/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * PHASE 23 ACCEPTANCE TEST SUITE: Maker Draft/Edit/Save/Resubmit & Reuse Lifecycle
 * Regulatory Directives: NBE Directive BSD/03/2020 Segregation of Duties & Report Lifecycle Governance
 *
 * Requirements:
 * 1. CREATE → EDIT → SAVE DRAFT → LEAVE → RETURN → CONTINUE → VALIDATE → SUBMIT
 * 2. SUBMITTED REPORT → REUSE AS NEW → NEW DRAFT → MODIFY → SAVE → SUBMIT
 * 3. Immutable submitted records: No submitted report can be edited in place.
 * 4. Optimistic locking / concurrent tabs conflict protection.
 * 5. Returned report correction and resubmission.
 * 6. RBAC and cross-department boundaries.
 */

import { submissionService, DEMO_USERS } from '../services/submissionService.ts';
import { getReportByKey } from '../data/report-registry.ts';
import { indexedDbStorage } from '../services/indexedDbStorage.ts';
import { auditService } from '../services/auditService.ts';
import { effectiveAccessEngine } from '../services/effectiveAccessEngine.ts';
import {
  normalizeSubmissionStatus,
  isMakerEditableStatus,
  isFinalSubmittedStatus,
  ReportSubmission,
  UserSession,
} from '../types/regulatory.ts';

function assert(condition: any, msg: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

export async function runPhase23MakerDraftLifecycleTests() {
  console.log('\n========================================================================');
  console.log('--- PHASE 23: MAKER DRAFT/EDIT/SAVE/RESUBMIT LIFECYCLE ACCEPTANCE SUITE ---');
  console.log('========================================================================\n');

  // Authorized Maker and Checker from Credit department
  const makerCredit: UserSession = {
    id: 'usr_maker_credit_p23',
    name: 'Abebe Bikila',
    email: 'abebe.bikila@oromiabank.com',
    role: 'MAKER',
    institutionCode: '0000013',
    department: 'Credit Risk & Prudential Reporting',
  };

  const checkerCredit: UserSession = {
    id: 'usr_checker_credit_p23',
    name: 'Derartu Tulu',
    email: 'derartu.tulu@oromiabank.com',
    role: 'CHECKER',
    institutionCode: '0000013',
    department: 'Credit Risk & Prudential Reporting',
  };

  const makerTrade: UserSession = {
    id: 'usr_maker_trade_p23',
    name: 'Kenenisa Bekele',
    email: 'kenenisa.bekele@oromiabank.com',
    role: 'MAKER',
    institutionCode: '0000013',
    department: 'Trade Services & International Banking',
  };

  const adminUser: UserSession = {
    id: 'usr_admin_p23',
    name: 'Haile Gebrselassie',
    email: 'haile.admin@oromiabank.com',
    role: 'ADMIN',
    institutionCode: '0000013',
    department: 'Compliance & Legal Governance',
  };

  console.log('--- 1. State Normalization & Lifecycle Predicate Verification ---');
  assert(normalizeSubmissionStatus('DRAFT') === 'DRAFT', 'Normalizes DRAFT correctly');
  assert(normalizeSubmissionStatus('SAVED') === 'DRAFT', 'Normalizes SAVED to DRAFT');
  assert(normalizeSubmissionStatus('IN_PROGRESS') === 'DRAFT', 'Normalizes IN_PROGRESS to DRAFT');
  assert(normalizeSubmissionStatus('RETURNED_FOR_CORRECTION') === 'CORRECTION_REQUIRED', 'Normalizes RETURNED_FOR_CORRECTION to CORRECTION_REQUIRED');
  assert(normalizeSubmissionStatus('READY_FOR_SUBMISSION') === 'DRAFT', 'Normalizes READY_FOR_SUBMISSION to DRAFT');
  assert(isMakerEditableStatus('DRAFT') === true, 'DRAFT is Maker-editable');
  assert(isMakerEditableStatus('CORRECTION_REQUIRED') === true, 'CORRECTION_REQUIRED is Maker-editable');
  assert(isMakerEditableStatus('SENT') === false, 'SENT is not Maker-editable');
  assert(isMakerEditableStatus('APPROVED') === false, 'APPROVED is not Maker-editable');
  assert(isFinalSubmittedStatus('SENT') === true, 'SENT is final submitted');
  assert(isFinalSubmittedStatus('APPROVED') === true, 'APPROVED is final submitted');
  assert(isFinalSubmittedStatus('DRAFT') === false, 'DRAFT is not final submitted');

  console.log('\n--- 2. Complete Primary Lifecycle: CREATE → EDIT → SAVE DRAFT → LEAVE → RETURN → CONTINUE → VALIDATE → SUBMIT ---');
  const targetReportKey = 'M_LCPLC001';
  const targetReport = getReportByKey(targetReportKey)!;
  assert(Boolean(targetReport), `Target report template ${targetReportKey} loaded`);

  // Step 2.1: CREATE
  const initialDraft = submissionService.createSubmission(targetReportKey, makerCredit);
  assert(Boolean(initialDraft && initialDraft.id), 'Draft created successfully with authoritative ID');
  assert(initialDraft.status === 'DRAFT', 'Initial status is DRAFT');
  assert(initialDraft.version === 1, 'Initial version is 1');
  assert(initialDraft.makerId === makerCredit.id, 'Maker ID matches authenticated user');
  assert(Boolean(initialDraft.integrityHash), 'Cryptographic integrity seal generated for initial draft');

  // Verify audit event
  const createAudits = auditService.getLogsByEntity(initialDraft.id).filter((a) => a.action === 'CREATE_DRAFT');
  assert(createAudits.length > 0, 'CREATE_DRAFT audit event recorded in immutable log');

  // Step 2.2: EDIT & SAVE DRAFT
  const editedValues = {
    ...initialDraft.values,
    '122_00001': 500000000,
    '122_00002': 250000000,
    '122_00003': 150000000,
  };
  const dynamicScheduleRows = {
    1: [
      {
        id: 'row_mkr_01',
        areaId: 1,
        values: {
          BORROWER_NAME: 'Bishoftu Agro Processing PLC',
          FACILITY_LIMIT: 75000000,
          OUTSTANDING_BAL: 60000000,
        },
      },
    ],
  };

  const savedDraftV2 = submissionService.updateDraft(
    initialDraft.id,
    editedValues,
    dynamicScheduleRows,
    makerCredit,
    1 // expectedVersion = 1
  );

  assert(savedDraftV2.version === 2, 'Version incremented to 2 after save');
  assert(savedDraftV2.values['122_00001'] === 500000000, 'Saved values persisted in backend submission service');
  assert(savedDraftV2.dynamicRows[1]?.[0]?.values?.BORROWER_NAME === 'Bishoftu Agro Processing PLC', 'Dynamic schedule rows persisted');

  // Step 2.3: LEAVE → RETURN → CONTINUE
  // Simulate Maker closing browser/tab and returning later
  const reloadedDraft = submissionService.getById(initialDraft.id);
  assert(Boolean(reloadedDraft), 'Report draft retrieved from backend upon returning to workspace');
  assert(reloadedDraft!.version === 2, 'Retrieved draft preserves exact version (v2)');
  assert(reloadedDraft!.values['122_00001'] === 500000000, 'Retrieved draft preserves edited values');
  assert(reloadedDraft!.dynamicRows[1]?.length === 1, 'Retrieved draft preserves dynamic schedules');

  // Step 2.4: CONTINUE EDITING
  const editedValuesV3 = {
    ...reloadedDraft!.values,
    '122_00001': 550000000,
  };
  const savedDraftV3 = submissionService.updateDraft(
    initialDraft.id,
    editedValuesV3,
    reloadedDraft!.dynamicRows,
    makerCredit,
    2 // expectedVersion = 2
  );
  assert(savedDraftV3.version === 3, 'Version incremented to 3 upon continuing draft');
  assert(savedDraftV3.values['122_00001'] === 550000000, 'Updated values persisted');

  // Step 2.5: VALIDATE
  const valSummary = submissionService.validateSubmission(initialDraft.id);
  assert(Boolean(valSummary), 'ValidationEngine successfully validated draft');

  // Step 2.6: SUBMIT TO CHECKER
  const submittedToChecker = submissionService.submitToChecker(
    initialDraft.id,
    makerCredit,
    'Q1 Capital Adequacy Return prepared and submitted for review',
    3 // expectedVersion = 3
  );
  assert(submittedToChecker.status === 'PENDING_CHECKER', 'Status transitioned to PENDING_CHECKER');
  assert(submittedToChecker.historicalSnapshots && submittedToChecker.historicalSnapshots.length > 0, 'Historical snapshot captured upon submission');

  const submitAudits = auditService.getLogsByEntity(initialDraft.id).filter((a) => a.action === 'SUBMIT_TO_CHECKER');
  assert(submitAudits.length > 0, 'SUBMIT_TO_CHECKER audit event recorded');

  console.log('\n--- 3. Returned for Correction & Resubmit Lifecycle ---');
  // Checker reviews and requests correction
  const returnedForCorrection = submissionService.reviewSubmission(
    initialDraft.id,
    'REQUEST_CORRECTION',
    checkerCredit,
    'Please re-verify line 122_00002 against general ledger reconciliation.'
  );
  assert(returnedForCorrection.status === 'CORRECTION_REQUIRED', 'Status changed to CORRECTION_REQUIRED');

  // Maker reopens the returned report
  const reopenedReturned = submissionService.getById(initialDraft.id);
  assert(reopenedReturned?.status === 'CORRECTION_REQUIRED', 'Maker can reopen report in CORRECTION_REQUIRED state');
  assert(isMakerEditableStatus(reopenedReturned!.status), 'CORRECTION_REQUIRED is flagged as editable');

  // Maker updates values based on Checker feedback
  const correctedValues = {
    ...reopenedReturned!.values,
    '122_00002': 260000000,
  };
  const savedCorrection = submissionService.updateDraft(
    initialDraft.id,
    correctedValues,
    reopenedReturned!.dynamicRows,
    makerCredit,
    reopenedReturned!.version
  );
  assert(savedCorrection.values['122_00002'] === 260000000, 'Corrected values saved to draft');

  // Maker resubmits to Checker
  const resubmittedToChecker = submissionService.submitToChecker(
    initialDraft.id,
    makerCredit,
    'Updated line 122_00002 per GL reconciliation notes. Resubmitting for sign-off.',
    savedCorrection.version
  );
  assert(resubmittedToChecker.status === 'PENDING_CHECKER', 'Returned report resubmitted to PENDING_CHECKER');

  const resubmitAudits = auditService.getLogsByEntity(initialDraft.id).filter((a) => a.action === 'RESUBMIT_TO_CHECKER');
  assert(resubmitAudits.length > 0, 'RESUBMIT_TO_CHECKER audit event recorded');

  console.log('\n--- 4. Submitted Report Immutability & "Reuse as New" Lifecycle ---');
  // Checker approves
  const approvedSub = submissionService.reviewSubmission(
    initialDraft.id,
    'APPROVE',
    checkerCredit,
    'All statutory items and GL balances verified.'
  );
  assert(approvedSub.status === 'APPROVED', 'Submission approved by Checker');

  // Maker delivers to NBE
  const deliverResult = await submissionService.deliverToNBE(initialDraft.id, makerCredit);
  assert(deliverResult.success === true, 'Report successfully delivered to NBE');

  const sentSub = submissionService.getById(initialDraft.id)!;
  assert(sentSub.status === 'SENT', 'Final status is SENT');
  assert(Boolean(sentSub.nbeReferenceNumber), 'NBE receipt generated');

  // Requirement: Submitted record must NEVER be edited in place
  let editSentBlocked = false;
  try {
    submissionService.updateDraft(
      sentSub.id,
      { ...sentSub.values, '122_00001': 999999999 },
      sentSub.dynamicRows,
      makerCredit
    );
  } catch (err: any) {
    editSentBlocked = true;
    assert(
      err.message.includes('Submitted records are permanently sealed') ||
      err.message.includes('Cannot modify submitted'),
      'Direct edit on submitted record blocked with descriptive error'
    );
  }
  assert(editSentBlocked, 'CRITICAL: In-place edit of submitted report strictly prohibited');

  // Snapshot integrity check
  const sourceHashBefore = sentSub.integrityHash;
  const sourceValuesBefore = JSON.stringify(sentSub.values);

  // Requirement: "Reuse as New" creates a new report identity linked to the source report/version
  const reusedDraft = submissionService.reuseSubmission(sentSub.id, makerCredit);
  assert(Boolean(reusedDraft && reusedDraft.id), 'Reused submission created with new distinct ID');
  assert(reusedDraft.id !== sentSub.id, 'Reused draft has a brand-new unique report identity');
  assert(reusedDraft.status === 'DRAFT', 'Reused submission initializes in DRAFT status');
  assert(reusedDraft.version === 1, 'Reused submission initializes at version 1');
  assert(reusedDraft.reusedFromSubmissionId === sentSub.id, 'Linked to source submission ID');
  assert(reusedDraft.reusedFromVersion === sentSub.submittedVersion || reusedDraft.reusedFromVersion === sentSub.version, 'Linked to source submission version');
  assert(reusedDraft.makerId === makerCredit.id, 'Maker assigned to the new reused draft');

  // Verify source report remains 100% untouched
  const sourceSubAfterReuse = submissionService.getById(sentSub.id)!;
  assert(sourceSubAfterReuse.integrityHash === sourceHashBefore, 'Source report integrity hash completely untouched');
  assert(JSON.stringify(sourceSubAfterReuse.values) === sourceValuesBefore, 'Source report values completely untouched');
  assert(sourceSubAfterReuse.status === 'SENT', 'Source report status remains SENT');

  // Verify reused draft is fully editable, saveable, validatable, and submittable
  const reusedEditedValues = {
    ...reusedDraft.values,
    '122_00001': 620000000,
  };
  const reusedSaved = submissionService.updateDraft(
    reusedDraft.id,
    reusedEditedValues,
    reusedDraft.dynamicRows,
    makerCredit,
    1
  );
  assert(reusedSaved.version === 2, 'Reused draft edited and saved to v2');
  assert(reusedSaved.values['122_00001'] === 620000000, 'Reused draft values updated');

  const reusedValidation = submissionService.validateSubmission(reusedDraft.id);
  assert(Boolean(reusedValidation), 'Reused draft validated successfully');

  const reusedSubmitted = submissionService.submitToChecker(
    reusedDraft.id,
    makerCredit,
    'New return prepared by reusing baseline from prior submitted return',
    2
  );
  assert(reusedSubmitted.status === 'PENDING_CHECKER', 'Reused draft successfully submitted to Checker');

  console.log('\n--- 5. Concurrency & Optimistic Lock Protection (Concurrent Edit Conflicts) ---');
  // Create another test draft to test concurrent editing across tabs
  const concDraft = submissionService.createSubmission('POBEPE001', makerTrade);
  assert(concDraft.version === 1, 'Concurrent test draft created at v1');

  // Tab 1 updates to v2
  const tab1Save = submissionService.updateDraft(
    concDraft.id,
    { ...concDraft.values, '153_00010': 460000000 },
    concDraft.dynamicRows,
    makerTrade,
    1 // Tab 1 expects v1 -> succeeds
  );
  assert(tab1Save.version === 2, 'Tab 1 save succeeded with expectedVersion 1');

  // Tab 2 has stale version 1 and attempts to save
  let tab2ConflictBlocked = false;
  try {
    submissionService.updateDraft(
      concDraft.id,
      { ...concDraft.values, '153_00010': 470000000 },
      concDraft.dynamicRows,
      makerTrade,
      1 // Tab 2 still thinks it is v1!
    );
  } catch (err: any) {
    tab2ConflictBlocked = true;
    assert(
      err.message.includes('CONCURRENT_MODIFICATION_CONFLICT'),
      'Concurrent save conflict trapped with CONCURRENT_MODIFICATION_CONFLICT error'
    );
  }
  assert(tab2ConflictBlocked, 'Optimistic concurrency locking prevented silent overwriting by stale tab');

  // Tab 2 reloads (gets current v2) and saves with expectedVersion 2
  const tab2FreshSave = submissionService.updateDraft(
    concDraft.id,
    { ...concDraft.values, '153_00010': 470000000 },
    concDraft.dynamicRows,
    makerTrade,
    2 // Fresh expectedVersion 2 -> succeeds
  );
  assert(tab2FreshSave.version === 3, 'Tab 2 succeeded after reloading fresh version');

  // Tab 1 attempts to submit with stale version 2 when current is v3
  let staleSubmitBlocked = false;
  try {
    submissionService.submitToChecker(
      concDraft.id,
      makerTrade,
      'Submit with stale version',
      2 // Stale version 2
    );
  } catch (err: any) {
    staleSubmitBlocked = true;
    assert(
      err.message.includes('CONCURRENT_MODIFICATION_CONFLICT'),
      'Stale submit blocked with CONCURRENT_MODIFICATION_CONFLICT'
    );
  }
  assert(staleSubmitBlocked, 'Optimistic lock prevents submitting stale draft state');

  console.log('\n--- 6. Segregation of Duties & Unauthorized Access Enforcement ---');
  // Checkers cannot create drafts
  let checkerCreateBlocked = false;
  try {
    submissionService.createSubmission('POBEPE001', checkerCredit);
  } catch (err: any) {
    checkerCreateBlocked = true;
    assert(err.message.includes('Role violation') || err.message.includes('Only registered Makers'), 'Checker draft creation blocked');
  }
  assert(checkerCreateBlocked, 'Checkers restricted from creating drafts');

  // Admins cannot edit draft data
  let adminEditBlocked = false;
  try {
    submissionService.updateDraft(concDraft.id, concDraft.values, concDraft.dynamicRows, adminUser);
  } catch (err: any) {
    adminEditBlocked = true;
    assert(err.message.includes('Role violation') || err.message.includes('Only authorized Makers'), 'Admin draft editing blocked');
  }
  assert(adminEditBlocked, 'Admins restricted from editing drafts');

  // Cross-department Maker access without special grant
  let crossDeptCreateBlocked = false;
  try {
    // makerCredit belongs to Credit, attempting Trade return POBEPE001
    submissionService.createSubmission('POBEPE001', makerCredit);
  } catch (err: any) {
    crossDeptCreateBlocked = true;
  }
  assert(crossDeptCreateBlocked, 'Cross-department Maker without special access is strictly blocked');

  console.log('\n========================================================================');
  console.log('✅ ALL PHASE 23 MAKER DRAFT/EDIT/SAVE/RESUBMIT LIFECYCLE TESTS PASSED (100%)');
  console.log('========================================================================\n');
}
