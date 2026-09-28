/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { nbeSimulator } from '../services/nbeSimulator.ts';
import { nbeAdapter } from '../services/nbeAdapter.ts';
import { submissionService } from '../services/submissionService.ts';
import type { UserSession } from '../types/regulatory.ts';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`[NBE Simulator Assertion Failed]: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

export async function runNbeSimulatorTests() {
  console.log('\n======================================================');
  console.log('--- 3. NBE ADAPTER & REALISTIC SIMULATOR TESTS ---');
  console.log('======================================================');

  // Test 1: Simulator starts in ALWAYS_SUCCESS mode
  nbeSimulator.setScenario({ mode: 'ALWAYS_SUCCESS', latencyMs: 10 });
  const scenario = nbeSimulator.getScenario();
  assert(scenario.mode === 'ALWAYS_SUCCESS', 'Simulator scenario configured to ALWAYS_SUCCESS');

  // Test 2: Process valid submission through simulator directly
  const testPayload = {
    InstCode: '0000013',
    ReturnKey: 'M_LCPLC001',
    FinYear: 2026,
    values: { '153_00010': 150000000 },
    dynamicRows: {},
    maker: { id: 'usr_maker_1', name: 'Abebe Kebede' },
    checker: { id: 'usr_checker_1', name: 'Chala Desta' },
  };

  const idempKey1 = `idemp_test_${Date.now()}`;
  const corrId1 = `corr_test_${Date.now()}`;

  const res1 = await nbeSimulator.processSubmission(testPayload, {
    'idempotency-key': idempKey1,
    'x-correlation-id': corrId1,
  });

  if (res1.statusCode !== 200) {
    console.error('NBE Simulator test 1 failed with:', res1.statusCode, res1.body);
  }

  assert(res1.statusCode === 200, `NBE Simulator returns 200 OK in ALWAYS_SUCCESS mode (got ${res1.statusCode})`);
  assert(res1.body.status === 'ACCEPTED', 'Response status is ACCEPTED');
  assert(Boolean(res1.body.receiptNumber || res1.body.referenceNumber), `Received authoritative receiptNumber: ${res1.body.receiptNumber || res1.body.referenceNumber}`);
  assert(res1.body.correlationId === corrId1, 'Correlation ID echoed accurately');

  // Test 3: Idempotency deduplication check
  // Submitting the same payload with the identical idempotency key must be recognized
  const resDuplicate = await nbeSimulator.processSubmission(testPayload, {
    'idempotency-key': idempKey1,
    'x-correlation-id': `corr_dup_${Date.now()}`,
  });
  assert(resDuplicate.statusCode === 200, 'Duplicate submission with same idempotency key returns 200');
  assert((resDuplicate.body.receiptNumber || resDuplicate.body.referenceNumber) === (res1.body.receiptNumber || res1.body.referenceNumber), 'Duplicate submission returns the exact same receiptNumber (idempotent receipt)');

  // Test 4: Simulator Scenario - VALIDATION_FAILURE (400 or 422)
  nbeSimulator.setScenario({ mode: 'VALIDATION_FAILURE', latencyMs: 10 });
  const resValFail = await nbeSimulator.processSubmission(testPayload, {
    'idempotency-key': `idemp_val_${Date.now()}`,
    'x-correlation-id': `corr_val_${Date.now()}`,
  });
  assert(resValFail.statusCode === 422 || resValFail.statusCode === 400, 'VALIDATION_FAILURE scenario returns 422 or 400');
  assert(resValFail.body.error !== undefined, 'Error response object returned on validation failure');

  // Test 5: Simulator Scenario - AUTH_FAILURE (401 Unauthorized)
  nbeSimulator.setScenario({ mode: 'AUTH_FAILURE', latencyMs: 10 });
  const resAuthFail = await nbeSimulator.processSubmission(testPayload, {
    'idempotency-key': `idemp_auth_${Date.now()}`,
    'x-correlation-id': `corr_auth_${Date.now()}`,
  });
  assert(resAuthFail.statusCode === 401, 'AUTH_FAILURE scenario returns 401 Unauthorized');

  // Test 6: Simulator Scenario - SERVER_ERROR (500 Internal Server Error)
  nbeSimulator.setScenario({ mode: 'SERVER_ERROR', latencyMs: 10 });
  const resServError = await nbeSimulator.processSubmission(testPayload, {
    'idempotency-key': `idemp_err_${Date.now()}`,
    'x-correlation-id': `corr_err_${Date.now()}`,
  });
  assert(resServError.statusCode === 500, 'SERVER_ERROR scenario returns 500 Internal Server Error');

  // Reset simulator to ALWAYS_SUCCESS for end-to-end delivery test
  nbeSimulator.setScenario({ mode: 'ALWAYS_SUCCESS', latencyMs: 10 });

  // Test 7: End-to-End Submission Delivery via submissionService.deliverToNBE
  console.log('\n--- End-to-End Delivery of Approved Submission ---');
  const makerSession: UserSession = {
    id: 'usr_maker_1',
    name: 'Abebe Kebede',
    email: 'abebe.kebede@oromiabank.com',
    role: 'MAKER',
    institutionCode: '0000013',
    department: 'Credit Operations & Portfolio Management',
  };

  const checkerSession: UserSession = {
    id: 'usr_checker_1',
    name: 'Chala Desta',
    email: 'chala.desta@oromiabank.com',
    role: 'CHECKER',
    institutionCode: '0000013',
    department: 'Credit Operations & Portfolio Management',
  };

  // Create, populate, submit, approve, and deliver
  const deliverySub = submissionService.createSubmission('LOA_PORT_EP001', makerSession);
  const values: Record<string, any> = {};
  for (const k of Object.keys(deliverySub.values)) {
    values[k] = 5000000;
  }
  submissionService.updateDraft(deliverySub.id, values, {}, makerSession);
  submissionService.submitToChecker(deliverySub.id, makerSession, 'For final delivery testing');
  submissionService.reviewSubmission(deliverySub.id, 'APPROVE', checkerSession, 'Approved for delivery');

  // Execute delivery as Maker
  const deliveryResult = await submissionService.deliverToNBE(deliverySub.id, makerSession);
  assert(deliveryResult.success, 'deliverToNBE succeeds');
  const deliveredSub = submissionService.getById(deliverySub.id)!;
  assert(deliveredSub.status === 'SENT', 'Submission status transitions to SENT');
  assert(deliveredSub.deliveryAttempts.length > 0, 'Delivery attempt is appended to submission history');
  const receiptNum = deliveredSub.nbeReferenceNumber || deliveredSub.deliveryAttempts[0]?.responsePayload?.receiptNumber;
  assert(Boolean(receiptNum), `Assigned NBE receipt number: ${receiptNum}`);

  console.log('✓ All NBE Adapter & Simulator integration tests passed successfully.');
}
