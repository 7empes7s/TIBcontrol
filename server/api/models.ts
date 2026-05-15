import { readFileSync } from 'fs';

function detectProviderType(modelName: string, provider: string): "openrouter" | "groq" | "github" | "cerebras" | "local" | "zen" | "nvidia" | "cloudflare" | "opencode" | "alibaba" | "other" {
  const n = modelName.toLowerCase();
  const p = provider?.toLowerCase() ?? "";
  if (p === "zen") return "zen";
  if (p === "github") return "github";
  if (p === "groq") return "groq";
  if (p === "cerebras") return "cerebras";
  if (p === "alibaba" || n.startsWith("alibaba/")) return "alibaba";
  if (p === "opencode" || n.startsWith("opencode-go/")) return "opencode";
  if (p === "nvidia" || n.includes("nvidia")) return "nvidia";
  if (p === "cloudflare" || n.includes("cf-") || n.includes("cloudflare")) return "cloudflare";
  if (p === "local" || modelName.startsWith("editorial-") || modelName.startsWith("coding-") || modelName.startsWith("mimule-")) return "local";
  if (n.includes("openrouter")) return "openrouter";
  return "other";
}

function detectIsCli(modelName: string): boolean {
  const n = modelName.toLowerCase();
  return n.includes("codex") || n.includes("claude") || n.includes("opencode") || n.includes("gemini");
}

function detectIsOpenCode(modelName: string): boolean {
  const n = modelName.toLowerCase();
  return n.includes("opencode") || n.startsWith("oc-") || n.startsWith("alibaba/");
}

export type PricingTier = "free-local" | "free-rate-limited" | "subscription" | "api-paid";

function derivePricingTier(m: { provider?: string; logicalName?: string; modelId?: string; apiKeyEnv?: string }): PricingTier {
  const provider = String(m.provider || "").toLowerCase();
  const logicalName = String(m.logicalName || "");
  const modelId = String(m.modelId || "");
  const apiKeyEnv = String(m.apiKeyEnv || "");

  if (provider === "local") return "free-local";
  if (provider === "opencode" || provider === "alibaba") return "subscription";
  if (logicalName.startsWith("opencode-go/") || logicalName.startsWith("alibaba/")) return "subscription";
  if (provider === "cerebras") {
    if (logicalName.endsWith("-paid") || apiKeyEnv === "CEREBRAS_API_KEY_PAID") return "api-paid";
    return "free-rate-limited";
  }
  if (provider === "zen") {
    if (modelId.endsWith("-free") || modelId.includes(":free") || logicalName.includes("-free")) return "free-rate-limited";
    return "subscription";
  }
  if (provider === "openrouter") {
    if (modelId.endsWith(":free") || logicalName.endsWith("-free") || logicalName.includes("-free-")) return "free-rate-limited";
    return "api-paid";
  }
  if (provider === "groq" || provider === "github" || provider === "cloudflare" || provider === "nvidia") {
    return "free-rate-limited";
  }
  return "subscription";
}

function computeQualityStatus(available: boolean, hasError: boolean): "healthy" | "probation" | "degraded" | "blocked" | "unknown" {
  if (!available && hasError) return "blocked";
  if (!available) return "degraded";
  if (hasError) return "probation";
  return "healthy";
}

export function modelsHandler(): Response {
  try {
    const raw = readFileSync('/var/lib/mimule/model-health.json', 'utf8');
    const health = JSON.parse(raw);

    const models = health.models.map((m: any) => {
      const providerType = detectProviderType(m.logicalName, m.provider);
      // Prefer the tier persisted by model-health-check; fall back to derivation
      // for records written before the field existed.
      const pricingTier: PricingTier = (m.pricingTier as PricingTier) ?? derivePricingTier(m);
      const isFree = pricingTier === "free-local" || pricingTier === "free-rate-limited";
      const isSubscription = pricingTier === "subscription";
      const isPaid = pricingTier === "api-paid";
      const isCli = detectIsCli(m.logicalName);
      const isOpenCode = detectIsOpenCode(m.logicalName);
      const hasError = !!m.error;
      const available = m.available ?? false;
      const contextWindow = m.contextWindow || (m.params >= 200 ? 131072 : m.params >= 70 ? 32768 : 8192);

      const rating100 = typeof m.rating100 === "number" ? m.rating100 : null;
      const ratingBreakdown = m.ratingBreakdown ?? null;
      const rawWs = m.workloadScores as Record<string, unknown> | null | undefined;
      const workloadScores = rawWs != null ? {
        json: typeof rawWs.json === "number" ? rawWs.json : null,
        coding: typeof rawWs.coding === "number" ? rawWs.coding : null,
        writing: typeof rawWs.writing === "number" ? rawWs.writing : null,
        reasoning: typeof rawWs.reasoning === "number" ? rawWs.reasoning : null,
        lastProbedAt: typeof rawWs.lastProbedAt === "number" ? rawWs.lastProbedAt : null,
      } : null;

      return {
        logicalName: m.logicalName,
        provider: m.provider,
        capability: m.capability ?? "light",
        available,
        latency: m.latency ?? null,
        jsonOk: available && !hasError,
        checkedAt: m.checkedAt ?? 0,
        qualityStatus: computeQualityStatus(available, hasError),
        recentFailures: hasError ? 1 : 0,
        consecutiveGarbage: 0,
        isFree,
        isPaid,
        isSubscription,
        pricingTier,
        isOpenCode,
        isCli,
        providerType,
        contextWindow,
        params: m.params ?? null,
        resolvedModel: m.resolvedModel ?? m.modelId ?? m.logicalName,
        tier: m.provider === 'zen' ? (m.modelId?.includes('free') ? 'zen-free' : 'zen-paid') : m.provider,
        rating: rating100 ?? Math.round((10000 / (m.latency || 1000)) * 10) / 10,
        rating100,
        ratingBreakdown,
        workloadScores,
        errorCount: hasError ? 1 : 0,
        lastError: m.error ?? null,
        uptime: available ? '✅' : '❌',
        latencyMs: m.latency ?? 0,
      };
    });

    const summary = {
      bestCloudHeavy: health.bestCloudHeavy ?? null,
      bestCloudFast: health.bestCloudFast ?? null,
      bestLocal: health.bestLocal ?? null,
      availableByCapability: health.availableByCapability ?? { heavy: 0, medium: 0, light: 0 },
      qualitySummary: health.qualitySummary ?? { blocked: 0, degraded: 0, probation: 0 },
      lastFullCheckAgo: Date.now() - (health.lastFullCheckAt ?? 0),
      lastQuickCheckAgo: Date.now() - (health.lastQuickCheckAt ?? 0),
      newModelsAdded: health.newModelsAdded ?? [],
    };

    return Response.json({
      data: {
        models,
        cooldowns: [],
        fallbacks: health.fallbacks ?? {},
        summary,
        discoveryLog: [],
      }
    });
  } catch (e) {
    console.error('modelsHandler failed:', e);
    return Response.json({ error: 'model-health.json unreadable' }, { status: 500 });
  }
}