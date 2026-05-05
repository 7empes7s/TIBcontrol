import { useState } from "react";
import { useApi } from "../hooks/useApi";
import type { NewsBitesDetail } from "../../server/api/types";

function Pill({ children, color = "gray" }: { children: React.ReactNode; color?: string }) {
  return <span className={`pill ${color}`}>{children}</span>;
}

function statusColor(s: string) {
  if (s === "published") return "green";
  if (s === "approved") return "blue";
  return "gray";
}

export function NewsBitesPage() {
  const { data, loading, error } = useApi<NewsBitesDetail>("/api/newsbites", 30_000);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterVertical, setFilterVertical] = useState("");
  const [search, setSearch] = useState("");

  if (loading && !data) return <div className="loading-dim">loading…</div>;
  if (error && !data) return <div className="loading-dim" style={{ color: "var(--red)" }}>error: {error}</div>;
  if (!data) return null;

  const d = data;
  const s = d.stats;

  const verticals = [...new Set(d.articles.map((a) => a.vertical).filter(Boolean))].sort();

  const filtered = d.articles.filter((a) => {
    if (filterStatus && a.status !== filterStatus) return false;
    if (filterVertical && a.vertical !== filterVertical) return false;
    if (search && !a.title.toLowerCase().includes(search.toLowerCase()) && !a.slug.includes(search.toLowerCase())) return false;
    return true;
  });

  const last30dTotal = s.publishedLast30d.reduce((acc, x) => acc + x.count, 0);

  return (
    <div className="dash-page">
      <div className="page-header">
        <div className="page-title">NewsBites</div>
        <div className="stat-row">
          <div className="stat-item">
            <div className="stat-val">{s.totalPublished}</div>
            <div className="stat-lbl">published</div>
          </div>
          <div className="stat-item">
            <div className="stat-val">{s.totalApproved}</div>
            <div className="stat-lbl">approved</div>
          </div>
          <div className="stat-item">
            <div className="stat-val">{s.totalDraft}</div>
            <div className="stat-lbl">draft/other</div>
          </div>
          <div className="stat-item">
            <div className="stat-val">{s.publishedToday}</div>
            <div className="stat-lbl">today</div>
          </div>
          <div className="stat-item">
            <div className="stat-val">{last30dTotal}</div>
            <div className="stat-lbl">last 30d</div>
          </div>
          <div className="stat-item">
            <div className="stat-lbl">site</div>
            <Pill color={d.deploy.siteReachable ? "green" : "red"} >{d.deploy.siteReachable ? "up" : "down"}</Pill>
          </div>
        </div>
      </div>

      {/* Deploy info */}
      <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)", marginBottom: 16, padding: "8px 12px", background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 4 }}>
        {d.deploy.lastDeployAt
          ? <>last deploy: <span style={{ color: "var(--text)" }}>{d.deploy.lastDeployAt}</span>
            {d.deploy.lastCommitHash && <> · commit <span style={{ color: "var(--text-dim)" }}>{d.deploy.lastCommitHash.slice(0, 8)}</span></>}
          </>
          : "deploy info unavailable"}
      </div>

      {/* Vertical mix */}
      <div className="section-card" id="by-vertical" style={{ marginBottom: 16 }}>
        <div className="section-card-header"><span className="title">vertical mix (published)</span></div>
        <div className="section-card-body" style={{ padding: "10px 14px", display: "flex", flexWrap: "wrap", gap: 6 }}>
          {s.verticalMix.map((v) => (
            <span key={v.vertical} className="pill gray" style={{ cursor: "pointer" }}
              onClick={() => setFilterVertical(filterVertical === v.vertical ? "" : v.vertical)}>
              {v.vertical} {v.count}
            </span>
          ))}
        </div>
      </div>

      {/* Publish rate last 30d */}
      <div className="section-card" id="publish-rate" style={{ marginBottom: 16 }}>
        <div className="section-card-header"><span className="title">publish rate · last 30 days</span></div>
        <div className="section-card-body" style={{ padding: "10px 14px" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 40 }}>
            {s.publishedLast30d.map((day) => {
              const max = Math.max(...s.publishedLast30d.map((x) => x.count), 1);
              const h = Math.max(2, Math.round((day.count / max) * 40));
              return (
                <div key={day.date} title={`${day.date}: ${day.count}`}
                  style={{ flex: 1, height: h, background: day.count > 0 ? "var(--accent)" : "var(--border)", borderRadius: 1, opacity: 0.7, minWidth: 2 }} />
              );
            })}
          </div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-dim)", marginTop: 6 }}>
            {s.publishedLast30d[0]?.date} → {s.publishedLast30d[s.publishedLast30d.length - 1]?.date}
          </div>
        </div>
      </div>

      {/* Articles table */}
      <div className="section-card">
        <div className="section-card-header">
          <span className="title">articles</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="search…"
              style={{ fontFamily: "var(--mono)", fontSize: 11, background: "var(--bg-hover)", border: "1px solid var(--border)", color: "var(--text)", padding: "3px 8px", borderRadius: 3, width: 140 }} />
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              style={{ fontFamily: "var(--mono)", fontSize: 11, background: "var(--bg-hover)", border: "1px solid var(--border)", color: "var(--text)", padding: "3px 8px", borderRadius: 3 }}>
              <option value="">all status</option>
              <option value="published">published</option>
              <option value="approved">approved</option>
              <option value="draft">draft</option>
            </select>
            <select value={filterVertical} onChange={(e) => setFilterVertical(e.target.value)}
              style={{ fontFamily: "var(--mono)", fontSize: 11, background: "var(--bg-hover)", border: "1px solid var(--border)", color: "var(--text)", padding: "3px 8px", borderRadius: 3 }}>
              <option value="">all verticals</option>
              {verticals.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </div>
        <div className="section-card-body table-wrap">
          <table className="data-table">
            <thead><tr>
              <th>title</th><th>vertical</th><th>date</th><th>status</th><th>~words</th>
            </tr></thead>
            <tbody>
              {filtered.slice(0, 200).map((a) => (
                <tr key={a.slug}>
                  <td style={{ maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <a href={`https://news.techinsiderbytes.com/articles/${a.slug}`}
                      target="_blank" rel="noreferrer"
                      style={{ color: "var(--text)", textDecoration: "none" }}
                      onMouseOver={(e) => (e.currentTarget.style.color = "var(--accent)")}
                      onMouseOut={(e) => (e.currentTarget.style.color = "var(--text)")}>
                      {a.title || a.slug}
                    </a>
                  </td>
                  <td className="mono dim">{a.vertical}</td>
                  <td className="mono dim">{a.date}</td>
                  <td><Pill color={statusColor(a.status)}>{a.status}</Pill></td>
                  <td className="mono dim">{a.wordCount > 0 ? `~${a.wordCount}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 200 && <div className="loading-dim">showing 200 of {filtered.length}</div>}
        </div>
      </div>
    </div>
  );
}
