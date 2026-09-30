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
  AlertCircle,
  X,
  Copy,
  Check,
  RefreshCw,
  Layers,
  ArrowRight,
  Info,
} from 'lucide-react';
import {
  departmentService,
  DepartmentInput,
  ReportTypeInput,
} from '../services/departmentService.ts';
import { vibrate } from '../utils/haptics.ts';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  adminName?: string;
}

type ImportTarget = 'DEPARTMENTS' | 'REPORT_TYPES';
type ImportFormat = 'CSV' | 'JSON';

const SAMPLE_DEPARTMENTS_CSV = `Name,ShortCode,Division,Description,ReportKeys
Mortgage & Retail Credit,MRCD,Credit Business & Operations Division,Mortgage lending operations,LOA_ADV_OUT_LA001;BUIL_CONSTXW002
Corporate Syndications,CSD,Credit Business & Operations Division,Large syndication credits,TOP_20_BOR_TB001;BOR_TEN_PER_LB002
Treasury & Money Markets,TMMD,Finance & Accounts Division,Asset liability management,`;

const SAMPLE_DEPARTMENTS_JSON = `[
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
]`;

const SAMPLE_REPORTS_CSV = `ReturnKey,Title,Category,Frequency,Description,Departments
FOREIGN_CURR_FC001,Foreign Currency Exposure Return,Exposures & Concentration,MONTHLY,Foreign currency position return,Trade Services & International Banking
ESG_GREEN_EG001,Green & Sustainable Lending Schedule,Credit & Lending,QUARTERLY,NBE ESG regulatory return,Credit Operations & Portfolio Management`;

const SAMPLE_REPORTS_JSON = `[
  {
    "ReturnKey": "MOBILE_MONEY_MM001",
    "Title": "Mobile Wallet & Fintech Credit Return",
    "Category": "Credit & Lending",
    "Frequency": "MONTHLY",
    "Description": "Digital wallet loan volumes and defaults",
    "departments": ["Digital Banking & Fintech Operations"]
  }
]`;

export const BulkImportModal: React.FC<BulkImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  adminName = 'Administrator',
}) => {
  const [target, setTarget] = useState<ImportTarget>('DEPARTMENTS');
  const [format, setFormat] = useState<ImportFormat>('CSV');
  const [conflictMode, setConflictMode] = useState<'SKIP' | 'UPDATE'>('UPDATE');
  const [payloadText, setPayloadText] = useState('');
  const [copiedSample, setCopiedSample] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Parsing result preview
  const [parsedPreview, setParsedPreview] = useState<{
    itemsCount: number;
    errors: string[];
    data: any[];
  } | null>(null);

  if (!isOpen) return null;

  const getSampleText = () => {
    if (target === 'DEPARTMENTS') {
      return format === 'CSV' ? SAMPLE_DEPARTMENTS_CSV : SAMPLE_DEPARTMENTS_JSON;
    }
    return format === 'CSV' ? SAMPLE_REPORTS_CSV : SAMPLE_REPORTS_JSON;
  };

  const handleCopySample = () => {
    navigator.clipboard.writeText(getSampleText());
    setCopiedSample(true);
    vibrate(10);
    setTimeout(() => setCopiedSample(false), 2000);
  };

  const handleFillSample = () => {
    const sample = getSampleText();
    setPayloadText(sample);
    handleParseText(sample, target, format);
  };

  const handleParseText = (text: string, currentTarget: ImportTarget, currentFormat: ImportFormat) => {
    if (!text.trim()) {
      setParsedPreview(null);
      return;
    }

    if (currentTarget === 'DEPARTMENTS') {
      const res = departmentService.parseDepartmentsPayload(text, currentFormat);
      setParsedPreview({
        itemsCount: res.data.length,
        errors: res.errors,
        data: res.data,
      });
    } else {
      const res = departmentService.parseReportTypesPayload(text, currentFormat);
      setParsedPreview({
        itemsCount: res.data.length,
        errors: res.errors,
        data: res.data,
      });
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setPayloadText(val);
    handleParseText(val, target, format);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = String(event.target?.result || '');
      setPayloadText(content);
      // Auto-detect format by extension
      const detectedFormat = file.name.endsWith('.json') ? 'JSON' : 'CSV';
      setFormat(detectedFormat);
      handleParseText(content, target, detectedFormat);
    };
    reader.readAsText(file);
  };

  const handleExecuteImport = async () => {
    if (!payloadText.trim() || !parsedPreview || parsedPreview.data.length === 0) return;

    setIsProcessing(true);
    try {
      if (target === 'DEPARTMENTS') {
        const result = departmentService.bulkImportDepartments(
          parsedPreview.data as DepartmentInput[],
          { conflictMode },
          adminName
        );
        onSuccess(result.message);
        vibrate([20, 30, 25]);
        onClose();
      } else {
        const result = await departmentService.bulkImportReportTypes(
          parsedPreview.data as ReportTypeInput[],
          { conflictMode },
          adminName
        );
        onSuccess(result.message);
        vibrate([20, 30, 25]);
        onClose();
      }
    } catch (err: any) {
      alert(`Import failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4 max-h-[calc(100dvh-2rem)] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-ob-indigo-500/10 dark:bg-ob-indigo-500/20 text-ob-indigo-600 dark:text-ob-indigo-400 flex items-center justify-center">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Bulk Import Configuration (CSV / JSON)
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Streamline setup by batch importing departments or NBE report types.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Target & Format Selector */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Import Target
            </label>
            <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => {
                  setTarget('DEPARTMENTS');
                  setParsedPreview(null);
                  setPayloadText('');
                }}
                className={`flex-1 py-1 text-xs font-bold rounded-lg transition-all ${
                  target === 'DEPARTMENTS'
                    ? 'bg-ob-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Departments
              </button>
              <button
                type="button"
                onClick={() => {
                  setTarget('REPORT_TYPES');
                  setParsedPreview(null);
                  setPayloadText('');
                }}
                className={`flex-1 py-1 text-xs font-bold rounded-lg transition-all ${
                  target === 'REPORT_TYPES'
                    ? 'bg-ob-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Report Types
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Format
            </label>
            <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => {
                  setFormat('CSV');
                  setParsedPreview(null);
                  setPayloadText('');
                }}
                className={`flex-1 py-1 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${
                  format === 'CSV'
                    ? 'bg-ob-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <FileSpreadsheet className="w-3 h-3" />
                <span>CSV</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormat('JSON');
                  setParsedPreview(null);
                  setPayloadText('');
                }}
                className={`flex-1 py-1 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${
                  format === 'JSON'
                    ? 'bg-ob-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <FileCode className="w-3 h-3" />
                <span>JSON</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Conflict Strategy
            </label>
            <select
              value={conflictMode}
              onChange={(e) => setConflictMode(e.target.value as any)}
              className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            >
              <option value="UPDATE">Update / Merge Existing</option>
              <option value="SKIP">Skip Duplicates</option>
            </select>
          </div>
        </div>

        {/* Action Bar for Sample & File Upload */}
        <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleFillSample}
              className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition-colors cursor-pointer"
            >
              Load Sample Template
            </button>
            <button
              type="button"
              onClick={handleCopySample}
              className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition-colors flex items-center gap-1 cursor-pointer"
            >
              {copiedSample ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              <span>{copiedSample ? 'Copied' : 'Copy Template'}</span>
            </button>
          </div>

          <label className="px-2.5 py-1 bg-ob-indigo-50 dark:bg-ob-indigo-950/70 hover:bg-ob-indigo-100 dark:hover:bg-ob-indigo-900/80 text-ob-indigo-700 dark:text-ob-indigo-300 border border-ob-indigo-200 dark:border-ob-indigo-800 rounded-lg font-medium cursor-pointer flex items-center gap-1">
            <Upload className="w-3 h-3" />
            <span>Upload File (.csv / .json)</span>
            <input
              type="file"
              accept=".csv,.json,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        {/* Text Input Area */}
        <div>
          <textarea
            rows={7}
            placeholder={`Paste ${target === 'DEPARTMENTS' ? 'departments' : 'report types'} ${format} content here or drop a file...`}
            value={payloadText}
            onChange={handleTextChange}
            className="w-full p-3 font-mono text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-ob-indigo-500"
          />
        </div>

        {/* Live Parsing Preview & Validation Status */}
        {parsedPreview && (
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-900 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {parsedPreview.errors.length === 0 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                )}
                <span className="font-bold text-slate-900 dark:text-white">
                  Parsed: {parsedPreview.itemsCount} valid {target === 'DEPARTMENTS' ? 'department(s)' : 'report type(s)'}
                </span>
              </div>
              <span className="text-[10px] text-slate-400">
                Mode: {conflictMode === 'UPDATE' ? 'Update & Merge' : 'Skip Existing'}
              </span>
            </div>

            {parsedPreview.errors.length > 0 && (
              <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-[11px] space-y-0.5 max-h-24 overflow-y-auto">
                <div className="font-bold">Validation Warnings:</div>
                {parsedPreview.errors.map((err, i) => (
                  <div key={i}>• {err}</div>
                ))}
              </div>
            )}

            {/* Quick Preview Table (first 3 items) */}
            {parsedPreview.data.length > 0 && (
              <div className="max-h-28 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 sticky top-0">
                    <tr>
                      <th className="p-1.5">{target === 'DEPARTMENTS' ? 'Name & Code' : 'ReturnKey & Title'}</th>
                      <th className="p-1.5">{target === 'DEPARTMENTS' ? 'Division' : 'Category'}</th>
                      <th className="p-1.5">{target === 'DEPARTMENTS' ? 'Reports' : 'Departments'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {parsedPreview.data.slice(0, 5).map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-100/50 dark:hover:bg-slate-800/60">
                        <td className="p-1.5 font-medium text-slate-900 dark:text-white">
                          {target === 'DEPARTMENTS' ? `${row.name} (${row.shortCode})` : `${row.ReturnKey} - ${row.Title}`}
                        </td>
                        <td className="p-1.5 text-slate-600 dark:text-slate-400">
                          {target === 'DEPARTMENTS' ? row.division : row.Category}
                        </td>
                        <td className="p-1.5 text-slate-500">
                          {target === 'DEPARTMENTS'
                            ? row.reportKeys?.join(', ') || '-'
                            : row.departments?.join(', ') || row.department || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer text-xs"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!parsedPreview || parsedPreview.itemsCount === 0 || isProcessing}
            onClick={handleExecuteImport}
            className="px-4 py-2 bg-ob-indigo-600 hover:bg-ob-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer text-xs flex items-center gap-1.5 touch-press"
          >
            {isProcessing ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            <span>
              {isProcessing
                ? 'Importing...'
                : `Execute Bulk Import (${parsedPreview?.itemsCount || 0} Items)`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
