/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { History, Clock, ArrowRight, RotateCcw, User, Check, Shield, AlertCircle } from 'lucide-react';
import type { ReportSubmission, SubmissionSnapshot } from '../types/regulatory.ts';

export interface FieldAuditEntry {
  version: number | string;
  timestamp: string;
  status?: string;
  modifiedBy: string;
  modifiedByRole?: string;
  value: string | number;
  reason?: string;
  delta?: {
    diff: number | null;
    percentDiff: number | null;
    isIncrease?: boolean;
  };
}

interface FieldAuditHoverToolProps {
  fieldCode: string;
  fieldDescription: string;
  dataType: string;
  currentValue: string | number;
  submission: ReportSubmission;
  sessionEdits?: Array<{ timestamp: string; value: string | number; modifiedBy: string; modifiedByRole?: string }>;
  onRevertValue?: (val: string | number) => void;
  isReadOnly?: boolean;
}

export const FieldAuditHoverTool: React.FC<FieldAuditHoverToolProps> = ({
  fieldCode,
  fieldDescription,
  dataType,
  currentValue,
  submission,
  sessionEdits = [],
  onRevertValue,
  isReadOnly = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleMouseEnter = () => {
    if (hoverTimeout) clearTimeout(hoverTimeout);
    const timeout = setTimeout(() => {
      setIsOpen(true);
    }, 250);
    setHoverTimeout(timeout);
  };

  const handleMouseLeave = () => {
    if (hoverTimeout) clearTimeout(hoverTimeout);
    const timeout = setTimeout(() => {
      setIsOpen(false);
    }, 300);
    setHoverTimeout(timeout);
  };

  // Extract all historical iterations for this specific field
  const historyEntries: FieldAuditEntry[] = [];

  // 1. Check historicalSnapshots
  if (submission.historicalSnapshots && submission.historicalSnapshots.length > 0) {
    submission.historicalSnapshots.forEach((snap) => {
      const snapVal = snap.values ? snap.values[fieldCode] : undefined;
      if (snapVal !== undefined && snapVal !== null && snapVal !== '') {
        historyEntries.push({
          version: `v${snap.version}`,
          timestamp: snap.timestamp,
          status: snap.status,
          modifiedBy: snap.capturedBy || 'Authorized Officer',
          modifiedByRole: snap.capturedByRole,
          value: snapVal,
          reason: snap.reason || `Snapshot iteration v${snap.version} (${snap.status})`,
        });
      }
    });
  }

  // 2. Check revisionHistory
  if (submission.revisionHistory && submission.revisionHistory.length > 0) {
    submission.revisionHistory.forEach((rev) => {
      const revVal = rev.values ? rev.values[fieldCode] : undefined;
      if (revVal !== undefined && revVal !== null && revVal !== '') {
        historyEntries.push({
          version: `v${rev.version} (Draft Rev)`,
          timestamp: rev.modifiedAt,
          modifiedBy: rev.modifiedBy || 'Maker Officer',
          modifiedByRole: rev.modifiedByRole || 'MAKER',
          value: revVal,
          reason: rev.reason || 'Draft updated in workspace',
        });
      }
    });
  }

  // 3. Check in-session edits
  if (sessionEdits && sessionEdits.length > 0) {
    sessionEdits.forEach((se, idx) => {
      historyEntries.push({
        version: `Session Edit #${idx + 1}`,
        timestamp: se.timestamp,
        modifiedBy: se.modifiedBy,
        modifiedByRole: se.modifiedByRole || 'MAKER',
        value: se.value,
        reason: 'In-form interactive modification',
      });
    });
  }

  // 4. Add initial baseline if values exist
  if (submission.dataSnapshot && submission.dataSnapshot[fieldCode] !== undefined) {
    const baseVal = submission.dataSnapshot[fieldCode];
    if (baseVal !== undefined && baseVal !== null && baseVal !== '') {
      historyEntries.unshift({
        version: 'v1 (Baseline)',
        timestamp: submission.createdAt || new Date().toISOString(),
        modifiedBy: submission.makerName || 'Maker Officer',
        modifiedByRole: 'MAKER',
        value: baseVal,
        reason: 'Initial return draft baseline',
      });
    }
  }

  // Sort chronological descending (newest first)
  historyEntries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Filter out redundant consecutive identical values to highlight actual modifications
  const deduplicatedHistory: FieldAuditEntry[] = [];
  historyEntries.forEach((entry) => {
    const prev = deduplicatedHistory[deduplicatedHistory.length - 1];
    if (!prev || String(prev.value) !== String(entry.value)) {
      deduplicatedHistory.push(entry);
    }
  });

  // Calculate deltas between consecutive entries
  for (let i = 0; i < deduplicatedHistory.length; i++) {
    const curr = deduplicatedHistory[i];
    const nextOlder = deduplicatedHistory[i + 1];

    if (nextOlder && typeof curr.value === 'number' && typeof nextOlder.value === 'number') {
      const diff = curr.value - nextOlder.value;
      const percentDiff = nextOlder.value !== 0 ? (diff / Math.abs(nextOlder.value)) * 100 : null;
      curr.delta = {
        diff,
        percentDiff,
        isIncrease: diff > 0,
      };
    }
  }

  const formatVal = (v: any) => {
    if (v === undefined || v === null || v === '') return '(empty)';
    if (dataType === 'NUMERIC' && typeof v === 'number') {
      return v.toLocaleString('en-US', {
        minimumFractionDigits: Number.isInteger(v) ? 0 : 2,
        maximumFractionDigits: 4,
      });
    }
    return String(v);
  };

  const modificationCount = deduplicatedHistory.length;
  const hasHistory = modificationCount > 0;

  return (
    <div
      ref={containerRef}
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Trigger Button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`p-1 rounded-md transition-all cursor-pointer flex items-center justify-center ${
          isOpen
            ? 'bg-ob-indigo-600 text-white shadow-2xs'
            : hasHistory
            ? 'text-ob-indigo-600 dark:text-ob-indigo-400 hover:bg-ob-indigo-50 dark:hover:bg-ob-indigo-950/60'
            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
        }`}
        title={`Field Audit: View modification history for ${fieldCode} (${modificationCount} revision${modificationCount === 1 ? '' : 's'})`}
        aria-label={`Field Audit History for ${fieldCode}`}
      >
        <History className="w-3.5 h-3.5" />
        {hasHistory && (
          <span className="ml-0.5 text-[9px] font-mono font-bold px-1 py-0.2 bg-ob-indigo-100 dark:bg-ob-indigo-900/80 text-ob-indigo-800 dark:text-ob-indigo-200 rounded-full">
            {modificationCount}
          </span>
        )}
      </button>

      {/* Popover Card */}
      {isOpen && (
        <div
          className="absolute right-0 top-full mt-1.5 w-80 sm:w-96 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-3.5 text-left space-y-3 animate-in fade-in zoom-in-95 duration-150"
          style={{ maxWidth: 'calc(100vw - 2rem)' }}
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-bold text-xs text-ob-indigo-700 dark:text-ob-indigo-400 bg-ob-indigo-50 dark:bg-ob-indigo-950 px-1.5 py-0.5 rounded border border-ob-indigo-200 dark:border-ob-indigo-800">
                  {fieldCode}
                </span>
                <span className="text-[11px] font-bold text-slate-900 dark:text-white truncate max-w-[180px]">
                  Field Audit Trail
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                {fieldDescription}
              </p>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {modificationCount} {modificationCount === 1 ? 'Entry' : 'Entries'}
              </span>
            </div>
          </div>

          {/* Current Live Value Card */}
          <div className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 block">
                Current Value (In Form)
              </span>
              <span className="text-xs font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                {formatVal(currentValue)}
              </span>
            </div>
            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-md flex items-center gap-1">
              <Check className="w-3 h-3" />
              Active
            </span>
          </div>

          {/* Timeline of Revisions */}
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 block">
              Draft Iteration History
            </span>

            {deduplicatedHistory.length === 0 ? (
              <div className="text-center py-4 text-xs text-slate-400 italic">
                No previous draft modifications recorded. This cell holds its initial value.
              </div>
            ) : (
              deduplicatedHistory.map((item, idx) => {
                const isCurrent = String(item.value) === String(currentValue);

                return (
                  <div
                    key={`${item.timestamp}-${idx}`}
                    className={`p-2.5 rounded-xl border text-xs space-y-1.5 transition-colors ${
                      isCurrent
                        ? 'bg-ob-indigo-50/40 dark:bg-ob-indigo-950/30 border-ob-indigo-200 dark:border-ob-indigo-800'
                        : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-[11px] text-slate-800 dark:text-slate-200">
                          {item.version}
                        </span>
                        {item.status && (
                          <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            {item.status}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                        <Clock className="w-2.5 h-2.5" />
                        <span>{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                      </div>
                    </div>

                    {/* Value and Delta */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-mono font-bold text-xs text-slate-900 dark:text-white tabular-nums">
                        {formatVal(item.value)}
                      </div>

                      {item.delta && item.delta.diff !== null && item.delta.diff !== 0 && (
                        <span
                          className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                            item.delta.isIncrease
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                          }`}
                        >
                          {item.delta.isIncrease ? '+' : ''}
                          {item.delta.diff.toLocaleString()}
                          {item.delta.percentDiff !== null ? ` (${item.delta.percentDiff > 0 ? '+' : ''}${item.delta.percentDiff.toFixed(1)}%)` : ''}
                        </span>
                      )}
                    </div>

                    {/* Metadata footer: User and Revert action */}
                    <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-700/60">
                      <div className="flex items-center gap-1 truncate max-w-[170px]" title={item.modifiedBy}>
                        <User className="w-2.5 h-2.5 shrink-0 text-slate-400" />
                        <span className="truncate">{item.modifiedBy}</span>
                      </div>

                      {!isReadOnly && !isCurrent && onRevertValue && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRevertValue(item.value);
                            setIsOpen(false);
                          }}
                          className="text-ob-indigo-600 dark:text-ob-indigo-400 hover:text-ob-indigo-800 dark:hover:text-ob-indigo-300 font-bold flex items-center gap-0.5 cursor-pointer"
                          title="Restore this historical value to current draft input"
                        >
                          <RotateCcw className="w-2.5 h-2.5" />
                          <span>Revert</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer note */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 dark:text-slate-500 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Shield className="w-3 h-3 text-ob-indigo-500" />
              NBE BSD/03/2020 Cell Audit
            </span>
            <span>Oromia Bank S.C.</span>
          </div>
        </div>
      )}
    </div>
  );
};
