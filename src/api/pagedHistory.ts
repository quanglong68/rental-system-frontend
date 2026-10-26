export type PageResult<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export type PagedHistory<T> = {
  items: T[];
  totalElements: number;
  totalPages: number;
  loadedPages: number;
  complete: boolean;
  incompleteReason: "page-error" | "page-limit" | null;
  error?: unknown;
};

type Options = { pageSize?: number; maxPages?: number };

/** Tải toàn bộ lịch sử; báo rõ nếu trang sau lỗi hoặc chạm giới hạn bảo vệ. */
export async function fetchPagedHistory<T>(
  fetchPage: (page: number, size: number) => Promise<PageResult<T>>,
  { pageSize = 100, maxPages = 100 }: Options = {},
): Promise<PagedHistory<T>> {
  const first = await fetchPage(0, pageSize);
  const items = [...first.content];
  const targetPages = first.totalPages;
  let loadedPages = targetPages === 0 ? 0 : 1;

  for (let page = 1; page < targetPages && page < maxPages; page += 1) {
    try {
      const next = await fetchPage(page, pageSize);
      items.push(...next.content);
      loadedPages += 1;
    } catch (error) {
      return {
        items,
        totalElements: first.totalElements,
        totalPages: targetPages,
        loadedPages,
        complete: false,
        incompleteReason: "page-error",
        error,
      };
    }
  }

  const complete = loadedPages >= targetPages;
  return {
    items,
    totalElements: first.totalElements,
    totalPages: targetPages,
    loadedPages,
    complete,
    incompleteReason: complete ? null : "page-limit",
  };
}
