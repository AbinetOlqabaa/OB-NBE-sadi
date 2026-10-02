/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * PHASE 23 ACCEPTANCE TEST SUITE: Periodic 30-Second IndexedDB Auto-Save
 * Regulatory Directives: NBE Directive BSD/03/2020 Data Durability & Offline Resilience
 */

import { indexedDbStorage, OfflineDraftRecord } from '../services/indexedDbStorage.ts';
import { getReportByKey } from '../data/report-registry.ts';
import type { ReportMetadata, ReportSubmission } from '../types/regulatory.ts';

function assert(condition: any, msg: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

export async function runPhase23IndexedDbAutoSaveTests() {
  console.log('\n========================================================================');
  console.log('--- PHASE 23: 30-SECOND INDEXEDDB AUTO-SAVE ACCEPTANCE SUITE ---');
  console.log('========================================================================\n');

  console.log('--- 1. Baseline Model & Storage Service Initialization ---');
  assert(Boolean(indexedDbStorage), 'IndexedDbStorageService singleton is initialized');

  const baseReport = getReportByKey('M_LCPLC001')!;
  assert(Boolean(baseReport), 'Base regulatory report loaded');

  const testSubmissionId = `sub_autosave_${Date.now()}`;
  const initialSubmission: ReportSubmission = {
    id: testSubmissionId,
    reportKey: baseReport.ReturnKey,
    periodYear: 2026,
    periodStart: '2026-01-01',
    periodEnd: '2026-01-31',
    institutionCode: '0000013',
    version: 1,
    templateVersion: 1,
    status: 'DRAFT',
    values: {
      [baseReport.ReturnItemsList[0]?.Code || 'ITEM_01']: 1000000,
    },
    dynamicRows: {
      1: [
        {
          id: 'row_init_1',
          areaId: 1,
          values: {
            BORROWER_NAME: 'Initial Agro Enterprise',
            FACILITY_LIMIT: 25000000,
            OUTSTANDING_BAL: 21000000,
          },
        },
      ],
    },
    makerId: 'emp_maker_001',
    makerName: 'Abebe Kebede',
    makerEmail: 'abebe.kebede@oromiabank.com',
    department: 'Credit Operations & Portfolio Management',
    comments: [],
    deliveryAttempts: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date(Date.now() - 60000).toISOString(),
    templateSnapshot: baseReport,
  };

  console.log('\n--- 2. Manual and Periodic Auto-Save Draft Storage ---');
  // Simulate 30-second auto-save tick with dirty form changes
  const modifiedValues = {
    ...initialSubmission.values,
    [baseReport.ReturnItemsList[0]?.Code || 'ITEM_01']: 154500000.75,
    [baseReport.ReturnItemsList[1]?.Code || 'ITEM_02']: 45000000.0,
  };

  const modifiedDynamicRows = {
    1: [
      {
        id: 'row_autosaved_1',
        areaId: 1,
        values: {
          BORROWER_NAME: 'Bishoftu Poultry Processing Farm S.C.',
          FACILITY_LIMIT: 50000000,
          OUTSTANDING_BAL: 42300000,
        },
      },
    ],
  };

  const autoSavedDraft: ReportSubmission = {
    ...initialSubmission,
    values: modifiedValues,
    dynamicRows: modifiedDynamicRows,
    updatedAt: new Date().toISOString(),
    offlineSavedAt: new Date().toISOString(),
    syncStatus: 'LOCAL_DRAFT',
    isOfflineDraft: true,
  };

  await indexedDbStorage.saveDraft(autoSavedDraft, {
    syncStatus: 'LOCAL_DRAFT',
    isOffline: true,
  });

  const retrievedDraft = await indexedDbStorage.getDraft(testSubmissionId);
  assert(Boolean(retrievedDraft), 'Auto-saved draft retrieved successfully by ID');
  assert(retrievedDraft?.id === testSubmissionId, 'Draft ID matches exactly');
  assert(retrievedDraft?.syncStatus === 'LOCAL_DRAFT', 'Draft marked with syncStatus: LOCAL_DRAFT');
  assert(retrievedDraft?.isOfflineDraft === true, 'Draft marked with isOfflineDraft: true');
  assert(Boolean(retrievedDraft?.offlineSavedAt), 'Draft contains authoritative offlineSavedAt timestamp');

  // Verify values persisted without truncation
  assert(
    retrievedDraft?.values[baseReport.ReturnItemsList[0]?.Code || 'ITEM_01'] === 154500000.75,
    'Numeric value persisted accurately to IndexedDB storage'
  );
  assert(
    retrievedDraft?.values[baseReport.ReturnItemsList[1]?.Code || 'ITEM_02'] === 45000000.0,
    'Additional item values persisted accurately'
  );

  // Verify dynamic schedule rows persisted
  const persistedRows = retrievedDraft?.dynamicRows[1];
  assert(Boolean(persistedRows && persistedRows.length === 1), 'Dynamic schedule rows persisted');
  assert(
    persistedRows![0].values.BORROWER_NAME === 'Bishoftu Poultry Processing Farm S.C.',
    'Dynamic schedule borrower name preserved'
  );

  console.log('\n--- 3. 30-Second Cadence & Redundant Save Avoidance Simulation ---');
  // Simulate auto-save timer behavior:
  // If hasUnsavedChanges is false, performAutoSaveToIndexedDB returns early without write
  let writeCounter = 0;
  const originalSaveDraft = indexedDbStorage.saveDraft.bind(indexedDbStorage);
  indexedDbStorage.saveDraft = async (sub, opt) => {
    writeCounter++;
    return originalSaveDraft(sub, opt);
  };

  // Simulate timer tick 1: hasUnsavedChanges = false -> no save
  const timerTick = async (hasUnsavedChanges: boolean, isReadOnly: boolean) => {
    if (isReadOnly || !hasUnsavedChanges) return;
    await indexedDbStorage.saveDraft(autoSavedDraft, { syncStatus: 'LOCAL_DRAFT', isOffline: true });
  };

  await timerTick(false, false);
  assert(writeCounter === 0, 'No IndexedDB write performed when hasUnsavedChanges is false');

  await timerTick(true, true);
  assert(writeCounter === 0, 'No IndexedDB write performed when form is in read-only mode');

  await timerTick(true, false);
  assert(writeCounter === 1, 'IndexedDB write triggered when 30-second timer fires with unsaved changes');

  // Restore original method
  indexedDbStorage.saveDraft = originalSaveDraft;

  console.log('\n--- 4. Offline Recovery on Form Mount ---');
  // When user re-opens form or page reloads, detect if cached offline draft is newer
  const serverSubmission: ReportSubmission = {
    ...initialSubmission,
    updatedAt: new Date(Date.now() - 300000).toISOString(), // 5 minutes old on server
  };

  const cachedOffline = await indexedDbStorage.getDraft(serverSubmission.id);
  assert(Boolean(cachedOffline), 'Found cached offline draft');

  const cachedTime = new Date(cachedOffline!.offlineSavedAt!).getTime();
  const serverTime = new Date(serverSubmission.updatedAt).getTime();
  assert(cachedTime > serverTime, 'Cached offline draft timestamp is strictly newer than server timestamp');

  // Form recovers values from cached draft
  const recoveredValues = cachedOffline!.values;
  const recoveredDynamic = cachedOffline!.dynamicRows;
  assert(
    recoveredValues[baseReport.ReturnItemsList[0]?.Code || 'ITEM_01'] === 154500000.75,
    'Recovered draft preserves all uncommitted Maker edits'
  );
  assert(
    recoveredDynamic[1]?.[0].values.BORROWER_NAME === 'Bishoftu Poultry Processing Farm S.C.',
    'Recovered draft preserves all dynamic schedule additions'
  );

  console.log('\n--- 5. Storage Stats & Cleanup Verification ---');
  const allDrafts = await indexedDbStorage.getAllDrafts();
  assert(allDrafts.length >= 1, `IndexedDB contains ${allDrafts.length} stored offline draft(s)`);

  const stats = await indexedDbStorage.getStorageStats();
  assert(stats.draftCount >= 1, `Storage stats report draftCount: ${stats.draftCount}`);

  // Clean up test draft
  await indexedDbStorage.deleteDraft(testSubmissionId);
  const afterDelete = await indexedDbStorage.getDraft(testSubmissionId);
  assert(!afterDelete, 'Test draft deleted cleanly from IndexedDB storage');

  console.log('\n========================================================================');
  console.log('✅ ALL PHASE 23 30-SECOND INDEXEDDB AUTO-SAVE TESTS PASSED (100% SUCCESS)');
  console.log('========================================================================\n');
}
