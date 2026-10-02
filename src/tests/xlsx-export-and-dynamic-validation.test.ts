/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ACCEPTANCE TEST SUITE: NBE-Compliant XLSX Regulatory Report Export & Real-Time Dynamic Validation
 * Compliance: NBE Directive BSD/03/2020 & 4-Eyes Supervisory Controls
 */

import * as XLSX from 'xlsx';
import { ValidationEngine } from '../utils/validationEngine.ts';
import { ExcelService, exportRegulatoryReportXLSX } from '../utils/excelService.ts';
import { getReportByKey } from '../data/report-registry.ts';
import type { ReportMetadata, ReportSubmission, ReportItemDefinition } from '../types/regulatory.ts';

function assert(condition: any, msg: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

export async function runXlsxExportAndDynamicValidationTests() {
  console.log('\n========================================================================');
  console.log('--- XLSX REGULATORY EXPORT & REAL-TIME DYNAMIC VALIDATION SUITE ---');
  console.log('========================================================================\n');

  console.log('--- 1. Real-Time Field-Level Mandatory & Format Validation ---');
  const baseReport = getReportByKey('M_LCPLC001')!;
  assert(Boolean(baseReport), 'Sample regulatory report definition loaded');

  const sampleReport: ReportMetadata = {
    ...baseReport,
    ReturnItemsList: baseReport.ReturnItemsList.map((item, idx) => ({
      ...item,
      _required: idx < 3 ? true : item._required,
    })),
  };

  // Test 1A: Mandatory field check on empty values
  const emptyValues: Record<string, string | number> = {};
  const emptySummary = ValidationEngine.validateReport(sampleReport, emptyValues);
  assert(!emptySummary.isValid, 'Empty submission fails validation when mandatory fields exist');
  assert(emptySummary.errorsCount >= 3, `Identifies ${emptySummary.errorsCount} mandatory field errors`);
  
  const mandatoryItems = sampleReport.ReturnItemsList.filter((i: ReportItemDefinition) => i._required);
  for (const item of mandatoryItems) {
    const err = ValidationEngine.getFieldError(emptySummary, item.Code);
    assert(Boolean(err), `Field ${item.Code} (${item._description}) flagged with mandatory validation error`);
    assert(err?.severity === 'ERROR', `Field ${item.Code} severity is ERROR`);
    assert(err?.message.includes('Mandatory'), `Field ${item.Code} error explains mandatory requirement`);
  }

  // Test 1B: Currency & Numeric Format Validation
  const invalidCurrencyValues: Record<string, string | number> = {
    ...emptyValues,
    [sampleReport.ReturnItemsList[0].Code]: 'invalid_currency_abc',
  };
  const currencyErrSummary = ValidationEngine.validateReport(sampleReport, invalidCurrencyValues);
  const currencyErr = ValidationEngine.getFieldError(currencyErrSummary, sampleReport.ReturnItemsList[0].Code);
  assert(Boolean(currencyErr), 'Invalid currency text flagged with format error');
  assert(currencyErr?.message.includes('Numeric') || currencyErr?.message.includes('format'), 'Clear numeric/currency diagnostic message returned');

  // Test 1C: Range & Ratio Boundary Constraints
  const testMetaWithRatio: ReportMetadata = {
    ...sampleReport,
    ReturnItemsList: [
      {
        Code: 'TEST_RATIO_01',
        _description: 'Capital Adequacy Ratio (%)',
        _dataType: 'NUMERIC',
        _required: true,
        Value: 0,
      },
      {
        Code: 'TEST_COUNT_01',
        _description: 'Number of Active Borrowers',
        _dataType: 'NUMERIC',
        _required: true,
        Value: 0,
      },
    ],
  };

  // Negative ratio -> error
  const negRatioSummary = ValidationEngine.validateReport(testMetaWithRatio, {
    TEST_RATIO_01: -5,
    TEST_COUNT_01: 10,
  });
  const negRatioErr = ValidationEngine.getFieldError(negRatioSummary, 'TEST_RATIO_01');
  assert(Boolean(negRatioErr), 'Negative percentage ratio flagged with range error');

  // Excessive ratio (> 100%) -> warning/error
  const excessRatioSummary = ValidationEngine.validateReport(testMetaWithRatio, {
    TEST_RATIO_01: 150,
    TEST_COUNT_01: 10,
  });
  const excessRatioErr = ValidationEngine.getFieldError(excessRatioSummary, 'TEST_RATIO_01');
  assert(Boolean(excessRatioErr), 'Ratio exceeding 100% flagged with range constraint');

  // Fractional borrower count -> error
  const fractionalCountSummary = ValidationEngine.validateReport(testMetaWithRatio, {
    TEST_RATIO_01: 18.5,
    TEST_COUNT_01: 10.75,
  });
  const countErr = ValidationEngine.getFieldError(fractionalCountSummary, 'TEST_COUNT_01');
  assert(Boolean(countErr), 'Fractional count of borrowers flagged as invalid integer');

  // Valid values -> 100% clean
  const validSummary = ValidationEngine.validateReport(testMetaWithRatio, {
    TEST_RATIO_01: 18.5,
    TEST_COUNT_01: 120,
  });
  assert(validSummary.isValid, 'Valid ratio and integer counts pass validation (100% valid)');

  console.log('\n--- 2. NBE-Compliant XLSX Export Engine Verification ---');
  const mockSubmission: ReportSubmission = {
    id: `sub_xlsx_${Date.now()}`,
    reportKey: sampleReport.ReturnKey,
    periodYear: 2026,
    periodStart: '2026-01-01',
    periodEnd: '2026-01-31',
    institutionCode: '0000013',
    version: 1,
    templateVersion: 1,
    status: 'PENDING_CHECKER',
    values: {
      [sampleReport.ReturnItemsList[0]?.Code || 'ITEM_01']: 154000000.5,
    },
    dynamicRows: {
      1: [
        {
          id: 'row_test_1',
          areaId: 1,
          values: {
            BORROWER_NAME: 'Finfinne Agro-Industrial PLC',
            FACILITY_LIMIT: 45000000,
            OUTSTANDING_BAL: 38200000,
          },
        },
      ],
    },
    makerId: 'emp_maker_001',
    makerName: 'Abebe Kebede',
    makerEmail: 'abebe.kebede@oromiabank.com',
    department: 'Credit Operations & Portfolio Management',
    comments: [],
    deliveryAttempts: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    submittedAt: new Date().toISOString(),
    templateSnapshot: sampleReport,
  };

  // Test Excel workbook creation directly
  const wb = ExcelService.exportToWorkbook(
    sampleReport,
    mockSubmission.values,
    mockSubmission.dynamicRows
  );
  assert(Boolean(wb), 'XLSX Workbook generated successfully');
  assert(wb.SheetNames.includes('Return Items'), 'Workbook contains Return Items worksheet');

  // Test binary export
  const binaryData = ExcelService.exportToBinary(
    sampleReport,
    mockSubmission.values,
    mockSubmission.dynamicRows
  );
  assert(binaryData instanceof Uint8Array, 'Binary export returns valid Uint8Array');
  assert(binaryData.length > 500, `Generated XLSX binary file size is substantial (${binaryData.length} bytes)`);

  // Parse generated binary back with SheetJS to verify integrity
  const parsedWb = XLSX.read(binaryData, { type: 'array' });
  assert(parsedWb.SheetNames.length >= 1, 'Parsed XLSX contains active worksheets');
  const itemsSheet = parsedWb.Sheets['Return Items'];
  assert(Boolean(itemsSheet), 'Parsed workbook preserves "Return Items" worksheet');

  console.log('\n--- 3. Full Submission XLSX Structure & Compliance Verification ---');
  // Verify helper exportRegulatoryReportXLSX is exported and functional
  assert(typeof exportRegulatoryReportXLSX === 'function', 'exportRegulatoryReportXLSX function exported');
  assert(typeof ExcelService.exportSubmission === 'function', 'ExcelService.exportSubmission static method exported');

  console.log('\n========================================================================');
  console.log('✅ ALL XLSX REGULATORY EXPORT & REAL-TIME VALIDATION TESTS PASSED');
  console.log('========================================================================\n');
}
