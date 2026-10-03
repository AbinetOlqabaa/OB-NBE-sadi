/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * PHASE 22 ACCEPTANCE TEST SUITE: SheetJS .xlsx Export for NBE-Compliant Offline Review
 * Regulatory Directives: NBE Directive BSD/03/2020 & 4-Eyes Supervisory Audit Trail
 */

import * as XLSX from 'xlsx';
import {
  generateRegulatoryReportWorkbook,
  exportRegulatoryReportXLSX,
} from '../utils/regulatoryReportXlsxExport.ts';
import { ExcelService } from '../utils/excelService.ts';
import { getReportByKey } from '../data/report-registry.ts';
import type { ReportMetadata, ReportSubmission } from '../types/regulatory.ts';

function assert(condition: any, msg: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

export async function runPhase22XlsxSheetJsExportTests() {
  console.log('\n========================================================================');
  console.log('--- PHASE 22: SHEETJS .XLSX EXPORT ACCEPTANCE SUITE ---');
  console.log('========================================================================\n');

  console.log('--- 1. Submission & Metadata Model Preparation ---');
  const baseReport = getReportByKey('M_LCPLC001')!;
  assert(Boolean(baseReport), 'Canonical NBE regulatory return (M_LCPLC001) loaded');

  const testReport: ReportMetadata = {
    ...baseReport,
    FinYear: 2026,
    ReturnItemsList: baseReport.ReturnItemsList.map((item, idx) => ({
      ...item,
      _required: idx < 3 ? true : item._required,
    })),
    DynamicItemsList: [
      {
        Area: 1,
        _areaName: 'Large Exposures Schedule',
        DynamicItems: [
          { Code: 'BORROWER_NAME', _description: 'Borrower Name', _dataType: 'TEXT', _required: true, Value: '' },
          { Code: 'FACILITY_LIMIT', _description: 'Approved Limit (ETB)', _dataType: 'NUMERIC', _required: true, Value: 0 },
          { Code: 'OUTSTANDING_BAL', _description: 'Outstanding Balance (ETB)', _dataType: 'NUMERIC', _required: true, Value: 0 },
          { Code: 'CLASSIFICATION', _description: 'Prudential Status', _dataType: 'TEXT', _required: true, Value: '' },
        ],
      },
    ],
  };

  const activeSubmission: ReportSubmission = {
    id: `sub_nbe_phase22_${Date.now()}`,
    reportKey: testReport.ReturnKey,
    periodYear: 2026,
    periodStart: '2026-01-01',
    periodEnd: '2026-01-31',
    institutionCode: '0000013',
    version: 1,
    templateVersion: 1,
    status: 'PENDING_CHECKER',
    values: {
      [testReport.ReturnItemsList[0]?.Code || 'ITEM_01']: 245000000.5,
      [testReport.ReturnItemsList[1]?.Code || 'ITEM_02']: 18000000.0,
      [testReport.ReturnItemsList[2]?.Code || 'ITEM_03']: 227000000.5,
    },
    dynamicRows: {
      1: [
        {
          id: 'row_schedule_01',
          areaId: 1,
          values: {
            BORROWER_NAME: 'Bishoftu Agro-Processing S.C.',
            FACILITY_LIMIT: 85000000,
            OUTSTANDING_BAL: 71200000,
            CLASSIFICATION: 'PASS',
          },
        },
        {
          id: 'row_schedule_02',
          areaId: 1,
          values: {
            BORROWER_NAME: 'Adama Logistics & Freight PLC',
            FACILITY_LIMIT: 40000000,
            OUTSTANDING_BAL: 34900000,
            CLASSIFICATION: 'SPECIAL_MENTION',
          },
        },
      ],
    },
    makerId: 'emp_maker_001',
    makerName: 'Abebe Kebede',
    makerEmail: 'abebe.kebede@oromiabank.com',
    department: 'Credit Operations & Portfolio Management',
    checkerId: 'emp_checker_001',
    checkerName: 'Almaz Ayana',
    checkerEmail: 'almaz.ayana@oromiabank.com',
    comments: [
      {
        id: 'cmt_001',
        userId: 'emp_maker_001',
        userName: 'Abebe Kebede',
        userRole: 'MAKER',
        action: 'SAVE_DRAFT',
        comment: 'Prepared statutory returns with audited credit ledger balances.',
        timestamp: new Date().toISOString(),
      },
      {
        id: 'cmt_002',
        userId: 'emp_checker_001',
        userName: 'Almaz Ayana',
        userRole: 'CHECKER',
        action: 'APPROVE',
        comment: 'Four-eyes verification completed; facility figures reconciled with core ledger.',
        timestamp: new Date().toISOString(),
      },
    ],
    deliveryAttempts: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    submittedAt: new Date().toISOString(),
    templateSnapshot: testReport,
  };

  console.log('\n--- 2. Multi-Sheet NBE-Compliant Workbook Generation ---');
  const wb = generateRegulatoryReportWorkbook(activeSubmission, {
    officerName: 'Abebe Kebede',
    officerRole: 'MAKER',
  });

  assert(Boolean(wb), 'SheetJS XLSX workbook generated successfully');
  assert(wb.SheetNames.length >= 4, `Workbook contains ${wb.SheetNames.length} worksheets`);
  assert(wb.SheetNames.includes('Submission Summary'), 'Contains "Submission Summary" sheet');
  assert(wb.SheetNames.includes('Return Items'), 'Contains "Return Items" sheet');
  assert(wb.SheetNames.includes('Validation Checklist'), 'Contains "Validation Checklist" sheet');
  assert(wb.SheetNames.includes('Offline Review Sign-off'), 'Contains "Offline Review Sign-off" sheet');

  console.log('\n--- 3. Submission Summary & 4-Eyes Supervisory Trail Verification ---');
  const summarySheet = wb.Sheets['Submission Summary'];
  assert(Boolean(summarySheet), 'Submission Summary sheet is accessible');
  const summaryCsv = XLSX.utils.sheet_to_csv(summarySheet);

  assert(summaryCsv.includes('Oromia Bank S.C.'), 'Summary sheet identifies licensed institution (Oromia Bank S.C.)');
  assert(summaryCsv.includes('0000013'), 'Summary sheet captures NBE InstCode (0000013)');
  assert(summaryCsv.includes('Abebe Kebede'), 'Summary captures Maker Officer name');
  assert(summaryCsv.includes('Almaz Ayana'), 'Summary captures Checker Reviewer name');
  assert(summaryCsv.includes('Four-eyes verification completed'), 'Summary captures Checker 4-eyes review comment');
  assert(summaryCsv.includes('Electronic Verification Seal'), 'Summary captures cryptographic integrity seal');
  assert(summaryCsv.includes('Directive BSD/03/2020'), 'Summary cites NBE Directive BSD/03/2020');

  console.log('\n--- 4. Fixed Return Items & Schedule Worksheets Verification ---');
  const itemsSheet = wb.Sheets['Return Items'];
  const itemsCsv = XLSX.utils.sheet_to_csv(itemsSheet);

  assert(itemsCsv.includes('Line Code'), 'Return Items contains Line Code column');
  assert(itemsCsv.includes('Line Item Description'), 'Return Items contains Description column');
  assert(itemsCsv.includes('Reported Value'), 'Return Items contains Reported Value column');
  assert(itemsCsv.includes('Calculation Method'), 'Return Items distinguishes Auto/Total vs Direct Input');
  assert(itemsCsv.includes('Validation Status'), 'Return Items includes line-level Validation Status');

  // Verify dynamic schedule sheets
  const dynamicSheets = wb.SheetNames.filter(
    (name) =>
      name !== 'Submission Summary' &&
      name !== 'Return Items' &&
      name !== 'Validation Checklist' &&
      name !== 'Offline Review Sign-off'
  );
  assert(dynamicSheets.length > 0, `Generated ${dynamicSheets.length} dynamic schedule worksheet(s)`);

  const firstDynamicSheet = wb.Sheets[dynamicSheets[0]];
  const dynamicCsv = XLSX.utils.sheet_to_csv(firstDynamicSheet);
  assert(dynamicCsv.includes('Bishoftu Agro-Processing S.C.'), 'Dynamic schedule preserves borrower row 1');
  assert(dynamicCsv.includes('Adama Logistics & Freight PLC'), 'Dynamic schedule preserves borrower row 2');

  console.log('\n--- 5. Supervisory Offline Review Sign-Off Sheet Verification ---');
  const signoffSheet = wb.Sheets['Offline Review Sign-off'];
  assert(Boolean(signoffSheet), 'Offline Review Sign-off sheet exists');
  const signoffCsv = XLSX.utils.sheet_to_csv(signoffSheet);

  assert(signoffCsv.includes('BANK SUPERVISION DIRECTORATE'), 'Sign-off sheet cites NBE Bank Supervision Directorate');
  assert(signoffCsv.includes('SUPERVISORY OFFLINE EXAMINATION'), 'Sign-off sheet identifies examination record');
  assert(signoffCsv.includes('Scope of Examination'), 'Sign-off sheet outlines prudential audit scope');
  assert(signoffCsv.includes('GL Reconciliation Status'), 'Sign-off sheet includes GL reconciliation audit field');
  assert(signoffCsv.includes('FORMAL AUTHORIZATION & CONCURRENCE SIGNATURES'), 'Sign-off sheet provides signature lines');

  console.log('\n--- 6. SheetJS Binary Output & Re-Parse Integrity Roundtrip ---');
  const binaryOutput = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
  const uint8 = new Uint8Array(binaryOutput);
  assert(uint8 instanceof Uint8Array, 'XLSX.write produces valid binary data');
  assert(uint8.length > 2000, `Generated XLSX binary file size is substantial (${uint8.length} bytes)`);

  // Parse binary array back with SheetJS to verify file integrity
  const parsedBackWb = XLSX.read(binaryOutput, { type: 'buffer' });
  assert(parsedBackWb.SheetNames.length === wb.SheetNames.length, 'Parsed workbook retains exact worksheet count');
  assert(Boolean(parsedBackWb.Sheets['Offline Review Sign-off']), 'Parsed workbook preserves "Offline Review Sign-off" sheet');

  // Verify export filename standard
  const exportedFilename = exportRegulatoryReportXLSX(activeSubmission, {
    officerName: 'Abebe Kebede',
    officerRole: 'MAKER',
  });
  assert(typeof exportedFilename === 'string', 'exportRegulatoryReportXLSX returns filename string');
  assert(exportedFilename.startsWith('OB_NBE_'), `Filename starts with OB_NBE_ prefix: ${exportedFilename}`);
  assert(exportedFilename.includes('FY2026'), 'Filename contains financial year (FY2026)');
  assert(exportedFilename.endsWith('.xlsx'), 'Filename ends with .xlsx extension');

  // Test through ExcelService static facade
  const facadeFilename = ExcelService.exportSubmission(activeSubmission);
  assert(typeof facadeFilename === 'string', 'ExcelService.exportSubmission returns valid filename');

  console.log('\n========================================================================');
  console.log('✅ ALL PHASE 22 SHEETJS .XLSX EXPORT ACCEPTANCE TESTS PASSED (100% SUCCESS)');
  console.log('========================================================================\n');
}
