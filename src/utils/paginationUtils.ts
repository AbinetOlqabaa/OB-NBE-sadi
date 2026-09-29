/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

export function paginateList<T>(
  data: T[],
  pageParam?: any,
  pageSizeParam?: any
): PaginatedResult<T> {
  const total = data.length;
  const pageNum = Math.max(1, parseInt(pageParam as string, 10) || 1);
  const pageSize = Math.max(1, parseInt(pageSizeParam as string, 10) || 10);
  const total_pages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(pageNum, total_pages);
  const start = (safePage - 1) * pageSize;
  const items = data.slice(start, start + pageSize);

  return {
    items,
    total,
    page: safePage,
    page_size: pageSize,
    total_pages,
    has_next: safePage < total_pages,
    has_previous: safePage > 1,
  };
}
