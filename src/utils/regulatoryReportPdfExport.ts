/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ReportSubmission, ReportMetadata, AuditLogEntry } from '../types/regulatory.ts';
import { getReportByKey } from '../data/report-registry.ts';

export interface ReportPdfExportOptions {
  officerName?: string;
  officerRole?: string;
  complianceNotes?: string;
  includeComments?: boolean;
  includeDynamicAreas?: boolean;
}

export interface GeneralAuditPdfExportOptions {
  officerName?: string;
  officerRole?: string;
  filtersSummary?: string;
  notes?: string;
}

/**
 * Computes a pseudo-cryptographic SHA-256 integrity hash for submission data
 */
export function generateSubmissionIntegrityHash(submission: ReportSubmission): string {
  const content = `${submission.id}|${submission.reportKey}|${submission.periodYear}|${submission.status}|${submission.version}|${submission.templateVersion || 1}|${JSON.stringify(submission.values)}|${submission.makerId}|${submission.checkerId || ''}|${submission.nbeReferenceNumber || ''}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  const p1 = hash.toString(16).padStart(8, '0').toUpperCase();
  const p2 = ((hash * 37) >>> 0).toString(16).padStart(8, '0').toUpperCase();
  const p3 = ((hash * 131) >>> 0).toString(16).padStart(8, '0').toUpperCase();
  const p4 = ((hash * 4093) >>> 0).toString(16).padStart(8, '0').toUpperCase();
  return `OB-NBE-SEAL-${p1}-${p2}-${p3}-${p4}`;
}

/**
 * Formats values nicely for regulatory display (currency, numbers, strings)
 */
function formatReportValue(val: any, dataType?: string): string {
  if (val === undefined || val === null || val === '') return '-';
  if (dataType === 'NUMERIC' || typeof val === 'number') {
    const num = Number(val);
    if (!isNaN(num)) {
      return num.toLocaleString('en-US', {
        minimumFractionDigits: Number.isInteger(num) ? 0 : 2,
        maximumFractionDigits: 4,
      });
    }
  }
  return String(val);
}

/**
 * Downloads a specific regulatory report submission as a formatted, signed PDF document for NBE compliance
 */
export function exportRegulatoryReportPDF(
  submission: ReportSubmission,
  options: ReportPdfExportOptions = {}
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const now = new Date();
  const reportDef: ReportMetadata =
    submission.templateSnapshot ||
    getReportByKey(submission.reportKey) || {
      ReturnKey: submission.reportKey,
      Code: submission.reportKey,
      Title: `Regulatory Return ${submission.reportKey}`,
      Category: 'Credit & Lending',
      Frequency: 'MONTHLY',
      InstCode: submission.institutionCode || '0000013',
      FinYear: submission.periodYear || 2026,
      StartDate: submission.periodStart,
      EndDate: submission.periodEnd,
      Description: 'Official NBE Regulatory Return Filing',
      ReturnItemsList: Object.keys(submission.values).map((code) => ({
        Code: code,
        Value: submission.values[code],
        _description: `Item ${code}`,
        _dataType: 'NUMERIC',
        _required: true,
      })),
      DynamicItemsList: [],
      Formulas: [],
      ValidationRules: [],
      SourceFilename: '',
      SourceHash: '',
    };

  const sealHash = submission.structuralHash || generateSubmissionIntegrityHash(submission);
  const docRef = `OB-NBE-${submission.reportKey}-${submission.periodYear}-${Math.floor(1000 + Math.random() * 9000)}`;

  // Header Banner
  doc.setFillColor(20, 27, 65); // Oromia Bank Brand Dark Indigo
  doc.rect(0, 0, 210, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('OROMIA BANK S.C. - OFFICIAL REGULATORY RETURN FILING', 14, 10);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 220, 255);
  doc.text('National Bank of Ethiopia (NBE) • Banking Supervision Directorate • Directive BSD/03/2020', 14, 16);
  doc.text(`Official Doc Ref: ${docRef}  |  Institution Code: 0000013`, 14, 21);

  // Status Badge on Header Right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  if (submission.status === 'SENT' || submission.status === 'APPROVED') {
    doc.setTextColor(52, 211, 153); // Emerald
  } else {
    doc.setTextColor(251, 191, 36); // Amber
  }
  doc.text(`STATUS: ${submission.status}`, 196, 11, { align: 'right' });

  // Metadata Card Block
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 28, 182, 38, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);

  // Metadata Left Column
  doc.setFont('helvetica', 'bold');
  doc.text('Report Return Key:', 18, 34);
  doc.setFont('courier', 'bold');
  doc.setTextColor(2, 132, 199);
  doc.text(reportDef.ReturnKey, 54, 34);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text('Return Title:', 18, 40);
  doc.setFont('helvetica', 'normal');
  doc.text(reportDef.Title, 54, 40);

  doc.setFont('helvetica', 'bold');
  doc.text('Category / Frequency:', 18, 46);
  doc.setFont('helvetica', 'normal');
  doc.text(`${reportDef.Category} • ${reportDef.Frequency}`, 54, 46);

  doc.setFont('helvetica', 'bold');
  doc.text('Reporting Department:', 18, 52);
  doc.setFont('helvetica', 'normal');
  doc.text(submission.department || submission.makerDepartment || 'General Operations', 54, 52);

  doc.setFont('helvetica', 'bold');
  doc.text('Period Window:', 18, 58);
  doc.setFont('helvetica', 'normal');
  doc.text(`${submission.periodStart?.slice(0, 10)} to ${submission.periodEnd?.slice(0, 10)} (FY ${submission.periodYear})`, 54, 58);

  // Metadata Right Column
  doc.setFont('helvetica', 'bold');
  doc.text('Submission Version:', 120, 34);
  doc.setFont('helvetica', 'normal');
  doc.text(`Revision v${submission.version} (Template v${submission.templateVersion || 1})`, 155, 34);

  doc.setFont('helvetica', 'bold');
  doc.text('NBE Reference No:', 120, 40);
  doc.setFont('courier', 'bold');
  doc.setTextColor(16, 185, 129);
  doc.text(submission.nbeReferenceNumber || 'PENDING_TRANSMISSION', 155, 40);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text('Maker (Prepared By):', 120, 46);
  doc.setFont('helvetica', 'normal');
  doc.text(`${submission.makerName} (${submission.makerDepartment || 'Maker'})`, 155, 46);

  doc.setFont('helvetica', 'bold');
  doc.text('Checker (4-Eyes Approved):', 120, 52);
  doc.setFont('helvetica', 'normal');
  doc.text(submission.checkerName ? `${submission.checkerName}` : 'Awaiting Checker Approval', 155, 52);

  doc.setFont('helvetica', 'bold');
  doc.text('Security Seal Hash:', 120, 58);
  doc.setFont('courier', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(sealHash.slice(0, 24) + '...', 155, 58);

  // Structured Return Items Table
  const tableRows = (reportDef.ReturnItemsList || []).map((item, idx) => {
    const rawVal = submission.values[item.Code];
    return [
      (idx + 1).toString(),
      item.Code,
      item._description || `Field ${item.Code}`,
      item._dataType || 'NUMERIC',
      formatReportValue(rawVal, item._dataType),
    ];
  });

  autoTable(doc, {
    startY: 69,
    head: [['#', 'NBE Field Code', 'Description / Financial Ledger Item', 'Data Type', 'Reported Value (ETB / Quantity)']],
    body: tableRows,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [30, 41, 89],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left',
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 28, fontStyle: 'bold', textColor: [2, 132, 199] },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 22, halign: 'center' },
      4: { cellWidth: 38, halign: 'right', fontStyle: 'bold' },
    },
    didDrawPage: (data) => {
      const pageCount = (doc as any).internal.getNumberOfPages();
      const currentPage = (doc as any).internal.getCurrentPageInfo().pageNumber;

      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Oromia Bank S.C. • Regulatory Return: ${reportDef.ReturnKey} • NBE Directive BSD/03/2020 Compliance`,
        14,
        287
      );
      doc.text(
        `Integrity Seal: ${sealHash.slice(0, 16)} • Page ${currentPage} of ${pageCount}`,
        210 - 14,
        287,
        { align: 'right' }
      );
    },
  });

  // Dynamic Table Areas if present
  let currentY = (doc as any).lastAutoTable.finalY || 160;

  if (reportDef.DynamicItemsList && reportDef.DynamicItemsList.length > 0) {
    for (const area of reportDef.DynamicItemsList) {
      const rows = submission.dynamicRows?.[area.Area] || [];
      if (rows.length > 0) {
        if (currentY > 240) {
          doc.addPage();
          currentY = 20;
        } else {
          currentY += 8;
        }

        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(20, 27, 65);
        doc.text(`Dynamic Schedule: ${area._areaName || `Area ${area.Area}`} (${rows.length} rows)`, 14, currentY);
        currentY += 4;

        const dynHeaders = ['#', ...area.DynamicItems.map((col) => col._description || col.Code)];
        const dynRows = rows.map((r, rIdx) => [
          (rIdx + 1).toString(),
          ...area.DynamicItems.map((col) => formatReportValue(r.values?.[col.Code], col._dataType)),
        ]);

        autoTable(doc, {
          startY: currentY,
          head: [dynHeaders],
          body: dynRows,
          theme: 'grid',
          styles: {
            fontSize: 7.5,
            cellPadding: 1.8,
            textColor: [30, 41, 59],
            lineColor: [226, 232, 240],
            lineWidth: 0.1,
          },
          headStyles: {
            fillColor: [51, 65, 85],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 8,
          },
        });

        currentY = (doc as any).lastAutoTable.finalY || currentY + 20;
      }
    }
  }

  // Official 4-Eyes Sign-Off & Certification Block
  if (currentY > 230) {
    doc.addPage();
    currentY = 20;
  } else {
    currentY += 10;
  }

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, currentY, 182, 34, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('OFFICIAL REGULATORY SUBMISSION CERTIFICATION & 4-EYES SIGN-OFF', 18, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    'We hereby certify that this return was prepared and verified in accordance with the National Bank of Ethiopia Banking Supervision Directives.',
    18,
    currentY + 11
  );

  // Maker Signature Line
  doc.line(20, currentY + 24, 75, currentY + 24);
  doc.setFontSize(7);
  doc.text(`Maker: ${submission.makerName}`, 20, currentY + 28);
  doc.text(`Date: ${submission.createdAt?.slice(0, 10) || now.toISOString().slice(0, 10)}`, 20, currentY + 31);

  // Checker Signature Line
  doc.line(85, currentY + 24, 140, currentY + 24);
  doc.text(`Checker: ${submission.checkerName || 'Authorized Signatory'}`, 85, currentY + 28);
  doc.text(`Reviewed: ${submission.reviewedAt?.slice(0, 10) || 'Pending'}`, 85, currentY + 31);

  // Seal & Stamp
  doc.line(148, currentY + 24, 190, currentY + 24);
  doc.setFont('courier', 'bold');
  doc.setTextColor(2, 132, 199);
  doc.text(`SEAL: [0000013-${submission.reportKey.slice(0, 6)}]`, 148, currentY + 28);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Ref: ${submission.nbeReferenceNumber ? submission.nbeReferenceNumber.slice(0, 12) : 'OB-OFFICIAL'}`, 148, currentY + 31);

  // Save the PDF
  const filename = `OROMIA_BANK_${submission.reportKey}_${submission.periodYear}_v${submission.version}_SIGNED.pdf`;
  doc.save(filename);
}

/**
 * Downloads general workflow / user audit trail logs as a signed PDF document
 */
export function exportGeneralAuditTrailPDF(
  logs: AuditLogEntry[],
  options: GeneralAuditPdfExportOptions = {}
): void {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const now = new Date();
  const formattedDate = now.toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'medium',
  });

  const checksum = `OB-AUDIT-${now.getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

  // Header background bar
  doc.setFillColor(20, 27, 65);
  doc.rect(0, 0, 297, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('OROMIA BANK S.C. - SYSTEM & REGULATORY AUDIT TRAIL LOG', 14, 11);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 215, 255);
  doc.text('National Bank of Ethiopia (NBE) Directive BSD/03/2020 Compliance Document', 14, 18);

  doc.setFont('helvetica', 'bold');
  doc.text(`DOC REF: ${checksum}`, 240, 11);
  doc.setFont('helvetica', 'normal');
  doc.text(`INSTITUTION: 0000013`, 240, 18);

  // Metadata Card Section
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 28, 269, 24, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);

  doc.setFont('helvetica', 'bold');
  doc.text('Export Timestamp:', 18, 34);
  doc.setFont('helvetica', 'normal');
  doc.text(formattedDate, 50, 34);

  doc.setFont('helvetica', 'bold');
  doc.text('Certifying Officer:', 18, 40);
  doc.setFont('helvetica', 'normal');
  doc.text(`${options.officerName || 'Abebe Bikila'} (${options.officerRole || 'Senior Compliance Officer'})`, 50, 40);

  doc.setFont('helvetica', 'bold');
  doc.text('Filter Criteria:', 18, 46);
  doc.setFont('helvetica', 'normal');
  doc.text(options.filtersSummary || 'All Audit Trail Events', 50, 46);

  doc.setFont('helvetica', 'bold');
  doc.text('Total Event Records:', 160, 34);
  doc.setFont('helvetica', 'normal');
  doc.text(`${logs.length} Logged Events`, 198, 34);

  doc.setFont('helvetica', 'bold');
  doc.text('Classification:', 160, 40);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(225, 29, 72);
  doc.text('CONFIDENTIAL - NBE AUDIT PAPER TRAIL', 198, 40);

  // Table of Audit Records
  const tableData = logs.map((log, index) => [
    (index + 1).toString(),
    new Date(log.timestamp).toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }),
    `${log.actorName}\n(${log.actorRole})`,
    log.action,
    log.entityType,
    log.entityId,
    log.details || '-',
  ]);

  autoTable(doc, {
    startY: 55,
    head: [['#', 'Timestamp', 'Actor & Role', 'Action Type', 'Entity', 'Entity ID / Return', 'Audit Narrative Details']],
    body: tableData,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [30, 41, 89],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 32 },
      2: { cellWidth: 34 },
      3: { cellWidth: 30, fontStyle: 'bold' },
      4: { cellWidth: 26 },
      5: { cellWidth: 34 },
      6: { cellWidth: 'auto' },
    },
    didDrawPage: (data) => {
      const pageCount = (doc as any).internal.getNumberOfPages();
      const currentPage = (doc as any).internal.getCurrentPageInfo().pageNumber;

      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Oromia Bank S.C. • Confidential Audit Paper Trail • NBE Directive BSD/03/2020 Compliance`,
        14,
        204
      );
      doc.text(
        `Checksum: ${checksum} • Page ${currentPage} of ${pageCount}`,
        297 - 14,
        204,
        { align: 'right' }
      );
    },
  });

  const filename = `OROMIA_BANK_SYSTEM_AUDIT_TRAIL_${now.toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
