import { useState } from "react";
import { useAppStore } from "../lib/store";
import { format } from "date-fns";
import { Plus, Trash2, Circle, Loader2, MessageSquare } from "lucide-react";

type Session = { id: string; title: string; createdAt: string; updatedAt: string; status: "active" | "completed" | "aborted" };

export function SessionListPanel() {
  const [isLoading, setIsLoading] = useState(false);
  const { sessions, activeSession, serverStatus, createSession, selectSession, deleteSession } = useAppStore();

  const handleCreate = async () => {
    setIsLoading(true);
    try {
      const session = await createSession();
      if (session) {
        await selectSession(session);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = async (session: Session) => {
    await selectSession(session);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteSession(id);
  };

  if (serverStatus !== "available") {
    return (
      <div className="p-4 text-center text-[var(--color-text-muted)]">
        <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Not connected to server</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-[var(--color-border)]">
        <button
          onClick={handleCreate}
          disabled={isLoading}
          className="w-full btn-primary flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          New Session
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-2">
        {sessions.length === 0 ? (
          <div className="p-4 text-center text-sm text-[var(--color-text-muted)]">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No sessions yet</p>
            <p className="text-xs mt-1">Create a new session to start</p>
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              onClick={() => handleSelect(session)}
              className={`session-card group ${
                activeSession?.id === session.id ? "active" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Circle
                      className={`w-2 h-2 ${
                        session.status === "active"
                          ? "fill-[var(--color-success)] text-[var(--color-success)]"
                          : "fill-[var(--color-text-muted)] text-[var(--color-text-muted)]"
                      }`}
                    />
                    <h3 className="text-sm font-medium truncate text-[var(--color-text)]">
                      {session.title || "Untitled"}
                    </h3>
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {format(session.updatedAt, "MMM d, h:mm a")}
                  </p>
                </div>
                <button
                  onClick={(e) => handleDelete(e, session.id)}
                  className="btn-icon opacity-0 group-hover:opacity-100 p-1"
                  title="Delete session"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}