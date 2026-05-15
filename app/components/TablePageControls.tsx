import type { PageSize } from "../hooks/useTablePage";
import { PAGE_SIZE_OPTIONS } from "../hooks/useTablePage";

interface Props {
  start: number;
  end: number;
  total: number;
  page: number;
  pageCount: number;
  pageSize: PageSize;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onSetPageSize: (s: PageSize) => void;
  noun?: string;
}

export function TablePageControls({
  start, end, total, pageCount, pageSize,
  hasPrev, hasNext, onPrev, onNext, onSetPageSize, noun = "items",
}: Props) {
  if (total === 0) return null;

  return (
    <div className="table-page-controls">
      <span className="tpc-count">
        {total <= (pageSize === "all" ? Infinity : (pageSize as number))
          ? `${total} ${noun}`
          : `${start + 1}–${end} of ${total} ${noun}`}
      </span>
      <div className="tpc-nav">
        <button className="tpc-btn" disabled={!hasPrev} onClick={onPrev}>‹</button>
        <button className="tpc-btn" disabled={!hasNext} onClick={onNext}>›</button>
      </div>
      <select
        className="filter-select tpc-size"
        value={String(pageSize)}
        onChange={e => {
          const v = e.target.value;
          onSetPageSize(v === "all" ? "all" : (Number(v) as PageSize));
        }}
      >
        {PAGE_SIZE_OPTIONS.map(s => (
          <option key={String(s)} value={String(s)}>{s === "all" ? "all" : `${s} / page`}</option>
        ))}
      </select>
    </div>
  );
}
