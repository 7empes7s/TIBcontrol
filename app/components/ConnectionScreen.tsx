import { useState } from "react";
import { useAppStore } from "../lib/store";
import { Loader2, Wifi, WifiOff, Terminal, Sparkles } from "lucide-react";

export function ConnectionScreen() {
  const [url, setUrl] = useState("http://opencode.techinsiderbytes.com");
  const [username, setUsername] = useState("opencode");
  const [password, setPassword] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const { connect, serverStatus, error, serverVersion } = useAppStore();

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      await connect(url, username || undefined, password || undefined);
    } finally {
      setIsConnecting(false);
    }
  };

  const isConnected = serverStatus === "available";

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "linear-gradient(135deg, #0d1117 0%, #161b22 50%, #1a2332 100%)" }}>
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl" style={{ background: "linear-gradient(135deg, #F5A623 0%, #e09620 100%)" }}>
            <Terminal className="w-8 h-8" style={{ color: "#0d1117" }} />
          </div>
          <h1 className="text-3xl font-bold" style={{ color: "#e6edf3", letterSpacing: "-0.02em" }}>
            OpenCode
          </h1>
          <p className="text-sm" style={{ color: "#8b949e" }}>
            Control Surface
          </p>
          {isConnected && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full" style={{ background: "rgba(63, 185, 80, 0.1)", border: "1px solid rgba(63, 185, 80, 0.3)" }}>
              <span className="w-2 h-2 rounded-full" style={{ background: "#3fb950" }} />
              <span className="text-xs" style={{ color: "#3fb950" }}>Connected {serverVersion && `v${serverVersion}`}</span>
            </div>
          )}
        </div>

        <div className="space-y-5" style={{ background: "rgba(22, 27, 34, 0.8)", padding: "24px", borderRadius: "16px", border: "1px solid #30363d" }}>
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Server URL
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://localhost:4096"
              className="w-full"
              style={{ 
                background: "#0d1117", 
                border: "1px solid #30363d", 
                borderRadius: "8px", 
                color: "#e6edf3", 
                padding: "12px 14px",
                fontSize: "14px"
              }}
              disabled={isConnecting}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="opencode"
                className="w-full"
                style={{ 
                  background: "#0d1117", 
                  border: "1px solid #30363d", 
                  borderRadius: "8px", 
                  color: "#e6edf3", 
                  padding: "12px 14px",
                  fontSize: "14px"
                }}
                disabled={isConnecting}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full"
                style={{ 
                  background: "#0d1117", 
                  border: "1px solid #30363d", 
                  borderRadius: "8px", 
                  color: "#e6edf3", 
                  padding: "12px 14px",
                  fontSize: "14px"
                }}
                disabled={isConnecting}
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg text-sm" style={{ background: "rgba(248, 81, 73, 0.1)", border: "1px solid rgba(248, 81, 73, 0.3)", color: "#f85149" }}>
              {error}
            </div>
          )}

          <button
            onClick={handleConnect}
            disabled={isConnecting || !url}
            className="w-full flex items-center justify-center gap-2"
            style={{ 
              background: isConnecting ? "#30363d" : "linear-gradient(135deg, #F5A623 0%, #e09620 100%)",
              color: isConnecting ? "#8b949e" : "#0d1117",
              fontWeight: "600",
              padding: "14px 20px",
              borderRadius: "8px",
              fontSize: "14px",
              cursor: isConnecting ? "not-allowed" : "pointer",
              border: "none"
            }}
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Connecting...
              </>
            ) : isConnected ? (
              <>
                <Wifi className="w-4 h-4" />
                Connected
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Connect
              </>
            )}
          </button>
        </div>

        <div className="text-center text-xs" style={{ color: "#6e7681" }}>
          <p>Enter credentials for your OpenCode server</p>
          <p>Default: opencode / (your password)</p>
        </div>
      </div>
    </div>
  );
}