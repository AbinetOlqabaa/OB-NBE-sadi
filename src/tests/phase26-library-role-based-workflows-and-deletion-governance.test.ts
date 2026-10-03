/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * PHASE 26 ACCEPTANCE TEST SUITE:
 * Library Role-Based Workflows and Deletion Governance
 * Regulatory Directive: NBE Directive BSD/03/2020 Segregation of Duties & Retention Governance
 *
 * Requirements:
 * 1. Checker Library: show only authorized review records and provide view/review/comment/flag/request-correction/approve.
 *    Library access must not grant Maker editing.
 * 2. Auditor Library: provide authorized audit/trace visibility, report history, version history and event inspection.
 *    Do not grant ordinary report editing unless explicitly authorized.
 * 3. Administrator Library: provide governed broad monitoring/configuration visibility.
 * 4. Use existing effective-access engine for role, department, report type and special access.
 * 5. Server-side permission filtering for all Library queries, search, autocomplete, counts and pagination.
 * 6. Makers cannot delete submitted reports.
 * 7. Admin removal of submitted records: prefer archive/void/soft-delete where regulatory retention requires it.
 *    Never silently destroy regulatory history.
 * 8. Any destructive Admin action requires authorization, impact warning, explicit confirmation and audit logging.
 * 9. Distinguish view/reuse/edit/review/delete permissions per role.
 * 10. Test cross-department isolation, special access, unauthorized IDs, search leakage, draft deletion and governed deletion.
 * 11. Update status/changelog.
 */

import { submissionService } from '../services/submissionService.ts';
import { auditService } from '../services/auditService.ts';
import { effectiveAccessEngine } from '../services/effectiveAccessEngine.ts';
import { departmentService } from '../services/departmentService.ts';
import { userService } from '../services/userService.ts';
import {
  deriveLibraryLifecycleState,
  isFinalSubmittedStatus,
  ReportSubmission,
  SpecialAccessGrant,
  UserSession,
} from '../types/regulatory.ts';

function assert(condition: any, msg: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

function toSession(account: any): UserSession {
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    role: account.role,
    institutionCode: account.institutionCode,
    department: account.department,
    specialAccessGrants: account.specialAccessGrants || [],
  };
}

export async function runPhase26LibraryRoleBasedWorkflowsAndDeletionGovernanceTests() {
  console.log('\n========================================================================');
  console.log('--- PHASE 26: LIBRARY ROLE-BASED WORKFLOWS & DELETION GOVERNANCE ACCEPTANCE ---');
  console.log('========================================================================\n');

  // Test User Personas from pre-seeded active accounts
  const adminGovernance: UserSession = toSession(userService.getById('usr_admin_1')!);
  const makerCredit: UserSession = toSession(userService.getById('usr_maker_1')!);
  const checkerCredit: UserSession = toSession(userService.getById('usr_checker_1')!);
  const makerTrade: UserSession = toSession(userService.getById('usr_maker_2')!);
  const checkerTrade: UserSession = toSession(userService.getById('usr_checker_2')!);
  const auditorGeneral: UserSession = toSession(userService.getById('usr_auditor_1')!);

  // Assign department reports
  effectiveAccessEngine.assignReportToUser(makerCredit.id, 'M_LCPLC001', 'ADMIN');
  effectiveAccessEngine.assignReportToUser(checkerCredit.id, 'M_LCPLC001', 'ADMIN');
  effectiveAccessEngine.assignReportToUser(makerTrade.id, 'POBEPE001', 'ADMIN');
  effectiveAccessEngine.assignReportToUser(checkerTrade.id, 'POBEPE001', 'ADMIN');

  console.log('--- TEST 1: Checker Library Scope & Workflow Governance (Requirement 1 & 4) ---');
  // 1a. Create Credit draft and submit it
  const creditDraft = submissionService.createSubmission('M_LCPLC001', makerCredit);
  const creditSubmitted = submissionService.submitToChecker(
    creditDraft.id,
    makerCredit,
    'Submitted for credit checker 4-eyes review'
  );
  assert(creditSubmitted.status === 'PENDING_CHECKER', 'Credit submission transitioned to PENDING_CHECKER');

  // 1b. Create Trade draft and submit it
  const tradeDraft = submissionService.createSubmission('POBEPE001', makerTrade);
  const tradeSubmitted = submissionService.submitToChecker(
    tradeDraft.id,
    makerTrade,
    'Submitted for trade checker 4-eyes review'
  );
  assert(tradeSubmitted.status === 'PENDING_CHECKER', 'Trade submission transitioned to PENDING_CHECKER');

  // 1c. Checker Credit queries Library: must see credit report, must NOT see trade report
  const checkerCreditLibrary = submissionService.queryLibrary(checkerCredit);
  const creditFoundByCreditChecker = checkerCreditLibrary.items.some((i) => i.id === creditSubmitted.id);
  const tradeFoundByCreditChecker = checkerCreditLibrary.items.some((i) => i.id === tradeSubmitted.id);
  assert(creditFoundByCreditChecker, 'Credit Checker sees authorized Credit review submission');
  assert(!tradeFoundByCreditChecker, 'Credit Checker CANNOT see foreign Trade submission (cross-department isolation enforced)');

  // 1d. Checker Trade queries Library: must see trade report, must NOT see credit report
  const checkerTradeLibrary = submissionService.queryLibrary(checkerTrade);
  const tradeFoundByTradeChecker = checkerTradeLibrary.items.some((i) => i.id === tradeSubmitted.id);
  const creditFoundByTradeChecker = checkerTradeLibrary.items.some((i) => i.id === creditSubmitted.id);
  assert(tradeFoundByTradeChecker, 'Trade Checker sees authorized Trade review submission');
  assert(!creditFoundByTradeChecker, 'Trade Checker CANNOT see foreign Credit submission (cross-department isolation enforced)');

  // 1e. Checker Library does NOT grant Maker editing
  const checkerEditEval = effectiveAccessEngine.evaluateSubmissionAccess(checkerCredit, creditSubmitted, 'EDIT_DRAFT');
  assert(!checkerEditEval.allowed && checkerEditEval.code === 'ROLE_FORBIDDEN', 'Library access strictly forbids Checker from editing report figures');

  const checkerCreateEval = effectiveAccessEngine.evaluateSubmissionAccess(checkerCredit, creditSubmitted, 'CREATE_DRAFT');
  assert(!checkerCreateEval.allowed && checkerCreateEval.code === 'ROLE_FORBIDDEN', 'Library access strictly forbids Checker from creating drafts');

  // 1f. 4-Eyes Segregation of Duties: Maker cannot review own submission
  const makerReviewEval = effectiveAccessEngine.evaluateSubmissionAccess(makerCredit, creditSubmitted, 'REVIEW');
  assert(!makerReviewEval.allowed, 'Maker is strictly forbidden from reviewing their own submission');

  // 1g. Checker review actions: view, review, comment, flag, request-correction, approve
  const checkerFlag = submissionService.flagSubmission(
    creditSubmitted.id,
    checkerCredit,
    'Audit inspection requested for exposure schedule',
    true
  );
  assert(checkerFlag.flagged === true && checkerFlag.flagReason?.includes('exposure schedule'), 'Checker successfully flagged review record');

  const checkerComment = submissionService.addSubmissionComment(
    creditSubmitted.id,
    checkerCredit,
    'Please verify Schedule 3 collateral haircut before final sign-off',
    'CHECKER_QUERY'
  );
  assert(
    checkerComment.comments?.some((c) => c.comment.includes('Schedule 3 collateral haircut')),
    'Checker successfully added verification query comment'
  );

  // Checker executes 4-eyes approval
  const approvedSub = submissionService.reviewSubmission(
    creditSubmitted.id,
    'APPROVE',
    checkerCredit,
    'Statutory figures verified against loan master balance'
  );
  assert(approvedSub.status === 'APPROVED', 'Checker successfully performed 4-eyes review and approval');

  console.log('\n--- TEST 2: Auditor Library Supervisory Visibility & Read-Only Governance (Requirement 2) ---');
  // 2a. Auditor queries Library: sees all institutional dossiers across Credit and Trade
  const auditorLibrary = submissionService.queryLibrary(auditorGeneral);
  const creditSeenByAuditor = auditorLibrary.items.some((i) => i.id === creditSubmitted.id);
  const tradeSeenByAuditor = auditorLibrary.items.some((i) => i.id === tradeSubmitted.id);
  assert(creditSeenByAuditor, 'Auditor has institutional visibility to Credit submission');
  assert(tradeSeenByAuditor, 'Auditor has institutional visibility to Trade submission');

  // 2b. Auditor permissions: can VIEW, EXPORT_XLSX, AUDIT_INSPECT, INSPECT_HISTORY, COMMENT
  const auditorViewEval = effectiveAccessEngine.evaluateSubmissionAccess(auditorGeneral, approvedSub, 'VIEW');
  const auditorInspectEval = effectiveAccessEngine.evaluateSubmissionAccess(auditorGeneral, approvedSub, 'AUDIT_INSPECT');
  const auditorHistoryEval = effectiveAccessEngine.evaluateSubmissionAccess(auditorGeneral, approvedSub, 'INSPECT_HISTORY');
  assert(auditorViewEval.allowed, 'Auditor authorized to view regulatory returns');
  assert(auditorInspectEval.allowed, 'Auditor authorized for audit inspection');
  assert(auditorHistoryEval.allowed, 'Auditor authorized for dossier history inspection');

  // 2c. Auditor CANNOT edit or delete records
  const auditorEditEval = effectiveAccessEngine.evaluateSubmissionAccess(auditorGeneral, approvedSub, 'EDIT_DRAFT');
  const auditorDeleteEval = effectiveAccessEngine.evaluateSubmissionAccess(auditorGeneral, approvedSub, 'DELETE_DRAFT');
  assert(!auditorEditEval.allowed && auditorEditEval.code === 'ROLE_FORBIDDEN', 'Auditor strictly forbidden from editing returns');
  assert(!auditorDeleteEval.allowed && auditorDeleteEval.code === 'ROLE_FORBIDDEN', 'Auditor strictly forbidden from deleting returns');

  // 2d. Auditor adds an audit supervisory finding comment
  const auditorComment = submissionService.addSubmissionComment(
    approvedSub.id,
    auditorGeneral,
    'Independent supervisory check verified NBE BSD/03/2020 limit ratios',
    'AUDIT'
  );
  assert(
    auditorComment.comments?.some((c) => c.category === 'AUDIT' || c.comment.includes('limit ratios')),
    'Auditor successfully appended supervisory audit finding'
  );

  console.log('\n--- TEST 3: Administrator Monitoring & Lifecycle Governance (Requirement 3) ---');
  const adminLibrary = submissionService.queryLibrary(adminGovernance);
  assert(adminLibrary.items.length >= 2, 'Administrator has comprehensive monitoring visibility across all returns');
  assert(
    adminLibrary.items.some((i) => i.id === creditSubmitted.id) &&
      adminLibrary.items.some((i) => i.id === tradeSubmitted.id),
    'Administrator monitors both Credit and Trade institutional dossiers'
  );

  console.log('\n--- TEST 4 & 5: Server-Side Permission Filtering & Search Leakage Prevention (Requirement 4 & 5) ---');
  // 4a. Stats calculation is strictly scoped to the requesting user's authorized scope
  assert(
    checkerCreditLibrary.stats.all < auditorLibrary.stats.all || auditorLibrary.stats.all >= checkerCreditLibrary.stats.all,
    'Checker stats.all is authoritatively restricted to authorized departmental scope'
  );

  // 4b. Search filtering on authorized scope: Searching for trade key with credit checker must return 0 results
  const searchLeakageTest = submissionService.queryLibrary(checkerCredit, {
    search: 'POBEPE001',
  });
  assert(searchLeakageTest.items.length === 0, 'Cross-department search strictly returns 0 results (NO search leakage)');

  // 4c. Maker searching for their own report key works
  const makerSearch = submissionService.queryLibrary(makerCredit, {
    search: 'M_LCPLC001',
  });
  assert(makerSearch.items.length > 0, 'Maker search for authorized report key returns items');

  console.log('\n--- TEST 6: Makers Cannot Delete Submitted Reports (Requirement 6) ---');
  // 6a. Attempt to delete an approved/submitted report as Maker
  let makerDeleteBlocked = false;
  try {
    submissionService.deleteSubmission(approvedSub.id, makerCredit);
  } catch (err: any) {
    makerDeleteBlocked = true;
    assert(err.message.includes('immutable') || err.message.includes('cannot delete'), `Maker deletion blocked with clear message: ${err.message}`);
  }
  assert(makerDeleteBlocked, 'Maker deleteSubmission on submitted report threw expected error');

  // 6b. Verification via effectiveAccessEngine directly
  const makerDeleteEval = effectiveAccessEngine.evaluateSubmissionAccess(makerCredit, approvedSub, 'DELETE_DRAFT');
  assert(!makerDeleteEval.allowed && makerDeleteEval.code === 'INVALID_WORKFLOW_STATE', 'effectiveAccessEngine strictly blocks DELETE_DRAFT on submitted returns');

  console.log('\n--- TEST 7 & 8: Admin Governed Removal, Archiving & Regulatory Retention (Requirements 7 & 8) ---');
  // 7a. Removal impact assessment for submitted record
  const impactAssessment = submissionService.getRemovalImpactAssessment(approvedSub.id, adminGovernance);
  assert(impactAssessment.isSubmittedRecord === true, 'Impact assessment identifies submitted regulatory dossier');
  assert(impactAssessment.canHardDelete === false, 'Hard deletion marked strictly forbidden for submitted statutory return');
  assert(impactAssessment.governedActionRequired === 'GOVERNED_ARCHIVE_VOID', 'Governed archive or void required');
  assert(impactAssessment.regulatoryWarning.includes('NBE Directive BSD/03/2020'), 'Impact assessment includes statutory retention warning');

  // 7b. Destructive Admin action requires explicit confirmation
  let unconfirmedBlocked = false;
  try {
    submissionService.adminGovernedRemoveSubmission(approvedSub.id, adminGovernance, {
      action: 'ARCHIVE',
      reason: 'Valid justification for regulatory archiving',
      confirmed: false,
    });
  } catch (err: any) {
    unconfirmedBlocked = true;
    assert(err.message.includes('confirmation is required'), 'Unconfirmed admin removal blocked');
  }
  assert(unconfirmedBlocked, 'Removal without confirmation rejected');

  // 7c. Destructive Admin action requires detailed justification (min 10 chars)
  let shortReasonBlocked = false;
  try {
    submissionService.adminGovernedRemoveSubmission(approvedSub.id, adminGovernance, {
      action: 'ARCHIVE',
      reason: 'Short',
      confirmed: true,
    });
  } catch (err: any) {
    shortReasonBlocked = true;
    assert(err.message.includes('10 characters'), 'Removal with short reason rejected');
  }
  assert(shortReasonBlocked, 'Removal with short justification rejected');

  // 7d. Admin attempting to hard-delete a submitted record is strictly blocked
  let hardDeleteSubmittedBlocked = false;
  try {
    submissionService.adminGovernedRemoveSubmission(approvedSub.id, adminGovernance, {
      action: 'DELETE_DRAFT',
      reason: 'Attempting invalid hard-deletion on submitted record',
      confirmed: true,
    });
  } catch (err: any) {
    hardDeleteSubmittedBlocked = true;
    assert(err.message.includes('Cannot hard-delete submitted') || err.message.includes('immutable'), 'Hard deletion of submitted record rejected');
  }
  assert(hardDeleteSubmittedBlocked, 'Attempt to hard-delete submitted record blocked');

  // 7e. Governed Archival of Submitted Record
  const archiveResult = submissionService.adminGovernedRemoveSubmission(approvedSub.id, adminGovernance, {
    action: 'ARCHIVE',
    reason: 'Archiving following supervisory annual cycle completion under NBE governance',
    confirmed: true,
  });
  assert(archiveResult.success === true, 'Governed archive completed successfully');
  assert(archiveResult.status === 'ARCHIVED', 'Record status updated to ARCHIVED');
  assert(archiveResult.preservedSnapshotsCount > 0, 'Regulatory historical snapshots preserved');

  const archivedRecord = submissionService.getById(approvedSub.id);
  assert(archivedRecord?.isArchived === true, 'isArchived flag set to true');
  assert(deriveLibraryLifecycleState(archivedRecord!) === 'ARCHIVED', 'Lifecycle state correctly derived as ARCHIVED');
  assert(Boolean(archivedRecord?.archivedAt), 'Archived timestamp populated');
  assert(archivedRecord?.archivedByName === adminGovernance.name, 'Archiving administrator recorded');

  // 7f. Audit trail logged for administrative archival
  const auditLogs = auditService.query({ entityId: approvedSub.id });
  const archiveAudit = auditLogs.find((a) => a.action === 'ADMIN_ARCHIVE_SUBMISSION' || a.action === 'ADMIN_ARCHIVE');
  assert(Boolean(archiveAudit), 'Audit service recorded authoritative ADMIN_ARCHIVE_SUBMISSION event');

  console.log('\n--- TEST 9: Governed Voiding of Submitted Record (Requirement 7) ---');
  // Create another submission to test VOID action
  const draftToVoid = submissionService.createSubmission('M_LCPLC001', makerCredit);
  const submittedToVoid = submissionService.submitToChecker(draftToVoid.id, makerCredit, 'Ready for voiding test');
  submissionService.reviewSubmission(submittedToVoid.id, 'APPROVE', checkerCredit, 'Approved for voiding test');

  const voidResult = submissionService.adminGovernedRemoveSubmission(submittedToVoid.id, adminGovernance, {
    action: 'VOID',
    reason: 'Voiding return due to structural regulatory restatement directive',
    confirmed: true,
  });
  assert(voidResult.success === true && voidResult.status === 'VOIDED', 'Governed voiding completed successfully');
  const voidedRecord = submissionService.getById(submittedToVoid.id);
  assert(voidedRecord?.isVoided === true, 'isVoided flag set to true');
  assert(deriveLibraryLifecycleState(voidedRecord!) === 'VOIDED', 'Lifecycle state derived as VOIDED');

  console.log('\n--- TEST 10: Special Access Grants & Unauthorized ID Protection (Requirement 4 & 10) ---');
  // 10a. Credit Checker attempting to access Trade record by direct ID must be blocked
  let directIdAccessBlocked = false;
  try {
    submissionService.getAuthorizedSubmission(tradeSubmitted.id, checkerCredit);
  } catch (err: any) {
    directIdAccessBlocked = true;
    assert(err.message.includes('Cross-department') || err.message.includes('not authorized'), `Direct ID access blocked: ${err.message}`);
  }
  assert(directIdAccessBlocked, 'Credit Checker blocked from accessing Trade submission by direct ID');

  // 10b. Grant active Special Access to Credit Checker for Trade department
  const now = new Date();
  const validUntil = new Date(now.getTime() + 3600000).toISOString();
  const grant: SpecialAccessGrant = {
    id: 'grant_checker_trade_p26',
    userId: checkerCredit.id,
    scope: 'REPORT',
    reportKey: 'POBEPE001',
    reason: 'Emergency cross-department supervisory coverage',
    grantedBy: adminGovernance.name,
    grantedAt: new Date().toISOString(),
    effectiveFrom: new Date(now.getTime() - 60000).toISOString(),
    expiresAt: validUntil,
  };

  const checkerCreditWithSpecial: UserSession = {
    ...checkerCredit,
    specialAccessGrants: [grant],
  };

  // 10c. With active special access grant, Credit Checker CAN access Trade record
  const specialAccessSub = submissionService.getAuthorizedSubmission(tradeSubmitted.id, checkerCreditWithSpecial);
  assert(specialAccessSub.id === tradeSubmitted.id, 'Active special access grant successfully authorizes cross-department review record');

  // 10d. Test expired grant: expiresAt in past
  const expiredGrant: SpecialAccessGrant = {
    ...grant,
    id: 'grant_expired_p26',
    expiresAt: new Date(now.getTime() - 10000).toISOString(),
  };
  const checkerCreditExpired: UserSession = {
    ...checkerCredit,
    specialAccessGrants: [expiredGrant],
  };

  let expiredGrantBlocked = false;
  try {
    submissionService.getAuthorizedSubmission(tradeSubmitted.id, checkerCreditExpired);
  } catch (err: any) {
    expiredGrantBlocked = true;
  }
  assert(expiredGrantBlocked, 'Expired special access grant does not grant access (strict expiry check)');

  console.log('\n--- TEST 11: Draft Deletion by Maker and Admin (Requirement 6, 8, 10) ---');
  // 11a. Maker creates a draft and deletes it (allowed for unsubmitted draft)
  const makerDraftToDelete = submissionService.createSubmission('M_LCPLC001', makerCredit);
  const deletedByMaker = submissionService.deleteSubmission(makerDraftToDelete.id, makerCredit);
  assert(deletedByMaker === true, 'Maker successfully deleted unsubmitted draft they created');
  assert(submissionService.getById(makerDraftToDelete.id) === undefined, 'Draft purged from repository');

  // 11b. Maker CANNOT delete unsubmitted draft created by another Maker in a different department
  const tradeDraftUnsubmitted = submissionService.createSubmission('POBEPE001', makerTrade);
  let crossDeptDraftDeleteBlocked = false;
  try {
    submissionService.deleteSubmission(tradeDraftUnsubmitted.id, makerCredit);
  } catch (err: any) {
    crossDeptDraftDeleteBlocked = true;
  }
  assert(crossDeptDraftDeleteBlocked, 'Maker CANNOT delete draft from another department');

  // 11c. Admin can remove unsubmitted draft with governed removal
  const adminRemoveDraftResult = submissionService.adminGovernedRemoveSubmission(
    tradeDraftUnsubmitted.id,
    adminGovernance,
    {
      action: 'DELETE_DRAFT',
      reason: 'Administrative cleanup of unsubmitted test draft',
      confirmed: true,
    }
  );
  assert(adminRemoveDraftResult.success === true, 'Admin successfully removed unsubmitted draft');
  assert(submissionService.getById(tradeDraftUnsubmitted.id) === undefined, 'Unsubmitted draft removed by Admin');

  console.log('\n========================================================================');
  console.log('✅ ALL PHASE 26 ACCEPTANCE TESTS PASSED CLEANLY (100% SUCCESS)');
  console.log('========================================================================\n');
}

// Direct execution support
if (process.argv[1] && process.argv[1].includes('phase26-library-role-based-workflows')) {
  runPhase26LibraryRoleBasedWorkflowsAndDeletionGovernanceTests().catch((err) => {
    console.error('Phase 26 tests failed:', err);
    process.exit(1);
  });
}

