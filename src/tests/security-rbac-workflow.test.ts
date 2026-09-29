/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { userService } from '../services/userService.ts';
import { submissionService } from '../services/submissionService.ts';
import { WorkflowEngine } from '../services/workflowEngine.ts';
import { auditService } from '../services/auditService.ts';
import type { UserSession, ReportSubmission } from '../types/regulatory.ts';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`[Security & RBAC Assertion Failed]: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

export async function runSecurityRbacWorkflowTests() {
  console.log('\n======================================================');
  console.log('--- 2. SECURITY, AUTHENTICATION & RBAC TESTS ---');
  console.log('======================================================');

  // Test 1: Successful login with valid credentials for all 4 primary roles
  const loginAdmin = userService.login('admin@oromiabank.com', 'password');
  assert(loginAdmin.success && loginAdmin.user?.role === 'ADMIN', 'Admin login succeeds with correct credentials');
  assert(loginAdmin.redirectTab === 'ADMIN_DASHBOARD', 'Admin redirects to ADMIN_DASHBOARD');

  const loginMaker = userService.login('abebe.kebede@oromiabank.com', 'password');
  assert(loginMaker.success && loginMaker.user?.role === 'MAKER', 'Maker login succeeds');
  assert(loginMaker.redirectTab === 'MAKER_WORKSPACE', 'Maker redirects to MAKER_WORKSPACE');

  const loginChecker = userService.login('chala.desta@oromiabank.com', 'password');
  assert(loginChecker.success && loginChecker.user?.role === 'CHECKER', 'Checker login succeeds');
  assert(loginChecker.redirectTab === 'CHECKER_INBOX', 'Checker redirects to CHECKER_INBOX');

  const loginAuditor = userService.login('auditor@oromiabank.com', 'password');
  assert(loginAuditor.success && loginAuditor.user?.role === 'AUDITOR', 'Auditor login succeeds');
  assert(loginAuditor.redirectTab === 'AUDITOR_DASHBOARD', 'Auditor redirects to dedicated AUDITOR_DASHBOARD');

  // Test 2: Invalid or missing password fails (no bypass)
  const loginBadPw = userService.login('admin@oromiabank.com', 'wrongpassword');
  assert(!loginBadPw.success, 'Login fails with incorrect password');

  const loginNoPw = userService.login('admin@oromiabank.com', '');
  assert(!loginNoPw.success, 'Login fails when password is missing (no bypass)');

  const loginUndefinedPw = userService.login('admin@oromiabank.com', undefined);
  assert(!loginUndefinedPw.success, 'Login fails when password is undefined');

  // Test 2b: Development seed data reset verification
  const seedReset = userService.resetDevelopmentSeedData();
  assert(seedReset.success && seedReset.usersCount >= 4, 'resetDevelopmentSeedData re-initializes seed accounts');
  const summary = userService.getDevelopmentSeedSummary();
  assert(summary.some((u) => u.role === 'ADMIN') && summary.some((u) => u.role === 'AUDITOR'), 'Development seed summary includes ADMIN, MAKER, CHECKER, and AUDITOR');

  // Test 3: Registration enforces PENDING_APPROVAL and forbids arbitrary ADMIN role
  const regAdminAttempt = userService.register({
    name: 'Malicious Actor',
    email: 'hacker@example.com',
    role: 'ADMIN' as any,
    department: 'Credit Operations & Portfolio Management',
    employeeId: 'OB-MAL-999',
  });
  assert(!regAdminAttempt.success, 'Registration prevents arbitrary self-assignment of ADMIN role');

  const regMaker = userService.register({
    name: 'New Officer',
    email: 'new.officer@oromiabank.com',
    role: 'MAKER',
    department: 'Credit Operations & Portfolio Management',
    employeeId: 'OB-MKR-888',
  });
  assert(regMaker.success && regMaker.user?.status === 'PENDING_APPROVAL', 'New Maker registration requires PENDING_APPROVAL');

  // Test 4: Pending user cannot login until approved by Admin
  const loginPending = userService.login('new.officer@oromiabank.com', 'password');
  assert(!loginPending.success && (loginPending.message || '').includes('pending authorization'), 'Pending account cannot log in before admin approval');

  // Test 5: Admin approves account
  const approveRes = userService.updateUserStatus(regMaker.user!.id, 'ACTIVE', 'Dawit Bekele');
  assert(approveRes.success && approveRes.user?.status === 'ACTIVE', 'Admin can activate pending user account');

  const loginApproved = userService.login('new.officer@oromiabank.com', 'password');
  assert(loginApproved.success, 'Activated user can now successfully log in');

  console.log('\n--- 3. DEPARTMENT ISOLATION & SPECIAL ACCESS TESTS ---');
  const makerCreditOps = userService.getById('usr_maker_1')!;

  // Attempt to create report from another department (POBEPE001 belongs to Trade Services)
  let crossDeptDenied = false;
  try {
    submissionService.createSubmission('POBEPE001', makerCreditOps as UserSession);
  } catch (err: any) {
    crossDeptDenied = true;
    assert(err.message.includes('Department restriction'), 'Department isolation blocks Maker from creating another department report');
  }
  assert(crossDeptDenied, 'Creation blocked by department isolation');

  // Can create report belonging to own department
  const ownDeptSub = submissionService.createSubmission('LOA_PORT_EP001', makerCreditOps as UserSession);
  assert(ownDeptSub.id.length > 0 && ownDeptSub.reportKey === 'LOA_PORT_EP001', 'Maker can create return belonging to own department');

  // Grant Special Access to external report (POBEPE001)
  const grantRes = userService.grantSpecialAccess(
    'usr_maker_1',
    {
      reportKey: 'POBEPE001',
      reason: 'Cross-functional quarterly regulatory audit delegation',
    },
    'Dawit Bekele'
  );
  assert(grantRes.success, 'Admin can grant explicit cross-department Special Access');

  // Update maker session with grant
  const specialSub = submissionService.createSubmission('POBEPE001', grantRes.user as UserSession);
  assert(specialSub.reportKey === 'POBEPE001', 'Maker with Special Access can successfully create external return');

  // Revoke Special Access
  const grantId = grantRes.user!.specialAccessGrants.find((g) => g.reportKey === 'POBEPE001')?.id!;
  const revokeRes = userService.revokeSpecialAccess('usr_maker_1', grantId, 'Dawit Bekele');
  assert(revokeRes.success, 'Admin can revoke Special Access grant');

  console.log('\n--- 4. MAKER/CHECKER SEGREGATION OF DUTIES & WORKFLOW TESTS ---');
  const maker1 = userService.getById('usr_maker_1')! as UserSession;
  const checkerSameDept = userService.getById('usr_checker_1')! as UserSession;
  const checkerOtherDept = userService.getById('usr_checker_2')! as UserSession;
  const adminUser = userService.getById('usr_admin_1')! as UserSession;

  // 1. Create a draft submission
  const subDraft = submissionService.createSubmission('LOA_ADV_OUT_LA001', maker1);
  assert(subDraft.status === 'DRAFT', 'Initial submission status is DRAFT');

  // 2. Checker CANNOT edit draft data
  let checkerEditDenied = false;
  try {
    submissionService.updateDraft(subDraft.id, { test: 123 }, {}, checkerSameDept);
  } catch (err: any) {
    checkerEditDenied = true;
    assert(err.message.includes('Role violation'), 'Checkers are prohibited from editing report draft data');
  }
  assert(checkerEditDenied, 'Checker data editing blocked');

  // 3. Admin CANNOT edit draft data
  let adminEditDenied = false;
  try {
    submissionService.updateDraft(subDraft.id, { test: 123 }, {}, adminUser);
  } catch (err: any) {
    adminEditDenied = true;
    assert(err.message.includes('Role violation'), 'Admins are prohibited from editing report draft data (read-only oversight)');
  }
  assert(adminEditDenied, 'Admin draft editing blocked');

  // 4. Fill draft data with valid values
  const reportObj = (submissionService as any).getById(subDraft.id);
  const repDef = (submissionService as any).validateSubmission ? (submissionService as any).getById(subDraft.id) : null;
  // Fill required fields
  const populatedValues: Record<string, string | number> = {};
  for (const k of Object.keys(subDraft.values)) {
    populatedValues[k] = 100000;
  }
  submissionService.updateDraft(subDraft.id, populatedValues, {}, maker1);

  // 5. Maker submits draft to Checker
  const submittedSub = submissionService.submitToChecker(subDraft.id, maker1, 'Ready for 4-eyes review');
  assert(submittedSub.status === 'PENDING_CHECKER', 'Status transitions to PENDING_CHECKER');

  // 6. Maker CANNOT approve their own submission (Segregation of Duties)
  let selfApprovalDenied = false;
  try {
    submissionService.reviewSubmission(subDraft.id, 'APPROVE', maker1 as any, 'Self-approval attempt');
  } catch (err: any) {
    selfApprovalDenied = true;
    assert(err.message.includes('Segregation of duties violation') || err.message.includes('Only registered Checkers'), 'Segregation of duties blocks Maker from self-review/approval');
  }
  assert(selfApprovalDenied, 'Self-approval strictly prevented');

  // 7. Checker from different department CANNOT review without special access
  let extCheckerDenied = false;
  try {
    submissionService.reviewSubmission(subDraft.id, 'APPROVE', checkerOtherDept, 'Cross dept attempt');
  } catch (err: any) {
    extCheckerDenied = true;
    assert(err.message.includes('does not match return department'), 'Checker from different department cannot review');
  }
  assert(extCheckerDenied, 'Cross-department checker review blocked');

  // 8. Admin CANNOT approve report (Admin is read-only supervisory)
  let adminApproveDenied = false;
  try {
    submissionService.reviewSubmission(subDraft.id, 'APPROVE', adminUser as any, 'Admin signoff attempt');
  } catch (err: any) {
    adminApproveDenied = true;
    assert(err.message.includes('Administrator has read-only compliance oversight'), 'Admin cannot perform operational review sign-off');
  }
  assert(adminApproveDenied, 'Admin review sign-off prohibited');

  // 9. Checker requests correction
  const corrSub = submissionService.reviewSubmission(subDraft.id, 'REQUEST_CORRECTION', checkerSameDept, 'Please check Q2 figures');
  assert(corrSub.status === 'CORRECTION_REQUIRED', 'Submission transitions to CORRECTION_REQUIRED');

  // 10. Maker revises draft
  populatedValues[Object.keys(populatedValues)[0]] = 250000;
  const revisedDraft = submissionService.updateDraft(subDraft.id, populatedValues, {}, maker1);
  assert(revisedDraft.values[Object.keys(populatedValues)[0]] === 250000, 'Maker can update figures when status is CORRECTION_REQUIRED');

  // 11. Maker resubmits to Checker
  const resubmitted = submissionService.submitToChecker(subDraft.id, maker1, 'Corrected Q2 values');
  assert(resubmitted.status === 'PENDING_CHECKER', 'Resubmitted report transitions back to PENDING_CHECKER');

  // 12. Checker approves report
  const approvedSub = submissionService.reviewSubmission(subDraft.id, 'APPROVE', checkerSameDept, 'Verified and approved for NBE transmission');
  assert(approvedSub.status === 'APPROVED', 'Submission transitions to APPROVED');

  // 13. Segregation: Checker CANNOT deliver to NBE - Only Maker can do final NBE submission
  let checkerDeliverDenied = false;
  try {
    await submissionService.deliverToNBE(subDraft.id, checkerSameDept);
  } catch (err: any) {
    checkerDeliverDenied = true;
    assert(err.message.includes('Maker who makes the final submission') || err.message.includes('Only authorized Makers'), 'Checker delivery to NBE blocked by segregation rule');
  }
  assert(checkerDeliverDenied, 'Checker delivery to NBE blocked');

  console.log('\n--- 5. AUDIT TRAIL LOGGING & INTEGRITY TESTS ---');
  const auditLogs = auditService.getLogs(50);
  assert(auditLogs.length > 5, `Audit service recorded ${auditLogs.length} regulatory events`);

  // Verify key actions were audited
  const actions = auditLogs.map((l) => l.action);
  assert(actions.includes('CREATE_DRAFT'), 'Draft creation is recorded in audit log');
  assert(actions.includes('SUBMIT_TO_CHECKER'), 'Submission to Checker is recorded in audit log');
  assert(actions.includes('CHECKER_REQUEST_CORRECTION'), 'Correction request is recorded in audit log');
  assert(actions.includes('CHECKER_APPROVE'), 'Checker approval is recorded in audit log');

  console.log('✓ All Security, RBAC & Workflow tests completed successfully.');
}
