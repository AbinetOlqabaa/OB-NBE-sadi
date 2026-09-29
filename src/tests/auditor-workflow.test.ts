/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { auditorService } from '../services/auditorService.ts';
import { userService } from '../services/userService.ts';
import { submissionService } from '../services/submissionService.ts';
import { getAllReports } from '../data/report-registry.ts';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`  ✓ ${message}`);
  }
}

export async function runAuditorWorkflowTests(): Promise<void> {
  console.log('\n======================================================');
  console.log('--- 9. FIRST-CLASS AUDITOR ROLE & AUDIT WORKFLOW ---');
  console.log('======================================================');

  // -------------------------------------------------------------------
  // 1. Auditor Registration Request & Admin Approval Workflow
  // -------------------------------------------------------------------
  console.log('\n--- 1. Auditor Registration Request & Admin Approval ---');
  const regEmail = `auditor.test.${Date.now()}@oromiabank.com`;
  const regResult = userService.register({
    name: 'Abinet Alemu',
    email: regEmail,
    password: 'securePassword2026',
    role: 'AUDITOR',
    department: 'Internal Audit & Regulatory Control',
    employeeId: 'OB-AUD-7701',
    phoneNumber: '+251 91 100 2000',
    auditorJustification: 'Annual independent NBE Directive BSD/03/2020 regulatory compliance review.',
    auditScope: 'ALL_DEPARTMENTS',
  });

  assert(regResult.success, 'Auditor registration request submitted successfully');
  assert(Boolean(regResult.user), 'User object created for registered auditor');
  assert(regResult.user?.role === 'AUDITOR', 'Registered user role is strictly AUDITOR');
  assert(regResult.user?.status === 'PENDING_APPROVAL', 'Auditor initial status is PENDING_APPROVAL');
  assert(
    regResult.user?.auditorJustification?.includes('BSD/03/2020') || false,
    'Auditor justification recorded in profile'
  );
  assert(regResult.user?.auditScope === 'ALL_DEPARTMENTS', 'Auditor requested enterprise-wide scope recorded');

  // Admin approves auditor registration
  const authResult = userService.authorizeUser(regResult.user!.id, 'Admin Dawit Bekele');
  assert(authResult.success, 'Administrator authorizes auditor registration request');
  assert(authResult.user?.status === 'ACTIVE', 'Auditor status transitioned to ACTIVE upon admin authorization');
  assert(Boolean(authResult.user?.approvedAt), 'Auditor approval timestamp stamped');

  // -------------------------------------------------------------------
  // 2. Auditor Authentication & Dedicated Workspace Redirection
  // -------------------------------------------------------------------
  console.log('\n--- 2. Auditor Authentication & Redirection ---');
  const loginResult = userService.login(regEmail, 'securePassword2026');
  assert(loginResult.success, 'Auditor credentials authentication succeeds');
  assert(loginResult.user?.role === 'AUDITOR', 'Logged-in user role is AUDITOR');
  assert(
    loginResult.redirectTab === 'AUDITOR_DASHBOARD',
    'Auditor login automatically redirects to dedicated AUDITOR_DASHBOARD'
  );

  // -------------------------------------------------------------------
  // 3. Strict Segregation of Duties (Abinet Alemu Directive)
  // -------------------------------------------------------------------
  console.log('\n--- 3. Segregation of Duties Enforcement (Abinet Alemu Directive) ---');
  const activeAuditor = loginResult.user!;

  // Rule 1: Auditor cannot act as Maker (cannot create drafts or edit returns)
  const canMaker = userService.canMakerAccessReport(activeAuditor, 'ANARN001');
  assert(!canMaker, 'Auditor strictly prohibited from Maker drafting (canMakerAccessReport = false)');

  // Rule 2: Auditor cannot act as Checker (cannot sign off 4-eyes reviews)
  const checkerReviewCheck = userService.canCheckerReviewSubmission(activeAuditor, {
    reportKey: 'ANARN001',
    makerDepartment: 'Credit Operations & Portfolio Management',
  });
  assert(!checkerReviewCheck.allowed, 'Auditor strictly prohibited from Checker review sign-off');
  assert(
    checkerReviewCheck.reason?.includes('Auditor has independent supervisory oversight') || false,
    'Reason discloses supervisory oversight boundary'
  );

  // Rule 3: Auditor has enterprise-wide read access across all 24 statutory returns
  const allowedReports = userService.getAllowedReportKeysForUser(activeAuditor);
  const totalReportsCount = getAllReports().length;
  assert(
    allowedReports.length === totalReportsCount,
    `Auditor possesses read-only oversight across all ${totalReportsCount} statutory returns`
  );

  // -------------------------------------------------------------------
  // 4. Audit Work Queue & Aggregated KPI Metrics
  // -------------------------------------------------------------------
  console.log('\n--- 4. Audit Work Queue & Aggregated KPI Metrics ---');
  const workQueue = auditorService.getWorkQueue();
  assert(workQueue.length === totalReportsCount, `Work queue indexes all ${totalReportsCount} statutory returns`);

  const kpis = auditorService.getKpiSummary();
  assert(kpis.totalReportsInQueue === totalReportsCount, 'KPI summary reflects total reports count');
  assert(typeof kpis.totalOpenFindings === 'number', 'KPI tracks total open findings');
  assert(typeof kpis.criticalFindings === 'number', 'KPI tracks critical findings');
  assert(typeof kpis.complianceScore === 'number' && kpis.complianceScore >= 0 && kpis.complianceScore <= 100, 'Compliance score calculated between 0% and 100%');

  // Filter queue by department
  const creditQueue = auditorService.getWorkQueue({
    department: 'Credit Operations & Portfolio Management',
  });
  assert(creditQueue.length > 0, 'Queue filters by department successfully');
  assert(
    creditQueue.every((q) => q.department === 'Credit Operations & Portfolio Management'),
    'All returned queue items belong to target department'
  );

  // -------------------------------------------------------------------
  // 5. Deep Report Audit View
  // -------------------------------------------------------------------
  console.log('\n--- 5. Deep Report Audit Inspection ---');
  const inspection = auditorService.getReportAuditInspection('ANARN001');
  assert(inspection.reportKey === 'ANARN001', 'Report audit inspection resolved correct return key');
  assert(Boolean(inspection.reportDefinition), 'Statutory schema definition attached to inspection view');
  assert(Boolean(inspection.values), 'Field values bundle loaded for line-by-line inspection');
  assert(Array.isArray(inspection.findings), 'Related audit findings linked to report view');
  assert(Array.isArray(inspection.evidences), 'Related evidence records linked to report view');
  assert(Array.isArray(inspection.workingNotes), 'Confidential working notes linked to report view');

  // -------------------------------------------------------------------
  // 6. Audit Findings System & Severity/Status Lifecycle
  // -------------------------------------------------------------------
  console.log('\n--- 6. Audit Findings System & Severity Lifecycle ---');
  const initialFindingsCount = auditorService.getFindings().length;

  const newFinding = auditorService.createFinding({
    submissionId: 'sub_test_auditor_001',
    reportKey: 'ANARN001',
    department: 'Credit Operations & Portfolio Management',
    title: 'Discrepancy in Agricultural NPL Schedule 2 Provisioning',
    description: 'Calculated loan loss provision variance of 6.5M ETB against NBE Directive SBB/43/2008.',
    severity: 'HIGH',
    status: 'OPEN',
    regulatoryReference: 'NBE Directive SBB/43/2008 Art. 4.2',
    affectedField: 'TOTAL_PROVISIONS',
    financialVariance: 6500000,
    auditorId: activeAuditor.id,
    auditorName: activeAuditor.name,
  });

  assert(Boolean(newFinding.id), 'Audit finding created with authoritative ID');
  assert(newFinding.id.startsWith('FIND-'), 'Finding ID adheres to FIND-YYYYMMDD-XXXX convention');
  assert(newFinding.severity === 'HIGH', 'Severity assigned as HIGH');
  assert(newFinding.status === 'OPEN', 'Initial finding status is OPEN');
  assert(auditorService.getFindings().length === initialFindingsCount + 1, 'Findings list incremented');

  // Status transitions
  const updatedFinding = auditorService.updateFinding(newFinding.id, {
    status: 'REMEDIATION_PENDING',
  });
  assert(updatedFinding?.status === 'REMEDIATION_PENDING', 'Finding status transitioned to REMEDIATION_PENDING');

  // Filter findings by severity and status
  const highOpen = auditorService.getFindings({ severity: 'HIGH' });
  assert(highOpen.some((f) => f.id === newFinding.id), 'Finding retrieved by severity filter');

  // -------------------------------------------------------------------
  // 7. Evidence Management with SHA-256 Tamper Seals
  // -------------------------------------------------------------------
  console.log('\n--- 7. Evidence Management & Cryptographic Tamper Seals ---');
  const evidence = await auditorService.attachEvidence({
    submissionId: 'sub_test_auditor_001',
    reportKey: 'ANARN001',
    findingId: newFinding.id,
    title: 'Core Banking Loan Ledger Schedule Extract',
    fileName: 'cbs_anarn001_aging_extract.xlsx',
    fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    fileSizeBytes: 184500,
    sha256Checksum: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    verificationStatus: 'VERIFIED',
    uploadedBy: `${activeAuditor.name} (AUDITOR)`,
    notes: 'Verified directly from CBS replica server snapshot.',
  });

  assert(Boolean(evidence.id), 'Evidence record created with unique ID');
  assert(evidence.id.startsWith('EVID-'), 'Evidence ID adheres to EVID-XXXX convention');
  assert(evidence.tamperSeal.startsWith('OB-EVID-SEAL-'), 'Cryptographic tamper seal stamped on evidence');
  assert(evidence.verificationStatus === 'VERIFIED', 'Evidence status flagged as VERIFIED');

  const reportEvidence = auditorService.getEvidence('ANARN001');
  assert(reportEvidence.some((e) => e.id === evidence.id), 'Evidence retrieved by reportKey');

  // -------------------------------------------------------------------
  // 8. Confidential Auditor Working Papers & Notes
  // -------------------------------------------------------------------
  console.log('\n--- 8. Confidential Auditor Working Papers & Notes ---');
  const note = auditorService.addWorkingNote({
    submissionId: 'sub_test_auditor_001',
    reportKey: 'ANARN001',
    category: 'METHODOLOGY',
    authorId: activeAuditor.id,
    authorName: activeAuditor.name,
    content: 'Sampling methodology: 100% of loans with principal balance > 10,000,000 ETB inspected.',
    isPrivate: true,
  });

  assert(Boolean(note.id), 'Working note created with unique ID');
  assert(note.category === 'METHODOLOGY', 'Note category stored correctly');
  assert(note.isPrivate, 'Note flagged as private to audit inspection team');

  const notesList = auditorService.getWorkingNotes('ANARN001');
  assert(notesList.some((n) => n.id === note.id), 'Working note retrieved for inspected return');

  // -------------------------------------------------------------------
  // 9. Remediation Action Tracking & Auditor Verification
  // -------------------------------------------------------------------
  console.log('\n--- 9. Remediation Action Tracking & Verification ---');
  const remAction = auditorService.createRemediation({
    findingId: newFinding.id,
    actionPlan: 'Post CBS adjusting entry to credit provision expense and update sub-ledger classification.',
    assignedDepartment: 'Credit Operations & Portfolio Management',
    assignedTo: 'Dawit Bekele (MAKER)',
    targetDate: '2026-04-15',
    status: 'IN_PROGRESS',
    remediationProof: 'Journal voucher #889012 submitted for review.',
  });

  assert(Boolean(remAction.id), 'Remediation task created with unique ID');
  assert(remAction.status === 'IN_PROGRESS', 'Remediation status set to IN_PROGRESS');
  assert(remAction.assignedTo.includes('Dawit Bekele'), 'Remediation assigned to responsible Maker');

  // Auditor inspects proof and signs off
  const verifiedRem = auditorService.verifyRemediationByAuditor(
    remAction.id,
    activeAuditor.name,
    'Verified provision balance on General Ledger Account 1400201 in live CBS.'
  );

  assert(verifiedRem?.status === 'VERIFIED_BY_AUDITOR', 'Remediation status transitioned to VERIFIED_BY_AUDITOR');
  assert(verifiedRem?.verifiedBy === activeAuditor.name, 'Auditor sign-off recorded');
  assert(Boolean(verifiedRem?.verifiedAt), 'Auditor sign-off timestamp recorded');

  // Verify that finding is automatically resolved when all remediations are verified
  const resolvedFinding = auditorService.getFindings().find((f) => f.id === newFinding.id);
  assert(resolvedFinding?.status === 'RESOLVED', 'Finding automatically transitioned to RESOLVED after auditor verification');

  // -------------------------------------------------------------------
  // 10. Formal Statutory Audit Reports Generator & Sealed Export
  // -------------------------------------------------------------------
  console.log('\n--- 10. Formal Audit Reports Generator & Export ---');
  const reportPkg = auditorService.generateAuditReport({
    period: 'Q1 2026',
    scopeDepartments: ['Credit Operations', 'Risk Management', 'International Banking'],
    generatedBy: activeAuditor.name,
  });

  assert(Boolean(reportPkg.id), 'Audit report package compiled with unique ID');
  assert(reportPkg.tamperSeal.startsWith('OB-AUD-SEAL-'), 'Official Oromia Bank tamper seal generated');
  assert(reportPkg.findingsCount > 0, 'Report captures findings count');
  assert(reportPkg.period === 'Q1 2026', 'Report period matches Q1 2026');

  // JSON Export verification
  const jsonExport = auditorService.exportAuditReportJson(reportPkg);
  const parsedExport = JSON.parse(jsonExport);
  assert(parsedExport.institutionCode === '0000013', 'Export metadata contains Institution Code 0000013');
  assert(parsedExport.cryptographicTamperSeal === reportPkg.tamperSeal, 'Export seal matches report package seal');
  assert(Array.isArray(parsedExport.findings), 'Export bundles findings array');
  assert(Array.isArray(parsedExport.remediations), 'Export bundles remediations array');

  console.log('\n✓ All First-Class Auditor Role & Audit Workflow tests passed successfully.');
}
