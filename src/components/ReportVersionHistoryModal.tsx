/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  History,
  Clock,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  FileText,
  User,
  X,
  ChevronRight,
  Layers,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import {
  departmentService,
  ReportVersionRecord,
} from '../services/departmentService.ts';
import { vibrate } from '../utils/haptics.ts';

interface ReportVersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportKey: string;
  reportTitle?: string;
  onSuccess: (message: string) => void;
  adminName?: string;
}

export const ReportVersionHistoryModal: React.FC<ReportVersionHistoryModalProps> = ({
  isOpen,
  onClose,
  reportKey,
  reportTitle,
  onSuccess,
  adminName = 'Administrator',
}) => {
  const [history, setHistory] = useState<ReportVersionRecord[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<ReportVersionRecord | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    if (!isOpen || !reportKey) return;
    const records = departmentService.getReportVersionHistory(reportKey);
    setHistory(records);
    if (records.length > 0) {
      setSelectedVersion(records[0]);
    } else {
      setSelectedVersion(null);
    }
  }, [isOpen, reportKey]);

  if (!isOpen) return null;

  const getChangeTypeBadge = (type: string) => {
    switch (type) {
      case 'CREATED':
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';
      case 'RENAMED':
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border-amber-300 dark:border-amber-800';
      case 'RESTORED':
        return 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border-purple-300 dark:border-purple-800';
      case 'BULK_IMPORTED':
        return 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800';
      case 'DECOMMISSIONED':
        return 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border-rose-300 dark:border-rose-800';
      default:
        return 'bg-ob-indigo-50 text-ob-indigo-700 dark:bg-ob-indigo-950 dark:text-ob-indigo-300 border-ob-indigo-300 dark:border-ob-indigo-800';
    }
  };

  const handleRestore = async (version: ReportVersionRecord) => {
    if (!confirm(`Are you sure you want to rollback ${reportKey} to Version ${version.versionNumber}?`)) {
      return;
    }

    setIsRestoring(true);
    try {
      const resp = await departmentService.restoreReportVersion(reportKey, version.versionId, adminName);
      if (resp.success) {
        onSuccess(resp.message);
        vibrate([20, 30, 25]);
        onClose();
      } else {
        alert(resp.message);
      }
    } catch (err: any) {
      alert(`Rollback error: ${err.message}`);
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-white dark:bg-[#161933] rounded-2xl max-w-3xl w-full border border-slate-200 dark:border-[#262D55] shadow-2xl p-5 space-y-4 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-ob-indigo-500/10 dark:bg-ob-indigo-500/20 text-ob-indigo-600 dark:text-ob-indigo-400 flex items-center justify-center">
              <History className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Report Version History & Structure Audit
                </h3>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-[#1E234B] text-ob-indigo-600 dark:text-ob-indigo-400 font-bold border border-slate-200 dark:border-[#2B3369]">
                  {reportKey}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {reportTitle || 'Audit trail of structural revisions, metadata changes, and department linkages.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body: Left Timeline & Right Snapshot View */}
        {history.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400 space-y-2">
            <Clock className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
            <p>No previous version revisions recorded for {reportKey} yet.</p>
            <p className="text-[10px] text-slate-500">
              Changes to titles, descriptions, categories, or linked departments are logged automatically.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Version List Timeline */}
            <div className="md:col-span-5 space-y-2 max-h-96 overflow-y-auto pr-1">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                Version Log ({history.length} Revisions)
              </span>

              {history.map((ver, idx) => {
                const isSelected = selectedVersion?.versionId === ver.versionId;
                const isLatest = idx === 0;
                return (
                  <button
                    key={ver.versionId}
                    type="button"
                    onClick={() => setSelectedVersion(ver)}
                    className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-ob-indigo-50/80 dark:bg-ob-indigo-950/60 border-ob-indigo-400 dark:border-ob-indigo-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-[#121428] border-slate-200 dark:border-[#22284D] hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                          v{ver.versionNumber}
                        </span>
                        {isLatest && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500 text-white">
                            Current
                          </span>
                        )}
                      </div>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${getChangeTypeBadge(ver.changeType)}`}>
                        {ver.changeType}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-700 dark:text-slate-300 font-medium line-clamp-1">
                      {ver.changeSummary}
                    </p>

                    <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <User className="w-2.5 h-2.5" />
                        {ver.changedBy}
                      </span>
                      <span>{new Date(ver.timestamp).toLocaleString()}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Version Snapshot Detail */}
            <div className="md:col-span-7 bg-slate-50 dark:bg-[#101226] border border-slate-200 dark:border-[#22284D] rounded-xl p-3.5 space-y-3 max-h-96 overflow-y-auto">
              {selectedVersion ? (
                <>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-[#22284D]">
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        Version {selectedVersion.versionNumber} Snapshot
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        Saved on {new Date(selectedVersion.timestamp).toLocaleString()} by {selectedVersion.changedBy}
                      </span>
                    </div>

                    {/* Restore button */}
                    <button
                      type="button"
                      disabled={isRestoring}
                      onClick={() => handleRestore(selectedVersion)}
                      className="px-3 py-1 bg-ob-indigo-600 hover:bg-ob-indigo-700 disabled:opacity-50 text-white font-bold text-[11px] rounded-lg shadow-xs transition-all flex items-center gap-1 cursor-pointer touch-press"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Rollback to v{selectedVersion.versionNumber}</span>
                    </button>
                  </div>

                  {/* Summary & Metadata */}
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase">Title</span>
                      <p className="font-bold text-slate-900 dark:text-white">{selectedVersion.snapshot.Title}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] font-semibold text-slate-400 uppercase">Category</span>
                        <p className="text-slate-800 dark:text-slate-200">{selectedVersion.snapshot.Category}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-semibold text-slate-400 uppercase">Frequency</span>
                        <p className="text-slate-800 dark:text-slate-200">{selectedVersion.snapshot.Frequency}</p>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase">Description</span>
                      <p className="text-slate-700 dark:text-slate-300 text-[11px]">
                        {selectedVersion.snapshot.Description}
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase">Authorized Departments</span>
                      <div className="flex items-center gap-1 flex-wrap mt-0.5">
                        {selectedVersion.snapshot.departments.map((d) => (
                          <span
                            key={d}
                            className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white dark:bg-[#161933] border border-slate-200 dark:border-[#2B3369] text-slate-800 dark:text-slate-200"
                          >
                            {d}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Diff breakdown if available */}
                    {selectedVersion.diff && selectedVersion.diff.length > 0 && (
                      <div className="pt-2 border-t border-slate-200 dark:border-[#22284D] space-y-1">
                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase">
                          Detected Changes in this Version:
                        </span>
                        <div className="space-y-1">
                          {selectedVersion.diff.map((d, i) => (
                            <div key={i} className="text-[11px] p-1.5 rounded bg-amber-500/10 border border-amber-500/20">
                              <span className="font-bold text-slate-900 dark:text-white capitalize">{d.field}: </span>
                              <span className="text-rose-600 dark:text-rose-400 line-through mr-1">
                                {Array.isArray(d.oldValue) ? d.oldValue.join(', ') : String(d.oldValue || 'none')}
                              </span>
                              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                → {Array.isArray(d.newValue) ? d.newValue.join(', ') : String(d.newValue || 'none')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        )}

        {/* Modal footer */}
        <div className="flex items-center justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-[#1E234B] hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
