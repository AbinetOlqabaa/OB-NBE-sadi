/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Send,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RotateCw,
  Terminal,
  Trash2,
  Eye,
  Sliders,
  ShieldCheck,
  Server,
  Layers,
  Activity,
  X,
  Filter,
  Download,
  Copy,
  Check,
  Code2,
  Lock,
  ArrowUpRight,
  Search,
  Zap,
} from 'lucide-react';
import { SimulationScenarioConfig } from '../types/regulatory';
import { Pagination } from './Pagination';

interface ReceivedReport {
  id: string;
  receivedAt: string;
  returnKey: string;
  institutionCode: string;
  finYear: number;
  periodStart: string;
  periodEnd: string;
  payload: any;
  headers: Record<string, string>;
  idempotencyKey: string;
  correlationId: string;
  status: 'ACCEPTED' | 'REJECTED' | 'DUPLICATE';
  validationErrors?: string[];
  submissionReceiptNumber: string;
}

export interface DetailedSimulatorApiLog {
  id: string;
  timestamp: string;
  method: string;
  path: string;
  statusCode: number;
  statusText?: string;
  returnKey?: string;
  institutionCode?: string;
  idempotencyKey?: string;
  correlationId?: string;
  message: string;
  durationMs: number;
  requestHeaders?: Record<string, string>;
  requestBody?: any;
  responseHeaders?: Record<string, string>;
  responseBody?: any;
  tlsInfo?: {
    protocol: string;
    cipherSuite: string;
    clientCertValidated: boolean;
  };
}

export const NbeSimulatorView: React.FC = () => {
  const [scenario, setScenario] = useState<SimulationScenarioConfig>({
    mode: 'ALWAYS_SUCCESS',
    failureRatePercent: 0,
    latencyMs: 150,
  });
  const [receivedSubmissions, setReceivedSubmissions] = useState<ReceivedReport[]>([]);
  const [logs, setLogs] = useState<DetailedSimulatorApiLog[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<ReceivedReport | null>(null);
  const [selectedLog, setSelectedLog] = useState<DetailedSimulatorApiLog | null>(null);
  const [testResult, setTestResult] = useState<any | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [activeTab, setActiveTab] = useState<'LOGS' | 'RECEIVED'>('LOGS');
  const [autoPoll, setAutoPoll] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Filters state
  const [receivedStatusFilter, setReceivedStatusFilter] = useState<string>('ALL');
  const [logStatusFilter, setLogStatusFilter] = useState<string>('ALL');
  const [logMethodFilter, setLogMethodFilter] = useState<string>('ALL');
  const [logSearchQuery, setLogSearchQuery] = useState<string>('');

  // Pagination for received submissions
  const [receivedPage, setReceivedPage] = useState(1);
  const [receivedPageSize, setReceivedPageSize] = useState(6);

  // Pagination for simulator logs
  const [logsPage, setLogsPage] = useState(1);
  const [logsPageSize, setLogsPageSize] = useState(8);

  const fetchData = async () => {
    try {
      const [subRes, logsRes, scenRes] = await Promise.all([
        fetch('/api/nbe-simulator/submissions').then((r) => (r.ok ? r.json() : [])),
        fetch('/api/nbe-simulator/logs').then((r) => (r.ok ? r.json() : [])),
        fetch('/api/nbe-simulator/scenario').then((r) => (r.ok ? r.json() : null)),
      ]);
      setReceivedSubmissions(Array.isArray(subRes) ? subRes : []);
      setLogs(Array.isArray(logsRes) ? logsRes : []);
      if (scenRes && scenRes.mode) setScenario(scenRes);
    } catch {}
  };

  useEffect(() => {
    fetchData();
    if (!autoPoll) return;
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, [autoPoll]);

  // Reset page when filter changes
  useEffect(() => {
    setLogsPage(1);
  }, [logStatusFilter, logMethodFilter, logSearchQuery]);

  const handleUpdateScenario = async (partial: Partial<SimulationScenarioConfig>) => {
    const next = { ...scenario, ...partial };
    setScenario(next);
    try {
      await fetch('/api/nbe-simulator/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
    } catch {}
  };

  const handleSendTestPayload = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/nbe-simulator/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `TEST_IDEMP_${Date.now()}`,
          'X-Correlation-ID': `TEST_CORR_${Date.now()}`,
          'X-Institution-Code': '0000013',
          'Authorization': 'Bearer NBE_PROBE_TOKEN_LIVE',
        },
        body: JSON.stringify({
          ReturnKey: 'POBEPE001',
          InstCode: '0000013',
          FinYear: 2026,
          StartDate: '2026-01-01',
          EndDate: '2026-01-31',
          ReturnItemsList: [
            { Code: 'R01_C01', Value: 12500000000 },
            { Code: 'R02_C01', Value: 48500000000 },
            { Code: 'R03_C01', Value: 61000000000 },
          ],
          DynamicItemsList: [],
        }),
      });
      const data = await res.json();
      setTestResult({ statusCode: res.status, body: data });
      await fetchData();
    } catch (err: any) {
      setTestResult({ statusCode: 0, body: { error: err.message } });
    } finally {
      setIsTesting(false);
    }
  };

  const handleClearLogs = async () => {
    try {
      await fetch('/api/nbe-simulator/logs', { method: 'DELETE' });
      setLogs([]);
      setLogsPage(1);
    } catch {}
  };

  const copyToClipboard = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    // Status filter
    if (logStatusFilter === '200_SUCCESS' && !(log.statusCode >= 200 && log.statusCode < 300)) return false;
    if (logStatusFilter === '401_AUTH' && !(log.statusCode === 401 || log.statusCode === 403)) return false;
    if (logStatusFilter === '422_VALIDATION' && log.statusCode !== 422) return false;
    if (logStatusFilter === '500_SERVER_ERROR' && log.statusCode !== 500) return false;
    if (logStatusFilter === '504_TIMEOUT' && log.statusCode !== 504) return false;

    // Method filter
    if (logMethodFilter !== 'ALL' && log.method !== logMethodFilter) return false;

    // Search query
    if (logSearchQuery) {
      const q = logSearchQuery.toLowerCase().trim();
      const match =
        log.path.toLowerCase().includes(q) ||
        log.message.toLowerCase().includes(q) ||
        (log.correlationId && log.correlationId.toLowerCase().includes(q)) ||
        (log.idempotencyKey && log.idempotencyKey.toLowerCase().includes(q)) ||
        (log.returnKey && log.returnKey.toLowerCase().includes(q)) ||
        String(log.statusCode).includes(q);
      if (!match) return false;
    }

    return true;
  });

  const paginatedLogs = filteredLogs.slice(
    (logsPage - 1) * logsPageSize,
    logsPage * logsPageSize
  );

  // Filter received submissions
  const filteredReceived = receivedSubmissions.filter((sub) => {
    if (receivedStatusFilter === 'ALL') return true;
    return sub.status === receivedStatusFilter;
  });

  const paginatedReceived = filteredReceived.slice(
    (receivedPage - 1) * receivedPageSize,
    receivedPage * receivedPageSize
  );

  // Stats calculation
  const totalInteractions = logs.length;
  const successCount = logs.filter((l) => l.statusCode >= 200 && l.statusCode < 300).length;
  const successRate = totalInteractions > 0 ? Math.round((successCount / totalInteractions) * 100) : 100;
  const avgLatency =
    totalInteractions > 0
      ? Math.round(logs.reduce((acc, l) => acc + (l.durationMs || 0), 0) / totalInteractions)
      : scenario.latencyMs;

  const getMethodBadgeColor = (method: string) => {
    switch (method.toUpperCase()) {
      case 'POST':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'GET':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'DELETE':
        return 'bg-rose-50 text-rose-800 border-rose-200';
      case 'PUT':
      case 'PATCH':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getStatusBadge = (statusCode: number) => {
    if (statusCode >= 200 && statusCode < 300) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          <span>{statusCode} OK</span>
        </span>
      );
    }
    if (statusCode === 422) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-300 inline-flex items-center gap-1">
          <AlertTriangle className="w-3 h-3 text-amber-600" />
          <span>422 Schema Rejection</span>
        </span>
      );
    }
    if (statusCode === 401 || statusCode === 403) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-50 text-purple-800 border border-purple-300 inline-flex items-center gap-1">
          <Lock className="w-3 h-3 text-purple-600" />
          <span>{statusCode} Auth Failed</span>
        </span>
      );
    }
    if (statusCode === 504) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-50 text-rose-800 border border-rose-300 inline-flex items-center gap-1">
          <Clock className="w-3 h-3 text-rose-600" />
          <span>504 Timeout</span>
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-50 text-rose-800 border border-rose-300 inline-flex items-center gap-1">
        <AlertTriangle className="w-3 h-3 text-rose-600" />
        <span>{statusCode} Error</span>
      </span>
    );
  };

  // Export logs to CSV
  const exportLogsCSV = () => {
    if (filteredLogs.length === 0) return;
    const nowIso = new Date().toISOString();
    const metaHeader = [
      `# OROMIA BANK S.C. - NATIONAL BANK OF ETHIOPIA (NBE) API GATEWAY INTERACTION LOGS`,
      `# Institution Code: 0000013 | Directive: BSD/03/2020 | Exported At: ${nowIso}`,
      `# Total Records: ${filteredLogs.length} | Success Rate: ${successRate}% | Avg Latency: ${avgLatency}ms`,
      ``,
    ].join('\r\n');

    const headers = [
      'Log ID',
      'Timestamp (UTC)',
      'Timestamp (Local)',
      'HTTP Method',
      'Endpoint Path',
      'Return Key',
      'Status Code',
      'Status Text',
      'Duration (ms)',
      'Correlation ID',
      'Idempotency Key',
      'Audit Message',
    ];

    const rows = filteredLogs.map((l) => [
      `"${l.id}"`,
      `"${l.timestamp}"`,
      `"${new Date(l.timestamp).toLocaleString()}"`,
      `"${l.method}"`,
      `"${l.path}"`,
      `"${l.returnKey || 'N/A'}"`,
      `"${l.statusCode}"`,
      `"${l.statusText || l.statusCode}"`,
      `"${l.durationMs || 0}"`,
      `"${l.correlationId || 'N/A'}"`,
      `"${l.idempotencyKey || 'N/A'}"`,
      `"${(l.message || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = metaHeader + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `OROMIA_BANK_NBE_API_LOGS_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden space-y-2 font-sans">
      {/* 1. Header Banner with Telemetry & Fast Actions (Strictly Fixed Height) */}
      <div className="bg-slate-900 text-white rounded-xl p-3 shadow-md border border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-ob-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 border border-ob-indigo-500 shadow-2xs">
            NBE
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs sm:text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                <span>National Bank of Ethiopia (NBE) API Gateway Simulator & Traffic Logs</span>
              </h2>
              <span className="text-[10px] font-mono font-bold bg-slate-800 text-ob-green-400 px-1.5 py-0.2 rounded border border-slate-700">
                mTLS / TLSv1.3
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Transparent inspection of bidirectional API transmissions, digital receipts, idempotency enforcement, and network probes.
            </p>
          </div>
        </div>

        {/* Quick Stats & Probes */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden lg:flex items-center gap-3 px-3 py-1 bg-slate-800/80 border border-slate-700/80 rounded-lg text-[11px] text-slate-300">
            <div>
              <span className="text-slate-500">Interactions: </span>
              <span className="font-mono font-bold text-white">{totalInteractions}</span>
            </div>
            <span className="text-slate-600">|</span>
            <div>
              <span className="text-slate-500">Success: </span>
              <span className="font-mono font-bold text-ob-green-400">{successRate}%</span>
            </div>
            <span className="text-slate-600">|</span>
            <div>
              <span className="text-slate-500">Latency: </span>
              <span className="font-mono font-bold text-white">{avgLatency}ms</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSendTestPayload}
            disabled={isTesting}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-ob-indigo-600 hover:bg-ob-indigo-700 text-white text-xs font-bold rounded-lg transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
            title="Send an automated test payload to test API response and logging"
          >
            <Send className="w-3 h-3 text-ob-green-300" />
            <span>{isTesting ? 'Sending...' : 'Test Probe'}</span>
          </button>

          <button
            type="button"
            onClick={fetchData}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors cursor-pointer"
            title="Refresh logs from gateway"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Gateway Simulation Scenario Controls Bar (Fixed Height) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 shadow-2xs flex flex-wrap items-center justify-between gap-2.5 shrink-0 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
            <Sliders className="w-3.5 h-3.5 text-ob-indigo-600 dark:text-ob-indigo-400" />
            <span>Active Scenario Mode:</span>
          </span>
          <select
            value={scenario.mode}
            onChange={(e) => handleUpdateScenario({ mode: e.target.value as any })}
            className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-800 dark:text-slate-100 font-semibold focus:outline-none focus:ring-1 focus:ring-ob-indigo-500 cursor-pointer"
          >
            <option value="ALWAYS_SUCCESS">Always Success (200 OK + Digital Receipt)</option>
            <option value="VALIDATION_FAILURE">Validation Failure (422 Unprocessable)</option>
            <option value="AUTH_FAILURE">Auth / Token Failure (401/403 Invalid Signature)</option>
            <option value="SERVER_ERROR">Gateway Internal Error (500)</option>
            <option value="TIMEOUT">Gateway Network Timeout (504)</option>
            <option value="RANDOM_FLAKY">Chaos / Flaky Mode (Random Errors)</option>
          </select>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Latency Delay:</span>
            <input
              type="range"
              min="0"
              max="1500"
              step="50"
              value={scenario.latencyMs}
              onChange={(e) => handleUpdateScenario({ latencyMs: parseInt(e.target.value, 10) })}
              className="w-24 accent-ob-indigo-600 cursor-pointer"
            />
            <span className="font-mono font-bold text-[11px] text-slate-700 dark:text-slate-200">{scenario.latencyMs}ms</span>
          </div>

          <div className="flex items-center gap-1.5 border-l border-slate-200 dark:border-slate-700 pl-3">
            <label className="text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoPoll}
                onChange={(e) => setAutoPoll(e.target.checked)}
                className="rounded text-ob-indigo-600 focus:ring-0 cursor-pointer"
              />
              <span className="flex items-center gap-1">
                <span>Live Stream</span>
                {autoPoll && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                )}
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* 3. Sub-Tabs & Filtering Toolbar (Fixed Height) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 shadow-2xs flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('LOGS')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'LOGS'
                ? 'bg-ob-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Detailed API Interaction Logs ({logs.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('RECEIVED')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'RECEIVED'
                ? 'bg-ob-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Ingested Returns Repository ({receivedSubmissions.length})</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'LOGS' ? (
            <>
              {/* Search Log */}
              <div className="relative w-44 sm:w-56">
                <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search log, token, return..."
                  value={logSearchQuery}
                  onChange={(e) => setLogSearchQuery(e.target.value)}
                  className="w-full pl-7 pr-2.5 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-ob-indigo-500"
                />
              </div>

              {/* Status filter */}
              <select
                value={logStatusFilter}
                onChange={(e) => setLogStatusFilter(e.target.value)}
                className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-200 font-medium focus:outline-none focus:ring-1 focus:ring-ob-indigo-500 cursor-pointer"
              >
                <option value="ALL">All Status Codes</option>
                <option value="200_SUCCESS">200 / 201 Success</option>
                <option value="401_AUTH">401 Auth Error</option>
                <option value="422_VALIDATION">422 Schema Rejected</option>
                <option value="500_SERVER_ERROR">500 Server Error</option>
                <option value="504_TIMEOUT">504 Gateway Timeout</option>
              </select>

              {/* Method filter */}
              <select
                value={logMethodFilter}
                onChange={(e) => setLogMethodFilter(e.target.value)}
                className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-200 font-medium focus:outline-none focus:ring-1 focus:ring-ob-indigo-500 cursor-pointer"
              >
                <option value="ALL">All Methods</option>
                <option value="POST">POST</option>
                <option value="GET">GET</option>
                <option value="DELETE">DELETE</option>
              </select>

              <button
                type="button"
                onClick={exportLogsCSV}
                className="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg transition-colors shadow-2xs cursor-pointer"
                title="Export detailed API interaction logs to CSV"
              >
                <Download className="w-3 h-3 text-ob-indigo-600 dark:text-ob-indigo-400" />
                <span className="hidden sm:inline">CSV</span>
              </button>

              {logs.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearLogs}
                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"
                  title="Clear API Interaction Logs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
                <Filter className="w-3 h-3 text-ob-indigo-600 dark:text-ob-indigo-400" />
                Status:
              </span>
              <select
                value={receivedStatusFilter}
                onChange={(e) => {
                  setReceivedStatusFilter(e.target.value);
                  setReceivedPage(1);
                }}
                className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-700 dark:text-slate-200 font-medium focus:outline-none focus:ring-1 focus:ring-ob-indigo-500 cursor-pointer"
              >
                <option value="ALL">All Status ({receivedSubmissions.length})</option>
                <option value="ACCEPTED">ACCEPTED ({receivedSubmissions.filter((s) => s.status === 'ACCEPTED').length})</option>
                <option value="REJECTED">REJECTED ({receivedSubmissions.filter((s) => s.status === 'REJECTED').length})</option>
                <option value="DUPLICATE">DUPLICATE ({receivedSubmissions.filter((s) => s.status === 'DUPLICATE').length})</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* 4. Tab 1: Detailed API Interaction Log Table (Strict flex-1 min-h-0 overflow-hidden) */}
      {activeTab === 'LOGS' && (
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs">
          <div className="flex-1 min-h-0 overflow-y-auto">
            {paginatedLogs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <Terminal className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Gateway API Logs Found</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Trigger a Test Probe or deliver a report from Checker Inbox to inspect live NBE traffic.
                </p>
                {logSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setLogSearchQuery('')}
                    className="mt-2 text-xs font-bold text-ob-indigo-700 dark:text-ob-indigo-400 hover:underline"
                  >
                    Clear search filter
                  </button>
                )}
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-semibold sticky top-0 z-10">
                    <th className="py-2 px-3">Timestamp (UTC/Local)</th>
                    <th className="py-2 px-3">Method & Path</th>
                    <th className="py-2 px-3">Return Code</th>
                    <th className="py-2 px-3">HTTP Response</th>
                    <th className="py-2 px-3">Duration</th>
                    <th className="py-2 px-3">Correlation / Idempotency Token</th>
                    <th className="py-2 px-3 text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paginatedLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/90 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-2 px-3 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap text-[11px]">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500">
                          {new Date(log.timestamp).toISOString().slice(0, 10)}
                        </div>
                      </td>

                      <td className="py-2 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-mono text-xs">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${getMethodBadgeColor(
                              log.method
                            )}`}
                          >
                            {log.method}
                          </span>
                          <span className="text-slate-800 dark:text-slate-200 font-medium truncate max-w-[170px]" title={log.path}>
                            {log.path}
                          </span>
                        </div>
                      </td>

                      <td className="py-2 px-3 whitespace-nowrap">
                        {log.returnKey ? (
                          <span className="font-mono font-bold text-ob-indigo-700 dark:text-ob-indigo-300 bg-ob-indigo-50 dark:bg-ob-indigo-950/60 px-1.5 py-0.5 rounded border border-ob-indigo-200 dark:border-ob-indigo-800 text-[11px]">
                            {log.returnKey}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 font-mono text-[10px]">Gateway Core</span>
                        )}
                      </td>

                      <td className="py-2 px-3 whitespace-nowrap">
                        {getStatusBadge(log.statusCode)}
                      </td>

                      <td className="py-2 px-3 whitespace-nowrap font-mono text-[11px]">
                        <span
                          className={`font-semibold ${
                            log.durationMs < 100
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : log.durationMs < 500
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'text-rose-700 dark:text-rose-400'
                          }`}
                        >
                          {log.durationMs || 0}ms
                        </span>
                      </td>

                      <td className="py-2 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-400 max-w-[180px] truncate" title={log.correlationId || log.idempotencyKey}>
                        <div className="truncate text-slate-700 dark:text-slate-200 font-semibold">{log.correlationId || 'N/A'}</div>
                        {log.idempotencyKey && (
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">Idemp: {log.idempotencyKey}</div>
                        )}
                      </td>

                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedLog(log)}
                          className="px-2.5 py-1 bg-ob-indigo-50 dark:bg-ob-indigo-950/60 hover:bg-ob-indigo-100 dark:hover:bg-ob-indigo-900/60 text-ob-indigo-700 dark:text-ob-indigo-300 rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Inspect Payload</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination Footer */}
          <div className="shrink-0 p-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
            <Pagination
              currentPage={logsPage}
              totalItems={filteredLogs.length}
              pageSize={logsPageSize}
              onPageChange={setLogsPage}
              onPageSizeChange={setLogsPageSize}
              pageSizeOptions={[8, 15, 30]}
              itemName="API interaction logs"
            />
          </div>
        </div>
      )}

      {/* 5. Tab 2: Ingested Returns Repository Table */}
      {activeTab === 'RECEIVED' && (
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs">
          <div className="flex-1 min-h-0 overflow-y-auto">
            {paginatedReceived.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <Server className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Ingested Returns Match</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Deliver an approved return from the Checker Inbox or click "Test Probe" above to simulate intake.
                </p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-semibold sticky top-0 z-10">
                    <th className="py-2 px-3">Receipt Time</th>
                    <th className="py-2 px-3">Return Code</th>
                    <th className="py-2 px-3">Institution Code</th>
                    <th className="py-2 px-3">Intake Status</th>
                    <th className="py-2 px-3 font-mono">Digital Receipt Token</th>
                    <th className="py-2 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paginatedReceived.map((sub) => (
                    <tr key={sub.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-2 px-3 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {new Date(sub.receivedAt).toLocaleTimeString()}
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500">
                          {new Date(sub.receivedAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-ob-indigo-700 dark:text-ob-indigo-400">
                        {sub.returnKey}
                      </td>
                      <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200">
                        {sub.institutionCode} (Oromia Bank S.C.)
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            sub.status === 'ACCEPTED'
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                              : sub.status === 'DUPLICATE'
                              ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                              : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                          }`}
                        >
                          {sub.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px] text-slate-700 dark:text-slate-300 font-bold">
                        {sub.submissionReceiptNumber}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedSubmission(sub)}
                          className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View Payload</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination Footer */}
          <div className="shrink-0 p-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
            <Pagination
              currentPage={receivedPage}
              totalItems={filteredReceived.length}
              pageSize={receivedPageSize}
              onPageChange={setReceivedPage}
              onPageSizeChange={setReceivedPageSize}
              pageSizeOptions={[6, 12, 24]}
              itemName="ingested returns"
            />
          </div>
        </div>
      )}

      {/* 6. Detailed API Log Deep Inspector Modal */}
      {selectedLog && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl max-w-3xl w-full max-h-[88vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <span className={`px-2 py-0.5 rounded font-mono text-xs font-bold border ${getMethodBadgeColor(selectedLog.method)}`}>
                  {selectedLog.method}
                </span>
                <span className="font-mono text-xs sm:text-sm font-bold text-white truncate max-w-md">
                  {selectedLog.path}
                </span>
                {getStatusBadge(selectedLog.statusCode)}
              </div>

              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                title="Close inspector (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 flex-1 min-h-0 overflow-y-auto space-y-4 text-xs">
              {/* Telemetry Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl">
                  <span className="text-[10px] text-slate-400 dark:text-slate-400 block">Round-Trip Latency</span>
                  <span className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100">{selectedLog.durationMs || 0} ms</span>
                </div>
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl">
                  <span className="text-[10px] text-slate-400 dark:text-slate-400 block">Transport Security</span>
                  <span className="font-mono font-bold text-xs text-slate-900 dark:text-slate-100">
                    {selectedLog.tlsInfo?.protocol || 'TLSv1.3 / mTLS'}
                  </span>
                </div>
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl">
                  <span className="text-[10px] text-slate-400 dark:text-slate-400 block">Target Return</span>
                  <span className="font-mono font-bold text-xs text-ob-indigo-700 dark:text-ob-indigo-400">
                    {selectedLog.returnKey || 'N/A'}
                  </span>
                </div>
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl">
                  <span className="text-[10px] text-slate-400 dark:text-slate-400 block">Institution Code</span>
                  <span className="font-mono font-bold text-xs text-slate-900 dark:text-slate-100">
                    {selectedLog.institutionCode || '0000013'}
                  </span>
                </div>
              </div>

              {/* Message Banner */}
              <div className="p-3 bg-ob-indigo-50/70 dark:bg-ob-indigo-950/50 border border-ob-indigo-200 dark:border-ob-indigo-800/60 rounded-xl text-ob-indigo-950 dark:text-ob-indigo-200 font-medium">
                <span className="font-bold">Gateway Audit Event: </span>
                <span>{selectedLog.message}</span>
              </div>

              {/* Correlation & Idempotency Bar */}
              <div className="p-3 bg-slate-900 dark:bg-slate-950 text-slate-200 rounded-xl font-mono text-[11px] space-y-1.5 border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">X-Correlation-ID:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-ob-green-400 font-bold">{selectedLog.correlationId || 'N/A'}</span>
                    {selectedLog.correlationId && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(selectedLog.correlationId!, 'corr')}
                        className="p-1 text-slate-400 hover:text-white"
                        title="Copy Correlation ID"
                      >
                        {copiedKey === 'corr' ? <Check className="w-3 h-3 text-ob-green-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Idempotency-Key:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-amber-300 font-bold">{selectedLog.idempotencyKey || 'NONE'}</span>
                    {selectedLog.idempotencyKey && selectedLog.idempotencyKey !== 'NONE' && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(selectedLog.idempotencyKey!, 'idemp')}
                        className="p-1 text-slate-400 hover:text-white"
                        title="Copy Idempotency Key"
                      >
                        {copiedKey === 'idemp' ? <Check className="w-3 h-3 text-ob-green-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Request & Response Sections */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Request Payload */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                      <Code2 className="w-3.5 h-3.5 text-ob-indigo-600 dark:text-ob-indigo-400" />
                      <span>Request Payload (Body)</span>
                    </span>
                    {selectedLog.requestBody && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(JSON.stringify(selectedLog.requestBody, null, 2), 'reqBody')}
                        className="text-[11px] font-bold text-ob-indigo-600 dark:text-ob-indigo-400 hover:underline flex items-center gap-1"
                      >
                        {copiedKey === 'reqBody' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>Copy JSON</span>
                      </button>
                    )}
                  </div>

                  <pre className="bg-slate-950 text-slate-100 p-3 rounded-xl font-mono text-[11px] max-h-56 overflow-y-auto border border-slate-800">
                    {selectedLog.requestBody
                      ? JSON.stringify(selectedLog.requestBody, null, 2)
                      : '// No request body'}
                  </pre>
                </div>

                {/* Response Payload */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                      <Terminal className="w-3.5 h-3.5 text-ob-green-600 dark:text-ob-green-400" />
                      <span>Response Body (HTTP {selectedLog.statusCode})</span>
                    </span>
                    {selectedLog.responseBody && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(JSON.stringify(selectedLog.responseBody, null, 2), 'respBody')}
                        className="text-[11px] font-bold text-ob-green-700 dark:text-ob-green-400 hover:underline flex items-center gap-1"
                      >
                        {copiedKey === 'respBody' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>Copy JSON</span>
                      </button>
                    )}
                  </div>

                  <pre className="bg-slate-950 text-slate-100 p-3 rounded-xl font-mono text-[11px] max-h-56 overflow-y-auto border border-slate-800">
                    {selectedLog.responseBody
                      ? JSON.stringify(selectedLog.responseBody, null, 2)
                      : '// No response body'}
                  </pre>
                </div>
              </div>

              {/* Request Headers Inspection */}
              {selectedLog.requestHeaders && (
                <div className="space-y-1">
                  <span className="font-bold text-slate-800 dark:text-slate-200 block">HTTP Request Headers</span>
                  <div className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 font-mono text-[11px] space-y-1">
                    {Object.entries(selectedLog.requestHeaders).map(([k, v]) => (
                      <div key={k} className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-700/50 pb-0.5 last:border-0">
                        <span className="text-slate-500 dark:text-slate-400 font-semibold">{k}:</span>
                        <span className="text-slate-900 dark:text-slate-100 font-medium truncate max-w-sm">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 dark:text-slate-400 font-mono">
                Log ID: {selectedLog.id} · Timestamp: {selectedLog.timestamp}
              </span>

              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Ingested Return Modal Viewer */}
      {selectedSubmission && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
          onClick={() => setSelectedSubmission(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3.5 bg-slate-900 text-white border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-ob-green-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                  {selectedSubmission.returnKey}
                </span>
                <span className="font-bold text-xs text-white">
                  Intake Receipt: {selectedSubmission.submissionReceiptNumber}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSubmission(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 flex-1 min-h-0 overflow-y-auto space-y-3 text-xs">
              <div>
                <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Receipt Envelope Headers:</span>
                <pre className="bg-slate-950 text-slate-100 p-2.5 rounded-lg font-mono text-[11px] overflow-x-auto">
                  {JSON.stringify(selectedSubmission.headers, null, 2)}
                </pre>
              </div>

              <div>
                <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Digital Return Payload (NBE Format):</span>
                <pre className="bg-slate-950 text-slate-100 p-2.5 rounded-lg font-mono text-[11px] overflow-x-auto">
                  {JSON.stringify(selectedSubmission.payload, null, 2)}
                </pre>
              </div>
            </div>

            <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedSubmission(null)}
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
