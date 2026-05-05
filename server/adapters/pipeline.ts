import { readFileSync } from "node:fs";

const PIPELINE_API = "http://127.0.0.1:3200";
const STATE_PATH = "/var/lib/mimule/pipeline-state.json";

export interface QueueItem {
  id: string;
  slug?: string;
  stage: string;
  priority: number;
  waitingApproval: boolean;
  running?: boolean;
  createdAt?: number;
  lastApprovalPing?: number;
}

export interface PipelineState {
  queue: QueueItem[];
  current: { id: string; slug?: string; stage: string } | null;
  paused: boolean;
  pauseReason: string | null;
}

// File is the primary source (written by autopipeline on every state change).
// HTTP API is the freshest source for the current live state — tried first.
export async function getPipelineState(): Promise<PipelineState> {
  // Fast path: try live API (has current running story, live paused state)
  try {
    const res = await fetch(`${PIPELINE_API}/queue`, { signal: AbortSignal.timeout(2500) });
    if (res.ok) {
      const json = await res.json() as PipelineState & { ok?: boolean };
      // Autopipeline wraps in { ok, queue, current, paused, pauseReason }
      return {
        queue: json.queue ?? [],
        current: json.current ?? null,
        paused: json.paused ?? false,
        pauseReason: json.pauseReason ?? null,
      };
    }
  } catch {}

  // Fallback: read last written state file
  try {
    return JSON.parse(readFileSync(STATE_PATH, "utf8")) as PipelineState;
  } catch {
    return { queue: [], current: null, paused: false, pauseReason: null };
  }
}
