/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { DynamicAreaDefinition, DynamicRowRecord } from '../types/regulatory.ts';
import { Plus, Trash2, Table as TableIcon, LayoutGrid, List, AlertCircle } from 'lucide-react';
import { Pagination } from './Pagination.tsx';
import { MaximizedViewModal } from './MaximizedViewModal.tsx';
import { MaximizeButton } from './MaximizeButton.tsx';
import { ValidationEngine, ValidationSummary } from '../utils/validationEngine.ts';
import type { FormValidationState } from '../services/zodValidationService.ts';

interface DynamicAreaTableProps {
  area: DynamicAreaDefinition;
  rows: DynamicRowRecord[];
  readOnly?: boolean;
  validation?: ValidationSummary | FormValidationState | null;
  onAddRow: () => void;
  onUpdateCell: (rowId: string, columnCode: string, value: any) => void;
  onDeleteRow: (rowId: string) => void;
}

export const DynamicAreaTable: React.FC<DynamicAreaTableProps> = ({
  area,
  rows,
  readOnly = false,
  validation,
  onAddRow,
  onUpdateCell,
  onDeleteRow,
}) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [mobileViewMode, setMobileViewMode] = useState<'TABLE' | 'CARDS'>('CARDS');
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    // If rows deleted and page is now out of range
    const maxPage = Math.max(1, Math.ceil(rows.length / pageSize));
    if (page > maxPage) {
      setPage(maxPage);
    }
  }, [rows.length, pageSize, page]);

  const paginatedRows = rows.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-2xs transition-colors">
      {/* Header bar */}
      <div className="px-3.5 py-2.5 sm:px-4 sm:py-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <TableIcon className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
            Schedule: {area._areaName || `Area ${area.Area}`}
          </h4>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            ({rows.length} {rows.length === 1 ? 'row' : 'rows'})
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Mobile Table/Card View Toggle */}
          <div className="flex sm:hidden items-center border border-slate-200 dark:border-slate-700 rounded-xl p-0.5 bg-slate-100 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setMobileViewMode('CARDS')}
              className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-xs transition-colors cursor-pointer touch-manipulation touch-press ${
                mobileViewMode === 'CARDS'
                  ? 'bg-white dark:bg-slate-700 text-ob-indigo-700 dark:text-white shadow-2xs font-bold'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
              }`}
              title="Card view (Mobile)"
              aria-label="Mobile Card View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setMobileViewMode('TABLE')}
              className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-xs transition-colors cursor-pointer touch-manipulation touch-press ${
                mobileViewMode === 'TABLE'
                  ? 'bg-white dark:bg-slate-700 text-ob-indigo-700 dark:text-white shadow-2xs font-bold'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
              }`}
              title="Table view"
              aria-label="Table View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {!readOnly && (
            <button
              type="button"
              onClick={onAddRow}
              className="min-h-[44px] sm:min-h-[34px] flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-ob-indigo-700 dark:text-ob-indigo-300 bg-ob-indigo-50 dark:bg-ob-indigo-950/60 hover:bg-ob-indigo-100 dark:hover:bg-ob-indigo-900/60 rounded-xl border border-ob-indigo-200 dark:border-ob-indigo-800 transition-colors cursor-pointer touch-manipulation touch-press shadow-2xs"
            >
              <Plus className="w-4 h-4" />
              <span>Add Row</span>
            </button>
          )}

          <MaximizeButton
            onClick={() => setIsMaximized(true)}
            title="Maximize Schedule Table (Esc to restore)"
          />
        </div>
      </div>

      {/* Mobile Card View (< 640px when mobileViewMode is CARDS) */}
      {mobileViewMode === 'CARDS' && (
        <div className="sm:hidden p-3 space-y-3">
          {rows.length === 0 ? (
            <div className="py-8 text-center text-slate-400 dark:text-slate-500 italic text-xs">
              No entries in this schedule. Tap "Add Row" to enter borrower or asset details.
            </div>
          ) : (
            paginatedRows.map((row, index) => {
              const rowIndex = (page - 1) * pageSize + index + 1;
              return (
                <div
                  key={row.id}
                  className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 space-y-3 shadow-2xs"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                    <span className="text-xs font-bold font-mono text-ob-indigo-700 dark:text-ob-indigo-400 bg-ob-indigo-50 dark:bg-ob-indigo-950 px-2 py-1 rounded-lg">
                      Row #{rowIndex}
                    </span>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => onDeleteRow(row.id)}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-xl transition-colors cursor-pointer touch-manipulation touch-press"
                        title="Delete Row"
                        aria-label={`Delete row ${rowIndex}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-2.5">
                    {area.DynamicItems.map((col) => {
                      const val =
                        row.values && row.values[col.Code] !== undefined
                          ? row.values[col.Code]
                          : (row as any)[col.Code] ?? '';
                      const cellErr =
                        (validation as any)?.getDynamicError?.(area.Area, row.id, col.Code) ||
                        ValidationEngine.getDynamicCellError(validation || null, area.Area, row.id, col.Code);
                      return (
                        <div key={col.Code} className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              {col._description}
                              {col._required && <span className="text-rose-500 ml-0.5">*</span>}
                            </span>
                            <span className="font-mono text-slate-400 text-[10px]">({col.Code})</span>
                          </div>

                          {readOnly ? (
                            <div className="font-mono text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 min-h-[44px] flex items-center">
                              {val !== '' ? String(val) : '-'}
                            </div>
                          ) : (
                            <div>
                              <input
                                type={
                                  col._dataType === 'NUMERIC'
                                    ? 'number'
                                    : col._dataType === 'DATE'
                                    ? 'date'
                                    : 'text'
                                }
                                inputMode={col._dataType === 'NUMERIC' ? 'decimal' : undefined}
                                value={val}
                                placeholder={col._dataType === 'NUMERIC' ? '0.00' : 'Enter value...'}
                                onChange={(e) => {
                                  const newVal =
                                    col._dataType === 'NUMERIC'
                                      ? e.target.value === ''
                                        ? ''
                                        : Number(e.target.value)
                                      : e.target.value;
                                  onUpdateCell(row.id, col.Code, newVal);
                                }}
                                className={`w-full min-h-[44px] px-3 py-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border rounded-xl text-xs focus:outline-none touch-manipulation font-mono tabular-nums shadow-xs ${
                                  cellErr
                                    ? 'border-rose-500 focus:border-rose-600 ring-1 ring-rose-500 bg-rose-50/40 dark:bg-rose-950/20'
                                    : 'border-slate-200 dark:border-slate-700 focus:border-ob-indigo-500'
                                }`}
                              />
                              {cellErr && (
                                <div className="flex items-center gap-1 text-[11px] text-rose-600 dark:text-rose-400 mt-1">
                                  <AlertCircle className="w-3 h-3 shrink-0" />
                                  <span>{cellErr.message}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Table View (Tablets, Desktops & Mobile Table mode) */}
      <div className={`overflow-x-auto touch-scroll-x ${mobileViewMode === 'CARDS' ? 'hidden sm:block' : 'block'}`}>
        <table className="w-full text-xs text-left border-collapse">
          <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold sticky top-0 border-b border-slate-200 dark:border-slate-800 z-10">
            <tr>
              <th className="py-2.5 px-3 w-10 text-center text-slate-400 dark:text-slate-500">#</th>
              {area.DynamicItems.map((col) => (
                <th key={col.Code} className="py-2.5 px-3 whitespace-nowrap min-w-[140px]">
                  <div>
                    <span className="text-slate-900 dark:text-slate-100">{col._description}</span>
                    <span className="ml-1 text-[10px] text-slate-400 dark:text-slate-500 font-mono">({col.Code})</span>
                    {col._required && <span className="text-rose-500 ml-0.5">*</span>}
                  </div>
                </th>
              ))}
              {!readOnly && <th className="py-2.5 px-3 w-12 text-center">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={area.DynamicItems.length + (readOnly ? 1 : 2)}
                  className="py-8 text-center text-slate-400 dark:text-slate-500 italic"
                >
                  No entries in this schedule. Click "Add Row" to enter borrower or asset details.
                </td>
              </tr>
            ) : (
              paginatedRows.map((row, index) => {
                const rowIndex = (page - 1) * pageSize + index + 1;
                return (
                  <tr key={row.id} className="hover:bg-slate-50/75 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-2 px-3 text-center text-slate-400 dark:text-slate-500 font-mono tabular-nums">
                      {rowIndex}
                    </td>

                    {area.DynamicItems.map((col) => {
                      const val = (row.values && row.values[col.Code] !== undefined) ? row.values[col.Code] : ((row as any)[col.Code] ?? '');
                      const cellErr =
                        (validation as any)?.getDynamicError?.(area.Area, row.id, col.Code) ||
                        ValidationEngine.getDynamicCellError(validation || null, area.Area, row.id, col.Code);
                      return (
                        <td key={col.Code} className="py-1.5 px-2">
                          {readOnly ? (
                            <span className="text-slate-800 dark:text-slate-200 font-medium font-mono text-xs">
                              {val !== '' ? String(val) : '-'}
                            </span>
                          ) : (
                            <div>
                              <input
                                type={col._dataType === 'NUMERIC' ? 'number' : col._dataType === 'DATE' ? 'date' : 'text'}
                                inputMode={col._dataType === 'NUMERIC' ? 'decimal' : undefined}
                                value={val}
                                placeholder={col._dataType === 'NUMERIC' ? '0.00' : 'Enter...'}
                                onChange={(e) => {
                                  const newVal =
                                    col._dataType === 'NUMERIC'
                                      ? e.target.value === ''
                                        ? ''
                                        : Number(e.target.value)
                                      : e.target.value;
                                  onUpdateCell(row.id, col.Code, newVal);
                                }}
                                className={`w-full min-h-[44px] sm:min-h-[32px] px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white border rounded-lg text-xs focus:outline-none touch-manipulation font-mono tabular-nums ${
                                  cellErr
                                    ? 'border-rose-500 focus:border-rose-600 ring-1 ring-rose-500 bg-rose-50/40 dark:bg-rose-950/20'
                                    : 'border-slate-200 dark:border-slate-700 focus:border-ob-indigo-500'
                                }`}
                              />
                              {cellErr && (
                                <span className="text-[10px] text-rose-600 dark:text-rose-400 font-medium block mt-0.5 max-w-[180px] truncate" title={cellErr.message}>
                                  {cellErr.message}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}

                    {!readOnly && (
                      <td className="py-1.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => onDeleteRow(row.id)}
                          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer touch-manipulation touch-press"
                          title="Delete Row"
                          aria-label={`Delete schedule row ${rowIndex}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {rows.length > 0 && (
        <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <Pagination
            currentPage={page}
            totalItems={rows.length}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[5, 10, 20]}
            itemName="schedule rows"
          />
        </div>
      )}

      {/* PHASE 47: FULL VIEW / MAXIMIZED DYNAMIC SCHEDULE TABLE */}
      {isMaximized && (
        <MaximizedViewModal
          isOpen={isMaximized}
          onClose={() => setIsMaximized(false)}
          title={`Schedule: ${area._areaName || `Area ${area.Area}`}`}
          badge="Dynamic Repeatable Schedule"
          subtitle={`${rows.length} rows recorded · ${area.DynamicItems.length} columns defined`}
          icon={TableIcon}
          actions={
            !readOnly && (
              <button
                type="button"
                onClick={onAddRow}
                className="min-h-[44px] sm:min-h-[34px] flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-ob-indigo-600 hover:bg-ob-indigo-700 rounded-xl transition-colors cursor-pointer shadow-2xs"
              >
                <Plus className="w-4 h-4" />
                <span>Add Row</span>
              </button>
            )
          }
        >
          <div className="space-y-4">
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto min-w-full touch-scroll-x">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-100/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 font-bold sticky top-0 border-b border-slate-200 dark:border-slate-800 z-10">
                    <tr>
                      <th className="py-3 px-3 w-10 text-center text-slate-400 dark:text-slate-500">#</th>
                      {area.DynamicItems.map((col) => (
                        <th key={col.Code} className="py-3 px-3 whitespace-nowrap min-w-[150px]">
                          <div>
                            <span className="text-slate-900 dark:text-slate-100">{col._description}</span>
                            <span className="ml-1 text-[10px] text-slate-400 dark:text-slate-500 font-mono">({col.Code})</span>
                            {col._required && <span className="text-rose-500 ml-0.5">*</span>}
                          </div>
                        </th>
                      ))}
                      {!readOnly && (
                        <th className="py-3 px-3 w-12 text-center text-slate-400 dark:text-slate-500">Action</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {rows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={area.DynamicItems.length + (readOnly ? 1 : 2)}
                          className="py-12 text-center text-slate-400 dark:text-slate-500"
                        >
                          No items added to this schedule yet. Click &quot;Add Row&quot; to begin.
                        </td>
                      </tr>
                    ) : (
                      rows.map((row, idx) => (
                        <tr key={row.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="py-2.5 px-3 text-center text-slate-400 dark:text-slate-500 font-mono">
                            {idx + 1}
                          </td>
                          {area.DynamicItems.map((col) => {
                            const val = (row.values && row.values[col.Code] !== undefined) ? row.values[col.Code] : ((row as any)[col.Code] ?? '');
                            return (
                              <td key={col.Code} className="py-2.5 px-3">
                                {readOnly ? (
                                  <span className="font-mono text-slate-800 dark:text-slate-200">
                                    {val !== '' ? String(val) : '—'}
                                  </span>
                                ) : (
                                  <input
                                    type={col._dataType === 'NUMERIC' ? 'number' : 'text'}
                                    value={val}
                                    onChange={(e) => onUpdateCell(row.id, col.Code, col._dataType === 'NUMERIC' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)}
                                    placeholder={col._description}
                                    className="w-full text-xs p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-ob-indigo-500"
                                  />
                                )}
                              </td>
                            );
                          })}
                          {!readOnly && (
                            <td className="py-2.5 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => onDeleteRow(row.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                                title="Delete Row"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </MaximizedViewModal>
      )}
    </div>
  );
};
