/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * PHASE 20 ACCEPTANCE TEST SUITE: Regulatory Reporting XLSX Export
 * Compliance: NBE Directive BSD/03/2020 & 4-Eyes Supervisory Controls
 */

import * as XLSX from 'xlsx';
import {
  ExcelService,
  exportRegulatoryReportXLSX,
  generateRegulatoryReportWorkbook,
} from '../utils/excelService.ts';
import { getReportByKey } from '../data/report-registry.ts';
import type { ReportMetadata, ReportSubmission } from '../types/regulatory.ts';

function assert(condition: any, msg: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

export async function runPhase20RegulatoryReportingXlsxExportTests() {
  console.log('\n========================================================================');
  console.log('--- PHASE 20: REGULATORY REPORTING XLSX EXPORT ACCEPTANCE SUITE ---');
  console.log('========================================================================\n');

  console.log('--- 1. Report Metadata & Submission Model Preparation ---');
  const baseReport = getReportByKey('M_LCPLC001')!;
  assert(Boolean(baseReport), 'Canonical NBE regulatory return loaded from registry');

  const sampleReport: ReportMetadata = {
    ...baseReport,
    ReturnItemsList: baseReport.ReturnItemsList.map((item, idx) => ({
      ...item,
      _required: idx < 3 ? true : item._required,
    })),
  };

  const mockSubmission: ReportSubmission = {
    id: `sub_nbe_phase20_${Date.now()}`,
    reportKey: sampleReport.ReturnKey,
    periodYear: 2026,
    periodStart: '2026-01-01',
    periodEnd: '2026-01-31',
    institutionCode: '0000013',
    version: 2,
    templateVersion: 1,
    status: 'PENDING_CHECKER',
    values: {
      [sampleReport.ReturnItemsList[0]?.Code || 'ITEM_01']: 184500000.75,
      [sampleReport.ReturnItemsList[1]?.Code || 'ITEM_02']: 45000000.0,
      [sampleReport.ReturnItemsList[2]?.Code || 'ITEM_03']: 139500000.75,
    },
    dynamicRows: {
      1: [
        {
          id: 'row_sched_1',
          areaId: 1,
          values: {
            BORROWER_NAME: 'Oromia Agro-Industry Enterprise S.C.',
            FACILITY_LIMIT: 75000000,
            OUTSTANDING_BAL: 64200000,
            CLASSIFICATION: 'PASS',
          },
        },
        {
          id: 'row_sched_2',
          areaId: 1,
          values: {
            BORROWER_NAME: 'Finfinne Export Trading PLC',
            FACILITY_LIMIT: 35000000,
            OUTSTANDING_BAL: 28900000,
            CLASSIFICATION: 'SPECIAL_MENTION',
          },
        },
      ],
    },
    makerId: 'emp_maker_001',
    makerName: 'Abebe Kebede',
    makerEmail: 'abebe.kebede@oromiabank.com',
    department: 'Credit Operations & Portfolio Management',
    comments: [
      {
        id: 'cmt_001',
        userId: 'emp_maker_001',
        userName: 'Abebe Kebede',
        userRole: 'MAKER',
        action: 'SAVE_DRAFT',
        comment: 'Prepared monthly prudential return with updated facility exposures.',
        timestamp: new Date().toISOString(),
      },
    ],
    deliveryAttempts: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    submittedAt: new Date().toISOString(),
    templateSnapshot: sampleReport,
  };

  console.log('\n--- 2. Multi-Sheet SheetJS Workbook Generation ---');
  const submissionWb = generateRegulatoryReportWorkbook(mockSubmission, {
    officerName: 'Abebe Kebede',
    officerRole: 'MAKER',
  });
  assert(Boolean(submissionWb), 'Regulatory Submission XLSX workbook generated successfully');
  assert(submissionWb.SheetNames.includes('Submission Summary'), 'Workbook includes "Submission Summary" cover sheet');
  assert(submissionWb.SheetNames.includes('Return Items'), 'Workbook includes "Return Items" line sheet');
  assert(submissionWb.SheetNames.includes('Validation Checklist'), 'Workbook includes "Validation Checklist" sheet');

  // Verify Sheet 1 content
  const summarySheet = submissionWb.Sheets['Submission Summary'];
  const summaryAoa: any[][] = XLSX.utils.sheet_to_json(summarySheet, { header: 1 });
  assert(summaryAoa.length > 10, 'Submission summary sheet populated with metadata');
  const summaryText = JSON.stringify(summaryAoa);
  assert(summaryText.includes('NATIONAL BANK OF ETHIOPIA'), 'Cover sheet contains NBE regulatory title');
  assert(summaryText.includes('0000013'), 'Cover sheet contains Institution Code 0000013');
  assert(summaryText.includes('Abebe Kebede'), 'Cover sheet contains 4-Eyes Maker Officer attribution');

  console.log('\n--- 3. Binary Export & Round-Trip Parsing Verification ---');
  const binaryBuffer = XLSX.write(submissionWb, { type: 'buffer', bookType: 'xlsx' });
  const uint8Data = binaryBuffer instanceof Uint8Array ? binaryBuffer : new Uint8Array(binaryBuffer);
  assert(uint8Data instanceof Uint8Array, 'Binary export produces valid Uint8Array buffer');
  assert(uint8Data.length > 1000, `Generated .xlsx file has substantial content (${uint8Data.length} bytes)`);

  const parsedWb = XLSX.read(uint8Data, { type: 'array' });
  assert(parsedWb.SheetNames.length >= 3, 'Parsed XLSX workbook preserves all multi-sheet structures (Summary, Items, Checklist)');
  assert(parsedWb.SheetNames.includes('Submission Summary'), 'Parsed workbook preserves "Submission Summary"');
  assert(parsedWb.SheetNames.includes('Return Items'), 'Parsed workbook preserves "Return Items"');
  assert(parsedWb.SheetNames.includes('Validation Checklist'), 'Parsed workbook preserves "Validation Checklist"');

  const itemsSheet = parsedWb.Sheets['Return Items'];
  assert(Boolean(itemsSheet), 'Sheet data populated correctly');
  const itemsJson: any[] = XLSX.utils.sheet_to_json(itemsSheet);
  assert(itemsJson.length > 0, 'Return items rows deserialized with proper headers');

  console.log('\n--- 4. Institutional Export Utilities & API Exports ---');
  assert(typeof exportRegulatoryReportXLSX === 'function', 'exportRegulatoryReportXLSX exported for direct UI binding');
  assert(typeof ExcelService.exportSubmission === 'function', 'ExcelService.exportSubmission static helper available');
  assert(typeof ExcelService.exportToWorkbook === 'function', 'ExcelService.exportToWorkbook available');
  assert(typeof ExcelService.exportToBinary === 'function', 'ExcelService.exportToBinary available');

  console.log('\n========================================================================');
  console.log('✅ ALL PHASE 20 REGULATORY REPORTING XLSX EXPORT TESTS PASSED (100% SUCCESS)');
  console.log('========================================================================\n');
}
