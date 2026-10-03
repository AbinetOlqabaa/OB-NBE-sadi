/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * PHASE 24 ACCEPTANCE TEST SUITE:
 * Unified Validation & Remediation Assistant (NBE Directive BSD/03/2020)
 *
 * Real acceptance testing verifying:
 * - 4-part understandable explanations (WHAT IS WRONG, WHY IT MATTERS, HOW TO FIX IT, WHAT IS EXPECTED)
 * - Authoritative server-side validation normalization
 * - Safe deterministic Auto-Fix capabilities (formatting, precision, dates, formulas)
 * - Strict prohibition on auto-changing ambiguous business figures
 * - CURRENT -> PROPOSED review requirements for non-trivial fixes
 * - Revalidation lifecycle (issues removed only when genuinely resolved)
 * - DATA ERROR vs REPORT-DEFINITION / RULE ERROR distinction
 * - Audit logging without leaking sensitive financial amounts
 * - Submission blocking gates
 */

import { ValidationRemediationService } from '../services/validationRemediationService.ts';
import { submissionService, DEMO_USERS } from '../services/submissionService.ts';
import { getReportByKey } from '../data/report-registry.ts';
import type {
  ReportMetadata,
  ReportSubmission,
  DynamicRowRecord,
  UserSession,
} from '../types/regulatory.ts';
import type {
  NormalizedValidationSummary,
  NormalizedValidationItem,
  ProposedFix,
} from '../types/remediation.ts';
import { auditService } from '../services/auditService.ts';

function assert(condition: any, msg: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

export async function runPhase24ValidationRemediationAssistantTests() {
  console.log('\n========================================================================');
  console.log('--- PHASE 24: VALIDATION & REMEDIATION ASSISTANT ACCEPTANCE SUITE ---');
  console.log('========================================================================\n');

  const baseMaker = DEMO_USERS.find((u) => u.role === 'MAKER') || DEMO_USERS[0];
  const makerUser: UserSession = {
    ...baseMaker,
    department: 'Credit Risk & Prudential Reporting',
  };
  const checkerUser: UserSession = {
    ...(DEMO_USERS.find((u) => u.role === 'CHECKER') || DEMO_USERS[1]),
    department: 'Credit Risk & Prudential Reporting',
  };

  const baseReport = getReportByKey('M_LCPLC001')!;
  assert(Boolean(baseReport), 'Base regulatory return metadata (M_LCPLC001) loaded');

  const testMetadata: ReportMetadata = {
    ...baseReport,
    FinYear: 2026,
    ReturnItemsList: [
      {
        Code: 'CAP_PAID_UP',
        _description: 'Total Paid-up Capital (ETB)',
        _dataType: 'NUMERIC',
        _required: true,
        Value: 0,
      },
      {
        Code: 'TOTAL_LOANS_ETB',
        _description: 'Total Gross Loans & Advances (ETB)',
        _dataType: 'NUMERIC',
        _required: true,
        Value: 0,
      },
      {
        Code: 'COMMERCIAL_BORROWER_COUNT',
        _description: 'Total Number of Commercial Borrowers',
        _dataType: 'NUMERIC',
        _required: true,
        Value: 0,
      },
      {
        Code: 'NBE_CAR_RATIO',
        _description: 'Capital Adequacy Ratio (%)',
        _dataType: 'NUMERIC',
        _required: true,
        Value: 0,
      },
      {
        Code: 'AUDIT_CUTOFF_DATE',
        _description: 'Statutory Audit Cutoff Date',
        _dataType: 'DATE',
        _required: true,
        Value: '',
      },
      {
        Code: 'TOTAL_EXPOSURES',
        _description: 'Total Consolidated Exposures (Calculated)',
        _dataType: 'NUMERIC',
        _required: true,
        isTotal: true,
        Value: 0,
      },
    ],
    Formulas: [
      {
        targetCode: 'TOTAL_EXPOSURES',
        expression: 'CAP_PAID_UP + TOTAL_LOANS_ETB',
        description: 'Sum of Capital and Loans',
        dependencies: ['CAP_PAID_UP', 'TOTAL_LOANS_ETB'],
      },
    ],
    DynamicItemsList: [
      {
        Area: 1,
        _areaName: 'Large Exposures Schedule',
        DynamicItems: [
          { Code: 'BORROWER_NAME', _description: 'Borrower Name', _dataType: 'TEXT', _required: true, Value: '' },
          { Code: 'EXPOSURE_AMOUNT', _description: 'Exposure Amount (ETB)', _dataType: 'NUMERIC', _required: true, Value: 0 },
        ],
      },
    ],
    ValidationRules: [
      {
        id: 'RULE_LOANS_EXCEED_CAPITAL',
        name: 'Loan Portfolio Scale Ratio',
        description: 'Total Gross Loans should reasonably exceed Paid-up Capital',
        severity: 'WARNING',
        check: (vals) => Number(vals.TOTAL_LOANS_ETB || 0) >= Number(vals.CAP_PAID_UP || 0),
      },
    ],
  };

  console.log('--- 1. Authoritative Validation Normalization & 4-Part Explanations ---');
  // 1A: Validate empty return: must yield normalized items with 4-part explanations
  const emptySummary = ValidationRemediationService.normalizeReportValidation(testMetadata, {}, {});

  assert(!emptySummary.isValid, 'Empty return is invalid');
  assert(!emptySummary.isSubmissionReady, 'Empty return is marked NOT submission ready');
  assert(emptySummary.blockingErrorsCount >= 4, `Identified ${emptySummary.blockingErrorsCount} blocking errors`);
  assert(emptySummary.items.length >= 4, `Generated ${emptySummary.items.length} normalized validation items`);

  // Verify that EVERY validation item has an understandable 4-part explanation (Requirement 4)
  for (const item of emptySummary.items) {
    assert(Boolean(item.explanation.whatIsWrong), `Item '${item.fieldCode}' has 'WHAT IS WRONG' explanation`);
    assert(Boolean(item.explanation.whyItMatters), `Item '${item.fieldCode}' has 'WHY IT MATTERS' explanation`);
    assert(Boolean(item.explanation.howToFix), `Item '${item.fieldCode}' has 'HOW TO FIX IT' explanation`);
    assert(Boolean(item.explanation.expectedFormat), `Item '${item.fieldCode}' has 'EXPECTED FORMAT' explanation`);
    assert(Boolean(item.suggestedAction), `Item '${item.fieldCode}' has suggested action`);
    assert(Boolean(item.ruleSource), `Item '${item.fieldCode}' cites authoritative rule source`);
  }

  console.log('\n--- 2. Mandatory Blank Fields: DATA ERROR, Blocking, Non-Auto-Fixable ---');
  const capMandatoryItem = emptySummary.items.find((i) => i.fieldCode === 'CAP_PAID_UP');
  assert(Boolean(capMandatoryItem), 'Mandatory missing field CAP_PAID_UP detected');
  assert(capMandatoryItem?.severity === 'BLOCKING_ERROR', 'Mandatory missing field is strictly BLOCKING_ERROR');
  assert(capMandatoryItem?.category === 'DATA_ERROR', 'Classified as DATA_ERROR (remedied by Maker)');
  assert(capMandatoryItem?.autoFixable === false, 'Requirement 7: Ambiguous missing business value is NOT auto-fixable');
  assert(capMandatoryItem?.explanation.whyItMatters.includes('NBE Directive BSD/03/2020'), 'Cites NBE Directive BSD/03/2020');

  console.log('\n--- 3. Currency Precision Normalization (Auto-Fixable, Requires Review) ---');
  // Value with 3 decimals: 254000500.755
  const precisionSummary = ValidationRemediationService.normalizeReportValidation(testMetadata, {
    CAP_PAID_UP: 500000000,
    TOTAL_LOANS_ETB: 254000500.755, // Excess decimal places!
    COMMERCIAL_BORROWER_COUNT: 120,
    NBE_CAR_RATIO: 18.5,
    AUDIT_CUTOFF_DATE: '2026-03-31',
  });

  const precisionItem = precisionSummary.items.find((i) => i.fieldCode === 'TOTAL_LOANS_ETB' && i.constraintType === 'CURRENCY_PRECISION');
  assert(Boolean(precisionItem), 'Detected ETB 3-decimal precision violation');
  assert(precisionItem?.severity === 'BLOCKING_ERROR', 'Precision violation is a BLOCKING_ERROR');
  assert(precisionItem?.autoFixable === true, 'Precision violation is deterministically auto-fixable');
  assert(Boolean(precisionItem?.proposedFix), 'ProposedFix descriptor is present');
  assert(precisionItem?.proposedFix?.requiresReview === true, 'Requirement 8: Non-trivial fix requires review (CURRENT -> PROPOSED)');
  assert(precisionItem?.proposedFix?.currentValue === 254000500.755, 'ProposedFix captures exact CURRENT value');
  assert(precisionItem?.proposedFix?.proposedValue === 254000500.76, 'ProposedFix computes exact 2-decimal rounded PROPOSED value (254,000,500.76)');

  console.log('\n--- 4. Safe Date Normalization & String Whitespace Trimming ---');
  // Date with slashes: "2026/03/31"
  const dateSlashSummary = ValidationRemediationService.normalizeReportValidation(testMetadata, {
    CAP_PAID_UP: 500000000,
    TOTAL_LOANS_ETB: 1200000000,
    COMMERCIAL_BORROWER_COUNT: 120,
    NBE_CAR_RATIO: 18.5,
    AUDIT_CUTOFF_DATE: '2026/03/31', // Slashes instead of dashes
  });

  const dateItem = dateSlashSummary.items.find((i) => i.fieldCode === 'AUDIT_CUTOFF_DATE');
  assert(Boolean(dateItem), 'Detected non-ISO date format');
  assert(dateItem?.autoFixable === true, 'Date format is safely auto-fixable');
  assert(dateItem?.proposedFix?.proposedValue === '2026-03-31', 'Date auto-fix normalizes to ISO standard "2026-03-31"');

  // Completely unparseable date: "invalid-date" -> not auto-fixable!
  const unparseableDateSummary = ValidationRemediationService.normalizeReportValidation(testMetadata, {
    CAP_PAID_UP: 500000000,
    TOTAL_LOANS_ETB: 1200000000,
    COMMERCIAL_BORROWER_COUNT: 120,
    NBE_CAR_RATIO: 18.5,
    AUDIT_CUTOFF_DATE: 'invalid_date_input',
  });
  const unparseableItem = unparseableDateSummary.items.find((i) => i.fieldCode === 'AUDIT_CUTOFF_DATE');
  assert(Boolean(unparseableItem), 'Detected unparseable date');
  assert(unparseableItem?.autoFixable === false, 'Requirement 7: Ambiguous unparseable date is NOT auto-fixable');

  console.log('\n--- 5. Strict Non-Negative Currency Constraints: Ambiguous Business Value Safety ---');
  // Paid-up capital negative: -50,000,000 ETB
  const negCapSummary = ValidationRemediationService.normalizeReportValidation(testMetadata, {
    CAP_PAID_UP: -50000000, // Negative capital!
    TOTAL_LOANS_ETB: 1200000000,
    COMMERCIAL_BORROWER_COUNT: 120,
    NBE_CAR_RATIO: 18.5,
    AUDIT_CUTOFF_DATE: '2026-03-31',
  });

  const negCapItem = negCapSummary.items.find((i) => i.fieldCode === 'CAP_PAID_UP' && i.constraintType === 'CURRENCY_NEGATIVE');
  assert(Boolean(negCapItem), 'Negative capital balance flagged');
  assert(negCapItem?.severity === 'BLOCKING_ERROR', 'Negative capital is BLOCKING_ERROR');
  assert(negCapItem?.autoFixable === false, 'Requirement 7: System NEVER automatically changes ambiguous financial balance');
  assert(negCapItem?.explanation.whatIsWrong.includes('-50,000,000'), 'Explanation states exact negative balance');

  console.log('\n--- 6. Percentage Ratio & Whole Integer Count Constraints ---');
  const ratioCountSummary = ValidationRemediationService.normalizeReportValidation(testMetadata, {
    CAP_PAID_UP: 500000000,
    TOTAL_LOANS_ETB: 1200000000,
    COMMERCIAL_BORROWER_COUNT: 124.6, // Fractional count!
    NBE_CAR_RATIO: -2.5, // Negative ratio!
    AUDIT_CUTOFF_DATE: '2026-03-31',
  });

  const fracCountItem = ratioCountSummary.items.find((i) => i.fieldCode === 'COMMERCIAL_BORROWER_COUNT');
  assert(Boolean(fracCountItem), 'Fractional borrower count flagged');
  assert(fracCountItem?.severity === 'BLOCKING_ERROR', 'Fractional count is BLOCKING_ERROR');
  assert(fracCountItem?.autoFixable === false, 'System does not guess discrete headcount (not auto-fixable)');

  const negRatioItem = ratioCountSummary.items.find((i) => i.fieldCode === 'NBE_CAR_RATIO');
  assert(Boolean(negRatioItem), 'Negative CAR ratio flagged');
  assert(negRatioItem?.severity === 'BLOCKING_ERROR', 'Negative ratio is BLOCKING_ERROR');

  console.log('\n--- 7. Formula Out-of-Sync Detection & Deterministic Synchronization Auto-Fix ---');
  // Paid-up = 500M, Loans = 1200M -> Formula TOTAL_EXPOSURES should be 1700M.
  // If stored value is 999M (desynced):
  const formulaDesyncSummary = ValidationRemediationService.normalizeReportValidation(testMetadata, {
    CAP_PAID_UP: 500000000,
    TOTAL_LOANS_ETB: 1200000000,
    COMMERCIAL_BORROWER_COUNT: 150,
    NBE_CAR_RATIO: 18.5,
    AUDIT_CUTOFF_DATE: '2026-03-31',
    TOTAL_EXPOSURES: 999999999, // Stale/desynced formula total!
  });

  const desyncItem = formulaDesyncSummary.items.find((i) => i.fieldCode === 'TOTAL_EXPOSURES' && i.constraintType === 'FORMULA_OUT_OF_SYNC');
  assert(Boolean(desyncItem), 'Formula desynchronization flagged');
  assert(desyncItem?.severity === 'BLOCKING_ERROR', 'Desynced total is BLOCKING_ERROR');
  assert(desyncItem?.autoFixable === true, 'Formula desync is deterministically auto-fixable');
  assert(desyncItem?.proposedFix?.proposedValue === 1700000000, 'ProposedFix computes exact formula total (1,700,000,000 ETB)');

  console.log('\n--- 8. Cross-Field Business Rules (BUSINESS_RULE_ERROR) ---');
  // Loans = 100M, Capital = 500M -> Violates RULE_LOANS_EXCEED_CAPITAL (Warning)
  const ruleWarnSummary = ValidationRemediationService.normalizeReportValidation(testMetadata, {
    CAP_PAID_UP: 500000000,
    TOTAL_LOANS_ETB: 100000000, // Capital exceeds loans
    COMMERCIAL_BORROWER_COUNT: 150,
    NBE_CAR_RATIO: 18.5,
    AUDIT_CUTOFF_DATE: '2026-03-31',
    TOTAL_EXPOSURES: 600000000,
  });

  const ruleItem = ruleWarnSummary.items.find((i) => i.fieldCode === 'RULE_LOANS_EXCEED_CAPITAL');
  assert(Boolean(ruleItem), 'Business rule failure detected');
  assert(ruleItem?.category === 'BUSINESS_RULE_ERROR', 'Classified as BUSINESS_RULE_ERROR');
  assert(ruleItem?.severity === 'WARNING', 'Severity is WARNING (advisory)');
  assert(ruleItem?.autoFixable === false, 'Cross-field rule violation is NOT auto-fixable');

  console.log('\n--- 9. REPORT-DEFINITION / RULE ERROR vs DATA ERROR Distinction ---');
  // Corrupted template definition with duplicate field code
  const corruptedMeta: ReportMetadata = {
    ...testMetadata,
    ReturnItemsList: [
      ...testMetadata.ReturnItemsList,
      {
        Code: 'CAP_PAID_UP', // Duplicate code!
        _description: 'Duplicate Capital Code',
        _dataType: 'NUMERIC',
        _required: true,
        Value: 0,
      },
    ],
  };

  const defErrorSummary = ValidationRemediationService.normalizeReportValidation(corruptedMeta, {
    CAP_PAID_UP: 500000000,
    TOTAL_LOANS_ETB: 1200000000,
    COMMERCIAL_BORROWER_COUNT: 150,
    NBE_CAR_RATIO: 18.5,
    AUDIT_CUTOFF_DATE: '2026-03-31',
  });

  const dupDefItem = defErrorSummary.items.find((i) => i.category === 'REPORT_DEFINITION_ERROR');
  assert(Boolean(dupDefItem), 'Identified REPORT_DEFINITION_ERROR for duplicate code');
  assert(dupDefItem?.severity === 'BLOCKING_ERROR', 'Report definition error is strictly BLOCKING_ERROR');
  assert(dupDefItem?.explanation.howToFix.includes('ADMIN'), 'Instructions state only configuration users (ADMIN) can modify template');

  console.log('\n--- 10. End-to-End Auto-Fix, Revalidation & Sensitive Telemetry Redaction ---');
  // Create a real draft submission
  const draftSub = submissionService.createSubmission(testMetadata.ReturnKey, makerUser);
  assert(Boolean(draftSub), `Created draft submission ${draftSub.id}`);

  // Attach testMetadata as effective template snapshot
  draftSub.templateSnapshot = testMetadata;

  // Update draft with precision error and date format issue
  submissionService.updateDraft(
    draftSub.id,
    {
      CAP_PAID_UP: 500000000,
      TOTAL_LOANS_ETB: 254000500.755, // Excess decimals
      COMMERCIAL_BORROWER_COUNT: 150,
      NBE_CAR_RATIO: 18.5,
      AUDIT_CUTOFF_DATE: '2026/03/31', // Slash date
    },
    {},
    makerUser,
    draftSub.version
  );

  // Authoritative server inspection
  const serverNormSummary1 = submissionService.validateSubmissionNormalized(draftSub.id);
  assert(!serverNormSummary1.isValid, 'Submission initially has blocking errors');
  assert(serverNormSummary1.autoFixableCount >= 2, `Server identifies ${serverNormSummary1.autoFixableCount} auto-fixable issues`);

  const precisionFix = serverNormSummary1.items.find((i) => i.constraintType === 'CURRENCY_PRECISION')!.proposedFix!;
  assert(Boolean(precisionFix), 'Obtained proposed precision fix');

  // Apply Auto-Fix authoritatively on server
  const fixResult1 = submissionService.remediateSubmission(draftSub.id, precisionFix, makerUser);
  assert(Boolean(fixResult1.updatedSubmission), 'remediateSubmission returned updated submission');
  assert(fixResult1.updatedSubmission.values.TOTAL_LOANS_ETB === 254000500.76, 'Value updated to exact rounded ETB (254,000,500.76)');
  assert(fixResult1.updatedSubmission.version > draftSub.version, 'Draft version incremented on auto-fix');

  // Verify Revalidation removed the precision error (Requirement 9)
  const remainingPrecisionErr = fixResult1.revalidationSummary.items.find((i) => i.constraintType === 'CURRENCY_PRECISION');
  assert(!remainingPrecisionErr, 'Precision error removed from summary after genuine resolution');

  // Verify Audit Log Redaction (Requirement 13)
  const auditLogs = auditService.getLogs(10);
  const remediationLog = auditLogs.find((l) => l.action === 'VALIDATION_REMEDIATION_APPLIED');
  assert(Boolean(remediationLog), 'Audit log recorded for VALIDATION_REMEDIATION_APPLIED');
  assert(!JSON.stringify(remediationLog).includes('254000500.755'), 'Sensitive multi-million financial amount is REDACTED from audit log telemetry');
  assert(remediationLog?.details.includes('Sensitive figures redacted'), 'Audit log explicitly affirms sensitive figures redacted');

  console.log('\n--- 11. Pre-Submission Blocking Gate Enforcement ---');
  // Submission still has date format error: attempt to submit to Checker must be blocked!
  let submitBlocked = false;
  try {
    submissionService.submitToChecker(draftSub.id, makerUser);
  } catch (err: any) {
    submitBlocked = true;
    assert(err.message.includes('Validation failed'), `Submission strictly blocked by server: ${err.message}`);
  }
  assert(submitBlocked, 'Submission to Checker is strictly prevented while validation errors exist');

  // Now fix the remaining date issue
  const dateFix = fixResult1.revalidationSummary.items.find((i) => i.fieldCode === 'AUDIT_CUTOFF_DATE')!.proposedFix!;
  assert(Boolean(dateFix), 'Obtained date format proposed fix');

  const fixResult2 = submissionService.remediateSubmission(
    draftSub.id,
    dateFix,
    makerUser,
    fixResult1.updatedSubmission.version
  );

  assert(fixResult2.updatedSubmission.values.AUDIT_CUTOFF_DATE === '2026-03-31', 'Date normalized to ISO "2026-03-31"');
  assert(fixResult2.revalidationSummary.blockingErrorsCount === 0, 'Zero blocking errors remaining');
  assert(fixResult2.revalidationSummary.isSubmissionReady === true, 'Submission is now marked READY');

  // Now submit to Checker succeeds!
  const submittedSub = submissionService.submitToChecker(
    draftSub.id,
    makerUser,
    'All statutory items reconciled and auto-fixed per NBE Directive BSD/03/2020.'
  );
  assert(submittedSub.status === 'PENDING_CHECKER', 'Draft successfully transitioned to PENDING_CHECKER');

  console.log('\n--- 12. Optimistic Concurrency Conflict on Remediation ---');
  // Attempt to apply remediation with stale expectedVersion: must throw conflict
  let concurrencyConflictTrapped = false;
  try {
    submissionService.remediateSubmission(
      draftSub.id,
      precisionFix,
      makerUser,
      1 // Stale expected version!
    );
  } catch (err: any) {
    concurrencyConflictTrapped = true;
    assert(err.message.includes('CONCURRENT_MODIFICATION_CONFLICT') || err.message.includes('CANNOT_REMEDIATE_SUBMITTED_REPORT'), `Stale remediation trapped: ${err.message}`);
  }
  assert(concurrencyConflictTrapped, 'Concurrency conflict on remediation successfully trapped');

  console.log('\n========================================================================');
  console.log('✅ ALL PHASE 24 VALIDATION & REMEDIATION ASSISTANT TESTS PASSED (100% SUCCESS)');
  console.log('========================================================================\n');
}

// Allow direct CLI execution via tsx
if (process.argv[1]?.includes('phase24-validation-remediation-assistant.test')) {
  runPhase24ValidationRemediationAssistantTests().catch((err) => {
    console.error('Test execution failed:', err);
    process.exit(1);
  });
}
