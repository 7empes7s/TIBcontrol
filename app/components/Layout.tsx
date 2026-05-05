import { useState } from "react";
import { useAppStore } from "../lib/store";
import { Wifi, WifiOff, Menu, X, ArrowLeft, Settings, MessageSquare } from "lucide-react";
import { ModelSelectorModal } from "./ModelSelector";
import { SessionListPanel } from "./SessionListPanel";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const {
    serverStatus,
    serverVersion,
    activeSession,
    serverUrl,
    disconnect,
    setActiveSession,
  } = useAppStore();

  const handleBack = () => {
    setActiveSession(null);
  };

  return (
    <div className="h-screen flex flex-col md:flex-row">
      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        <div className="flex items-center gap-2">
          {activeSession ? (
            <button onClick={handleBack} className="btn-icon">
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : (
            <span className="font-semibold text-[var(--color-text)]">Sessions</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ModelSelectorModal />
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="btn-icon">
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex md:w-64 flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        <div className="p-4 border-b border-[var(--color-border)]">
          <h1 className="font-semibold text-[var(--color-text)]">
            OpenCode Control
          </h1>
          <div className="flex items-center gap-2 mt-2 text-xs text-[var(--color-text-muted)]">
            {serverStatus === "available" ? (
              <>
                <Wifi className="w-3 h-3 text-[var(--color-success)]" />
                <span>Connected</span>
                {serverVersion && <span>(v{serverVersion})</span>}
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-[var(--color-error)]" />
                <span>Disconnected</span>
              </>
            )}
          </div>
        </div>

        <div className="p-3 border-b border-[var(--color-border)]">
          <div className="flex items-center justify-between">
            <ModelSelectorModal />
            {serverUrl && (
              <span className="text-xs text-[var(--color-text-muted)] truncate max-w-[100px]">
                {serverUrl.replace("http://", "")}
              </span>
            )}
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto">
          <SessionListPanel />
        </nav>

        <div className="p-3 border-t border-[var(--color-border)]">
          <button
            onClick={() => disconnect()}
            className="w-full btn-secondary text-sm"
          >
            Disconnect
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-[var(--color-bg)]">
          <div className="h-full flex flex-col">
            <header className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)]">
              <h1 className="font-semibold text-[var(--color-text)]">OpenCode</h1>
              <button onClick={() => setSidebarOpen(false)} className="btn-icon">
                <X className="w-5 h-5" />
              </button>
            </header>
            <nav className="flex-1 overflow-y-auto">
              <SessionListPanel />
            </nav>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden flex items-center justify-around px-2 py-2 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        <button className="flex flex-col items-center gap-1 p-2 text-[var(--color-amber)]">
          <MessageSquare className="w-5 h-5" />
          <span className="text-xs">Chat</span>
        </button>
        <button
          onClick={() => disconnect()}
          className="flex flex-col items-center gap-1 p-2 text-[var(--color-text-muted)]"
        >
          <WifiOff className="w-5 h-5" />
          <span className="text-xs">Disconnect</span>
        </button>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="flex flex-col items-center gap-1 p-2 text-[var(--color-text-muted)]"
        >
          <Settings className="w-5 h-5" />
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  );
}