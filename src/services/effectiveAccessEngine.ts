/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type UserSession,
  type ReportSubmission,
  type SpecialAccessGrant,
  type SpecialAccessScope,
  type SpecialAccessAuditEntry,
  isFinalSubmittedStatus,
} from '../types/regulatory.ts';
import type { UserAccount } from './userService.ts';
import { getReportByKey, getAllReports } from '../data/report-registry.ts';
import { getDepartmentForReport } from '../data/organizationHierarchy.ts';
import { departmentService } from './departmentService.ts';
import { configService } from './configService.ts';
import { auditService } from './auditService.ts';
import { realtimeSsotEngine } from './realtimeSsotEngine.ts';

export type UserRole = 'ADMIN' | 'MAKER' | 'CHECKER' | 'AUDITOR';
export type AccountStatus = 'ACTIVE' | 'PENDING_APPROVAL' | 'DISABLED' | 'SUSPENDED';

export type AccessAction =
  | 'VIEW'
  | 'CREATE_DRAFT'
  | 'EDIT_DRAFT'
  | 'DELETE_DRAFT'
  | 'VALIDATE'
  | 'SUBMIT_CHECKER'
  | 'REVIEW'
  | 'APPROVE'
  | 'REJECT'
  | 'REQUEST_CORRECTION'
  | 'DELIVER_NBE'
  | 'EXPORT_XLSX'
  | 'IMPORT_XLSX'
  | 'AUDIT_INSPECT'
  | 'AUDIT_ATTACH_EVIDENCE'
  | 'AUDIT_CREATE_FINDING'
  | 'AUDIT_MANAGE_REMEDIATION'
  | 'AUDIT_EXPORT_PACKAGE'
  | 'MANAGE_USERS'
  | 'MANAGE_DEPARTMENTS'
  | 'CONFIGURE_SIMULATOR'
  | 'TRIGGER_SSOT_PIPELINE'
  | 'GRANT_SPECIAL_ACCESS'
  | 'REVOKE_SPECIAL_ACCESS'
  | 'FLAG'
  | 'COMMENT'
  | 'ADMIN_ARCHIVE'
  | 'ADMIN_VOID'
  | 'INSPECT_HISTORY';

export type AccessReasonCode =
  | 'ALLOWED'
  | 'AUTH_REQUIRED'
  | 'ACCOUNT_INACTIVE'
  | 'ACCOUNT_PENDING'
  | 'ACCOUNT_SUSPENDED'
  | 'ROLE_FORBIDDEN'
  | 'DEPT_MISMATCH'
  | 'DUTIES_SEGREGATION_VIOLATION'
  | 'REPORT_RETIRED'
  | 'REPORT_NOT_FOUND'
  | 'GRANT_EXPIRED'
  | 'GRANT_REVOKED'
  | 'INVALID_WORKFLOW_STATE';

export interface AccessEvaluationContext {
  role?: string;
  userDept?: string;
  reportKey?: string;
  reportDept?: string;
  isHomeDept?: boolean;
  isLinkedDept?: boolean;
  isDirectAssignment?: boolean;
  isSpecialAccess?: boolean;
  grantId?: string;
  grantReason?: string;
  effectiveFrom?: string;
  expiresAt?: string;
  workflowStatus?: string;
}

export interface AccessEvaluationResult {
  allowed: boolean;
  reason: string;
  code: AccessReasonCode;
  context?: AccessEvaluationContext;
}

export interface EffectiveReportPermissions {
  reportKey: string;
  reportTitle: string;
  primaryDepartment: string;
  linkedDepartments: string[];
  canView: boolean;
  canCreateDraft: boolean;
  canEditDraft: boolean;
  canValidate: boolean;
  canSubmitToChecker: boolean;
  canReview: boolean;
  canDeliverToNbe: boolean;
  canAudit: boolean;
  authorizedVia: 'HOME_DEPARTMENT' | 'LINKED_DEPARTMENT' | 'DIRECT_ASSIGNMENT' | 'SPECIAL_ACCESS' | 'ADMIN_OVERSIGHT' | 'AUDIT_OVERSIGHT' | 'NONE';
  governanceNotes: string;
  activeGrant?: SpecialAccessGrant;
}

export interface GrantSpecialAccessInput {
  userId: string;
  scope?: SpecialAccessScope;
  reportKey?: string;
  department?: string;
  departments?: string[];
  reason: string;
  grantedBy: string;
  effectiveFrom?: string;
  expiresAt?: string;
}

/**
 * Authoritative Central Relationship and Effective-Access Engine
 * 
 * Unifies:
 * User ↔ Role ↔ Department ↔ Report ↔ Special Access ↔ Workflow State
 * 
 * Security Boundary: All backend mutations and API routes query this engine.
 * Frontend conditionals are strictly for UX presentation.
 */
class EffectiveAccessEngineClass {
  // Invalidation cache for fast repeated lookups
  private accessCache: Map<string, AccessEvaluationResult> = new Map();

  // User to Report direct assignments (userId -> Set of reportKeys)
  private userReportAssignments: Map<string, Set<string>> = new Map();
  private userProvider: { getById: (id: string) => any } | null = null;

  public setUserProvider(provider: { getById: (id: string) => any }): void {
    this.userProvider = provider;
  }

  constructor() {
    this.setupListeners();
  }

  /**
   * Listen to structural SSOT changes and department updates to invalidate cache
   */
  private setupListeners(): void {
    if (typeof window !== 'undefined' || typeof process !== 'undefined') {
      try {
        departmentService.subscribe(() => {
          this.invalidateAll('Department registry updated');
        });
      } catch {}

      try {
        configService.events.on('CONFIG_CHANGED', (event) => {
          this.invalidateAll(`SSOT configuration changed: ${event?.type || 'UNKNOWN'}`);
        });
        configService.events.on('CACHE_INVALIDATED', () => {
          this.invalidateAll('SSOT cache invalidated');
        });
      } catch {}

      try {
        realtimeSsotEngine.events.on('ASSIGNMENT_CHANGED', (event) => {
          const payload = event.payload || {};
          if (event.action === 'ASSIGN' && (payload.userId || payload.newState?.userId) && (payload.reportKey || payload.newState?.reportKey)) {
            const uId = payload.userId || payload.newState.userId;
            const rKey = payload.reportKey || payload.newState.reportKey;
            this.assignReportToUser(uId, rKey, event.actor?.name || 'ADMIN');
          } else if (event.action === 'REVOKE' && (payload.oldState?.userId || payload.userId) && (payload.oldState?.reportKey || payload.reportKey)) {
            const uId = payload.oldState?.userId || payload.userId;
            const rKey = payload.oldState?.reportKey || payload.reportKey;
            this.removeReportFromUser(uId, rKey, event.actor?.name || 'ADMIN');
          }
          this.invalidateAll(`Assignment changed: ${event.action}`);
        });

        realtimeSsotEngine.events.on('SPECIAL_ACCESS_CHANGED', (event) => {
          if (event.entityId) {
            this.invalidateUser(event.entityId);
          }
        });

        realtimeSsotEngine.events.on('USER_CHANGED', (event) => {
          if (event.entityId) {
            this.invalidateUser(event.entityId);
          }
        });
      } catch {}
    }
  }

  // -------------------------------------------------------------
  // CACHE MANAGEMENT & INVALIDATION
  // -------------------------------------------------------------

  private buildCacheKey(
    user: UserSession | UserAccount,
    reportKey: string | null | undefined,
    action: AccessAction,
    submission?: Partial<ReportSubmission> | null
  ): string {
    const uId = user.id || 'anonymous';
    const uRole = user.role || 'NONE';
    const uStatus = (user as any).status || 'ACTIVE';
    const uDept = user.department || 'NONE';
    const grantsHash = (user.specialAccessGrants || [])
      .map((g) => `${g.id}:${g.revoked ? 1 : 0}:${g.expiresAt || ''}`)
      .join('|');
    const rKey = reportKey || 'GLOBAL';
    const subPart = submission
      ? `${submission.id || 'new'}:${submission.status || 'DRAFT'}:${submission.makerId || 'none'}`
      : 'no_sub';
    return `${uId}:${uRole}:${uStatus}:${uDept}:${grantsHash}:${rKey}:${action}:${subPart}`;
  }

  /**
   * Invalidate entire evaluation cache
   */
  public invalidateAll(reason?: string): void {
    const size = this.accessCache.size;
    this.accessCache.clear();
    if (size > 0 && reason) {
      // Log internal cache invalidation for audit visibility
    }
  }

  /**
   * Invalidate cache for a specific user
   */
  public invalidateUser(userId: string): void {
    for (const key of this.accessCache.keys()) {
      if (key.startsWith(`${userId}:`)) {
        this.accessCache.delete(key);
      }
    }
  }

  /**
   * Invalidate cache when a role changes
   */
  public onRoleChange(userId: string, newRole: string): void {
    this.invalidateUser(userId);
  }

  /**
   * Invalidate cache when a department changes
   */
  public onDepartmentChange(userId?: string, newDept?: string): void {
    if (userId) {
      this.invalidateUser(userId);
    } else {
      this.invalidateAll('Department hierarchy modified');
    }
  }

  /**
   * Invalidate cache when a report assignment or status changes
   */
  public onReportAssignmentChange(reportKey?: string, userId?: string): void {
    if (userId) {
      this.invalidateUser(userId);
    } else if (reportKey) {
      for (const [key] of this.accessCache) {
        if (key.includes(`:${reportKey}:`)) {
          this.accessCache.delete(key);
        }
      }
    } else {
      this.invalidateAll('Report assignments updated');
    }
  }

  /**
   * Invalidate cache when special access is granted, updated, or revoked
   */
  public onSpecialAccessChange(userId: string): void {
    this.invalidateUser(userId);
  }

  // -------------------------------------------------------------
  // USER ↔ REPORT DIRECT ASSIGNMENTS
  // -------------------------------------------------------------

  public assignReportToUser(userId: string, reportKey: string, adminName: string): boolean {
    if (!this.userReportAssignments.has(userId)) {
      this.userReportAssignments.set(userId, new Set());
    }
    this.userReportAssignments.get(userId)!.add(reportKey);
    this.invalidateUser(userId);

    auditService.log({
      actorId: 'usr_admin',
      actorName: adminName,
      actorRole: 'ADMIN',
      action: 'USER_REPORT_ASSIGNED' as any,
      entityType: 'USER_PERMISSION' as any,
      entityId: userId,
      correlationId: `corr_assign_${userId}_${reportKey}_${Date.now()}`,
      details: `Direct report assignment added: ${reportKey} to user ${userId}.`,
    });

    return true;
  }

  public removeReportFromUser(userId: string, reportKey: string, adminName: string): boolean {
    if (this.userReportAssignments.has(userId)) {
      this.userReportAssignments.get(userId)!.delete(reportKey);
      this.invalidateUser(userId);

      auditService.log({
        actorId: 'usr_admin',
        actorName: adminName,
        actorRole: 'ADMIN',
        action: 'USER_REPORT_UNASSIGNED' as any,
        entityType: 'USER_PERMISSION' as any,
        entityId: userId,
        correlationId: `corr_unassign_${userId}_${reportKey}_${Date.now()}`,
        details: `Direct report assignment removed: ${reportKey} from user ${userId}.`,
      });

      return true;
    }
    return false;
  }

  public getUserDirectReportAssignments(userId: string): string[] {
    return Array.from(this.userReportAssignments.get(userId) || []);
  }

  // -------------------------------------------------------------
  // SPECIAL ACCESS RESOLUTION & VERIFICATION
  // -------------------------------------------------------------

  public isGrantActive(grant: SpecialAccessGrant): { active: boolean; reason?: string } {
    if (grant.revoked) {
      return { active: false, reason: 'Grant was formally revoked by Administrator.' };
    }

    const now = new Date();

    if (grant.effectiveFrom) {
      const eff = new Date(grant.effectiveFrom);
      if (now < eff) {
        return { active: false, reason: `Grant is not yet effective (effective from: ${grant.effectiveFrom}).` };
      }
    }

    if (grant.expiresAt) {
      const exp = new Date(grant.expiresAt);
      if (now > exp) {
        return { active: false, reason: `Grant has expired (expired at: ${grant.expiresAt}).` };
      }
    }

    return { active: true };
  }

  public findActiveGrantCoveringReport(
    grants: SpecialAccessGrant[],
    reportKey: string,
    reportDeptName: string
  ): SpecialAccessGrant | null {
    if (!Array.isArray(grants) || grants.length === 0) return null;

    const rKeyNorm = reportKey.trim().toLowerCase();
    const rDeptNorm = reportDeptName.trim().toLowerCase();

    for (const grant of grants) {
      const { active } = this.isGrantActive(grant);
      if (!active) continue;

      // 1. All reports scope
      if (grant.scope === 'ALL_REPORTS') {
        return grant;
      }

      // 2. Specific report key
      if (grant.reportKey && grant.reportKey.trim().toLowerCase() === rKeyNorm) {
        return grant;
      }

      // 3. Department scope
      if (grant.department) {
        const gDeptNorm = grant.department.trim().toLowerCase();
        if (
          gDeptNorm === rDeptNorm ||
          rDeptNorm.includes(gDeptNorm) ||
          gDeptNorm.includes(rDeptNorm) ||
          departmentService.getReportsForDepartment(grant.department).includes(reportKey)
        ) {
          return grant;
        }
      }

      // 4. Multi-departments scope
      if (Array.isArray(grant.departments)) {
        if (
          grant.departments.some(
            (d) =>
              d.trim().toLowerCase() === rDeptNorm ||
              rDeptNorm.includes(d.trim().toLowerCase()) ||
              d.trim().toLowerCase().includes(rDeptNorm) ||
              departmentService.getReportsForDepartment(d).includes(reportKey)
          )
        ) {
          return grant;
        }
      }
    }

    return null;
  }

  // -------------------------------------------------------------
  // CORE AUTHORITATIVE EVALUATION ENGINE
  // -------------------------------------------------------------

  /**
   * Authoritative effective access evaluation
   * Derives permission from: Role ↔ Account Status ↔ Department ↔ Report ↔ Special Access ↔ Workflow State ↔ Segregation
   */
  public evaluateAccess(
    user: UserSession | UserAccount | null | undefined,
    reportKey: string | null | undefined,
    action: AccessAction,
    submission?: Partial<ReportSubmission> | null
  ): AccessEvaluationResult {
    // 1. Authentication check
    if (!user || !user.id || !user.role) {
      return {
        allowed: false,
        reason: 'Authentication credentials required for operational execution.',
        code: 'AUTH_REQUIRED',
      };
    }

    // Check Cache
    const cacheKey = this.buildCacheKey(user, reportKey, action, submission);
    const cached = this.accessCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // 2. Account Status Check
    const accountStatus: AccountStatus = (user as any).status || 'ACTIVE';
    if (accountStatus === 'PENDING_APPROVAL') {
      const res: AccessEvaluationResult = {
        allowed: false,
        reason: 'Account is pending compliance administrator approval. Operational access is blocked.',
        code: 'ACCOUNT_PENDING',
        context: { role: user.role, userDept: user.department },
      };
      this.accessCache.set(cacheKey, res);
      return res;
    }

    if (accountStatus === 'DISABLED') {
      const res: AccessEvaluationResult = {
        allowed: false,
        reason: 'Account has been disabled. Operational access is forbidden.',
        code: 'ACCOUNT_INACTIVE',
        context: { role: user.role, userDept: user.department },
      };
      this.accessCache.set(cacheKey, res);
      return res;
    }

    if (accountStatus === 'SUSPENDED') {
      const res: AccessEvaluationResult = {
        allowed: false,
        reason: 'Account is temporarily suspended pending compliance inquiry.',
        code: 'ACCOUNT_SUSPENDED',
        context: { role: user.role, userDept: user.department },
      };
      this.accessCache.set(cacheKey, res);
      return res;
    }

    const role = user.role as UserRole;
    const userDept = (user.department || '').trim();

    // 3. Global Administrative Governance Actions
    const adminOnlyActions: AccessAction[] = [
      'MANAGE_USERS',
      'MANAGE_DEPARTMENTS',
      'CONFIGURE_SIMULATOR',
      'TRIGGER_SSOT_PIPELINE',
      'GRANT_SPECIAL_ACCESS',
      'REVOKE_SPECIAL_ACCESS',
    ];

    if (adminOnlyActions.includes(action)) {
      if (role !== 'ADMIN') {
        const res: AccessEvaluationResult = {
          allowed: false,
          reason: `Action '${action}' requires ADMIN compliance privileges (current role: ${role}).`,
          code: 'ROLE_FORBIDDEN',
          context: { role, userDept },
        };
        this.accessCache.set(cacheKey, res);
        return res;
      }
      const res: AccessEvaluationResult = {
        allowed: true,
        reason: 'Authorized administrator governance action.',
        code: 'ALLOWED',
        context: { role, userDept },
      };
      this.accessCache.set(cacheKey, res);
      return res;
    }

    // 4. Auditor Governance Actions
    const auditorActions: AccessAction[] = [
      'AUDIT_INSPECT',
      'AUDIT_ATTACH_EVIDENCE',
      'AUDIT_CREATE_FINDING',
      'AUDIT_MANAGE_REMEDIATION',
      'AUDIT_EXPORT_PACKAGE',
    ];

    if (auditorActions.includes(action)) {
      if (role !== 'AUDITOR' && role !== 'ADMIN') {
        const res: AccessEvaluationResult = {
          allowed: false,
          reason: `Audit examinations and findings require AUDITOR or supervisory ADMIN role (current role: ${role}).`,
          code: 'ROLE_FORBIDDEN',
          context: { role, userDept },
        };
        this.accessCache.set(cacheKey, res);
        return res;
      }
      const res: AccessEvaluationResult = {
        allowed: true,
        reason: 'Authorized independent audit examination action.',
        code: 'ALLOWED',
        context: { role, userDept },
      };
      this.accessCache.set(cacheKey, res);
      return res;
    }

    // 5. Global View and Export permissions
    if (action === 'VIEW' || action === 'EXPORT_XLSX') {
      // All authenticated active roles (Admin, Maker, Checker, Auditor) can inspect and export reports
      const res: AccessEvaluationResult = {
        allowed: true,
        reason: `Authorized to ${action.toLowerCase()} regulatory reporting records.`,
        code: 'ALLOWED',
        context: { role, userDept, reportKey: reportKey || undefined },
      };
      this.accessCache.set(cacheKey, res);
      return res;
    }

    // 6. Strict Role Separation: Admin & Auditor Non-Operational Rule
    // Neither Admin nor Auditor may ever prepare drafts, edit numbers, approve, or deliver returns.
    if (role === 'ADMIN') {
      const res: AccessEvaluationResult = {
        allowed: false,
        reason:
          'Administrator has read-only compliance oversight. Review sign-off and operational return mutations are forbidden per NBE prudential governance directives.',
        code: 'ROLE_FORBIDDEN',
        context: { role, userDept, reportKey: reportKey || undefined },
      };
      this.accessCache.set(cacheKey, res);
      return res;
    }

    if (role === 'AUDITOR') {
      const res: AccessEvaluationResult = {
        allowed: false,
        reason:
          'Auditor has independent supervisory oversight. Review sign-off, return entry, and operational return mutations are forbidden per NBE governance directives.',
        code: 'ROLE_FORBIDDEN',
        context: { role, userDept, reportKey: reportKey || undefined },
      };
      this.accessCache.set(cacheKey, res);
      return res;
    }

    // Beyond here, action must be MAKER or CHECKER operational workflow.
    // A reportKey is mandatory for operational actions.
    if (!reportKey) {
      const res: AccessEvaluationResult = {
        allowed: false,
        reason: 'Report key is required to evaluate operational report access.',
        code: 'REPORT_NOT_FOUND',
      };
      this.accessCache.set(cacheKey, res);
      return res;
    }

    // 7. Resolve Report Definition & Lifecycle Status
    const report = getReportByKey(reportKey);
    const ssotReport = configService.getReportDefinition(reportKey);

    if (!report && !ssotReport) {
      const res: AccessEvaluationResult = {
        allowed: false,
        reason: `Regulatory report '${reportKey}' is not registered in the canonical NBE catalog.`,
        code: 'REPORT_NOT_FOUND',
        context: { role, userDept, reportKey },
      };
      this.accessCache.set(cacheKey, res);
      return res;
    }

    // Check if Report is Retired
    const reportStatus = ssotReport?.status || 'ACTIVE';
    if (reportStatus === 'RETIRED' || reportStatus === 'INACTIVE') {
      if (['CREATE_DRAFT', 'EDIT_DRAFT', 'SUBMIT_CHECKER', 'DELIVER_NBE', 'IMPORT_XLSX'].includes(action)) {
        const res: AccessEvaluationResult = {
          allowed: false,
          reason: `Report '${reportKey}' has been officially retired/decommissioned. New submissions or modifications are forbidden; historical records remain preserved.`,
          code: 'REPORT_RETIRED',
          context: { role, userDept, reportKey },
        };
        this.accessCache.set(cacheKey, res);
        return res;
      }
    }

    // 8. Department & Authority Resolution
    const defaultDept = ssotReport?.defaultDepartmentId ? configService.getDepartmentById(ssotReport.defaultDepartmentId) : null;
    const reportPrimaryDept = report?.department || defaultDept?.name || getDepartmentForReport(reportKey);
    const linkedDepts = departmentService.getDepartmentsForReport(reportKey);
    const configLinkedDepts = (ssotReport?.departmentIds || []).map((id) => {
      const d = configService.getDepartmentById(id);
      return d ? d.name : id;
    });
    const ssotDeptAssignments = configService.getDepartmentReportAssignments({ reportKey, activeOnly: true });
    const ssotAssignedDeptNames = ssotDeptAssignments.map((a) => {
      const d = configService.getDepartmentById(a.departmentId);
      return d ? d.name : a.departmentName;
    });
    const allLinkedDepts = Array.from(new Set([...linkedDepts, ...configLinkedDepts, ...ssotAssignedDeptNames]));

    // Relationship 1: Home Department Match
    const isHomeDept = Boolean(
      userDept &&
      reportPrimaryDept &&
      userDept.toLowerCase() === reportPrimaryDept.toLowerCase()
    );

    // Relationship 2: Linked Department Match (M:N)
    const isLinkedDept = Boolean(
      userDept &&
      allLinkedDepts.some((d) => d.toLowerCase() === userDept.toLowerCase())
    );

    // Relationship 3: Direct User-Report Assignment
    const directAssignments = this.userReportAssignments.get(user.id);
    const ssotUserAssignments = configService.getUserReportAssignments({ userId: user.id, reportKey });
    const isDirectAssignment = Boolean(
      (directAssignments && directAssignments.has(reportKey)) ||
      ssotUserAssignments.some((a) => a.isActive !== false)
    );

    // Relationship 4: Special Access Grants
    let grants: SpecialAccessGrant[] = (user as any).specialAccessGrants || [];
    if (grants.length === 0 && user.id && this.userProvider) {
      const u = this.userProvider.getById(user.id);
      if (u && Array.isArray(u.specialAccessGrants)) {
        grants = u.specialAccessGrants;
      }
    }
    const coveringGrant = this.findActiveGrantCoveringReport(grants, reportKey, reportPrimaryDept);
    const isSpecialAccess = Boolean(coveringGrant);

    const hasDepartmentAuthority = isHomeDept || isLinkedDept || isDirectAssignment || isSpecialAccess;

    // 9. MAKER Workflow Actions: CREATE_DRAFT, EDIT_DRAFT, VALIDATE, SUBMIT_CHECKER, IMPORT_XLSX
    if (action === 'CREATE_DRAFT' || action === 'EDIT_DRAFT' || action === 'SUBMIT_CHECKER' || action === 'IMPORT_XLSX') {
      if (role !== 'MAKER') {
        const res: AccessEvaluationResult = {
          allowed: false,
          reason: `Preparation action '${action}' requires MAKER role (current role: ${role}).`,
          code: 'ROLE_FORBIDDEN',
          context: { role, userDept, reportKey, reportDept: reportPrimaryDept },
        };
        this.accessCache.set(cacheKey, res);
        return res;
      }

      if (!hasDepartmentAuthority) {
        const res: AccessEvaluationResult = {
          allowed: false,
          reason: `Department restriction: Your department (${userDept || 'Unassigned'}) is not authorized to prepare return '${reportKey}'. This return belongs to '${reportPrimaryDept}'. Contact Administrator for Special Cross-Department Access.`,
          code: 'DEPT_MISMATCH',
          context: {
            role,
            userDept,
            reportKey,
            reportDept: reportPrimaryDept,
            isHomeDept,
            isLinkedDept,
            isSpecialAccess: false,
          },
        };
        this.accessCache.set(cacheKey, res);
        return res;
      }

      // Check Submission-Level Workflow State if modifying existing submission
      if (submission && (action === 'EDIT_DRAFT' || action === 'SUBMIT_CHECKER' || action === 'IMPORT_XLSX')) {
        const subStatus = submission.status || 'DRAFT';
        if (subStatus !== 'DRAFT' && subStatus !== 'CORRECTION_REQUIRED') {
          const res: AccessEvaluationResult = {
            allowed: false,
            reason: `Return cannot be edited or submitted in state '${subStatus}'. Only DRAFT or CORRECTION_REQUIRED submissions can be updated.`,
            code: 'INVALID_WORKFLOW_STATE',
            context: { role, userDept, reportKey, workflowStatus: subStatus },
          };
          this.accessCache.set(cacheKey, res);
          return res;
        }
      }

      const res: AccessEvaluationResult = {
        allowed: true,
        reason: isSpecialAccess
          ? `Authorized Maker operation via Special Access Grant: ${coveringGrant?.reason}`
          : 'Authorized Maker operation within assigned department boundary.',
        code: 'ALLOWED',
        context: {
          role,
          userDept,
          reportKey,
          reportDept: reportPrimaryDept,
          isHomeDept,
          isLinkedDept,
          isDirectAssignment,
          isSpecialAccess,
          grantId: coveringGrant?.id,
          grantReason: coveringGrant?.reason,
        },
      };
      this.accessCache.set(cacheKey, res);
      return res;
    }

    // 9b. MAKER Action: DELETE_DRAFT
    if (action === 'DELETE_DRAFT') {
      if (role !== 'MAKER') {
        const res: AccessEvaluationResult = {
          allowed: false,
          reason: `Draft deletion requires MAKER role (current role: ${role}).`,
          code: 'ROLE_FORBIDDEN',
          context: { role, userDept, reportKey, reportDept: reportPrimaryDept },
        };
        this.accessCache.set(cacheKey, res);
        return res;
      }

      if (submission) {
        const subStatus = (submission.status || 'DRAFT').toUpperCase();
        if (
          subStatus === 'PENDING_CHECKER' ||
          subStatus === 'APPROVED' ||
          subStatus === 'SENT' ||
          subStatus === 'SENDING'
        ) {
          const res: AccessEvaluationResult = {
            allowed: false,
            reason: `Submitted regulatory reports cannot be deleted (status: ${subStatus}). Under NBE Directive BSD/03/2020, submitted reports are permanent immutable records.`,
            code: 'INVALID_WORKFLOW_STATE',
            context: { role, userDept, reportKey, workflowStatus: subStatus },
          };
          this.accessCache.set(cacheKey, res);
          return res;
        }

        if (role === 'MAKER') {
          if (
            submission.makerId &&
            submission.makerId !== user.id &&
            (!submission.department || submission.department.toLowerCase() !== (userDept || '').toLowerCase())
          ) {
            const res: AccessEvaluationResult = {
              allowed: false,
              reason: 'Ownership violation: Makers can only delete unsubmitted reports they created or that belong to their assigned department.',
              code: 'DEPT_MISMATCH',
              context: { role, userDept, reportKey, workflowStatus: subStatus },
            };
            this.accessCache.set(cacheKey, res);
            return res;
          }
        }
      }

      const res: AccessEvaluationResult = {
        allowed: true,
        reason: 'Authorized to delete unsubmitted report draft.',
        code: 'ALLOWED',
        context: { role, userDept, reportKey },
      };
      this.accessCache.set(cacheKey, res);
      return res;
    }

    // 10. CHECKER Workflow Actions: REVIEW, APPROVE, REJECT, REQUEST_CORRECTION
    if (['REVIEW', 'APPROVE', 'REJECT', 'REQUEST_CORRECTION'].includes(action)) {
      // Segregation of Duties (Dual Control / 4-Eyes Principle)
      if (submission && submission.makerId && submission.makerId === user.id) {
        const res: AccessEvaluationResult = {
          allowed: false,
          reason: 'Segregation of duties violation: The Maker who created this submission cannot review, approve, or sign off on it as Checker.',
          code: 'DUTIES_SEGREGATION_VIOLATION',
          context: { role, userDept, reportKey, workflowStatus: submission.status },
        };
        this.accessCache.set(cacheKey, res);
        return res;
      }

      if (role !== 'CHECKER') {
        const res: AccessEvaluationResult = {
          allowed: false,
          reason: 'Only registered Checkers can perform 4-eyes reviews.',
          code: 'ROLE_FORBIDDEN',
          context: { role, userDept, reportKey, reportDept: reportPrimaryDept },
        };
        this.accessCache.set(cacheKey, res);
        return res;
      }

      if (!hasDepartmentAuthority) {
        const res: AccessEvaluationResult = {
          allowed: false,
          reason: `Checker department (${userDept || 'Unassigned'}) does not match return department (${reportPrimaryDept}). Cross-department review requires Administrator authorization.`,
          code: 'DEPT_MISMATCH',
          context: {
            role,
            userDept,
            reportKey,
            reportDept: reportPrimaryDept,
            isHomeDept,
            isLinkedDept,
            isSpecialAccess: false,
          },
        };
        this.accessCache.set(cacheKey, res);
        return res;
      }

      // Check Submission-Level Workflow State
      if (submission && submission.status && submission.status !== 'PENDING_CHECKER') {
        const res: AccessEvaluationResult = {
          allowed: false,
          reason: `Only submissions in PENDING_CHECKER status can be reviewed (current status: ${submission.status}).`,
          code: 'INVALID_WORKFLOW_STATE',
          context: { role, userDept, reportKey, workflowStatus: submission.status },
        };
        this.accessCache.set(cacheKey, res);
        return res;
      }

      const res: AccessEvaluationResult = {
        allowed: true,
        reason: isSpecialAccess
          ? `Authorized Checker sign-off via Special Access Grant: ${coveringGrant?.reason}`
          : 'Authorized Checker review within assigned department boundary.',
        code: 'ALLOWED',
        context: {
          role,
          userDept,
          reportKey,
          reportDept: reportPrimaryDept,
          isHomeDept,
          isLinkedDept,
          isDirectAssignment,
          isSpecialAccess,
          grantId: coveringGrant?.id,
          grantReason: coveringGrant?.reason,
        },
      };
      this.accessCache.set(cacheKey, res);
      return res;
    }

    // 11. DELIVER_NBE Workflow Action
    if (action === 'DELIVER_NBE') {
      if (role !== 'MAKER') {
        const res: AccessEvaluationResult = {
          allowed: false,
          reason: 'Per NBE regulations, only the authorized Maker can deliver approved returns to NBE.',
          code: 'ROLE_FORBIDDEN',
          context: { role, userDept, reportKey },
        };
        this.accessCache.set(cacheKey, res);
        return res;
      }

      if (!hasDepartmentAuthority) {
        const res: AccessEvaluationResult = {
          allowed: false,
          reason: 'Maker lacks departmental authority for final NBE delivery.',
          code: 'DEPT_MISMATCH',
          context: { role, userDept, reportKey },
        };
        this.accessCache.set(cacheKey, res);
        return res;
      }

      if (submission && submission.status !== 'APPROVED') {
        const res: AccessEvaluationResult = {
          allowed: false,
          reason: `Only returns in APPROVED state can be delivered to NBE (current state: ${submission.status}).`,
          code: 'INVALID_WORKFLOW_STATE',
          context: { role, userDept, reportKey, workflowStatus: submission.status },
        };
        this.accessCache.set(cacheKey, res);
        return res;
      }

      const res: AccessEvaluationResult = {
        allowed: true,
        reason: 'Authorized Maker for final NBE delivery.',
        code: 'ALLOWED',
        context: { role, userDept, reportKey },
      };
      this.accessCache.set(cacheKey, res);
      return res;
    }

    // 12. VALIDATE Action
    if (action === 'VALIDATE') {
      const res: AccessEvaluationResult = {
        allowed: true,
        reason: 'Authorized to validate report figures.',
        code: 'ALLOWED',
        context: { role, userDept, reportKey },
      };
      this.accessCache.set(cacheKey, res);
      return res;
    }

    return {
      allowed: false,
      reason: `Unknown action '${action}'.`,
      code: 'ROLE_FORBIDDEN',
    };
  }

  /**
   * Phase 26: Authoritative Submission-Level Access Evaluation
   * Evaluates permissions on a specific submission instance across all 4 roles:
   * MAKER, CHECKER, AUDITOR, ADMIN.
   * Enforces cross-department isolation, 4-eyes segregation of duties,
   * unsubmitted draft deletion rules, and governed submitted-record deletion/archiving.
   */
  public evaluateSubmissionAccess(
    user: UserSession | UserAccount | null | undefined,
    submission: ReportSubmission,
    action: AccessAction
  ): AccessEvaluationResult {
    if (!user || !user.id || !user.role) {
      return {
        allowed: false,
        reason: 'Authentication credentials required.',
        code: 'AUTH_REQUIRED',
      };
    }

    const role = user.role as UserRole;
    const userDept = (user.department || '').trim();

    // 1. Account status checks
    const accountStatus: AccountStatus = (user as any).status || 'ACTIVE';
    if (accountStatus !== 'ACTIVE') {
      return {
        allowed: false,
        reason: `Account is ${accountStatus.toLowerCase()}. Operational access is restricted.`,
        code:
          accountStatus === 'PENDING_APPROVAL'
            ? 'ACCOUNT_PENDING'
            : accountStatus === 'DISABLED'
            ? 'ACCOUNT_INACTIVE'
            : 'ACCOUNT_SUSPENDED',
      };
    }

    // 2. Department authority calculation for this submission
    const reportKey = submission.reportKey;
    const report = getReportByKey(reportKey);
    const ssotReport = configService.getReportDefinition(reportKey);
    const defaultDept = ssotReport?.defaultDepartmentId
      ? configService.getDepartmentById(ssotReport.defaultDepartmentId)
      : null;
    const reportPrimaryDept =
      report?.department || defaultDept?.name || getDepartmentForReport(reportKey);
    const linkedDepts = departmentService.getDepartmentsForReport(reportKey);
    const configLinkedDepts = (ssotReport?.departmentIds || []).map((id) => {
      const d = configService.getDepartmentById(id);
      return d ? d.name : id;
    });
    const allLinked = Array.from(new Set([...linkedDepts, ...configLinkedDepts]));

    const subDept = submission.department || reportPrimaryDept;
    const isHomeDept = Boolean(
      userDept &&
        ((subDept && userDept.toLowerCase() === subDept.toLowerCase()) ||
          (reportPrimaryDept && userDept.toLowerCase() === reportPrimaryDept.toLowerCase()))
    );
    const isLinkedDept = Boolean(
      userDept && allLinked.some((d) => d.toLowerCase() === userDept.toLowerCase())
    );
    const directAssignments = this.userReportAssignments.get(user.id);
    const isDirectAssignment = Boolean(directAssignments && directAssignments.has(reportKey));

    let grants: SpecialAccessGrant[] = (user as any).specialAccessGrants || [];
    if (grants.length === 0 && user.id && this.userProvider) {
      const u = this.userProvider.getById(user.id);
      if (u && Array.isArray(u.specialAccessGrants)) grants = u.specialAccessGrants;
    }
    const coveringGrant = this.findActiveGrantCoveringReport(grants, reportKey, subDept);
    const isSpecialAccess = Boolean(coveringGrant);
    const hasDeptAuthority = isHomeDept || isLinkedDept || isDirectAssignment || isSpecialAccess;

    // 3. Evaluate by Role and Action
    if (role === 'ADMIN') {
      if (
        action === 'VIEW' ||
        action === 'EXPORT_XLSX' ||
        action === 'AUDIT_INSPECT' ||
        action === 'INSPECT_HISTORY' ||
        action === 'COMMENT'
      ) {
        return {
          allowed: true,
          reason: 'Administrator oversight visibility authorized.',
          code: 'ALLOWED',
        };
      }
      if (action === 'DELETE_DRAFT') {
        const isSubmitted =
          isFinalSubmittedStatus(submission.status) || submission.status === 'PENDING_CHECKER';
        if (isSubmitted) {
          return {
            allowed: false,
            reason:
              'Submitted regulatory records cannot be hard-deleted. Under NBE Directive BSD/03/2020, use governed archive or void.',
            code: 'INVALID_WORKFLOW_STATE',
          };
        }
        return {
          allowed: true,
          reason: 'Administrator authorized to remove unsubmitted draft.',
          code: 'ALLOWED',
        };
      }
      if (action === 'ADMIN_ARCHIVE' || action === 'ADMIN_VOID') {
        return {
          allowed: true,
          reason: 'Administrator authorized for governed regulatory archiving/voiding.',
          code: 'ALLOWED',
        };
      }
      if (action === 'EDIT_DRAFT' || action === 'CREATE_DRAFT') {
        return {
          allowed: false,
          reason:
            'Administrator role is restricted from entering or editing regulatory return figures.',
          code: 'ROLE_FORBIDDEN',
        };
      }
      if (action === 'REVIEW' || action === 'APPROVE' || action === 'REJECT') {
        return {
          allowed: false,
          reason: '4-Eyes operational review is reserved for designated Checkers.',
          code: 'ROLE_FORBIDDEN',
        };
      }
    }

    if (role === 'AUDITOR') {
      if (
        action === 'VIEW' ||
        action === 'EXPORT_XLSX' ||
        action === 'AUDIT_INSPECT' ||
        action === 'INSPECT_HISTORY' ||
        action === 'COMMENT'
      ) {
        return {
          allowed: true,
          reason: 'Authorized independent auditor supervisory inspection.',
          code: 'ALLOWED',
        };
      }
      return {
        allowed: false,
        reason:
          'Independent Auditor has read-only supervisory authority. Operational mutations are forbidden.',
        code: 'ROLE_FORBIDDEN',
      };
    }

    if (role === 'MAKER') {
      // Maker must have department authority over the return
      if (!hasDeptAuthority) {
        return {
          allowed: false,
          reason: `Cross-department isolation: Your department (${userDept || 'Unassigned'}) is not authorized for return '${reportKey}' (${subDept}).`,
          code: 'DEPT_MISMATCH',
        };
      }

      if (action === 'VIEW' || action === 'EXPORT_XLSX' || action === 'COMMENT') {
        return {
          allowed: true,
          reason: 'Maker authorized to view return within assigned scope.',
          code: 'ALLOWED',
        };
      }
      if (action === 'EDIT_DRAFT') {
        const canEdit =
          submission.status === 'DRAFT' || submission.status === 'CORRECTION_REQUIRED';
        if (!canEdit) {
          return {
            allowed: false,
            reason: `Cannot edit submission in state '${submission.status}'.`,
            code: 'INVALID_WORKFLOW_STATE',
          };
        }
        return {
          allowed: true,
          reason: 'Maker authorized to edit draft.',
          code: 'ALLOWED',
        };
      }
      if (action === 'DELETE_DRAFT') {
        const isSubmitted =
          isFinalSubmittedStatus(submission.status) || submission.status === 'PENDING_CHECKER';
        if (isSubmitted) {
          return {
            allowed: false,
            reason: `Cannot delete submission in ${submission.status} state. Under NBE Directive BSD/03/2020, submitted reports are permanent immutable records.`,
            code: 'INVALID_WORKFLOW_STATE',
          };
        }
        // Ownership check: maker must have created it or belong to same department
        const isCreator = submission.makerId === user.id;
        const isDeptMember =
          submission.department &&
          submission.department.toLowerCase() === (userDept || '').toLowerCase();
        if (!isCreator && !isDeptMember && !isSpecialAccess) {
          return {
            allowed: false,
            reason:
              'Makers can only delete unsubmitted drafts they created or within their assigned department.',
            code: 'DEPT_MISMATCH',
          };
        }
        return {
          allowed: true,
          reason: 'Maker authorized to delete unsubmitted draft.',
          code: 'ALLOWED',
        };
      }
      if (
        action === 'REVIEW' ||
        action === 'APPROVE' ||
        action === 'REJECT' ||
        action === 'REQUEST_CORRECTION'
      ) {
        return {
          allowed: false,
          reason: 'Segregation of duties: Makers cannot review or approve returns.',
          code: 'ROLE_FORBIDDEN',
        };
      }
      if (action === 'ADMIN_ARCHIVE' || action === 'ADMIN_VOID') {
        return {
          allowed: false,
          reason: 'Makers have no administrative archival authority.',
          code: 'ROLE_FORBIDDEN',
        };
      }
    }

    if (role === 'CHECKER') {
      // Checker must have department authority over the return
      if (!hasDeptAuthority) {
        return {
          allowed: false,
          reason: `Cross-department isolation: Checker department (${userDept || 'Unassigned'}) is not authorized for return '${reportKey}' (${subDept}).`,
          code: 'DEPT_MISMATCH',
        };
      }

      if (
        action === 'VIEW' ||
        action === 'EXPORT_XLSX' ||
        action === 'COMMENT' ||
        action === 'FLAG'
      ) {
        return {
          allowed: true,
          reason: 'Checker authorized within review scope.',
          code: 'ALLOWED',
        };
      }
      if (
        action === 'REVIEW' ||
        action === 'APPROVE' ||
        action === 'REJECT' ||
        action === 'REQUEST_CORRECTION'
      ) {
        // Segregation of duties: Maker cannot review own submission
        if (submission.makerId && submission.makerId === user.id) {
          return {
            allowed: false,
            reason:
              'Segregation of duties violation: Maker cannot review or approve own return.',
            code: 'DUTIES_SEGREGATION_VIOLATION',
          };
        }
        if (submission.status !== 'PENDING_CHECKER') {
          return {
            allowed: false,
            reason: `Only submissions in PENDING_CHECKER status can be reviewed (current: ${submission.status}).`,
            code: 'INVALID_WORKFLOW_STATE',
          };
        }
        return {
          allowed: true,
          reason: 'Authorized Checker 4-eyes review.',
          code: 'ALLOWED',
        };
      }
      if (action === 'EDIT_DRAFT' || action === 'CREATE_DRAFT') {
        return {
          allowed: false,
          reason: 'Library access does not grant Maker editing to Checkers.',
          code: 'ROLE_FORBIDDEN',
        };
      }
      if (action === 'DELETE_DRAFT' || action === 'ADMIN_ARCHIVE' || action === 'ADMIN_VOID') {
        return {
          allowed: false,
          reason: 'Checkers have zero deletion or administrative archival authority.',
          code: 'ROLE_FORBIDDEN',
        };
      }
    }

    return {
      allowed: false,
      reason: `Action '${action}' is not permitted for role '${role}'.`,
      code: 'ROLE_FORBIDDEN',
    };
  }

  // -------------------------------------------------------------
  // EFFECTIVE REPORT PERMISSIONS MATRIX GENERATION
  // -------------------------------------------------------------

  /**
   * Generates the comprehensive effective permissions matrix across all 24 canonical returns
   * for a given user session.
   */
  public getEffectiveReportPermissionsMatrix(user: UserSession | UserAccount): EffectiveReportPermissions[] {
    if (!user || !user.id || !user.role) {
      return [];
    }
    const reportsMap = new Map<string, any>();
    getAllReports().forEach((r) => reportsMap.set(r.ReturnKey, r));
    try {
      configService.getReports().forEach((r) => {
        if (r.status === 'ACTIVE' && !reportsMap.has(r.returnKey)) {
          reportsMap.set(r.returnKey, {
            ReturnKey: r.returnKey,
            Code: r.code || r.returnKey,
            Name: r.name,
            Title: r.name,
            Category: r.category || 'Credit & Lending',
            Frequency: r.frequency || 'MONTHLY',
            department: configService.getDepartmentById(r.defaultDepartmentId)?.name || 'Credit Operations & Portfolio Management',
            ReturnItemsList: [],
            DynamicItemsList: [],
            Formulas: [],
            ValidationRules: [],
          });
        }
      });
    } catch (_) {}
    const allReports = Array.from(reportsMap.values());
    const matrix: EffectiveReportPermissions[] = [];

    for (const report of allReports) {
      const rKey = report.ReturnKey;
      const primaryDept = report.department || getDepartmentForReport(rKey);
      const linkedDepts = departmentService.getDepartmentsForReport(rKey);

      const canView = this.evaluateAccess(user, rKey, 'VIEW').allowed;
      const canCreateDraft = this.evaluateAccess(user, rKey, 'CREATE_DRAFT').allowed;
      const canEditDraft = this.evaluateAccess(user, rKey, 'EDIT_DRAFT').allowed;
      const canValidate = this.evaluateAccess(user, rKey, 'VALIDATE').allowed;
      const canSubmitToChecker = this.evaluateAccess(user, rKey, 'SUBMIT_CHECKER').allowed;
      const canReview = this.evaluateAccess(user, rKey, 'REVIEW').allowed;
      const canDeliverToNbe = this.evaluateAccess(user, rKey, 'DELIVER_NBE').allowed;
      const canAudit = this.evaluateAccess(user, rKey, 'AUDIT_INSPECT').allowed;

      // Determine authoritative basis
      let authorizedVia: EffectiveReportPermissions['authorizedVia'] = 'NONE';
      let governanceNotes = 'No operational access to this return.';
      const grants: SpecialAccessGrant[] = (user as any).specialAccessGrants || [];
      const activeGrant = this.findActiveGrantCoveringReport(grants, rKey, primaryDept) || undefined;

      const userDeptNorm = (user.department || '').trim().toLowerCase();
      const primaryDeptNorm = primaryDept.trim().toLowerCase();

      if (user.role === 'ADMIN') {
        authorizedVia = 'ADMIN_OVERSIGHT';
        governanceNotes = 'Compliance supervisory oversight. Read-only on financial figures.';
      } else if (user.role === 'AUDITOR') {
        authorizedVia = 'AUDIT_OVERSIGHT';
        governanceNotes = 'Independent internal audit examination. Read-only on submissions.';
      } else if (activeGrant) {
        authorizedVia = 'SPECIAL_ACCESS';
        governanceNotes = `Special Access Grant (${activeGrant.id}) granted by ${activeGrant.grantedBy}. Reason: ${activeGrant.reason}`;
      } else if (this.userReportAssignments.get(user.id)?.has(rKey)) {
        authorizedVia = 'DIRECT_ASSIGNMENT';
        governanceNotes = 'Direct individual user-report assignment configured by Administrator.';
      } else if (userDeptNorm && primaryDeptNorm && userDeptNorm === primaryDeptNorm) {
        authorizedVia = 'HOME_DEPARTMENT';
        governanceNotes = `Authorized via home department assignment: ${primaryDept}.`;
      } else if (linkedDepts.some((ld) => ld.trim().toLowerCase() === userDeptNorm)) {
        authorizedVia = 'LINKED_DEPARTMENT';
        governanceNotes = `Authorized via dynamic multi-department linkage: ${user.department}.`;
      }

      matrix.push({
        reportKey: rKey,
        reportTitle: report.Title,
        primaryDepartment: primaryDept,
        linkedDepartments: linkedDepts,
        canView,
        canCreateDraft,
        canEditDraft,
        canValidate,
        canSubmitToChecker,
        canReview,
        canDeliverToNbe,
        canAudit,
        authorizedVia,
        governanceNotes,
        activeGrant,
      });
    }

    return matrix;
  }

  /**
   * Helper to filter list of allowed report keys for Maker creation
   */
  public getAllowedReportKeysForUser(user: UserSession | UserAccount): string[] {
    const matrix = this.getEffectiveReportPermissionsMatrix(user);
    if (user.role === 'MAKER') {
      return matrix.filter((m) => m.canCreateDraft).map((m) => m.reportKey);
    }
    if (user.role === 'CHECKER') {
      return matrix.filter((m) => m.canReview).map((m) => m.reportKey);
    }
    if (user.role === 'AUDITOR' || user.role === 'ADMIN') {
      return matrix.map((m) => m.reportKey);
    }
    return [];
  }
}

export const effectiveAccessEngine = new EffectiveAccessEngineClass();
