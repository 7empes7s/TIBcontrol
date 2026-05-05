import { exec } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync } from "node:fs";

const execAsync = promisify(exec);
const STRIP_ANSI = /\x1b\[[0-9;]*m/g;
const GPU_HEALTH_PATH = "/var/lib/mimule/gpu-health.json";

export interface VastInstance {
  id: string;
  status: string;
  gpu: string;
  vcpus: number;
  ram: number;
  disk: number;
  gpuRam: number;
  hourlyRate: number;
  ip: string;
  sshPort: number;
  machineId: string;
  uptime: number;
  gpuUtil: number;
}

export interface VastAccount {
  balance: number;
  credit: number;
  email: string;
  userId: string;
}

// vastai show instances returns 3 multi-line rows per instance:
//  Row A: # ID  Machine  Status   Num  Model  Util.%  vCPUs  RAM  Storage
//  Row B: # SSH_Addr  SSH_Port  $/hr  Image  Net_up
//  Row C: # Net_down  R  Label  age(h)  uptime(m)
export async function getVastInstance(): Promise<VastInstance | null> {
  try {
    const { stdout } = await execAsync("vastai show instances", { timeout: 8000 });
    const lines = stdout.split("\n").map((l) => l.replace(STRIP_ANSI, "").trim()).filter(Boolean);

    let rowA: string[] | null = null;
    let rowB: string[] | null = null;

    for (const line of lines) {
      const parts = line.split(/\s+/);
      if (parts.length < 4) continue;

      // Row A: contains "running" or "stopped" at index 3
      if (parts[3] === "running" || parts[3] === "stopped") {
        rowA = parts;
      }
      // Row B: contains a $/hr value at index 3 (a decimal number like 0.1378)
      // and SSH addr at index 1 (contains "." or "ssh")
      if (rowA && parts[0] === rowA[0] && /^\d+\.\d+$/.test(parts[3])) {
        rowB = parts;
      }
    }

    if (!rowA) return null;

    return {
      id: rowA[1] ?? "",
      status: rowA[3] ?? "unknown",
      gpu: rowA[5] ?? "",
      vcpus: parseFloat(rowA[7] ?? "0") || 0,
      ram: parseFloat(rowA[8] ?? "0") || 0,
      disk: parseFloat(rowA[9] ?? "0") || 0,
      gpuRam: 24,
      hourlyRate: rowB ? parseFloat(rowB[3] ?? "0") || 0 : 0,
      ip: rowB ? rowB[1] ?? "" : "",
      sshPort: rowB ? parseInt(rowB[2] ?? "0") || 0 : 0,
      machineId: rowA[2] ?? "",
      uptime: 0,
      gpuUtil: 0,
    };
  } catch {
    return null;
  }
}

// vastai show user currently returns a 400 error — fall back to gpu-health.json
// which tracks balance indirectly via the watchdog.
export async function getVastAccount(): Promise<VastAccount | null> {
  try {
    const { stdout } = await execAsync("vastai show user", { timeout: 6000 });
    let balance = 0, credit = 0, email = "", userId = "";

    for (const line of stdout.split("\n")) {
      if (line.includes("Balance")) {
        const m = line.match(/([\d.]+)/);
        if (m) balance = parseFloat(m[1]);
      }
      if (line.includes("Credit")) {
        const parts = line.trim().split(/\s+/);
        for (let i = 0; i < parts.length; i++) {
          if (parts[i] === "Credit" && /^\d/.test(parts[i + 1] ?? "")) {
            credit = parseFloat(parts[i + 1]);
          }
        }
      }
      if (line.includes("@")) {
        const m = line.match(/[\w.+%-]+@[\w.-]+/);
        if (m) email = m[0];
      }
      if (line.includes("vast.ai/admin")) {
        const m = line.match(/user\/(\d+)/);
        if (m) userId = m[1];
      }
    }

    if (balance === 0 && credit === 0 && !email) return null;
    return { balance, credit, email, userId };
  } catch {
    return null;
  }
}

// GPU util comes from the watchdog-written gpu-health.json — faster than SSH
export function getGpuUtilFromHealth(): number | null {
  try {
    const raw = JSON.parse(readFileSync(GPU_HEALTH_PATH, "utf8")) as { gpu_max_util?: number };
    return raw.gpu_max_util ?? null;
  } catch {
    return null;
  }
}
