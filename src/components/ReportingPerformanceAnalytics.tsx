/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Send,
  Building2,
  RefreshCw,
  Download,
  Calendar,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  Check,
  ChevronRight,
  Filter,
  BarChart3,
  PieChart as PieChartIcon,
  Flame,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import {
  reportingAnalyticsService,
  type ReportingAnalyticsData,
  type AnalyticsFilter,
} from '../services/reportingAnalyticsService.ts';
import { departmentService } from '../services/departmentService.ts';
import type { UserSession } from '../types/regulatory.ts';
import { DataQualityHeatmap } from './DataQualityHeatmap.tsx';
import { MaximizedViewModal } from './MaximizedViewModal.tsx';
import { MaximizeButton } from './MaximizeButton.tsx';

interface ReportingPerformanceAnalyticsProps {
  currentUser: UserSession;
  compact?: boolean;
  onViewAllSubmissions?: () => void;
  onOpenReport?: (reportKey: string) => void;
}

export const ReportingPerformanceAnalytics: React.FC<ReportingPerformanceAnalyticsProps> = ({
  currentUser,
  compact = false,
  onViewAllSubmissions,
  onOpenReport,
}) => {
  const [timeRange, setTimeRange] = useState<number>(30);
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedFreq, setSelectedFreq] = useState<string>('ALL');
  const [data, setData] = useState<ReportingAnalyticsData>(() =>
    reportingAnalyticsService.getAnalytics({ timeRangeDays: 30 })
  );
  const [activeChartTab, setActiveChartTab] = useState<
    'VOLUME' | 'ACCEPTANCE' | 'TURNAROUND' | 'AGING' | 'STATUS' | 'DEPARTMENTS' | 'DATA_QUALITY_HEATMAP'
  >('VOLUME');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [departments, setDepartments] = useState(() => departmentService.getAll());

  // Subscribe to live submission updates
  useEffect(() => {
    const unsub = reportingAnalyticsService.subscribe(() => {
      refreshData();
    });
    return unsub;
  }, [timeRange, selectedDept, selectedFreq]);

  const refreshData = () => {
    setIsRefreshing(true);
    try {
      const analytics = reportingAnalyticsService.getAnalytics({
        timeRangeDays: timeRange,
        department: selectedDept,
        frequency: selectedFreq,
      });
      setData(analytics);
    } finally {
      setTimeout(() => setIsRefreshing(false), 300);
    }
  };

  useEffect(() => {
    refreshData();
  }, [timeRange, selectedDept, selectedFreq]);

  // CSV Export Handler
  const handleExportCsv = () => {
    const csv = reportingAnalyticsService.generateCsvExport(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `Oromia_Bank_NBE_Reporting_Performance_Analytics_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // JSON Export Handler
  const handleExportJson = () => {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `Oromia_Bank_NBE_Analytics_Dataset_${new Date().toISOString().split('T')[0]}.json`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const kpis = data.kpis;

  // Custom Chart Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs">
          <div className="font-bold text-slate-200 mb-1 border-b border-slate-700/80 pb-1">{label}</div>
          <div className="space-y-1">
            {payload.map((entry: any, index: number) => (
              <div key={`item-${index}`} className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5" style={{ color: entry.color }}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span>{entry.name}:</span>
                </span>
                <span className="font-mono font-bold">{entry.value}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  // Compact Widget Mode for Dashboard Embedding
  if (compact) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-2xs transition-colors mb-3">
        {/* Compact Header */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-ob-indigo-50 dark:bg-ob-indigo-950 text-ob-indigo-700 dark:text-ob-indigo-300 flex items-center justify-center border border-ob-indigo-200 dark:border-ob-indigo-800 shrink-0">
              <BarChart3 className="w-4 h-4 text-ob-indigo-600 dark:text-ob-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                  Regulatory Performance
                </h3>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">· Last {timeRange} Days</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Key metrics: Submission Acceptance Rate, Average Turnaround Time & Pending Review Aging.
              </p>
            </div>
          </div>

          {/* Interactive Controls Bar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Switcher */}
            <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveChartTab('ACCEPTANCE')}
                className={`px-2 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  activeChartTab === 'ACCEPTANCE'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Acceptance Rate
              </button>
              <button
                type="button"
                onClick={() => setActiveChartTab('TURNAROUND')}
                className={`px-2 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  activeChartTab === 'TURNAROUND'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Turnaround Time
              </button>
              <button
                type="button"
                onClick={() => setActiveChartTab('AGING')}
                className={`px-2 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  activeChartTab === 'AGING'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Review Aging
              </button>
              <button
                type="button"
                onClick={() => setActiveChartTab('VOLUME')}
                className={`px-2 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  activeChartTab === 'VOLUME'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Volume Flow
              </button>
              <button
                type="button"
                onClick={() => setActiveChartTab('STATUS')}
                className={`px-2 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  activeChartTab === 'STATUS'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Pipeline
              </button>
              <button
                type="button"
                onClick={() => setActiveChartTab('DATA_QUALITY_HEATMAP')}
                className={`px-2 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                  activeChartTab === 'DATA_QUALITY_HEATMAP'
                    ? 'bg-rose-600 text-white shadow-2xs font-bold'
                    : 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50'
                }`}
              >
                <Flame className="w-3 h-3" />
                <span>Data Quality Heatmap</span>
              </button>
            </div>

            {/* Time Range Selector */}
            <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-semibold">
              {[7, 14, 30, 90].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setTimeRange(days)}
                  className={`px-2 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    timeRange === days
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {days}D
                </button>
              ))}
            </div>

            {/* Department Filter */}
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-300 font-medium focus:outline-none focus:ring-1 focus:ring-ob-indigo-500 cursor-pointer"
            >
              <option value="ALL">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={refreshData}
              disabled={isRefreshing}
              className="p-1 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
              title="Refresh Analytics Dataset"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-ob-indigo-600' : ''}`} />
            </button>

            {/* Expand / Full View Link */}
            {onViewAllSubmissions && (
              <button
                type="button"
                onClick={onViewAllSubmissions}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-ob-indigo-700 dark:text-ob-indigo-300 bg-ob-indigo-50 dark:bg-ob-indigo-950/70 hover:bg-ob-indigo-100 dark:hover:bg-ob-indigo-900 border border-ob-indigo-200 dark:border-ob-indigo-800 rounded-lg transition-colors cursor-pointer"
                title="Expand to Full Analytics Suite"
              >
                <span>Full Suite</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Compact KPI Row: Submission Acceptance Rate, Average Turnaround Time, Pending Review Aging */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 my-3">
          <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-800/60 rounded-lg p-2">
            <div className="text-[10px] text-emerald-800 dark:text-emerald-300 font-semibold flex items-center justify-between">
              <span>Acceptance Rate</span>
              <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex items-baseline justify-between gap-1 mt-0.5">
              <div className="text-base font-bold font-mono text-emerald-700 dark:text-emerald-400">
                {kpis.submissionAcceptanceRate}%
              </div>
              <div
                className={`inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[10px] font-bold font-mono ${
                  kpis.acceptanceRateTrendPercentage >= 0
                    ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-900/40'
                    : 'text-rose-700 dark:text-rose-300 bg-rose-100/70 dark:bg-rose-900/40'
                }`}
                title={`Prior period: ${kpis.priorSubmissionAcceptanceRate}% (${kpis.acceptanceRateTrendPercentage >= 0 ? '+' : ''}${kpis.acceptanceRateTrendPercentage}% change)`}
              >
                {kpis.acceptanceRateTrendPercentage >= 0 ? (
                  <TrendingUp className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <TrendingDown className="w-2.5 h-2.5 text-rose-600 dark:text-rose-400" />
                )}
                <span>
                  {kpis.acceptanceRateTrendPercentage >= 0 ? '+' : ''}
                  {kpis.acceptanceRateTrendPercentage}%
                </span>
              </div>
            </div>
            <div className="text-[9px] text-emerald-700/80 dark:text-emerald-400/80 mt-0.5 flex items-center justify-between">
              <span>First-Pass: {kpis.firstPassRate}%</span>
              <span className="text-slate-400 font-normal">prev: {kpis.priorSubmissionAcceptanceRate}%</span>
            </div>
          </div>

          <div className="bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 rounded-lg p-2">
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium flex items-center justify-between">
              <span>Avg Turnaround Time</span>
              <Clock className="w-3 h-3 text-ob-indigo-600 dark:text-ob-indigo-400" />
            </div>
            <div className="flex items-baseline justify-between gap-1 mt-0.5">
              <div className="text-base font-bold font-mono text-slate-900 dark:text-white flex items-baseline gap-0.5">
                <span>{kpis.avgTurnaroundHours}</span>
                <span className="text-[10px] font-normal text-slate-500">hrs</span>
              </div>
              <div
                className={`inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[10px] font-bold font-mono ${
                  kpis.turnaroundTrendPercentage <= 0
                    ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-900/40'
                    : 'text-amber-700 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-900/40'
                }`}
                title={`Prior period: ${kpis.priorAvgTurnaroundHours}h (${kpis.turnaroundTrendPercentage <= 0 ? `${Math.abs(kpis.turnaroundTrendPercentage)}% faster` : `${kpis.turnaroundTrendPercentage}% slower`})`}
              >
                {kpis.turnaroundTrendPercentage <= 0 ? (
                  <TrendingDown className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <TrendingUp className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                )}
                <span>
                  {kpis.turnaroundTrendPercentage > 0 ? '+' : ''}
                  {kpis.turnaroundTrendPercentage}%
                </span>
              </div>
            </div>
            <div className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center justify-between">
              <span>Target: &le;24h SLA</span>
              <span className="font-normal text-slate-400">prev: {kpis.priorAvgTurnaroundHours}h</span>
            </div>
          </div>

          <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-800/60 rounded-lg p-2">
            <div className="text-[10px] text-amber-800 dark:text-amber-300 font-semibold flex items-center justify-between">
              <span>Pending Review Aging</span>
              <AlertCircle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="text-base font-bold font-mono text-amber-700 dark:text-amber-400 mt-0.5 flex items-baseline gap-0.5">
              <span>{data.pendingReviewAging?.avgAgeHours ?? kpis.pendingReviewAgingHours}</span>
              <span className="text-[10px] font-normal text-slate-500">hrs avg</span>
            </div>
            <div className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5">
              {data.pendingReviewAging?.overdueCount ?? 0} Overdue SLA
            </div>
          </div>

          <div className="bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 rounded-lg p-2">
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">SLA Compliance</div>
            <div className="text-base font-bold font-mono text-slate-900 dark:text-white mt-0.5">
              {kpis.slaComplianceRate}%
            </div>
            <div className="text-[9px] text-slate-400 mt-0.5">&le; 24h Statutory Target</div>
          </div>

          <div className="bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 rounded-lg p-2 col-span-2 sm:col-span-1">
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">In-Flight Queue</div>
            <div className="text-base font-bold font-mono text-ob-indigo-700 dark:text-ob-indigo-400 mt-0.5">
              {kpis.activeInFlight}
            </div>
            <div className="text-[9px] text-slate-400 mt-0.5">{kpis.pendingCheckerCount} Pend · {kpis.needsCorrectionCount} Edit</div>
          </div>
        </div>

        {/* Compact Chart Area */}
        <div className="h-60 sm:h-64 w-full">
          {activeChartTab === 'ACCEPTANCE' && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data.dailyTrends}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="compactColorAcceptance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.15} />
                <XAxis
                  dataKey="dayLabel"
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                  interval={timeRange > 30 ? 6 : timeRange > 14 ? 3 : 1}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                  unit="%"
                  domain={[0, 100]}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine
                  y={90}
                  stroke="#059669"
                  strokeDasharray="4 4"
                  label={{
                    value: '90% Target',
                    position: 'top',
                    fill: '#059669',
                    fontSize: 9,
                    fontWeight: 'bold',
                  }}
                />
                <ReferenceLine
                  y={kpis.priorSubmissionAcceptanceRate}
                  stroke="#64748b"
                  strokeDasharray="3 3"
                  label={{
                    value: `Prev: ${kpis.priorSubmissionAcceptanceRate}%`,
                    position: 'insideBottomRight',
                    fill: '#64748b',
                    fontSize: 9,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="acceptanceRate"
                  name="Submission Acceptance Rate (%)"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#compactColorAcceptance)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}

          {activeChartTab === 'AGING' && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.pendingReviewAging?.buckets || []}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.15} />
                <XAxis
                  dataKey="bucket"
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  formatter={(val: any, name: any) => [`${val} Submissions`, 'Pending Count']}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    fontSize: '11px',
                    color: '#fff',
                  }}
                />
                <Bar
                  dataKey="count"
                  name="Pending Review Aging"
                  radius={[4, 4, 0, 0]}
                >
                  {(data.pendingReviewAging?.buckets || []).map((entry, index) => (
                    <Cell key={`compact-aging-cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}

          {activeChartTab === 'VOLUME' && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data.dailyTrends}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="compactColorCreated" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="compactColorSubmitted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="compactColorApproved" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="compactColorTransmitted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.15} />
                <XAxis
                  dataKey="dayLabel"
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                  interval={timeRange > 30 ? 6 : timeRange > 14 ? 3 : 1}
                />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="top"
                  height={28}
                  iconType="circle"
                  iconSize={7}
                  wrapperStyle={{ fontSize: '10px' }}
                />
                <Area
                  type="monotone"
                  dataKey="created"
                  name="Drafts Created"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#compactColorCreated)"
                />
                <Area
                  type="monotone"
                  dataKey="submitted"
                  name="Submitted to Checker"
                  stroke="#0284c7"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#compactColorSubmitted)"
                />
                <Area
                  type="monotone"
                  dataKey="approved"
                  name="Approved by Checker"
                  stroke="#059669"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#compactColorApproved)"
                />
                <Area
                  type="monotone"
                  dataKey="transmitted"
                  name="Delivered to NBE"
                  stroke="#7c3aed"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#compactColorTransmitted)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}

          {activeChartTab === 'TURNAROUND' && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.dailyTrends}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.15} />
                <XAxis
                  dataKey="dayLabel"
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                  interval={timeRange > 30 ? 6 : timeRange > 14 ? 3 : 1}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                  unit="h"
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine
                  y={24}
                  stroke="#e11d48"
                  strokeDasharray="4 4"
                  label={{
                    value: '24h Target',
                    position: 'top',
                    fill: '#e11d48',
                    fontSize: 9,
                    fontWeight: 'bold',
                  }}
                />
                <ReferenceLine
                  y={kpis.priorAvgTurnaroundHours}
                  stroke="#64748b"
                  strokeDasharray="3 3"
                  label={{
                    value: `Prev: ${kpis.priorAvgTurnaroundHours}h`,
                    position: 'insideBottomRight',
                    fill: '#64748b',
                    fontSize: 9,
                  }}
                />
                <Bar
                  dataKey="avgTurnaroundHours"
                  name="Avg Approval Time (Hours)"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}

          {activeChartTab === 'STATUS' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 h-full items-center gap-4">
              <div className="h-full relative min-h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.statusDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={68}
                      paddingAngle={3}
                      dataKey="count"
                    >
                      {data.statusDistribution.map((entry, index) => (
                        <Cell key={`compact-cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any, name: any) => [`${value} Returns`, name]}
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '8px',
                        fontSize: '11px',
                        color: '#fff',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-base font-bold font-mono text-slate-900 dark:text-white">
                    {kpis.totalSubmissions30d}
                  </span>
                  <span className="text-[9px] text-slate-400 uppercase font-semibold">Returns</span>
                </div>
              </div>

              <div className="space-y-1.5 pr-2">
                {data.statusDistribution.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-slate-700 dark:text-slate-300 font-medium truncate max-w-[140px]">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="font-bold text-slate-900 dark:text-white">{item.count}</span>
                      <span className="text-slate-400 text-[10px]">({item.percentage}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Compact Footnote */}
        <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 gap-2">
          <span>Dual-control 4-eyes principle enforced under NBE Banking Supervision Directive BSD/03/2020.</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              className="text-xs font-semibold text-ob-indigo-600 dark:text-ob-indigo-400 hover:underline cursor-pointer"
            >
              Export CSV
            </button>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-[10px]">Institution #0000013</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Header & Interactive Controls Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-2xs transition-colors">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-ob-indigo-50 dark:bg-ob-indigo-950 text-ob-indigo-700 dark:text-ob-indigo-300 flex items-center justify-center border border-ob-indigo-200 dark:border-ob-indigo-800 shrink-0">
              <BarChart3 className="w-5 h-5 text-ob-indigo-600 dark:text-ob-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  Regulatory Performance & Compliance Analytics
                </h2>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">· 30-Day NBE Statutory Oversight</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Key regulatory metrics: Submission Acceptance Rate, Average Turnaround Time, and Pending Review Aging.
              </p>
            </div>
          </div>

          {/* Interactive Controls & Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Time Range Selector */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => setTimeRange(7)}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  timeRange === 7
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                7D
              </button>
              <button
                type="button"
                onClick={() => setTimeRange(14)}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  timeRange === 14
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                14D
              </button>
              <button
                type="button"
                onClick={() => setTimeRange(30)}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  timeRange === 30
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                30D
              </button>
              <button
                type="button"
                onClick={() => setTimeRange(90)}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  timeRange === 90
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                90D
              </button>
            </div>

            {/* Department Filter */}
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-300 font-medium focus:outline-none focus:ring-1 focus:ring-ob-indigo-500 cursor-pointer"
            >
              <option value="ALL">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>

            {/* Frequency Filter */}
            <select
              value={selectedFreq}
              onChange={(e) => setSelectedFreq(e.target.value)}
              className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-300 font-medium focus:outline-none focus:ring-1 focus:ring-ob-indigo-500 cursor-pointer"
            >
              <option value="ALL">All Frequencies</option>
              <option value="DAILY">Daily Returns</option>
              <option value="WEEKLY">Weekly Returns</option>
              <option value="MONTHLY">Monthly Returns</option>
              <option value="QUARTERLY">Quarterly Returns</option>
            </select>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={refreshData}
              disabled={isRefreshing}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
              title="Refresh Analytics Dataset"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-ob-indigo-600' : ''}`} />
            </button>

            {/* Export Menu */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleExportCsv}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                title="Export reporting metrics to CSV"
              >
                <Download className="w-3.5 h-3.5 text-ob-indigo-600" />
                <span>CSV</span>
              </button>
              <button
                type="button"
                onClick={handleExportJson}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                title="Export reporting dataset to JSON"
              >
                <span>JSON</span>
              </button>

              <MaximizeButton
                onClick={() => setIsMaximized(true)}
                title="Maximize Regulatory Performance Analytics (Esc to restore)"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. Executive KPI Cards Row: Submission Acceptance Rate, Average Turnaround Time, Pending Review Aging */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {/* 1. Submission Acceptance Rate */}
        <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/60 rounded-xl p-3 shadow-2xs transition-colors flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-300">
            <span className="text-[11px] font-bold">Submission Acceptance Rate</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-2">
            <div className="flex items-baseline justify-between gap-1.5">
              <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400">
                {kpis.submissionAcceptanceRate}%
              </div>
              {/* Percentage-based Trend Indicator compared to previous reporting period */}
              <div
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-bold font-mono ${
                  kpis.acceptanceRateTrendPercentage >= 0
                    ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-100/90 dark:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800'
                    : 'text-rose-700 dark:text-rose-300 bg-rose-100/90 dark:bg-rose-900/50 border border-rose-200 dark:border-rose-800'
                }`}
                title={`Prior period: ${kpis.priorSubmissionAcceptanceRate}% (${kpis.acceptanceRateTrendPercentage >= 0 ? '+' : ''}${kpis.acceptanceRateTrendPercentage}% relative change)`}
              >
                {kpis.acceptanceRateTrendPercentage >= 0 ? (
                  <TrendingUp className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-rose-600 dark:text-rose-400 shrink-0" />
                )}
                <span>
                  {kpis.acceptanceRateTrendPercentage >= 0 ? '+' : ''}
                  {kpis.acceptanceRateTrendPercentage}%
                </span>
              </div>
            </div>
            <div className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 mt-1 flex items-center justify-between">
              <span>First-Pass: {kpis.firstPassRate}%</span>
              <span className="text-slate-500 dark:text-slate-400 font-normal">
                vs prev {timeRange}d ({kpis.priorSubmissionAcceptanceRate}%)
              </span>
            </div>
          </div>
        </div>

        {/* 2. Average Review Turnaround Time */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-2xs transition-colors flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-semibold">Average Turnaround Time</span>
            <Clock className="w-4 h-4 text-ob-indigo-600 dark:text-ob-indigo-400" />
          </div>
          <div className="mt-2">
            <div className="flex items-baseline justify-between gap-1.5">
              <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 dark:text-white flex items-baseline gap-1">
                <span>{kpis.avgTurnaroundHours}</span>
                <span className="text-xs font-normal text-slate-500">hrs</span>
              </div>
              {/* Percentage-based Trend Indicator compared to previous reporting period */}
              <div
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-bold font-mono ${
                  kpis.turnaroundTrendPercentage <= 0
                    ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-100/90 dark:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800'
                    : 'text-amber-700 dark:text-amber-300 bg-amber-100/90 dark:bg-amber-900/50 border border-amber-200 dark:border-amber-800'
                }`}
                title={`Prior period: ${kpis.priorAvgTurnaroundHours}h (${kpis.turnaroundTrendPercentage <= 0 ? `${Math.abs(kpis.turnaroundTrendPercentage)}% faster` : `${kpis.turnaroundTrendPercentage}% slower`})`}
              >
                {kpis.turnaroundTrendPercentage <= 0 ? (
                  <TrendingDown className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <TrendingUp className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                )}
                <span>
                  {kpis.turnaroundTrendPercentage > 0 ? '+' : ''}
                  {kpis.turnaroundTrendPercentage}%
                </span>
              </div>
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-between">
              <span>Target: &le;24h (Med: {kpis.medianTurnaroundHours}h)</span>
              <span className="font-normal text-slate-400">
                vs prev {timeRange}d ({kpis.priorAvgTurnaroundHours}h)
              </span>
            </div>
          </div>
        </div>

        {/* 3. Pending Review Aging */}
        <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/60 rounded-xl p-3 shadow-2xs transition-colors flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-800 dark:text-amber-300">
            <span className="text-[11px] font-bold">Pending Review Aging</span>
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-bold font-mono text-amber-700 dark:text-amber-400 flex items-baseline gap-1">
              <span>{data.pendingReviewAging?.avgAgeHours ?? kpis.pendingReviewAgingHours}</span>
              <span className="text-xs font-normal text-slate-500">hrs avg</span>
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
              <span>{kpis.pendingCheckerCount} In Queue</span>
              <span aria-hidden="true">·</span>
              <span className="text-rose-600 dark:text-rose-400 font-semibold">{data.pendingReviewAging?.overdueCount ?? 0} Overdue SLA</span>
            </div>
          </div>
        </div>

        {/* 4. SLA Compliance Rate */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-2xs transition-colors flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-semibold">SLA Compliance</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400">
              {kpis.slaComplianceRate}%
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
              <span>Reviewed in &le;24 Hours</span>
            </div>
          </div>
        </div>

        {/* 5. Total Returns Processed */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-2xs transition-colors flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-semibold">Total Volume</span>
            <FileSpreadsheet className="w-4 h-4 text-ob-indigo-600 dark:text-ob-indigo-400" />
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 dark:text-white">
              {kpis.totalSubmissions30d}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
              <span>Past {timeRange} Days</span>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{kpis.totalDepartmentsReporting} Depts</span>
            </div>
          </div>
        </div>

        {/* 6. Direct NBE Transmission Rate */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-2xs transition-colors flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-semibold">NBE Delivered</span>
            <Send className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-bold font-mono text-purple-700 dark:text-purple-400">
              {kpis.transmittedCount}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
              <span>{kpis.nbeTransmissionRate}% of Approved</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Main Data Visualization Section with Recharts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column: Primary Timeline Trend (Spans 2 cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs transition-colors flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Regulatory Submission & Transmission Volume Trend</span>
                <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">
                  ({timeRange} Days)
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Daily progression of returns created, submitted to checker, approved, and delivered to NBE.
              </p>
            </div>

            {/* Chart Mode Switcher */}
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setActiveChartTab('ACCEPTANCE')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer text-xs font-semibold ${
                  activeChartTab === 'ACCEPTANCE'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Acceptance Rate
              </button>
              <button
                type="button"
                onClick={() => setActiveChartTab('TURNAROUND')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer text-xs font-semibold ${
                  activeChartTab === 'TURNAROUND'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Turnaround Time
              </button>
              <button
                type="button"
                onClick={() => setActiveChartTab('AGING')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer text-xs font-semibold ${
                  activeChartTab === 'AGING'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Review Aging
              </button>
              <button
                type="button"
                onClick={() => setActiveChartTab('VOLUME')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer text-xs font-semibold ${
                  activeChartTab === 'VOLUME'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Volume Flow
              </button>
              <button
                type="button"
                onClick={() => setActiveChartTab('DATA_QUALITY_HEATMAP')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer text-xs font-semibold flex items-center gap-1 ${
                  activeChartTab === 'DATA_QUALITY_HEATMAP'
                    ? 'bg-rose-600 text-white shadow-2xs font-bold'
                    : 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50'
                }`}
              >
                <Flame className="w-3 h-3" />
                <span>Quality Heatmap</span>
              </button>
            </div>
          </div>

          {/* Chart Display Area with Recharts */}
          {activeChartTab === 'DATA_QUALITY_HEATMAP' ? (
            <div className="pt-2">
              <DataQualityHeatmap
                currentUser={currentUser}
                onInspectReport={onOpenReport}
                onNavigateToSubmissions={onViewAllSubmissions}
              />
            </div>
          ) : (
            <div className="h-64 sm:h-72 w-full min-h-[256px]">
              {/* Chart 1: Submission Acceptance Rate */}
            {activeChartTab === 'ACCEPTANCE' && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={data.dailyTrends}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorAcceptanceRate" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.15} />
                  <XAxis
                    dataKey="dayLabel"
                    stroke="#94a3b8"
                    fontSize={10}
                    tickLine={false}
                    interval={timeRange > 30 ? 6 : timeRange > 14 ? 3 : 1}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={10}
                    tickLine={false}
                    unit="%"
                    domain={[0, 100]}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine
                    y={90}
                    stroke="#059669"
                    strokeDasharray="4 4"
                    label={{
                      value: '90% Target Benchmark',
                      position: 'top',
                      fill: '#059669',
                      fontSize: 10,
                      fontWeight: 'bold',
                    }}
                  />
                  <ReferenceLine
                    y={kpis.priorSubmissionAcceptanceRate}
                    stroke="#64748b"
                    strokeDasharray="3 3"
                    label={{
                      value: `Prior Period: ${kpis.priorSubmissionAcceptanceRate}% (${kpis.acceptanceRateTrendPercentage >= 0 ? '+' : ''}${kpis.acceptanceRateTrendPercentage}%)`,
                      position: 'insideBottomRight',
                      fill: '#64748b',
                      fontSize: 10,
                      fontWeight: 'bold',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="acceptanceRate"
                    name="Submission Acceptance Rate (%)"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorAcceptanceRate)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}

            {/* Chart 2: Average Turnaround Time */}
            {activeChartTab === 'TURNAROUND' && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.dailyTrends}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.15} />
                  <XAxis
                    dataKey="dayLabel"
                    stroke="#94a3b8"
                    fontSize={10}
                    tickLine={false}
                    interval={timeRange > 30 ? 6 : timeRange > 14 ? 3 : 1}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={10}
                    tickLine={false}
                    unit="h"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine
                    y={24}
                    stroke="#e11d48"
                    strokeDasharray="4 4"
                    label={{
                      value: '24h Statutory SLA Target',
                      position: 'top',
                      fill: '#e11d48',
                      fontSize: 10,
                      fontWeight: 'bold',
                    }}
                  />
                  <ReferenceLine
                    y={kpis.priorAvgTurnaroundHours}
                    stroke="#64748b"
                    strokeDasharray="3 3"
                    label={{
                      value: `Prior Period: ${kpis.priorAvgTurnaroundHours}h (${kpis.turnaroundTrendPercentage > 0 ? '+' : ''}${kpis.turnaroundTrendPercentage}%)`,
                      position: 'insideBottomRight',
                      fill: '#64748b',
                      fontSize: 10,
                      fontWeight: 'bold',
                    }}
                  />
                  <Bar
                    dataKey="avgTurnaroundHours"
                    name="Average Turnaround Time (Hours)"
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}

            {/* Chart 3: Pending Review Aging Distribution */}
            {activeChartTab === 'AGING' && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.pendingReviewAging?.buckets || []}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.15} />
                  <XAxis
                    dataKey="bucket"
                    stroke="#94a3b8"
                    fontSize={10}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={10}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    formatter={(val: any, name: any) => [`${val} Returns`, 'Pending In Queue']}
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      fontSize: '11px',
                      color: '#fff',
                    }}
                  />
                  <Bar
                    dataKey="count"
                    name="Pending Review Aging"
                    radius={[4, 4, 0, 0]}
                  >
                    {(data.pendingReviewAging?.buckets || []).map((entry, index) => (
                      <Cell key={`full-aging-cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}

            {/* Chart 4: Volume Flow */}
            {activeChartTab === 'VOLUME' && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={data.dailyTrends}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorSubmitted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorApproved" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorTransmitted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.15} />
                  <XAxis
                    dataKey="dayLabel"
                    stroke="#94a3b8"
                    fontSize={10}
                    tickLine={false}
                    interval={timeRange > 30 ? 6 : timeRange > 14 ? 3 : 1}
                  />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    verticalAlign="top"
                    height={32}
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '11px' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="created"
                    name="Drafts Created"
                    stroke="#6366f1"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorCreated)"
                  />
                  <Area
                    type="monotone"
                    dataKey="submitted"
                    name="Submitted to Checker"
                    stroke="#0284c7"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorSubmitted)"
                  />
                  <Area
                    type="monotone"
                    dataKey="approved"
                    name="Approved by Checker"
                    stroke="#059669"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorApproved)"
                  />
                  <Area
                    type="monotone"
                    dataKey="transmitted"
                    name="Delivered to NBE"
                    stroke="#7c3aed"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorTransmitted)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
          )}

          {/* Quick Subtext Footnote */}
          <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between gap-2">
            <span>Dual-control 4-eyes principle enforced under NBE Banking Supervision Directive BSD/03/2020.</span>
            <span className="font-mono text-[10px]">Active Window: Last {timeRange} Days</span>
          </div>
        </div>

        {/* Right Column: Status Distribution & Review Speed Buckets */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs transition-colors flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <PieChartIcon className="w-4 h-4 text-ob-indigo-600 dark:text-ob-indigo-400" />
                <span>Regulatory Pipeline Breakdown</span>
              </h3>
              <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                {kpis.totalSubmissions30d} Total Returns
              </span>
            </div>

            {/* Donut Chart */}
            <div className="h-44 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.statusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={68}
                    paddingAngle={3}
                    dataKey="count"
                  >
                    {data.statusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any, name: any) => [`${value} Returns`, name]}
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      fontSize: '11px',
                      color: '#fff',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Centered Total Callout */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-base font-bold font-mono text-slate-900 dark:text-white">
                  {kpis.totalSubmissions30d}
                </span>
                <span className="text-[9px] text-slate-400 uppercase font-semibold">Returns</span>
              </div>
            </div>

            {/* Legend List */}
            <div className="space-y-1.5 mt-2">
              {data.statusDistribution.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-slate-700 dark:text-slate-300 font-medium">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="font-bold text-slate-900 dark:text-white">{item.count}</span>
                    <span className="text-slate-400 text-[10px]">({item.percentage}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Turnaround Time Buckets Card */}
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Review Turnaround Distribution</span>
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">&le;24h Target</span>
            </div>
            <div className="grid grid-cols-5 gap-1 text-center">
              {data.approvalBuckets.map((b) => (
                <div
                  key={b.rangeLabel}
                  className="bg-slate-50 dark:bg-slate-800/60 p-1.5 rounded-lg border border-slate-100 dark:border-slate-800"
                >
                  <div className="text-[9px] text-slate-500 dark:text-slate-400 truncate" title={b.rangeLabel}>
                    {b.rangeLabel.replace(' (Over SLA)', '')}
                  </div>
                  <div className="text-xs font-bold font-mono text-slate-900 dark:text-white mt-0.5">
                    {b.count}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Secondary Row: Department Reporting Performance & Timeliness */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Department Compliance & SLA Matrix */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs transition-colors">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-ob-indigo-600 dark:text-ob-indigo-400" />
                <span>Department Performance & Turnaround Speed</span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Turnaround efficiency and statutory review compliance by bank department.
              </p>
            </div>
          </div>

          {/* Department Horizontal Bar Comparison */}
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.departmentPerformance}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.15} />
                <XAxis type="number" stroke="#94a3b8" fontSize={10} tickLine={false} allowDecimals={false} />
                <YAxis
                  dataKey="shortCode"
                  type="category"
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(val: any, name: any) => [val, name]}
                  content={<CustomTooltip />}
                />
                <Legend
                  verticalAlign="top"
                  height={28}
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: '11px' }}
                />
                <Bar
                  dataKey="totalSubmissions"
                  name="Total Returns"
                  fill="#5962AB"
                  radius={[0, 4, 4, 0]}
                />
                <Bar
                  dataKey="transmittedCount"
                  name="Delivered to NBE"
                  fill="#10b981"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Detailed Department Performance Table */}
          <div className="overflow-x-auto mt-3 border-t border-slate-100 dark:border-slate-800 pt-2">
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  <th className="py-1.5 pr-2 font-semibold">Department</th>
                  <th className="py-1.5 px-2 font-semibold text-center">Volume</th>
                  <th className="py-1.5 px-2 font-semibold text-center">Avg Turnaround</th>
                  <th className="py-1.5 px-2 font-semibold text-center">SLA Compliance</th>
                  <th className="py-1.5 pl-2 font-semibold text-right">First-Pass</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {data.departmentPerformance.slice(0, 5).map((d) => (
                  <tr key={d.department} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-1.5 pr-2 font-medium text-slate-800 dark:text-slate-200 truncate max-w-[160px]">
                      {d.department}
                    </td>
                    <td className="py-1.5 px-2 font-mono text-center font-bold text-slate-900 dark:text-white">
                      {d.totalSubmissions}
                    </td>
                    <td className="py-1.5 px-2 font-mono text-center text-slate-700 dark:text-slate-300">
                      {d.avgTurnaroundHours}h
                    </td>
                    <td className="py-1.5 px-2 font-mono text-center">
                      <span className={`font-bold ${d.complianceRate >= 95 ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                        {d.complianceRate}%
                      </span>
                    </td>
                    <td className="py-1.5 pl-2 font-mono text-right text-slate-600 dark:text-slate-400">
                      {d.firstPassRate}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Frequency Breakdown & Recent 4-Eyes Audits */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs transition-colors flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Recent 4-Eyes Verified Statutory Returns</span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Dual-control maker submissions with checker review durations and NBE receipts.
                </p>
              </div>
              {onViewAllSubmissions && (
                <button
                  type="button"
                  onClick={onViewAllSubmissions}
                  className="text-xs text-ob-indigo-600 dark:text-ob-indigo-400 font-bold hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                >
                  <span>Ledger</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* List of Recent Audited Submissions */}
            <div className="space-y-2">
              {data.recentAuditedSubmissions.slice(0, 5).map((sub) => (
                <div
                  key={sub.id}
                  className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs hover:border-ob-indigo-300 dark:hover:border-ob-indigo-700 transition-colors"
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-ob-indigo-700 dark:text-ob-indigo-400">
                        {sub.reportKey}
                      </span>
                      <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[180px]">
                        {sub.reportTitle}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                      <span>Maker: {sub.makerName}</span>
                      <span aria-hidden="true">/</span>
                      <span>Checker: {sub.checkerName}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {sub.turnaroundHours}h
                      </span>
                      {sub.withinSla ? (
                        <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold">
                          Within SLA
                        </span>
                      ) : (
                        <span className="text-[10px] text-rose-700 dark:text-rose-400 font-bold">
                          Over SLA
                        </span>
                      )}
                    </div>
                    {sub.nbeReceipt && (
                      <div className="text-[9px] font-mono text-purple-600 dark:text-purple-400 truncate max-w-[120px]" title={sub.nbeReceipt}>
                        {sub.nbeReceipt}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Statutory Governance Note */}
          <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Full cryptographic audit trail active</span>
            </span>
            <span className="font-mono text-[10px] text-slate-400">NBE Institution #0000013</span>
          </div>
        </div>
      </div>

      {/* 5. Pending Review Aging & Statutory Review Queue */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>Pending Review Aging & Dual-Control Pipeline</span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Active statutory returns in 4-eyes review awaiting Checker authorization, classified by aging tier.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              {data.pendingReviewAging?.items?.length || 0} Pending Reviews
            </span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
              {data.pendingReviewAging?.overdueCount || 0} Breached SLA (&gt;24h)
            </span>
          </div>
        </div>

        {/* Aging Distribution Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
          {(data.pendingReviewAging?.buckets || []).map((b) => (
            <div
              key={b.bucket}
              className={`p-2.5 rounded-lg border text-center ${
                b.isBreached
                  ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200/80 dark:border-rose-800/60'
                  : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200/70 dark:border-slate-800'
              }`}
            >
              <div className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 flex items-center justify-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: b.color }} />
                <span>{b.bucket}</span>
              </div>
              <div className={`text-base font-bold font-mono mt-1 ${b.isBreached ? 'text-rose-700 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
                {b.count}
              </div>
              <div className="text-[9px] text-slate-400 mt-0.5">{b.percentage}% of Queue</div>
            </div>
          ))}
        </div>

        {/* Pending Review Table */}
        <div className="overflow-x-auto">
          {(!data.pendingReviewAging?.items || data.pendingReviewAging.items.length === 0) ? (
            <div className="p-6 text-center text-slate-500 dark:text-slate-400 text-xs">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-1.5" />
              <div className="font-semibold text-slate-700 dark:text-slate-300">No Pending Reviews in Queue</div>
              <div className="text-[11px] text-slate-400 mt-0.5">All regulatory submissions have been verified and processed.</div>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 text-[11px]">
                  <th className="py-2 pr-3 font-semibold">Report Return</th>
                  <th className="py-2 px-3 font-semibold">Department</th>
                  <th className="py-2 px-3 font-semibold">Maker</th>
                  <th className="py-2 px-3 font-semibold text-center">Submitted</th>
                  <th className="py-2 px-3 font-semibold text-center">Aging</th>
                  <th className="py-2 pl-3 font-semibold text-right">SLA Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {data.pendingReviewAging.items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 pr-3">
                      <div className="font-bold text-slate-900 dark:text-white">{item.reportTitle}</div>
                      <div className="font-mono text-[10px] text-ob-indigo-600 dark:text-ob-indigo-400">{item.reportKey}</div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                      {item.department}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                      {item.makerName}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-center text-slate-500 dark:text-slate-400">
                      {new Date(item.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-center font-bold">
                      <span className={item.slaStatus === 'BREACHED' ? 'text-rose-600 dark:text-rose-400' : item.slaStatus === 'WARNING' ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}>
                        {item.ageHours} hrs
                      </span>
                    </td>
                    <td className="py-2.5 pl-3 text-right">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        item.slaStatus === 'BREACHED'
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                          : item.slaStatus === 'WARNING'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      }`}>
                        {item.slaStatus === 'BREACHED' ? 'SLA Breached' : item.slaStatus === 'WARNING' ? 'Approaching SLA' : 'Within Target'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* PHASE 47: FULL VIEW / MAXIMIZED PERFORMANCE ANALYTICS */}
      {isMaximized && (
        <MaximizedViewModal
          isOpen={isMaximized}
          onClose={() => setIsMaximized(false)}
          title="Regulatory Reporting Performance & SLA Compliance Analytics"
          badge={`Live Analytics (${timeRange}D)`}
          subtitle="Dual-control verification velocity, statutory SLA compliance rates, and department performance"
          icon={BarChart3}
          actions={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportCsv}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                title="Export compliance dataset to CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
              <button
                type="button"
                onClick={handleExportJson}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                title="Export reporting dataset to JSON"
              >
                <span>JSON</span>
              </button>
            </div>
          }
        >
          <div className="space-y-6">
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/60 rounded-xl p-3">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Acceptance Rate</span>
                <div className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-1">
                  {kpis.submissionAcceptanceRate}%
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Approved & Transmitted</div>
              </div>

              <div className="bg-ob-indigo-50/50 dark:bg-ob-indigo-950/20 border border-ob-indigo-200/80 dark:border-ob-indigo-800/60 rounded-xl p-3">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Avg Turnaround</span>
                <div className="text-2xl font-bold font-mono text-ob-indigo-700 dark:text-ob-indigo-300 mt-1">
                  {kpis.averageReviewTurnaroundHours}h
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">SLA Target &le; 24h</div>
              </div>

              <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/60 rounded-xl p-3">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Pending Review</span>
                <div className="text-2xl font-bold font-mono text-amber-700 dark:text-amber-400 mt-1">
                  {kpis.pendingReviewAgingCount}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Awaiting Checker</div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">SLA Compliance</span>
                <div className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-1">
                  {kpis.slaComplianceRate}%
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Within 24h Window</div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Total Volume</span>
                <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1">
                  {kpis.totalSubmissions30d}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">{kpis.totalDepartmentsReporting} Depts</div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">NBE Delivered</span>
                <div className="text-2xl font-bold font-mono text-purple-700 dark:text-purple-400 mt-1">
                  {kpis.transmittedCount}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">{kpis.nbeTransmissionRate}% Transmitted</div>
              </div>
            </div>

            {/* Maximized Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Daily Volume Trend */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-2">Daily Submission Volume Trend</h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.dailyVolumeTrend}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Area type="monotone" dataKey="count" stroke="#1d4ed8" fill="#3b82f6" fillOpacity={0.2} name="Submissions" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Status Distribution */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-2">Statutory Pipeline Status</h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.statusDistribution}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} name="Submissions" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Department Breakdown Table in Full View */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-3">Department Performance & SLA Breakdown</h4>
              <div className="overflow-x-auto touch-scroll-x">
                <table className="w-full text-left text-xs min-w-[700px]">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 text-[11px] font-semibold">
                      <th className="py-2.5 px-3">Department</th>
                      <th className="py-2.5 px-3 text-center">Total Returns</th>
                      <th className="py-2.5 px-3 text-center">Approved</th>
                      <th className="py-2.5 px-3 text-center">Pending Review</th>
                      <th className="py-2.5 px-3 text-center">Avg Turnaround</th>
                      <th className="py-2.5 px-3 text-right">SLA Compliance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {data.departmentPerformance.map((dept) => (
                      <tr key={dept.departmentId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">{dept.departmentName}</td>
                        <td className="py-2.5 px-3 text-center font-mono">{dept.totalSubmissions}</td>
                        <td className="py-2.5 px-3 text-center font-mono text-emerald-600">{dept.approvedCount}</td>
                        <td className="py-2.5 px-3 text-center font-mono text-amber-600">{dept.pendingCount}</td>
                        <td className="py-2.5 px-3 text-center font-mono">{dept.avgTurnaroundHours}h</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600">{dept.slaComplianceRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </MaximizedViewModal>
      )}
    </div>
  );
};
