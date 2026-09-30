/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Database,
  Wifi,
  WifiOff,
  CloudUpload,
  Download,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  FileText,
  FileSpreadsheet,
  Layers,
  ArrowRight,
  HardDrive,
  RefreshCw,
  Radio,
  Lock,
} from 'lucide-react';
import { useOfflineStorage } from '../hooks/useOfflineStorage.ts';
import {
  indexedDbStorage,
  OfflineDraftRecord,
  OfflineAuditRecord,
} from '../services/indexedDbStorage.ts';
import { getReportByKey } from '../data/report-registry.ts';

interface OfflineStorageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OfflineStorageModal: React.FC<OfflineStorageModalProps> = ({ isOpen, onClose }) => {
  const {
    isOnline,
    isRemoteSiteVisitMode,
    isEffectiveOffline,
    stats,
    isSyncing,
    syncFeedback,
    toggleRemoteSiteVisitMode,
    syncWithServer,
    exportOfflineVaultBundle,
    refreshStats,
  } = useOfflineStorage();

  const [activeTab, setActiveTab] = useState<'DRAFTS' | 'AUDIT' | 'STORAGE_HEALTH'>('DRAFTS');
  const [drafts, setDrafts] = useState<OfflineDraftRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<OfflineAuditRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');

  // Fetch actual records from IndexedDB
  const loadIndexedDbData = async () => {
    setLoading(true);
    try {
      const [dList, aList] = await Promise.all([
        indexedDbStorage.getAllDrafts(),
        indexedDbStorage.getAllAuditLogs(),
      ]);
      setDrafts(dList);
      setAuditLogs(aList);
    } catch (err) {
      console.warn('Failed to load IndexedDB records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadIndexedDbData();
      refreshStats();
    }
  }, [isOpen, refreshStats]);

  if (!isOpen) return null;

  const filteredDrafts = drafts.filter(
    (d) =>
      !filterQuery ||
      d.reportKey.toLowerCase().includes(filterQuery.toLowerCase()) ||
      d.id.toLowerCase().includes(filterQuery.toLowerCase()) ||
      d.status.toLowerCase().includes(filterQuery.toLowerCase())
  );

  const filteredAuditLogs = auditLogs.filter(
    (a) =>
      !filterQuery ||
      a.action.toLowerCase().includes(filterQuery.toLowerCase()) ||
      a.details.toLowerCase().includes(filterQuery.toLowerCase()) ||
      a.actorName.toLowerCase().includes(filterQuery.toLowerCase())
  );

  const handleClear = async () => {
    if (window.confirm('Are you sure you want to clear IndexedDB offline cache? All unsynced drafts will be removed.')) {
      setClearing(true);
      try {
        await indexedDbStorage.clearAll();
        await loadIndexedDbData();
        await refreshStats();
      } finally {
        setClearing(false);
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="offline-modal-title"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl max-h-[calc(100dvh-2rem)] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-ob-indigo-50 dark:bg-ob-indigo-950/60 text-ob-indigo-700 dark:text-ob-indigo-400 rounded-xl border border-ob-indigo-200 dark:border-ob-indigo-800">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="offline-modal-title"
                className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"
              >
                IndexedDB Storage & Remote Site Visit Center
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold">
                  NBE BSD/03/2020
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Client-side persistent storage ensuring data resilience during temporary connectivity loss at remote branches
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Remote Site Visit Toggle Banner */}
        <div className="p-4 bg-gradient-to-r from-slate-50 to-amber-50/40 dark:from-slate-900/60 dark:to-amber-950/20 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div
              className={`p-2 rounded-xl mt-0.5 sm:mt-0 ${
                isEffectiveOffline
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
              }`}
            >
              {isEffectiveOffline ? <WifiOff className="w-5 h-5" /> : <Wifi className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  {isEffectiveOffline
                    ? isRemoteSiteVisitMode
                      ? 'Remote NBE Site Visit Mode (Simulated Offline)'
                      : 'Physical Internet Connection Dropped'
                    : 'Connected to Central Regulatory Gateway'}
                </span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    isEffectiveOffline ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
                  }`}
                />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {isEffectiveOffline
                  ? 'All return drafts and audit trail events are saved to browser IndexedDB with tamper-evident checksums.'
                  : 'Online with direct real-time communication to Oromia Bank Regulatory Core.'}
              </p>
            </div>
          </div>

          {/* Toggle Remote Site Visit Switch */}
          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <button
              type="button"
              onClick={() => toggleRemoteSiteVisitMode()}
              className={`min-h-[40px] px-3 rounded-xl text-xs font-bold transition-all border flex items-center gap-2 cursor-pointer shadow-2xs ${
                isRemoteSiteVisitMode
                  ? 'bg-amber-500 text-white border-amber-600 hover:bg-amber-600'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              {isRemoteSiteVisitMode ? 'Exit Site Visit Mode' : 'Simulate Remote Site Visit'}
            </button>
          </div>
        </div>

        {/* Diagnostics Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
          <div className="p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700/60 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
              <span className="text-[11px] font-semibold">IndexedDB Drafts</span>
              <FileSpreadsheet className="w-3.5 h-3.5 text-ob-indigo-600 dark:text-ob-indigo-400" />
            </div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">
              {stats.draftCount}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
              {stats.pendingDrafts} pending sync
            </div>
          </div>

          <div className="p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700/60 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
              <span className="text-[11px] font-semibold">IndexedDB Audit Logs</span>
              <ShieldCheck className="w-3.5 h-3.5 text-ob-green-600 dark:text-ob-green-400" />
            </div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">
              {stats.auditCount}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
              {stats.pendingAuditLogs} pending sync
            </div>
          </div>

          <div className="p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700/60 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
              <span className="text-[11px] font-semibold">IndexedDB Engine</span>
              <HardDrive className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
              {stats.isIndexedDBSupported ? 'Active (v1)' : 'In-Memory Fallback'}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
              {stats.storageName}
            </div>
          </div>

          <div className="p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700/60 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
              <span className="text-[11px] font-semibold">Central Server Sync</span>
              <CloudUpload className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-xs font-bold text-slate-900 dark:text-white">
              {stats.lastSyncTimestamp ? new Date(stats.lastSyncTimestamp).toLocaleTimeString() : 'Not yet synced'}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
              {stats.pendingDrafts + stats.pendingAuditLogs === 0 ? 'Fully reconciled' : 'Queued for sync'}
            </div>
          </div>
        </div>

        {/* Global Action Toolbar */}
        <div className="p-3 px-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-slate-900">
          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('DRAFTS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                activeTab === 'DRAFTS'
                  ? 'bg-white dark:bg-slate-700 text-ob-indigo-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Stored Drafts ({drafts.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('AUDIT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                activeTab === 'AUDIT'
                  ? 'bg-white dark:bg-slate-700 text-ob-indigo-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Stored Audit Logs ({auditLogs.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('STORAGE_HEALTH')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                activeTab === 'STORAGE_HEALTH'
                  ? 'bg-white dark:bg-slate-700 text-ob-indigo-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Storage Architecture
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => syncWithServer()}
              disabled={isSyncing}
              className="min-h-[38px] px-3 rounded-xl bg-ob-indigo-700 hover:bg-ob-indigo-800 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
              title="Synchronize all local drafts and audit entries with the central server"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync with Central Server'}</span>
            </button>

            <button
              type="button"
              onClick={exportOfflineVaultBundle}
              className="min-h-[38px] px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all border border-slate-300 dark:border-slate-600 shadow-2xs"
              title="Export complete tamper-evident inspection vault bundle (JSON) for NBE on-site inspectors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Field Vault</span>
            </button>
          </div>
        </div>

        {/* Sync Feedback Toast */}
        {syncFeedback && (
          <div className="px-4 py-2 bg-blue-50 dark:bg-blue-950/80 border-b border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 text-xs font-medium flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>{syncFeedback}</span>
          </div>
        )}

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {activeTab === 'DRAFTS' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Returns and submission drafts persisted in local IndexedDB:</span>
                <span className="font-mono">{filteredDrafts.length} record(s)</span>
              </div>

              {filteredDrafts.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-slate-500">
                  <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                  <p className="text-xs font-semibold">No draft submissions currently stored in IndexedDB.</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    New drafts created or edited by Makers will automatically persist here.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredDrafts.map((draft) => {
                    const tmpl = getReportByKey(draft.reportKey);
                    const isPending = draft.syncStatus === 'PENDING_SYNC' || draft.syncStatus === 'LOCAL_DRAFT';
                    return (
                      <div
                        key={draft.id}
                        className="p-3.5 bg-slate-50/70 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 flex flex-col justify-between gap-3 shadow-2xs"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="font-mono font-bold text-xs text-ob-indigo-900 dark:text-white">
                              {draft.reportKey}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase font-mono ${
                                isPending
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                              }`}
                            >
                              {isPending ? 'Pending Sync' : 'Synced'}
                            </span>
                          </div>

                          <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 line-clamp-1">
                            {tmpl?.Title || draft.reportKey}
                          </div>

                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
                            <span>Status: <strong>{draft.status}</strong></span>
                            <span>•</span>
                            <span>v{draft.version}</span>
                            <span>•</span>
                            <span>{draft.department || 'Oromia Bank'}</span>
                          </div>

                          {draft.integrityHash && (
                            <div className="mt-2 text-[9px] font-mono text-slate-500 dark:text-slate-400 truncate bg-white/70 dark:bg-slate-900/60 p-1 rounded border border-slate-200/60 dark:border-slate-800">
                              Seal: {draft.integrityHash}
                            </div>
                          )}
                        </div>

                        <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[10px] text-slate-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(draft.updatedAt).toLocaleString()}
                          </span>
                          <span className="font-mono">
                            {Object.keys(draft.values || {}).length} values
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'AUDIT' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Audit events preserved in local IndexedDB:</span>
                <span className="font-mono">{filteredAuditLogs.length} record(s)</span>
              </div>

              {filteredAuditLogs.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-slate-500">
                  <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                  <p className="text-xs font-semibold">No audit logs currently stored in IndexedDB.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredAuditLogs.slice(0, 30).map((log) => {
                    const isPending = log.syncStatus === 'PENDING_SYNC';
                    return (
                      <div
                        key={log.id}
                        className="p-3 bg-slate-50/70 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 flex flex-col gap-1 shadow-2xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                              {log.action}
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold">
                              {log.actorRole}
                            </span>
                          </div>
                          <span
                            className={`px-1.5 py-0.2 rounded-md text-[9px] font-bold uppercase font-mono ${
                              isPending
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                            }`}
                          >
                            {isPending ? 'Pending Sync' : 'Synced'}
                          </span>
                        </div>

                        <div className="text-xs text-slate-600 dark:text-slate-300">
                          {log.details}
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 font-mono">
                          <span>Actor: {log.actorName}</span>
                          <span>{new Date(log.timestamp).toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'STORAGE_HEALTH' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-ob-green-600" />
                  NBE Directive BSD/03/2020 Offline Compliance Specification
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  During remote bank supervisory examinations conducted by the National Bank of Ethiopia, bank officers may encounter zero internet or cellular connectivity. This client-side IndexedDB engine guarantees:
                </p>
                <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 list-disc list-inside">
                  <li><strong>Zero Data Drop Guarantee:</strong> Every draft edit, row insertion, and formula computation is committed to a persistent IndexedDB transaction.</li>
                  <li><strong>Audit Trail Integrity:</strong> User actions, biometric passkey events, and validation checks are persisted with cryptographic correlation IDs.</li>
                  <li><strong>Reconciliation on Reconnect:</strong> Automatic bidirectional sync reconciles local IndexedDB state with Addis Ababa HQ when network is re-established.</li>
                </ul>
              </div>

              <div className="p-4 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                <div className="font-bold text-slate-900 dark:text-white">Technical Configuration</div>
                <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                  <div>Database Name: <strong>OromiaBank_NBE_Regulatory_DB</strong></div>
                  <div>Version: <strong>1.0.0</strong></div>
                  <div>Store 1: <strong>draft_submissions</strong></div>
                  <div>Store 2: <strong>audit_logs</strong></div>
                  <div>Store 3: <strong>offline_metadata</strong></div>
                  <div>Footprint: <strong>~{Math.round((stats.estimatedSizeBytes || 1024) / 1024)} KB</strong></div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={clearing}
                  className="px-3 py-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors font-semibold flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear IndexedDB Cache</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            {stats.pendingDrafts + stats.pendingAuditLogs > 0 ? (
              <span className="text-amber-700 dark:text-amber-400 font-semibold">
                ⚠️ {stats.pendingDrafts} draft(s) and {stats.pendingAuditLogs} audit log(s) pending central sync.
              </span>
            ) : (
              <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                ✓ All IndexedDB data synchronized with central regulatory records.
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
