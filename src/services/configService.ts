/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserSafeEventEmitter } from '../utils/browserEventEmitter.ts';
import { OROMIA_BANK_DEPARTMENTS, type DepartmentDefinition, recordDepartmentRename, registerDynamicDepartmentLookup } from '../data/organizationHierarchy.ts';
import { getAllReports, getReportByKey, NBE_REPORTS, syncSSOTReportToRegistry, retireSSOTReportInRegistry, renameDepartmentInReports } from '../data/report-registry.ts';
import { auditService } from './auditService.ts';
import { realtimeSsotEngine } from './realtimeSsotEngine.ts';
import type { ReportMetadata } from '../types/regulatory.ts';

// ============================================================================
// 1. DATA CONTRACTS & SSOT TYPES
// ============================================================================

export type DepartmentStatus = 'ACTIVE' | 'INACTIVE' | 'RESTRUCTURED' | 'PLANNED';
export type ReportStatus = 'ACTIVE' | 'INACTIVE' | 'DECOMMISSIONED' | 'DRAFT' | 'RETIRED';
export type VersionStatus = 'DRAFT' | 'VALIDATED' | 'PREVIEW' | 'PUBLISHED' | 'ACTIVE' | 'SUPERSEDED' | 'RETIRED';
export type ReportFrequency = 'MONTHLY' | 'QUARTERLY' | 'ANNUAL' | 'ON_DEMAND';
export type AssignmentRole = 'PRIMARY_OWNER' | 'CONTRIBUTOR' | 'REVIEWER' | 'SUPERVISORY';
export type UserDuty = 'MAKER' | 'CHECKER' | 'AUDITOR' | 'VIEWER';
export type FieldDataType = 'NUMERIC' | 'STRING' | 'DATE' | 'PERCENTAGE' | 'CURRENCY' | 'BOOLEAN';

export interface ActorInfo {
  id: string;
  name: string;
  role: string;
}

export interface DepartmentSSOT {
  id: string;
  name: string;
  shortCode: string;
  division: string;
  description: string;
  parentId: string | null;
  hierarchyLevel: number; // 0 = Division, 1 = Department, 2 = Section / Unit
  path: string; // e.g. "/div_banking/dept_credit_ops"
  status: DepartmentStatus;
  primaryResponsibilities: string[];
  effectiveFrom: string; // ISO 8601
  effectiveTo: string | null;
  reportKeys: string[];
  createdAt: string;
  updatedAt: string;
  children?: DepartmentSSOT[];
}

export interface ReportSectionSSOT {
  id: string;
  code: string;
  title: string;
  order: number;
  description: string;
  isRepeating: boolean;
}

export interface ReportFieldSSOT {
  id: string;
  itemId: string;
  itemCode: string;
  itemDescription: string;
  sectionId?: string;
  sectionTitle?: string;
  dataType: FieldDataType;
  isRequired: boolean;
  isCalculated: boolean;
  formulaExpression?: string;
  validationRules: any[];
  order: number;
  defaultValue?: string | number;
  displayConfig?: Record<string, any>;
}

export interface ReportColumnSSOT {
  id: string;
  columnKey: string;
  headerLabel: string;
  dataType: string;
  isRequired: boolean;
  order: number;
  width?: string;
  defaultValue?: string | number;
}

export interface ReportRowSSOT {
  id: string;
  rowCode: string;
  lineNumber: number;
  description: string;
  parentRowCode?: string;
  order: number;
}

export interface ReportVersionSSOT {
  versionId: string;
  reportKey: string;
  versionNumber: number;
  status: VersionStatus;
  effectiveFrom: string;
  effectiveTo: string | null;
  changelogSummary: string;
  changeDiff: Array<{ field: string; oldValue: any; newValue: any }>;
  createdBy: string;
  createdAt: string;
  publishedAt?: string | null;
  sections: ReportSectionSSOT[];
  fields: ReportFieldSSOT[];
  columns: ReportColumnSSOT[];
  rows: ReportRowSSOT[];
  formulas: any[];
  validationRules: any[];
  nbeMapping?: Record<string, any>;
  validationResults?: {
    valid: boolean;
    errors: string[];
    warnings: string[];
    validatedAt: string;
  };
  schemaSnapshot: {
    itemCount: number;
    dynamicAreaCount: number;
    formulaCount: number;
    validationRuleCount: number;
    ReturnItemsList: any[];
    DynamicItemsList: any[];
  };
}

export interface ReportDefinitionSSOT {
  id: string;
  returnKey: string;
  code: string;
  name: string;
  description: string;
  category: string;
  frequency: ReportFrequency;
  status: ReportStatus;
  instCode: string;
  finYear: number;
  defaultDepartmentId: string;
  departmentIds?: string[];
  currentVersion: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  nbeMapping: Record<string, any>;
  displayConfiguration: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  activeVersionSnapshot?: ReportVersionSSOT;
}

/**
 * Transforms an authoritative SSOT ReportDefinition and ReportVersion into a full ReportMetadata instance
 * for dynamic form consumption, validation, calculation, and NBE transmission.
 */
export function versionToReportMetadata(
  def: ReportDefinitionSSOT,
  version: ReportVersionSSOT,
  departmentName?: string
): ReportMetadata {
  return {
    ReturnKey: def.returnKey,
    Code: def.code || def.returnKey,
    Title: def.name,
    Category: (def.category || 'Credit & Lending') as any,
    department: departmentName || def.defaultDepartmentId,
    departments: def.departmentIds && def.departmentIds.length > 0 ? def.departmentIds : [departmentName || def.defaultDepartmentId],
    Frequency: (def.frequency === 'ON_DEMAND' ? 'MONTHLY' : def.frequency) as any,
    InstCode: def.instCode || '0000013',
    FinYear: def.finYear || 2026,
    StartDate: version.effectiveFrom || `${def.finYear || 2026}-01-01T00:00:00`,
    EndDate: version.effectiveTo || `${def.finYear || 2026}-12-31T00:00:00`,
    Description: def.description || `Prudential return for ${def.name}`,
    ReturnItemsList: (version.fields || []).map((f) => ({
      Code: f.itemCode,
      Value: f.defaultValue !== undefined ? f.defaultValue : '',
      _description: f.itemDescription || f.itemCode,
      _dataType: (f.dataType === 'STRING' ? 'TEXT' : f.dataType === 'DATE' ? 'DATE' : 'NUMERIC') as any,
      _required: f.isRequired ?? true,
      section: f.sectionTitle || f.sectionId,
      isTotal: f.isCalculated,
    })),
    DynamicItemsList: (version.columns && version.columns.length > 0) ? [
      {
        Area: 1,
        _areaName: 'Schedule Breakdown',
        DynamicItems: version.columns.map((c) => ({
          Code: c.columnKey,
          Value: c.defaultValue !== undefined ? c.defaultValue : '',
          _description: c.headerLabel || c.columnKey,
          _dataType: (c.dataType === 'STRING' || c.dataType === 'TEXT' ? 'TEXT' : c.dataType === 'DATE' ? 'DATE' : 'NUMERIC') as any,
          _required: c.isRequired ?? true,
        })),
      },
    ] : [],
    Formulas: (version.formulas || []).map((form: any) => ({
      targetCode: form.targetCode || form.targetField || form.code,
      expression: form.expression,
      description: form.description || `Calculation for ${form.targetCode || form.code}`,
      dependencies: form.dependencies || [],
    })),
    ValidationRules: version.validationRules || [],
    SourceFilename: `${def.returnKey}_v${version.versionNumber}.json`,
    SourceHash: `sha256-v${version.versionNumber}-${Date.now()}`,
    isCustom: true,
  };
}

export interface DepartmentReportAssignmentSSOT {
  id: string;
  departmentId: string;
  departmentName: string;
  reportKey: string;
  role: AssignmentRole;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  notes: string;
  assignedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserReportAssignmentSSOT {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  reportKey: string;
  departmentId: string;
  duty: UserDuty;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  assignedBy: string;
  createdAt: string;
}

export interface RoleSSOT {
  code: string;
  name: string;
  description: string;
  permissions: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PermissionSSOT {
  code: string;
  name: string;
  category: 'REPORT' | 'WORKFLOW' | 'ADMIN' | 'AUDIT' | 'SYSTEM';
  description: string;
}

export interface WorkflowStepSSOT {
  id: string;
  stepNumber: number;
  name: string;
  stateCode: string;
  allowedRoles: string[];
  permittedActions: string[];
  requiresBiometric: boolean;
  timeoutHours: number;
}

export interface WorkflowDefinitionSSOT {
  id: string;
  code: string;
  name: string;
  description: string;
  version: number;
  isActive: boolean;
  applicableReports: string[]; // empty means all
  applicableDepartments: string[];
  steps: WorkflowStepSSOT[];
  createdAt: string;
  updatedAt: string;
}

export type ConfigurationEntityType =
  | 'DEPARTMENT'
  | 'REPORT_DEFINITION'
  | 'REPORT_VERSION'
  | 'ROLE'
  | 'PERMISSION'
  | 'ASSIGNMENT'
  | 'SPECIAL_ACCESS'
  | 'WORKFLOW';

export interface ConfigurationChangeSSOT {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  entityType: ConfigurationEntityType;
  entityId: string;
  entityName: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'VERSION_BUMP' | 'ASSIGN' | 'REVOKE' | 'RESTORE';
  summary: string;
  details?: string;
  diff?: Array<{ field: string; oldValue: any; newValue: any }>;
  oldState?: any;
  newState?: any;
  reason?: string;
  correlationId?: string;
}

export interface ConfigSummary {
  status: string;
  institutionCode: string;
  hashes: {
    deptVersion: number;
    reportsVersion: number;
    workflowsVersion: number;
    rbacVersion: number;
    assignmentsVersion: number;
    globalConfigHash: string;
  };
  counts: {
    departments: number;
    reports: number;
    activeVersions: number;
    departmentAssignments: number;
    userAssignments: number;
    roles: number;
    permissions: number;
    workflows: number;
    auditChanges: number;
  };
  lastChangeTimestamp: string;
}

// ============================================================================
// 2. CONFIGURATION ENGINE IMPLEMENTATION
// ============================================================================

class ConfigurationEngine {
  private departments: Map<string, DepartmentSSOT> = new Map();
  private reports: Map<string, ReportDefinitionSSOT> = new Map();
  private versions: Map<string, ReportVersionSSOT[]> = new Map(); // key = returnKey
  private deptAssignments: Map<string, DepartmentReportAssignmentSSOT> = new Map();
  private userAssignments: Map<string, UserReportAssignmentSSOT> = new Map();
  private roles: Map<string, RoleSSOT> = new Map();
  private permissions: Map<string, PermissionSSOT> = new Map();
  private workflows: Map<string, WorkflowDefinitionSSOT> = new Map();
  private changeLogs: ConfigurationChangeSSOT[] = [];

  // Version Counters for Cache Validation
  private deptVersion = 1;
  private reportsVersion = 1;
  private workflowsVersion = 1;
  private rbacVersion = 1;
  private assignmentsVersion = 1;
  private lastChangeTime = new Date().toISOString();

  public readonly events = new BrowserSafeEventEmitter();
  private deptRenameHandlers: Array<(oldName: string, newName: string) => void> = [];

  constructor() {
    this.events.setMaxListeners(100);
    try {
      realtimeSsotEngine.setHashProvider(() => this.generateGlobalHash());
    } catch (_) {}
    try {
      registerDynamicDepartmentLookup((key) => {
        const report = this.getReportDefinition(key);
        if (report?.defaultDepartmentId) {
          const dept = this.getDepartmentById(report.defaultDepartmentId);
          if (dept) return dept.name;
        }
        const assignments = this.getDepartmentReportAssignments({ reportKey: key, activeOnly: true });
        if (assignments.length > 0) {
          const dept = this.getDepartmentById(assignments[0].departmentId);
          if (dept) return dept.name;
        }
        return undefined;
      });
    } catch (_) {}
    this.bootstrapDefaults();
  }

  public onDepartmentRename(handler: (oldName: string, newName: string) => void): () => void {
    this.deptRenameHandlers.push(handler);
    return () => {
      this.deptRenameHandlers = this.deptRenameHandlers.filter((h) => h !== handler);
    };
  }

  // --------------------------------------------------------------------------
  // INITIAL SEEDING & BOOTSTRAP
  // --------------------------------------------------------------------------

  private bootstrapDefaults(): void {
    const now = new Date().toISOString();

    // 1. Seed Roles
    const defaultRoles: RoleSSOT[] = [
      {
        code: 'ADMIN',
        name: 'Compliance Administrator',
        description: 'Complete system oversight, configuration governance, and user lifecycle administration',
        permissions: ['*'],
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        code: 'MAKER',
        name: 'Regulatory Reporting Maker',
        description: 'Prepares statutory return figures, runs mathematical validations, and submits to 4-eyes review',
        permissions: [
          'REPORT_VIEW',
          'REPORT_CREATE_DRAFT',
          'REPORT_EDIT_DRAFT',
          'REPORT_VALIDATE',
          'WORKFLOW_SUBMIT_CHECKER',
          'WORKFLOW_DELIVER_NBE',
        ],
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        code: 'CHECKER',
        name: 'Four-Eyes Regulatory Checker',
        description: 'Conducts independent 4-eyes supervisory verification, approval, and rejection of returns',
        permissions: [
          'REPORT_VIEW',
          'REPORT_VALIDATE',
          'WORKFLOW_CHECKER_APPROVE',
          'WORKFLOW_CHECKER_REJECT',
          'WORKFLOW_REQUEST_CORRECTION',
        ],
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        code: 'AUDITOR',
        name: 'Internal Compliance Auditor',
        description: 'Performs independent continuous auditing, raises non-compliance findings, and inspects audit trails',
        permissions: [
          'REPORT_VIEW',
          'AUDIT_INSPECT_ALL',
          'AUDIT_CREATE_FINDING',
          'AUDIT_UPDATE_FINDING',
          'AUDIT_ATTACH_EVIDENCE',
          'AUDIT_GENERATE_REPORT',
        ],
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    ];

    defaultRoles.forEach((r) => this.roles.set(r.code, r));

    // 2. Seed Granular Permissions
    const defaultPermissions: PermissionSSOT[] = [
      { code: 'REPORT_VIEW', name: 'View Regulatory Reports', category: 'REPORT', description: 'Read-only access to returns' },
      { code: 'REPORT_CREATE_DRAFT', name: 'Create Report Draft', category: 'REPORT', description: 'Initiate new period reporting return' },
      { code: 'REPORT_EDIT_DRAFT', name: 'Edit Return Values', category: 'REPORT', description: 'Modify fixed and dynamic schedule data' },
      { code: 'REPORT_VALIDATE', name: 'Run Validation Engine', category: 'REPORT', description: 'Execute NBE validation rules and formulas' },
      { code: 'WORKFLOW_SUBMIT_CHECKER', name: 'Submit for Four-Eyes Review', category: 'WORKFLOW', description: 'Send draft to Checker queue' },
      { code: 'WORKFLOW_CHECKER_APPROVE', name: 'Approve Submission', category: 'WORKFLOW', description: 'Authorize report for NBE delivery' },
      { code: 'WORKFLOW_CHECKER_REJECT', name: 'Reject Submission', category: 'WORKFLOW', description: 'Reject submission back to draft' },
      { code: 'WORKFLOW_REQUEST_CORRECTION', name: 'Request Correction', category: 'WORKFLOW', description: 'Demand specific numerical remediation' },
      { code: 'WORKFLOW_DELIVER_NBE', name: 'Transmit to Central Bank', category: 'WORKFLOW', description: 'Deliver certified return to NBE' },
      { code: 'ADMIN_MANAGE_USERS', name: 'Manage User Accounts', category: 'ADMIN', description: 'User lifecycle, status, and role assignment' },
      { code: 'ADMIN_MANAGE_DEPARTMENTS', name: 'Manage Department Hierarchy', category: 'ADMIN', description: 'Configure organizational structure' },
      { code: 'ADMIN_MANAGE_REPORTS', name: 'Manage Report Catalog', category: 'ADMIN', description: 'Define returns, metadata, and versions' },
      { code: 'AUDIT_INSPECT_ALL', name: 'Inspect All Departments', category: 'AUDIT', description: 'Supervisory read access across the bank' },
      { code: 'AUDIT_CREATE_FINDING', name: 'Raise Audit Finding', category: 'AUDIT', description: 'Record compliance and data quality exceptions' },
      { code: 'AUDIT_GENERATE_REPORT', name: 'Generate Audit Packages', category: 'AUDIT', description: 'Export tamper-evident audit memorandums' },
    ];

    defaultPermissions.forEach((p) => this.permissions.set(p.code, p));

    // 3. Seed Workflow Definitions
    const defaultWorkflow: WorkflowDefinitionSSOT = {
      id: 'WF_STANDARD_FOUR_EYES',
      code: 'WF_STANDARD_FOUR_EYES',
      name: 'Standard NBE Four-Eyes Dual Control Workflow',
      description: 'Authoritative Maker-Checker workflow adhering to NBE Directive BSD/03/2020',
      version: 1,
      isActive: true,
      applicableReports: [],
      applicableDepartments: [],
      steps: [
        {
          id: 'step_1_draft',
          stepNumber: 1,
          name: 'Draft Preparation',
          stateCode: 'DRAFT',
          allowedRoles: ['MAKER'],
          permittedActions: ['CREATE', 'EDIT', 'VALIDATE', 'SUBMIT_TO_CHECKER'],
          requiresBiometric: false,
          timeoutHours: 72,
        },
        {
          id: 'step_2_review',
          stepNumber: 2,
          name: 'Checker Supervisory Review',
          stateCode: 'PENDING_CHECKER',
          allowedRoles: ['CHECKER'],
          permittedActions: ['APPROVE', 'REJECT', 'REQUEST_CORRECTION'],
          requiresBiometric: false,
          timeoutHours: 24,
        },
        {
          id: 'step_3_approved',
          stepNumber: 3,
          name: 'Compliance Certified',
          stateCode: 'APPROVED',
          allowedRoles: ['MAKER'],
          permittedActions: ['DELIVER_TO_NBE'],
          requiresBiometric: false,
          timeoutHours: 12,
        },
        {
          id: 'step_4_transmitted',
          stepNumber: 4,
          name: 'NBE Delivered & Sealed',
          stateCode: 'SENT',
          allowedRoles: [],
          permittedActions: ['AUDIT_INSPECT', 'EXPORT_RECEIPT'],
          requiresBiometric: false,
          timeoutHours: 0,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    this.workflows.set(defaultWorkflow.code, defaultWorkflow);

    // 4. Seed Departments with Hierarchical Modeling
    // We establish high-level Divisions and nested Operational Departments
    const divisions: Array<{ id: string; name: string; shortCode: string; description: string }> = [
      {
        id: 'div_credit_risk',
        name: 'Credit & Risk Management Division',
        shortCode: 'CRMD',
        description: 'Executive oversight of credit granting, asset quality classification, and risk exposure',
      },
      {
        id: 'div_treasury_finance',
        name: 'Treasury & International Banking Division',
        shortCode: 'TIBD',
        description: 'Liquidity, foreign exchange operations, trade finance, and reserve management',
      },
      {
        id: 'div_operations_tech',
        name: 'Banking Operations & Digital Technology Division',
        shortCode: 'BOTD',
        description: 'Core banking processing, digital channels, and payment systems',
      },
      {
        id: 'div_compliance_legal',
        name: 'Compliance & Governance Division',
        shortCode: 'CGD',
        description: 'Regulatory relationship with NBE, prudential governance, and internal control',
      },
    ];

    // Seed Divisions (Level 0)
    divisions.forEach((div) => {
      this.departments.set(div.id, {
        id: div.id,
        name: div.name,
        shortCode: div.shortCode,
        division: 'Executive Management',
        description: div.description,
        parentId: null,
        hierarchyLevel: 0,
        path: `/${div.id}`,
        status: 'ACTIVE',
        primaryResponsibilities: ['Division Strategic Governance', 'Executive Risk Management'],
        effectiveFrom: now,
        effectiveTo: null,
        reportKeys: [],
        createdAt: now,
        updatedAt: now,
      });
    });

    // Map existing 8 departments to divisions and hierarchy (Level 1)
    const divisionMapping: Record<string, string> = {
      dept_credit_ops: 'div_credit_risk',
      dept_credit_risk: 'div_credit_risk',
      dept_asset_recovery: 'div_credit_risk',
      dept_treasury: 'div_treasury_finance',
      dept_intl_banking: 'div_treasury_finance',
      dept_trade_services: 'div_treasury_finance',
      dept_finance: 'div_treasury_finance',
      dept_digital_banking: 'div_operations_tech',
      dept_banking_ops: 'div_operations_tech',
      dept_compliance: 'div_compliance_legal',
    };

    OROMIA_BANK_DEPARTMENTS.forEach((deptDef) => {
      const parentDivisionId = divisionMapping[deptDef.id] || null;
      const deptSSOT: DepartmentSSOT = {
        id: deptDef.id,
        name: deptDef.name,
        shortCode: deptDef.shortCode,
        division: deptDef.division,
        description: deptDef.description || `${deptDef.name} at Oromia Bank`,
        parentId: parentDivisionId,
        hierarchyLevel: parentDivisionId ? 1 : 0,
        path: parentDivisionId ? `/${parentDivisionId}/${deptDef.id}` : `/${deptDef.id}`,
        status: 'ACTIVE',
        primaryResponsibilities: deptDef.primaryResponsibilities || [],
        effectiveFrom: now,
        effectiveTo: null,
        reportKeys: [...deptDef.reportKeys],
        createdAt: now,
        updatedAt: now,
      };

      this.departments.set(deptSSOT.id, deptSSOT);

      // Create explicit DepartmentReportAssignment records
      deptDef.reportKeys.forEach((key) => {
        const assignmentId = `asgn_dept_${deptDef.id}_${key}`;
        this.deptAssignments.set(assignmentId, {
          id: assignmentId,
          departmentId: deptDef.id,
          departmentName: deptDef.name,
          reportKey: key,
          role: 'PRIMARY_OWNER',
          isActive: true,
          effectiveFrom: now,
          effectiveTo: null,
          notes: `Statutory departmental assignment for ${key}`,
          assignedBy: 'System Bootstrap',
          createdAt: now,
          updatedAt: now,
        });
      });
    });

    // 5. Seed Report Definitions & Version 1 Metadata
    const reportsList = getAllReports();
    reportsList.forEach((r) => {
      const defaultDeptId = (r as any).departmentId || r.department || this.findDepartmentForReport(r.ReturnKey) || 'dept_credit_ops';

      // Parse fields into ReportFieldSSOT
      const formulaTargetCodes = new Set((r.Formulas || []).map((f: any) => f.targetField || f.target || f.code));
      const fields: ReportFieldSSOT[] = (r.ReturnItemsList || []).map((item: any, index: number) => {
        const itemCode = String(item.ItemCode || item.Code || item.ItemId || `ITEM_${index + 1}`);
        const codeLower = itemCode.toLowerCase();
        const desc = item.ItemDescription || item._description || itemCode;
        const isCalculated = Boolean(item.IsCalculated || item.isTotal || formulaTargetCodes.has(itemCode) || (r.Formulas && r.Formulas.length > 0 && index >= r.ReturnItemsList.length - 2));
        let dataType: FieldDataType = 'NUMERIC';
        if (item._dataType === 'TEXT') dataType = 'STRING';
        else if (item._dataType === 'DATE') dataType = 'DATE';
        else if (isCalculated) dataType = 'NUMERIC';
        else if (codeLower.includes('date')) dataType = 'DATE';
        else if (codeLower.includes('desc') || codeLower.includes('name') || codeLower.includes('text')) dataType = 'STRING';

        const matchedFormula = (r.Formulas || []).find((f: any) => (f.targetField || f.target || f.code) === itemCode);

        return {
          id: `fld_${r.ReturnKey}_${item.ItemId || item.Code || index}`,
          itemId: String(item.ItemId || item.Code || index),
          itemCode,
          itemDescription: desc,
          dataType,
          isRequired: item._required !== undefined ? Boolean(item._required) : true,
          isCalculated,
          formulaExpression: item.FormulaExpression || matchedFormula?.expression || undefined,
          validationRules: (r.ValidationRules || []).filter((v: any) => v.field === itemCode),
          order: index + 1,
        };
      });

      // Parse dynamic columns into ReportColumnSSOT
      const columns: ReportColumnSSOT[] = [];
      let colIdx = 1;
      (r.DynamicItemsList || []).forEach((area: any) => {
        if (Array.isArray(area.DynamicItems)) {
          area.DynamicItems.forEach((col: any) => {
            const colKey = String(col.Code || col.ItemCode || `COL_${colIdx}`);
            columns.push({
              id: `col_${r.ReturnKey}_${colKey}`,
              columnKey: colKey,
              headerLabel: col._description || col.ItemDescription || colKey,
              dataType: col._dataType || 'STRING',
              isRequired: col._required !== undefined ? Boolean(col._required) : true,
              order: colIdx++,
            });
          });
        } else {
          const colKey = String(area.ItemCode || area.Code || `COL_${colIdx}`);
          columns.push({
            id: `col_${r.ReturnKey}_${colKey}`,
            columnKey: colKey,
            headerLabel: area.ItemDescription || area._description || colKey,
            dataType: area._dataType || 'STRING',
            isRequired: true,
            order: colIdx++,
          });
        }
      });

      // Create Version 1 SSOT
      const version1: ReportVersionSSOT = {
        versionId: `ver_${r.ReturnKey}_v1`,
        reportKey: r.ReturnKey,
        versionNumber: 1,
        status: 'ACTIVE',
        effectiveFrom: r.StartDate || now,
        effectiveTo: null,
        changelogSummary: 'Initial canonical NBE return schema definition ingested into metadata SSOT',
        changeDiff: [],
        createdBy: 'NBE Regulatory Authority (Ingestion)',
        createdAt: now,
        sections: [
          {
            id: `sec_${r.ReturnKey}_main`,
            code: 'MAIN',
            title: r.Title,
            order: 1,
            description: r.Description || '',
            isRepeating: false,
          },
        ],
        fields,
        columns,
        rows: [],
        formulas: r.Formulas || [],
        validationRules: r.ValidationRules || [],
        schemaSnapshot: {
          itemCount: fields.length,
          dynamicAreaCount: columns.length,
          formulaCount: (r.Formulas || []).length,
          validationRuleCount: (r.ValidationRules || []).length,
          ReturnItemsList: r.ReturnItemsList,
          DynamicItemsList: r.DynamicItemsList || [],
        },
      };

      this.versions.set(r.ReturnKey, [version1]);

      // Create ReportDefinitionSSOT
      const definition: ReportDefinitionSSOT = {
        id: `rep_${r.ReturnKey}`,
        returnKey: r.ReturnKey,
        code: r.Code || r.ReturnKey,
        name: r.Title,
        description: r.Description || '',
        category: r.Category || 'Credit & Lending',
        frequency: (r.Frequency as ReportFrequency) || 'MONTHLY',
        status: 'ACTIVE',
        instCode: r.InstCode || '0000013',
        finYear: r.FinYear || 2026,
        defaultDepartmentId: defaultDeptId,
        currentVersion: 1,
        effectiveFrom: r.StartDate || now,
        effectiveTo: null,
        nbeMapping: {
          returnKey: r.ReturnKey,
          instCode: r.InstCode || '0000013',
          nbeEndpoint: `/api/v2/returns/${r.ReturnKey}`,
        },
        displayConfiguration: {
          layout: columns.length > 0 ? 'HYBRID_TABLE_SCHEDULE' : 'FIXED_FORM',
          showSectionHeaders: true,
          compactMode: false,
        },
        createdAt: now,
        updatedAt: now,
        activeVersionSnapshot: version1,
      };

      this.reports.set(r.ReturnKey, definition);
    });

    // Initial audit log
    this.recordChange({
      actorId: 'system_ssot_bootstrap',
      actorName: 'Oromia Bank Regulatory Gateway Kernel',
      actorRole: 'SYSTEM',
      entityType: 'REPORT_DEFINITION',
      entityId: 'ALL_24_REPORTS',
      entityName: 'NBE Regulatory Return Suite',
      action: 'CREATE',
      summary: 'Bootstrapped Phase 2 Dynamic Configuration SSOT database across 8 departments and 24 returns',
    });
  }

  private findDepartmentForReport(returnKey: string): string | null {
    for (const dept of OROMIA_BANK_DEPARTMENTS) {
      if (dept.reportKeys.includes(returnKey)) {
        return dept.id;
      }
    }
    return null;
  }

  // --------------------------------------------------------------------------
  // CACHE & METRIC MANAGEMENT
  // --------------------------------------------------------------------------

  public generateGlobalHash(): string {
    return `ssot_${this.deptVersion}_${this.reportsVersion}_${this.workflowsVersion}_${this.rbacVersion}_${this.assignmentsVersion}`;
  }

  public bumpVersion(domain: 'DEPARTMENT' | 'REPORT' | 'WORKFLOW' | 'RBAC' | 'ASSIGNMENT'): void {
    if (domain === 'DEPARTMENT') this.deptVersion++;
    else if (domain === 'REPORT') this.reportsVersion++;
    else if (domain === 'WORKFLOW') this.workflowsVersion++;
    else if (domain === 'RBAC') this.rbacVersion++;
    else if (domain === 'ASSIGNMENT') this.assignmentsVersion++;
    this.lastChangeTime = new Date().toISOString();

    const globalHash = this.generateGlobalHash();
    this.events.emit('CACHE_INVALIDATED', { domain, globalHash, timestamp: this.lastChangeTime });
    this.events.emit('CONFIG_CHANGED', { domain, globalHash, timestamp: this.lastChangeTime });
  }

  public invalidateCache(domain?: 'DEPARTMENT' | 'REPORT' | 'WORKFLOW' | 'RBAC' | 'ASSIGNMENT'): void {
    if (domain) {
      this.bumpVersion(domain);
    } else {
      this.deptVersion++;
      this.reportsVersion++;
      this.workflowsVersion++;
      this.rbacVersion++;
      this.assignmentsVersion++;
      this.lastChangeTime = new Date().toISOString();
      this.events.emit('CACHE_INVALIDATED', { domain: 'ALL', globalHash: this.generateGlobalHash() });
    }
  }

  public getConfigSummary(): ConfigSummary {
    let totalVersions = 0;
    this.versions.forEach((vList) => {
      totalVersions += vList.length;
    });

    return {
      status: 'SYNCHRONIZED',
      institutionCode: '0000013',
      hashes: {
        deptVersion: this.deptVersion,
        reportsVersion: this.reportsVersion,
        workflowsVersion: this.workflowsVersion,
        rbacVersion: this.rbacVersion,
        assignmentsVersion: this.assignmentsVersion,
        globalConfigHash: this.generateGlobalHash(),
      },
      counts: {
        departments: this.departments.size,
        reports: this.reports.size,
        activeVersions: totalVersions,
        departmentAssignments: this.deptAssignments.size,
        userAssignments: this.userAssignments.size,
        roles: this.roles.size,
        permissions: this.permissions.size,
        workflows: this.workflows.size,
        auditChanges: this.changeLogs.length,
      },
      lastChangeTimestamp: this.lastChangeTime,
    };
  }

  private recordChange(change: Omit<ConfigurationChangeSSOT, 'id' | 'timestamp'>): ConfigurationChangeSSOT {
    const record: ConfigurationChangeSSOT = {
      ...change,
      id: `cfg_chg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
    };
    this.changeLogs.unshift(record);

    // Integrate with system compliance auditService
    auditService.log({
      actorId: record.actorId,
      actorName: record.actorName,
      actorRole: record.actorRole,
      action: `CONFIG_${record.action}_${record.entityType}`,
      entityType: 'CONFIGURATION_SSOT',
      entityId: record.entityId,
      correlationId: record.correlationId || `corr_cfg_${Date.now()}`,
      details: `[SSOT Change] ${record.summary}`,
      newState: record.newState,
      oldState: record.oldState,
    });

    // Real-Time SSOT Event propagation
    try {
      const eventType = this.resolveRealtimeEventType(record.entityType, record.action);
      const domain = this.resolveRealtimeDomain(record.entityType);
      realtimeSsotEngine.publishEvent({
        eventType,
        action: record.action,
        domain,
        entityId: record.entityId,
        actor: { id: record.actorId, name: record.actorName, role: record.actorRole },
        summary: record.summary,
        globalConfigHash: this.generateGlobalHash(),
        payload: {
          diff: record.diff,
          details: record.details,
          entityName: record.entityName,
          entityType: record.entityType,
          action: record.action,
          newState: record.newState,
          oldState: record.oldState,
        },
      });
    } catch (_) {}

    return record;
  }

  private resolveRealtimeEventType(entityType: ConfigurationEntityType, action: string): any {
    switch (entityType) {
      case 'DEPARTMENT':
        return 'DEPARTMENT_CHANGED';
      case 'REPORT_DEFINITION':
      case 'REPORT_VERSION':
        return 'REPORT_CHANGED';
      case 'ASSIGNMENT':
        return 'ASSIGNMENT_CHANGED';
      case 'ROLE':
      case 'PERMISSION':
        return 'ROLE_CHANGED';
      default:
        return 'CONFIG_SYNC_TRIGGER';
    }
  }

  private resolveRealtimeDomain(entityType: ConfigurationEntityType): any {
    switch (entityType) {
      case 'DEPARTMENT':
        return 'DEPARTMENT';
      case 'REPORT_DEFINITION':
      case 'REPORT_VERSION':
        return 'REPORT';
      case 'ASSIGNMENT':
        return 'ASSIGNMENT';
      case 'ROLE':
      case 'PERMISSION':
        return 'RBAC';
      default:
        return 'REPORT';
    }
  }

  public getChangeLogs(limit = 100): ConfigurationChangeSSOT[] {
    return this.changeLogs.slice(0, limit);
  }

  // --------------------------------------------------------------------------
  // DEPARTMENT HIERARCHY SSOT
  // --------------------------------------------------------------------------

  public getDepartments(options?: { flat?: boolean; activeOnly?: boolean }): DepartmentSSOT[] {
    const list = Array.from(this.departments.values());
    const filtered = options?.activeOnly ? list.filter((d) => d.status === 'ACTIVE') : list;

    if (options?.flat) {
      return filtered;
    }

    // Return tree structure
    const roots: DepartmentSSOT[] = [];
    const map = new Map<string, DepartmentSSOT>();

    filtered.forEach((d) => {
      map.set(d.id, { ...d, children: [] });
    });

    map.forEach((dept) => {
      if (dept.parentId && map.has(dept.parentId)) {
        map.get(dept.parentId)!.children!.push(dept);
      } else {
        roots.push(dept);
      }
    });

    return roots;
  }

  public getDepartmentById(id: string): DepartmentSSOT | null {
    return this.departments.get(id) || null;
  }

  public getDepartmentAncestors(id: string): DepartmentSSOT[] {
    const ancestors: DepartmentSSOT[] = [];
    let current = this.departments.get(id);
    while (current && current.parentId) {
      const parent = this.departments.get(current.parentId);
      if (parent) {
        ancestors.push(parent);
        current = parent;
      } else {
        break;
      }
    }
    return ancestors;
  }

  public getDepartmentDescendants(id: string): DepartmentSSOT[] {
    const descendants: DepartmentSSOT[] = [];
    const queue = [id];
    while (queue.length > 0) {
      const currId = queue.shift()!;
      this.departments.forEach((dept) => {
        if (dept.parentId === currId) {
          descendants.push(dept);
          queue.push(dept.id);
        }
      });
    }
    return descendants;
  }

  public createDepartment(
    input: {
      id?: string;
      name: string;
      shortCode: string;
      division: string;
      description?: string;
      parentId?: string | null;
      primaryResponsibilities?: string[];
      status?: DepartmentStatus;
      effectiveFrom?: string;
    },
    actor: ActorInfo
  ): DepartmentSSOT {
    const id = input.id || `dept_${input.shortCode.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    if (this.departments.has(id)) {
      throw new Error(`Department with ID '${id}' already exists.`);
    }

    // Verify parent exists if provided
    let level = 0;
    let path = `/${id}`;
    if (input.parentId) {
      const parent = this.departments.get(input.parentId);
      if (!parent) {
        throw new Error(`Parent department '${input.parentId}' does not exist.`);
      }
      level = parent.hierarchyLevel + 1;
      path = `${parent.path}/${id}`;
    }

    const now = new Date().toISOString();
    const newDept: DepartmentSSOT = {
      id,
      name: input.name,
      shortCode: input.shortCode.toUpperCase(),
      division: input.division,
      description: input.description || '',
      parentId: input.parentId || null,
      hierarchyLevel: level,
      path,
      status: input.status || 'ACTIVE',
      primaryResponsibilities: input.primaryResponsibilities || [],
      effectiveFrom: input.effectiveFrom || now,
      effectiveTo: null,
      reportKeys: [],
      createdAt: now,
      updatedAt: now,
    };

    this.departments.set(id, newDept);

    this.recordChange({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      entityType: 'DEPARTMENT',
      entityId: id,
      entityName: newDept.name,
      action: 'CREATE',
      summary: `Created department '${newDept.name}' (${newDept.shortCode}) under parent ${newDept.parentId || 'ROOT'}`,
      newState: newDept,
    });

    this.bumpVersion('DEPARTMENT');
    return newDept;
  }

  public updateDepartment(
    id: string,
    updates: {
      name?: string;
      shortCode?: string;
      division?: string;
      description?: string;
      parentId?: string | null;
      status?: DepartmentStatus;
      primaryResponsibilities?: string[];
      effectiveTo?: string | null;
    },
    actor: ActorInfo
  ): DepartmentSSOT {
    const dept = this.departments.get(id);
    if (!dept) throw new Error(`Department with ID '${id}' not found.`);

    const oldState = { ...dept };
    const diff: Array<{ field: string; oldValue: any; newValue: any }> = [];

    if (updates.name && updates.name !== dept.name) {
      diff.push({ field: 'name', oldValue: dept.name, newValue: updates.name });
      const oldName = dept.name;
      dept.name = updates.name;
      recordDepartmentRename(oldName, updates.name);
      renameDepartmentInReports(oldName, updates.name);
      for (const handler of this.deptRenameHandlers) {
        try {
          handler(oldName, updates.name);
        } catch (_) {}
      }
    }
    if (updates.shortCode && updates.shortCode !== dept.shortCode) {
      diff.push({ field: 'shortCode', oldValue: dept.shortCode, newValue: updates.shortCode.toUpperCase() });
      dept.shortCode = updates.shortCode.toUpperCase();
    }
    if (updates.division && updates.division !== dept.division) {
      diff.push({ field: 'division', oldValue: dept.division, newValue: updates.division });
      dept.division = updates.division;
    }
    if (updates.description !== undefined && updates.description !== dept.description) {
      diff.push({ field: 'description', oldValue: dept.description, newValue: updates.description });
      dept.description = updates.description;
    }
    if (updates.status && updates.status !== dept.status) {
      diff.push({ field: 'status', oldValue: dept.status, newValue: updates.status });
      dept.status = updates.status;
    }
    if (updates.primaryResponsibilities) {
      diff.push({ field: 'primaryResponsibilities', oldValue: dept.primaryResponsibilities, newValue: updates.primaryResponsibilities });
      dept.primaryResponsibilities = updates.primaryResponsibilities;
    }
    if (updates.effectiveTo !== undefined) {
      diff.push({ field: 'effectiveTo', oldValue: dept.effectiveTo, newValue: updates.effectiveTo });
      dept.effectiveTo = updates.effectiveTo;
    }

    // Handle hierarchy restructuring if parentId modified
    if (updates.parentId !== undefined && updates.parentId !== dept.parentId) {
      if (updates.parentId === dept.id) {
        throw new Error('A department cannot be its own parent.');
      }
      // Check cyclical hierarchy
      if (updates.parentId) {
        const descendants = this.getDepartmentDescendants(dept.id);
        if (descendants.some((d) => d.id === updates.parentId)) {
          throw new Error('Cannot assign a descendant department as parent (circular reference).');
        }
        const newParent = this.departments.get(updates.parentId);
        if (!newParent) throw new Error(`Parent department '${updates.parentId}' does not exist.`);
        dept.parentId = updates.parentId;
        dept.hierarchyLevel = newParent.hierarchyLevel + 1;
        dept.path = `${newParent.path}/${dept.id}`;
      } else {
        dept.parentId = null;
        dept.hierarchyLevel = 0;
        dept.path = `/${dept.id}`;
      }
      diff.push({ field: 'parentId', oldValue: oldState.parentId, newValue: dept.parentId });
      diff.push({ field: 'path', oldValue: oldState.path, newValue: dept.path });
    }

    dept.updatedAt = new Date().toISOString();
    this.departments.set(id, dept);

    this.recordChange({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      entityType: 'DEPARTMENT',
      entityId: id,
      entityName: dept.name,
      action: 'UPDATE',
      summary: `Updated department '${dept.name}' (${diff.map((d) => d.field).join(', ')})`,
      diff,
      oldState,
      newState: dept,
    });

    this.bumpVersion('DEPARTMENT');
    return dept;
  }

  private deptSubmissionProvider?: { getAll: () => Array<{ department?: string; departmentId?: string }> };
  private deptUserProvider?: { getAll: () => Array<{ department?: string; id?: string }> };

  public setSubmissionProvider(provider: { getAll: () => Array<{ department?: string; departmentId?: string }> }): void {
    this.deptSubmissionProvider = provider;
  }

  public setUserProvider(provider: { getAll: () => Array<{ department?: string; id?: string }> }): void {
    this.deptUserProvider = provider;
  }

  /**
   * Pre-flight safety check determining whether a department can be destructively removed,
   * or whether historical reporting references and assigned officers prohibit deletion under NBE compliance rules.
   */
  public canDeleteDepartment(id: string): {
    canDelete: boolean;
    reason?: string;
    submissionsCount?: number;
    usersCount?: number;
    department?: DepartmentSSOT;
  } {
    const dept = this.departments.get(id);
    if (!dept) {
      return { canDelete: false, reason: `Department with ID '${id}' not found.` };
    }

    // 1. Check for child departments
    const descendants = this.getDepartmentDescendants(id);
    if (descendants.length > 0) {
      return {
        canDelete: false,
        reason: `Cannot delete department '${dept.name}' because it has ${descendants.length} subordinate child unit(s). Reassign or delete child units first.`,
      };
    }

    // 2. Check for historical statutory submissions
    if (this.deptSubmissionProvider && typeof this.deptSubmissionProvider.getAll === 'function') {
      const subs = this.deptSubmissionProvider.getAll().filter(
        (s: any) =>
          (s.department && s.department.toLowerCase() === dept.name.toLowerCase()) ||
          s.departmentId === dept.id
      );
      if (subs.length > 0) {
        return {
          canDelete: false,
          submissionsCount: subs.length,
          department: dept,
          reason: `Historical safety violation: Department '${dept.name}' is referenced in ${subs.length} historical regulatory return submission(s). NBE banking supervision directives require permanent retention of institutional reporting history. Destructive deletion is prohibited. Please set status to 'INACTIVE' or specify an effective-to retirement date instead.`,
        };
      }
    }

    // 3. Check for assigned bank officers
    if (this.deptUserProvider && typeof this.deptUserProvider.getAll === 'function') {
      const officers = this.deptUserProvider.getAll().filter(
        (u: any) =>
          u.department &&
          (u.department.toLowerCase() === dept.name.toLowerCase() || u.department === dept.id)
      );
      if (officers.length > 0) {
        return {
          canDelete: false,
          usersCount: officers.length,
          department: dept,
          reason: `Department '${dept.name}' has ${officers.length} active assigned user account(s). Please reassign officers before deleting.`,
        };
      }
    }

    return { canDelete: true, department: dept };
  }

  public deleteDepartment(id: string, actor: ActorInfo): boolean {
    const check = this.canDeleteDepartment(id);
    if (!check.canDelete) {
      throw new Error(check.reason || 'Department cannot be safely deleted.');
    }

    const dept = this.departments.get(id)!;
    const oldState = { ...dept };

    // Clean up any empty report assignments for this department
    const relatedAssignments = Array.from(this.deptAssignments.values()).filter(
      (a) => a.departmentId === id
    );
    relatedAssignments.forEach((a) => this.deptAssignments.delete(a.id));

    this.departments.delete(id);

    this.recordChange({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      entityType: 'DEPARTMENT',
      entityId: id,
      entityName: dept.name,
      action: 'DELETE',
      summary: `Permanently removed empty department '${dept.name}' (${dept.shortCode})`,
      oldState,
    });

    this.bumpVersion('DEPARTMENT');
    return true;
  }

  public setDepartmentStatus(
    id: string,
    status: DepartmentStatus,
    actor: ActorInfo,
    effectiveTo?: string | null
  ): DepartmentSSOT {
    const dept = this.departments.get(id);
    if (!dept) throw new Error(`Department with ID '${id}' not found.`);

    const oldStatus = dept.status;
    const oldEffectiveTo = dept.effectiveTo;
    dept.status = status;
    if (effectiveTo !== undefined) {
      dept.effectiveTo = effectiveTo;
    } else if (status === 'INACTIVE' && !dept.effectiveTo) {
      dept.effectiveTo = new Date().toISOString();
    } else if (status === 'ACTIVE') {
      dept.effectiveTo = null;
    }
    dept.updatedAt = new Date().toISOString();

    this.departments.set(id, dept);

    this.recordChange({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      entityType: 'DEPARTMENT',
      entityId: id,
      entityName: dept.name,
      action: 'UPDATE',
      summary: `Changed department '${dept.name}' status from ${oldStatus} to ${status}${dept.effectiveTo ? ` (Effective To: ${dept.effectiveTo})` : ''}`,
      diff: [
        { field: 'status', oldValue: oldStatus, newValue: status },
        { field: 'effectiveTo', oldValue: oldEffectiveTo, newValue: dept.effectiveTo },
      ],
      newState: dept,
    });

    this.bumpVersion('DEPARTMENT');
    return dept;
  }

  public getDepartmentAuditHistory(id: string): ConfigurationChangeSSOT[] {
    const dept = this.departments.get(id);
    const deptName = dept?.name?.toLowerCase() || '';
    return this.changeLogs.filter(
      (c) =>
        (c.entityType === 'DEPARTMENT' && c.entityId === id) ||
        (c.entityType === 'ASSIGNMENT' && (c.entityName.includes(dept?.shortCode || '') || c.summary.toLowerCase().includes(deptName)))
    );
  }

  // --------------------------------------------------------------------------
  // REPORT DEFINITIONS & IMMUTABLE VERSIONING SSOT
  // --------------------------------------------------------------------------

  public getReports(filter?: { category?: string; frequency?: string; status?: string; departmentId?: string }): ReportDefinitionSSOT[] {
    let list = Array.from(this.reports.values());
    if (filter?.category) list = list.filter((r) => r.category === filter.category);
    if (filter?.frequency) list = list.filter((r) => r.frequency === filter.frequency);
    if (filter?.status) list = list.filter((r) => r.status === filter.status);
    if (filter?.departmentId) {
      // Find reports assigned to this department
      const assignedKeys = new Set(
        Array.from(this.deptAssignments.values())
          .filter((a) => a.departmentId === filter.departmentId && a.isActive)
          .map((a) => a.reportKey)
      );
      list = list.filter((r) => r.defaultDepartmentId === filter.departmentId || assignedKeys.has(r.returnKey));
    }
    return list;
  }

  public getReportDefinition(returnKey: string): ReportDefinitionSSOT | null {
    const report = this.reports.get(returnKey);
    if (!report) return null;

    // Attach active version snapshot
    const activeVersion = this.getActiveVersion(returnKey);
    return {
      ...report,
      activeVersionSnapshot: activeVersion || undefined,
    };
  }

  public getReportVersions(returnKey: string): ReportVersionSSOT[] {
    return this.versions.get(returnKey) || [];
  }

  public getReportVersion(returnKey: string, versionNumber: number): ReportVersionSSOT | null {
    const list = this.versions.get(returnKey);
    if (!list) return null;
    return list.find((v) => v.versionNumber === versionNumber) || null;
  }

  public getActiveVersion(returnKey: string): ReportVersionSSOT | null {
    const list = this.versions.get(returnKey);
    if (!list || list.length === 0) return null;
    return list.find((v) => v.status === 'ACTIVE') || list[list.length - 1];
  }

  /**
   * Creates a new metadata-driven report definition with initial version, sections, fields, and department ownership.
   */
  public createReportDefinition(
    input: {
      returnKey: string;
      code?: string;
      name: string;
      description?: string;
      category?: string;
      frequency?: ReportFrequency;
      status?: ReportStatus;
      instCode?: string;
      finYear?: number;
      defaultDepartmentId?: string;
      departmentIds?: string[];
      sections?: ReportSectionSSOT[];
      fields?: ReportFieldSSOT[];
      columns?: ReportColumnSSOT[];
      formulas?: any[];
      validationRules?: any[];
      nbeMapping?: Record<string, any>;
      displayConfiguration?: Record<string, any>;
      initialStatus?: VersionStatus;
      changelogSummary?: string;
    },
    actor: ActorInfo
  ): { report: ReportDefinitionSSOT; version: ReportVersionSSOT } {
    const normKey = input.returnKey.trim().toUpperCase();
    if (this.reports.has(normKey)) {
      throw new Error(`Report definition with ReturnKey '${normKey}' already exists.`);
    }

    const now = new Date().toISOString();
    const defaultDept = input.defaultDepartmentId || (input.departmentIds && input.departmentIds[0]) || 'dept_credit_ops';
    const initialFields = input.fields && input.fields.length > 0 ? input.fields : [
      {
        id: `fld_${normKey}_00001`,
        itemId: '00001',
        itemCode: `${normKey}_00001`,
        itemDescription: 'Principal Balance / Exposure Value',
        dataType: 'NUMERIC' as FieldDataType,
        isRequired: true,
        isCalculated: false,
        validationRules: [],
        order: 1,
      },
      {
        id: `fld_${normKey}_00002`,
        itemId: '00002',
        itemCode: `${normKey}_00002`,
        itemDescription: 'Mandatory Provisioning Rate (%)',
        dataType: 'PERCENTAGE' as FieldDataType,
        isRequired: false,
        isCalculated: false,
        validationRules: [],
        order: 2,
      },
      {
        id: `fld_${normKey}_00003`,
        itemId: '00003',
        itemCode: `${normKey}_00003`,
        itemDescription: 'Required Statutory Provision Amount',
        dataType: 'NUMERIC' as FieldDataType,
        isRequired: false,
        isCalculated: true,
        formulaExpression: `${normKey}_00001 * ${normKey}_00002`,
        validationRules: [],
        order: 3,
      },
    ];

    const initialFormulas = input.formulas && input.formulas.length > 0 ? input.formulas : [
      {
        targetCode: `${normKey}_00003`,
        expression: `${normKey}_00001 * ${normKey}_00002`,
        description: 'Calculated Required Provision',
        dependencies: [`${normKey}_00001`, `${normKey}_00002`],
      },
    ];

    const vStatus: VersionStatus = input.initialStatus || 'ACTIVE';

    const version1: ReportVersionSSOT = {
      versionId: `ver_${normKey}_v1`,
      reportKey: normKey,
      versionNumber: 1,
      status: vStatus,
      effectiveFrom: now,
      effectiveTo: null,
      changelogSummary: input.changelogSummary || 'Initial metadata-driven report definition registered by Administrator',
      changeDiff: [],
      createdBy: actor.name,
      createdAt: now,
      publishedAt: vStatus === 'ACTIVE' ? now : null,
      sections: input.sections && input.sections.length > 0 ? input.sections : [
        {
          id: `sec_${normKey}_main`,
          code: 'MAIN',
          title: input.name,
          order: 1,
          description: input.description || '',
          isRepeating: false,
        },
      ],
      fields: initialFields,
      columns: input.columns || [],
      rows: [],
      formulas: initialFormulas,
      validationRules: input.validationRules || [],
      nbeMapping: input.nbeMapping || { returnKey: normKey, instCode: input.instCode || '0000013', finYear: input.finYear || 2026 },
      schemaSnapshot: {
        itemCount: initialFields.length,
        dynamicAreaCount: (input.columns || []).length,
        formulaCount: initialFormulas.length,
        validationRuleCount: (input.validationRules || []).length,
        ReturnItemsList: initialFields.map((f) => ({
          ItemId: f.itemId,
          ItemCode: f.itemCode,
          ItemDescription: f.itemDescription,
          IsCalculated: f.isCalculated,
          FormulaExpression: f.formulaExpression,
        })),
        DynamicItemsList: (input.columns || []).map((c) => ({
          ItemCode: c.columnKey,
          ItemDescription: c.headerLabel,
        })),
      },
    };

    const report: ReportDefinitionSSOT = {
      id: `rep_${normKey}`,
      returnKey: normKey,
      code: (input.code || normKey).toUpperCase(),
      name: input.name,
      description: input.description || `Prudential return for ${input.name}`,
      category: input.category || 'Credit & Lending',
      frequency: input.frequency || 'MONTHLY',
      status: input.status || (vStatus === 'ACTIVE' ? 'ACTIVE' : 'DRAFT'),
      instCode: input.instCode || '0000013',
      finYear: input.finYear || 2026,
      defaultDepartmentId: defaultDept,
      departmentIds: input.departmentIds && input.departmentIds.length > 0 ? input.departmentIds : [defaultDept],
      currentVersion: 1,
      effectiveFrom: now,
      effectiveTo: null,
      nbeMapping: input.nbeMapping || { returnKey: normKey, instCode: input.instCode || '0000013', finYear: input.finYear || 2026 },
      displayConfiguration: input.displayConfiguration || { layout: 'STANDARD_TABLE' },
      createdAt: now,
      updatedAt: now,
      activeVersionSnapshot: vStatus === 'ACTIVE' ? version1 : undefined,
    };

    this.reports.set(normKey, report);
    this.versions.set(normKey, [version1]);

    // Create departmental assignments
    const deptsToAssign = report.departmentIds && report.departmentIds.length > 0 ? report.departmentIds : [defaultDept];
    deptsToAssign.forEach((dId, idx) => {
      try {
        this.assignDepartmentReport(
          {
            departmentId: dId,
            reportKey: normKey,
            role: idx === 0 ? 'PRIMARY_OWNER' : 'CONTRIBUTOR',
            notes: `Initial departmental assignment for ${normKey}`,
          },
          actor
        );
      } catch {}
    });

    // If published active, sync into active catalog
    if (vStatus === 'ACTIVE') {
      const primaryDeptName = this.departments.get(defaultDept)?.name || 'Credit Operations & Portfolio Management';
      const metadata = versionToReportMetadata(report, version1, primaryDeptName);
      syncSSOTReportToRegistry(metadata);
    }

    this.recordChange({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      entityType: 'REPORT_DEFINITION',
      entityId: normKey,
      entityName: report.name,
      action: 'CREATE',
      summary: `Created new metadata-driven report definition '${report.name}' (${normKey}) v1`,
      newState: report,
    });

    this.bumpVersion('REPORT');
    return { report, version: version1 };
  }

  /**
   * Updates report definition metadata and linkages.
   */
  public updateReportDefinition(
    returnKey: string,
    updates: {
      name?: string;
      code?: string;
      description?: string;
      category?: string;
      frequency?: ReportFrequency;
      status?: ReportStatus;
      defaultDepartmentId?: string;
      departmentIds?: string[];
      nbeMapping?: Record<string, any>;
      displayConfiguration?: Record<string, any>;
    },
    actor: ActorInfo
  ): ReportDefinitionSSOT {
    const report = this.reports.get(returnKey);
    if (!report) throw new Error(`Report definition '${returnKey}' not found.`);

    const oldState = { ...report };
    const diff: Array<{ field: string; oldValue: any; newValue: any }> = [];

    if (updates.name && updates.name !== report.name) {
      diff.push({ field: 'name', oldValue: report.name, newValue: updates.name });
      report.name = updates.name;
    }
    if (updates.code && updates.code !== report.code) {
      diff.push({ field: 'code', oldValue: report.code, newValue: updates.code.toUpperCase() });
      report.code = updates.code.toUpperCase();
    }
    if (updates.description !== undefined && updates.description !== report.description) {
      diff.push({ field: 'description', oldValue: report.description, newValue: updates.description });
      report.description = updates.description;
    }
    if (updates.category && updates.category !== report.category) {
      diff.push({ field: 'category', oldValue: report.category, newValue: updates.category });
      report.category = updates.category;
    }
    if (updates.frequency && updates.frequency !== report.frequency) {
      diff.push({ field: 'frequency', oldValue: report.frequency, newValue: updates.frequency });
      report.frequency = updates.frequency;
    }
    if (updates.status && updates.status !== report.status) {
      diff.push({ field: 'status', oldValue: report.status, newValue: updates.status });
      report.status = updates.status;
    }
    if (updates.defaultDepartmentId && updates.defaultDepartmentId !== report.defaultDepartmentId) {
      diff.push({ field: 'defaultDepartmentId', oldValue: report.defaultDepartmentId, newValue: updates.defaultDepartmentId });
      report.defaultDepartmentId = updates.defaultDepartmentId;
    }
    if (updates.departmentIds) {
      diff.push({ field: 'departmentIds', oldValue: report.departmentIds, newValue: updates.departmentIds });
      report.departmentIds = updates.departmentIds;
      // Re-synchronize department assignments
      updates.departmentIds.forEach((dId, idx) => {
        try {
          this.assignDepartmentReport(
            {
              departmentId: dId,
              reportKey: returnKey,
              role: idx === 0 ? 'PRIMARY_OWNER' : 'CONTRIBUTOR',
              notes: `Departmental assignment updated for ${returnKey}`,
            },
            actor
          );
        } catch {}
      });
    }
    if (updates.nbeMapping) {
      diff.push({ field: 'nbeMapping', oldValue: report.nbeMapping, newValue: updates.nbeMapping });
      report.nbeMapping = { ...report.nbeMapping, ...updates.nbeMapping };
    }
    if (updates.displayConfiguration) {
      report.displayConfiguration = { ...report.displayConfiguration, ...updates.displayConfiguration };
    }

    report.updatedAt = new Date().toISOString();
    this.reports.set(returnKey, report);

    // Sync into active catalog if active version exists
    const activeVersion = this.getActiveVersion(returnKey);
    if (activeVersion && activeVersion.status === 'ACTIVE') {
      const primaryDeptName = this.departments.get(report.defaultDepartmentId)?.name || 'Credit Operations & Portfolio Management';
      const metadata = versionToReportMetadata(report, activeVersion, primaryDeptName);
      syncSSOTReportToRegistry(metadata);
    }

    this.recordChange({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      entityType: 'REPORT_DEFINITION',
      entityId: returnKey,
      entityName: report.name,
      action: 'UPDATE',
      summary: `Updated metadata for report '${report.name}' (${diff.map((d) => d.field).join(', ')})`,
      diff,
      oldState,
      newState: report,
    });

    this.bumpVersion('REPORT');
    return report;
  }

  /**
   * Creates a new working draft version for a report, copying previous schema or accepting modifications.
   */
  public createDraftVersion(
    returnKey: string,
    input: {
      changelogSummary?: string;
      fields?: ReportFieldSSOT[];
      columns?: ReportColumnSSOT[];
      sections?: ReportSectionSSOT[];
      formulas?: any[];
      validationRules?: any[];
      nbeMapping?: Record<string, any>;
    },
    actor: ActorInfo
  ): ReportVersionSSOT {
    const report = this.reports.get(returnKey);
    if (!report) throw new Error(`Report with ReturnKey '${returnKey}' not found.`);

    const versionList = this.versions.get(returnKey) || [];
    const currentActive = this.getActiveVersion(returnKey);

    // If an existing un-published draft already exists, update it
    const existingDraft = versionList.find(
      (v) => v.status === 'DRAFT' || v.status === 'VALIDATED' || v.status === 'PREVIEW'
    );
    if (existingDraft) {
      if (input.changelogSummary) existingDraft.changelogSummary = input.changelogSummary;
      if (input.fields) existingDraft.fields = [...input.fields];
      if (input.columns) existingDraft.columns = [...input.columns];
      if (input.sections) existingDraft.sections = [...input.sections];
      if (input.formulas) existingDraft.formulas = [...input.formulas];
      if (input.validationRules) existingDraft.validationRules = [...input.validationRules];
      if (input.nbeMapping) existingDraft.nbeMapping = input.nbeMapping;
      existingDraft.status = 'DRAFT';
      return existingDraft;
    }

    const nextVersionNumber = report.currentVersion + 1;
    const now = new Date().toISOString();

    const newVersion: ReportVersionSSOT = {
      versionId: `ver_${returnKey}_v${nextVersionNumber}`,
      reportKey: returnKey,
      versionNumber: nextVersionNumber,
      status: 'DRAFT',
      effectiveFrom: now,
      effectiveTo: null,
      changelogSummary: input.changelogSummary || `Draft Version ${nextVersionNumber} revision`,
      changeDiff: [],
      createdBy: actor.name,
      createdAt: now,
      publishedAt: null,
      sections: input.sections || (currentActive ? JSON.parse(JSON.stringify(currentActive.sections)) : []),
      fields: input.fields || (currentActive ? JSON.parse(JSON.stringify(currentActive.fields)) : []),
      columns: input.columns || (currentActive ? JSON.parse(JSON.stringify(currentActive.columns)) : []),
      rows: currentActive?.rows || [],
      formulas: input.formulas || (currentActive ? JSON.parse(JSON.stringify(currentActive.formulas)) : []),
      validationRules: input.validationRules || (currentActive ? JSON.parse(JSON.stringify(currentActive.validationRules)) : []),
      nbeMapping: input.nbeMapping || currentActive?.nbeMapping || report.nbeMapping,
      schemaSnapshot: {
        itemCount: (input.fields || currentActive?.fields || []).length,
        dynamicAreaCount: (input.columns || currentActive?.columns || []).length,
        formulaCount: (input.formulas || currentActive?.formulas || []).length,
        validationRuleCount: (input.validationRules || currentActive?.validationRules || []).length,
        ReturnItemsList: [],
        DynamicItemsList: [],
      },
    };

    versionList.push(newVersion);
    this.versions.set(returnKey, versionList);

    this.recordChange({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      entityType: 'REPORT_VERSION',
      entityId: newVersion.versionId,
      entityName: `${report.name} (v${nextVersionNumber} DRAFT)`,
      action: 'CREATE',
      summary: `Created draft Version ${nextVersionNumber} for '${returnKey}'`,
      newState: newVersion,
    });

    this.bumpVersion('REPORT');
    return newVersion;
  }

  /**
   * Updates an in-flight working draft version.
   */
  public updateDraftVersion(
    returnKey: string,
    versionNumber: number,
    updates: {
      changelogSummary?: string;
      sections?: ReportSectionSSOT[];
      fields?: ReportFieldSSOT[];
      columns?: ReportColumnSSOT[];
      rows?: ReportRowSSOT[];
      formulas?: any[];
      validationRules?: any[];
      nbeMapping?: Record<string, any>;
    },
    actor: ActorInfo
  ): ReportVersionSSOT {
    const version = this.getReportVersion(returnKey, versionNumber);
    if (!version) throw new Error(`Version ${versionNumber} for report '${returnKey}' not found.`);

    if (version.status === 'SUPERSEDED' || version.status === 'RETIRED') {
      throw new Error(`Cannot modify version in '${version.status}' status (immutable historical record).`);
    }

    if (updates.changelogSummary !== undefined) version.changelogSummary = updates.changelogSummary;
    if (updates.sections !== undefined) version.sections = updates.sections;
    if (updates.fields !== undefined) version.fields = updates.fields;
    if (updates.columns !== undefined) version.columns = updates.columns;
    if (updates.rows !== undefined) version.rows = updates.rows;
    if (updates.formulas !== undefined) version.formulas = updates.formulas;
    if (updates.validationRules !== undefined) version.validationRules = updates.validationRules;
    if (updates.nbeMapping !== undefined) version.nbeMapping = updates.nbeMapping;

    // Reset status to DRAFT so re-validation is required before publishing
    if (version.status === 'VALIDATED' || version.status === 'PREVIEW') {
      version.status = 'DRAFT';
    }

    this.bumpVersion('REPORT');
    return version;
  }

  /**
   * Rigorously validates a report version for structural integrity, unique field codes, formula dependencies and cycle detection.
   */
  public validateReportVersion(returnKey: string, versionNumber: number): {
    valid: boolean;
    errors: string[];
    warnings: string[];
    summary: {
      fieldCount: number;
      columnCount: number;
      formulaCount: number;
      sectionCount: number;
    };
  } {
    const version = this.getReportVersion(returnKey, versionNumber);
    if (!version) {
      throw new Error(`Version ${versionNumber} for report '${returnKey}' not found.`);
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Check fields
    if (!version.fields || version.fields.length === 0) {
      errors.push('Report version must define at least one return field.');
    }

    const fieldCodes = new Set<string>();
    (version.fields || []).forEach((f, idx) => {
      if (!f.itemCode || !f.itemCode.trim()) {
        errors.push(`Field at position ${idx + 1} has an empty field code.`);
      } else {
        const codeUpper = f.itemCode.trim().toUpperCase();
        if (fieldCodes.has(codeUpper)) {
          errors.push(`Duplicate field code '${f.itemCode}' detected in version fields.`);
        }
        fieldCodes.add(codeUpper);
      }
      if (!f.itemDescription || !f.itemDescription.trim()) {
        warnings.push(`Field '${f.itemCode}' has no descriptive label.`);
      }
    });

    // 2. Check dynamic columns
    const columnKeys = new Set<string>();
    (version.columns || []).forEach((c, idx) => {
      if (!c.columnKey || !c.columnKey.trim()) {
        errors.push(`Schedule column at position ${idx + 1} has an empty column key.`);
      } else {
        const colUpper = c.columnKey.trim().toUpperCase();
        if (columnKeys.has(colUpper)) {
          errors.push(`Duplicate schedule column key '${c.columnKey}' detected.`);
        }
        columnKeys.add(colUpper);
      }
    });

    // 3. Formula dependencies & Cycle Detection
    const formulaTargets = new Set<string>();
    const formulaGraph: Record<string, string[]> = {};

    (version.formulas || []).forEach((formula: any, idx: number) => {
      const target = (formula.targetCode || formula.targetField || formula.code || '').trim().toUpperCase();
      if (!target) {
        errors.push(`Formula at index ${idx + 1} has an empty target code.`);
        return;
      }
      if (!fieldCodes.has(target)) {
        errors.push(`Formula target '${target}' does not exist among report return fields.`);
      }
      if (formulaTargets.has(target)) {
        errors.push(`Multiple formulas target the same field '${target}'.`);
      }
      formulaTargets.add(target);

      const deps: string[] = Array.isArray(formula.dependencies)
        ? formula.dependencies.map((d: string) => d.trim().toUpperCase())
        : [];

      deps.forEach((dep) => {
        if (!fieldCodes.has(dep)) {
          errors.push(`Formula targeting '${target}' references non-existent dependency field '${dep}'.`);
        }
      });

      formulaGraph[target] = deps;
    });

    // Cycle Detection in Formulas using DFS
    const visited = new Set<string>();
    const inStack = new Set<string>();

    function hasCycle(node: string, path: string[]): boolean {
      visited.add(node);
      inStack.add(node);
      path.push(node);

      const neighbors = formulaGraph[node] || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (hasCycle(neighbor, path)) return true;
        } else if (inStack.has(neighbor)) {
          path.push(neighbor);
          return true;
        }
      }

      inStack.delete(node);
      path.pop();
      return false;
    }

    for (const node of Object.keys(formulaGraph)) {
      if (!visited.has(node)) {
        const cyclePath: string[] = [];
        if (hasCycle(node, cyclePath)) {
          errors.push(`Circular formula calculation dependency detected: ${cyclePath.join(' -> ')}.`);
          break;
        }
      }
    }

    const valid = errors.length === 0;

    version.validationResults = {
      valid,
      errors,
      warnings,
      validatedAt: new Date().toISOString(),
    };

    if (valid && (version.status === 'DRAFT' || version.status === 'VALIDATED')) {
      version.status = 'VALIDATED';
    }

    return {
      valid,
      errors,
      warnings,
      summary: {
        fieldCount: (version.fields || []).length,
        columnCount: (version.columns || []).length,
        formulaCount: (version.formulas || []).length,
        sectionCount: (version.sections || []).length,
      },
    };
  }

  /**
   * Generates a preview schema for a version and transitions status to PREVIEW if validated.
   */
  public previewReportVersion(returnKey: string, versionNumber: number): {
    version: ReportVersionSSOT;
    previewMetadata: ReportMetadata;
  } {
    const report = this.reports.get(returnKey);
    if (!report) throw new Error(`Report definition '${returnKey}' not found.`);

    const version = this.getReportVersion(returnKey, versionNumber);
    if (!version) throw new Error(`Version ${versionNumber} for report '${returnKey}' not found.`);

    if (version.status === 'VALIDATED') {
      version.status = 'PREVIEW';
    }

    const primaryDept = this.departments.get(report.defaultDepartmentId)?.name || 'Credit Operations & Portfolio Management';
    const previewMetadata = versionToReportMetadata(report, version, primaryDept);

    return { version, previewMetadata };
  }

  /**
   * Authoritatively publishes a version (Draft/Validated/Preview -> Active).
   * Transitions any existing active version to SUPERSEDED, preserving historical submission reproducibility.
   */
  public publishReportVersion(
    returnKey: string,
    versionNumber: number,
    actor: ActorInfo,
    changelogSummary?: string
  ): ReportVersionSSOT {
    const report = this.reports.get(returnKey);
    if (!report) throw new Error(`Report with ReturnKey '${returnKey}' not found.`);

    const version = this.getReportVersion(returnKey, versionNumber);
    if (!version) throw new Error(`Version ${versionNumber} for report '${returnKey}' not found.`);

    // Pre-flight validation
    const valResult = this.validateReportVersion(returnKey, versionNumber);
    if (!valResult.valid) {
      throw new Error(`Cannot publish version ${versionNumber}: structural validation failed with ${valResult.errors.length} error(s):\n${valResult.errors.join('\n')}`);
    }

    const now = new Date().toISOString();
    const currentActive = this.getActiveVersion(returnKey);

    // Transition previous active version to SUPERSEDED (Preserving historical integrity!)
    if (currentActive && currentActive.versionNumber !== versionNumber) {
      currentActive.status = 'SUPERSEDED';
      currentActive.effectiveTo = now;
    }

    // Update this version
    version.status = 'ACTIVE';
    version.effectiveFrom = version.effectiveFrom || now;
    version.effectiveTo = null;
    version.publishedAt = now;
    if (changelogSummary) {
      version.changelogSummary = changelogSummary;
    }

    // Update ReportDefinition pointers
    report.currentVersion = Math.max(report.currentVersion, versionNumber);
    report.status = 'ACTIVE';
    report.updatedAt = now;
    report.activeVersionSnapshot = version;
    this.reports.set(returnKey, report);

    // Sync to active catalog so Maker, Checker, DynamicReportForm immediately consume active schema
    const primaryDeptName = this.departments.get(report.defaultDepartmentId)?.name || 'Credit Operations & Portfolio Management';
    const metadata = versionToReportMetadata(report, version, primaryDeptName);
    syncSSOTReportToRegistry(metadata);

    this.recordChange({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      entityType: 'REPORT_VERSION',
      entityId: version.versionId,
      entityName: `${report.name} (v${versionNumber})`,
      action: 'VERSION_BUMP',
      summary: `Published Version ${versionNumber} for '${returnKey}' (${version.changelogSummary})`,
      newState: version,
    });

    this.bumpVersion('REPORT');
    return version;
  }

  /**
   * Safely retires an obsolete report return template while preserving historical audit trails.
   */
  public retireReport(returnKey: string, actor: ActorInfo, reason?: string): ReportDefinitionSSOT {
    const report = this.reports.get(returnKey);
    if (!report) throw new Error(`Report with ReturnKey '${returnKey}' not found.`);

    const now = new Date().toISOString();
    report.status = 'RETIRED';
    report.effectiveTo = now;
    report.updatedAt = now;

    const currentActive = this.getActiveVersion(returnKey);
    if (currentActive) {
      currentActive.status = 'RETIRED';
      currentActive.effectiveTo = now;
    }

    this.reports.set(returnKey, report);
    retireSSOTReportInRegistry(returnKey);

    this.recordChange({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      entityType: 'REPORT_DEFINITION',
      entityId: returnKey,
      entityName: report.name,
      action: 'UPDATE',
      summary: `Retired report return template '${report.name}' (${returnKey}). Reason: ${reason || 'Statutory obsolescence'}`,
      newState: report,
    });

    this.bumpVersion('REPORT');
    return report;
  }

  /**
   * Governed Rollback: Reverts a report definition to an earlier version snapshot.
   * Creates a NEW version snapshot (Version N+1) reproducing the target historical schema.
   * NEVER rewrites or destroys historical versions or submitted returns.
   */
  public rollbackReportVersion(
    returnKey: string,
    targetVersionNumber: number,
    actor: ActorInfo,
    reason: string
  ): ReportVersionSSOT {
    const report = this.reports.get(returnKey);
    if (!report) throw new Error(`Report with ReturnKey '${returnKey}' not found.`);

    const targetVersion = this.getReportVersion(returnKey, targetVersionNumber);
    if (!targetVersion) {
      throw new Error(`Target Version ${targetVersionNumber} not found for report '${returnKey}'.`);
    }

    if (!reason || reason.trim().length < 5) {
      throw new Error('A detailed rollback reason is required (at least 5 characters).');
    }

    const nextVersionNumber = report.currentVersion + 1;
    const now = new Date().toISOString();

    // Create new version with target schema
    const rolledBackVersion: ReportVersionSSOT = {
      versionId: `ver_${returnKey}_v${nextVersionNumber}_${Date.now()}`,
      reportKey: returnKey,
      versionNumber: nextVersionNumber,
      status: 'ACTIVE',
      effectiveFrom: now,
      effectiveTo: null,
      changelogSummary: `[GOVERNED ROLLBACK] Restored schema from Version ${targetVersionNumber}. Reason: ${reason}`,
      changeDiff: [{ field: 'rollbackSourceVersion', oldValue: targetVersionNumber, newValue: nextVersionNumber }],
      createdBy: actor.name,
      createdAt: now,
      publishedAt: now,
      sections: JSON.parse(JSON.stringify(targetVersion.sections)),
      fields: JSON.parse(JSON.stringify(targetVersion.fields)),
      columns: JSON.parse(JSON.stringify(targetVersion.columns)),
      rows: JSON.parse(JSON.stringify(targetVersion.rows)),
      formulas: JSON.parse(JSON.stringify(targetVersion.formulas)),
      validationRules: JSON.parse(JSON.stringify(targetVersion.validationRules)),
      nbeMapping: targetVersion.nbeMapping ? JSON.parse(JSON.stringify(targetVersion.nbeMapping)) : undefined,
      schemaSnapshot: JSON.parse(JSON.stringify(targetVersion.schemaSnapshot)),
    };

    // Transition current active to SUPERSEDED
    const currentActive = this.getActiveVersion(returnKey);
    if (currentActive) {
      currentActive.status = 'SUPERSEDED';
      currentActive.effectiveTo = now;
    }

    // Register in versions map
    const list = this.versions.get(returnKey) || [];
    list.push(rolledBackVersion);
    this.versions.set(returnKey, list);

    // Update report pointers
    report.currentVersion = nextVersionNumber;
    report.status = 'ACTIVE';
    report.updatedAt = now;
    report.activeVersionSnapshot = rolledBackVersion;
    this.reports.set(returnKey, report);

    // Sync to active registry
    const primaryDeptName = this.departments.get(report.defaultDepartmentId)?.name || 'Credit Operations & Portfolio Management';
    const metadata = versionToReportMetadata(report, rolledBackVersion, primaryDeptName);
    syncSSOTReportToRegistry(metadata);

    this.recordChange({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      entityType: 'REPORT_VERSION',
      entityId: rolledBackVersion.versionId,
      entityName: `${report.name} (v${nextVersionNumber})`,
      action: 'RESTORE',
      summary: `Rolled back '${returnKey}' to schema of Version ${targetVersionNumber}. Reason: ${reason}`,
      newState: rolledBackVersion,
      oldState: currentActive,
    });

    this.bumpVersion('REPORT');
    return rolledBackVersion;
  }

  // --- Fine-Grained Structural Editing Helpers ---

  public addField(returnKey: string, versionNumber: number, field: ReportFieldSSOT, actor: ActorInfo): ReportVersionSSOT {
    const version = this.getReportVersion(returnKey, versionNumber);
    if (!version) throw new Error(`Version ${versionNumber} for '${returnKey}' not found.`);
    if (version.status === 'SUPERSEDED' || version.status === 'RETIRED') {
      throw new Error(`Cannot modify version in '${version.status}' status.`);
    }
    const fields = version.fields || [];
    if (fields.some((f) => f.itemCode.toUpperCase() === field.itemCode.toUpperCase())) {
      throw new Error(`Field with code '${field.itemCode}' already exists in this version.`);
    }
    field.order = fields.length + 1;
    fields.push(field);
    version.fields = fields;
    version.status = 'DRAFT';
    this.bumpVersion('REPORT');
    return version;
  }

  public updateField(returnKey: string, versionNumber: number, fieldId: string, updates: Partial<ReportFieldSSOT>, actor: ActorInfo): ReportVersionSSOT {
    const version = this.getReportVersion(returnKey, versionNumber);
    if (!version) throw new Error(`Version ${versionNumber} for '${returnKey}' not found.`);
    if (version.status === 'SUPERSEDED' || version.status === 'RETIRED') {
      throw new Error(`Cannot modify version in '${version.status}' status.`);
    }
    const field = (version.fields || []).find((f) => f.id === fieldId || f.itemCode === fieldId);
    if (!field) throw new Error(`Field '${fieldId}' not found in version ${versionNumber}.`);
    Object.assign(field, updates);
    version.status = 'DRAFT';
    this.bumpVersion('REPORT');
    return version;
  }

  public removeField(returnKey: string, versionNumber: number, fieldId: string, actor: ActorInfo): ReportVersionSSOT {
    const version = this.getReportVersion(returnKey, versionNumber);
    if (!version) throw new Error(`Version ${versionNumber} for '${returnKey}' not found.`);
    if (version.status === 'SUPERSEDED' || version.status === 'RETIRED') {
      throw new Error(`Cannot modify version in '${version.status}' status.`);
    }
    version.fields = (version.fields || []).filter((f) => f.id !== fieldId && f.itemCode !== fieldId);
    version.status = 'DRAFT';
    this.bumpVersion('REPORT');
    return version;
  }

  public reorderFields(returnKey: string, versionNumber: number, fieldIdsInOrder: string[], actor: ActorInfo): ReportVersionSSOT {
    const version = this.getReportVersion(returnKey, versionNumber);
    if (!version) throw new Error(`Version ${versionNumber} for '${returnKey}' not found.`);
    const fieldMap = new Map((version.fields || []).map((f) => [f.id, f]));
    const reordered: ReportFieldSSOT[] = [];
    fieldIdsInOrder.forEach((id, idx) => {
      const f = fieldMap.get(id);
      if (f) {
        f.order = idx + 1;
        reordered.push(f);
        fieldMap.delete(id);
      }
    });
    // Append any omitted fields
    fieldMap.forEach((f) => {
      f.order = reordered.length + 1;
      reordered.push(f);
    });
    version.fields = reordered;
    version.status = 'DRAFT';
    this.bumpVersion('REPORT');
    return version;
  }

  public addColumn(returnKey: string, versionNumber: number, column: ReportColumnSSOT, actor: ActorInfo): ReportVersionSSOT {
    const version = this.getReportVersion(returnKey, versionNumber);
    if (!version) throw new Error(`Version ${versionNumber} for '${returnKey}' not found.`);
    const columns = version.columns || [];
    if (columns.some((c) => c.columnKey.toUpperCase() === column.columnKey.toUpperCase())) {
      throw new Error(`Schedule column '${column.columnKey}' already exists in this version.`);
    }
    column.order = columns.length + 1;
    columns.push(column);
    version.columns = columns;
    version.status = 'DRAFT';
    this.bumpVersion('REPORT');
    return version;
  }

  public updateColumn(returnKey: string, versionNumber: number, columnId: string, updates: Partial<ReportColumnSSOT>, actor: ActorInfo): ReportVersionSSOT {
    const version = this.getReportVersion(returnKey, versionNumber);
    if (!version) throw new Error(`Version ${versionNumber} for '${returnKey}' not found.`);
    const col = (version.columns || []).find((c) => c.id === columnId || c.columnKey === columnId);
    if (!col) throw new Error(`Column '${columnId}' not found.`);
    Object.assign(col, updates);
    version.status = 'DRAFT';
    this.bumpVersion('REPORT');
    return version;
  }

  public removeColumn(returnKey: string, versionNumber: number, columnId: string, actor: ActorInfo): ReportVersionSSOT {
    const version = this.getReportVersion(returnKey, versionNumber);
    if (!version) throw new Error(`Version ${versionNumber} for '${returnKey}' not found.`);
    version.columns = (version.columns || []).filter((c) => c.id !== columnId && c.columnKey !== columnId);
    version.status = 'DRAFT';
    this.bumpVersion('REPORT');
    return version;
  }

  public addSection(returnKey: string, versionNumber: number, section: ReportSectionSSOT, actor: ActorInfo): ReportVersionSSOT {
    const version = this.getReportVersion(returnKey, versionNumber);
    if (!version) throw new Error(`Version ${versionNumber} for '${returnKey}' not found.`);
    const sections = version.sections || [];
    section.order = sections.length + 1;
    sections.push(section);
    version.sections = sections;
    version.status = 'DRAFT';
    this.bumpVersion('REPORT');
    return version;
  }

  public removeSection(returnKey: string, versionNumber: number, sectionId: string, actor: ActorInfo): ReportVersionSSOT {
    const version = this.getReportVersion(returnKey, versionNumber);
    if (!version) throw new Error(`Version ${versionNumber} for '${returnKey}' not found.`);
    version.sections = (version.sections || []).filter((s) => s.id !== sectionId && s.code !== sectionId);
    version.status = 'DRAFT';
    this.bumpVersion('REPORT');
    return version;
  }

  /**
   * Safe version bump without destroying historical meaning or overwriting past submissions.
   */
  public createReportVersion(
    returnKey: string,
    input: {
      changelogSummary: string;
      fields?: ReportFieldSSOT[];
      columns?: ReportColumnSSOT[];
      formulas?: any[];
      validationRules?: any[];
      effectiveFrom?: string;
    },
    actor: ActorInfo
  ): ReportVersionSSOT {
    const report = this.reports.get(returnKey);
    if (!report) throw new Error(`Report with ReturnKey '${returnKey}' not found.`);

    const versionList = this.versions.get(returnKey) || [];
    const currentActive = this.getActiveVersion(returnKey);
    const nextVersionNumber = report.currentVersion + 1;
    const now = new Date().toISOString();

    // Mark current version as SUPERSEDED (preserving historical integrity!)
    if (currentActive) {
      currentActive.status = 'SUPERSEDED';
      currentActive.effectiveTo = now;
    }

    const newFields = input.fields || (currentActive ? [...currentActive.fields] : []);
    const newColumns = input.columns || (currentActive ? [...currentActive.columns] : []);
    const newFormulas = input.formulas || (currentActive ? [...currentActive.formulas] : []);
    const newRules = input.validationRules || (currentActive ? [...currentActive.validationRules] : []);

    const newVersion: ReportVersionSSOT = {
      versionId: `ver_${returnKey}_v${nextVersionNumber}`,
      reportKey: returnKey,
      versionNumber: nextVersionNumber,
      status: 'ACTIVE',
      effectiveFrom: input.effectiveFrom || now,
      effectiveTo: null,
      changelogSummary: input.changelogSummary,
      changeDiff: [
        { field: 'versionNumber', oldValue: report.currentVersion, newValue: nextVersionNumber },
        { field: 'itemCount', oldValue: currentActive?.fields.length || 0, newValue: newFields.length },
      ],
      createdBy: actor.name,
      createdAt: now,
      publishedAt: now,
      sections: currentActive?.sections || [],
      fields: newFields,
      columns: newColumns,
      rows: currentActive?.rows || [],
      formulas: newFormulas,
      validationRules: newRules,
      schemaSnapshot: {
        itemCount: newFields.length,
        dynamicAreaCount: newColumns.length,
        formulaCount: newFormulas.length,
        validationRuleCount: newRules.length,
        ReturnItemsList: newFields.map((f) => ({
          ItemId: f.itemId,
          ItemCode: f.itemCode,
          ItemDescription: f.itemDescription,
          IsCalculated: f.isCalculated,
          FormulaExpression: f.formulaExpression,
        })),
        DynamicItemsList: newColumns.map((c) => ({
          ItemCode: c.columnKey,
          ItemDescription: c.headerLabel,
        })),
      },
    };

    versionList.push(newVersion);
    this.versions.set(returnKey, versionList);

    // Update Report Definition currentVersion pointer
    report.currentVersion = nextVersionNumber;
    report.updatedAt = now;
    report.activeVersionSnapshot = newVersion;
    this.reports.set(returnKey, report);

    // Sync into active catalog
    const primaryDeptName = this.departments.get(report.defaultDepartmentId)?.name || 'Credit Operations & Portfolio Management';
    const metadata = versionToReportMetadata(report, newVersion, primaryDeptName);
    syncSSOTReportToRegistry(metadata);

    this.recordChange({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      entityType: 'REPORT_VERSION',
      entityId: newVersion.versionId,
      entityName: `${report.name} (v${nextVersionNumber})`,
      action: 'VERSION_BUMP',
      summary: `Bumped '${returnKey}' to Version ${nextVersionNumber}: ${input.changelogSummary}`,
      newState: newVersion,
    });

    this.bumpVersion('REPORT');
    return newVersion;
  }

  // --------------------------------------------------------------------------
  // EXPLICIT RELATIONSHIP MODEL (DEPARTMENT ↔ REPORT, USER ↔ REPORT)
  // --------------------------------------------------------------------------

  public getDepartmentReportAssignments(filter?: { departmentId?: string; reportKey?: string; activeOnly?: boolean }): DepartmentReportAssignmentSSOT[] {
    let list = Array.from(this.deptAssignments.values());
    if (filter?.departmentId) list = list.filter((a) => a.departmentId === filter.departmentId);
    if (filter?.reportKey) list = list.filter((a) => a.reportKey === filter.reportKey);
    if (filter?.activeOnly) list = list.filter((a) => a.isActive);
    return list;
  }

  public assignDepartmentReport(
    input: {
      departmentId: string;
      reportKey: string;
      role?: AssignmentRole;
      notes?: string;
      effectiveFrom?: string;
      effectiveTo?: string | null;
    },
    actor: ActorInfo
  ): DepartmentReportAssignmentSSOT {
    const dept = this.departments.get(input.departmentId);
    if (!dept) throw new Error(`Department '${input.departmentId}' not found.`);
    const report = this.reports.get(input.reportKey);
    if (!report) throw new Error(`Report '${input.reportKey}' not found.`);

    const id = `asgn_dept_${input.departmentId}_${input.reportKey}_${input.role || 'PRIMARY_OWNER'}`;
    const now = new Date().toISOString();

    const assignment: DepartmentReportAssignmentSSOT = {
      id,
      departmentId: dept.id,
      departmentName: dept.name,
      reportKey: report.returnKey,
      role: input.role || 'PRIMARY_OWNER',
      isActive: true,
      effectiveFrom: input.effectiveFrom || now,
      effectiveTo: input.effectiveTo || null,
      notes: input.notes || `Assigned ${input.role || 'PRIMARY_OWNER'} role for ${report.returnKey}`,
      assignedBy: actor.name,
      createdAt: now,
      updatedAt: now,
    };

    this.deptAssignments.set(id, assignment);

    // Keep department.reportKeys in sync for backward compatibility
    if (!dept.reportKeys.includes(input.reportKey)) {
      dept.reportKeys.push(input.reportKey);
      this.departments.set(dept.id, dept);
    }

    this.recordChange({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      entityType: 'ASSIGNMENT',
      entityId: id,
      entityName: `${dept.shortCode} -> ${report.returnKey}`,
      action: 'ASSIGN',
      summary: `Assigned '${report.returnKey}' to '${dept.name}' as ${assignment.role}`,
      newState: assignment,
    });

    this.bumpVersion('ASSIGNMENT');
    return assignment;
  }

  public removeDepartmentReportAssignment(id: string, actor: ActorInfo): boolean {
    const existing = this.deptAssignments.get(id);
    if (!existing) return false;

    this.deptAssignments.delete(id);

    // Check if department has other active assignments for this report
    const otherAssignments = Array.from(this.deptAssignments.values()).filter(
      (a) => a.departmentId === existing.departmentId && a.reportKey === existing.reportKey
    );
    if (otherAssignments.length === 0) {
      const dept = this.departments.get(existing.departmentId);
      if (dept) {
        dept.reportKeys = dept.reportKeys.filter((k) => k !== existing.reportKey);
        this.departments.set(dept.id, dept);
      }
    }

    this.recordChange({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      entityType: 'ASSIGNMENT',
      entityId: id,
      entityName: `${existing.departmentName} -> ${existing.reportKey}`,
      action: 'REVOKE',
      summary: `Revoked assignment of '${existing.reportKey}' from '${existing.departmentName}'`,
      oldState: existing,
    });

    this.bumpVersion('ASSIGNMENT');
    return true;
  }

  public getUserReportAssignments(filter?: { userId?: string; reportKey?: string; duty?: UserDuty }): UserReportAssignmentSSOT[] {
    let list = Array.from(this.userAssignments.values());
    if (filter?.userId) list = list.filter((a) => a.userId === filter.userId);
    if (filter?.reportKey) list = list.filter((a) => a.reportKey === filter.reportKey);
    if (filter?.duty) list = list.filter((a) => a.duty === filter.duty);
    return list;
  }

  public assignUserReport(
    input: {
      userId: string;
      userEmail: string;
      userName: string;
      reportKey: string;
      departmentId: string;
      duty: UserDuty;
      effectiveFrom?: string;
      effectiveTo?: string | null;
    },
    actor: ActorInfo
  ): UserReportAssignmentSSOT {
    const id = `asgn_usr_${input.userId}_${input.reportKey}_${input.duty}`;
    const now = new Date().toISOString();

    const assignment: UserReportAssignmentSSOT = {
      id,
      userId: input.userId,
      userEmail: input.userEmail,
      userName: input.userName,
      reportKey: input.reportKey,
      departmentId: input.departmentId,
      duty: input.duty,
      isActive: true,
      effectiveFrom: input.effectiveFrom || now,
      effectiveTo: input.effectiveTo || null,
      assignedBy: actor.name,
      createdAt: now,
    };

    this.userAssignments.set(id, assignment);

    this.recordChange({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      entityType: 'ASSIGNMENT',
      entityId: id,
      entityName: `${input.userName} -> ${input.reportKey}`,
      action: 'ASSIGN',
      summary: `Assigned user '${input.userName}' duty ${input.duty} for report '${input.reportKey}'`,
      newState: assignment,
    });

    this.bumpVersion('ASSIGNMENT');
    return assignment;
  }

  public removeUserReportAssignment(id: string, actor: ActorInfo): boolean {
    const existing = this.userAssignments.get(id);
    if (!existing) return false;

    this.userAssignments.delete(id);

    this.recordChange({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      entityType: 'ASSIGNMENT',
      entityId: id,
      entityName: `${existing.userName} -> ${existing.reportKey}`,
      action: 'REVOKE',
      summary: `Removed duty ${existing.duty} for user '${existing.userName}' on report '${existing.reportKey}'`,
      oldState: existing,
    });

    this.bumpVersion('ASSIGNMENT');
    return true;
  }

  // --------------------------------------------------------------------------
  // DYNAMIC AUTHORIZATION RESOLVER
  // --------------------------------------------------------------------------

  /**
   * Authoritative backend authorization checking:
   * Resolves whether a specific user can view, edit, or approve a return
   * based on explicit assignments, home department, and special access grants.
   */
  public getAuthorizedReportsForUser(user: { id: string; role: string; department: string; specialAccessGrants?: any[] }): {
    authorizedReportKeys: string[];
    role: string;
    department: string;
    hasAdminOversight: boolean;
    hasAuditorInspection: boolean;
    directAssignments: string[];
    departmentReports: string[];
    specialAccessReports: string[];
  } {
    if (user.role === 'ADMIN') {
      const allKeys = Array.from(this.reports.keys());
      return {
        authorizedReportKeys: allKeys,
        role: 'ADMIN',
        department: user.department,
        hasAdminOversight: true,
        hasAuditorInspection: false,
        directAssignments: [],
        departmentReports: allKeys,
        specialAccessReports: [],
      };
    }

    if (user.role === 'AUDITOR') {
      const allKeys = Array.from(this.reports.keys());
      return {
        authorizedReportKeys: allKeys,
        role: 'AUDITOR',
        department: user.department,
        hasAdminOversight: false,
        hasAuditorInspection: true,
        directAssignments: [],
        departmentReports: allKeys,
        specialAccessReports: [],
      };
    }

    // 1. Direct User Report Assignments
    const userAssignments = this.getUserReportAssignments({ userId: user.id })
      .filter((a) => a.isActive)
      .map((a) => a.reportKey);

    // 2. Department Report Assignments
    const homeDept = Array.from(this.departments.values()).find(
      (d) => d.name.toLowerCase() === user.department.toLowerCase() || d.id === user.department
    );
    const deptReports = homeDept
      ? this.getDepartmentReportAssignments({ departmentId: homeDept.id, activeOnly: true }).map((a) => a.reportKey)
      : [];

    // 3. Special Access Grants
    const specialReports: string[] = [];
    if (user.specialAccessGrants && Array.isArray(user.specialAccessGrants)) {
      const now = new Date();
      user.specialAccessGrants.forEach((grant) => {
        if (grant.revoked) return;
        if (grant.expiresAt && new Date(grant.expiresAt) < now) return;

        if (grant.reportKey) {
          specialReports.push(grant.reportKey);
        }
        if (grant.department) {
          const targetDept = Array.from(this.departments.values()).find(
            (d) => d.name.toLowerCase() === grant.department.toLowerCase() || d.id === grant.department
          );
          if (targetDept) {
            const deptsReports = this.getDepartmentReportAssignments({ departmentId: targetDept.id, activeOnly: true }).map(
              (a) => a.reportKey
            );
            specialReports.push(...deptsReports);
          }
        }
        if (grant.departments && Array.isArray(grant.departments)) {
          grant.departments.forEach((dName: string) => {
            const targetDept = Array.from(this.departments.values()).find(
              (d) => d.name.toLowerCase() === dName.toLowerCase() || d.id === dName
            );
            if (targetDept) {
              const deptsReports = this.getDepartmentReportAssignments({ departmentId: targetDept.id, activeOnly: true }).map(
                (a) => a.reportKey
              );
              specialReports.push(...deptsReports);
            }
          });
        }
      });
    }

    const combined = Array.from(new Set([...userAssignments, ...deptReports, ...specialReports]));

    return {
      authorizedReportKeys: combined,
      role: user.role,
      department: user.department,
      hasAdminOversight: false,
      hasAuditorInspection: false,
      directAssignments: userAssignments,
      departmentReports: deptReports,
      specialAccessReports: specialReports,
    };
  }

  // --------------------------------------------------------------------------
  // ROLES, PERMISSIONS & WORKFLOWS
  // --------------------------------------------------------------------------

  public getRoles(): RoleSSOT[] {
    return Array.from(this.roles.values());
  }

  public getRole(code: string): RoleSSOT | null {
    return this.roles.get(code) || null;
  }

  public updateRolePermissions(code: string, permissions: string[], actor: ActorInfo): RoleSSOT {
    const role = this.roles.get(code);
    if (!role) throw new Error(`Role '${code}' not found.`);

    const oldPerms = [...role.permissions];
    role.permissions = permissions;
    role.updatedAt = new Date().toISOString();
    this.roles.set(code, role);

    this.recordChange({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      entityType: 'ROLE',
      entityId: code,
      entityName: role.name,
      action: 'UPDATE',
      summary: `Updated permissions for role '${code}'`,
      oldState: { permissions: oldPerms },
      newState: { permissions },
    });

    this.bumpVersion('RBAC');
    return role;
  }

  public getPermissions(): PermissionSSOT[] {
    return Array.from(this.permissions.values());
  }

  public getWorkflows(): WorkflowDefinitionSSOT[] {
    return Array.from(this.workflows.values());
  }

  public getWorkflowForReport(reportKey: string): WorkflowDefinitionSSOT {
    // Find workflow explicitly bound to report or fallback to default standard four-eyes
    for (const wf of this.workflows.values()) {
      if (wf.isActive && wf.applicableReports.includes(reportKey)) {
        return wf;
      }
    }
    return this.workflows.get('WF_STANDARD_FOUR_EYES')!;
  }
}

// Export singleton instance
export const configService = new ConfigurationEngine();
