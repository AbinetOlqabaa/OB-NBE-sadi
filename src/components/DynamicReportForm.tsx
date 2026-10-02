/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  ReportMetadata,
  ReportSubmission,
  DynamicRowRecord,
  UserSession,
} from '../types/regulatory.ts';
import { DynamicAreaTable } from './DynamicAreaTable.tsx';
import { FormulaEngine } from '../utils/formulaEngine.ts';
import * as XLSX from 'xlsx';
import { ValidationEngine, ValidationSummary } from '../utils/validationEngine.ts';
import {
  ZodValidationService,
  FormValidationState,
  ZodFieldError,
} from '../services/zodValidationService.ts';
import { ExcelService } from '../utils/excelService.ts';
import { Pagination } from './Pagination.tsx';
import { PdfReportGenerator } from '../utils/pdfReportGenerator.ts';
import { exportRegulatoryReportPDF } from '../utils/regulatoryReportPdfExport.ts';
import { exportRegulatoryReportXLSX } from '../utils/regulatoryReportXlsxExport.ts';
import { FieldAuditHoverTool } from './FieldAuditHoverTool.tsx';
import { InputAccessoryView } from './InputAccessoryView.tsx';
import { vibrate, haptics } from '../utils/haptics.ts';
import { indexedDbStorage } from '../services/indexedDbStorage.ts';
import {
  Save,
  Send,
  Download,
  Upload,
  AlertCircle,
  CheckCircle2,
  Calculator,
  Calendar,
  Building,
  ArrowLeft,
  Info,
  Layers,
  Table as TableIcon,
  FileText,
  FileCheck,
  Database,
  Clock,
  ExternalLink,
  Sparkles,
} from 'lucide-react';

interface DynamicReportFormProps {
  metadata: ReportMetadata;
  submission: ReportSubmission;
  currentUser: UserSession;
  readOnly?: boolean;
  onBack: () => void;
  onSave: (values: Record<string, string | number>, dynamicRows: Record<number, DynamicRowRecord[]>, expectedVersion?: number) => void;
  onSubmitToChecker: (comment: string, expectedVersion?: number) => void;
  onReuseSubmission?: (submissionId: string) => void;
}

export const DynamicReportForm: React.FC<DynamicReportFormProps> = ({
  metadata: passedMetadata,
  submission,
  currentUser,
  readOnly = false,
  onBack,
  onSave,
  onSubmitToChecker,
  onReuseSubmission,
}) => {
  // Use immutable template snapshot if present to maintain regulatory integrity
  const metadata = submission.templateSnapshot || passedMetadata;
  const [values, setValues] = useState<Record<string, string | number>>(submission.values || {});
  const [dynamicRows, setDynamicRows] = useState<Record<number, DynamicRowRecord[]>>(submission.dynamicRows || {});
  const [validation, setValidation] = useState<FormValidationState | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [submitModalOpen, setSubmitModalOpen] = useState<boolean>(false);
  const [submitComment, setSubmitComment] = useState<string>('');
  const [filterQuery, setFilterQuery] = useState<string>('');
  const [itemTypeFilter, setItemTypeFilter] = useState<string>('ALL');
  const [importNotification, setImportNotification] = useState<string | null>(null);
  const [activeFormTab, setActiveFormTab] = useState<'ITEMS' | 'DYNAMIC_SCHEDULES'>('ITEMS');
  const [focusedFieldCode, setFocusedFieldCode] = useState<string | null>(null);
  const [sessionEditsHistory, setSessionEditsHistory] = useState<
    Record<string, Array<{ timestamp: string; value: string | number; modifiedBy: string; modifiedByRole?: string }>>
  >({});

  // 30-Second Periodic IndexedDB Auto-Save State
  const AUTO_SAVE_INTERVAL_SECONDS = 30;
  const [autoSaveCountdown, setAutoSaveCountdown] = useState<number>(AUTO_SAVE_INTERVAL_SECONDS);
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<string | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState<boolean>(false);

  const valuesRef = useRef(values);
  const dynamicRowsRef = useRef(dynamicRows);
  const hasUnsavedChangesRef = useRef(hasUnsavedChanges);

  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  useEffect(() => {
    dynamicRowsRef.current = dynamicRows;
  }, [dynamicRows]);

  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isMac = typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const modKey = isMac ? '⌘' : 'Ctrl';

  // Pagination for Fixed Return Items
  const [itemsPage, setItemsPage] = useState(1);
  const [itemsPageSize, setItemsPageSize] = useState(10);

  // Segregation of Duties: Checkers and Admins are strictly read-only
  const isEffectiveReadOnly =
    readOnly ||
    currentUser.role !== 'MAKER' ||
    (submission.status !== 'DRAFT' && submission.status !== 'CORRECTION_REQUIRED');

  useEffect(() => {
    setItemsPage(1);
  }, [filterQuery, itemTypeFilter]);

  // Filter items
  const filteredItems = metadata.ReturnItemsList.filter((item) => {
    const matchesQuery =
      !filterQuery ||
      item._description.toLowerCase().includes(filterQuery.toLowerCase()) ||
      item.Code.toLowerCase().includes(filterQuery.toLowerCase());

    const isFormula = metadata.Formulas.some((f) => f.targetCode === item.Code);
    const val = values[item.Code];
    const isPopulated = val !== '' && val !== undefined && val !== null && val !== 0;

    let matchesType = true;
    if (itemTypeFilter === 'REQUIRED') matchesType = !!item._required;
    else if (itemTypeFilter === 'ERRORS_ONLY') matchesType = ValidationEngine.hasFieldError(validation, item.Code);
    else if (itemTypeFilter === 'FORMULA_TOTAL') matchesType = isFormula || !!item.isTotal;
    else if (itemTypeFilter === 'DIRECT_INPUT') matchesType = !isFormula && !item.isTotal;
    else if (itemTypeFilter === 'POPULATED') matchesType = isPopulated;
    else if (itemTypeFilter === 'EMPTY') matchesType = !isPopulated;

    return matchesQuery && matchesType;
  });

  // Paginated items slice
  const paginatedItems = filteredItems.slice(
    (itemsPage - 1) * itemsPageSize,
    itemsPage * itemsPageSize
  );

  // Direct editable items across the current return for InputAccessoryView navigation
  const editableItems = filteredItems.filter(
    (item) => !metadata.Formulas.some((f) => f.targetCode === item.Code)
  );

  const currentFocusedIndex = editableItems.findIndex((i) => i.Code === focusedFieldCode);
  const currentFocusedItem = currentFocusedIndex >= 0 ? editableItems[currentFocusedIndex] : null;

  const handlePreviousInput = () => {
    if (currentFocusedIndex > 0) {
      const targetItem = editableItems[currentFocusedIndex - 1];
      const targetIdxInFiltered = filteredItems.findIndex((i) => i.Code === targetItem.Code);
      if (targetIdxInFiltered >= 0) {
        const targetPage = Math.floor(targetIdxInFiltered / itemsPageSize) + 1;
        if (targetPage !== itemsPage) {
          setItemsPage(targetPage);
        }
      }
      setFocusedFieldCode(targetItem.Code);
      setTimeout(() => {
        const el = document.getElementById(`field-input-${targetItem.Code}`) as HTMLInputElement | null;
        if (el) {
          el.focus();
          el.select();
        }
      }, 50);
    }
  };

  const handleNextInput = () => {
    if (currentFocusedIndex < editableItems.length - 1) {
      const targetItem = editableItems[currentFocusedIndex + 1];
      const targetIdxInFiltered = filteredItems.findIndex((i) => i.Code === targetItem.Code);
      if (targetIdxInFiltered >= 0) {
        const targetPage = Math.floor(targetIdxInFiltered / itemsPageSize) + 1;
        if (targetPage !== itemsPage) {
          setItemsPage(targetPage);
        }
      }
      setFocusedFieldCode(targetItem.Code);
      setTimeout(() => {
        const el = document.getElementById(`field-input-${targetItem.Code}`) as HTMLInputElement | null;
        if (el) {
          el.focus();
          el.select();
        }
      }, 50);
    }
  };

  const handleDoneInput = () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setFocusedFieldCode(null);
    vibrate(20);
  };

  // Recalculate formulas and validations using real-time Zod schema engine
  const recalculateAndValidate = (
    currentVals: Record<string, string | number>,
    currentDynamic: Record<number, DynamicRowRecord[]>
  ): Record<string, string | number> => {
    const calculatedVals = FormulaEngine.calculateReport(metadata, currentVals, currentDynamic);
    const zodValidationState = ZodValidationService.validateReport(metadata, calculatedVals, currentDynamic);
    setValidation(zodValidationState);
    return calculatedVals;
  };

  // Initial calculation on mount
  useEffect(() => {
    recalculateAndValidate(values, dynamicRows);
  }, [metadata.ReturnKey]);

  // Check for newer draft in IndexedDB on mount to prevent data loss
  useEffect(() => {
    let isMounted = true;
    const restoreDraftFromIndexedDB = async () => {
      try {
        const storedDraft = await indexedDbStorage.getDraft(submission.id);
        if (storedDraft && storedDraft.offlineSavedAt && isMounted) {
          const storedTime = new Date(storedDraft.offlineSavedAt).getTime();
          const subTime = new Date(submission.updatedAt || submission.createdAt || 0).getTime();
          if (storedTime > subTime && storedDraft.values && Object.keys(storedDraft.values).length > 0) {
            const calculated = recalculateAndValidate(storedDraft.values, storedDraft.dynamicRows || {});
            setValues(calculated);
            setDynamicRows(storedDraft.dynamicRows || {});
            const timeStr = new Date(storedDraft.offlineSavedAt).toLocaleTimeString();
            setLastAutoSavedAt(timeStr);
            setSaveFeedback(`Restored offline auto-saved draft from IndexedDB (${timeStr})`);
            setTimeout(() => setSaveFeedback(null), 5000);
          }
        }
      } catch (err) {
        console.warn('[IndexedDB] Auto-save restoration check warning:', err);
      }
    };
    restoreDraftFromIndexedDB();
    return () => {
      isMounted = false;
    };
  }, [submission.id]);

  // Periodic Auto-Save every 30 seconds to IndexedDB
  const performAutoSaveToIndexedDB = async () => {
    if (isEffectiveReadOnly || !hasUnsavedChangesRef.current) return;
    try {
      setIsAutoSaving(true);
      const calculated = FormulaEngine.calculateReport(metadata, valuesRef.current, dynamicRowsRef.current);
      const draftRecord: ReportSubmission = {
        ...submission,
        values: calculated,
        dynamicRows: dynamicRowsRef.current,
        updatedAt: new Date().toISOString(),
        offlineSavedAt: new Date().toISOString(),
        syncStatus: 'LOCAL_DRAFT',
        isOfflineDraft: true,
      };

      await indexedDbStorage.saveDraft(draftRecord, {
        syncStatus: 'LOCAL_DRAFT',
        isOffline: true,
      });

      onSave(calculated, dynamicRowsRef.current, submission.version);
      setHasUnsavedChanges(false);
      hasUnsavedChangesRef.current = false;
      const savedTime = new Date().toLocaleTimeString();
      setLastAutoSavedAt(savedTime);
      setAutoSaveCountdown(AUTO_SAVE_INTERVAL_SECONDS);
    } catch (err) {
      console.warn('[IndexedDB] Auto-save failed:', err);
    } finally {
      setIsAutoSaving(false);
    }
  };

  useEffect(() => {
    if (isEffectiveReadOnly) return;

    const timer = setInterval(() => {
      setAutoSaveCountdown((prev) => {
        if (prev <= 1) {
          if (hasUnsavedChangesRef.current) {
            performAutoSaveToIndexedDB();
          }
          return AUTO_SAVE_INTERVAL_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isEffectiveReadOnly, metadata.ReturnKey, submission.id]);

  // Listen for Ctrl+S or Cmd+S to save draft
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (!isEffectiveReadOnly) {
          handleManualSave();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [values, dynamicRows, isEffectiveReadOnly]);

  const handleFieldChange = (code: string, value: string | number) => {
    if (isEffectiveReadOnly) return;
    const nextValues = { ...values, [code]: value };
    const calculated = recalculateAndValidate(nextValues, dynamicRows);
    setValues(calculated);
    setHasUnsavedChanges(true);

    // Record session edit history for cell-level audit trail
    setSessionEditsHistory((prev) => {
      const existing = prev[code] || [];
      const newEntry = {
        timestamp: new Date().toISOString(),
        value,
        modifiedBy: currentUser.name || 'Maker Officer',
        modifiedByRole: currentUser.role || 'MAKER',
      };
      return {
        ...prev,
        [code]: [...existing, newEntry],
      };
    });
  };

  const handleAddDynamicRow = (areaId: number) => {
    if (readOnly) return;
    const areaDef = metadata.DynamicItemsList.find((a) => a.Area === areaId);
    if (!areaDef) return;

    const rowValues: Record<string, string | number> = {};
    areaDef.DynamicItems.forEach((col) => {
      rowValues[col.Code] = col._dataType === 'NUMERIC' ? 0 : '';
    });

    const newRow: DynamicRowRecord = {
      id: `row_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      areaId,
      values: rowValues,
    };

    const currentAreaRows = dynamicRows[areaId] || [];
    const nextDynamic = { ...dynamicRows, [areaId]: [...currentAreaRows, newRow] };
    setDynamicRows(nextDynamic);
    setHasUnsavedChanges(true);
    const calculated = recalculateAndValidate(values, nextDynamic);
    setValues(calculated);
  };

  const handleUpdateDynamicCell = (
    areaId: number,
    rowId: string,
    columnCode: string,
    val: any
  ) => {
    if (readOnly) return;
    const currentAreaRows = dynamicRows[areaId] || [];
    const updatedRows = currentAreaRows.map((r) =>
      r.id === rowId
        ? {
            ...r,
            values: { ...(r.values || {}), [columnCode]: val },
          }
        : r
    );

    const nextDynamic = { ...dynamicRows, [areaId]: updatedRows };
    setDynamicRows(nextDynamic);
    setHasUnsavedChanges(true);
    const calculated = recalculateAndValidate(values, nextDynamic);
    setValues(calculated);
  };

  const handleDeleteDynamicRow = (areaId: number, rowId: string) => {
    if (readOnly) return;
    const currentAreaRows = dynamicRows[areaId] || [];
    const updatedRows = currentAreaRows.filter((r) => r.id !== rowId);
    const nextDynamic = { ...dynamicRows, [areaId]: updatedRows };
    setDynamicRows(nextDynamic);
    setHasUnsavedChanges(true);
    const calculated = recalculateAndValidate(values, nextDynamic);
    setValues(calculated);
  };

  const handleManualSave = async () => {
    vibrate(30);
    const calculated = recalculateAndValidate(values, dynamicRows);
    setValues(calculated);
    onSave(calculated, dynamicRows, submission.version);
    setHasUnsavedChanges(false);
    hasUnsavedChangesRef.current = false;
    setAutoSaveCountdown(AUTO_SAVE_INTERVAL_SECONDS);
    const savedTime = new Date().toLocaleTimeString();
    setLastAutoSavedAt(savedTime);

    try {
      await indexedDbStorage.saveDraft(
        {
          ...submission,
          values: calculated,
          dynamicRows,
          updatedAt: new Date().toISOString(),
          offlineSavedAt: new Date().toISOString(),
          syncStatus: 'LOCAL_DRAFT',
          isOfflineDraft: true,
        },
        { syncStatus: 'LOCAL_DRAFT', isOffline: true }
      );
    } catch (err) {
      console.warn('[IndexedDB] Manual save to IndexedDB warning:', err);
    }

    setSaveFeedback(
      `Draft persisted to local IndexedDB (Protected for remote NBE site visits) at ${savedTime}`
    );
    setTimeout(() => setSaveFeedback(null), 4000);
  };

  const handleBackWithSafety = () => {
    if (hasUnsavedChanges && !isEffectiveReadOnly) {
      const calculated = recalculateAndValidate(values, dynamicRows);
      onSave(calculated, dynamicRows, submission.version);
    }
    onBack();
  };

  const handleExportExcel = () => {
    vibrate(20);
    try {
      const exportedFile = exportRegulatoryReportXLSX(
        {
          ...submission,
          values,
          dynamicRows,
          templateSnapshot: metadata,
        },
        {
          officerName: currentUser.name,
          officerRole: currentUser.role,
        }
      );
      setExportNotice(`XLSX exported for NBE offline review: ${exportedFile}`);
      setTimeout(() => setExportNotice(null), 6000);
    } catch (err: any) {
      alert(`XLSX Export error: ${err?.message || 'Failed to generate Excel report'}`);
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const imported = ExcelService.importFromBuffer(arrayBuffer, metadata);

      const nextValues = { ...values, ...imported.values };
      const nextDynamic = { ...dynamicRows };

      Object.entries(imported.dynamicRows).forEach(([areaKey, rows]) => {
        const areaId = Number(areaKey);
        const mapped = (rows as DynamicRowRecord[]).map((r, i) => ({
          ...r,
          id: `imported_${Date.now()}_${i}`,
          areaId,
          values: r.values || {},
        }));
        nextDynamic[areaId] = mapped;
      });

      setValues(nextValues);
      setDynamicRows(nextDynamic);
      setHasUnsavedChanges(true);
      const calculated = recalculateAndValidate(nextValues, nextDynamic);
      onSave(calculated, nextDynamic);

      setImportNotification(
        `Successfully imported data from ${file.name}. Validations re-evaluated.`
      );
      setTimeout(() => setImportNotification(null), 5000);
    } catch (err: any) {
      alert(`Import error: ${err.message}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const filledCount = metadata.ReturnItemsList.filter(
    (i) => values[i.Code] !== '' && values[i.Code] !== undefined
  ).length;

  return (
    <div className="h-full flex flex-col overflow-hidden space-y-2 font-sans">
      {/* 1. Top Header & Action Controls (Strictly Fixed Height) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 rounded-xl shadow-2xs shrink-0 transition-colors">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={handleBackWithSafety}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer touch-manipulation touch-press shrink-0"
            title="Back to Catalog (Auto-saves draft if modified)"
            aria-label="Back to Catalog"
          >
            <ArrowLeft className="w-5 h-5 sm:w-4 sm:h-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 truncate">
              <span>Returns</span>
              <span>/</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">{metadata.Category}</span>
              <span>/</span>
              <span className="font-mono font-bold text-ob-indigo-700 dark:text-ob-indigo-400">{metadata.Code}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white tracking-tight leading-tight truncate max-w-md sm:max-w-xl">
                {metadata.Title}
              </h1>
              <div
                className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 shrink-0 transition-all"
                title="Draft data is periodically auto-saved to local IndexedDB every 30 seconds to prevent data loss"
              >
                <Database className={`w-3 h-3 ${isAutoSaving ? 'animate-spin text-ob-indigo-600' : 'text-emerald-600 dark:text-emerald-400'}`} />
                {isAutoSaving ? (
                  <span className="font-bold text-ob-indigo-600 dark:text-ob-indigo-400">Saving to IndexedDB...</span>
                ) : lastAutoSavedAt ? (
                  <span>Auto-saved {lastAutoSavedAt} (every 30s)</span>
                ) : (
                  <span>IndexedDB Active • Auto-save (30s)</span>
                )}
                {hasUnsavedChanges && !isAutoSaving && (
                  <span className="text-[9px] text-amber-600 dark:text-amber-400 font-bold ml-0.5">
                    (in {autoSaveCountdown}s)
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto flex-wrap">
          {/* Reuse as New for submitted/final returns */}
          {onReuseSubmission && (submission.status === 'SENT' || submission.status === 'APPROVED' || readOnly) && (
            <button
              type="button"
              onClick={() => onReuseSubmission(submission.id)}
              className="min-h-[44px] sm:min-h-[34px] flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-ob-indigo-600 hover:bg-ob-indigo-700 rounded-xl sm:rounded-lg transition-colors shadow-2xs cursor-pointer touch-manipulation touch-press"
              title="Create a new draft using this submitted report as template (source report remains 100% immutable)"
            >
              <Sparkles className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-ob-indigo-200" />
              <span>Reuse as New</span>
            </button>
          )}

          {/* Download as Signed PDF button */}
          <button
            type="button"
            onClick={() => exportRegulatoryReportPDF(submission)}
            className="min-h-[44px] sm:min-h-[34px] flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-ob-indigo-600 hover:bg-ob-indigo-700 border border-ob-indigo-500 rounded-xl sm:rounded-lg transition-colors shadow-2xs cursor-pointer touch-manipulation touch-press"
            title="Download official NBE signed PDF regulatory return document"
          >
            <FileCheck className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-ob-green-300" />
            <span>Signed PDF</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="min-h-[44px] sm:min-h-[34px] flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl sm:rounded-lg transition-colors shadow-2xs cursor-pointer touch-manipulation touch-press"
            title="Export return to Excel XLSX using SheetJS for offline NBE review"
          >
            <Download className="w-4 h-4 sm:w-3 sm:h-3 text-slate-500 dark:text-slate-400" />
            <span>XLSX</span>
          </button>

          {!isEffectiveReadOnly && (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[44px] sm:min-h-[34px] flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl sm:rounded-lg transition-colors shadow-2xs cursor-pointer touch-manipulation touch-press"
                title="Import data from Excel XLSX"
              >
                <Upload className="w-4 h-4 sm:w-3 sm:h-3 text-slate-500 dark:text-slate-400" />
                <span>Import</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileImport}
                className="hidden"
              />

              <button
                type="button"
                onClick={handleManualSave}
                className={`min-h-[44px] sm:min-h-[34px] flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl sm:rounded-lg transition-colors cursor-pointer touch-manipulation touch-press ${
                  hasUnsavedChanges
                    ? 'bg-slate-900 dark:bg-ob-indigo-600 text-white hover:bg-slate-800 dark:hover:bg-ob-indigo-700 shadow-2xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
                title={`Save Changes (${modKey}+S)`}
              >
                <Save className="w-4 h-4 sm:w-3 sm:h-3" />
                <span>{hasUnsavedChanges ? 'Save Changes' : 'Saved'}</span>
                <kbd className={`hidden sm:inline px-1 py-0.2 text-[9px] font-mono rounded border ${
                  hasUnsavedChanges ? 'bg-slate-800 dark:bg-ob-indigo-800 border-slate-700 dark:border-ob-indigo-700 text-slate-300 dark:text-ob-indigo-200' : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                }`}>
                  {modKey}+S
                </kbd>
              </button>

              <button
                type="button"
                onClick={() => setSubmitModalOpen(true)}
                disabled={!validation?.isValid}
                title={
                  validation?.isValid
                    ? 'Submit prepared regulatory return for Checker 4-eyes review'
                    : `Cannot submit: ${validation?.errorsCount || 0} unresolved field-level validation error(s) must be fixed first.`
                }
                className={`min-h-[44px] sm:min-h-[34px] flex items-center gap-1 px-3.5 py-1.5 text-xs font-bold rounded-xl sm:rounded-lg transition-colors shadow-2xs touch-manipulation touch-press ${
                  validation?.isValid
                    ? 'bg-ob-indigo-600 text-white hover:bg-ob-indigo-700 cursor-pointer'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                }`}
              >
                <Send className="w-4 h-4 sm:w-3 sm:h-3" />
                <span>{submission.status === 'CORRECTION_REQUIRED' ? 'Resubmit to Checker' : 'Submit to Checker'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Maker Lifecycle Indicator Bar */}
      <div className="bg-slate-50 dark:bg-slate-850 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-[10px] font-medium flex items-center justify-between gap-2 overflow-x-auto select-none shrink-0">
        <div className="flex items-center gap-1.5 shrink-0 text-slate-500 dark:text-slate-400 font-mono">
          <span className="font-bold text-slate-700 dark:text-slate-200">Lifecycle:</span>
          <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold">1. CREATE</span>
          <span>→</span>
          <span className={`px-1.5 py-0.5 rounded font-semibold ${hasUnsavedChanges ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold border border-amber-300 dark:border-amber-700' : 'bg-slate-200 dark:bg-slate-700'}`}>2. EDIT</span>
          <span>→</span>
          <span className={`px-1.5 py-0.5 rounded font-semibold ${!hasUnsavedChanges && !isEffectiveReadOnly ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-300 dark:border-emerald-700' : 'bg-slate-200 dark:bg-slate-700'}`}>3. SAVE DRAFT</span>
          <span>→</span>
          <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700">4. LEAVE / RETURN</span>
          <span>→</span>
          <span className={`px-1.5 py-0.5 rounded font-semibold ${validation?.isValid ? 'bg-ob-indigo-100 dark:bg-ob-indigo-950 text-ob-indigo-800 dark:text-ob-indigo-300 font-bold' : 'bg-slate-200 dark:bg-slate-700'}`}>5. VALIDATE</span>
          <span>→</span>
          <span className={`px-1.5 py-0.5 rounded font-semibold ${submission.status === 'PENDING_CHECKER' || submission.status === 'APPROVED' || submission.status === 'SENT' ? 'bg-emerald-600 text-white font-bold' : 'bg-slate-200 dark:bg-slate-700'}`}>
            {submission.status === 'CORRECTION_REQUIRED' ? '6. RESUBMIT' : '6. SUBMIT'}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-mono text-slate-500">Return: <strong>{metadata.Code}</strong></span>
          <span className="font-mono text-slate-500">v{submission.version}</span>
        </div>
      </div>

      {/* Reused Report Banner */}
      {submission.reusedFromSubmissionId && (
        <div className="bg-ob-indigo-50 dark:bg-ob-indigo-950/60 border border-ob-indigo-200 dark:border-ob-indigo-800 px-3 py-1.5 rounded-lg text-xs flex items-center justify-between text-ob-indigo-900 dark:text-ob-indigo-200 shrink-0 animate-in fade-in">
          <div className="flex items-center gap-2 font-semibold">
            <Sparkles className="w-4 h-4 text-ob-indigo-600 dark:text-ob-indigo-400 shrink-0" />
            <span>Reused from submitted return <strong>{submission.reusedFromSubmissionId}</strong> (v{submission.reusedFromVersion}). You are editing an independent new draft. The source submission is permanently sealed and untouched.</span>
          </div>
        </div>
      )}

      {/* Returned for Correction Banner */}
      {submission.status === 'CORRECTION_REQUIRED' && (
        <div className="bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 px-3 py-1.5 rounded-lg text-xs flex items-center justify-between text-amber-900 dark:text-amber-200 shrink-0 animate-in fade-in">
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>Returned for Correction by Checker: {submission.comments?.[submission.comments.length - 1]?.comment || 'Please update the requested fields and click Resubmit to Checker.'}</span>
          </div>
        </div>
      )}

      {/* 2. Notification Toast if active */}
      {saveFeedback && (
        <div className="bg-ob-green-50 dark:bg-ob-green-950/60 border border-ob-green-300 dark:border-ob-green-800 text-ob-green-950 dark:text-ob-green-200 px-3 py-1.5 rounded-lg text-xs flex items-center justify-between shadow-2xs shrink-0 animate-in fade-in">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5 text-ob-green-700 dark:text-ob-green-400 shrink-0" />
            <span>{saveFeedback}</span>
          </div>
          <button
            onClick={() => setSaveFeedback(null)}
            className="text-ob-green-800 dark:text-ob-green-400 hover:text-ob-green-950 dark:hover:text-ob-green-200 font-bold text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {exportNotice && (
        <div className="bg-ob-indigo-50 dark:bg-ob-indigo-950/60 border border-ob-indigo-300 dark:border-ob-indigo-800 text-ob-indigo-950 dark:text-ob-indigo-200 px-3 py-1.5 rounded-lg text-xs flex items-center justify-between shadow-2xs shrink-0 animate-in fade-in">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5 text-ob-indigo-600 dark:text-ob-indigo-400 shrink-0" />
            <span>{exportNotice}</span>
          </div>
          <button
            onClick={() => setExportNotice(null)}
            className="text-ob-indigo-800 dark:text-ob-indigo-400 hover:text-ob-indigo-950 dark:hover:text-ob-indigo-200 font-bold text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {importNotification && (
        <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 px-3 py-1.5 rounded-lg text-xs flex items-center justify-between shadow-2xs shrink-0">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{importNotification}</span>
          </div>
          <button
            onClick={() => setImportNotification(null)}
            className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-200 font-bold text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* 3. Envelope Context & Validation Summary Strip (Fixed Height) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-2xs transition-colors">
        <div className="flex items-center gap-4 text-[11px] text-slate-600 dark:text-slate-300">
          <span className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1">
            <Building className="w-3 h-3 text-slate-400" />
            Oromia Bank (0000013)
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3 text-slate-400" />
            Period: {metadata.FinYear} ({metadata.Frequency})
          </span>
          <span>•</span>
          <span className="font-bold text-ob-indigo-700 dark:text-ob-indigo-400">
            Status: {submission.status.replace('_', ' ')} (v{submission.version})
          </span>
        </div>

        {validation && (
          <div className="flex items-center gap-2 text-[11px]">
            {validation.isValid ? (
              <span className="text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 px-2 py-0.5 rounded-md">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Zod Validated: All Constraints Passed (100%)</span>
              </span>
            ) : (
              <span className="text-rose-700 dark:text-rose-300 font-bold flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/80 px-2 py-0.5 rounded-md">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>Zod Schema: {validation.errorsCount} Error(s) detected</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* 3.5 Real-Time Zod Validation Error Banner */}
      {validation && !validation.isValid && (
        <div className="bg-rose-50 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-900 rounded-xl px-3.5 py-2.5 text-xs flex flex-col gap-2 shadow-2xs shrink-0 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <div className="leading-tight">
                <span className="font-bold text-rose-900 dark:text-rose-100">
                  {validation.errorsCount} Real-Time Validation Constraint Error(s) Detected Before Submission
                </span>
                <span className="hidden sm:inline text-rose-700 dark:text-rose-300 ml-1.5">
                  • Zod schema validator enforced mandatory fields, currency ranges, and non-negativity.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setItemTypeFilter(itemTypeFilter === 'ERRORS_ONLY' ? 'ALL' : 'ERRORS_ONLY')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                itemTypeFilter === 'ERRORS_ONLY'
                  ? 'bg-rose-700 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-slate-700'
              }`}
            >
              {itemTypeFilter === 'ERRORS_ONLY' ? 'Showing Errors Only' : 'Filter to Errors Only'}
            </button>
          </div>

          {/* Issue Pills Preview */}
          {validation.allErrors && validation.allErrors.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1 border-t border-rose-200 dark:border-rose-900/60 max-h-24 overflow-y-auto">
              {validation.allErrors.slice(0, 5).map((err, i) => (
                <span
                  key={`${err.code}_${i}`}
                  className="inline-flex items-center gap-1 text-[10px] font-medium bg-white dark:bg-slate-900/90 text-rose-800 dark:text-rose-200 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-800"
                >
                  <span className="font-mono font-bold">{err.code}:</span>
                  <span className="truncate max-w-[200px]">{err.message}</span>
                </span>
              ))}
              {validation.allErrors.length > 5 && (
                <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold self-center">
                  +{validation.allErrors.length - 5} more issue(s)
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* 4. Sub-Tabs Bar (if dynamic roster exists) */}
      {metadata.DynamicItemsList.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1.5 shadow-2xs flex items-center gap-1.5 shrink-0 transition-colors">
          <button
            type="button"
            onClick={() => setActiveFormTab('ITEMS')}
            className={`min-h-[44px] sm:min-h-[32px] px-3.5 py-1.5 rounded-xl sm:rounded-lg text-xs font-bold transition-colors cursor-pointer touch-manipulation touch-press flex items-center justify-center ${
              activeFormTab === 'ITEMS'
                ? 'bg-ob-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Fixed Return Items ({metadata.ReturnItemsList.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveFormTab('DYNAMIC_SCHEDULES')}
            className={`min-h-[44px] sm:min-h-[32px] px-3.5 py-1.5 rounded-xl sm:rounded-lg text-xs font-bold transition-colors cursor-pointer touch-manipulation touch-press flex items-center justify-center ${
              activeFormTab === 'DYNAMIC_SCHEDULES'
                ? 'bg-ob-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Repeatable Schedules ({metadata.DynamicItemsList.length})
          </button>
        </div>
      )}

      {/* 5. Main Form Items / Schedules (Strict flex-1 min-h-0 overflow-hidden) */}
      {activeFormTab === 'ITEMS' || metadata.DynamicItemsList.length === 0 ? (
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs transition-colors">
          {/* Search and item filter bar inside fixed return items */}
          <div className="px-3 py-2 bg-slate-50/70 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Line Items: {filledCount} of {metadata.ReturnItemsList.length} populated ({Math.round((filledCount / metadata.ReturnItemsList.length) * 100)}%)
            </span>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full sm:w-auto">
              {validation && !validation.isValid && (
                <button
                  type="button"
                  onClick={() => setItemTypeFilter(itemTypeFilter === 'ERRORS_ONLY' ? 'ALL' : 'ERRORS_ONLY')}
                  className={`min-h-[44px] sm:min-h-[32px] flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-xl sm:rounded-lg border transition-all cursor-pointer touch-manipulation touch-press ${
                    itemTypeFilter === 'ERRORS_ONLY'
                      ? 'bg-rose-600 text-white border-rose-700 shadow-2xs'
                      : 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/80 border-rose-300 dark:border-rose-800 hover:bg-rose-100'
                  }`}
                  title="Filter table to view unresolved validation errors"
                >
                  <AlertCircle className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                  <span>{itemTypeFilter === 'ERRORS_ONLY' ? 'Showing Errors' : `${validation.errorsCount} Error(s)`}</span>
                </button>
              )}

              <select
                value={itemTypeFilter}
                onChange={(e) => setItemTypeFilter(e.target.value)}
                className="min-h-[44px] sm:min-h-[32px] text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl sm:rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-200 font-semibold focus:outline-none focus:ring-2 focus:ring-ob-indigo-500 cursor-pointer shadow-2xs touch-manipulation touch-press"
              >
                <option value="ALL" className="dark:bg-slate-900">All Items ({metadata.ReturnItemsList.length})</option>
                {validation && validation.errorsCount > 0 && (
                  <option value="ERRORS_ONLY" className="dark:bg-slate-900 text-rose-600 font-bold">
                    ⚠️ Validation Errors ({validation.errorsCount})
                  </option>
                )}
                <option value="REQUIRED" className="dark:bg-slate-900">Mandatory Fields Only</option>
                <option value="DIRECT_INPUT" className="dark:bg-slate-900">Direct Input Cells Only</option>
                <option value="FORMULA_TOTAL" className="dark:bg-slate-900">Formula / Total Cells</option>
                <option value="POPULATED" className="dark:bg-slate-900">Populated Items ({filledCount})</option>
                <option value="EMPTY" className="dark:bg-slate-900">Unpopulated Items ({metadata.ReturnItemsList.length - filledCount})</option>
              </select>

              <div className="relative flex-1 sm:w-56 min-w-[160px]">
                <input
                  type="text"
                  placeholder="Search line item or code..."
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  className="w-full min-h-[44px] sm:min-h-[32px] px-3 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-xl sm:rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-ob-indigo-500 shadow-2xs font-medium"
                />
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-50/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
                <tr>
                  <th className="py-2 px-3 w-20 sm:w-28 font-mono">Code</th>
                  <th className="py-2 px-3">Line Item Description</th>
                  <th className="py-2 px-3 w-20 hidden sm:table-cell">Type</th>
                  <th className="py-2 px-3 w-36 sm:w-44 text-right">Value (ETB / Count)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginatedItems.map((item) => {
                  const currentVal = values[item.Code] !== undefined ? values[item.Code] : '';
                  const isFormula = metadata.Formulas.some((f) => f.targetCode === item.Code);
                  const formulaDef = metadata.Formulas.find((f) => f.targetCode === item.Code);
                  const fieldError =
                    validation?.getFieldError?.(item.Code) ||
                    validation?.fieldErrorsMap?.[item.Code] ||
                    ValidationEngine.getFieldError(validation, item.Code);
                  const hasError = !!fieldError && fieldError.severity === 'ERROR';
                  const hasWarning = !!fieldError && fieldError.severity === 'WARNING';

                  return (
                    <tr
                      key={item.Code}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                        hasError
                          ? 'bg-rose-50/40 dark:bg-rose-950/20'
                          : hasWarning
                          ? 'bg-amber-50/30 dark:bg-amber-950/15'
                          : item.isTotal
                          ? 'bg-slate-50/70 dark:bg-slate-800/40 font-semibold'
                          : ''
                      }`}
                    >
                      <td className="py-2 px-3 font-mono text-slate-600 dark:text-slate-400 select-all font-medium text-[11px] sm:text-xs align-top">
                        <div className="flex items-center gap-1">
                          {hasError && <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />}
                          <span>{item.Code}</span>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-slate-900 dark:text-slate-100 align-top">
                        <div className="flex flex-col gap-1">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-1.5">
                            <span className="leading-snug">{item._description}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              {item._required && <span className="text-rose-500 font-bold text-xs" title="Mandatory regulatory field">*</span>}
                              {isFormula && (
                                <span
                                  className="inline-flex items-center gap-0.5 text-[10px] text-ob-indigo-700 dark:text-ob-indigo-300 bg-ob-indigo-50 dark:bg-ob-indigo-950 px-1 py-0.2 rounded border border-ob-indigo-200 dark:border-ob-indigo-800"
                                  title={`Calculated: ${formulaDef?.description || formulaDef?.expression}`}
                                >
                                  <Calculator className="w-2.5 h-2.5" />
                                  Auto
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Real-time field validation error message */}
                          {fieldError && (
                            <div
                              id={`error-${item.Code}`}
                              className={`flex items-start gap-1.5 text-[11px] font-medium px-2 py-1 rounded-md border animate-in fade-in duration-150 ${
                                hasError
                                  ? 'bg-rose-50 dark:bg-rose-950/80 border-rose-200 dark:border-rose-900/80 text-rose-700 dark:text-rose-300'
                                  : 'bg-amber-50 dark:bg-amber-950/80 border-amber-200 dark:border-amber-900/80 text-amber-700 dark:text-amber-300'
                              }`}
                            >
                              <AlertCircle className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${hasError ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`} />
                              <div className="flex flex-col">
                                <span>{fieldError.message}</span>
                                {(fieldError as any).constraintType && (
                                  <span className="text-[9px] uppercase tracking-wider font-mono opacity-80 text-rose-800 dark:text-rose-300">
                                    [Constraint: {(fieldError as any).constraintType.replace('_', ' ')}]
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          {!fieldError && item._required && currentVal !== '' && currentVal !== undefined && (
                            <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                              <span>Mandatory field compliant</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-slate-400 dark:text-slate-500 font-mono text-[10px] hidden sm:table-cell align-top">
                        {item._dataType}
                      </td>
                      <td className="py-1.5 px-3 text-right align-top">
                        <div className="flex items-center justify-end gap-1 w-full">
                          <div className="flex-1">
                            {isEffectiveReadOnly ? (
                              <div className="font-mono tabular-nums text-slate-900 dark:text-slate-100 py-1 text-xs text-right">
                                {currentVal !== '' && currentVal !== undefined ? (
                                  item._dataType === 'NUMERIC' && typeof currentVal === 'number'
                                    ? currentVal.toLocaleString('en-US')
                                    : String(currentVal)
                                ) : (
                                  <span className="text-slate-300 dark:text-slate-600">-</span>
                                )}
                              </div>
                            ) : (
                              <input
                                id={`field-input-${item.Code}`}
                                type={
                                  item._dataType === 'NUMERIC'
                                    ? 'text'
                                    : item._dataType === 'DATE'
                                    ? 'date'
                                    : 'text'
                                }
                                inputMode={item._dataType === 'NUMERIC' ? 'decimal' : undefined}
                                value={currentVal}
                                readOnly={isFormula}
                                placeholder={isFormula ? 'Auto' : '0.00'}
                                onFocus={() => {
                                  if (!isFormula) {
                                    setFocusedFieldCode(item.Code);
                                  }
                                }}
                                onChange={(e) => {
                                  const rawVal = e.target.value;
                                  let val: string | number = rawVal;
                                  if (item._dataType === 'NUMERIC') {
                                    if (rawVal === '') {
                                      val = '';
                                    } else {
                                      const num = Number(rawVal);
                                      val = !isNaN(num) && rawVal.trim() !== '' ? num : rawVal;
                                    }
                                  }
                                  handleFieldChange(item.Code, val);
                                }}
                                className={`w-full min-h-[44px] sm:min-h-[32px] px-2.5 py-1.5 text-xs border rounded-lg transition-colors touch-manipulation ${
                                  isFormula
                                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 cursor-not-allowed text-right font-mono tabular-nums font-semibold'
                                    : hasError
                                    ? 'bg-rose-50/60 dark:bg-rose-950/40 border-rose-400 dark:border-rose-600 text-slate-900 dark:text-white focus:border-rose-500 focus:ring-1 focus:ring-rose-500 focus:outline-none text-right font-mono tabular-nums font-semibold'
                                    : hasWarning
                                    ? 'bg-amber-50/50 dark:bg-amber-950/30 border-amber-400 dark:border-amber-600 text-slate-900 dark:text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none text-right font-mono tabular-nums font-medium'
                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:border-ob-indigo-500 focus:outline-none text-right font-mono tabular-nums font-medium'
                                }`}
                              />
                            )}
                          </div>

                          {/* Field Audit Hover Tool */}
                          <FieldAuditHoverTool
                            fieldCode={item.Code}
                            fieldDescription={item._description}
                            dataType={item._dataType}
                            currentValue={currentVal}
                            submission={submission}
                            sessionEdits={sessionEditsHistory[item.Code] || []}
                            onRevertValue={(revertedVal) => handleFieldChange(item.Code, revertedVal)}
                            isReadOnly={isEffectiveReadOnly || isFormula}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="shrink-0 p-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <Pagination
              currentPage={itemsPage}
              totalItems={filteredItems.length}
              pageSize={itemsPageSize}
              onPageChange={setItemsPage}
              onPageSizeChange={setItemsPageSize}
              pageSizeOptions={[10, 15, 25, 50]}
              itemName="return items"
            />
          </div>
        </div>
      ) : (
        /* Dynamic Schedules View */
        <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1">
          {metadata.DynamicItemsList.map((area) => (
            <DynamicAreaTable
              key={area.Area}
              area={area}
              rows={dynamicRows[area.Area] || []}
              readOnly={readOnly}
              validation={validation}
              onAddRow={() => handleAddDynamicRow(area.Area)}
              onUpdateCell={(rowId, colCode, val) =>
                handleUpdateDynamicCell(area.Area, rowId, colCode, val)
              }
              onDeleteRow={(rowId) => handleDeleteDynamicRow(area.Area, rowId)}
            />
          ))}
        </div>
      )}

      {/* 5.5 Mobile Sticky Thumb-Zone Action Bar (< 640px) */}
      {!isEffectiveReadOnly && (
        <div className="sm:hidden shrink-0 bg-white/95 dark:bg-slate-900/95 border-t border-slate-200 dark:border-slate-800 backdrop-blur-md px-3 py-2 flex items-center justify-between gap-2 shadow-lg z-20 pb-safe">
          <button
            type="button"
            onClick={handleManualSave}
            className={`min-h-[44px] flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all touch-manipulation touch-press cursor-pointer ${
              hasUnsavedChanges
                ? 'bg-slate-900 dark:bg-ob-indigo-600 text-white shadow-md'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Save className="w-4 h-4" />
            <span>{hasUnsavedChanges ? 'Save Draft' : 'Saved'}</span>
          </button>

          <button
            type="button"
            onClick={() => setSubmitModalOpen(true)}
            disabled={!validation?.isValid}
            className={`min-h-[44px] flex-[1.4] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all touch-manipulation touch-press ${
              validation?.isValid
                ? 'bg-ob-indigo-600 hover:bg-ob-indigo-700 text-white shadow-md cursor-pointer'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>Submit to Checker</span>
          </button>
        </div>
      )}

      {/* 6. Maker Submit to Checker Modal */}
      {submitModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-5 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 transition-colors">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Submit Report to Checker
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                You are submitting <span className="font-semibold text-slate-900 dark:text-white">{metadata.Title}</span> for formal 4-eyes Checker review and authorization.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                Maker Remarks / Notes (Optional)
              </label>
              <textarea
                rows={3}
                value={submitComment}
                onChange={(e) => setSubmitComment(e.target.value)}
                placeholder="Add any specific reconciliation notes or ledger context for the Checker..."
                className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:border-ob-indigo-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSubmitModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  vibrate([30, 45, 40]);
                  handleManualSave();
                  onSubmitToChecker(submitComment);
                  setSubmitModalOpen(false);
                }}
                className="px-4 py-1.5 text-xs font-bold text-white bg-ob-indigo-600 hover:bg-ob-indigo-700 rounded-lg transition-colors shadow-2xs cursor-pointer"
              >
                Confirm Submission
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Mobile Input Accessory View (Docked above soft keyboard when editing) */}
      {!isEffectiveReadOnly && focusedFieldCode && (
        <InputAccessoryView
          isVisible={Boolean(focusedFieldCode)}
          currentIndex={currentFocusedIndex >= 0 ? currentFocusedIndex : 0}
          totalFields={editableItems.length}
          currentCode={currentFocusedItem?.Code}
          currentLabel={currentFocusedItem?._description}
          hasPrevious={currentFocusedIndex > 0}
          hasNext={currentFocusedIndex < editableItems.length - 1}
          onPrevious={handlePreviousInput}
          onNext={handleNextInput}
          onDone={handleDoneInput}
        />
      )}
    </div>
  );
};
