/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserSafeEventEmitter } from '../utils/browserEventEmitter.ts';
import {
  configService,
  type ActorInfo,
  type ReportVersionSSOT,
  type DepartmentSSOT,
  type ReportDefinitionSSOT,
  type ReportFrequency,
  type ReportSectionSSOT,
  type ReportFieldSSOT,
  type ReportColumnSSOT,
} from './configService.ts';
import { departmentService } from './departmentService.ts';
import { userService, type UserAccount } from './userService.ts';
import { submissionService } from './submissionService.ts';
import type { ReportSubmission } from '../types/regulatory.ts';
import { auditService } from './auditService.ts';
import { realtimeSsotEngine } from './realtimeSsotEngine.ts';
import { getAllReports, getReportByKey } from '../data/report-registry.ts';
import { nbeEndpointRegistry, type ReportIntegrationConfigSSOT } from './nbeEndpointRegistry.ts';

// ============================================================================
// 1. DATA CONTRACTS & GOVERNANCE TYPES (Phase 8 Specification)
// ============================================================================

export type GovernanceRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type GovernanceProposalStatus =
  | 'DRAFT'
  | 'VALIDATED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'PUBLISHED'
  | 'EFFECTIVE'
  | 'ROLLED_BACK'
  | 'CANCELLED';

export type GovernanceEntityType =
  | 'REPORT_DEFINITION'
  | 'REPORT_TEMPLATE'
  | 'REPORT_VERSION'
  | 'DEPARTMENT'
  | 'ASSIGNMENT_DEPARTMENT'
  | 'ASSIGNMENT_USER'
  | 'SPECIAL_ACCESS'
  | 'WORKFLOW_DEFINITION'
  | 'ROLE_PERMISSION'
  | 'GENERAL_CONFIG';

export type GovernanceActionType =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'VERSION_BUMP'
  | 'ASSIGN'
  | 'REVOKE'
  | 'ROLLBACK'
  | 'RESTRUCTURE'
  | 'RETIRE';

export interface GovernanceAffectedUser {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  reason: string;
}

export interface GovernanceAffectedDepartment {
  id: string;
  name: string;
  shortCode: string;
  reason: string;
}

export interface GovernanceAffectedReport {
  returnKey: string;
  title: string;
  frequency: string;
  reason: string;
}

export interface GovernanceAffectedWorkflow {
  id: string;
  name: string;
  stepCount: number;
  reason: string;
}

export interface GovernanceAffectedPermission {
  role: string;
  permissionCode: string;
  action: 'ADDED' | 'REMOVED' | 'MODIFIED';
}

export interface GovernanceAffectedSubmissions {
  draftCount: number;
  submittedCount: number;
  approvedCount: number;
  sentCount: number;
  historicalPreserved: boolean;
  note: string;
}

export interface ImpactAnalysisResult {
  analyzedAt: string;
  riskLevel: GovernanceRiskLevel;
  riskReason: string;
  affectedUsers: GovernanceAffectedUser[];
  affectedDepartments: GovernanceAffectedDepartment[];
  affectedReports: GovernanceAffectedReport[];
  affectedWorkflows: GovernanceAffectedWorkflow[];
  affectedPermissions: GovernanceAffectedPermission[];
  affectedSubmissions: GovernanceAffectedSubmissions;
  requiresDualApproval: boolean;
  breakingChanges: string[];
}

export interface GovernanceApprovalRecord {
  approverId: string;
  approverName: string;
  approverRole: string;
  decision: 'APPROVED' | 'REJECTED';
  comments: string;
  timestamp: string;
}

export interface GovernanceProposalDiff {
  field: string;
  oldValue: any;
  newValue: any;
}

export interface GovernanceProposal {
  id: string;
  title: string;
  description: string;
  category: string;
  entityType: GovernanceEntityType;
  entityId: string;
  entityName: string;
  actionType: GovernanceActionType;
  riskLevel: GovernanceRiskLevel;
  status: GovernanceProposalStatus;
  proposer: {
    id: string;
    name: string;
    role: string;
    department?: string;
  };
  createdAt: string;
  updatedAt: string;
  effectiveFrom: string; // ISO 8601
  effectiveTo: string | null;
  expectedEntityVersion: number;
  expectedConfigHash?: string;
  proposedChanges: {
    beforeState: any; // Secrets scrubbed!
    afterState: any;  // Secrets scrubbed!
    diff: GovernanceProposalDiff[];
  };
  validationResult: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    validatedAt?: string;
    validatedBy?: string;
  };
  impactAnalysis: ImpactAnalysisResult;
  approvals: GovernanceApprovalRecord[];
  rejectionReason?: string;
  publication?: {
    publishedAt: string;
    publishedBy: { id: string; name: string; role: string };
    resultingVersionNumber: number;
    resultingConfigHash: string;
  };
  rollbackInfo?: {
    isRollback: boolean;
    revertsProposalId?: string;
    revertsVersion?: number;
    rolledBackAt?: string;
    rolledBackBy?: { id: string; name: string; role: string };
    rollbackReason?: string;
  };
}

export interface GovernanceAuditExplanation {
  changeId: string;
  proposalId: string;
  actor: { id: string; name: string; role: string };
  timestamp: string;
  entity: { type: string; id: string; name: string };
  action: string;
  beforeState: any;
  afterState: any;
  diff: GovernanceProposalDiff[];
  reason: string;
  approval: {
    approvedBy: string;
    approvedAt: string;
    approverRole: string;
    comments?: string;
    decision: string;
    isDualApproved: boolean;
  } | null;
  effectiveDate: {
    effectiveFrom: string;
    effectiveTo: string | null;
    isCurrentlyEffective: boolean;
  };
  version: {
    versionNumber: number;
    previousVersion?: number;
  };
  impactSummary: {
    affectedUsersCount: number;
    affectedDeptsCount: number;
    affectedReportsCount: number;
    affectedSubmissionsCount: number;
    summaryNarrative: string;
  };
}

export interface GovernanceNotification {
  id: string;
  recipientUserId: string;
  recipientName: string;
  recipientEmail: string;
  proposalId: string;
  title: string;
  message: string;
  riskLevel: GovernanceRiskLevel;
  effectiveFrom: string;
  createdAt: string;
  isRead: boolean;
}

// ============================================================================
// 2. SECRET SANITIZER (Non-Negotiable: Never store secrets in audit logs)
// ============================================================================

const SENSITIVE_KEY_PATTERN = /(password|secret|hash|token|credential|privatekey|pin|apikey|salt)/i;

export function sanitizeGovernanceState<T = any>(input: T): T {
  if (input === null || input === undefined) return input;
  if (typeof input !== 'object') return input;

  if (Array.isArray(input)) {
    return input.map((item) => sanitizeGovernanceState(item)) as unknown as T;
  }

  const cleanObj: Record<string, any> = {};
  for (const [key, value] of Object.entries(input as Record<string, any>)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      cleanObj[key] = '[REDACTED_FOR_SECURITY]';
    } else if (value && typeof value === 'object') {
      cleanObj[key] = sanitizeGovernanceState(value);
    } else {
      cleanObj[key] = value;
    }
  }
  return cleanObj as T;
}

// ============================================================================
// 3. CONFIGURATION GOVERNANCE ENGINE
// ============================================================================

const PROPOSALS_STORAGE_KEY = 'ob_governance_proposals_v1';
const NOTIFICATIONS_STORAGE_KEY = 'ob_governance_notifications_v1';

class ConfigurationGovernanceEngine extends BrowserSafeEventEmitter {
  private proposals: Map<string, GovernanceProposal> = new Map();
  private notifications: GovernanceNotification[] = [];
  private entityVersions: Map<string, number> = new Map(); // entityKey -> version number

  constructor() {
    super();
    this.hydrateFromStorage();
    this.seedInitialGovernanceRecordsIfEmpty();
  }

  // --------------------------------------------------------------------------
  // HYDRATION & PERSISTENCE
  // --------------------------------------------------------------------------

  private hydrateFromStorage(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const storedProposals = localStorage.getItem(PROPOSALS_STORAGE_KEY);
      if (storedProposals) {
        const parsed: GovernanceProposal[] = JSON.parse(storedProposals);
        parsed.forEach((p) => {
          this.proposals.set(p.id, p);
          // Track highest version per entity
          const key = `${p.entityType}:${p.entityId}`;
          const current = this.entityVersions.get(key) || 1;
          const propVersion = p.publication?.resultingVersionNumber || p.expectedEntityVersion;
          if (propVersion >= current) {
            this.entityVersions.set(key, propVersion);
          }
        });
      }

      const storedNotifs = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
      if (storedNotifs) {
        this.notifications = JSON.parse(storedNotifs);
      }
    } catch (err) {
      console.warn('[ConfigurationGovernance] Storage hydration error:', err);
    }
  }

  private persist(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(PROPOSALS_STORAGE_KEY, JSON.stringify(Array.from(this.proposals.values())));
      localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(this.notifications.slice(0, 500)));
    } catch (err) {
      console.warn('[ConfigurationGovernance] Storage persist error:', err);
    }
  }

  private seedInitialGovernanceRecordsIfEmpty(): void {
    if (this.proposals.size > 0) return;

    const now = new Date().toISOString();
    const seedProposal: GovernanceProposal = {
      id: 'gov_prop_seed_bsd01_baseline',
      title: 'Baseline Return Template Configuration (BSD/01/2020)',
      description: 'Authoritative statutory baseline return definition for BSD-01 (Daily Liquidity & Reserve Computation)',
      category: 'REPORT_TEMPLATE',
      entityType: 'REPORT_DEFINITION',
      entityId: 'BSD_01',
      entityName: 'BSD-01: Daily Liquidity & Reserve Computation',
      actionType: 'CREATE',
      riskLevel: 'LOW',
      status: 'PUBLISHED',
      proposer: {
        id: 'usr_admin',
        name: 'Abebe Bikila',
        role: 'ADMIN',
        department: 'Compliance & Legal Governance',
      },
      createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 30).toISOString(),
      effectiveFrom: '2026-01-01T00:00:00.000Z',
      effectiveTo: null,
      expectedEntityVersion: 1,
      expectedConfigHash: 'hash_bsd01_baseline_v1',
      proposedChanges: {
        beforeState: null,
        afterState: { returnKey: 'BSD_01', status: 'ACTIVE', version: 1 },
        diff: [{ field: 'status', oldValue: null, newValue: 'ACTIVE' }],
      },
      validationResult: {
        isValid: true,
        errors: [],
        warnings: [],
        validatedAt: new Date(Date.now() - 86400000 * 30).toISOString(),
        validatedBy: 'System Validator',
      },
      impactAnalysis: {
        analyzedAt: new Date(Date.now() - 86400000 * 30).toISOString(),
        riskLevel: 'LOW',
        riskReason: 'Initial statutory platform configuration',
        affectedUsers: [],
        affectedDepartments: [{ id: 'dept_treasury', name: 'Treasury & International Banking', shortCode: 'TREAS', reason: 'Primary Owner' }],
        affectedReports: [{ returnKey: 'BSD_01', title: 'Daily Liquidity & Reserve Computation', frequency: 'MONTHLY', reason: 'Template baseline' }],
        affectedWorkflows: [{ id: 'WF_STANDARD_FOUR_EYES', name: 'Standard 4-Eyes Supervisory Return', stepCount: 4, reason: 'Governing workflow' }],
        affectedPermissions: [],
        affectedSubmissions: { draftCount: 0, submittedCount: 0, approvedCount: 0, sentCount: 0, historicalPreserved: true, note: 'Initial baseline setup' },
        requiresDualApproval: false,
        breakingChanges: [],
      },
      approvals: [
        {
          approverId: 'usr_checker_seed',
          approverName: 'Almaz Ayana',
          approverRole: 'CHECKER',
          decision: 'APPROVED',
          comments: 'Statutory BSD/01/2020 structure confirmed',
          timestamp: new Date(Date.now() - 86400000 * 29).toISOString(),
        },
      ],
      publication: {
        publishedAt: new Date(Date.now() - 86400000 * 29).toISOString(),
        publishedBy: { id: 'usr_admin', name: 'Abebe Bikila', role: 'ADMIN' },
        resultingVersionNumber: 1,
        resultingConfigHash: 'hash_bsd01_baseline_v1',
      },
    };

    this.proposals.set(seedProposal.id, seedProposal);
    this.entityVersions.set('REPORT_DEFINITION:BSD_01', 1);
    this.persist();
  }

  // --------------------------------------------------------------------------
  // CONCURRENCY & OPTIMISTIC LOCKING
  // --------------------------------------------------------------------------

  public getEntityCurrentVersion(entityType: GovernanceEntityType, entityId: string): number {
    const key = `${entityType}:${entityId}`;
    if (this.entityVersions.has(key)) {
      return this.entityVersions.get(key)!;
    }

    // Attempt resolution from configService
    if (entityType === 'REPORT_DEFINITION' || entityType === 'REPORT_VERSION') {
      const rep = configService.getReportDefinition(entityId);
      if (rep) {
        const v = rep.currentVersion || 1;
        this.entityVersions.set(key, v);
        return v;
      }
    } else if (entityType === 'DEPARTMENT') {
      const dept = departmentService.getById(entityId) || departmentService.getByShortCode(entityId);
      if (dept) {
        const v = 1;
        this.entityVersions.set(key, v);
        return v;
      }
    }

    return 1;
  }

  public setEntityCurrentVersion(entityType: GovernanceEntityType, entityId: string, version: number): void {
    const key = `${entityType}:${entityId}`;
    this.entityVersions.set(key, version);
  }

  public assertConcurrency(
    entityType: GovernanceEntityType,
    entityId: string,
    expectedVersion: number,
    actorName: string
  ): void {
    const currentVersion = this.getEntityCurrentVersion(entityType, entityId);
    if (currentVersion !== expectedVersion) {
      throw new Error(
        `CONCURRENCY_CONFLICT: Configuration for '${entityType}:${entityId}' has been modified by another administrator since you opened it. Expected Version ${expectedVersion}, but current authoritative version is ${currentVersion}. Please reload the latest state before reapplying your changes.`
      );
    }
  }

  // --------------------------------------------------------------------------
  // RISK CLASSIFICATION ENGINE
  // --------------------------------------------------------------------------

  public classifyRisk(
    entityType: GovernanceEntityType,
    actionType: GovernanceActionType,
    beforeState: any,
    afterState: any,
    diff: GovernanceProposalDiff[]
  ): { riskLevel: GovernanceRiskLevel; reason: string } {
    // 1. CRITICAL Risk: Roles, permissions, security directives, or deletion of core returns
    if (entityType === 'ROLE_PERMISSION') {
      return {
        riskLevel: 'CRITICAL',
        reason: 'Modifications to RBAC role matrix or permission grants affect enterprise-wide authorization and segregation of duties.',
      };
    }

    if (actionType === 'DELETE' || actionType === 'RETIRE') {
      if (entityType === 'REPORT_DEFINITION' || entityType === 'DEPARTMENT') {
        return {
          riskLevel: 'CRITICAL',
          reason: `Decommissioning/deleting an active ${entityType} impacts statutory compliance and operational returns.`,
        };
      }
    }

    // 2. HIGH Risk: Formula changes, field removals, department restructuring, primary ownership changes, rollbacks
    if (actionType === 'ROLLBACK') {
      return {
        riskLevel: 'HIGH',
        reason: 'Reverting configuration to an earlier version modifies live schemas and operational expectations.',
      };
    }

    if (entityType === 'REPORT_DEFINITION' || entityType === 'REPORT_TEMPLATE' || entityType === 'REPORT_VERSION') {
      const hasFormulaChange = diff.some(
        (d) => d.field.toLowerCase().includes('formula') || d.field.toLowerCase().includes('expression')
      );
      if (hasFormulaChange) {
        return {
          riskLevel: 'HIGH',
          reason: 'Mathematical formula alteration changes statutory computation and automated balance check rules.',
        };
      }

      const hasFieldRemoval = diff.some(
        (d) => d.field.toLowerCase().includes('items') || d.field.toLowerCase().includes('fields')
      );
      if (hasFieldRemoval && beforeState && afterState) {
        const beforeCount = beforeState.fields?.length || beforeState.ReturnItemsList?.length || 0;
        const afterCount = afterState.fields?.length || afterState.ReturnItemsList?.length || 0;
        if (afterCount < beforeCount) {
          return {
            riskLevel: 'HIGH',
            reason: 'Removing return fields introduces structural breaking changes for active returns and submissions.',
          };
        }
      }
    }

    if (entityType === 'DEPARTMENT' && (actionType === 'UPDATE' || actionType === 'RESTRUCTURE')) {
      const touchesHierarchy = diff.some(
        (d) => d.field === 'parentId' || d.field === 'hierarchyLevel' || d.field === 'status'
      );
      if (touchesHierarchy) {
        return {
          riskLevel: 'HIGH',
          reason: 'Departmental hierarchy restructuring alters organizational reporting lines and access scope inheritance.',
        };
      }
    }

    if (entityType === 'WORKFLOW_DEFINITION') {
      return {
        riskLevel: 'HIGH',
        reason: 'Altering regulatory submission workflow steps changes 4-eyes review and approval stages.',
      };
    }

    // 3. MEDIUM Risk: Adding optional fields, changing department description/contact, contributor assignments
    if (entityType === 'REPORT_DEFINITION' || entityType === 'REPORT_TEMPLATE' || entityType === 'REPORT_VERSION') {
      return {
        riskLevel: 'MEDIUM',
        reason: 'Report structure or schedule metadata modified without deleting existing fields or altering formulas.',
      };
    }

    if (entityType === 'ASSIGNMENT_DEPARTMENT' || entityType === 'ASSIGNMENT_USER' || entityType === 'SPECIAL_ACCESS') {
      return {
        riskLevel: 'MEDIUM',
        reason: 'Return assignment or special access grant modifies operational responsibility.',
      };
    }

    if (entityType === 'DEPARTMENT') {
      return {
        riskLevel: 'MEDIUM',
        reason: 'Department descriptive attributes or non-structural parameters modified.',
      };
    }

    // 4. LOW Risk: Minor descriptive notes, cosmetic labels, harmless edits
    return {
      riskLevel: 'LOW',
      reason: 'Harmless informational or non-structural metadata change. Auto-approval permitted.',
    };
  }

  // --------------------------------------------------------------------------
  // IMPACT ANALYSIS ENGINE
  // --------------------------------------------------------------------------

  public calculateImpactAnalysis(
    entityType: GovernanceEntityType,
    entityId: string,
    actionType: GovernanceActionType,
    beforeState: any,
    afterState: any,
    diff: GovernanceProposalDiff[]
  ): ImpactAnalysisResult {
    const { riskLevel, reason: riskReason } = this.classifyRisk(
      entityType,
      actionType,
      beforeState,
      afterState,
      diff
    );

    const affectedUsers: GovernanceAffectedUser[] = [];
    const affectedDepartments: GovernanceAffectedDepartment[] = [];
    const affectedReports: GovernanceAffectedReport[] = [];
    const affectedWorkflows: GovernanceAffectedWorkflow[] = [];
    const affectedPermissions: GovernanceAffectedPermission[] = [];
    const breakingChanges: string[] = [];

    const allUsers = userService.getAll();
    const allDepts = departmentService.getAll();
    const allSubmissions = submissionService.getAll();

    // 1. Report Impacts
    if (entityType === 'REPORT_DEFINITION' || entityType === 'REPORT_TEMPLATE' || entityType === 'REPORT_VERSION') {
      const reportKey = entityId;
      const rep = configService.getReportDefinition(reportKey) || getReportByKey(reportKey);
      const repTitle = rep ? (rep as any).name || (rep as any).Title : reportKey;

      affectedReports.push({
        returnKey: reportKey,
        title: repTitle,
        frequency: (rep as any)?.frequency || (rep as any)?.Frequency || 'MONTHLY',
        reason: `Target of ${actionType} proposal`,
      });

      // Find assigned departments via configService, departmentService, or report definition default department
      const deptAssignments = configService.getDepartmentReportAssignments({ reportKey });
      deptAssignments.forEach((da) => {
        if (!affectedDepartments.some((d) => d.id === da.departmentId)) {
          affectedDepartments.push({
            id: da.departmentId,
            name: da.departmentName,
            shortCode: da.departmentId,
            reason: `Assigned as ${da.role} for ${reportKey}`,
          });
        }
      });

      const deptsFromService = departmentService.getDepartmentsForReport(reportKey);
      deptsFromService.forEach((dName) => {
        if (!affectedDepartments.some((d) => d.name === dName)) {
          const dObj = departmentService.getByName(dName);
          affectedDepartments.push({
            id: dObj?.id || dName,
            name: dName,
            shortCode: dObj?.shortCode || dName,
            reason: `Mapped organizational return owner for ${reportKey}`,
          });
        }
      });

      if (rep && (rep as any).defaultDepartmentId) {
        const defDeptId = (rep as any).defaultDepartmentId;
        const dObj = departmentService.getById(defDeptId) || departmentService.getByName(defDeptId);
        if (dObj && !affectedDepartments.some((d) => d.id === dObj.id)) {
          affectedDepartments.push({
            id: dObj.id,
            name: dObj.name,
            shortCode: dObj.shortCode,
            reason: `Default department owner for ${reportKey}`,
          });
        }
      }

      // Find assigned users
      const userAssignments = configService.getUserReportAssignments({ reportKey });
      userAssignments.forEach((ua) => {
        affectedUsers.push({
          id: ua.userId,
          name: ua.userName,
          email: ua.userEmail,
          role: ua.duty,
          department: ua.departmentId,
          reason: `Assigned duty ${ua.duty} on ${reportKey}`,
        });
      });

      // Also include users belonging to affected departments
      affectedDepartments.forEach((da) => {
        allUsers.forEach((u) => {
          if (
            (u.department === da.name || u.department === da.id || u.department === da.shortCode) &&
            !affectedUsers.some((au) => au.id === u.id)
          ) {
            affectedUsers.push({
              id: u.id,
              name: u.name,
              email: u.email,
              role: u.role,
              department: u.department,
              reason: `Belongs to assigned department '${da.name}'`,
            });
          }
        });
      });

      // If still empty, include active Checkers and Compliance Admins as supervisors
      if (affectedUsers.length === 0) {
        allUsers
          .filter((u) => u.role === 'CHECKER' || u.role === 'ADMIN')
          .slice(0, 5)
          .forEach((u) => {
            affectedUsers.push({
              id: u.id,
              name: u.name,
              email: u.email,
              role: u.role,
              department: u.department,
              reason: `Regulatory supervisor for return ${reportKey}`,
            });
          });
      }

      // Workflows
      const wf = configService.getWorkflowForReport(reportKey);
      if (wf) {
        affectedWorkflows.push({
          id: wf.id,
          name: wf.name,
          stepCount: wf.steps.length,
          reason: `Governs submission lifecycle for ${reportKey}`,
        });
      }

      // Check for breaking changes
      if (diff.some((d) => d.field.toLowerCase().includes('formula'))) {
        breakingChanges.push('Validation formulas altered: existing draft calculations may produce variances.');
      }
      if (actionType === 'DELETE' || actionType === 'RETIRE') {
        breakingChanges.push(`Report ${reportKey} will no longer accept new submissions.`);
      }
    }

    // 2. Department Impacts
    else if (entityType === 'DEPARTMENT') {
      const deptId = entityId;
      const dept = departmentService.getById(deptId) || departmentService.getByShortCode(deptId);
      const deptName = dept ? dept.name : deptId;
      const shortCode = dept ? dept.shortCode : deptId;

      affectedDepartments.push({
        id: deptId,
        name: deptName,
        shortCode,
        reason: `Target of ${actionType} proposal`,
      });

      // Users in department
      allUsers.forEach((u) => {
        if (u.department === deptName) {
          affectedUsers.push({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            department: u.department,
            reason: `Department member affected by reorganization or update`,
          });
        }
      });

      // Reports assigned to department
      const deptReports = departmentService.getReportsForDepartment(deptName);
      deptReports.forEach((rk) => {
        const rep = getReportByKey(rk);
        affectedReports.push({
          returnKey: rk,
          title: rep?.Title || rk,
          frequency: rep?.Frequency || 'MONTHLY',
          reason: `Assigned return of department '${deptName}'`,
        });
      });

      if (actionType === 'DELETE' || (beforeState?.status === 'ACTIVE' && afterState?.status === 'INACTIVE')) {
        breakingChanges.push(`Department '${deptName}' deactivated: linked reports must be reassigned.`);
      }
    }

    // 3. User Report Assignment Impacts
    else if (entityType === 'ASSIGNMENT_USER') {
      const userId = afterState?.userId || beforeState?.userId;
      const reportKey = afterState?.reportKey || beforeState?.reportKey;
      const user = allUsers.find((u) => u.id === userId || u.email === userId);
      if (user) {
        affectedUsers.push({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
          reason: `Direct operational assignment ${actionType.toLowerCase()}ed for ${reportKey}`,
        });
      }
      if (reportKey) {
        const rep = getReportByKey(reportKey);
        affectedReports.push({
          returnKey: rep?.ReturnKey || reportKey,
          title: rep?.Title || reportKey,
          frequency: rep?.Frequency || 'MONTHLY',
          reason: `Assigned user duty modified`,
        });
      }
    }

    // 4. Role & Permission Impacts
    else if (entityType === 'ROLE_PERMISSION') {
      const roleCode = entityId;
      allUsers.forEach((u) => {
        if (u.role === roleCode) {
          affectedUsers.push({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            department: u.department,
            reason: `User holds role '${roleCode}' with modified permissions`,
          });
        }
      });

      diff.forEach((d) => {
        affectedPermissions.push({
          role: roleCode,
          permissionCode: d.field,
          action: 'MODIFIED',
        });
      });
      breakingChanges.push(`Permissions for role '${roleCode}' updated: may impact user authorization matrix.`);
    }

    // 5. Active & Historical Submissions Impact
    let relevantSubmissions: ReportSubmission[] = [];
    if (affectedReports.length > 0) {
      const reportKeySet = new Set(affectedReports.map((r) => r.returnKey));
      relevantSubmissions = allSubmissions.filter((s) => reportKeySet.has(s.reportKey));
    } else {
      relevantSubmissions = [];
    }

    const draftCount = relevantSubmissions.filter((s) => s.status === 'DRAFT').length;
    const submittedCount = relevantSubmissions.filter((s) => s.status === 'PENDING_CHECKER').length;
    const approvedCount = relevantSubmissions.filter((s) => s.status === 'APPROVED').length;
    const sentCount = relevantSubmissions.filter((s) => s.status === 'SENT').length;

    const affectedSubmissions: GovernanceAffectedSubmissions = {
      draftCount,
      submittedCount,
      approvedCount,
      sentCount,
      historicalPreserved: true,
      note: 'Immutable Versioning: Past submitted and signed returns remain permanently pinned to their submission version schema. No historical data will be altered or lost.',
    };

    const requiresDualApproval = riskLevel === 'HIGH' || riskLevel === 'CRITICAL';

    return {
      analyzedAt: new Date().toISOString(),
      riskLevel,
      riskReason,
      affectedUsers,
      affectedDepartments,
      affectedReports,
      affectedWorkflows,
      affectedPermissions,
      affectedSubmissions,
      requiresDualApproval,
      breakingChanges,
    };
  }

  // --------------------------------------------------------------------------
  // LIFECYCLE: 1. CREATE DRAFT
  // --------------------------------------------------------------------------

  public createProposalDraft(
    input: {
      title: string;
      description: string;
      category?: string;
      entityType: GovernanceEntityType;
      entityId: string;
      entityName: string;
      actionType: GovernanceActionType;
      effectiveFrom?: string;
      effectiveTo?: string | null;
      proposedBeforeState: any;
      proposedAfterState: any;
      diff?: GovernanceProposalDiff[];
      expectedEntityVersion?: number;
    },
    proposer: { id: string; name: string; role: string; department?: string }
  ): GovernanceProposal {
    // Sanitize states so no secrets ever leak into governance records
    const cleanBefore = sanitizeGovernanceState(input.proposedBeforeState);
    const cleanAfter = sanitizeGovernanceState(input.proposedAfterState);

    // Compute diff if not provided
    const diff = input.diff || this.computeDiff(cleanBefore, cleanAfter);

    const expectedVersion =
      input.expectedEntityVersion ?? this.getEntityCurrentVersion(input.entityType, input.entityId);

    // Run initial impact analysis
    const impact = this.calculateImpactAnalysis(
      input.entityType,
      input.entityId,
      input.actionType,
      cleanBefore,
      cleanAfter,
      diff
    );

    const now = new Date().toISOString();
    const proposalId = `gov_prop_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const proposal: GovernanceProposal = {
      id: proposalId,
      title: input.title,
      description: input.description,
      category: input.category || 'GENERAL_CONFIG',
      entityType: input.entityType,
      entityId: input.entityId,
      entityName: input.entityName,
      actionType: input.actionType,
      riskLevel: impact.riskLevel,
      status: 'DRAFT',
      proposer: {
        id: proposer.id,
        name: proposer.name,
        role: proposer.role,
        department: proposer.department,
      },
      createdAt: now,
      updatedAt: now,
      effectiveFrom: input.effectiveFrom || now,
      effectiveTo: input.effectiveTo || null,
      expectedEntityVersion: expectedVersion,
      proposedChanges: {
        beforeState: cleanBefore,
        afterState: cleanAfter,
        diff,
      },
      validationResult: {
        isValid: false,
        errors: [],
        warnings: [],
      },
      impactAnalysis: impact,
      approvals: [],
    };

    this.proposals.set(proposal.id, proposal);
    this.persist();

    // Audit creation
    auditService.log({
      actorId: proposer.id,
      actorName: proposer.name,
      actorRole: proposer.role,
      action: 'GOVERNANCE_PROPOSAL_DRAFTED',
      entityType: 'GOVERNANCE_PROPOSAL',
      entityId: proposal.id,
      correlationId: `corr_gov_${proposal.id}`,
      details: `Drafted configuration change proposal '${proposal.title}' (Risk: ${proposal.riskLevel})`,
      newState: { proposalId: proposal.id, title: proposal.title, riskLevel: proposal.riskLevel },
    });

    this.emit('proposal:created', proposal);
    return proposal;
  }

  /**
   * Phase 34: Administrator Template Governance Workflow
   * Proposes modifications to report definition, titles, descriptions, line items,
   * schedules, formulas, validation rules, or endpoints.
   * Runs automated impact analysis, enforces 4-eyes dual control on high-impact changes,
   * and upon publication, safely increments version while preserving historical returns.
   */
  public proposeReportDefinitionChange(
    reportKey: string,
    updates: {
      title?: string;
      name?: string;
      code?: string;
      description?: string;
      category?: string;
      frequency?: ReportFrequency;
      defaultDepartmentId?: string;
      departmentIds?: string[];
      sections?: ReportSectionSSOT[];
      fields?: ReportFieldSSOT[];
      columns?: ReportColumnSSOT[];
      formulas?: any[];
      validationRules?: any[];
      nbeMapping?: Record<string, any>;
      endpointConfig?: Partial<ReportIntegrationConfigSSOT>;
      reason: string;
    },
    proposer: { id: string; name: string; role: string; department?: string }
  ): GovernanceProposal {
    if (!proposer || proposer.role !== 'ADMIN') {
      throw new Error(
        `ROLE_FORBIDDEN: Only Compliance Administrators can propose modifications to report definitions. User role '${proposer?.role || 'ANONYMOUS'}' is restricted to data entry.`
      );
    }

    const normKey = reportKey.trim().toUpperCase();
    const existing = configService.getReportDefinition(normKey);
    if (!existing) {
      throw new Error(`Report definition '${normKey}' not found.`);
    }

    const currentVersion = existing.currentVersion || 1;
    const activeVersion = configService.getActiveVersion(normKey) || configService.getReportVersion(normKey, currentVersion);

    const beforeState = {
      name: existing.name,
      code: existing.code,
      description: existing.description,
      category: existing.category,
      frequency: existing.frequency,
      defaultDepartmentId: existing.defaultDepartmentId,
      departmentIds: existing.departmentIds || [],
      sections: activeVersion?.sections || [],
      fields: activeVersion?.fields || [],
      columns: activeVersion?.columns || [],
      formulas: activeVersion?.formulas || [],
      validationRules: activeVersion?.validationRules || [],
      nbeMapping: existing.nbeMapping || {},
    };

    const targetName = updates.name || updates.title || existing.name;
    const afterState = {
      ...beforeState,
      name: targetName,
      code: updates.code ? updates.code.toUpperCase() : existing.code,
      description: updates.description !== undefined ? updates.description : existing.description,
      category: updates.category || existing.category,
      frequency: updates.frequency || existing.frequency,
      defaultDepartmentId: updates.defaultDepartmentId || existing.defaultDepartmentId,
      departmentIds: updates.departmentIds || existing.departmentIds,
      sections: updates.sections || beforeState.sections,
      fields: updates.fields || beforeState.fields,
      columns: updates.columns || beforeState.columns,
      formulas: updates.formulas || beforeState.formulas,
      validationRules: updates.validationRules || beforeState.validationRules,
      nbeMapping: updates.nbeMapping || beforeState.nbeMapping,
    };

    const diff = this.computeDiff(beforeState, afterState);
    const hasStructuralChanges = Boolean(
      updates.fields || updates.columns || updates.sections || updates.formulas || updates.validationRules
    );
    const actionType: GovernanceActionType = hasStructuralChanges ? 'VERSION_BUMP' : 'UPDATE';

    return this.createProposalDraft(
      {
        title: `Governed Update for ${existing.name} (${normKey})`,
        description: updates.reason || `Administrative template governance change for ${normKey}`,
        category: 'REPORT_TEMPLATE',
        entityType: 'REPORT_DEFINITION',
        entityId: normKey,
        entityName: targetName,
        actionType,
        proposedBeforeState: beforeState,
        proposedAfterState: afterState,
        diff,
        expectedEntityVersion: currentVersion,
      },
      proposer
    );
  }

  // --------------------------------------------------------------------------
  // LIFECYCLE: 2. VALIDATE PROPOSAL
  // --------------------------------------------------------------------------

  public validateProposal(proposalId: string, validator: { id: string; name: string; role: string }): GovernanceProposal {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error(`Proposal '${proposalId}' not found.`);

    const errors: string[] = [];
    const warnings: string[] = [];

    // Structural checks
    if (!proposal.title || proposal.title.trim().length < 5) {
      errors.push('Proposal title must be at least 5 characters.');
    }
    if (!proposal.description || proposal.description.trim().length < 10) {
      errors.push('Business justification / description must be at least 10 characters.');
    }
    if (!proposal.entityId) {
      errors.push('Target entity identifier is missing.');
    }

    // Effective dates sanity check
    if (proposal.effectiveTo && new Date(proposal.effectiveTo) < new Date(proposal.effectiveFrom)) {
      errors.push('Effective To date cannot be earlier than Effective From date.');
    }

    // Specific domain validations
    if (proposal.entityType === 'REPORT_TEMPLATE' || proposal.entityType === 'REPORT_VERSION') {
      const after = proposal.proposedChanges.afterState;
      if (after && Array.isArray(after.fields)) {
        const itemIds = new Set<string>();
        after.fields.forEach((f: any, idx: number) => {
          if (!f.itemCode && !f.itemId) {
            errors.push(`Field at index ${idx} is missing itemCode.`);
          }
          const id = f.itemCode || f.itemId;
          if (itemIds.has(id)) {
            errors.push(`Duplicate field itemCode '${id}' detected in proposed template.`);
          }
          itemIds.add(id);
        });
      }
    }

    // Concurrency sanity check
    const currentVersion = this.getEntityCurrentVersion(proposal.entityType, proposal.entityId);
    if (currentVersion !== proposal.expectedEntityVersion) {
      warnings.push(
        `Authoritative version has advanced to Version ${currentVersion} (proposal was drafted at Version ${proposal.expectedEntityVersion}). Please review changes before publishing.`
      );
    }

    proposal.validationResult = {
      isValid: errors.length === 0,
      errors,
      warnings,
      validatedAt: new Date().toISOString(),
      validatedBy: validator.name,
    };

    if (errors.length === 0) {
      proposal.status = proposal.impactAnalysis.requiresDualApproval ? 'PENDING_APPROVAL' : 'VALIDATED';
    } else {
      proposal.status = 'DRAFT';
    }

    proposal.updatedAt = new Date().toISOString();
    this.proposals.set(proposal.id, proposal);
    this.persist();

    auditService.log({
      actorId: validator.id,
      actorName: validator.name,
      actorRole: validator.role,
      action: 'GOVERNANCE_PROPOSAL_VALIDATED',
      entityType: 'GOVERNANCE_PROPOSAL',
      entityId: proposal.id,
      correlationId: `corr_gov_${proposal.id}`,
      details: `Validated proposal '${proposal.title}': ${errors.length === 0 ? 'PASSED' : 'FAILED with ' + errors.length + ' error(s)'}`,
      newState: proposal.validationResult,
    });

    this.emit('proposal:validated', proposal);
    return proposal;
  }

  // --------------------------------------------------------------------------
  // LIFECYCLE: 3. REVIEW & APPROVE (Segregation of Duties / 4-Eyes Check)
  // --------------------------------------------------------------------------

  public approveProposal(
    proposalId: string,
    approver: { id: string; name: string; role: string; department?: string },
    comments: string
  ): GovernanceProposal {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error(`Proposal '${proposalId}' not found.`);

    if (proposal.status !== 'PENDING_APPROVAL' && proposal.status !== 'VALIDATED') {
      throw new Error(`Cannot approve proposal in '${proposal.status}' status. Must be PENDING_APPROVAL or VALIDATED.`);
    }

    // 4-EYES SEGREGATION OF DUTIES ENFORCEMENT:
    // Proposer CANNOT approve their own HIGH or CRITICAL risk changes!
    if (proposal.impactAnalysis.requiresDualApproval) {
      if (proposal.proposer.id === approver.id) {
        throw new Error(
          `SEGREGATION_OF_DUTIES_VIOLATION: Proposer '${approver.name}' cannot approve their own high-impact configuration change. Under NBE BSD/03/2020 four-eyes directives, an independent Checker or Administrator must review and approve.`
        );
      }
    }

    // Approver role verification
    if (approver.role !== 'ADMIN' && approver.role !== 'CHECKER') {
      throw new Error(
        `UNAUTHORIZED_APPROVAL: Role '${approver.role}' is not authorized to approve configuration governance changes. Required: ADMIN or CHECKER.`
      );
    }

    const now = new Date().toISOString();
    const approvalRecord: GovernanceApprovalRecord = {
      approverId: approver.id,
      approverName: approver.name,
      approverRole: approver.role,
      decision: 'APPROVED',
      comments: comments || 'Approved per regulatory governance review standards.',
      timestamp: now,
    };

    proposal.approvals.push(approvalRecord);
    proposal.status = 'APPROVED';
    proposal.updatedAt = now;

    this.proposals.set(proposal.id, proposal);
    this.persist();

    auditService.log({
      actorId: approver.id,
      actorName: approver.name,
      actorRole: approver.role,
      action: 'GOVERNANCE_PROPOSAL_APPROVED',
      entityType: 'GOVERNANCE_PROPOSAL',
      entityId: proposal.id,
      correlationId: `corr_gov_${proposal.id}`,
      details: `Approved proposal '${proposal.title}' (Risk: ${proposal.riskLevel}). Comments: ${comments}`,
      newState: approvalRecord,
    });

    this.emit('proposal:approved', proposal);
    return proposal;
  }

  // --------------------------------------------------------------------------
  // LIFECYCLE: REJECT PROPOSAL
  // --------------------------------------------------------------------------

  public rejectProposal(
    proposalId: string,
    rejector: { id: string; name: string; role: string },
    rejectionReason: string
  ): GovernanceProposal {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error(`Proposal '${proposalId}' not found.`);

    if (!rejectionReason || rejectionReason.trim().length < 5) {
      throw new Error('A detailed rejection reason is required (at least 5 characters).');
    }

    const now = new Date().toISOString();
    proposal.status = 'REJECTED';
    proposal.rejectionReason = rejectionReason;
    proposal.updatedAt = now;

    proposal.approvals.push({
      approverId: rejector.id,
      approverName: rejector.name,
      approverRole: rejector.role,
      decision: 'REJECTED',
      comments: rejectionReason,
      timestamp: now,
    });

    this.proposals.set(proposal.id, proposal);
    this.persist();

    auditService.log({
      actorId: rejector.id,
      actorName: rejector.name,
      actorRole: rejector.role,
      action: 'GOVERNANCE_PROPOSAL_REJECTED',
      entityType: 'GOVERNANCE_PROPOSAL',
      entityId: proposal.id,
      correlationId: `corr_gov_${proposal.id}`,
      details: `Rejected proposal '${proposal.title}'. Reason: ${rejectionReason}`,
    });

    this.emit('proposal:rejected', proposal);
    return proposal;
  }

  // --------------------------------------------------------------------------
  // LIFECYCLE: 4. PUBLISH & APPLY (Enforces Optimistic Concurrency Locking)
  // --------------------------------------------------------------------------

  public publishProposal(
    proposalId: string,
    publisher: { id: string; name: string; role: string }
  ): { proposal: GovernanceProposal; resultingVersion: number } {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error(`Proposal '${proposalId}' not found.`);

    // Status check
    if (proposal.status !== 'APPROVED') {
      if (!(proposal.status === 'VALIDATED' && proposal.riskLevel === 'LOW')) {
        throw new Error(
          `Cannot publish proposal in status '${proposal.status}'. High/Medium risk changes require formal approval before publication.`
        );
      }
    }

    // OPTIMISTIC CONCURRENCY CHECK:
    // Prevents administrators from unknowingly overwriting each other's changes!
    this.assertConcurrency(
      proposal.entityType,
      proposal.entityId,
      proposal.expectedEntityVersion,
      publisher.name
    );

    const now = new Date().toISOString();
    const newVersionNumber = proposal.expectedEntityVersion + 1;

    // Apply the change to authoritative SSOT registries based on entityType
    this.applyProposalToAuthoritativeState(proposal, newVersionNumber, publisher);

    // Update entity version tracker
    this.setEntityCurrentVersion(proposal.entityType, proposal.entityId, newVersionNumber);

    const resultingConfigHash = `hash_${proposal.entityId}_v${newVersionNumber}_${Date.now()}`;

    proposal.publication = {
      publishedAt: now,
      publishedBy: { id: publisher.id, name: publisher.name, role: publisher.role },
      resultingVersionNumber: newVersionNumber,
      resultingConfigHash,
    };

    // Determine if effective immediately or in the future
    const isEffectiveNow = new Date(proposal.effectiveFrom) <= new Date(now);
    proposal.status = isEffectiveNow ? 'EFFECTIVE' : 'PUBLISHED';
    proposal.updatedAt = now;

    this.proposals.set(proposal.id, proposal);
    this.persist();

    // 10-Field Complete Audit Record for NBE BSD Regulatory Non-Repudiation
    auditService.log({
      actorId: publisher.id,
      actorName: publisher.name,
      actorRole: publisher.role,
      action: `CONFIG_GOVERNED_${proposal.actionType}_${proposal.entityType}`,
      entityType: proposal.entityType,
      entityId: proposal.entityId,
      correlationId: `corr_gov_${proposal.id}`,
      details: `[Governed Publication] Published '${proposal.title}' to Version ${newVersionNumber}. Status: ${proposal.status}. Impact: ${proposal.impactAnalysis.affectedUsers.length} users, ${proposal.impactAnalysis.affectedReports.length} reports.`,
      oldState: proposal.proposedChanges.beforeState,
      newState: proposal.proposedChanges.afterState,
    });

    // Notify affected users
    this.dispatchNotificationsForProposal(proposal);

    // Broadcast real-time SSOT event
    realtimeSsotEngine.publishEvent({
      eventType: 'REPORT_CHANGED',
      action: proposal.actionType,
      domain: proposal.entityType === 'DEPARTMENT' ? 'DEPARTMENT' : 'REPORT',
      entityId: proposal.entityId,
      actor: publisher,
      summary: `[Governance] Published Version ${newVersionNumber} for ${proposal.entityName}`,
      globalConfigHash: resultingConfigHash,
      payload: {
        proposalId: proposal.id,
        entityType: proposal.entityType,
        resultingVersionNumber: newVersionNumber,
        effectiveFrom: proposal.effectiveFrom,
        riskLevel: proposal.riskLevel,
      },
    });

    this.emit('proposal:published', proposal);
    return { proposal, resultingVersion: newVersionNumber };
  }

  // --------------------------------------------------------------------------
  // APPLY TO AUTHORITATIVE SSOT
  // --------------------------------------------------------------------------

  private applyProposalToAuthoritativeState(
    proposal: GovernanceProposal,
    newVersionNumber: number,
    publisher: { id: string; name: string; role: string }
  ): void {
    const after = proposal.proposedChanges.afterState;

    if (proposal.entityType === 'REPORT_DEFINITION' || proposal.entityType === 'REPORT_VERSION' || proposal.entityType === 'REPORT_TEMPLATE') {
      const returnKey = proposal.entityId;
      const rep = configService.getReportDefinition(returnKey);
      if (rep) {
        // 1. Update metadata if title, name, description, category, frequency, department linkage changed
        if (
          after?.name ||
          after?.title ||
          after?.description !== undefined ||
          after?.category ||
          after?.frequency ||
          after?.defaultDepartmentId ||
          after?.departmentIds
        ) {
          try {
            configService.updateReportDefinition(
              returnKey,
              {
                name: after.name || after.title,
                code: after.code,
                description: after.description,
                category: after.category,
                frequency: after.frequency,
                defaultDepartmentId: after.defaultDepartmentId,
                departmentIds: after.departmentIds,
                nbeMapping: after.nbeMapping,
              },
              publisher
            );
          } catch (err) {
            console.warn('[Governance] Warning updating report definition metadata:', err);
          }
        }

        // 2. If endpoint configuration changed
        if (after?.endpointUrl || after?.environmentTarget || after?.endpointConfig) {
          try {
            const epInput = after.endpointConfig || {
              endpointUrl: after.endpointUrl,
              environmentTarget: after.environmentTarget,
              httpMethod: after.httpMethod,
              timeoutMs: after.timeoutMs,
              authProfileRef: after.authProfileRef,
            };
            nbeEndpointRegistry.updateReportEndpoint(returnKey, epInput, publisher);
          } catch (err) {
            console.warn('[Governance] Warning updating NBE endpoint:', err);
          }
        }

        // 3. If version bump or structural changes
        if (proposal.actionType === 'VERSION_BUMP' || proposal.actionType === 'UPDATE' || proposal.actionType === 'ROLLBACK') {
          if (after?.fields || after?.columns || after?.sections || after?.formulas || after?.validationRules) {
            configService.createReportVersion(
              returnKey,
              {
                changelogSummary: `[Governance] ${proposal.title}`,
                sections: after?.sections,
                fields: after?.fields,
                columns: after?.columns,
                formulas: after?.formulas,
                validationRules: after?.validationRules,
              },
              publisher
            );
          }
        }
      }
    } else if (proposal.entityType === 'DEPARTMENT') {
      const deptId = proposal.entityId;
      if (proposal.actionType === 'UPDATE' || proposal.actionType === 'RESTRUCTURE') {
        departmentService.updateDepartment(deptId, after, publisher.name);
      }
    }
  }

  // --------------------------------------------------------------------------
  // LIFECYCLE: 5. CONTROLLED ROLLBACK (Never Rewrite History!)
  // --------------------------------------------------------------------------

  public rollbackToVersion(
    entityType: GovernanceEntityType,
    entityId: string,
    targetVersionNumber: number,
    actor: { id: string; name: string; role: string },
    rollbackReason: string
  ): GovernanceProposal {
    if (!rollbackReason || rollbackReason.trim().length < 5) {
      throw new Error('A detailed rollback reason is mandatory (at least 5 characters).');
    }

    const currentVersion = this.getEntityCurrentVersion(entityType, entityId);
    if (targetVersionNumber >= currentVersion) {
      throw new Error(
        `Invalid rollback target: Target Version ${targetVersionNumber} must be strictly lower than current Version ${currentVersion}.`
      );
    }

    // Find target version historical state
    let targetHistoricalState: any = null;
    let currentState: any = null;
    let entityName = entityId;

    if (entityType === 'REPORT_DEFINITION' || entityType === 'REPORT_VERSION') {
      const returnKey = entityId;
      const rep = configService.getReportDefinition(returnKey);
      const targetVersion = rep ? configService.getReportVersion(returnKey, targetVersionNumber) : null;
      if (rep && targetVersion) {
        entityName = rep.name;
        currentState = rep.activeVersionSnapshot || rep;
        targetHistoricalState = targetVersion;
      } else {
        // Fallback to proposal history for this entity
        const pastProposal = Array.from(this.proposals.values()).find(
          (p) =>
            p.entityId === entityId &&
            (p.publication?.resultingVersionNumber === targetVersionNumber || p.expectedEntityVersion === targetVersionNumber)
        );
        if (pastProposal) {
          targetHistoricalState = pastProposal.proposedChanges.beforeState || pastProposal.proposedChanges.afterState;
          currentState = pastProposal.proposedChanges.afterState;
          entityName = pastProposal.entityName;
        } else {
          throw new Error(`Historical Version ${targetVersionNumber} not found for report '${returnKey}'.`);
        }
      }
    } else {
      // Find earlier proposal for this entity that matched targetVersionNumber
      const pastProposal = Array.from(this.proposals.values()).find(
        (p) =>
          p.entityType === entityType &&
          p.entityId === entityId &&
          p.publication?.resultingVersionNumber === targetVersionNumber
      );
      if (pastProposal) {
        targetHistoricalState = pastProposal.proposedChanges.afterState;
        currentState = pastProposal.proposedChanges.beforeState;
        entityName = pastProposal.entityName;
      } else {
        throw new Error(`Historical state for Version ${targetVersionNumber} of '${entityType}:${entityId}' could not be located.`);
      }
    }

    // A ROLLBACK IS A NEW AUDITABLE CHANGE (Never rewrite history!)
    const cleanBefore = sanitizeGovernanceState(currentState);
    const cleanAfter = sanitizeGovernanceState(targetHistoricalState);
    const diff = this.computeDiff(cleanBefore, cleanAfter);

    const rollbackProposal = this.createProposalDraft(
      {
        title: `Rollback ${entityName} to Version ${targetVersionNumber}`,
        description: `Controlled rollback to Version ${targetVersionNumber}. Rationale: ${rollbackReason}`,
        category: 'ROLLBACK',
        entityType,
        entityId,
        entityName,
        actionType: 'ROLLBACK',
        proposedBeforeState: cleanBefore,
        proposedAfterState: cleanAfter,
        diff,
        expectedEntityVersion: currentVersion,
      },
      actor
    );

    rollbackProposal.rollbackInfo = {
      isRollback: true,
      revertsVersion: targetVersionNumber,
      rolledBackAt: new Date().toISOString(),
      rolledBackBy: actor,
      rollbackReason,
    };

    // Auto-validate rollback proposal
    this.validateProposal(rollbackProposal.id, actor);

    this.proposals.set(rollbackProposal.id, rollbackProposal);
    this.persist();

    auditService.log({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'CONFIG_ROLLBACK_INITIATED',
      entityType,
      entityId,
      correlationId: `corr_rollback_${rollbackProposal.id}`,
      details: `Initiated rollback of '${entityName}' from v${currentVersion} to v${targetVersionNumber}. Reason: ${rollbackReason}`,
      oldState: cleanBefore,
      newState: cleanAfter,
    });

    this.emit('proposal:rollback_initiated', rollbackProposal);
    return rollbackProposal;
  }

  // --------------------------------------------------------------------------
  // NOTIFICATION DISPATCHER (Notifies Affected Users of Material Changes)
  // --------------------------------------------------------------------------

  private dispatchNotificationsForProposal(proposal: GovernanceProposal): void {
    if (proposal.riskLevel === 'LOW') return; // Do not spam users with harmless edits

    const affected = proposal.impactAnalysis.affectedUsers;
    const now = new Date().toISOString();

    affected.forEach((user) => {
      const notif: GovernanceNotification = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        recipientUserId: user.id,
        recipientName: user.name,
        recipientEmail: user.email,
        proposalId: proposal.id,
        title: `Regulatory Configuration Notice: ${proposal.title}`,
        message: `A ${proposal.riskLevel}-risk configuration change affecting your ${user.role} responsibilities was published. Reason for impact: ${user.reason}. Effective: ${new Date(proposal.effectiveFrom).toLocaleDateString()}.`,
        riskLevel: proposal.riskLevel,
        effectiveFrom: proposal.effectiveFrom,
        createdAt: now,
        isRead: false,
      };
      this.notifications.unshift(notif);
    });

    this.persist();
  }

  public getNotificationsForUser(userId: string): GovernanceNotification[] {
    return this.notifications.filter((n) => n.recipientUserId === userId || n.recipientEmail === userId);
  }

  public getAllNotifications(): GovernanceNotification[] {
    return [...this.notifications];
  }

  public markNotificationAsRead(id: string): void {
    const n = this.notifications.find((item) => item.id === id);
    if (n) {
      n.isRead = true;
      this.persist();
    }
  }

  // --------------------------------------------------------------------------
  // COMPLETION GATE: AUDIT EXPLANATION ENGINE
  // "The platform must be able to explain who changed what, when, from what, to what,
  // under which approval/workflow, when it became effective, and what it affected."
  // --------------------------------------------------------------------------

  public explainChange(proposalId: string): GovernanceAuditExplanation {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error(`Cannot explain change: Proposal '${proposalId}' not found.`);
    }

    const latestApproval = proposal.approvals.length > 0 ? proposal.approvals[proposal.approvals.length - 1] : null;
    const isDualApproved = proposal.approvals.filter((a) => a.decision === 'APPROVED').length >= (proposal.impactAnalysis.requiresDualApproval ? 1 : 0);

    const isCurrentlyEffective = new Date(proposal.effectiveFrom) <= new Date();

    const narrative = `On ${new Date(proposal.createdAt).toLocaleString()}, ${proposal.proposer.name} (${proposal.proposer.role}) proposed ${proposal.actionType} for ${proposal.entityName} (${proposal.entityType}). It was classified as ${proposal.riskLevel} risk. ${
      latestApproval
        ? `It was approved by ${latestApproval.approverName} (${latestApproval.approverRole}) on ${new Date(latestApproval.timestamp).toLocaleString()} with comments: "${latestApproval.comments}".`
        : 'It has not been approved.'
    } It became effective on ${new Date(proposal.effectiveFrom).toLocaleDateString()} (Version ${proposal.publication?.resultingVersionNumber || proposal.expectedEntityVersion}). It affected ${proposal.impactAnalysis.affectedUsers.length} user(s), ${proposal.impactAnalysis.affectedDepartments.length} department(s), ${proposal.impactAnalysis.affectedReports.length} report(s), while preserving 100% of historical returns.`;

    return {
      changeId: proposal.publication?.resultingConfigHash || proposal.id,
      proposalId: proposal.id,
      actor: proposal.publication?.publishedBy || proposal.proposer,
      timestamp: proposal.publication?.publishedAt || proposal.updatedAt,
      entity: {
        type: proposal.entityType,
        id: proposal.entityId,
        name: proposal.entityName,
      },
      action: proposal.actionType,
      beforeState: proposal.proposedChanges.beforeState,
      afterState: proposal.proposedChanges.afterState,
      diff: proposal.proposedChanges.diff,
      reason: proposal.description,
      approval: latestApproval
        ? {
            approvedBy: latestApproval.approverName,
            approvedAt: latestApproval.timestamp,
            approverRole: latestApproval.approverRole,
            comments: latestApproval.comments,
            decision: latestApproval.decision,
            isDualApproved,
          }
        : null,
      effectiveDate: {
        effectiveFrom: proposal.effectiveFrom,
        effectiveTo: proposal.effectiveTo,
        isCurrentlyEffective,
      },
      version: {
        versionNumber: proposal.publication?.resultingVersionNumber || proposal.expectedEntityVersion,
        previousVersion: proposal.expectedEntityVersion,
      },
      impactSummary: {
        affectedUsersCount: proposal.impactAnalysis.affectedUsers.length,
        affectedDeptsCount: proposal.impactAnalysis.affectedDepartments.length,
        affectedReportsCount: proposal.impactAnalysis.affectedReports.length,
        affectedSubmissionsCount: proposal.impactAnalysis.affectedSubmissions.draftCount + proposal.impactAnalysis.affectedSubmissions.sentCount,
        summaryNarrative: narrative,
      },
    };
  }

  // --------------------------------------------------------------------------
  // QUERIES & FILTERS
  // --------------------------------------------------------------------------

  public getProposals(filter?: {
    status?: GovernanceProposalStatus | 'ALL';
    riskLevel?: GovernanceRiskLevel | 'ALL';
    entityType?: GovernanceEntityType | 'ALL';
    entityId?: string;
  }): GovernanceProposal[] {
    let list = Array.from(this.proposals.values());

    if (filter?.status && filter.status !== 'ALL') {
      list = list.filter((p) => p.status === filter.status);
    }
    if (filter?.riskLevel && filter.riskLevel !== 'ALL') {
      list = list.filter((p) => p.riskLevel === filter.riskLevel);
    }
    if (filter?.entityType && filter.entityType !== 'ALL') {
      list = list.filter((p) => p.entityType === filter.entityType);
    }
    if (filter?.entityId) {
      list = list.filter((p) => p.entityId === filter.entityId);
    }

    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getProposalById(id: string): GovernanceProposal | undefined {
    return this.proposals.get(id);
  }

  // --------------------------------------------------------------------------
  // DIFF COMPUTATION HELPER
  // --------------------------------------------------------------------------

  private computeDiff(before: any, after: any, prefix = ''): GovernanceProposalDiff[] {
    if (!before && !after) return [];
    if (!before && after) {
      return Object.keys(after).map((key) => ({
        field: prefix ? `${prefix}.${key}` : key,
        oldValue: null,
        newValue: after[key],
      }));
    }
    if (before && !after) {
      return Object.keys(before).map((key) => ({
        field: prefix ? `${prefix}.${key}` : key,
        oldValue: before[key],
        newValue: null,
      }));
    }

    const diffs: GovernanceProposalDiff[] = [];
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

    for (const key of allKeys) {
      const fieldName = prefix ? `${prefix}.${key}` : key;
      const oldVal = before[key];
      const newVal = after[key];

      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        diffs.push({
          field: fieldName,
          oldValue: oldVal,
          newValue: newVal,
        });
      }
    }

    return diffs;
  }
}

// Export singleton instance
export const configurationGovernanceService = new ConfigurationGovernanceEngine();
