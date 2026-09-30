/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Layers,
  Settings,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ArrowUp,
  ArrowDown,
  Eye,
  Send,
  Save,
  Clock,
  RotateCw,
  FolderTree,
  Building2,
  ShieldAlert,
  Info,
  ChevronRight,
  ChevronDown,
  Calendar,
  Sparkles,
  Columns,
  Table as TableIcon,
  Calculator,
  Binary,
} from 'lucide-react';
import {
  configService,
  ReportDefinitionSSOT,
  ReportVersionSSOT,
  ReportFieldSSOT,
  ReportColumnSSOT,
  ReportSectionSSOT,
  VersionStatus,
  FieldDataType,
  ReportFrequency,
} from '../services/configService.ts';
import { DepartmentDefinition } from '../data/organizationHierarchy.ts';
import { departmentService } from '../services/departmentService.ts';
import { UserSession, ReportMetadata } from '../types/regulatory.ts';
import { vibrate } from '../utils/haptics.ts';

interface ReportTemplateStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportKey?: string; // If empty, studio starts in "New Report Template" mode
  currentUser: UserSession;
  onSuccess: (message: string) => void;
}

type StudioTab =
  | 'METADATA'
  | 'SECTIONS'
  | 'FIELDS'
  | 'COLUMNS'
  | 'FORMULAS'
  | 'VALIDATION'
  | 'PREVIEW'
  | 'PUBLISH';

export const ReportTemplateStudioModal: React.FC<ReportTemplateStudioModalProps> = ({
  isOpen,
  onClose,
  reportKey: initialReportKey,
  currentUser,
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<StudioTab>('METADATA');
  const [departments, setDepartments] = useState<DepartmentDefinition[]>(() => departmentService.getAll());

  // Editing Report Identity & Current Version
  const [report, setReport] = useState<ReportDefinitionSSOT | null>(null);
  const [versions, setVersions] = useState<ReportVersionSSOT[]>([]);
  const [selectedVersionNumber, setSelectedVersionNumber] = useState<number>(1);
  const [workingVersion, setWorkingVersion] = useState<ReportVersionSSOT | null>(null);

  // Form State for Metadata
  const [metaForm, setMetaForm] = useState<{
    returnKey: string;
    code: string;
    name: string;
    description: string;
    category: string;
    frequency: ReportFrequency;
    defaultDepartmentId: string;
    selectedDepartmentIds: string[];
    instCode: string;
    finYear: number;
    nbeReturnKey: string;
  }>({
    returnKey: '',
    code: '',
    name: '',
    description: '',
    category: 'Credit & Lending',
    frequency: 'MONTHLY',
    defaultDepartmentId: 'dept_credit_ops',
    selectedDepartmentIds: ['dept_credit_ops'],
    instCode: '0000013',
    finYear: 2026,
    nbeReturnKey: '',
  });

  // Working Version In-Memory Schema
  const [fields, setFields] = useState<ReportFieldSSOT[]>([]);
  const [columns, setColumns] = useState<ReportColumnSSOT[]>([]);
  const [sections, setSections] = useState<ReportSectionSSOT[]>([]);
  const [formulas, setFormulas] = useState<any[]>([]);
  const [changelogSummary, setChangelogSummary] = useState<string>('');

  // Modals / Item Sub-Editors
  const [editingField, setEditingField] = useState<ReportFieldSSOT | null>(null);
  const [isFieldEditorOpen, setIsFieldEditorOpen] = useState(false);
  const [editingColumn, setEditingColumn] = useState<ReportColumnSSOT | null>(null);
  const [isColumnEditorOpen, setIsColumnEditorOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<ReportSectionSSOT | null>(null);
  const [isSectionEditorOpen, setIsSectionEditorOpen] = useState(false);
  const [editingFormula, setEditingFormula] = useState<{ targetCode: string; expression: string; description: string; dependencies: string[] } | null>(null);
  const [isFormulaEditorOpen, setIsFormulaEditorOpen] = useState(false);

  // Validation State
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    errors: string[];
    warnings: string[];
    summary: { fieldCount: number; columnCount: number; formulaCount: number; sectionCount: number };
  } | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // Preview Metadata
  const [previewMetadata, setPreviewMetadata] = useState<ReportMetadata | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setDepartments(departmentService.getAll());

    if (initialReportKey) {
      const rep = configService.getReportDefinition(initialReportKey);
      if (rep) {
        setReport(rep);
        const vers = configService.getReportVersions(initialReportKey);
        setVersions(vers);

        // Find existing draft version or the latest active version
        const draftVer = vers.find((v) => v.status === 'DRAFT' || v.status === 'VALIDATED' || v.status === 'PREVIEW');
        const activeVer = rep.activeVersionSnapshot || vers[vers.length - 1];
        const targetVer = draftVer || activeVer;

        if (targetVer) {
          setSelectedVersionNumber(targetVer.versionNumber);
          setWorkingVersion(JSON.parse(JSON.stringify(targetVer)));
          setFields(JSON.parse(JSON.stringify(targetVer.fields || [])));
          setColumns(JSON.parse(JSON.stringify(targetVer.columns || [])));
          setSections(JSON.parse(JSON.stringify(targetVer.sections || [])));
          setFormulas(JSON.parse(JSON.stringify(targetVer.formulas || [])));
          setChangelogSummary(targetVer.changelogSummary || '');
        }

        setMetaForm({
          returnKey: rep.returnKey,
          code: rep.code,
          name: rep.name,
          description: rep.description,
          category: rep.category,
          frequency: rep.frequency,
          defaultDepartmentId: rep.defaultDepartmentId,
          selectedDepartmentIds: rep.departmentIds || [rep.defaultDepartmentId],
          instCode: rep.instCode || '0000013',
          finYear: rep.finYear || 2026,
          nbeReturnKey: rep.nbeMapping?.returnKey || rep.returnKey,
        });
      }
    } else {
      // New Report Template Mode
      setReport(null);
      setVersions([]);
      setSelectedVersionNumber(1);
      setWorkingVersion(null);
      const defaultKey = 'CUSTOM_RETURN_' + Math.floor(100 + Math.random() * 900);
      setMetaForm({
        returnKey: defaultKey,
        code: defaultKey,
        name: 'New Regulatory Return Template',
        description: 'Bank regulatory return defined in accordance with National Bank of Ethiopia directives.',
        category: 'Credit & Lending',
        frequency: 'MONTHLY',
        defaultDepartmentId: 'dept_credit_ops',
        selectedDepartmentIds: ['dept_credit_ops'],
        instCode: '0000013',
        finYear: 2026,
        nbeReturnKey: defaultKey,
      });

      const initialFields: ReportFieldSSOT[] = [
        {
          id: `fld_${defaultKey}_00001`,
          itemId: '00001',
          itemCode: `${defaultKey}_00001`,
          itemDescription: 'Total Principal Balance / Outstanding Loan Value',
          dataType: 'NUMERIC',
          isRequired: true,
          isCalculated: false,
          validationRules: [],
          order: 1,
        },
        {
          id: `fld_${defaultKey}_00002`,
          itemId: '00002',
          itemCode: `${defaultKey}_00002`,
          itemDescription: 'Statutory Provision Rate (0.01 = 1%)',
          dataType: 'PERCENTAGE',
          isRequired: false,
          isCalculated: false,
          validationRules: [],
          order: 2,
        },
        {
          id: `fld_${defaultKey}_00003`,
          itemId: '00003',
          itemCode: `${defaultKey}_00003`,
          itemDescription: 'Calculated Required Statutory Provision',
          dataType: 'NUMERIC',
          isRequired: false,
          isCalculated: true,
          formulaExpression: `${defaultKey}_00001 * ${defaultKey}_00002`,
          validationRules: [],
          order: 3,
        },
      ];

      setFields(initialFields);
      setColumns([
        {
          id: `col_${defaultKey}_borrower`,
          columnKey: 'BORROWER_NAME',
          headerLabel: 'Borrower Legal / Business Name',
          dataType: 'STRING',
          isRequired: true,
          order: 1,
          width: '240px',
        },
        {
          id: `col_${defaultKey}_amount`,
          columnKey: 'FACILITY_AMOUNT',
          headerLabel: 'Approved Facility Limit (ETB)',
          dataType: 'NUMERIC',
          isRequired: true,
          order: 2,
          width: '160px',
        },
      ]);
      setSections([
        {
          id: `sec_${defaultKey}_main`,
          code: 'MAIN',
          title: 'Core Prudential Balances & Provisions',
          order: 1,
          description: 'Statutory balance items and required provisioning',
          isRepeating: false,
        },
      ]);
      setFormulas([
        {
          targetCode: `${defaultKey}_00003`,
          expression: `${defaultKey}_00001 * ${defaultKey}_00002`,
          description: 'Calculated Required Provision = Balance * Rate',
          dependencies: [`${defaultKey}_00001`, `${defaultKey}_00002`],
        },
      ]);
      setChangelogSummary('Initial template creation in Dynamic Template Studio');
    }
    setActiveTab('METADATA');
    setValidationResult(null);
  }, [isOpen, initialReportKey]);

  if (!isOpen) return null;

  // -------------------------------------------------------------------------
  // Handlers for Sections, Fields, Columns, and Formulas
  // -------------------------------------------------------------------------

  const handleAddField = () => {
    const nextIdx = fields.length + 1;
    const baseKey = metaForm.returnKey || 'RET';
    const code = `${baseKey}_${String(nextIdx).padStart(5, '0')}`;
    setEditingField({
      id: `fld_${baseKey}_${Date.now()}`,
      itemId: String(nextIdx).padStart(5, '0'),
      itemCode: code,
      itemDescription: 'New Report Balance Field',
      dataType: 'NUMERIC',
      isRequired: true,
      isCalculated: false,
      validationRules: [],
      order: nextIdx,
    });
    setIsFieldEditorOpen(true);
  };

  const handleSaveField = (f: ReportFieldSSOT) => {
    const exists = fields.some((item) => item.id === f.id);
    let next: ReportFieldSSOT[];
    if (exists) {
      next = fields.map((item) => (item.id === f.id ? f : item));
    } else {
      next = [...fields, { ...f, order: fields.length + 1 }];
    }
    setFields(next);
    setIsFieldEditorOpen(false);
    setEditingField(null);
    vibrate(20);
  };

  const handleRemoveField = (id: string) => {
    setFields(fields.filter((f) => f.id !== id));
    vibrate(30);
  };

  const handleMoveField = (index: number, direction: 'UP' | 'DOWN') => {
    if ((direction === 'UP' && index === 0) || (direction === 'DOWN' && index === fields.length - 1)) return;
    const targetIdx = direction === 'UP' ? index - 1 : index + 1;
    const next = [...fields];
    const temp = next[index];
    next[index] = next[targetIdx];
    next[targetIdx] = temp;
    next.forEach((f, idx) => (f.order = idx + 1));
    setFields(next);
  };

  const handleAddColumn = () => {
    const nextIdx = columns.length + 1;
    setEditingColumn({
      id: `col_${Date.now()}`,
      columnKey: `COLUMN_${nextIdx}`,
      headerLabel: `Schedule Column ${nextIdx}`,
      dataType: 'STRING',
      isRequired: true,
      order: nextIdx,
      width: '180px',
    });
    setIsColumnEditorOpen(true);
  };

  const handleSaveColumn = (c: ReportColumnSSOT) => {
    const exists = columns.some((col) => col.id === c.id);
    let next: ReportColumnSSOT[];
    if (exists) {
      next = columns.map((col) => (col.id === c.id ? c : col));
    } else {
      next = [...columns, { ...c, order: columns.length + 1 }];
    }
    setColumns(next);
    setIsColumnEditorOpen(false);
    setEditingColumn(null);
    vibrate(20);
  };

  const handleRemoveColumn = (id: string) => {
    setColumns(columns.filter((c) => c.id !== id));
    vibrate(30);
  };

  const handleAddSection = () => {
    const nextIdx = sections.length + 1;
    setEditingSection({
      id: `sec_${Date.now()}`,
      code: `SEC_${nextIdx}`,
      title: `Section ${nextIdx}`,
      order: nextIdx,
      description: '',
      isRepeating: false,
    });
    setIsSectionEditorOpen(true);
  };

  const handleSaveSection = (s: ReportSectionSSOT) => {
    const exists = sections.some((sec) => sec.id === s.id);
    let next: ReportSectionSSOT[];
    if (exists) {
      next = sections.map((sec) => (sec.id === s.id ? s : sec));
    } else {
      next = [...sections, { ...s, order: sections.length + 1 }];
    }
    setSections(next);
    setIsSectionEditorOpen(false);
    setEditingSection(null);
    vibrate(20);
  };

  const handleRemoveSection = (id: string) => {
    setSections(sections.filter((s) => s.id !== id));
    vibrate(30);
  };

  const handleAddFormula = () => {
    setEditingFormula({
      targetCode: fields.find((f) => f.isCalculated)?.itemCode || fields[fields.length - 1]?.itemCode || '',
      expression: '',
      description: 'Calculated Field Formula',
      dependencies: [],
    });
    setIsFormulaEditorOpen(true);
  };

  const handleSaveFormula = (form: { targetCode: string; expression: string; description: string; dependencies: string[] }) => {
    const exists = formulas.some((f) => (f.targetCode || f.code) === form.targetCode);
    let next: any[];
    if (exists) {
      next = formulas.map((f) => ((f.targetCode || f.code) === form.targetCode ? form : f));
    } else {
      next = [...formulas, form];
    }
    setFormulas(next);
    // Mark target field as isCalculated in fields list
    setFields(
      fields.map((f) =>
        f.itemCode === form.targetCode ? { ...f, isCalculated: true, formulaExpression: form.expression } : f
      )
    );
    setIsFormulaEditorOpen(false);
    setEditingFormula(null);
    vibrate(20);
  };

  const handleRemoveFormula = (targetCode: string) => {
    setFormulas(formulas.filter((f) => (f.targetCode || f.code) !== targetCode));
    setFields(
      fields.map((f) => (f.itemCode === targetCode ? { ...f, isCalculated: false, formulaExpression: undefined } : f))
    );
    vibrate(30);
  };

  // -------------------------------------------------------------------------
  // Lifecycle Actions: Validate, Preview, Save Draft, Publish, Retire
  // -------------------------------------------------------------------------

  const handleRunValidation = () => {
    setIsValidating(true);
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!metaForm.returnKey.trim()) errors.push('ReturnKey is required.');
    if (!metaForm.name.trim()) errors.push('Report Title is required.');
    if (!fields || fields.length === 0) errors.push('At least one field is required.');

    const fieldCodes = new Set<string>();
    fields.forEach((f, idx) => {
      if (!f.itemCode.trim()) errors.push(`Field #${idx + 1} has an empty code.`);
      const codeUpper = f.itemCode.trim().toUpperCase();
      if (fieldCodes.has(codeUpper)) errors.push(`Duplicate field code '${f.itemCode}'.`);
      fieldCodes.add(codeUpper);
    });

    const colKeys = new Set<string>();
    columns.forEach((c, idx) => {
      if (!c.columnKey.trim()) errors.push(`Column #${idx + 1} has an empty key.`);
      const colUpper = c.columnKey.trim().toUpperCase();
      if (colKeys.has(colUpper)) errors.push(`Duplicate column key '${c.columnKey}'.`);
      colKeys.add(colUpper);
    });

    // Formula dependencies & cycle detection
    const formulaTargets = new Set<string>();
    const graph: Record<string, string[]> = {};

    formulas.forEach((form, idx) => {
      const target = (form.targetCode || form.code || '').trim().toUpperCase();
      if (!target) errors.push(`Formula #${idx + 1} has empty target.`);
      if (!fieldCodes.has(target)) errors.push(`Formula target '${target}' is not in fields.`);
      if (formulaTargets.has(target)) errors.push(`Multiple formulas target '${target}'.`);
      formulaTargets.add(target);

      const deps: string[] = form.dependencies || [];
      deps.forEach((d) => {
        if (!fieldCodes.has(d.trim().toUpperCase())) {
          errors.push(`Formula target '${target}' references unknown field '${d}'.`);
        }
      });
      graph[target] = deps.map((d) => d.trim().toUpperCase());
    });

    // Cycle detection DFS
    const visited = new Set<string>();
    const inStack = new Set<string>();
    function dfsCycle(node: string, path: string[]): boolean {
      visited.add(node);
      inStack.add(node);
      path.push(node);
      for (const neighbor of graph[node] || []) {
        if (!visited.has(neighbor)) {
          if (dfsCycle(neighbor, path)) return true;
        } else if (inStack.has(neighbor)) {
          path.push(neighbor);
          return true;
        }
      }
      inStack.delete(node);
      path.pop();
      return false;
    }

    for (const node of Object.keys(graph)) {
      if (!visited.has(node)) {
        const cyclePath: string[] = [];
        if (dfsCycle(node, cyclePath)) {
          errors.push(`Circular formula calculation dependency detected: ${cyclePath.join(' -> ')}.`);
          break;
        }
      }
    }

    const valid = errors.length === 0;
    setValidationResult({
      valid,
      errors,
      warnings,
      summary: {
        fieldCount: fields.length,
        columnCount: columns.length,
        formulaCount: formulas.length,
        sectionCount: sections.length,
      },
    });
    setIsValidating(false);
    vibrate(valid ? 20 : [40, 40, 40]);
    return valid;
  };

  const handleGeneratePreview = () => {
    const valid = handleRunValidation();
    const primaryDept = departments.find((d) => d.id === metaForm.defaultDepartmentId)?.name || 'Credit Operations & Portfolio Management';
    const mockDef: ReportDefinitionSSOT = {
      id: `rep_${metaForm.returnKey}`,
      returnKey: metaForm.returnKey,
      code: metaForm.code || metaForm.returnKey,
      name: metaForm.name,
      description: metaForm.description,
      category: metaForm.category,
      frequency: metaForm.frequency,
      status: 'DRAFT',
      instCode: metaForm.instCode,
      finYear: metaForm.finYear,
      defaultDepartmentId: metaForm.defaultDepartmentId,
      departmentIds: metaForm.selectedDepartmentIds,
      currentVersion: selectedVersionNumber,
      effectiveFrom: new Date().toISOString(),
      effectiveTo: null,
      nbeMapping: { returnKey: metaForm.nbeReturnKey || metaForm.returnKey },
      displayConfiguration: { layout: 'STANDARD' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const mockVer: ReportVersionSSOT = {
      versionId: `ver_${metaForm.returnKey}_v${selectedVersionNumber}`,
      reportKey: metaForm.returnKey,
      versionNumber: selectedVersionNumber,
      status: valid ? 'VALIDATED' : 'DRAFT',
      effectiveFrom: new Date().toISOString(),
      effectiveTo: null,
      changelogSummary,
      changeDiff: [],
      createdBy: currentUser.name,
      createdAt: new Date().toISOString(),
      sections,
      fields,
      columns,
      rows: [],
      formulas,
      validationRules: [],
      schemaSnapshot: {
        itemCount: fields.length,
        dynamicAreaCount: columns.length,
        formulaCount: formulas.length,
        validationRuleCount: 0,
        ReturnItemsList: [],
        DynamicItemsList: [],
      },
    };

    const preview = configService.previewReportVersion
      ? configService.previewReportVersion(report?.returnKey || metaForm.returnKey, selectedVersionNumber).previewMetadata
      : null;

    // Use our inline converter as reliable preview
    setPreviewMetadata({
      ReturnKey: metaForm.returnKey,
      Code: metaForm.code || metaForm.returnKey,
      Title: metaForm.name,
      Category: metaForm.category as any,
      department: primaryDept,
      departments: metaForm.selectedDepartmentIds.map((id) => departments.find((d) => d.id === id)?.name || id),
      Frequency: metaForm.frequency === 'ON_DEMAND' ? 'MONTHLY' : (metaForm.frequency as any),
      InstCode: metaForm.instCode,
      FinYear: metaForm.finYear,
      StartDate: `${metaForm.finYear}-01-01T00:00:00`,
      EndDate: `${metaForm.finYear}-12-31T00:00:00`,
      Description: metaForm.description,
      ReturnItemsList: fields.map((f) => ({
        Code: f.itemCode,
        Value: f.defaultValue ?? '',
        _description: f.itemDescription || f.itemCode,
        _dataType: (f.dataType === 'STRING' ? 'TEXT' : f.dataType === 'DATE' ? 'DATE' : 'NUMERIC') as any,
        _required: f.isRequired,
        section: f.sectionTitle || f.sectionId,
        isTotal: f.isCalculated,
      })),
      DynamicItemsList: columns.length > 0 ? [
        {
          Area: 1,
          _areaName: 'Schedule Breakdown Table',
          DynamicItems: columns.map((c) => ({
            Code: c.columnKey,
            Value: c.defaultValue ?? '',
            _description: c.headerLabel,
            _dataType: (c.dataType === 'TEXT' ? 'TEXT' : c.dataType === 'DATE' ? 'DATE' : 'NUMERIC') as any,
            _required: c.isRequired,
          })),
        },
      ] : [],
      Formulas: formulas.map((f) => ({
        targetCode: f.targetCode || f.code,
        expression: f.expression,
        description: f.description || `Calculation for ${f.targetCode || f.code}`,
        dependencies: f.dependencies || [],
      })),
      ValidationRules: [],
      SourceFilename: `${metaForm.returnKey}.json`,
      SourceHash: `preview-${Date.now()}`,
      isCustom: true,
    });

    setActiveTab('PREVIEW');
  };

  const handleSaveDraft = async () => {
    try {
      const actor = { id: currentUser.id, name: currentUser.name, role: currentUser.role };
      if (!report) {
        // Create new report definition in DRAFT status
        const created = configService.createReportDefinition(
          {
            returnKey: metaForm.returnKey.trim().toUpperCase(),
            code: metaForm.code || metaForm.returnKey,
            name: metaForm.name.trim(),
            description: metaForm.description,
            category: metaForm.category,
            frequency: metaForm.frequency,
            status: 'DRAFT',
            instCode: metaForm.instCode,
            finYear: metaForm.finYear,
            defaultDepartmentId: metaForm.defaultDepartmentId,
            departmentIds: metaForm.selectedDepartmentIds,
            sections,
            fields,
            columns,
            formulas,
            initialStatus: 'DRAFT',
            changelogSummary: changelogSummary || 'Initial draft version created in Template Studio',
          },
          actor
        );
        setReport(created.report);
        setWorkingVersion(created.version);
        onSuccess(`Draft report definition '${created.report.name}' saved.`);
      } else {
        // Update metadata & update/create draft version
        configService.updateReportDefinition(
          report.returnKey,
          {
            name: metaForm.name,
            code: metaForm.code,
            description: metaForm.description,
            category: metaForm.category,
            frequency: metaForm.frequency,
            defaultDepartmentId: metaForm.defaultDepartmentId,
            departmentIds: metaForm.selectedDepartmentIds,
          },
          actor
        );

        let draftVer = versions.find((v) => v.status === 'DRAFT' || v.status === 'VALIDATED' || v.status === 'PREVIEW');
        if (!draftVer) {
          draftVer = configService.createDraftVersion(
            report.returnKey,
            {
              changelogSummary: changelogSummary || 'New working draft revision',
              sections,
              fields,
              columns,
              formulas,
            },
            actor
          );
        } else {
          draftVer = configService.updateDraftVersion(
            report.returnKey,
            draftVer.versionNumber,
            {
              changelogSummary,
              sections,
              fields,
              columns,
              formulas,
            },
            actor
          );
        }
        setWorkingVersion(draftVer);
        setVersions(configService.getReportVersions(report.returnKey));
        onSuccess(`Draft Version ${draftVer.versionNumber} updated successfully.`);
      }
      vibrate(20);
    } catch (err: any) {
      alert(`Save Draft Failed: ${err.message}`);
    }
  };

  const handlePublishVersion = async () => {
    const valid = handleRunValidation();
    if (!valid) {
      alert('Cannot publish version: Please resolve the structural validation errors first.');
      setActiveTab('VALIDATION');
      return;
    }

    if (!changelogSummary.trim()) {
      alert('A changelog summary is mandatory when publishing a report version for NBE regulatory auditing.');
      setActiveTab('PUBLISH');
      return;
    }

    setIsPublishing(true);
    try {
      const actor = { id: currentUser.id, name: currentUser.name, role: currentUser.role };
      let publishedVer: ReportVersionSSOT;

      if (!report) {
        // Create as published directly
        const created = configService.createReportDefinition(
          {
            returnKey: metaForm.returnKey.trim().toUpperCase(),
            code: metaForm.code || metaForm.returnKey,
            name: metaForm.name.trim(),
            description: metaForm.description,
            category: metaForm.category,
            frequency: metaForm.frequency,
            status: 'ACTIVE',
            instCode: metaForm.instCode,
            finYear: metaForm.finYear,
            defaultDepartmentId: metaForm.defaultDepartmentId,
            departmentIds: metaForm.selectedDepartmentIds,
            sections,
            fields,
            columns,
            formulas,
            initialStatus: 'ACTIVE',
            changelogSummary: changelogSummary.trim(),
          },
          actor
        );
        publishedVer = created.version;
        setReport(created.report);
      } else {
        // Save current metadata first
        configService.updateReportDefinition(
          report.returnKey,
          {
            name: metaForm.name,
            code: metaForm.code,
            description: metaForm.description,
            category: metaForm.category,
            frequency: metaForm.frequency,
            defaultDepartmentId: metaForm.defaultDepartmentId,
            departmentIds: metaForm.selectedDepartmentIds,
          },
          actor
        );

        // Find or create version to publish
        let targetVer = versions.find((v) => v.status === 'DRAFT' || v.status === 'VALIDATED' || v.status === 'PREVIEW');
        if (!targetVer) {
          targetVer = configService.createDraftVersion(
            report.returnKey,
            {
              changelogSummary,
              sections,
              fields,
              columns,
              formulas,
            },
            actor
          );
        } else {
          configService.updateDraftVersion(
            report.returnKey,
            targetVer.versionNumber,
            {
              changelogSummary,
              sections,
              fields,
              columns,
              formulas,
            },
            actor
          );
        }

        publishedVer = configService.publishReportVersion(
          report.returnKey,
          targetVer.versionNumber,
          actor,
          changelogSummary.trim()
        );
      }

      onSuccess(`Version ${publishedVer.versionNumber} of '${metaForm.name}' published successfully! New drafts will consume this schema; historical submissions remain permanently preserved.`);
      vibrate([20, 30, 20]);
      onClose();
    } catch (err: any) {
      alert(`Publish Failed: ${err.message}`);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleRetireReport = () => {
    if (!report) return;
    if (!confirm(`Are you sure you want to decommission and retire '${report.name}'? This will mark the return as RETIRED while preserving all historical submissions.`)) {
      return;
    }
    const actor = { id: currentUser.id, name: currentUser.name, role: currentUser.role };
    configService.retireReport(report.returnKey, actor, 'Administrator retired report return via Template Studio');
    onSuccess(`Report '${report.name}' (${report.returnKey}) retired.`);
    vibrate(30);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 dark:bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-hidden">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-5xl h-[92vh] max-h-[900px] border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-in fade-in">
        {/* Studio Top Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-ob-green-500/10 text-ob-green-600 dark:text-ob-green-400 border border-ob-green-500/20 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  {report ? `Configure Structure: ${report.name}` : 'New Report Definition & Template Studio'}
                </h2>
                <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-ob-indigo-50 dark:bg-ob-indigo-950 text-ob-indigo-700 dark:text-ob-indigo-300 border border-ob-indigo-200 dark:border-ob-indigo-800">
                  {metaForm.returnKey || 'NEW_RETURN'}
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                  v{selectedVersionNumber} ({workingVersion?.status || 'DRAFT'})
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Authoritative Central Bank metadata definition, mathematical formula engine & non-destructive versioning.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveDraft}
              className="min-h-[38px] px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer touch-press"
            >
              <Save className="w-4 h-4" />
              <span>Save Draft</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Lifecycle Steps Bar */}
        <div className="px-4 py-2 bg-slate-100/70 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs overflow-x-auto shrink-0">
          <div className="flex items-center gap-2 sm:gap-4 shrink-0 font-medium">
            <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400">Lifecycle:</span>
            <div className="flex items-center gap-1.5">
              <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${activeTab === 'METADATA' || activeTab === 'FIELDS' || activeTab === 'COLUMNS' ? 'bg-ob-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                1. Draft Structure
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <button
                type="button"
                onClick={() => {
                  handleRunValidation();
                  setActiveTab('VALIDATION');
                }}
                className={`px-2 py-0.5 rounded-md text-[11px] font-bold cursor-pointer ${activeTab === 'VALIDATION' ? 'bg-ob-indigo-600 text-white' : validationResult?.valid ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}
              >
                2. Validate Rules
              </button>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <button
                type="button"
                onClick={handleGeneratePreview}
                className={`px-2 py-0.5 rounded-md text-[11px] font-bold cursor-pointer ${activeTab === 'PREVIEW' ? 'bg-ob-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}
              >
                3. Live Preview
              </button>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <button
                type="button"
                onClick={() => setActiveTab('PUBLISH')}
                className={`px-2 py-0.5 rounded-md text-[11px] font-bold cursor-pointer ${activeTab === 'PUBLISH' ? 'bg-ob-green-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}
              >
                4. Safe Publish
              </button>
            </div>
          </div>

          {report && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] text-slate-500">Historical Versions:</span>
              <select
                value={selectedVersionNumber}
                onChange={(e) => {
                  const vNum = parseInt(e.target.value, 10);
                  setSelectedVersionNumber(vNum);
                  const ver = versions.find((v) => v.versionNumber === vNum);
                  if (ver) {
                    setWorkingVersion(JSON.parse(JSON.stringify(ver)));
                    setFields(JSON.parse(JSON.stringify(ver.fields || [])));
                    setColumns(JSON.parse(JSON.stringify(ver.columns || [])));
                    setSections(JSON.parse(JSON.stringify(ver.sections || [])));
                    setFormulas(JSON.parse(JSON.stringify(ver.formulas || [])));
                    setChangelogSummary(ver.changelogSummary || '');
                  }
                }}
                className="text-[11px] p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              >
                {versions.map((v) => (
                  <option key={v.versionNumber} value={v.versionNumber}>
                    v{v.versionNumber} [{v.status}]
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 px-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto shrink-0">
          {[
            { id: 'METADATA', label: '1. Identity & NBE Mapping', icon: Settings },
            { id: 'SECTIONS', label: `2. Sections (${sections.length})`, icon: FolderTree },
            { id: 'FIELDS', label: `3. Return Fields (${fields.length})`, icon: Binary },
            { id: 'COLUMNS', label: `4. Schedule Columns (${columns.length})`, icon: Columns },
            { id: 'FORMULAS', label: `5. Formulas & AST (${formulas.length})`, icon: Calculator },
            { id: 'VALIDATION', label: '6. Validation Check', icon: ShieldAlert },
            { id: 'PREVIEW', label: '7. Form Preview', icon: Eye },
            { id: 'PUBLISH', label: '8. Publish Version', icon: Sparkles },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as StudioTab)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap cursor-pointer transition-colors ${
                  isActive
                    ? 'border-ob-indigo-600 text-ob-indigo-600 dark:text-ob-indigo-400 font-bold'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Studio Content Region */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {/* TAB 1: METADATA & NBE MAPPING */}
          {activeTab === 'METADATA' && (
            <div className="max-w-3xl space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Central Bank Return Key *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!report}
                    placeholder="e.g. LIQ_COV_LQ001"
                    value={metaForm.returnKey}
                    onChange={(e) =>
                      setMetaForm({
                        ...metaForm,
                        returnKey: e.target.value.toUpperCase(),
                        code: e.target.value.toUpperCase(),
                        nbeReturnKey: e.target.value.toUpperCase(),
                      })
                    }
                    className="w-full p-2.5 font-mono uppercase bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-ob-indigo-500 disabled:opacity-60"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Immutable statutory identifier registered with the National Bank of Ethiopia.
                  </p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Reporting Frequency *
                  </label>
                  <select
                    value={metaForm.frequency}
                    onChange={(e) => setMetaForm({ ...metaForm, frequency: e.target.value as any })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-ob-indigo-500"
                  >
                    <option value="MONTHLY">Monthly Prudential Return</option>
                    <option value="QUARTERLY">Quarterly Prudential Return</option>
                    <option value="ANNUAL">Annual Statutory Return</option>
                    <option value="ON_DEMAND">On-Demand Examination Return</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Official Report Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Prudential Return on Liquidity Coverage and Reserve Requirements"
                  value={metaForm.name}
                  onChange={(e) => setMetaForm({ ...metaForm, name: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-ob-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Risk Classification Category
                  </label>
                  <select
                    value={metaForm.category}
                    onChange={(e) => setMetaForm({ ...metaForm, category: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none"
                  >
                    <option value="Credit & Lending">Credit & Lending</option>
                    <option value="Classification & Provisioning">Classification & Provisioning</option>
                    <option value="Exposures & Concentration">Exposures & Concentration</option>
                    <option value="Assets & Collateral">Assets & Collateral</option>
                    <option value="Restructuring">Restructuring</option>
                    <option value="Sector Breakdown">Sector Breakdown</option>
                    <option value="Liquidity & Treasury">Liquidity & Treasury</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Primary Owning Department *
                  </label>
                  <select
                    value={metaForm.defaultDepartmentId}
                    onChange={(e) => {
                      const dId = e.target.value;
                      const next = Array.from(new Set([dId, ...metaForm.selectedDepartmentIds]));
                      setMetaForm({ ...metaForm, defaultDepartmentId: dId, selectedDepartmentIds: next });
                    }}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.shortCode})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Responsible / Contributing Department(s)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-50 dark:bg-slate-800/50">
                  {departments.map((d) => {
                    const isChecked = metaForm.selectedDepartmentIds.includes(d.id);
                    return (
                      <label
                        key={d.id}
                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-ob-indigo-50 dark:bg-ob-indigo-950/80 font-bold text-ob-indigo-900 dark:text-ob-indigo-200'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            let next: string[];
                            if (isChecked) {
                              next = metaForm.selectedDepartmentIds.filter((id) => id !== d.id);
                              if (next.length === 0) next = [d.id];
                            } else {
                              next = [...metaForm.selectedDepartmentIds, d.id];
                            }
                            setMetaForm({ ...metaForm, selectedDepartmentIds: next });
                          }}
                          className="rounded text-ob-indigo-600 focus:ring-ob-indigo-500"
                        />
                        <span className="truncate">{d.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Detailed Description & Regulatory Basis
                </label>
                <textarea
                  rows={3}
                  value={metaForm.description}
                  onChange={(e) => setMetaForm({ ...metaForm, description: e.target.value })}
                  placeholder="Provide circular references, supervisory intent and instructions for makers..."
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              {/* Central Bank Gateway Mapping Contract */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50 dark:bg-slate-900/60 space-y-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-ob-indigo-600" />
                  <h4 className="font-bold text-slate-900 dark:text-white">
                    National Bank of Ethiopia Gateway Mapping
                  </h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      NBE ReturnKey
                    </label>
                    <input
                      type="text"
                      value={metaForm.nbeReturnKey}
                      onChange={(e) => setMetaForm({ ...metaForm, nbeReturnKey: e.target.value.toUpperCase() })}
                      className="w-full p-2 font-mono uppercase text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Bank Institution Code
                    </label>
                    <input
                      type="text"
                      disabled
                      value={metaForm.instCode}
                      className="w-full p-2 font-mono text-xs bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 opacity-80"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Financial Year Baseline
                    </label>
                    <input
                      type="number"
                      value={metaForm.finYear}
                      onChange={(e) => setMetaForm({ ...metaForm, finYear: parseInt(e.target.value, 10) || 2026 })}
                      className="w-full p-2 font-mono text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {report && (
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] text-rose-500 font-semibold">
                    Danger Zone: Statutory Decommissioning
                  </span>
                  <button
                    type="button"
                    onClick={handleRetireReport}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/80 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 rounded-xl font-bold cursor-pointer touch-press"
                  >
                    Retire Report Template
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SECTIONS */}
          {activeTab === 'SECTIONS' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Report Sections & Form Hierarchy
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Group fields into structured headings for organized data entry by Makers.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddSection}
                  className="min-h-[36px] px-3 py-1.5 bg-ob-green-600 hover:bg-ob-green-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer touch-press"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Section</span>
                </button>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase text-[10px] font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">Order</th>
                      <th className="py-2.5 px-3">Code</th>
                      <th className="py-2.5 px-3">Section Title</th>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {sections.map((s, idx) => (
                      <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-mono text-slate-400 font-bold">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-ob-indigo-600 dark:text-ob-indigo-400">{s.code}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">{s.title}</td>
                        <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">{s.description || '—'}</td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveSection(s.id)}
                            className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-lg cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: RETURN FIELDS */}
          {activeTab === 'FIELDS' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Fixed Return Items & Exposure Balances ({fields.length})
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Define statutory cells, data types, required constraints, and calculations.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddField}
                  className="min-h-[36px] px-3.5 py-1.5 bg-ob-green-600 hover:bg-ob-green-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer touch-press"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Return Field</span>
                </button>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase text-[10px] font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Field Code</th>
                      <th className="py-2.5 px-3">Label / Description</th>
                      <th className="py-2.5 px-3">Data Type</th>
                      <th className="py-2.5 px-3">Required</th>
                      <th className="py-2.5 px-3">Calculation / Formula</th>
                      <th className="py-2.5 px-3 text-right">Reorder & Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {fields.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-slate-400">
                          No fields defined yet. Click "Add Return Field" above.
                        </td>
                      </tr>
                    ) : (
                      fields.map((f, idx) => (
                        <tr key={f.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 px-3 font-mono text-slate-400 font-bold">{idx + 1}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-ob-indigo-600 dark:text-ob-indigo-400">
                            {f.itemCode}
                          </td>
                          <td className="py-2.5 px-3 max-w-xs truncate font-medium text-slate-900 dark:text-white">
                            {f.itemDescription}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {f.dataType}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            {f.isRequired ? (
                              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                <Check className="w-3 h-3" /> Yes
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400">Optional</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px]">
                            {f.isCalculated ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                                {f.formulaExpression || 'Calculated'}
                              </span>
                            ) : (
                              <span className="text-slate-400">Direct Input</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleMoveField(idx, 'UP')}
                                disabled={idx === 0}
                                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 cursor-pointer"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveField(idx, 'DOWN')}
                                disabled={idx === fields.length - 1}
                                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 cursor-pointer"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingField(f);
                                  setIsFieldEditorOpen(true);
                                }}
                                className="p-1 text-ob-indigo-600 hover:bg-ob-indigo-50 dark:hover:bg-ob-indigo-950 rounded cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveField(f.id)}
                                className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950 rounded cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: SCHEDULE COLUMNS */}
          {activeTab === 'COLUMNS' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Dynamic Schedule Columns ({columns.length})
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Configure repeating schedule breakdown columns (e.g. Borrower Schedule, Collateral Schedule).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddColumn}
                  className="min-h-[36px] px-3.5 py-1.5 bg-ob-green-600 hover:bg-ob-green-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer touch-press"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Schedule Column</span>
                </button>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase text-[10px] font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Column Key</th>
                      <th className="py-2.5 px-3">Header Label</th>
                      <th className="py-2.5 px-3">Data Type</th>
                      <th className="py-2.5 px-3">Width</th>
                      <th className="py-2.5 px-3">Required</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {columns.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-slate-400">
                          No schedule columns. This return operates as a fixed form without repeating schedules.
                        </td>
                      </tr>
                    ) : (
                      columns.map((c, idx) => (
                        <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 px-3 font-mono text-slate-400 font-bold">{idx + 1}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-ob-indigo-600 dark:text-ob-indigo-400">
                            {c.columnKey}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">{c.headerLabel}</td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {c.dataType}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-500">{c.width || 'auto'}</td>
                          <td className="py-2.5 px-3">
                            {c.isRequired ? (
                              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">Yes</span>
                            ) : (
                              <span className="text-[11px] text-slate-400">Optional</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveColumn(c.id)}
                              className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950 rounded cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: FORMULAS */}
          {activeTab === 'FORMULAS' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Mathematical Calculation Rules & AST Engine ({formulas.length})
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Configure automated calculation formulas executed by the regulatory engine.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddFormula}
                  className="min-h-[36px] px-3.5 py-1.5 bg-ob-green-600 hover:bg-ob-green-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer touch-press"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Formula</span>
                </button>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase text-[10px] font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">Target Field</th>
                      <th className="py-2.5 px-3">Mathematical Expression</th>
                      <th className="py-2.5 px-3">Dependencies</th>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {formulas.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-400">
                          No formulas defined. All return cells will require manual input.
                        </td>
                      </tr>
                    ) : (
                      formulas.map((form) => {
                        const target = form.targetCode || form.code;
                        return (
                          <tr key={target} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                            <td className="py-2.5 px-3 font-mono font-bold text-ob-indigo-600 dark:text-ob-indigo-400">
                              {target}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-xs font-bold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800/40 px-2 py-1 rounded">
                              {form.expression}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                              {(form.dependencies || []).join(', ') || '—'}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                              {form.description || 'Calculated field'}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveFormula(target)}
                                className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950 rounded cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: VALIDATION */}
          {activeTab === 'VALIDATION' && (
            <div className="max-w-3xl space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Structural Consistency & Cycle Detection
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400">
                    Verifies field codes, non-circular formula dependency trees, and NBE gateway mapping contracts.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRunValidation}
                  className="min-h-[36px] px-3.5 py-1.5 bg-ob-indigo-600 hover:bg-ob-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer touch-press"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Run Validation Check</span>
                </button>
              </div>

              {validationResult ? (
                <div className={`p-4 rounded-xl border ${validationResult.valid ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800' : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800'} space-y-3`}>
                  <div className="flex items-center gap-2">
                    {validationResult.valid ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                    )}
                    <h4 className={`text-sm font-bold ${validationResult.valid ? 'text-emerald-900 dark:text-emerald-200' : 'text-rose-900 dark:text-rose-200'}`}>
                      {validationResult.valid
                        ? 'Structural Validation Passed! Ready for Live Preview & Publishing.'
                        : `Validation Failed with ${validationResult.errors.length} Critical Issue(s)`}
                    </h4>
                  </div>

                  {!validationResult.valid && (
                    <ul className="space-y-1 list-disc pl-5 text-rose-800 dark:text-rose-300">
                      {validationResult.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  )}

                  {validationResult.warnings.length > 0 && (
                    <div className="pt-2 border-t border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300">
                      <span className="font-bold">Warnings:</span>
                      <ul className="list-disc pl-5 mt-1">
                        {validationResult.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-[11px]">
                    <div>Fields: <span className="font-bold">{validationResult.summary.fieldCount}</span></div>
                    <div>Schedule Columns: <span className="font-bold">{validationResult.summary.columnCount}</span></div>
                    <div>Formulas: <span className="font-bold">{validationResult.summary.formulaCount}</span></div>
                    <div>Sections: <span className="font-bold">{validationResult.summary.sectionCount}</span></div>
                  </div>
                </div>
              ) : (
                <div className="p-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center text-slate-400">
                  Click "Run Validation Check" above to verify all mathematical formulas and field dependencies.
                </div>
              )}
            </div>
          )}

          {/* TAB 7: LIVE FORM PREVIEW */}
          {activeTab === 'PREVIEW' && (
            <div className="space-y-4">
              <div className="p-3 bg-ob-indigo-50 dark:bg-ob-indigo-950/40 border border-ob-indigo-200 dark:border-ob-indigo-800 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-ob-indigo-600" />
                  <span className="text-xs font-bold text-ob-indigo-900 dark:text-ob-indigo-200">
                    Live Interactive Maker Form Preview
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  This preview renders the live UI and formulas exactly as operational Makers will see it.
                </span>
              </div>

              {previewMetadata ? (
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-4 bg-slate-50/50 dark:bg-slate-900/60">
                  <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">{previewMetadata.Title}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{previewMetadata.Description}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-ob-indigo-50 text-ob-indigo-700 dark:bg-ob-indigo-950 dark:text-ob-indigo-300">
                        {previewMetadata.ReturnKey}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {previewMetadata.Frequency}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-ob-green-50 text-ob-green-800 dark:bg-ob-green-950 dark:text-ob-green-300">
                        {previewMetadata.department}
                      </span>
                    </div>
                  </div>

                  {/* Preview Items */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      Fixed Return Cells
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {previewMetadata.ReturnItemsList.map((item) => (
                        <div key={item.Code} className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[10px] text-slate-400">{item.Code}</span>
                            {item.isTotal && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                                Calculated
                              </span>
                            )}
                          </div>
                          <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {item._description}
                          </label>
                          <input
                            type={item._dataType === 'NUMERIC' ? 'number' : 'text'}
                            disabled={item.isTotal}
                            placeholder={item.isTotal ? '[Auto-Calculated by Formula]' : 'Enter value...'}
                            className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white disabled:opacity-60"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Preview Dynamic Schedules */}
                  {previewMetadata.DynamicItemsList.length > 0 && (
                    <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                        Repeating Breakdown Schedule
                      </h4>
                      <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-x-auto bg-white dark:bg-slate-800">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 font-bold">
                            <tr>
                              <th className="py-2 px-3">#</th>
                              {previewMetadata.DynamicItemsList[0].DynamicItems.map((col) => (
                                <th key={col.Code} className="py-2 px-3">{col._description}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td className="py-2 px-3 text-slate-400">1</td>
                              {previewMetadata.DynamicItemsList[0].DynamicItems.map((col) => (
                                <td key={col.Code} className="py-2 px-3">
                                  <input
                                    type={col._dataType === 'NUMERIC' ? 'number' : 'text'}
                                    placeholder="Input..."
                                    className="w-full text-xs p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                                  />
                                </td>
                              ))}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400">
                  Click "Generate Live Preview" to view the form.
                </div>
              )}
            </div>
          )}

          {/* TAB 8: PUBLISH VERSION */}
          {activeTab === 'PUBLISH' && (
            <div className="max-w-2xl space-y-4 text-xs">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                    Safe Version Publishing & Historical Non-Destruction
                  </h4>
                </div>
                <p className="text-emerald-800 dark:text-emerald-300 leading-relaxed">
                  Publishing Version {report ? report.currentVersion + 1 : 1} will make it the active statutory template for all future regulatory returns. Any historical returns already compiled or submitted under previous versions remain 100% frozen to their original schema snapshots for immutable auditability.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Changelog Summary *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Added mandatory collateral haircut column per NBE circular BSD/04/2026..."
                  value={changelogSummary}
                  onChange={(e) => setChangelogSummary(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-ob-green-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Mandatory regulatory reason logged into the non-repudiation compliance audit trail.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1 text-slate-600 dark:text-slate-300">
                <div className="flex justify-between">
                  <span>Target Return:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{metaForm.returnKey}</span>
                </div>
                <div className="flex justify-between">
                  <span>Version to Publish:</span>
                  <span className="font-bold text-slate-900 dark:text-white">v{report ? report.currentVersion + 1 : 1}</span>
                </div>
                <div className="flex justify-between">
                  <span>Return Fields:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{fields.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Schedule Columns:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{columns.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Formulas:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{formulas.length}</span>
                </div>
              </div>

              <button
                type="button"
                disabled={isPublishing}
                onClick={handlePublishVersion}
                className="w-full min-h-[44px] px-4 py-2.5 bg-ob-green-600 hover:bg-ob-green-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer touch-press"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isPublishing ? 'Publishing Version...' : 'Confirm & Publish Statutory Version'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Studio Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs bg-slate-50/50 dark:bg-slate-900/80 shrink-0">
          <div className="text-[11px] text-slate-500">
            Oromia Bank Regulatory Reporting Gateway — Central Bank Directive Engine
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveDraft}
              className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl transition-colors cursor-pointer"
            >
              Save Draft
            </button>
            <button
              type="button"
              onClick={() => {
                if (activeTab === 'PREVIEW') setActiveTab('PUBLISH');
                else if (activeTab === 'VALIDATION') handleGeneratePreview();
                else {
                  handleRunValidation();
                  setActiveTab('VALIDATION');
                }
              }}
              className="px-4 py-1.5 bg-ob-indigo-600 hover:bg-ob-indigo-700 text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Next Step →
            </button>
          </div>
        </div>

        {/* SUB-MODAL: FIELD EDITOR */}
        {isFieldEditorOpen && editingField && (
          <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
            <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-700 shadow-2xl p-5 space-y-3.5 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700">
                <h4 className="font-bold text-slate-900 dark:text-white">
                  Configure Return Field
                </h4>
                <button
                  type="button"
                  onClick={() => setIsFieldEditorOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Field Code *
                </label>
                <input
                  type="text"
                  required
                  value={editingField.itemCode}
                  onChange={(e) => setEditingField({ ...editingField, itemCode: e.target.value.toUpperCase() })}
                  className="w-full p-2 font-mono uppercase bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Descriptive Label *
                </label>
                <input
                  type="text"
                  required
                  value={editingField.itemDescription}
                  onChange={(e) => setEditingField({ ...editingField, itemDescription: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Data Type
                  </label>
                  <select
                    value={editingField.dataType}
                    onChange={(e) => setEditingField({ ...editingField, dataType: e.target.value as FieldDataType })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  >
                    <option value="NUMERIC">Numeric / Balance (ETB)</option>
                    <option value="STRING">Text / String</option>
                    <option value="PERCENTAGE">Percentage / Rate</option>
                    <option value="DATE">Calendar Date</option>
                    <option value="BOOLEAN">Boolean (Yes/No)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Assign Section
                  </label>
                  <select
                    value={editingField.sectionId || ''}
                    onChange={(e) => setEditingField({ ...editingField, sectionId: e.target.value, sectionTitle: sections.find((s) => s.id === e.target.value)?.title })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  >
                    <option value="">General (No Section)</option>
                    {sections.map((s) => (
                      <option key={s.id} value={s.id}>{s.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={editingField.isRequired}
                    onChange={(e) => setEditingField({ ...editingField, isRequired: e.target.checked })}
                    className="rounded text-ob-indigo-600 focus:ring-ob-indigo-500"
                  />
                  <span>Mandatory / Required Field</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={editingField.isCalculated}
                    onChange={(e) => setEditingField({ ...editingField, isCalculated: e.target.checked })}
                    className="rounded text-amber-600 focus:ring-amber-500"
                  />
                  <span>Calculated Field</span>
                </label>
              </div>

              {editingField.isCalculated && (
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Formula Expression (e.g. FIELD_A + FIELD_B)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. LIQ_00001 * 0.05"
                    value={editingField.formulaExpression || ''}
                    onChange={(e) => setEditingField({ ...editingField, formulaExpression: e.target.value })}
                    className="w-full p-2 font-mono text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsFieldEditorOpen(false)}
                  className="px-3 py-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveField(editingField)}
                  className="px-4 py-1.5 bg-ob-indigo-600 hover:bg-ob-indigo-700 text-white font-bold rounded-lg cursor-pointer"
                >
                  Save Field
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SUB-MODAL: COLUMN EDITOR */}
        {isColumnEditorOpen && editingColumn && (
          <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
            <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-700 shadow-2xl p-5 space-y-3.5 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700">
                <h4 className="font-bold text-slate-900 dark:text-white">
                  Configure Schedule Column
                </h4>
                <button
                  type="button"
                  onClick={() => setIsColumnEditorOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Column Key *
                </label>
                <input
                  type="text"
                  required
                  value={editingColumn.columnKey}
                  onChange={(e) => setEditingColumn({ ...editingColumn, columnKey: e.target.value.toUpperCase() })}
                  className="w-full p-2 font-mono uppercase bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Header Label *
                </label>
                <input
                  type="text"
                  required
                  value={editingColumn.headerLabel}
                  onChange={(e) => setEditingColumn({ ...editingColumn, headerLabel: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Data Type
                  </label>
                  <select
                    value={editingColumn.dataType}
                    onChange={(e) => setEditingColumn({ ...editingColumn, dataType: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  >
                    <option value="STRING">Text / String</option>
                    <option value="NUMERIC">Numeric Amount</option>
                    <option value="DATE">Calendar Date</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Width (px)
                  </label>
                  <input
                    type="text"
                    value={editingColumn.width || '160px'}
                    onChange={(e) => setEditingColumn({ ...editingColumn, width: e.target.value })}
                    className="w-full p-2 font-mono bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700 dark:text-slate-300 pt-1">
                <input
                  type="checkbox"
                  checked={editingColumn.isRequired}
                  onChange={(e) => setEditingColumn({ ...editingColumn, isRequired: e.target.checked })}
                  className="rounded text-ob-indigo-600 focus:ring-ob-indigo-500"
                />
                <span>Required Column</span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsColumnEditorOpen(false)}
                  className="px-3 py-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveColumn(editingColumn)}
                  className="px-4 py-1.5 bg-ob-indigo-600 hover:bg-ob-indigo-700 text-white font-bold rounded-lg cursor-pointer"
                >
                  Save Column
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SUB-MODAL: SECTION EDITOR */}
        {isSectionEditorOpen && editingSection && (
          <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
            <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-700 shadow-2xl p-5 space-y-3.5 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700">
                <h4 className="font-bold text-slate-900 dark:text-white">
                  Add / Edit Section
                </h4>
                <button
                  type="button"
                  onClick={() => setIsSectionEditorOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Section Code *
                </label>
                <input
                  type="text"
                  required
                  value={editingSection.code}
                  onChange={(e) => setEditingSection({ ...editingSection, code: e.target.value.toUpperCase() })}
                  className="w-full p-2 font-mono uppercase bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Section Title *
                </label>
                <input
                  type="text"
                  required
                  value={editingSection.title}
                  onChange={(e) => setEditingSection({ ...editingSection, title: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={editingSection.description}
                  onChange={(e) => setEditingSection({ ...editingSection, description: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsSectionEditorOpen(false)}
                  className="px-3 py-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveSection(editingSection)}
                  className="px-4 py-1.5 bg-ob-indigo-600 hover:bg-ob-indigo-700 text-white font-bold rounded-lg cursor-pointer"
                >
                  Save Section
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SUB-MODAL: FORMULA EDITOR */}
        {isFormulaEditorOpen && editingFormula && (
          <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
            <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-700 shadow-2xl p-5 space-y-3.5 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700">
                <h4 className="font-bold text-slate-900 dark:text-white">
                  Add / Edit Mathematical Formula
                </h4>
                <button
                  type="button"
                  onClick={() => setIsFormulaEditorOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Target Field to Compute *
                </label>
                <select
                  value={editingFormula.targetCode}
                  onChange={(e) => setEditingFormula({ ...editingFormula, targetCode: e.target.value })}
                  className="w-full p-2 font-mono text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                >
                  {fields.map((f) => (
                    <option key={f.itemCode} value={f.itemCode}>
                      {f.itemCode} - {f.itemDescription}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Formula Expression (e.g. FIELD_A + FIELD_B - FIELD_C) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ITEM_00001 + ITEM_00002"
                  value={editingFormula.expression}
                  onChange={(e) => {
                    const expr = e.target.value;
                    // Extract words matching field codes as dependencies
                    const tokens = expr.match(/[A-Z0-9_]+/g) || [];
                    const matchedDeps = tokens.filter((t) => fields.some((f) => f.itemCode === t && f.itemCode !== editingFormula.targetCode));
                    setEditingFormula({
                      ...editingFormula,
                      expression: expr,
                      dependencies: Array.from(new Set(matchedDeps)),
                    });
                  }}
                  className="w-full p-2 font-mono text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Detected Field Dependencies
                </label>
                <div className="p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-[11px] text-ob-indigo-600 dark:text-ob-indigo-400">
                  {editingFormula.dependencies.length > 0
                    ? editingFormula.dependencies.join(', ')
                    : 'None detected yet. Type field codes into the formula.'}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Rule Description
                </label>
                <input
                  type="text"
                  value={editingFormula.description}
                  onChange={(e) => setEditingFormula({ ...editingFormula, description: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsFormulaEditorOpen(false)}
                  className="px-3 py-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveFormula(editingFormula)}
                  className="px-4 py-1.5 bg-ob-indigo-600 hover:bg-ob-indigo-700 text-white font-bold rounded-lg cursor-pointer"
                >
                  Save Formula
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
