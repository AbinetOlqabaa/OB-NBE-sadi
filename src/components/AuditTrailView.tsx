/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  History,
  Search,
  Filter,
  Download,
  RotateCw,
  ShieldCheck,
  Calendar,
  FileSpreadsheet,
  CheckCircle2,
  X,
  UserCheck,
  Layers,
  FileCheck,
  Fingerprint,
  ScanFace,
  Clock,
  AlertTriangle,
  Radio,
} from 'lucide-react';
import { AuditLogEntry } from '../types/regulatory';
import { Pagination } from './Pagination';
import { exportGeneralAuditTrailPDF } from '../utils/regulatoryReportPdfExport';

export interface BiometricLogPayload {
  actorId?: string;
  actorName?: string;
  actorRole?: string;
  action:
    | 'BIOMETRIC_AUTH_SUCCESS'
    | 'BIOMETRIC_AUTH_FAILURE'
    | 'BIOMETRIC_AUTH_TIMEOUT'
    | 'BIOMETRIC_LOGIN'
    | 'BIOMETRIC_ENROLLED'
    | 'BIOMETRIC_PROBE';
  type?: 'FINGERPRINT' | 'FACE' | 'WEBAUTHN_PLATFORM';
  entityId?: string;
  details?: string;
  errorMessage?: string;
  correlationId?: string;
  metadata?: Record<string, any>;
}

/**
 * NBE Regulatory Log Utility for Biometric Authentication Events
 * Implements NBE Directive BSD/03/2020 Compliance standards for biometric authentication tracking.
 */
export async function recordBiometricAuditLog(payload: BiometricLogPayload): Promise<AuditLogEntry> {
  const typeLabel = payload.type || 'FINGERPRINT';
  const statusLabel =
    payload.action === 'BIOMETRIC_AUTH_SUCCESS' ||
    payload.action === 'BIOMETRIC_LOGIN' ||
    payload.action === 'BIOMETRIC_ENROLLED'
      ? 'SUCCESS'
      : payload.action === 'BIOMETRIC_AUTH_TIMEOUT'
      ? 'TIMEOUT (30s Inactivity Auto-Cancelled)'
      : 'FAILURE';

  const defaultDetails = `[NBE Directive BSD/03/2020 Security Compliance] Biometric ${typeLabel} authentication attempt: ${statusLabel}.${
    payload.errorMessage ? ` Reason: ${payload.errorMessage}` : ''
  }`;

  const entry: AuditLogEntry = {
    id: 'bio_aud_' + Math.random().toString(36).substring(2, 10),
    timestamp: new Date().toISOString(),
    actorId: payload.actorId || 'bio_actor',
    actorName: payload.actorName || 'Bank Officer',
    actorRole: payload.actorRole || 'MAKER',
    action: payload.action,
    entityType: 'BIOMETRIC_AUTH',
    entityId: payload.entityId || 'OB_BIOMETRIC_SENSOR',
    correlationId:
      payload.correlationId ||
      `corr_bio_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    details: payload.details || defaultDetails,
    newState: payload.metadata,
  };

  try {
    const res = await fetch('/api/audit-logs/biometric', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const serverEntry = await res.json();
      return serverEntry;
    }
  } catch (err) {
    // Graceful offline fallback
  }

  // Cache locally in browser storage for persistence across reloads
  try {
    const existing = JSON.parse(localStorage.getItem('ob_biometric_audit_cache') || '[]');
    existing.unshift(entry);
    localStorage.setItem('ob_biometric_audit_cache', JSON.stringify(existing.slice(0, 100)));
  } catch {}

  return entry;
}

export const logBiometricEvent = recordBiometricAuditLog;

export const AuditTrailView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [entityFilter, setEntityFilter] = useState('ALL');
  const [loading, setLoading] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Pagination state - 8 items per page keeps window strictly fixed
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/audit-logs?limit=300');
      const data = await res.json();
      
      // Merge with any client-side cached biometric logs if available
      let mergedLogs: AuditLogEntry[] = data || [];
      try {
        const localBio = JSON.parse(localStorage.getItem('ob_biometric_audit_cache') || '[]');
        if (Array.isArray(localBio) && localBio.length > 0) {
          const ids = new Set(mergedLogs.map((l) => l.id));
          const uniqueLocal = localBio.filter((l: AuditLogEntry) => !ids.has(l.id));
          mergedLogs = [...uniqueLocal, ...mergedLogs];
        }
      } catch {}

      setLogs(mergedLogs);
    } catch (e) {
      console.warn('Failed to load audit logs from API', e);
      try {
        const localBio = JSON.parse(localStorage.getItem('ob_biometric_audit_cache') || '[]');
        if (Array.isArray(localBio)) {
          setLogs(localBio);
        }
      } catch {}
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [searchQuery, actionFilter, roleFilter, entityFilter]);

  // Aggregate distinct actions from loaded logs + core regulatory actions catalog
  const standardActions = [
    'BIOMETRIC_AUTH_SUCCESS',
    'BIOMETRIC_AUTH_FAILURE',
    'BIOMETRIC_AUTH_TIMEOUT',
    'BIOMETRIC_LOGIN',
    'BIOMETRIC_ENROLLED',
    'BIOMETRIC_PROBE',
    'CREATE_DRAFT',
    'SAVE_DRAFT',
    'UPDATE_VALUES',
    'SUBMIT_TO_CHECKER',
    'CHECKER_APPROVE',
    'CHECKER_REJECT',
    'CHECKER_REQUEST_CORRECTION',
    'DELIVER_TO_NBE',
    'NBE_DELIVERY_SUCCESS',
    'NBE_DELIVERY_FAILURE',
    'USER_LOGIN',
    'USER_REGISTER',
    'USER_STATUS_ACTIVE',
    'USER_STATUS_DISABLED',
    'USER_STATUS_PENDING_APPROVAL',
    'INGESTION_COMPLETED',
    'GENERATE_REPORT_FROM_SSOT',
    'SYSTEM_BOOTSTRAP',
  ];

  const distinctActions = Array.from(
    new Set([...logs.map((l) => l.action).filter(Boolean), ...standardActions])
  );

  const distinctEntityTypes = Array.from(
    new Set(['ALL', ...logs.map((l) => l.entityType).filter(Boolean)])
  );

  const filteredLogs = logs.filter((log) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      log.action.toLowerCase().includes(q) ||
      log.actorName.toLowerCase().includes(q) ||
      log.details.toLowerCase().includes(q) ||
      log.entityId.toLowerCase().includes(q) ||
      log.correlationId.toLowerCase().includes(q);

    const matchesAction = actionFilter === 'ALL' || log.action === actionFilter;
    const matchesRole = roleFilter === 'ALL' || log.actorRole === roleFilter;
    const matchesEntity = entityFilter === 'ALL' || log.entityType === entityFilter;

    return matchesSearch && matchesAction && matchesRole && matchesEntity;
  });

  const paginatedLogs = filteredLogs.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  /**
   * Generates and downloads an official compliance CSV export of the filtered audit trail
   */
  const exportCSV = () => {
    if (filteredLogs.length === 0) return;

    // Header metadata comments for regulatory compliance
    const nowIso = new Date().toISOString();
    const metaHeader = [
      `# OROMIA BANK S.C. - NATIONAL BANK OF ETHIOPIA (NBE) REGULATORY COMPLIANCE AUDIT TRAIL`,
      `# Institution Code: 0000013 | Directive: BSD/03/2020 | Exported At: ${nowIso}`,
      `# Filter Criteria: Action=${actionFilter} | Role=${roleFilter} | Entity=${entityFilter} | SearchQuery="${searchQuery}" | Record Count=${filteredLogs.length}`,
      ``,
    ].join('\r\n');

    const columnHeaders = [
      'Log ID',
      'Timestamp (UTC)',
      'Timestamp (Local)',
      'Actor Name',
      'Actor Role',
      'Compliance Action',
      'Entity Type',
      'Entity ID / Return Code',
      'Audit Narrative & Details',
      'Correlation / NBE Token',
    ];

    const dataRows = filteredLogs.map((l) => [
      `"${l.id}"`,
      `"${l.timestamp}"`,
      `"${new Date(l.timestamp).toLocaleString('en-US')}"`,
      `"${l.actorName.replace(/"/g, '""')}"`,
      `"${l.actorRole}"`,
      `"${l.action}"`,
      `"${l.entityType || 'REGULATORY'}"`,
      `"${l.entityId}"`,
      `"${l.details.replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`,
      `"${l.correlationId}"`,
    ]);

    const csvBody = [columnHeaders.join(','), ...dataRows.map((r) => r.join(','))].join('\r\n');
    const fullCsvContent = metaHeader + csvBody;

    const blob = new Blob([fullCsvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const safeDate = new Date().toISOString().slice(0, 10);
    link.setAttribute('download', `OROMIA_BANK_NBE_AUDIT_LOGS_${actionFilter}_${safeDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setExportNotice(`Exported ${filteredLogs.length} audit records to CSV.`);
    setTimeout(() => setExportNotice(null), 4000);
  };

  const exportJSON = () => {
    if (filteredLogs.length === 0) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(filteredLogs, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', dataStr);
    link.setAttribute('download', `OROMIA_BANK_NBE_AUDIT_LOGS_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setExportNotice(`Exported ${filteredLogs.length} audit records to JSON.`);
    setTimeout(() => setExportNotice(null), 4000);
  };

  const exportPDF = () => {
    if (filteredLogs.length === 0) return;
    exportGeneralAuditTrailPDF(filteredLogs, {
      filtersSummary: `Action=${actionFilter} | Role=${roleFilter} | Entity=${entityFilter} | Search="${searchQuery || 'None'}"`,
      officerName: 'Authorized Regulatory Compliance Auditor',
      officerRole: 'Senior NBE Governance Officer',
    });
    setExportNotice(`Exported ${filteredLogs.length} audit records as signed NBE PDF document.`);
    setTimeout(() => setExportNotice(null), 4000);
  };

  const getActionBadgeColor = (action: string) => {
    if (action === 'BIOMETRIC_AUTH_SUCCESS' || action === 'BIOMETRIC_LOGIN' || action === 'BIOMETRIC_ENROLLED') {
      return 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800';
    }
    if (action === 'BIOMETRIC_AUTH_FAILURE') {
      return 'bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800';
    }
    if (action === 'BIOMETRIC_AUTH_TIMEOUT') {
      return 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800';
    }
    if (action === 'BIOMETRIC_PROBE') {
      return 'bg-cyan-50 text-cyan-800 border-cyan-300 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800';
    }
    if (action.includes('APPROVE')) return 'bg-emerald-50 text-emerald-800 border-emerald-300';
    if (action.includes('REJECT')) return 'bg-rose-50 text-rose-800 border-rose-300';
    if (action.includes('SUBMIT')) return 'bg-amber-50 text-amber-800 border-amber-300';
    if (action.includes('DELIVER') || action.includes('SEND')) return 'bg-ob-green-50 text-ob-green-900 border-ob-green-300';
    if (action.includes('CREATE')) return 'bg-ob-indigo-50 text-ob-indigo-800 border-ob-indigo-200';
    if (action.includes('USER_STATUS')) return 'bg-purple-50 text-purple-800 border-purple-200';
    return 'bg-slate-50 text-slate-800 border-slate-200';
  };

  const renderActionIcon = (action: string) => {
    if (action === 'BIOMETRIC_AUTH_TIMEOUT') {
      return <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />;
    }
    if (action === 'BIOMETRIC_AUTH_FAILURE') {
      return <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400 shrink-0" />;
    }
    if (action.startsWith('BIOMETRIC')) {
      return <Fingerprint className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />;
    }
    return null;
  };

  return (
    <div className="h-full flex flex-col overflow-hidden space-y-2.5 font-sans">
      {/* 1. Header Banner (Compact, Fixed Height) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 bg-ob-indigo-50 dark:bg-ob-indigo-950/60 rounded-lg text-ob-indigo-700 dark:text-ob-indigo-300 border border-ob-indigo-200 dark:border-ob-indigo-800">
              <History className="w-4 h-4" />
            </span>
            <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white tracking-tight">
              Immutable Regulatory Compliance Audit Trail
            </h2>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-ob-green-50 dark:bg-ob-green-950/60 text-ob-green-800 dark:text-ob-green-300 border border-ob-green-300 dark:border-ob-green-800">
              BSD/03/2020
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Cryptographically timestamped audit logging for Maker drafts, Checker 4-eyes reviews, user status updates, and NBE transmissions.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Export Signed PDF Button */}
          <button
            type="button"
            onClick={exportPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-ob-green-600 hover:bg-ob-green-700 text-white text-xs font-bold rounded-lg transition-colors shadow-2xs cursor-pointer"
            title={`Export ${filteredLogs.length} audit logs as signed NBE PDF document`}
          >
            <FileCheck className="w-3.5 h-3.5" />
            <span>Signed PDF</span>
            <span className="px-1 py-0.2 rounded bg-ob-green-800 text-[10px] font-mono text-white">
              {filteredLogs.length}
            </span>
          </button>

          {/* Enhanced Export CSV Button */}
          <button
            type="button"
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-ob-indigo-600 hover:bg-ob-indigo-700 text-white text-xs font-bold rounded-lg transition-colors shadow-2xs cursor-pointer"
            title={`Export ${filteredLogs.length} filtered audit logs to CSV for regulatory reporting`}
          >
            <Download className="w-3.5 h-3.5 text-ob-green-300" />
            <span>Export CSV</span>
            <span className="px-1 py-0.2 rounded bg-ob-indigo-800 text-[10px] font-mono text-white">
              {filteredLogs.length}
            </span>
          </button>

          <button
            type="button"
            onClick={exportJSON}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors shadow-2xs cursor-pointer"
            title="Export audit logs as JSON dataset"
          >
            <Download className="w-3 h-3 text-slate-400" />
            <span className="hidden sm:inline">JSON</span>
          </button>

          <button
            type="button"
            onClick={fetchLogs}
            className="p-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg transition-colors cursor-pointer"
            title="Refresh logs from server"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-ob-indigo-600 dark:text-ob-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Export Confirmation Notice */}
      {exportNotice && (
        <div className="shrink-0 p-2 rounded-xl bg-ob-green-50 dark:bg-ob-green-950/60 border border-ob-green-300 dark:border-ob-green-800 text-ob-green-900 dark:text-ob-green-300 text-xs font-semibold flex items-center justify-between shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-ob-green-600 dark:text-ob-green-400" />
            <span>{exportNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setExportNotice(null)}
            className="p-0.5 rounded text-ob-green-700 dark:text-ob-green-400 hover:text-ob-green-900"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. Filters & Search Strip with Action, Role, and Entity Dropdowns */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2 shadow-2xs flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="w-3.5 h-3.5 text-ob-indigo-500 dark:text-ob-indigo-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search action, actor, entity ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-ob-indigo-500 focus:bg-white dark:focus:bg-slate-800"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Action Filter Dropdown */}
          <div className="flex items-center gap-1">
            <span className="text-slate-500 dark:text-slate-400 font-medium text-[11px] flex items-center gap-1">
              <Filter className="w-3 h-3 text-ob-indigo-600 dark:text-ob-indigo-400" />
              Action:
            </span>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-200 font-medium focus:outline-none focus:ring-1 focus:ring-ob-indigo-500 cursor-pointer max-w-[150px]"
            >
              <option value="ALL">All Actions ({logs.length})</option>
              {distinctActions.map((act) => (
                <option key={act} value={act}>
                  {act}
                </option>
              ))}
            </select>
          </div>

          {/* Actor Role Filter Dropdown */}
          <div className="flex items-center gap-1">
            <span className="text-slate-500 dark:text-slate-400 font-medium text-[11px] flex items-center gap-1">
              <UserCheck className="w-3 h-3 text-ob-indigo-600 dark:text-ob-indigo-400" />
              Role:
            </span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-200 font-medium focus:outline-none focus:ring-1 focus:ring-ob-indigo-500 cursor-pointer"
            >
              <option value="ALL">All Roles</option>
              <option value="ADMIN">ADMIN</option>
              <option value="MAKER">MAKER</option>
              <option value="CHECKER">CHECKER</option>
              <option value="SYSTEM">SYSTEM</option>
              <option value="NBE_OFFICER">NBE_OFFICER</option>
            </select>
          </div>

          {/* Entity Type Filter Dropdown */}
          {distinctEntityTypes.length > 2 && (
            <div className="flex items-center gap-1">
              <span className="text-slate-500 dark:text-slate-400 font-medium text-[11px] flex items-center gap-1">
                <Layers className="w-3 h-3 text-ob-indigo-600 dark:text-ob-indigo-400" />
                Entity:
              </span>
              <select
                value={entityFilter}
                onChange={(e) => setEntityFilter(e.target.value)}
                className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-200 font-medium focus:outline-none focus:ring-1 focus:ring-ob-indigo-500 cursor-pointer"
              >
                {distinctEntityTypes.map((ent) => (
                  <option key={ent} value={ent}>
                    {ent === 'ALL' ? 'All Entities' : ent}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* 3. Audit Logs Table (Strict flex-1 min-h-0 overflow-hidden) */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs">
        <div className="flex-1 min-h-0 overflow-y-auto">
          {paginatedLogs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <History className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Audit Events Match Criteria</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Actions performed on returns and user profiles will appear here.</p>
              {(searchQuery || actionFilter !== 'ALL' || roleFilter !== 'ALL' || entityFilter !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setActionFilter('ALL');
                    setRoleFilter('ALL');
                    setEntityFilter('ALL');
                  }}
                  className="mt-2 text-xs font-bold text-ob-indigo-700 dark:text-ob-indigo-400 hover:underline cursor-pointer"
                >
                  Reset all filters
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-semibold sticky top-0 z-10">
                  <th className="py-2 px-3">Timestamp</th>
                  <th className="py-2 px-3">Actor & Role</th>
                  <th className="py-2 px-3">Action</th>
                  <th className="py-2 px-3">Entity ID</th>
                  <th className="py-2 px-3">Audit Details</th>
                  <th className="py-2 px-3 font-mono">Correlation Token</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginatedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-2 px-3 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap text-[11px]">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500">
                        {new Date(log.timestamp).toLocaleDateString()}
                      </div>
                    </td>

                    <td className="py-2 px-3 whitespace-nowrap">
                      <div className="font-bold text-slate-900 dark:text-slate-100">{log.actorName}</div>
                      <div className="text-[10px] uppercase font-bold text-ob-indigo-700 dark:text-ob-indigo-400">{log.actorRole}</div>
                    </td>

                    <td className="py-2 px-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider border ${getActionBadgeColor(
                          log.action
                        )}`}
                      >
                        {renderActionIcon(log.action)}
                        <span>{log.action}</span>
                      </span>
                    </td>

                    <td className="py-2 px-3 font-mono font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap text-[11px]">
                      {log.entityId}
                    </td>

                    <td className="py-2 px-3 text-slate-600 dark:text-slate-300 max-w-sm truncate" title={log.details}>
                      {log.details}
                    </td>

                    <td className="py-2 px-3 font-mono text-[10px] text-slate-400 dark:text-slate-500 whitespace-nowrap">
                      {log.correlationId}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Footer */}
        <div className="shrink-0 p-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <Pagination
            currentPage={page}
            totalItems={filteredLogs.length}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[8, 15, 30]}
            itemName="audit logs"
          />
        </div>
      </div>
    </div>
  );
};
