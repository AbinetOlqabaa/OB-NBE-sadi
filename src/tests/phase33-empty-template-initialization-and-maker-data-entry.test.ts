/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { configService } from '../services/configService.ts';
import { submissionService } from '../services/submissionService.ts';
import { templateInitializationService, KNOWN_PLACEHOLDER_STRINGS } from '../services/templateInitializationService.ts';
import { nbeAdapter } from '../services/nbeAdapter.ts';
import { ZodValidationService } from '../services/zodValidationService.ts';
import { ValidationRemediationService } from '../services/validationRemediationService.ts';
import { ValidationEngine } from '../utils/validationEngine.ts';
import { nbeReportPackageService } from '../services/nbeReportPackageNormalizer.ts';
import { getReportByKey } from '../data/report-registry.ts';
import type { ReportMetadata, ReportSubmission, UserSession } from '../types/regulatory.ts';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

export async function runPhase33EmptyTemplateInitializationAndMakerDataEntryTests() {
  console.log('\n========================================================================');
  console.log('--- PHASE 33: EMPTY TEMPLATE INITIALIZATION & MAKER DATA-ENTRY SEMANTICS ---');
  console.log('========================================================================');

  const makerUser: UserSession = {
    id: 'usr_maker_phase33',
    name: 'Dawit Maker',
    role: 'MAKER',
    department: 'Credit Operations & Portfolio Management',
    email: 'dawit.maker@oromiabank.com',
    institutionCode: '0000013',
  };

  const checkerUser: UserSession = {
    id: 'usr_checker_phase33',
    name: 'Tigist Checker',
    role: 'CHECKER',
    department: 'Credit Operations & Portfolio Management',
    email: 'tigist.checker@oromiabank.com',
    institutionCode: '0000013',
  };

  // =========================================================================
  // 1. SEPARATION OF DEFINITION METADATA FROM BUSINESS VALUES (Req 1, 2)
  // =========================================================================
  console.log('\n--- 1. Separation of Definition Metadata from Business Values (Req 1, 2) ---');

  const sampleReport = getReportByKey('LOA_ADV_OUT_LA001')!;
  assert(Boolean(sampleReport), 'Found authoritative template LOA_ADV_OUT_LA001 in report-registry');

  // Verify template contains descriptive metadata, titles, and item definitions
  assert(sampleReport.Title.length > 0, `Template has Title: "${sampleReport.Title}"`);
  assert(sampleReport.ReturnItemsList.length > 0, `Template has ${sampleReport.ReturnItemsList.length} fixed return items`);

  // Initialize draft using templateInitializationService
  const cleanInit = templateInitializationService.initializeDraftFromTemplate(sampleReport);
  assert(typeof cleanInit.values === 'object', 'Draft values object generated cleanly');
  assert(typeof cleanInit.dynamicRows === 'object', 'Draft dynamicRows object generated cleanly');

  // Verify none of the items in cleanInit have invented values or legacy sample values
  const nonTotalItems = sampleReport.ReturnItemsList.filter(
    (item) => !sampleReport.Formulas.some((f) => f.targetCode === item.Code)
  );
  const sampleValuesCopied = nonTotalItems.some((item) => {
    const v = cleanInit.values[item.Code];
    return typeof v === 'number' && v > 1000000; // Old legacy sample JSON had millions hardcoded
  });
  assert(!sampleValuesCopied, 'Clean draft contains zero hardcoded legacy business amounts');

  // Verify titles, row labels, column labels, categories remain strictly in metadata and are preserved
  for (const item of sampleReport.ReturnItemsList) {
    assert(Boolean(item._description), `Structural label preserved for item ${item.Code}: "${item._description}"`);
  }

  // =========================================================================
  // 2. SCHEMA-AWARE INITIAL VALUE RULES (Req 3)
  // =========================================================================
  console.log('\n--- 2. Schema-Aware Initial-Value Rules (Req 3) ---');

  // Test numeric field
  const numericField = sampleReport.ReturnItemsList.find((i) => i._dataType === 'NUMERIC');
  if (numericField) {
    const initVal = templateInitializationService.getSchemaAwareInitialValue(numericField);
    assert(initVal === '', `Numeric field without structural default initializes to unset (''), not invented numbers`);
  }

  // Test explicit structural default field (where allowed by schema)
  const itemWithStructuralDefault: any = {
    Code: 'TEST_STRUCT_DEFAULT',
    _description: 'Statutory Base Currency Factor',
    _dataType: 'NUMERIC',
    _required: true,
    isStructuralDefault: true,
    defaultValue: 1.0,
  };
  const structDefaultVal = templateInitializationService.getSchemaAwareInitialValue(itemWithStructuralDefault);
  assert(structDefaultVal === 1.0, 'Structural default explicitly allowed by schema is respected (1.0)');

  // Test percentage field identification
  const pctItem = {
    Code: 'CAR_RATIO_PCT',
    _description: 'Capital Adequacy Ratio (%)',
    _dataType: 'NUMERIC' as const,
    _required: true,
    Value: 0,
  };
  assert(templateInitializationService.isPercentageRatioField(pctItem), 'Capital Adequacy Ratio identified as percentage field');
  const pctPlaceholder = templateInitializationService.getSchemaAwarePlaceholder(pctItem);
  assert(pctPlaceholder === '0.00%', `Percentage field placeholder is visual hint "0.00%" (got: ${pctPlaceholder})`);

  // Test count field identification
  const countItem = {
    Code: 'NUM_BORROWERS_COUNT',
    _description: 'Total Number of Borrowers',
    _dataType: 'NUMERIC' as const,
    _required: true,
    Value: 0,
  };
  assert(templateInitializationService.isCountField(countItem), 'Borrower count identified as integer count field');
  const countPlaceholder = templateInitializationService.getSchemaAwarePlaceholder(countItem);
  assert(countPlaceholder === '0', `Count field placeholder is visual hint "0" (got: ${countPlaceholder})`);

  // Test repeating tables / dynamic schedule areas
  const templateWithDynamic: ReportMetadata = {
    ...sampleReport,
    DynamicItemsList: [
      {
        Area: 99,
        _areaName: 'Large Restructured Exposures',
        DynamicItems: [
          { Code: 'BORROWER_NAME', Value: '', _description: 'Borrower Name', _dataType: 'TEXT', _required: true },
          { Code: 'OUTSTANDING_BAL', Value: '', _description: 'Outstanding Balance', _dataType: 'NUMERIC', _required: true },
        ],
      } as any,
    ],
  };

  const dynamicInit = templateInitializationService.initializeDraftFromTemplate(templateWithDynamic);
  assert(Array.isArray(dynamicInit.dynamicRows[99]), 'Dynamic schedule area initialized as an array');
  assert(dynamicInit.dynamicRows[99].length === 0, 'Dynamic schedule area initialized with 0 rows (no invented rows or figures)');

  // Dynamic area with structural rows declared
  const templateWithStructuralRows: ReportMetadata = {
    ...sampleReport,
    DynamicItemsList: [
      {
        Area: 98,
        _areaName: 'Mandatory Foreign Currencies',
        _minRows: 2,
        _maxRows: 5,
        structuralRows: [
          { CURRENCY: 'USD' },
          { CURRENCY: 'EUR' },
        ],
        DynamicItems: [
          { Code: 'CURRENCY', Value: '', _description: 'Currency Code', _dataType: 'TEXT', _required: true },
          { Code: 'BALANCE', Value: '', _description: 'Closing Balance', _dataType: 'NUMERIC', _required: true },
        ],
      } as any,
    ],
  };
  const structRowsInit = templateInitializationService.initializeDraftFromTemplate(templateWithStructuralRows);
  assert(structRowsInit.dynamicRows[98].length === 2, 'Declared structural rows initialized for Area 98');
  assert(structRowsInit.dynamicRows[98][0].values['CURRENCY'] === 'USD', 'Structural row 1 preserves currency code USD');
  assert(structRowsInit.dynamicRows[98][0].values['BALANCE'] === '', 'Structural row 1 balance is unset without invented numbers');

  // =========================================================================
  // 3. UI PLACEHOLDERS VS ACTUAL SUBMITTED VALUES (Req 4, 5)
  // =========================================================================
  console.log('\n--- 3. UI Placeholders vs Actual Submitted Values (Req 4, 5) ---');

  // Test placeholder string detection
  for (const ph of ['0.00 ETB', '0.00', '0.00%', '0%', 'YYYY-MM-DD', 'Auto-calculated', 'Enter text...']) {
    assert(templateInitializationService.isPlaceholderString(ph), `isPlaceholderString correctly recognizes "${ph}" as placeholder`);
    assert(!templateInitializationService.isFieldSupplied(ph), `isFieldSupplied correctly flags "${ph}" as NOT supplied`);
  }

  // Real business values are recognized as supplied
  assert(templateInitializationService.isFieldSupplied('1250000.50'), 'Numeric string "1250000.50" recognized as supplied');
  assert(templateInitializationService.isFieldSupplied(1250000.50), 'Number 1250000.50 recognized as supplied');
  assert(templateInitializationService.isFieldSupplied(0), 'Legitimate zero number (0) recognized as supplied');
  assert(templateInitializationService.isFieldSupplied('Oromia Commercial Center'), 'Text string recognized as supplied');

  // Empty states are NOT supplied
  assert(!templateInitializationService.isFieldSupplied(''), 'Empty string is not supplied');
  assert(!templateInitializationService.isFieldSupplied('   '), 'Whitespace string is not supplied');
  assert(!templateInitializationService.isFieldSupplied(null), 'Null is not supplied');
  assert(!templateInitializationService.isFieldSupplied(undefined), 'Undefined is not supplied');

  // Test payload sanitization: placeholders MUST NEVER enter NBE payload
  const submissionWithPlaceholders: any = {
    id: 'sub_test_placeholders',
    reportKey: sampleReport.ReturnKey,
    version: 1,
    status: 'DRAFT',
    makerId: makerUser.id,
    makerName: makerUser.name,
    makerDepartment: makerUser.department,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    values: {
      LA001: '0.00 ETB', // Placeholder text accidentally stored
      LA002: 'Auto-calculated',
      LA003: 45000000.0, // Real business value
      LA004: 'YYYY-MM-DD',
      LA005: '', // Unset
    },
    dynamicRows: {
      1: [
        {
          id: 'row_1',
          areaId: 1,
          values: {
            COL_AMT: '0.00 ETB',
            COL_DESC: 'Enter text...',
            COL_REAL: 120000,
          },
        },
      ],
    },
  };

  const nbePayload = nbeAdapter.buildNBEPayload(submissionWithPlaceholders);
  assert(Boolean(nbePayload), 'NBE payload built successfully');

  // Inspect ReturnItemsList in payload
  const la001Item = nbePayload.ReturnItemsList.find((i: any) => i.Code === 'LA001');
  assert(la001Item.Value === '', `Placeholder '0.00 ETB' in LA001 was sanitized to empty string: "${la001Item.Value}"`);

  const la002Item = nbePayload.ReturnItemsList.find((i: any) => i.Code === 'LA002');
  assert(la002Item.Value === '', `Placeholder 'Auto-calculated' was sanitized to empty string: "${la002Item.Value}"`);

  const la003Item = nbePayload.ReturnItemsList.find((i: any) => i.Code === 'LA003');
  assert(la003Item.Value === 45000000.0, `Real business value in LA003 was preserved: ${la003Item.Value}`);

  // Inspect dynamic schedule in payload
  const dynRow = nbePayload.DynamicItemsList[0].Rows[0];
  assert(dynRow.COL_AMT === '', `Dynamic row placeholder '0.00 ETB' sanitized to empty string: "${dynRow.COL_AMT}"`);
  assert(dynRow.COL_DESC === '', `Dynamic row placeholder 'Enter text...' sanitized to empty string: "${dynRow.COL_DESC}"`);
  assert(dynRow.COL_REAL === 120000, `Dynamic row real figure preserved: ${dynRow.COL_REAL}`);

  // =========================================================================
  // 4. UNTOUCHED TEMPLATES & VALIDATION NOISE SUPPRESSION (Req 6, 7, 8)
  // =========================================================================
  console.log('\n--- 4. Untouched Templates & Validation Noise Suppression (Req 6, 7, 8) ---');

  // Create a newly initialized clean draft
  const initialDraft = submissionService.createSubmission(sampleReport.ReturnKey, makerUser);
  assert(Boolean(initialDraft), 'Created fresh submission draft via submissionService');

  // Verify that newly created submission has values initialized via templateInitializationService
  const unsuppliedCount = Object.values(initialDraft.values).filter(
    (v) => !templateInitializationService.isFieldSupplied(v)
  ).length;
  assert(unsuppliedCount > 0, `Clean draft contains ${unsuppliedCount} unsupplied fields waiting for business entry`);

  // Test Zod validation on newly created draft:
  const zodValidation = ZodValidationService.validateReport(
    sampleReport,
    initialDraft.values,
    initialDraft.dynamicRows
  );

  // Check optional fields: verify NO optional fields generated errors or warnings
  const optionalCodes = new Set(
    sampleReport.ReturnItemsList.filter((i) => !i._required).map((i) => i.Code)
  );
  const optionalFieldErrors = zodValidation.fieldErrors.filter((e) => optionalCodes.has(e.code));
  assert(
    optionalFieldErrors.length === 0,
    `Untouched optional fields generated ZERO warnings/errors (errors count: ${optionalFieldErrors.length})`
  );

  // Verify that no duplicate warnings are generated for an untouched field
  const fieldCodeCounts = new Map<string, number>();
  for (const err of zodValidation.fieldErrors) {
    fieldCodeCounts.set(err.code, (fieldCodeCounts.get(err.code) || 0) + 1);
  }
  const hasDuplicates = Array.from(fieldCodeCounts.values()).some((count) => count > 1);
  assert(!hasDuplicates, 'Validation produces ZERO duplicate errors/warnings per field for untouched template');

  // Test template with mandatory required fields:
  const templateWithRequired: ReportMetadata = {
    ...sampleReport,
    ReturnKey: 'TEST_REQUIRED_RET',
    ReturnItemsList: [
      {
        Code: 'REQ_MANDATORY_01',
        _description: 'Total Regulatory Capital Base',
        _dataType: 'NUMERIC',
        _required: true,
        Value: 0,
      },
      {
        Code: 'OPT_DISCRETIONARY_02',
        _description: 'Optional Subordinated Debt Note',
        _dataType: 'NUMERIC',
        _required: false,
        Value: 0,
      },
    ],
  };

  const { values: reqInitVals, dynamicRows: reqInitDyn } =
    templateInitializationService.initializeDraftFromTemplate(templateWithRequired);

  const reqZodValidation = ZodValidationService.validateReport(
    templateWithRequired,
    reqInitVals,
    reqInitDyn
  );

  assert(
    !reqZodValidation.isValid,
    'Zod correctly marks empty report with mandatory fields as not valid for submission'
  );
  const reqFieldErr = reqZodValidation.fieldErrors.find((e) => e.code === 'REQ_MANDATORY_01');
  assert(Boolean(reqFieldErr), 'Missing required field is identifiable and blocks final submission');
  const optFieldErr = reqZodValidation.fieldErrors.find((e) => e.code === 'OPT_DISCRETIONARY_02');
  assert(!optFieldErr, 'Optional empty field does NOT generate any error or warning');

  // Test ValidationRemediationService
  const remediationResult = ValidationRemediationService.normalizeReportValidation(
    templateWithRequired,
    reqInitVals,
    reqInitDyn
  );

  assert(Boolean(remediationResult), 'Validation remediation normalization ran successfully');
  // Verify remediation clearly explains genuinely missing required values (Req 9)
  const mandatoryRemediationItem = remediationResult.items.find(
    (i) => i.constraintType === 'MANDATORY' && i.fieldCode === 'REQ_MANDATORY_01'
  );
  assert(Boolean(mandatoryRemediationItem), 'Remediation assistant lists missing mandatory field');
  assert(
    mandatoryRemediationItem?.explanation.whatIsWrong.length! > 10,
    `Clear explanation 'whatIsWrong': "${mandatoryRemediationItem?.explanation.whatIsWrong}"`
  );
  assert(
    mandatoryRemediationItem?.explanation.whyItMatters.length! > 10,
    `Clear explanation 'whyItMatters': "${mandatoryRemediationItem?.explanation.whyItMatters}"`
  );
  assert(
    mandatoryRemediationItem?.explanation.howToFix.length! > 10,
    `Clear explanation 'howToFix': "${mandatoryRemediationItem?.explanation.howToFix}"`
  );
  assert(
    mandatoryRemediationItem?.explanation.expectedFormat.length! > 5,
    `Clear explanation 'expectedFormat': "${mandatoryRemediationItem?.explanation.expectedFormat}"`
  );

  // Requirement 8: Untouched template does NOT produce duplicate balancing/business rule warnings
  const businessRuleErrorsOnUntouched = remediationResult.items.filter(
    (i) => i.category === 'BUSINESS_RULE_ERROR'
  );
  assert(
    businessRuleErrorsOnUntouched.length === 0,
    `Untouched clean template produces ZERO false balancing/business rule warnings (got: ${businessRuleErrorsOnUntouched.length})`
  );

  // =========================================================================
  // 5. RESET TO TEMPLATE DEFAULTS (Req 10)
  // =========================================================================
  console.log('\n--- 5. Reset to Template Defaults (Req 10) ---');

  // Maker enters some test figures into the draft
  const targetCode = sampleReport.ReturnItemsList[0].Code;
  const draftToModify = submissionService.getSubmissionById(initialDraft.id)!;
  draftToModify.values[targetCode] = 987654321;
  submissionService.updateDraft(initialDraft.id, draftToModify.values, draftToModify.dynamicRows, makerUser);

  const modifiedDraft = submissionService.getSubmissionById(initialDraft.id)!;
  assert(
    modifiedDraft.values[targetCode] === 987654321,
    `Maker modified draft field ${targetCode} to 987654321`
  );

  // Record report definition snapshot in configService before reset
  const definitionBeforeReset = JSON.stringify(configService.getReportDefinition(sampleReport.ReturnKey));

  // Perform reset to template defaults
  const resetDraft = submissionService.resetToTemplateDefaults(initialDraft.id, makerUser);
  assert(Boolean(resetDraft), 'resetToTemplateDefaults completed successfully');
  assert(
    resetDraft.values[targetCode] === '',
    `Field ${targetCode} was cleanly reset to template default ('')`
  );
  assert(
    resetDraft.version === modifiedDraft.version + 1,
    `Draft version incremented from v${modifiedDraft.version} to v${resetDraft.version}`
  );

  // Crucial Guarantee: Verify underlying report definition in configService was NEVER modified
  const definitionAfterReset = JSON.stringify(configService.getReportDefinition(sampleReport.ReturnKey));
  assert(
    definitionBeforeReset === definitionAfterReset,
    'Report definition in configService remained 100% UNMODIFIED after reset-to-defaults'
  );

  // Non-Maker cannot reset draft
  let checkerResetBlocked = false;
  try {
    submissionService.resetToTemplateDefaults(initialDraft.id, checkerUser);
  } catch (err: any) {
    checkerResetBlocked = true;
  }
  assert(checkerResetBlocked, 'Checker is strictly blocked from resetting draft (Makers only)');

  // =========================================================================
  // 6. SUBMITTED REPORT IMMUTABILITY & REUSE AS NEW (Req 11, 12)
  // =========================================================================
  console.log('\n--- 6. Submitted Report Immutability & Reuse As New (Req 11, 12) ---');

  // Create a submission and advance it to SENT
  const subForSubmit = submissionService.createSubmission(sampleReport.ReturnKey, makerUser);
  subForSubmit.status = 'SENT';
  (submissionService as any).submissions.set(subForSubmit.id, subForSubmit);

  // Verify reset on SENT report is blocked
  let submittedResetBlocked = false;
  try {
    submissionService.resetToTemplateDefaults(subForSubmit.id, makerUser);
  } catch (err: any) {
    submittedResetBlocked = true;
  }
  assert(submittedResetBlocked, 'Reset is strictly blocked on SENT reports (immutability preserved)');

  // Test Reuse as New creates an independent clean draft
  const reusedDraft = submissionService.reuseSubmission(subForSubmit.id, makerUser);
  assert(Boolean(reusedDraft), 'reuseSubmission succeeded');
  assert(reusedDraft.id !== subForSubmit.id, `Reused draft has a brand-new unique ID (${reusedDraft.id})`);
  assert(reusedDraft.status === 'DRAFT', 'Reused submission starts as clean DRAFT');
  assert(reusedDraft.version === 1, 'Reused submission starts at version 1');

  // Verify historical submitted submission remains unchanged
  const originalSubAfterReuse = submissionService.getSubmissionById(subForSubmit.id)!;
  assert(originalSubAfterReuse.status === 'SENT', 'Historical report remains SENT');
  assert(originalSubAfterReuse.id === subForSubmit.id, 'Historical report ID intact');

  // =========================================================================
  // 7. IMPORTING A PACKAGE AND VERIFYING INITIALIZATION (Req 2)
  // =========================================================================
  console.log('\n--- 7. Imported Package Template Clean Initialization (Req 2) ---');

  const importedPackage = {
    packageVersion: '1.0',
    report: {
      returnKey: 'NBE_PHASE33_TEST_RETURN',
      shortCode: 'P33TR',
      mainTitle: 'Phase 33 Automated Acceptance Test Return',
      subTitle: 'Statutory Verification Schedule',
      frequency: 'MONTHLY',
      regulatoryCategory: 'Capital Adequacy',
      sections: [{ id: 'sec_1', code: 'SEC1', title: 'Asset Quality Table' }],
      fields: [
        {
          id: 'f_req_num',
          itemCode: 'MANDATORY_ETB',
          itemDescription: 'Mandatory Gross Loan Portfolio',
          dataType: 'NUMERIC',
          sectionId: 'sec_1',
          required: true,
          defaultValue: 75000000, // Legacy sample value in package that must NOT be blindly copied
        },
        {
          id: 'f_opt_num',
          itemCode: 'OPTIONAL_EXP',
          itemDescription: 'Optional Additional Exposure',
          dataType: 'NUMERIC',
          sectionId: 'sec_1',
          required: false,
          defaultValue: 1000000, // Legacy sample value
        },
        {
          id: 'f_pct',
          itemCode: 'NPL_RATIO',
          itemDescription: 'Non-Performing Loan Ratio (%)',
          dataType: 'NUMERIC',
          sectionId: 'sec_1',
          required: true,
        },
      ],
      columns: [],
      formulas: [],
      validationRules: [],
    },
    integration: {
      endpointKey: 'P33_TEST_EP',
      endpointName: 'Phase 33 Test Endpoint',
      httpMethod: 'POST',
      urlPath: '/api/v1/nbe/reports/p33',
      requiresAuth: true,
      authProfileId: 'NBE_OAUTH_MUTUAL_TLS',
      requestTimeoutMs: 30000,
      retryCount: 3,
      idempotencyEnabled: true,
    },
  };

  // Import package through nbeReportPackageService
  const importResult = nbeReportPackageService.importPackageAsDraft(importedPackage as any, {
    id: 'usr_admin_p33',
    name: 'Compliance Administrator',
    role: 'ADMIN',
  });
  assert(importResult.success, 'Imported package successfully as draft');
  assert(importResult.report.name === 'Phase 33 Automated Acceptance Test Return', 'Report main title preserved');
  assert(importResult.validation.sampleValuesStrippedCount >= 2, `Legacy sample values stripped count: ${importResult.validation.sampleValuesStrippedCount}`);

  // Convert imported snapshot into ReportMetadata structure to verify templateInitializationService
  const importedPackageReportMeta: ReportMetadata = {
    ReturnKey: 'NBE_PHASE33_TEST_RETURN',
    Code: 'P33TR',
    Title: 'Phase 33 Automated Acceptance Test Return',
    Category: 'Classification & Provisioning',
    Frequency: 'MONTHLY',
    InstCode: '0000013',
    FinYear: 2026,
    StartDate: '2026-01-01',
    EndDate: '2026-01-31',
    Description: 'Statutory Verification Schedule',
    ReturnItemsList: importResult.version.fields.map((f) => ({
      Code: f.itemCode,
      _description: f.itemDescription,
      _dataType: f.dataType as any,
      _required: f.isRequired,
      defaultValue: f.defaultValue,
      Value: 0,
    })),
    DynamicItemsList: [],
    Formulas: [],
    ValidationRules: [],
    SourceFilename: 'package.json',
    SourceHash: 'hash',
  };

  // Verify draft initialized from imported package strips legacy sample figures
  const { values: importedDraftVals } = templateInitializationService.initializeDraftFromTemplate(importedPackageReportMeta);
  assert(
    importedDraftVals['MANDATORY_ETB'] === '',
    `Legacy sample value (75,000,000) was NOT copied into editable draft: "${importedDraftVals['MANDATORY_ETB']}"`
  );
  assert(
    importedDraftVals['OPTIONAL_EXP'] === '',
    `Legacy sample value (1,000,000) was NOT copied into editable draft: "${importedDraftVals['OPTIONAL_EXP']}"`
  );

  console.log('\n========================================================================');
  console.log('✅ ALL PHASE 33 EMPTY TEMPLATE INITIALIZATION & DATA-ENTRY TESTS PASSED');
  console.log('========================================================================\n');
}

// Auto-run if executed directly via tsx
if (process.argv[1]?.includes('phase33')) {
  runPhase33EmptyTemplateInitializationAndMakerDataEntryTests().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
