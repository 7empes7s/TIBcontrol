import { create } from "zustand";

const API = "/opencode";

// ── Types ──────────────────────────────────────────────────────────────────

export type Session = {
  id: string;
  slug: string;
  title: string;
  projectID: string;
  directory: string;
  version: string;
  time: { created: number; updated: number };
};

export type Part =
  | { id: string; messageID: string; sessionID: string; type: "text"; text: string }
  | { id: string; messageID: string; sessionID: string; type: "reasoning"; text: string }
  | { id: string; messageID: string; sessionID: string; type: "tool"; callID: string; tool: string; state: ToolState }
  | { id: string; messageID: string; sessionID: string; type: "step-start" }
  | { id: string; messageID: string; sessionID: string; type: "step-finish"; tokens?: unknown; cost?: number }
  | { id: string; messageID: string; sessionID: string; type: "patch"; files: string[] }
  | { id: string; messageID: string; sessionID: string; type: string; [k: string]: unknown };

export type ToolState =
  | { status: "pending"; input: Record<string, unknown>; raw: string }
  | { status: "running"; input: Record<string, unknown>; title?: string; time: { start: number } }
  | { status: "completed"; input: Record<string, unknown>; output: string; title: string; time: { start: number; end: number } }
  | { status: "error"; input: Record<string, unknown>; error: string };

export type Message = {
  info: {
    id: string;
    sessionID: string;
    role: "user" | "assistant";
    time: { created: number; completed?: number };
    modelID?: string;
    providerID?: string;
    error?: unknown;
  };
  parts: Part[];
};

export type Permission = {
  id: string;
  sessionID: string;
  createdAt: number;
  metadata: { message?: string; title?: string; [k: string]: unknown };
};

// ── Store ──────────────────────────────────────────────────────────────────

interface State {
  ready: boolean;
  sessions: Session[];
  activeSession: Session | null;
  messages: Message[];
  parts: Record<string, Part>;
  messageOrder: string[];
  messageParts: Record<string, string[]>;
  running: boolean;
  permission: Permission | null;

  init: () => Promise<void>;
  selectSession: (session: Session) => Promise<void>;
  createSession: () => Promise<Session | null>;
  deleteSession: (id: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  replyPermission: (id: string, action: "allow" | "deny") => Promise<void>;
}

let sse: EventSource | null = null;

function startSSE(dispatch: (event: MessageEvent) => void) {
  if (sse) { sse.close(); sse = null; }
  sse = new EventSource(`${API}/event`);
  sse.onmessage = dispatch;
  sse.onerror = () => {
    setTimeout(() => {
      if (sse) { sse.close(); sse = null; }
      startSSE(dispatch);
    }, 3000);
  };
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json();
}

export const useStore = create<State>((set, get) => {
  function handleSSE(event: MessageEvent) {
    let ev: { type: string; properties: Record<string, unknown> };
    try { ev = JSON.parse(event.data); }
    catch { return; }

    const { activeSession } = get();

    switch (ev.type) {
      case "message.part.updated": {
        const part = ev.properties.part as Part;
        const delta = ev.properties.delta as string | undefined;
        if (!activeSession || part.sessionID !== activeSession.id) return;

        set((s) => {
          const existing = s.parts[part.id];
          let updated: Part;
          if (part.type === "text" && delta && existing?.type === "text") {
            updated = { ...existing, text: (existing as { type: "text"; text: string }).text + delta };
          } else {
            updated = part;
          }
          const newParts = { ...s.parts, [part.id]: updated };
          const msgId = part.messageID;
          const existingIds = s.messageParts[msgId] ?? [];
          const newIds = existingIds.includes(part.id) ? existingIds : [...existingIds, part.id];
          return { parts: newParts, messageParts: { ...s.messageParts, [msgId]: newIds } };
        });
        break;
      }

      case "message.updated": {
        const info = ev.properties.info as Message["info"];
        if (!activeSession || info.sessionID !== activeSession.id) return;
        set((s) => {
          const idx = s.messages.findIndex((m) => m.info.id === info.id);
          if (idx >= 0) {
            const updated = [...s.messages];
            updated[idx] = { ...updated[idx], info };
            return { messages: updated };
          }
          const newOrder = s.messageOrder.includes(info.id)
            ? s.messageOrder : [...s.messageOrder, info.id];
          return { messages: [...s.messages, { info, parts: [] }], messageOrder: newOrder };
        });
        break;
      }

      case "session.idle": {
        const sid = (ev.properties as { sessionID: string }).sessionID;
        if (!activeSession || sid !== activeSession.id) return;
        set({ running: false });
        apiFetch<Session[]>("/session").then((sessions) => set({ sessions })).catch(() => {});
        break;
      }

      case "session.status": {
        const sid = (ev.properties as { sessionID: string }).sessionID;
        if (!activeSession || sid !== activeSession.id) return;
        const status = (ev.properties as { status: string }).status;
        set({ running: status === "running" });
        break;
      }

      case "permission.updated": {
        const perm = ev.properties as unknown as Permission;
        if (!activeSession || perm.sessionID !== activeSession.id) return;
        set({ permission: perm });
        break;
      }

      case "permission.replied": {
        set({ permission: null });
        break;
      }
    }
  }

  return {
    ready: false,
    sessions: [],
    activeSession: null,
    messages: [],
    parts: {},
    messageOrder: [],
    messageParts: {},
    running: false,
    permission: null,

    init: async () => {
      startSSE(handleSSE);
      const sessions = await apiFetch<Session[]>("/session");
      set({ sessions, ready: true });
    },

    selectSession: async (session: Session) => {
      set({
        activeSession: session,
        messages: [],
        parts: {},
        messageOrder: [],
        messageParts: {},
        running: false,
        permission: null,
      });
      type RawMsg = { info: Message["info"]; parts: Part[] };
      const raw = await apiFetch<RawMsg[]>(`/session/${session.id}/message`);
      const parts: Record<string, Part> = {};
      const messageParts: Record<string, string[]> = {};
      const messageOrder: string[] = [];
      for (const msg of raw) {
        messageOrder.push(msg.info.id);
        messageParts[msg.info.id] = msg.parts.map((p) => p.id);
        for (const p of msg.parts) parts[p.id] = p;
      }
      set({ messages: raw, parts, messageParts, messageOrder });
    },

    createSession: async () => {
      const session = await apiFetch<Session>("/session", {
        method: "POST",
        body: JSON.stringify({}),
      });
      const sessions = await apiFetch<Session[]>("/session");
      set({ sessions });
      await get().selectSession(session);
      return session;
    },

    deleteSession: async (id: string) => {
      await apiFetch(`/session/${id}`, { method: "DELETE" });
      const sessions = await apiFetch<Session[]>("/session");
      const { activeSession } = get();
      if (activeSession?.id === id) {
        set({ sessions, activeSession: null, messages: [], parts: {}, messageOrder: [], messageParts: {} });
      } else {
        set({ sessions });
      }
    },

    sendMessage: async (content: string) => {
      const { activeSession } = get();
      if (!activeSession) return;
      set({ running: true });
      await apiFetch(`/session/${activeSession.id}/message`, {
        method: "POST",
        body: JSON.stringify({ parts: [{ type: "text", text: content }] }),
      });
    },

    replyPermission: async (id: string, action: "allow" | "deny") => {
      const { activeSession } = get();
      if (!activeSession) return;
      await apiFetch(`/session/${activeSession.id}/permission/${id}`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      set({ permission: null });
    },
  };
});

export const useAppStore = useStore;
