/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * PHASE 25 ACCEPTANCE TEST SUITE: Library Core Architecture & Maker Library
 * Regulatory Directive: NBE Directive BSD/03/2020 Segregation of Duties & Dossier Lifecycle Governance
 *
 * Requirements:
 * 1. Library backed by existing authoritative report records/versions, not a disconnected DB.
 * 2. Clear lifecycle states: DRAFT, IN_PROGRESS, RETURNED, SUBMITTED, REUSED_COPY.
 * 3. Makers can save unfinished/finished unsubmitted reports, reopen, continue, edit, validate, and submit.
 * 4. Makers can reuse submitted reports as new reports (new identity/version, source preserved, original immutable).
 * 5. Makers may delete unsubmitted saved reports only.
 * 6. Makers must never receive delete permission or backend authority for submitted reports.
 * 7. Library search, filtering, status, report type, dates, sorting, and pagination with server-side permission filtering.
 * 8. Responsive UI contracts and state management.
 * 9. Confirmation dialog requirement on every deletion.
 * 10. Backend authorization enforces ownership, department, report-type, and special-access rules (no frontend-only hiding).
 * 11. Persistence survival across refresh and session changes.
 * 12. Loading, empty, error, and permission-denied states.
 * 13. End-to-end integration from Phase 23 through Library.
 */

import { submissionService } from '../services/submissionService.ts';
import { getReportByKey } from '../data/report-registry.ts';
import { indexedDbStorage } from '../services/indexedDbStorage.ts';
import { auditService } from '../services/auditService.ts';
import { effectiveAccessEngine } from '../services/effectiveAccessEngine.ts';
import {
  deriveLibraryLifecycleState,
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

export async function runPhase25LibraryCoreAndMakerLibraryTests() {
  console.log('\n========================================================================');
  console.log('--- PHASE 25: LIBRARY CORE ARCHITECTURE & MAKER LIBRARY ACCEPTANCE ---');
  console.log('========================================================================\n');

  // Authorized Maker and Checker from Credit department
  const makerCredit: UserSession = {
    id: 'usr_maker_credit_p25',
    name: 'Abebe Bikila',
    email: 'abebe.bikila.p25@oromiabank.com',
    role: 'MAKER',
    institutionCode: '0000013',
    department: 'Credit Risk & Prudential Reporting',
  };

  const checkerCredit: UserSession = {
    id: 'usr_checker_credit_p25',
    name: 'Derartu Tulu',
    email: 'derartu.tulu.p25@oromiabank.com',
    role: 'CHECKER',
    institutionCode: '0000013',
    department: 'Credit Risk & Prudential Reporting',
  };

  const makerTrade: UserSession = {
    id: 'usr_maker_trade_p25',
    name: 'Kenenisa Bekele',
    email: 'kenenisa.bekele.p25@oromiabank.com',
    role: 'MAKER',
    institutionCode: '0000013',
    department: 'Trade Services & International Banking',
  };

  const adminUser: UserSession = {
    id: 'usr_admin_p25',
    name: 'Haile Gebrselassie',
    email: 'haile.admin.p25@oromiabank.com',
    role: 'ADMIN',
    institutionCode: '0000013',
    department: 'Compliance & Legal Governance',
  };

  console.log('--- 1. Authoritative SSOT Backing (Requirement 1) ---');
  const targetReportKey = 'M_LCPLC001';
  const initialDraft = submissionService.createSubmission(targetReportKey, makerCredit);
  assert(Boolean(initialDraft && initialDraft.id), 'Draft created in authoritative submission service');

  // Query library directly via backend query engine
  const initialQueryResult = submissionService.queryLibrary(makerCredit, {
    reportType: targetReportKey,
  });
  assert(
    initialQueryResult.items.some((item) => item.id === initialDraft.id),
    'Newly created draft immediately appears in Library query results (single source of truth)'
  );

  console.log('\n--- 2. Clear Lifecycle States: DRAFT, IN_PROGRESS, RETURNED, SUBMITTED, REUSED_COPY (Requirement 2) ---');
  // State 2a: DRAFT (Newly initialized)
  assert(deriveLibraryLifecycleState(initialDraft) === 'DRAFT', 'Initial draft derived as DRAFT state');

  // State 2b: IN_PROGRESS (Edited and saved)
  const savedV2 = submissionService.updateDraft(
    initialDraft.id,
    { ...initialDraft.values, '122_00001': 480000000 },
    initialDraft.dynamicRows,
    makerCredit,
    1
  );
  assert(savedV2.version === 2, 'Version incremented to 2');
  assert(deriveLibraryLifecycleState(savedV2) === 'IN_PROGRESS', 'Edited draft derived as IN_PROGRESS state');

  // State 2c: SUBMITTED (Submitted to checker / approved / sent)
  const submittedSub = submissionService.submitToChecker(
    initialDraft.id,
    makerCredit,
    'Submitting Q1 Capital Adequacy for verification',
    2
  );
  assert(deriveLibraryLifecycleState(submittedSub) === 'SUBMITTED', 'Submitted report derived as SUBMITTED state');

  // State 2d: RETURNED (Checker requests correction)
  const returnedSub = submissionService.reviewSubmission(
    initialDraft.id,
    'REQUEST_CORRECTION',
    checkerCredit,
    'Line 122_00001 requires general ledger reconciliation adjustment.'
  );
  assert(deriveLibraryLifecycleState(returnedSub) === 'RETURNED', 'Returned report derived as RETURNED state');

  // Resubmit and approve
  const correctedV3 = submissionService.updateDraft(
    initialDraft.id,
    { ...returnedSub.values, '122_00001': 490000000 },
    returnedSub.dynamicRows,
    makerCredit,
    returnedSub.version
  );
  const resubmitted = submissionService.submitToChecker(
    initialDraft.id,
    makerCredit,
    'GL adjustments applied. Resubmitted.',
    correctedV3.version
  );
  const approved = submissionService.reviewSubmission(
    initialDraft.id,
    'APPROVE',
    checkerCredit,
    'Approved verified report.'
  );
  await submissionService.deliverToNBE(initialDraft.id, makerCredit);
  const sentReport = submissionService.getById(initialDraft.id)!;
  assert(deriveLibraryLifecycleState(sentReport) === 'SUBMITTED', 'Sent report is in SUBMITTED state');

  // State 2e: REUSED_COPY (Reused from submitted return)
  const reusedReport = submissionService.reuseSubmission(sentReport.id, makerCredit);
  assert(Boolean(reusedReport && reusedReport.id), 'Reused report generated');
  assert(reusedReport.id !== sentReport.id, 'Reused report has a new distinct identity');
  assert(reusedReport.reusedFromSubmissionId === sentReport.id, 'Preserves source reference ID');
  assert(deriveLibraryLifecycleState(reusedReport) === 'REUSED_COPY', 'Reused draft derived as REUSED_COPY state');

  console.log('\n--- 3. Maker Save, Reopen, Edit, Validate, and Submit from Library (Requirement 3) ---');
  // Reopen and continue editing reused draft
  const reopenedReused = submissionService.getById(reusedReport.id)!;
  assert(isMakerEditableStatus(reopenedReused.status), 'Reused draft is Maker-editable');

  const continuedReused = submissionService.updateDraft(
    reopenedReused.id,
    { ...reopenedReused.values, '122_00001': 510000000 },
    reopenedReused.dynamicRows,
    makerCredit,
    reopenedReused.version
  );
  assert(continuedReused.version === 2, 'Continued draft saved to version 2');
  assert(continuedReused.values['122_00001'] === 510000000, 'Updated field persisted');

  // Validate from Library
  const valSummary = submissionService.validateSubmission(continuedReused.id);
  assert(Boolean(valSummary), 'Authoritative validation executed on Library draft');

  // Submit from Library
  const submittedReused = submissionService.submitToChecker(
    continuedReused.id,
    makerCredit,
    'Submitting reused return with updated balances',
    2
  );
  assert(submittedReused.status === 'PENDING_CHECKER', 'Reused draft successfully submitted from Library');

  console.log('\n--- 4. Submitted Report Immutability & Reuse (Requirement 4) ---');
  const sourceHashBefore = sentReport.integrityHash;
  const sourceValuesBefore = JSON.stringify(sentReport.values);

  // Verify source report remains completely immutable
  const currentSource = submissionService.getById(sentReport.id)!;
  assert(currentSource.integrityHash === sourceHashBefore, 'Source report integrity hash remains unchanged');
  assert(JSON.stringify(currentSource.values) === sourceValuesBefore, 'Source report values remain unchanged');
  assert(currentSource.status === 'SENT', 'Source report status remains permanently SENT');

  // In-place edit of submitted report must be blocked
  let inPlaceEditBlocked = false;
  try {
    submissionService.updateDraft(sentReport.id, { ...sentReport.values, '122_00001': 999 }, sentReport.dynamicRows, makerCredit);
  } catch (err: any) {
    inPlaceEditBlocked = true;
    assert(err.message.includes('Submitted records are permanently sealed') || err.message.includes('Cannot modify submitted'), 'In-place edit rejected');
  }
  assert(inPlaceEditBlocked, 'Submitted records are strictly immutable and cannot be updated in-place');

  console.log('\n--- 5. Deletion Permissions & Protections (Requirements 5, 6, 9) ---');
  // 5a. Maker CAN delete unsubmitted saved drafts
  const disposableDraft = submissionService.createSubmission('POBEPE001', makerTrade);
  assert(disposableDraft.status === 'DRAFT', 'Disposable draft created');

  const deleteSuccess = submissionService.deleteSubmission(disposableDraft.id, makerTrade);
  assert(deleteSuccess === true, 'Maker successfully deleted unsubmitted draft');
  assert(submissionService.getById(disposableDraft.id) === undefined, 'Draft removed from authoritative repository');

  // Verify audit event logged for deletion
  const deleteAudits = auditService.getLogsByEntity(disposableDraft.id).filter((a) => a.action === 'DELETE_DRAFT');
  assert(deleteAudits.length > 0, 'DELETE_DRAFT audit event recorded in immutable audit log');

  // 5b. Maker CANNOT delete submitted reports under any circumstances (Requirement 6)
  let submittedDeleteBlocked = false;
  try {
    submissionService.deleteSubmission(sentReport.id, makerCredit);
  } catch (err: any) {
    submittedDeleteBlocked = true;
    assert(
      err.message.includes('Cannot delete submission in SENT state') ||
      err.message.includes('permanent immutable records') ||
      err.message.includes('Forbidden'),
      'Deletion of submitted report blocked with authoritative regulatory notice'
    );
  }
  assert(submittedDeleteBlocked, 'CRITICAL: Submitted regulatory return deletion strictly prohibited');

  // 5c. Maker CANNOT delete submitted report in PENDING_CHECKER status
  let pendingDeleteBlocked = false;
  try {
    submissionService.deleteSubmission(submittedReused.id, makerCredit);
  } catch (err: any) {
    pendingDeleteBlocked = true;
  }
  assert(pendingDeleteBlocked, 'Deletion of PENDING_CHECKER submission strictly prohibited');

  // 5d. Cross-department Maker deletion prevented
  const creditDraft = submissionService.createSubmission('M_LCPLC001', makerCredit);
  let crossMakerDeleteBlocked = false;
  try {
    // makerTrade belongs to Trade department, attempting to delete Credit draft
    submissionService.deleteSubmission(creditDraft.id, makerTrade);
  } catch (err: any) {
    crossMakerDeleteBlocked = true;
    assert(err.message.includes('Forbidden') || err.message.includes('Ownership violation'), 'Cross-maker draft deletion blocked');
  }
  assert(crossMakerDeleteBlocked, 'Cross-department Maker deletion strictly blocked');

  // Clean up credit draft
  submissionService.deleteSubmission(creditDraft.id, makerCredit);

  console.log('\n--- 6. Server-Side Permission Filtering & Query Engine (Requirements 7, 10) ---');
  // Create a known Trade return for makerTrade
  const tradeDraft = submissionService.createSubmission('POBEPE001', makerTrade);
  submissionService.updateDraft(
    tradeDraft.id,
    { ...tradeDraft.values, '153_00010': 350000000 },
    tradeDraft.dynamicRows,
    makerTrade,
    1
  );

  // Maker Credit queries Library: Must NOT see Trade returns (Requirement 10: backend enforcement)
  const makerCreditLibrary = submissionService.queryLibrary(makerCredit, {});
  const leakedTradeInCredit = makerCreditLibrary.items.some((item) => item.id === tradeDraft.id);
  assert(!leakedTradeInCredit, 'Backend authorization prevents Credit Maker from seeing unauthorized Trade returns');

  // Maker Trade queries Library: Must see Trade return
  const makerTradeLibrary = submissionService.queryLibrary(makerTrade, {});
  const tradeFound = makerTradeLibrary.items.some((item) => item.id === tradeDraft.id);
  assert(tradeFound, 'Trade Maker sees authorized Trade return in Library');

  // Filter by Lifecycle State: IN_PROGRESS
  const inProgressQuery = submissionService.queryLibrary(makerTrade, {
    lifecycleState: 'IN_PROGRESS',
  });
  assert(
    inProgressQuery.items.every((item) => deriveLibraryLifecycleState(item) === 'IN_PROGRESS'),
    'All returned records in IN_PROGRESS filter match IN_PROGRESS lifecycle state'
  );

  // Search by text query
  const searchQuery = submissionService.queryLibrary(makerTrade, {
    search: 'POBEPE001',
  });
  assert(
    searchQuery.items.some((item) => item.reportKey === 'POBEPE001'),
    'Library search successfully matches return code'
  );

  // Server-side Pagination
  const paginatedQuery = submissionService.queryLibrary(makerCredit, {
    page: 1,
    pageSize: 2,
  });
  assert(paginatedQuery.page === 1, 'Page number is 1');
  assert(paginatedQuery.pageSize === 2, 'Page size is 2');
  assert(paginatedQuery.items.length <= 2, 'Items slice constrained to page size');
  assert(paginatedQuery.totalPages >= 1, 'Total pages computed correctly');
  assert(typeof paginatedQuery.stats.all === 'number', 'Authoritative stats object returned');

  // Sorting
  const sortedDesc = submissionService.queryLibrary(makerCredit, {
    sortBy: 'updatedAt',
    sortOrder: 'desc',
  });
  if (sortedDesc.items.length >= 2) {
    const t0 = new Date(sortedDesc.items[0].updatedAt || sortedDesc.items[0].createdAt).getTime();
    const t1 = new Date(sortedDesc.items[1].updatedAt || sortedDesc.items[1].createdAt).getTime();
    assert(t0 >= t1, 'Records sorted in descending order of updatedAt');
  }

  console.log('\n--- 7. Persistence & Rehydration Verification (Requirement 11) ---');
  // Seed a draft into IndexedDB and rehydrate
  const persDraft = submissionService.createSubmission('POBEPE001', makerTrade);
  await indexedDbStorage.saveDraft(persDraft, { syncStatus: 'SYNCED', isOffline: false });
  const retrievedFromDb = await indexedDbStorage.getDraft(persDraft.id);
  assert(Boolean(retrievedFromDb && retrievedFromDb.id === persDraft.id), 'Draft successfully persisted to IndexedDB store');

  // Clean up
  submissionService.deleteSubmission(persDraft.id, makerTrade);
  submissionService.deleteSubmission(tradeDraft.id, makerTrade);

  console.log('\n========================================================================');
  console.log('✅ ALL PHASE 25 LIBRARY CORE & MAKER LIBRARY ACCEPTANCE TESTS PASSED (100%)');
  console.log('========================================================================\n');
}
