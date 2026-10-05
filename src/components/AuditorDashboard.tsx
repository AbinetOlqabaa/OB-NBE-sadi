/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert,
  ClipboardCheck,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  FileCheck,
  Upload,
  Download,
  Eye,
  Lock,
  ArrowRight,
  RefreshCw,
  Plus,
  BookOpen,
  Calendar,
  Building2,
  User,
  History,
  Check,
  X,
  FileSpreadsheet,
  Layers,
  ChevronRight,
  ShieldCheck,
  AlertOctagon,
  Sparkles,
  ExternalLink,
  TrendingUp,
  Activity,
  BarChart3,
  CheckSquare,
  Square,
} from 'lucide-react';
import type {
  UserSession,
  AuditFinding,
  AuditFindingSeverity,
  AuditFindingStatus,
  AuditEvidence,
  AuditWorkingNote,
  RemediationAction,
  AuditReportPackage,
  AuditWorkQueueItem,
  SubmissionStatus,
  AuditorExportFormat,
  AuditorExportScope,
} from '../types/regulatory.ts';
import { auditorService } from '../services/auditorService.ts';
import { submissionService } from '../services/submissionService.ts';
import { DEPARTMENTS } from '../data/organizationHierarchy.ts';
import { getAllReports, getReportDefinition } from '../data/report-registry.ts';
import { vibrate, haptics } from '../utils/haptics.ts';
import { Pagination } from './Pagination.tsx';
import { MaximizedViewModal } from './MaximizedViewModal.tsx';
import { MaximizeButton } from './MaximizeButton.tsx';
import { HistoricalSubmissionTrendChart } from './HistoricalSubmissionTrendChart.tsx';
import { AnomalyDetectionFeed } from './AnomalyDetectionFeed.tsx';
import { AuditorSupervisoryAnalytics } from './AuditorSupervisoryAnalytics.tsx';
import { triggerAuditorMultiFormatExport } from '../utils/auditorMultiFormatExport.ts';

type AuditorTab =
  | 'WORK_QUEUE'
  | 'REPORT_AUDIT'
  | 'HISTORICAL_TRENDS'
  | 'TIMELINE'
  | 'FINDINGS'
  | 'EVIDENCE'
  | 'NOTES'
  | 'REMEDIATION'
  | 'REPORTS';

interface AuditorDashboardProps {
  currentUser: UserSession;
  onNavigateToReport?: (reportKey: string) => void;
}

export const AuditorDashboard: React.FC<AuditorDashboardProps> = ({
  currentUser,
  onNavigateToReport,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<AuditorTab>('WORK_QUEUE');
  const [selectedReportKey, setSelectedReportKey] = useState<string>('ANARN001');
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string>('');

  // Filters for work queue
  const [deptFilter, setDeptFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Pagination states
  const [workQueuePage, setWorkQueuePage] = useState<number>(1);
  const [workQueuePageSize, setWorkQueuePageSize] = useState<number>(8);

  const [findingPage, setFindingPage] = useState<number>(1);
  const [findingPageSize, setFindingPageSize] = useState<number>(8);

  const [evidencePage, setEvidencePage] = useState<number>(1);
  const [evidencePageSize, setEvidencePageSize] = useState<number>(8);

  const [notePage, setNotePage] = useState<number>(1);
  const [notePageSize, setNotePageSize] = useState<number>(6);

  const [remediationPage, setRemediationPage] = useState<number>(1);
  const [remediationPageSize, setRemediationPageSize] = useState<number>(6);

  const [reportPackagePage, setReportPackagePage] = useState<number>(1);
  const [reportPackagePageSize, setReportPackagePageSize] = useState<number>(6);

  // Timeline filter state
  const [timelineFilter, setTimelineFilter] = useState<'ALL' | 'MAKER' | 'CHECKER' | 'NBE'>('ALL');
  const [isQueueMaximized, setIsQueueMaximized] = useState<boolean>(false);
  const [isFindingsMaximized, setIsFindingsMaximized] = useState<boolean>(false);

  // Findings state
  const [findingSeverityFilter, setFindingSeverityFilter] = useState<string>('');
  const [findingStatusFilter, setFindingStatusFilter] = useState<string>('');
  const [isFindingModalOpen, setIsFindingModalOpen] = useState<boolean>(false);
  const [newFindingTitle, setNewFindingTitle] = useState<string>('');
  const [newFindingDesc, setNewFindingDesc] = useState<string>('');
  const [newFindingSeverity, setNewFindingSeverity] = useState<AuditFindingSeverity>('MEDIUM');
  const [newFindingCircular, setNewFindingCircular] = useState<string>('NBE Directive BSD/03/2020');
  const [newFindingField, setNewFindingField] = useState<string>('');
  const [newFindingVariance, setNewFindingVariance] = useState<string>('');

  // Evidence state
  const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState<boolean>(false);
  const [evidenceTitle, setEvidenceTitle] = useState<string>('');
  const [evidenceFileName, setEvidenceFileName] = useState<string>('');
  const [evidenceNotes, setEvidenceNotes] = useState<string>('');

  // Working Note state
  const [isNoteModalOpen, setIsNoteModalOpen] = useState<boolean>(false);
  const [noteCategory, setNoteCategory] = useState<'OBSERVATION' | 'METHODOLOGY' | 'RISK_NOTE' | 'INQUIRY'>('OBSERVATION');
  const [noteContent, setNoteContent] = useState<string>('');

  // Remediation state
  const [isRemediationModalOpen, setIsRemediationModalOpen] = useState<boolean>(false);
  const [remFindingId, setRemFindingId] = useState<string>('');
  const [remActionPlan, setRemActionPlan] = useState<string>('');
  const [remDept, setRemDept] = useState<string>('');
  const [remAssignee, setRemAssignee] = useState<string>('');
  const [remTargetDate, setRemTargetDate] = useState<string>('2026-03-31');

  // Trigger re-render on data change
  const [version, setVersion] = useState(0);

  // Phase 49: Multi-format Single & Bulk Export state
  const [selectedQueueKeys, setSelectedQueueKeys] = useState<string[]>([]);
  const [bulkExportFormat, setBulkExportFormat] = useState<AuditorExportFormat>('XLSX');
  const [bulkExportScope, setBulkExportScope] = useState<AuditorExportScope>('FULL_AUDIT_DOSSIER');
  const [exportStatusBanner, setExportStatusBanner] = useState<string | null>(null);

  useEffect(() => {
    const unsub = auditorService.subscribe(() => {
      setVersion((v) => v + 1);
    });
    const unsubSub = submissionService.onSubmissionsUpdated(() => {
      setVersion((v) => v + 1);
    });
    return () => {
      unsub();
      unsubSub();
    };
  }, []);

  // Data queries
  const workQueue = useMemo(() => {
    return auditorService.getWorkQueue({
      department: deptFilter || undefined,
      submissionStatus: statusFilter || undefined,
      search: searchQuery || undefined,
    });
  }, [deptFilter, statusFilter, searchQuery, version]);

  const kpis = useMemo(() => {
    return auditorService.getKpiSummary();
  }, [version]);

  const perfMetrics = useMemo(() => {
    return auditorService.getPerformanceOverviewMetrics();
  }, [version]);

  const findings = useMemo(() => {
    return auditorService.getFindings({
      severity: (findingSeverityFilter as AuditFindingSeverity) || undefined,
      status: (findingStatusFilter as AuditFindingStatus) || undefined,
    });
  }, [findingSeverityFilter, findingStatusFilter, version]);

  const evidences = useMemo(() => {
    return auditorService.getEvidence();
  }, [version]);

  const workingNotes = useMemo(() => {
    return auditorService.getWorkingNotes();
  }, [version]);

  const remediations = useMemo(() => {
    return auditorService.getRemediations();
  }, [version]);

  const reportPackages = useMemo(() => {
    return auditorService.getReportPackages();
  }, [version]);

  // Paginated Slices
  const paginatedWorkQueue = useMemo(() => {
    const start = (workQueuePage - 1) * workQueuePageSize;
    return workQueue.slice(start, start + workQueuePageSize);
  }, [workQueue, workQueuePage, workQueuePageSize]);

  const paginatedFindings = useMemo(() => {
    const start = (findingPage - 1) * findingPageSize;
    return findings.slice(start, start + findingPageSize);
  }, [findings, findingPage, findingPageSize]);

  const paginatedEvidences = useMemo(() => {
    const start = (evidencePage - 1) * evidencePageSize;
    return evidences.slice(start, start + evidencePageSize);
  }, [evidences, evidencePage, evidencePageSize]);

  const paginatedNotes = useMemo(() => {
    const start = (notePage - 1) * notePageSize;
    return workingNotes.slice(start, start + notePageSize);
  }, [workingNotes, notePage, notePageSize]);

  const paginatedRemediations = useMemo(() => {
    const start = (remediationPage - 1) * remediationPageSize;
    return remediations.slice(start, start + remediationPageSize);
  }, [remediations, remediationPage, remediationPageSize]);

  const paginatedReportPackages = useMemo(() => {
    const start = (reportPackagePage - 1) * reportPackagePageSize;
    return reportPackages.slice(start, start + reportPackagePageSize);
  }, [reportPackages, reportPackagePage, reportPackagePageSize]);

  // Selected report deep inspection data
  const currentInspection = useMemo(() => {
    return auditorService.getReportAuditInspection(selectedReportKey, selectedSubmissionId || undefined);
  }, [selectedReportKey, selectedSubmissionId, version]);

  const handleSelectReportForAudit = (reportKey: string, submissionId?: string) => {
    setSelectedReportKey(reportKey);
    setSelectedSubmissionId(submissionId || '');
    setActiveSubTab('REPORT_AUDIT');
    vibrate(25);
  };

  const handleCreateFinding = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFindingTitle.trim()) return;

    auditorService.createFinding({
      submissionId: selectedSubmissionId || `sub_${selectedReportKey}`,
      reportKey: selectedReportKey,
      department: currentInspection.reportDefinition?.department || (currentInspection.reportDefinition as any)?.Department || 'Credit Operations & Portfolio Management',
      title: newFindingTitle.trim(),
      description: newFindingDesc.trim(),
      severity: newFindingSeverity,
      status: 'OPEN',
      regulatoryReference: newFindingCircular.trim(),
      affectedField: newFindingField.trim() || undefined,
      financialVariance: newFindingVariance ? parseFloat(newFindingVariance) : undefined,
      auditorId: currentUser.id,
      auditorName: currentUser.name,
    });

    setNewFindingTitle('');
    setNewFindingDesc('');
    setNewFindingField('');
    setNewFindingVariance('');
    setIsFindingModalOpen(false);
    haptics.success();
  };

  const handleAttachEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evidenceTitle.trim()) return;

    const fakeHash = 'hash_' + Math.random().toString(36).substring(2, 18) + Math.random().toString(36).substring(2, 18);
    await auditorService.attachEvidence({
      submissionId: selectedSubmissionId || `sub_${selectedReportKey}`,
      reportKey: selectedReportKey,
      title: evidenceTitle.trim(),
      fileName: evidenceFileName.trim() || `${selectedReportKey}_evidence.pdf`,
      fileType: 'application/pdf',
      fileSizeBytes: Math.floor(45000 + Math.random() * 95000),
      sha256Checksum: fakeHash,
      verificationStatus: 'VERIFIED',
      uploadedBy: `${currentUser.name} (AUDITOR)`,
      notes: evidenceNotes.trim(),
    });

    setEvidenceTitle('');
    setEvidenceFileName('');
    setEvidenceNotes('');
    setIsEvidenceModalOpen(false);
    haptics.success();
  };

  const handleAddWorkingNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) return;

    auditorService.addWorkingNote({
      submissionId: selectedSubmissionId || `sub_${selectedReportKey}`,
      reportKey: selectedReportKey,
      category: noteCategory,
      authorId: currentUser.id,
      authorName: currentUser.name,
      content: noteContent.trim(),
      isPrivate: true,
    });

    setNoteContent('');
    setIsNoteModalOpen(false);
    haptics.success();
  };

  const handleCreateRemediation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!remActionPlan.trim()) return;

    auditorService.createRemediation({
      findingId: remFindingId || (findings[0]?.id ?? 'FIND-GENERAL'),
      actionPlan: remActionPlan.trim(),
      assignedDepartment: remDept || currentInspection.reportDefinition?.department || (currentInspection.reportDefinition as any)?.Department || 'Credit Operations',
      assignedTo: remAssignee.trim() || 'Assigned Maker',
      targetDate: remTargetDate,
      status: 'PENDING',
    });

    setRemActionPlan('');
    setRemAssignee('');
    setIsRemediationModalOpen(false);
    haptics.success();
  };

  const handleGenerateAuditMemo = () => {
    auditorService.generateAuditReport({
      period: 'Q1 2026',
      scopeDepartments: DEPARTMENTS.map((d) => d.name),
      generatedBy: currentUser.name,
    });
    haptics.success();
  };

  const handleDownloadReportJson = (pkg: AuditReportPackage) => {
    const jsonStr = auditorService.exportAuditReportJson(pkg);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pkg.id}_compliance_pack.json`;
    a.click();
    URL.revokeObjectURL(url);
    haptics.success();
  };

  const toggleSelectQueueItem = (reportKey: string) => {
    vibrate(15);
    setSelectedQueueKeys((prev) =>
      prev.includes(reportKey) ? prev.filter((k) => k !== reportKey) : [...prev, reportKey]
    );
  };

  const toggleSelectAllQueue = () => {
    vibrate(20);
    if (selectedQueueKeys.length === workQueue.length && workQueue.length > 0) {
      setSelectedQueueKeys([]);
    } else {
      setSelectedQueueKeys(workQueue.map((q) => q.reportKey));
    }
  };

  const handleTriggerExport = (
    format: AuditorExportFormat,
    scope: AuditorExportScope,
    mode: 'SINGLE' | 'BULK',
    selectedIds?: string[]
  ) => {
    const res = triggerAuditorMultiFormatExport({
      format,
      scope,
      mode,
      selectedIds,
      actorName: currentUser.name,
    });
    haptics.success();
    setExportStatusBanner(
      `${mode} Export Complete: ${res.fileName} (${res.recordCount} records, Seal: ${res.tamperSeal})`
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white transition-colors duration-200">
      {/* Top Banner: Supervisory Status & Clearance */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-center gap-1.5 shadow-2xs">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                <span>FIRST-CLASS AUDITOR DESK</span>
              </span>
              <span className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-mono">
                OROMIA BANK S.C.
              </span>
              <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Abinet Alemu Segregation: Strictly Barred from Maker & Checker Privileges
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              NBE Regulatory Compliance Audit & Assurance Console
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              National Bank of Ethiopia Directive BSD/03/2020 Compliance Inspection & Assurance Framework
            </p>
          </div>

          <div className="flex items-center gap-2 self-start lg:self-center">
            <button
              type="button"
              onClick={handleGenerateAuditMemo}
              className="min-h-[44px] px-3.5 py-2 bg-ob-indigo-600 hover:bg-ob-indigo-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer touch-manipulation"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Compile Audit Memo</span>
            </button>
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold text-slate-900 dark:text-white">{currentUser.name}</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">ROLE: COMPLIANCE AUDITOR</div>
            </div>
          </div>
        </div>

        {/* Phase 48: Performance Overview Summary Metric Cards Row */}
        <div
          id="auditor-performance-summary-cards"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800"
        >
          <div className="p-3.5 bg-gradient-to-br from-slate-50 to-white dark:from-slate-800/90 dark:to-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-2xs flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Total Submissions
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-0.5 font-mono">
                {perfMetrics.totalSubmissions}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {perfMetrics.sentToNbeCount} Delivered to NBE • {perfMetrics.pendingCheckerCount} in 4-Eyes
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-ob-indigo-50 dark:bg-ob-indigo-950/60 text-ob-indigo-600 dark:text-ob-indigo-400 border border-ob-indigo-200 dark:border-ob-indigo-800 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
          </div>

          <div className="p-3.5 bg-gradient-to-br from-amber-50/70 to-white dark:from-amber-950/30 dark:to-slate-900 rounded-2xl border border-amber-200/80 dark:border-amber-800/60 shadow-2xs flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                Pending Corrections
              </div>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-0.5 font-mono">
                {perfMetrics.pendingCorrections}
              </div>
              <div className="text-[11px] text-amber-600/80 dark:text-amber-400/80 mt-0.5">
                Active Rectifications & Remediations
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-100/80 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-800 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>

          <div className="p-3.5 bg-gradient-to-br from-emerald-50/70 to-white dark:from-emerald-950/30 dark:to-slate-900 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/60 shadow-2xs flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                Approved Today
              </div>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5 font-mono">
                {perfMetrics.approvedToday}
              </div>
              <div className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">
                4-Eyes Verified & Authorized Returns
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-100/80 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="p-3.5 bg-gradient-to-br from-blue-50/70 to-white dark:from-blue-950/30 dark:to-slate-900 rounded-2xl border border-blue-200/80 dark:border-blue-800/60 shadow-2xs flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                Avg. Processing Time
              </div>
              <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-0.5 font-mono">
                {perfMetrics.avgProcessingTimeFormatted}
              </div>
              <div className="text-[11px] text-blue-600/80 dark:text-blue-400/80 mt-0.5">
                {perfMetrics.slaComplianceRate}% Within NBE Turnaround SLA
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-100/80 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-800 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Phase 49: Multi-Format Single & Bulk Export Command Ribbon */}
        <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/70 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded bg-ob-indigo-100 text-ob-indigo-800 dark:bg-ob-indigo-950 dark:text-ob-indigo-300 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
              <Download className="w-3 h-3" />
              <span>MULTI-FORMAT AUDIT EXPORT HUB</span>
            </span>
            <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
              Export Single or Bulk Audit Datasets (CSV, XLSX, PDF, JSON, XML) with Cryptographic Tamper Seals
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={bulkExportScope}
              onChange={(e) => setBulkExportScope(e.target.value as AuditorExportScope)}
              aria-label="Select Audit Export Scope"
              className="min-h-[38px] px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 font-semibold cursor-pointer"
            >
              <option value="FULL_AUDIT_DOSSIER">Complete Audit Dossier Bundle (Bulk)</option>
              <option value="WORK_QUEUE">
                Audit Work Queue ({selectedQueueKeys.length > 0 ? `${selectedQueueKeys.length} Selected` : 'All'})
              </option>
              <option value="ANOMALY_FEED">Anomaly Detection Feed</option>
              <option value="FINDINGS">Audit Findings & Exceptions</option>
              <option value="PERFORMANCE_KPIS">Performance Metrics & Dept SLA</option>
              <option value="EVIDENCE_VAULT">Cryptographic Evidence Vault</option>
              <option value="REMEDIATIONS">Remediation Action Tracker</option>
            </select>

            <select
              value={bulkExportFormat}
              onChange={(e) => setBulkExportFormat(e.target.value as AuditorExportFormat)}
              aria-label="Select Audit Export Format"
              className="min-h-[38px] px-2.5 py-1.5 text-xs font-mono font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 cursor-pointer"
            >
              <option value="XLSX">XLSX (Excel Workbook)</option>
              <option value="PDF">PDF (Signed Dossier)</option>
              <option value="CSV">CSV (Regulatory Flat-File)</option>
              <option value="JSON">JSON (Cryptographic Bundle)</option>
              <option value="XML">XML (NBE Supervisory XSD)</option>
            </select>

            <button
              type="button"
              onClick={() =>
                handleTriggerExport(
                  bulkExportFormat,
                  bulkExportScope,
                  selectedQueueKeys.length === 1 && bulkExportScope === 'WORK_QUEUE' ? 'SINGLE' : 'BULK',
                  bulkExportScope === 'WORK_QUEUE' && selectedQueueKeys.length > 0
                    ? selectedQueueKeys
                    : undefined
                )
              }
              className="min-h-[38px] px-3.5 py-1.5 bg-ob-indigo-600 hover:bg-ob-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download {bulkExportFormat}</span>
            </button>
          </div>
        </div>

        {exportStatusBanner && (
          <div className="mt-2 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 flex items-center justify-between gap-2">
            <span className="font-mono font-semibold">{exportStatusBanner}</span>
            <button
              type="button"
              onClick={() => setExportStatusBanner(null)}
              className="text-emerald-600 hover:text-emerald-800 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Auditor KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-800">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Reports in Queue</div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5">
              {kpis.totalReportsInQueue}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Across 8 Departments</div>
          </div>

          <div className="p-3 bg-rose-50/60 dark:bg-rose-950/20 rounded-xl border border-rose-200/70 dark:border-rose-900/40">
            <div className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Critical Findings
            </div>
            <div className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 mt-0.5">
              {kpis.criticalFindings}
            </div>
            <div className="text-[10px] text-rose-500/80 mt-0.5">High Regulatory Risk</div>
          </div>

          <div className="p-3 bg-amber-50/60 dark:bg-amber-950/20 rounded-xl border border-amber-200/70 dark:border-amber-900/40">
            <div className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
              Total Open Findings
            </div>
            <div className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 mt-0.5">
              {kpis.totalOpenFindings}
            </div>
            <div className="text-[10px] text-amber-500/80 mt-0.5">{kpis.highFindings} High Severity</div>
          </div>

          <div className="p-3 bg-blue-50/60 dark:bg-blue-950/20 rounded-xl border border-blue-200/70 dark:border-blue-900/40">
            <div className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
              Pending Remediations
            </div>
            <div className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400 mt-0.5">
              {kpis.pendingRemediations}
            </div>
            <div className="text-[10px] text-blue-500/80 mt-0.5">Assigned to Makers</div>
          </div>

          <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl border border-emerald-200/70 dark:border-emerald-900/40">
            <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
              Cleared Submissions
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
              {kpis.completedAudits}
            </div>
            <div className="text-[10px] text-emerald-500/80 mt-0.5">Zero Open Issues</div>
          </div>

          <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/20 rounded-xl border border-indigo-200/70 dark:border-indigo-900/40">
            <div className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
              Compliance Score
            </div>
            <div className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
              {kpis.complianceScore}%
            </div>
            <div className="text-[10px] text-indigo-500/80 mt-0.5">BSD Weighted Formula</div>
          </div>
        </div>

        {/* Compliance Notification & Alert Banner */}
        {kpis.criticalFindings > 0 && (
          <div className="mt-3 p-3.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-rose-900 dark:text-rose-200 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <AlertOctagon className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
              <div>
                <span className="font-bold">Supervisory Alert:</span>{' '}
                <span>
                  {kpis.criticalFindings} Critical Severity finding(s) require active remediation under NBE Directive BSD/03/2020.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setFindingSeverityFilter('CRITICAL');
                setActiveSubTab('FINDINGS');
              }}
              className="min-h-[36px] px-3.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold shrink-0 cursor-pointer touch-press"
            >
              Review Critical Findings
            </button>
          </div>
        )}

        {/* Tab Navigation Pill Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto touch-scroll-x mt-4 pt-1 no-scrollbar">
          {[
            { id: 'WORK_QUEUE', label: 'Audit Work Queue', count: workQueue.length, icon: ClipboardCheck },
            { id: 'REPORT_AUDIT', label: 'Report Inspection', count: null, icon: Eye },
            { id: 'HISTORICAL_TRENDS', label: '12M Historical Trends', count: null, icon: TrendingUp },
            { id: 'TIMELINE', label: 'Workflow Timeline', count: null, icon: History },
            { id: 'FINDINGS', label: 'Audit Findings', count: findings.length, icon: AlertTriangle },
            { id: 'EVIDENCE', label: 'Evidence Vault', count: evidences.length, icon: Upload },
            { id: 'NOTES', label: 'Working Papers', count: workingNotes.length, icon: BookOpen },
            { id: 'REMEDIATION', label: 'Remediation Tracker', count: remediations.length, icon: CheckCircle2 },
            { id: 'REPORTS', label: 'Audit Reports', count: reportPackages.length, icon: FileSpreadsheet },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveSubTab(tab.id as AuditorTab);
                  vibrate(15);
                }}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer touch-manipulation ${
                  isActive
                    ? 'bg-ob-indigo-600 text-white shadow-md'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.count !== null && (
                  <span
                    className={`px-1.5 py-0.2 rounded-md font-mono font-bold text-[10px] ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        {/* SUB-VIEW 1: AUDIT WORK QUEUE */}
        {activeSubTab === 'WORK_QUEUE' && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by report code, title, department, maker, or NBE ref..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setWorkQueuePage(1);
                  }}
                  className="w-full min-h-[44px] pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-ob-indigo-500 font-medium"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={deptFilter}
                  onChange={(e) => {
                    setDeptFilter(e.target.value);
                    setWorkQueuePage(1);
                  }}
                  className="min-h-[44px] px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 font-medium cursor-pointer"
                >
                  <option value="">All Departments (8)</option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d.name} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setWorkQueuePage(1);
                  }}
                  className="min-h-[44px] px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 font-medium cursor-pointer"
                >
                  <option value="">All Submission States</option>
                  <option value="SENT">Delivered to NBE (SENT)</option>
                  <option value="APPROVED">Checker Approved</option>
                  <option value="PENDING_CHECKER">Pending 4-Eyes Review</option>
                  <option value="CORRECTION_REQUIRED">Correction Requested</option>
                  <option value="DRAFT">Maker Drafting</option>
                </select>

                {(deptFilter || statusFilter || searchQuery) && (
                  <button
                    type="button"
                    onClick={() => {
                      setDeptFilter('');
                      setStatusFilter('');
                      setSearchQuery('');
                      setWorkQueuePage(1);
                    }}
                    className="min-h-[44px] px-3 py-2 text-xs text-rose-600 dark:text-rose-400 hover:underline font-semibold cursor-pointer"
                  >
                    Reset
                  </button>
                )}

                <MaximizeButton
                  onClick={() => setIsQueueMaximized(true)}
                  title="Maximize Audit Work Queue (Esc to restore)"
                />
              </div>
            </div>

            {/* Queue Table */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto min-w-full touch-scroll-x">
                <table className="min-w-[750px] w-full divide-y divide-slate-200 dark:divide-slate-800 text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-3 w-9">
                        <button
                          type="button"
                          onClick={toggleSelectAllQueue}
                          aria-label="Select all returns in queue"
                          className="p-1 rounded text-slate-500 hover:text-ob-indigo-600 cursor-pointer"
                        >
                          {selectedQueueKeys.length === workQueue.length && workQueue.length > 0 ? (
                            <CheckSquare className="w-4 h-4 text-ob-indigo-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </th>
                      <th className="py-3 px-4">Statutory Return</th>
                      <th className="py-3 px-4">Department & Maker</th>
                      <th className="py-3 px-4">Workflow Status</th>
                      <th className="py-3 px-4">Audit Assessment</th>
                      <th className="py-3 px-4 text-center">Findings</th>
                      <th className="py-3 px-4 text-center">Evidence</th>
                      <th className="py-3 px-4 text-center">Remediations</th>
                      <th className="py-3 px-4 text-right">Actions & Single Export</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {workQueue.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-slate-400">
                          No regulatory returns match your filter criteria.
                        </td>
                      </tr>
                    ) : (
                      paginatedWorkQueue.map((item) => (
                        <tr
                          key={item.reportKey}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                        >
                          <td className="py-3 px-3">
                            <button
                              type="button"
                              onClick={() => toggleSelectQueueItem(item.reportKey)}
                              aria-label={`Select return ${item.reportKey}`}
                              className="p-1 rounded text-slate-400 hover:text-ob-indigo-600 cursor-pointer"
                            >
                              {selectedQueueKeys.includes(item.reportKey) ? (
                                <CheckSquare className="w-4 h-4 text-ob-indigo-600" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-mono font-bold text-slate-900 dark:text-white">
                              {item.reportKey}
                            </div>
                            <div className="text-[11px] text-slate-500 max-w-[200px] truncate">
                              {getReportDefinition(item.reportKey)?.Title || 'Regulatory Return'}
                            </div>
                            {item.nbeReference && (
                              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                                Ref: {item.nbeReference}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-medium text-slate-800 dark:text-slate-200 max-w-[180px] truncate">
                              {item.department}
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <User className="w-3 h-3" />
                              <span>{item.makerName} (v{item.version})</span>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                item.submissionStatus === 'SENT'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : item.submissionStatus === 'APPROVED'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                  : item.submissionStatus === 'PENDING_CHECKER'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                  : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                              }`}
                            >
                              {item.submissionStatus}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 w-fit ${
                                item.auditStatus === 'FLAGGED_HIGH_RISK'
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                  : item.auditStatus === 'FINDINGS_OPEN'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              }`}
                            >
                              {item.auditStatus === 'FLAGGED_HIGH_RISK' && <AlertTriangle className="w-3 h-3 text-rose-600" />}
                              {item.auditStatus === 'FINDINGS_OPEN' && <AlertOctagon className="w-3 h-3 text-amber-600" />}
                              {item.auditStatus.replace(/_/g, ' ')}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-center font-mono">
                            {item.totalFindings > 0 ? (
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                  item.criticalFindings > 0
                                    ? 'bg-rose-600 text-white'
                                    : 'bg-amber-600 text-white'
                                }`}
                              >
                                {item.openFindings} / {item.totalFindings}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-center font-mono text-slate-700 dark:text-slate-300">
                            {item.evidenceCount > 0 ? (
                              <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px] font-bold">
                                {item.evidenceCount}
                              </span>
                            ) : (
                              <span className="text-slate-400">0</span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-center font-mono text-slate-700 dark:text-slate-300">
                            {item.pendingRemediations > 0 ? (
                              <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 text-[11px] font-bold">
                                {item.pendingRemediations}
                              </span>
                            ) : (
                              <span className="text-slate-400">0</span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  handleTriggerExport('PDF', 'WORK_QUEUE', 'SINGLE', [item.reportKey])
                                }
                                className="min-h-[34px] px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-mono font-bold rounded-lg cursor-pointer"
                                title={`Single PDF export for ${item.reportKey}`}
                              >
                                PDF
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleTriggerExport('XLSX', 'WORK_QUEUE', 'SINGLE', [item.reportKey])
                                }
                                className="min-h-[34px] px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-mono font-bold rounded-lg cursor-pointer"
                                title={`Single XLSX export for ${item.reportKey}`}
                              >
                                XLSX
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSelectReportForAudit(item.reportKey, item.submissionId)}
                                className="min-h-[38px] px-3 py-1.5 bg-ob-indigo-600 hover:bg-ob-indigo-700 text-white text-xs font-bold rounded-lg inline-flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Inspect</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Work Queue Pagination */}
              <Pagination
                currentPage={workQueuePage}
                totalItems={workQueue.length}
                pageSize={workQueuePageSize}
                onPageChange={setWorkQueuePage}
                onPageSizeChange={setWorkQueuePageSize}
                pageSizeOptions={[8, 16, 24]}
                itemName="statutory returns"
              />
            </div>

            {/* Phase 48: Supervisory Visualizations & Anomaly Detection Feed below Queue & Charts */}
            <AuditorSupervisoryAnalytics currentUser={currentUser} />
            <AnomalyDetectionFeed
              currentUser={currentUser}
              onInspectReturn={(rk, subId) => handleSelectReportForAudit(rk, subId)}
              onAnomalyConverted={() => setVersion((v) => v + 1)}
            />
          </div>
        )}

        {/* SUB-VIEW 2: REPORT AUDIT DEEP INSPECTION */}
        {activeSubTab === 'REPORT_AUDIT' && (
          <div className="space-y-4">
            {/* Header info bar */}
            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono font-bold text-xs">
                    {currentInspection.reportKey}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 text-[10px] font-bold flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    READ-ONLY AUDIT LOCK
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    {currentInspection.reportDefinition?.Frequency} Return
                  </span>
                </div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white mt-1">
                  {currentInspection.reportDefinition?.Title || currentInspection.reportKey}
                </h2>
                <div className="text-xs text-slate-500">
                  Department: {currentInspection.reportDefinition?.department || (currentInspection.reportDefinition as any)?.Department}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setIsFindingModalOpen(true)}
                  className="min-h-[44px] px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>File Audit Finding</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsEvidenceModalOpen(true)}
                  className="min-h-[44px] px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white dark:bg-slate-700 dark:hover:bg-slate-600 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>Attach Evidence</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsNoteModalOpen(true)}
                  className="min-h-[44px] px-3.5 py-2 bg-ob-indigo-600 hover:bg-ob-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Add Working Note</span>
                </button>
              </div>
            </div>

            {/* Read-Only Form Line Items Grid */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    Statutory Field Values & Calculated Aggregates
                  </h3>
                  <p className="text-xs text-slate-500">
                    Inspecting values submitted by Maker with automated AST formula validation.
                  </p>
                </div>
                <div className="text-xs font-mono text-slate-400">
                  {currentInspection.reportDefinition?.ReturnItemsList.length || 0} Statutory Fields
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {currentInspection.reportDefinition?.ReturnItemsList.map((field) => {
                  const val = (currentInspection.values as Record<string, any>)?.[field.Code];
                  return (
                    <div
                      key={field.Code}
                      className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-mono font-bold text-ob-indigo-600 dark:text-ob-indigo-400">
                          {field.Code}
                        </span>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold">
                          {field._dataType}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-300 font-medium truncate" title={field._description}>
                        {field._description}
                      </div>
                      <div className="font-mono font-bold text-slate-900 dark:text-white text-sm bg-white dark:bg-slate-950 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                        {typeof val === 'number' ? val.toLocaleString() : (val ?? '-')}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Dynamic Repeatable Schedule Areas if any */}
              {currentInspection.reportDefinition?.DynamicItemsList && currentInspection.reportDefinition.DynamicItemsList.length > 0 && (
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-2">
                    Dynamic Repeatable Schedules ({currentInspection.reportDefinition.DynamicItemsList.length} Areas)
                  </h4>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl text-xs text-slate-600 dark:text-slate-300">
                    Schedules inspected against core banking sub-ledger exports. Zero missing required rows.
                  </div>
                </div>
              )}
            </div>

            {/* 12-Month Historical Value Trend Line Chart (Embedded in Inspection) */}
            <HistoricalSubmissionTrendChart
              currentUser={currentUser}
              initialReportKey={selectedReportKey}
              onSelectReportKey={(rk) => setSelectedReportKey(rk)}
            />

            {/* Phase 48: Anomaly Detection Feed below the charts */}
            <AnomalyDetectionFeed
              currentUser={currentUser}
              reportKeyFilter={selectedReportKey}
              onInspectReturn={(rk, subId) => handleSelectReportForAudit(rk, subId)}
              onAnomalyConverted={() => setVersion((v) => v + 1)}
            />
          </div>
        )}

        {/* SUB-VIEW: 12-MONTH HISTORICAL VALUE TRENDS */}
        {activeSubTab === 'HISTORICAL_TRENDS' && (
          <div className="space-y-4">
            <HistoricalSubmissionTrendChart
              currentUser={currentUser}
              initialReportKey={selectedReportKey}
              onSelectReportKey={(rk) => setSelectedReportKey(rk)}
            />
            <AuditorSupervisoryAnalytics currentUser={currentUser} />
            <AnomalyDetectionFeed
              currentUser={currentUser}
              reportKeyFilter={selectedReportKey}
              onInspectReturn={(rk, subId) => handleSelectReportForAudit(rk, subId)}
              onAnomalyConverted={() => setVersion((v) => v + 1)}
            />
          </div>
        )}

        {/* SUB-VIEW 3: WORKFLOW TIMELINE & SUBMISSION AUDIT */}
        {activeSubTab === 'TIMELINE' && (
          <div className="space-y-4">
            {/* Return Selector & Context Ribbon */}
            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex-1 w-full md:w-auto">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Select Return to Audit Timeline & Activity History
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={selectedReportKey}
                    onChange={(e) => {
                      setSelectedReportKey(e.target.value);
                      setSelectedSubmissionId('');
                    }}
                    className="min-h-[44px] px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white cursor-pointer"
                  >
                    {getAllReports().map((r) => (
                      <option key={r.ReturnKey} value={r.ReturnKey}>
                        {r.ReturnKey} — {r.Title}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-ob-indigo-50 dark:bg-ob-indigo-950/60 text-ob-indigo-700 dark:text-ob-indigo-300 border border-ob-indigo-200 dark:border-ob-indigo-800">
                    Status: {currentInspection.submission?.status || 'DRAFT'}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    v{currentInspection.submission?.version || 1}
                  </span>
                </div>
              </div>

              {/* Lifecycle Stage Filters */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { id: 'ALL', label: 'All Lifecycle Events' },
                  { id: 'MAKER', label: 'Maker Activity' },
                  { id: 'CHECKER', label: 'Checker Review' },
                  { id: 'NBE', label: 'NBE Gateway' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setTimelineFilter(f.id as any)}
                    className={`min-h-[36px] px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer touch-press ${
                      timelineFilter === f.id
                        ? 'bg-ob-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Timeline Cards Container */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-6 space-y-6">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <span>{selectedReportKey} Statutory Audit Trail & Activity Lifecycle</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Chronological event verification chain from initial Maker data intake to Central Bank cryptographic receipt.
                </p>
              </div>

              <div className="relative pl-6 space-y-8 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
                {/* Event 1: Maker Creation */}
                {(timelineFilter === 'ALL' || timelineFilter === 'MAKER') && (
                  <div className="relative">
                    <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold">
                      ✓
                    </div>
                    <div className="space-y-1.5">
                      <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                        <span>1. Statutory Return Initialized by Maker</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {currentInspection.submission?.submittedAt
                            ? new Date(currentInspection.submission.submittedAt).toLocaleDateString()
                            : '2026-01-16 09:30 UTC'}
                        </span>
                        <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-400">
                          Maker: {currentInspection.submission?.makerName || 'Assigned Maker'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        Maker initialized draft return for {selectedReportKey} ({currentInspection.reportDefinition?.Title}) using official NBE supervisory schema v2026.
                      </p>
                      <div className="text-[11px] text-slate-500 bg-slate-50 dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 font-mono">
                        Department: {currentInspection.reportDefinition?.department || 'Credit Operations & Portfolio Management'} • Frequency: {currentInspection.reportDefinition?.Frequency} • Version: 1
                      </div>
                    </div>
                  </div>
                )}

                {/* Event 2: Line Items & AST Math Recalculation */}
                {(timelineFilter === 'ALL' || timelineFilter === 'MAKER') && (
                  <div className="relative">
                    <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-bold">
                      2
                    </div>
                    <div className="space-y-1.5">
                      <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                        <span>2. Draft Values Updated & AST Formula Recalculation</span>
                        <span className="text-[10px] text-slate-400 font-mono">2026-01-18 14:15 UTC</span>
                        <span className="px-1.5 py-0.2 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[10px] font-bold">
                          AST Math Verified
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        Automated AST calculation engine verified all mathematical relationships, balancing cross-totals with zero formula errors.
                      </p>
                      <div className="text-[11px] text-slate-500 bg-slate-50 dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 font-mono">
                        Inspected Fields: {currentInspection.reportDefinition?.ReturnItemsList.length || 18} • Validation Errors: 0 • Strict BSD/03/2020 Compliance
                      </div>
                    </div>
                  </div>
                )}

                {/* Event 3: Submission to 4-Eyes Review */}
                {(timelineFilter === 'ALL' || timelineFilter === 'MAKER') && (
                  <div className="relative">
                    <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-bold">
                      3
                    </div>
                    <div className="space-y-1.5">
                      <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                        <span>3. Maker Dispatched to 4-Eyes Checker Review</span>
                        <span className="text-[10px] text-slate-400 font-mono">2026-01-20 11:45 UTC</span>
                        <span className="px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-[10px] font-bold">
                          Maker Segregation Locked
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        Submission state changed to <code className="font-bold">PENDING_CHECKER</code>. Line values locked against further modification by Maker.
                      </p>
                      <div className="text-[11px] text-slate-500 bg-slate-50 dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 font-mono">
                        Frozen Integrity Hash: {currentInspection.submission?.integrityHash || 'sha256:7f8a91c0b3d4e2...'}
                      </div>
                    </div>
                  </div>
                )}

                {/* Event 4: Checker Verification */}
                {(timelineFilter === 'ALL' || timelineFilter === 'CHECKER') && (
                  <div className="relative">
                    <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[10px] font-bold">
                      4
                    </div>
                    <div className="space-y-1.5">
                      <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                        <span>4. Checker Verification & Sign-Off</span>
                        <span className="text-[10px] text-slate-400 font-mono">2026-01-21 16:20 UTC</span>
                        <span className="px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold">
                          Checker: {currentInspection.submission?.checkerName || 'Department Checker'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        Department Checker performed line-by-line verification against general ledger schedules and signed off the 4-Eyes authorization.
                      </p>
                      <div className="text-[11px] text-slate-500 bg-slate-50 dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 font-mono">
                        Decision: APPROVED • Dual-control separation verified • Ready for NBE submission
                      </div>
                    </div>
                  </div>
                )}

                {/* Event 5: NBE Gateway Delivery */}
                {(timelineFilter === 'ALL' || timelineFilter === 'NBE') && (
                  <div className="relative">
                    <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">
                      ★
                    </div>
                    <div className="space-y-1.5">
                      <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2 flex-wrap">
                        <span>5. National Bank of Ethiopia Delivery & Gateway Receipt</span>
                        <span className="text-[10px] text-slate-400 font-mono">2026-01-22 08:30 UTC</span>
                        <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-bold">
                          HTTP 200 OK
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        Encrypted payload dispatched over TLS 1.3 / mTLS channel to National Bank of Ethiopia BSD Gateway. Central bank receipt logged.
                      </p>
                      <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-mono space-y-1">
                        <div>Receipt: {currentInspection.submission?.nbeReferenceNumber || (currentInspection.submission as any)?.nbeSubmissionId || 'NBE-REC-20260122-8841'}</div>
                        <div>Gateway: https://nbe.gov.et/api/v2/regulatory/gateway</div>
                        <div>SHA-256 Tamper Seal: {currentInspection.submission?.integrityHash || 'OB-SEAL-8F12AC-20260122'}</div>
                        <div>Institution Code: 0000013 (Oromia Bank S.C.)</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Event 6: Audit Cases & Findings Linked */}
                {timelineFilter === 'ALL' && (
                  <div className="relative">
                    <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px] font-bold">
                      🔍
                    </div>
                    <div className="space-y-1.5">
                      <div className="text-xs font-bold text-purple-600 dark:text-purple-400 flex items-center gap-2 flex-wrap">
                        <span>6. Internal Audit Supervisory Examination</span>
                        <span className="text-[10px] text-slate-400 font-mono">Current Audit Session</span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        Compliance Auditor reviewed historical submissions, attached supporting evidence, and tracked findings.
                      </p>
                      <div className="text-[11px] text-slate-500 bg-slate-50 dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 font-mono flex items-center gap-4 flex-wrap">
                        <span>Findings: {currentInspection.findings.length}</span>
                        <span>Evidence Records: {currentInspection.evidences.length}</span>
                        <span>Working Papers: {currentInspection.workingNotes.length}</span>
                        <span>Snapshots: {currentInspection.snapshots.length}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Historical Snapshots Inspection Card */}
              {currentInspection.snapshots && currentInspection.snapshots.length > 0 && (
                <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-2">
                    <History className="w-3.5 h-3.5 text-ob-indigo-600 dark:text-ob-indigo-400" />
                    <span>Historical Revision Snapshots ({currentInspection.snapshots.length} Versions)</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {currentInspection.snapshots.map((snap: any, sIdx: number) => (
                      <div
                        key={snap.snapshotId || `snap_${sIdx}`}
                        className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between font-mono font-bold">
                          <span className="text-slate-900 dark:text-white">Snapshot v{snap.version || sIdx + 1}</span>
                          <span className="text-[10px] text-ob-indigo-600 dark:text-ob-indigo-400">{snap.status}</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {snap.timestamp ? new Date(snap.timestamp).toLocaleString() : 'Captured during workflow'}
                        </div>
                        {snap.actorName && (
                          <div className="text-[10px] text-slate-500">
                            Actor: {snap.actorName} ({snap.actorRole})
                          </div>
                        )}
                        {snap.integrityHash && (
                          <div className="text-[9px] font-mono text-slate-400 truncate" title={snap.integrityHash}>
                            Seal: {snap.integrityHash}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SUB-VIEW 4: AUDIT FINDINGS */}
        {activeSubTab === 'FINDINGS' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={findingSeverityFilter}
                  onChange={(e) => {
                    setFindingSeverityFilter(e.target.value);
                    setFindingPage(1);
                  }}
                  className="min-h-[44px] px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 font-medium cursor-pointer"
                >
                  <option value="">All Severities</option>
                  <option value="CRITICAL">Critical Severity</option>
                  <option value="HIGH">High Severity</option>
                  <option value="MEDIUM">Medium Severity</option>
                  <option value="LOW">Low Severity</option>
                  <option value="INFORMATIONAL">Informational</option>
                </select>

                <select
                  value={findingStatusFilter}
                  onChange={(e) => {
                    setFindingStatusFilter(e.target.value);
                    setFindingPage(1);
                  }}
                  className="min-h-[44px] px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 font-medium cursor-pointer"
                >
                  <option value="">All Statuses</option>
                  <option value="OPEN">Open</option>
                  <option value="UNDER_REVIEW">Under Review</option>
                  <option value="REMEDIATION_PENDING">Remediation Pending</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsFindingModalOpen(true)}
                  className="min-h-[44px] px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>File New Finding</span>
                </button>

                <MaximizeButton
                  onClick={() => setIsFindingsMaximized(true)}
                  title="Maximize Audit Findings (Esc to restore)"
                />
              </div>
            </div>

            <div className="space-y-3">
              {findings.length === 0 ? (
                <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
                  No audit findings match your selected filters.
                </div>
              ) : (
                paginatedFindings.map((f) => (
                  <div
                    key={f.id}
                    className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2.5 py-0.5 rounded text-[10px] font-black ${
                            f.severity === 'CRITICAL'
                              ? 'bg-rose-600 text-white'
                              : f.severity === 'HIGH'
                              ? 'bg-orange-600 text-white'
                              : f.severity === 'MEDIUM'
                              ? 'bg-amber-600 text-white'
                              : 'bg-blue-600 text-white'
                          }`}
                        >
                          {f.severity}
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                          {f.id}
                        </span>
                        <span className="text-xs text-slate-500 font-mono">
                          [{f.reportKey}]
                        </span>
                        <span className="text-xs text-slate-500">
                          {f.department}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          Status: {f.status}
                        </span>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                        {f.title}
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                        {f.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap pt-2 border-t border-slate-100 dark:border-slate-800">
                      {f.regulatoryReference && (
                        <div>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">Authority: </span>
                          <span className="font-mono">{f.regulatoryReference}</span>
                        </div>
                      )}
                      {f.affectedField && (
                        <div>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">Field: </span>
                          <span className="font-mono">{f.affectedField}</span>
                        </div>
                      )}
                      {f.financialVariance !== undefined && (
                        <div>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">Variance: </span>
                          <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                            ETB {f.financialVariance.toLocaleString()}
                          </span>
                        </div>
                      )}
                      <div className="ml-auto text-[11px] text-slate-400">
                        Auditor: {f.auditorName} • {new Date(f.createdAt).toLocaleDateString()}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 pt-2">
                      {f.status === 'OPEN' && (
                        <button
                          type="button"
                          onClick={() => auditorService.updateFinding(f.id, { status: 'REMEDIATION_PENDING' })}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                        >
                          Request Remediation
                        </button>
                      )}
                      {f.status === 'REMEDIATION_PENDING' && (
                        <button
                          type="button"
                          onClick={() => {
                            setRemFindingId(f.id);
                            setIsRemediationModalOpen(true);
                          }}
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                        >
                          Assign Action Item
                        </button>
                      )}
                      {f.status !== 'CLOSED' && (
                        <button
                          type="button"
                          onClick={() => auditorService.updateFinding(f.id, { status: 'CLOSED' })}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                        >
                          Mark Closed
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Findings Pagination */}
            <Pagination
              currentPage={findingPage}
              totalItems={findings.length}
              pageSize={findingPageSize}
              onPageChange={setFindingPage}
              onPageSizeChange={setFindingPageSize}
              pageSizeOptions={[8, 16, 32]}
              itemName="audit findings"
            />
          </div>
        )}

        {/* SUB-VIEW 5: EVIDENCE VAULT */}
        {activeSubTab === 'EVIDENCE' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Regulatory Evidence & Audit Verification Documents
                </h3>
                <p className="text-xs text-slate-500">
                  Supporting General Ledger extracts, loan contracts, and reconciliation schedules sealed with SHA-256 hashes.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEvidenceModalOpen(true)}
                className="min-h-[44px] px-4 py-2 bg-slate-900 hover:bg-black text-white dark:bg-slate-700 dark:hover:bg-slate-600 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Upload Evidence</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {evidences.length === 0 ? (
                <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400 text-xs md:col-span-2">
                  No evidence documents attached to current audit cases.
                </div>
              ) : (
                paginatedEvidences.map((e) => (
                  <div
                    key={e.id}
                    className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-ob-indigo-600 dark:text-ob-indigo-400">
                        {e.id}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        {e.verificationStatus}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">{e.title}</h4>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">{e.fileName}</div>
                    </div>

                    <div className="p-2.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl space-y-1 font-mono text-[10px]">
                      <div className="text-slate-500 truncate" title={e.sha256Checksum}>
                        SHA-256: {e.sha256Checksum}
                      </div>
                      <div className="text-indigo-600 dark:text-indigo-400 font-bold">
                        Seal: {e.tamperSeal}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span>Uploaded: {new Date(e.uploadedAt).toLocaleDateString()}</span>
                      <span>By: {e.uploadedBy}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Evidence Pagination */}
            <Pagination
              currentPage={evidencePage}
              totalItems={evidences.length}
              pageSize={evidencePageSize}
              onPageChange={setEvidencePage}
              onPageSizeChange={setEvidencePageSize}
              pageSizeOptions={[8, 16]}
              itemName="evidence records"
            />
          </div>
        )}

        {/* SUB-VIEW 6: WORKING PAPERS / NOTES */}
        {activeSubTab === 'NOTES' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Auditor Working Papers & Confidential Field Notes
                </h3>
                <p className="text-xs text-slate-500">
                  Non-destructive audit notes and inquiries private to the Internal Audit team.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsNoteModalOpen(true)}
                className="min-h-[44px] px-4 py-2 bg-ob-indigo-600 hover:bg-ob-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>New Working Note</span>
              </button>
            </div>

            <div className="space-y-3">
              {paginatedNotes.length === 0 ? (
                <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
                  No confidential working papers recorded yet.
                </div>
              ) : (
                paginatedNotes.map((note) => (
                  <div
                    key={note.id}
                    className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                        {note.category}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        {new Date(note.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-sans">
                      {note.content}
                    </p>
                    <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                      Author: {note.authorName} • Return: {note.reportKey}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Notes Pagination */}
            <Pagination
              currentPage={notePage}
              totalItems={workingNotes.length}
              pageSize={notePageSize}
              onPageChange={setNotePage}
              onPageSizeChange={setNotePageSize}
              pageSizeOptions={[6, 12, 24]}
              itemName="working notes"
            />
          </div>
        )}

        {/* SUB-VIEW 7: REMEDIATION TRACKER */}
        {activeSubTab === 'REMEDIATION' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Remediation Action Plans & Deadlines
                </h3>
                <p className="text-xs text-slate-500">
                  Track corrective actions assigned to Makers and Department Heads per NBE Directive compliance mandates.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsRemediationModalOpen(true)}
                className="min-h-[44px] px-4 py-2 bg-ob-indigo-600 hover:bg-ob-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Action Plan</span>
              </button>
            </div>

            <div className="space-y-3">
              {paginatedRemediations.length === 0 ? (
                <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
                  No remediation action items recorded.
                </div>
              ) : (
                paginatedRemediations.map((rem) => (
                  <div
                    key={rem.id}
                    className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                        {rem.id} (Finding: {rem.findingId})
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                          rem.status === 'VERIFIED_BY_AUDITOR'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : rem.status === 'COMPLETED'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}
                      >
                        {rem.status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">Action Plan</h4>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                        {rem.actionPlan}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Responsible Person</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{rem.assignedTo}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Department</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{rem.assignedDepartment}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Target Completion</span>
                        <span className="font-semibold text-rose-600 dark:text-rose-400">{rem.targetDate}</span>
                      </div>
                    </div>

                    {rem.remediationProof && (
                      <div className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 p-2.5 rounded-lg">
                        <span className="font-bold">Proof of Rectification: </span>
                        {rem.remediationProof}
                      </div>
                    )}

                    {rem.status !== 'VERIFIED_BY_AUDITOR' && (
                      <div className="pt-2 flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() =>
                            auditorService.verifyRemediationByAuditor(
                              rem.id,
                              currentUser.name,
                              'Auditor verified adjustments in core banking system ledger.'
                            )
                          }
                          className="min-h-[38px] px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Auditor Sign-Off & Verification</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Remediation Pagination */}
            <Pagination
              currentPage={remediationPage}
              totalItems={remediations.length}
              pageSize={remediationPageSize}
              onPageChange={setRemediationPage}
              onPageSizeChange={setRemediationPageSize}
              pageSizeOptions={[6, 12, 24]}
              itemName="remediation items"
            />
          </div>
        )}

        {/* SUB-VIEW 8: AUDIT REPORTS GENERATOR */}
        {activeSubTab === 'REPORTS' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Formal NBE Statutory Compliance Audit Reports & Memorandums
                </h3>
                <p className="text-xs text-slate-500">
                  Exportable audit bundles signed with Oromia Bank cryptographic verification seals.
                </p>
              </div>
              <button
                type="button"
                onClick={handleGenerateAuditMemo}
                className="min-h-[44px] px-4 py-2 bg-ob-indigo-600 hover:bg-ob-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Generate Audit Package</span>
              </button>
            </div>

            <div className="space-y-3">
              {paginatedReportPackages.length === 0 ? (
                <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
                  No compiled audit report packages available.
                </div>
              ) : (
                paginatedReportPackages.map((pkg) => (
                  <div
                    key={pkg.id}
                    className="p-4 sm:p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="font-mono text-xs font-bold text-ob-indigo-600 dark:text-ob-indigo-400">
                          {pkg.id}
                        </span>
                        <h4 className="font-black text-sm text-slate-900 dark:text-white mt-0.5">
                          {pkg.title}
                        </h4>
                      </div>
                      <div className="text-right">
                        <span className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 font-mono text-xs font-bold">
                          Period: {pkg.period}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {pkg.executiveSummary}
                    </p>

                    <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-4">
                        <div>
                          <span className="text-[10px] text-slate-400 block">Total Findings</span>
                          <span className="font-bold text-slate-900 dark:text-white">{pkg.findingsCount}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Critical</span>
                          <span className="font-bold text-rose-600 dark:text-rose-400">{pkg.criticalCount}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">High</span>
                          <span className="font-bold text-amber-600 dark:text-amber-400">{pkg.highCount}</span>
                        </div>
                      </div>

                      <div className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400 font-bold">
                        Seal: {pkg.tamperSeal}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => handleDownloadReportJson(pkg)}
                        className="min-h-[40px] px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Export JSON Vault</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Report Packages Pagination */}
            <Pagination
              currentPage={reportPackagePage}
              totalItems={reportPackages.length}
              pageSize={reportPackagePageSize}
              onPageChange={setReportPackagePage}
              onPageSizeChange={setReportPackagePageSize}
              pageSizeOptions={[6, 12]}
              itemName="audit packages"
            />
          </div>
        )}
      </div>

      {/* MODAL 1: FILE AUDIT FINDING */}
      {isFindingModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Record Formal Audit Finding ({selectedReportKey})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFindingModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateFinding} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Finding Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Schedule 2 Past-Due Classification Discrepancy"
                  value={newFindingTitle}
                  onChange={(e) => setNewFindingTitle(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Description & Inspection Observation *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe the discrepancy, affected records, and testing observation..."
                  value={newFindingDesc}
                  onChange={(e) => setNewFindingDesc(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Finding Severity *</label>
                  <select
                    value={newFindingSeverity}
                    onChange={(e) => setNewFindingSeverity(e.target.value as AuditFindingSeverity)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium cursor-pointer"
                  >
                    <option value="CRITICAL">CRITICAL (High Non-Compliance)</option>
                    <option value="HIGH">HIGH (Material Variance)</option>
                    <option value="MEDIUM">MEDIUM (Policy Exception)</option>
                    <option value="LOW">LOW (Documentation Issue)</option>
                    <option value="INFORMATIONAL">INFORMATIONAL</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">NBE Directive Citation</label>
                  <input
                    type="text"
                    value={newFindingCircular}
                    onChange={(e) => setNewFindingCircular(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Affected Schedule Field</label>
                  <input
                    type="text"
                    placeholder="e.g. TOTAL_LOANS"
                    value={newFindingField}
                    onChange={(e) => setNewFindingField(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Financial Variance (ETB)</label>
                  <input
                    type="number"
                    placeholder="e.g. 5000000"
                    value={newFindingVariance}
                    onChange={(e) => setNewFindingVariance(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsFindingModalOpen(false)}
                  className="px-4 py-2 text-slate-500 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold cursor-pointer shadow-sm"
                >
                  Record Audit Finding
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ATTACH EVIDENCE */}
      {isEvidenceModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Attach Supporting Evidence ({selectedReportKey})
              </h3>
              <button
                type="button"
                onClick={() => setIsEvidenceModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAttachEvidence} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Document Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Core Banking GL Provision Extract"
                  value={evidenceTitle}
                  onChange={(e) => setEvidenceTitle(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">File Name</label>
                <input
                  type="text"
                  placeholder="e.g. gl_extract_2026_q1.xlsx"
                  value={evidenceFileName}
                  onChange={(e) => setEvidenceFileName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Verification Notes</label>
                <textarea
                  rows={2}
                  placeholder="Audit verification procedures applied..."
                  value={evidenceNotes}
                  onChange={(e) => setEvidenceNotes(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEvidenceModalOpen(false)}
                  className="px-4 py-2 text-slate-500 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-4 py-2 bg-slate-900 hover:bg-black text-white dark:bg-slate-700 dark:hover:bg-slate-600 rounded-xl font-bold cursor-pointer shadow-sm"
                >
                  Seal & Attach Evidence
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: WORKING NOTE */}
      {isNoteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Record Auditor Working Paper Note
              </h3>
              <button
                type="button"
                onClick={() => setIsNoteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddWorkingNote} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Category</label>
                <select
                  value={noteCategory}
                  onChange={(e) => setNoteCategory(e.target.value as any)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium cursor-pointer"
                >
                  <option value="OBSERVATION">Audit Observation</option>
                  <option value="METHODOLOGY">Testing Methodology</option>
                  <option value="RISK_NOTE">Risk Assessment Note</option>
                  <option value="INQUIRY">Management Inquiry</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Note Content *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Record confidential observation or working paper remarks..."
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNoteModalOpen(false)}
                  className="px-4 py-2 text-slate-500 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-4 py-2 bg-ob-indigo-600 hover:bg-ob-indigo-700 text-white rounded-xl font-bold cursor-pointer shadow-sm"
                >
                  Save Working Paper
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: REMEDIATION ACTION PLAN */}
      {isRemediationModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Create Remediation Action Plan
              </h3>
              <button
                type="button"
                onClick={() => setIsRemediationModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRemediation} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Target Finding</label>
                <select
                  value={remFindingId}
                  onChange={(e) => setRemFindingId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium cursor-pointer"
                >
                  {findings.map((f) => (
                    <option key={f.id} value={f.id}>
                      [{f.severity}] {f.title} ({f.reportKey})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Corrective Action Plan *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Specify exact corrective steps required by the department..."
                  value={remActionPlan}
                  onChange={(e) => setRemActionPlan(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Assigned Department</label>
                  <select
                    value={remDept}
                    onChange={(e) => setRemDept(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium cursor-pointer"
                  >
                    <option value="">Department</option>
                    {DEPARTMENTS.map((d) => (
                      <option key={d.name} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Assigned To (Maker)</label>
                  <input
                    type="text"
                    placeholder="e.g. Dawit Bekele"
                    value={remAssignee}
                    onChange={(e) => setRemAssignee(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Target Remediation Date</label>
                <input
                  type="date"
                  value={remTargetDate}
                  onChange={(e) => setRemTargetDate(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsRemediationModalOpen(false)}
                  className="px-4 py-2 text-slate-500 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-4 py-2 bg-ob-indigo-600 hover:bg-ob-indigo-700 text-white rounded-xl font-bold cursor-pointer shadow-sm"
                >
                  Assign Remediation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PHASE 47: FULL VIEW / MAXIMIZED AUDIT WORK QUEUE */}
      {isQueueMaximized && (
        <MaximizedViewModal
          isOpen={isQueueMaximized}
          onClose={() => setIsQueueMaximized(false)}
          title="Regulatory Audit Ledger & Work Queue"
          badge="Auditor Full View"
          subtitle={`Full inspection ledger of ${workQueue.length} returns across all Oromia Bank departments`}
          icon={ClipboardCheck}
        >
          <div className="space-y-4">
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto min-w-full touch-scroll-x">
                <table className="min-w-[800px] w-full divide-y divide-slate-200 dark:divide-slate-800 text-left text-xs">
                  <thead className="bg-slate-50/90 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider text-[10px] sticky top-0 z-10">
                    <tr>
                      <th className="py-3 px-4">Statutory Return</th>
                      <th className="py-3 px-4">Department & Maker</th>
                      <th className="py-3 px-4">Workflow Status</th>
                      <th className="py-3 px-4">Audit Assessment</th>
                      <th className="py-3 px-4 text-center">Findings</th>
                      <th className="py-3 px-4 text-center">Evidence</th>
                      <th className="py-3 px-4 text-center">Remediations</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {paginatedWorkQueue.map((item) => (
                      <tr key={item.reportKey} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-mono text-xs font-bold text-ob-indigo-700 dark:text-ob-indigo-400 bg-ob-indigo-50 dark:bg-ob-indigo-950/60 px-2 py-0.5 rounded border border-ob-indigo-200 dark:border-ob-indigo-800">
                            {item.reportKey}
                          </span>
                          <div className="font-semibold text-slate-900 dark:text-white mt-1">
                            {getReportDefinition(item.reportKey)?.Title || 'Regulatory Return'}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">v{item.version}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                          <div className="font-medium text-slate-900 dark:text-white">{item.department}</div>
                          <div className="text-[10px] text-slate-500">Maker: {item.makerName}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              item.submissionStatus === 'APPROVED'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : item.submissionStatus === 'SENT'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                : item.submissionStatus === 'PENDING_CHECKER'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {item.submissionStatus}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.auditStatus === 'FLAGGED_HIGH_RISK'
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                : item.auditStatus === 'FINDINGS_OPEN'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            }`}
                          >
                            {item.auditStatus}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-rose-600">{item.totalFindings}</td>
                        <td className="py-3 px-4 text-center font-mono">{item.evidenceCount}</td>
                        <td className="py-3 px-4 text-center font-mono">{item.pendingRemediations}</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setIsQueueMaximized(false);
                              handleSelectReportForAudit(item.reportKey, item.submissionId);
                            }}
                            className="px-3 py-1 bg-ob-indigo-600 hover:bg-ob-indigo-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                          >
                            Inspect Dossier
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <Pagination
              currentPage={workQueuePage}
              pageSize={workQueuePageSize}
              totalItems={workQueue.length}
              onPageChange={(p) => setWorkQueuePage(p)}
              onPageSizeChange={(sz) => {
                setWorkQueuePageSize(sz);
                setWorkQueuePage(1);
              }}
              itemName="returns"
            />
          </div>
        </MaximizedViewModal>
      )}

      {/* PHASE 47: FULL VIEW / MAXIMIZED FINDINGS */}
      {isFindingsMaximized && (
        <MaximizedViewModal
          isOpen={isFindingsMaximized}
          onClose={() => setIsFindingsMaximized(false)}
          title="Statutory Audit Findings & Exception Matrix"
          badge="Audit Observations"
          subtitle={`Independent supervisory exceptions catalog (${findings.length} findings recorded)`}
          icon={AlertTriangle}
        >
          <div className="space-y-4">
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto min-w-full touch-scroll-x">
                <table className="min-w-[800px] w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 font-bold sticky top-0 z-10">
                      <th className="py-3 px-3">Finding Ref & Title</th>
                      <th className="py-3 px-3">Severity</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3">Statutory Return</th>
                      <th className="py-3 px-3">Circular / Directive</th>
                      <th className="py-3 px-3">Logged Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {paginatedFindings.map((f) => (
                      <tr key={f.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900 dark:text-white">{f.title}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{f.id}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              f.severity === 'CRITICAL'
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                : f.severity === 'HIGH'
                                ? 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            }`}
                          >
                            {f.severity}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {f.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-ob-indigo-600 dark:text-ob-indigo-400">{f.reportKey}</td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">{f.regulatoryReference || 'NBE BSD/03/2020'}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-500">{new Date(f.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <Pagination
              currentPage={findingPage}
              pageSize={findingPageSize}
              totalItems={findings.length}
              onPageChange={(p) => setFindingPage(p)}
              onPageSizeChange={(sz) => {
                setFindingPageSize(sz);
                setFindingPage(1);
              }}
              itemName="findings"
            />
          </div>
        </MaximizedViewModal>
      )}
    </div>
  );
};
