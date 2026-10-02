/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  ReportMetadata,
  ReportSubmission,
  UserSession,
} from '../types/regulatory.ts';
import {
  Shield,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Send,
  FileText,
  UserCheck,
  AlertCircle,
  Search,
  Eye,
  MessageSquare,
  ArrowRight,
  RefreshCw,
  X,
  Building2,
  Lock,
  Key,
  HelpCircle,
  FileCheck,
  Archive,
  Download,
} from 'lucide-react';
import { ValidationEngine } from '../utils/validationEngine.ts';
import { Pagination } from './Pagination.tsx';
import { PdfReportGenerator } from '../utils/pdfReportGenerator.ts';
import { exportRegulatoryReportPDF } from '../utils/regulatoryReportPdfExport.ts';
import { exportRegulatoryReportXLSX } from '../utils/regulatoryReportXlsxExport.ts';
import { userService } from '../services/userService.ts';
import { getDepartmentForReport } from '../data/organizationHierarchy.ts';
import { SwipeableCard } from './SwipeableCard.tsx';
import { haptics, vibrate } from '../utils/haptics.ts';

interface CheckerInboxProps {
  submissions: ReportSubmission[];
  templates: ReportMetadata[];
  currentUser: UserSession;
  onReviewSubmission: (
    submissionId: string,
    action: 'APPROVE' | 'REJECT' | 'REQUEST_CORRECTION',
    comment: string
  ) => void;
  onDeliverToNBE?: (submissionId: string) => Promise<any>;
  onSwitchUser?: (user: UserSession) => void;
  onArchiveSubmission?: (submissionId: string) => void;
  checkerUser?: UserSession;
}

export const CheckerInbox: React.FC<CheckerInboxProps> = ({
  submissions,
  templates,
  currentUser,
  onReviewSubmission,
  onArchiveSubmission,
}) => {
  const [selectedSubForReview, setSelectedSubForReview] = useState<ReportSubmission | null>(null);
  const [reviewAction, setReviewAction] = useState<'APPROVE' | 'REJECT' | 'REQUEST_CORRECTION' | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('PENDING_CHECKER');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [archivedSubmissionIds, setArchivedSubmissionIds] = useState<string[]>([]);

  // Pagination state - 6 items per page
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  const categories = ['ALL', ...Array.from(new Set(templates.map((t) => t.Category || 'General')))];

  // Filter submissions based on Checker's Department and Special Access Grants
  const filteredSubmissions = submissions.filter((sub) => {
    if (archivedSubmissionIds.includes(sub.id)) {
      return false;
    }

    // Check if Checker is authorized for this submission
    const authCheck = userService.canCheckerReviewSubmission(currentUser, sub);

    // If Admin, allowed to view all; if Checker, must match department or have special access
    if (currentUser.role !== 'ADMIN' && !authCheck.allowed) {
      return false;
    }

    const tpl = templates.find((t) => t.ReturnKey === sub.reportKey);
    const title = tpl ? tpl.Title : sub.reportKey;
    const cat = tpl ? tpl.Category : 'General';

    const matchesStatus = filterStatus === 'ALL' || sub.status === filterStatus;
    const matchesCategory = filterCategory === 'ALL' || cat === filterCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      sub.reportKey.toLowerCase().includes(q) ||
      title.toLowerCase().includes(q) ||
      sub.makerName.toLowerCase().includes(q);

    return matchesStatus && matchesCategory && matchesSearch;
  });

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [filterStatus, filterCategory, searchQuery]);

  const paginatedSubmissions = filteredSubmissions.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  const pendingCount = submissions.filter((s) => {
    const auth = userService.canCheckerReviewSubmission(currentUser, s);
    return s.status === 'PENDING_CHECKER' && (currentUser.role === 'ADMIN' || auth.allowed);
  }).length;

  const approvedCount = submissions.filter((s) => {
    const auth = userService.canCheckerReviewSubmission(currentUser, s);
    return s.status === 'APPROVED' && (currentUser.role === 'ADMIN' || auth.allowed);
  }).length;

  const correctionCount = submissions.filter((s) => {
    const auth = userService.canCheckerReviewSubmission(currentUser, s);
    return s.status === 'CORRECTION_REQUIRED' && (currentUser.role === 'ADMIN' || auth.allowed);
  }).length;

  const sentCount = submissions.filter((s) => {
    const auth = userService.canCheckerReviewSubmission(currentUser, s);
    return s.status === 'SENT' && (currentUser.role === 'ADMIN' || auth.allowed);
  }).length;

  const handleOpenReview = (sub: ReportSubmission) => {
    setSelectedSubForReview(sub);
    setReviewAction(null);
    setReviewComment('');
  };

  const handleSubmitReview = (action: 'APPROVE' | 'REJECT' | 'REQUEST_CORRECTION') => {
    if (!selectedSubForReview) return;

    if (selectedSubForReview.makerId === currentUser.id) {
      haptics.error();
      alert('Segregation of Duties Violation: You cannot approve a submission that you created as Maker.');
      return;
    }

    const authCheck = userService.canCheckerReviewSubmission(currentUser, selectedSubForReview);
    if (!authCheck.allowed && currentUser.role !== 'ADMIN') {
      haptics.error();
      alert(`Access denied: ${authCheck.reason}`);
      return;
    }

    if (action === 'APPROVE') {
      haptics.success();
    } else if (action === 'REQUEST_CORRECTION') {
      haptics.warning();
    } else {
      haptics.error();
    }

    onReviewSubmission(
      selectedSubForReview.id,
      action,
      reviewComment || `${action} sign-off recorded by Checker ${currentUser.name} (${currentUser.department})`
    );
    setSelectedSubForReview(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            Draft
          </span>
        );
      case 'PENDING_CHECKER':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            Pending Sign-off
          </span>
        );
      case 'CORRECTION_REQUIRED':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-center gap-1">
            <AlertCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
            Correction Req.
          </span>
        );
      case 'APPROVED':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            Approved (Awaiting Maker Delivery)
          </span>
        );
      case 'SENT':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-purple-600 dark:text-purple-400" />
            Delivered to NBE
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden space-y-2.5 font-sans">
      {/* 1. Department 4-Eyes Governance Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-900 text-white rounded-xl p-3 shadow-sm border border-emerald-800/60 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-400 text-slate-950 uppercase tracking-wider">
                Checker 4-Eyes Queue
              </span>
              <span className="text-xs text-emerald-200 font-mono">
                {currentUser.employeeId || 'OB-CHK'}
              </span>
              <span className="text-slate-400 text-xs">•</span>
              <span className="text-xs font-semibold text-white flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-emerald-300" />
                {currentUser.department || 'Credit Operations & Portfolio Management'}
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Checkers independently review and sign off on submissions prepared by Makers in your department. Checkers do not fill or edit returns. Upon your approval, the report is returned to the Maker for final delivery to the NBE.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="bg-emerald-500/20 border border-emerald-400/40 rounded-lg px-2.5 py-1 text-xs text-emerald-200 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-300" />
              <span>Segregation of Duties Enforced</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Compact Metrics Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 shadow-2xs flex items-center justify-between transition-colors">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 block">Pending Sign-off</span>
            <div className="text-lg font-bold text-amber-700 dark:text-amber-400 leading-tight">{pendingCount}</div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Department review</span>
          </div>
          <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center border border-amber-200 dark:border-amber-800">
            <Clock className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 shadow-2xs flex items-center justify-between transition-colors">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">Approved by Checker</span>
            <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400 leading-tight">{approvedCount}</div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Returned to Maker</span>
          </div>
          <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 shadow-2xs flex items-center justify-between transition-colors">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 block">Correction Required</span>
            <div className="text-lg font-bold text-rose-700 dark:text-rose-400 leading-tight">{correctionCount}</div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Returned for edit</span>
          </div>
          <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 flex items-center justify-center border border-rose-200 dark:border-rose-800">
            <AlertCircle className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 shadow-2xs flex items-center justify-between transition-colors">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400 block">Delivered to NBE</span>
            <div className="text-lg font-bold text-purple-700 dark:text-purple-400 leading-tight">{sentCount}</div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Completed cycles</span>
          </div>
          <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 flex items-center justify-center border border-purple-200 dark:border-purple-800">
            <Send className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* 3. Filter Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 shadow-2xs flex flex-wrap items-center justify-between gap-2 shrink-0 transition-colors">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search return code, title, or Maker name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-ob-indigo-500 font-medium"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-700 dark:text-slate-300 font-medium focus:outline-none focus:ring-1 focus:ring-ob-indigo-500 cursor-pointer"
          >
            <option value="ALL">All Status ({submissions.length})</option>
            <option value="PENDING_CHECKER">Pending Sign-off ({pendingCount})</option>
            <option value="APPROVED">Approved ({approvedCount})</option>
            <option value="CORRECTION_REQUIRED">Needs Correction ({correctionCount})</option>
            <option value="SENT">Delivered to NBE ({sentCount})</option>
          </select>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-700 dark:text-slate-300 font-medium focus:outline-none focus:ring-1 focus:ring-ob-indigo-500 cursor-pointer"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === 'ALL' ? 'All Categories' : c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 4. Submissions Table */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs transition-colors">
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto touch-scroll-x">
          {paginatedSubmissions.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <Shield className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-2" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Department Submissions Found</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                No submissions currently match this filter. As Checkers review submissions from their own department ({currentUser.department}), returns prepared by Makers in your department will appear here.
              </p>
            </div>
          ) : (
            <>
              {/* Mobile View: Swipeable native cards */}
              <div className="sm:hidden p-2.5 space-y-2.5">
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium px-1 flex items-center justify-between">
                  <span>Swipe right to review • Swipe left to archive</span>
                  <span className="font-mono">{paginatedSubmissions.length} returns</span>
                </div>
                {paginatedSubmissions.map((sub) => {
                  const tpl = templates.find((t) => t.ReturnKey === sub.reportKey);
                  return (
                    <SwipeableCard
                      key={sub.id}
                      onSwipeRight={() => handleOpenReview(sub)}
                      rightActionLabel="Review"
                      rightActionIcon={<Shield className="w-5 h-5" />}
                      rightActionColor="bg-amber-600"
                      onSwipeLeft={() => {
                        vibrate(25);
                        setArchivedSubmissionIds((prev) => [...prev, sub.id]);
                        if (onArchiveSubmission) {
                          onArchiveSubmission(sub.id);
                        }
                      }}
                      leftActionLabel="Archive"
                      leftActionIcon={<Archive className="w-5 h-5" />}
                      leftActionColor="bg-slate-700 dark:bg-slate-800"
                    >
                      <div
                        onClick={() => handleOpenReview(sub)}
                        className="p-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl space-y-2 shadow-xs cursor-pointer touch-press"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono text-xs font-bold text-ob-indigo-700 dark:text-ob-indigo-300 bg-ob-indigo-50 dark:bg-ob-indigo-950 px-2 py-0.5 rounded border border-ob-indigo-200 dark:border-ob-indigo-800">
                            {sub.reportKey}
                          </span>
                          {getStatusBadge(sub.status)}
                        </div>

                        <div>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {tpl?.Title || sub.reportKey}
                          </h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                            Maker: {sub.makerName} ({sub.department || 'Credit Operations'})
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="font-mono">{sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString() : 'N/A'}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenReview(sub);
                            }}
                            className={`min-h-[44px] px-3.5 py-2 font-bold rounded-xl text-xs flex items-center gap-1.5 touch-manipulation touch-press cursor-pointer ${
                              sub.status === 'PENDING_CHECKER'
                                ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-2xs'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            <Eye className="w-4 h-4" />
                            <span>{sub.status === 'PENDING_CHECKER' ? '4-Eyes Review' : 'Audit Details'}</span>
                          </button>
                        </div>
                      </div>
                    </SwipeableCard>
                  );
                })}
              </div>

              {/* Tablet / Desktop Table View */}
              <div className="hidden sm:block overflow-x-auto min-w-full touch-scroll-x">
                <table className="w-full min-w-[700px] text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-semibold sticky top-0 z-10">
                    <th className="py-2.5 px-3">Return Code</th>
                    <th className="py-2.5 px-3">Report Name</th>
                    <th className="py-2.5 px-3">Department</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Maker Details</th>
                    <th className="py-2.5 px-3">Submitted At</th>
                    <th className="py-2.5 px-3 text-right">4-Eyes Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paginatedSubmissions.map((sub) => {
                    const tpl = templates.find((t) => t.ReturnKey === sub.reportKey);
                    const isSpecialAccess =
                      sub.department &&
                      currentUser.department &&
                      sub.department.toLowerCase() !== currentUser.department.toLowerCase();

                    return (
                      <tr key={sub.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-ob-indigo-700 dark:text-ob-indigo-300">
                          {sub.reportKey}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white max-w-xs truncate">
                          {tpl?.Title || sub.reportKey}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] text-slate-700 dark:text-slate-300">
                              {sub.department || getDepartmentForReport(sub.reportKey)}
                            </span>
                            {isSpecialAccess && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                                Delegated
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">{getStatusBadge(sub.status)}</td>
                        <td className="py-2.5 px-3">
                          <div className="text-slate-800 dark:text-slate-200 font-medium">{sub.makerName}</div>
                          <div className="text-[10px] text-slate-400">{sub.makerEmail}</div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                          {sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="py-2.5 px-3 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => exportRegulatoryReportPDF(sub)}
                            className="px-2 py-1 bg-ob-indigo-50 hover:bg-ob-indigo-100 dark:bg-ob-indigo-950/60 dark:hover:bg-ob-indigo-900/80 text-ob-indigo-700 dark:text-ob-indigo-300 border border-ob-indigo-200 dark:border-ob-indigo-800 font-bold rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                            title="Download NBE Signed PDF report return"
                          >
                            <FileCheck className="w-3 h-3 text-ob-indigo-600 dark:text-ob-indigo-400" />
                            <span>PDF</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => exportRegulatoryReportXLSX(sub, { officerName: currentUser.name, officerRole: currentUser.role })}
                            className="px-2 py-1 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-bold rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                            title="Export to NBE-compliant Excel .xlsx for offline review"
                          >
                            <Download className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                            <span>XLSX</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenReview(sub)}
                            className={`px-3 py-1 font-bold rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer ${
                              sub.status === 'PENDING_CHECKER'
                                ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-2xs'
                                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            <Eye className="w-3 h-3" />
                            <span>{sub.status === 'PENDING_CHECKER' ? 'Conduct 4-Eyes Review' : 'View Audit Details'}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
          )}
        </div>

        <div className="p-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 shrink-0">
          <Pagination
            currentPage={page}
            totalItems={filteredSubmissions.length}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[6, 9, 12, 24]}
          />
        </div>
      </div>

      {/* 5. 4-Eyes Review Modal */}
      {selectedSubForReview && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-2xl sm:rounded-2xl max-w-2xl w-full p-4 sm:p-5 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto pb-safe">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600 flex items-center justify-center border border-amber-200 dark:border-amber-800">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    4-Eyes Supervisory Review: {selectedSubForReview.reportKey}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Verify submission integrity prepared by Maker {selectedSubForReview.makerName} ({selectedSubForReview.department || 'Credit Operations'})
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => exportRegulatoryReportPDF(selectedSubForReview)}
                  className="px-2.5 py-1.5 bg-ob-indigo-600 hover:bg-ob-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title="Download official NBE Signed PDF"
                >
                  <FileCheck className="w-3.5 h-3.5" />
                  <span>PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => exportRegulatoryReportXLSX(selectedSubForReview, { officerName: currentUser.name, officerRole: currentUser.role })}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-xs border border-slate-200 dark:border-slate-700"
                  title="Download NBE-compliant Excel XLSX"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>XLSX</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSubForReview(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Submission Summary Metadata */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 border border-slate-200 dark:border-slate-700 text-xs">
              <div>
                <span className="text-slate-500 block text-[10px]">Return Department:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{selectedSubForReview.department || 'General'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Reporting Period:</span>
                <span className="font-semibold font-mono text-slate-900 dark:text-white">{selectedSubForReview.periodYear} (v{selectedSubForReview.version})</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Current Status:</span>
                <span className="font-semibold text-amber-600 dark:text-amber-400">{selectedSubForReview.status}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Populated Values:</span>
                <span className="font-semibold text-slate-900 dark:text-white font-mono">
                  {Object.keys(selectedSubForReview.values || {}).length} Line Items
                </span>
              </div>
            </div>

            {/* Comments & Audit Trail */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Submission History & Previous Comments
              </label>
              <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-3 max-h-36 overflow-y-auto space-y-2 border border-slate-200 dark:border-slate-700">
                {selectedSubForReview.comments.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No comments recorded on this submission.</p>
                ) : (
                  selectedSubForReview.comments.map((comm) => (
                    <div key={comm.id} className="text-xs pb-1.5 border-b border-slate-200/50 dark:border-slate-700/50 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 mb-0.5">
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          {comm.userName} ({comm.userRole})
                        </span>
                        <span className="font-mono text-[10px]">{new Date(comm.timestamp).toLocaleString()}</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 p-1.5 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                        {comm.comment}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Review Decision Input (Only active if PENDING_CHECKER) */}
            {selectedSubForReview.status === 'PENDING_CHECKER' ? (
              <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Checker Supervisory Comments & Audit Notes *
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Enter compliance verification findings, reconciliation references, or instructions for correction..."
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-ob-indigo-500 font-medium"
                  />
                </div>

                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                  <HelpCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    <strong>Segregation of Duties:</strong> Upon your Approval, the report returns to Maker {selectedSubForReview.makerName} to make the final official transmission to the National Bank of Ethiopia (NBE).
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => handleSubmitReview('REQUEST_CORRECTION')}
                    className="min-h-[44px] px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation touch-press"
                  >
                    <AlertCircle className="w-4 h-4" />
                    <span>Return for Correction</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSubmitReview('REJECT')}
                      className="min-h-[44px] flex-1 sm:flex-initial px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation touch-press"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Reject Return</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSubmitReview('APPROVE')}
                      className="min-h-[44px] flex-[1.5] sm:flex-initial px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer touch-manipulation touch-press"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Approve & Authorize Delivery</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-600 dark:text-slate-300 flex items-center justify-between">
                <span>Current state: <strong>{selectedSubForReview.status}</strong>. 4-Eyes review has been finalized.</span>
                <button
                  type="button"
                  onClick={() => setSelectedSubForReview(null)}
                  className="px-3 py-1 bg-slate-200 dark:bg-slate-700 rounded-lg text-xs font-bold"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
