import { useState, useMemo } from "react";

export type PageSize = 5 | 10 | 25 | 50 | "all";
export const PAGE_SIZE_OPTIONS: PageSize[] = [5, 10, 25, 50, "all"];

export function useTablePage<T>(items: T[], defaultSize: PageSize = 10) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSizeState] = useState<PageSize>(defaultSize);

  const setPageSize = (size: PageSize) => {
    setPageSizeState(size);
    setPage(0);
  };

  const total = items.length;
  const pageCount = pageSize === "all" ? 1 : Math.max(1, Math.ceil(total / pageSize));

  // Clamp page when items shrink
  const safePage = Math.min(page, pageCount - 1);

  const slice = useMemo(() => {
    if (pageSize === "all") return items;
    const start = safePage * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage, pageSize]);

  const start = pageSize === "all" ? 0 : safePage * pageSize;
  const end = pageSize === "all" ? total : Math.min(start + (pageSize as number), total);

  return {
    slice,
    page: safePage,
    pageSize,
    pageCount,
    total,
    start,
    end,
    setPage,
    setPageSize,
    hasPrev: safePage > 0,
    hasNext: safePage < pageCount - 1,
    prev: () => setPage(p => Math.max(0, p - 1)),
    next: () => setPage(p => Math.min(pageCount - 1, p + 1)),
  };
}
