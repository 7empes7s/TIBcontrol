import React from "react";

export type ApprovalMode = "default" | "auto_edit" | "plan" | "yolo";
export type EffortLevel = "low" | "medium" | "high";
export type OutputFormat = "stream-json" | "text";

export interface AgentRuntimeBarProps {
  model: string;
  onModelChange?: (model: string) => void;
  models?: Array<{ name: string; label: string }>;
  approvalMode?: ApprovalMode;
  onApprovalModeChange?: (mode: ApprovalMode) => void;
  effortLevel?: EffortLevel;
  onEffortLevelChange?: (level: EffortLevel) => void;
  outputFormat?: OutputFormat;
  onOutputFormatChange?: (format: OutputFormat) => void;
  disabledFeatures?: string[];
  yoloWarn?: boolean;
}

export function AgentRuntimeBar({
  model,
  onModelChange,
  models = [],
  approvalMode,
  onApprovalModeChange,
  effortLevel,
  onEffortLevelChange,
  outputFormat,
  onOutputFormatChange,
  disabledFeatures = [],
  yoloWarn = false,
}: AgentRuntimeBarProps) {
  return (
    <div className="oc-runtime-bar">
      {/* Model */}
      <label>Model</label>
      <select
        value={model}
        onChange={(e) => onModelChange?.(e.target.value)}
        disabled={disabledFeatures.includes("model") || !onModelChange}
        title={disabledFeatures.includes("model") ? "Model switching not available" : undefined}
      >
        {models.length > 0 ? (
          models.map((m) => (
            <option key={m.name} value={m.name}>{m.label}</option>
          ))
        ) : (
          <option value={model}>{model}</option>
        )}
      </select>

      {/* Approval */}
      {approvalMode !== undefined && (
        <>
          <label>Approval</label>
          <select
            value={approvalMode}
            onChange={(e) => onApprovalModeChange?.(e.target.value as ApprovalMode)}
            disabled={disabledFeatures.includes("approvalMode") || !onApprovalModeChange}
          >
            <option value="default">default</option>
            <option value="auto_edit">auto_edit</option>
            <option value="plan">plan</option>
            <option value="yolo">yolo ⚠</option>
          </select>
        </>
      )}

      {/* Effort */}
      {effortLevel !== undefined && (
        <>
          <label>Effort</label>
          <select
            value={effortLevel}
            onChange={(e) => onEffortLevelChange?.(e.target.value as EffortLevel)}
            disabled={disabledFeatures.includes("effortLevel") || !onEffortLevelChange}
          >
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
          </select>
        </>
      )}

      {/* Output */}
      {outputFormat !== undefined && (
        <>
          <label>Output</label>
          <select
            value={outputFormat}
            onChange={(e) => onOutputFormatChange?.(e.target.value as OutputFormat)}
            disabled={disabledFeatures.includes("outputFormat") || !onOutputFormatChange}
          >
            <option value="stream-json">stream-json</option>
            <option value="text">text</option>
          </select>
        </>
      )}

      {yoloWarn && approvalMode === "yolo" && (
        <span className="oc-yolo-warn">⚠ YOLO active</span>
      )}
      {yoloWarn && model && models.length > 0 && !models.some(m => m.name === model) && model !== "gemini-2.5-flash" && (
          <span className="oc-yolo-warn">custom: {model}</span>
      )}
    </div>
  );
}
