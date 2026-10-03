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
import { submissionService } from '../services/submissionService.ts';
import { ValidationRemediationService } from '../services/validationRemediationService.ts';
import { ValidationRemediationAssistant } from './ValidationRemediationAssistant.tsx';
import type {
  NormalizedValidationSummary,
  NormalizedValidationItem,
  ProposedFix,
} from '../types/remediation.ts';
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
  Wand2,
  Loader2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';

export interface NavigationGuardHandler {
  hasUnsavedChanges: () => boolean;
  flush: () => Promise<boolean>;
}

export type AutosaveStatus = 'SAVED' | 'SAVING' | 'UNSAVED' | 'FAILED' | 'CONFLICT';

interface DynamicReportFormProps {
  metadata: ReportMetadata;
  submission: ReportSubmission;
  currentUser: UserSession;
  readOnly?: boolean;
  onBack: () => void;
  onSave: (
    values: Record<string, string | number>,
    dynamicRows: Record<number, DynamicRowRecord[]>,
    expectedVersion?: number
  ) => Promise<ReportSubmission> | ReportSubmission;
  onSubmitToChecker: (comment: string, expectedVersion?: number) => void;
  onReuseSubmission?: (submissionId: string) => void;
  onRegisterNavigationGuard?: (guard: NavigationGuardHandler | null) => void;
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
  onRegisterNavigationGuard,
}) => {
  // Use immutable template snapshot if present to maintain regulatory integrity
  const metadata = submission.templateSnapshot || passedMetadata;
  const [values, setValues] = useState<Record<string, string | number>>(submission.values || {});
  const [dynamicRows, setDynamicRows] = useState<Record<number, DynamicRowRecord[]>>(submission.dynamicRows || {});
  const [validation, setValidation] = useState<FormValidationState | null>(null);
  const [remediationSummary, setRemediationSummary] = useState<NormalizedValidationSummary | null>(null);
  const [assistantOpen, setAssistantOpen] = useState<boolean>(false);
  const [highlightedFieldCode, setHighlightedFieldCode] = useState<string | null>(null);
  const [isFixing, setIsFixing] = useState<boolean>(false);
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

  // Phase 27 SSOT Autosave Status & Persistence States
  const [saveStatus, setSaveStatus] = useState<AutosaveStatus>('SAVED');
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(
    submission.updatedAt ? new Date(submission.updatedAt).toLocaleTimeString() : null
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [currentVersion, setCurrentVersion] = useState<number>(submission.version || 1);
  const currentVersionRef = useRef<number>(submission.version || 1);
  useEffect(() => {
    currentVersionRef.current = currentVersion;
  }, [currentVersion]);

  // Subordinate Local Recovery State (Requirement 8)
  const [subordinateRecoveryDraft, setSubordinateRecoveryDraft] = useState<ReportSubmission | null>(null);

  // Leave-Page Safety Modal State (Requirement 5)
  const [leaveSafetyModalOpen, setLeaveSafetyModalOpen] = useState<boolean>(false);
  const [leaveSafetyError, setLeaveSafetyError] = useState<string | null>(null);
  const [isFlushing, setIsFlushing] = useState<boolean>(false);

  // Optimistic Concurrency Conflict Resolution State (Requirement 7)
  const [conflictModalOpen, setConflictModalOpen] = useState<boolean>(false);
  const [serverConflictSub, setServerConflictSub] = useState<ReportSubmission | null>(null);
  const [mergeFieldDecisions, setMergeFieldDecisions] = useState<Record<string, 'LOCAL' | 'SERVER'>>({});

  // Controlled debounced & throttled autosave timers (Requirement 1 & 2)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const throttleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef<boolean>(false);

  // Periodic fallback countdown
  const AUTO_SAVE_INTERVAL_SECONDS = 30;
  const [autoSaveCountdown, setAutoSaveCountdown] = useState<number>(AUTO_SAVE_INTERVAL_SECONDS);
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

  // Recalculate formulas and validations using real-time Zod schema engine & unified remediation assistant
  const recalculateAndValidate = (
    currentVals: Record<string, string | number>,
    currentDynamic: Record<number, DynamicRowRecord[]>
  ): Record<string, string | number> => {
    const calculatedVals = FormulaEngine.calculateReport(metadata, currentVals, currentDynamic);
    const zodValidationState = ZodValidationService.validateReport(metadata, calculatedVals, currentDynamic);
    setValidation(zodValidationState);

    // Phase 24: Authoritative Normalized Validation & Remediation Assistant Summary
    const normalizedSummary = ValidationRemediationService.normalizeReportValidation(
      metadata,
      calculatedVals,
      currentDynamic
    );
    setRemediationSummary(normalizedSummary);

    return calculatedVals;
  };

  // Phase 24 Requirement 5: Navigate to and highlight relevant field
  const handleNavigateToField = (item: NormalizedValidationItem) => {
    if (item.areaId !== undefined) {
      setActiveFormTab('DYNAMIC_SCHEDULES');
      setAssistantOpen(false);
      setHighlightedFieldCode(item.fieldCode);
      setTimeout(() => {
        const el = document.getElementById(`dynamic-cell-${item.areaId}-${item.rowId}-${item.fieldCode}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.focus();
        }
      }, 100);
      setTimeout(() => setHighlightedFieldCode(null), 3500);
      return;
    }

    setActiveFormTab('ITEMS');
    setAssistantOpen(false);

    if (itemTypeFilter !== 'ALL' && itemTypeFilter !== 'ERRORS_ONLY') {
      setItemTypeFilter('ALL');
    }
    if (filterQuery) {
      setFilterQuery('');
    }

    const itemIndex = metadata.ReturnItemsList.findIndex((i) => i.Code === item.fieldCode);
    if (itemIndex >= 0) {
      const targetPage = Math.floor(itemIndex / itemsPageSize) + 1;
      setItemsPage(targetPage);
    }

    setHighlightedFieldCode(item.fieldCode);
    setTimeout(() => {
      const el = document.getElementById(`field-input-${item.fieldCode}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
        if (el instanceof HTMLInputElement) el.select();
      }
    }, 150);

    setTimeout(() => setHighlightedFieldCode(null), 3500);
  };

  // Phase 27: Authoritative Server SSOT Persistence Engine (Requirements 1, 2, 3, 4, 7)
  const performSave = async (
    reason: 'AUTOSAVE' | 'MANUAL' | 'FLUSH' | 'RETRY' | 'FORCE_OVERWRITE' | 'RECONCILE' | 'AUTO_FIX',
    overrideExpectedVersion?: number
  ): Promise<ReportSubmission> => {
    if (isEffectiveReadOnly) {
      throw new Error('Read-only submission cannot be modified.');
    }

    // Cancel pending debounce/throttle timers
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (throttleTimerRef.current) {
      clearTimeout(throttleTimerRef.current);
      throttleTimerRef.current = null;
    }

    isSavingRef.current = true;
    setIsAutoSaving(true);
    setSaveStatus('SAVING');
    setSaveError(null);

    const calculated = recalculateAndValidate(valuesRef.current, dynamicRowsRef.current);
    const expectedVer = overrideExpectedVersion !== undefined ? overrideExpectedVersion : currentVersionRef.current;

    try {
      // Authoritative persistence call to server SSOT
      const result = await Promise.resolve(onSave(calculated, dynamicRowsRef.current, expectedVer));
      const confirmedSub = (result as ReportSubmission) || submission;
      const nextVer = confirmedSub.version || expectedVer + 1;
      const timeStr = new Date().toLocaleTimeString();

      setCurrentVersion(nextVer);
      currentVersionRef.current = nextVer;
      setValues(calculated);
      valuesRef.current = calculated;
      setHasUnsavedChanges(false);
      hasUnsavedChangesRef.current = false;
      setSaveStatus('SAVED');
      setLastSavedTime(timeStr);
      setSaveError(null);
      setConflictModalOpen(false);

      // Subordinate IndexedDB cache update for offline resilience
      await indexedDbStorage.saveDraft(
        {
          ...confirmedSub,
          version: nextVer,
          values: calculated,
          dynamicRows: dynamicRowsRef.current,
          updatedAt: new Date().toISOString(),
          offlineSavedAt: new Date().toISOString(),
          syncStatus: 'SYNCED',
          isOfflineDraft: false,
        },
        { syncStatus: 'SYNCED', isOffline: false }
      ).catch(() => {});

      return confirmedSub;
    } catch (err: any) {
      const errMsg = err?.message || 'Save failed';
      console.warn('[DynamicReportForm] Save rejected by backend SSOT:', errMsg);

      if (
        errMsg.includes('CONCURRENT_MODIFICATION_CONFLICT') ||
        errMsg.includes('409') ||
        errMsg.includes('concurrency') ||
        errMsg.includes('modified concurrently')
      ) {
        setSaveStatus('CONFLICT');
        setSaveError(errMsg);
        // Load latest authoritative server state for interactive resolution
        const latestServer = submissionService.getById(submission.id);
        if (latestServer) {
          setServerConflictSub(latestServer);
        }
        setConflictModalOpen(true);
      } else {
        setSaveStatus('FAILED');
        setSaveError(errMsg);
      }
      throw err;
    } finally {
      isSavingRef.current = false;
      setIsAutoSaving(false);
    }
  };

  // Controlled Debounced Autosave Trigger (Requirement 1: 1500ms debounce, 15s throttle)
  const triggerDebouncedAutosave = () => {
    if (isEffectiveReadOnly) return;
    setHasUnsavedChanges(true);
    hasUnsavedChangesRef.current = true;
    setSaveStatus('UNSAVED');

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      performSave('AUTOSAVE').catch(() => {});
    }, 1500);

    if (!throttleTimerRef.current) {
      throttleTimerRef.current = setTimeout(() => {
        performSave('AUTOSAVE').catch(() => {});
      }, 15000);
    }
  };

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (throttleTimerRef.current) clearTimeout(throttleTimerRef.current);
    };
  }, []);

  // Register Navigation Guard with parent application (Requirement 5 & 6)
  useEffect(() => {
    if (onRegisterNavigationGuard) {
      onRegisterNavigationGuard({
        hasUnsavedChanges: () => hasUnsavedChangesRef.current,
        flush: async () => {
          try {
            await performSave('FLUSH');
            return true;
          } catch (e) {
            return false;
          }
        },
      });
      return () => {
        onRegisterNavigationGuard(null);
      };
    }
  }, [onRegisterNavigationGuard]);

  // Window beforeunload listener for browser close/refresh safety (Requirement 5 & 10)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChangesRef.current) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes in this regulatory report. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Phase 24 Requirements 6, 8 & 9: Safe Auto-Fix, Save & Authoritative Rerun
  const handleApplyFix = async (proposedFix: ProposedFix) => {
    try {
      setIsFixing(true);
      const { updatedValues, updatedDynamicRows, revalidationSummary } =
        ValidationRemediationService.applyAutoFix(
          metadata,
          values,
          dynamicRows,
          proposedFix,
          currentUser,
          submission.id
        );

      setValues(updatedValues);
      valuesRef.current = updatedValues;
      setDynamicRows(updatedDynamicRows);
      dynamicRowsRef.current = updatedDynamicRows;
      setRemediationSummary(revalidationSummary);

      // Re-run Zod state in sync
      const zodValidationState = ZodValidationService.validateReport(metadata, updatedValues, updatedDynamicRows);
      setValidation(zodValidationState);

      setHasUnsavedChanges(true);
      hasUnsavedChangesRef.current = true;

      // Authoritative Save (Requirement 9)
      await performSave('AUTO_FIX', currentVersionRef.current);

      setSaveFeedback(`Auto-Fix Applied: ${proposedFix.description}`);
      vibrate(25);
      setTimeout(() => setSaveFeedback(null), 4000);
    } catch (err: any) {
      setSaveFeedback(`Auto-fix failed: ${err.message}`);
      setTimeout(() => setSaveFeedback(null), 4000);
    } finally {
      setIsFixing(false);
    }
  };

  // Initial calculation on mount
  useEffect(() => {
    recalculateAndValidate(values, dynamicRows);
  }, [metadata.ReturnKey]);

  // Phase 27 Requirement 8: Subordinate Local Recovery State Reconciliation
  // Local recovery state is strictly subordinate to server SSOT. It must never become an alternate SSOT.
  useEffect(() => {
    let isMounted = true;
    const checkSubordinateRecoveryDraft = async () => {
      try {
        const storedDraft = await indexedDbStorage.getDraft(submission.id);
        if (!storedDraft || !isMounted) return;

        const serverVersion = submission.version || 1;
        const localVersion = storedDraft.version || 1;
        const storedTime = new Date(storedDraft.offlineSavedAt || storedDraft.updatedAt || 0).getTime();
        const serverTime = new Date(submission.updatedAt || submission.createdAt || 0).getTime();

        // 1. If server is newer, server SSOT wins unconditionally. Discard obsolete local cache.
        if (serverVersion > localVersion) {
          await indexedDbStorage.deleteDraft(submission.id);
          return;
        }

        // 2. If local subordinate draft has offline edits timestamped after server:
        if (
          storedTime > serverTime &&
          localVersion >= serverVersion &&
          storedDraft.values &&
          Object.keys(storedDraft.values).length > 0
        ) {
          const valuesDiffer = JSON.stringify(storedDraft.values) !== JSON.stringify(submission.values);
          if (valuesDiffer) {
            setSubordinateRecoveryDraft(storedDraft);
          }
        }
      } catch (err) {
        console.warn('[IndexedDB] Subordinate recovery check warning:', err);
      }
    };
    checkSubordinateRecoveryDraft();
    return () => {
      isMounted = false;
    };
  }, [submission.id]);

  const handleReconcileLocalRecovery = async () => {
    if (!subordinateRecoveryDraft) return;
    try {
      const recoveredValues = subordinateRecoveryDraft.values || {};
      const recoveredDynamic = subordinateRecoveryDraft.dynamicRows || {};
      const calculated = recalculateAndValidate(recoveredValues, recoveredDynamic);
      setValues(calculated);
      valuesRef.current = calculated;
      setDynamicRows(recoveredDynamic);
      dynamicRowsRef.current = recoveredDynamic;

      // Persist to server SSOT immediately to reconcile
      await performSave('RECONCILE', submission.version);
      setSubordinateRecoveryDraft(null);
      setSaveFeedback('Subordinate local recovery draft reconciled and persisted to server SSOT.');
      setTimeout(() => setSaveFeedback(null), 4000);
    } catch (err: any) {
      setSaveFeedback(`Reconciliation failed: ${err.message}`);
      setTimeout(() => setSaveFeedback(null), 4000);
    }
  };

  const handleDiscardLocalRecovery = async () => {
    try {
      await indexedDbStorage.deleteDraft(submission.id);
      setSubordinateRecoveryDraft(null);
      setSaveFeedback('Subordinate local cache discarded. Authoritative server copy retained.');
      setTimeout(() => setSaveFeedback(null), 4000);
    } catch (err) {
      setSubordinateRecoveryDraft(null);
    }
  };

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
    valuesRef.current = calculated;
    triggerDebouncedAutosave();

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
    dynamicRowsRef.current = nextDynamic;
    const calculated = recalculateAndValidate(values, nextDynamic);
    setValues(calculated);
    valuesRef.current = calculated;
    triggerDebouncedAutosave();
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
    dynamicRowsRef.current = nextDynamic;
    const calculated = recalculateAndValidate(values, nextDynamic);
    setValues(calculated);
    valuesRef.current = calculated;
    triggerDebouncedAutosave();
  };

  const handleDeleteDynamicRow = (areaId: number, rowId: string) => {
    if (readOnly) return;
    const currentAreaRows = dynamicRows[areaId] || [];
    const updatedRows = currentAreaRows.filter((r) => r.id !== rowId);
    const nextDynamic = { ...dynamicRows, [areaId]: updatedRows };
    setDynamicRows(nextDynamic);
    dynamicRowsRef.current = nextDynamic;
    const calculated = recalculateAndValidate(values, nextDynamic);
    setValues(calculated);
    valuesRef.current = calculated;
    triggerDebouncedAutosave();
  };

  const handleManualSave = async () => {
    vibrate(30);
    try {
      await performSave('MANUAL');
      setSaveFeedback(`Draft persisted to server SSOT at ${new Date().toLocaleTimeString()}`);
      setTimeout(() => setSaveFeedback(null), 4000);
    } catch (err: any) {
      setSaveFeedback(`Save failed: ${err.message}`);
      setTimeout(() => setSaveFeedback(null), 4000);
    }
  };

  // Phase 27 Requirement 5: Route Change & Leave-Page Safety with Flush
  const handleBackWithSafety = async () => {
    if (hasUnsavedChangesRef.current && !isEffectiveReadOnly) {
      try {
        setIsFlushing(true);
        await performSave('FLUSH');
        onBack();
      } catch (err: any) {
        setLeaveSafetyError(err?.message || 'Server persistence failed');
        setLeaveSafetyModalOpen(true);
      } finally {
        setIsFlushing(false);
      }
    } else {
      onBack();
    }
  };

  // Phase 27 Requirement 7: Conflict Resolution Action Handlers
  const handleAcceptServerConflict = () => {
    if (!serverConflictSub) return;
    setValues(serverConflictSub.values || {});
    valuesRef.current = serverConflictSub.values || {};
    setDynamicRows(serverConflictSub.dynamicRows || {});
    dynamicRowsRef.current = serverConflictSub.dynamicRows || {};
    setCurrentVersion(serverConflictSub.version);
    currentVersionRef.current = serverConflictSub.version;
    recalculateAndValidate(serverConflictSub.values || {}, serverConflictSub.dynamicRows || {});
    setHasUnsavedChanges(false);
    hasUnsavedChangesRef.current = false;
    setSaveStatus('SAVED');
    setLastSavedTime(new Date(serverConflictSub.updatedAt).toLocaleTimeString());
    setConflictModalOpen(false);
    setSaveFeedback(`Authoritative server version v${serverConflictSub.version} loaded.`);
    setTimeout(() => setSaveFeedback(null), 4000);
  };

  const handleOverwriteConflict = async () => {
    if (!serverConflictSub) return;
    try {
      await performSave('FORCE_OVERWRITE', serverConflictSub.version);
      setConflictModalOpen(false);
      setSaveFeedback(`Server overwritten with your changes (bumped to v${serverConflictSub.version + 1}).`);
      setTimeout(() => setSaveFeedback(null), 4000);
    } catch (err: any) {
      setSaveError(err.message);
    }
  };

  const handleMergeConflict = async () => {
    if (!serverConflictSub) return;
    try {
      const mergedVals: Record<string, string | number> = { ...(serverConflictSub.values || {}) };
      for (const item of metadata.ReturnItemsList) {
        const choice = mergeFieldDecisions[item.Code] || 'LOCAL';
        if (choice === 'LOCAL') {
          mergedVals[item.Code] = values[item.Code] ?? '';
        } else {
          mergedVals[item.Code] = serverConflictSub.values?.[item.Code] ?? '';
        }
      }
      const calculated = recalculateAndValidate(mergedVals, dynamicRowsRef.current);
      setValues(calculated);
      valuesRef.current = calculated;
      await performSave('FORCE_OVERWRITE', serverConflictSub.version);
      setConflictModalOpen(false);
      setSaveFeedback('Merged return draft saved to server SSOT.');
      setTimeout(() => setSaveFeedback(null), 4000);
    } catch (err: any) {
      setSaveError(err.message);
    }
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
                className={`inline-flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-0.5 rounded-full border shrink-0 transition-all ${
                  saveStatus === 'SAVED'
                    ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                    : saveStatus === 'SAVING'
                    ? 'border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold'
                    : saveStatus === 'UNSAVED'
                    ? 'border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400'
                    : saveStatus === 'CONFLICT'
                    ? 'border-rose-400 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200 font-bold animate-pulse'
                    : 'border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400'
                }`}
                title="Authoritative Single Source of Truth (SSOT) persistence status"
              >
                {saveStatus === 'SAVING' ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin text-amber-600 dark:text-amber-400" />
                    <span>Saving to Server…</span>
                  </>
                ) : saveStatus === 'SAVED' ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    <span>{lastSavedTime ? `Saved at ${lastSavedTime}` : 'Saved just now'}</span>
                  </>
                ) : saveStatus === 'UNSAVED' ? (
                  <>
                    <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                    <span>Unsaved changes</span>
                  </>
                ) : saveStatus === 'CONFLICT' ? (
                  <>
                    <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                    <span>Conflict detected —</span>
                    <button
                      type="button"
                      onClick={() => setConflictModalOpen(true)}
                      className="underline font-bold text-rose-800 dark:text-rose-200 hover:text-rose-950 cursor-pointer ml-0.5"
                    >
                      Resolve
                    </button>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                    <span>Save failed —</span>
                    <button
                      type="button"
                      onClick={() => performSave('RETRY').catch(() => {})}
                      className="underline font-bold text-rose-800 dark:text-rose-200 hover:text-rose-950 cursor-pointer ml-0.5"
                    >
                      Retry
                    </button>
                  </>
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

          {/* Phase 24: Unified Validation & Remediation Assistant Trigger */}
          <button
            type="button"
            onClick={() => setAssistantOpen(true)}
            className={`min-h-[44px] sm:min-h-[34px] flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl sm:rounded-lg border transition-colors shadow-2xs cursor-pointer touch-manipulation touch-press ${
              remediationSummary && !remediationSummary.isSubmissionReady
                ? 'bg-rose-50 dark:bg-rose-950/80 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 hover:bg-rose-100'
                : remediationSummary && remediationSummary.warningsCount > 0
                ? 'bg-amber-50 dark:bg-amber-950/80 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200 hover:bg-amber-100'
                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100'
            }`}
            title="Open Unified Validation & Remediation Assistant (NBE BSD/03/2020)"
          >
            <Wand2 className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-ob-indigo-600 dark:text-ob-indigo-400" />
            <span className="hidden sm:inline">Remediation Assistant</span>
            <span className="sm:hidden">Assistant</span>
            {remediationSummary && (
              <span
                className={`px-1.5 py-0.2 text-[10px] font-bold rounded-full font-mono ${
                  remediationSummary.blockingErrorsCount > 0
                    ? 'bg-rose-600 text-white'
                    : remediationSummary.warningsCount > 0
                    ? 'bg-amber-500 text-white'
                    : 'bg-emerald-600 text-white'
                }`}
              >
                {remediationSummary.blockingErrorsCount > 0
                  ? remediationSummary.blockingErrorsCount
                  : remediationSummary.warningsCount > 0
                  ? `${remediationSummary.warningsCount}w`
                  : '✓'}
              </span>
            )}
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
                disabled={isAutoSaving}
                className={`min-h-[44px] sm:min-h-[34px] flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl sm:rounded-lg transition-colors cursor-pointer touch-manipulation touch-press ${
                  hasUnsavedChanges
                    ? 'bg-slate-900 dark:bg-ob-indigo-600 text-white hover:bg-slate-800 dark:hover:bg-ob-indigo-700 shadow-2xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
                title={`Save Changes (${modKey}+S)`}
              >
                {isAutoSaving ? (
                  <Loader2 className="w-4 h-4 sm:w-3 sm:h-3 animate-spin text-ob-indigo-400" />
                ) : (
                  <Save className="w-4 h-4 sm:w-3 sm:h-3" />
                )}
                <span>{isAutoSaving ? 'Saving…' : hasUnsavedChanges ? 'Save Changes' : 'Saved'}</span>
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

      {/* Phase 27 Requirement 8: Subordinate Local Recovery Reconciliation Banner */}
      {subordinateRecoveryDraft && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-800 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs text-amber-900 dark:text-amber-200 shadow-xs animate-in fade-in shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <div className="min-w-0">
              <span className="font-bold">Subordinate Local Recovery Draft Detected</span>
              <span className="ml-1 text-[11px] text-amber-700 dark:text-amber-300">
                (Offline edits from {new Date(subordinateRecoveryDraft.offlineSavedAt || subordinateRecoveryDraft.updatedAt).toLocaleTimeString()} • Server is v{submission.version})
              </span>
              <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5 truncate">
                Local offline recovery drafts are subordinate to the backend server. Reconcile to maintain backend as Single Source of Truth (SSOT).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <button
              type="button"
              onClick={handleReconcileLocalRecovery}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs shadow-2xs transition-colors cursor-pointer"
            >
              Reconcile to Server SSOT
            </button>
            <button
              type="button"
              onClick={handleDiscardLocalRecovery}
              className="px-2.5 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs transition-colors cursor-pointer"
            >
              Discard Local Draft
            </button>
          </div>
        </div>
      )}

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
          <span className="font-mono text-slate-500">v{currentVersion}</span>
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
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setAssistantOpen(true)}
                className="px-3 py-1 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-lg text-xs transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>Open Remediation Assistant</span>
              </button>
              <button
                type="button"
                onClick={() => setItemTypeFilter(itemTypeFilter === 'ERRORS_ONLY' ? 'ALL' : 'ERRORS_ONLY')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  itemTypeFilter === 'ERRORS_ONLY'
                    ? 'bg-rose-800 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-slate-700'
                }`}
              >
                {itemTypeFilter === 'ERRORS_ONLY' ? 'Showing Errors Only' : 'Filter to Errors Only'}
              </button>
            </div>
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

                  const isHighlighted = highlightedFieldCode === item.Code;
                  const remediationItem = remediationSummary?.items.find((i) => i.fieldCode === item.Code);

                  return (
                    <tr
                      key={item.Code}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                        isHighlighted
                          ? 'ring-2 ring-amber-500 bg-amber-100/70 dark:bg-amber-950/60 animate-pulse'
                          : hasError
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

                          {/* Real-time field validation error message & inline auto-fix */}
                          {fieldError && (
                            <div
                              id={`error-${item.Code}`}
                              className={`flex flex-col gap-1.5 text-[11px] font-medium p-2 rounded-md border animate-in fade-in duration-150 ${
                                hasError
                                  ? 'bg-rose-50 dark:bg-rose-950/80 border-rose-200 dark:border-rose-900/80 text-rose-700 dark:text-rose-300'
                                  : 'bg-amber-50 dark:bg-amber-950/80 border-amber-200 dark:border-amber-900/80 text-amber-700 dark:text-amber-300'
                              }`}
                            >
                              <div className="flex items-start gap-1.5">
                                <AlertCircle className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${hasError ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`} />
                                <div className="flex flex-col flex-1">
                                  <span>{fieldError.message}</span>
                                  {(fieldError as any).constraintType && (
                                    <span className="text-[9px] uppercase tracking-wider font-mono opacity-80 text-rose-800 dark:text-rose-300">
                                      [Constraint: {(fieldError as any).constraintType.replace('_', ' ')}]
                                    </span>
                                  )}
                                </div>
                              </div>

                              {remediationItem?.autoFixable && !isEffectiveReadOnly && (
                                <div className="flex items-center gap-2 pt-1 border-t border-rose-200/60 dark:border-rose-900/60">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (remediationItem.proposedFix) {
                                        handleApplyFix(remediationItem.proposedFix);
                                      }
                                    }}
                                    disabled={isFixing}
                                    className="px-2 py-0.5 text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded transition-colors flex items-center gap-1 shadow-2xs cursor-pointer disabled:opacity-50"
                                  >
                                    <Wand2 className="w-2.5 h-2.5" />
                                    <span>Auto-Fix ({remediationItem.suggestedAction})</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setAssistantOpen(true)}
                                    className="text-[10px] text-ob-indigo-600 dark:text-ob-indigo-400 hover:underline cursor-pointer"
                                  >
                                    Why this matters →
                                  </button>
                                </div>
                              )}
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

      {/* 8. Phase 24: Unified Validation & Remediation Assistant Drawer */}
      <ValidationRemediationAssistant
        summary={remediationSummary}
        isOpen={assistantOpen}
        onClose={() => setAssistantOpen(false)}
        onNavigateToField={handleNavigateToField}
        onApplyFix={handleApplyFix}
        currentUser={currentUser}
        readOnly={isEffectiveReadOnly}
        isFixing={isFixing}
      />

      {/* Phase 27: Concurrency Conflict Resolution Modal (Requirement 7) */}
      {conflictModalOpen && serverConflictSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border-2 border-rose-300 dark:border-rose-800 rounded-2xl max-w-2xl w-full p-5 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-start gap-3 border-b border-rose-100 dark:border-rose-950 pb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Concurrent Modification Conflict Detected</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 font-bold">
                    HTTP 409
                  </span>
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Another user or process has updated return <strong className="font-mono">{metadata.Code}</strong> on the server while you were editing. Your draft expected <strong>v{currentVersion}</strong>, but the server state is now at <strong>v{serverConflictSub.version}</strong> (last modified by {serverConflictSub.makerName} at {new Date(serverConflictSub.updatedAt).toLocaleTimeString()}).
                </p>
              </div>
            </div>

            {/* Conflicting Fields Diff Table */}
            <div className="flex-1 overflow-y-auto min-h-0 space-y-2 text-xs">
              <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Field Differences Comparison:
              </div>
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-[10px] font-bold font-mono text-slate-600 dark:text-slate-300 uppercase">
                    <tr>
                      <th className="px-3 py-2">Field</th>
                      <th className="px-3 py-2 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300">Your Local Value</th>
                      <th className="px-3 py-2 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300">Server Value (v{serverConflictSub.version})</th>
                      <th className="px-3 py-2 text-center">Merge Choice</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {metadata.ReturnItemsList.filter((item) => {
                      const localV = values[item.Code] ?? '';
                      const serverV = serverConflictSub.values?.[item.Code] ?? '';
                      return String(localV) !== String(serverV);
                    }).length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-4 text-center text-slate-500 italic">
                          No direct return item conflicts found (dynamic schedules or metadata updated).
                        </td>
                      </tr>
                    ) : (
                      metadata.ReturnItemsList.filter((item) => {
                        const localV = values[item.Code] ?? '';
                        const serverV = serverConflictSub.values?.[item.Code] ?? '';
                        return String(localV) !== String(serverV);
                      }).map((item) => {
                        const localV = values[item.Code] ?? '';
                        const serverV = serverConflictSub.values?.[item.Code] ?? '';
                        const choice = mergeFieldDecisions[item.Code] || 'LOCAL';
                        return (
                          <tr key={item.Code} className="hover:bg-slate-50 dark:hover:bg-slate-850">
                            <td className="px-3 py-2 font-mono">
                              <span className="font-bold text-slate-900 dark:text-white">{item.Code}</span>
                              <div className="text-[10px] text-slate-500 truncate max-w-[150px]">{item._description}</div>
                            </td>
                            <td className="px-3 py-2 font-mono bg-amber-50/60 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200">
                              {String(localV) || '—'}
                            </td>
                            <td className="px-3 py-2 font-mono bg-blue-50/60 dark:bg-blue-950/20 text-blue-900 dark:text-blue-200">
                              {String(serverV) || '—'}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 text-[10px]">
                                <button
                                  type="button"
                                  onClick={() => setMergeFieldDecisions((prev) => ({ ...prev, [item.Code]: 'LOCAL' }))}
                                  className={`px-2 py-0.5 rounded font-bold transition-colors cursor-pointer ${
                                    choice === 'LOCAL' ? 'bg-amber-600 text-white shadow-2xs' : 'text-slate-600 dark:text-slate-400'
                                  }`}
                                >
                                  Mine
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setMergeFieldDecisions((prev) => ({ ...prev, [item.Code]: 'SERVER' }))}
                                  className={`px-2 py-0.5 rounded font-bold transition-colors cursor-pointer ${
                                    choice === 'SERVER' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 dark:text-slate-400'
                                  }`}
                                >
                                  Server
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Resolution Action Paths */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2.5">
              <span className="text-[11px] text-slate-500">Choose conflict resolution path:</span>
              <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={handleAcceptServerConflict}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                  title="Discard local unsaved changes and load the latest authoritative server version"
                >
                  Discard Mine & Load Server (v{serverConflictSub.version})
                </button>
                <button
                  type="button"
                  onClick={handleMergeConflict}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-ob-indigo-600 hover:bg-ob-indigo-700 rounded-lg transition-colors shadow-2xs cursor-pointer"
                  title="Apply field-level choices and save merged result"
                >
                  Merge & Save
                </button>
                <button
                  type="button"
                  onClick={handleOverwriteConflict}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-2xs cursor-pointer"
                  title="Force overwrite server with all your local changes (bumping to v{serverConflictSub.version + 1})"
                >
                  Overwrite Server (Keep All Mine)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Phase 27: Leave-Page Safety Modal (Requirement 5) */}
      {leaveSafetyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border-2 border-amber-300 dark:border-amber-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Unsaved Regulatory Return Changes
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Your pending changes for return <strong className="font-mono">{metadata.Code}</strong> could not be persisted to the server:
                </p>
                {leaveSafetyError && (
                  <div className="mt-2 p-2 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-[11px] font-mono break-words">
                    {leaveSafetyError}
                  </div>
                )}
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                  If you leave without saving, newly entered report data will be discarded.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setLeaveSafetyModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                Stay on Page
              </button>
              <button
                type="button"
                onClick={() => {
                  setLeaveSafetyModalOpen(false);
                  onBack();
                }}
                className="px-3.5 py-1.5 text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950 hover:bg-rose-100 dark:hover:bg-rose-900 border border-rose-300 dark:border-rose-800 rounded-lg transition-colors cursor-pointer"
              >
                Discard & Leave
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await performSave('FLUSH');
                    setLeaveSafetyModalOpen(false);
                    onBack();
                  } catch (err: any) {
                    setLeaveSafetyError(err.message || 'Retry failed');
                  }
                }}
                className="px-4 py-1.5 text-xs font-bold text-white bg-ob-indigo-600 hover:bg-ob-indigo-700 rounded-lg transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Save</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
