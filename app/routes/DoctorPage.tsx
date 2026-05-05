import { useState } from "react";
import { useApi } from "../hooks/useApi";
import type { DoctorDetail } from "../../server/api/types";

function Pill({ children, color = "gray" }: { children: React.ReactNode; color?: string }) {
  return <span className={`pill ${color}`}>{children}</span>;
}

function verdictColor(action: string): string {
  if (action === "requeued" || action === "promoted") return "green";
  if (action === "abandoned") return "red";
  if (action === "cooldown") return "amber";
  return "gray";
}

export function DoctorPage() {
  const { data, loading, error } = useApi<DoctorDetail>("/api/doctor", 15_000);
  const [filterStage, setFilterStage] = useState("");
  const [filterError, setFilterError] = useState("");
  const [filterModel, setFilterModel] = useState("");

  if (loading && !data) return <div className="loading-dim">loading…</div>;
  if (error && !data) return <div className="loading-dim" style={{ color: "var(--red)" }}>error: {error}</div>;
  if (!data) return null;

  const d = data;
  const successPct = d.stats.total > 0 ? Math.round(d.stats.successRate * 100) : null;

  const filtered = d.entries.filter((e) => {
    if (filterStage && e.stage !== filterStage) return false;
    if (filterError && e.errorType !== filterError) return false;
    if (filterModel && e.failedModel !== filterModel) return false;
    return true;
  }).slice().reverse(); // newest first

  // Unique values for filters
  const stages = [...new Set(d.entries.map((e) => e.stage).filter(Boolean))].sort();
  const errorTypes = [...new Set(d.entries.map((e) => e.errorType).filter(Boolean))].sort();
  const models = [...new Set(d.entries.map((e) => e.failedModel).filter(Boolean))].sort();

  return (
    <div className="dash-page">
      <div className="page-header">
        <div className="page-title">Doctor</div>
        <div className="stat-row">
          <div className="stat-item">
            <div className="stat-val">{d.stats.total}</div>
            <div className="stat-lbl">repairs 24h</div>
          </div>
          {successPct !== null && (
            <div className="stat-item">
              <div className="stat-val">{successPct}%</div>
              <div className="stat-lbl">success rate</div>
            </div>
          )}
          {d.lastDecision && (
            <div className="stat-item">
              <div className="stat-lbl">last decision</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
                {d.lastDecision.slug} · <Pill color={verdictColor(d.lastDecision.action)}>{d.lastDecision.action}</Pill>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8, marginBottom: 16 }}>
        <div className="section-card" id="errors">
          <div className="section-card-header"><span className="title">error classes</span></div>
          <div className="section-card-body" style={{ padding: "10px 14px" }}>
            {d.stats.errorClasses.length === 0 ? <div className="loading-dim">none</div> : (
              d.stats.errorClasses.map((e) => (
                <div key={e.type} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)" }}>{e.type}</span>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text)" }}>{e.count}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="section-card" id="models">
          <div className="section-card-header"><span className="title">top failing models</span></div>
          <div className="section-card-body" style={{ padding: "10px 14px" }}>
            {d.stats.topFailingModels.length === 0 ? <div className="loading-dim">none</div> : (
              d.stats.topFailingModels.map((m) => (
                <div key={m.model} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "80%" }}>{m.model}</span>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text)" }}>{m.count}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="section-card" id="verdicts">
          <div className="section-card-header"><span className="title">verdict mix</span></div>
          <div className="section-card-body" style={{ padding: "10px 14px" }}>
            {d.stats.verdictMix.length === 0 ? <div className="loading-dim">none</div> : (
              d.stats.verdictMix.map((v) => (
                <div key={v.action} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <Pill color={verdictColor(v.action)}>{v.action}</Pill>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text)" }}>{v.count}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Full log */}
      <div className="section-card">
        <div className="section-card-header">
          <span className="title">decision log</span>
          <span className="dim" style={{ fontFamily: "var(--mono)", fontSize: 10 }}>{d.entries.length} entries (last 2MB)</span>
        </div>
        <div style={{ padding: "8px 14px", borderBottom: "1px solid var(--border)", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select value={filterStage} onChange={(e) => setFilterStage(e.target.value)}
            style={{ fontFamily: "var(--mono)", fontSize: 11, background: "var(--bg-hover)", border: "1px solid var(--border)", color: "var(--text)", padding: "3px 8px", borderRadius: 3 }}>
            <option value="">all stages</option>
            {stages.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterError} onChange={(e) => setFilterError(e.target.value)}
            style={{ fontFamily: "var(--mono)", fontSize: 11, background: "var(--bg-hover)", border: "1px solid var(--border)", color: "var(--text)", padding: "3px 8px", borderRadius: 3 }}>
            <option value="">all errors</option>
            {errorTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={filterModel} onChange={(e) => setFilterModel(e.target.value)}
            style={{ fontFamily: "var(--mono)", fontSize: 11, background: "var(--bg-hover)", border: "1px solid var(--border)", color: "var(--text)", padding: "3px 8px", borderRadius: 3 }}>
            <option value="">all models</option>
            {models.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          {(filterStage || filterError || filterModel) && (
            <button onClick={() => { setFilterStage(""); setFilterError(""); setFilterModel(""); }}
              style={{ fontFamily: "var(--mono)", fontSize: 11, background: "none", border: "1px solid var(--border)", color: "var(--text-dim)", padding: "3px 8px", borderRadius: 3, cursor: "pointer" }}>
              clear
            </button>
          )}
        </div>
        <div className="section-card-body table-wrap">
          <table className="data-table">
            <thead><tr>
              <th>time</th><th>slug</th><th>stage</th><th>error</th><th>model</th><th>verdict</th><th>reason</th>
            </tr></thead>
            <tbody>
              {filtered.slice(0, 200).map((e, i) => (
                <tr key={i}>
                  <td className="mono dim" style={{ whiteSpace: "nowrap" }}>{e.ts.slice(0, 19).replace("T", " ")}</td>
                  <td className="mono trunc" style={{ maxWidth: 160 }}>{e.slug}</td>
                  <td className="mono">{e.stage}</td>
                  <td className="mono dim" style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.errorType}</td>
                  <td className="mono dim trunc" style={{ maxWidth: 140 }}>{e.failedModel}</td>
                  <td><Pill color={verdictColor(e.action)}>{e.action}</Pill></td>
                  <td className="dim" style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11 }}>{e.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 200 && (
            <div className="loading-dim">showing 200 of {filtered.length} entries</div>
          )}
        </div>
      </div>
    </div>
  );
}
