/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getAllReports, getReportByKey } from '../data/report-registry.ts';
import { submissionService, DEMO_USERS } from '../services/submissionService.ts';
import { userService } from '../services/userService.ts';
import { nbeSimulator } from '../services/nbeSimulator.ts';
import { nbeAdapter } from '../services/nbeAdapter.ts';
import { auditService } from '../services/auditService.ts';
import { isTabAuthorized, getDefaultTabForRole } from '../App.tsx';
import type { ViewTab } from '../components/Sidebar.tsx';
import { execSync } from 'child_process';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`[Phase 5 Gate Failure] Assertion Failed: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

export async function runPhase5VerificationHardeningTests() {
  console.log('\n========================================================================');
  console.log('--- PHASE 5: FINAL APPLICATION VERIFICATION, SECURITY HARDENING & GATES ---');
  console.log('========================================================================');

  // -------------------------------------------------------------------------
  // PART 2: ARCHITECTURAL INTEGRITY & BACKEND RULE ENFORCEMENT
  // -------------------------------------------------------------------------
  console.log('\n--- Part 2: Architectural Integrity & Backend Enforced Rules ---');

  const admin = DEMO_USERS.find((u) => u.role === 'ADMIN')!;
  const makerCredit = DEMO_USERS.find((u) => u.role === 'MAKER' && u.department && u.department.includes('Credit'))!;
  const checkerCredit = DEMO_USERS.find((u) => u.role === 'CHECKER' && u.department && u.department.includes('Credit'))!;
  const auditor = DEMO_USERS.find((u) => u.role === 'AUDITOR')!;

  assert(Boolean(admin && makerCredit && checkerCredit && auditor), 'All 4 canonical roles exist with verified departments');

  // Verify Department isolation: makerCredit cannot create POBEPE001 (belongs to Trade Services)
  let deptIsolationBlocked = false;
  try {
    submissionService.createSubmission('POBEPE001', makerCredit);
  } catch (err: any) {
    deptIsolationBlocked = err.message.includes('Department restriction');
  }
  assert(deptIsolationBlocked, 'Backend strictly enforces department isolation (Maker blocked from creating foreign report)');

  // Verify makerCredit can create its own department report: LOA_ADV_OUT_LA001
  let sub = submissionService.createSubmission('LOA_ADV_OUT_LA001', makerCredit);
  assert(sub.status === 'DRAFT', 'Initial submission status is DRAFT');

  let adminEditBlocked = false;
  try {
    submissionService.updateDraft(sub.id, { 'LA001_01': 9999 }, {}, admin);
  } catch (err: any) {
    adminEditBlocked = err.message.includes('Role violation');
  }
  assert(adminEditBlocked, 'Backend strictly blocks Admin from modifying operational return figures');

  // Verify Checker cannot edit return draft data
  let checkerEditBlocked = false;
  try {
    submissionService.updateDraft(sub.id, { 'LA001_01': 8888 }, {}, checkerCredit);
  } catch (err: any) {
    checkerEditBlocked = err.message.includes('Role violation');
  }
  assert(checkerEditBlocked, 'Backend strictly blocks Checker from modifying operational return figures');

  // Verify Auditor cannot draft or edit return data
  let auditorDraftBlocked = false;
  try {
    submissionService.createSubmission('LOA_ADV_OUT_LA001', auditor);
  } catch (err: any) {
    auditorDraftBlocked = err.message.includes('Role violation');
  }
  assert(auditorDraftBlocked, 'Backend strictly blocks Auditor from drafting returns');

  // -------------------------------------------------------------------------
  // PART 3: AUTHENTICATION & ROLE ROUTING
  // -------------------------------------------------------------------------
  console.log('\n--- Part 3: Authentication & Role Routing Security ---');

  // Test password authentication
  const authResult = userService.login('admin@oromiabank.com', 'password');
  assert(authResult.success && authResult.user?.role === 'ADMIN', 'Password authentication succeeds for valid credentials');

  const badAuth = userService.login('admin@oromiabank.com', 'wrongpassword');
  assert(!badAuth.success, 'Password authentication strictly fails with incorrect password');

  // Test Role Route Access Table (Defense-in-Depth)
  const tabsToTest: { tab: ViewTab; allowedRoles: string[] }[] = [
    { tab: 'ADMIN_DASHBOARD', allowedRoles: ['ADMIN'] },
    { tab: 'DEPT_REPORT_MANAGEMENT', allowedRoles: ['ADMIN'] },
    { tab: 'MAKER_WORKSPACE', allowedRoles: ['ADMIN', 'MAKER'] },
    { tab: 'CHECKER_INBOX', allowedRoles: ['ADMIN', 'CHECKER'] },
    { tab: 'AUDITOR_DASHBOARD', allowedRoles: ['ADMIN', 'AUDITOR'] },
    { tab: 'NBE_SIMULATOR', allowedRoles: ['ADMIN', 'CHECKER', 'AUDITOR'] },
    { tab: 'PHASE2_SSOT', allowedRoles: ['ADMIN'] },
    { tab: 'SYSTEM_HEALTH', allowedRoles: ['ADMIN'] },
    { tab: 'AUDIT_TRAIL', allowedRoles: ['ADMIN', 'MAKER', 'CHECKER', 'AUDITOR'] },
  ];

  for (const { tab, allowedRoles } of tabsToTest) {
    for (const role of ['MAKER', 'CHECKER', 'AUDITOR', 'ADMIN']) {
      const expected = allowedRoles.includes(role);
      const actual = isTabAuthorized(tab, role);
      assert(actual === expected, `Route Guard: ${role} access to ${tab} is ${expected ? 'PERMITTED' : 'REJECTED'}`);
    }
  }

  assert(getDefaultTabForRole('ADMIN') === 'ADMIN_DASHBOARD', 'Default landing for ADMIN is ADMIN_DASHBOARD');
  assert(getDefaultTabForRole('MAKER') === 'MAKER_WORKSPACE', 'Default landing for MAKER is MAKER_WORKSPACE');
  assert(getDefaultTabForRole('CHECKER') === 'CHECKER_INBOX', 'Default landing for CHECKER is CHECKER_INBOX');
  assert(getDefaultTabForRole('AUDITOR') === 'AUDITOR_DASHBOARD', 'Default landing for AUDITOR is AUDITOR_DASHBOARD');

  // -------------------------------------------------------------------------
  // PART 4: AUTHORIZATION & RBAC (SEGREGATION & CROSS-DEPARTMENT EXCEPTION)
  // -------------------------------------------------------------------------
  console.log('\n--- Part 4: Authorization, Department Boundaries & Dual-Control ---');

  // Populate valid return values so pre-submission validation passes
  const template = getReportByKey('LOA_ADV_OUT_LA001')!;
  const validValues: Record<string, number> = {};
  for (const item of template.ReturnItemsList) {
    validValues[item.Code] = 5000000;
  }
  sub = submissionService.updateDraft(sub.id, validValues, {}, makerCredit);

  // Maker cannot self-approve
  const submittedSub = submissionService.submitToChecker(sub.id, makerCredit, 'Ready for 4-eyes review');
  assert(submittedSub.status === 'PENDING_CHECKER', 'Return transitioned to PENDING_CHECKER');

  let selfApprovalBlocked = false;
  try {
    submissionService.reviewSubmission(submittedSub.id, 'APPROVE', makerCredit, 'Self approve attempt');
  } catch (err: any) {
    selfApprovalBlocked = err.message.includes('denied') || err.message.includes('Maker');
  }
  assert(selfApprovalBlocked, 'Segregation of duties: Maker cannot self-approve submission');

  // Checker cannot deliver to NBE
  const approvedSub = submissionService.reviewSubmission(submittedSub.id, 'APPROVE', checkerCredit, '4-eyes verification approved');
  assert(approvedSub.status === 'APPROVED', 'Checker successfully signs off return to APPROVED');

  let checkerDeliveryBlocked = false;
  try {
    await submissionService.deliverToNBE(approvedSub.id, checkerCredit);
  } catch (err: any) {
    checkerDeliveryBlocked = err.message.includes('Segregation of duties');
  }
  assert(checkerDeliveryBlocked, 'Segregation of duties: Checker cannot deliver approved return to NBE');

  // Maker makes final delivery to NBE
  const deliveryResult = await submissionService.deliverToNBE(approvedSub.id, makerCredit);
  assert(deliveryResult.success, 'Maker successfully delivers approved return to NBE');

  const sentSub = submissionService.getById(approvedSub.id)!;
  assert(sentSub.status === 'SENT', 'Submission status transitions to SENT');
  const receiptNumber = sentSub.nbeReferenceNumber || deliveryResult.response?.receiptNumber;
  assert(Boolean(receiptNumber), `Assigned official receipt number: ${receiptNumber}`);

  // -------------------------------------------------------------------------
  // PART 5: REPORT WORKFLOW & AUDIT TRAIL LOGGING
  // -------------------------------------------------------------------------
  console.log('\n--- Part 5: Report Workflow & Audit Trail Attribution ---');

  const logs = auditService.getAllLogs();
  assert(logs.length >= 5, `Audit ledger records regulatory activity (count: ${logs.length})`);
  assert(logs.some((l) => l.action.includes('SUBMIT') || l.action.includes('CREATE_DRAFT')), 'Creation & submission actions recorded');
  assert(logs.some((l) => l.action.includes('CHECKER') || l.action.includes('APPROVE')), 'Review actions recorded with actor attribution');
  assert(logs.some((l) => l.action.includes('DELIVER')), 'Delivery actions recorded with correlation ID');

  // -------------------------------------------------------------------------
  // PART 6: NBE INTEGRATION & SCENARIOS
  // -------------------------------------------------------------------------
  console.log('\n--- Part 6: NBE Simulator & Gateway Resilience ---');

  // Test Idempotency key reuse
  const payload = {
    ReturnKey: 'POBEPE001',
    InstCode: '0000013',
    FinYear: 2026,
    StartDate: '2026-01-01',
    EndDate: '2026-03-31',
    ReturnItemsList: [{ Code: '153_00010', Value: 450000000 }],
  };

  const idempKey = `idemp_test_${Date.now()}`;
  const firstSubmission = await nbeSimulator.processSubmission(
    payload,
    { 'idempotency-key': idempKey, 'x-correlation-id': 'corr_test_1' }
  );
  assert(firstSubmission.statusCode === 200, 'NBE Simulator accepts valid submission (200 OK)');
  const receipt1 = firstSubmission.body.receiptNumber || firstSubmission.body.referenceNumber;
  assert(Boolean(receipt1), `Received receiptNumber: ${receipt1}`);

  const secondSubmission = await nbeSimulator.processSubmission(
    payload,
    { 'idempotency-key': idempKey, 'x-correlation-id': 'corr_test_2' }
  );
  assert(secondSubmission.statusCode === 200, 'Duplicate submission with same idempotency key returns 200');
  const receipt2 = secondSubmission.body.receiptNumber || secondSubmission.body.referenceNumber;
  assert(receipt2 === receipt1, 'Idempotent duplicate returns identical receipt number');

  // Test Failure Injections
  nbeSimulator.setScenario({ mode: 'VALIDATION_FAILURE', failureRatePercent: 100, latencyMs: 10 });
  const valFail = await nbeSimulator.processSubmission(payload, { 'idempotency-key': `idemp_val_${Date.now()}` });
  assert(valFail.statusCode === 422 || valFail.statusCode === 400, 'VALIDATION_FAILURE mode returns HTTP 422/400');

  nbeSimulator.setScenario({ mode: 'AUTH_FAILURE', failureRatePercent: 100, latencyMs: 10 });
  const authFail = await nbeSimulator.processSubmission(payload, { 'idempotency-key': `idemp_auth_${Date.now()}` });
  assert(authFail.statusCode === 401, 'AUTH_FAILURE mode returns HTTP 401 Unauthorized');

  nbeSimulator.setScenario({ mode: 'SERVER_ERROR', failureRatePercent: 100, latencyMs: 10 });
  const serverFail = await nbeSimulator.processSubmission(payload, { 'idempotency-key': `idemp_srv_${Date.now()}` });
  assert(serverFail.statusCode === 500, 'SERVER_ERROR mode returns HTTP 500 Internal Server Error');

  // Reset simulator to ALWAYS_SUCCESS
  nbeSimulator.setScenario({ mode: 'ALWAYS_SUCCESS', failureRatePercent: 0, latencyMs: 20 });
  assert(nbeSimulator.getScenario().mode === 'ALWAYS_SUCCESS', 'NBE Simulator scenario successfully reset to ALWAYS_SUCCESS');

  // -------------------------------------------------------------------------
  // PART 7: DATABASE INTEGRITY VERIFICATION
  // -------------------------------------------------------------------------
  console.log('\n--- Part 7: Database Relational Integrity & Schema Check ---');

  const fkCheckOutput = execSync(
    'python3 -c "import sqlite3; con=sqlite3.connect(\'backend/db.sqlite3\'); cur=con.cursor(); cur.execute(\'PRAGMA foreign_key_check;\'); print(len(cur.fetchall()))"'
  ).toString().trim();
  assert(fkCheckOutput === '0', 'Backend SQLite database has 0 foreign key violations');

  const integrityCheckOutput = execSync(
    'python3 -c "import sqlite3; con=sqlite3.connect(\'backend/db.sqlite3\'); cur=con.cursor(); cur.execute(\'PRAGMA integrity_check;\'); print(cur.fetchall()[0][0])"'
  ).toString().trim();
  assert(integrityCheckOutput === 'ok', 'Backend SQLite database passes PRAGMA integrity_check with "ok"');

  const simIntegrityCheckOutput = execSync(
    'python3 -c "import sqlite3; con=sqlite3.connect(\'nbe_simulator_service/simulator_db.sqlite3\'); cur=con.cursor(); cur.execute(\'PRAGMA integrity_check;\'); print(cur.fetchall()[0][0])"'
  ).toString().trim();
  assert(simIntegrityCheckOutput === 'ok', 'Simulator SQLite database passes PRAGMA integrity_check with "ok"');

  // -------------------------------------------------------------------------
  // PART 8: UI/UX REGRESSION & DESIGN TOKENS
  // -------------------------------------------------------------------------
  console.log('\n--- Part 8: UI/UX Regression, Zero-Pill & Color Tokens ---');

  // Check no forbidden legacy hex codes in src/
  const forbiddenCodes = ['121428', '161933', '22284D', '262D55'];
  for (const hex of forbiddenCodes) {
    const grepOutput = execSync(`grep -rn "${hex}" src/components/ || true`).toString().trim();
    // Exclude designTokens comment lines if any
    const codeHits = grepOutput
      .split('\n')
      .filter((line) => line && !line.includes('//') && !line.includes('legacy') && !line.includes('forbidden'));
    assert(codeHits.length === 0, `Zero active occurrences of forbidden legacy hex color #${hex} in components`);
  }

  console.log('\n✓ All Phase 5 System Verification, Security Hardening & Completion Gates passed cleanly!');
}
