import { useApi, fmtAge } from "../hooks/useApi";
import type { ModelsDetail } from "../../server/api/types";

function Pill({ children, color = "gray" }: { children: React.ReactNode; color?: string }) {
  return <span className={`pill ${color}`}>{children}</span>;
}

function qualityColor(s: string): string {
  if (s === "healthy") return "green";
  if (s === "blocked") return "red";
  if (s === "degraded" || s === "probation") return "amber";
  return "gray";
}

export function ModelsPage() {
  const { data, loading, error } = useApi<ModelsDetail>("/api/models", 30_000);

  if (loading && !data) return <div className="loading-dim">loading…</div>;
  if (error && !data) return <div className="loading-dim" style={{ color: "var(--red)" }}>error: {error}</div>;
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

      {/* Quality summary */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <Pill color="blue">heavy {s.availableByCapability.heavy}</Pill>
        <Pill color="gray">medium {s.availableByCapability.medium}</Pill>
        <Pill color="gray">light {s.availableByCapability.light}</Pill>
        {s.qualitySummary.blocked > 0 && <Pill color="red">blocked {s.qualitySummary.blocked}</Pill>}
        {s.qualitySummary.degraded > 0 && <Pill color="amber">degraded {s.qualitySummary.degraded}</Pill>}
        {s.qualitySummary.probation > 0 && <Pill color="amber">probation {s.qualitySummary.probation}</Pill>}
        {s.newModelsAdded.length > 0 && <Pill color="green">+{s.newModelsAdded.length} new</Pill>}
      </div>

      {/* All models table */}
      <div className="section-card" id="current">
        <div className="section-card-header"><span className="title">all models</span><span className="dim" style={{ fontFamily: "var(--mono)", fontSize: 10 }}>{d.models.length} total</span></div>
        <div className="section-card-body table-wrap">
          <table className="data-table">
            <thead><tr>
              <th>logical name</th><th>provider</th><th>capability</th><th>available</th><th>latency</th><th>json ok</th><th>quality</th><th>failures</th><th>garbage streak</th>
            </tr></thead>
            <tbody>
              {d.models.map((m) => (
                <tr key={m.logicalName}>
                  <td className="mono" style={{ color: m.available ? "var(--text-bright)" : "var(--text-dim)" }}>{m.logicalName}</td>
                  <td className="dim mono">{m.provider}</td>
                  <td><Pill color={m.capability === "heavy" ? "blue" : "gray"}>{m.capability}</Pill></td>
                  <td><Pill color={m.available ? "green" : "red"}>{m.available ? "yes" : "no"}</Pill></td>
                  <td className="mono dim">{m.latency != null ? `${m.latency}ms` : "—"}</td>
                  <td><Pill color={m.jsonOk ? "green" : "red"}>{m.jsonOk ? "✓" : "✗"}</Pill></td>
                  <td><Pill color={qualityColor(m.qualityStatus)}>{m.qualityStatus}</Pill></td>
                  <td className="mono dim">{m.recentFailures}</td>
                  <td className="mono dim">{m.consecutiveGarbage > 0 ? m.consecutiveGarbage : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fallback chains */}
      <div className="section-card">
        <div className="section-card-header"><span className="title">fallback chains</span></div>
        <div className="section-card-body" style={{ padding: "12px 14px" }}>
          <div className="chain-list">
            {Object.entries(d.fallbacks).map(([chain, models]) => (
              <div key={chain} className="chain-item">
                <div className="chain-name">{chain}</div>
                <div className="chain-models">
                  {models.map((m, i) => (
                    <span key={m} className={`chain-model ${i === 0 ? "first" : ""}`}>{i + 1}. {m}</span>
                  ))}
                </div>
              </div>
            ))}
            {Object.keys(d.fallbacks).length === 0 && <div className="loading-dim">no fallback chains in health file</div>}
          </div>
        </div>
      </div>

      {/* Cooldowns */}
      <div className="section-card" id="cooldowns">
        <div className="section-card-header"><span className="title">active cooldowns</span><span className="dim" style={{ fontFamily: "var(--mono)", fontSize: 10 }}>{d.cooldowns.length}</span></div>
        <div className="section-card-body table-wrap">
          {d.cooldowns.length === 0 ? (
            <div className="loading-dim">no active cooldowns</div>
          ) : (
            <table className="data-table">
              <thead><tr><th>model</th><th>expires</th><th>reason</th></tr></thead>
              <tbody>
                {d.cooldowns.map((c) => (
                  <tr key={c.model}>
                    <td className="mono">{c.model}</td>
                    <td className="mono dim">{new Date(c.expiresAt).toISOString().slice(0, 19).replace("T", " ")} UTC</td>
                    <td className="dim">{c.reason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Discovery log */}
      <div className="section-card" id="new">
        <div className="section-card-header"><span className="title">discovery log</span></div>
        <div className="section-card-body table-wrap">
          {d.discoveryLog.length === 0 ? (
            <div className="loading-dim">discovery log not yet created — will appear after next full model-health-check run</div>
          ) : (
            <table className="data-table">
              <thead><tr><th>time</th><th>new models</th><th>total</th></tr></thead>
              <tbody>
                {[...d.discoveryLog].reverse().map((entry, i) => (
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
          )}
        </div>
      </div>
    </div>
  );
}
