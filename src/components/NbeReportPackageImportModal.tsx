/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  Hash,
  Clock,
  Layers,
  Sparkles,
  ArrowRight,
  Database,
  ExternalLink,
  Table as TableIcon,
  Calculator,
  Code2,
  FileCheck,
  Info,
  X,
  RefreshCw,
  Eye,
  Archive,
} from 'lucide-react';
import {
  nbeReportPackageService,
  type NbePackageValidationResult,
  type NbeImportedArtifact,
} from '../services/nbeReportPackageNormalizer.ts';
import { type UserSession } from '../types/regulatory.ts';
import { vibrate } from '../utils/haptics.ts';

interface NbeReportPackageImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserSession;
  onImportSuccess?: (reportKey: string, message: string) => void;
  onOpenStudio?: (reportKey: string) => void;
}

type ModalTab = 'INPUT' | 'PREVIEW' | 'ARTIFACTS';

const SAMPLE_MODERN_PACKAGE = {
  packageVersion: '1.0',
  report: {
    returnKey: 'NBE_CR_EXP_2026',
    shortCode: 'CR_EXP_01',
    mainTitle: 'Credit Exposure & Large Borrowers Statutory Statement',
    subTitles: ['Statutory Schedule A - Single Borrower Prudential Limits'],
    description: 'Statutory prudential schedule measuring concentration risk in accordance with NBE Directive SBB/43/2008.',
    frequency: 'QUARTERLY',
    regulatoryCategory: 'Credit & Risk Management',
    sections: [
      {
        code: 'SEC_EXPOSURE',
        title: 'Single Borrower Concentration & Tier 1 Capital Limits',
        description: 'Exposures exceeding 10% of total capital base',
        order: 1,
        isRepeating: false,
      },
    ],
    fields: [
      {
        itemCode: 'CR_001',
        itemDescription: 'Total Qualifying Tier 1 Capital Base (ETB)',
        dataType: 'NUMERIC',
        isRequired: true,
        order: 1,
        sampleValue: '5840000000', // Sample financial value -> will be stripped!
      },
      {
        itemCode: 'CR_002',
        itemDescription: 'Statutory Concentration Ceiling (25% of Tier 1)',
        dataType: 'NUMERIC',
        isRequired: true,
        isCalculated: true,
        formulaExpression: 'CR_001 * 0.25',
        order: 2,
      },
      {
        itemCode: 'CR_003',
        itemDescription: 'Aggregate Total Large Exposures (ETB)',
        dataType: 'NUMERIC',
        isRequired: true,
        order: 3,
        sampleValue: '1240000000', // Sample value -> will be stripped!
      },
      {
        itemCode: 'CR_004',
        itemDescription: 'Statutory Regulatory Reporting Currency Code',
        dataType: 'STRING',
        isRequired: true,
        order: 4,
        defaultValue: 'ETB',
        isStructuralDefault: true, // Structural default -> preserved!
      },
    ],
    columns: [
      {
        columnKey: 'BORROWER_NAME',
        headerLabel: 'Borrower Legal Registered Name',
        dataType: 'STRING',
        isRequired: true,
        order: 1,
      },
      {
        columnKey: 'TIN_NUMBER',
        headerLabel: 'Borrower Tax Identification Number (TIN)',
        dataType: 'STRING',
        isRequired: true,
        order: 2,
      },
      {
        columnKey: 'COMMITTED_EXPOSURE',
        headerLabel: 'Committed Funded Facility Amount (ETB)',
        dataType: 'NUMERIC',
        isRequired: true,
        order: 3,
      },
    ],
    formulas: [
      {
        targetCode: 'CR_002',
        expression: 'CR_001 * 0.25',
        description: 'Automatic computation of maximum single borrower exposure ceiling',
        dependencies: ['CR_001'],
      },
    ],
    validationRules: [
      {
        id: 'rule_cr_ceiling',
        ruleCode: 'RULE_CR_CEILING',
        ruleName: 'Single Borrower Ceiling Check',
        severity: 'ERROR',
        description: 'Total exposure must not exceed regulatory 25% threshold',
        expression: 'CR_003 <= CR_002',
      },
    ],
    nbeMapping: {
      returnKey: 'NBE_CR_EXP_2026',
      instCode: '0000013',
      reportingFormNumber: 'NBE-BSD-SBB43-01',
      finYear: 2026,
    },
  },
  integration: {
    apiEndpoint: 'https://gateway.nbe.gov.et/api/v1/returns/credit-exposure',
    httpMethod: 'POST',
    contentType: 'application/json',
    authenticationProfile: 'NBE_MUTUAL_TLS_SECURE_VAULT',
    timeoutMs: 30000,
  },
};

export const NbeReportPackageImportModal: React.FC<NbeReportPackageImportModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onImportSuccess,
  onOpenStudio,
}) => {
  const [activeTab, setActiveTab] = useState<ModalTab>('INPUT');
  const [jsonText, setJsonText] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [validationResult, setValidationResult] = useState<NbePackageValidationResult | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [importedReportKey, setImportedReportKey] = useState<string | null>(null);
  const [artifacts, setArtifacts] = useState<NbeImportedArtifact[]>(() => nbeReportPackageService.getAllArtifacts());

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Synchronize artifacts list on open
  useEffect(() => {
    if (isOpen) {
      setArtifacts(nbeReportPackageService.getAllArtifacts());
      setActionError(null);
      setActionSuccess(null);
    }
  }, [isOpen]);

  // Run real-time validation whenever JSON text changes
  useEffect(() => {
    if (!jsonText.trim()) {
      setValidationResult(null);
      return;
    }

    try {
      const result = nbeReportPackageService.validatePackage(jsonText);
      setValidationResult(result);
    } catch (e: any) {
      setValidationResult({
        valid: false,
        format: 'UNKNOWN',
        errors: [{ code: 'INVALID_JSON', message: e.message, severity: 'ERROR' }],
        warnings: [],
        sampleValuesStrippedCount: 0,
        structuralDefaultsPreservedCount: 0,
      });
    }
  }, [jsonText]);

  if (!isOpen) return null;

  const isAdmin = currentUser.role === 'ADMIN';

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setActionError(null);
    setActionSuccess(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setJsonText(text || '');
      vibrate(10);
    };
    reader.onerror = () => {
      setActionError('Failed to read selected file. Please verify file permissions.');
    };
    reader.readAsText(file);
  };

  const handleLoadSample = () => {
    setFileName('sample_nbe_credit_exposure_package.json');
    setJsonText(JSON.stringify(SAMPLE_MODERN_PACKAGE, null, 2));
    setActionError(null);
    setActionSuccess(null);
    vibrate(10);
  };

  const handleExecuteImport = async () => {
    if (!isAdmin) {
      setActionError('Access Denied: Only users with the ADMINISTRATOR role can import NBE JSON packages.');
      return;
    }

    if (!validationResult || !validationResult.valid || !validationResult.normalizedPackage) {
      setActionError('Cannot import an invalid package. Please resolve all validation errors first.');
      return;
    }

    setIsProcessing(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      // Execute import via normalizer service
      const res = nbeReportPackageService.importPackageAsDraft(jsonText, {
        id: currentUser.id,
        name: currentUser.name,
        role: 'ADMIN',
      });

      setImportedReportKey(res.report.returnKey);
      setActionSuccess(res.message);
      setArtifacts(nbeReportPackageService.getAllArtifacts());
      vibrate([15, 50, 15]);

      if (onImportSuccess) {
        onImportSuccess(res.report.returnKey, res.message);
      }
    } catch (err: any) {
      setActionError(err.message || 'Import operation failed.');
      vibrate(50);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col w-full max-w-4xl max-h-[92vh] overflow-hidden text-slate-800 dark:text-slate-100">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-ob-indigo-600/10 dark:bg-ob-indigo-500/20 text-ob-indigo-600 dark:text-ob-indigo-400 flex items-center justify-center">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold">Import NBE Report Definition Package</h2>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-ob-gold-100 dark:bg-ob-gold-950 text-ob-gold-800 dark:text-ob-gold-300 border border-ob-gold-300 dark:border-ob-gold-700">
                  Admin Only
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Transform National Bank of Ethiopia JSON definitions into governed Oromia Bank DRAFT reports
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Admin Authorization Notice */}
        {!isAdmin && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border-b border-rose-200 dark:border-rose-900 flex items-center gap-2 text-xs text-rose-800 dark:text-rose-200">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              <strong>Restricted Administrative Action:</strong> You are currently signed in as <strong>{currentUser.name}</strong> ({currentUser.role}). Only administrators can create or mutate report schemas.
            </span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-4 pt-2 bg-slate-50/40 dark:bg-slate-800/20 text-xs font-semibold">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('INPUT')}
              className={`flex items-center gap-1.5 px-3 py-2 border-b-2 transition-colors cursor-pointer ${
                activeTab === 'INPUT'
                  ? 'border-ob-indigo-600 text-ob-indigo-600 dark:text-ob-indigo-400 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Package JSON & Validation</span>
              {validationResult && (
                <span
                  className={`ml-1 px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
                    validationResult.valid ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                  }`}
                >
                  {validationResult.valid ? 'Valid' : `${validationResult.errors.length} Errors`}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('PREVIEW')}
              disabled={!validationResult?.valid}
              className={`flex items-center gap-1.5 px-3 py-2 border-b-2 transition-colors cursor-pointer ${
                activeTab === 'PREVIEW'
                  ? 'border-ob-indigo-600 text-ob-indigo-600 dark:text-ob-indigo-400 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Draft Structure Preview</span>
            </button>

            <button
              onClick={() => setActiveTab('ARTIFACTS')}
              className={`flex items-center gap-1.5 px-3 py-2 border-b-2 transition-colors cursor-pointer ${
                activeTab === 'ARTIFACTS'
                  ? 'border-ob-indigo-600 text-ob-indigo-600 dark:text-ob-indigo-400 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Audit Artifacts</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-md text-[10px] font-mono bg-slate-200 dark:bg-slate-700">
                {artifacts.length}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2 pb-2">
            <button
              type="button"
              onClick={handleLoadSample}
              className="text-[11px] font-medium text-ob-indigo-600 dark:text-ob-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="w-3 h-3" />
              <span>Load NBE Sample Envelope</span>
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {actionError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <strong>Import Error:</strong> {actionError}
              </div>
            </div>
          )}

          {actionSuccess && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-200 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-2">
                <div className="font-bold text-sm">Governed Draft Created Successfully</div>
                <p>{actionSuccess}</p>
                {importedReportKey && (
                  <div className="flex items-center gap-2 pt-1">
                    {onOpenStudio && (
                      <button
                        onClick={() => {
                          onClose();
                          onOpenStudio(importedReportKey);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors flex items-center gap-1 text-[11px] cursor-pointer"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>Inspect in Template Studio</span>
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setJsonText('');
                        setFileName('');
                        setActionSuccess(null);
                      }}
                      className="px-3 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors text-[11px] cursor-pointer"
                    >
                      Import Another Package
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'INPUT' && (
            <div className="space-y-4">
              {/* File upload drag drop zone */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-ob-indigo-50 dark:bg-ob-indigo-950 text-ob-indigo-600 dark:text-ob-indigo-400 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                      {fileName || 'Select NBE Package File (.json)'}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Supports versioned JSON packages (v1.0, v1.1, v2.0) and legacy 24 statutory templates
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5 text-slate-500" />
                    <span>Browse File</span>
                  </button>
                </div>
              </div>

              {/* JSON Text Editor */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <label htmlFor="nbe-package-json" className="font-semibold text-slate-700 dark:text-slate-300">Package JSON Content</label>
                  <span>{jsonText.length ? `${jsonText.length.toLocaleString()} characters` : 'Paste JSON below'}</span>
                </div>
                <textarea
                  id="nbe-package-json"
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                  placeholder="Paste NBE JSON report package definition here..."
                  rows={10}
                  className="w-full font-mono text-xs p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-ob-indigo-500 transition-colors resize-y"
                  spellCheck={false}
                />
              </div>

              {/* Validation Results Drawer */}
              {validationResult && (
                <div
                  className={`p-4 rounded-xl border space-y-3 ${
                    validationResult.valid
                      ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/80'
                      : 'bg-rose-50/60 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/80'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {validationResult.valid ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                      )}
                      <div>
                        <div className="text-xs font-bold">
                          {validationResult.valid
                            ? 'NBE Package Passed Statutory Validation'
                            : `Validation Failed (${validationResult.errors.length} issue(s))`}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          Format: <strong className="font-mono">{validationResult.format}</strong> • Version: <strong className="font-mono">{validationResult.packageVersion}</strong>
                        </div>
                      </div>
                    </div>

                    {validationResult.sourceHash && (
                      <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-white/70 dark:bg-slate-900/70 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                        <Hash className="w-3 h-3" />
                        <span>SHA-256: {validationResult.sourceHash.slice(0, 16)}...</span>
                      </div>
                    )}
                  </div>

                  {/* Sample Values vs Structural Defaults Notice (Req 6) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 flex items-start gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Sample Values Stripped: </span>
                        <span className="font-mono font-bold text-ob-indigo-600 dark:text-ob-indigo-400">
                          {validationResult.sampleValuesStrippedCount}
                        </span>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                          Financial/business example values removed to ensure clean template instantiation.
                        </p>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Structural Defaults Preserved: </span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {validationResult.structuralDefaultsPreservedCount}
                        </span>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                          Only explicit statutory schema constants and fixed defaults are preserved.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Errors List */}
                  {validationResult.errors.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <div className="text-xs font-bold text-rose-700 dark:text-rose-300">Validation Errors:</div>
                      <div className="space-y-1 max-h-36 overflow-y-auto">
                        {validationResult.errors.map((err, i) => (
                          <div
                            key={i}
                            className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-rose-200 dark:border-rose-900 text-[11px] text-rose-800 dark:text-rose-200 flex items-start gap-1.5"
                          >
                            <span className="px-1 py-0.2 rounded-sm bg-rose-100 dark:bg-rose-950 font-mono text-[9px] font-bold text-rose-800 dark:text-rose-300">
                              {err.code}
                            </span>
                            <span className="flex-1">{err.message}</span>
                            {err.path && <span className="font-mono text-[10px] text-slate-400">{err.path}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Warnings List */}
                  {validationResult.warnings.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <div className="text-xs font-bold text-amber-700 dark:text-amber-300">Governance Warnings:</div>
                      <div className="space-y-1 max-h-24 overflow-y-auto">
                        {validationResult.warnings.map((warn, i) => (
                          <div
                            key={i}
                            className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-amber-200 dark:border-amber-900 text-[11px] text-amber-800 dark:text-amber-200 flex items-start gap-1.5"
                          >
                            <span className="px-1 py-0.2 rounded-sm bg-amber-100 dark:bg-amber-950 font-mono text-[9px] font-bold text-amber-800 dark:text-amber-300">
                              {warn.code}
                            </span>
                            <span className="flex-1">{warn.message}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'PREVIEW' && validationResult?.reportSummary && (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Return Key</div>
                  <div className="font-mono font-bold text-xs mt-0.5 truncate text-ob-indigo-600 dark:text-ob-indigo-400">
                    {validationResult.reportSummary.returnKey}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Frequency</div>
                  <div className="font-bold text-xs mt-0.5">{validationResult.reportSummary.frequency}</div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Return Items</div>
                  <div className="font-mono font-bold text-xs mt-0.5">{validationResult.reportSummary.fieldCount} fields</div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Schedules / Columns</div>
                  <div className="font-mono font-bold text-xs mt-0.5">{validationResult.reportSummary.columnCount} columns</div>
                </div>
              </div>

              {/* Title & Description */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                <div className="text-sm font-bold">{validationResult.reportSummary.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{validationResult.reportSummary.description}</div>
                <div className="text-[11px] text-slate-400 pt-1">
                  Category: <strong>{validationResult.reportSummary.category}</strong> • Short Code: <span className="font-mono">{validationResult.reportSummary.code}</span>
                </div>
              </div>

              {/* Fields Table Preview with Clean Placeholder Inspection */}
              {validationResult.normalizedPackage && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <TableIcon className="w-4 h-4 text-ob-indigo-600" />
                      <span>Normalized Fields ({validationResult.normalizedPackage.version.fields.length})</span>
                    </span>
                    <span className="text-[11px] font-normal text-slate-400">
                      Sample values stripped • Clean placeholders instantiated
                    </span>
                  </div>

                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 sticky top-0">
                        <tr>
                          <th className="p-2.5 w-12">#</th>
                          <th className="p-2.5">Item Code</th>
                          <th className="p-2.5">Description</th>
                          <th className="p-2.5">Data Type</th>
                          <th className="p-2.5">Required</th>
                          <th className="p-2.5">Formula / Default</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono text-[11px]">
                        {validationResult.normalizedPackage.version.fields.slice(0, 30).map((f, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="p-2 text-slate-400">{idx + 1}</td>
                            <td className="p-2 font-bold text-ob-indigo-600 dark:text-ob-indigo-400">{f.itemCode}</td>
                            <td className="p-2 font-sans text-xs text-slate-800 dark:text-slate-200">{f.itemDescription}</td>
                            <td className="p-2">
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-200 dark:bg-slate-700">
                                {f.dataType}
                              </span>
                            </td>
                            <td className="p-2">{f.isRequired ? 'Yes' : 'No'}</td>
                            <td className="p-2 text-slate-500">
                              {f.formulaExpression ? (
                                <span className="text-amber-600 dark:text-amber-400 font-semibold">{f.formulaExpression}</span>
                              ) : f.defaultValue !== undefined ? (
                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">[Default: {String(f.defaultValue)}]</span>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600 italic">(blank)</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'ARTIFACTS' && (
            <div className="space-y-3">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Auditable repository of original imported NBE packages and SHA-256 cryptographic signatures.
              </div>

              {artifacts.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-400">
                  No NBE report packages imported yet.
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {artifacts.map((art, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-ob-indigo-600 dark:text-ob-indigo-400">
                            {art.returnKey}
                          </span>
                          <span className="px-1.5 py-0.2 rounded-md text-[10px] bg-slate-200 dark:bg-slate-700 font-semibold">
                            {art.packageVersion}
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            {art.reportName}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 font-mono">
                          <span>SHA-256: {art.sourceHash.slice(0, 16)}...</span>
                          <span>•</span>
                          <span>By: {art.importedBy?.name}</span>
                          <span>•</span>
                          <span>{new Date(art.importedAt).toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => {
                            setJsonText(art.rawPackageText);
                            setActiveTab('INPUT');
                            vibrate(10);
                          }}
                          className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-[11px] hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                        >
                          Load JSON
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-ob-indigo-500 shrink-0" />
            <span>
              Report will be created in <strong>DRAFT</strong> status. 4-Eyes Compliance review required before publication.
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleExecuteImport}
              disabled={!validationResult?.valid || isProcessing || !isAdmin}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-ob-indigo-600 text-white hover:bg-ob-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xs flex items-center gap-2 cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Normalizing Draft...</span>
                </>
              ) : (
                <>
                  <FileCheck className="w-4 h-4" />
                  <span>Import as Governed Draft</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
