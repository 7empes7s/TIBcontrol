interface Props {
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number;
  title?: string;
}

export function TableFilterChip({ label, active, onClick, count, title }: Props) {
  return (
    <button
      type="button"
      className={`filter-toggle${active ? " active" : ""}`}
      onClick={onClick}
      title={title ?? `Toggle ${label} filter`}
    >
      <span>{label}</span>
      {count !== undefined && <span className="filter-count">{count}</span>}
    </button>
  );
}
