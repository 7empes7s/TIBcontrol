import { useStore } from "../lib/store";
import { Trash2, Plus } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";

export function Sidebar() {
  const { sessions, activeSession, selectSession, createSession, deleteSession, running } = useStore();

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Delete this session?")) return;
    await deleteSession(id);
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          opencode
        </div>
        <div className={`status-dot ${running ? "" : ""}`} title="Connected" />
      </div>

      <button className="new-session-btn" onClick={() => createSession()}>
        <Plus size={11} />
        new session
      </button>

      <div className="session-list">
        {sessions.length === 0 && (
          <div style={{ padding: "12px 8px", fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-dim)", textAlign: "center" }}>
            no sessions yet
          </div>
        )}
        {[...sessions]
          .sort((a, b) => b.time.updated - a.time.updated)
          .map((s) => (
            <div
              key={s.id}
              className={`session-item ${activeSession?.id === s.id ? "active" : ""}`}
              onClick={() => selectSession(s)}
            >
              <div className="session-item-dot" />
              <div className="session-item-content">
                <div className="session-item-title">{s.title || s.slug || "untitled"}</div>
                <div className="session-item-meta">
                  {formatDistanceToNowStrict(s.time.updated, { addSuffix: true })}
                </div>
              </div>
              <button
                className="session-delete-btn"
                onClick={(e) => handleDelete(e, s.id)}
                title="Delete"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}
