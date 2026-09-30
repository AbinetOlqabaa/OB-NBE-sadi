/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { configService } from '../services/configService.ts';
import { submissionService, DEMO_USERS } from '../services/submissionService.ts';
import { userService } from '../services/userService.ts';

export async function runPhase2ConfigurationSSOTTests(): Promise<void> {
  console.log('\n========================================================================');
  console.log('--- PHASE 2: DYNAMIC CONFIGURATION & SSOT FOUNDATION TESTS ---');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✓ ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  // --------------------------------------------------------------------------
  // TEST 1: Department Hierarchy & Tree Traversal
  // --------------------------------------------------------------------------
  console.log('--- 1. Department Hierarchy & Organizational Agility ---');

  const deptTree = configService.getDepartments();
  assert(deptTree.length > 0, 'Department hierarchy tree loaded with root divisions');

  const divisions = deptTree.filter((d) => d.hierarchyLevel === 0);
  assert(divisions.length >= 4, `At least 4 top-level Divisions exist (found ${divisions.length})`);

  const flatDepts = configService.getDepartments({ flat: true });
  assert(flatDepts.length >= 12, `Total departments and divisions is at least 12 (found ${flatDepts.length})`);

  const creditOps = configService.getDepartmentById('dept_credit_ops');
  assert(creditOps !== null, 'Credit Operations department exists');
  assert(creditOps?.hierarchyLevel === 1, 'Credit Operations is at hierarchy level 1');
  assert(creditOps?.parentId === 'div_credit_risk', 'Credit Operations parent is Credit & Risk Management Division');
  assert(creditOps?.path.includes('/div_credit_risk/dept_credit_ops') === true, 'Path reflects hierarchy traversal');

  const ancestors = configService.getDepartmentAncestors('dept_credit_ops');
  assert(ancestors.length === 1 && ancestors[0].id === 'div_credit_risk', 'Ancestors correctly identify div_credit_risk');

  const descendants = configService.getDepartmentDescendants('div_credit_risk');
  assert(
    descendants.some((d) => d.id === 'dept_credit_ops') && descendants.some((d) => d.id === 'dept_credit_risk'),
    'Descendants correctly identify child departments under Credit & Risk Division'
  );

  // Test dynamic creation of a sub-unit (Level 2)
  const testSubUnit = configService.createDepartment(
    {
      name: 'Specialized SME Lending Section',
      shortCode: 'SME_SEC',
      division: 'Banking Operations',
      parentId: 'dept_credit_ops',
      primaryResponsibilities: ['SME Loan Underwriting', 'Collateral Valuation Review'],
    },
    { id: 'usr_admin', name: 'Compliance Admin', role: 'ADMIN' }
  );

  assert(testSubUnit.hierarchyLevel === 2, 'Sub-unit created at hierarchy level 2');
  assert(testSubUnit.path.includes('dept_credit_ops/dept_sme_sec'), 'Sub-unit path correctly chains ancestors');

  // Test circular reference rejection
  let circularRejected = false;
  try {
    configService.updateDepartment(
      'dept_credit_ops',
      { parentId: testSubUnit.id },
      { id: 'usr_admin', name: 'Admin', role: 'ADMIN' }
    );
  } catch (err: any) {
    circularRejected = err.message.includes('descendant');
  }
  assert(circularRejected, 'Prevented circular hierarchy: cannot assign descendant as parent');

  // --------------------------------------------------------------------------
  // TEST 2: Report Metadata & Schema Breakdown
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Report Metadata Foundation & Schema Breakdown ---');

  const allReports = configService.getReports();
  assert(allReports.length >= 24, `All 24 canonical statutory returns ingested as SSOT (found ${allReports.length})`);

  const lcplc = configService.getReportDefinition('M_LCPLC001');
  assert(lcplc !== null, 'Report definition for M_LCPLC001 exists');
  assert(lcplc?.frequency === 'MONTHLY', 'Frequency correctly mapped to MONTHLY');
  assert(lcplc?.status === 'ACTIVE', 'Report status is ACTIVE');
  assert(lcplc?.instCode === '0000013', 'InstCode is authoritative Oromia Bank 0000013');

  const snapshot = lcplc?.activeVersionSnapshot;
  assert(snapshot !== null && snapshot !== undefined, 'Active version snapshot attached to definition');
  assert((snapshot?.fields.length || 0) > 0, `Fields defined in metadata (found ${snapshot?.fields.length})`);

  const calculatedField = snapshot?.fields.find((f) => f.isCalculated);
  assert(calculatedField !== undefined, 'Calculated fields identified with formulas');

  // Dynamic area support
  const dynamicReport = configService.getReportDefinition('TOP_20_BOR_TB001');
  assert(dynamicReport !== null, 'Schedule TOP_20_BOR_TB001 exists');
  assert((dynamicReport?.activeVersionSnapshot?.columns.length || 0) > 0, 'Schedule columns modeled in metadata SSOT');

  // --------------------------------------------------------------------------
  // TEST 3: Versioning Foundation & Historical Integrity
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Versioning Foundation & Historical Non-Destruction ---');

  // Step A: Create a submission under Version 1 (using an authorized maker for M_LCPLC001)
  const creditRiskMaker = {
    ...DEMO_USERS[0],
    id: 'usr_maker_credit_risk',
    department: 'Credit Risk & Prudential Reporting',
  };
  const submissionV1 = submissionService.createSubmission('M_LCPLC001', creditRiskMaker);
  assert(submissionV1.version === 1, 'Initial submission created with version 1');

  // Step B: Bump report to Version 2 with modified metadata
  const newVersion = configService.createReportVersion(
    'M_LCPLC001',
    {
      changelogSummary: 'Circular BSD/08/2026: Updated impaired loan classification thresholds',
      effectiveFrom: '2026-10-01T00:00:00Z',
    },
    { id: 'usr_admin', name: 'Compliance Admin', role: 'ADMIN' }
  );

  assert(newVersion.versionNumber === 2, 'New version number incremented to 2');
  assert(newVersion.status === 'ACTIVE', 'New version status is ACTIVE');

  const updatedDef = configService.getReportDefinition('M_LCPLC001');
  assert(updatedDef?.currentVersion === 2, 'Report definition currentVersion pointer updated to 2');

  const allVersions = configService.getReportVersions('M_LCPLC001');
  assert(allVersions.length === 2, 'Report now contains exactly 2 versions');

  const v1Record = allVersions.find((v) => v.versionNumber === 1);
  assert(v1Record?.status === 'SUPERSEDED', 'Version 1 marked as SUPERSEDED');

  // Step C: Verify Historical Integrity - Submission V1 is completely intact!
  const fetchedSub = submissionService.getById(submissionV1.id);
  assert(fetchedSub !== null, 'Historical submission exists');
  assert(fetchedSub?.version === 1, 'Historical submission remains permanently pinned to Version 1');
  assert(
    fetchedSub?.reportKey === 'M_LCPLC001',
    'Historical submission continues to reference M_LCPLC001 without data loss'
  );

  // --------------------------------------------------------------------------
  // TEST 4: Explicit Relationship Models
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Explicit Relationship Models & Auditable Assignments ---');

  const deptAssignments = configService.getDepartmentReportAssignments({ reportKey: 'M_LCPLC001' });
  assert(deptAssignments.length > 0, 'Department assignments found for M_LCPLC001');
  assert(deptAssignments[0].role === 'PRIMARY_OWNER', 'Primary owner role established for department');

  // Add contributor assignment
  const contributor = configService.assignDepartmentReport(
    {
      departmentId: 'dept_asset_recovery',
      reportKey: 'M_LCPLC001',
      role: 'CONTRIBUTOR',
      notes: 'Asset recovery contributes collateral liquidation values',
    },
    { id: 'usr_admin', name: 'Compliance Admin', role: 'ADMIN' }
  );
  assert(contributor.role === 'CONTRIBUTOR', 'Explicit CONTRIBUTOR relationship added');

  // Assign user duty
  const userAsgn = configService.assignUserReport(
    {
      userId: 'usr_maker_1',
      userEmail: 'maker.credit@oromiabank.com',
      userName: 'Chala Bekele',
      reportKey: 'M_LCPLC001',
      departmentId: 'dept_credit_ops',
      duty: 'MAKER',
    },
    { id: 'usr_admin', name: 'Compliance Admin', role: 'ADMIN' }
  );
  assert(userAsgn.duty === 'MAKER', 'Explicit UserReportAssignment established for MAKER');

  // Remove assignment
  const removed = configService.removeDepartmentReportAssignment(contributor.id, {
    id: 'usr_admin',
    name: 'Compliance Admin',
    role: 'ADMIN',
  });
  assert(removed === true, 'Explicit DepartmentReportAssignment revoked cleanly');

  // --------------------------------------------------------------------------
  // TEST 5: Dynamic Authorization Matrix
  // --------------------------------------------------------------------------
  console.log('\n--- 5. Dynamic Authorization Matrix & Boundaries ---');

  // Maker in Credit Ops
  const makerAuth = configService.getAuthorizedReportsForUser({
    id: 'usr_maker_1',
    role: 'MAKER',
    department: 'Credit Operations',
    specialAccessGrants: [],
  });

  assert(makerAuth.authorizedReportKeys.includes('M_LCPLC001'), 'Credit Ops Maker authorized for M_LCPLC001');
  assert(
    !makerAuth.authorizedReportKeys.includes('M_FOREX001'),
    'Credit Ops Maker denied unauthorized Forex return (M_FOREX001)'
  );

  // Maker with Special Access Grant
  const makerWithSpecial = configService.getAuthorizedReportsForUser({
    id: 'usr_maker_1',
    role: 'MAKER',
    department: 'Credit Operations',
    specialAccessGrants: [
      {
        reportKey: 'M_FOREX001',
        reason: 'Temporary coverage during annual leave',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        revoked: false,
      },
    ],
  });
  assert(
    makerWithSpecial.authorizedReportKeys.includes('M_FOREX001'),
    'Special Access Grant dynamically authorizes foreign return'
  );

  // Auditor has whole-bank inspection
  const auditorAuth = configService.getAuthorizedReportsForUser({
    id: 'usr_auditor_1',
    role: 'AUDITOR',
    department: 'Internal Audit Directorate',
    specialAccessGrants: [],
  });
  assert(auditorAuth.hasAuditorInspection === true, 'Auditor granted whole-bank inspection oversight');
  assert(auditorAuth.authorizedReportKeys.length >= 24, 'Auditor can inspect all 24 returns');

  // --------------------------------------------------------------------------
  // TEST 6: Roles & Permissions SSOT
  // --------------------------------------------------------------------------
  console.log('\n--- 6. Roles & Permissions SSOT ---');

  const roles = configService.getRoles();
  assert(roles.length >= 4, `All standard roles present in SSOT (found ${roles.length})`);

  const permissions = configService.getPermissions();
  assert(permissions.length >= 10, `Granular permissions defined in SSOT (found ${permissions.length})`);

  // Update role permission
  const makerRole = configService.getRole('MAKER');
  const originalPerms = [...(makerRole?.permissions || [])];
  configService.updateRolePermissions('MAKER', [...originalPerms, 'SPECIAL_INSPECT'], {
    id: 'usr_admin',
    name: 'Admin',
    role: 'ADMIN',
  });
  const updatedMaker = configService.getRole('MAKER');
  assert(updatedMaker?.permissions.includes('SPECIAL_INSPECT') === true, 'Role permissions updated dynamically in SSOT');
  // Revert
  configService.updateRolePermissions('MAKER', originalPerms, { id: 'usr_admin', name: 'Admin', role: 'ADMIN' });

  // --------------------------------------------------------------------------
  // TEST 7: Workflows SSOT
  // --------------------------------------------------------------------------
  console.log('\n--- 7. Workflow Definitions & State Machine SSOT ---');

  const workflows = configService.getWorkflows();
  assert(workflows.length > 0, 'Workflow definitions exist in SSOT');

  const stdWf = configService.getWorkflowForReport('M_LCPLC001');
  assert(stdWf.code === 'WF_STANDARD_FOUR_EYES', 'Report bound to WF_STANDARD_FOUR_EYES');
  assert(stdWf.steps.length === 4, 'Standard workflow contains 4 sequential steps');
  assert(stdWf.steps[0].stateCode === 'DRAFT', 'Step 1 is DRAFT');
  assert(stdWf.steps[1].stateCode === 'PENDING_CHECKER', 'Step 2 is PENDING_CHECKER');
  assert(stdWf.steps[2].stateCode === 'APPROVED', 'Step 3 is APPROVED');
  assert(stdWf.steps[3].stateCode === 'SENT', 'Step 4 is SENT');

  // --------------------------------------------------------------------------
  // TEST 8: Cache Consistency & Real-Time Event Emission
  // --------------------------------------------------------------------------
  console.log('\n--- 8. Cache Consistency & Real-Time Foundation ---');

  const summaryBefore = configService.getConfigSummary();
  const hashBefore = summaryBefore.hashes.globalConfigHash;

  // Listen for real-time config change event
  const eventCapture = { fired: false, payload: null as any };
  const listener = (data: any) => {
    eventCapture.fired = true;
    eventCapture.payload = data;
  };
  configService.events.once('CONFIG_CHANGED', listener);

  // Invalidate cache / mutate
  configService.invalidateCache('DEPARTMENT');
  const summaryAfter = configService.getConfigSummary();
  const hashAfter = summaryAfter.hashes.globalConfigHash;

  assert(hashBefore !== hashAfter, 'Global config hash updated on mutation');
  assert(summaryAfter.hashes.deptVersion > summaryBefore.hashes.deptVersion, 'Department version counter incremented');
  assert(eventCapture.fired === true, 'Real-time CONFIG_CHANGED event emitted to listeners');
  assert(eventCapture.payload?.domain === 'DEPARTMENT', 'Event payload identifies updated domain');

  // Change logs
  const changeLogs = configService.getChangeLogs(10);
  assert(changeLogs.length > 0, `Change logs recorded in audit trail (found ${changeLogs.length})`);
  assert(changeLogs[0].timestamp !== undefined, 'Change log includes ISO 8601 timestamp');

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log(`Phase 2 SSOT Tests Completed: ${passed} Passed, ${failed} Failed`);
  console.log('========================================================================\n');

  if (failed > 0) {
    throw new Error(`${failed} Phase 2 SSOT tests failed.`);
  }
}

// Direct execution when run via tsx
if (import.meta.url === `file://${process.argv[1]}`) {
  runPhase2ConfigurationSSOTTests().catch((err) => {
    console.error('Fatal error during Phase 2 SSOT test run:', err);
    process.exit(1);
  });
}
