/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { History, RotateCcw, Info, CheckCircle2, ShieldCheck, X } from 'lucide-react';
import type { ReportSubmission } from '../types/regulatory.ts';

interface FieldAuditHoverToolProps {
  fieldCode: string;
  fieldDescription?: string;
  dataType?: string;
  currentValue: any;
  submission: ReportSubmission;
  sessionEdits?: any[];
  onRevertValue: (val: any) => void;
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
  const containerRef = useRef<HTMLDivElement>(null);

  // Initial baseline value from submission snapshot
  const baselineValue = submission.values?.[fieldCode];
  const hasChanged = currentValue !== baselineValue && baselineValue !== undefined;

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-flex items-center" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`p-1 rounded-md transition-colors cursor-pointer text-xs ${
          hasChanged
            ? 'text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/60'
            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
        }`}
        title={`Audit trail & change history for ${fieldCode}`}
      >
        <History className="w-3.5 h-3.5" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-72 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl text-left animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-ob-indigo-600 dark:text-ob-indigo-400 shrink-0" />
              <div>
                <span className="font-mono font-bold text-xs text-slate-900 dark:text-slate-100">
                  {fieldCode}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate max-w-[170px]">
                  {fieldDescription || 'Line Item Audit'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="py-2 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-400">Data Type:</span>
              <span className="font-mono text-slate-700 dark:text-slate-300 font-medium">
                {dataType || 'NUMERIC'}
              </span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-400">Current Value:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                {currentValue !== undefined && currentValue !== '' ? String(currentValue) : 'Empty'}
              </span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-400">Baseline Value:</span>
              <span className="font-mono text-slate-700 dark:text-slate-300">
                {baselineValue !== undefined && baselineValue !== '' ? String(baselineValue) : 'None'}
              </span>
            </div>

            {/* Session modifications */}
            {sessionEdits.length > 0 && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Session Change Log ({sessionEdits.length})
                </span>
                <div className="max-h-20 overflow-y-auto space-y-1">
                  {sessionEdits.slice(-3).map((edit, idx) => (
                    <div
                      key={idx}
                      className="text-[10px] bg-slate-50 dark:bg-slate-800/60 p-1 rounded border border-slate-100 dark:border-slate-800 flex justify-between"
                    >
                      <span className="font-mono text-slate-500">
                        {edit.previousValue !== undefined ? `${String(edit.previousValue)} → ` : ''}
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">{String(edit.newValue ?? edit.value ?? '')}</span>
                      </span>
                      <span className="text-slate-400">
                        {edit.timestamp ? new Date(edit.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Revert Action */}
          {!isReadOnly && hasChanged && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  onRevertValue(baselineValue);
                  setIsOpen(false);
                }}
                className="px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 border border-amber-200 dark:border-amber-800 rounded-lg inline-flex items-center gap-1 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Revert to Baseline</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
