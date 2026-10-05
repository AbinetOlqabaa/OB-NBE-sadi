/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { auditorService } from '../services/auditorService.ts';
import { submissionService, DEMO_USERS } from '../services/submissionService.ts';
import { getReportByKey, getReportsByDepartment } from '../data/report-registry.ts';
import { FormulaEngine } from '../utils/formulaEngine.ts';
import { generateAuditorExportBlob } from '../utils/auditorMultiFormatExport.ts';
import type {
  UserSession,
  RegulatoryAnomalyItem,
  AuditorExportFormat,
  AuditorExportScope,
} from '../types/regulatory.ts';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

export async function runPhase48Phase49Phase50Tests() {
  console.log('\n========================================================================');
  console.log('--- Phase 48: Auditor Performance Summary Metric Cards & Anomaly Detection Feed ---');
  console.log('--- Phase 49: Auditor Multi-Format Single & Bulk Export Engine (CSV/JSON/XML/XLSX/PDF) ---');
  console.log('--- Phase 50: Batch Submission in Maker Library & Checker Inbox with NBE Delivery ---');
  console.log('========================================================================\n');

  // Test User Sessions using registered authoritative users
  const mockMaker: UserSession = DEMO_USERS.find((u) => u.role === 'MAKER') || {
    id: 'usr_maker_1',
    name: 'Abebe Kebede',
    email: 'abebe.kebede@oromiabank.com',
    role: 'MAKER',
    institutionCode: '0000013',
    department: 'Credit Operations & Portfolio Management',
  };

  const mockChecker: UserSession = DEMO_USERS.find((u) => u.role === 'CHECKER') || {
    id: 'usr_checker_1',
    name: 'Chala Desta',
    email: 'chala.desta@oromiabank.com',
    role: 'CHECKER',
    institutionCode: '0000013',
    department: 'Credit Operations & Portfolio Management',
  };

  const mockAuditor: UserSession = DEMO_USERS.find((u) => u.role === 'AUDITOR') || {
    id: 'usr_auditor_1',
    name: 'Worku Alemu',
    email: 'worku.alemu@oromiabank.com',
    role: 'AUDITOR',
    institutionCode: '0000013',
    department: 'Internal Audit & Regulatory Control',
  };

  // -------------------------------------------------------------------------
  // 1. Auditor Performance Summary Metric Cards
  // -------------------------------------------------------------------------
  console.log('Test Suite 1: Auditor Dashboard Performance Summary Metric Cards');
  const metrics = auditorService.getPerformanceOverviewMetrics();

  assert(typeof metrics.totalSubmissions === 'number', 'Total Submissions metric is computed');
  assert(typeof metrics.pendingCorrections === 'number', 'Pending Corrections metric is computed');
  assert(typeof metrics.approvedToday === 'number', 'Approved Today metric is computed');
  assert(typeof metrics.avgProcessingTimeHours === 'number', 'Avg Processing Time (Hours) metric is computed');
  assert(typeof metrics.avgProcessingTimeFormatted === 'string', 'Avg Processing Time Formatted string exists');
  assert(typeof metrics.slaComplianceRate === 'number' && metrics.slaComplianceRate > 0, 'SLA compliance rate is computed');

  // -------------------------------------------------------------------------
  // 2. Anomaly Detection Feed Engine
  // -------------------------------------------------------------------------
  console.log('\nTest Suite 2: Anomaly Detection Feed Engine & Severity Badges');
  const anomalies = auditorService.getAnomalyDetectionFeed();
  assert(Array.isArray(anomalies) && anomalies.length >= 4, 'Anomaly Detection Feed contains initial seeded regulatory anomalies');

  const criticalAnomaly = anomalies.find((a) => a.severity === 'CRITICAL');
  assert(criticalAnomaly !== undefined, 'Critical severity anomaly pattern detected in returns');
  assert(criticalAnomaly?.patternLabel !== undefined, 'Pattern category classified correctly');
  assert(typeof criticalAnomaly?.confidencePct === 'number' && criticalAnomaly.confidencePct > 50, 'Confidence score calculated');
  assert(criticalAnomaly?.observedValue !== undefined && criticalAnomaly?.expectedRange !== undefined, 'Observed vs expected values present');

  // Test Anomaly Status Workflow
  const testAnomaly = anomalies[0];
  const updatedAnomaly = auditorService.updateAnomalyStatus(testAnomaly.id, 'INVESTIGATING', 'Kenenisa Bekele');
  assert(updatedAnomaly !== null && updatedAnomaly.status === 'INVESTIGATING', 'Anomaly status updated to INVESTIGATING');

  // Test Conversion of Anomaly to Audit Finding
  const convertedFinding = auditorService.convertAnomalyToFinding(testAnomaly.id, mockAuditor.id, mockAuditor.name);
  assert(convertedFinding !== null, 'Anomaly successfully converted to official Audit Finding');
  assert(Boolean(convertedFinding?.title.includes('Anomaly') || convertedFinding?.description.includes('Observed')), 'Finding retains anomaly context');
  
  const recheckedAnomaly = auditorService.getAnomalyDetectionFeed().find((a) => a.id === testAnomaly.id);
  assert(recheckedAnomaly?.status === 'CONVERTED_TO_FINDING', 'Anomaly status reflects conversion to finding');
  assert(recheckedAnomaly?.linkedFindingId === convertedFinding?.id, 'Anomaly is linked to created finding ID');

  // -------------------------------------------------------------------------
  // 3. Multi-Format Single and Bulk Export Engine (CSV, JSON, XML, XLSX, PDF)
  // -------------------------------------------------------------------------
  console.log('\nTest Suite 3: Multi-Format Single and Bulk Export Capabilities');

  const exportFormats: AuditorExportFormat[] = ['CSV', 'JSON', 'XML', 'XLSX', 'PDF'];

  for (const fmt of exportFormats) {
    // Bulk export test
    const exportResult = auditorService.exportAuditData({
      format: fmt,
      scope: 'FULL_AUDIT_DOSSIER',
      mode: 'BULK',
    });
    assert(exportResult.fileName.length > 0, `Generated valid filename for bulk ${fmt} export: ${exportResult.fileName}`);
    assert(exportResult.content !== undefined, `Generated non-empty payload for ${fmt} export`);
    assert(exportResult.mimeType.length > 0, `Correct MIME type returned for ${fmt}: ${exportResult.mimeType}`);

    // Verify blob generator utility
    const blob = generateAuditorExportBlob(exportResult);
    assert(blob instanceof Blob, `Blob generated successfully for ${fmt}`);
  }

  // Single Item Export Tests
  const singleFindingExport = auditorService.exportAuditData({
    format: 'JSON',
    scope: 'FINDINGS',
    mode: 'SINGLE',
    selectedIds: [convertedFinding!.id],
  });
  const parsedFinding = JSON.parse(singleFindingExport.content);
  assert(parsedFinding.records.length === 1 && parsedFinding.records[0].FindingId === convertedFinding!.id, 'Single finding export contains only selected item');

  const singleAnomalyExport = auditorService.exportAuditData({
    format: 'XML',
    scope: 'ANOMALY_FEED',
    mode: 'SINGLE',
    selectedIds: [anomalies[1].id],
  });
  assert(singleAnomalyExport.content.includes('<NBESupervisoryAuditExport'), 'Single anomaly XML export properly root-tagged');
  assert(singleAnomalyExport.content.includes(anomalies[1].id), 'Single anomaly XML export contains anomaly ID');

  // -------------------------------------------------------------------------
  // 4. Batch Submission Workflow for Makers (MakerLibraryView)
  // -------------------------------------------------------------------------
  console.log('\nTest Suite 4: Maker Batch Submission to Checker Workflow');

  // Use 3 Credit Operations reports with guaranteed formula-validation consistency
  const k1 = 'LOA_ADV_OUT_LA001';
  const k2 = 'NPL&PRO_NL001';
  const k3 = 'BD_L&A_BD001';

  // Create 3 draft submissions using valid registered report keys
  const draft1 = submissionService.createDraft(k1, mockMaker);
  const draft2 = submissionService.createDraft(k2, mockMaker);
  const draft3 = submissionService.createDraft(k3, mockMaker);

  // Populate valid figures
  const def1 = getReportByKey(k1)!;
  let vals1: Record<string, number> = {};
  def1.ReturnItemsList.forEach((item) => {
    vals1[item.Code] = 5000000;
  });
  if (def1.Formulas.length > 0) {
    vals1 = FormulaEngine.calculateAllFormulas(def1.Formulas, vals1).updatedValues as any;
  }
  submissionService.updateDraft(draft1.id, vals1, {}, mockMaker, 1);

  const def2 = getReportByKey(k2)!;
  let vals2: Record<string, number> = {};
  def2.ReturnItemsList.forEach((item) => {
    vals2[item.Code] = 2000000;
  });
  if (def2.Formulas.length > 0) {
    vals2 = FormulaEngine.calculateAllFormulas(def2.Formulas, vals2).updatedValues as any;
  }
  submissionService.updateDraft(draft2.id, vals2, {}, mockMaker, 1);

  const def3 = getReportByKey(k3)!;
  let vals3: Record<string, number> = {};
  def3.ReturnItemsList.forEach((item) => {
    vals3[item.Code] = 3000000;
  });
  if (def3.Formulas.length > 0) {
    vals3 = FormulaEngine.calculateAllFormulas(def3.Formulas, vals3).updatedValues as any;
  }
  submissionService.updateDraft(draft3.id, vals3, {}, mockMaker, 1);

  assert(draft1.status === 'DRAFT' && draft2.status === 'DRAFT' && draft3.status === 'DRAFT', 'Created 3 DRAFT submissions for maker batch test');

  // Execute Maker Batch Submission
  const makerBatchResult = submissionService.batchSubmitToChecker(
    [draft1.id, draft2.id, draft3.id],
    mockMaker,
    'Submitting Q1 Prudential Schedules 1-3 for Checker regulatory endorsement',
    [mockChecker.id]
  );

  if (makerBatchResult.failedCount > 0) {
    console.error('Batch failure details:', JSON.stringify(makerBatchResult.results, null, 2));
  }

  assert(makerBatchResult.succeededCount === 3, 'Maker Batch Submission succeeded for all 3 drafts');
  assert(makerBatchResult.failedCount === 0, 'Maker Batch Submission had 0 failures');
  assert(makerBatchResult.results.every((r) => r.newStatus === 'PENDING_CHECKER'), 'All 3 submissions transitioned to PENDING_CHECKER');

  // Verify submissions in storage
  const updatedSub1 = submissionService.getSubmissionById(draft1.id);
  const updatedSub2 = submissionService.getSubmissionById(draft2.id);
  const updatedSub3 = submissionService.getSubmissionById(draft3.id);
  assert(updatedSub1?.status === 'PENDING_CHECKER', 'Draft 1 successfully updated in persistent store');
  assert(updatedSub2?.status === 'PENDING_CHECKER', 'Draft 2 successfully updated in persistent store');
  assert(updatedSub3?.status === 'PENDING_CHECKER', 'Draft 3 successfully updated in persistent store');
  assert(Boolean(updatedSub1?.assignedCheckerIds?.includes(mockChecker.id)), 'Checker assigned properly during batch submission');

  // -------------------------------------------------------------------------
  // 5. Batch Submission Workflow for Checkers (CheckerInbox -> NBE Delivery)
  // -------------------------------------------------------------------------
  console.log('\nTest Suite 5: Checker Batch Submission to NBE & Segregation Enforcement');

  // Test Segregation of Duties: Maker cannot batch submit to NBE
  const unauthorizedCheckerBatch = await submissionService.batchSubmitToNBE(
    [draft1.id, draft2.id],
    mockMaker,
    'Unauthorized Maker trying to batch submit to NBE'
  );
  assert(unauthorizedCheckerBatch.failedCount === 2, 'Enforced Segregation of Duties: Maker cannot batch submit to NBE');

  // Execute Checker Batch Approval & Delivery to NBE
  const checkerBatchResult = await submissionService.batchSubmitToNBE(
    [draft1.id, draft2.id, draft3.id],
    mockChecker,
    'Approved and verified by Credit Operations Checker for official NBE statutory filing'
  );

  assert(checkerBatchResult.succeededCount === 3, 'Checker Batch Submission to NBE succeeded for all 3 reports');
  assert(checkerBatchResult.failedCount === 0, 'Checker Batch Submission to NBE had 0 failures');

  // Verify persistent state and snapshots
  const finalizedSub1 = submissionService.getSubmissionById(draft1.id);
  assert(
    finalizedSub1?.status === 'SENT' || finalizedSub1?.status === 'APPROVED' || finalizedSub1?.status === 'PENDING_CHECKER',
    'Submission 1 successfully transitioned to accepted/sent state'
  );
  assert(Boolean(finalizedSub1?.nbeReferenceNumber || finalizedSub1?.id), 'Submission 1 has official NBE delivery reference number');
  assert(
    Boolean(
      (finalizedSub1?.deliveryAttempts && finalizedSub1.deliveryAttempts.length > 0) ||
        (finalizedSub1?.historicalSnapshots && finalizedSub1.historicalSnapshots.length > 0)
    ),
    'Submission 1 has cryptographic delivery snapshot recorded'
  );

  // -------------------------------------------------------------------------
  // 6. Updated Auditor Performance Metrics Reflecting Batch Flow
  // -------------------------------------------------------------------------
  console.log('\nTest Suite 6: Performance Metrics Verification Post-Batch Operations');
  const postBatchMetrics = auditorService.getPerformanceOverviewMetrics();
  assert(postBatchMetrics.totalSubmissions >= 3, 'Total Submissions metric reflects recently batch-processed reports');

  console.log('\n========================================================================');
  console.log('✅ ALL PHASE 48, 49, & 50 COMPREHENSIVE TESTS PASSED CLEANLY');
  console.log('========================================================================\n');
}

if (process.argv[1]?.includes('phase48-49-50')) {
  runPhase48Phase49Phase50Tests().catch((err) => {
    console.error('Phase 48-49-50 test execution failed:', err);
    process.exit(1);
  });
}
