/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  History,
  Search,
  Filter,
  Download,
  Trash2,
  RefreshCw,
  Building2,
  FileText,
  Network,
  User,
  Clock,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Layers,
  ArrowRight,
  RotateCcw,
  FileSpreadsheet,
  Lock,
  FileCheck,
  X,
  Calendar,
  Sparkles,
  SlidersHorizontal,
  Info,
} from 'lucide-react';
import {
  departmentService,
  GovernanceChangeLog,
  GovernanceEntityType,
  GovernanceChangeLogFilter,
} from '../services/departmentService.ts';
import { getAllReports } from '../data/report-registry.ts';
import { userService, UserAccount } from '../services/userService.ts';
import { UserSession } from '../types/regulatory.ts';
import { Pagination } from './Pagination.tsx';
import { ConfigurationGovernanceView } from './ConfigurationGovernanceView.tsx';
import { vibrate } from '../utils/haptics.ts';
import {
  exportSignedAuditPDF,
  exportEncryptedAuditCSV,
  generateIntegrityChecksum,
  AuditExportOptions,
} from '../utils/auditExportUtils.ts';

interface ChangeHistoryViewProps {
  currentUser?: UserSession;
  onNotice?: (message: string, type?: 'SUCCESS' | 'ERROR') => void;
}

export const ChangeHistoryView: React.FC<ChangeHistoryViewProps> = ({
  currentUser,
  onNotice,
}) => {
  const [logs, setLogs] = useState<GovernanceChangeLog[]>(() => departmentService.getChangeLogs());
  const [departments, setDepartments] = useState(() => departmentService.getAll());
  const [reports, setReports] = useState(() => getAllReports());

  // Search & Multi-Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [entityFilter, setEntityFilter] = useState<string>('ALL');
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [reportTypeFilter, setReportTypeFilter] = useState<string>('ALL');
  const [userIdFilter, setUserIdFilter] = useState<string>('ALL');
  const [dateRangeFilter, setDateRangeFilter] = useState<'ALL' | 'TODAY' | '7_DAYS' | '30_DAYS'>('ALL');

  // Expanded details
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());

  // Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'PDF_SIGNED' | 'CSV_ENCRYPTED' | 'CSV_STANDARD'>('PDF_SIGNED');
  const [officerName, setOfficerName] = useState(currentUser?.name || 'Abebe Bikila');
  const [officerRole, setOfficerRole] = useState(currentUser?.role ? `${currentUser.role} - Regulatory Governance` : 'Senior Regulatory Compliance Auditor');
  const [complianceNotes, setComplianceNotes] = useState('Official NBE Regulatory Supervision Audit Trail Submission');
  const [isExporting, setIsExporting] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  // Sub-view toggle
  const [activeViewMode, setActiveViewMode] = useState<'AUDIT_LOGS' | 'GOVERNANCE_PROPOSALS'>('AUDIT_LOGS');

  // Real-time subscriptions
  useEffect(() => {
    const unsubLogs = departmentService.subscribeChangeLogs((updated) => {
      setLogs(updated);
    });
    const unsubDepts = departmentService.subscribe((updated) => {
      setDepartments(updated);
    });
    return () => {
      unsubLogs();
      unsubDepts();
    };
  }, []);

  // Extract unique users/actors from logs and user service
  const availableUsers = useMemo(() => {
    const fromLogs = logs.map((l) => ({
      id: l.userId || l.actor,
      name: l.actor,
      role: l.actorRole,
    }));
    const fromService = userService.getAll().map((u: UserAccount) => ({
      id: u.name,
      name: u.name,
      role: u.role,
    }));

    const map = new Map<string, { id: string; name: string; role: string }>();
    [...fromService, ...fromLogs].forEach((item) => {
      if (item.id && !map.has(item.id)) {
        map.set(item.id, item);
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [logs]);

  // Query filtered logs via departmentService
  const filteredLogs = useMemo(() => {
    return departmentService.getChangeLogs({
      entityType: entityFilter as any,
      action: actionFilter,
      department: departmentFilter,
      reportType: reportTypeFilter,
      userId: userIdFilter,
      dateRange: dateRangeFilter,
      search: searchQuery,
    });
  }, [
    logs,
    entityFilter,
    actionFilter,
    departmentFilter,
    reportTypeFilter,
    userIdFilter,
    dateRangeFilter,
    searchQuery,
  ]);

  // Active filter count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (entityFilter !== 'ALL') count++;
    if (actionFilter !== 'ALL') count++;
    if (departmentFilter !== 'ALL') count++;
    if (reportTypeFilter !== 'ALL') count++;
    if (userIdFilter !== 'ALL') count++;
    if (dateRangeFilter !== 'ALL') count++;
    if (searchQuery.trim()) count++;
    return count;
  }, [
    entityFilter,
    actionFilter,
    departmentFilter,
    reportTypeFilter,
    userIdFilter,
    dateRangeFilter,
    searchQuery,
  ]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setEntityFilter('ALL');
    setActionFilter('ALL');
    setDepartmentFilter('ALL');
    setReportTypeFilter('ALL');
    setUserIdFilter('ALL');
    setDateRangeFilter('ALL');
    setPage(1);
    vibrate(10);
  };

  const toggleExpand = (id: string) => {
    setExpandedLogIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    vibrate(8);
  };

  const handleClearLogs = () => {
    if (confirm('Are you sure you want to permanently clear governance change logs? This action is irreversible.')) {
      departmentService.clearChangeLogs();
      if (onNotice) onNotice('Governance change logs cleared.', 'SUCCESS');
      vibrate(20);
    }
  };

  // Build filter summary string for export
  const buildFilterSummary = () => {
    const parts: string[] = [];
    if (departmentFilter !== 'ALL') parts.push(`Dept: ${departmentFilter}`);
    if (reportTypeFilter !== 'ALL') parts.push(`Report: ${reportTypeFilter}`);
    if (userIdFilter !== 'ALL') parts.push(`User: ${userIdFilter}`);
    if (entityFilter !== 'ALL') parts.push(`Entity: ${entityFilter}`);
    if (actionFilter !== 'ALL') parts.push(`Action: ${actionFilter}`);
    if (dateRangeFilter !== 'ALL') parts.push(`Date Range: ${dateRangeFilter}`);
    if (searchQuery.trim()) parts.push(`Search: "${searchQuery}"`);
    return parts.length > 0 ? parts.join(' | ') : 'All Governance Records (Global Scope)';
  };

  // Execute Export
  const handleExecuteExport = () => {
    if (filteredLogs.length === 0) return;
    setIsExporting(true);

    try {
      const options: AuditExportOptions = {
        format: exportFormat,
        officerName: officerName.trim() || 'Abebe Bikila',
        officerRole: officerRole.trim() || 'Senior Compliance Officer',
        notes: complianceNotes.trim(),
        filtersSummary: buildFilterSummary(),
        department: departmentFilter !== 'ALL' ? departmentFilter : undefined,
        reportType: reportTypeFilter !== 'ALL' ? reportTypeFilter : undefined,
        userId: userIdFilter !== 'ALL' ? userIdFilter : undefined,
      };

      if (exportFormat === 'PDF_SIGNED') {
        exportSignedAuditPDF(filteredLogs, options);
        if (onNotice) onNotice(`Exported ${filteredLogs.length} audit logs as NBE-compliant Signed PDF.`, 'SUCCESS');
      } else {
        exportEncryptedAuditCSV(filteredLogs, options);
        const modeLabel = exportFormat === 'CSV_ENCRYPTED' ? 'Encrypted Compliance CSV' : 'Standard CSV';
        if (onNotice) onNotice(`Exported ${filteredLogs.length} audit logs as ${modeLabel}.`, 'SUCCESS');
      }

      vibrate([20, 30, 25]);
      setIsExportModalOpen(false);
    } catch (err: any) {
      console.error('Export failed:', err);
      alert(`Export error: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const getEntityIcon = (type: GovernanceEntityType) => {
    switch (type) {
      case 'DEPARTMENT':
        return <Building2 className="w-3.5 h-3.5 text-ob-indigo-600 dark:text-ob-indigo-400" />;
      case 'REPORT_TYPE':
        return <FileText className="w-3.5 h-3.5 text-ob-green-600 dark:text-ob-green-400" />;
      case 'LINKAGE':
        return <Network className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />;
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'CREATE':
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';
      case 'UPDATE':
      case 'RENAME':
        return 'bg-ob-indigo-50 text-ob-indigo-700 dark:bg-ob-indigo-950 dark:text-ob-indigo-300 border-ob-indigo-300 dark:border-ob-indigo-800';
      case 'DELETE':
        return 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border-rose-300 dark:border-rose-800';
      case 'LINK_REPORTS':
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border-amber-300 dark:border-amber-800';
      case 'BULK_IMPORT':
        return 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800';
      case 'RESTORE':
        return 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border-purple-300 dark:border-purple-800';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700';
    }
  };

  return (
    <div className="space-y-4">
      {/* Top View Selector: Audit Trail vs Governed Proposals */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveViewMode('AUDIT_LOGS')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            activeViewMode === 'AUDIT_LOGS'
              ? 'bg-ob-indigo-600 text-white shadow-2xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Audit Trail Logs & Timeline</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveViewMode('GOVERNANCE_PROPOSALS')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            activeViewMode === 'GOVERNANCE_PROPOSALS'
              ? 'bg-ob-indigo-600 text-white shadow-2xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Governed Proposals & Approvals (Phase 8)</span>
        </button>
      </div>

      {activeViewMode === 'GOVERNANCE_PROPOSALS' ? (
        <ConfigurationGovernanceView currentUser={currentUser} onNotice={onNotice} />
      ) : (
        <>
          {/* Header & Main Controls Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3.5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-ob-indigo-500/10 dark:bg-ob-indigo-500/20 text-ob-indigo-600 dark:text-ob-indigo-400 border border-ob-indigo-500/30 flex items-center justify-center shrink-0">
              <History className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Regulatory Governance Audit Trail & Compliance Log
                </h3>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  NBE Directive BSD/03/2020
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {filteredLogs.length} Events ({logs.length} Total)
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Multi-dimensional audit trail capturing department structural changes, report template life cycles, M:N matrix alterations, and user authorization activity.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Export Audit Trail Button */}
            <button
              type="button"
              onClick={() => setIsExportModalOpen(true)}
              disabled={filteredLogs.length === 0}
              className="min-h-[38px] px-3.5 py-1.5 bg-ob-indigo-600 hover:bg-ob-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 touch-press"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Audit Trail (Signed PDF / CSV)</span>
            </button>

            {logs.length > 0 && (
              <button
                type="button"
                onClick={handleClearLogs}
                className="min-h-[38px] px-2.5 py-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-rose-200 dark:hover:border-rose-900"
                title="Clear Logs"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Search Bar & Multi-Filter Dropdown Controls */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
          {/* Top Row: Search input & Quick resets */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex-1 min-w-[240px] relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search audit trail by entity name, ID, return key, actor, summary, or details..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-ob-indigo-500 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setPage(1);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-2.5 py-2 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/80 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Filters ({activeFiltersCount})</span>
              </button>
            )}
          </div>

          {/* Multi-Filter Dropdowns Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
            {/* Filter 1: Department */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">
                Department
              </label>
              <select
                value={departmentFilter}
                onChange={(e) => {
                  setDepartmentFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full py-1.5 px-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-ob-indigo-500"
              >
                <option value="ALL">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.name}>
                    {dept.shortCode} - {dept.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter 2: Report Type */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">
                Report Type
              </label>
              <select
                value={reportTypeFilter}
                onChange={(e) => {
                  setReportTypeFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full py-1.5 px-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-ob-indigo-500"
              >
                <option value="ALL">All Report Types</option>
                {reports.map((rep) => (
                  <option key={rep.ReturnKey} value={rep.ReturnKey}>
                    {rep.ReturnKey} - {rep.Title.length > 20 ? rep.Title.substring(0, 20) + '...' : rep.Title}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter 3: User ID / Actor */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">
                User ID / Officer
              </label>
              <select
                value={userIdFilter}
                onChange={(e) => {
                  setUserIdFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full py-1.5 px-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-ob-indigo-500"
              >
                <option value="ALL">All Officers</option>
                {availableUsers.map((user) => (
                  <option key={user.id} value={user.name}>
                    {user.name} ({user.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Filter 4: Entity Type */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">
                Entity Category
              </label>
              <select
                value={entityFilter}
                onChange={(e) => {
                  setEntityFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full py-1.5 px-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-ob-indigo-500"
              >
                <option value="ALL">All Categories</option>
                <option value="DEPARTMENT">Departments</option>
                <option value="REPORT_TYPE">Report Types</option>
                <option value="LINKAGE">Linkage Matrix</option>
              </select>
            </div>

            {/* Filter 5: Action Type */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">
                Action Type
              </label>
              <select
                value={actionFilter}
                onChange={(e) => {
                  setActionFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full py-1.5 px-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-ob-indigo-500"
              >
                <option value="ALL">All Actions</option>
                <option value="CREATE">Created</option>
                <option value="UPDATE">Updated</option>
                <option value="RENAME">Renamed</option>
                <option value="DELETE">Deleted</option>
                <option value="LINK_REPORTS">Linkage Changed</option>
                <option value="BULK_IMPORT">Bulk Imported</option>
                <option value="RESTORE">Restored</option>
              </select>
            </div>

            {/* Filter 6: Date Range */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">
                Time Horizon
              </label>
              <select
                value={dateRangeFilter}
                onChange={(e) => {
                  setDateRangeFilter(e.target.value as any);
                  setPage(1);
                }}
                className="w-full py-1.5 px-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-ob-indigo-500"
              >
                <option value="ALL">All Time</option>
                <option value="TODAY">Today Only</option>
                <option value="7_DAYS">Last 7 Days</option>
                <option value="30_DAYS">Last 30 Days</option>
              </select>
            </div>
          </div>

          {/* Active Filter Pills Display */}
          {activeFiltersCount > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[11px]">
              <span className="text-slate-400 font-semibold">Active Criteria:</span>

              {departmentFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-ob-indigo-50 dark:bg-ob-indigo-950 text-ob-indigo-700 dark:text-ob-indigo-300 border border-ob-indigo-200 dark:border-ob-indigo-800">
                  <Building2 className="w-3 h-3" />
                  <span>Dept: {departmentFilter}</span>
                  <button type="button" onClick={() => setDepartmentFilter('ALL')} className="hover:text-rose-500">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {reportTypeFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-ob-green-50 dark:bg-ob-green-950 text-ob-green-700 dark:text-ob-green-300 border border-ob-green-200 dark:border-ob-green-800">
                  <FileText className="w-3 h-3" />
                  <span>Report: {reportTypeFilter}</span>
                  <button type="button" onClick={() => setReportTypeFilter('ALL')} className="hover:text-rose-500">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {userIdFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  <User className="w-3 h-3" />
                  <span>User: {userIdFilter}</span>
                  <button type="button" onClick={() => setUserIdFilter('ALL')} className="hover:text-rose-500">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {entityFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  <span>Category: {entityFilter}</span>
                  <button type="button" onClick={() => setEntityFilter('ALL')} className="hover:text-rose-500">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {actionFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  <span>Action: {actionFilter}</span>
                  <button type="button" onClick={() => setActionFilter('ALL')} className="hover:text-rose-500">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {dateRangeFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  <Clock className="w-3 h-3" />
                  <span>Horizon: {dateRangeFilter}</span>
                  <button type="button" onClick={() => setDateRangeFilter('ALL')} className="hover:text-rose-500">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Logs Timeline List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-2">
            <Clock className="w-9 h-9 mx-auto text-slate-300 dark:text-slate-600" />
            <p className="font-semibold text-slate-600 dark:text-slate-300">
              No audit events found matching your filter criteria.
            </p>
            <p className="text-[11px] max-w-md mx-auto">
              Try adjusting your department, report type, user ID, or date filters to expand the search scope.
            </p>
            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="mt-2 px-3 py-1.5 bg-ob-indigo-600 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Clear All Filter Criteria
              </button>
            )}
          </div>
        ) : (
          filteredLogs.slice((page - 1) * pageSize, page * pageSize).map((log) => {
            const isExpanded = expandedLogIds.has(log.id);
            return (
              <div
                key={log.id}
                className="p-3.5 hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors text-xs space-y-2"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                      {getEntityIcon(log.entityType)}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                          {log.summary}
                        </span>
                        <span className={`px-2 py-0.2 rounded text-[10px] font-bold border ${getActionBadge(log.action)}`}>
                          {log.action}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                          {log.entityType}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold text-ob-indigo-600 dark:text-ob-indigo-400 bg-ob-indigo-50 dark:bg-ob-indigo-950/60 border border-ob-indigo-200 dark:border-ob-indigo-800">
                          {log.entityId}
                        </span>
                      </div>

                      {log.details && (
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                          {log.details}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-slate-400 shrink-0">
                    <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300 font-medium">
                      <User className="w-3 h-3 text-slate-400" />
                      <span>{log.actor}</span>
                      <span className="text-[9px] px-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-400 font-normal">
                        {log.actorRole}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{new Date(log.timestamp).toLocaleString()}</span>
                    </div>

                    {(log.diff || log.oldState || log.newState) && (
                      <button
                        type="button"
                        onClick={() => toggleExpand(log.id)}
                        className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-md transition-colors text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer flex items-center gap-0.5"
                      >
                        <span className="text-[10px] font-bold">{isExpanded ? 'Hide Diff' : 'View Diff'}</span>
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Collapsible Diff / State View */}
                {isExpanded && (
                  <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2 animate-in fade-in">
                    {log.diff && log.diff.length > 0 && (
                      <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 space-y-1.5">
                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide block">
                          Field-Level Modification Diff:
                        </span>
                        <div className="space-y-1">
                          {log.diff.map((d, i) => (
                            <div
                              key={i}
                              className="text-[11px] font-mono p-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 flex-wrap"
                            >
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                {d.field}:
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-rose-600 dark:text-rose-400 line-through bg-rose-50 dark:bg-rose-950/60 px-1.5 py-0.5 rounded">
                                  {Array.isArray(d.oldValue) ? d.oldValue.join(', ') : String(d.oldValue ?? 'none')}
                                </span>
                                <ArrowRight className="w-3 h-3 text-slate-400" />
                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
                                  {Array.isArray(d.newValue) ? d.newValue.join(', ') : String(d.newValue ?? 'none')}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Pagination */}
        <div className="p-3 bg-slate-50/50 dark:bg-slate-900">
          <Pagination
            currentPage={page}
            totalItems={filteredLogs.length}
            pageSize={pageSize}
            onPageChange={(p) => setPage(p)}
            onPageSizeChange={(sz) => {
              setPageSize(sz);
              setPage(1);
            }}
          />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: EXPORT AUDIT TRAIL (Signed PDF / Encrypted CSV) */}
      {/* ========================================================================= */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-700 shadow-2xl p-5 space-y-4 max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-ob-indigo-500/10 dark:bg-ob-indigo-500/20 text-ob-indigo-600 dark:text-ob-indigo-400 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Export Regulatory Audit Trail
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Official NBE BSD/03/2020 Compliance Certification Export
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scope Summary */}
            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs space-y-1">
              <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white">
                <span>Selected Export Scope:</span>
                <span className="text-ob-indigo-600 dark:text-ob-indigo-400">
                  {filteredLogs.length} Events
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {buildFilterSummary()}
              </p>
            </div>

            {/* Export Format Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Compliance Export Format
              </label>
              <div className="grid grid-cols-1 gap-2">
                {/* Format 1: Signed PDF */}
                <label
                  className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                    exportFormat === 'PDF_SIGNED'
                      ? 'bg-ob-indigo-50/70 dark:bg-ob-indigo-950/50 border-ob-indigo-500 ring-1 ring-ob-indigo-500'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="exportFormat"
                    value="PDF_SIGNED"
                    checked={exportFormat === 'PDF_SIGNED'}
                    onChange={() => setExportFormat('PDF_SIGNED')}
                    className="mt-1 text-ob-indigo-600"
                  />
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white">
                      <FileCheck className="w-4 h-4 text-ob-indigo-600 dark:text-ob-indigo-400" />
                      <span>Signed PDF Audit Document (Official NBE Format)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Landscape multi-page PDF formatted with NBE Directive header, cryptographic SHA-256 integrity checksum, signature certification block, and structural diffs.
                    </p>
                  </div>
                </label>

                {/* Format 2: Encrypted CSV */}
                <label
                  className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                    exportFormat === 'CSV_ENCRYPTED'
                      ? 'bg-ob-indigo-50/70 dark:bg-ob-indigo-950/50 border-ob-indigo-500 ring-1 ring-ob-indigo-500'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="exportFormat"
                    value="CSV_ENCRYPTED"
                    checked={exportFormat === 'CSV_ENCRYPTED'}
                    onChange={() => setExportFormat('CSV_ENCRYPTED')}
                    className="mt-1 text-ob-indigo-600"
                  />
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white">
                      <Lock className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                      <span>Encrypted / Armored CSV (Digital Signature Verification)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Standardized data stream enveloped with Base64 security seal, HMAC validation tokens, and regulatory metadata for automated supervisor ingestion.
                    </p>
                  </div>
                </label>

                {/* Format 3: Standard CSV */}
                <label
                  className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                    exportFormat === 'CSV_STANDARD'
                      ? 'bg-ob-indigo-50/70 dark:bg-ob-indigo-950/50 border-ob-indigo-500 ring-1 ring-ob-indigo-500'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="exportFormat"
                    value="CSV_STANDARD"
                    checked={exportFormat === 'CSV_STANDARD'}
                    onChange={() => setExportFormat('CSV_STANDARD')}
                    className="mt-1 text-ob-indigo-600"
                  />
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white">
                      <FileSpreadsheet className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                      <span>Standard CSV Spreadsheet</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Standard plain comma-separated values file suitable for spreadsheet software and internal analytics.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Officer Sign-off Inputs */}
            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Certifying Compliance Officer Name
                </label>
                <input
                  type="text"
                  value={officerName}
                  onChange={(e) => setOfficerName(e.target.value)}
                  placeholder="Officer full legal name"
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-ob-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Officer Designation / Authority Role
                </label>
                <input
                  type="text"
                  value={officerRole}
                  onChange={(e) => setOfficerRole(e.target.value)}
                  placeholder="e.g. Senior Compliance Auditor / Risk Manager"
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-ob-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Compliance Audit Purpose / Regulatory Note
                </label>
                <input
                  type="text"
                  value={complianceNotes}
                  onChange={(e) => setComplianceNotes(e.target.value)}
                  placeholder="e.g. Quarterly NBE On-Site Examination Submission"
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-ob-indigo-500"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="px-3.5 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer text-xs"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isExporting || filteredLogs.length === 0 || !officerName.trim()}
                onClick={handleExecuteExport}
                className="px-4 py-2 bg-ob-indigo-600 hover:bg-ob-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer text-xs flex items-center gap-1.5 touch-press"
              >
                {isExporting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>
                  {isExporting
                    ? 'Generating Export...'
                    : `Generate & Download (${filteredLogs.length} Events)`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};
