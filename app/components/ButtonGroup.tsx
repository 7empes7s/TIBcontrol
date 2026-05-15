import React from "react";

export type ButtonGroupOption<T extends string> = {
  value: T;
  label: React.ReactNode;
  title?: string;
};

export function ButtonGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  options: ButtonGroupOption<T>[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="modal-input-row">
      <span className="modal-input-label">{label}</span>
      <div className={`builder-btn-group${disabled ? " disabled" : ""}`}>
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`builder-btn-group-item${value === opt.value ? " active" : ""}`}
            title={opt.title}
            onClick={() => !disabled && onChange(opt.value)}
            disabled={disabled}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
