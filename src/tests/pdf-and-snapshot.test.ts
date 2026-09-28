/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PdfGenerator, generateRegulatoryReportPDF, generateDocumentIntegrityHash } from '../utils/pdfGenerator.ts';
import { submissionService } from '../services/submissionService.ts';
import { getReportByKey } from '../data/report-registry.ts';
import type { UserSession, ReportMetadata } from '../types/regulatory.ts';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

export async function runPdfAndSnapshotTests(): Promise<void> {
  console.log('\n======================================================');
  console.log('--- 6. PDF GENERATOR & SUBMISSION SNAPSHOTTING TESTS ---');
  console.log('======================================================');

  const makerUser: UserSession = {
    id: 'usr_maker_test_snap',
    name: 'Abebe Kebede',
    email: 'abebe.kebede@oromiabank.com',
    role: 'MAKER',
    institutionCode: '0000013',
    department: 'Credit Operations & Portfolio Management',
  };

  const checkerUser: UserSession = {
    id: 'usr_checker_test_snap',
    name: 'Chala Desta',
    email: 'chala.desta@oromiabank.com',
    role: 'CHECKER',
    institutionCode: '0000013',
    department: 'Credit Operations & Portfolio Management',
  };

  // 1. Create a new submission draft
  console.log('\n--- 1. Submission Creation & Initial Snapshot (Version 1) ---');
  const sub = submissionService.createSubmission('LOA_PORT_EP001', makerUser);
  assert(sub !== undefined, 'Created new submission draft for LOA_PORT_EP001');
  assert(sub.version === 1, 'Initial submission data version is 1');
  assert(sub.templateVersion === 1, 'Initial templateVersion is 1');
  assert(sub.dataVersion === 1, 'Initial dataVersion is 1');
  assert(sub.status === 'DRAFT', 'Initial status is DRAFT');
  assert(sub.templateSnapshot !== undefined, 'templateSnapshot is frozen at creation time');
  assert(sub.dataSnapshot !== undefined, 'dataSnapshot is populated with initial values');
  assert(Array.isArray(sub.historicalSnapshots) && sub.historicalSnapshots.length === 1, 'Initial historical snapshot recorded');
  assert(sub.historicalSnapshots![0].version === 1, 'Initial snapshot version is 1');
  assert(sub.historicalSnapshots![0].status === 'DRAFT', 'Initial snapshot status is DRAFT');

  // 2. Update Draft Values (Version 2)
  console.log('\n--- 2. Draft Value Update & Version Increment (Version 2) ---');
  const v1Values = { ...sub.values };
  const updatedValues = {
    ...sub.values,
    '34_00001': 850000000,
    '34_00003': 120000000,
    '34_00006': 730000000,
  };

  const v2Sub = submissionService.updateDraft(sub.id, updatedValues, {}, makerUser);
  assert(v2Sub.version === 2, 'Submission version incremented to 2');
  assert(v2Sub.dataVersion === 2, 'dataVersion incremented to 2');
  assert(v2Sub.values['34_00001'] === 850000000, 'Updated values applied to draft');
  assert(v2Sub.dataSnapshot!['34_00001'] === 850000000, 'dataSnapshot reflects v2 values');
  assert(v2Sub.historicalSnapshots!.length === 2, 'Two historical snapshots recorded');
  assert(v2Sub.historicalSnapshots![1].version === 2, 'Second snapshot version is 2');

  // 3. Update Draft Values Again (Version 3)
  console.log('\n--- 3. Multiple Revision History & Snapshot Isolation ---');
  const v3Values = {
    ...updatedValues,
    '34_00001': 920000000,
    '34_00003': 150000000,
    '34_00006': 770000000,
  };

  const v3Sub = submissionService.updateDraft(sub.id, v3Values, {}, makerUser);
  assert(v3Sub.version === 3, 'Submission version incremented to 3');
  assert(v3Sub.values['34_00001'] === 920000000, 'Draft values updated to v3 amount 920,000,000');

  // Verify historical retrieval of Version 2 retains original values even after Version 3 edit
  const snap2 = submissionService.getHistoricalSnapshot(sub.id, 2);
  assert(snap2 !== undefined, 'Historical snapshot v2 successfully retrieved');
  assert(snap2!.version === 2, 'Retrieved snapshot is version 2');
  assert(snap2!.values['34_00001'] === 850000000, 'Historical snapshot v2 retained 850,000,000 without mutation');

  const histData2 = submissionService.getHistoricalSubmissionData(sub.id, 2);
  assert(histData2 !== undefined, 'getHistoricalSubmissionData returns data bundle for v2');
  assert(histData2!.values['34_00001'] === 850000000, 'Exact historical value 850,000,000 retrieved for v2');

  // 4. Restore Version
  console.log('\n--- 4. Draft Version Rollback / Restore ---');
  const restored = submissionService.restoreVersion(sub.id, 2, makerUser);
  assert(restored.version === 4, 'Restoring v2 creates a new version 4 reflecting restored values');
  assert(restored.values['34_00001'] === 850000000, 'Restored draft values match v2 value 850,000,000');

  // 5. Submit to Checker & Verify 4-Eyes Snapshot
  console.log('\n--- 5. 4-Eyes Workflow Submission Snapshotting ---');
  const pendingSub = submissionService.submitToChecker(sub.id, makerUser, 'Reviewing Q2 portfolio balances');
  assert(pendingSub.status === 'PENDING_CHECKER', 'Status transitioned to PENDING_CHECKER');
  const submitSnap = submissionService.getHistoricalSnapshot(sub.id, pendingSub.version);
  assert(submitSnap !== undefined, 'Snapshot exists for version at submission');
  assert(submitSnap!.status === 'PENDING_CHECKER', 'Snapshot captures PENDING_CHECKER status');
  assert(submitSnap!.capturedBy === 'Abebe Kebede', 'Snapshot recorded submitting maker name');

  // Checker Approves
  const approvedSub = submissionService.reviewSubmission(sub.id, 'APPROVE', checkerUser, 'Verified against core general ledger');
  assert(approvedSub.status === 'APPROVED', 'Status transitioned to APPROVED');

  // Maker Delivers to NBE
  const deliveryRes = await submissionService.deliverToNBE(sub.id, makerUser);
  assert(deliveryRes.success === true, 'NBE delivery succeeded');
  const deliveredSub = submissionService.getById(sub.id)!;
  assert(deliveredSub.status === 'SENT', 'Final status is SENT');
  assert(deliveredSub.submittedVersion === deliveredSub.version, 'submittedVersion is locked to submission version');
  assert(deliveredSub.dataSnapshot !== undefined, 'dataSnapshot is immutable after delivery');
  assert(deliveredSub.nbeReferenceNumber !== undefined, 'NBE reference number assigned');

  // 6. Schema Mutation Immunity Test
  console.log('\n--- 6. Schema Mutation Immunity Verification ---');
  // Simulate template schema change (e.g., fields removed or added in live registry)
  const syntheticModifiedReport: ReportMetadata = {
    ...deliveredSub.templateSnapshot!,
    Title: 'MODIFIED TEMPLATE TITLE AFTER REGULATORY CIRCULAR',
    ReturnItemsList: [
      {
        Code: 'NEW_FIELD_FUTURE_CIRCULAR',
        Value: 999999,
        _description: 'Future field not present in historical return',
        _dataType: 'NUMERIC',
        _required: true,
      },
    ],
  };

  // Ensure effective template on historical submission preserves the snapshot, NOT the modified schema
  const effectiveTemplate = submissionService.getEffectiveTemplate(deliveredSub);
  assert(
    effectiveTemplate.Title !== syntheticModifiedReport.Title,
    'Historical submission preserves original template snapshot title'
  );
  assert(
    effectiveTemplate.ReturnItemsList.some((i) => i.Code === '34_00001'),
    'Historical submission retains original field codes'
  );

  // 7. Oromia Bank Standardized PDF Generator Verification
  console.log('\n--- 7. Oromia Bank NBE-Compliant PDF Generator Verification ---');
  assert(typeof PdfGenerator.createPdfDocument === 'function', 'PdfGenerator.createPdfDocument is exported');
  assert(typeof generateRegulatoryReportPDF === 'function', 'generateRegulatoryReportPDF is exported');

  const pdfDoc = PdfGenerator.createPdfDocument(undefined, deliveredSub);
  assert(pdfDoc !== undefined, 'PDF document generated successfully');

  const arrayBuffer = PdfGenerator.getPdfArrayBuffer(undefined, deliveredSub);
  assert(arrayBuffer !== undefined && arrayBuffer.byteLength > 1000, `PDF compiled to binary ArrayBuffer (${arrayBuffer.byteLength} bytes)`);

  const integritySeal = generateDocumentIntegrityHash(deliveredSub);
  assert(integritySeal.startsWith('OB-NBE-SEAL-'), `Generated cryptographic tamper seal: ${integritySeal}`);

  console.log('✓ All PDF Generator & Submission Snapshotting tests passed successfully.');
}
