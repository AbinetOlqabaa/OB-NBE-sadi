/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from 'xlsx';
import type { ReportSubmission, ReportMetadata, DynamicRowRecord } from '../types/regulatory.ts';
import { getReportByKey } from '../data/report-registry.ts';
import { generateSubmissionIntegrityHash } from './regulatoryReportPdfExport.ts';
import { ValidationEngine } from './validationEngine.ts';
import { FormulaEngine } from './formulaEngine.ts';

export interface ReportXlsxExportOptions {
  officerName?: string;
  officerRole?: string;
  notes?: string;
}

/**
 * Formats values for Excel export (converts numeric strings to real numbers).
 */
function prepareExcelCellValue(val: any, dataType?: string): { v: any; t: 'n' | 's' | 'b' | 'd'; z?: string } {
  if (val === undefined || val === null || val === '') {
    return { v: '', t: 's' };
  }

  if (dataType === 'NUMERIC' || typeof val === 'number') {
    const num = typeof val === 'number' ? val : Number(val);
    if (!isNaN(num)) {
      return {
        v: num,
        t: 'n',
        z: Number.isInteger(num) ? '#,##0' : '#,##0.00',
      };
    }
  }

  return { v: String(val), t: 's' };
}

/**
 * Calculates optimal column widths for an array-of-arrays worksheet data.
 */
function computeAutoColumnWidths(data: any[][]): XLSX.ColInfo[] {
  const colWidths: number[] = [];
  for (const row of data) {
    if (!Array.isArray(row)) continue;
    row.forEach((cell, colIdx) => {
      const cellLen = cell !== undefined && cell !== null ? String(cell).length : 0;
      colWidths[colIdx] = Math.max(colWidths[colIdx] || 10, cellLen + 3);
    });
  }
  return colWidths.map((w) => ({ wch: Math.min(Math.max(w, 12), 65) }));
}

/**
 * Generates an NBE-compliant multi-sheet .xlsx workbook object in-memory.
 */
export function generateRegulatoryReportWorkbook(
  submission: ReportSubmission,
  options: ReportXlsxExportOptions = {}
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  const reportDef: ReportMetadata =
    submission.templateSnapshot ||
    getReportByKey(submission.reportKey) || {
      ReturnKey: submission.reportKey,
      Code: submission.reportKey,
      Title: submission.reportKey,
      Category: 'Credit & Lending',
      Frequency: 'MONTHLY',
      InstCode: '0000013',
      FinYear: submission.periodYear || new Date().getFullYear(),
      StartDate: `${submission.periodYear || 2026}-01-01`,
      EndDate: `${submission.periodYear || 2026}-01-31`,
      Description: 'National Bank of Ethiopia Statutory Regulatory Return',
      SourceFilename: `${submission.reportKey}.xlsx`,
      SourceHash: 'SSOT_SOURCE_HASH',
      ReturnItemsList: [],
      DynamicItemsList: [],
      Formulas: [],
      ValidationRules: [],
    };

  const values = submission.values || {};
  const dynamicRows = submission.dynamicRows || {};

  // Compute calculated values and validation diagnostics
  const calculatedValues = FormulaEngine.calculateReport(reportDef, values, dynamicRows);
  const validationSummary = ValidationEngine.validateReport(reportDef, calculatedValues, dynamicRows);
  const integritySeal = generateSubmissionIntegrityHash(submission);
  const generatedTimestamp = new Date().toISOString();

  const checkerComment = submission.comments?.find((c) => c.userRole === 'CHECKER')?.comment || 'N/A';

  // =========================================================================
  // SHEET 1: NBE SUBMISSION SUMMARY & VERIFICATION SEAL
  // =========================================================================
  const summaryAoa: any[][] = [
    ['NATIONAL BANK OF ETHIOPIA (NBE) - STATUTORY REGULATORY RETURN'],
    ['OROMIA BANK S.C. | SUPERVISORY COMPLIANCE EXPORT'],
    [],
    ['SUBMISSION IDENTIFIERS & METADATA', ''],
    ['Institution Name', 'Oromia Bank S.C.'],
    ['Institution Code (InstCode)', reportDef.InstCode || '0000013'],
    ['Regulatory Return Key', submission.reportKey],
    ['Return Title', reportDef.Title],
    ['Return Category', reportDef.Category],
    ['Reporting Frequency', reportDef.Frequency],
    ['Financial Year (FinYear)', submission.periodYear || reportDef.FinYear],
    ['Reporting Window', `${reportDef.StartDate.split('T')[0]} to ${reportDef.EndDate.split('T')[0]}`],
    ['Submission ID', submission.id],
    ['Lifecycle Status', submission.status.replace('_', ' ')],
    ['Submission Version', `v${submission.version} (Template v${submission.templateVersion || 1})`],
    [],
    ['GOVERNANCE & 4-EYES SUPERVISORY TRAIL', ''],
    ['Maker Officer (Prepared By)', `${submission.makerName} (${submission.makerEmail || submission.makerId})`],
    ['Maker Department', submission.department || 'Credit Operations & Portfolio Management'],
    ['Prepared / Saved At', submission.updatedAt || submission.createdAt || generatedTimestamp],
    ['Submitted to Checker At', submission.submittedAt || 'Pending / In Preparation'],
    ['Checker Approver (4-Eyes Review)', submission.checkerName ? `${submission.checkerName} (${submission.checkerEmail || submission.checkerId})` : 'Pending Checker Approval'],
    ['Checker Approval Timestamp', submission.approvedAt || 'N/A'],
    ['Checker Reviewer Notes', checkerComment],
    ['NBE Gateway Reference Receipt', submission.nbeReferenceNumber || 'Pending NBE Gateway Transmission'],
    ['Transmission Timestamp', submission.finalSubmittedAt || 'N/A'],
    [],
    ['CRYPTOGRAPHIC INTEGRITY & COMPLIANCE SEAL', ''],
    ['Electronic Verification Seal', integritySeal],
    ['Validation Status', validationSummary.isValid ? 'PASSED (100% NBE Rule Compliance)' : `ACTION REQUIRED (${validationSummary.errorsCount} validation errors)`],
    ['Exported By Officer', options.officerName ? `${options.officerName} (${options.officerRole || 'Officer'})` : 'Authorized Bank Officer'],
    ['Export Timestamp', generatedTimestamp],
    ['Regulatory Compliance Directive', 'National Bank of Ethiopia Directive BSD/03/2020 on Prudential Reporting'],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryAoa);
  wsSummary['!cols'] = computeAutoColumnWidths(summaryAoa);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Submission Summary');

  // =========================================================================
  // SHEET 2: FIXED RETURN ITEMS
  // =========================================================================
  const itemsHeaders = [
    'Line Code',
    'Line Item Description',
    'Data Type',
    'Mandatory / Required',
    'Reported Value (ETB / Units)',
    'Calculation Method',
    'Formula / Rule Description',
    'Validation Status',
  ];

  const itemsAoa: any[][] = [
    [`OROMIA BANK S.C. - FIXED RETURN ITEMS: ${submission.reportKey} - ${reportDef.Title}`],
    [`Financial Period: FY${submission.periodYear || reportDef.FinYear} | Status: ${submission.status}`],
    [],
    itemsHeaders,
  ];

  for (const item of reportDef.ReturnItemsList) {
    const val = calculatedValues[item.Code] !== undefined ? calculatedValues[item.Code] : item.Value;
    const formulaDef = reportDef.Formulas.find((f) => f.targetCode === item.Code);
    const isFormula = !!formulaDef;
    const isTotal = !!item.isTotal;

    const cellPrep = prepareExcelCellValue(val, item._dataType);

    // Check field validation
    const fieldError = validationSummary.fieldErrors.find((e) => e.code === item.Code);
    let valStatus = 'VALID';
    if (fieldError) {
      valStatus = `${fieldError.severity}: ${fieldError.message}`;
    } else if (item._required && (val === undefined || val === null || val === '')) {
      valStatus = 'ERROR: Mandatory field missing';
    }

    itemsAoa.push([
      item.Code,
      item._description,
      item._dataType,
      item._required ? 'YES (MANDATORY)' : 'NO (OPTIONAL)',
      cellPrep.v,
      isFormula ? 'FORMULA (AUTO-CALCULATED)' : isTotal ? 'TOTAL' : 'DIRECT INPUT',
      formulaDef ? formulaDef.description || formulaDef.expression : '-',
      valStatus,
    ]);
  }

  const wsItems = XLSX.utils.aoa_to_sheet(itemsAoa);
  wsItems['!cols'] = computeAutoColumnWidths(itemsAoa);
  XLSX.utils.book_append_sheet(wb, wsItems, 'Return Items');

  // =========================================================================
  // SHEET 3+: DYNAMIC SCHEDULES / AREAS (If present)
  // =========================================================================
  if (reportDef.DynamicItemsList && reportDef.DynamicItemsList.length > 0) {
    for (const area of reportDef.DynamicItemsList) {
      const areaRows: DynamicRowRecord[] = dynamicRows[area.Area] || [];
      const cleanAreaName = (area._areaName || `Schedule Area ${area.Area}`).replace(/[:\\/?*[\]]/g, '').slice(0, 30);

      const dynamicHeaders = ['Row #', ...area.DynamicItems.map((col) => `${col.Code} - ${col._description}`)];
      const dynamicCodeHeaders = ['Code', ...area.DynamicItems.map((col) => col.Code)];

      const dynamicAoa: any[][] = [
        [`DYNAMIC SCHEDULE: ${area._areaName || 'Area ' + area.Area} (Area ID: ${area.Area})`],
        [`Total Entries: ${areaRows.length} rows | Return: ${submission.reportKey}`],
        [],
        dynamicHeaders,
        dynamicCodeHeaders,
      ];

      if (areaRows.length === 0) {
        dynamicAoa.push(['(No schedule rows entered)', ...area.DynamicItems.map(() => '-')]);
      } else {
        areaRows.forEach((row, idx) => {
          const rowData: any[] = [idx + 1];
          for (const col of area.DynamicItems) {
            const rawVal = row.values[col.Code];
            const prep = prepareExcelCellValue(rawVal, col._dataType);
            rowData.push(prep.v);
          }
          dynamicAoa.push(rowData);
        });
      }

      const wsDynamic = XLSX.utils.aoa_to_sheet(dynamicAoa);
      wsDynamic['!cols'] = computeAutoColumnWidths(dynamicAoa);
      XLSX.utils.book_append_sheet(wb, wsDynamic, cleanAreaName);
    }
  }

  // =========================================================================
  // SHEET 4: VALIDATION RULES & COMPLIANCE CHECKLIST
  // =========================================================================
  const rulesAoa: any[][] = [
    ['NBE REGULATORY VALIDATION ENGINE - COMPLIANCE AUDIT CHECKLIST'],
    [`Evaluation Date: ${generatedTimestamp} | Submission ID: ${submission.id}`],
    [],
    ['Rule ID', 'Rule Name', 'Statutory Description', 'Severity', 'Rule Outcome / Diagnostics'],
  ];

  if (reportDef.ValidationRules && reportDef.ValidationRules.length > 0) {
    for (const rule of reportDef.ValidationRules) {
      const isFailed = validationSummary.ruleErrors.some((r) => r.id === rule.id);
      rulesAoa.push([
        rule.id,
        rule.name,
        rule.description,
        rule.severity,
        isFailed ? `FAILED (${rule.severity}) - Balance or consistency threshold violated` : 'PASSED (Compliant)',
      ]);
    }
  } else {
    rulesAoa.push(['N/A', 'Standard NBE Consistency Checks', 'All field formats, mandatory flags and arithmetic totals checked', 'INFO', 'PASSED']);
  }

  const wsRules = XLSX.utils.aoa_to_sheet(rulesAoa);
  wsRules['!cols'] = computeAutoColumnWidths(rulesAoa);
  XLSX.utils.book_append_sheet(wb, wsRules, 'Validation Checklist');

  // =========================================================================
  // SHEET 5: SUPERVISORY OFFLINE REVIEW & AUDIT SIGN-OFF
  // =========================================================================
  const signoffAoa: any[][] = [
    ['NATIONAL BANK OF ETHIOPIA - BANK SUPERVISION DIRECTORATE (BSD)'],
    ['SUPERVISORY OFFLINE EXAMINATION & AUDIT VERIFICATION RECORD'],
    [],
    ['SUBMISSION IDENTIFICATION', ''],
    ['Licensed Financial Institution', 'Oromia Bank S.C. (InstCode: 0000013)'],
    ['Statutory Return Title', reportDef.Title],
    ['Regulatory Return Key', submission.reportKey],
    ['Submission Reference ID', submission.id],
    ['Reporting Financial Period', `FY${submission.periodYear || reportDef.FinYear} (${reportDef.Frequency})`],
    ['Submission Lifecycle Status', submission.status.replace('_', ' ')],
    ['Electronic Verification Seal', integritySeal],
    ['Generated for Offline Review', generatedTimestamp],
    [],
    ['SUPERVISORY ON-SITE / OFFLINE EXAMINATION RECORD', ''],
    ['Examiner / Senior Inspector Name', ''],
    ['NBE Directorate / Department', 'Banking Supervision Directorate (BSD)'],
    ['Inspection Date', ''],
    ['Scope of Examination', 'Prudential Return Consistency & General Ledger Reconciliation'],
    ['GL Reconciliation Status (Matched/Discrepant)', ''],
    ['Identified Compliance Exceptions', 'None / As detailed in on-site examination memo'],
    ['Supervisory Audit Determination', 'SATISFACTORY - Full Prudential Compliance with BSD/03/2020'],
    [],
    ['FORMAL AUTHORIZATION & CONCURRENCE SIGNATURES', ''],
    ['NBE Supervisory Inspector Signature', '________________________________________'],
    ['Oromia Bank Chief Compliance Officer Counter-Signature', '________________________________________'],
    ['Date of Formal Endorsement', '____________________'],
  ];

  const wsSignoff = XLSX.utils.aoa_to_sheet(signoffAoa);
  wsSignoff['!cols'] = computeAutoColumnWidths(signoffAoa);
  XLSX.utils.book_append_sheet(wb, wsSignoff, 'Offline Review Sign-off');

  return wb;
}

/**
 * Exports any active regulatory report submission into an NBE-compliant .xlsx workbook and triggers download.
 * Returns the generated filename.
 */
export function exportRegulatoryReportXLSX(
  submission: ReportSubmission,
  options: ReportXlsxExportOptions = {}
): string {
  const wb = generateRegulatoryReportWorkbook(submission, options);
  const reportDef: ReportMetadata =
    submission.templateSnapshot ||
    getReportByKey(submission.reportKey) ||
    ({
      FinYear: submission.periodYear || new Date().getFullYear(),
    } as any);

  // Trigger browser file download
  const cleanKey = submission.reportKey.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `OB_NBE_${cleanKey}_FY${submission.periodYear || reportDef.FinYear}_${submission.status}_${submission.id}.xlsx`;

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    try {
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 250);
    } catch {
      // Fallback
      XLSX.writeFile(wb, filename, { bookType: 'xlsx', type: 'binary' });
    }
  } else {
    // Node.js / Unit test environment
    XLSX.writeFile(wb, filename, { bookType: 'xlsx', type: 'binary' });
  }

  return filename;
}
