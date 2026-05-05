import { useEffect, useRef, useState } from "react";
import { useAppStore } from "../lib/store";
import { Send, StopCircle, Loader2, Terminal, FileCode, MessageSquare } from "lucide-react";

type MessagePart = { id: string; type: string; content?: string; toolName?: string; toolCallID?: string };

export function ChatView() {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  const {
    activeSession,
    messages,
    isStreaming,
    sendMessage,
    abortSession,
  } = useAppStore();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [activeSession?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !activeSession || isStreaming) return;

    const content = input.trim();
    setInput("");
    await sendMessage(activeSession.id, content);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  if (!activeSession) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-[var(--color-text-muted)]">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Select a session to start chatting</p>
        </div>
      </div>
    );
  }

  const getContent = (msg: typeof messages[0]) => {
    if (msg.content) return msg.content;
    return msg.parts.map((p) => p.content || "").join("");
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-[var(--color-text-muted)]">
              <Terminal className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Send a message to start the session</p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="space-y-2">
              <div
                className={`message ${
                  message.role === "user" ? "message-user" : "message-assistant"
                }`}
              >
                <div className="text-sm whitespace-pre-wrap">
                  {getContent(message)}
                </div>
              </div>

              {message.parts
                .filter((p) => p.type === "tool_call" || p.type === "tool_result")
                .map((part: MessagePart) => (
                  <div
                    key={part.id}
                    className={`tool-event ${
                      part.type === "tool_call"
                        ? "tool-event-running"
                        : "tool-event-completed"
                    }`}
                  >
                    <div className="flex items-center gap-2 text-[var(--color-amber)]">
                      <FileCode className="w-3 h-3" />
                      <span className="text-xs font-medium">
                        {part.toolName || "tool"}
                      </span>
                    </div>
                    {part.content && (
                      <pre className="mt-1 text-xs text-[var(--color-text-muted)] whitespace-pre-wrap">
                        {part.content}
                      </pre>
                    )}
                  </div>
                ))}
            </div>
          ))
        )}

        {isStreaming && (
          <div className="message message-assistant">
            <div className="flex items-center gap-2 text-[var(--color-amber)]">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Thinking...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-3 border-t border-[var(--color-border)]">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            className="flex-1 min-h-[44px] max-h-32 resize-none"
            disabled={isStreaming}
            rows={1}
          />
          {isStreaming ? (
            <button
              type="button"
              onClick={() => abortSession()}
              className="btn-primary bg-[var(--color-error)] hover:bg-[#d73a49]"
            >
              <StopCircle className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="btn-primary"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}