import { useMemo, useState } from "react";
import { useApi } from "../hooks/useApi";
import { SectionCard } from "../components/SectionCard";
import type { ModelsDetail, WorkloadScores, RatingBreakdown } from "../../server/api/types";

type ModelRow = ModelsDetail["models"][number];

type PricingTier = "free-local" | "free-rate-limited" | "subscription" | "api-paid";

const TIER_LABEL: Record<PricingTier, string> = {
  "free-local": "free·local",
  "free-rate-limited": "free·rl",
  "subscription": "sub",
  "api-paid": "paid",
};

const TIER_COLOR: Record<PricingTier, string> = {
  "free-local": "var(--green)",
  "free-rate-limited": "var(--green)",
  "subscription": "var(--blue, #5b7ec9)",
  "api-paid": "var(--amber)",
};

function scoreBar(score: number | null, max = 100) {
  if (score == null) return null;
  const pct = Math.round((score / max) * 100);
  const color = score >= 80 ? "var(--green)" : score >= 60 ? "var(--accent)" : "var(--amber)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ flex: 1, height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontFamily: "var(--mono)", fontSize: 11, color, minWidth: 28, textAlign: "right" }}>{score}</span>
    </div>
  );
}

function WorkloadRow({ label, score }: { label: string; score: number | null }) {
  return (
    <tr>
      <td style={{ color: "var(--text-dim)", fontSize: 11, paddingRight: 8, whiteSpace: "nowrap" }}>{label}</td>
      <td style={{ width: "100%" }}>{scoreBar(score)}</td>
    </tr>
  );
}

function BreakdownCard({ m }: { m: ModelRow }) {
  const r = (m as { ratingBreakdown?: RatingBreakdown | null }).ratingBreakdown;
  const ws = (m as { workloadScores?: WorkloadScores | null }).workloadScores;
  const r100 = (m as { rating100?: number | null }).rating100;
  const tier = ((m as { pricingTier?: string }).pricingTier ?? "subscription") as PricingTier;

  return (
    <div className="ratings-card">
      <div className="ratings-card-header">
        <div className="ratings-card-name">{m.logicalName}</div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4, flexWrap: "wrap" }}>
          <span className={`pill ${m.capability === "heavy" ? "blue" : "gray"}`}>{m.capability}</span>
          <span style={{ fontSize: 10, color: TIER_COLOR[tier] }}>{TIER_LABEL[tier]}</span>
          {m.available
            ? <span className="pill green" style={{ fontSize: 10 }}>up</span>
            : <span className="pill red" style={{ fontSize: 10 }}>down</span>}
        </div>
      </div>

      <div className="ratings-card-score">
        {r100 != null ? (
          <>
            <span style={{ fontSize: 32, fontFamily: "var(--mono)", color: r100 >= 80 ? "var(--green)" : r100 >= 60 ? "var(--text)" : "var(--amber)", fontWeight: 700 }}>{r100}</span>
            <span style={{ fontSize: 14, color: "var(--text-dim)", marginLeft: 2 }}>/100</span>
            {r && <span style={{ fontSize: 10, color: "var(--text-dim)", marginLeft: 8 }}>{r.confidence}% conf.</span>}
          </>
        ) : (
          <span style={{ color: "var(--text-dim)", fontSize: 14 }}>no rating</span>
        )}
      </div>

      {r && Object.keys(r.components).length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Breakdown</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {Object.entries(r.components).map(([key, c]) => (
                <tr key={key}>
                  <td style={{ color: "var(--text-dim)", fontSize: 11, paddingRight: 8, whiteSpace: "nowrap" }}>{key}</td>
                  <td style={{ width: "100%" }}>{scoreBar(c.score)}</td>
                  <td style={{ fontSize: 10, color: "var(--text-dim)", paddingLeft: 6, whiteSpace: "nowrap" }}>{(c.weight * 100).toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          {r.missing.length > 0 && (
            <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 4 }}>missing: {r.missing.join(", ")}</div>
          )}
        </div>
      )}

      {ws && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Workload scores</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              <WorkloadRow label="JSON" score={ws.json} />
              <WorkloadRow label="Coding" score={ws.coding} />
              <WorkloadRow label="Writing" score={ws.writing} />
              <WorkloadRow label="Reasoning" score={ws.reasoning} />
            </tbody>
          </table>
          {ws.lastProbedAt && (
            <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 4 }}>
              probed {new Date(ws.lastProbedAt).toISOString().slice(0, 16).replace("T", " ")} UTC
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 10, borderTop: "1px solid var(--border)", paddingTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, fontSize: 11 }}>
        <div><span style={{ color: "var(--text-dim)" }}>latency </span><span style={{ fontFamily: "var(--mono)" }}>{m.latency != null ? `${m.latency}ms` : "—"}</span></div>
        <div><span style={{ color: "var(--text-dim)" }}>quality </span><span className={`pill ${m.qualityStatus === "healthy" ? "green" : m.qualityStatus === "blocked" ? "red" : "amber"}`} style={{ fontSize: 10 }}>{m.qualityStatus}</span></div>
        <div><span style={{ color: "var(--text-dim)" }}>fails </span><span style={{ fontFamily: "var(--mono)", color: m.recentFailures > 0 ? "var(--amber)" : "var(--text-dim)" }}>{m.recentFailures}</span></div>
        <div><span style={{ color: "var(--text-dim)" }}>json </span><span className={`pill ${m.jsonOk ? "green" : "red"}`} style={{ fontSize: 10 }}>{m.jsonOk ? "✓" : "✗"}</span></div>
      </div>
    </div>
  );
}

export function RatingsPage() {
  const { data, loading, error } = useApi<ModelsDetail>("/api/models", 60_000);

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [capFilter, setCapFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"rating100" | "latency" | "quality">("rating100");

  const models = data?.models ?? [];

  // Models with rating100 set, sorted descending
  const rankedModels = useMemo(() => {
    const filtered = models.filter(m => {
      if (capFilter !== "all" && m.capability !== capFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!m.logicalName.toLowerCase().includes(q) && !m.provider.toLowerCase().includes(q)) return false;
      }
      return true;
    });
    return [...filtered].sort((a, b) => {
      if (sortBy === "rating100") {
        const ra = (a as { rating100?: number | null }).rating100 ?? -1;
        const rb = (b as { rating100?: number | null }).rating100 ?? -1;
        return rb - ra;
      }
      if (sortBy === "latency") {
        return (a.latency ?? 999999) - (b.latency ?? 999999);
      }
      // quality: healthy < probation < degraded < blocked < unknown
      const qOrder: Record<string, number> = { healthy: 0, probation: 1, degraded: 2, blocked: 3, unknown: 4 };
      return (qOrder[a.qualityStatus] ?? 5) - (qOrder[b.qualityStatus] ?? 5);
    });
  }, [models, search, capFilter, sortBy]);

  const selectedModels = useMemo(
    () => selected.map(n => models.find(m => m.logicalName === n)).filter(Boolean) as ModelRow[],
    [models, selected],
  );

  const toggleSelect = (name: string) => {
    setSelected(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : prev.length >= 6 ? prev : [...prev, name],
    );
  };

  const hasRatings = models.some(m => (m as { rating100?: number | null }).rating100 != null);

  if (loading && !data) return <div className="loading-dim">loading…</div>;
  if (error && !data) return <div className="loading-dim error">error: {error}</div>;
  if (!data) return null;

  return (
    <div className="dash-page">
      <div className="page-header">
        <div className="page-title">Ratings</div>
        <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>
          Composite 100-point rating with workload-specific probe scores, latency, and optional benchmark anchor.
        </div>
      </div>

      {!hasRatings && (
        <div style={{ background: "var(--surface-2, #1a1f2e)", border: "1px solid var(--border)", borderRadius: 6, padding: "12px 16px", marginBottom: 16, fontSize: 12, color: "var(--amber)" }}>
          No ratings yet — run a full model-health-check to populate workload scores and rating100.
          <br /><code style={{ fontSize: 11 }}>systemctl start model-health-check.service</code>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
        <input
          className="filter-input"
          type="search"
          placeholder="search models…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 220 }}
        />
        <select className="filter-select" value={capFilter} onChange={e => setCapFilter(e.target.value)}>
          <option value="all">all caps</option>
          <option value="heavy">heavy</option>
          <option value="medium">medium</option>
          <option value="light">light</option>
        </select>
        <select className="filter-select" value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}>
          <option value="rating100">sort: rating</option>
          <option value="latency">sort: latency</option>
          <option value="quality">sort: quality</option>
        </select>
        <span style={{ color: "var(--text-dim)", fontSize: 11, marginLeft: "auto" }}>
          {selected.length > 0 ? `${selected.length}/6 selected for comparison` : "click rows to compare (max 6)"}
        </span>
        {selected.length > 0 && (
          <button className="btn btn-sm btn-ghost" onClick={() => setSelected([])}>clear</button>
        )}
      </div>

      {selectedModels.length > 0 && (
        <SectionCard title={`Comparison · ${selectedModels.length} model${selectedModels.length > 1 ? "s" : ""}`} defaultOpen={true}>
          <div className="section-card-body">
            <div className="ratings-grid">
              {selectedModels.map(m => <BreakdownCard key={m.logicalName} m={m} />)}
            </div>
          </div>
        </SectionCard>
      )}

      <SectionCard
        title="All models"
        defaultOpen={true}
        right={<span className="dim" style={{ fontFamily: "var(--mono)", fontSize: 10 }}>{rankedModels.length} shown</span>}
      >
        <div className="section-card-body table-wrap">
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
                <th>quality</th>
                <th>pricing</th>
                <th>conf.</th>
              </tr>
            </thead>
            <tbody>
              {rankedModels.map(m => {
                const r100 = (m as { rating100?: number | null }).rating100;
                const bd = (m as { ratingBreakdown?: RatingBreakdown | null }).ratingBreakdown;
                const ws = (m as { workloadScores?: WorkloadScores | null }).workloadScores;
                const isSelected = selected.includes(m.logicalName);
                const tier = ((m as { pricingTier?: string }).pricingTier ?? "subscription") as PricingTier;
                return (
                  <tr
                    key={m.logicalName}
                    onClick={() => toggleSelect(m.logicalName)}
                    style={{ cursor: "pointer", background: isSelected ? "var(--surface-2, rgba(91,126,201,0.08))" : undefined }}
                  >
                    <td className="mono" style={{ color: m.available ? "var(--text-bright)" : "var(--text-dim)" }}>
                      {isSelected && <span style={{ color: "var(--accent)", marginRight: 6 }}>●</span>}
                      {m.logicalName}
                    </td>
                    <td><span className={`pill ${m.capability === "heavy" ? "blue" : "gray"}`}>{m.capability}</span></td>
                    <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 12, color: r100 != null ? (r100 >= 80 ? "var(--green)" : r100 >= 60 ? "var(--text)" : "var(--amber)") : "var(--text-dim)" }}>
                      {r100 != null ? `${r100}` : "—"}
                    </td>
                    <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)" }}>{ws?.json ?? "—"}</td>
                    <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)" }}>{ws?.coding ?? "—"}</td>
                    <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)" }}>{ws?.writing ?? "—"}</td>
                    <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)" }}>{ws?.reasoning ?? "—"}</td>
                    <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)" }}>{m.latency != null ? `${m.latency}ms` : "—"}</td>
                    <td><span className={`pill ${m.qualityStatus === "healthy" ? "green" : m.qualityStatus === "blocked" ? "red" : "amber"}`}>{m.qualityStatus}</span></td>
                    <td><span style={{ fontSize: 11, color: TIER_COLOR[tier] }}>{TIER_LABEL[tier]}</span></td>
                    <td style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)" }}>{bd ? `${bd.confidence}%` : "—"}</td>
                  </tr>
                );
              })}
              {rankedModels.length === 0 && (
                <tr><td colSpan={11} style={{ textAlign: "center", padding: 24, color: "var(--text-dim)" }}>no models match</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
