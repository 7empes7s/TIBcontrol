import { useMemo, useState, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { useAuthenticatedApi } from "../hooks/useAuthenticatedApi";
import { SectionCard } from "../components/SectionCard";
import { useTableSort, type SortValue } from "../hooks/useTableSort";
import { SortableTh } from "../components/SortableTh";
import { useTablePage } from "../hooks/useTablePage";
import { TablePageControls } from "../components/TablePageControls";
import type { ActionAuditRow } from "../../server/db/writer";

interface AuditData {
  audit: ActionAuditRow[];
  degraded: boolean;
  reason?: string;
}

function Pill({ children, color = "gray" }: { children: React.ReactNode; color?: string }) {
  return <span className={`pill ${color}`}>{children}</span>;
}

function statusColor(status: string | null): string {
  if (status === "success" || status === "accepted") return "green";
  if (status === "failed" || status === "error" || status === "denied") return "red";
  if (status === "running" || status === "started") return "blue";
  return "amber";
}

function riskColor(risk: string | null): string {
  if (risk === "high" || risk === "destructive") return "red";
  if (risk === "medium") return "amber";
  if (risk === "low") return "green";
  return "gray";
}

function fmtTs(ts: number): string {
  return new Date(ts).toISOString().slice(0, 19).replace("T", " ") + " UTC";
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

type SortKey = "ts" | "resultStatus" | "risk" | "actionKind" | "target" | "actor";

const RISK_ORDER: Record<string, number> = { destructive: 0, high: 1, medium: 2, low: 3 };

export function AuditPage() {
  const [resultStatus, setResultStatus] = useState("");
  const [targetType, setTargetType] = useState("");
  const [actionKind, setActionKind] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ActionAuditRow | null>(null);
  const query = new URLSearchParams({ limit: "100" });
  if (resultStatus) query.set("resultStatus", resultStatus);
  if (targetType) query.set("targetType", targetType);
  if (actionKind) query.set("actionKind", actionKind);
  const { data, loading, error, refresh } = useAuthenticatedApi<AuditData>(`/api/actions/audit?${query.toString()}`, 20_000);

  const rows = data?.audit ?? [];
  const targetTypes = useMemo(() => Array.from(new Set(rows.map((row) => row.targetType).filter(Boolean) as string[])).sort(), [rows]);
  const actionKinds = useMemo(() => Array.from(new Set(rows.map((row) => row.actionKind))).sort(), [rows]);
  const counts = useMemo(() => ({
    success: rows.filter((row) => row.resultStatus === "success" || row.resultStatus === "accepted").length,
    failed: rows.filter((row) => row.resultStatus === "failed" || row.resultStatus === "error" || row.resultStatus === "denied").length,
    highRisk: rows.filter((row) => row.risk === "high" || row.risk === "destructive").length,
  }), [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      (r.actionKind ?? "").toLowerCase().includes(q)
      || (r.target ?? "").toLowerCase().includes(q)
      || (r.targetId ?? "").toLowerCase().includes(q)
      || (r.targetType ?? "").toLowerCase().includes(q)
      || (r.actor ?? "").toLowerCase().includes(q)
      || (r.reason ?? "").toLowerCase().includes(q)
      || (r.error ?? "").toLowerCase().includes(q)
    );
  }, [rows, search]);

  const accessor = useCallback((r: ActionAuditRow, key: SortKey): SortValue => {
    switch (key) {
      case "ts": return r.ts;
      case "resultStatus": return r.resultStatus ?? "";
      case "risk": return RISK_ORDER[r.risk ?? ""] ?? 9;
      case "actionKind": return r.actionKind;
      case "target": return r.targetId ?? r.target ?? r.targetType ?? "";
      case "actor": return r.actor ?? "";
      default: return null;
    }
  }, []);

  const { sorted, sort, onSort } = useTableSort<ActionAuditRow, SortKey>(filtered, {
    defaultKey: "ts",
    defaultDir: "desc",
    tieBreak: ["risk", "actionKind"],
    accessor,
  });

  const auditPage = useTablePage(sorted);

  const hasActiveFilter = resultStatus !== "" || targetType !== "" || actionKind !== "" || search !== "";
  const clearFilters = () => { setResultStatus(""); setTargetType(""); setActionKind(""); setSearch(""); };

  if (loading && !data) return <div className="loading-dim">loading...</div>;
  if (error && !data) return <div className="loading-dim error">error: {error}</div>;

  return (
    <div className="dash-page">
      {selected && (
        <div className="evidence-drawer-overlay" onClick={() => setSelected(null)}>
          <aside className="evidence-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="evidence-drawer-head">
              <div>
                <div className="evidence-drawer-kicker">audit record</div>
                <div className="evidence-drawer-title">#{selected.id} · {selected.actionKind}</div>
              </div>
              <button className="drawer-close" onClick={() => setSelected(null)} aria-label="Close audit drawer">×</button>
            </div>

            <div className="evidence-drawer-summary">
              <Pill color={statusColor(selected.resultStatus)}>{selected.resultStatus ?? "unknown"}</Pill>
              <Pill color={riskColor(selected.risk)}>{selected.risk ?? "unknown"}</Pill>
              {selected.targetType && <Pill color="gray">{selected.targetType}</Pill>}
            </div>

            <div className="audit-detail-grid">
              <div><span>time</span><strong>{fmtTs(selected.ts)}</strong></div>
              <div><span>actor</span><strong>{selected.actor ?? "-"}</strong></div>
              <div><span>source</span><strong>{selected.actorSource ?? "-"}</strong></div>
              <div><span>target</span><strong>{selected.targetId ?? selected.target ?? "-"}</strong></div>
              <div><span>job</span><strong>{selected.jobId ?? "-"}</strong></div>
              <div><span>event</span><strong>{selected.eventId ?? "-"}</strong></div>
            </div>

            {selected.reason && (
              <div className="evidence-block">
                <div className="evidence-block-title">Reason</div>
                <div className="audit-pre">{selected.reason}</div>
              </div>
            )}
            {selected.error && (
              <div className="evidence-block">
                <div className="evidence-block-title">Error</div>
                <div className="audit-pre error">{selected.error}</div>
              </div>
            )}
            {selected.rollbackHint && (
              <div className="evidence-block">
                <div className="evidence-block-title">Rollback</div>
                <div className="audit-pre">{selected.rollbackHint}</div>
              </div>
            )}
            {stringify(selected.request) && (
              <div className="evidence-block">
                <div className="evidence-block-title">Request</div>
                <pre className="audit-pre">{stringify(selected.request)}</pre>
              </div>
            )}
            {stringify(selected.resultJson) && (
              <div className="evidence-block">
                <div className="evidence-block-title">Result</div>
                <pre className="audit-pre">{stringify(selected.resultJson)}</pre>
              </div>
            )}
            {stringify(selected.evidence) && (
              <div className="evidence-block">
                <div className="evidence-block-title">Evidence</div>
                <pre className="audit-pre">{stringify(selected.evidence)}</pre>
              </div>
            )}
          </aside>
        </div>
      )}

      <div className="page-header">
        <div className="page-title">Audit</div>
        <button className="btn btn-sm btn-ghost" onClick={refresh} disabled={loading}>
          <RefreshCw size={14} /> refresh
        </button>
      </div>

      <div className="stat-row">
        <div className="stat-item"><div className="stat-val">{rows.length}</div><div className="stat-lbl">loaded</div></div>
        <div className="stat-item"><div className="stat-val">{counts.success}</div><div className="stat-lbl">success</div></div>
        <div className="stat-item"><div className="stat-val">{counts.failed}</div><div className="stat-lbl">failed</div></div>
        <div className="stat-item"><div className="stat-val">{counts.highRisk}</div><div className="stat-lbl">high risk</div></div>
      </div>

      {data?.degraded && <div className="loading-dim error">degraded: {data.reason}</div>}

      <div className="table-filter-bar">
        <input
          className="filter-input"
          type="search"
          placeholder="search action / target / actor / reason / error"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="filter-group-label">result</span>
        <select className="filter-select" value={resultStatus} onChange={(event) => setResultStatus(event.target.value)}>
          <option value="">all</option>
          <option value="success">success</option>
          <option value="failed">failed</option>
        </select>
        <span className="filter-group-label">target</span>
        <select className="filter-select" value={targetType} onChange={(event) => setTargetType(event.target.value)}>
          <option value="">all</option>
          {targetTypes.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <span className="filter-group-label">action</span>
        <select className="filter-select" value={actionKind} onChange={(event) => setActionKind(event.target.value)}>
          <option value="">all</option>
          {actionKinds.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        {hasActiveFilter && <button className="filter-clear" onClick={clearFilters}>clear filters</button>}
        <span className="filter-count">{sorted.length} / {rows.length}</span>
      </div>

      <SectionCard
        title="recent audit"
        defaultOpen={false}
        right={<span className="mono dim">{sorted.length} rows</span>}
      >
        <div className="section-card-body table-wrap">
          {sorted.length === 0 ? (
            <div className="loading-dim">no audit records match filters</div>
          ) : (
            <table className="data-table audit-entries-table">
              <thead><tr>
                <SortableTh<SortKey> sortKey="ts" sort={sort} onSort={onSort} className="audit-when-col">when</SortableTh>
                <SortableTh<SortKey> sortKey="resultStatus" sort={sort} onSort={onSort}>result</SortableTh>
                <SortableTh<SortKey> sortKey="risk" sort={sort} onSort={onSort}>risk</SortableTh>
                <SortableTh<SortKey> sortKey="actionKind" sort={sort} onSort={onSort}>action</SortableTh>
                <SortableTh<SortKey> sortKey="target" sort={sort} onSort={onSort}>target</SortableTh>
                <SortableTh<SortKey> sortKey="actor" sort={sort} onSort={onSort} className="audit-actor-col">actor</SortableTh>
                <th></th>
              </tr></thead>
              <tbody>
                {auditPage.slice.map((row) => (
                  <tr key={row.id}>
                    <td className="mono dim audit-when-col">{fmtTs(row.ts)}</td>
                    <td><Pill color={statusColor(row.resultStatus)}>{row.resultStatus ?? "-"}</Pill></td>
                    <td><Pill color={riskColor(row.risk)}>{row.risk ?? "-"}</Pill></td>
                    <td className="mono">{row.actionKind}</td>
                    <td className="mono trunc">{row.targetId ?? row.target ?? row.targetType ?? "-"}</td>
                    <td className="mono dim audit-actor-col">{row.actor ?? "-"}</td>
                    <td style={{ textAlign: "right" }}>
                      <button className="btn btn-sm btn-ghost" onClick={() => setSelected(row)}>details</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <TablePageControls {...auditPage} onPrev={auditPage.prev} onNext={auditPage.next} onSetPageSize={auditPage.setPageSize} noun="rows" />
      </SectionCard>
    </div>
  );
}
