import { useMemo, useState, useCallback, useRef } from "react";
import { useApi, fmtAge } from "../hooks/useApi";
import { useAction } from "../hooks/useAction";
import { useTableSort, type SortValue } from "../hooks/useTableSort";
import { useTablePage } from "../hooks/useTablePage";
import { SortableTh } from "../components/SortableTh";
import { TableFilterChip } from "../components/TableFilterChip";
import { ConfirmModal } from "../components/ConfirmModal";
import { SectionCard } from "../components/SectionCard";
import { TablePageControls } from "../components/TablePageControls";
import type { ModelsDetail, RatingBreakdown, WorkloadScores } from "../../server/api/types";

type ModelRow = ModelsDetail["models"][number];

function Pill({ children, color = "gray" }: { children: React.ReactNode; color?: string }) {
  return <span className={`pill ${color}`}>{children}</span>;
}

function qualityColor(s: string): string {
  if (s === "healthy") return "green";
  if (s === "blocked") return "red";
  if (s === "degraded" || s === "probation") return "amber";
  return "gray";
}

function fmtContextWindow(ctx: number | null): string {
  if (!ctx) return "—";
  if (ctx >= 1_000_000) return `${(ctx / 1_000_000).toFixed(0)}M`;
  if (ctx >= 1000) return `${(ctx / 1000).toFixed(0)}K`;
  return String(ctx);
}

type SortKey =
  | "logicalName" | "capability" | "qualityStatus" | "pricing" | "providerType"
  | "isCli" | "provider" | "contextWindow" | "rating" | "latency" | "jsonOk" | "recentFailures";

type PricingTier = "free-local" | "free-rate-limited" | "subscription" | "api-paid";

const TIER_LABEL: Record<PricingTier, string> = {
  "free-local": "free·local",
  "free-rate-limited": "free·rl",
  "subscription": "sub",
  "api-paid": "paid",
};

const TIER_PILL_COLOR: Record<PricingTier, string> = {
  "free-local": "green",
  "free-rate-limited": "green",
  "subscription": "blue",
  "api-paid": "amber",
};

const TIER_TITLE: Record<PricingTier, string> = {
  "free-local": "Runs on owned hardware (RTX 3090)",
  "free-rate-limited": "Third-party free quota (OpenRouter :free, Groq, GitHub Models, Cloudflare, NVIDIA NIM)",
  "subscription": "Included with paid subscription (OpenCode Pro, Zen GPT-5/Claude, Alibaba via opencode-server)",
  "api-paid": "Pay-as-you-go API charged per request (last-resort fallback)",
};

function pricingTierOf(m: ModelRow): PricingTier {
  const t = (m as { pricingTier?: string }).pricingTier;
  if (t === "free-local" || t === "free-rate-limited" || t === "subscription" || t === "api-paid") return t;
  // Derive from legacy fields if pricingTier missing on the wire.
  if (m.provider === "local") return "free-local";
  if (m.isFree) return "free-rate-limited";
  if (m.isPaid) return "api-paid";
  return "subscription";
}

function ratingColor(score: number | null): string {
  if (score == null) return "var(--text-dim)";
  if (score >= 80) return "var(--green)";
  if (score >= 60) return "var(--text)";
  return "var(--amber)";
}

function RatingCell({ rating100, ratingBreakdown, workloadScores }: {
  rating100: number | null;
  ratingBreakdown: RatingBreakdown | null;
  workloadScores: WorkloadScores | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  if (rating100 == null) return <span className="dim">—</span>;

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <span
        style={{ color: ratingColor(rating100), cursor: "help", fontFamily: "var(--mono)", fontSize: 12 }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen(v => !v)}
      >
        {rating100}/100
      </span>
      {open && ratingBreakdown && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)",
          background: "var(--surface-2, #1a1f2e)", border: "1px solid var(--border)", borderRadius: 6,
          padding: "10px 12px", zIndex: 100, minWidth: 220, maxWidth: 280,
          boxShadow: "0 4px 16px rgba(0,0,0,0.5)", fontSize: 11, lineHeight: 1.6,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 6, color: ratingColor(rating100), fontFamily: "var(--mono)" }}>
            {rating100}/100 · {ratingBreakdown.confidence}% confidence
          </div>
          {Object.entries(ratingBreakdown.components).map(([key, c]) => (
            <div key={key} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span style={{ color: "var(--text-dim)" }}>{key}</span>
              <span style={{ fontFamily: "var(--mono)", color: "var(--text)" }}>
                {c.score.toFixed(0)} × {(c.weight * 100).toFixed(0)}% = <b>{c.contribution.toFixed(1)}</b>
              </span>
            </div>
          ))}
          {ratingBreakdown.missing.length > 0 && (
            <div style={{ marginTop: 6, color: "var(--text-dim)", fontSize: 10 }}>
              missing: {ratingBreakdown.missing.join(", ")}
            </div>
          )}
          {workloadScores && (
            <div style={{ marginTop: 6, borderTop: "1px solid var(--border)", paddingTop: 6, color: "var(--text-dim)", fontSize: 10 }}>
              json {workloadScores.json ?? "—"} · coding {workloadScores.coding ?? "—"} · writing {workloadScores.writing ?? "—"} · reasoning {workloadScores.reasoning ?? "—"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type Modal =
  | { type: "block"; model: string }
  | { type: "unblock"; model: string }
  | { type: "probation-clear"; model: string }
  | { type: "run-check" };

export function ModelsPage() {
  const { data, loading, error, refresh } = useApi<ModelsDetail>("/api/models", 30_000);
  const [modal, setModal] = useState<Modal | null>(null);
  const action = useAction("/api/models/action");

  const [search, setSearch] = useState("");
  const [capFilter, setCapFilter] = useState<Set<string>>(new Set());
  const [qualityFilter, setQualityFilter] = useState<Set<string>>(new Set());
  const [pricingFilter, setPricingFilter] = useState<Set<PricingTier>>(new Set());
  const [providerFilter, setProviderFilter] = useState<string>("");
  const [cliOnly, setCliOnly] = useState(false);
  const [availableOnly, setAvailableOnly] = useState(false);

  const models = data?.models ?? [];

  const providerOptions = useMemo(() => {
    const set = new Set<string>();
    for (const m of models) if (m.provider) set.add(m.provider);
    return Array.from(set).sort();
  }, [models]);

  const counts = useMemo(() => {
    const byCap = { heavy: 0, medium: 0, light: 0 };
    const byQuality = { healthy: 0, probation: 0, degraded: 0, blocked: 0, unknown: 0 };
    const byPricing: Record<PricingTier, number> = {
      "free-local": 0, "free-rate-limited": 0, "subscription": 0, "api-paid": 0,
    };
    for (const m of models) {
      const c = m.capability as keyof typeof byCap;
      if (c in byCap) byCap[c]++;
      const q = m.qualityStatus as keyof typeof byQuality;
      if (q in byQuality) byQuality[q]++;
      byPricing[pricingTierOf(m)]++;
    }
    return { byCap, byQuality, byPricing };
  }, [models]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return models.filter((m) => {
      if (q && !m.logicalName.toLowerCase().includes(q) && !m.provider.toLowerCase().includes(q) && !(m.resolvedModel ?? "").toLowerCase().includes(q)) return false;
      if (capFilter.size > 0 && !capFilter.has(m.capability)) return false;
      if (qualityFilter.size > 0 && !qualityFilter.has(m.qualityStatus)) return false;
      if (pricingFilter.size > 0 && !pricingFilter.has(pricingTierOf(m))) return false;
      if (providerFilter && m.provider !== providerFilter) return false;
      if (cliOnly && !m.isCli) return false;
      if (availableOnly && !m.available) return false;
      return true;
    });
  }, [models, search, capFilter, qualityFilter, pricingFilter, providerFilter, cliOnly, availableOnly]);

  const accessor = useCallback((m: ModelRow, key: SortKey): SortValue => {
    switch (key) {
      case "logicalName": return m.logicalName;
      case "capability": {
        const order: Record<string, number> = { heavy: 0, medium: 1, light: 2 };
        return order[m.capability] ?? 3;
      }
      case "qualityStatus": {
        const order: Record<string, number> = { healthy: 0, probation: 1, degraded: 2, blocked: 3, unknown: 4 };
        return order[m.qualityStatus] ?? 5;
      }
      case "pricing": {
        const order: Record<PricingTier, number> = {
          "free-local": 0, "free-rate-limited": 1, "subscription": 2, "api-paid": 3,
        };
        return order[pricingTierOf(m)];
      }
      case "providerType": return m.providerType;
      case "isCli": return m.isCli;
      case "provider": return m.provider;
      case "contextWindow": return m.contextWindow ?? -1;
      case "rating": return (m as { rating100?: number | null }).rating100 ?? (m as { rating?: number }).rating ?? -1;
      case "latency": return m.latency ?? Number.MAX_SAFE_INTEGER;
      case "jsonOk": return m.jsonOk;
      case "recentFailures": return m.recentFailures;
      default: return null;
    }
  }, []);

  const { sorted, sort, onSort } = useTableSort<ModelRow, SortKey>(filtered, {
    defaultKey: "qualityStatus",
    defaultDir: "asc",
    tieBreak: ["capability", "latency", "logicalName"],
    accessor,
  });

  const modelsPage = useTablePage(sorted);
  const cooldownsPage = useTablePage(data?.cooldowns ?? []);
  const discoveryLogPage = useTablePage([...(data?.discoveryLog ?? [])].reverse());

  // Ratings: models sorted by rating100 desc
  const ratedModels = useMemo(() => {
    return [...models]
      .filter(m => (m as { rating100?: number | null }).rating100 != null)
      .sort((a, b) => ((b as { rating100?: number | null }).rating100 ?? -1) - ((a as { rating100?: number | null }).rating100 ?? -1));
  }, [models]);
  const ratingsPage = useTablePage(ratedModels);
  const [ratingSelected, setRatingSelected] = useState<string[]>([]);

  const toggleRatingSelect = (name: string) =>
    setRatingSelected(prev => prev.includes(name) ? prev.filter(n => n !== name) : prev.length >= 6 ? prev : [...prev, name]);

  const selectedForComparison = useMemo(
    () => ratingSelected.map(n => models.find(m => m.logicalName === n)).filter(Boolean) as ModelRow[],
    [models, ratingSelected],
  );

  const toggleSet = <T,>(set: Set<T>, value: T, setter: (s: Set<T>) => void) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value); else next.add(value);
    setter(next);
  };

  const clearFilters = () => {
    setSearch("");
    setCapFilter(new Set());
    setQualityFilter(new Set());
    setPricingFilter(new Set());
    setProviderFilter("");
    setCliOnly(false);
    setAvailableOnly(false);
  };

  const hasActiveFilter = search !== "" || capFilter.size > 0 || qualityFilter.size > 0
    || pricingFilter.size > 0 || providerFilter !== "" || cliOnly || availableOnly;

  if (loading && !data) return <div className="loading-dim">loading…</div>;
  if (error && !data) return <div className="loading-dim error">error: {error}</div>;
  if (!data) return null;

  const d = data;
  const s = d.summary;

  return (
    <div className="dash-page">
      <div className="page-header">
        <div className="page-title">Models</div>
        <div className="stat-row">
          <div className="stat-item">
            <div className="stat-lbl">best heavy</div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--accent)", marginTop: 2 }}>{s.bestCloudHeavy ?? "—"}</div>
          </div>
          <div className="stat-item">
            <div className="stat-lbl">best fast</div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--text)", marginTop: 2 }}>{s.bestCloudFast ?? "—"}</div>
          </div>
          <div className="stat-item">
            <div className="stat-lbl">best local</div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--text)", marginTop: 2 }}>{s.bestLocal ?? "—"}</div>
          </div>
          <div className="stat-item">
            <div className="stat-lbl">full check</div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>{fmtAge(s.lastFullCheckAgo)}</div>
          </div>
          <div className="stat-item">
            <div className="stat-lbl">quick check</div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>{fmtAge(s.lastQuickCheckAgo)}</div>
          </div>
        </div>
      </div>

      {modal && (
        <ConfirmModal
          title={
            modal.type === "block" ? `Block ${modal.model}?` :
            modal.type === "unblock" ? `Unblock ${modal.model}?` :
            modal.type === "probation-clear" ? `Clear probation for ${modal.model}?` :
            "Run model health check?"
          }
          message={
            modal.type === "block"
              ? `${modal.model} will be marked blocked and excluded from fallback chains.`
              : modal.type === "unblock"
              ? `${modal.model} will be restored to healthy status.`
              : modal.type === "probation-clear"
              ? `${modal.model} will be cleared from probation and restored to healthy status.`
              : "Triggers the model-health-check.service immediately."
          }
          confirmLabel={
            modal.type === "block" ? "Block" :
            modal.type === "unblock" ? "Unblock" :
            modal.type === "probation-clear" ? "Clear" :
            "Run"
          }
          danger={modal.type === "block"}
          loading={action.loading}
          error={action.error}
          onCancel={() => { setModal(null); action.reset(); }}
          onConfirm={async () => {
            let body: unknown;
            if (modal.type === "block") body = { action: "block", model: modal.model };
            else if (modal.type === "unblock") body = { action: "unblock", model: modal.model };
            else if (modal.type === "probation-clear") body = { action: "probation-clear", model: modal.model };
            else body = { action: "run-quick-check" };
            const ok = await action.run(body);
            if (ok) { setModal(null); refresh(); }
          }}
        />
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <Pill color="blue">heavy {s.availableByCapability.heavy}</Pill>
        <Pill color="gray">medium {s.availableByCapability.medium}</Pill>
        <Pill color="gray">light {s.availableByCapability.light}</Pill>
        {s.qualitySummary.blocked > 0 && <Pill color="red">blocked {s.qualitySummary.blocked}</Pill>}
        {s.qualitySummary.degraded > 0 && <Pill color="amber">degraded {s.qualitySummary.degraded}</Pill>}
        {s.qualitySummary.probation > 0 && <Pill color="amber">probation {s.qualitySummary.probation}</Pill>}
        {s.newModelsAdded.length > 0 && <Pill color="green">+{s.newModelsAdded.length} new</Pill>}
      </div>

      <div className="action-bar" style={{ marginBottom: 12 }}>
        <button className="btn btn-ghost" onClick={() => setModal({ type: "run-check" })}>
          Run health check
        </button>
        {action.success && <span className="action-feedback ok">{action.success}</span>}
        {action.error && <span className="action-feedback err">{action.error}</span>}
      </div>

      <div className="table-filter-bar">
        <input
          className="filter-input"
          type="search"
          placeholder="search name / provider / model id"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <span className="filter-group-label">cap</span>
        <TableFilterChip label={`heavy ${counts.byCap.heavy}`} active={capFilter.has("heavy")} onClick={() => toggleSet(capFilter, "heavy", setCapFilter)} />
        <TableFilterChip label={`medium ${counts.byCap.medium}`} active={capFilter.has("medium")} onClick={() => toggleSet(capFilter, "medium", setCapFilter)} />
        <TableFilterChip label={`light ${counts.byCap.light}`} active={capFilter.has("light")} onClick={() => toggleSet(capFilter, "light", setCapFilter)} />

        <span className="filter-group-label">quality</span>
        <TableFilterChip label={`healthy ${counts.byQuality.healthy}`} active={qualityFilter.has("healthy")} onClick={() => toggleSet(qualityFilter, "healthy", setQualityFilter)} />
        <TableFilterChip label={`probation ${counts.byQuality.probation}`} active={qualityFilter.has("probation")} onClick={() => toggleSet(qualityFilter, "probation", setQualityFilter)} />
        <TableFilterChip label={`degraded ${counts.byQuality.degraded}`} active={qualityFilter.has("degraded")} onClick={() => toggleSet(qualityFilter, "degraded", setQualityFilter)} />
        <TableFilterChip label={`blocked ${counts.byQuality.blocked}`} active={qualityFilter.has("blocked")} onClick={() => toggleSet(qualityFilter, "blocked", setQualityFilter)} />

        <span className="filter-group-label">pricing</span>
        <TableFilterChip label={`local ${counts.byPricing["free-local"]}`}        active={pricingFilter.has("free-local")}        onClick={() => toggleSet(pricingFilter, "free-local", setPricingFilter)}        title={TIER_TITLE["free-local"]} />
        <TableFilterChip label={`free·rl ${counts.byPricing["free-rate-limited"]}`} active={pricingFilter.has("free-rate-limited")} onClick={() => toggleSet(pricingFilter, "free-rate-limited", setPricingFilter)} title={TIER_TITLE["free-rate-limited"]} />
        <TableFilterChip label={`sub ${counts.byPricing.subscription}`}            active={pricingFilter.has("subscription")}      onClick={() => toggleSet(pricingFilter, "subscription", setPricingFilter)}      title={TIER_TITLE.subscription} />
        <TableFilterChip label={`paid ${counts.byPricing["api-paid"]}`}            active={pricingFilter.has("api-paid")}          onClick={() => toggleSet(pricingFilter, "api-paid", setPricingFilter)}          title={TIER_TITLE["api-paid"]} />

        <span className="filter-group-label">provider</span>
        <select className="filter-select" value={providerFilter} onChange={(e) => setProviderFilter(e.target.value)}>
          <option value="">all</option>
          {providerOptions.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>

        <TableFilterChip label="CLI only" active={cliOnly} onClick={() => setCliOnly((v) => !v)} />
        <TableFilterChip label="available" active={availableOnly} onClick={() => setAvailableOnly((v) => !v)} title="Hide unavailable models" />

        {hasActiveFilter && <button className="filter-clear" onClick={clearFilters}>clear filters</button>}

        <span className="filter-count">{sorted.length} / {models.length}</span>
      </div>

      <SectionCard
        title="all models"
        id="current"
        defaultOpen={false}
        right={<span className="dim" style={{ fontFamily: "var(--mono)", fontSize: 10 }}>{sorted.length} shown · {models.length} total</span>}
      >
        <div className="section-card-body table-wrap">
          <table className="data-table models-table">
            <colgroup>
              <col className="name-col" />
              <col className="cap-col" />
              <col className="quality-col" />
              <col className="actions-col" />
              <col className="price-col" />
              <col className="type-col" />
              <col className="cli-col" />
              <col className="provider-col" />
              <col className="ctx-col" />
              <col className="rating-col" />
              <col className="latency-col" />
              <col className="json-col" />
              <col className="fails-col" />
            </colgroup>
            <thead><tr>
              <SortableTh<SortKey> sortKey="logicalName" sort={sort} onSort={onSort}>logical name</SortableTh>
              <SortableTh<SortKey> sortKey="capability" sort={sort} onSort={onSort}>cap</SortableTh>
              <SortableTh<SortKey> sortKey="qualityStatus" sort={sort} onSort={onSort}>quality</SortableTh>
              <th></th>
              <SortableTh<SortKey> sortKey="pricing" sort={sort} onSort={onSort} className="price-col">pricing</SortableTh>
              <SortableTh<SortKey> sortKey="providerType" sort={sort} onSort={onSort} className="type-col">type</SortableTh>
              <SortableTh<SortKey> sortKey="isCli" sort={sort} onSort={onSort} className="cli-col">CLI</SortableTh>
              <SortableTh<SortKey> sortKey="provider" sort={sort} onSort={onSort} className="models-col-provider provider-col">provider</SortableTh>
              <SortableTh<SortKey> sortKey="contextWindow" sort={sort} onSort={onSort} className="ctx-col">ctx</SortableTh>
              <SortableTh<SortKey> sortKey="rating" sort={sort} onSort={onSort} className="rating-col">rating</SortableTh>
              <SortableTh<SortKey> sortKey="latency" sort={sort} onSort={onSort} className="latency-col models-col-latency">latency</SortableTh>
              <SortableTh<SortKey> sortKey="jsonOk" sort={sort} onSort={onSort} className="models-col-json">json</SortableTh>
              <SortableTh<SortKey> sortKey="recentFailures" sort={sort} onSort={onSort} className="models-col-failures">fails</SortableTh>
            </tr></thead>
            <tbody>
              {modelsPage.slice.map((m) => (
                <tr key={m.logicalName}>
                  <td className="mono" style={{ color: m.available ? "var(--text-bright)" : "var(--text-dim)" }}>{m.logicalName}</td>
                  <td><Pill color={m.capability === "heavy" ? "blue" : "gray"}>{m.capability}</Pill></td>
                  <td><Pill color={qualityColor(m.qualityStatus)}>{m.qualityStatus}</Pill></td>
                  <td className="actions-col">
                    <div className="mobile-stack" style={{ display: "flex", gap: 4 }}>
                      {m.qualityStatus === "blocked" ? (
                        <button className="btn btn-sm btn-primary" onClick={() => setModal({ type: "unblock", model: m.logicalName })}>unblock</button>
                      ) : m.qualityStatus === "probation" ? (
                        <>
                          <button className="btn btn-sm btn-primary" onClick={() => setModal({ type: "probation-clear", model: m.logicalName })}>clear</button>
                          <button className="btn btn-sm btn-danger" onClick={() => setModal({ type: "block", model: m.logicalName })}>block</button>
                        </>
                      ) : (
                        <button className="btn btn-sm btn-danger" onClick={() => setModal({ type: "block", model: m.logicalName })}>block</button>
                      )}
                    </div>
                  </td>
                  <td className="price-col">
                    {(() => {
                      const tier = pricingTierOf(m);
                      return <Pill color={TIER_PILL_COLOR[tier]}><span title={TIER_TITLE[tier]}>{TIER_LABEL[tier]}</span></Pill>;
                    })()}
                    {m.isOpenCode && <span className="text-xs" style={{ marginLeft: 4 }} title="OpenCode native">🔷</span>}
                  </td>
                  <td className="type-col"><Pill>{m.providerType}</Pill></td>
                  <td className="cli-col">{m.isCli ? <Pill color="blue">CLI</Pill> : "—"}</td>
                  <td className="dim mono models-col-provider provider-col">{m.provider}</td>
                  <td className="mono dim ctx-col">{fmtContextWindow(m.contextWindow)}</td>
                  <td className="rating-col">
                    <RatingCell
                      rating100={(m as { rating100?: number | null }).rating100 ?? null}
                      ratingBreakdown={(m as { ratingBreakdown?: RatingBreakdown | null }).ratingBreakdown ?? null}
                      workloadScores={(m as { workloadScores?: WorkloadScores | null }).workloadScores ?? null}
                    />
                  </td>
                  <td className="mono dim latency-col models-col-latency">{m.latency != null ? `${m.latency}ms` : "—"}</td>
                  <td className="models-col-json"><Pill color={m.jsonOk ? "green" : "red"}>{m.jsonOk ? "✓" : "✗"}</Pill></td>
                  <td className="mono dim models-col-failures">
                    {m.recentFailures > 0 ? <span className="text-red">{m.recentFailures}</span> : "0"}
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr><td colSpan={13} className="loading-dim" style={{ textAlign: "center", padding: 24 }}>no models match filters</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <TablePageControls {...modelsPage} onPrev={modelsPage.prev} onNext={modelsPage.next} onSetPageSize={modelsPage.setPageSize} noun="models" />
      </SectionCard>

      {/* ── Ratings ──────────────────────────────────────────────────────── */}
      <SectionCard
        title="ratings"
        id="ratings"
        defaultOpen={false}
        right={<span className="dim" style={{ fontFamily: "var(--mono)", fontSize: 10 }}>{ratedModels.length} rated</span>}
      >
        <div className="section-card-body">
          {ratedModels.length === 0 ? (
            <div className="loading-dim" style={{ padding: 16 }}>
              No ratings yet — run a full model-health-check to populate scores.
              <br /><code style={{ fontSize: 11 }}>systemctl start model-health-check.service</code>
            </div>
          ) : (
            <>
              {selectedForComparison.length > 0 && (
                <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 11, color: "var(--text-dim)" }}>comparing {selectedForComparison.length} model{selectedForComparison.length > 1 ? "s" : ""}</span>
                    <button className="btn btn-sm btn-ghost" onClick={() => setRatingSelected([])}>clear</button>
                  </div>
                  <div className="ratings-grid">
                    {selectedForComparison.map(m => <BreakdownCard key={m.logicalName} m={m} />)}
                  </div>
                </div>
              )}
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>model</th>
                      <th>cap</th>
                      <th style={{ textAlign: "right" }}>rating</th>
                      <th style={{ textAlign: "right" }}>json</th>
                      <th style={{ textAlign: "right" }}>coding</th>
                      <th style={{ textAlign: "right" }}>writing</th>
                      <th style={{ textAlign: "right" }}>reasoning</th>
                      <th style={{ textAlign: "right" }}>latency</th>
                      <th>pricing</th>
                      <th>conf.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ratingsPage.slice.map(m => {
                      const r100 = (m as { rating100?: number | null }).rating100;
                      const bd = (m as { ratingBreakdown?: RatingBreakdown | null }).ratingBreakdown;
                      const ws = (m as { workloadScores?: WorkloadScores | null }).workloadScores;
                      const isSelected = ratingSelected.includes(m.logicalName);
                      const tier = pricingTierOf(m);
                      return (
                        <tr
                          key={m.logicalName}
                          onClick={() => toggleRatingSelect(m.logicalName)}
                          style={{ cursor: "pointer", background: isSelected ? "color-mix(in oklch, var(--accent) 8%, transparent)" : undefined }}
                        >
                          <td className="mono" style={{ color: m.available ? "var(--text-bright)" : "var(--text-dim)" }}>
                            {isSelected && <span style={{ color: "var(--accent)", marginRight: 6 }}>●</span>}
                            {m.logicalName}
                          </td>
                          <td><Pill color={m.capability === "heavy" ? "blue" : "gray"}>{m.capability}</Pill></td>
                          <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 12, color: ratingColor(r100 ?? null) }}>
                            {r100 != null ? `${r100}` : "—"}
                          </td>
                          <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)" }}>{ws?.json ?? "—"}</td>
                          <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)" }}>{ws?.coding ?? "—"}</td>
                          <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)" }}>{ws?.writing ?? "—"}</td>
                          <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)" }}>{ws?.reasoning ?? "—"}</td>
                          <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)" }}>{m.latency != null ? `${m.latency}ms` : "—"}</td>
                          <td><Pill color={TIER_PILL_COLOR[tier]}>{TIER_LABEL[tier]}</Pill></td>
                          <td style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)" }}>{bd ? `${bd.confidence}%` : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <TablePageControls {...ratingsPage} onPrev={ratingsPage.prev} onNext={ratingsPage.next} onSetPageSize={ratingsPage.setPageSize} noun="rated models" />
            </>
          )}
        </div>
      </SectionCard>

      <SectionCard title="fallback chains" defaultOpen={false}>
        <div className="section-card-body" style={{ padding: "12px 14px" }}>
          <div className="chain-list">
            {Object.entries(d.fallbacks).map(([chain, mods]) => (
              <div key={chain} className="chain-item">
                <div className="chain-name">{chain}</div>
                <div className="chain-models">
                  {mods.map((m, i) => (
                    <span key={m} className={`chain-model ${i === 0 ? "first" : ""}`}>{i + 1}. {m}</span>
                  ))}
                </div>
              </div>
            ))}
            {Object.keys(d.fallbacks).length === 0 && <div className="loading-dim">no fallback chains in health file</div>}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="active cooldowns"
        id="cooldowns"
        defaultOpen={false}
        right={<span className="dim" style={{ fontFamily: "var(--mono)", fontSize: 10 }}>{d.cooldowns.length}</span>}
      >
        <div className="section-card-body table-wrap">
          {d.cooldowns.length === 0 ? (
            <div className="loading-dim">no active cooldowns</div>
          ) : (
            <>
              <table className="data-table">
                <thead><tr><th>model</th><th>expires</th><th>reason</th></tr></thead>
                <tbody>
                  {cooldownsPage.slice.map((c) => (
                    <tr key={c.model}>
                      <td className="mono">{c.model}</td>
                      <td className="mono dim">{new Date(c.expiresAt).toISOString().slice(0, 19).replace("T", " ")} UTC</td>
                      <td className="dim">{c.reason ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <TablePageControls {...cooldownsPage} onPrev={cooldownsPage.prev} onNext={cooldownsPage.next} onSetPageSize={cooldownsPage.setPageSize} noun="cooldowns" />
            </>
          )}
        </div>
      </SectionCard>

      <SectionCard title="discovery log" id="new" defaultOpen={false}>
        <div className="section-card-body table-wrap">
          {d.discoveryLog.length === 0 ? (
            <div className="loading-dim">discovery log not yet created — will appear after next full model-health-check run</div>
          ) : (
            <>
              <table className="data-table">
                <thead><tr><th>time</th><th>new models</th><th>total</th></tr></thead>
                <tbody>
                  {discoveryLogPage.slice.map((entry, i) => (
                    <tr key={i}>
                      <td className="mono dim">{entry.ts.slice(0, 19).replace("T", " ")}</td>
                      <td>
                        {entry.newModelsAdded.length > 0
                          ? entry.newModelsAdded.map((m) => <span key={m} className="chain-model" style={{ marginRight: 4 }}>{m}</span>)
                          : <span className="dim">none</span>}
                      </td>
                      <td className="mono dim">{entry.totalModelCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <TablePageControls {...discoveryLogPage} onPrev={discoveryLogPage.prev} onNext={discoveryLogPage.next} onSetPageSize={discoveryLogPage.setPageSize} noun="entries" />
            </>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

// ── Breakdown card (used in ratings comparison) ───────────────────────────────

function scoreBar(score: number | null) {
  if (score == null) return <span className="dim">—</span>;
  const pct = Math.round((score / 100) * 100);
  const color = score >= 80 ? "var(--green)" : score >= 60 ? "var(--accent)" : "var(--amber)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ flex: 1, height: 5, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontFamily: "var(--mono)", fontSize: 11, color, minWidth: 24, textAlign: "right" }}>{score}</span>
    </div>
  );
}

function BreakdownCard({ m }: { m: ModelRow }) {
  const r = (m as { ratingBreakdown?: RatingBreakdown | null }).ratingBreakdown;
  const ws = (m as { workloadScores?: WorkloadScores | null }).workloadScores;
  const r100 = (m as { rating100?: number | null }).rating100;
  const tier = pricingTierOf(m);

  return (
    <div className="ratings-card">
      <div className="ratings-card-name">{m.logicalName}</div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4, flexWrap: "wrap" }}>
        <span className={`pill ${m.capability === "heavy" ? "blue" : "gray"}`}>{m.capability}</span>
        <Pill color={TIER_PILL_COLOR[tier]}>{TIER_LABEL[tier]}</Pill>
        {m.available ? <Pill color="green">up</Pill> : <Pill color="red">down</Pill>}
      </div>

      <div className="ratings-card-score" style={{ margin: "10px 0 6px" }}>
        {r100 != null ? (
          <>
            <span style={{ fontSize: 30, fontFamily: "var(--mono)", color: ratingColor(r100), fontWeight: 700 }}>{r100}</span>
            <span style={{ fontSize: 13, color: "var(--text-dim)", marginLeft: 2 }}>/100</span>
            {r && <span style={{ fontSize: 10, color: "var(--text-dim)", marginLeft: 8 }}>{r.confidence}% conf.</span>}
          </>
        ) : (
          <span style={{ color: "var(--text-dim)", fontSize: 13 }}>no rating</span>
        )}
      </div>

      {r && Object.keys(r.components).length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Breakdown</div>
          {Object.entries(r.components).map(([key, c]) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
              <span style={{ color: "var(--text-dim)", fontSize: 10, width: 70 }}>{key}</span>
              <div style={{ flex: 1 }}>{scoreBar(c.score)}</div>
              <span style={{ fontSize: 10, color: "var(--text-dim)", width: 28, textAlign: "right" }}>{(c.weight * 100).toFixed(0)}%</span>
            </div>
          ))}
          {r.missing.length > 0 && <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 4 }}>missing: {r.missing.join(", ")}</div>}
        </div>
      )}

      {ws && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Workload scores</div>
          {[["JSON", ws.json], ["Coding", ws.coding], ["Writing", ws.writing], ["Reasoning", ws.reasoning]].map(([label, score]) => (
            <div key={String(label)} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
              <span style={{ color: "var(--text-dim)", fontSize: 10, width: 60 }}>{label}</span>
              <div style={{ flex: 1 }}>{scoreBar(typeof score === "number" ? score : null)}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 8, borderTop: "1px solid var(--border)", paddingTop: 6, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3, fontSize: 11 }}>
        <div><span style={{ color: "var(--text-dim)" }}>latency </span><span style={{ fontFamily: "var(--mono)" }}>{m.latency != null ? `${m.latency}ms` : "—"}</span></div>
        <div><span style={{ color: "var(--text-dim)" }}>quality </span><Pill color={qualityColor(m.qualityStatus)}>{m.qualityStatus}</Pill></div>
      </div>
    </div>
  );
}
