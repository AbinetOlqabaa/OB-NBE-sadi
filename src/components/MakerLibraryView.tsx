/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BookOpen,
  Search,
  Filter,
  X,
  Plus,
  RefreshCw,
  FileText,
  Clock,
  AlertCircle,
  CheckCircle2,
  Lock,
  Copy,
  Trash2,
  Edit3,
  Eye,
  Send,
  Sparkles,
  Layers,
  Calendar,
  ArrowUpDown,
  LayoutGrid,
  List as ListIcon,
  ShieldCheck,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  History,
  FileCheck2,
  Flag,
  MessageSquare,
  Archive,
  AlertTriangle,
  CheckCircle,
  XCircle,
  FileWarning,
  Shield,
  CheckSquare,
  Square,
} from 'lucide-react';
import {
  ReportMetadata,
  ReportSubmission,
  UserSession,
  LibraryLifecycleState,
  LibraryFilterOptions,
  LibraryQueryResult,
  deriveLibraryLifecycleState,
  isFinalSubmittedStatus,
  RemovalImpactAssessment,
} from '../types/regulatory.ts';
import { submissionService } from '../services/submissionService.ts';
import { realtimeSsotEngine } from '../services/realtimeSsotEngine.ts';
import { auditService } from '../services/auditService.ts';
import { effectiveAccessEngine } from '../services/effectiveAccessEngine.ts';
import { getReportByKey } from '../data/report-registry.ts';
import { userService } from '../services/userService.ts';
import { triggerHaptic, vibrate } from '../utils/haptics.ts';
import { CheckerSelector } from './CheckerSelector.tsx';
import { MaximizedViewModal } from './MaximizedViewModal.tsx';
import { MaximizeButton } from './MaximizeButton.tsx';

interface MakerLibraryViewProps {
  currentUser: UserSession;
  templates: ReportMetadata[];
  submissions: ReportSubmission[];
  onSelectSubmission: (submission: ReportSubmission) => void;
  onCreateDraft?: (reportKey: string) => void;
  onSubmitToChecker: (submissionId: string, comment?: string, selectedCheckerIds?: string[]) => void;
  onDeleteSubmission: (submissionId: string) => void;
  onReuseSubmission: (submissionId: string) => void;
  onRefresh?: () => void;
}

export const MakerLibraryView: React.FC<MakerLibraryViewProps> = ({
  currentUser,
  templates,
  submissions,
  onSelectSubmission,
  onCreateDraft,
  onSubmitToChecker,
  onDeleteSubmission,
  onReuseSubmission,
  onRefresh,
}) => {
  // Query state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLifecycleState, setSelectedLifecycleState] = useState<LibraryLifecycleState | 'ALL'>('ALL');
  const [selectedReportType, setSelectedReportType] = useState<string>('ALL');
  const [selectedFrequency, setSelectedFrequency] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [sortBy, setSortBy] = useState<'updatedAt' | 'createdAt' | 'reportKey' | 'title' | 'status' | 'version'>('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [viewMode, setViewMode] = useState<'GRID' | 'TABLE'>('GRID');

  // UI interaction state
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modals state
  const [deleteTargetSub, setDeleteTargetSub] = useState<ReportSubmission | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [submitTargetSub, setSubmitTargetSub] = useState<ReportSubmission | null>(null);
  const [selectedCheckerIds, setSelectedCheckerIds] = useState<string[]>([]);
  const [submitComment, setSubmitComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (submitTargetSub) {
      const eligible = effectiveAccessEngine.getEligibleCheckersForReport(
        submitTargetSub.reportKey,
        currentUser,
        submitTargetSub
      );
      if (eligible.length > 0) {
        setSelectedCheckerIds([eligible[0].id]);
      } else {
        setSelectedCheckerIds([]);
      }
    }
  }, [submitTargetSub, currentUser]);

  const [validateTargetSub, setValidateTargetSub] = useState<ReportSubmission | null>(null);
  const [validationResult, setValidationResult] = useState<any | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const [isNewReturnModalOpen, setIsNewReturnModalOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  // Phase 50: Batch Submission State for Maker & Checker Library Views
  const [selectedSubIds, setSelectedSubIds] = useState<string[]>([]);
  const [isBatchSubmitModalOpen, setIsBatchSubmitModalOpen] = useState(false);
  const [batchSubmitComment, setBatchSubmitComment] = useState('');
  const [batchCheckerIds, setBatchCheckerIds] = useState<string[]>([]);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchResultBanner, setBatchResultBanner] = useState<string | null>(null);

  // Phase 26 Modals State
  // Checker 4-Eyes Review Modal
  const [checkerReviewTargetSub, setCheckerReviewTargetSub] = useState<ReportSubmission | null>(null);
  const [checkerReviewAction, setCheckerReviewAction] = useState<'APPROVE' | 'REJECT' | 'REQUEST_CORRECTION'>('APPROVE');
  const [checkerReviewComment, setCheckerReviewComment] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);

  // Flag & Comment Modal
  const [flagTargetSub, setFlagTargetSub] = useState<ReportSubmission | null>(null);
  const [flagReason, setFlagReason] = useState('');
  const [isFlagging, setIsFlagging] = useState(false);

  const [commentTargetSub, setCommentTargetSub] = useState<ReportSubmission | null>(null);
  const [commentText, setCommentText] = useState('');
  const [commentCategory, setCommentCategory] = useState<'GENERAL' | 'AUDIT' | 'CHECKER_QUERY' | 'CORRECTION_NOTE'>('GENERAL');
  const [isCommenting, setIsCommenting] = useState(false);

  // Auditor/Admin Dossier History & Event Trail Modal
  const [historyTargetSub, setHistoryTargetSub] = useState<ReportSubmission | null>(null);
  const [dossierAuditEvents, setDossierAuditEvents] = useState<any[]>([]);

  // Admin Governed Removal Modal
  const [adminRemovalTargetSub, setAdminRemovalTargetSub] = useState<ReportSubmission | null>(null);
  const [removalAssessment, setRemovalAssessment] = useState<RemovalImpactAssessment | null>(null);
  const [adminRemovalAction, setAdminRemovalAction] = useState<'ARCHIVE' | 'VOID' | 'DELETE_DRAFT'>('ARCHIVE');
  const [adminRemovalReason, setAdminRemovalReason] = useState('');
  const [adminRemovalConfirmed, setAdminRemovalConfirmed] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [ssotTick, setSsotTick] = useState(0);

  // Requirement 9: Active listener ensuring library immediately reflects latest authoritative server updates
  useEffect(() => {
    const unsubSubmissions = submissionService.onSubmissionsUpdated(() => {
      setSsotTick((t) => t + 1);
    });
    const unsubRealtime = realtimeSsotEngine.subscribe(() => {
      setSsotTick((t) => t + 1);
    });
    return () => {
      unsubSubmissions();
      unsubRealtime();
    };
  }, []);

  // Local query result derived directly from authoritative backend submissionService
  const queryResult: LibraryQueryResult = useMemo(() => {
    try {
      return submissionService.queryLibrary(currentUser, {
        search: searchQuery,
        lifecycleState: selectedLifecycleState,
        reportType: selectedReportType !== 'ALL' ? selectedReportType : undefined,
        frequency: selectedFrequency !== 'ALL' ? selectedFrequency : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        sortBy,
        sortOrder,
        page: currentPage,
        pageSize,
      });
    } catch (err: any) {
      return {
        items: [],
        total: 0,
        page: 1,
        pageSize,
        totalPages: 1,
        stats: { all: 0, draft: 0, inProgress: 0, returned: 0, submitted: 0, reusedCopy: 0, archived: 0, voided: 0 },
      };
    }
  }, [
    currentUser,
    submissions,
    ssotTick,
    searchQuery,
    selectedLifecycleState,
    selectedReportType,
    selectedFrequency,
    startDate,
    endDate,
    sortBy,
    sortOrder,
    currentPage,
    pageSize,
  ]);

  // Allowed report keys for this Maker
  const allowedReportKeys = useMemo(
    () => userService.getAllowedReportKeysForUser(currentUser),
    [currentUser]
  );

  const authorizedTemplates = useMemo(
    () => templates.filter((tpl) => allowedReportKeys.includes(tpl.ReturnKey)),
    [templates, allowedReportKeys]
  );

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedLifecycleState, selectedReportType, selectedFrequency, startDate, endDate, sortBy, sortOrder]);

  const handleRefresh = useCallback(() => {
    setIsLoading(true);
    triggerHaptic('selection');
    setTimeout(() => {
      if (onRefresh) onRefresh();
      setIsLoading(false);
    }, 250);
  }, [onRefresh]);

  const handleExecuteDelete = () => {
    if (!deleteTargetSub) return;
    setIsDeleting(true);
    try {
      vibrate([40, 60]);
      onDeleteSubmission(deleteTargetSub.id);
      setDeleteTargetSub(null);
    } catch (err: any) {
      alert(`Deletion failed: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExecuteSubmit = () => {
    if (!submitTargetSub) return;
    setIsSubmitting(true);
    try {
      vibrate([30, 45]);
      onSubmitToChecker(submitTargetSub.id, submitComment, selectedCheckerIds);
      setSubmitTargetSub(null);
      setSubmitComment('');
    } catch (err: any) {
      alert(`Submission failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExecuteValidate = (sub: ReportSubmission) => {
    setValidateTargetSub(sub);
    setIsValidating(true);
    try {
      vibrate(25);
      const res = submissionService.validateSubmission(sub.id);
      setValidationResult(res);
    } catch (err: any) {
      alert(`Validation failed: ${err.message}`);
    } finally {
      setIsValidating(false);
    }
  };

  const handleExecuteReuse = (sub: ReportSubmission) => {
    try {
      vibrate([30, 45]);
      onReuseSubmission(sub.id);
    } catch (err: any) {
      alert(`Reuse failed: ${err.message}`);
    }
  };

  // Phase 26 Handlers for Checker, Auditor, and Administrator
  const handleOpenCheckerReview = (sub: ReportSubmission) => {
    setCheckerReviewTargetSub(sub);
    setCheckerReviewAction('APPROVE');
    setCheckerReviewComment('');
  };

  const handleExecuteCheckerReview = () => {
    if (!checkerReviewTargetSub) return;
    setIsReviewing(true);
    try {
      vibrate([30, 45]);
      submissionService.reviewSubmission(
        checkerReviewTargetSub.id,
        checkerReviewAction,
        currentUser,
        checkerReviewComment
      );
      setCheckerReviewTargetSub(null);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(`Review action failed: ${err.message}`);
    } finally {
      setIsReviewing(false);
    }
  };

  const handleOpenFlag = (sub: ReportSubmission) => {
    setFlagTargetSub(sub);
    setFlagReason(sub.flagReason || '');
  };

  const handleExecuteFlag = () => {
    if (!flagTargetSub) return;
    setIsFlagging(true);
    try {
      vibrate(30);
      const newFlag = !flagTargetSub.flagged;
      submissionService.flagSubmission(
        flagTargetSub.id,
        currentUser,
        flagReason || 'Flagged for attention',
        newFlag
      );
      setFlagTargetSub(null);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(`Flag update failed: ${err.message}`);
    } finally {
      setIsFlagging(false);
    }
  };

  const handleOpenComment = (sub: ReportSubmission) => {
    setCommentTargetSub(sub);
    setCommentText('');
    setCommentCategory(
      currentUser.role === 'AUDITOR'
        ? 'AUDIT'
        : currentUser.role === 'CHECKER'
        ? 'CHECKER_QUERY'
        : 'GENERAL'
    );
  };

  const handleExecuteAddComment = () => {
    if (!commentTargetSub || !commentText.trim()) return;
    setIsCommenting(true);
    try {
      vibrate(25);
      submissionService.addSubmissionComment(
        commentTargetSub.id,
        currentUser,
        commentText.trim(),
        commentCategory
      );
      setCommentTargetSub(null);
      setCommentText('');
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(`Add comment failed: ${err.message}`);
    } finally {
      setIsCommenting(false);
    }
  };

  const handleOpenHistory = (sub: ReportSubmission) => {
    setHistoryTargetSub(sub);
    const events = auditService.query({ entityId: sub.id });
    setDossierAuditEvents(events);
  };

  const handleOpenAdminRemoval = (sub: ReportSubmission) => {
    try {
      const assessment = submissionService.getRemovalImpactAssessment(sub.id, currentUser);
      setRemovalAssessment(assessment);
      setAdminRemovalTargetSub(sub);
      setAdminRemovalAction(assessment.isSubmittedRecord ? 'ARCHIVE' : 'DELETE_DRAFT');
      setAdminRemovalReason('');
      setAdminRemovalConfirmed(false);
    } catch (err: any) {
      alert(`Cannot assess removal impact: ${err.message}`);
    }
  };

  const handleExecuteAdminRemoval = () => {
    if (!adminRemovalTargetSub) return;
    if (!adminRemovalConfirmed) {
      alert('Explicit confirmation is required.');
      return;
    }
    if (!adminRemovalReason || adminRemovalReason.trim().length < 10) {
      alert('Mandatory justification of at least 10 characters is required.');
      return;
    }
    setIsRemoving(true);
    try {
      vibrate([40, 60, 40]);
      submissionService.adminGovernedRemoveSubmission(adminRemovalTargetSub.id, currentUser, {
        action: adminRemovalAction,
        reason: adminRemovalReason.trim(),
        confirmed: adminRemovalConfirmed,
      });
      setAdminRemovalTargetSub(null);
      setRemovalAssessment(null);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(`Governed removal failed: ${err.message}`);
    } finally {
      setIsRemoving(false);
    }
  };

  // Phase 50 Batch Selection & Execution Handlers
  const toggleSelectSub = (subId: string) => {
    vibrate(15);
    setSelectedSubIds((prev) =>
      prev.includes(subId) ? prev.filter((id) => id !== subId) : [...prev, subId]
    );
  };

  const selectedSubmissions = useMemo(() => {
    return queryResult.items.filter((s) => selectedSubIds.includes(s.id));
  }, [queryResult.items, selectedSubIds]);

  const toggleSelectAllEligible = () => {
    vibrate(20);
    const eligibleIds =
      currentUser.role === 'MAKER'
        ? queryResult.items.filter((s) => isEditable(s)).map((s) => s.id)
        : queryResult.items.map((s) => s.id);

    if (selectedSubIds.length === eligibleIds.length && eligibleIds.length > 0) {
      setSelectedSubIds([]);
    } else {
      setSelectedSubIds(eligibleIds);
    }
  };

  const handleOpenBatchModal = () => {
    if (selectedSubIds.length === 0) return;
    setBatchSubmitComment(
      currentUser.role === 'MAKER'
        ? 'Batch submission of verified statutory returns to Checker 4-eyes review.'
        : 'Batch verified and authorized for transmission to NBE Gateway.'
    );
    // Pre-populate eligible checkers from the first selected submission
    if (currentUser.role === 'MAKER' && selectedSubmissions.length > 0) {
      const eligible = effectiveAccessEngine.getEligibleCheckersForReport(
        selectedSubmissions[0].reportKey,
        currentUser,
        selectedSubmissions[0]
      );
      if (eligible.length > 0) {
        setBatchCheckerIds([eligible[0].id]);
      }
    }
    setIsBatchSubmitModalOpen(true);
    vibrate(25);
  };

  const handleExecuteBatchSubmission = async () => {
    if (selectedSubIds.length === 0) return;
    setIsBatchProcessing(true);
    try {
      if (currentUser.role === 'MAKER') {
        const res = submissionService.batchSubmitToChecker(
          selectedSubIds,
          currentUser,
          batchSubmitComment,
          batchCheckerIds
        );
        vibrate(25);
        setBatchResultBanner(
          `Batch Submit to Checker Complete: ${res.succeededCount} of ${res.totalRequested} return(s) dispatched to 4-eyes review.`
        );
      } else {
        // Checker or Admin role: Batch Submit to NBE
        const res = await submissionService.batchSubmitToNBE(
          selectedSubIds,
          currentUser,
          batchSubmitComment
        );
        vibrate(25);
        setBatchResultBanner(
          `Batch Submit to NBE Complete: ${res.succeededCount} of ${res.totalRequested} return(s) officially delivered to NBE Gateway.`
        );
      }
      setSelectedSubIds([]);
      setIsBatchSubmitModalOpen(false);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(`Batch operation error: ${err.message}`);
    } finally {
      setIsBatchProcessing(false);
    }
  };

  // Lifecycle state badge styling
  const renderLifecycleBadge = (state: LibraryLifecycleState) => {
    switch (state) {
      case 'DRAFT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <Clock className="w-3 h-3 text-slate-500" />
            DRAFT
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <Edit3 className="w-3 h-3 text-blue-600 dark:text-blue-400" />
            IN PROGRESS
          </span>
        );
      case 'RETURNED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800 animate-pulse">
            <AlertCircle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            RETURNED FOR CORRECTION
          </span>
        );
      case 'SUBMITTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            SUBMITTED / SEALED
          </span>
        );
      case 'REUSED_COPY':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
            <Copy className="w-3 h-3 text-purple-600 dark:text-purple-400" />
            REUSED COPY
          </span>
        );
      case 'ARCHIVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600">
            <Archive className="w-3 h-3 text-slate-600 dark:text-slate-300" />
            ARCHIVED
          </span>
        );
      case 'VOIDED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
            <XCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
            VOIDED
          </span>
        );
      default:
        return null;
    }
  };

  const isEditable = (sub: ReportSubmission) => {
    return sub.status === 'DRAFT' || sub.status === 'CORRECTION_REQUIRED';
  };

  const isSubmittedState = (sub: ReportSubmission) => {
    return (
      sub.status === 'PENDING_CHECKER' ||
      sub.status === 'APPROVED' ||
      sub.status === 'SENT' ||
      sub.status === 'SENDING'
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-4">
      {/* 1. Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                  currentUser.role === 'CHECKER'
                    ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                    : currentUser.role === 'AUDITOR'
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800'
                    : currentUser.role === 'ADMIN'
                    ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800'
                    : 'bg-ob-blue-50 dark:bg-ob-blue-950/60 text-ob-blue-600 dark:text-ob-blue-400 border-ob-blue-200 dark:border-ob-blue-800'
                }`}
              >
                {currentUser.role === 'CHECKER' ? (
                  <ShieldCheck className="w-5 h-5" />
                ) : currentUser.role === 'AUDITOR' ? (
                  <ShieldAlert className="w-5 h-5" />
                ) : currentUser.role === 'ADMIN' ? (
                  <Shield className="w-5 h-5" />
                ) : (
                  <BookOpen className="w-5 h-5" />
                )}
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  {currentUser.role === 'CHECKER'
                    ? 'Checker Review Library & 4-Eyes Queue'
                    : currentUser.role === 'AUDITOR'
                    ? 'Auditor Regulatory Repository & Dossiers'
                    : currentUser.role === 'ADMIN'
                    ? 'Administrator Institutional Library & Governance'
                    : 'Maker Library & Regulatory Dossiers'}
                  <span
                    className={`text-[11px] font-mono font-medium px-2 py-0.5 rounded-md border ${
                      currentUser.role === 'CHECKER'
                        ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300'
                        : currentUser.role === 'AUDITOR'
                        ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border-indigo-300'
                        : currentUser.role === 'ADMIN'
                        ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-300'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {currentUser.role === 'CHECKER'
                      ? '4-Eyes Governance'
                      : currentUser.role === 'AUDITOR'
                      ? 'Independent Audit'
                      : currentUser.role === 'ADMIN'
                      ? 'Compliance Administration'
                      : 'SSOT Authoritative'}
                  </span>
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {currentUser.role === 'CHECKER'
                    ? 'Authorized review records for your department, 4-eyes principle inspection, compliance flagging, and statutory review sign-off.'
                    : currentUser.role === 'AUDITOR'
                    ? 'Independent supervisory examination, historical version comparisons, and full event inspection across institutional returns.'
                    : currentUser.role === 'ADMIN'
                    ? 'Comprehensive institutional monitoring, lifecycle governance, and regulated retention management under NBE Directive BSD/03/2020.'
                    : 'Comprehensive lifecycle archive of unsubmitted drafts, in-progress returns, returned corrections, and immutable submitted filings.'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isLoading}
              title="Refresh Library Records"
              className="p-2 sm:px-3 sm:py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-ob-blue-600' : ''}`}
              />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {currentUser.role === 'MAKER' && onCreateDraft && (
              <button
                type="button"
                onClick={() => setIsNewReturnModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-ob-blue-600 hover:bg-ob-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-ob-blue-600/20 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>New Return</span>
              </button>
            )}
          </div>
        </div>

        {/* 2. Lifecycle Stats Bar (Interactive Quick Filters) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2.5 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80">
          <button
            type="button"
            onClick={() => setSelectedLifecycleState('ALL')}
            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
              selectedLifecycleState === 'ALL'
                ? 'bg-ob-blue-50/80 dark:bg-ob-blue-950/40 border-ob-blue-400 dark:border-ob-blue-600 shadow-xs'
                : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">
              {currentUser.role === 'CHECKER'
                ? 'All Review Records'
                : currentUser.role === 'AUDITOR'
                ? 'All Bank Dossiers'
                : currentUser.role === 'ADMIN'
                ? 'All Institutional'
                : 'All Dossiers'}
            </div>
            <div className="text-base sm:text-lg font-mono font-bold text-slate-900 dark:text-white mt-0.5">
              {queryResult.stats.all}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedLifecycleState('DRAFT')}
            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
              selectedLifecycleState === 'DRAFT'
                ? 'bg-slate-100 dark:bg-slate-800 border-slate-400 dark:border-slate-500 shadow-xs'
                : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              Drafts
            </div>
            <div className="text-base sm:text-lg font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5">
              {queryResult.stats.draft}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedLifecycleState('IN_PROGRESS')}
            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
              selectedLifecycleState === 'IN_PROGRESS'
                ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-400 dark:border-blue-600 shadow-xs'
                : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <div className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
              <Edit3 className="w-2.5 h-2.5" />
              In Progress
            </div>
            <div className="text-base sm:text-lg font-mono font-bold text-blue-700 dark:text-blue-300 mt-0.5">
              {queryResult.stats.inProgress}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedLifecycleState('RETURNED')}
            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer relative ${
              selectedLifecycleState === 'RETURNED'
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 dark:border-amber-600 shadow-xs'
                : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <div className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
              <AlertCircle className="w-2.5 h-2.5" />
              Returned
            </div>
            <div className="text-base sm:text-lg font-mono font-bold text-amber-700 dark:text-amber-300 mt-0.5 flex items-center gap-1.5">
              {queryResult.stats.returned}
              {queryResult.stats.returned > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              )}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedLifecycleState('SUBMITTED')}
            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
              selectedLifecycleState === 'SUBMITTED'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-600 shadow-xs'
                : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <div className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-2.5 h-2.5" />
              {currentUser.role === 'CHECKER' ? 'Pending & Reviewed' : 'Submitted'}
            </div>
            <div className="text-base sm:text-lg font-mono font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
              {queryResult.stats.submitted}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedLifecycleState('ARCHIVED')}
            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
              selectedLifecycleState === 'ARCHIVED'
                ? 'bg-slate-200 dark:bg-slate-700 border-slate-400 dark:border-slate-500 shadow-xs'
                : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <div className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
              <Archive className="w-2.5 h-2.5" />
              Archived / Void
            </div>
            <div className="text-base sm:text-lg font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5">
              {(queryResult.stats.archived || 0) + (queryResult.stats.voided || 0)}
            </div>
          </button>
        </div>
      </div>

      {/* 3. Filter Controls Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 sm:p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by report code, title, category, author, or NBE ref..."
              className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-ob-blue-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Report Category / Type Dropdown */}
          <div className="flex items-center gap-2">
            <select
              value={selectedReportType}
              onChange={(e) => setSelectedReportType(e.target.value)}
              className="py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ob-blue-500 cursor-pointer"
            >
              <option value="ALL">All Categories</option>
              {Array.from(new Set(templates.map((t) => t.Category).filter(Boolean))).map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            {/* Frequency Dropdown */}
            <select
              value={selectedFrequency}
              onChange={(e) => setSelectedFrequency(e.target.value)}
              className="py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ob-blue-500 cursor-pointer"
            >
              <option value="ALL">All Frequencies</option>
              <option value="MONTHLY">Monthly</option>
              <option value="QUARTERLY">Quarterly</option>
              <option value="ANNUAL">Annual</option>
            </select>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ob-blue-500 cursor-pointer"
            >
              <option value="updatedAt">Sort: Last Updated</option>
              <option value="createdAt">Sort: Created Date</option>
              <option value="reportKey">Sort: Return Code</option>
              <option value="title">Sort: Title</option>
              <option value="version">Sort: Version</option>
            </select>

            <button
              type="button"
              onClick={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
              title={`Sorting ${sortOrder.toUpperCase()}`}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <ArrowUpDown className="w-4 h-4" />
            </button>

            {/* View Mode Toggle */}
            <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-800/60">
              <button
                type="button"
                onClick={() => setViewMode('GRID')}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'GRID'
                    ? 'bg-white dark:bg-slate-700 text-ob-blue-600 dark:text-ob-blue-400 shadow-xs'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
                title="Grid Cards View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('TABLE')}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'TABLE'
                    ? 'bg-white dark:bg-slate-700 text-ob-blue-600 dark:text-ob-blue-400 shadow-xs'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
                title="Compact Table View"
              >
                <ListIcon className="w-3.5 h-3.5" />
              </button>
            </div>

            <MaximizeButton
              onClick={() => setIsMaximized(true)}
              title="Maximize Regulatory Dossier Archive (Esc to restore)"
            />
          </div>
        </div>

        {/* Date Range Sub-Bar */}
        <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>Date Range:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="py-1 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs focus:ring-1 focus:ring-ob-blue-500"
            />
            <span>to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="py-1 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs focus:ring-1 focus:ring-ob-blue-500"
            />
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="text-[11px] text-ob-blue-600 dark:text-ob-blue-400 hover:underline cursor-pointer ml-1"
              >
                Clear Dates
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span>
              Showing <strong className="text-slate-800 dark:text-slate-200">{queryResult.items.length}</strong> of{' '}
              <strong className="text-slate-800 dark:text-slate-200">{queryResult.total}</strong> records
            </span>
            {(searchQuery || selectedLifecycleState !== 'ALL' || selectedReportType !== 'ALL' || selectedFrequency !== 'ALL' || startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedLifecycleState('ALL');
                  setSelectedReportType('ALL');
                  setSelectedFrequency('ALL');
                  setStartDate('');
                  setEndDate('');
                }}
                className="text-[11px] font-bold text-red-600 dark:text-red-400 hover:underline cursor-pointer ml-2"
              >
                Reset All Filters
              </button>
            )}
          </div>
        </div>

        {/* Phase 50: Batch Action Bar (Boundary-Safe, Responsive & Scrollable) */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 overflow-x-auto touch-scroll-x min-w-0 max-w-full">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={toggleSelectAllEligible}
              className="min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer"
            >
              {selectedSubIds.length > 0 ? (
                <CheckSquare className="w-3.5 h-3.5 text-ob-blue-600 dark:text-ob-blue-400" />
              ) : (
                <Square className="w-3.5 h-3.5" />
              )}
              <span>
                {selectedSubIds.length > 0
                  ? `Selected (${selectedSubIds.length})`
                  : currentUser.role === 'MAKER'
                  ? 'Select Drafts'
                  : 'Select All Eligible'}
              </span>
            </button>

            {selectedSubIds.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedSubIds([])}
                className="min-h-[38px] px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-semibold cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {currentUser.role === 'MAKER' ? (
              <button
                type="button"
                disabled={selectedSubIds.length === 0}
                onClick={handleOpenBatchModal}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                <span>Submit to Checker ({selectedSubIds.length})</span>
              </button>
            ) : currentUser.role === 'CHECKER' ? (
              <button
                type="button"
                disabled={selectedSubIds.length === 0}
                onClick={handleOpenBatchModal}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                <span>Submit to NBE ({selectedSubIds.length})</span>
              </button>
            ) : null}
          </div>
        </div>

        {batchResultBanner && (
          <div className="mt-2 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 flex items-center justify-between gap-2">
            <span className="font-mono font-semibold">{batchResultBanner}</span>
            <button
              type="button"
              onClick={() => setBatchResultBanner(null)}
              className="text-emerald-600 hover:text-emerald-800 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* 4. Main Body: Cards Grid or Table */}
      {queryResult.items.length === 0 ? (
        /* Empty State */
        <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 flex flex-col items-center justify-center text-center shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center mb-3">
            <BookOpen className="w-7 h-7" />
          </div>
          <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-white mb-1">
            No Regulatory Returns Found
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-4">
            {searchQuery || selectedLifecycleState !== 'ALL' || selectedReportType !== 'ALL' || startDate || endDate
              ? 'No reports match your selected search criteria or lifecycle filters. Try broadening your parameters.'
              : 'Your department library currently has no active returns or drafts.'}
          </p>
          <div className="flex items-center gap-2">
            {(searchQuery || selectedLifecycleState !== 'ALL' || selectedReportType !== 'ALL' || startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedLifecycleState('ALL');
                  setSelectedReportType('ALL');
                  setSelectedFrequency('ALL');
                  setStartDate('');
                  setEndDate('');
                }}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Clear Filters
              </button>
            )}
            {onCreateDraft && (
              <button
                type="button"
                onClick={() => setIsNewReturnModalOpen(true)}
                className="px-3.5 py-1.5 rounded-xl bg-ob-blue-600 hover:bg-ob-blue-700 text-white text-xs font-bold shadow-md cursor-pointer"
              >
                Create New Return
              </button>
            )}
          </div>
        </div>
      ) : viewMode === 'GRID' ? (
        /* Cards View (Grid) */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
          {queryResult.items.map((sub) => {
            const report = getReportByKey(sub.reportKey);
            const title = report?.Title || sub.reportKey;
            const lState = deriveLibraryLifecycleState(sub);
            const editable = isEditable(sub);
            const submitted = isSubmittedState(sub);

            return (
              <div
                key={sub.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-3 group"
              >
                {/* Card Header */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={() => toggleSelectSub(sub.id)}
                        aria-label={`Select return ${sub.reportKey}`}
                        className="mt-0.5 p-1 rounded-lg text-slate-400 hover:text-ob-blue-600 cursor-pointer"
                      >
                        {selectedSubIds.includes(sub.id) ? (
                          <CheckSquare className="w-4 h-4 text-ob-blue-600 dark:text-ob-blue-400" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-ob-blue-600 dark:text-ob-blue-400">
                            {sub.reportKey}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                            v{sub.version}
                          </span>
                          {sub.reusedFromSubmissionId && (
                            <span
                              title={`Reused from Return (v${sub.reusedFromVersion || 1})`}
                              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center gap-0.5"
                            >
                              <Copy className="w-2.5 h-2.5" />
                              REUSED
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1 mt-0.5">
                          {title}
                        </h4>
                      </div>
                    </div>
                    {renderLifecycleBadge(lState)}
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                    {report?.Description || 'Statutory regulatory return prepared under NBE Directive BSD/03/2020.'}
                  </p>
                </div>

                {/* Metadata & Status */}
                <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-2.5 space-y-1.5 text-[11px] border border-slate-100 dark:border-slate-800/60">
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                    <span className="text-slate-400">Department:</span>
                    <span className="font-semibold truncate max-w-[180px]">
                      {sub.department || report?.department || 'Credit Operations'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                    <span className="text-slate-400">Prepared By:</span>
                    <span className="font-medium truncate max-w-[180px]">{sub.makerName}</span>
                  </div>

                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                    <span className="text-slate-400">Last Updated:</span>
                    <span className="font-mono text-[10px]">
                      {new Date(sub.updatedAt || sub.createdAt).toLocaleDateString()}{' '}
                      {new Date(sub.updatedAt || sub.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {sub.nbeReferenceNumber && (
                    <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 font-mono text-[10px] pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                      <span>NBE Receipt:</span>
                      <span className="font-bold">{sub.nbeReferenceNumber}</span>
                    </div>
                  )}
                </div>

                {/* Card Actions Footer */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1">
                    {/* View / Inspect (Available for all roles) */}
                    <button
                      type="button"
                      onClick={() => onSelectSubmission(sub)}
                      className={`px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 cursor-pointer font-bold ${
                        currentUser.role === 'MAKER' && editable
                          ? 'bg-ob-blue-600 hover:bg-ob-blue-700 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold'
                      }`}
                    >
                      {currentUser.role === 'MAKER' && editable ? (
                        <>
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Continue</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          <span>{currentUser.role === 'AUDITOR' ? 'Inspect' : 'View'}</span>
                        </>
                      )}
                    </button>

                    {/* MAKER ONLY: Validate & Submit for Drafts */}
                    {currentUser.role === 'MAKER' && editable && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleExecuteValidate(sub)}
                          className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                          title="Validate against NBE rules"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="hidden sm:inline">Validate</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSubmitTargetSub(sub)}
                          className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                          title="Submit to Checker review"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Submit</span>
                        </button>
                      </>
                    )}

                    {/* CHECKER ONLY: Review & Sign-Off */}
                    {currentUser.role === 'CHECKER' && sub.status === 'PENDING_CHECKER' && (
                      <button
                        type="button"
                        onClick={() => handleOpenCheckerReview(sub)}
                        className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs cursor-pointer animate-pulse"
                        title="Perform 4-Eyes Review & Sign-Off"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Review</span>
                      </button>
                    )}

                    {/* CHECKER / AUDITOR / ADMIN: Add Comment / Note */}
                    {currentUser.role !== 'MAKER' && (
                      <button
                        type="button"
                        onClick={() => handleOpenComment(sub)}
                        className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs flex items-center gap-1 cursor-pointer"
                        title="Add review/audit note"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                        <span className="hidden sm:inline">Note</span>
                      </button>
                    )}

                    {/* CHECKER ONLY: Flag Dossier */}
                    {currentUser.role === 'CHECKER' && (
                      <button
                        type="button"
                        onClick={() => handleOpenFlag(sub)}
                        className={`p-1.5 rounded-xl transition-colors cursor-pointer border ${
                          sub.flagged
                            ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/40 dark:border-red-800'
                            : 'border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600'
                        }`}
                        title={sub.flagged ? 'Clear compliance flag' : 'Flag for attention'}
                      >
                        <Flag className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* AUDITOR & ADMIN: Event Trail / History Inspector */}
                    {(currentUser.role === 'AUDITOR' || currentUser.role === 'ADMIN') && (
                      <button
                        type="button"
                        onClick={() => handleOpenHistory(sub)}
                        className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs flex items-center gap-1 cursor-pointer"
                        title="Inspect version history and event trail"
                      >
                        <History className="w-3.5 h-3.5 text-indigo-500" />
                        <span className="hidden sm:inline">History</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {/* MAKER ONLY: Reuse as New Return */}
                    {currentUser.role === 'MAKER' && submitted && (
                      <button
                        type="button"
                        onClick={() => handleExecuteReuse(sub)}
                        className="px-2.5 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        title="Reuse return baseline to create a new draft"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Reuse as New</span>
                      </button>
                    )}

                    {/* MAKER & ADMIN: Delete Draft (Strictly unsubmitted drafts only) */}
                    {(currentUser.role === 'MAKER' || currentUser.role === 'ADMIN') && editable && (
                      <button
                        type="button"
                        onClick={() => setDeleteTargetSub(sub)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                        title="Delete unsubmitted draft"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}

                    {/* ADMIN ONLY: Governed Removal of Submitted Dossiers (Requirement 7 & 8) */}
                    {currentUser.role === 'ADMIN' && submitted && (
                      <button
                        type="button"
                        onClick={() => handleOpenAdminRemoval(sub)}
                        className="p-1.5 rounded-xl text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 border border-amber-200 dark:border-amber-800 transition-colors cursor-pointer"
                        title="Governed Administrative Removal (Archive / Void with retention)"
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View (Compact) */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto min-w-full touch-scroll-x">
            <table className="min-w-[700px] w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 uppercase font-mono text-[10px]">
                <tr>
                  <th className="py-3 px-3 w-8">
                    <button
                      type="button"
                      onClick={toggleSelectAllEligible}
                      aria-label="Select all eligible returns"
                      className="p-1 rounded text-slate-400 hover:text-ob-blue-600 cursor-pointer"
                    >
                      {selectedSubIds.length > 0 ? (
                        <CheckSquare className="w-3.5 h-3.5 text-ob-blue-600" />
                      ) : (
                        <Square className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4">Code & Title</th>
                  <th className="py-3 px-3">Lifecycle State</th>
                  <th className="py-3 px-3">Department</th>
                  <th className="py-3 px-3">Ver</th>
                  <th className="py-3 px-3">Prepared By</th>
                  <th className="py-3 px-3">Last Modified</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {queryResult.items.map((sub) => {
                  const report = getReportByKey(sub.reportKey);
                  const title = report?.Title || sub.reportKey;
                  const lState = deriveLibraryLifecycleState(sub);
                  const editable = isEditable(sub);
                  const submitted = isSubmittedState(sub);

                  return (
                    <tr
                      key={sub.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="py-3 px-3">
                        <button
                          type="button"
                          onClick={() => toggleSelectSub(sub.id)}
                          aria-label={`Select row ${sub.reportKey}`}
                          className="p-1 rounded text-slate-400 hover:text-ob-blue-600 cursor-pointer"
                        >
                          {selectedSubIds.includes(sub.id) ? (
                            <CheckSquare className="w-3.5 h-3.5 text-ob-blue-600" />
                          ) : (
                            <Square className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-ob-blue-600 dark:text-ob-blue-400">
                            {sub.reportKey}
                          </span>
                          {sub.reusedFromSubmissionId && (
                            <span className="text-[9px] font-mono px-1 rounded bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
                              REUSED
                            </span>
                          )}
                          {sub.flagged && (
                            <span className="text-[9px] font-bold px-1 rounded bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-300">
                              FLAGGED
                            </span>
                          )}
                        </div>
                        <div className="text-slate-900 dark:text-white font-medium line-clamp-1 max-w-xs">
                          {title}
                        </div>
                      </td>

                      <td className="py-3 px-3">{renderLifecycleBadge(lState)}</td>

                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                        {sub.department || report?.department || 'Credit Operations'}
                      </td>

                      <td className="py-3 px-3 font-mono font-semibold text-slate-700 dark:text-slate-300">
                        v{sub.version}
                      </td>

                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                        {sub.makerName}
                      </td>

                      <td className="py-3 px-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {new Date(sub.updatedAt || sub.createdAt).toLocaleDateString()}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {currentUser.role === 'MAKER' && editable ? (
                            <button
                              type="button"
                              onClick={() => onSelectSubmission(sub)}
                              className="px-2.5 py-1 rounded-lg bg-ob-blue-600 hover:bg-ob-blue-700 text-white font-bold text-[11px] cursor-pointer"
                            >
                              Edit
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onSelectSubmission(sub)}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-[11px] cursor-pointer"
                            >
                              {currentUser.role === 'AUDITOR' ? 'Inspect' : 'View'}
                            </button>
                          )}

                          {currentUser.role === 'MAKER' && editable && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleExecuteValidate(sub)}
                                className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
                                title="Validate"
                              >
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setSubmitTargetSub(sub)}
                                className="p-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                                title="Submit to Checker"
                              >
                                <Send className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}

                          {currentUser.role === 'CHECKER' && sub.status === 'PENDING_CHECKER' && (
                            <button
                              type="button"
                              onClick={() => handleOpenCheckerReview(sub)}
                              className="px-2 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold cursor-pointer"
                              title="Review"
                            >
                              Review
                            </button>
                          )}

                          {currentUser.role === 'CHECKER' && (
                            <button
                              type="button"
                              onClick={() => handleOpenFlag(sub)}
                              className={`p-1 rounded-lg cursor-pointer ${
                                sub.flagged
                                  ? 'text-red-600 bg-red-50 dark:bg-red-950/40'
                                  : 'text-slate-400 hover:text-slate-600'
                              }`}
                              title={sub.flagged ? 'Flagged' : 'Flag'}
                            >
                              <Flag className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {currentUser.role !== 'MAKER' && (
                            <button
                              type="button"
                              onClick={() => handleOpenComment(sub)}
                              className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
                              title="Add Note"
                            >
                              <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                            </button>
                          )}

                          {(currentUser.role === 'AUDITOR' || currentUser.role === 'ADMIN') && (
                            <button
                              type="button"
                              onClick={() => handleOpenHistory(sub)}
                              className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
                              title="History & Events"
                            >
                              <History className="w-3.5 h-3.5 text-indigo-500" />
                            </button>
                          )}

                          {currentUser.role === 'MAKER' && submitted && (
                            <button
                              type="button"
                              onClick={() => handleExecuteReuse(sub)}
                              className="px-2 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-100 text-[11px] font-semibold cursor-pointer"
                              title="Reuse as New"
                            >
                              Reuse
                            </button>
                          )}

                          {/* Delete Action (Strictly for unsubmitted drafts only) */}
                          {(currentUser.role === 'MAKER' || currentUser.role === 'ADMIN') &&
                            editable && (
                              <button
                                type="button"
                                onClick={() => setDeleteTargetSub(sub)}
                                className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                                title="Delete draft"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}

                          {/* Governed Removal for Admin */}
                          {currentUser.role === 'ADMIN' && submitted && (
                            <button
                              type="button"
                              onClick={() => handleOpenAdminRemoval(sub)}
                              className="p-1 rounded-lg text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 border border-amber-200 dark:border-amber-800 cursor-pointer"
                              title="Governed Removal"
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. Pagination Controls */}
      {queryResult.totalPages > 1 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-xs flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 dark:text-slate-400">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="py-1 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs cursor-pointer"
            >
              <option value="6">6</option>
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-slate-600 dark:text-slate-300 font-semibold">
              Page {queryResult.page} of {queryResult.totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(queryResult.totalPages, p + 1))}
              disabled={currentPage >= queryResult.totalPages}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 6. Delete Confirmation Dialog (Requirement 9) */}
      {deleteTargetSub && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0 border border-red-200 dark:border-red-800">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Confirm Deletion of Saved Draft
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Are you sure you want to permanently delete this unsubmitted report draft?
                </p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 text-xs space-y-1 border border-slate-200 dark:border-slate-700">
              <div className="font-mono font-bold text-ob-blue-600 dark:text-ob-blue-400">
                {deleteTargetSub.reportKey} (v{deleteTargetSub.version})
              </div>
              <div className="text-slate-700 dark:text-slate-300 font-medium">
                {getReportByKey(deleteTargetSub.reportKey)?.Title}
              </div>
              <div className="text-slate-400 text-[10px]">
                Status: {deleteTargetSub.status} • Last Saved:{' '}
                {new Date(deleteTargetSub.updatedAt || deleteTargetSub.createdAt).toLocaleString()}
              </div>
            </div>

            <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-200 dark:border-amber-800">
              ⚠️ Warning: This action cannot be reversed. All unsubmitted changes will be purged from the repository.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteTargetSub(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md shadow-red-600/20 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete Draft'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Submit to Checker Modal */}
      {submitTargetSub && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="max-w-lg w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-800">
                <Send className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Submit Return to Checker Queue
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Submit <strong className="font-mono text-slate-700 dark:text-slate-300">{submitTargetSub.reportKey}</strong> for 4-eyes principle verification.
                </p>
              </div>
            </div>

            {/* Phase 36: Server-side Checker selector */}
            <CheckerSelector
              reportKey={submitTargetSub.reportKey}
              currentUser={currentUser}
              selectedCheckerIds={selectedCheckerIds}
              onChangeSelectedCheckers={setSelectedCheckerIds}
              submission={submitTargetSub}
            />

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Maker Preparation Notes / Comments
              </label>
              <textarea
                value={submitComment}
                onChange={(e) => setSubmitComment(e.target.value)}
                placeholder="Detail verification steps, reconciliation notes, or ledger references..."
                rows={3}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-ob-blue-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSubmitTargetSub(null)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteSubmit}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Submitting...' : 'Confirm Submission'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 50: Batch Submission Confirmation Modal (Boundary-safe & Responsive) */}
      {isBatchSubmitModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="max-w-lg w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-800">
                <Send className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {currentUser.role === 'MAKER'
                    ? `Batch Submit ${selectedSubIds.length} Return(s) to Checker`
                    : `Batch Submit ${selectedSubIds.length} Return(s) to NBE Gateway`}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {currentUser.role === 'MAKER'
                    ? 'Trigger a single governed batch submission to the department Checker 4-eyes review queue.'
                    : 'Trigger a single authorized batch transmission directly to the National Bank of Ethiopia Gateway.'}
                </p>
              </div>
            </div>

            {/* Selected Returns Summary List (Strict max-h boundary with internal vertical scroll) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Selected Returns ({selectedSubmissions.length})</span>
                <span className="text-[10px] text-slate-400">Scroll to view all</span>
              </label>
              <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-2 space-y-1.5 divide-y divide-slate-200/60 dark:divide-slate-700/60">
                {selectedSubmissions.map((s) => (
                  <div key={s.id} className="pt-1 first:pt-0 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-mono font-bold text-ob-blue-600 dark:text-ob-blue-400 mr-2">
                        {s.reportKey}
                      </span>
                      <span className="text-slate-700 dark:text-slate-300 font-medium truncate max-w-[200px]">
                        {getReportByKey(s.reportKey)?.Title || s.reportKey}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold">
                      {s.status} (v{s.version})
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* For Makers: Checker Selector */}
            {currentUser.role === 'MAKER' && selectedSubmissions.length > 0 && (
              <CheckerSelector
                reportKey={selectedSubmissions[0].reportKey}
                currentUser={currentUser}
                selectedCheckerIds={batchCheckerIds}
                onChangeSelectedCheckers={setBatchCheckerIds}
                submission={selectedSubmissions[0]}
              />
            )}

            {/* Shared Bulk Comment */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Shared Bulk Comment / Verification Notes *
              </label>
              <textarea
                value={batchSubmitComment}
                onChange={(e) => setBatchSubmitComment(e.target.value)}
                placeholder="Enter verification notes applied to all returns in this batch..."
                rows={3}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-ob-blue-500 font-medium"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsBatchSubmitModalOpen(false)}
                disabled={isBatchProcessing}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteBatchSubmission}
                disabled={isBatchProcessing || selectedSubIds.length === 0}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isBatchProcessing ? (
                  <span>Processing Batch...</span>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>
                      {currentUser.role === 'MAKER' ? 'Confirm Submit to Checker' : 'Confirm Submit to NBE'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Validation Inspection Modal */}
      {validateTargetSub && validationResult && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="max-w-lg w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    validationResult.isValid
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                      : 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                  }`}
                >
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Validation Summary: {validateTargetSub.reportKey}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    NBE Directive validation engines & mathematical integrity checks
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setValidateTargetSub(null);
                  setValidationResult(null);
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Status:</span>
                {validationResult.isValid ? (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold">
                    ✓ All statutory rules satisfied
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-md bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 font-bold">
                    {validationResult.errors?.length || 0} validation issue(s) detected
                  </span>
                )}
              </div>

              {validationResult.errors && validationResult.errors.length > 0 && (
                <div className="space-y-1.5">
                  <span className="font-bold text-slate-700 dark:text-slate-300 block">Issues list:</span>
                  {validationResult.errors.map((err: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs"
                    >
                      <div className="font-bold">{err.ruleName || err.code || 'Validation Error'}</div>
                      <div className="text-[11px] opacity-90 mt-0.5">{err.message}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setValidateTargetSub(null);
                  setValidationResult(null);
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. Quick New Return Draft Modal */}
      {isNewReturnModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="max-w-lg w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-ob-blue-50 dark:bg-ob-blue-950/60 text-ob-blue-600 dark:text-ob-blue-400 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Initiate New Regulatory Return Draft
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Select an authorized template from your department's catalog
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNewReturnModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {authorizedTemplates.map((tpl) => (
                <div
                  key={tpl.ReturnKey}
                  onClick={() => {
                    if (onCreateDraft) onCreateDraft(tpl.ReturnKey);
                    setIsNewReturnModalOpen(false);
                  }}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-ob-blue-400 dark:hover:border-ob-blue-600 hover:bg-ob-blue-50/50 dark:hover:bg-ob-blue-950/30 transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-ob-blue-600 dark:text-ob-blue-400">
                        {tpl.Code}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {tpl.Frequency}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-800 dark:text-white">
                      {tpl.Title}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="px-2.5 py-1 rounded-lg bg-ob-blue-600 text-white text-[11px] font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Start
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsNewReturnModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10. Checker 4-Eyes Review & Sign-Off Modal (Requirement 1) */}
      {checkerReviewTargetSub && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-200 dark:border-amber-800">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Checker 4-Eyes Review & Sign-Off
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Review return <strong className="font-mono text-slate-700 dark:text-slate-300">{checkerReviewTargetSub.reportKey}</strong> (v{checkerReviewTargetSub.version}) prepared by {checkerReviewTargetSub.makerName}.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                Review Decision
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setCheckerReviewAction('APPROVE')}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                    checkerReviewAction === 'APPROVE'
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>Approve</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCheckerReviewAction('REQUEST_CORRECTION')}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                    checkerReviewAction === 'REQUEST_CORRECTION'
                      ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-500 text-amber-700 dark:text-amber-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span>Correction</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCheckerReviewAction('REJECT')}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                    checkerReviewAction === 'REJECT'
                      ? 'bg-red-50 dark:bg-red-950/50 border-red-500 text-red-700 dark:text-red-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <XCircle className="w-4 h-4 text-red-600" />
                  <span>Reject</span>
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Checker Comments / Reason
              </label>
              <textarea
                value={checkerReviewComment}
                onChange={(e) => setCheckerReviewComment(e.target.value)}
                placeholder={
                  checkerReviewAction === 'APPROVE'
                    ? 'Optional approval verification notes...'
                    : 'Detail the correction required or reason for rejection...'
                }
                rows={3}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setCheckerReviewTargetSub(null)}
                disabled={isReviewing}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteCheckerReview}
                disabled={isReviewing}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md shadow-amber-600/20 cursor-pointer disabled:opacity-50"
              >
                {isReviewing ? 'Submitting Review...' : 'Confirm Decision'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 11. Compliance Flagging Modal (Requirement 1) */}
      {flagTargetSub && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0 border border-red-200 dark:border-red-800">
                <Flag className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {flagTargetSub.flagged ? 'Clear Compliance Flag' : 'Flag Return for Attention'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {flagTargetSub.flagged
                    ? `Clear flag currently placed on ${flagTargetSub.reportKey}.`
                    : `Mark return ${flagTargetSub.reportKey} for compliance investigation or priority review.`}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Reason / Investigation Note
              </label>
              <textarea
                value={flagReason}
                onChange={(e) => setFlagReason(e.target.value)}
                placeholder="Detail reason for flagging or resolution note..."
                rows={3}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setFlagTargetSub(null)}
                disabled={isFlagging}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteFlag}
                disabled={isFlagging}
                className={`px-4 py-2 rounded-xl text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50 ${
                  flagTargetSub.flagged
                    ? 'bg-slate-700 hover:bg-slate-800'
                    : 'bg-red-600 hover:bg-red-700 shadow-red-600/20'
                }`}
              >
                {isFlagging ? 'Updating...' : flagTargetSub.flagged ? 'Clear Flag' : 'Apply Flag'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 12. Review / Audit Comment Note Modal (Requirement 1 & 2) */}
      {commentTargetSub && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-200 dark:border-blue-800">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Add Review / Audit Note
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Record an authoritative note on <strong className="font-mono text-slate-700 dark:text-slate-300">{commentTargetSub.reportKey}</strong>.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                Note Category
              </label>
              <select
                value={commentCategory}
                onChange={(e) => setCommentCategory(e.target.value as any)}
                className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
              >
                <option value="GENERAL">General Regulatory Note</option>
                <option value="CHECKER_QUERY">Checker Verification Query</option>
                <option value="CORRECTION_NOTE">Correction Instructions</option>
                <option value="AUDIT">Supervisory Audit Finding</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Note Content
              </label>
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Enter detailed review or supervisory note..."
                rows={3}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setCommentTargetSub(null)}
                disabled={isCommenting}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteAddComment}
                disabled={isCommenting || !commentText.trim()}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20 cursor-pointer disabled:opacity-50"
              >
                {isCommenting ? 'Saving...' : 'Add Note'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 13. Auditor & Admin Version History & Audit Trail Modal (Requirement 2) */}
      {historyTargetSub && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="max-w-2xl w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Regulatory Dossier History: {historyTargetSub.reportKey} (v{historyTargetSub.version})
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Audit inspection, version iterations, and immutable regulatory event trail
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHistoryTargetSub(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
              {/* Snapshot History */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <FileCheck2 className="w-3.5 h-3.5 text-indigo-500" />
                  Historical Snapshots ({historyTargetSub.historicalSnapshots?.length || 0})
                </h4>
                {(!historyTargetSub.historicalSnapshots || historyTargetSub.historicalSnapshots.length === 0) ? (
                  <p className="text-slate-400 text-[11px] italic">No prior snapshots recorded.</p>
                ) : (
                  <div className="space-y-1.5">
                    {historyTargetSub.historicalSnapshots.map((snap, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between"
                      >
                        <div>
                          <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                            v{snap.version} • {snap.status}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {snap.capturedBy} ({snap.capturedByRole}) • {snap.reason || 'Snapshot'}
                          </div>
                        </div>
                        <span className="font-mono text-[10px] text-slate-400">
                          {new Date(snap.timestamp).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Comments & Review Notes */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
                  Notes & Review Threads ({historyTargetSub.comments?.length || 0})
                </h4>
                {(!historyTargetSub.comments || historyTargetSub.comments.length === 0) ? (
                  <p className="text-slate-400 text-[11px] italic">No review notes recorded.</p>
                ) : (
                  <div className="space-y-1.5">
                    {historyTargetSub.comments.map((c, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-blue-900 dark:text-blue-300">
                            {c.userName} ({c.userRole})
                          </span>
                          <span className="text-slate-400 font-mono text-[10px]">
                            {new Date(c.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 dark:text-slate-300 mt-1">{c.comment}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Audit Events */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-indigo-500" />
                  Audit Trail Events ({dossierAuditEvents.length})
                </h4>
                {dossierAuditEvents.length === 0 ? (
                  <p className="text-slate-400 text-[11px] italic">No direct audit events indexed.</p>
                ) : (
                  <div className="space-y-1.5">
                    {dossierAuditEvents.slice(0, 15).map((ev, i) => (
                      <div
                        key={i}
                        className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-[11px] border border-slate-100 dark:border-slate-800/80 flex items-center justify-between"
                      >
                        <div>
                          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {ev.action}
                          </span>
                          <span className="text-slate-600 dark:text-slate-300 ml-1.5">
                            by {ev.actorName || ev.actorRole}
                          </span>
                          <div className="text-[10px] text-slate-400 truncate max-w-md">{ev.details}</div>
                        </div>
                        <span className="font-mono text-[10px] text-slate-400 shrink-0 ml-2">
                          {new Date(ev.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setHistoryTargetSub(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 text-xs font-semibold cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 14. Admin Governed Removal & Lifecycle Disposition Modal (Requirements 7 & 8) */}
      {adminRemovalTargetSub && removalAssessment && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="max-w-lg w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-200 dark:border-amber-800">
                <Archive className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Governed Regulatory Record Disposition
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Governed lifecycle management for <strong className="font-mono text-slate-700 dark:text-slate-300">{adminRemovalTargetSub.reportKey}</strong> (v{adminRemovalTargetSub.version}).
                </p>
              </div>
            </div>

            {/* Regulatory Retention Warning */}
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs space-y-1">
              <div className="font-bold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>Regulatory Retention Governance</span>
              </div>
              <p className="text-[11px] leading-relaxed">{removalAssessment.regulatoryWarning}</p>
            </div>

            {/* Impact Assessment Card */}
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 text-xs space-y-1.5 border border-slate-200 dark:border-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-500">Record Status:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{adminRemovalTargetSub.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Preserved Historical Snapshots:</span>
                <span className="font-bold text-emerald-600">{removalAssessment.affectedSnapshotsCount} snapshots</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Preserved Audit Trail Entries:</span>
                <span className="font-bold text-indigo-600">{removalAssessment.affectedAuditEntriesCount} entries</span>
              </div>
            </div>

            {/* Action Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                Governed Action
              </label>
              {removalAssessment.isSubmittedRecord ? (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdminRemovalAction('ARCHIVE')}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      adminRemovalAction === 'ARCHIVE'
                        ? 'bg-slate-100 dark:bg-slate-800 border-slate-500 text-slate-900 dark:text-white'
                        : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <Archive className="w-4 h-4 text-slate-600" />
                    <span>Archive Dossier</span>
                    <span className="text-[10px] font-normal text-slate-400">Retain full history</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminRemovalAction('VOID')}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      adminRemovalAction === 'VOID'
                        ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-700 dark:text-rose-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <XCircle className="w-4 h-4 text-rose-600" />
                    <span>Void Dossier</span>
                    <span className="text-[10px] font-normal text-slate-400">Nullify with retention</span>
                  </button>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 text-red-700 dark:text-red-300 text-xs font-bold flex items-center gap-2">
                  <Trash2 className="w-4 h-4" />
                  <span>Hard Delete Unsubmitted Draft</span>
                </div>
              )}
            </div>

            {/* Mandatory Justification */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Regulatory Justification (Mandatory, min 10 chars)</span>
                <span className={`text-[10px] font-mono ${adminRemovalReason.trim().length >= 10 ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {adminRemovalReason.trim().length}/10
                </span>
              </label>
              <textarea
                value={adminRemovalReason}
                onChange={(e) => setAdminRemovalReason(e.target.value)}
                placeholder="Provide official administrative justification under NBE governance..."
                rows={2}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Explicit Confirmation Checkbox (Requirement 8) */}
            <label className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={adminRemovalConfirmed}
                onChange={(e) => setAdminRemovalConfirmed(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
              <span>
                I confirm this governed action complies with NBE Directive BSD/03/2020 record retention rules.
              </span>
            </label>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setAdminRemovalTargetSub(null);
                  setRemovalAssessment(null);
                }}
                disabled={isRemoving}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteAdminRemoval}
                disabled={
                  isRemoving ||
                  !adminRemovalConfirmed ||
                  adminRemovalReason.trim().length < 10
                }
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md shadow-amber-600/20 cursor-pointer disabled:opacity-50"
              >
                {isRemoving ? 'Executing...' : 'Execute Governed Action'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PHASE 47: FULL VIEW / MAXIMIZED LIBRARY DOSSIER */}
      {isMaximized && (
        <MaximizedViewModal
          isOpen={isMaximized}
          onClose={() => setIsMaximized(false)}
          title="Regulatory Dossier Archive & Library"
          badge="Audit Archive"
          subtitle={`Complete lifecycle archive of ${queryResult.total} filings, unsubmitted drafts, and signed statutory returns`}
          icon={BookOpen}
        >
          <div className="space-y-4">
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto min-w-full touch-scroll-x">
                <table className="min-w-[800px] w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 font-bold uppercase font-mono text-[10px] sticky top-0 z-10">
                      <th className="py-3 px-4">Code & Title</th>
                      <th className="py-3 px-3">Lifecycle State</th>
                      <th className="py-3 px-3">Department</th>
                      <th className="py-3 px-3">Ver</th>
                      <th className="py-3 px-3">Prepared By</th>
                      <th className="py-3 px-3">Last Modified</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {queryResult.items.map((sub) => {
                      const report = getReportByKey(sub.reportKey);
                      const title = report?.Title || sub.reportKey;
                      const lState = deriveLibraryLifecycleState(sub);
                      const editable = isEditable(sub);

                      return (
                        <tr key={sub.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="py-2.5 px-4">
                            <span className="font-mono text-xs font-bold text-ob-indigo-700 dark:text-ob-indigo-400 bg-ob-indigo-50 dark:bg-ob-indigo-950/60 px-1.5 py-0.5 rounded border border-ob-indigo-200 dark:border-ob-indigo-800/60">
                              {sub.reportKey}
                            </span>
                            <div className="font-bold text-slate-900 dark:text-white mt-1 truncate max-w-sm">{title}</div>
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                lState === 'SUBMITTED'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                  : lState === 'RETURNED'
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                  : lState === 'IN_PROGRESS'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                              }`}
                            >
                              {lState}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                            {sub.department || 'Credit Operations'}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                            v{sub.version || 1}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                            {sub.makerName}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-500">
                            {new Date(sub.updatedAt).toLocaleDateString()}
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setIsMaximized(false);
                                  onSelectSubmission(sub);
                                }}
                                className="px-2.5 py-1 bg-ob-indigo-600 hover:bg-ob-indigo-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                              >
                                {editable && currentUser.role === 'MAKER' ? 'Edit' : 'View'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Showing {queryResult.items.length} of {queryResult.total} filings</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="px-2 font-mono">Page {currentPage} of {queryResult.totalPages || 1}</span>
                <button
                  type="button"
                  disabled={currentPage >= (queryResult.totalPages || 1)}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </MaximizedViewModal>
      )}
    </div>
  );
};
