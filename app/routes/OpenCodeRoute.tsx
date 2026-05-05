import { useEffect } from "react";
import { useStore } from "../lib/store";
import { Sidebar } from "../components/Sidebar";
import { ChatArea } from "../components/ChatArea";

export function OpenCodeRoute() {
  const { init, ready } = useStore();
  useEffect(() => { init(); }, [init]);

  if (!ready) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)" }}>connecting…</span>
      </div>
    );
  }

  return (
    <>
      <Sidebar />
      <ChatArea />
    </>
  );
}
