/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';

export interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  itemName?: string;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
  itemName = 'items',
  className = '',
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const startItem = totalItems === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, safeCurrentPage * pageSize);

  // If there are zero items, do not render
  if (totalItems === 0) {
    return null;
  }

  // Part 8 requirement: Do not display unnecessary pagination controls when all records fit on one page
  const hasMultiplePages = totalPages > 1;

  // Generate page numbers with smart ellipsis for desktop
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      if (safeCurrentPage > 3) {
        pages.push('...');
      }
      const start = Math.max(2, safeCurrentPage - 1);
      const end = Math.min(totalPages - 1, safeCurrentPage + 1);
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      if (safeCurrentPage < totalPages - 2) {
        pages.push('...');
      }
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div
      className={`px-3 sm:px-4 py-2 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs text-slate-600 dark:text-slate-300 transition-colors w-full overflow-hidden ${className}`}
    >
      {/* Zone 1: Showing X–Y of Z items & optional Page Size Selector */}
      <div className="flex items-center justify-between w-full sm:w-auto gap-3">
        <div className="text-slate-500 dark:text-slate-400 text-xs truncate">
          Showing <span className="font-semibold text-slate-900 dark:text-slate-100">{startItem}</span>–
          <span className="font-semibold text-slate-900 dark:text-slate-100">{endItem}</span> of{' '}
          <span className="font-semibold text-slate-900 dark:text-slate-100">{totalItems}</span> {itemName}
        </div>

        {onPageSizeChange && pageSizeOptions && pageSizeOptions.length > 1 && (
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 pl-2 border-l border-slate-200 dark:border-slate-700 shrink-0">
            <span className="hidden sm:inline">Show</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label="Items per page"
              className="min-h-[44px] sm:min-h-[32px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-ob-indigo-500 cursor-pointer touch-press"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt} className="dark:bg-slate-900 dark:text-slate-200">
                  {opt} / page
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Zone 2: Navigation Controls (Only displayed when there are multiple pages) */}
      {hasMultiplePages && (
        <div className="flex items-center justify-center w-full sm:w-auto">
          {/* Mobile Compact Representation: [Previous]   Page X / Y   [Next] */}
          <div className="flex sm:hidden items-center justify-between w-full gap-2 py-0.5">
            <button
              type="button"
              onClick={() => onPageChange(safeCurrentPage - 1)}
              disabled={safeCurrentPage === 1}
              aria-label="Previous page"
              className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-semibold flex items-center gap-1 cursor-pointer touch-press transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            <span className="text-xs font-medium text-slate-600 dark:text-slate-400 font-mono">
              Page <span className="font-bold text-slate-900 dark:text-slate-100">{safeCurrentPage}</span> / {totalPages}
            </span>

            <button
              type="button"
              onClick={() => onPageChange(safeCurrentPage + 1)}
              disabled={safeCurrentPage === totalPages}
              aria-label="Next page"
              className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-semibold flex items-center gap-1 cursor-pointer touch-press transition-colors"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Desktop Full Representation: [First] [Previous] [1] [2] [3] [Next] [Last] */}
          <div className="hidden sm:flex items-center gap-1 flex-wrap">
            <span className="text-xs text-slate-400 dark:text-slate-500 mr-2 font-mono hidden md:inline">
              Page {safeCurrentPage} of {totalPages}
            </span>

            {/* First Page */}
            <button
              type="button"
              onClick={() => onPageChange(1)}
              disabled={safeCurrentPage === 1}
              aria-label="First page"
              title="First page"
              className="min-h-[32px] min-w-[32px] p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors text-slate-600 dark:text-slate-300 cursor-pointer flex items-center justify-center touch-press"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>

            {/* Previous Page */}
            <button
              type="button"
              onClick={() => onPageChange(safeCurrentPage - 1)}
              disabled={safeCurrentPage === 1}
              aria-label="Previous page"
              title="Previous page"
              className="min-h-[32px] min-w-[32px] p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors text-slate-600 dark:text-slate-300 cursor-pointer flex items-center justify-center touch-press"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {/* Number Buttons */}
            <div className="flex items-center gap-1 mx-0.5">
              {getPageNumbers().map((p, idx) => {
                if (p === '...') {
                  return (
                    <span
                      key={`ellipsis-${idx}`}
                      className="px-1.5 py-1 text-slate-400 dark:text-slate-600 select-none font-mono text-xs"
                    >
                      ...
                    </span>
                  );
                }
                const isCurrent = p === safeCurrentPage;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => onPageChange(Number(p))}
                    aria-label={`Page ${p}`}
                    aria-current={isCurrent ? 'page' : undefined}
                    className={`min-h-[32px] min-w-[32px] px-2 rounded-lg font-bold text-xs transition-colors cursor-pointer flex items-center justify-center touch-press ${
                      isCurrent
                        ? 'bg-ob-indigo-600 text-white shadow-xs'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>

            {/* Next Page */}
            <button
              type="button"
              onClick={() => onPageChange(safeCurrentPage + 1)}
              disabled={safeCurrentPage === totalPages}
              aria-label="Next page"
              title="Next page"
              className="min-h-[32px] min-w-[32px] p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors text-slate-600 dark:text-slate-300 cursor-pointer flex items-center justify-center touch-press"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            {/* Last Page */}
            <button
              type="button"
              onClick={() => onPageChange(totalPages)}
              disabled={safeCurrentPage === totalPages}
              aria-label="Last page"
              title="Last page"
              className="min-h-[32px] min-w-[32px] p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors text-slate-600 dark:text-slate-300 cursor-pointer flex items-center justify-center touch-press"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
