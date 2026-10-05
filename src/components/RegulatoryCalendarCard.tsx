/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Building2,
  ChevronRight,
  Filter,
  ArrowRight,
  Send,
  Eye,
  ShieldCheck,
  Flame,
  CalendarDays,
  Bell,
  Check,
} from 'lucide-react';
import { NBE_REPORTS } from '../data/report-registry.ts';
import { OROMIA_BANK_DEPARTMENTS, getDepartmentForReport } from '../data/organizationHierarchy.ts';
import { submissionService } from '../services/submissionService.ts';
import type { ReportSubmission, SubmissionStatus, UserSession } from '../types/regulatory.ts';

export interface RegulatoryDeadlineItem {
  id: string;
  reportKey: string;
  title: string;
  department: string;
  departmentShort: string;
  frequency: string;
  statutoryDeadline: Date;
  deadlineFormatted: string;
  reportingPeriodLabel: string;
  daysRemaining: number;
  hoursRemaining: number;
  urgency: 'OVERDUE' | 'CRITICAL_TODAY' | 'DUE_SOON' | 'UPCOMING' | 'ON_TRACK';
  urgencyLabel: string;
  submissionStatus: 'NOT_STARTED' | SubmissionStatus;
  activeSubmission?: ReportSubmission;
}

interface RegulatoryCalendarCardProps {
  currentUser?: UserSession;
  onInspectSubmission?: (submission: ReportSubmission) => void;
  onViewAllSubmissions?: () => void;
  onOpenReport?: (reportKey: string) => void;
}

export const RegulatoryCalendarCard: React.FC<RegulatoryCalendarCardProps> = ({
  currentUser,
  onInspectSubmission,
  onViewAllSubmissions,
  onOpenReport,
}) => {
  const [frequencyFilter, setFrequencyFilter] = useState<string>('ALL');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'TIMELINE' | 'GRID'>('TIMELINE');
  const [reminderNotices, setReminderNotices] = useState<Record<string, boolean>>({});

  // Dynamic calculation of upcoming NBE filing deadlines
  const deadlines = useMemo<RegulatoryDeadlineItem[]>(() => {
    const allSubs = submissionService.getAll();
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed

    const items: RegulatoryDeadlineItem[] = [];

    NBE_REPORTS.forEach((report, index) => {
      const deptName = getDepartmentForReport(report.ReturnKey) || 'Credit Operations & Portfolio Management';
      const deptDef = OROMIA_BANK_DEPARTMENTS.find((d) => d.name === deptName);
      const deptShort = deptDef?.shortCode || deptName.slice(0, 4).toUpperCase();

      // Determine standard statutory filing deadline for this report
      let deadlineDate = new Date();
      let periodLabel = '';
      const freqStr = (report.Frequency || 'MONTHLY').toString().toUpperCase();

      if (freqStr.includes('DAILY')) {
        // Daily returns due T+1 at 17:00
        deadlineDate = new Date(currentYear, currentMonth, now.getDate() + ((index % 2) + 1), 17, 0, 0);
        periodLabel = `Daily Cycle (${deadlineDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
      } else if (freqStr.includes('WEEKLY')) {
        // Weekly returns due Friday close
        const dayOfWeek = now.getDay();
        const daysToFriday = (5 - dayOfWeek + 7) % 7 || 7;
        deadlineDate = new Date(currentYear, currentMonth, now.getDate() + daysToFriday, 18, 0, 0);
        periodLabel = `Week ${Math.ceil(now.getDate() / 7)} Close`;
      } else if (freqStr.includes('QUARTER')) {
        // Quarterly returns due 20th or 30th after quarter end
        const quarterMonth = Math.floor(currentMonth / 3) * 3 + 3;
        const dueDay = 15 + ((index % 3) * 5); // 15th, 20th, 25th
        deadlineDate = new Date(currentYear, quarterMonth, dueDay, 17, 0, 0);
        periodLabel = `Q${Math.floor(currentMonth / 3) + 1} ${currentYear}`;
      } else if (freqStr.includes('ANNUAL')) {
        deadlineDate = new Date(currentYear, 11, 31, 17, 0, 0);
        periodLabel = `FY ${currentYear}`;
      } else {
        // MONTHLY (Canonical default) - Due on the 10th / 15th of next month
        const dueDay = 10 + (index % 5);
        deadlineDate = new Date(currentYear, currentMonth, dueDay, 17, 0, 0);
        if (deadlineDate < now) {
          deadlineDate = new Date(currentYear, currentMonth + 1, dueDay, 17, 0, 0);
        }
        const monthName = new Date(currentYear, currentMonth).toLocaleDateString('en-US', { month: 'short' });
        periodLabel = `${monthName} ${currentYear} Period`;
      }

      // Check active submission matching this reportKey
      const matchingSub = allSubs.find((s) => s.reportKey === report.ReturnKey);
      const submissionStatus = matchingSub ? matchingSub.status : 'NOT_STARTED';

      const diffMs = deadlineDate.getTime() - now.getTime();
      const diffHours = Math.round(diffMs / (1000 * 60 * 60));
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      let urgency: 'OVERDUE' | 'CRITICAL_TODAY' | 'DUE_SOON' | 'UPCOMING' | 'ON_TRACK' = 'ON_TRACK';
      let urgencyLabel = `${diffDays}d remaining`;

      if (submissionStatus === 'APPROVED' || submissionStatus === 'SENT') {
        urgency = 'ON_TRACK';
        urgencyLabel = submissionStatus === 'SENT' ? 'Filed / Confirmed' : 'Approved';
      } else if (diffHours < 0) {
        urgency = 'OVERDUE';
        urgencyLabel = 'Overdue / Past Deadline';
      } else if (diffHours <= 24) {
        urgency = 'CRITICAL_TODAY';
        urgencyLabel = `Due in ${diffHours}h (Critical)`;
      } else if (diffDays <= 3) {
        urgency = 'DUE_SOON';
        urgencyLabel = `Due in ${diffDays} days`;
      } else if (diffDays <= 10) {
        urgency = 'UPCOMING';
        urgencyLabel = `${diffDays} days left`;
      } else {
        urgency = 'ON_TRACK';
        urgencyLabel = `${diffDays} days`;
      }

      items.push({
        id: `deadline_${report.ReturnKey}`,
        reportKey: report.ReturnKey,
        title: report.Title,
        department: deptName,
        departmentShort: deptShort,
        frequency: report.Frequency as any,
        statutoryDeadline: deadlineDate,
        deadlineFormatted: deadlineDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
        reportingPeriodLabel: periodLabel,
        daysRemaining: diffDays,
        hoursRemaining: diffHours,
        urgency,
        urgencyLabel,
        submissionStatus,
        activeSubmission: matchingSub,
      });
    });

    // Sort chronologically by deadline
    return items.sort((a, b) => a.statutoryDeadline.getTime() - b.statutoryDeadline.getTime());
  }, []);

  // Filtered deadlines
  const filteredDeadlines = useMemo(() => {
    return deadlines.filter((item) => {
      if (frequencyFilter !== 'ALL' && item.frequency !== frequencyFilter) return false;
      if (departmentFilter !== 'ALL' && item.department !== departmentFilter) return false;
      return true;
    });
  }, [deadlines, frequencyFilter, departmentFilter]);

  // Summary counts
  const criticalCount = deadlines.filter(
    (d) => (d.urgency === 'CRITICAL_TODAY' || d.urgency === 'DUE_SOON') && d.submissionStatus !== 'SENT' && d.submissionStatus !== 'APPROVED'
  ).length;
  const completedCount = deadlines.filter((d) => d.submissionStatus === 'SENT' || d.submissionStatus === 'APPROVED').length;
  const nextCritical = deadlines.find(
    (d) => d.submissionStatus !== 'SENT' && d.submissionStatus !== 'APPROVED'
  );

  const toggleReminder = (id: string) => {
    setReminderNotices((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const getStatusBadge = (status: RegulatoryDeadlineItem['submissionStatus']) => {
    switch (status) {
      case 'SENT':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center gap-1">
            <Send className="w-2.5 h-2.5" />
            <span>Delivered</span>
          </span>
        );
      case 'APPROVED':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
            <CheckCircle2 className="w-2.5 h-2.5" />
            <span>Approved</span>
          </span>
        );
      case 'PENDING_CHECKER':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" />
            <span>Pending Checker</span>
          </span>
        );
      case 'CORRECTION_REQUIRED':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-center gap-1">
            <AlertTriangle className="w-2.5 h-2.5" />
            <span>Needs Correction</span>
          </span>
        );
      case 'DRAFT':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            Draft in Progress
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            Not Initiated
          </span>
        );
    }
  };

  const getUrgencyNodeColor = (urgency: RegulatoryDeadlineItem['urgency'], status: string) => {
    if (status === 'SENT' || status === 'APPROVED') {
      return {
        nodeBg: 'bg-emerald-500 ring-4 ring-emerald-100 dark:ring-emerald-950',
        line: 'border-emerald-500',
        text: 'text-emerald-700 dark:text-emerald-400',
      };
    }
    if (urgency === 'OVERDUE' || urgency === 'CRITICAL_TODAY') {
      return {
        nodeBg: 'bg-rose-500 animate-pulse ring-4 ring-rose-100 dark:ring-rose-950',
        line: 'border-rose-500',
        text: 'text-rose-700 dark:text-rose-400',
      };
    }
    if (urgency === 'DUE_SOON') {
      return {
        nodeBg: 'bg-amber-500 ring-4 ring-amber-100 dark:ring-amber-950',
        line: 'border-amber-500',
        text: 'text-amber-700 dark:text-amber-400',
      };
    }
    return {
      nodeBg: 'bg-ob-indigo-500 ring-4 ring-ob-indigo-100 dark:ring-ob-indigo-950',
      line: 'border-ob-indigo-500',
      text: 'text-ob-indigo-700 dark:text-ob-indigo-400',
    };
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs transition-colors space-y-4">
      {/* 1. Header & Timeline Summary */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-ob-indigo-50 dark:bg-ob-indigo-950/70 border border-ob-indigo-200 dark:border-ob-indigo-800 text-ob-indigo-600 dark:text-ob-indigo-400">
              <CalendarIcon className="w-4 h-4" />
            </span>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Regulatory Calendar & Statutory Filing Deadlines
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
              NBE Timelines
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time chronological timeline tracking NBE BSD compliance deadlines and submission readiness across banking departments.
          </p>
        </div>

        {/* Filters & View Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Frequency Filter */}
          <select
            value={frequencyFilter}
            onChange={(e) => setFrequencyFilter(e.target.value)}
            aria-label="Filter deadlines by frequency"
            className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-700 dark:text-slate-300 font-medium focus:outline-none focus:ring-1 focus:ring-ob-indigo-500 cursor-pointer"
          >
            <option value="ALL">All Frequencies</option>
            <option value="DAILY">Daily Returns</option>
            <option value="WEEKLY">Weekly Returns</option>
            <option value="MONTHLY">Monthly Returns</option>
            <option value="QUARTERLY">Quarterly Returns</option>
          </select>

          {/* Department Filter */}
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            aria-label="Filter deadlines by department"
            className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-700 dark:text-slate-300 font-medium focus:outline-none focus:ring-1 focus:ring-ob-indigo-500 cursor-pointer"
          >
            <option value="ALL">All Departments</option>
            {OROMIA_BANK_DEPARTMENTS.map((d) => (
              <option key={d.id} value={d.name}>
                {d.shortCode} - {d.name}
              </option>
            ))}
          </select>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setViewMode('TIMELINE')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                viewMode === 'TIMELINE'
                  ? 'bg-white dark:bg-slate-700 text-ob-indigo-600 dark:text-ob-indigo-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Timeline View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('GRID')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                viewMode === 'GRID'
                  ? 'bg-white dark:bg-slate-700 text-ob-indigo-600 dark:text-ob-indigo-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Schedule Grid
            </button>
          </div>
        </div>
      </div>

      {/* 2. Key Deadlines Quick Metric Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-slate-50/70 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-950 text-rose-600 flex items-center justify-center font-bold text-sm shrink-0">
            {criticalCount}
          </div>
          <div>
            <div className="font-bold text-slate-900 dark:text-white">Deadlines Within 72 Hours</div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">Awaiting Maker/Checker sign-off</div>
          </div>
        </div>

        <div className="flex items-center gap-3 border-t sm:border-t-0 sm:border-l border-slate-200 dark:border-slate-700 pt-2 sm:pt-0 sm:pl-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center font-bold text-sm shrink-0">
            {completedCount}
          </div>
          <div>
            <div className="font-bold text-slate-900 dark:text-white">Filed or Approved Returns</div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">Ready for regulatory ingestion</div>
          </div>
        </div>

        <div className="flex items-center gap-3 border-t sm:border-t-0 sm:border-l border-slate-200 dark:border-slate-700 pt-2 sm:pt-0 sm:pl-3">
          <div className="w-8 h-8 rounded-lg bg-ob-indigo-100 dark:bg-ob-indigo-950 text-ob-indigo-600 flex items-center justify-center font-bold text-sm shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div className="truncate">
            <div className="font-bold text-slate-900 dark:text-white truncate">
              Next: {nextCritical?.reportKey || 'All On Track'}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
              {nextCritical?.deadlineFormatted} • {nextCritical?.urgencyLabel}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Timeline Visualization */}
      {viewMode === 'TIMELINE' ? (
        <div className="relative pl-6 sm:pl-8 space-y-4 before:absolute before:left-2.5 sm:before:left-3.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
          {filteredDeadlines.slice(0, 8).map((item) => {
            const colors = getUrgencyNodeColor(item.urgency, item.submissionStatus);
            const isReminderSet = reminderNotices[item.id];

            return (
              <div key={item.id} className="relative group">
                {/* Timeline node */}
                <div
                  className={`absolute -left-6 sm:-left-8 top-3.5 w-3.5 h-3.5 rounded-full ${colors.nodeBg} transition-all`}
                />

                {/* Card body */}
                <div className="p-3 bg-slate-50/70 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl transition-all shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-black text-ob-indigo-600 dark:text-ob-indigo-400">
                        {item.reportKey}
                      </span>
                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {item.title}
                      </span>
                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 font-mono">
                        {item.frequency}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                        <Building2 className="w-3.5 h-3.5 text-ob-indigo-500" />
                        <span>{item.department}</span>
                      </span>
                      <span>•</span>
                      <span className="font-medium text-slate-600 dark:text-slate-400">
                        Period: {item.reportingPeriodLabel}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1 font-semibold text-slate-900 dark:text-white">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Deadline: {item.deadlineFormatted} (17:00 EAT)</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="text-right">
                      <div className={`text-xs font-bold ${colors.text}`}>
                        {item.urgencyLabel}
                      </div>
                      <div className="mt-0.5">{getStatusBadge(item.submissionStatus)}</div>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleReminder(item.id)}
                      className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                        isReminderSet
                          ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-300'
                          : 'bg-white dark:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 border-slate-200 dark:border-slate-600'
                      }`}
                      title={isReminderSet ? 'Deadline reminder set' : 'Set reminder notice'}
                    >
                      <Bell className="w-3.5 h-3.5" />
                    </button>

                    {item.activeSubmission ? (
                      <button
                        type="button"
                        onClick={() => onInspectSubmission?.(item.activeSubmission!)}
                        className="px-2.5 py-1.5 text-xs font-semibold text-ob-indigo-600 dark:text-ob-indigo-400 bg-ob-indigo-50 dark:bg-ob-indigo-950/60 hover:bg-ob-indigo-100 dark:hover:bg-ob-indigo-900 border border-ob-indigo-200 dark:border-ob-indigo-800 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onOpenReport?.(item.reportKey)}
                        className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <span>View Return</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Schedule Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredDeadlines.map((item) => {
            const colors = getUrgencyNodeColor(item.urgency, item.submissionStatus);
            return (
              <div
                key={item.id}
                className="bg-slate-50/70 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between gap-2 shadow-2xs hover:border-ob-indigo-300 dark:hover:border-ob-indigo-700 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-mono text-xs font-black text-ob-indigo-600 dark:text-ob-indigo-400">
                      {item.reportKey}
                    </span>
                    {getStatusBadge(item.submissionStatus)}
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                    {item.title}
                  </h4>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    {item.departmentShort} • {item.frequency}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Statutory Due</div>
                    <div className="font-bold text-slate-800 dark:text-slate-200">
                      {item.deadlineFormatted}
                    </div>
                  </div>
                  <span className={`text-xs font-bold ${colors.text}`}>
                    {item.urgencyLabel}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Footer CTA */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
        <span className="text-slate-500 dark:text-slate-400">
          Showing {filteredDeadlines.length} scheduled statutory returns across all regulatory cycles.
        </span>
        <button
          type="button"
          onClick={onViewAllSubmissions}
          className="text-ob-indigo-600 dark:text-ob-indigo-400 hover:text-ob-indigo-700 font-bold flex items-center gap-1 cursor-pointer"
        >
          <span>View In Reports Oversight Ledger</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
