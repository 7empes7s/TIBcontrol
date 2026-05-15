import React, { useState, useMemo } from "react";

export type AgentModel = {
  id: string;
  name: string;
  provider?: string;
  capabilities?: {
    image?: boolean;
    attachment?: boolean;
  };
};

export function AgentModelPicker({
  models,
  currentModel,
  onSelect,
  onClose,
}: {
  models: AgentModel[];
  currentModel: string | null;
  onSelect: (modelId: string) => void;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    if (!filter) return models;
    const f = filter.toLowerCase();
    return models.filter(m =>
      m.id.toLowerCase().includes(f) ||
      m.name.toLowerCase().includes(f) ||
      m.provider?.toLowerCase().includes(f)
    );
  }, [models, filter]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box oc-model-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Choose model</div>
        <input
          className="modal-input"
          placeholder="Filter models…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          autoFocus
        />
        <div className="oc-model-list">
          {filtered.length === 0 && <div className="loading-dim">no models</div>}
          {filtered.map((m) => {
            const active = currentModel === m.id;
            return (
              <button
                key={m.id}
                className={`oc-model-row${active ? " active" : ""}`}
                onClick={() => { onSelect(m.id); onClose(); }}
              >
                <div className="oc-model-name">{m.name}</div>
                <div className="oc-model-meta">
                  <span className="oc-model-id">{m.id}</span>
                  {m.capabilities?.image && <span className="pill blue" style={{ fontSize: 9 }}>image</span>}
                  {m.capabilities?.attachment && <span className="pill blue" style={{ fontSize: 9 }}>attach</span>}
                </div>
              </button>
            );
          })}
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
