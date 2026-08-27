export interface PageResult<T> {
  items: T[];
  page: number;
  pages: number;
  pageSize: number;
  remaining: number;
}

export function pageItems<T>(items: T[], page: number, pageSize: number): PageResult<T> {
  const safeSize = Math.max(1, Math.floor(pageSize));
  const pages = Math.max(1, Math.ceil(items.length / safeSize));
  const normalized = ((Math.floor(page) % pages) + pages) % pages;
  const start = normalized * safeSize;
  const visible = items.slice(start, start + safeSize);
  return { items: visible, page: normalized, pages, pageSize: safeSize, remaining: Math.max(0, items.length - start - visible.length) };
}
