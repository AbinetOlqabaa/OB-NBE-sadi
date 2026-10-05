/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Filter,
  RefreshCw,
  Download,
  Flame,
  HelpCircle,
  Building2,
  ChevronRight,
  Info,
  X,
  Activity,
  Layers,
  Sparkles,
  ArrowRight,
  Check,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ReferenceLine,
  Cell,
} from 'recharts';
import {
  dataQualityAnalyticsService,
  VALIDATION_CATEGORIES,
  type DepartmentHeatmapCell,
  type RecurringErrorDetail,
  type ValidationErrorCategory,
} from '../services/dataQualityAnalyticsService.ts';
import type { UserSession } from '../types/regulatory.ts';

interface DataQualityHeatmapProps {
  currentUser: UserSession;
  onInspectReport?: (reportKey: string) => void;
  onNavigateToSubmissions?: () => void;
}

export const DataQualityHeatmap: React.FC<DataQualityHeatmapProps> = ({
  currentUser,
  onInspectReport,
  onNavigateToSubmissions,
}) => {
  const [timeRange, setTimeRange] = useState<number>(30);
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedSeverity, setSelectedSeverity] = useState<'ALL' | 'CRITICAL' | 'HIGH' | 'MODERATE'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'HEATMAP' | 'RECURRING_LIST' | 'TRENDS'>('HEATMAP');
  const [selectedCell, setSelectedCell] = useState<DepartmentHeatmapCell | null>(null);
  const [selectedErrorDetail, setSelectedErrorDetail] = useState<RecurringErrorDetail | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Compute analytics
  const analyticsData = useMemo(() => {
    return dataQualityAnalyticsService.getQualityAnalytics({
      timeRangeDays: timeRange,
      department: selectedDept,
      severity: selectedSeverity,
      category: selectedCategory,
    });
  }, [timeRange, selectedDept, selectedSeverity, selectedCategory, isRefreshing]);

  const refreshData = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 250);
  };

  // CSV Export Handler
  const handleExportCsv = () => {
    let csv = 'Department,Department Code,Validation Category,Error Count,Recurring Count,Unique Returns,Severity Level\n';
    analyticsData.heatmapMatrix.forEach((cell) => {
      csv += `"${cell.departmentName}","${cell.departmentShort}","${cell.categoryName}",${cell.errorCount},${cell.recurringCount},${cell.uniqueReturnsCount},"${cell.severity}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `Oromia_Bank_Data_Quality_Heatmap_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Color Intensity Function for Heatmap
  const getCellStyles = (cell: DepartmentHeatmapCell) => {
    if (cell.errorCount === 0) {
      return {
        bg: 'bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50',
        border: 'border-emerald-200 dark:border-emerald-800/60',
        text: 'text-emerald-700 dark:text-emerald-300',
        badge: 'bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200',
        indicator: 'bg-emerald-500',
        label: 'Clean',
      };
    }
    if (cell.errorCount <= 2) {
      return {
        bg: 'bg-yellow-50 dark:bg-yellow-950/40 hover:bg-yellow-100 dark:hover:bg-yellow-900/50',
        border: 'border-yellow-200 dark:border-yellow-800/60',
        text: 'text-yellow-800 dark:text-yellow-300',
        badge: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-900 dark:text-yellow-100',
        indicator: 'bg-yellow-500',
        label: 'Low',
      };
    }
    if (cell.errorCount <= 5) {
      return {
        bg: 'bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50',
        border: 'border-amber-300 dark:border-amber-800',
        text: 'text-amber-900 dark:text-amber-300',
        badge: 'bg-amber-100 dark:bg-amber-900 text-amber-900 dark:text-amber-100',
        indicator: 'bg-amber-500',
        label: 'Moderate',
      };
    }
    if (cell.errorCount <= 9) {
      return {
        bg: 'bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60',
        border: 'border-rose-300 dark:border-rose-800',
        text: 'text-rose-800 dark:text-rose-300',
        badge: 'bg-rose-100 dark:bg-rose-900 text-rose-900 dark:text-rose-100',
        indicator: 'bg-rose-500',
        label: 'High Risk',
      };
    }
    return {
      bg: 'bg-rose-600 dark:bg-rose-700 text-white hover:bg-rose-700 dark:hover:bg-rose-800',
      border: 'border-rose-700 dark:border-rose-600',
      text: 'text-white',
      badge: 'bg-white/20 text-white font-bold',
      indicator: 'bg-white',
      label: 'Critical Recurring',
    };
  };

  // Unique departments in matrix
  const departmentsList = useMemo(() => {
    const map = new Map<string, { id: string; name: string; short: string }>();
    analyticsData.heatmapMatrix.forEach((m) => {
      if (!map.has(m.departmentId)) {
        map.set(m.departmentId, {
          id: m.departmentId,
          name: m.departmentName,
          short: m.departmentShort,
        });
      }
    });
    return Array.from(map.values());
  }, [analyticsData.heatmapMatrix]);

  // Recharts Bar Data for Department Error Comparison
  const departmentChartData = useMemo(() => {
    return analyticsData.departmentSummaries.map((dept) => {
      const nonRecurring = Math.max(0, dept.totalValidationErrors - dept.recurringErrorsCount);
      return {
        name: dept.departmentShort,
        fullName: dept.departmentName,
        'Single Errors': nonRecurring,
        'Recurring Errors': dept.recurringErrorsCount,
        'Quality Score': dept.dataQualityScore,
        total: dept.totalValidationErrors,
      };
    });
  }, [analyticsData.departmentSummaries]);

  return (
    <div className="space-y-4">
      {/* 1. Header & Controls Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-2xs transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400">
                <Flame className="w-4 h-4" />
              </span>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Data Quality Heatmap & Recurring Validation Error Hotspots
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
                Recharts Visual Engine
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Identifies systemic data quality bottlenecks and departments with recurring pre-flight validation errors across 6 regulatory rule dimensions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Time Window */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 border border-slate-200 dark:border-slate-700">
              {[7, 14, 30, 90].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setTimeRange(days)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    timeRange === days
                      ? 'bg-white dark:bg-slate-700 text-ob-indigo-600 dark:text-ob-indigo-400 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {days}d
                </button>
              ))}
            </div>

            {/* Department Filter */}
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              aria-label="Filter by department"
              className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-700 dark:text-slate-300 font-medium focus:outline-none focus:ring-1 focus:ring-ob-indigo-500 cursor-pointer"
            >
              <option value="ALL">All Departments</option>
              {departmentsList.map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>

            {/* Severity Filter */}
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value as any)}
              aria-label="Filter by severity level"
              className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-700 dark:text-slate-300 font-medium focus:outline-none focus:ring-1 focus:ring-ob-indigo-500 cursor-pointer"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical Only</option>
              <option value="HIGH">High Severity</option>
              <option value="MODERATE">Moderate Severity</option>
            </select>

            <button
              type="button"
              onClick={refreshData}
              className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors cursor-pointer"
              title="Refresh Heatmap Dataset"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              title="Export Heatmap Matrix as CSV"
            >
              <Download className="w-3.5 h-3.5 text-ob-indigo-500" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Executive Quality KPI Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Data Quality Index (DQI)
            </span>
            <div className="w-6 h-6 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {analyticsData.overallScore}%
            </span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              Target: ≥ 90%
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Weighted composite score across 6 validation dimensions
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Recurring Validation Faults
            </span>
            <div className="w-6 h-6 rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center border border-rose-200 dark:border-rose-800">
              <Flame className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-600 dark:text-rose-400">
              {analyticsData.totalRecurringErrors}
            </span>
            <span className="text-xs text-slate-400">
              of {analyticsData.totalValidationErrors} total exceptions
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Rules failing 2+ times within the same reporting cycle
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Primary Error Hotspot
            </span>
            <div className="w-6 h-6 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center border border-amber-200 dark:border-amber-800">
              <Building2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {analyticsData.hotspotDepartment}
            </div>
            <div className="text-xs text-amber-600 dark:text-amber-400 font-semibold mt-0.5">
              Requires validation remediation focus
            </div>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Highest concentration of recurring formula/blank faults
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Zero-Fault Submission Rate
            </span>
            <div className="w-6 h-6 rounded-md bg-ob-indigo-50 dark:bg-ob-indigo-950/60 text-ob-indigo-600 flex items-center justify-center border border-ob-indigo-200 dark:border-ob-indigo-800">
              <ShieldAlert className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-ob-indigo-600 dark:text-ob-indigo-400">
              {analyticsData.cleanSubmissionsRate}%
            </span>
            <span className="text-xs text-slate-400">first-pass clean</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Filings passing all NBE statutory gates on initial draft
          </div>
        </div>
      </div>

      {/* 3. Visual Subtab Selector */}
      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('HEATMAP')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            activeTab === 'HEATMAP'
              ? 'bg-ob-indigo-600 text-white shadow-2xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Flame className="w-3.5 h-3.5" />
          <span>Department Validation Matrix Heatmap</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('TRENDS')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            activeTab === 'TRENDS'
              ? 'bg-ob-indigo-600 text-white shadow-2xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Recharts Department & Trend Visualizations</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('RECURRING_LIST')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            activeTab === 'RECURRING_LIST'
              ? 'bg-ob-indigo-600 text-white shadow-2xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Recurring Exceptions Queue ({analyticsData.recurringErrorsList.length})</span>
        </button>
      </div>

      {/* 4. Tab 1: Interactive Heatmap Grid */}
      {activeTab === 'HEATMAP' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <span>Validation Error Intensity Matrix</span>
                <span className="text-[10px] text-slate-400 font-normal lowercase">
                  (click cell for recurring rule diagnostics)
                </span>
              </h3>
            </div>

            {/* Heatmap Legend */}
            <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
              <span>Error Intensity:</span>
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-emerald-100 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-800" title="0 Clean" />
                <span className="text-slate-500">0 (Clean)</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-yellow-100 dark:bg-yellow-950 border border-yellow-300 dark:border-yellow-800" title="1-2 Low" />
                <span className="text-slate-500">1-2</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-amber-200 dark:bg-amber-900 border border-amber-400 dark:border-amber-700" title="3-5 Moderate" />
                <span className="text-slate-500">3-5</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-rose-200 dark:bg-rose-900 border border-rose-400 dark:border-rose-700" title="6-9 High" />
                <span className="text-slate-500">6-9</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-rose-600 border border-rose-700" title="10+ Critical Recurring" />
                <span className="text-rose-600 dark:text-rose-400 font-bold">10+ (Severe)</span>
              </div>
            </div>
          </div>

          {/* Matrix Grid */}
          <div className="overflow-x-auto min-w-full touch-scroll-x">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="py-2.5 px-3 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/80 rounded-l-lg border-b border-slate-200 dark:border-slate-800 w-64">
                    Reporting Bank Department
                  </th>
                  {VALIDATION_CATEGORIES.map((cat) => (
                    <th
                      key={cat.key}
                      className="py-2.5 px-2 text-center text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800"
                    >
                      <div className="truncate max-w-[130px] mx-auto" title={cat.description}>
                        {cat.shortLabel}
                      </div>
                      <div className="text-[9px] text-slate-400 font-normal uppercase tracking-tight truncate">
                        {cat.defaultSeverity}
                      </div>
                    </th>
                  ))}
                  <th className="py-2.5 px-3 text-center text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/80 rounded-r-lg border-b border-slate-200 dark:border-slate-800">
                    Dept Quality
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {departmentsList.map((dept) => {
                  const deptSummary = analyticsData.departmentSummaries.find(
                    (d) => d.departmentId === dept.id
                  );
                  return (
                    <tr key={dept.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-bold text-xs text-slate-900 dark:text-white">
                          {dept.name}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                          <span className="font-mono font-semibold text-ob-indigo-600 dark:text-ob-indigo-400">
                            {dept.short}
                          </span>
                          <span>•</span>
                          <span>{deptSummary?.totalSubmissions || 0} returns in window</span>
                        </div>
                      </td>

                      {VALIDATION_CATEGORIES.map((cat) => {
                        const cell = analyticsData.heatmapMatrix.find(
                          (m) => m.departmentId === dept.id && m.categoryKey === cat.key
                        );
                        if (!cell) return <td key={cat.key} className="p-1" />;

                        const style = getCellStyles(cell);

                        return (
                          <td key={cat.key} className="p-1 text-center">
                            <button
                              type="button"
                              onClick={() => setSelectedCell(cell)}
                              className={`w-full min-h-[52px] p-2 rounded-lg border transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer text-center relative group ${style.bg} ${style.border}`}
                              title={`${dept.name} - ${cat.name}: ${cell.errorCount} total errors, ${cell.recurringCount} recurring faults across ${cell.uniqueReturnsCount} returns.`}
                            >
                              <div className="flex items-center gap-1">
                                <span className={`text-xs font-black ${style.text}`}>
                                  {cell.errorCount}
                                </span>
                                {cell.recurringCount > 0 && (
                                  <span
                                    className="text-[9px] font-bold text-rose-500 dark:text-rose-400 flex items-center"
                                    title={`${cell.recurringCount} recurring`}
                                  >
                                    <Flame className="w-2.5 h-2.5 fill-current" />
                                    <span>{cell.recurringCount}</span>
                                  </span>
                                )}
                              </div>
                              <span className="text-[9px] font-medium text-slate-500 dark:text-slate-400 leading-none">
                                {style.label}
                              </span>
                            </button>
                          </td>
                        );
                      })}

                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span
                            className={`text-xs font-black ${
                              (deptSummary?.dataQualityScore || 100) >= 90
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : (deptSummary?.dataQualityScore || 100) >= 80
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {deptSummary?.dataQualityScore || 95}%
                          </span>
                          <span className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">
                            {deptSummary?.riskRating || 'LOW'}
                          </span>
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

      {/* 5. Tab 2: Recharts Visualizations */}
      {activeTab === 'TRENDS' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Recharts Bar Chart: Department Recurring Errors Breakdown */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs transition-colors">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Recurring vs Single Validation Errors by Department
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Stacked distribution highlighting systemic recurring faults (Recharts Bar)
                </p>
              </div>
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={departmentChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} interval={0} angle={-15} textAnchor="end" />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} />
                  <RechartsTooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const item = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white p-2.5 rounded-xl border border-slate-700 shadow-xl text-xs">
                            <div className="font-bold border-b border-slate-700 pb-1 mb-1">{item.fullName}</div>
                            <div className="space-y-1">
                              <div className="flex justify-between gap-4 text-emerald-400">
                                <span>Single Exceptions:</span>
                                <span className="font-bold font-mono">{item['Single Errors']}</span>
                              </div>
                              <div className="flex justify-between gap-4 text-rose-400">
                                <span>Recurring Faults:</span>
                                <span className="font-bold font-mono">{item['Recurring Errors']}</span>
                              </div>
                              <div className="flex justify-between gap-4 text-ob-indigo-300 border-t border-slate-800 pt-1">
                                <span>Quality Score:</span>
                                <span className="font-bold font-mono">{item['Quality Score']}%</span>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="Single Errors" stackId="a" fill="#facc15" radius={[0, 0, 0, 0]} name="Single Occurrences" />
                  <Bar dataKey="Recurring Errors" stackId="a" fill="#f43f5e" radius={[4, 4, 0, 0]} name="Recurring Faults (≥ 2x)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recharts Area Chart: Validation Error Trend Over Cycles */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs transition-colors">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Validation Error Velocity & Remediation Trajectory
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Total vs recurring error counts across the past 6 reporting cycles (Recharts Area)
                </p>
              </div>
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analyticsData.timeSeriesTrend} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorRec" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
                  <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                  <RechartsTooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-slate-900 text-white p-2.5 rounded-xl border border-slate-700 shadow-xl text-xs">
                            <div className="font-bold border-b border-slate-700 pb-1 mb-1">Cycle: {label}</div>
                            {payload.map((entry: any, index: number) => (
                              <div key={`entry-${index}`} className="flex justify-between gap-4" style={{ color: entry.color }}>
                                <span>{entry.name}:</span>
                                <span className="font-bold font-mono">{entry.value}</span>
                              </div>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Area
                    type="monotone"
                    dataKey="totalErrors"
                    stroke="#6366f1"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorTotal)"
                    name="Total Validation Exceptions"
                  />
                  <Area
                    type="monotone"
                    dataKey="recurringErrors"
                    stroke="#f43f5e"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorRec)"
                    name="Recurring Validation Faults"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* 6. Tab 3: Detailed Recurring Exceptions Queue */}
      {activeTab === 'RECURRING_LIST' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs transition-colors">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                <span>Identified Recurring Validation Exceptions Queue</span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Rule violations failing 2+ times in the same department with suggested automated auto-fixes
              </p>
            </div>
          </div>

          {analyticsData.recurringErrorsList.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                No Recurring Validation Exceptions Found
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                All submissions in the selected filter window comply with NBE quality standards.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {analyticsData.recurringErrorsList.map((err) => (
                <div key={err.id} className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-ob-indigo-600 dark:text-ob-indigo-400">
                        {err.ruleCode}
                      </span>
                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          err.severity === 'CRITICAL'
                            ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                            : err.severity === 'HIGH'
                            ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                            : 'bg-yellow-100 dark:bg-yellow-950 text-yellow-800 dark:text-yellow-300'
                        }`}
                      >
                        {err.severity}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">
                        {err.departmentName}
                      </span>
                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <span className="text-xs text-slate-500 font-mono">
                        {err.reportKey} ({err.reportTitle})
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                      {err.ruleDescription}
                    </p>

                    <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800/60 max-w-2xl">
                      <Sparkles className="w-3.5 h-3.5 shrink-0" />
                      <span><strong>Remediation Guidance:</strong> {err.remediationAdvice}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-sm font-black text-rose-600 dark:text-rose-400 flex items-center justify-end gap-1">
                        <Flame className="w-3.5 h-3.5 fill-current" />
                        <span>{err.recurrenceCount}x Recurrences</span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Last detected {new Date(err.lastEncountered).toLocaleDateString()}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onInspectReport?.(err.reportKey)}
                      className="px-2.5 py-1.5 text-xs font-semibold text-ob-indigo-600 dark:text-ob-indigo-400 bg-ob-indigo-50 dark:bg-ob-indigo-950/60 hover:bg-ob-indigo-100 dark:hover:bg-ob-indigo-900 border border-ob-indigo-200 dark:border-ob-indigo-800 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <span>Inspect Return</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 7. Cell Drilldown Modal / Drawer */}
      {selectedCell && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-5 shadow-2xl relative space-y-4 max-h-[85vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setSelectedCell(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-ob-indigo-100 dark:bg-ob-indigo-900 text-ob-indigo-700 dark:text-ob-indigo-300">
                  {selectedCell.departmentShort}
                </span>
                <span className="text-xs text-slate-400">•</span>
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  {selectedCell.categoryName}
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                {selectedCell.departmentName}
              </h3>
            </div>

            <div className="grid grid-cols-3 gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
              <div>
                <span className="text-[10px] text-slate-400 font-semibold block uppercase">Total Exceptions</span>
                <span className="text-lg font-black text-slate-900 dark:text-white">{selectedCell.errorCount}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-semibold block uppercase">Recurring Faults</span>
                <span className="text-lg font-black text-rose-600">{selectedCell.recurringCount}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-semibold block uppercase">Returns Affected</span>
                <span className="text-lg font-black text-ob-indigo-600">{selectedCell.uniqueReturnsCount}</span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-1.5 uppercase tracking-wider">
                Observed Recurring Issue Patterns
              </h4>
              <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                {selectedCell.sampleIssues.map((issue, idx) => (
                  <li key={idx} className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <span>{issue}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedCell(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Close Inspector
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedCell(null);
                  setActiveTab('RECURRING_LIST');
                }}
                className="px-3 py-1.5 text-xs font-bold text-white bg-ob-indigo-600 hover:bg-ob-indigo-700 rounded-lg transition-colors cursor-pointer"
              >
                View in Exceptions Queue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
