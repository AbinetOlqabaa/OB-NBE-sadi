/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * PHASE 24 ACCEPTANCE TEST SUITE: Zod Real-Time Validation Service
 * Regulatory Compliance: NBE Directive BSD/03/2020 & Real-Time Supervisory Gate
 */

import {
  ZodValidationService,
  FormValidationState,
  ZodFieldError,
} from '../services/zodValidationService.ts';
import { getReportByKey } from '../data/report-registry.ts';
import type { ReportMetadata, ReportItemDefinition, DynamicRowRecord } from '../types/regulatory.ts';

function assert(condition: any, msg: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

export async function runPhase24ZodRealtimeValidationTests() {
  console.log('\n========================================================================');
  console.log('--- PHASE 24: ZOD REAL-TIME VALIDATION SERVICE ACCEPTANCE SUITE ---');
  console.log('========================================================================\n');

  console.log('--- 1. Zod Schema Generation & Compilation ---');
  const baseReport = getReportByKey('M_LCPLC001')!;
  assert(Boolean(baseReport), 'Base regulatory return metadata (M_LCPLC001) loaded');

  const reportMetadata: ReportMetadata = {
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
        Code: 'NBE_CAR_RATIO',
        _description: 'Capital Adequacy Ratio (%)',
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
        Code: 'TOTAL_LOANS_ETB',
        _description: 'Total Gross Loans & Advances (ETB)',
        _dataType: 'NUMERIC',
        _required: true,
        Value: 0,
      },
      {
        Code: 'AUDIT_CLOSE_DATE',
        _description: 'Audit Cut-off Date',
        _dataType: 'DATE',
        _required: false,
        Value: '',
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
  };

  const zodObjectSchema = ZodValidationService.buildReportSchema(reportMetadata);
  assert(Boolean(zodObjectSchema), 'Zod schema compiled dynamically from ReportMetadata items');
  assert(Boolean(zodObjectSchema.shape.CAP_PAID_UP), 'Zod schema shape contains CAP_PAID_UP item validator');
  assert(Boolean(zodObjectSchema.shape.NBE_CAR_RATIO), 'Zod schema shape contains NBE_CAR_RATIO item validator');

  console.log('\n--- 2. Real-Time Mandatory Field Validation via Zod ---');
  // 2A: Empty return data fails mandatory validation
  const emptyValues: Record<string, string | number> = {};
  const emptyValidation = ZodValidationService.validateReport(reportMetadata, emptyValues);

  assert(!emptyValidation.isValid, 'Empty submission fails Zod schema validation');
  assert(emptyValidation.errorsCount >= 3, `Identified ${emptyValidation.errorsCount} mandatory missing fields`);
  assert(emptyValidation.hasError('CAP_PAID_UP'), 'hasError("CAP_PAID_UP") returns true');
  assert(emptyValidation.hasError('NBE_CAR_RATIO'), 'hasError("NBE_CAR_RATIO") returns true');
  assert(emptyValidation.hasError('COMMERCIAL_BORROWER_COUNT'), 'hasError("COMMERCIAL_BORROWER_COUNT") returns true');

  const capErr = emptyValidation.getFieldError('CAP_PAID_UP');
  assert(Boolean(capErr), 'getFieldError("CAP_PAID_UP") returns ZodFieldError');
  assert(capErr?.constraintType === 'MANDATORY', 'Constraint type classified as MANDATORY');
  assert(capErr?.message.includes('mandatory regulatory field'), 'Message explicitly cites mandatory regulatory requirement');

  // 2B: Instant single-field validation check
  const singleErr = ZodValidationService.validateSingleField(reportMetadata.ReturnItemsList[0], '');
  assert(Boolean(singleErr), 'validateSingleField flags empty mandatory value');
  assert(singleErr?.constraintType === 'MANDATORY', 'Single-field validator reports MANDATORY constraint type');

  console.log('\n--- 3. Currency Precision Constraints via Zod (Max 2 Decimals for ETB) ---');
  // Valid 2-decimal figure
  const validCurrencyErr = ZodValidationService.validateSingleField(
    reportMetadata.ReturnItemsList[3], // TOTAL_LOANS_ETB
    254000500.75
  );
  assert(validCurrencyErr === null, '2-decimal currency amount (254,000,500.75 ETB) passes validation');

  // Invalid 3-decimal figure
  const invalidPrecisionErr = ZodValidationService.validateSingleField(
    reportMetadata.ReturnItemsList[3],
    254000500.755
  );
  assert(Boolean(invalidPrecisionErr), '3-decimal currency amount flagged by Zod');
  assert(invalidPrecisionErr?.constraintType === 'CURRENCY_PRECISION', 'Error classified as CURRENCY_PRECISION');
  assert(invalidPrecisionErr?.message.includes('cannot exceed 2 decimal places'), 'Error message specifies 2 decimal places');

  console.log('\n--- 4. Non-Negative Currency Constraints via Zod ---');
  // Capital/deposit/reserve accounts cannot carry a negative balance
  const negCapitalErr = ZodValidationService.validateSingleField(
    reportMetadata.ReturnItemsList[0], // CAP_PAID_UP
    -5000000
  );
  assert(Boolean(negCapitalErr), 'Negative paid-up capital flagged by Zod validator');
  assert(negCapitalErr?.constraintType === 'CURRENCY_NEGATIVE', 'Classified as CURRENCY_NEGATIVE constraint');
  assert(negCapitalErr?.severity === 'ERROR', 'Severity is strictly ERROR');
  assert(negCapitalErr?.message.includes('cannot carry a negative balance'), 'Message indicates negative balance violation');

  console.log('\n--- 5. Percentage Range & Whole Number Constraints via Zod ---');
  // Ratio cannot be negative
  const negRatioErr = ZodValidationService.validateSingleField(
    reportMetadata.ReturnItemsList[1], // NBE_CAR_RATIO
    -2.5
  );
  assert(Boolean(negRatioErr), 'Negative percentage ratio flagged by Zod');
  assert(negRatioErr?.constraintType === 'RANGE', 'Classified as RANGE constraint');

  // Fractional count for commercial borrowers (must be integer >= 0)
  const fractionalCountErr = ZodValidationService.validateSingleField(
    reportMetadata.ReturnItemsList[2], // COMMERCIAL_BORROWER_COUNT
    124.6
  );
  assert(Boolean(fractionalCountErr), 'Fractional count for commercial borrower count flagged by Zod');
  assert(fractionalCountErr?.constraintType === 'RANGE', 'Count error classified as RANGE constraint');
  assert(fractionalCountErr?.message.includes('whole integer'), 'Message instructs whole integer required');

  console.log('\n--- 6. Dynamic Repeatable Schedule Cell Validation ---');
  const dynamicRows: Record<number, DynamicRowRecord[]> = {
    1: [
      {
        id: 'row_dyn_01',
        areaId: 1,
        values: {
          BORROWER_NAME: 'Bishoftu Agro Industries S.C.',
          EXPOSURE_AMOUNT: 45000000,
        },
      },
      {
        id: 'row_dyn_02',
        areaId: 1,
        values: {
          BORROWER_NAME: '', // Empty mandatory
          EXPOSURE_AMOUNT: 'invalid_numeric', // Invalid format
        },
      },
    ],
  };

  const dynamicValidation = ZodValidationService.validateReport(
    reportMetadata,
    {
      CAP_PAID_UP: 500000000,
      NBE_CAR_RATIO: 18.2,
      COMMERCIAL_BORROWER_COUNT: 125,
      TOTAL_LOANS_ETB: 1200000000,
    },
    dynamicRows
  );

  assert(!dynamicValidation.isValid, 'Dynamic schedule errors invalidate report');
  const dynCellErr1 = dynamicValidation.getDynamicError(1, 'row_dyn_02', 'BORROWER_NAME');
  assert(Boolean(dynCellErr1), 'Identifies empty mandatory cell in dynamic row');
  assert(dynCellErr1?.constraintType === 'MANDATORY', 'Dynamic cell error classified as MANDATORY');

  const dynCellErr2 = dynamicValidation.getDynamicError(1, 'row_dyn_02', 'EXPOSURE_AMOUNT');
  assert(Boolean(dynCellErr2), 'Identifies invalid numeric format in dynamic cell');
  assert(dynCellErr2?.constraintType === 'FORMAT', 'Dynamic cell format error classified as FORMAT');

  console.log('\n--- 7. UI Error State Object Completeness & Performance ---');
  // Fully compliant return data
  const compliantValues: Record<string, string | number> = {
    CAP_PAID_UP: 500000000,
    NBE_CAR_RATIO: 18.5,
    COMMERCIAL_BORROWER_COUNT: 150,
    TOTAL_LOANS_ETB: 2500000000,
    AUDIT_CLOSE_DATE: '2026-01-31',
  };

  const compliantDynamic: Record<number, DynamicRowRecord[]> = {
    1: [
      {
        id: 'row_dyn_clean',
        areaId: 1,
        values: {
          BORROWER_NAME: 'Bishoftu Agro Industries S.C.',
          EXPOSURE_AMOUNT: 45000000,
        },
      },
    ],
  };

  const cleanValidation = ZodValidationService.validateReport(reportMetadata, compliantValues, compliantDynamic);
  assert(cleanValidation.isValid, 'Compliant data produces clean FormValidationState (isValid: true)');
  assert(cleanValidation.errorsCount === 0, 'Zero errors reported on compliant submission');
  assert(cleanValidation.allErrors.length === 0, 'allErrors array is empty');
  assert(typeof cleanValidation.hasError === 'function', 'Exposes hasError helper function');
  assert(typeof cleanValidation.getFieldError === 'function', 'Exposes getFieldError helper function');
  assert(typeof cleanValidation.getDynamicError === 'function', 'Exposes getDynamicError helper function');
  assert(Boolean(cleanValidation.timestamp), 'Captures authoritative validation timestamp');

  console.log('\n========================================================================');
  console.log('✅ ALL PHASE 24 ZOD REAL-TIME VALIDATION TESTS PASSED (100% SUCCESS)');
  console.log('========================================================================\n');
}
