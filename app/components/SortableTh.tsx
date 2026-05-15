import type { ReactNode } from "react";
import type { SortState } from "../hooks/useTableSort";

interface Props<K extends string> {
  sortKey: K;
  sort: SortState<K>;
  onSort: (key: K) => void;
  children: ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
  title?: string;
}

export function SortableTh<K extends string>({
  sortKey,
  sort,
  onSort,
  children,
  className,
  align = "left",
  title,
}: Props<K>) {
  const active = sort.key === sortKey;
  const dir = active ? sort.dir : null;
  const ariaSort = active ? (dir === "asc" ? "ascending" : "descending") : "none";
  const arrow = !active ? "↕" : dir === "asc" ? "↑" : "↓";

  return (
    <th
      className={`sortable-th${active ? " sortable-th-active" : ""}${className ? ` ${className}` : ""}`}
      aria-sort={ariaSort}
      onClick={() => onSort(sortKey)}
      title={title ?? `Sort by ${String(sortKey)}`}
      style={{ textAlign: align, cursor: "pointer", userSelect: "none" }}
    >
      <span className="sortable-th-label">{children}</span>
      <span className="sortable-th-arrow" aria-hidden="true">{arrow}</span>
    </th>
  );
}
