/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Upload,
  FileSpreadsheet,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  X,
  Copy,
  Check,
  RefreshCw,
  Layers,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Info,
  ChevronLeft,
  ChevronRight,
  Download,
  RotateCcw,
  FileText,
  Filter,
} from 'lucide-react';
import {
  bulkOperationsEngine,
  type BulkTargetType,
  type BulkFormat,
  type BulkConflictStrategy,
  type BulkExecutionMode,
  type BulkDryRunResult,
  type BulkExecutionResult,
  type BulkRowDetail,
} from '../services/bulkOperationsEngine.ts';
import { vibrate } from '../utils/haptics.ts';

interface BulkOperationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  currentUser: {
    id: string;
    name: string;
    email?: string;
    role: 'ADMIN' | 'MAKER' | 'CHECKER' | 'AUDITOR' | 'NBE_OFFICER' | string;
    department?: string;
  };
  initialTarget?: BulkTargetType;
}

type WizardStep = 'CONFIG_UPLOAD' | 'PREVIEW_VALIDATION' | 'CONFIRM_EXECUTE' | 'RESULT_REPORT';

const SAMPLE_TEMPLATES: Record<BulkTargetType, { csv: string; json: string }> = {
  USERS: {
    csv: `name,email,role,department,employeeId,status
Dawud Tulu,dawud.tulu@oromiabank.com,MAKER,Credit Operations & Portfolio Management,OB-MKR-501,ACTIVE
Ayantu Dibaba,ayantu.dibaba@oromiabank.com,CHECKER,Credit Operations & Portfolio Management,OB-CHK-502,ACTIVE
Kassahun Gemechu,kassahun.gemechu@oromiabank.com,MAKER,Trade Services & International Banking,OB-MKR-503,ACTIVE`,
    json: `[
  {
    "name": "Dawud Tulu",
    "email": "dawud.tulu@oromiabank.com",
    "role": "MAKER",
    "department": "Credit Operations & Portfolio Management",
    "employeeId": "OB-MKR-501",
    "status": "ACTIVE"
  },
  {
    "name": "Ayantu Dibaba",
    "email": "ayantu.dibaba@oromiabank.com",
    "role": "CHECKER",
    "department": "Credit Operations & Portfolio Management",
    "employeeId": "OB-CHK-502",
    "status": "ACTIVE"
  }
]`,
  },
  DEPARTMENTS: {
    csv: `name,shortCode,division,description,reportKeys
Mortgage & Retail Credit,MRCD,Credit Business & Operations Division,Mortgage lending operations,LOA_ADV_OUT_LA001;BUIL_CONSTXW002
Corporate Syndications,CSD,Credit Business & Operations Division,Large syndication credits,TOP_20_BOR_TB001;BOR_TEN_PER_LB002
Treasury & Money Markets,TMMD,Finance & Accounts Division,Asset liability management,`,
    json: `[
  {
    "name": "Microfinance & Agency Lending",
    "shortCode": "MAL",
    "division": "Digital Banking & Retail Division",
    "description": "Inclusive financing and agent loans",
    "reportKeys": ["DigitalLendingDL001"]
  },
  {
    "name": "Trade Finance Operations",
    "shortCode": "TFO",
    "division": "International Banking Division",
    "description": "Commercial LC and trade guarantees",
    "reportKeys": ["POBEPE001"]
  }
]`,
  },
  REPORTS: {
    csv: `ReturnKey,Title,Category,Frequency,Department,Description
M_AGRI_LN001,Agricultural Credit & Smallholder Lending,Credit & Lending,MONTHLY,Credit Operations & Portfolio Management,Statutory schedule of rural agricultural credits
Q_FX_EXP002,Quarterly Foreign Exchange Position Return,Exposures & Concentration,QUARTERLY,Trade Services & International Banking,Comprehensive foreign currency risk exposure`,
    json: `[
  {
    "ReturnKey": "M_AGRI_LN001",
    "Title": "Agricultural Credit & Smallholder Lending",
    "Category": "Credit & Lending",
    "Frequency": "MONTHLY",
    "Department": "Credit Operations & Portfolio Management",
    "Description": "Statutory schedule of rural agricultural credits"
  }
]`,
  },
  SPECIAL_ACCESS: {
    csv: `email,reportKey,department,reason,expiresAt
abebe.kebede@oromiabank.com,POBEPE001,,Cross-department surge delegation for trade finance,2026-12-31T23:59:59Z
tigist.alemu@oromiabank.com,,Credit Operations & Portfolio Management,Inter-departmental quarterly provisioning review,2026-11-30T23:59:59Z`,
    json: `[
  {
    "email": "abebe.kebede@oromiabank.com",
    "reportKey": "POBEPE001",
    "reason": "Cross-department surge delegation for trade finance",
    "expiresAt": "2026-12-31T23:59:59Z"
  }
]`,
  },
  SUBMISSIONS: { csv: '', json: '' },
  USER_REPORT_ASSIGNMENTS: { csv: '', json: '' },
};

export const BulkOperationsModal: React.FC<BulkOperationsModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  currentUser,
  initialTarget = 'USERS',
}) => {
  const [step, setStep] = useState<WizardStep>('CONFIG_UPLOAD');
  const [targetType, setTargetType] = useState<BulkTargetType>(initialTarget);
  const [format, setFormat] = useState<BulkFormat>('CSV');
  const [conflictStrategy, setConflictStrategy] = useState<BulkConflictStrategy>('UPDATE');
  const [executionMode, setExecutionMode] = useState<BulkExecutionMode>('ATOMIC');
  const [payloadText, setPayloadText] = useState('');
  const [rawFileBytes, setRawFileBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState('');

  // Dry run preview state
  const [dryRun, setDryRun] = useState<BulkDryRunResult | null>(null);
  const [previewPage, setPreviewPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'VALID' | 'CONFLICT' | 'INVALID'>('ALL');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Confirmation & Execution state
  const [confirmedByUser, setConfirmedByUser] = useState(false);
  const [executionResult, setExecutionResult] = useState<BulkExecutionResult | null>(null);
  const [copiedTemplate, setCopiedTemplate] = useState(false);

  if (!isOpen) return null;

  const currentTemplate = SAMPLE_TEMPLATES[targetType] || SAMPLE_TEMPLATES.USERS;

  const handleCopyTemplate = () => {
    const text = format === 'CSV' ? currentTemplate.csv : currentTemplate.json;
    navigator.clipboard.writeText(text);
    setCopiedTemplate(true);
    vibrate(10);
    setTimeout(() => setCopiedTemplate(false), 2000);
  };

  const handleLoadSample = () => {
    const text = format === 'CSV' ? currentTemplate.csv : currentTemplate.json;
    setPayloadText(text);
    setRawFileBytes(null);
    setFileName('sample_template');
    vibrate(10);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setErrorMessage('');

    if (file.name.endsWith('.xlsx')) {
      setFormat('XLSX');
      const reader = new FileReader();
      reader.onload = (evt) => {
        const arrBuffer = evt.target?.result as ArrayBuffer;
        if (arrBuffer) {
          setRawFileBytes(new Uint8Array(arrBuffer));
          setPayloadText(`[Binary XLSX file loaded: ${file.name} (${Math.round(file.size / 1024)} KB)]`);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const detectedFormat = file.name.endsWith('.json') ? 'JSON' : 'CSV';
      setFormat(detectedFormat);
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = String(evt.target?.result || '');
        setPayloadText(text);
        setRawFileBytes(null);
      };
      reader.readAsText(file);
    }
  };

  // STEP 1 -> STEP 2: GENERATE DRY RUN
  const handleGenerateDryRun = () => {
    if (!payloadText.trim() && !rawFileBytes) {
      setErrorMessage('Please paste tabular payload content or upload a valid CSV, JSON, or XLSX file.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage('');

    try {
      const payload = rawFileBytes || payloadText;
      const result = bulkOperationsEngine.generateDryRun({
        targetType,
        format,
        rawPayload: payload,
        conflictStrategy,
        actor: {
          id: currentUser.id,
          name: currentUser.name,
          email: currentUser.email,
          role: currentUser.role,
          department: currentUser.department,
        },
        page: 1,
        pageSize: 15,
      });

      setDryRun(result);
      setPreviewPage(1);
      setStep('PREVIEW_VALIDATION');
      vibrate([15, 20]);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // STEP 2 -> STEP 3: GO TO EXPLICIT CONFIRMATION
  const handleProceedToConfirmation = () => {
    if (!dryRun || !dryRun.canExecute) return;
    setConfirmedByUser(false);
    setStep('CONFIRM_EXECUTE');
    vibrate(10);
  };

  // STEP 3 -> STEP 4: EXECUTE TRANSACTION
  const handleExecuteTransaction = () => {
    if (!dryRun || !confirmedByUser) return;

    setIsProcessing(true);
    setErrorMessage('');

    try {
      const result = bulkOperationsEngine.executeDryRun({
        dryRunId: dryRun.dryRunId,
        mode: executionMode,
        actor: {
          id: currentUser.id,
          name: currentUser.name,
          email: currentUser.email,
          role: currentUser.role,
          department: currentUser.department,
        },
        confirmed: true,
      });

      setExecutionResult(result);
      setStep('RESULT_REPORT');
      vibrate([20, 30, 20]);

      if (result.success) {
        onSuccess(result.message);
      }
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Filtered rows in preview table
  const filteredRows = dryRun
    ? dryRun.rows.filter((r) => {
        if (statusFilter === 'ALL') return true;
        return r.status === statusFilter;
      })
    : [];

  const pageSize = 10;
  const totalFilteredPages = Math.ceil(filteredRows.length / pageSize) || 1;
  const currentFilteredRows = filteredRows.slice((previewPage - 1) * pageSize, previewPage * pageSize);

  const resetWorkflow = () => {
    setStep('CONFIG_UPLOAD');
    setDryRun(null);
    setExecutionResult(null);
    setPayloadText('');
    setRawFileBytes(null);
    setFileName('');
    setErrorMessage('');
    setConfirmedByUser(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 dark:bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4 max-h-[calc(100dvh-2rem)] overflow-y-auto">
        {/* Header with Step Indicator */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-ob-indigo-500/10 dark:bg-ob-indigo-500/20 text-ob-indigo-600 dark:text-ob-indigo-400 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Enterprise Bulk Operations & File Workflow</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-ob-indigo-50 dark:bg-ob-indigo-950 text-ob-indigo-600 dark:text-ob-indigo-400 border border-ob-indigo-200 dark:border-ob-indigo-800">
                  Transactional SSOT
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Safe, audited, multi-entity bulk management with strict segregation of duties and atomic rollback.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Wizard Step Progress Tracker */}
        <div className="grid grid-cols-4 gap-2 text-xs">
          {[
            { id: 'CONFIG_UPLOAD', label: '1. Configure & Upload' },
            { id: 'PREVIEW_VALIDATION', label: '2. Validate & Preview' },
            { id: 'CONFIRM_EXECUTE', label: '3. Explicit Confirm' },
            { id: 'RESULT_REPORT', label: '4. Audit & Results' },
          ].map((s, idx) => {
            const isCurrent = step === s.id;
            const isCompleted =
              (s.id === 'CONFIG_UPLOAD' && step !== 'CONFIG_UPLOAD') ||
              (s.id === 'PREVIEW_VALIDATION' && (step === 'CONFIRM_EXECUTE' || step === 'RESULT_REPORT')) ||
              (s.id === 'CONFIRM_EXECUTE' && step === 'RESULT_REPORT');

            return (
              <div
                key={s.id}
                className={`py-1.5 px-2 rounded-lg font-medium text-center border transition-all ${
                  isCurrent
                    ? 'bg-ob-indigo-600 text-white border-ob-indigo-600 shadow-2xs font-bold'
                    : isCompleted
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                    : 'bg-slate-50 dark:bg-slate-800/50 text-slate-400 border-slate-200 dark:border-slate-800'
                }`}
              >
                {s.label}
              </div>
            );
          })}
        </div>

        {/* Error Notification Banner */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
            <div className="flex-1 font-medium">{errorMessage}</div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 1: CONFIGURE & UPLOAD PAYLOAD */}
        {/* ========================================================================= */}
        {step === 'CONFIG_UPLOAD' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {/* Target Entity */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Target Entity
                </label>
                <select
                  value={targetType}
                  onChange={(e) => {
                    setTargetType(e.target.value as BulkTargetType);
                    setPayloadText('');
                    setRawFileBytes(null);
                  }}
                  className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                >
                  <option value="USERS">Users & Roles</option>
                  <option value="DEPARTMENTS">Departments & Hierarchy</option>
                  <option value="REPORTS">Report Definitions</option>
                  <option value="SPECIAL_ACCESS">Special Access Grants</option>
                </select>
              </div>

              {/* Format */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  File Format
                </label>
                <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setFormat('CSV')}
                    className={`flex-1 py-1 text-xs font-bold rounded-lg transition-all ${
                      format === 'CSV'
                        ? 'bg-ob-indigo-600 text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormat('JSON')}
                    className={`flex-1 py-1 text-xs font-bold rounded-lg transition-all ${
                      format === 'JSON'
                        ? 'bg-ob-indigo-600 text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    JSON
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormat('XLSX')}
                    className={`flex-1 py-1 text-xs font-bold rounded-lg transition-all ${
                      format === 'XLSX'
                        ? 'bg-ob-indigo-600 text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    XLSX
                  </button>
                </div>
              </div>

              {/* Conflict Strategy */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Conflict Resolution
                </label>
                <select
                  value={conflictStrategy}
                  onChange={(e) => setConflictStrategy(e.target.value as BulkConflictStrategy)}
                  className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                >
                  <option value="UPDATE">Update / Merge Existing</option>
                  <option value="SKIP">Skip Duplicates</option>
                  <option value="FAIL_ON_CONFLICT">Fail on Duplicate (Strict)</option>
                </select>
              </div>

              {/* Execution Mode */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Execution Safety Mode
                </label>
                <select
                  value={executionMode}
                  onChange={(e) => setExecutionMode(e.target.value as BulkExecutionMode)}
                  className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                >
                  <option value="ATOMIC">Atomic (Rollback on any error)</option>
                  <option value="PARTIAL">Partial Success (Log errors)</option>
                </select>
              </div>
            </div>

            {/* Template Bar */}
            <div className="flex items-center justify-between flex-wrap gap-2 text-xs pt-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleLoadSample}
                  className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition-colors cursor-pointer"
                >
                  Load Sample Template
                </button>
                <button
                  type="button"
                  onClick={handleCopyTemplate}
                  className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition-colors flex items-center gap-1 cursor-pointer"
                >
                  {copiedTemplate ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedTemplate ? 'Copied' : 'Copy Sample'}</span>
                </button>
              </div>

              <label className="px-3 py-1.5 bg-ob-indigo-50 dark:bg-ob-indigo-950/70 hover:bg-ob-indigo-100 dark:hover:bg-ob-indigo-900 text-ob-indigo-700 dark:text-ob-indigo-300 border border-ob-indigo-200 dark:border-ob-indigo-800 rounded-xl font-medium cursor-pointer flex items-center gap-1.5 transition-colors">
                <Upload className="w-3.5 h-3.5" />
                <span>{fileName ? `File: ${fileName}` : 'Upload File (.csv, .json, .xlsx)'}</span>
                <input
                  type="file"
                  accept=".csv,.json,.xlsx"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Textarea for CSV/JSON paste */}
            <div>
              <textarea
                rows={9}
                placeholder={`Paste ${targetType} data in ${format} format or drop a spreadsheet file...`}
                value={payloadText}
                onChange={(e) => {
                  setPayloadText(e.target.value);
                  setRawFileBytes(null);
                }}
                className="w-full p-3 font-mono text-xs bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-ob-indigo-500"
              />
            </div>

            {/* Security Notice */}
            <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 text-[11px] text-blue-800 dark:text-blue-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>
                <strong>Zero-Mutation Guarantee:</strong> Uploading or parsing a file will never alter authoritative data. A full dry-run preview is generated first, requiring explicit confirmation.
              </span>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 2: PREVIEW & VALIDATION RESULTS */}
        {/* ========================================================================= */}
        {step === 'PREVIEW_VALIDATION' && dryRun && (
          <div className="space-y-4">
            {/* Metric Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div className="text-[10px] font-semibold text-slate-500 uppercase">Total Rows</div>
                <div className="text-base font-bold text-slate-900 dark:text-white">{dryRun.summary.totalRows}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase">Valid</div>
                <div className="text-base font-bold text-emerald-700 dark:text-emerald-300">{dryRun.summary.validRows}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                <div className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase">Conflicts</div>
                <div className="text-base font-bold text-amber-700 dark:text-amber-300">{dryRun.summary.conflictingRows}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800">
                <div className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase">To Create</div>
                <div className="text-base font-bold text-indigo-700 dark:text-indigo-300">{dryRun.summary.createdRows}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800">
                <div className="text-[10px] font-semibold text-cyan-600 dark:text-cyan-400 uppercase">To Update</div>
                <div className="text-base font-bold text-cyan-700 dark:text-cyan-300">{dryRun.summary.updatedRows}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800">
                <div className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 uppercase">Invalid</div>
                <div className="text-base font-bold text-rose-700 dark:text-rose-300">{dryRun.summary.rejectedRows}</div>
              </div>
            </div>

            {/* Filter Bar for Preview Rows */}
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[11px] text-slate-500 font-medium">Filter Preview:</span>
                {(['ALL', 'VALID', 'CONFLICT', 'INVALID'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => {
                      setStatusFilter(f);
                      setPreviewPage(1);
                    }}
                    className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                      statusFilter === f
                        ? 'bg-ob-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <div className="text-[11px] text-slate-400">
                Strategy: <span className="font-semibold text-slate-700 dark:text-slate-300">{dryRun.conflictStrategy}</span> | Mode: <span className="font-semibold text-slate-700 dark:text-slate-300">{executionMode}</span>
              </div>
            </div>

            {/* Paginated Table of Row Details */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 sticky top-0">
                  <tr>
                    <th className="p-2 w-12 text-center">Row</th>
                    <th className="p-2">Identifier</th>
                    <th className="p-2 w-24">Action</th>
                    <th className="p-2 w-24">Status</th>
                    <th className="p-2">Validation / Differences</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {currentFilteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-slate-400">
                        No rows matching selected filter.
                      </td>
                    </tr>
                  ) : (
                    currentFilteredRows.map((row) => (
                      <tr key={row.rowNumber} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="p-2 text-center text-slate-400 font-mono text-[11px]">#{row.rowNumber}</td>
                        <td className="p-2 font-medium text-slate-900 dark:text-white">{row.identifier}</td>
                        <td className="p-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              row.action === 'CREATE'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : row.action === 'UPDATE'
                                ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300'
                                : row.action === 'SKIP'
                                ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            }`}
                          >
                            {row.action}
                          </span>
                        </td>
                        <td className="p-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              row.status === 'VALID'
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                                : row.status === 'CONFLICT'
                                ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="p-2 text-[11px]">
                          {row.errors.length > 0 ? (
                            <span className="text-rose-600 dark:text-rose-400 font-medium">
                              {row.errors.join('; ')}
                            </span>
                          ) : (
                            <span className="text-slate-600 dark:text-slate-400">
                              {row.action === 'CREATE'
                                ? `New record: ${JSON.stringify(row.newValues)}`
                                : row.action === 'UPDATE'
                                ? `Updating fields to match upload.`
                                : 'Existing record skipped.'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalFilteredPages > 1 && (
              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                <span>
                  Showing page {previewPage} of {totalFilteredPages} ({filteredRows.length} rows)
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={previewPage <= 1}
                    onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                    className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={previewPage >= totalFilteredPages}
                    onClick={() => setPreviewPage((p) => Math.min(totalFilteredPages, p + 1))}
                    className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 3: EXPLICIT CONFIRMATION */}
        {/* ========================================================================= */}
        {step === 'CONFIRM_EXECUTE' && dryRun && (
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 space-y-3">
              <div className="flex items-center gap-2.5 text-amber-900 dark:text-amber-200 font-bold text-sm">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Explicit Administrative Authorization Required</span>
              </div>
              <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                You are about to execute a transactional bulk modification affecting{' '}
                <strong>{dryRun.summary.validRows + dryRun.summary.conflictingRows}</strong> {dryRun.targetType} record(s).
                This operation will create <strong>{dryRun.summary.createdRows}</strong> new entity(ies) and update{' '}
                <strong>{dryRun.summary.updatedRows}</strong> existing record(s).
              </p>
              <div className="p-3 bg-white/70 dark:bg-slate-900/60 rounded-xl border border-amber-200/60 dark:border-amber-800/60 text-xs space-y-1">
                <div>• Mode: <strong>{executionMode}</strong> (Snapshot captured prior to mutation)</div>
                <div>• Transaction ID: <code className="font-mono text-xs">{dryRun.dryRunId}</code></div>
                <div>• Actor: <strong>{currentUser.name}</strong> ({currentUser.role})</div>
              </div>
            </div>

            {/* Checkbox confirmation */}
            <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmedByUser}
                onChange={(e) => setConfirmedByUser(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-ob-indigo-600 rounded cursor-pointer"
              />
              <span className="text-xs text-slate-800 dark:text-slate-200 font-medium">
                I explicitly confirm applying these changes to the authoritative regulatory registry. I understand that an immutable compliance audit record will be sealed.
              </span>
            </label>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 4: RESULT REPORT */}
        {/* ========================================================================= */}
        {step === 'RESULT_REPORT' && executionResult && (
          <div className="space-y-4">
            <div
              className={`p-4 rounded-2xl border flex items-start gap-3 ${
                executionResult.success
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                  : executionResult.rolledBack
                  ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
              }`}
            >
              {executionResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              ) : executionResult.rolledBack ? (
                <RotateCcw className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              )}
              <div>
                <h3 className="text-sm font-bold">
                  {executionResult.success
                    ? 'Bulk Transaction Successfully Completed'
                    : executionResult.rolledBack
                    ? 'Transaction Failed & Rolled Back Automatically'
                    : 'Partial Success Execution Completed'}
                </h3>
                <p className="text-xs opacity-90 mt-0.5">{executionResult.message}</p>
                <div className="mt-2 text-[11px] font-mono opacity-80">
                  Correlation ID: {executionResult.correlationId}
                </div>
              </div>
            </div>

            {/* Results Table */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 sticky top-0">
                  <tr>
                    <th className="p-2 w-12 text-center">Row</th>
                    <th className="p-2">Identifier</th>
                    <th className="p-2 w-24">Action</th>
                    <th className="p-2 w-24">Status</th>
                    <th className="p-2">Outcome</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {executionResult.rowResults.map((r) => (
                    <tr key={r.rowNumber} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="p-2 text-center text-slate-400 font-mono text-[11px]">#{r.rowNumber}</td>
                      <td className="p-2 font-medium text-slate-900 dark:text-white">{r.identifier}</td>
                      <td className="p-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800">
                          {r.action}
                        </span>
                      </td>
                      <td className="p-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            r.success
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          }`}
                        >
                          {r.success ? 'SUCCESS' : 'FAILED'}
                        </span>
                      </td>
                      <td className="p-2 text-[11px] text-slate-600 dark:text-slate-400">
                        {r.message || r.error}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal Action Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
          <div>
            {step !== 'CONFIG_UPLOAD' && step !== 'RESULT_REPORT' && (
              <button
                type="button"
                onClick={() => {
                  if (step === 'CONFIRM_EXECUTE') setStep('PREVIEW_VALIDATION');
                  else if (step === 'PREVIEW_VALIDATION') setStep('CONFIG_UPLOAD');
                }}
                className="px-3.5 py-1.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer text-xs font-medium"
              >
                Back
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer text-xs font-medium"
            >
              {step === 'RESULT_REPORT' ? 'Close' : 'Cancel'}
            </button>

            {step === 'CONFIG_UPLOAD' && (
              <button
                type="button"
                onClick={handleGenerateDryRun}
                disabled={isProcessing || (!payloadText.trim() && !rawFileBytes)}
                className="px-4 py-2 bg-ob-indigo-600 hover:bg-ob-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer text-xs flex items-center gap-1.5"
              >
                {isProcessing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />}
                <span>Generate Validation Preview</span>
              </button>
            )}

            {step === 'PREVIEW_VALIDATION' && (
              <button
                type="button"
                onClick={handleProceedToConfirmation}
                disabled={!dryRun?.canExecute}
                className="px-4 py-2 bg-ob-indigo-600 hover:bg-ob-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer text-xs flex items-center gap-1.5"
              >
                <span>Proceed to Confirmation</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {step === 'CONFIRM_EXECUTE' && (
              <button
                type="button"
                onClick={handleExecuteTransaction}
                disabled={!confirmedByUser || isProcessing}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer text-xs flex items-center gap-1.5"
              >
                {isProcessing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                <span>Execute Transaction ({executionMode})</span>
              </button>
            )}

            {step === 'RESULT_REPORT' && (
              <button
                type="button"
                onClick={resetWorkflow}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer text-xs flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>New Bulk Operation</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
