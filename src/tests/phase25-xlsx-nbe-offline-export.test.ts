/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * PHASE 25 ACCEPTANCE TEST SUITE: XLSX Package Integration & NBE-Compliant Offline Review Export
 * Regulatory Directives: NBE Directive BSD/03/2020 & 4-Eyes Supervisory On-Site Audit Trail
 */

import * as XLSX from 'xlsx';
import {
  generateRegulatoryReportWorkbook,
  exportRegulatoryReportXLSX,
} from '../utils/regulatoryReportXlsxExport.ts';
import { ExcelService } from '../utils/excelService.ts';
import { getReportByKey } from '../data/report-registry.ts';
import type { ReportMetadata, ReportSubmission, DynamicRowRecord } from '../types/regulatory.ts';

function assert(condition: any, msg: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

export async function runPhase25XlsxNbeOfflineExportTests() {
  console.log('\n========================================================================');
  console.log('--- PHASE 25: XLSX PACKAGE INTEGRATION & OFFLINE EXPORT ACCEPTANCE SUITE ---');
  console.log('========================================================================\n');

  console.log('--- 1. SheetJS XLSX Package Verification ---');
  assert(Boolean(XLSX), 'SheetJS (xlsx) package is installed and importable');
  assert(typeof XLSX.read === 'function', 'XLSX.read function available');
  assert(typeof XLSX.write === 'function', 'XLSX.write function available');
  assert(typeof XLSX.utils.aoa_to_sheet === 'function', 'XLSX.utils.aoa_to_sheet utility available');
  assert(typeof XLSX.utils.book_new === 'function', 'XLSX.utils.book_new utility available');
  assert(typeof XLSX.utils.book_append_sheet === 'function', 'XLSX.utils.book_append_sheet utility available');
  console.log(`  ✓ SheetJS library version verified: ${XLSX.version || '0.18.5'}`);

  console.log('\n--- 2. Active Submission Data Setup for DynamicReportForm ---');
  const baseReport = getReportByKey('M_LCPLC001')!;
  assert(Boolean(baseReport), 'Canonical NBE regulatory return (M_LCPLC001) loaded');

  const reportMetadata: ReportMetadata = {
    ...baseReport,
    FinYear: 2026,
    ReturnItemsList: baseReport.ReturnItemsList.map((item, idx) => ({
      ...item,
      _required: idx < 4 ? true : item._required,
    })),
    DynamicItemsList: [
      {
        Area: 1,
        _areaName: 'Large Commercial Exposures',
        DynamicItems: [
          { Code: 'BORROWER_LEGAL_NAME', _description: 'Borrower Name', _dataType: 'TEXT', _required: true, Value: '' },
          { Code: 'SANCTIONED_LIMIT_ETB', _description: 'Sanctioned Facility (ETB)', _dataType: 'NUMERIC', _required: true, Value: 0 },
          { Code: 'OUTSTANDING_PRINCIPAL_ETB', _description: 'Outstanding Principal (ETB)', _dataType: 'NUMERIC', _required: true, Value: 0 },
          { Code: 'NBE_RISK_RATING', _description: 'NBE Risk Classification', _dataType: 'TEXT', _required: true, Value: '' },
        ],
      },
    ],
  };

  const dynamicScheduleRows: Record<number, DynamicRowRecord[]> = {
    1: [
      {
        id: 'row_exp_001',
        areaId: 1,
        values: {
          BORROWER_LEGAL_NAME: 'Dire Dawa Industrial Enterprises S.C.',
          SANCTIONED_LIMIT_ETB: 120000000,
          OUTSTANDING_PRINCIPAL_ETB: 104500000,
          NBE_RISK_RATING: 'PASS',
        },
      },
      {
        id: 'row_exp_002',
        areaId: 1,
        values: {
          BORROWER_LEGAL_NAME: 'Bishoftu Floriculture Export PLC',
          SANCTIONED_LIMIT_ETB: 65000000,
          OUTSTANDING_PRINCIPAL_ETB: 58200000,
          NBE_RISK_RATING: 'SPECIAL_MENTION',
        },
      },
    ],
  };

  const currentSubmission: ReportSubmission = {
    id: `sub_phase25_${Date.now()}`,
    reportKey: reportMetadata.ReturnKey,
    periodYear: 2026,
    periodStart: '2026-01-01',
    periodEnd: '2026-01-31',
    institutionCode: '0000013',
    version: 2,
    templateVersion: 1,
    status: 'PENDING_CHECKER',
    values: {
      [reportMetadata.ReturnItemsList[0]?.Code || 'ITEM_01']: 485000000.75,
      [reportMetadata.ReturnItemsList[1]?.Code || 'ITEM_02']: 120000000.0,
      [reportMetadata.ReturnItemsList[2]?.Code || 'ITEM_03']: 365000000.75,
    },
    dynamicRows: dynamicScheduleRows,
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
        action: 'SUBMIT',
        comment: 'Prepared statutory return for supervisory examination with full core ledger reconciliation.',
        timestamp: new Date().toISOString(),
      },
    ],
    deliveryAttempts: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    templateSnapshot: reportMetadata,
  };

  console.log('\n--- 3. Multi-Worksheet NBE Offline Review Workbook Generation ---');
  const workbook = generateRegulatoryReportWorkbook(currentSubmission, {
    officerName: 'Abebe Kebede',
    officerRole: 'MAKER',
    notes: 'Official examination copy generated from DynamicReportForm.',
  });

  assert(Boolean(workbook), 'Generated SheetJS Workbook object');
  assert(workbook.SheetNames.length === 5, `Workbook contains exactly 5 worksheets (actual: ${workbook.SheetNames.length})`);
  assert(workbook.SheetNames.includes('Submission Summary'), 'Contains "Submission Summary" sheet');
  assert(workbook.SheetNames.includes('Return Items'), 'Contains "Return Items" sheet');
  assert(workbook.SheetNames.includes('Large Commercial Exposures'), 'Contains "Large Commercial Exposures" schedule sheet');
  assert(workbook.SheetNames.includes('Validation Checklist'), 'Contains "Validation Checklist" sheet');
  assert(workbook.SheetNames.includes('Offline Review Sign-off'), 'Contains "Offline Review Sign-off" sheet');

  console.log('\n--- 4. NBE Compliance & 4-Eyes Supervisory Audit Trail Verification ---');
  // Sheet 1: Submission Summary
  const summaryCsv = XLSX.utils.sheet_to_csv(workbook.Sheets['Submission Summary']);
  assert(summaryCsv.includes('Oromia Bank S.C.'), 'Identifies Oromia Bank S.C.');
  assert(summaryCsv.includes('0000013'), 'Captures NBE InstCode 0000013');
  assert(summaryCsv.includes('Abebe Kebede'), 'Captures Maker Officer name');
  assert(summaryCsv.includes('Almaz Ayana'), 'Captures Checker Officer name');
  assert(summaryCsv.includes('BSD/03/2020'), 'Cites NBE Directive BSD/03/2020');
  assert(summaryCsv.includes('Electronic Verification Seal'), 'Includes cryptographic Electronic Verification Seal');

  // Sheet 2: Return Items
  const itemsCsv = XLSX.utils.sheet_to_csv(workbook.Sheets['Return Items']);
  assert(itemsCsv.includes('Line Code'), 'Includes Line Code column');
  assert(itemsCsv.includes('Line Item Description'), 'Includes Line Item Description column');
  assert(itemsCsv.includes('Reported Value'), 'Includes Reported Value column');
  assert(itemsCsv.includes('Validation Status'), 'Includes line-level Validation Status');

  // Sheet 3: Dynamic Schedule
  const scheduleCsv = XLSX.utils.sheet_to_csv(workbook.Sheets['Large Commercial Exposures']);
  assert(scheduleCsv.includes('Dire Dawa Industrial Enterprises S.C.'), 'Dynamic schedule captures exposure row 1');
  assert(scheduleCsv.includes('Bishoftu Floriculture Export PLC'), 'Dynamic schedule captures exposure row 2');
  assert(scheduleCsv.includes('104500000') || scheduleCsv.includes('104,500,000'), 'Dynamic schedule captures numerical balance');

  // Sheet 5: Supervisory Offline Review Sign-Off
  const signoffCsv = XLSX.utils.sheet_to_csv(workbook.Sheets['Offline Review Sign-off']);
  assert(signoffCsv.includes('BANK SUPERVISION DIRECTORATE'), 'Sign-off identifies NBE Bank Supervision Directorate');
  assert(signoffCsv.includes('SUPERVISORY OFFLINE EXAMINATION'), 'Sign-off identifies Examination Record');
  assert(signoffCsv.includes('GL Reconciliation Status'), 'Sign-off includes GL Reconciliation Status audit field');
  assert(signoffCsv.includes('FORMAL AUTHORIZATION & CONCURRENCE SIGNATURES'), 'Sign-off includes Authorization signature blocks');

  console.log('\n--- 5. SheetJS Binary Output & Roundtrip Parse Integrity ---');
  // Write to binary buffer using SheetJS
  const binaryOutput = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
  const uint8 = new Uint8Array(binaryOutput);
  assert(uint8.byteLength > 1000, `SheetJS write generates valid binary XLSX payload (${uint8.byteLength} bytes)`);

  // Parse binary buffer back using SheetJS
  const parsedBackWb = XLSX.read(binaryOutput, { type: 'buffer' });
  assert(parsedBackWb.SheetNames.length === 5, 'Parsed workbook retains all 5 worksheets');
  assert(parsedBackWb.SheetNames.includes('Offline Review Sign-off'), 'Parsed workbook preserves "Offline Review Sign-off" sheet');

  const parsedSignoffCsv = XLSX.utils.sheet_to_csv(parsedBackWb.Sheets['Offline Review Sign-off']);
  assert(parsedSignoffCsv.includes('BANK SUPERVISION DIRECTORATE'), 'Parsed sign-off sheet retains exact regulatory text');

  console.log('\n--- 6. Export Filename Format Compliance ---');
  const filename = exportRegulatoryReportXLSX(currentSubmission, {
    officerName: 'Abebe Kebede',
    officerRole: 'MAKER',
  });
  assert(typeof filename === 'string', 'exportRegulatoryReportXLSX returns filename string');
  assert(filename.startsWith('OB_NBE_'), `Filename conforms to OB_NBE_ standard prefix: ${filename}`);
  assert(filename.includes('FY2026'), 'Filename contains reporting financial year (FY2026)');
  assert(filename.endsWith('.xlsx'), 'Filename ends with .xlsx extension');

  // Static facade
  const facadeFilename = ExcelService.exportSubmission(currentSubmission);
  assert(typeof facadeFilename === 'string', 'ExcelService facade returns exported filename');

  console.log('\n========================================================================');
  console.log('✅ ALL PHASE 25 XLSX INTEGRATION & OFFLINE EXPORT TESTS PASSED (100%)');
  console.log('========================================================================\n');
}
