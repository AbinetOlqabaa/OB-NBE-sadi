/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * PHASE 21 ACCEPTANCE TEST SUITE: Real-Time Field-Level Validation
 * Compliance: NBE Directive BSD/03/2020 & 4-Eyes Supervisory Validation Gate
 */

import { ValidationEngine } from '../utils/validationEngine.ts';
import { getReportByKey } from '../data/report-registry.ts';
import type { ReportMetadata, ReportItemDefinition } from '../types/regulatory.ts';

function assert(condition: any, msg: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

export async function runPhase21RealtimeFieldLevelValidationTests() {
  console.log('\n========================================================================');
  console.log('--- PHASE 21: REAL-TIME FIELD-LEVEL VALIDATION ACCEPTANCE SUITE ---');
  console.log('========================================================================\n');

  console.log('--- 1. Mandatory Field Real-Time Validation ---');
  const baseReport = getReportByKey('M_LCPLC001')!;
  assert(Boolean(baseReport), 'Canonical report loaded');

  const reportWithMandatory: ReportMetadata = {
    ...baseReport,
    ReturnItemsList: baseReport.ReturnItemsList.map((item, idx) => ({
      ...item,
      _required: idx < 3 ? true : item._required,
    })),
  };

  // Test with empty values
  const emptyValues: Record<string, string | number> = {};
  const emptySummary = ValidationEngine.validateReport(reportWithMandatory, emptyValues);
  assert(!emptySummary.isValid, 'Empty return fails validation when mandatory items exist');
  assert(emptySummary.errorsCount >= 3, `Identifies ${emptySummary.errorsCount} mandatory missing fields`);

  const mandatoryList = reportWithMandatory.ReturnItemsList.filter((i: ReportItemDefinition) => i._required);
  for (const item of mandatoryList) {
    const err = ValidationEngine.getFieldError(emptySummary, item.Code);
    assert(Boolean(err), `Field ${item.Code} flagged with mandatory validation error`);
    assert(err?.severity === 'ERROR', `Field ${item.Code} error severity is ERROR`);
    assert(err?.message.includes('Mandatory'), `Field ${item.Code} error message describes mandatory requirement`);
    assert(ValidationEngine.hasFieldError(emptySummary, item.Code), `hasFieldError returns true for ${item.Code}`);
  }

  console.log('\n--- 2. Currency & Decimal Format Constraints ---');
  const invalidCurrencyValues: Record<string, string | number> = {
    ...emptyValues,
    [reportWithMandatory.ReturnItemsList[0].Code]: 'invalid_currency_text',
  };
  const currencyErrSummary = ValidationEngine.validateReport(reportWithMandatory, invalidCurrencyValues);
  const currencyErr = ValidationEngine.getFieldError(currencyErrSummary, reportWithMandatory.ReturnItemsList[0].Code);
  assert(Boolean(currencyErr), 'Invalid non-numeric string in numeric field flagged with error');
  assert(
    currencyErr?.message.includes('Numeric') || currencyErr?.message.includes('format'),
    'Descriptive numeric format error returned'
  );

  // Test 2B: Currency decimal precision (maximum 2 decimal places for ETB currency figures)
  const excessDecimalsValues: Record<string, string | number> = {
    ...emptyValues,
    [reportWithMandatory.ReturnItemsList[0].Code]: 1500000.755,
  };
  const precisionSummary = ValidationEngine.validateReport(reportWithMandatory, excessDecimalsValues);
  const precisionErr = ValidationEngine.getFieldError(precisionSummary, reportWithMandatory.ReturnItemsList[0].Code);
  assert(Boolean(precisionErr), 'Currency figure with >2 decimal places flagged with precision error');
  assert(precisionErr?.message.includes('precision'), 'Error message specifically cites currency precision limit');

  // Test 2C: Currency strictly non-negative balance constraint
  const testCapitalReport: ReportMetadata = {
    ...baseReport,
    ReturnItemsList: [
      {
        Code: 'CAP_PAID_UP_01',
        _description: 'Total Paid-up Capital (ETB)',
        _dataType: 'NUMERIC',
        _required: true,
        Value: 0,
      },
    ],
  };
  const negCapitalSummary = ValidationEngine.validateReport(testCapitalReport, {
    CAP_PAID_UP_01: -50000000,
  });
  const negCapitalErr = ValidationEngine.getFieldError(negCapitalSummary, 'CAP_PAID_UP_01');
  assert(Boolean(negCapitalErr), 'Negative balance in capital account flagged with currency constraint error');
  assert(negCapitalErr?.severity === 'ERROR', 'Negative capital balance severity is ERROR');
  assert(negCapitalErr?.message.includes('negative balance'), 'Error message cites negative balance prohibition');

  console.log('\n--- 3. Range Constraints & Capital Adequacy Ratio Checks ---');
  const testRatioReport: ReportMetadata = {
    ...baseReport,
    ReturnItemsList: [
      {
        Code: 'NBE_CAR_01',
        _description: 'Total Capital Adequacy Ratio (%)',
        _dataType: 'NUMERIC',
        _required: true,
        Value: 0,
      },
      {
        Code: 'NBE_BORROWER_COUNT',
        _description: 'Total Number of Commercial Borrowers',
        _dataType: 'NUMERIC',
        _required: true,
        Value: 0,
      },
      {
        Code: 'NBE_NPL_TOTAL',
        _description: 'Total Non-Performing Loans (ETB)',
        _dataType: 'NUMERIC',
        _required: true,
        Value: 0,
      },
    ],
  };

  // Test 3A: Negative percentage ratio
  const negRatioSummary = ValidationEngine.validateReport(testRatioReport, {
    NBE_CAR_01: -8.5,
    NBE_BORROWER_COUNT: 45,
    NBE_NPL_TOTAL: 1500000,
  });
  const negRatioErr = ValidationEngine.getFieldError(negRatioSummary, 'NBE_CAR_01');
  assert(Boolean(negRatioErr), 'Negative percentage ratio flagged with range error');

  // Test 3B: Ratio exceeding 100%
  const excessRatioSummary = ValidationEngine.validateReport(testRatioReport, {
    NBE_CAR_01: 145.0,
    NBE_BORROWER_COUNT: 45,
    NBE_NPL_TOTAL: 1500000,
  });
  const excessRatioErr = ValidationEngine.getFieldError(excessRatioSummary, 'NBE_CAR_01');
  assert(Boolean(excessRatioErr), 'Ratio > 100% flagged with range limit warning');

  // Test 3C: Fractional borrower count (must be whole number)
  const fractionalCountSummary = ValidationEngine.validateReport(testRatioReport, {
    NBE_CAR_01: 17.5,
    NBE_BORROWER_COUNT: 45.75,
    NBE_NPL_TOTAL: 1500000,
  });
  const countErr = ValidationEngine.getFieldError(fractionalCountSummary, 'NBE_BORROWER_COUNT');
  assert(Boolean(countErr), 'Fractional count for whole number borrower field flagged with integer error');

  // Test 3D: Valid values pass 100%
  const validSummary = ValidationEngine.validateReport(testRatioReport, {
    NBE_CAR_01: 17.5,
    NBE_BORROWER_COUNT: 45,
    NBE_NPL_TOTAL: 1500000,
  });
  assert(validSummary.isValid, 'Clean, compliant field values pass all real-time validation checks');
  assert(validSummary.errorsCount === 0, 'Zero errors reported on valid return');

  console.log('\n--- 4. Pre-Submission Gate Verification ---');
  // Validation summary determines eligibility for submission to Checker queue
  assert(!emptySummary.isValid, 'Pre-submission gate blocks submission when errors exist (isValid === false)');
  assert(validSummary.isValid, 'Pre-submission gate unlocks when form is valid (isValid === true)');

  console.log('\n========================================================================');
  console.log('✅ ALL PHASE 21 REAL-TIME FIELD-LEVEL VALIDATION TESTS PASSED (100% SUCCESS)');
  console.log('========================================================================\n');
}
