import { useState } from "react";
import { useAppStore } from "../lib/store";
import { Cpu, Cloud, AlertTriangle, Circle, ChevronDown } from "lucide-react";

export function ModelSelector() {
  return null;
}

export function ModelStatusBadge({ modelId }: { modelId: string }) {
  return (
    <div className="status-indicator">
      <Cloud className="w-3 h-3" />
      <span className="capitalize">available</span>
    </div>
  );
}

export function ModelSelectorModal() {
  return (
    <button className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-sm">
      <span className="text-[var(--color-text-muted)]">Auto</span>
    </button>
  );
}