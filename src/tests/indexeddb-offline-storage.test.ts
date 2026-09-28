/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  indexedDbStorage,
  STORES,
  OfflineDraftRecord,
  OfflineAuditRecord,
} from '../services/indexedDbStorage.ts';
import { submissionService, DEMO_USERS } from '../services/submissionService.ts';
import { auditService } from '../services/auditService.ts';
import type { ReportSubmission, AuditLogEntry } from '../types/regulatory.ts';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

export async function runIndexedDbOfflineStorageTests() {
  console.log('\n======================================================');
  console.log('--- 7. INDEXEDDB OFFLINE STORAGE & SITE VISIT TESTS ---');
  console.log('======================================================');

  // Reset clean state
  await indexedDbStorage.clearAll();

  // -------------------------------------------------------------------------
  // Test Suite 1: Storage Initialization & Stores Schema
  // -------------------------------------------------------------------------
  console.log('\n--- 1. Storage Architecture & Stores Verification ---');
  assert(Boolean(indexedDbStorage), 'indexedDbStorage service is exported and initialized');
  assert(STORES.DRAFTS === 'draft_submissions', 'Store for drafts is "draft_submissions"');
  assert(STORES.AUDIT_LOGS === 'audit_logs', 'Store for audit trail is "audit_logs"');
  assert(STORES.METADATA === 'offline_metadata', 'Store for metadata is "offline_metadata"');

  const initialStats = await indexedDbStorage.getStorageStats();
  assert(initialStats.draftCount === 0, 'Clean store initialized with 0 drafts');
  assert(initialStats.auditCount === 0, 'Clean store initialized with 0 audit logs');
  assert(initialStats.storageName === 'OromiaBank_NBE_Regulatory_DB', 'Database name matches regulatory specification');

  // -------------------------------------------------------------------------
  // Test Suite 2: Draft Submission CRUD in IndexedDB
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Draft Submission Offline Persistence (CRUD) ---');
  const mockDraft1: ReportSubmission = {
    id: 'sub_test_offline_001',
    reportKey: 'POBEPE001',
    department: 'Trade Services & International Banking',
    periodYear: 2026,
    periodStart: '2026-04-01T00:00:00',
    periodEnd: '2026-06-30T00:00:00',
    institutionCode: '0000013',
    status: 'DRAFT',
    version: 1,
    templateVersion: 1,
    dataVersion: 1,
    values: {
      '153_00010': 450000000,
      '153_00011': 1,
    },
    dynamicRows: {},
    makerId: 'usr_maker_2',
    makerName: 'Tigist Alemu',
    makerEmail: 'tigist.alemu@oromiabank.com',
    comments: [],
    deliveryAttempts: [],
    createdAt: '2026-09-28T09:00:00Z',
    updatedAt: '2026-09-28T09:00:00Z',
  };

  // Save draft with PENDING_SYNC status
  await indexedDbStorage.saveDraft(mockDraft1, {
    syncStatus: 'PENDING_SYNC',
    isOffline: true,
  });

  const retrievedDraft = await indexedDbStorage.getDraft('sub_test_offline_001');
  assert(Boolean(retrievedDraft), 'Draft successfully saved and retrieved from IndexedDB');
  assert(retrievedDraft?.id === 'sub_test_offline_001', 'Retrieved draft ID matches');
  assert(retrievedDraft?.reportKey === 'POBEPE001', 'Retrieved reportKey matches');
  assert(retrievedDraft?.syncStatus === 'PENDING_SYNC', 'Draft syncStatus tagged as PENDING_SYNC');
  assert(retrievedDraft?.isOfflineDraft === true, 'Draft isOfflineDraft flagged as true');
  assert(Boolean(retrievedDraft?.offlineSavedAt), 'Draft offlineSavedAt timestamp recorded');

  // Update draft in IndexedDB
  const updatedDraft1: ReportSubmission = {
    ...mockDraft1,
    version: 2,
    values: {
      ...mockDraft1.values,
      '153_00010': 480000000,
      '153_00016': 4800000,
    },
    updatedAt: '2026-09-28T10:30:00Z',
  };
  await indexedDbStorage.saveDraft(updatedDraft1, { syncStatus: 'PENDING_SYNC', isOffline: true });

  const retrievedV2 = await indexedDbStorage.getDraft('sub_test_offline_001');
  assert(retrievedV2?.version === 2, 'Draft version incremented to 2 in IndexedDB');
  assert(retrievedV2?.values['153_00010'] === 480000000, 'Draft field value updated in IndexedDB');

  // Add second draft
  const mockDraft2: ReportSubmission = {
    id: 'sub_test_offline_002',
    reportKey: 'LOA_ADV_OUT_LA001',
    department: 'Credit Operations & Portfolio Management',
    periodYear: 2026,
    periodStart: '2026-01-01T00:00:00',
    periodEnd: '2026-03-31T00:00:00',
    institutionCode: '0000013',
    status: 'DRAFT',
    version: 1,
    templateVersion: 1,
    values: { '001_00001': 15000000000 },
    dynamicRows: {},
    makerId: 'usr_maker_1',
    makerName: 'Abebe Kebede',
    makerEmail: 'abebe.kebede@oromiabank.com',
    comments: [],
    deliveryAttempts: [],
    createdAt: '2026-09-28T08:00:00Z',
    updatedAt: '2026-09-28T08:00:00Z',
  };
  await indexedDbStorage.saveDraft(mockDraft2, { syncStatus: 'SYNCED', isOffline: false });

  const allDrafts = await indexedDbStorage.getAllDrafts();
  assert(allDrafts.length === 2, 'getAllDrafts returns all 2 drafts in storage');

  const pendingDrafts = await indexedDbStorage.getPendingDrafts();
  assert(pendingDrafts.length === 1, 'getPendingDrafts accurately filters to the 1 pending draft');
  assert(pendingDrafts[0].id === 'sub_test_offline_001', 'Pending draft is sub_test_offline_001');

  // Mark drafts as synced
  await indexedDbStorage.markDraftsAsSynced(['sub_test_offline_001']);
  const pendingAfterSync = await indexedDbStorage.getPendingDrafts();
  assert(pendingAfterSync.length === 0, 'markDraftsAsSynced clears pending sync queue');

  // Delete draft
  await indexedDbStorage.deleteDraft('sub_test_offline_002');
  const draftsAfterDelete = await indexedDbStorage.getAllDrafts();
  assert(draftsAfterDelete.length === 1, 'deleteDraft removes target draft from IndexedDB');

  // -------------------------------------------------------------------------
  // Test Suite 3: Audit Trail Log Persistence in IndexedDB
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Audit Trail Offline Persistence ---');
  const mockAuditEntry: AuditLogEntry = {
    id: 'aud_test_off_01',
    timestamp: '2026-09-28T10:00:00Z',
    actorId: 'usr_maker_1',
    actorName: 'Abebe Kebede',
    actorRole: 'MAKER',
    action: 'UPDATE_VALUES',
    entityType: 'REPORT_SUBMISSION',
    entityId: 'sub_test_offline_001',
    correlationId: 'corr_offline_test',
    details: '[NBE Remote Site Visit] Officer modified loans outstanding during offline audit',
  };

  await indexedDbStorage.saveAuditLog(mockAuditEntry, {
    syncStatus: 'PENDING_SYNC',
    isOffline: true,
  });

  const storedAuditLogs = await indexedDbStorage.getAllAuditLogs();
  assert(storedAuditLogs.length === 1, 'Audit log saved and retrieved from IndexedDB');
  assert(storedAuditLogs[0].id === 'aud_test_off_01', 'Audit log ID preserved');
  assert(storedAuditLogs[0].syncStatus === 'PENDING_SYNC', 'Audit log flagged as PENDING_SYNC');
  assert(storedAuditLogs[0].isOfflineRecord === true, 'Audit log flagged as isOfflineRecord');

  // Batch insert audit logs
  const batchLogs: AuditLogEntry[] = [
    {
      id: 'aud_test_off_02',
      timestamp: '2026-09-28T10:05:00Z',
      actorId: 'usr_maker_1',
      actorName: 'Abebe Kebede',
      actorRole: 'MAKER',
      action: 'BIOMETRIC_AUTH_SUCCESS',
      entityType: 'BIOMETRIC_AUTH',
      entityId: 'OB_BIOMETRIC_SENSOR',
      correlationId: 'corr_bio_offline',
      details: '[NBE Directive BSD/03/2020] Officer verified fingerprint while offline at remote site',
    },
    {
      id: 'aud_test_off_03',
      timestamp: '2026-09-28T10:10:00Z',
      actorId: 'usr_maker_1',
      actorName: 'Abebe Kebede',
      actorRole: 'MAKER',
      action: 'SAVE_DRAFT',
      entityType: 'REPORT_SUBMISSION',
      entityId: 'sub_test_offline_001',
      correlationId: 'corr_save_offline',
      details: '[NBE Directive BSD/03/2020] Offline auto-save executed to IndexedDB',
    },
  ];

  await indexedDbStorage.saveAuditLogsBatch(batchLogs, 'PENDING_SYNC');
  const allLogsAfterBatch = await indexedDbStorage.getAllAuditLogs();
  assert(allLogsAfterBatch.length === 3, 'saveAuditLogsBatch successfully writes multiple logs');

  const pendingLogs = await indexedDbStorage.getPendingAuditLogs();
  assert(pendingLogs.length === 3, 'getPendingAuditLogs identifies all 3 pending audit records');

  // Mark audit logs as synced
  await indexedDbStorage.markAuditLogsAsSynced(['aud_test_off_01', 'aud_test_off_02']);
  const pendingLogsAfterSync = await indexedDbStorage.getPendingAuditLogs();
  assert(pendingLogsAfterSync.length === 1, 'markAuditLogsAsSynced marks specific logs as synced');
  assert(pendingLogsAfterSync[0].id === 'aud_test_off_03', 'Remaining pending log is aud_test_off_03');

  // -------------------------------------------------------------------------
  // Test Suite 4: Remote Site Visit Metadata & Vault Package Export
  // -------------------------------------------------------------------------
  console.log('\n--- 4. Remote Site Visit Metadata & Cryptographic Vault Bundle ---');
  await indexedDbStorage.setMetadata('site_visit_active', true);
  await indexedDbStorage.setMetadata('site_visit_location', 'Jimma Regional Inspection Office');
  await indexedDbStorage.setMetadata('last_sync_timestamp', '2026-09-28T08:00:00Z');

  const location = await indexedDbStorage.getMetadata<string>('site_visit_location');
  assert(location === 'Jimma Regional Inspection Office', 'Metadata retrieved correctly from IndexedDB');

  const stats = await indexedDbStorage.getStorageStats();
  assert(stats.draftCount === 1, 'Stats reflects 1 active draft');
  assert(stats.auditCount === 3, 'Stats reflects 3 active audit logs');
  assert(stats.lastSyncTimestamp === '2026-09-28T08:00:00Z', 'Stats reflects last sync timestamp');
  assert(typeof stats.estimatedSizeBytes === 'number' && stats.estimatedSizeBytes > 0, 'Estimated storage footprint calculated');

  // Export field inspection package
  const vaultBundle = await indexedDbStorage.exportOfflineVaultBundle();
  assert(vaultBundle.format === 'OROMIA_BANK_NBE_OFFLINE_STORAGE_PACKAGE', 'Vault package format conforms to Oromia Bank spec');
  assert(vaultBundle.institutionCode === '0000013', 'Institution code matches 0000013');
  assert(vaultBundle.drafts.length === 1, 'Vault package bundles 1 draft');
  assert(vaultBundle.auditLogs.length === 3, 'Vault package bundles 3 audit logs');
  assert(vaultBundle.integritySeal.startsWith('OB-NBE-OFFLINE-VAULT-'), 'Generated cryptographic integrity seal for NBE inspection team');

  // -------------------------------------------------------------------------
  // Test Suite 5: SubmissionService & AuditService End-to-End Integration
  // -------------------------------------------------------------------------
  console.log('\n--- 5. SubmissionService & AuditService Integration Verification ---');
  const makerUser = DEMO_USERS.find((u) => u.id === 'usr_maker_2')!;

  // 1. Create submission via service
  const serviceDraft = submissionService.createSubmission('POBEPE001', makerUser);
  assert(Boolean(serviceDraft.id), 'submissionService.createSubmission creates draft successfully');

  // Check that draft was automatically committed to IndexedDB
  const indexedDraft = await indexedDbStorage.getDraft(serviceDraft.id);
  assert(Boolean(indexedDraft), 'Draft created in submissionService is automatically persisted to IndexedDB');
  assert(indexedDraft?.reportKey === 'POBEPE001', 'IndexedDB draft reportKey matches');

  // 2. Update draft via service
  const updatedServiceDraft = submissionService.updateDraft(
    serviceDraft.id,
    { '153_00010': 990000000 },
    {},
    makerUser
  );
  assert(updatedServiceDraft.version === 2, 'Draft version updated to 2');

  const indexedV2 = await indexedDbStorage.getDraft(serviceDraft.id);
  assert(indexedV2?.version === 2, 'IndexedDB draft version automatically updated to 2');
  assert(indexedV2?.values['153_00010'] === 990000000, 'IndexedDB values reflect latest edit');

  // 3. AuditService automatic IndexedDB persistence
  const testAuditLog = auditService.log({
    actorId: makerUser.id,
    actorName: makerUser.name,
    actorRole: makerUser.role,
    action: 'SAVE_DRAFT',
    entityType: 'REPORT_SUBMISSION',
    entityId: serviceDraft.id,
    correlationId: 'corr_test_int',
    details: 'Field officer saved draft during offline regulatory visit',
  });

  const indexedAuditLog = (await indexedDbStorage.getAllAuditLogs()).find((l) => l.id === testAuditLog.id);
  assert(Boolean(indexedAuditLog), 'AuditService log automatically persists to IndexedDB storage');
  assert(indexedAuditLog?.action === 'SAVE_DRAFT', 'Audit action preserved in IndexedDB');

  // 4. Biometric event automatic IndexedDB persistence
  const bioLog = auditService.logBiometricEvent({
    actorId: makerUser.id,
    actorName: makerUser.name,
    actorRole: makerUser.role,
    action: 'BIOMETRIC_AUTH_SUCCESS',
    type: 'FINGERPRINT',
    details: 'Biometric passkey verified on offline device',
  });

  const indexedBioLog = (await indexedDbStorage.getAllAuditLogs()).find((l) => l.id === bioLog.id);
  assert(Boolean(indexedBioLog), 'Biometric audit event automatically persists to IndexedDB storage');

  // 5. Hydration from IndexedDB into fresh instance
  await submissionService.hydrateFromIndexedDB();
  const hydrated = submissionService.getById(serviceDraft.id);
  assert(Boolean(hydrated), 'submissionService.hydrateFromIndexedDB recovers drafts from IndexedDB');

  console.log('\n✓ All IndexedDB Offline Storage & Remote Site Visit tests passed successfully.');
}
