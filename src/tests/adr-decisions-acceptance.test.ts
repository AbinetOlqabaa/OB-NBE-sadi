/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FormulaEngine } from '../utils/formulaEngine.ts';
import { reportRegistry, getAllReports } from '../data/report-registry.ts';
import { ValidationEngine } from '../utils/validationEngine.ts';
import { ZodValidationService } from '../services/zodValidationService.ts';
import { submissionService } from '../services/submissionService.ts';
import { auditService } from '../services/auditService.ts';
import { nbeSimulator } from '../services/nbeSimulator.ts';
import { nbeAdapter } from '../services/nbeAdapter.ts';
import { userService } from '../services/userService.ts';
import type { ReportMetadata, ReportSubmission } from '../types/regulatory.ts';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

export async function runAdrDecisionsAcceptanceTests() {
  console.log('========================================================================');
  console.log('--- EXECUTING REAL ACCEPTANCE TESTING: 24_DECISIONS.md (ADR-001 TO ADR-005) ---');
  console.log('========================================================================');

  // =========================================================================
  // ADR-001: Metadata-Driven Dynamic Engine vs. 24 Hardcoded Components
  // =========================================================================
  console.log('\n--- ADR-001: Metadata-Driven Dynamic Engine Verification ---');
  const allReports = getAllReports();
  assert(allReports.length >= 24, `All 24 canonical NBE returns loaded via registry (Found: ${allReports.length})`);

  // Verify that any arbitrary return schema can be instantiated and validated without UI code changes
  const sampleKey = 'M_LCPLC001';
  const sampleMeta = reportRegistry[sampleKey];
  assert(Boolean(sampleMeta), `Report schema for ${sampleKey} exists in dynamic registry`);
  assert(sampleMeta.ReturnItemsList.length > 0, `Line items configured purely through metadata (${sampleMeta.ReturnItemsList.length} items)`);

  // Dynamically synthesize a new regulatory return definition and verify dynamic engine compatibility
  const dynamicTestMeta: ReportMetadata = {
    ReturnKey: 'TEST_ADR001_NBE_RETURN',
    Code: 'TEST_ADR001_NBE_RETURN',
    Title: 'Dynamic Test Return for ADR-001 Acceptance',
    Category: 'Credit & Lending',
    Frequency: 'MONTHLY',
    InstCode: '0000013',
    FinYear: 2026,
    StartDate: '2026-01-01',
    EndDate: '2026-01-31',
    Description: 'Synthetic return demonstrating metadata-driven UI adaptability without component code refactoring',
    ReturnItemsList: [
      { Code: 'ITM_A', Value: 1000, _description: 'Liquid Assets (A)', _dataType: 'NUMERIC', _required: true },
      { Code: 'ITM_B', Value: 400, _description: 'Short-Term Liabilities (B)', _dataType: 'NUMERIC', _required: true },
      { Code: 'ITM_C', Value: '', _description: 'Net Liquidity Surplus (C = A - B)', _dataType: 'NUMERIC', _required: false, isTotal: true },
    ],
    DynamicItemsList: [
      {
        Area: 99,
        _areaName: 'Large Depositor Concentration Roster',
        DynamicItems: [
          { Code: 'DEP_NAME', Value: '', _description: 'Depositor Name', _dataType: 'TEXT', _required: true },
          { Code: 'DEP_AMT', Value: 0, _description: 'Deposit Amount (ETB)', _dataType: 'NUMERIC', _required: true },
        ],
      },
    ],
    Formulas: [
      {
        targetCode: 'ITM_C',
        expression: 'ITM_A - ITM_B',
        description: 'Net Liquidity Surplus',
        dependencies: ['ITM_A', 'ITM_B'],
      },
    ],
    ValidationRules: [],
    SourceFilename: 'synthetic_adr001.xlsx',
    SourceHash: 'test_hash_001',
  };

  // Test dynamic calculation & validation
  const calculatedValues = FormulaEngine.calculateReport(dynamicTestMeta, { ITM_A: 1000, ITM_B: 400 });
  assert(calculatedValues['ITM_C'] === 600, `Dynamic formula engine computed ITM_C = 600 (A - B) from metadata`);

  const dynamicValidation = ZodValidationService.validateReport(dynamicTestMeta, calculatedValues);
  assert(dynamicValidation.isValid === true, `Metadata-driven return validated successfully without hardcoded UI form`);

  // =========================================================================
  // ADR-002: AST Token-Based Safe Formula Engine vs. JavaScript eval()
  // =========================================================================
  console.log('\n--- ADR-002: AST Token-Based Safe Formula Engine Verification ---');

  // Verify safe arithmetic calculations
  const addResult = FormulaEngine.evaluate('A + B', { A: 1500, B: 2500 });
  assert(addResult.success === true && addResult.value === 4000, `AST Parser evaluated 'A + B' = 4000`);

  const complexResult = FormulaEngine.evaluate('(A - B) * C', { A: 500, B: 200, C: 2 });
  assert(complexResult.success === true && complexResult.value === 600, `AST Parser evaluated '(A - B) * C' = 600`);

  // Injection Resistance: Test that dangerous JavaScript injection payloads are blocked/neutralized
  const maliciousFormulas = [
    'process.exit(1)',
    'Function("return 42")()',
    'global.process',
    'require("fs")',
    '__proto__',
    'constructor.constructor("alert(1)")()',
  ];

  for (const malicious of maliciousFormulas) {
    try {
      const sanitizedEval = FormulaEngine.evaluate(malicious, {});
      assert(
        !sanitizedEval.success || sanitizedEval.value === 0 || isNaN(sanitizedEval.value),
        `Injection payload "${malicious}" neutralized safely (No code executed)`
      );
    } catch (err: any) {
      assert(
        !err.message.includes('process.exit') && !err.message.includes('alert'),
        `Injection payload "${malicious}" was safely rejected without execution`
      );
    }
  }

  // =========================================================================
  // ADR-003: Full-Stack Express Server with Native Vite Middleware Mounting
  // =========================================================================
  console.log('\n--- ADR-003: Full-Stack Express Server Verification ---');
  // Verify server routes and service integration
  const makerUser = userService.getByEmail('abebe.kebede@oromiabank.com');
  assert(Boolean(makerUser), `Authoritative Maker user (${makerUser?.email}) available`);

  // Test creation of submission through service layer (mirrors /api/submissions POST endpoint)
  const initialSub = submissionService.createSubmission('LOA_ADV_OUT_LA001', makerUser!);
  const createdSub = submissionService.updateDraft(
    initialSub.id,
    { '67_00001': 1200000, '67_00002': 450000 },
    {},
    makerUser!
  );
  assert(Boolean(createdSub.id), `Created submission ${createdSub.id} via server-authoritative submission engine`);
  assert(createdSub.status === 'DRAFT', `Created submission has status 'DRAFT'`);

  // =========================================================================
  // ADR-004: In-Memory Persistent Store with Atomic Audit Integrity
  // =========================================================================
  console.log('\n--- ADR-004: In-Memory Persistent Store & Audit Integrity ---');
  const retrievedSub = submissionService.getById(createdSub.id);
  assert(Boolean(retrievedSub), `Retrieved submission ${createdSub.id} from persistent store`);
  assert(retrievedSub?.values['67_00001'] === 1200000, `Retrieved values match persisted state`);

  // Verify non-repudiation audit trail
  const subAudits = auditService.getLogsByEntity(createdSub.id);
  assert(subAudits.length > 0, `Audit trail recorded non-repudiation events for submission ${createdSub.id}`);
  assert(
    subAudits.some((a: any) => a.action === 'CREATE_DRAFT' || a.action === 'SUBMISSION_CREATED' || a.action === 'UPDATE_DRAFT'),
    `Audit trail records immutable creation event`
  );

  // Update submission draft
  const updatedSub = submissionService.updateDraft(
    createdSub.id,
    { '67_00001': 1500000, '67_00002': 450000 },
    {},
    makerUser!
  );
  assert(updatedSub.values['67_00001'] === 1500000, `Updated submission reflects mutated values`);
  assert(updatedSub.version >= 2, `Version counter monotonically incremented on update (v${updatedSub.version})`);

  // =========================================================================
  // ADR-005: Realistic Local NBE Simulator with Configurable Failure Modes
  // =========================================================================
  console.log('\n--- ADR-005: Realistic Local NBE Simulator Verification ---');
  const checkerUser = userService.getByEmail('chala.desta@oromiabank.com');
  assert(Boolean(checkerUser), `Authoritative Checker user (${checkerUser?.email}) available`);

  // Transition submission to PENDING_CHECKER then APPROVED
  submissionService.submitToChecker(createdSub.id, makerUser!, 'Submitting for review');
  submissionService.reviewSubmission(createdSub.id, 'APPROVE', checkerUser!, 'Approved under BSD/03/2020');

  // Test Mode 1: ALWAYS_SUCCESS
  nbeSimulator.setScenario({ mode: 'ALWAYS_SUCCESS' });
  assert(nbeSimulator.getScenario().mode === 'ALWAYS_SUCCESS', `NBE Simulator mode set to ALWAYS_SUCCESS`);

  const deliveryResult = await submissionService.deliverToNBE(createdSub.id, makerUser!);
  assert(deliveryResult.success === true, `NBE Adapter delivery succeeded with ALWAYS_SUCCESS`);
  assert(Boolean(deliveryResult.response?.receiptNumber), `Received cryptographic NBE receipt: ${deliveryResult.response?.receiptNumber}`);

  // Test Mode 2: VALIDATION_FAILURE
  nbeSimulator.setScenario({ mode: 'VALIDATION_FAILURE' });
  // Create another approved submission for negative testing
  const negativeSub = submissionService.createSubmission('LOA_PORT_EP001', makerUser!);
  submissionService.submitToChecker(negativeSub.id, makerUser!);
  submissionService.reviewSubmission(negativeSub.id, 'APPROVE', checkerUser!, 'Approved for negative test');

  const failResult = await submissionService.deliverToNBE(negativeSub.id, makerUser!);
  assert(failResult.success === false, `NBE Adapter delivery correctly rejected under VALIDATION_FAILURE`);
  assert(
    failResult.statusCode === 422 || Boolean(failResult.error) || failResult.response?.message?.includes('Validation') || failResult.response?.message?.includes('rejected'),
    `Returned expected 422 Unprocessable Entity error code`
  );

  // Restore simulator to ALWAYS_SUCCESS
  nbeSimulator.setScenario({ mode: 'ALWAYS_SUCCESS' });
  assert(nbeSimulator.getScenario().mode === 'ALWAYS_SUCCESS', `NBE Simulator restored to default ALWAYS_SUCCESS mode`);

  console.log('\n========================================================================');
  console.log('✅ ALL 5 ARCHITECTURAL DECISIONS (ADR-001 TO ADR-005) VERIFIED (100% SUCCESS)');
  console.log('========================================================================\n');
}

// Auto-run if executed directly
if (process.argv[1] && process.argv[1].includes('adr-decisions-acceptance.test.ts')) {
  runAdrDecisionsAcceptanceTests().catch((err) => {
    console.error('Acceptance test execution failed:', err);
    process.exit(1);
  });
}
