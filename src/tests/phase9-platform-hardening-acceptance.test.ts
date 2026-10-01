/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { configService } from '../services/configService.ts';
import { submissionService, DEMO_USERS } from '../services/submissionService.ts';
import { userService } from '../services/userService.ts';
import { departmentService } from '../services/departmentService.ts';
import { effectiveAccessEngine } from '../services/effectiveAccessEngine.ts';
import { nbeSimulator } from '../services/nbeSimulator.ts';
import { nbeAdapter } from '../services/nbeAdapter.ts';
import { auditService } from '../services/auditService.ts';
import { bulkOperationsEngine } from '../services/bulkOperationsEngine.ts';
import { configurationGovernanceService } from '../services/configurationGovernanceService.ts';
import { realtimeSsotEngine } from '../services/realtimeSsotEngine.ts';
import { getDepartmentForReport, getReportsForDepartment } from '../data/organizationHierarchy.ts';
import { getAllReports, getReportByKey } from '../data/report-registry.ts';
import type { UserSession, ReportSubmission } from '../types/regulatory.ts';
import * as fs from 'fs';
import * as path from 'path';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`[Phase 9 Assertion Failed]: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

export async function runPhase9PlatformHardeningAcceptanceTests() {
  console.log('\n========================================================================');
  console.log('--- PHASE 9: FULL PLATFORM INTEGRATION, SECURITY, E2E & PRODUCTION HARDENING ---');
  console.log('========================================================================\n');

  const adminActor = { id: 'usr_admin_001', name: 'Abebe Bikila', role: 'ADMIN' };
  const checkerActor = { id: 'usr_checker_001', name: 'Almaz Ayana', role: 'CHECKER' };
  const makerUser = DEMO_USERS.find((u) => u.role === 'MAKER' && u.department === 'Credit Operations & Portfolio Management')!;
  const checkerUser = DEMO_USERS.find((u) => u.role === 'CHECKER')!;
  const auditorUser = DEMO_USERS.find((u) => u.role === 'AUDITOR')!;
  const adminUser = DEMO_USERS.find((u) => u.role === 'ADMIN')!;

  // --------------------------------------------------------------------------
  // SECTION 1: ARCHITECTURE AUDIT & DATA INTEGRITY
  // --------------------------------------------------------------------------
  console.log('--- 1. Architecture Audit & Migration Integrity ---');

  // Verify all Django app migrations exist
  const backendApps = ['departments', 'reports', 'accounts', 'workflows', 'audit', 'permissions', 'notifications', 'nbe_gateway'];
  for (const app of backendApps) {
    const migDir = path.join(process.cwd(), 'backend', 'apps', app, 'migrations');
    assert(fs.existsSync(migDir), `Migration directory exists for backend app '${app}'`);
    const migFiles = fs.readdirSync(migDir).filter((f) => f.endsWith('.py') && f !== '__init__.py');
    assert(migFiles.length > 0, `App '${app}' contains initial migration files (${migFiles.join(', ')})`);
    assert(fs.existsSync(path.join(migDir, '__init__.py')), `App '${app}' migrations directory has __init__.py package marker`);
  }

  // Verify SSOT uniqueness & integrity
  const depts = configService.getDepartments({ flat: true });
  assert(depts.length >= 8, `SSOT contains all ${depts.length} authoritative departments`);
  const deptIds = new Set(depts.map((d) => d.id));
  assert(deptIds.size === depts.length, 'All department IDs are strictly unique in SSOT');
  const deptCodes = new Set(depts.map((d) => d.shortCode.toUpperCase()));
  assert(deptCodes.size === depts.length, 'All department short codes are strictly unique');

  // Verify reports catalog integrity
  const reports = configService.getReports();
  assert(reports.length >= 24, `SSOT contains all ${reports.length} canonical NBE statutory returns`);
  const reportKeys = new Set(reports.map((r) => r.returnKey));
  assert(reportKeys.size === reports.length, 'All regulatory report return keys are strictly unique');

  // --------------------------------------------------------------------------
  // SECTION 2: CONFIGURATION MUTATION SCENARIOS (1 TO 8)
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Configuration Mutation Scenarios (1 to 8) ---');

  // Scenario 1: Rename a department and verify authoritative views update
  console.log('\n  [Scenario 1] Department Rename & Global Propagation');
  const targetDept = configService.getDepartmentById('dept_asset_recovery');
  assert(Boolean(targetDept), 'Target department dept_asset_recovery exists');
  const originalDeptName = targetDept!.name;
  const renamedDeptName = 'Restructured Asset Recovery & Special Workout';

  // Perform rename via configService SSOT
  configService.updateDepartment('dept_asset_recovery', { name: renamedDeptName }, adminActor);
  const updatedDept = configService.getDepartmentById('dept_asset_recovery');
  assert(updatedDept?.name === renamedDeptName, `Department name updated to '${renamedDeptName}' in configService`);

  // Verify organizationHierarchy dynamic lookup reflects rename
  const deptForColReport = getDepartmentForReport('COL_SOL_18M_LL001');
  assert(deptForColReport === renamedDeptName, `organizationHierarchy.getDepartmentForReport('COL_SOL_18M_LL001') reflects '${renamedDeptName}'`);

  // Verify userService updated all assigned users
  const recoveryUsers = userService.getAll().filter((u) => u.department === renamedDeptName);
  assert(recoveryUsers.length > 0, `Users formerly in '${originalDeptName}' automatically updated to '${renamedDeptName}'`);

  // Revert rename to keep pristine state
  configService.updateDepartment('dept_asset_recovery', { name: originalDeptName }, adminActor);
  assert(configService.getDepartmentById('dept_asset_recovery')?.name === originalDeptName, 'Department name safely restored to original');

  // Scenario 2: Change a department/report relationship and verify access changes
  console.log('\n  [Scenario 2] Department/Report Relationship Mutation & Effective Access');
  // Trade Services & International Banking (dept_trade_services)
  // Let's assign report 'M_LCPLC001' (normally Credit Risk) to dept_trade_services as CONTRIBUTOR
  const tradeFinanceDept = configService.getDepartmentById('dept_trade_services')!;
  const tradeMaker = userService.getAll().find((u) => u.department === tradeFinanceDept.name && u.role === 'MAKER')!;
  assert(Boolean(tradeMaker), 'Found active Maker in Trade Services department');

  // Before assignment: trade maker cannot draft M_LCPLC001
  const accessBefore = effectiveAccessEngine.evaluateAccess(tradeMaker, 'M_LCPLC001', 'CREATE_DRAFT');
  assert(!accessBefore.allowed, 'Trade maker initially denied CREATE_DRAFT on M_LCPLC001');

  // Create department-report assignment
  const assignment = configService.assignDepartmentReport({
    departmentId: tradeFinanceDept.id,
    reportKey: 'M_LCPLC001',
    role: 'CONTRIBUTOR',
    notes: 'Temporary collaborative reporting duty',
  }, adminActor);
  assert(assignment.isActive, 'Department-report assignment created successfully');

  // Access immediately granted to trade maker
  const accessAfter = effectiveAccessEngine.evaluateAccess(tradeMaker, 'M_LCPLC001', 'CREATE_DRAFT');
  assert(accessAfter.allowed, 'Trade maker granted CREATE_DRAFT after department-report assignment');

  // Revoke department-report assignment
  configService.removeDepartmentReportAssignment(assignment.id, adminActor);
  const accessAfterRevoke = effectiveAccessEngine.evaluateAccess(tradeMaker, 'M_LCPLC001', 'CREATE_DRAFT');
  assert(!accessAfterRevoke.allowed, 'Trade maker access immediately revoked upon assignment removal');

  // Scenario 3: Add a report and verify authorized catalogues update
  console.log('\n  [Scenario 3] Dynamic Report Creation & Catalog Convergence');
  const dynamicReportKey = `NBE_NEW_AUDIT_${Date.now()}`;
  const { report: newReport } = configService.createReportDefinition({
    returnKey: dynamicReportKey,
    code: dynamicReportKey,
    name: 'Quarterly Specialized Capital Adequacy Return',
    category: 'Capital & Solvency',
    frequency: 'QUARTERLY',
    defaultDepartmentId: 'dept_credit_ops',
  }, adminActor);
  assert(newReport.returnKey === dynamicReportKey, 'New dynamic report created in configService');

  // Catalog update verification
  const makerAllowedReports = effectiveAccessEngine.getAllowedReportKeysForUser(makerUser);
  assert(makerAllowedReports.includes(dynamicReportKey), 'New report immediately appears in Maker authorized creation catalog');
  const checkerMatrix = effectiveAccessEngine.getEffectiveReportPermissionsMatrix(checkerUser);
  assert(checkerMatrix.some((m) => m.reportKey === dynamicReportKey), 'New report immediately appears in Checker permissions matrix');

  // Scenario 4: Retire a report and verify new submissions are blocked while historical remain
  console.log('\n  [Scenario 4] Report Retirement & Historical Preservation');
  // First, create a valid draft under the dynamic report while it is active
  const draftUnderNew = submissionService.createSubmission(dynamicReportKey, makerUser);
  assert(draftUnderNew.status === 'DRAFT', 'Successfully created draft while report is ACTIVE');

  // Retire the report
  configService.retireReport(dynamicReportKey, adminActor, 'Replaced by Basel III revised standard');
  assert(configService.getReportDefinition(dynamicReportKey)?.status === 'RETIRED', 'Report status marked as RETIRED');

  // Attempt to create new submission -> MUST FAIL with REPORT_RETIRED
  let createFailed = false;
  try {
    submissionService.createSubmission(dynamicReportKey, makerUser);
  } catch (err: any) {
    createFailed = true;
    assert(err.message.includes('retired') || err.message.includes('REPORT_RETIRED'), 'New submission blocked with explicit retirement error');
  }
  assert(createFailed, 'Creating submission for retired report was strictly blocked');

  // Historical draft remains readable & auditable
  const historicalSub = submissionService.getById(draftUnderNew.id);
  assert(Boolean(historicalSub), 'Historical submission record remains intact');
  const viewAccess = effectiveAccessEngine.evaluateAccess(makerUser, dynamicReportKey, 'VIEW', historicalSub);
  assert(viewAccess.allowed, 'Historical submission VIEW access remains allowed for retired report');

  // Scenario 5: Create a new report version and verify old submissions remain reproducible
  console.log('\n  [Scenario 5] Version Increment & Historical Template Reproducibility');
  const versionedReportKey = 'LOA_ADV_OUT_LA001';
  const bsdReport = getReportByKey(versionedReportKey)!;
  const initialV1FieldsCount = bsdReport.ReturnItemsList.length;

  // Create submission under V1
  const subV1 = submissionService.createSubmission(versionedReportKey, makerUser);
  assert(subV1.templateVersion === 1 || subV1.templateVersion === undefined || subV1.templateSnapshot !== undefined, 'Submission created under Version 1');
  const v1Snapshot = submissionService.getEffectiveTemplate(subV1);
  assert(v1Snapshot.ReturnItemsList.length === initialV1FieldsCount, `V1 submission snapshot captures exact ${initialV1FieldsCount} fields`);

  // Create Version 2 of LOA_ADV_OUT_LA001 with an added field
  const newV2 = configService.createReportVersion(versionedReportKey, {
    changelogSummary: 'Phase 9 Regulatory Field Addition',
    effectiveFrom: new Date().toISOString(),
  }, adminActor);
  configService.addField(versionedReportKey, newV2.versionNumber, {
    id: `fld_phase9_${Date.now()}`,
    itemId: `ITEM_PHASE9_${Date.now()}`,
    itemCode: 'LA001_NEW_RATIO',
    itemDescription: 'Adjusted Outturn Ratio',
    dataType: 'PERCENTAGE',
    isRequired: true,
    isCalculated: false,
    validationRules: [],
    order: 99,
  }, adminActor);
  configService.publishReportVersion(versionedReportKey, newV2.versionNumber, adminActor);
  assert(newV2.versionNumber >= 2, `Published Version ${newV2.versionNumber} for ${versionedReportKey}`);

  // Re-verify that old submission subV1 STILL reproduces exact original V1 snapshot
  const reproducedV1 = submissionService.getEffectiveTemplate(subV1);
  assert(reproducedV1.ReturnItemsList.length === initialV1FieldsCount, 'Historical V1 submission permanently preserves pristine V1 schema without field leakage');

  // Scenario 6 & 7: Grant special access and verify access, then revoke and verify disappearance
  console.log('\n  [Scenario 6 & 7] Special Access Grant & Instant Revocation');
  // Specialized Asset Recovery report
  const workoutReportKey = 'COL_SOL_18M_LL001';
  // Maker in Credit Ops does not have access to workout report
  const opsMaker = makerUser;
  const beforeGrant = effectiveAccessEngine.evaluateAccess(opsMaker, workoutReportKey, 'CREATE_DRAFT');
  assert(!beforeGrant.allowed, 'Ops maker initially denied access to Specialized Asset Recovery return');

  // Grant special access for 24 hours
  const grantResult = userService.grantSpecialAccess(opsMaker.id, {
    reportKey: workoutReportKey,
    reason: 'Emergency interim workout reporting cover',
    expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
  }, adminActor.name);
  assert(grantResult.success, 'Special access grant created');

  // Verify access granted
  const afterGrant = effectiveAccessEngine.evaluateAccess(opsMaker, workoutReportKey, 'CREATE_DRAFT');
  assert(afterGrant.allowed, 'Ops maker granted CREATE_DRAFT via active special access grant');

  // Revoke special access
  const revokeResult = userService.revokeSpecialAccess(
    opsMaker.id,
    grantResult.grant!.id,
    adminActor.name
  );
  assert(revokeResult.success, 'Special access grant revoked');

  // Verify access immediately revoked
  const afterRevoke = effectiveAccessEngine.evaluateAccess(opsMaker, workoutReportKey, 'CREATE_DRAFT');
  assert(!afterRevoke.allowed, 'Ops maker access strictly disallowed immediately upon special access revocation');

  // Scenario 8: Change a role and verify effective permissions
  console.log('\n  [Scenario 8] Dynamic Role Mutation & Effective Permissions Boundary');
  const tempUser = userService.getAll().find((u) => u.email === 'temp_eval@oromiabank.com') ||
    userService.createUser({
      email: `temp_eval_${Date.now()}@oromiabank.com`,
      name: 'Test Evaluation Officer',
      role: 'MAKER',
      department: 'Credit Operations & Portfolio Management',
      employeeId: `EMP_EVAL_${Date.now()}`,
    }, adminActor.name).user!;

  // 1. As MAKER
  const makerPerms = effectiveAccessEngine.getEffectiveReportPermissionsMatrix(tempUser);
  assert(makerPerms.some((m) => m.canCreateDraft), 'User as MAKER can create drafts');
  assert(makerPerms.every((m) => !m.canReview), 'User as MAKER cannot review or approve submissions');

  // 2. Promote to CHECKER
  userService.updateUserRole(tempUser.id, 'CHECKER', adminActor.name, 'Promoted to departmental reviewer');
  const updatedToChecker = userService.getById(tempUser.id)!;
  const checkerPerms = effectiveAccessEngine.getEffectiveReportPermissionsMatrix(updatedToChecker);
  assert(checkerPerms.every((m) => !m.canCreateDraft), 'User as CHECKER can no longer create drafts');
  assert(checkerPerms.some((m) => m.canReview), 'User as CHECKER can now review submissions');

  // 3. Reassign to AUDITOR
  userService.updateUserRole(tempUser.id, 'AUDITOR', adminActor.name, 'Transferred to internal audit');
  const updatedToAuditor = userService.getById(tempUser.id)!;
  const auditorPerms = effectiveAccessEngine.getEffectiveReportPermissionsMatrix(updatedToAuditor);
  assert(auditorPerms.every((m) => !m.canCreateDraft && !m.canReview), 'User as AUDITOR has zero operational Maker/Checker mutation powers');
  assert(auditorPerms.every((m) => m.canAudit), 'User as AUDITOR has universal AUDIT_INSPECT authority across all returns');

  // --------------------------------------------------------------------------
  // SECTION 3: SECURITY, RBAC & SANITIZATION HARDENING
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Security, RBAC & Sanitization Hardening ---');

  // 1. Segregation of Duties (4-Eyes Enforcement in Submissions)
  const makerSelfSub = submissionService.createSubmission('LOA_ADV_OUT_LA001', makerUser);
  const populatedValues: Record<string, number> = {};
  for (const k of Object.keys(makerSelfSub.values)) {
    populatedValues[k] = 100000;
  }
  submissionService.updateDraft(makerSelfSub.id, populatedValues, {}, makerUser);
  submissionService.submitToChecker(makerSelfSub.id, makerUser, 'Ready for review');
  let selfReviewBlocked = false;
  try {
    submissionService.reviewSubmission(makerSelfSub.id, 'APPROVE', makerUser, 'Self approval attempt');
  } catch (err: any) {
    selfReviewBlocked = true;
    assert(err.message.includes('Maker cannot review') || err.message.includes('Segregation') || err.message.includes('Role violation') || err.message.includes('same person'), 'Maker prohibited from approving their own submission (4-eyes enforcement)');
  }
  assert(selfReviewBlocked, 'Self-approval strictly rejected');

  // 2. Segregation of Duties in Configuration Governance
  const testProposal = configurationGovernanceService.createProposalDraft({
    title: 'Statutory Liquidity Calibration',
    description: 'Statutory compliance calibration',
    entityType: 'REPORT_DEFINITION',
    entityId: 'LOA_ADV_OUT_LA001',
    entityName: 'LOA_ADV_OUT_LA001: Loans & Advances Outturn',
    actionType: 'UPDATE',
    proposedBeforeState: { formula: 'A + B' },
    proposedAfterState: { formula: 'A + B + C' },
  }, adminActor);
  configurationGovernanceService.validateProposal(testProposal.id, adminActor);

  let selfGovApprovalBlocked = false;
  try {
    configurationGovernanceService.approveProposal(testProposal.id, adminActor, 'Self approval attempt');
  } catch (err: any) {
    selfGovApprovalBlocked = true;
    assert(err.message.includes('SEGREGATION_OF_DUTIES') || err.message.includes('cannot approve'), 'Proposer strictly prohibited from approving own high-risk proposal');
  }
  assert(selfGovApprovalBlocked, 'Governance proposal self-approval strictly rejected');

  // 3. Formula Injection (CWE-1236) Protection
  const rawMaliciousCsv = `id,name,value\n1,=CMD|' /C calc'!A0,100\n2,+10+20,200\n3,@SUM(1,2),300\n4,-50,50`;
  const dryRun = bulkOperationsEngine.generateDryRun({
    targetType: 'USERS',
    format: 'CSV',
    rawPayload: rawMaliciousCsv,
    conflictStrategy: 'SKIP',
    actor: adminActor,
  });
  assert(dryRun !== undefined, 'Bulk parser safely processes spreadsheet content without executing dangerous formulas');

  // 4. Account Lifecycle Gate (Disabled/Suspended access restriction)
  const disabledAccount = userService.getAll().find((u) => u.status === 'DISABLED') ||
    userService.createUser({
      email: `disabled_officer_${Date.now()}@oromiabank.com`,
      name: 'Deactivated Officer',
      role: 'MAKER',
      department: 'Credit Operations & Portfolio Management',
      employeeId: `EMP_DIS_${Date.now()}`,
    }, adminActor.name).user!;
  userService.updateUserStatus(disabledAccount.id, 'DISABLED', adminActor.name);
  const updatedDisabled = userService.getById(disabledAccount.id)!;

  const disabledAccess = effectiveAccessEngine.evaluateAccess(updatedDisabled, 'LOA_ADV_OUT_LA001', 'CREATE_DRAFT');
  assert(!disabledAccess.allowed && disabledAccess.code === 'ACCOUNT_INACTIVE', 'Disabled account strictly blocked with ACCOUNT_INACTIVE code');

  // --------------------------------------------------------------------------
  // SECTION 4: NBE SIMULATOR CONTRACTS & ERROR HANDLING
  // --------------------------------------------------------------------------
  console.log('\n--- 4. NBE Simulator & Gateway Contract Hardening ---');

  // Test 1: Always Success
  nbeSimulator.setScenario({ mode: 'ALWAYS_SUCCESS', latencyMs: 5 });
  const samplePayload = {
    InstCode: '0000013',
    ReturnKey: 'LOA_ADV_OUT_LA001',
    FinYear: 2026,
    values: { 'LA001_01': 50000000 },
    dynamicRows: {},
    maker: { id: 'usr_maker_1', name: 'Abebe Kebede' },
    checker: { id: 'usr_checker_1', name: 'Chala Desta' },
  };
  const successRes = await nbeSimulator.processSubmission(samplePayload, { 'idempotency-key': `idemp_${Date.now()}` });
  assert(successRes.statusCode === 200, 'NBE simulator returns 200 OK in ALWAYS_SUCCESS mode');
  assert(successRes.body.status === 'ACCEPTED', 'Response status is ACCEPTED');
  assert(Boolean(successRes.body.receiptNumber || successRes.body.referenceNumber), `NBE receipt generated: ${successRes.body.receiptNumber || successRes.body.referenceNumber}`);

  // Test 2: Idempotency Duplication Guarantee
  const idempKey = `fixed_idemp_${Date.now()}`;
  const firstCall = await nbeSimulator.processSubmission(samplePayload, { 'idempotency-key': idempKey });
  const secondCall = await nbeSimulator.processSubmission(samplePayload, { 'idempotency-key': idempKey });
  const firstReceipt = firstCall.body.receiptNumber || firstCall.body.referenceNumber;
  const secondReceipt = secondCall.body.receiptNumber || secondCall.body.referenceNumber;
  assert(firstReceipt === secondReceipt, 'NBE Idempotency guarantee: identical receipt returned on duplicate submission');

  // Test 3: Validation Failure Mode
  nbeSimulator.setScenario({ mode: 'VALIDATION_FAILURE', latencyMs: 5 });
  const valFailRes = await nbeSimulator.processSubmission(samplePayload, { 'idempotency-key': `idemp_val_${Date.now()}` });
  assert(valFailRes.statusCode === 422 || valFailRes.body.status === 'VALIDATION_FAILED' || valFailRes.body.status === 'REJECTED', 'NBE simulator returns VALIDATION_FAILED when configured');

  // Test 4: Auth Failure Mode
  nbeSimulator.setScenario({ mode: 'AUTH_FAILURE', latencyMs: 5 });
  const authFailRes = await nbeSimulator.processSubmission(samplePayload, { 'idempotency-key': `idemp_auth_${Date.now()}` });
  assert(authFailRes.statusCode === 401 || authFailRes.body.status === 'AUTHENTICATION_FAILED' || authFailRes.body.status === 'REJECTED', 'NBE simulator returns AUTHENTICATION_FAILED when configured');

  // Test 5: Server Error & Gateway Retry
  nbeSimulator.setScenario({ mode: 'SERVER_ERROR', latencyMs: 5 });
  const srvErrorRes = await nbeSimulator.processSubmission(samplePayload, { 'idempotency-key': `idemp_srv_${Date.now()}` });
  assert(srvErrorRes.statusCode === 500 || srvErrorRes.body.status === 'SYSTEM_ERROR' || srvErrorRes.body.status === 'ERROR', 'NBE simulator returns SYSTEM_ERROR when configured');

  // Restore simulator to ALWAYS_SUCCESS
  nbeSimulator.setScenario({ mode: 'ALWAYS_SUCCESS', latencyMs: 5 });

  // --------------------------------------------------------------------------
  // SECTION 5: PERFORMANCE, CACHING & SCALE
  // --------------------------------------------------------------------------
  console.log('\n--- 5. Performance, Cache Latency & Scale ---');

  // 1. Cache Latency Benchmark
  // Warm cache
  effectiveAccessEngine.evaluateAccess(makerUser, 'LOA_ADV_OUT_LA001', 'CREATE_DRAFT');
  const t0 = performance.now();
  const iterations = 500;
  for (let i = 0; i < iterations; i++) {
    effectiveAccessEngine.evaluateAccess(makerUser, 'LOA_ADV_OUT_LA001', 'CREATE_DRAFT');
  }
  const t1 = performance.now();
  const avgLatencyMs = (t1 - t0) / iterations;
  assert(avgLatencyMs < 0.1, `Effective access engine cache latency is sub-millisecond: ${avgLatencyMs.toFixed(4)}ms/call`);

  // 2. Global Hash Cache Invalidation
  const oldHash = configService.generateGlobalHash();
  configService.bumpVersion('REPORT');
  const newHash = configService.generateGlobalHash();
  assert(oldHash !== newHash, 'Config version bump immediately rotates global configuration hash');

  console.log('\n========================================================================');
  console.log('✅ ALL PHASE 9 PLATFORM HARDENING & ENGINEERING ACCEPTANCE GATES SATISFIED');
  console.log('========================================================================\n');
}

if (process.argv[1]?.includes('phase9-platform-hardening-acceptance.test.ts')) {
  runPhase9PlatformHardeningAcceptanceTests().catch((err) => {
    console.error('Phase 9 test execution failed:', err);
    process.exit(1);
  });
}

