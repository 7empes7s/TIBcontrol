import { useApi, fmtAge, fmtMs } from "../hooks/useApi";
import type { AutopipelineDetail } from "../../server/api/types";

function Pill({ children, color = "gray" }: { children: React.ReactNode; color?: string }) {
  return <span className={`pill ${color}`}>{children}</span>;
}

function StageDurationTable({ durations }: { durations: AutopipelineDetail["stageDurations"] }) {
  const relevant = durations.filter((d) => d.sampleCount > 0);
  if (relevant.length === 0) return <div className="loading-dim">no timing samples yet</div>;
  return (
    <table className="data-table">
      <thead><tr>
        <th>stage</th><th>p50</th><th>p95</th><th>samples</th>
      </tr></thead>
      <tbody>
        {relevant.map((d) => (
          <tr key={d.stage}>
            <td className="mono">{d.stage}</td>
            <td className="mono">{fmtMs(d.p50Ms)}</td>
            <td className="mono">{fmtMs(d.p95Ms)}</td>
            <td className="dim">{d.sampleCount}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function AutopipelinePage() {
  const { data, loading, error } = useApi<AutopipelineDetail>("/api/autopipeline", 10_000);

  if (loading && !data) return <div className="loading-dim">loading…</div>;
  if (error && !data) return <div className="loading-dim" style={{ color: "var(--red)" }}>error: {error}</div>;
  if (!data) return null;

  const d = data;

  return (
    <div className="dash-page">
      <div className="page-header">
        <div className="page-title">Autopipeline</div>
        <div className="stat-row">
          <div className="stat-item">
            <div className="stat-val">{d.stats.queueDepth}</div>
            <div className="stat-lbl">queued</div>
          </div>
          <div className="stat-item">
            <div className="stat-val">{d.stats.approvalsWaiting}</div>
            <div className="stat-lbl">waiting approval</div>
          </div>
          <div className="stat-item" style={{ display: "flex", alignItems: "flex-start", flexDirection: "column", gap: 2 }}>
            <Pill color={d.paused ? "amber" : "green"}>{d.paused ? "paused" : "running"}</Pill>
            {d.pauseReason && <div className="stat-lbl">{d.pauseReason}</div>}
          </div>
        </div>
      </div>

      {/* Current story */}
      {d.current && (
        <div className="section-card" id="current">
          <div className="section-card-header"><span className="title">current story</span></div>
          <div className="section-card-body" style={{ padding: "12px 14px" }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--text-bright)", marginBottom: 6 }}>
              {d.current.slug ?? d.current.id}
            </div>
            <Pill color="amber">{d.current.stage}</Pill>
          </div>
        </div>
      )}

      {/* Queue */}
      <div className="section-card" id="queue">
        <div className="section-card-header">
          <span className="title">queue</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {Object.entries(d.stats.stageBreakdown).map(([stage, count]) => (
              <Pill key={stage} color="gray">{stage} {count}</Pill>
            ))}
          </div>
        </div>
        <div className="section-card-body table-wrap">
          {d.queue.length === 0 ? (
            <div className="loading-dim">queue empty</div>
          ) : (
            <table className="data-table">
              <thead><tr>
                <th>slug / id</th><th>stage</th><th>priority</th><th>elapsed</th><th>flags</th>
              </tr></thead>
              <tbody>
                {d.queue.map((item) => (
                  <tr key={item.id}>
                    <td className="mono trunc">{item.slug ?? item.id}</td>
                    <td className="mono">{item.stage}</td>
                    <td className="dim">{item.priority}</td>
                    <td className="dim">{item.elapsedMs != null ? fmtMs(item.elapsedMs) : "—"}</td>
                    <td>
                      {item.running && <Pill color="amber">running</Pill>}
                      {item.waitingApproval && <Pill color="red">approval</Pill>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Approvals */}
      {d.stats.approvalsWaiting > 0 && (
        <div className="section-card" id="approvals">
          <div className="section-card-header"><span className="title">approvals waiting</span></div>
          <div className="section-card-body table-wrap">
            <table className="data-table">
              <thead><tr><th>slug / id</th><th>stage</th><th>age</th></tr></thead>
              <tbody>
                {d.queue.filter((i) => i.waitingApproval).map((item) => (
                  <tr key={item.id}>
                    <td className="mono trunc">{item.slug ?? item.id}</td>
                    <td className="mono">{item.stage}</td>
                    <td className="dim">{item.elapsedMs != null ? fmtMs(item.elapsedMs) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stage durations */}
      <div className="section-card" id="throughput">
        <div className="section-card-header"><span className="title">stage durations (from dossier timestamps)</span></div>
        <div className="section-card-body table-wrap">
          <StageDurationTable durations={d.stageDurations} />
        </div>
      </div>
    </div>
  );
}
