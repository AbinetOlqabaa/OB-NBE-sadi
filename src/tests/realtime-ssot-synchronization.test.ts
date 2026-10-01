/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { realtimeSsotEngine } from '../services/realtimeSsotEngine.ts';
import { realtimeSsotClient } from '../services/realtimeSsotClient.ts';
import { configService } from '../services/configService.ts';
import { userService } from '../services/userService.ts';
import { effectiveAccessEngine } from '../services/effectiveAccessEngine.ts';
import { bulkOperationsEngine } from '../services/bulkOperationsEngine.ts';
import type { SsotChangeEvent } from '../types/realtime.ts';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

export async function runRealtimeSsotSynchronizationTests() {
  console.log('\n========================================================================');
  console.log('--- PHASE 7: REAL-TIME SINGLE-SOURCE-OF-TRUTH SYNCHRONIZATION ---');
  console.log('========================================================================\n');

  realtimeSsotEngine.clearHistory();
  realtimeSsotClient.clearDedupCache();

  // --- 1. ADMIN CHANGE → AFFECTED UI UPDATES ---
  console.log('--- 1. Admin Change → Affected UI Updates ---');
  let userChangedEventReceived: SsotChangeEvent | null = null;
  const onUserChanged = (evt: SsotChangeEvent) => {
    userChangedEventReceived = evt;
  };
  realtimeSsotEngine.events.on('USER_CHANGED', onUserChanged);

  // Admin updates a user status
  const testUser = userService.getAll().find((u) => u.role === 'MAKER')!;
  const originalStatus = testUser.status;
  const updateRes = userService.updateUserStatus(testUser.id, 'DISABLED', 'Compliance Admin');
  assert(updateRes.success, 'Admin successfully updated user status to DISABLED');
  assert(userChangedEventReceived !== null, 'realtimeSsotEngine emitted USER_CHANGED event');
  assert(
    (userChangedEventReceived as any).entityId === testUser.id,
    'Event entityId matches updated user ID'
  );
  assert(
    (userChangedEventReceived as any).action === 'STATUS_CHANGE',
    'Event action is STATUS_CHANGE'
  );
  assert(
    (userChangedEventReceived as any).payload.status === 'DISABLED',
    'Event payload contains updated status'
  );

  // Restore user status
  userService.updateUserStatus(testUser.id, originalStatus, 'Compliance Admin');
  realtimeSsotEngine.events.off('USER_CHANGED', onUserChanged);

  // --- 2. ASSIGNMENT CHANGE → EFFECTIVE ACCESS UPDATES ---
  console.log('--- 2. Assignment Change → Effective Access Updates ---');
  let assignmentEventReceived: SsotChangeEvent | null = null;
  const onAssignmentChanged = (evt: SsotChangeEvent) => {
    assignmentEventReceived = evt;
  };
  realtimeSsotEngine.events.on('ASSIGNMENT_CHANGED', onAssignmentChanged);

  const adminActor = { id: 'usr_admin', name: 'Compliance Admin', role: 'ADMIN' };
  const targetReportKey = 'DigitalLendingDL001';

  // Assign report directly to user
  const assignRes = configService.assignUserReport(
    {
      userId: testUser.id,
      userEmail: testUser.email,
      userName: testUser.name,
      reportKey: targetReportKey,
      departmentId: (testUser as any).departmentId || 'dept_credit_ops',
      duty: 'MAKER',
    },
    adminActor
  );
  assert(assignRes !== null && assignRes.id !== undefined, 'User report assignment created');
  assert(assignmentEventReceived !== null, 'ASSIGNMENT_CHANGED event dispatched');
  assert(
    (assignmentEventReceived as any).action === 'ASSIGN',
    'Assignment event has ASSIGN action'
  );

  // Effective access reflects update
  effectiveAccessEngine.invalidateUser(testUser.id);
  const updatedAllowed = effectiveAccessEngine.getAllowedReportKeysForUser(testUser);
  assert(
    updatedAllowed.includes(targetReportKey),
    'Effective access immediately reflects new user report assignment'
  );

  // Remove assignment
  assignmentEventReceived = null;
  configService.removeUserReportAssignment(assignRes.id, adminActor);
  assert(assignmentEventReceived !== null, 'ASSIGNMENT_CHANGED (REVOKE) event dispatched');
  assert((assignmentEventReceived as any).action === 'REVOKE', 'Assignment event has REVOKE action');

  effectiveAccessEngine.invalidateUser(testUser.id);
  const finalAllowed = effectiveAccessEngine.getAllowedReportKeysForUser(testUser);
  assert(
    !finalAllowed.includes(targetReportKey),
    'Effective access immediately revoked upon assignment deletion'
  );
  realtimeSsotEngine.events.off('ASSIGNMENT_CHANGED', onAssignmentChanged);

  // --- 3. REPORT PUBLICATION → CATALOG UPDATES ---
  console.log('--- 3. Report Publication → Catalog Updates ---');
  let reportPublishEventReceived: SsotChangeEvent | null = null;
  const onReportChanged = (evt: SsotChangeEvent) => {
    if (evt.action === 'PUBLISH' || evt.action === 'VERSION_BUMP') {
      reportPublishEventReceived = evt;
    }
  };
  realtimeSsotEngine.events.on('REPORT_CHANGED', onReportChanged);

  const reportToPublish = configService.getReportDefinition('LOA_ADV_OUT_LA001')!;

  // Publish a new snapshot version
  const newV = configService.createReportVersion(
    reportToPublish.returnKey,
    {
      changelogSummary: 'Regulatory updates for 2026 BSD audit directive',
    },
    { id: 'usr_admin', name: 'Compliance Admin', role: 'ADMIN' }
  );

  configService.publishReportVersion(
    reportToPublish.returnKey,
    newV.versionNumber,
    { id: 'usr_admin', name: 'Compliance Admin', role: 'ADMIN' }
  );

  assert(reportPublishEventReceived !== null, 'REPORT_CHANGED (PUBLISH) event published');
  assert(
    (reportPublishEventReceived as any).entityId === newV.versionId,
    'Published version ID matches event entityId'
  );
  assert(
    (reportPublishEventReceived as any).payload.entityType === 'REPORT_VERSION',
    'Event specifies REPORT_VERSION entity type'
  );
  realtimeSsotEngine.events.off('REPORT_CHANGED', onReportChanged);

  // --- 4. SPECIAL-ACCESS REVOCATION → ACCESS DISAPPEARS ---
  console.log('--- 4. Special-Access Revocation → Access Disappears ---');
  let specialAccessEvent: SsotChangeEvent | null = null;
  const onSpecialAccess = (evt: SsotChangeEvent) => {
    specialAccessEvent = evt;
  };
  realtimeSsotEngine.events.on('SPECIAL_ACCESS_CHANGED', onSpecialAccess);

  // Grant special access to Maker for an external department report
  const grantRes = userService.grantSpecialAccess(
    testUser.id,
    {
      reportKey: 'POBEPE001',
      reason: 'Urgent temporary coverage during peak import season',
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    },
    'Compliance Administrator'
  );
  assert(grantRes.success, 'Special access grant created');
  assert(specialAccessEvent !== null, 'SPECIAL_ACCESS_CHANGED (GRANTED) event published');
  assert((specialAccessEvent as any).action === 'GRANTED', 'Event action is GRANTED');

  // Verify access is currently active
  const accessBeforeRevoke = effectiveAccessEngine.evaluateAccess(
    userService.getById(testUser.id)!,
    'POBEPE001',
    'CREATE_DRAFT'
  );
  assert(accessBeforeRevoke.allowed, 'Maker can prepare draft under active special access grant');

  // Now revoke special access
  const grantId = grantRes.user!.specialAccessGrants.find((g) => g.reportKey === 'POBEPE001')!.id;
  specialAccessEvent = null;
  const revokeRes = userService.revokeSpecialAccess(testUser.id, grantId, 'Compliance Administrator');
  assert(revokeRes.success, 'Special access grant revoked');
  assert(specialAccessEvent !== null, 'SPECIAL_ACCESS_CHANGED (REVOKED) event published');
  assert((specialAccessEvent as any).action === 'REVOKED', 'Event action is REVOKED');

  // Verify access immediately disappears
  const accessAfterRevoke = effectiveAccessEngine.evaluateAccess(
    userService.getById(testUser.id)!,
    'POBEPE001',
    'CREATE_DRAFT'
  );
  assert(!accessAfterRevoke.allowed, 'Access is immediately barred after special-access revocation');
  realtimeSsotEngine.events.off('SPECIAL_ACCESS_CHANGED', onSpecialAccess);

  // --- 5. RECONNECT, HEARTBEAT & MISSED EVENTS RECOVERY ---
  console.log('--- 5. Reconnect, Heartbeat & Missed Events Recovery ---');
  // Client processes baseline event
  const baseEvent = realtimeSsotEngine.publishEvent({
    eventType: 'CONFIG_SYNC_TRIGGER',
    action: 'BASELINE_SYNC',
    domain: 'REPORT',
    entityId: 'SYSTEM',
    summary: 'Baseline synchronization state',
  });
  realtimeSsotClient.processEvent(baseEvent);
  const baselineSeq = realtimeSsotClient.getLastSequence();

  // Simulate offline period: server emits 3 new mutations
  const offlineEvt1 = realtimeSsotEngine.publishEvent({
    eventType: 'DEPARTMENT_CHANGED',
    action: 'UPDATE',
    domain: 'DEPARTMENT',
    entityId: 'dept_credit_ops',
    summary: 'Department profile updated while client offline',
  });
  const offlineEvt2 = realtimeSsotEngine.publishEvent({
    eventType: 'REPORT_CHANGED',
    action: 'VERSION_BUMP',
    domain: 'REPORT',
    entityId: 'LOA_ADV_OUT_LA001',
    summary: 'Report version bumped while client offline',
  });
  const offlineEvt3 = realtimeSsotEngine.publishEvent({
    eventType: 'WORKFLOW_STATUS_CHANGED',
    action: 'APPROVED',
    domain: 'WORKFLOW',
    entityId: 'sub_test_offline',
    summary: 'Submission approved while client offline',
  });

  // Client reconnects and requests sync
  let syncResponseReceived: any = null;
  const mockClient: any = {
    id: 'test_client_reconnect',
    ws: { readyState: 1, send: (data: string) => { syncResponseReceived = JSON.parse(data); } },
    isAlive: true,
    authenticated: true,
    role: 'ADMIN',
    subscribedTopics: new Set(['GLOBAL', 'DEPARTMENTS', 'REPORTS', 'WORKFLOWS']),
  };

  realtimeSsotEngine.processClientMessage(mockClient, {
    type: 'SYNC_REQUEST',
    lastSequenceNumber: baselineSeq,
  });

  assert(syncResponseReceived !== null, 'Server responded to SYNC_REQUEST after reconnect');
  assert(syncResponseReceived.type === 'SYNC_RESPONSE', 'Response type is SYNC_RESPONSE');
  assert(syncResponseReceived.missedEvents.length >= 3, 'Server identified all missed events during offline gap');
  assert(
    syncResponseReceived.missedEvents.some((e: any) => e.eventId === offlineEvt1.eventId),
    'Missed events include offline event 1'
  );
  assert(
    syncResponseReceived.missedEvents.some((e: any) => e.eventId === offlineEvt3.eventId),
    'Missed events include offline event 3'
  );

  // Client applies missed events idempotently
  syncResponseReceived.missedEvents.forEach((evt: any) => {
    realtimeSsotClient.processEvent(evt);
  });
  assert(
    realtimeSsotClient.getLastSequence() >= offlineEvt3.sequenceNumber,
    'Client sequence counter converged to latest authoritative sequence'
  );

  // --- 6. DUPLICATE EVENT DEDUPLICATION (IDEMPOTENCY) ---
  console.log('--- 6. Duplicate Event Deduplication (Idempotency) ---');
  let duplicateDropped = false;
  const onDuplicate = () => {
    duplicateDropped = true;
  };
  realtimeSsotClient.events.on('DUPLICATE_EVENT_DROPPED', onDuplicate);

  const testDupEvent: SsotChangeEvent = {
    eventId: 'evt_unique_12345',
    sequenceNumber: 9999,
    eventType: 'USER_CHANGED',
    action: 'UPDATE',
    domain: 'USER',
    entityId: 'usr_test',
    topic: 'USER:usr_test',
    timestamp: new Date().toISOString(),
    actor: { id: 'admin', name: 'Admin', role: 'ADMIN' },
    summary: 'Test idempotent event',
    globalConfigHash: 'hash_test',
    payload: { updated: true },
  };

  const firstResult = realtimeSsotClient.processEvent(testDupEvent);
  assert(firstResult === true, 'First event arrival processed successfully');

  const secondResult = realtimeSsotClient.processEvent(testDupEvent);
  assert(secondResult === false, 'Duplicate arrival discarded by deduplication filter');
  assert(duplicateDropped, 'DUPLICATE_EVENT_DROPPED notification triggered');
  realtimeSsotClient.events.off('DUPLICATE_EVENT_DROPPED', onDuplicate);

  // --- 7. STALE CACHE RESOLUTION ---
  console.log('--- 7. Stale Cache Resolution ---');
  const latestServerHash = configService.generateGlobalHash();
  let revalidateTriggered = false;
  realtimeSsotClient.events.on('REVALIDATE_ALL', () => {
    revalidateTriggered = true;
  });

  // Client requests sync with an ancient sequence number beyond buffer
  realtimeSsotEngine.processClientMessage(mockClient, {
    type: 'SYNC_REQUEST',
    lastSequenceNumber: -100, // Forces gap overflow
    lastHash: 'ancient_hash_expired',
  });

  assert(syncResponseReceived.requiresFullRevalidation === true, 'Server detects unrecoverable gap and flags full revalidation');
  realtimeSsotClient.handleServerMessage(syncResponseReceived);
  assert(revalidateTriggered, 'Client triggers REVALIDATE_ALL across UI domains to converge state');

  // --- 8. SUBSCRIPTION SCOPING & SENSITIVE DATA ISOLATION ---
  console.log('--- 8. Subscription Scoping & Sensitive Data Isolation ---');
  const makerClient = {
    userId: 'usr_maker_1',
    role: 'MAKER',
    department: 'Credit Operations',
  };

  // Maker attempts to subscribe to admin topic
  const adminTopicCheck = realtimeSsotEngine.authorizeSubscription(makerClient, 'ADMIN:CONFIG');
  assert(!adminTopicCheck.allowed, 'Maker denied subscription to ADMIN:CONFIG');
  assert(
    adminTopicCheck.reason.includes('ADMIN role required'),
    'Denied with appropriate privilege requirement reason'
  );

  // Maker attempts to subscribe to another user private channel
  const otherUserCheck = realtimeSsotEngine.authorizeSubscription(makerClient, 'USER:usr_other_maker');
  assert(!otherUserCheck.allowed, 'User denied subscription to another user private topic');

  // Maker subscribes to own channel
  const ownChannelCheck = realtimeSsotEngine.authorizeSubscription(makerClient, 'USER:usr_maker_1');
  assert(ownChannelCheck.allowed, 'User authorized to subscribe to own private topic');

  // Maker subscribes to public topics
  const publicCheck = realtimeSsotEngine.authorizeSubscription(makerClient, 'REPORTS');
  assert(publicCheck.allowed, 'User authorized to subscribe to REPORTS topic');

  // Sensitive data sanitization in event payloads
  const rawPayload = {
    userId: 'usr_secret_1',
    email: 'compliance@oromiabank.com',
    password: 'super_secret_password',
    passwordHash: 'sha256$hashed$secret',
    token: 'jwt.token.secret',
    nested: {
      authToken: 'bearer_token_123',
      safeField: 'This is safe to broadcast',
    },
  };

  const sanitized = realtimeSsotEngine.sanitizePayload(rawPayload);
  assert((sanitized as any).password === undefined, 'Password stripped from event payload');
  assert((sanitized as any).passwordHash === undefined, 'Password hash stripped from event payload');
  assert((sanitized as any).token === undefined, 'Auth token stripped from event payload');
  assert((sanitized as any).nested.authToken === undefined, 'Nested auth token stripped from event payload');
  assert((sanitized as any).nested.safeField === 'This is safe to broadcast', 'Non-sensitive field preserved');

  // --- 9. ATOMIC TRANSACTION ROLLBACK SAFETY ---
  console.log('--- 9. Atomic Transaction Rollback Safety ---');
  let eventsDuringFailedTransaction = 0;
  const countEvents = () => {
    eventsDuringFailedTransaction++;
  };
  realtimeSsotEngine.events.on('SSOT_EVENT', countEvents);

  const initialUserCount = userService.getAll().length;
  try {
    const rollbackCsv = `Name,Email,Role,Department,EmployeeId,Status
Valid User,valid_rollback_${Date.now()}@oromiabank.com,MAKER,Credit Operations & Portfolio Management,OB-RB-1,ACTIVE
Invalid User,invalid_dept_${Date.now()}@oromiabank.com,MAKER,NON_EXISTENT_DEPT,OB-RB-2,ACTIVE`;

    const dryRunRollback = bulkOperationsEngine.generateDryRun({
      targetType: 'USERS',
      format: 'CSV',
      rawPayload: rollbackCsv,
      conflictStrategy: 'FAIL_ON_CONFLICT',
      actor: { id: 'usr_admin', name: 'Admin', role: 'ADMIN' },
    });

    bulkOperationsEngine.executeDryRun({
      dryRunId: dryRunRollback.dryRunId,
      mode: 'ATOMIC',
      actor: { id: 'usr_admin', name: 'Admin', role: 'ADMIN' },
      confirmed: true,
    });
  } catch (_) {
    // Expected rollback
  }

  assert(
    userService.getAll().length === initialUserCount,
    'Authoritative state intact: zero uncommitted rows survived rollback'
  );
  realtimeSsotEngine.events.off('SSOT_EVENT', countEvents);

  console.log('\n========================================================================');
  console.log('✅ ALL PHASE 7 REAL-TIME SSOT SYNCHRONIZATION TESTS PASSED CLEANLY');
  console.log('========================================================================\n');
}
