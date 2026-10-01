/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  configurationGovernanceService,
  sanitizeGovernanceState,
  type GovernanceProposal,
} from '../services/configurationGovernanceService.ts';
import { configService } from '../services/configService.ts';
import { userService } from '../services/userService.ts';
import { departmentService } from '../services/departmentService.ts';
import { auditService } from '../services/auditService.ts';

export function runConfigurationGovernanceVersioningTests(): void {
  console.log('\n========================================================================');
  console.log('--- PHASE 8: CONFIGURATION GOVERNANCE, VERSIONING & ROLLBACK TESTS ---');
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
      throw new Error(`Test assertion failed: ${message}`);
    }
  }

  // --- 1. SECRET SANITIZATION IN AUDIT & GOVERNANCE STATES ---
  console.log('--- 1. Secret & Credential Sanitization (No Secrets in Audit Logs) ---');
  const rawStateWithSecrets = {
    reportKey: 'BSD_01',
    password: 'superSecretPassword123!',
    apiToken: 'bearer_token_abc_xyz',
    privateKeyHash: 'sha256_private_key_data',
    nestedConfig: {
      dbCredential: 'db_pass_banking_secret',
      authPin: '1234',
      publicTitle: 'Statutory Daily Liquidity Return',
    },
  };

  const sanitized = sanitizeGovernanceState(rawStateWithSecrets);
  assert(sanitized.password === '[REDACTED_FOR_SECURITY]', 'Password field is redacted to [REDACTED_FOR_SECURITY]');
  assert(sanitized.apiToken === '[REDACTED_FOR_SECURITY]', 'API token field is redacted');
  assert(sanitized.privateKeyHash === '[REDACTED_FOR_SECURITY]', 'Private key hash is redacted');
  assert(sanitized.nestedConfig.dbCredential === '[REDACTED_FOR_SECURITY]', 'Nested dbCredential is redacted');
  assert(sanitized.nestedConfig.authPin === '[REDACTED_FOR_SECURITY]', 'Nested authPin is redacted');
  assert(
    sanitized.nestedConfig.publicTitle === 'Statutory Daily Liquidity Return',
    'Non-sensitive public title is preserved intact'
  );

  // --- 2. RISK CLASSIFICATION ENGINE ---
  console.log('\n--- 2. Risk Classification Engine (Low, Medium, High, Critical) ---');
  
  // 2.1 Role permission alteration -> CRITICAL
  const roleRisk = configurationGovernanceService.classifyRisk(
    'ROLE_PERMISSION',
    'UPDATE',
    { permissions: ['VIEW'] },
    { permissions: ['VIEW', 'APPROVE'] },
    [{ field: 'permissions', oldValue: ['VIEW'], newValue: ['VIEW', 'APPROVE'] }]
  );
  assert(roleRisk.riskLevel === 'CRITICAL', 'Role & Permission modification classified as CRITICAL risk');

  // 2.2 Mathematical formula change in report -> HIGH
  const formulaRisk = configurationGovernanceService.classifyRisk(
    'REPORT_TEMPLATE',
    'UPDATE',
    { formulas: ['A1 + B1'] },
    { formulas: ['A1 * 1.5 + B1'] },
    [{ field: 'formulas.expression', oldValue: 'A1 + B1', newValue: 'A1 * 1.5 + B1' }]
  );
  assert(formulaRisk.riskLevel === 'HIGH', 'Mathematical formula alteration classified as HIGH risk');

  // 2.3 Department restructuring -> HIGH
  const deptHierarchyRisk = configurationGovernanceService.classifyRisk(
    'DEPARTMENT',
    'UPDATE',
    { parentId: 'div_banking' },
    { parentId: 'div_risk' },
    [{ field: 'parentId', oldValue: 'div_banking', newValue: 'div_risk' }]
  );
  assert(deptHierarchyRisk.riskLevel === 'HIGH', 'Department hierarchy restructuring classified as HIGH risk');

  // 2.4 Controlled Rollback -> HIGH
  const rollbackRisk = configurationGovernanceService.classifyRisk(
    'REPORT_VERSION',
    'ROLLBACK',
    { version: 3 },
    { version: 1 },
    [{ field: 'version', oldValue: 3, newValue: 1 }]
  );
  assert(rollbackRisk.riskLevel === 'HIGH', 'Rollback action classified as HIGH risk');

  // 2.5 Adding optional field -> MEDIUM
  const optionalFieldRisk = configurationGovernanceService.classifyRisk(
    'REPORT_TEMPLATE',
    'UPDATE',
    { description: 'Old' },
    { description: 'New description' },
    [{ field: 'description', oldValue: 'Old', newValue: 'New description' }]
  );
  assert(optionalFieldRisk.riskLevel === 'MEDIUM', 'Metadata description modification classified as MEDIUM risk');

  // 2.6 Cosmetic notes -> LOW
  const cosmeticRisk = configurationGovernanceService.classifyRisk(
    'GENERAL_CONFIG',
    'UPDATE',
    { notes: 'v1' },
    { notes: 'v1.1' },
    [{ field: 'notes', oldValue: 'v1', newValue: 'v1.1' }]
  );
  assert(cosmeticRisk.riskLevel === 'LOW', 'Harmless non-structural edit classified as LOW risk');

  // --- 3. DRAFT PROPOSAL LIFECYCLE & IMPACT ANALYSIS ---
  console.log('\n--- 3. Multi-Domain Impact Analysis Engine ---');
  const testProposer = {
    id: 'usr_admin_test',
    name: 'Abebe Bikila',
    role: 'ADMIN',
    department: 'Compliance & Legal Governance',
  };

  const draftProposal = configurationGovernanceService.createProposalDraft(
    {
      title: 'Update BSD-01 Reserve Ratio Formula & Fields',
      description: 'Align BSD-01 liquidity computation formula with revised NBE BSD directive 2026/02.',
      category: 'REPORT_TEMPLATE',
      entityType: 'REPORT_DEFINITION',
      entityId: 'BSD_01',
      entityName: 'BSD-01: Daily Liquidity & Reserve Computation',
      actionType: 'UPDATE',
      proposedBeforeState: { formula: 'Reserves / TotalDeposits', secretKey: 'token123' },
      proposedAfterState: { formula: 'Reserves / (TotalDeposits - Exclusions)', secretKey: 'token456' },
      expectedEntityVersion: 1,
    },
    testProposer
  );

  assert(draftProposal.status === 'DRAFT', 'Initial proposal state is DRAFT');
  assert(draftProposal.riskLevel === 'HIGH', 'Formula update automatically classified as HIGH risk');
  assert(
    draftProposal.proposedChanges.beforeState.secretKey === '[REDACTED_FOR_SECURITY]',
    'Draft proposal scrubbed secretKey from beforeState'
  );
  assert(draftProposal.impactAnalysis.requiresDualApproval === true, 'HIGH risk change flags requiresDualApproval: true');
  assert(draftProposal.impactAnalysis.affectedReports.length > 0, 'Impact analysis identified affected report BSD-01');
  assert(draftProposal.impactAnalysis.affectedDepartments.length > 0, 'Impact analysis identified linked departments');
  assert(draftProposal.impactAnalysis.affectedSubmissions.historicalPreserved === true, 'Historical returns guaranteed preserved');

  // --- 4. STRUCTURAL VALIDATION ---
  console.log('\n--- 4. Structural Validation & Status Transition ---');
  const validatedProposal = configurationGovernanceService.validateProposal(draftProposal.id, {
    id: 'usr_admin_test',
    name: 'Abebe Bikila',
    role: 'ADMIN',
  });

  assert(validatedProposal.validationResult.isValid === true, 'Proposal passed structural validation');
  assert(
    validatedProposal.status === 'PENDING_APPROVAL',
    'HIGH-risk proposal transitioned from DRAFT to PENDING_APPROVAL after validation'
  );

  // --- 5. SEGREGATION OF DUTIES (4-EYES RULE: PROPOSER CANNOT APPROVE) ---
  console.log('\n--- 5. Segregation of Duties & 4-Eyes Review Enforcement ---');
  let sodBlocked = false;
  try {
    // Proposer attempting to approve their own proposal!
    configurationGovernanceService.approveProposal(
      validatedProposal.id,
      {
        id: testProposer.id, // SAME ID as proposer!
        name: testProposer.name,
        role: 'ADMIN',
      },
      'Self-approving my own proposal'
    );
  } catch (err: any) {
    if (err.message.includes('SEGREGATION_OF_DUTIES_VIOLATION')) {
      sodBlocked = true;
    }
  }
  assert(sodBlocked, 'Proposer is strictly blocked from approving their own high-impact configuration change');

  // Maker role cannot approve configuration proposal
  let makerBlocked = false;
  try {
    configurationGovernanceService.approveProposal(
      validatedProposal.id,
      {
        id: 'usr_maker_1',
        name: 'Chala Tolessa',
        role: 'MAKER',
      },
      'Maker approving'
    );
  } catch (err: any) {
    if (err.message.includes('UNAUTHORIZED_APPROVAL')) {
      makerBlocked = true;
    }
  }
  assert(makerBlocked, 'Non-governance role (MAKER) is strictly prohibited from approving configuration changes');

  // Independent Checker approval succeeds
  const approvedProposal = configurationGovernanceService.approveProposal(
    validatedProposal.id,
    {
      id: 'usr_checker_independent',
      name: 'Almaz Ayana',
      role: 'CHECKER',
      department: 'Credit Operations & Portfolio Management',
    },
    'Statutory formula alignment verified against NBE Directive.'
  );

  assert(approvedProposal.status === 'APPROVED', 'Proposal successfully approved by independent Checker');
  assert(approvedProposal.approvals.length === 1, 'Approval record appended to proposal');
  assert(approvedProposal.approvals[0].approverName === 'Almaz Ayana', 'Approval record preserves approver name');

  // --- 6. OPTIMISTIC CONCURRENCY LOCKING & COLLISION DETECTION ---
  console.log('\n--- 6. Optimistic Concurrency Locking & Collision Detection ---');
  // Simulate Administrator B modifying the entity version in the background
  const entityType = approvedProposal.entityType;
  const entityId = approvedProposal.entityId;

  // Currently expectedEntityVersion is 1. If another admin updated it to 2:
  configurationGovernanceService.setEntityCurrentVersion(entityType, entityId, 2);

  let concurrencyCollisionBlocked = false;
  try {
    // Attempting to publish when current version has advanced to 2
    configurationGovernanceService.publishProposal(approvedProposal.id, {
      id: 'usr_admin_test',
      name: 'Abebe Bikila',
      role: 'ADMIN',
    });
  } catch (err: any) {
    if (err.message.includes('CONCURRENCY_CONFLICT')) {
      concurrencyCollisionBlocked = true;
    }
  }
  assert(
    concurrencyCollisionBlocked,
    'Optimistic concurrency check detects version drift and prevents silent overwrite'
  );

  // Reset expected version to match current version (2) so publishing can proceed cleanly
  approvedProposal.expectedEntityVersion = 2;

  // --- 7. PUBLICATION & EFFECTIVE DATE TRANSITION ---
  console.log('\n--- 7. Governed Publication & Effective State ---');
  const { proposal: publishedProposal, resultingVersion } = configurationGovernanceService.publishProposal(
    approvedProposal.id,
    {
      id: 'usr_admin_test',
      name: 'Abebe Bikila',
      role: 'ADMIN',
    }
  );

  assert(resultingVersion === 3, 'Publication incremented authoritative entity version to Version 3');
  assert(publishedProposal.status === 'EFFECTIVE', 'Immediate effective date transitioned proposal to EFFECTIVE');
  assert(publishedProposal.publication?.resultingVersionNumber === 3, 'Publication record captures resulting version');
  assert(Boolean(publishedProposal.publication?.resultingConfigHash), 'Publication generated cryptographic config hash');

  // Verify notifications sent to affected stakeholders
  const allNotifs = configurationGovernanceService.getAllNotifications();
  assert(allNotifs.length > 0, 'Generated material change notifications for affected stakeholders');
  assert(
    allNotifs.some((n) => n.proposalId === publishedProposal.id),
    'Notification references published proposal ID'
  );

  // --- 8. REJECTION LIFECYCLE ---
  console.log('\n--- 8. Rejection Workflow & Reason Capture ---');
  const rejectableProposal = configurationGovernanceService.createProposalDraft(
    {
      title: 'Erroneous Field Deletion in BSD-02',
      description: 'Attempted deletion of mandatory non-performing loans schedule.',
      entityType: 'REPORT_DEFINITION',
      entityId: 'BSD_02',
      entityName: 'BSD-02: Non-Performing Loans Return',
      actionType: 'DELETE',
      proposedBeforeState: { active: true },
      proposedAfterState: { active: false },
    },
    testProposer
  );
  configurationGovernanceService.validateProposal(rejectableProposal.id, testProposer);

  const rejected = configurationGovernanceService.rejectProposal(
    rejectableProposal.id,
    {
      id: 'usr_checker_independent',
      name: 'Almaz Ayana',
      role: 'CHECKER',
    },
    'Statutory non-performing loans schedule is mandatory under BSD/03/2020 and cannot be decommissioned.'
  );

  assert(rejected.status === 'REJECTED', 'Proposal status transitioned to REJECTED');
  assert(Boolean(rejected.rejectionReason), 'Rejection reason recorded in permanent proposal record');
  assert(rejected.approvals.some((a) => a.decision === 'REJECTED'), 'Rejection decision logged in approvals history');

  // --- 9. CONTROLLED GOVERNED ROLLBACK (NEVER DESTROY HISTORY) ---
  console.log('\n--- 9. Controlled Governed Rollback & Historical Integrity ---');
  // Report BSD_01 is now at Version 3. Rollback to Version 1:
  const rollbackProposal = configurationGovernanceService.rollbackToVersion(
    'REPORT_DEFINITION',
    'BSD_01',
    1,
    testProposer,
    'Reverting liquidity computation formula due to NBE clarification notice 2026/03.'
  );

  assert(rollbackProposal.actionType === 'ROLLBACK', 'Rollback proposal has actionType: ROLLBACK');
  assert(rollbackProposal.rollbackInfo?.isRollback === true, 'Proposal flagged with isRollback: true');
  assert(rollbackProposal.rollbackInfo?.revertsVersion === 1, 'Rollback explicitly tracks target Version 1');
  assert(rollbackProposal.riskLevel === 'HIGH', 'Rollback is classified as HIGH risk');

  // Historical proposals remain untouched in memory/storage
  const originalProposal = configurationGovernanceService.getProposalById(publishedProposal.id);
  assert(originalProposal !== undefined, 'Original published proposal remains permanently intact');
  assert(originalProposal?.status === 'EFFECTIVE', 'Original published proposal status is never erased or overwritten');

  // --- 10. CONFIG SERVICE ROLLBACK INTEGRATION ---
  console.log('\n--- 10. ConfigService Native Rollback Method ---');
  // Test native rollbackReportVersion on configService with canonical return key
  const repKey = 'POBEPE001';
  const targetVer = 1;
  const rolledBackVer = configService.rollbackReportVersion(
    repKey,
    targetVer,
    { id: 'usr_admin', name: 'Abebe Bikila', role: 'ADMIN' },
    'Compliance rollback per circular BSD/03/2020'
  );

  assert(rolledBackVer.status === 'ACTIVE', 'Rolled back version is ACTIVE');
  assert(rolledBackVer.versionNumber > targetVer, 'Rollback created a higher version number (Version N+1)');
  assert(
    rolledBackVer.changelogSummary.includes('[GOVERNED ROLLBACK]'),
    'Changelog summary records [GOVERNED ROLLBACK]'
  );

  // Past versions remain accessible
  const pastV1 = configService.getReportVersion(repKey, 1);
  assert(pastV1 !== undefined, 'Historical Version 1 is permanently preserved in configService');

  // --- 11. COMPLETION GATE: AUDIT EXPLANATION ENGINE ---
  console.log('\n--- 11. Completion Gate: "Explain Who Changed What, When, Under Which Approval, When Effective, and What It Affected" ---');
  const explanation = configurationGovernanceService.explainChange(publishedProposal.id);

  assert(Boolean(explanation.actor.name), 'Explanation captures actor name: ' + explanation.actor.name);
  assert(Boolean(explanation.timestamp), 'Explanation captures timestamp: ' + explanation.timestamp);
  assert(Boolean(explanation.entity.name), 'Explanation captures entity: ' + explanation.entity.name);
  assert(Boolean(explanation.action), 'Explanation captures action: ' + explanation.action);
  assert(explanation.beforeState !== undefined, 'Explanation captures beforeState');
  assert(explanation.afterState !== undefined, 'Explanation captures afterState');
  assert(Boolean(explanation.approval?.approvedBy), 'Explanation captures approver: ' + explanation.approval?.approvedBy);
  assert(Boolean(explanation.effectiveDate.effectiveFrom), 'Explanation captures effective date: ' + explanation.effectiveDate.effectiveFrom);
  assert(explanation.version.versionNumber >= 1, 'Explanation captures version: v' + explanation.version.versionNumber);
  assert(explanation.impactSummary.affectedReportsCount >= 1, 'Explanation captures affected reports count');
  assert(Boolean(explanation.impactSummary.summaryNarrative), 'Explanation provides readable regulatory narrative');

  console.log('\n' + '-'.repeat(70));
  console.log('Sample Official Explanation Output:');
  console.log(explanation.impactSummary.summaryNarrative);
  console.log('-'.repeat(70));

  console.log(`\n========================================================================`);
  console.log(`✅ ALL PHASE 8 CONFIGURATION GOVERNANCE, VERSIONING & ROLLBACK TESTS PASSED (${passed} assertions, 0 failed)`);
  console.log(`========================================================================\n`);
}
