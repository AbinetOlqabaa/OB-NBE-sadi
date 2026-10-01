/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  UserSession,
  SpecialAccessGrant,
  SpecialAccessAuditEntry,
  SpecialAccessScope,
} from '../types/regulatory.ts';
import { UserAccount } from './userService.ts';
import { configService } from './configService.ts';
import { departmentService } from './departmentService.ts';
import { getAllReports, getReportByKey } from '../data/report-registry.ts';
import { auditService } from './auditService.ts';

// ============================================================================
// 1. DATA CONTRACTS & ACCESS TYPES
// ============================================================================

export type AccessAction =
  | 'VIEW_REPORT'
  | 'CREATE_DRAFT'
  | 'EDIT_DRAFT'
  | 'DELETE_DRAFT'
  | 'VALIDATE_SUBMISSION'
  | 'SUBMIT_TO_CHECKER'
  | 'REVIEW_SUBMISSION'
  | 'APPROVE_SUBMISSION'
  | 'REJECT_SUBMISSION'
  | 'REQUEST_CORRECTION'
  | 'DELIVER_TO_NBE'
  | 'EXPORT_REPORT'
  | 'AUDIT_INSPECT'
  | 'CREATE_FINDING'
  | 'ATTACH_EVIDENCE'
  | 'MANAGE_USERS'
  | 'MANAGE_DEPARTMENTS'
  | 'MANAGE_REPORTS'
  | 'CONFIGURE_SYSTEM';

export type DecisionCode =
  | 'AUTHORIZED'
  | 'UNAUTHENTICATED'
  | 'INACTIVE_USER'
  | 'ROLE_RESTRICTION'
  | 'DEPARTMENT_MISMATCH'
  | 'REPORT_RETIRED'
  | 'REPORT_NOT_FOUND'
  | 'GRANT_EXPIRED'
  | 'GRANT_REVOKED'
  | 'SEGREGATION_OF_DUTIES_VIOLATION'
  | 'WORKFLOW_STATE_INVALID'
  | 'DENY_BY_DEFAULT';

export type AccessSource =
  | 'ADMIN_OVERSIGHT'
  | 'AUDITOR_SUPERVISION'
  | 'DIRECT_USER_ASSIGNMENT'
  | 'HOME_DEPARTMENT'
  | 'LINKED_DEPARTMENT'
  | 'ACTIVE_SPECIAL_ACCESS_GRANT'
  | 'DENIED';

export interface AccessContext {
  reportKey?: string;
  submission?: {
    id?: string;
    reportKey: string;
    makerId?: string;
    makerName?: string;
    makerDepartment?: string;
    department?: string;
    status?: string;
  };
  targetUserId?: string;
  targetDeptId?: string;
  ipAddress?: string;
}

export interface AccessDecision {
  allowed: boolean;
  decisionCode: DecisionCode;
  reason: string;
  action: AccessAction;
  evaluatedAt: string;
  user: {
    id: string;
    name: string;
    role: string;
    department: string;
    status: string;
  };
  reportKey?: string;
  authorizedVia?: AccessSource;
  grantId?: string;
}

export interface EffectiveReportAccess {
  reportKey: string;
  reportTitle: string;
  category: string;
  frequency: string;
  owningDepartments: string[];
  canView: boolean;
  canCreateDraft: boolean;
  canEditDraft: boolean;
  canSubmitToChecker: boolean;
  canReview: boolean;
  canDeliverToNBE: boolean;
  canAudit: boolean;
  accessSource: AccessSource;
  grantId?: string;
  grantExpiresAt?: string | null;
}

export interface EffectiveAccessMatrixResult {
  userId: string;
  userRole: string;
  userDepartment: string;
  userStatus: string;
  evaluatedAt: string;
  hasAdminOversight: boolean;
  hasAuditorInspection: boolean;
  reports: EffectiveReportAccess[];
  directAssignmentsCount: number;
  departmentReportsCount: number;
  specialAccessReportsCount: number;
}

// ============================================================================
// 2. AUTHORITATIVE EFFECTIVE ACCESS ENGINE
// ============================================================================

class EffectiveAccessServiceClass {
  private cache: Map<string, { matrix: EffectiveAccessMatrixResult; cachedAt: number; version: string }> = new Map();
  private cacheTTLMs = 60000; // 1 minute default, invalidated proactively upon mutations

  constructor() {
    // Listen for configuration and departmental changes to flush authorization caches
    (configService as any).events?.on('CONFIG_CHANGED', () => this.invalidateCache());
    (configService as any).events?.on('CACHE_INVALIDATED', () => this.invalidateCache());
    departmentService.subscribe(() => this.invalidateCache());
  }

  /**
   * Invalidates cached effective access matrices for a specific user or globally.
   */
  public invalidateCache(userId?: string): void {
    if (userId) {
      this.cache.delete(userId);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Authoritative access evaluation pipeline.
   * Derives effective access from:
   * Role + Department + Report Assignment + Special Access + Workflow State + Account Status + Dates + Restrictions
   */
  public evaluateAccess(
    rawUser: UserSession | UserAccount | null | undefined,
    action: AccessAction,
    context?: AccessContext
  ): AccessDecision {
    const now = new Date();
    const evaluatedAt = now.toISOString();

    // 1. Authentication Check
    if (!rawUser || !rawUser.id) {
      return {
        allowed: false,
        decisionCode: 'UNAUTHENTICATED',
        reason: 'Authentication credentials are required to perform this action.',
        action,
        evaluatedAt,
        user: { id: '', name: 'Anonymous', role: 'NONE', department: '', status: 'INACTIVE' },
      };
    }

    const user = {
      id: rawUser.id,
      name: rawUser.name || 'User',
      role: (rawUser.role || '').toUpperCase(),
      department: rawUser.department || '',
      status: (rawUser as any).status || 'ACTIVE',
      specialAccessGrants: rawUser.specialAccessGrants || [],
    };

    // 2. Account Status Check (Non-active accounts are strictly barred from all operations)
    if (user.status !== 'ACTIVE') {
      return {
        allowed: false,
        decisionCode: 'INACTIVE_USER',
        reason: `User account '${user.name}' is ${user.status}. Only ACTIVE accounts are authorized for bank operations.`,
        action,
        evaluatedAt,
        user,
        reportKey: context?.reportKey,
      };
    }

    // 3. Resolve Target Report (if applicable)
    const reportKey = (context?.reportKey || context?.submission?.reportKey || '').trim().toUpperCase();
    let reportDef = reportKey ? configService.getReportDefinition(reportKey) : null;
    let catalogReport = reportKey ? getReportByKey(reportKey) : null;

    if (reportKey && !reportDef && !catalogReport) {
      return {
        allowed: false,
        decisionCode: 'REPORT_NOT_FOUND',
        reason: `Regulatory return template '${reportKey}' was not found in the bank registry.`,
        action,
        evaluatedAt,
        user,
        reportKey,
      };
    }

    // 4. Report Lifecycle & Obsolescence Restriction
    const isReportRetired =
      reportDef?.status === 'RETIRED' ||
      reportDef?.status === 'DECOMMISSIONED' ||
      catalogReport?.Description?.includes('[RETIRED]');

    if (isReportRetired) {
      // Prohibit operational drafting/submission/delivery on retired templates
      const mutationActions: AccessAction[] = [
        'CREATE_DRAFT',
        'EDIT_DRAFT',
        'SUBMIT_TO_CHECKER',
        'DELIVER_TO_NBE',
      ];
      if (mutationActions.includes(action)) {
        return {
          allowed: false,
          decisionCode: 'REPORT_RETIRED',
          reason: `Regulatory return '${reportKey}' is RETIRED and decommissioned. New submissions are prohibited, though historical records remain inspectable.`,
          action,
          evaluatedAt,
          user,
          reportKey,
        };
      }
    }

    // 5. Role Operational Boundaries (Strict Separation of Duties)
    // ------------------------------------------------------------------------

    // Role A: ADMINISTRATOR
    // Mandate: Configuration, governance, user management, and system monitoring.
    // Restriction: Cannot create, edit, approve, or submit regulatory returns!
    if (user.role === 'ADMIN') {
      const adminPermitted: AccessAction[] = [
        'MANAGE_USERS',
        'MANAGE_DEPARTMENTS',
        'MANAGE_REPORTS',
        'CONFIGURE_SYSTEM',
        'VIEW_REPORT',
        'EXPORT_REPORT',
        'VALIDATE_SUBMISSION',
      ];
      if (adminPermitted.includes(action)) {
        return {
          allowed: true,
          decisionCode: 'AUTHORIZED',
          reason: 'Administrator authorized for compliance oversight and configuration governance.',
          action,
          evaluatedAt,
          user,
          reportKey,
          authorizedVia: 'ADMIN_OVERSIGHT',
        };
      }
      return {
        allowed: false,
        decisionCode: 'ROLE_RESTRICTION',
        reason: `Administrator role is restricted to system configuration and supervisory monitoring. Operational reporting action '${action}' is strictly prohibited to prevent accidental data entry or conflict of interest.`,
        action,
        evaluatedAt,
        user,
        reportKey,
      };
    }

    // Role B: AUDITOR
    // Mandate: Independent supervisory oversight, evidence attachment, finding creation.
    // Restriction: Cannot compile drafts or perform Checker review sign-offs unless explicitly granted.
    if (user.role === 'AUDITOR') {
      const auditorPermitted: AccessAction[] = [
        'AUDIT_INSPECT',
        'CREATE_FINDING',
        'ATTACH_EVIDENCE',
        'VIEW_REPORT',
        'EXPORT_REPORT',
      ];
      if (auditorPermitted.includes(action)) {
        return {
          allowed: true,
          decisionCode: 'AUTHORIZED',
          reason: 'Auditor authorized for independent compliance review, evidence examination, and findings tracking.',
          action,
          evaluatedAt,
          user,
          reportKey,
          authorizedVia: 'AUDITOR_SUPERVISION',
        };
      }
      return {
        allowed: false,
        decisionCode: 'ROLE_RESTRICTION',
        reason: `Auditor role has an independent supervisory mandate. Operational return action '${action}' is barred by NBE banking supervision directives to safeguard independence.`,
        action,
        evaluatedAt,
        user,
        reportKey,
      };
    }

    // Role C: CHECKER
    // Mandate: 4-Eyes verification, review remarks, approval/correction/rejection.
    // Restriction: Cannot create/edit report figures, cannot deliver to NBE, cannot approve own drafts.
    if (user.role === 'CHECKER') {
      const checkerRestricted: AccessAction[] = [
        'CREATE_DRAFT',
        'EDIT_DRAFT',
        'DELETE_DRAFT',
        'SUBMIT_TO_CHECKER',
        'DELIVER_TO_NBE',
        'MANAGE_USERS',
        'MANAGE_DEPARTMENTS',
        'MANAGE_REPORTS',
      ];
      if (checkerRestricted.includes(action)) {
        return {
          allowed: false,
          decisionCode: 'ROLE_RESTRICTION',
          reason: `Action '${action}' is a Maker or Administrator capability. Checkers are strictly restricted to 4-eyes review sign-offs.`,
          action,
          evaluatedAt,
          user,
          reportKey,
        };
      }

      // 4-Eyes Principle: Segregation of Duties - Maker cannot review or approve own draft!
      if (['REVIEW_SUBMISSION', 'APPROVE_SUBMISSION', 'REJECT_SUBMISSION', 'REQUEST_CORRECTION'].includes(action)) {
        if (context?.submission && context.submission.makerId && context.submission.makerId === user.id) {
          return {
            allowed: false,
            decisionCode: 'SEGREGATION_OF_DUTIES_VIOLATION',
            reason: 'Segregation of Duties Violation: You prepared this submission as Maker and cannot perform 4-eyes review or approval on your own draft.',
            action,
            evaluatedAt,
            user,
            reportKey,
          };
        }
      }
    }

    // Role D: MAKER
    // Mandate: Report drafting, editing, formula validation, submission to Checker, and final delivery to NBE upon approval.
    // Restriction: Cannot perform review approvals or administrative configuration.
    if (user.role === 'MAKER') {
      const makerRestricted: AccessAction[] = [
        'REVIEW_SUBMISSION',
        'APPROVE_SUBMISSION',
        'REJECT_SUBMISSION',
        'REQUEST_CORRECTION',
        'MANAGE_USERS',
        'MANAGE_DEPARTMENTS',
        'MANAGE_REPORTS',
      ];
      if (makerRestricted.includes(action)) {
        return {
          allowed: false,
          decisionCode: 'ROLE_RESTRICTION',
          reason: `Action '${action}' requires supervisory Checker or Administrator credentials. Makers cannot approve their own submissions.`,
          action,
          evaluatedAt,
          user,
          reportKey,
        };
      }

      // Pre-condition: Final delivery to NBE requires APPROVED submission state
      if (action === 'DELIVER_TO_NBE') {
        if (context?.submission && context.submission.status !== 'APPROVED') {
          return {
            allowed: false,
            decisionCode: 'WORKFLOW_STATE_INVALID',
            reason: `Return cannot be delivered to NBE in '${context.submission.status}' status. Submission must be in APPROVED state following 4-eyes sign-off.`,
            action,
            evaluatedAt,
            user,
            reportKey,
          };
        }
      }
    }

    // 6. Generic View & Export Actions
    // Authenticated active users with home department or special access can view/export
    if (action === 'VIEW_REPORT' || action === 'EXPORT_REPORT' || action === 'VALIDATE_SUBMISSION') {
      const hasRelation = this.checkReportRelationship(user, reportKey, reportDef, catalogReport, now);
      if (hasRelation.authorized) {
        return {
          allowed: true,
          decisionCode: 'AUTHORIZED',
          reason: `Authorized to ${action.toLowerCase().replace('_', ' ')} based on ${hasRelation.source.replace('_', ' ').toLowerCase()}.`,
          action,
          evaluatedAt,
          user,
          reportKey,
          authorizedVia: hasRelation.source,
          grantId: hasRelation.grantId,
        };
      }
    }

    // 7. Report-Specific Operational Access (Maker drafting & Checker review)
    // ------------------------------------------------------------------------
    if (reportKey) {
      const relation = this.checkReportRelationship(user, reportKey, reportDef, catalogReport, now);
      if (!relation.authorized) {
        return {
          allowed: false,
          decisionCode: relation.decisionCode || 'DEPARTMENT_MISMATCH',
          reason: relation.reason,
          action,
          evaluatedAt,
          user,
          reportKey,
        };
      }

      return {
        allowed: true,
        decisionCode: 'AUTHORIZED',
        reason: `Authorized for '${action}' via ${relation.source.replace(/_/g, ' ').toLowerCase()}.`,
        action,
        evaluatedAt,
        user,
        reportKey,
        authorizedVia: relation.source,
        grantId: relation.grantId,
      };
    }

    // If no report specified and passes previous checks
    return {
      allowed: true,
      decisionCode: 'AUTHORIZED',
      reason: 'Authorized action.',
      action,
      evaluatedAt,
      user,
    };
  }

  /**
   * Evaluates the relationship binding User ↔ Department ↔ Report ↔ Special Access.
   */
  private checkReportRelationship(
    user: { id: string; role: string; department: string; specialAccessGrants?: SpecialAccessGrant[] },
    reportKey: string,
    reportDef: any,
    catalogReport: any,
    now: Date
  ): { authorized: boolean; source: AccessSource; reason: string; decisionCode?: DecisionCode; grantId?: string } {
    const normKey = reportKey.trim().toUpperCase();

    // 1. Check Explicit User ↔ Report Duty Assignment in SSOT
    const directUserAssignments = configService.getUserReportAssignments({ userId: user.id, reportKey: normKey });
    const matchingAssignment = directUserAssignments.find((a) => {
      if (!a.isActive) return false;
      if (a.effectiveFrom && new Date(a.effectiveFrom) > now) return false;
      if (a.effectiveTo && new Date(a.effectiveTo) < now) return false;
      if (user.role === 'MAKER' && a.duty !== 'MAKER') return false;
      if (user.role === 'CHECKER' && a.duty !== 'CHECKER') return false;
      return true;
    });

    if (matchingAssignment) {
      return {
        authorized: true,
        source: 'DIRECT_USER_ASSIGNMENT',
        reason: `User explicitly assigned duty '${matchingAssignment.duty}' for report '${normKey}'.`,
      };
    }

    // 2. Resolve Report Owning Departments
    const owningDepts = this.resolveOwningDepartmentNames(normKey, reportDef, catalogReport);
    const userDeptNorm = (user.department || '').trim().toLowerCase();

    // Check Home Department Match
    const isHomeDeptMatch = owningDepts.some((d) => d.toLowerCase() === userDeptNorm);
    if (isHomeDeptMatch) {
      return {
        authorized: true,
        source: 'HOME_DEPARTMENT',
        reason: `Report '${normKey}' is assigned to user's home department ('${user.department}').`,
      };
    }

    // Check SSOT Department Report Assignment
    const homeDeptObj = Array.from(configService.getDepartments().values()).find(
      (d) => d.name.toLowerCase() === userDeptNorm || d.id.toLowerCase() === userDeptNorm
    );
    if (homeDeptObj) {
      const deptAssignments = configService.getDepartmentReportAssignments({
        departmentId: homeDeptObj.id,
        reportKey: normKey,
        activeOnly: true,
      });
      if (deptAssignments.length > 0) {
        return {
          authorized: true,
          source: 'LINKED_DEPARTMENT',
          reason: `Department '${homeDeptObj.name}' is assigned responsibility for report '${normKey}'.`,
        };
      }
    }

    // 3. Check Active Special Access Grants
    const grants: SpecialAccessGrant[] = user.specialAccessGrants || [];
    let hasExpiredGrant = false;

    for (const grant of grants) {
      // Ignore revoked grants
      if (grant.revoked) continue;

      // Check temporal validity
      const effectiveDate = (grant as any).effectiveDate || grant.effectiveFrom;
      if (effectiveDate && new Date(effectiveDate) > now) continue;
      const expiry = (grant as any).expiration || grant.expiresAt;
      if (expiry && new Date(expiry) < now) {
        hasExpiredGrant = true;
        continue;
      }

      // Check Report Key match
      if (grant.reportKey && grant.reportKey.trim().toUpperCase() === normKey) {
        return {
          authorized: true,
          source: 'ACTIVE_SPECIAL_ACCESS_GRANT',
          grantId: grant.id,
          reason: `Special cross-department access granted for report '${normKey}'. Justification: ${grant.reason}`,
        };
      }

      // Check Department match
      const grantDepts = Array.isArray(grant.departments) && grant.departments.length > 0
        ? grant.departments
        : grant.department
        ? grant.department.split(',').map((s) => s.trim())
        : [];

      for (const gd of grantDepts) {
        const gdNorm = gd.toLowerCase();
        if (owningDepts.some((od) => od.toLowerCase() === gdNorm)) {
          return {
            authorized: true,
            source: 'ACTIVE_SPECIAL_ACCESS_GRANT',
            grantId: grant.id,
            reason: `Special cross-department access granted for department '${gd}'. Justification: ${grant.reason}`,
          };
        }
      }
    }

    if (hasExpiredGrant) {
      return {
        authorized: false,
        source: 'DENIED',
        decisionCode: 'GRANT_EXPIRED',
        reason: `Special access grant for report '${normKey}' has expired. Contact Administrator for extension.`,
      };
    }

    const owningDesc = owningDepts.length > 0 ? owningDepts.join(', ') : 'Unassigned';
    return {
      authorized: false,
      source: 'DENIED',
      decisionCode: 'DEPARTMENT_MISMATCH',
      reason: `Department restriction: Your department ('${user.department || 'Unassigned'}') is not authorized for return '${normKey}' (owned by: '${owningDesc}'). Contact Administrator for Special Cross-Department Access.`,
    };
  }

  /**
   * Resolves the list of department names that own or compile a report.
   */
  private resolveOwningDepartmentNames(reportKey: string, reportDef: any, catalogReport: any): string[] {
    const depts = new Set<string>();

    if (catalogReport) {
      if (catalogReport.department) depts.add(catalogReport.department);
      if (Array.isArray(catalogReport.departments)) {
        catalogReport.departments.forEach((d: string) => depts.add(d));
      }
    }

    if (reportDef) {
      if (reportDef.defaultDepartmentId) {
        const dObj = configService.getDepartmentById(reportDef.defaultDepartmentId);
        if (dObj) depts.add(dObj.name);
      }
      if (Array.isArray(reportDef.departmentIds)) {
        reportDef.departmentIds.forEach((dId: string) => {
          const dObj = configService.getDepartmentById(dId);
          if (dObj) depts.add(dObj.name);
          else depts.add(dId);
        });
      }
    }

    // Fallback to departmentService linkage
    const linked = departmentService.getDepartmentsForReport(reportKey);
    linked.forEach((d) => depts.add(d));

    return Array.from(depts);
  }

  /**
   * Computes the complete Effective Access Matrix across all registered regulatory returns for a user.
   */
  public getEffectiveAccessMatrix(rawUser: UserSession | UserAccount): EffectiveAccessMatrixResult {
    const userId = rawUser.id;
    const summary = configService.getConfigSummary() as any;
    const versionHash = summary.globalConfigHash || summary.version || 'v1';

    // Check cache
    const cached = this.cache.get(userId);
    if (cached && cached.version === versionHash && Date.now() - cached.cachedAt < this.cacheTTLMs) {
      return cached.matrix;
    }

    const now = new Date();
    const evaluatedAt = now.toISOString();
    const reports = getAllReports();
    const effectiveReports: EffectiveReportAccess[] = [];

    let directAssignmentsCount = 0;
    let departmentReportsCount = 0;
    let specialAccessReportsCount = 0;

    for (const report of reports) {
      const reportKey = report.ReturnKey;
      const canView = this.evaluateAccess(rawUser, 'VIEW_REPORT', { reportKey }).allowed;
      const canCreateDraft = this.evaluateAccess(rawUser, 'CREATE_DRAFT', { reportKey }).allowed;
      const canEditDraft = this.evaluateAccess(rawUser, 'EDIT_DRAFT', { reportKey }).allowed;
      const canSubmitToChecker = this.evaluateAccess(rawUser, 'SUBMIT_TO_CHECKER', { reportKey }).allowed;
      const canReview = this.evaluateAccess(rawUser, 'REVIEW_SUBMISSION', { reportKey }).allowed;
      const canDeliverToNBE = this.evaluateAccess(rawUser, 'DELIVER_TO_NBE', { reportKey }).allowed;
      const canAudit = this.evaluateAccess(rawUser, 'AUDIT_INSPECT', { reportKey }).allowed;

      // Determine source
      const relation = this.checkReportRelationship(
        { id: rawUser.id, role: rawUser.role, department: rawUser.department || '', specialAccessGrants: rawUser.specialAccessGrants },
        reportKey,
        configService.getReportDefinition(reportKey),
        report,
        now
      );

      let accessSource: AccessSource = 'DENIED';
      if (rawUser.role === 'ADMIN') accessSource = 'ADMIN_OVERSIGHT';
      else if (rawUser.role === 'AUDITOR') accessSource = 'AUDITOR_SUPERVISION';
      else if (relation.authorized) accessSource = relation.source;

      if (accessSource === 'DIRECT_USER_ASSIGNMENT') directAssignmentsCount++;
      else if (accessSource === 'HOME_DEPARTMENT' || accessSource === 'LINKED_DEPARTMENT') departmentReportsCount++;
      else if (accessSource === 'ACTIVE_SPECIAL_ACCESS_GRANT') specialAccessReportsCount++;

      const owningDepts = this.resolveOwningDepartmentNames(
        reportKey,
        configService.getReportDefinition(reportKey),
        report
      );

      effectiveReports.push({
        reportKey,
        reportTitle: report.Title,
        category: report.Category,
        frequency: report.Frequency,
        owningDepartments: owningDepts,
        canView,
        canCreateDraft,
        canEditDraft,
        canSubmitToChecker,
        canReview,
        canDeliverToNBE,
        canAudit,
        accessSource,
        grantId: relation.grantId,
      });
    }

    const result: EffectiveAccessMatrixResult = {
      userId,
      userRole: rawUser.role,
      userDepartment: rawUser.department || '',
      userStatus: (rawUser as any).status || 'ACTIVE',
      evaluatedAt,
      hasAdminOversight: rawUser.role === 'ADMIN',
      hasAuditorInspection: rawUser.role === 'AUDITOR',
      reports: effectiveReports,
      directAssignmentsCount,
      departmentReportsCount,
      specialAccessReportsCount,
    };

    // Store in cache
    this.cache.set(userId, { matrix: result, cachedAt: Date.now(), version: versionHash });
    return result;
  }

  // ==========================================================================
  // 3. SPECIAL ACCESS LIFECYCLE & AUDIT TRAIL
  // ==========================================================================

  /**
   * Grants special cross-department access with required regulatory attributes:
   * scope, reason, granting administrator, effective date, expiration, and audit trail.
   */
  public grantSpecialAccess(
    targetUser: UserAccount,
    grantData: {
      reportKey?: string;
      department?: string;
      departments?: string[];
      reason: string;
      effectiveDate?: string;
      expiresAt?: string;
      scope?: 'SINGLE_REPORT' | 'DEPARTMENT_WIDE' | 'CROSS_DEPARTMENT';
    },
    adminActor: { id: string; name: string; role: string }
  ): { success: boolean; grant?: SpecialAccessGrant; user?: UserAccount; message?: string } {
    if (adminActor.role !== 'ADMIN') {
      return { success: false, message: 'Only administrators with ADMIN role can grant special access.' };
    }

    const hasDepts = Array.isArray(grantData.departments) && grantData.departments.length > 0;
    if (!grantData.reportKey && !grantData.department && !hasDepts) {
      return { success: false, message: 'Either a reportKey or target department(s) must be specified.' };
    }

    if (!grantData.reason || grantData.reason.trim().length < 5) {
      return { success: false, message: 'A regulatory justification reason is mandatory (minimum 5 characters).' };
    }

    const now = new Date().toISOString();
    const targetDepts = hasDepts
      ? grantData.departments!
      : grantData.department
      ? grantData.department.split(',').map((s) => s.trim())
      : [];

    const scope: SpecialAccessScope =
      grantData.scope
        ? (grantData.scope as SpecialAccessScope)
        : grantData.reportKey
        ? 'REPORT'
        : targetDepts.length > 1
        ? 'MULTI_DEPARTMENT'
        : 'DEPARTMENT';

    const auditEntry: SpecialAccessAuditEntry = {
      action: 'GRANTED',
      timestamp: now,
      actorName: adminActor.name,
      actorRole: adminActor.role,
      notes: `Granted ${scope} access for ${grantData.reportKey || targetDepts.join(', ')}. Justification: ${grantData.reason}`,
    };

    const newGrant: SpecialAccessGrant = {
      id: `grant_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      reportKey: grantData.reportKey?.trim().toUpperCase(),
      department: targetDepts.length === 1 ? targetDepts[0] : targetDepts.join(', '),
      departments: targetDepts,
      scope,
      grantedBy: `${adminActor.name} (${adminActor.role})`,
      grantedAt: now,
      effectiveFrom: grantData.effectiveDate || now,
      expiresAt: grantData.expiresAt,
      reason: grantData.reason.trim(),
      revoked: false,
      auditTrail: [auditEntry],
    };
    (newGrant as any).effectiveDate = grantData.effectiveDate || now;
    (newGrant as any).expiration = grantData.expiresAt || null;

    if (!Array.isArray(targetUser.specialAccessGrants)) {
      targetUser.specialAccessGrants = [];
    }

    targetUser.specialAccessGrants.push(newGrant);

    // Invalidate effective access cache for this user immediately
    this.invalidateCache(targetUser.id);
    configService.bumpVersion('ASSIGNMENT');

    // Audit log
    auditService.log({
      actorId: adminActor.id,
      actorName: adminActor.name,
      actorRole: 'ADMIN',
      action: 'SPECIAL_ACCESS_GRANTED',
      entityType: 'USER_PERMISSION',
      entityId: targetUser.id,
      correlationId: `corr_grant_${newGrant.id}`,
      details: `Special access grant '${newGrant.id}' issued to ${targetUser.name} (${targetUser.role}) for ${newGrant.reportKey || targetDepts.join(', ')}. Scope: ${scope}. Reason: ${grantData.reason}`,
      newState: newGrant,
    });

    return {
      success: true,
      grant: newGrant,
      user: targetUser,
      message: `Special access granted to ${targetUser.name}.`,
    };
  }

  /**
   * Revokes an existing special access grant with non-repudiation audit logging.
   */
  public revokeSpecialAccess(
    targetUser: UserAccount,
    grantId: string,
    adminActor: { id: string; name: string; role: string },
    reason?: string
  ): { success: boolean; user?: UserAccount; message?: string } {
    if (adminActor.role !== 'ADMIN') {
      return { success: false, message: 'Only administrators with ADMIN role can revoke special access.' };
    }

    if (!Array.isArray(targetUser.specialAccessGrants)) {
      return { success: false, message: 'No special access grants exist on this user.' };
    }

    const grant = targetUser.specialAccessGrants.find((g) => g.id === grantId);
    if (!grant) {
      return { success: false, message: `Special access grant '${grantId}' not found.` };
    }

    const now = new Date().toISOString();
    grant.revoked = true;
    grant.revokedAt = now;
    grant.revokedBy = `${adminActor.name} (${adminActor.role})`;

    if (!Array.isArray(grant.auditTrail)) {
      grant.auditTrail = [];
    }
    grant.auditTrail.push({
      action: 'REVOKED',
      timestamp: now,
      actorName: adminActor.name,
      actorRole: adminActor.role,
      notes: `Special access revoked by ${adminActor.name}. Reason: ${reason || 'Administrative revocation'}`,
    });

    // Invalidate authorization cache immediately
    this.invalidateCache(targetUser.id);
    configService.bumpVersion('ASSIGNMENT');

    auditService.log({
      actorId: adminActor.id,
      actorName: adminActor.name,
      actorRole: 'ADMIN',
      action: 'SPECIAL_ACCESS_REVOKED',
      entityType: 'USER_PERMISSION',
      entityId: targetUser.id,
      correlationId: `corr_rev_${grantId}`,
      details: `Special access grant '${grantId}' revoked for ${targetUser.name} by ${adminActor.name}.`,
      oldState: grant,
    });

    return {
      success: true,
      user: targetUser,
      message: `Special access grant '${grantId}' revoked successfully.`,
    };
  }

  // ==========================================================================
  // 4. CONVENIENCE HELPERS FOR BACKEND SERVICES
  // ==========================================================================

  public canMakerAccessReport(user: UserSession | UserAccount, reportKey: string): boolean {
    return this.evaluateAccess(user, 'CREATE_DRAFT', { reportKey }).allowed;
  }

  public canCheckerReviewSubmission(
    user: UserSession | UserAccount,
    submission: { id?: string; reportKey: string; makerId?: string; department?: string; makerDepartment?: string }
  ): { allowed: boolean; reason?: string } {
    const decision = this.evaluateAccess(user, 'REVIEW_SUBMISSION', { reportKey: submission.reportKey, submission });
    return {
      allowed: decision.allowed,
      reason: decision.reason,
    };
  }

  public canDeliverToNBE(
    user: UserSession | UserAccount,
    submission: { id?: string; reportKey: string; status?: string; makerId?: string }
  ): { allowed: boolean; reason?: string } {
    const decision = this.evaluateAccess(user, 'DELIVER_TO_NBE', { reportKey: submission.reportKey, submission });
    return {
      allowed: decision.allowed,
      reason: decision.reason,
    };
  }

  public canAuditorInspect(user: UserSession | UserAccount, reportKey?: string): boolean {
    return this.evaluateAccess(user, 'AUDIT_INSPECT', { reportKey }).allowed;
  }
}

export const effectiveAccessService = new EffectiveAccessServiceClass();
