import { useMemo, useState, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { useAuthenticatedApi } from "../hooks/useAuthenticatedApi";
import { SectionCard } from "../components/SectionCard";
import { useTableSort, type SortValue } from "../hooks/useTableSort";
import { SortableTh } from "../components/SortableTh";
import { TableFilterChip } from "../components/TableFilterChip";
import { useTablePage } from "../hooks/useTablePage";
import { TablePageControls } from "../components/TablePageControls";
import type { JobRow } from "../../server/db/writer";

interface JobsData {
  jobs: JobRow[];
  degraded: boolean;
  reason?: string;
}

function Pill({ children, color = "gray" }: { children: React.ReactNode; color?: string }) {
  return <span className={`pill ${color}`}>{children}</span>;
}

function statusColor(status: string): string {
  if (status === "success" || status === "succeeded" || status === "completed") return "green";
  if (status === "running" || status === "pending") return "blue";
  if (status === "failed" || status === "error") return "red";
  return "amber";
}

function fmtTs(ts: number | null): string {
  if (!ts) return "-";
  return new Date(ts).toISOString().slice(0, 19).replace("T", " ") + " UTC";
}

function fmtDuration(startedAt: number | null, finishedAt: number | null): string {
  if (!startedAt) return "-";
  const end = finishedAt ?? Date.now();
  const seconds = Math.max(0, Math.round((end - startedAt) / 1000));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
}

function durationSeconds(startedAt: number | null, finishedAt: number | null): number {
  if (!startedAt) return -1;
  const end = finishedAt ?? Date.now();
  return Math.max(0, Math.round((end - startedAt) / 1000));
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

type SortKey = "startedAt" | "status" | "kind" | "target" | "duration" | "actor";

export function JobsPage() {
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<JobRow | null>(null);
  const query = new URLSearchParams({ limit: "100" });
  if (status) query.set("status", status);
  if (kind) query.set("kind", kind);
  const { data, loading, error, refresh } = useAuthenticatedApi<JobsData>(`/api/jobs?${query.toString()}`, 20_000);

  const jobs = data?.jobs ?? [];
  const kinds = useMemo(() => Array.from(new Set(jobs.map((job) => job.kind))).sort(), [jobs]);
  const counts = useMemo(() => ({
    running: jobs.filter((job) => job.status === "running").length,
    success: jobs.filter((job) => String(job.status) === "success" || String(job.status) === "succeeded" || String(job.status) === "completed").length,
    failed: jobs.filter((job) => String(job.status) === "failed" || String(job.status) === "error").length,
  }), [jobs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter((j) =>
      j.id.toLowerCase().includes(q)
      || j.kind.toLowerCase().includes(q)
      || (j.targetId ?? "").toLowerCase().includes(q)
      || (j.targetType ?? "").toLowerCase().includes(q)
      || (j.actor ?? "").toLowerCase().includes(q)
      || (j.reason ?? "").toLowerCase().includes(q)
    );
  }, [jobs, search]);

  const accessor = useCallback((j: JobRow, key: SortKey): SortValue => {
    switch (key) {
      case "startedAt": return j.startedAt ?? 0;
      case "status": return j.status;
      case "kind": return j.kind;
      case "target": return j.targetId ?? j.targetType ?? "";
      case "duration": return durationSeconds(j.startedAt, j.finishedAt);
      case "actor": return j.actor ?? "";
      default: return null;
    }
  }, []);

  const { sorted, sort, onSort } = useTableSort<JobRow, SortKey>(filtered, {
    defaultKey: "startedAt",
    defaultDir: "desc",
    tieBreak: ["kind", "status"],
    accessor,
  });

  const jobsPage = useTablePage(sorted);

  const hasActiveFilter = status !== "" || kind !== "" || search !== "";
  const clearFilters = () => { setStatus(""); setKind(""); setSearch(""); };

  if (loading && !data) return <div className="loading-dim">loading...</div>;
  if (error && !data) return <div className="loading-dim error">error: {error}</div>;

  return (
    <div className="dash-page">
      {selected && (
        <div className="evidence-drawer-overlay" onClick={() => setSelected(null)}>
          <aside className="evidence-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="evidence-drawer-head">
              <div>
                <div className="evidence-drawer-kicker">job</div>
                <div className="evidence-drawer-title">{selected.id}</div>
              </div>
              <button className="drawer-close" onClick={() => setSelected(null)} aria-label="Close job drawer">×</button>
            </div>

            <div className="evidence-drawer-summary">
              <Pill color={statusColor(selected.status)}>{selected.status}</Pill>
              <Pill color="gray">{selected.kind}</Pill>
              {selected.targetType && <Pill color="gray">{selected.targetType}</Pill>}
            </div>

            <div className="audit-detail-grid">
              <div><span>started</span><strong>{fmtTs(selected.startedAt)}</strong></div>
              <div><span>finished</span><strong>{fmtTs(selected.finishedAt)}</strong></div>
              <div><span>duration</span><strong>{fmtDuration(selected.startedAt, selected.finishedAt)}</strong></div>
              <div><span>actor</span><strong>{selected.actor ?? "-"}</strong></div>
              <div><span>target</span><strong>{selected.targetId ?? "-"}</strong></div>
              <div><span>exit</span><strong>{selected.exitCode ?? "-"}</strong></div>
            </div>

            {selected.reason && (
              <div className="evidence-block">
                <div className="evidence-block-title">Reason</div>
                <div className="audit-pre">{selected.reason}</div>
              </div>
            )}
            {selected.command && (
              <div className="evidence-block">
                <div className="evidence-block-title">Command</div>
                <div className="audit-pre">{selected.command}</div>
              </div>
            )}
            {selected.error && (
              <div className="evidence-block">
                <div className="evidence-block-title">Error</div>
                <div className="audit-pre error">{selected.error}</div>
              </div>
            )}
            {selected.outputTail && (
              <div className="evidence-block">
                <div className="evidence-block-title">Output</div>
                <pre className="audit-pre">{selected.outputTail}</pre>
              </div>
            )}
            {stringify(selected.request) && (
              <div className="evidence-block">
                <div className="evidence-block-title">Request</div>
                <pre className="audit-pre">{stringify(selected.request)}</pre>
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
        <div className="page-title">Jobs</div>
        <button className="btn btn-sm btn-ghost" onClick={refresh} disabled={loading}>
          <RefreshCw size={14} /> refresh
        </button>
      </div>

      <div className="stat-row">
        <div className="stat-item"><div className="stat-val">{jobs.length}</div><div className="stat-lbl">loaded</div></div>
        <div className="stat-item"><div className="stat-val">{counts.running}</div><div className="stat-lbl">running</div></div>
        <div className="stat-item"><div className="stat-val">{counts.success}</div><div className="stat-lbl">success</div></div>
        <div className="stat-item"><div className="stat-val">{counts.failed}</div><div className="stat-lbl">failed</div></div>
      </div>

      {data?.degraded && <div className="loading-dim error">degraded: {data.reason}</div>}

      <div className="table-filter-bar">
        <input
          className="filter-input"
          type="search"
          placeholder="search id / kind / target / actor / reason"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="filter-group-label">status</span>
        <select className="filter-select" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">all</option>
          <option value="running">running</option>
          <option value="success">success</option>
          <option value="failed">failed</option>
        </select>
        <span className="filter-group-label">kind</span>
        <select className="filter-select" value={kind} onChange={(event) => setKind(event.target.value)}>
          <option value="">all</option>
          {kinds.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        {hasActiveFilter && <button className="filter-clear" onClick={clearFilters}>clear filters</button>}
        <span className="filter-count">{sorted.length} / {jobs.length}</span>
      </div>

      <SectionCard
        title="recent jobs"
        defaultOpen={false}
        right={<span className="mono dim">{sorted.length} rows</span>}
      >
        <div className="section-card-body table-wrap">
          {sorted.length === 0 ? (
            <div className="loading-dim">no jobs match filters</div>
          ) : (
            <table className="data-table jobs-table">
              <thead><tr>
                <SortableTh<SortKey> sortKey="startedAt" sort={sort} onSort={onSort} className="job-date-col">started</SortableTh>
                <SortableTh<SortKey> sortKey="status" sort={sort} onSort={onSort}>status</SortableTh>
                <SortableTh<SortKey> sortKey="kind" sort={sort} onSort={onSort}>kind</SortableTh>
                <SortableTh<SortKey> sortKey="target" sort={sort} onSort={onSort}>target</SortableTh>
                <SortableTh<SortKey> sortKey="duration" sort={sort} onSort={onSort} className="job-dur-col">duration</SortableTh>
                <SortableTh<SortKey> sortKey="actor" sort={sort} onSort={onSort} className="job-actor-col">actor</SortableTh>
                <th></th>
              </tr></thead>
              <tbody>
                {jobsPage.slice.map((job) => (
                  <tr key={job.id}>
                    <td className="mono dim job-date-col">{fmtTs(job.startedAt)}</td>
                    <td><Pill color={statusColor(job.status)}>{job.status}</Pill></td>
                    <td className="mono">{job.kind}</td>
                    <td className="mono trunc">{job.targetId ?? job.targetType ?? "-"}</td>
                    <td className="mono dim job-dur-col">{fmtDuration(job.startedAt, job.finishedAt)}</td>
                    <td className="mono dim job-actor-col">{job.actor ?? "-"}</td>
                    <td style={{ textAlign: "right" }}>
                      <button className="btn btn-sm btn-ghost" onClick={() => setSelected(job)}>details</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <TablePageControls {...jobsPage} onPrev={jobsPage.prev} onNext={jobsPage.next} onSetPageSize={jobsPage.setPageSize} noun="jobs" />
      </SectionCard>
    </div>
  );
}
