/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { submissionService, DEMO_USERS } from '../services/submissionService.ts';
import { effectiveAccessEngine } from '../services/effectiveAccessEngine.ts';
import { notificationService } from '../services/notificationService.ts';
import { auditService } from '../services/auditService.ts';
import { userService } from '../services/userService.ts';
import type { UserSession, ReportSubmission, SpecialAccessGrant } from '../types/regulatory.ts';

function assert(condition: any, msg: string) {
  if (!condition) {
    throw new Error(`[Phase 36 Assertion Failure]: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

export async function runPhase36MakerSelectedCheckerAssignmentTests() {
  console.log('\n========================================================================');
  console.log('--- PHASE 36: MAKER-SELECTED CHECKER ASSIGNMENT & NOTIFICATION TESTS ---');
  console.log('========================================================================\n');

  // Ensure fresh seed state
  userService.resetDevelopmentSeedData();
  notificationService.clearAll();

  // Test Users
  const makerCredit: UserSession = {
    id: 'usr_maker_1',
    name: 'Abebe Kebede',
    email: 'abebe.kebede@oromiabank.com',
    role: 'MAKER',
    institutionCode: '0000013',
    department: 'Credit Operations & Portfolio Management',
    employeeId: 'OB-MKR-104',
    specialAccessGrants: [],
  };

  const checkerCredit1: UserSession = {
    id: 'usr_checker_1',
    name: 'Chala Desta',
    email: 'chala.desta@oromiabank.com',
    role: 'CHECKER',
    institutionCode: '0000013',
    department: 'Credit Operations & Portfolio Management',
    employeeId: 'OB-CHK-055',
    specialAccessGrants: [],
  };

  const checkerCredit2: UserSession = {
    id: 'usr_checker_credit_2',
    name: 'Almaz Bekele',
    email: 'almaz.bekele@oromiabank.com',
    role: 'CHECKER',
    institutionCode: '0000013',
    department: 'Credit Operations & Portfolio Management',
    employeeId: 'OB-CHK-056',
    specialAccessGrants: [],
  };

  const checkerTrade: UserSession = {
    id: 'usr_checker_2',
    name: 'Meron Worku',
    email: 'meron.worku@oromiabank.com',
    role: 'CHECKER',
    institutionCode: '0000013',
    department: 'Trade Services & International Banking',
    employeeId: 'OB-CHK-112',
    specialAccessGrants: [],
  };

  const reportKey = 'LOA_ADV_OUT_LA001'; // Belongs to Credit Operations & Portfolio Management

  // -------------------------------------------------------------------------
  // 1. Same-Department Checker Filtering & Eligibility
  // -------------------------------------------------------------------------
  console.log('--- 1. Checker Eligibility & Server-Side Filtering ---');

  const eligibleCheckers = effectiveAccessEngine.getEligibleCheckersForReport(reportKey, makerCredit);
  const eligibleIds = eligibleCheckers.map((c) => c.id);

  assert(
    eligibleIds.includes('usr_checker_1'),
    'Active Credit Operations Checker 1 (Chala Desta) is included in eligible Checkers.'
  );
  assert(
    eligibleIds.includes('usr_checker_credit_2'),
    'Active Credit Operations Checker 2 (Almaz Bekele) is included in eligible Checkers.'
  );

  // -------------------------------------------------------------------------
  // 2. Inactive / Disabled Checkers Excluded
  // -------------------------------------------------------------------------
  console.log('--- 2. Inactive & Disabled Checkers Excluded ---');

  assert(
    !eligibleIds.includes('usr_checker_credit_inactive'),
    'Disabled Checker (Kebede Gemechu, status: DISABLED) is strictly excluded from selector.'
  );
  assert(
    !eligibleIds.includes('usr_pending_2'),
    'Pending Approval Checker (Fikadu Tolosa, status: PENDING_APPROVAL) is strictly excluded.'
  );

  // -------------------------------------------------------------------------
  // 3. Other-Department Checkers Excluded (without Special Access)
  // -------------------------------------------------------------------------
  console.log('--- 3. Cross-Department Isolation in Selector ---');

  assert(
    !eligibleIds.includes('usr_checker_2'),
    'Trade Services Checker (Meron Worku) is excluded from Credit return BSD_01 selector.'
  );
  assert(
    !eligibleIds.includes('usr_checker_3'),
    'Specialized Asset Recovery Checker is excluded from Credit return selector.'
  );

  // -------------------------------------------------------------------------
  // 4. Maker Cannot Select Self (Segregation of Duties)
  // -------------------------------------------------------------------------
  console.log('--- 4. Maker Cannot Select Self ---');

  assert(
    !eligibleIds.includes(makerCredit.id),
    'Maker themselves (Abebe Kebede) is strictly excluded from Checker selector.'
  );

  const selfSelectVal = effectiveAccessEngine.validateCheckerSelection(
    reportKey,
    makerCredit,
    [makerCredit.id]
  );
  assert(
    !selfSelectVal.valid && selfSelectVal.error?.includes('Segregation of duties violation'),
    'Validation rejects Maker selecting their own user ID with Segregation of Duties error.'
  );

  // -------------------------------------------------------------------------
  // 5. Forged Checker ID Rejected
  // -------------------------------------------------------------------------
  console.log('--- 5. Forged Checker ID Rejection ---');

  const forgedVal = effectiveAccessEngine.validateCheckerSelection(
    reportKey,
    makerCredit,
    ['forged_checker_id_9999']
  );
  assert(
    !forgedVal.valid && forgedVal.error?.includes('Unauthorized Checker selection'),
    'Validation rejects forged/non-existent Checker ID with security error.'
  );

  const crossDeptVal = effectiveAccessEngine.validateCheckerSelection(
    reportKey,
    makerCredit,
    ['usr_checker_2'] // Trade services checker without grant
  );
  assert(
    !crossDeptVal.valid && crossDeptVal.error?.includes('Unauthorized Checker selection'),
    'Validation rejects selecting unauthorized cross-department Checker without special access.'
  );

  // -------------------------------------------------------------------------
  // 6. Duplicate Selection Prevented
  // -------------------------------------------------------------------------
  console.log('--- 6. Duplicate Selection Prevention ---');

  const duplicateVal = effectiveAccessEngine.validateCheckerSelection(
    reportKey,
    makerCredit,
    ['usr_checker_1', 'usr_checker_1']
  );
  assert(
    !duplicateVal.valid && duplicateVal.error?.includes('Duplicate reviewer selection detected'),
    'Validation rejects duplicate entries of the same Checker ID.'
  );

  // -------------------------------------------------------------------------
  // 7. Multiple Checker Selection & Assignment Persistence
  // -------------------------------------------------------------------------
  console.log('--- 7. Multiple Checker Selection & Assignment Persistence ---');

  // Create clean draft for submission test
  const testSubDraft = submissionService.createDraft(reportKey, makerCredit);

  // Submit to both Checker 1 and Checker 2
  const selectedIds = ['usr_checker_1', 'usr_checker_credit_2'];
  const submittedSub = submissionService.submitToChecker(
    testSubDraft.id,
    makerCredit,
    'Please review Q1 liquidity figures thoroughly.',
    testSubDraft.version,
    selectedIds
  );

  assert(submittedSub.status === 'PENDING_CHECKER', 'Submission status transitioned to PENDING_CHECKER.');
  assert(
    Array.isArray(submittedSub.assignedCheckerIds) &&
      submittedSub.assignedCheckerIds.length === 2 &&
      submittedSub.assignedCheckerIds[0] === 'usr_checker_1' &&
      submittedSub.assignedCheckerIds[1] === 'usr_checker_credit_2',
    'Both selected Checker IDs persisted on submission workflow record.'
  );

  assert(
    submittedSub.primaryCheckerId === 'usr_checker_1',
    'First selected reviewer designated as primaryCheckerId.'
  );
  assert(
    submittedSub.checkerId === 'usr_checker_1' && submittedSub.checkerName === 'Chala Desta',
    'Checker summary fields correctly point to primary reviewer for backward compatibility.'
  );

  assert(
    Array.isArray(submittedSub.reviewerAssignments) &&
      submittedSub.reviewerAssignments.length === 2 &&
      submittedSub.reviewerAssignments[0].isPrimary === true &&
      submittedSub.reviewerAssignments[1].isPrimary === false,
    'ReviewerAssignment array captures primary/secondary designation.'
  );

  // -------------------------------------------------------------------------
  // 8. Notifications Emitted Authoritatively to Checkers
  // -------------------------------------------------------------------------
  console.log('--- 8. Smart Notifications Emitted to Assigned Checkers ---');

  const notifsChecker1 = notificationService.getNotificationsForUser(checkerCredit1);
  const assignmentNotif1 = notifsChecker1.notifications.find(
    (n) => n.targetReportKey === reportKey && n.title.includes('New Review Assignment')
  );
  assert(Boolean(assignmentNotif1), 'Checker 1 received authoritative notification for BSD_01 assignment.');
  assert(
    assignmentNotif1?.message.includes('Maker Abebe Kebede') === true,
    'Notification message cites Maker Abebe Kebede and remarks.'
  );
  assert(assignmentNotif1?.actionTab === 'CHECKER_INBOX', 'Notification links directly to CHECKER_INBOX view.');

  const notifsChecker2 = notificationService.getNotificationsForUser(checkerCredit2);
  const assignmentNotif2 = notifsChecker2.notifications.find(
    (n) => n.targetReportKey === reportKey && n.title.includes('New Review Assignment')
  );
  assert(Boolean(assignmentNotif2), 'Checker 2 (co-assigned) also received authoritative notification.');

  // Notification Isolation: Trade Checker must NOT receive Credit notifications
  const notifsTrade = notificationService.getNotificationsForUser(checkerTrade);
  const leakedNotif = notifsTrade.notifications.find((n) => n.targetReportKey === reportKey);
  assert(!leakedNotif, 'Trade Services Checker received zero notifications for Credit return assignment.');

  // -------------------------------------------------------------------------
  // 9. Unauthorized Review Action Blocked
  // -------------------------------------------------------------------------
  console.log('--- 9. Unauthorized Review Action Blocked ---');

  let tradeReviewThrew = false;
  try {
    submissionService.reviewSubmission(submittedSub.id, 'APPROVE', checkerTrade, 'Illegitimate approval attempt');
  } catch (err: any) {
    tradeReviewThrew = true;
    assert(
      err.message.includes('department') || err.message.includes('Reviewer assignment restriction'),
      `Unauthorized cross-department review blocked: "${err.message}"`
    );
  }
  assert(tradeReviewThrew, 'Non-assigned / cross-department Checker review strictly blocked.');

  // Unassigned Checker in same department (simulate a 3rd checker not assigned)
  const unassignedCheckerCredit: UserSession = {
    id: 'usr_checker_unassigned_credit',
    name: 'Tsegaye Gemeda',
    email: 'tsegaye.gemeda@oromiabank.com',
    role: 'CHECKER',
    institutionCode: '0000013',
    department: 'Credit Operations & Portfolio Management',
    employeeId: 'OB-CHK-077',
    specialAccessGrants: [],
  };

  let unassignedReviewThrew = false;
  try {
    submissionService.reviewSubmission(submittedSub.id, 'APPROVE', unassignedCheckerCredit, 'Unassigned review');
  } catch (err: any) {
    unassignedReviewThrew = true;
    assert(
      err.message.includes('Reviewer assignment restriction'),
      `Unassigned same-department checker blocked: "${err.message}"`
    );
  }
  assert(unassignedReviewThrew, 'Unassigned same-department Checker blocked when specific reviewers were designated.');

  // -------------------------------------------------------------------------
  // 10. Checker Accepts / Opens Review Event
  // -------------------------------------------------------------------------
  console.log('--- 10. Checker Accepts / Opens Review Event ---');

  const acceptedSub = submissionService.acceptReview(submittedSub.id, checkerCredit1);
  const chk1Assignment = acceptedSub.reviewerAssignments?.find((r) => r.checkerId === checkerCredit1.id);
  assert(chk1Assignment?.status === 'ACCEPTED', 'Checker 1 assignment status transitioned to ACCEPTED.');
  assert(Boolean(chk1Assignment?.openedAt), 'Assignment timestamp recorded for opened review.');

  const notifsMakerAfterAccept = notificationService.getNotificationsForUser(makerCredit);
  const acceptNotif = notifsMakerAfterAccept.notifications.find(
    (n) => n.targetReportKey === reportKey && n.title.includes('Review In Progress')
  );
  assert(Boolean(acceptNotif), 'Maker received notification that Checker Chala Desta accepted/opened review.');

  // -------------------------------------------------------------------------
  // 11. Checker Review Decision & Maker Outcome Notification
  // -------------------------------------------------------------------------
  console.log('--- 11. Checker Review Decision & Maker Outcome Notification ---');

  const approvedSub = submissionService.reviewSubmission(
    submittedSub.id,
    'APPROVE',
    checkerCredit1,
    'All statutory reserve liquidity ratios verified against general ledger.'
  );

  assert(approvedSub.status === 'APPROVED', 'Submission transitioned to APPROVED state.');
  assert(
    approvedSub.checkerId === checkerCredit1.id,
    'Checker ID set to reviewing Checker 1.'
  );

  const updatedAssignment1 = approvedSub.reviewerAssignments?.find((r) => r.checkerId === checkerCredit1.id);
  const updatedAssignment2 = approvedSub.reviewerAssignments?.find((r) => r.checkerId === checkerCredit2.id);
  assert(updatedAssignment1?.status === 'REVIEWED', 'Reviewing Checker assignment marked as REVIEWED.');
  assert(updatedAssignment2?.status === 'SUPERSEDED', 'Secondary Checker assignment resolved as SUPERSEDED.');

  const notifsMakerAfterApprove = notificationService.getNotificationsForUser(makerCredit);
  const approveNotif = notifsMakerAfterApprove.notifications.find(
    (n) => n.targetReportKey === reportKey && n.title.includes('Approved')
  );
  assert(Boolean(approveNotif), 'Maker received review outcome notification confirming return was Approved.');
  assert(
    approveNotif?.message.includes('Chala Desta'),
    'Notification specifically names the Checker who signed off.'
  );

  // -------------------------------------------------------------------------
  // 12. Concurrency & Conflicting Reviewer Action Prevention
  // -------------------------------------------------------------------------
  console.log('--- 12. Concurrency & Conflicting Reviewer Action Prevention ---');

  // Checker 2 attempts to also review the already-approved submission
  let conflictingReviewThrew = false;
  try {
    submissionService.reviewSubmission(
      submittedSub.id,
      'REJECT',
      checkerCredit2,
      'Late conflicting review attempt'
    );
  } catch (err: any) {
    conflictingReviewThrew = true;
    assert(
      err.message.includes('Duplicate review prevented') || err.message.includes('INVALID_WORKFLOW_STATE'),
      `Duplicate/conflicting review action blocked: "${err.message}"`
    );
  }
  assert(conflictingReviewThrew, 'Second assigned Checker is strictly blocked from duplicate conflicting review action.');

  // -------------------------------------------------------------------------
  // 13. Correction Request Workflow & Notification
  // -------------------------------------------------------------------------
  console.log('--- 13. Correction Request Workflow & Notification ---');

  const draft2 = submissionService.createDraft(reportKey, makerCredit);
  const sub2 = submissionService.submitToChecker(
    draft2.id,
    makerCredit,
    'Q2 figures submitted',
    draft2.version,
    ['usr_checker_1']
  );

  const correctionSub = submissionService.reviewSubmission(
    sub2.id,
    'REQUEST_CORRECTION',
    checkerCredit1,
    'Row 4 statutory liquidity ratio formula requires recalculation.'
  );

  assert(correctionSub.status === 'CORRECTION_REQUIRED', 'Submission transitioned to CORRECTION_REQUIRED.');

  const notifsMakerCorrection = notificationService.getNotificationsForUser(makerCredit);
  const correctionNotif = notifsMakerCorrection.notifications.find(
    (n) => n.targetReportKey === reportKey && n.title.includes('Correction Requested')
  );
  assert(Boolean(correctionNotif), 'Maker received immediate notification of correction request.');
  assert(
    correctionNotif?.message.includes('recalculation'),
    'Correction notification contains Checker notes.'
  );

  // -------------------------------------------------------------------------
  // 14. Special Access Reviewer Eligibility & Assignment
  // -------------------------------------------------------------------------
  console.log('--- 14. Special Access Reviewer Eligibility & Assignment ---');

  // Grant Trade Checker special access to Credit return BSD_01
  const specialGrant: SpecialAccessGrant = {
    id: 'grant_trade_checker_bsd01',
    reportKey,
    grantedBy: 'Dawit Bekele (ADMIN)',
    grantedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    reason: 'Temporary dual-control delegation for supervisory liquidity audit',
  };

  const tradeCheckerUser = userService.getById(checkerTrade.id);
  if (tradeCheckerUser) {
    tradeCheckerUser.specialAccessGrants = [specialGrant];
  }

  const eligibleWithSpecialAccess = effectiveAccessEngine.getEligibleCheckersForReport(
    reportKey,
    makerCredit
  );
  const eligibleSpecialIds = eligibleWithSpecialAccess.map((c) => c.id);
  assert(
    eligibleSpecialIds.includes(checkerTrade.id),
    'Trade Services Checker with Special Access is now eligible and included in selector.'
  );

  const specialAssignment = eligibleWithSpecialAccess.find((c) => c.id === checkerTrade.id);
  assert(
    specialAssignment?.authorizationReason.includes('Special Access Grant'),
    'Special access reason clearly identified in Checker selector metadata.'
  );

  // -------------------------------------------------------------------------
  // 15. Audit Trail Verification
  // -------------------------------------------------------------------------
  console.log('--- 15. Audit Trail Verification ---');

  const auditLogs = auditService.getAllLogs();
  const assignLogs = auditLogs.filter((l) => l.action === 'CHECKER_ASSIGNED');
  const reviewLogs = auditLogs.filter((l) => l.action.includes('CHECKER_') || l.action === 'SUBMIT_TO_CHECKER');

  assert(assignLogs.length >= 1, 'CHECKER_ASSIGNED audit events logged in authoritative audit trail.');
  assert(
    assignLogs.some((l) => l.details.includes('usr_checker_1')),
    'Audit log details capture assigned Checker IDs and count.'
  );
  assert(
    reviewLogs.some((l) => l.action === 'CHECKER_APPROVE' && l.actorId === checkerCredit1.id),
    'Review sign-off audit log captures reviewing Checker actor ID and decision.'
  );

  console.log('\n========================================================================');
  console.log('✅ ALL PHASE 36 MAKER-SELECTED CHECKER ASSIGNMENT TESTS PASSED CLEANLY');
  console.log('========================================================================\n');
}

// Direct execution support
if (process.argv[1] && process.argv[1].includes('phase36-maker-selected-checker-assignment')) {
  runPhase36MakerSelectedCheckerAssignmentTests().catch((err) => {
    console.error('Phase 36 tests failed:', err);
    process.exit(1);
  });
}
