import { useEffect, useRef, useState } from "react";
import { useStore } from "../lib/store";
import { PartView } from "./PartView";
import { Send, Square, TriangleAlert } from "lucide-react";

// ── Permission banner ──────────────────────────────────────────────────────

function PermissionBanner() {
  const { permission, replyPermission } = useStore();
  if (!permission) return null;

  const msg = permission.metadata?.message ?? "Tool execution requires your approval.";
  const title = permission.metadata?.title ?? "Permission required";

  return (
    <div style={{ padding: "0 0 8px" }}>
      <div className="permission-bar">
        <div className="permission-bar-title">
          <TriangleAlert size={12} />
          {title}
        </div>
        <div className="permission-bar-msg">{msg}</div>
        <div className="permission-btns">
          <button className="perm-btn allow" onClick={() => replyPermission(permission.id, "allow")}>
            allow
          </button>
          <button className="perm-btn deny" onClick={() => replyPermission(permission.id, "deny")}>
            deny
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Chat area ──────────────────────────────────────────────────────────────

export function ChatArea() {
  const { activeSession, messages, parts, messageOrder, messageParts, running, sendMessage } = useStore();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // auto-scroll on new content
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messageOrder.length, Object.keys(parts).length]);

  // auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 150)}px`;
  }, [input]);

  const handleSubmit = async () => {
    const text = input.trim();
    if (!text || !activeSession || running) return;
    setInput("");
    await sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!activeSession) {
    return (
      <div className="main">
        <div className="empty-state">
          <div className="prompt-symbol">_</div>
          <div className="empty-state-title">no session selected</div>
          <div className="empty-state-hint">← create or select a session</div>
        </div>
      </div>
    );
  }

  // Build ordered messages with their live parts
  const orderedMsgs = messageOrder
    .map((id) => messages.find((m) => m.info.id === id))
    .filter(Boolean) as typeof messages;

  return (
    <div className="main">
      {/* Topbar */}
      <div className="topbar">
        <div className="topbar-path">
          <span className="hl">{activeSession.title || activeSession.slug}</span>
          <span style={{ marginLeft: 6 }}>— {activeSession.directory}</span>
        </div>
        {running && <div className="topbar-badge running">● running</div>}
        {!running && <div className="topbar-badge">idle</div>}
      </div>

      {/* Messages */}
      <div className="messages">
        {orderedMsgs.length === 0 && (
          <div style={{ maxWidth: 860, margin: "40px auto", padding: "0 20px" }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)" }}>
              session ready — send a message to begin
            </div>
          </div>
        )}

        {orderedMsgs.map((msg, msgIdx) => {
          const isUser = msg.info.role === "user";
          const livePartIds = messageParts[msg.info.id] ?? msg.parts.map((p) => p.id);
          const liveParts = livePartIds.map((pid) => parts[pid] ?? msg.parts.find((p) => p.id === pid)).filter(Boolean);
          const isLastMsg = msgIdx === orderedMsgs.length - 1;

          if (isUser) {
            const textPart = liveParts.find((p) => p?.type === "text") as { text: string } | undefined;
            const text = textPart?.text ?? liveParts.map((p) => (p as { text?: string }).text ?? "").join("");
            return (
              <div key={msg.info.id} className="msg-wrap">
                <div className="msg-user">
                  <div className="msg-user-bubble">{text}</div>
                </div>
              </div>
            );
          }

          // assistant
          const visibleParts = liveParts.filter((p) => p && p.type !== "step-start" && p.type !== "step-finish");
          if (visibleParts.length === 0 && !running) return null;

          return (
            <div key={msg.info.id} className="msg-wrap">
              <div className="msg-assistant">
                <div className="msg-label model">
                  {msg.info.modelID ?? "assistant"}
                </div>
                {visibleParts.map((part, partIdx) => (
                  <PartView
                    key={part!.id}
                    part={part!}
                    isLast={isLastMsg && partIdx === visibleParts.length - 1}
                    running={running}
                  />
                ))}
                {isLastMsg && running && visibleParts.length === 0 && (
                  <div className="part-text">
                    <span className="stream-cursor" />
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 20px" }}>
          <PermissionBanner />
        </div>

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="input-area">
        <div className="input-inner">
          <div className="input-wrap">
            <textarea
              ref={textareaRef}
              className="input-textarea"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={running ? "waiting for response…" : "message opencode  (shift+enter for newline)"}
              disabled={running}
              rows={1}
            />
            {running ? (
              <button className="input-stop-btn" title="Stop">
                <Square size={12} />
              </button>
            ) : (
              <button
                className="input-send-btn"
                onClick={handleSubmit}
                disabled={!input.trim()}
                title="Send (Enter)"
              >
                <Send size={12} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
