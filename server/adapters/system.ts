import { execSync } from "node:child_process";

export interface ServicePill {
  name: string;
  status: "active" | "inactive" | "failed" | "unknown";
}

const CRITICAL_SERVICES = [
  "newsbites",
  "newsbites-autopipeline",
  "litellm",
  "opencode-server",
  "control-surface",
  "vast-tunnel",
  "cloudflared",
];

const DOCKER_CONTAINERS = ["openclaw_gateway", "paperclip", "paperclip_db", "goblin_game"];

export function getServiceStatuses(): ServicePill[] {
  const results: ServicePill[] = [];

  try {
    const raw = execSync(
      `systemctl is-active ${CRITICAL_SERVICES.join(" ")} 2>/dev/null || true`,
      { encoding: "utf8", timeout: 5000 }
    );
    const statuses = raw.trim().split("\n");
    for (let i = 0; i < CRITICAL_SERVICES.length; i++) {
      const s = (statuses[i] || "unknown").trim();
      results.push({
        name: CRITICAL_SERVICES[i],
        status: s === "active" ? "active" : s === "failed" ? "failed" : s === "inactive" ? "inactive" : "unknown",
      });
    }
  } catch {
    for (const name of CRITICAL_SERVICES) {
      results.push({ name, status: "unknown" });
    }
  }

  try {
    const raw = execSync(
      `docker inspect --format='{{.Name}} {{.State.Status}}' ${DOCKER_CONTAINERS.join(" ")} 2>/dev/null || true`,
      { encoding: "utf8", timeout: 5000 }
    );
    for (const line of raw.trim().split("\n")) {
      if (!line.trim()) continue;
      const parts = line.trim().split(/\s+/);
      const name = parts[0].replace(/^\//, "");
      const status = parts[1] || "unknown";
      results.push({
        name,
        status: status === "running" ? "active" : status === "exited" ? "inactive" : "unknown",
      });
    }
  } catch {
    for (const name of DOCKER_CONTAINERS) {
      results.push({ name, status: "unknown" });
    }
  }

  return results;
}

export interface HetznerStats {
  load1: number;
  load5: number;
  load15: number;
  memTotalKb: number;
  memUsedKb: number;
  memAvailableKb: number;
  diskTotalGb: number;
  diskUsedGb: number;
  diskUsedPct: number;
}

export function getHetznerStats(): HetznerStats {
  let load1 = 0, load5 = 0, load15 = 0;
  try {
    const raw = execSync("cat /proc/loadavg", { encoding: "utf8", timeout: 2000 });
    const parts = raw.trim().split(/\s+/);
    load1 = parseFloat(parts[0]) || 0;
    load5 = parseFloat(parts[1]) || 0;
    load15 = parseFloat(parts[2]) || 0;
  } catch {}

  let memTotalKb = 0, memUsedKb = 0, memAvailableKb = 0;
  try {
    const raw = execSync("cat /proc/meminfo", { encoding: "utf8", timeout: 2000 });
    for (const line of raw.split("\n")) {
      if (line.startsWith("MemTotal:")) memTotalKb = parseInt(line.split(/\s+/)[1]) || 0;
      if (line.startsWith("MemAvailable:")) memAvailableKb = parseInt(line.split(/\s+/)[1]) || 0;
    }
    memUsedKb = memTotalKb - memAvailableKb;
  } catch {}

  let diskTotalGb = 0, diskUsedGb = 0, diskUsedPct = 0;
  try {
    const raw = execSync("df -BG / | tail -1", { encoding: "utf8", timeout: 2000 });
    const parts = raw.trim().split(/\s+/);
    diskTotalGb = parseInt(parts[1]) || 0;
    diskUsedGb = parseInt(parts[2]) || 0;
    diskUsedPct = parseInt(parts[4]) || 0;
  } catch {}

  return { load1, load5, load15, memTotalKb, memUsedKb, memAvailableKb, diskTotalGb, diskUsedGb, diskUsedPct };
}

export interface TimerInfo {
  name: string;
  active: boolean;
  lastTrigger: string | null;
  nextElapse: string | null;
  lastResult: string | null;
}

const KNOWN_TIMERS = [
  "model-health-check",
  "paperclip-action-notify",
  "newsbites-agent-watch",
  "newsbites-brief",
  "morning-brief",
  "mimule-backup",
  "vast-watchdog",
];

export function getTimers(): TimerInfo[] {
  return KNOWN_TIMERS.map((name) => {
    const timerUnit = `${name}.timer`;
    try {
      const raw = execSync(
        `systemctl show ${timerUnit} --property=ActiveState,LastTriggerUSec,NextElapseUSecRealtime,Result 2>/dev/null || true`,
        { encoding: "utf8", timeout: 3000 }
      );
      const props: Record<string, string> = {};
      for (const line of raw.trim().split("\n")) {
        const eq = line.indexOf("=");
        if (eq > 0) props[line.slice(0, eq)] = line.slice(eq + 1);
      }
      return {
        name,
        active: props.ActiveState === "active",
        lastTrigger: props.LastTriggerUSec && props.LastTriggerUSec !== "n/a" ? props.LastTriggerUSec : null,
        nextElapse: props.NextElapseUSecRealtime && props.NextElapseUSecRealtime !== "n/a" ? props.NextElapseUSecRealtime : null,
        lastResult: props.Result ?? null,
      };
    } catch {
      return { name, active: false, lastTrigger: null, nextElapse: null, lastResult: null };
    }
  });
}
