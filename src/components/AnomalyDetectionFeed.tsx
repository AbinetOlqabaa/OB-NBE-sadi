/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  AlertOctagon,
  ShieldAlert,
  Search,
  Eye,
  Plus,
  CheckCircle2,
  Download,
  Activity,
  TrendingUp,
  Clock,
  Layers,
  Sparkles,
  X,
  CheckSquare,
  Square,
} from 'lucide-react';
import type {
  UserSession,
  RegulatoryAnomalyItem,
  AuditFindingSeverity,
  AnomalyPatternType,
  AuditorExportFormat,
} from '../types/regulatory.ts';
import { auditorService } from '../services/auditorService.ts';
import { triggerAuditorMultiFormatExport } from '../utils/auditorMultiFormatExport.ts';
import { Pagination } from './Pagination.tsx';
import { MaximizeButton } from './MaximizeButton.tsx';
import { MaximizedViewModal } from './MaximizedViewModal.tsx';
import { haptics, vibrate } from '../utils/haptics.ts';

interface AnomalyDetectionFeedProps {
  currentUser: UserSession;
  reportKeyFilter?: string;
  onInspectReturn?: (reportKey: string, submissionId?: string) => void;
  onAnomalyConverted?: () => void;
}

export const AnomalyDetectionFeed: React.FC<AnomalyDetectionFeedProps> = ({
  currentUser,
  reportKeyFilter,
  onInspectReturn,
  onAnomalyConverted,
}) => {
  const [severityFilter, setSeverityFilter] = useState<AuditFindingSeverity | 'ALL'>('ALL');
  const [patternFilter, setPatternFilter] = useState<AnomalyPatternType | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(4);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkExportFormat, setBulkExportFormat] = useState<AuditorExportFormat>('XLSX');
  const [tick, setTick] = useState<number>(0);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const anomalies = useMemo(() => {
    return auditorService.getAnomalyDetectionFeed({
      severity: severityFilter,
      patternType: patternFilter,
      search: searchQuery || undefined,
    });
  }, [severityFilter, patternFilter, searchQuery, tick, reportKeyFilter]);

  const paginatedAnomalies = useMemo(() => {
    const start = (page - 1) * pageSize;
    return anomalies.slice(start, start + pageSize);
  }, [anomalies, page, pageSize]);

  const toggleSelect = (id: string) => {
    vibrate(15);
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAllFiltered = () => {
    vibrate(20);
    if (selectedIds.length === anomalies.length && anomalies.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(anomalies.map((a) => a.id));
    }
  };

  const handleConvertAnomaly = (anomaly: RegulatoryAnomalyItem) => {
    const created = auditorService.convertAnomalyToFinding(
      anomaly.id,
      currentUser.id,
      currentUser.name
    );
    if (created) {
      haptics.success();
      setTick((t) => t + 1);
      setStatusBanner(
        `Escalated anomaly ${anomaly.id} (${anomaly.reportKey}) to formal Audit Finding ${created.id}.`
      );
      if (onAnomalyConverted) onAnomalyConverted();
    }
  };

  const handleAcknowledgeAnomaly = (anomaly: RegulatoryAnomalyItem) => {
    const nextStatus = anomaly.status === 'INVESTIGATING' ? 'DISMISSED' : 'INVESTIGATING';
    auditorService.updateAnomalyStatus(anomaly.id, nextStatus, currentUser.name);
    vibrate(20);
    setTick((t) => t + 1);
    setStatusBanner(
      `Anomaly ${anomaly.id} (${anomaly.reportKey}) marked as ${nextStatus.replace(/_/g, ' ')}.`
    );
  };

  const handleSingleExport = (anomaly: RegulatoryAnomalyItem, format: AuditorExportFormat) => {
    triggerAuditorMultiFormatExport({
      format,
      scope: 'ANOMALY_FEED',
      mode: 'SINGLE',
      selectedIds: [anomaly.id],
      actorName: currentUser.name,
    });
    haptics.success();
    setStatusBanner(`Exported single anomaly ${anomaly.id} in ${format} format.`);
  };

  const handleBulkExport = (format: AuditorExportFormat) => {
    const targetIds = selectedIds.length > 0 ? selectedIds : anomalies.map((a) => a.id);
    triggerAuditorMultiFormatExport({
      format,
      scope: 'ANOMALY_FEED',
      mode: 'BULK',
      selectedIds: targetIds,
      actorName: currentUser.name,
    });
    haptics.success();
    setStatusBanner(
      `Bulk exported ${targetIds.length} anomaly pattern(s) in ${format} format.`
    );
  };

  const renderSeverityBadge = (severity: AuditFindingSeverity) => {
    switch (severity) {
      case 'CRITICAL':
        return (
          <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-rose-600 text-white flex items-center gap-1 shrink-0 shadow-2xs">
            <AlertOctagon className="w-3 h-3" />
            <span>CRITICAL</span>
          </span>
        );
      case 'HIGH':
        return (
          <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-orange-600 text-white flex items-center gap-1 shrink-0 shadow-2xs">
            <AlertTriangle className="w-3 h-3" />
            <span>HIGH</span>
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-500 text-slate-950 flex items-center gap-1 shrink-0">
            <ShieldAlert className="w-3 h-3" />
            <span>MEDIUM</span>
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shrink-0">
            {severity}
          </span>
        );
    }
  };

  const renderAnomalyList = (items: RegulatoryAnomalyItem[]) => (
    <div className="divide-y divide-slate-100 dark:divide-slate-800" role="list" aria-label="Anomaly Detection Feed List">
      {items.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-400">
          No suspicious regulatory return patterns match your current filter criteria.
        </div>
      ) : (
        items.map((anom) => {
          const isSelected = selectedIds.includes(anom.id);
          const isHighlighted = reportKeyFilter && anom.reportKey === reportKeyFilter;
          return (
            <div
              key={anom.id}
              role="listitem"
              className={`p-4 transition-colors space-y-3 ${
                isSelected
                  ? 'bg-ob-indigo-50/50 dark:bg-ob-indigo-950/30'
                  : isHighlighted
                  ? 'bg-rose-50/30 dark:bg-rose-950/15'
                  : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/50'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                <div className="flex items-start sm:items-center gap-2.5 flex-wrap min-w-0">
                  <button
                    type="button"
                    onClick={() => toggleSelect(anom.id)}
                    aria-label={`Select anomaly ${anom.id}`}
                    className="min-h-[36px] min-w-[36px] p-1.5 rounded-lg text-slate-400 hover:text-ob-indigo-600 dark:hover:text-ob-indigo-400 flex items-center justify-center cursor-pointer shrink-0"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-ob-indigo-600 dark:text-ob-indigo-400" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>

                  {renderSeverityBadge(anom.severity)}

                  <span className="font-mono text-xs font-bold text-ob-indigo-600 dark:text-ob-indigo-400 bg-ob-indigo-50 dark:bg-ob-indigo-950/60 px-2 py-0.5 rounded border border-ob-indigo-200 dark:border-ob-indigo-800">
                    {anom.reportKey}
                  </span>

                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    {anom.patternLabel}
                  </span>

                  <span className="text-[11px] font-mono text-slate-400">
                    {anom.id}
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                    Deviation: {anom.deviationScore}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                    Confidence: {anom.confidencePct}%
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      anom.status === 'CONVERTED_TO_FINDING'
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                        : anom.status === 'INVESTIGATING'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        : anom.status === 'DISMISSED'
                        ? 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                    }`}
                  >
                    {anom.status.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              <div className="pl-0 sm:pl-9 space-y-2">
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    {anom.title}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                    {anom.description}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200/70 dark:border-slate-800 text-[11px]">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Department</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
                      {anom.department}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Affected Statutory Field</span>
                    <span className="font-mono font-bold text-ob-indigo-600 dark:text-ob-indigo-400">
                      {anom.affectedField}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Expected Baseline</span>
                    <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                      {anom.expectedRange}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Observed Return Value</span>
                    <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                      {anom.observedValue}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {onInspectReturn && (
                      <button
                        type="button"
                        onClick={() => onInspectReturn(anom.reportKey, anom.submissionId)}
                        className="min-h-[38px] px-3 py-1.5 bg-ob-indigo-600 hover:bg-ob-indigo-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect Return</span>
                      </button>
                    )}

                    {anom.status !== 'CONVERTED_TO_FINDING' && (
                      <button
                        type="button"
                        onClick={() => handleConvertAnomaly(anom)}
                        className="min-h-[38px] px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Escalate to Finding</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleAcknowledgeAnomaly(anom)}
                      className="min-h-[38px] px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>
                        {anom.status === 'INVESTIGATING' ? 'Dismiss Pattern' : 'Mark Investigating'}
                      </span>
                    </button>
                  </div>

                  {/* Single Anomaly Quick Export Buttons */}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400 font-semibold mr-1">Single Export:</span>
                    {(['PDF', 'XLSX', 'CSV', 'JSON'] as AuditorExportFormat[]).map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => handleSingleExport(anom, fmt)}
                        className="min-h-[34px] px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
                        title={`Download anomaly ${anom.id} as ${fmt}`}
                      >
                        {fmt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  return (
    <div
      id="auditor-anomaly-detection-feed"
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden min-w-0 max-w-full"
    >
      {/* Header & Controls */}
      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-lg bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                <span>ANOMALY DETECTION FEED</span>
              </span>
              <span className="text-xs font-mono font-bold text-slate-500">
                {anomalies.length} Suspicious Return Patterns Flagged
              </span>
            </div>
            <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
              Anomaly Detection Feed — Suspicious Regulatory Return Patterns
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Automated Z-score variance spikes, cross-schedule imbalances, rapid version churn, and off-hours filing pattern surveillance.
            </p>
          </div>

          {/* Bulk Export & Maximize Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <select
                value={bulkExportFormat}
                onChange={(e) => setBulkExportFormat(e.target.value as AuditorExportFormat)}
                aria-label="Anomaly Bulk Export Format"
                className="min-h-[36px] px-2.5 py-1 text-xs font-mono font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 cursor-pointer"
              >
                <option value="XLSX">XLSX (Excel)</option>
                <option value="CSV">CSV (Ledger)</option>
                <option value="PDF">PDF (Dossier)</option>
                <option value="JSON">JSON (Sealed)</option>
                <option value="XML">XML (NBE XSD)</option>
              </select>
              <button
                type="button"
                onClick={() => handleBulkExport(bulkExportFormat)}
                className="min-h-[36px] px-3 py-1.5 bg-ob-indigo-600 hover:bg-ob-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>
                  {selectedIds.length > 0
                    ? `Bulk Export (${selectedIds.length})`
                    : `Export All (${anomalies.length})`}
                </span>
              </button>
            </div>

            <MaximizeButton
              onClick={() => setIsMaximized(true)}
              title="Maximize Anomaly Detection Feed (Esc to restore)"
            />
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Filter anomalies by return key, department, pattern, or field..."
              className="w-full min-h-[40px] pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-ob-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={toggleSelectAllFiltered}
              className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 cursor-pointer flex items-center gap-1.5"
            >
              {selectedIds.length === anomalies.length && anomalies.length > 0 ? (
                <CheckSquare className="w-3.5 h-3.5 text-ob-indigo-600" />
              ) : (
                <Square className="w-3.5 h-3.5" />
              )}
              <span>Select All ({anomalies.length})</span>
            </button>

            <select
              value={severityFilter}
              onChange={(e) => {
                setSeverityFilter(e.target.value as any);
                setPage(1);
              }}
              className="min-h-[40px] px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 font-medium cursor-pointer"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">CRITICAL Severity</option>
              <option value="HIGH">HIGH Severity</option>
              <option value="MEDIUM">MEDIUM Severity</option>
              <option value="LOW">LOW Severity</option>
            </select>

            <select
              value={patternFilter}
              onChange={(e) => {
                setPatternFilter(e.target.value as any);
                setPage(1);
              }}
              className="min-h-[40px] px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 font-medium cursor-pointer"
            >
              <option value="ALL">All Anomaly Patterns</option>
              <option value="STATISTICAL_VARIANCE_SPIKE">Statistical Z-Score Spike</option>
              <option value="PROVISION_COVERAGE_DROP">Provision Coverage Drop</option>
              <option value="CROSS_SCHEDULE_IMBALANCE">Cross-Schedule Imbalance</option>
              <option value="RAPID_VERSION_CHURN">Rapid Version Churn</option>
              <option value="OFF_HOURS_SUBMISSION">Off-Hours Filing Pattern</option>
              <option value="SLA_BOTTLENECK">SLA Turnaround Drift</option>
            </select>
          </div>
        </div>

        {statusBanner && (
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 flex items-center justify-between gap-2">
            <span>{statusBanner}</span>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              className="text-emerald-600 hover:text-emerald-800 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Anomaly List Body */}
      {renderAnomalyList(paginatedAnomalies)}

      {/* Pagination */}
      <Pagination
        currentPage={page}
        totalItems={anomalies.length}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(sz) => {
          setPageSize(sz);
          setPage(1);
        }}
        pageSizeOptions={[4, 8, 12]}
        itemName="detected anomalies"
      />

      {/* Phase 47 Maximized Full-View Modal */}
      {isMaximized && (
        <MaximizedViewModal
          isOpen={isMaximized}
          onClose={() => setIsMaximized(false)}
          title="Regulatory Anomaly Detection Feed — Full Inspection View"
          badge="Supervisory Surveillance"
          subtitle={`Complete surveillance feed of ${anomalies.length} suspicious regulatory return patterns across Oromia Bank departments`}
          icon={Activity}
        >
          <div className="space-y-4">
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
              {renderAnomalyList(anomalies)}
            </div>
          </div>
        </MaximizedViewModal>
      )}
    </div>
  );
};
