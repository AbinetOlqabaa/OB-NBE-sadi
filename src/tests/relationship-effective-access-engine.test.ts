/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { effectiveAccessEngine } from '../services/effectiveAccessEngine.ts';
import { submissionService, DEMO_USERS } from '../services/submissionService.ts';
import { userService, type UserAccount } from '../services/userService.ts';
import { departmentService } from '../services/departmentService.ts';
import { configService } from '../services/configService.ts';
import { auditService } from '../services/auditService.ts';
import { getAllReports } from '../data/report-registry.ts';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`[Relationship & Effective-Access Engine Assertion Failed]: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

export async function runRelationshipEffectiveAccessEngineTests(): Promise<void> {
  console.log('\n========================================================================');
  console.log('--- PHASE 5: USER / DEPT / REPORT / ROLE RELATIONSHIP & ACCESS ENGINE ---');
  console.log('========================================================================');

  // Resolve baseline demo users
  const admin = DEMO_USERS.find((u) => u.role === 'ADMIN')!;
  const makerCredit = DEMO_USERS.find((u) => u.role === 'MAKER' && u.department?.includes('Credit'))!;
  const checkerCredit = DEMO_USERS.find((u) => u.role === 'CHECKER' && u.department?.includes('Credit'))!;
  const auditor = DEMO_USERS.find((u) => u.role === 'AUDITOR')!;

  // -------------------------------------------------------------------------
  // PART 1: COMPLETE 4-ROLE SEPARATION MATRIX (ADMIN, MAKER, CHECKER, AUDITOR)
  // -------------------------------------------------------------------------
  console.log('\n--- 1. Role Capabilities Separation Matrix ---');

  // Maker permissions
  const makerCreate = effectiveAccessEngine.evaluateAccess(makerCredit, 'LOA_ADV_OUT_LA001', 'CREATE_DRAFT');
  assert(makerCreate.allowed && makerCreate.code === 'ALLOWED', 'Maker can create draft for home department report');

  const makerReview = effectiveAccessEngine.evaluateAccess(makerCredit, 'LOA_ADV_OUT_LA001', 'REVIEW');
  assert(!makerReview.allowed && makerReview.code === 'ROLE_FORBIDDEN', 'Maker is strictly forbidden from review sign-off');

  const makerAdminOp = effectiveAccessEngine.evaluateAccess(makerCredit, null, 'MANAGE_USERS');
  assert(!makerAdminOp.allowed && makerAdminOp.code === 'ROLE_FORBIDDEN', 'Maker is strictly forbidden from user administration');

  // Checker permissions
  const checkerCreate = effectiveAccessEngine.evaluateAccess(checkerCredit, 'LOA_ADV_OUT_LA001', 'CREATE_DRAFT');
  assert(!checkerCreate.allowed && checkerCreate.code === 'ROLE_FORBIDDEN', 'Checker is strictly forbidden from creating drafts');

  const checkerEdit = effectiveAccessEngine.evaluateAccess(checkerCredit, 'LOA_ADV_OUT_LA001', 'EDIT_DRAFT');
  assert(!checkerEdit.allowed && checkerEdit.code === 'ROLE_FORBIDDEN', 'Checker is strictly forbidden from editing draft figures');

  const checkerDeliver = effectiveAccessEngine.evaluateAccess(checkerCredit, 'LOA_ADV_OUT_LA001', 'DELIVER_NBE');
  assert(!checkerDeliver.allowed && checkerDeliver.code === 'ROLE_FORBIDDEN', 'Checker is strictly forbidden from NBE transmission (Maker gate)');

  // Auditor permissions: read-only examination, no mutations
  const auditorInspect = effectiveAccessEngine.evaluateAccess(auditor, 'LOA_ADV_OUT_LA001', 'AUDIT_INSPECT');
  assert(auditorInspect.allowed && auditorInspect.code === 'ALLOWED', 'Auditor is authorized for independent audit examination');

  const auditorCreateDraft = effectiveAccessEngine.evaluateAccess(auditor, 'LOA_ADV_OUT_LA001', 'CREATE_DRAFT');
  assert(!auditorCreateDraft.allowed && auditorCreateDraft.code === 'ROLE_FORBIDDEN', 'Auditor is strictly forbidden from report draft entry');

  const auditorReview = effectiveAccessEngine.evaluateAccess(auditor, 'LOA_ADV_OUT_LA001', 'REVIEW');
  assert(!auditorReview.allowed && auditorReview.code === 'ROLE_FORBIDDEN', 'Auditor is strictly forbidden from Checker review approval');

  // Admin permissions: governance and oversight, read-only on returns
  const adminManageUsers = effectiveAccessEngine.evaluateAccess(admin, null, 'MANAGE_USERS');
  assert(adminManageUsers.allowed && adminManageUsers.code === 'ALLOWED', 'Admin is authorized for user identity management');

  const adminCreateDraft = effectiveAccessEngine.evaluateAccess(admin, 'LOA_ADV_OUT_LA001', 'CREATE_DRAFT');
  assert(!adminCreateDraft.allowed && adminCreateDraft.code === 'ROLE_FORBIDDEN', 'Admin is prohibited from creating report drafts (supervisory oversight)');

  const adminReview = effectiveAccessEngine.evaluateAccess(admin, 'LOA_ADV_OUT_LA001', 'REVIEW');
  assert(!adminReview.allowed && adminReview.code === 'ROLE_FORBIDDEN', 'Admin is prohibited from Checker sign-off (supervisory oversight)');

  const adminDeliver = effectiveAccessEngine.evaluateAccess(admin, 'LOA_ADV_OUT_LA001', 'DELIVER_NBE');
  assert(!adminDeliver.allowed && adminDeliver.code === 'ROLE_FORBIDDEN', 'Admin is prohibited from NBE portal transmission');

  // -------------------------------------------------------------------------
  // PART 2: DEPARTMENT ISOLATION (SAME VS DIFFERENT DEPARTMENT)
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Department Isolation & Boundary Enforcement ---');

  // POBEPE001 belongs to Trade Services & International Banking
  const makerCreditPobepe = effectiveAccessEngine.evaluateAccess(makerCredit, 'POBEPE001', 'CREATE_DRAFT');
  assert(!makerCreditPobepe.allowed && makerCreditPobepe.code === 'DEPT_MISMATCH', 'Department boundary: Credit Maker blocked from Trade Services return');

  const checkerCreditPobepe = effectiveAccessEngine.evaluateAccess(checkerCredit, 'POBEPE001', 'REVIEW');
  assert(!checkerCreditPobepe.allowed && checkerCreditPobepe.code === 'DEPT_MISMATCH', 'Department boundary: Credit Checker blocked from reviewing Trade Services return');

  // -------------------------------------------------------------------------
  // PART 3: DYNAMIC USER ↔ REPORT DIRECT ASSIGNMENTS
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Direct User ↔ Report Assignments Without Code Modification ---');

  const testUserId = makerCredit.id;
  const targetReport = 'POBEPE001';

  // Initially denied
  assert(!effectiveAccessEngine.evaluateAccess(makerCredit, targetReport, 'CREATE_DRAFT').allowed, 'Initially denied before direct assignment');

  // Admin assigns report directly
  effectiveAccessEngine.assignReportToUser(testUserId, targetReport, 'Dawit Bekele (ADMIN)');
  const assignedReports = effectiveAccessEngine.getUserDirectReportAssignments(testUserId);
  assert(assignedReports.includes(targetReport), `Report ${targetReport} added to user direct assignments`);

  // Now permitted via direct assignment
  const evalAfterAssign = effectiveAccessEngine.evaluateAccess(makerCredit, targetReport, 'CREATE_DRAFT');
  assert(evalAfterAssign.allowed && Boolean(evalAfterAssign.context?.isDirectAssignment), 'Maker can now prepare return via direct assignment');

  // Admin removes direct assignment
  effectiveAccessEngine.removeReportFromUser(testUserId, targetReport, 'Dawit Bekele (ADMIN)');
  const evalAfterRemove = effectiveAccessEngine.evaluateAccess(makerCredit, targetReport, 'CREATE_DRAFT');
  assert(!evalAfterRemove.allowed && evalAfterRemove.code === 'DEPT_MISMATCH', 'Access immediately revoked upon removing direct assignment');

  // -------------------------------------------------------------------------
  // PART 4: CONTROLLED SPECIAL ACCESS GRANTS (SCOPE, REASON, EXPIRY, REVOKE)
  // -------------------------------------------------------------------------
  console.log('\n--- 4. Controlled Special Access Grants (Scope, Expiration & Revocation) ---');

  const testUserAccount: UserAccount = {
    id: 'usr_test_matrix_maker',
    name: 'Test Special Access Maker',
    email: 'test.maker@oromiabank.com',
    password: 'password',
    role: 'MAKER',
    status: 'ACTIVE',
    institutionCode: '0000013',
    department: 'Risk Management & Compliance Analysis',
    employeeId: 'OB-MKR-999',
    specialAccessGrants: [],
    createdAt: new Date().toISOString(),
  };

  // Case A: Specific Report Scope Grant
  const grantReport: any = {
    id: 'grant_spec_mlcplc_001',
    scope: 'REPORT',
    reportKey: 'M_LCPLC001',
    grantedBy: 'Dawit Bekele (ADMIN)',
    grantedAt: new Date().toISOString(),
    reason: 'Interim loan classification reconciliation during quarterly examination',
  };
  testUserAccount.specialAccessGrants = [grantReport];
  effectiveAccessEngine.onSpecialAccessChange(testUserAccount.id);

  const evalSpecReport = effectiveAccessEngine.evaluateAccess(testUserAccount, 'M_LCPLC001', 'CREATE_DRAFT');
  assert(evalSpecReport.allowed && Boolean(evalSpecReport.context?.isSpecialAccess), 'Report-scoped special access grant allows preparation');

  // Other report in same dept is still blocked under REPORT scope
  const evalOtherReport = effectiveAccessEngine.evaluateAccess(testUserAccount, 'TOP_20_BOR_TB001', 'CREATE_DRAFT');
  assert(!evalOtherReport.allowed, 'REPORT scope does NOT leak to other returns in that department');

  // Case B: Department Scope Grant
  const grantDept: any = {
    id: 'grant_spec_dept_credit_risk',
    scope: 'DEPARTMENT',
    department: 'Credit Risk & Prudential Reporting',
    grantedBy: 'Dawit Bekele (ADMIN)',
    grantedAt: new Date().toISOString(),
    reason: 'Quarterly delegation for Credit Risk department returns',
  };
  testUserAccount.specialAccessGrants = [grantDept];
  effectiveAccessEngine.onSpecialAccessChange(testUserAccount.id);

  assert(effectiveAccessEngine.evaluateAccess(testUserAccount, 'M_LCPLC001', 'CREATE_DRAFT').allowed, 'Dept-scoped grant permits M_LCPLC001');
  assert(effectiveAccessEngine.evaluateAccess(testUserAccount, 'TOP_20_BOR_TB001', 'CREATE_DRAFT').allowed, 'Dept-scoped grant permits TOP_20_BOR_TB001');

  // Case C: Expired Grant
  const expiredGrant: any = {
    id: 'grant_expired_001',
    scope: 'REPORT',
    reportKey: 'POBEPE001',
    grantedBy: 'Dawit Bekele (ADMIN)',
    grantedAt: '2026-01-01T00:00:00Z',
    expiresAt: '2026-01-31T23:59:59Z', // Past date
    reason: 'Temporary delegation in January',
  };
  testUserAccount.specialAccessGrants = [expiredGrant];
  effectiveAccessEngine.onSpecialAccessChange(testUserAccount.id);

  const evalExpired = effectiveAccessEngine.evaluateAccess(testUserAccount, 'POBEPE001', 'CREATE_DRAFT');
  assert(!evalExpired.allowed && evalExpired.code === 'DEPT_MISMATCH', 'Expired grant is rejected and access denied');

  // Case D: Formally Revoked Grant
  const revokedGrant: any = {
    id: 'grant_revoked_001',
    scope: 'REPORT',
    reportKey: 'POBEPE001',
    grantedBy: 'Dawit Bekele (ADMIN)',
    grantedAt: new Date().toISOString(),
    revoked: true,
    revokedAt: new Date().toISOString(),
    revokedBy: 'Dawit Bekele (ADMIN)',
    reason: 'Prematurely revoked due to staff reassignment',
  };
  testUserAccount.specialAccessGrants = [revokedGrant];
  effectiveAccessEngine.onSpecialAccessChange(testUserAccount.id);

  const evalRevoked = effectiveAccessEngine.evaluateAccess(testUserAccount, 'POBEPE001', 'CREATE_DRAFT');
  assert(!evalRevoked.allowed && evalRevoked.code === 'DEPT_MISMATCH', 'Revoked grant is immediately barred');

  // -------------------------------------------------------------------------
  // PART 5: ACCOUNT STATUS ENFORCEMENT (INACTIVE, PENDING, SUSPENDED)
  // -------------------------------------------------------------------------
  console.log('\n--- 5. Account Lifecycle & Status Enforcement ---');

  const pendingUser: any = { ...makerCredit, id: 'usr_pending_test', status: 'PENDING_APPROVAL' };
  const evalPending = effectiveAccessEngine.evaluateAccess(pendingUser, 'LOA_ADV_OUT_LA001', 'CREATE_DRAFT');
  assert(!evalPending.allowed && evalPending.code === 'ACCOUNT_PENDING', 'Pending approval user denied operational draft creation');

  const disabledUser: any = { ...makerCredit, id: 'usr_disabled_test', status: 'DISABLED' };
  const evalDisabled = effectiveAccessEngine.evaluateAccess(disabledUser, 'LOA_ADV_OUT_LA001', 'CREATE_DRAFT');
  assert(!evalDisabled.allowed && evalDisabled.code === 'ACCOUNT_INACTIVE', 'Disabled user denied operational draft creation');

  const suspendedUser: any = { ...checkerCredit, id: 'usr_suspended_test', status: 'SUSPENDED' };
  const evalSuspended = effectiveAccessEngine.evaluateAccess(suspendedUser, 'LOA_ADV_OUT_LA001', 'REVIEW');
  assert(!evalSuspended.allowed && evalSuspended.code === 'ACCOUNT_SUSPENDED', 'Suspended user denied review operations');

  // -------------------------------------------------------------------------
  // PART 6: RETIRED / DECOMMISSIONED REPORT LIFECYCLE
  // -------------------------------------------------------------------------
  console.log('\n--- 6. Retired & Decommissioned Report Lifecycle ---');

  // Register a retired test report definition in configService
  try {
    configService.createReportDefinition(
      {
        returnKey: 'RET_DEPRECATED_001',
        name: 'Deprecated Loan Schedule 2024',
        code: 'RET_001',
        description: 'Historical decommissioned return',
        category: 'Credit & Lending',
        frequency: 'ANNUAL',
        instCode: '0000013',
        finYear: 2024,
        defaultDepartmentId: 'dept_credit_ops',
        status: 'RETIRED' as any,
      },
      { id: 'usr_admin_1', name: 'Dawit Bekele', role: 'ADMIN' }
    );
  } catch {}

  const evalRetiredCreate = effectiveAccessEngine.evaluateAccess(makerCredit, 'RET_DEPRECATED_001', 'CREATE_DRAFT');
  assert(!evalRetiredCreate.allowed && evalRetiredCreate.code === 'REPORT_RETIRED', 'Retired report blocks new draft creation');

  const evalRetiredView = effectiveAccessEngine.evaluateAccess(makerCredit, 'RET_DEPRECATED_001', 'VIEW');
  assert(evalRetiredView.allowed && evalRetiredView.code === 'ALLOWED', 'Historical view remains preserved on retired report');

  // -------------------------------------------------------------------------
  // PART 7: 4-EYES SEGREGATION OF DUTIES & WORKFLOW STATES
  // -------------------------------------------------------------------------
  console.log('\n--- 7. Segregation of Duties (Dual Control / 4-Eyes Principle) ---');

  const mockSubmission: any = {
    id: 'sub_segregation_test',
    reportKey: 'LOA_ADV_OUT_LA001',
    makerId: makerCredit.id,
    makerName: makerCredit.name,
    department: 'Credit Operations & Portfolio Management',
    status: 'PENDING_CHECKER',
  };

  // Self-approval attempt: Maker cannot review own report even if they pass user session as checker
  const selfReviewAttempt: any = { ...makerCredit, role: 'CHECKER' };
  const evalSelfReview = effectiveAccessEngine.evaluateAccess(selfReviewAttempt, 'LOA_ADV_OUT_LA001', 'APPROVE', mockSubmission);
  assert(!evalSelfReview.allowed && evalSelfReview.code === 'DUTIES_SEGREGATION_VIOLATION', 'Self-approval strictly rejected under 4-eyes principle');

  // Independent checker can review
  const evalIndependentReview = effectiveAccessEngine.evaluateAccess(checkerCredit, 'LOA_ADV_OUT_LA001', 'APPROVE', mockSubmission);
  assert(evalIndependentReview.allowed && evalIndependentReview.code === 'ALLOWED', 'Independent Checker in same department is authorized for 4-eyes approval');

  // -------------------------------------------------------------------------
  // PART 8: COMPLETE 24-REPORT EFFECTIVE PERMISSIONS MATRIX
  // -------------------------------------------------------------------------
  console.log('\n--- 8. Complete 24-Report Effective Permissions Matrix ---');

  const matrixMaker = effectiveAccessEngine.getEffectiveReportPermissionsMatrix(makerCredit);
  assert(matrixMaker.length >= 24, `Matrix generated for Maker across all ${matrixMaker.length} returns (at least 24 statutory returns)`);
  const makerHomeReports = matrixMaker.filter((m) => m.authorizedVia === 'HOME_DEPARTMENT');
  assert(makerHomeReports.length > 0, `Maker has ${makerHomeReports.length} authorized home department returns`);

  const matrixAuditor = effectiveAccessEngine.getEffectiveReportPermissionsMatrix(auditor);
  assert(matrixAuditor.every((m) => m.canView && m.canAudit), 'Auditor has comprehensive supervisory view across all 24 returns');
  assert(matrixAuditor.every((m) => !m.canCreateDraft && !m.canReview), 'Auditor is blocked from creating drafts or signing off on all 24 returns');

  const matrixAdmin = effectiveAccessEngine.getEffectiveReportPermissionsMatrix(admin);
  assert(matrixAdmin.every((m) => m.canView && !m.canCreateDraft && !m.canReview && !m.canDeliverToNbe), 'Admin has oversight view and is prohibited from return entry across all 24 returns');

  // -------------------------------------------------------------------------
  // PART 9: AUTHORIZATION CACHE INVALIDATION
  // -------------------------------------------------------------------------
  console.log('\n--- 9. Cache Invalidation & Real-Time Sync ---');

  // Evaluate and populate cache
  effectiveAccessEngine.evaluateAccess(makerCredit, 'LOA_ADV_OUT_LA001', 'CREATE_DRAFT');
  
  // Invalidate specific user
  effectiveAccessEngine.invalidateUser(makerCredit.id);
  assert(true, 'User-specific cache invalidation executes without error');

  // Invalidate all
  effectiveAccessEngine.invalidateAll('Test suite complete purge');
  assert(true, 'Full cache purge executes cleanly');

  console.log('\n✅ All Phase 5 Relationship & Effective-Access Engine tests passed cleanly.');
}
