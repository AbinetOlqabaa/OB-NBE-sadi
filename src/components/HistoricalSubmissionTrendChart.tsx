/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  FileSpreadsheet,
  Download,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Building2,
  Eye,
  Info,
  Layers,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Sparkles,
  Table as TableIcon,
  RotateCcw,
  CalendarDays,
  CalendarRange,
  Check,
  FileDown,
  X,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { MaximizedViewModal } from './MaximizedViewModal.tsx';
import { MaximizeButton } from './MaximizeButton.tsx';
import {
  auditorService,
  type HistoricalReportTrendResult,
  type HistoricalTrendMonthPoint,
  type HistoricalTrendOptions,
} from '../services/auditorService.ts';
import { getAllReports } from '../data/report-registry.ts';
import type { UserSession } from '../types/regulatory.ts';

interface HistoricalSubmissionTrendChartProps {
  currentUser?: UserSession;
  initialReportKey?: string;
  onSelectReportKey?: (reportKey: string) => void;
  onInspectSubmission?: (reportKey: string, month: string) => void;
  compact?: boolean;
}

export const HistoricalSubmissionTrendChart: React.FC<HistoricalSubmissionTrendChartProps> = ({
  currentUser,
  initialReportKey = 'ANARN001',
  onSelectReportKey,
  onInspectSubmission,
  compact = false,
}) => {
  const [selectedReportKey, setSelectedReportKey] = useState<string>(initialReportKey);
  const [selectedFieldCode, setSelectedFieldCode] = useState<string>('');
  
  // Date range filter states
  const [rangePreset, setRangePreset] = useState<'3M' | '6M' | '12M' | '18M' | '24M' | '36M' | 'CUSTOM'>('12M');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState<boolean>(false);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  
  // Custom date picker inputs (defaulting to 12 months ago up to today)
  const defaultDates = useMemo(() => {
    const now = new Date();
    const endStr = now.toISOString().split('T')[0];
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 11);
    startDate.setDate(1);
    const startStr = startDate.toISOString().split('T')[0];
    return { startStr, endStr };
  }, []);

  const [customStartDate, setCustomStartDate] = useState<string>(defaultDates.startStr);
  const [customEndDate, setCustomEndDate] = useState<string>(defaultDates.endStr);
  const [dateError, setDateError] = useState<string | null>(null);
  
  // Applied custom range
  const [appliedCustomRange, setAppliedCustomRange] = useState<{ startDate: string; endDate: string } | null>(null);

  // Chart configuration
  const [showSecondaryMetric, setShowSecondaryMetric] = useState<boolean>(true);
  const [showBenchmarkLine, setShowBenchmarkLine] = useState<boolean>(true);
  const [showDataTable, setShowDataTable] = useState<boolean>(false);
  const [exportNotice, setExportNotice] = useState<{ message: string; timestamp: string } | null>(null);

  const allReports = useMemo(() => getAllReports(), []);

  // Compute trend options
  const trendOptions: HistoricalTrendOptions = useMemo(() => {
    const opts: HistoricalTrendOptions = {
      customFieldCode: selectedFieldCode || undefined,
    };

    if (rangePreset === 'CUSTOM' && appliedCustomRange) {
      opts.startDate = appliedCustomRange.startDate;
      opts.endDate = appliedCustomRange.endDate;
    } else {
      switch (rangePreset) {
        case '3M':
          opts.monthsCount = 3;
          break;
        case '6M':
          opts.monthsCount = 6;
          break;
        case '12M':
          opts.monthsCount = 12;
          break;
        case '18M':
          opts.monthsCount = 18;
          break;
        case '24M':
          opts.monthsCount = 24;
          break;
        case '36M':
          opts.monthsCount = 36;
          break;
        default:
          opts.monthsCount = 12;
      }
    }
    return opts;
  }, [selectedFieldCode, rangePreset, appliedCustomRange]);

  // Compute historical trend dataset
  const trendData: HistoricalReportTrendResult = useMemo(() => {
    return auditorService.getHistoricalTrend(selectedReportKey, trendOptions);
  }, [selectedReportKey, trendOptions]);

  // Handle report selection change
  const handleReportChange = (newKey: string) => {
    setSelectedReportKey(newKey);
    setSelectedFieldCode('');
    onSelectReportKey?.(newKey);
  };

  // Format currency helpers
  const formatCurrency = (val: number): string => {
    if (Math.abs(val) >= 1_000_000_000) {
      return `${(val / 1_000_000_000).toFixed(2)}B ETB`;
    }
    if (Math.abs(val) >= 1_000_000) {
      return `${(val / 1_000_000).toFixed(2)}M ETB`;
    }
    return `${val.toLocaleString()} ETB`;
  };

  const formatShortCurrency = (val: number): string => {
    if (Math.abs(val) >= 1_000_000_000) {
      return `${(val / 1_000_000_000).toFixed(1)}B`;
    }
    if (Math.abs(val) >= 1_000_000) {
      return `${(val / 1_000_000).toFixed(1)}M`;
    }
    if (Math.abs(val) >= 1_000) {
      return `${(val / 1_000).toFixed(0)}k`;
    }
    return String(val);
  };

  // Apply custom date range
  const handleApplyCustomDateRange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customStartDate || !customEndDate) {
      setDateError('Please enter both start and end cutoff dates.');
      return;
    }
    if (new Date(customStartDate) > new Date(customEndDate)) {
      setDateError('Start date must be before or equal to end date.');
      return;
    }
    setDateError(null);
    setAppliedCustomRange({
      startDate: customStartDate,
      endDate: customEndDate,
    });
    setRangePreset('CUSTOM');
    setIsDatePickerOpen(false);
  };

  // Reset date range to default 12M
  const handleResetTo12M = () => {
    setRangePreset('12M');
    setAppliedCustomRange(null);
    setCustomStartDate(defaultDates.startStr);
    setCustomEndDate(defaultDates.endStr);
    setDateError(null);
    setIsDatePickerOpen(false);
  };

  // CSV Export for Offline Regulatory Analysis
  const handleExportCsv = () => {
    const actorName = currentUser?.name || 'Auditor Inspector (Oromia Bank)';
    const csvContent = auditorService.generateCsvExport(trendData, actorName);
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const dateStamp = new Date().toISOString().split('T')[0];
    link.setAttribute(
      'download',
      `Oromia_Bank_Regulatory_Historical_Trend_${trendData.reportKey}_${rangePreset}_${dateStamp}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setExportNotice({
      message: `Offline CSV Regulatory Export generated for ${trendData.reportKey} (${trendData.months.length} periods).`,
      timestamp: new Date().toLocaleTimeString(),
    });

    setTimeout(() => {
      setExportNotice(null);
    }, 5000);
  };

  // Custom Chart Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const point: HistoricalTrendMonthPoint = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white p-3.5 rounded-2xl shadow-2xl border border-slate-700 text-xs space-y-2 max-w-xs">
          <div className="flex items-center justify-between border-b border-slate-700/80 pb-1.5 gap-3">
            <div>
              <div className="font-bold text-slate-200">{point.monthFull}</div>
              <div className="text-[10px] text-slate-400 font-mono">Period: {point.period}</div>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                point.status === 'SENT'
                  ? 'bg-purple-900 text-purple-200 border border-purple-700'
                  : 'bg-emerald-900 text-emerald-200 border border-emerald-700'
              }`}
            >
              {point.status}
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-ob-indigo-300 font-semibold truncate max-w-[170px]" title={trendData.primaryFieldName}>
                <span className="w-2 h-2 rounded-full bg-ob-indigo-400 shrink-0" />
                <span className="truncate">{trendData.primaryFieldName}:</span>
              </span>
              <span className="font-mono font-bold text-white shrink-0">
                {formatCurrency(point.primaryValue)}
              </span>
            </div>

            {showSecondaryMetric && point.secondaryValue > 0 && (
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 text-emerald-300 font-semibold truncate max-w-[170px]" title={trendData.secondaryFieldName}>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                  <span className="truncate">{trendData.secondaryFieldName}:</span>
                </span>
                <span className="font-mono font-bold text-slate-200 shrink-0">
                  {formatCurrency(point.secondaryValue)}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between gap-4 text-slate-400 text-[11px] pt-1 border-t border-slate-800">
              <span>Variance vs Period Mean:</span>
              <span className={`font-mono font-bold ${point.variancePercentage >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {point.variancePercentage >= 0 ? `+${point.variancePercentage}%` : `${point.variancePercentage}%`}
              </span>
            </div>

            {point.hasFinding && (
              <div className="mt-1 p-1.5 bg-rose-950/80 border border-rose-800/80 rounded-lg text-rose-300 text-[10px] flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>Audit finding or supervisory exception recorded</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  const summary = trendData.summary;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xs transition-colors space-y-4">
      {/* 1. Control Header & Report Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-ob-indigo-50 dark:bg-ob-indigo-950/70 border border-ob-indigo-200 dark:border-ob-indigo-800 text-ob-indigo-600 dark:text-ob-indigo-400">
              <TrendingUp className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Historical Statutory Submission Value Trend & Analysis
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
              Recharts Line Engine
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Supervisory trend tracking across historical filing cycles to identify seasonal growth, cyclical exposure surges, and audit anomalies.
          </p>
        </div>

        {/* Action Controls & Date Range Pickers */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Report Key Dropdown */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="auditor-report-select" className="text-xs font-semibold text-slate-600 dark:text-slate-400 shrink-0">
              Return:
            </label>
            <select
              id="auditor-report-select"
              value={selectedReportKey}
              onChange={(e) => handleReportChange(e.target.value)}
              aria-label="Select report key for historical trend"
              className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200 font-bold focus:outline-none focus:ring-1 focus:ring-ob-indigo-500 cursor-pointer max-w-[220px] truncate"
            >
              {allReports.map((r) => (
                <option key={r.ReturnKey} value={r.ReturnKey}>
                  {r.ReturnKey} — {r.Title}
                </option>
              ))}
            </select>
          </div>

          {/* Metric / Field Selector */}
          {trendData.availableNumericFields.length > 1 && (
            <div className="flex items-center gap-1.5">
              <label htmlFor="auditor-field-select" className="text-xs font-semibold text-slate-600 dark:text-slate-400 shrink-0">
                Metric:
              </label>
              <select
                id="auditor-field-select"
                value={selectedFieldCode}
                onChange={(e) => setSelectedFieldCode(e.target.value)}
                aria-label="Select statutory numeric field"
                className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-1 focus:ring-ob-indigo-500 cursor-pointer max-w-[180px] truncate"
              >
                {trendData.availableNumericFields.map((f) => (
                  <option key={f.code} value={f.code}>
                    {f.code}: {f.description}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Date Range Presets */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 border border-slate-200 dark:border-slate-700">
            {(['3M', '6M', '12M', '24M', '36M'] as const).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setRangePreset(preset);
                  setAppliedCustomRange(null);
                }}
                className={`px-2 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  rangePreset === preset
                    ? 'bg-white dark:bg-slate-700 text-ob-indigo-600 dark:text-ob-indigo-400 shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {preset}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
                rangePreset === 'CUSTOM'
                  ? 'bg-ob-indigo-600 text-white shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Open Custom Date Range Picker"
            >
              <CalendarRange className="w-3 h-3" />
              <span>Custom Range</span>
            </button>
          </div>

          {/* CSV Export Button for Offline Regulatory Analysis */}
          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-ob-indigo-600 hover:bg-ob-indigo-700 border border-ob-indigo-700 rounded-lg shadow-2xs transition-colors cursor-pointer"
            title="Export full line chart historical dataset to CSV for offline regulatory analysis"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Export Success Notification Banner */}
      {exportNotice && (
        <div className="p-2.5 rounded-xl text-xs bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 flex items-center justify-between transition-all">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span><strong>Regulatory Export Complete:</strong> {exportNotice.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setExportNotice(null)}
            className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. Interactive Date Range Picker Dropdown / Panel */}
      {isDatePickerOpen && (
        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
            <div className="flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4 text-ob-indigo-600 dark:text-ob-indigo-400" />
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Custom Historical Date Range Filter
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setIsDatePickerOpen(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleApplyCustomDateRange} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <label htmlFor="auditor-start-date" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Start Date (Cutoff From):
              </label>
              <input
                id="auditor-start-date"
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-1 focus:ring-ob-indigo-500 cursor-pointer"
              />
            </div>

            <div>
              <label htmlFor="auditor-end-date" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                End Date (Cutoff To):
              </label>
              <input
                id="auditor-end-date"
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-1 focus:ring-ob-indigo-500 cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="flex-1 px-3 py-1.5 text-xs font-bold text-white bg-ob-indigo-600 hover:bg-ob-indigo-700 rounded-lg transition-colors cursor-pointer"
              >
                Apply Date Range
              </button>
              <button
                type="button"
                onClick={handleResetTo12M}
                className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1"
                title="Reset to default 12-month window"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset (12M)</span>
              </button>
            </div>
          </form>

          {dateError && (
            <div className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              <span>{dateError}</span>
            </div>
          )}
        </div>
      )}

      {/* Active Filter Indicator Badge */}
      <div className="flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-800/40 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-500 dark:text-slate-400">
            Active Filter Window:
          </span>
          <span className="font-bold text-ob-indigo-700 dark:text-ob-indigo-300">
            {rangePreset === 'CUSTOM' && appliedCustomRange
              ? `${appliedCustomRange.startDate} to ${appliedCustomRange.endDate} (${trendData.months.length} reporting periods)`
              : `Past ${trendData.months.length} Months (${trendData.months[0]?.monthFull || ''} – ${trendData.months[trendData.months.length - 1]?.monthFull || ''})`}
          </span>
        </div>

        {rangePreset !== '12M' && (
          <button
            type="button"
            onClick={handleResetTo12M}
            className="text-[11px] font-bold text-ob-indigo-600 dark:text-ob-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset to Default 12M</span>
          </button>
        )}
      </div>

      {/* 3. Executive Trend Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Card 1: Latest Submission Value */}
        <div className="bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Latest Submission Value
          </span>
          <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-1 truncate">
            {formatCurrency(summary.currentValue)}
          </div>
          <div className="flex items-center gap-1 mt-1 text-[11px] font-semibold">
            {summary.momGrowthRate >= 0 ? (
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center">
                <ArrowUpRight className="w-3.5 h-3.5" />
                +{summary.momGrowthRate}% MoM
              </span>
            ) : (
              <span className="text-rose-600 dark:text-rose-400 flex items-center">
                <ArrowDownRight className="w-3.5 h-3.5" />
                {summary.momGrowthRate}% MoM
              </span>
            )}
          </div>
        </div>

        {/* Card 2: Period Mean Average */}
        <div className="bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Period Mean Average
          </span>
          <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-1 truncate">
            {formatCurrency(summary.twelveMonthMean)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Baseline mean across {trendData.months.length} months
          </div>
        </div>

        {/* Card 3: Period High */}
        <div className="bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Period Peak / High
          </span>
          <div className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1 truncate">
            {formatCurrency(summary.twelveMonthHigh.value)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Peak month: {summary.twelveMonthHigh.month}
          </div>
        </div>

        {/* Card 4: Period Low */}
        <div className="bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Period Low
          </span>
          <div className="text-base sm:text-lg font-black text-slate-700 dark:text-slate-300 mt-1 truncate">
            {formatCurrency(summary.twelveMonthLow.value)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Low month: {summary.twelveMonthLow.month}
          </div>
        </div>

        {/* Card 5: Annual Growth & Volatility */}
        <div className="bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3 col-span-2 sm:col-span-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Period Growth Trajectory
          </span>
          <div className="text-base sm:text-lg font-black text-ob-indigo-600 dark:text-ob-indigo-400 mt-1">
            {summary.twelveMonthAnnualGrowth >= 0 ? `+${summary.twelveMonthAnnualGrowth}%` : `${summary.twelveMonthAnnualGrowth}%`}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Spread σ: {summary.volatilityIndex}%
          </div>
        </div>
      </div>

      {/* 4. Recharts Line Chart Container */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 px-1">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-ob-indigo-600 dark:text-ob-indigo-400">
              {trendData.reportKey}
            </span>
            <span>•</span>
            <span className="text-slate-800 dark:text-slate-200 font-bold">
              {trendData.primaryFieldName}
            </span>
            <span className="text-slate-400 text-[11px] font-normal">
              ({trendData.department} • {trendData.frequency})
            </span>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={showSecondaryMetric}
                onChange={(e) => setShowSecondaryMetric(e.target.checked)}
                className="rounded text-ob-indigo-600 focus:ring-ob-indigo-500 cursor-pointer"
              />
              <span>Secondary Metric</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={showBenchmarkLine}
                onChange={(e) => setShowBenchmarkLine(e.target.checked)}
                className="rounded text-ob-indigo-600 focus:ring-ob-indigo-500 cursor-pointer"
              />
              <span>Mean Baseline Line</span>
            </label>
          </div>
        </div>

        <div className="h-72 sm:h-80 w-full min-h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={trendData.months}
              margin={{ top: 15, right: 20, left: 10, bottom: 5 }}
            >
              <defs>
                <linearGradient id="gradientPrimary" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.2} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.18} />
              <XAxis
                dataKey="month"
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                dy={6}
                interval={trendData.months.length > 20 ? 2 : trendData.months.length > 12 ? 1 : 0}
              />
              <YAxis
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                tickFormatter={(val) => formatShortCurrency(val)}
                dx={-4}
              />
              <RechartsTooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                iconType="circle"
              />

              {showBenchmarkLine && (
                <ReferenceLine
                  y={summary.twelveMonthMean}
                  stroke="#94a3b8"
                  strokeDasharray="4 4"
                  label={{
                    value: `Mean: ${formatShortCurrency(summary.twelveMonthMean)}`,
                    fill: '#64748b',
                    fontSize: 10,
                    position: 'right',
                  }}
                />
              )}

              <Line
                type="monotone"
                dataKey="primaryValue"
                name={trendData.primaryFieldName}
                stroke="#6366f1"
                strokeWidth={3}
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  if (payload.hasFinding) {
                    return (
                      <circle
                        key={payload.month}
                        cx={cx}
                        cy={cy}
                        r={5}
                        fill="#f43f5e"
                        stroke="#ffffff"
                        strokeWidth={2}
                      />
                    );
                  }
                  return (
                    <circle
                      key={payload.month}
                      cx={cx}
                      cy={cy}
                      r={3.5}
                      fill="#6366f1"
                      stroke="#ffffff"
                      strokeWidth={1.5}
                    />
                  );
                }}
                activeDot={{ r: 6, stroke: '#6366f1', strokeWidth: 2 }}
              />

              {showSecondaryMetric && (
                <Line
                  type="monotone"
                  dataKey="secondaryValue"
                  name={trendData.secondaryFieldName}
                  stroke="#10b981"
                  strokeWidth={2}
                  strokeDasharray="3 3"
                  dot={{ r: 3, fill: '#10b981' }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 5. Table Toggle & Itemized Submission Values Ledger */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowDataTable(!showDataTable)}
            className="flex items-center gap-1.5 text-xs font-bold text-ob-indigo-600 dark:text-ob-indigo-400 hover:underline cursor-pointer"
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>{showDataTable ? 'Hide Detailed Submission Ledger' : `Show Detailed Submission Ledger (${trendData.months.length} Periods)`}</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showDataTable ? 'rotate-180' : ''}`} />
          </button>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              Red markers on trend line designate recorded audit findings.
            </span>
            <button
              type="button"
              onClick={handleExportCsv}
              className="text-xs font-semibold text-ob-indigo-600 dark:text-ob-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Download CSV</span>
            </button>

            <MaximizeButton
              onClick={() => setIsMaximized(true)}
              title="Maximize Historical Trend Visualization (Esc to restore)"
            />
          </div>
        </div>

        {showDataTable && (
          <div className="mt-3 overflow-x-auto min-w-full touch-scroll-x">
            <table className="min-w-[650px] w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80 text-slate-500 font-semibold">
                  <th className="py-2 px-3">Reporting Period</th>
                  <th className="py-2 px-3">Month</th>
                  <th className="py-2 px-3 text-right">Primary Statutory Value (ETB)</th>
                  <th className="py-2 px-3 text-right">Secondary Metric (ETB)</th>
                  <th className="py-2 px-3 text-right">Variance vs Mean</th>
                  <th className="py-2 px-3 text-center">Filing Status</th>
                  <th className="py-2 px-3 text-center">Audit Findings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {trendData.months.map((m) => (
                  <tr key={m.period} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="py-2 px-3 font-mono font-bold text-ob-indigo-700 dark:text-ob-indigo-400">
                      {m.period}
                    </td>
                    <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-200">
                      {m.monthFull}
                    </td>
                    <td className="py-2 px-3 font-mono font-bold text-right text-slate-900 dark:text-white">
                      {formatCurrency(m.primaryValue)}
                    </td>
                    <td className="py-2 px-3 font-mono text-right text-slate-700 dark:text-slate-300">
                      {formatCurrency(m.secondaryValue)}
                    </td>
                    <td className="py-2 px-3 font-mono text-right">
                      <span className={`font-semibold ${m.variancePercentage >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {m.variancePercentage >= 0 ? `+${m.variancePercentage}%` : `${m.variancePercentage}%`}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {m.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      {m.hasFinding ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 inline-flex items-center gap-1">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          <span>Variance Flagged</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono text-[11px]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PHASE 47: FULL VIEW / MAXIMIZED HISTORICAL TREND VISUALIZATION */}
      {isMaximized && (
        <MaximizedViewModal
          isOpen={isMaximized}
          onClose={() => setIsMaximized(false)}
          title={`12-Month Trend: ${selectedReportKey} — ${trendData.reportTitle}`}
          badge="Audit Trend Analytics"
          subtitle={`Primary Metric: ${trendData.primaryFieldName} | Range: ${rangePreset}`}
          icon={TrendingUp}
          actions={
            <button
              type="button"
              onClick={handleExportCsv}
              className="min-h-[44px] px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <FileDown className="w-4 h-4 text-ob-indigo-600 dark:text-ob-indigo-400" />
              <span>Export CSV</span>
            </button>
          }
        >
          <div className="space-y-5">
            {/* Summary Statistics Ribbon */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">12-Month Mean</span>
                <span className="text-base font-bold font-mono text-slate-900 dark:text-white mt-1 block">
                  {formatCurrency(trendData.summary.mean)}
                </span>
                <span className="text-[10px] text-slate-500">Benchmark baseline</span>
              </div>
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Peak Statutory Filing</span>
                <span className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1 block">
                  {formatCurrency(trendData.summary.high)}
                </span>
                <span className="text-[10px] text-slate-500">{trendData.summary.highMonth}</span>
              </div>
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Lowest Period Filing</span>
                <span className="text-base font-bold font-mono text-amber-600 dark:text-amber-400 mt-1 block">
                  {formatCurrency(trendData.summary.low)}
                </span>
                <span className="text-[10px] text-slate-500">{trendData.summary.lowMonth}</span>
              </div>
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">12-Month Trajectory</span>
                <span
                  className={`text-base font-bold font-mono mt-1 block ${
                    trendData.summary.annualGrowthRate >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {trendData.summary.annualGrowthRate >= 0
                    ? `+${trendData.summary.annualGrowthRate}%`
                    : `${trendData.summary.annualGrowthRate}%`}
                </span>
                <span className="text-[10px] text-slate-500">Annual statutory drift</span>
              </div>
            </div>

            {/* High-Resolution Maximized LineChart */}
            <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center justify-between">
                <span>Statutory Value Trajectory Over 12 Months</span>
                <span className="font-mono text-[10px] text-slate-400">Values in Ethiopian Birr (ETB)</span>
              </h4>
              <div className="h-80 sm:h-96 w-full min-h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={trendData.months}
                    margin={{ top: 15, right: 30, left: 20, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.2} />
                    <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis
                      stroke="#94a3b8"
                      fontSize={11}
                      tickLine={false}
                      tickFormatter={(v) => (v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : `${v}`)}
                    />
                    <RechartsTooltip
                      formatter={(val: any, name: any) => [formatCurrency(Number(val)), name]}
                      labelFormatter={(label) => `Month: ${label}`}
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: '#fff',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <ReferenceLine
                      y={trendData.summary.mean}
                      stroke="#f59e0b"
                      strokeDasharray="4 4"
                      label={{
                        value: `Mean: ${formatCurrency(trendData.summary.mean)}`,
                        position: 'insideTopLeft',
                        fill: '#f59e0b',
                        fontSize: 11,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="primaryValue"
                      name={trendData.primaryFieldName}
                      stroke="#6366f1"
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#6366f1' }}
                      activeDot={{ r: 6, stroke: '#6366f1', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Complete Itemized Submission Values Ledger */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto min-w-full touch-scroll-x">
                <table className="min-w-[700px] w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 font-bold sticky top-0 z-10">
                      <th className="py-2.5 px-3">Reporting Period</th>
                      <th className="py-2.5 px-3">Month</th>
                      <th className="py-2.5 px-3 text-right">Primary Statutory Value (ETB)</th>
                      <th className="py-2.5 px-3 text-right">Variance vs Mean</th>
                      <th className="py-2.5 px-3 text-center">Filing Status</th>
                      <th className="py-2.5 px-3 text-center">Audit Findings</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {trendData.months.map((m) => (
                      <tr key={m.period} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-ob-indigo-700 dark:text-ob-indigo-400">
                          {m.period}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">
                          {m.monthFull}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-right text-slate-900 dark:text-white">
                          {formatCurrency(m.primaryValue)}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-right">
                          <span
                            className={`font-semibold ${
                              m.variancePercentage >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {m.variancePercentage >= 0 ? `+${m.variancePercentage}%` : `${m.variancePercentage}%`}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {m.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {m.hasFinding ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 inline-flex items-center gap-1">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              <span>Variance Flagged</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono text-[11px]">—</span>
                          )}
                        </td>
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
