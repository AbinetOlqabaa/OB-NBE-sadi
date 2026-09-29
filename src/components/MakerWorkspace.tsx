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
  FileText,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileSpreadsheet,
  Eye,
  Edit3,
  Layers,
  Download,
  LayoutGrid,
  List as ListIcon,
  Sparkles,
  X,
  Building2,
  Send,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  Key,
  BadgeAlert,
  HelpCircle,
  ExternalLink,
  Trash2,
  FileCheck,
} from 'lucide-react';
import { ExcelService } from '../utils/excelService.ts';
import { Pagination } from './Pagination.tsx';
import { userService } from '../services/userService.ts';
import { getDepartmentForReport } from '../data/organizationHierarchy.ts';
import { departmentService } from '../services/departmentService.ts';
import { SwipeableCard } from './SwipeableCard.tsx';
import { haptics } from '../utils/haptics.ts';
import { exportRegulatoryReportPDF } from '../utils/regulatoryReportPdfExport.ts';

interface MakerWorkspaceProps {
  templates: ReportMetadata[];
  submissions: ReportSubmission[];
  currentUser: UserSession;
  onSelectSubmission: (submission: ReportSubmission) => void;
  onCreateDraft: (reportKey: string) => void;
  onSubmitToChecker: (submissionId: string, comment?: string) => void;
  onDeliverToNBE?: (submissionId: string) => Promise<any>;
  onDeleteSubmission?: (submissionId: string) => void;
}

export const MakerWorkspace: React.FC<MakerWorkspaceProps> = ({
  templates,
  submissions,
  currentUser,
  onSelectSubmission,
  onCreateDraft,
  onSubmitToChecker,
  onDeliverToNBE,
  onDeleteSubmission,
}) => {
  const [activeTab, setActiveTab] = useState<'TEMPLATES' | 'SUBMISSIONS'>('TEMPLATES');
  const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('GRID');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedFrequency, setSelectedFrequency] = useState<string>('ALL');

  // Quick New Return Modal
  const [isNewReturnModalOpen, setIsNewReturnModalOpen] = useState(false);
  const [selectedModalReportKey, setSelectedModalReportKey] = useState<string>('');

  // Final NBE Delivery Confirmation Modal
  const [deliveringSub, setDeliveringSub] = useState<ReportSubmission | null>(null);
  const [isDelivering, setIsDelivering] = useState(false);
  const [deliveryFeedback, setDeliveryFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // Pagination states
  const [templatesPage, setTemplatesPage] = useState(1);
  const [templatesPageSize, setTemplatesPageSize] = useState(6);

  const [submissionsPage, setSubmissionsPage] = useState(1);
  const [submissionsPageSize, setSubmissionsPageSize] = useState(6);

  const [selectedSubmissionStatus, setSelectedSubmissionStatus] = useState<string>('ALL');
  const [, setDeptVersion] = useState(0);

  // Re-render when departments or report linkages change dynamically
  useEffect(() => {
    return departmentService.subscribe(() => {
      setDeptVersion((v) => v + 1);
    });
  }, []);

  // Allowed report keys based on user department + special access grants
  const allowedReportKeys = userService.getAllowedReportKeysForUser(currentUser);

  // Filter templates: Makers ONLY see reports they are authorized to access and fill
  const authorizedTemplates = templates.filter((tpl) => allowedReportKeys.includes(tpl.ReturnKey));

  // Determine special access keys (reports not from home department or M:N linked departments)
  const homeDeptReportKeys = currentUser.department
    ? templates
        .filter((t) => {
          const linked = departmentService.getDepartmentsForReport(t.ReturnKey);
          return (
            (t.department && t.department.toLowerCase() === currentUser.department?.toLowerCase()) ||
            linked.some((d) => d.toLowerCase() === currentUser.department?.toLowerCase())
          );
        })
        .map((t) => t.ReturnKey)
    : [];

  const specialAccessReportKeys = allowedReportKeys.filter((k) => !homeDeptReportKeys.includes(k));

  // Dynamically compute all distinct categories from authorized templates
  const dynamicCategories = ['ALL', ...Array.from(new Set(authorizedTemplates.map((t) => t.Category || 'General')))];

  // Reset pagination when filter changes
  useEffect(() => {
    setTemplatesPage(1);
  }, [searchQuery, selectedCategory, selectedFrequency]);

  useEffect(() => {
    setSubmissionsPage(1);
  }, [searchQuery, selectedSubmissionStatus]);

  // Filtering templates
  const filteredTemplates = authorizedTemplates.filter((tpl) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      tpl.Code.toLowerCase().includes(q) ||
      tpl.Title.toLowerCase().includes(q) ||
      tpl.ReturnKey.toLowerCase().includes(q) ||
      (tpl.Category && tpl.Category.toLowerCase().includes(q)) ||
      (tpl.Description && tpl.Description.toLowerCase().includes(q));

    const matchesCategory = selectedCategory === 'ALL' || tpl.Category === selectedCategory;
    const matchesFreq = selectedFrequency === 'ALL' || tpl.Frequency === selectedFrequency;

    return matchesSearch && matchesCategory && matchesFreq;
  });

  // Paginated templates slice
  const paginatedTemplates = filteredTemplates.slice(
    (templatesPage - 1) * templatesPageSize,
    templatesPage * templatesPageSize
  );

  // Filtering submissions - Maker sees submissions from their department or created by themselves
  const filteredSubmissions = submissions.filter((sub) => {
    const isOwner = sub.makerId === currentUser.id;
    const isDept = sub.department && currentUser.department && sub.department.toLowerCase() === currentUser.department.toLowerCase();
    const isSpecialAccess = specialAccessReportKeys.includes(sub.reportKey);

    if (!isOwner && !isDept && !isSpecialAccess && currentUser.role !== 'ADMIN') {
      return false;
    }

    const q = searchQuery.trim().toLowerCase();
    const tpl = templates.find((t) => t.ReturnKey === sub.reportKey);
    const title = tpl ? tpl.Title : sub.reportKey;
    const matchesSearch =
      !q ||
      sub.reportKey.toLowerCase().includes(q) ||
      title.toLowerCase().includes(q) ||
      sub.makerName.toLowerCase().includes(q);

    const matchesStatus =
      selectedSubmissionStatus === 'ALL' || sub.status === selectedSubmissionStatus;

    return matchesSearch && matchesStatus;
  });

  // Paginated submissions slice
  const paginatedSubmissions = filteredSubmissions.slice(
    (submissionsPage - 1) * submissionsPageSize,
    submissionsPage * submissionsPageSize
  );

  // Export blank template to XLSX
  const handleExportBlank = (tpl: ReportMetadata) => {
    const binary = ExcelService.exportToBinary(tpl, {}, {});
    const blob = new Blob([binary as any], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TEMPLATE_${tpl.Code}_${tpl.FinYear}.xlsx`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExecuteDeliver = async () => {
    if (!deliveringSub || !onDeliverToNBE) return;
    setIsDelivering(true);
    setDeliveryFeedback(null);
    try {
      const result = await onDeliverToNBE(deliveringSub.id);
      if (result.success) {
        setDeliveryFeedback({
          success: true,
          message: `Official transmission to NBE confirmed! Receipt: ${result.response?.receiptNumber || result.response?.submissionReceiptNumber || 'DELIVERED'}`,
        });
        setTimeout(() => {
          setDeliveringSub(null);
          setDeliveryFeedback(null);
        }, 3000);
      } else {
        setDeliveryFeedback({
          success: false,
          message: result.error || 'NBE Gateway rejected delivery payload.',
        });
      }
    } catch (err: any) {
      setDeliveryFeedback({
        success: false,
        message: err.message || 'Delivery request failed.',
      });
    } finally {
      setIsDelivering(false);
    }
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
            Pending Checker
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
            Approved (Ready to Deliver)
          </span>
        );
      case 'SENDING':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1 animate-pulse">
            <Send className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
            Transmitting...
          </span>
        );
      case 'SENT':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-purple-600 dark:text-purple-400" />
            Delivered to NBE
          </span>
        );
      case 'FAILED':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-center gap-1">
            <AlertCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
            Delivery Failed
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
      {/* 1. Department Role & Segregation Banner */}
      <div className="bg-gradient-to-r from-ob-indigo-900 via-indigo-950 to-slate-900 text-white rounded-xl p-3 shadow-sm border border-ob-indigo-800/60 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-slate-950 uppercase tracking-wider">
                Maker Portal
              </span>
              <span className="text-xs text-ob-indigo-200 font-mono">
                {currentUser.employeeId || 'OB-STAFF'}
              </span>
              <span className="text-slate-400 text-xs">•</span>
              <span className="text-xs font-semibold text-white flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-ob-indigo-300" />
                {currentUser.department || 'Credit Operations & Portfolio Management'}
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Department-bound returns workspace. As a Maker, you prepare and calculate returns for your department, submit to Checker for 4-eyes review, and perform the final transmission to NBE.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {specialAccessReportKeys.length > 0 && (
              <div className="bg-amber-500/20 border border-amber-400/40 rounded-lg px-2.5 py-1 text-xs text-amber-200 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-amber-300" />
                <span>{specialAccessReportKeys.length} Special Access Granted</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsNewReturnModalOpen(true)}
              className="px-3 py-1.5 bg-ob-indigo-500 hover:bg-ob-indigo-400 text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Initiate Return Form</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Top Filter and Navigation Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 shadow-2xs space-y-2 shrink-0 transition-colors">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search return code, title, category, or line items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-ob-indigo-500 font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Counts Indicator */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1 text-xs">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Department Returns:</span>
              <span className="font-mono font-bold text-ob-indigo-700 dark:text-ob-indigo-300 bg-ob-indigo-50 dark:bg-ob-indigo-950/60 px-1.5 py-0.2 rounded border border-ob-indigo-200 dark:border-ob-indigo-800">
                {activeTab === 'TEMPLATES' ? `${filteredTemplates.length} of ${authorizedTemplates.length}` : `${filteredSubmissions.length} active`}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs and Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5 overflow-x-auto touch-scroll-x pb-1 sm:pb-0">
            <button
              onClick={() => setActiveTab('TEMPLATES')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 touch-manipulation touch-press ${
                activeTab === 'TEMPLATES'
                  ? 'bg-ob-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Authorized Department Returns</span>
              <span
                className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                  activeTab === 'TEMPLATES'
                    ? 'bg-ob-indigo-700 text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                {filteredTemplates.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('SUBMISSIONS')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 touch-manipulation touch-press ${
                activeTab === 'SUBMISSIONS'
                  ? 'bg-ob-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Department Submissions</span>
              <span
                className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                  activeTab === 'SUBMISSIONS'
                    ? 'bg-ob-indigo-700 text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                {filteredSubmissions.length}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'TEMPLATES' ? (
              <>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-700 dark:text-slate-300 font-medium focus:outline-none focus:ring-1 focus:ring-ob-indigo-500 cursor-pointer"
                >
                  {dynamicCategories.map((c) => (
                    <option key={c} value={c} className="dark:bg-slate-900 dark:text-slate-200">
                      {c === 'ALL' ? 'All Categories' : c}
                    </option>
                  ))}
                </select>

                <div className="hidden lg:flex items-center gap-1">
                  {(['ALL', 'MONTHLY', 'QUARTERLY'] as const).map((freq) => (
                    <button
                      key={freq}
                      onClick={() => setSelectedFrequency(freq)}
                      className={`px-2 py-0.8 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                        selectedFrequency === freq
                          ? 'bg-ob-indigo-50 dark:bg-ob-indigo-950/80 text-ob-indigo-700 dark:text-ob-indigo-300 border border-ob-indigo-200 dark:border-ob-indigo-800'
                          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {freq}
                    </button>
                  ))}
                </div>

                <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 bg-slate-50 dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => setViewMode('GRID')}
                    className={`p-1 rounded text-xs transition-colors cursor-pointer ${
                      viewMode === 'GRID'
                        ? 'bg-white dark:bg-slate-700 text-ob-indigo-700 dark:text-white shadow-2xs font-bold'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('LIST')}
                    className={`p-1 rounded text-xs transition-colors cursor-pointer ${
                      viewMode === 'LIST'
                        ? 'bg-white dark:bg-slate-700 text-ob-indigo-700 dark:text-white shadow-2xs font-bold'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <ListIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
                  <Filter className="w-3 h-3 text-ob-indigo-600 dark:text-ob-indigo-400" />
                  Status:
                </span>
                <select
                  value={selectedSubmissionStatus}
                  onChange={(e) => setSelectedSubmissionStatus(e.target.value)}
                  className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-700 dark:text-slate-300 font-medium focus:outline-none focus:ring-1 focus:ring-ob-indigo-500 cursor-pointer"
                >
                  <option value="ALL" className="dark:bg-slate-900">All Status ({filteredSubmissions.length})</option>
                  <option value="DRAFT" className="dark:bg-slate-900">Draft</option>
                  <option value="PENDING_CHECKER" className="dark:bg-slate-900">Pending Checker</option>
                  <option value="CORRECTION_REQUIRED" className="dark:bg-slate-900">Correction Required</option>
                  <option value="APPROVED" className="dark:bg-slate-900">Approved (Ready for Delivery)</option>
                  <option value="SENT" className="dark:bg-slate-900">Delivered to NBE</option>
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Main Workspace Display Area */}
      {activeTab === 'TEMPLATES' ? (
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs transition-colors">
          <div className="flex-1 min-h-0 overflow-y-auto p-3">
            {paginatedTemplates.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <FileSpreadsheet className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-2" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Authorized Reports Found</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                  Your department is {currentUser.department || 'Unassigned'}. If you need access to other returns, request special access from the Compliance Administrator.
                </p>
              </div>
            ) : viewMode === 'GRID' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {paginatedTemplates.map((tpl) => {
                  const isSpecial = specialAccessReportKeys.includes(tpl.ReturnKey);
                  const existingSubmissions = submissions.filter((s) => s.reportKey === tpl.ReturnKey);
                  const latestSub = existingSubmissions[0];

                  return (
                    <div
                      key={tpl.ReturnKey}
                      className="bg-slate-50/60 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 rounded-xl p-3 flex flex-col justify-between hover:border-ob-indigo-400 dark:hover:border-ob-indigo-600 transition-all hover:shadow-xs group"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <span className="font-mono text-xs font-bold text-ob-indigo-700 dark:text-ob-indigo-400 bg-ob-indigo-50 dark:bg-ob-indigo-950/60 px-1.5 py-0.5 rounded border border-ob-indigo-200 dark:border-ob-indigo-800/60">
                            {tpl.Code}
                          </span>
                          <div className="flex items-center gap-1">
                            {isSpecial && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 flex items-center gap-0.5">
                                <Key className="w-2.5 h-2.5" />
                                Special Access
                              </span>
                            )}
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                              {tpl.Frequency}
                            </span>
                          </div>
                        </div>

                        <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1 group-hover:text-ob-indigo-600 dark:group-hover:text-ob-indigo-400 transition-colors">
                          {tpl.Title}
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-1 leading-snug">
                          {tpl.Description}
                        </p>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs">
                        <div>
                          {latestSub ? (
                            getStatusBadge(latestSub.status)
                          ) : (
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">No Draft Active</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleExportBlank(tpl)}
                            className="min-h-[44px] min-w-[44px] sm:min-h-[32px] sm:min-w-[32px] p-2 sm:p-1.5 rounded-xl sm:rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer flex items-center justify-center touch-manipulation touch-press"
                            title="Download Official Blank Excel (XLSX) Template"
                            aria-label="Download Excel template"
                          >
                            <Download className="w-4 h-4 sm:w-3 sm:h-3" />
                          </button>

                          {latestSub ? (
                            <button
                              type="button"
                              onClick={() => onSelectSubmission(latestSub)}
                              className="min-h-[44px] sm:min-h-[32px] px-3.5 py-2 sm:px-2.5 sm:py-1 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs sm:text-[11px] font-bold rounded-xl sm:rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer touch-manipulation touch-press"
                            >
                              <Edit3 className="w-3.5 h-3.5 sm:w-2.5 sm:h-2.5" />
                              <span>Open Form</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onCreateDraft(tpl.ReturnKey)}
                              className="min-h-[44px] sm:min-h-[32px] px-3.5 py-2 sm:px-2.5 sm:py-1 bg-ob-indigo-600 hover:bg-ob-indigo-700 text-white text-xs sm:text-[11px] font-bold rounded-xl sm:rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer touch-manipulation touch-press"
                            >
                              <Plus className="w-3.5 h-3.5 sm:w-2.5 sm:h-2.5" />
                              <span>Initiate Draft</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="overflow-x-auto min-w-full touch-scroll-x">
                <table className="min-w-[650px] w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-semibold sticky top-0 z-10">
                    <th className="py-2 px-3">Return Code</th>
                    <th className="py-2 px-3">Report Title</th>
                    <th className="py-2 px-3">Access Level</th>
                    <th className="py-2 px-3">Frequency</th>
                    <th className="py-2 px-3">Fields / Rosters</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paginatedTemplates.map((tpl) => {
                    const isSpecial = specialAccessReportKeys.includes(tpl.ReturnKey);
                    const existingSubmissions = submissions.filter((s) => s.reportKey === tpl.ReturnKey);
                    const latestSub = existingSubmissions[0];

                    return (
                      <tr key={tpl.ReturnKey} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-ob-indigo-700 dark:text-ob-indigo-400">
                          {tpl.Code}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white max-w-xs truncate">
                          {tpl.Title}
                        </td>
                        <td className="py-2.5 px-3">
                          {isSpecial ? (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 flex items-center gap-1 w-max">
                              <Key className="w-2.5 h-2.5" />
                              Special Access
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400">
                              Home Dept
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">{tpl.Frequency}</td>
                        <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                          {tpl.ReturnItemsList.length} items {tpl.DynamicItemsList.length > 0 ? `+ ${tpl.DynamicItemsList.length} schedules` : ''}
                        </td>
                        <td className="py-2.5 px-3">{latestSub ? getStatusBadge(latestSub.status) : <span className="text-slate-400 text-[10px]">No Draft</span>}</td>
                        <td className="py-2.5 px-3 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleExportBlank(tpl)}
                            className="p-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                            title="Export Excel Blank"
                          >
                            <Download className="w-3 h-3" />
                          </button>
                          {latestSub ? (
                            <button
                              type="button"
                              onClick={() => onSelectSubmission(latestSub)}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 text-white font-bold rounded-lg"
                            >
                              Open Form
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onCreateDraft(tpl.ReturnKey)}
                              className="px-2.5 py-1 bg-ob-indigo-600 hover:bg-ob-indigo-700 text-white font-bold rounded-lg"
                            >
                              Initiate Draft
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          </div>

          <div className="p-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 shrink-0">
            <Pagination
              currentPage={templatesPage}
              totalItems={filteredTemplates.length}
              pageSize={templatesPageSize}
              onPageChange={setTemplatesPage}
              onPageSizeChange={setTemplatesPageSize}
              pageSizeOptions={[6, 9, 12, 24]}
            />
          </div>
        </div>
      ) : (
        /* Submissions Tab */
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs transition-colors">
          <div className="flex-1 min-h-0 overflow-y-auto">
            {paginatedSubmissions.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <Clock className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Submissions Found</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Initiate a return draft from the Authorized Department Returns tab above.</p>
              </div>
            ) : (
              <>
                {/* Mobile View: Swipeable native cards with swipe-to-delete */}
                <div className="sm:hidden p-2.5 space-y-2.5">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium px-1 flex items-center justify-between">
                    <span>Swipe left on draft to delete • Tap to edit</span>
                    <span className="font-mono">{paginatedSubmissions.length} items</span>
                  </div>
                  {paginatedSubmissions.map((sub) => {
                    const tpl = templates.find((t) => t.ReturnKey === sub.reportKey);
                    const canDelete = sub.status === 'DRAFT' || sub.status === 'CORRECTION_REQUIRED' || sub.status === 'FAILED';

                    return (
                      <SwipeableCard
                        key={sub.id}
                        onSwipeLeft={canDelete && onDeleteSubmission ? () => onDeleteSubmission(sub.id) : undefined}
                        leftActionLabel="Delete"
                        leftActionIcon={<Trash2 className="w-5 h-5" />}
                        leftActionColor="bg-rose-600"
                        onSwipeRight={() => onSelectSubmission(sub)}
                        rightActionLabel="Open"
                        rightActionIcon={<Edit3 className="w-5 h-5" />}
                        rightActionColor="bg-ob-indigo-600"
                      >
                        <div
                          onClick={() => onSelectSubmission(sub)}
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
                              {sub.department || getDepartmentForReport(sub.reportKey)}
                            </p>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-[11px] text-slate-500 dark:text-slate-400">
                            <span className="font-mono">{sub.periodYear} (v{sub.version})</span>
                            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              {(sub.status === 'DRAFT' || sub.status === 'CORRECTION_REQUIRED') && (
                                <button
                                  type="button"
                                  onClick={() => onSubmitToChecker(sub.id)}
                                  className="min-h-[40px] px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs flex items-center gap-1 touch-press"
                                >
                                  <Clock className="w-3 h-3" />
                                  <span>Submit</span>
                                </button>
                              )}
                              {sub.status === 'APPROVED' && (
                                <button
                                  type="button"
                                  onClick={() => setDeliveringSub(sub)}
                                  className="min-h-[40px] px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center gap-1 touch-press animate-pulse"
                                >
                                  <Send className="w-3 h-3" />
                                  <span>NBE Send</span>
                                </button>
                              )}
                            </div>
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
                      <th className="py-2 px-3">Return Code</th>
                      <th className="py-2 px-3">Report Name</th>
                      <th className="py-2 px-3">Department</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Period</th>
                      <th className="py-2 px-3">Maker</th>
                      <th className="py-2 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {paginatedSubmissions.map((sub) => {
                      const tpl = templates.find((t) => t.ReturnKey === sub.reportKey);
                      return (
                        <tr key={sub.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-bold text-ob-indigo-700 dark:text-ob-indigo-300">
                            {sub.reportKey}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100 max-w-xs truncate">
                            {tpl?.Title || sub.reportKey}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 text-[11px]">
                            {sub.department || getDepartmentForReport(sub.reportKey)}
                          </td>
                          <td className="py-2.5 px-3">{getStatusBadge(sub.status)}</td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 font-mono">
                            {sub.periodYear} (v{sub.version})
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 font-medium">
                            {sub.makerName}
                          </td>
                          <td className="py-2.5 px-3 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => onSelectSubmission(sub)}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>{sub.status === 'DRAFT' ? 'Edit Draft' : 'View Return'}</span>
                            </button>

                            {/* Download Signed PDF */}
                            <button
                              type="button"
                              onClick={() => exportRegulatoryReportPDF(sub)}
                              className="px-2 py-1 bg-ob-indigo-50 hover:bg-ob-indigo-100 dark:bg-ob-indigo-950/60 dark:hover:bg-ob-indigo-900/80 text-ob-indigo-700 dark:text-ob-indigo-300 border border-ob-indigo-200 dark:border-ob-indigo-800 font-bold rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                              title="Download NBE-compliant signed PDF regulatory return document"
                            >
                              <FileCheck className="w-3 h-3 text-ob-indigo-600 dark:text-ob-indigo-400" />
                              <span>PDF</span>
                            </button>

                            {/* Submit to Checker */}
                            {(sub.status === 'DRAFT' || sub.status === 'CORRECTION_REQUIRED') && (
                              <button
                                type="button"
                                onClick={() => onSubmitToChecker(sub.id)}
                                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                                title="Submit prepared return for Checker 4-eyes review"
                              >
                                <Clock className="w-3 h-3" />
                                <span>Submit to Checker</span>
                              </button>
                            )}

                            {/* Final Submission to NBE by Maker */}
                            {sub.status === 'APPROVED' && (
                              <button
                                type="button"
                                onClick={() => setDeliveringSub(sub)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors inline-flex items-center gap-1 shadow-2xs cursor-pointer animate-pulse"
                                title="Approved by Checker. You can now execute the final official submission to the NBE."
                              >
                                <Send className="w-3 h-3" />
                                <span>Final Submit to NBE</span>
                              </button>
                            )}

                            {/* Retry Delivery if Failed */}
                            {sub.status === 'FAILED' && (
                              <button
                                type="button"
                                onClick={() => setDeliveringSub(sub)}
                                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Send className="w-3 h-3" />
                                <span>Retry NBE Delivery</span>
                              </button>
                            )}

                            {/* Delete Draft */}
                            {(sub.status === 'DRAFT' || sub.status === 'CORRECTION_REQUIRED' || sub.status === 'FAILED') && onDeleteSubmission && (
                              <button
                                type="button"
                                onClick={() => onDeleteSubmission(sub.id)}
                                className="p-1 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/80 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 rounded-lg transition-colors inline-flex items-center cursor-pointer"
                                title="Delete Draft"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
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
              currentPage={submissionsPage}
              totalItems={filteredSubmissions.length}
              pageSize={submissionsPageSize}
              onPageChange={setSubmissionsPage}
              onPageSizeChange={setSubmissionsPageSize}
              pageSizeOptions={[6, 9, 12, 24]}
            />
          </div>
        </div>
      )}

      {/* 4. Initiate New Return Modal (Strictly lists authorized returns) */}
      {isNewReturnModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-2xl sm:rounded-2xl max-w-lg w-full p-4 sm:p-5 shadow-2xl space-y-4 pb-safe">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-ob-indigo-50 dark:bg-ob-indigo-950 text-ob-indigo-600 flex items-center justify-center border border-ob-indigo-200 dark:border-ob-indigo-800">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Initiate New Return Form</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Select a return form assigned to your department ({currentUser.department})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNewReturnModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Department Return Form Selection *
              </label>
              <select
                value={selectedModalReportKey}
                onChange={(e) => setSelectedModalReportKey(e.target.value)}
                className="w-full min-h-[44px] text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-ob-indigo-500 font-medium cursor-pointer"
              >
                <option value="">-- Choose an authorized return ({authorizedTemplates.length} available) --</option>
                {authorizedTemplates.map((t) => {
                  const isSpecial = specialAccessReportKeys.includes(t.ReturnKey);
                  return (
                    <option key={t.ReturnKey} value={t.ReturnKey} className="dark:bg-slate-900 py-1">
                      {isSpecial ? '[Special Access] ' : ''}{t.Code} - {t.Title} ({t.Frequency})
                    </option>
                  );
                })}
              </select>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Only the {authorizedTemplates.length} returns bound to your department or delegated by the Administrator appear in this dropdown list.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsNewReturnModalOpen(false)}
                className="min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 touch-manipulation touch-press"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!selectedModalReportKey}
                onClick={() => {
                  if (selectedModalReportKey) {
                    onCreateDraft(selectedModalReportKey);
                    setIsNewReturnModalOpen(false);
                    setSelectedModalReportKey('');
                  }
                }}
                className="min-h-[44px] px-4 py-2 bg-ob-indigo-600 hover:bg-ob-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm transition-colors cursor-pointer touch-manipulation touch-press"
              >
                Create Return Draft
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Final NBE Delivery Modal for Maker */}
      {deliveringSub && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-2xl sm:rounded-2xl max-w-lg w-full p-4 sm:p-5 shadow-2xl space-y-4 pb-safe">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center border border-emerald-200 dark:border-emerald-800">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Final Submission to NBE</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Execute official electronic transmission to the National Bank of Ethiopia
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isDelivering}
                onClick={() => setDeliveringSub(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 space-y-2 border border-slate-200 dark:border-slate-700 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Return Key:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{deliveringSub.reportKey}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Department:</span>
                <span className="font-medium text-slate-900 dark:text-white">{deliveringSub.department || 'Credit Operations'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Checker Sign-off:</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {deliveringSub.checkerName || 'Authorized Checker'} ({deliveringSub.checkerDepartment || 'Same Department'})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Reporting Year:</span>
                <span className="font-mono text-slate-900 dark:text-white">{deliveringSub.periodYear} (v{deliveringSub.version})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Institution Code:</span>
                <span className="font-mono text-slate-900 dark:text-white">{deliveringSub.institutionCode} (Oromia Bank)</span>
              </div>
            </div>

            {deliveryFeedback && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  deliveryFeedback.success
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                }`}
              >
                {deliveryFeedback.success ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                )}
                <span>{deliveryFeedback.message}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                disabled={isDelivering}
                onClick={() => setDeliveringSub(null)}
                className="min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 touch-manipulation touch-press"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDelivering}
                onClick={handleExecuteDeliver}
                className="min-h-[44px] px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 touch-manipulation touch-press"
              >
                {isDelivering ? (
                  <>
                    <Send className="w-3.5 h-3.5 animate-spin" />
                    <span>Transmitting to NBE...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Confirm Final Transmission to NBE</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
