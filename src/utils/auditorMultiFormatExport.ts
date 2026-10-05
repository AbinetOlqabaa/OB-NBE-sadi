/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import type { AuditorExportFormat, AuditorExportScope } from '../types/regulatory.ts';
import { auditorService } from '../services/auditorService.ts';

export interface TriggerAuditorExportOptions {
  format: AuditorExportFormat;
  scope: AuditorExportScope;
  mode: 'SINGLE' | 'BULK';
  selectedIds?: string[];
  actorName?: string;
}

/**
 * Phase 49: Multi-Format Single & Bulk Export Utility for Internal Audit Department.
 * Supports downloading results in CSV, XLSX, PDF, JSON, and XML formats.
 */
export function triggerAuditorMultiFormatExport(options: TriggerAuditorExportOptions) {
  const payload = auditorService.exportAuditData(options);

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return payload;
  }

  if (options.format === 'XLSX') {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Executive Performance & Audit Summary
    const summaryRows = [
      { Metric: 'Institution', Value: payload.metadata.institution },
      { Metric: 'Institution Code', Value: payload.metadata.institutionCode },
      { Metric: 'Governing Directive', Value: payload.metadata.directive },
      { Metric: 'Export Mode', Value: payload.metadata.exportMode },
      { Metric: 'Export Scope', Value: payload.metadata.exportScope },
      { Metric: 'Exported By', Value: payload.metadata.exportedBy },
      { Metric: 'Export Timestamp', Value: payload.metadata.exportedAt },
      { Metric: 'Cryptographic Tamper Seal', Value: payload.tamperSeal },
      { Metric: 'Total Submissions', Value: payload.metadata.performanceOverview.totalSubmissions },
      { Metric: 'Pending Corrections', Value: payload.metadata.performanceOverview.pendingCorrections },
      { Metric: 'Approved Today', Value: payload.metadata.performanceOverview.approvedToday },
      { Metric: 'Avg. Processing Time', Value: payload.metadata.performanceOverview.avgProcessingTimeFormatted },
      { Metric: 'Compliance Score (%)', Value: payload.metadata.kpiSummary.complianceScore },
    ];
    const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Executive_Summary');

    // Sheet 2: Exported Audit Records
    const recordsSheet = XLSX.utils.json_to_sheet(
      payload.rows.length > 0 ? payload.rows : [{ Note: 'No records matched current selection' }]
    );
    XLSX.utils.book_append_sheet(wb, recordsSheet, options.scope.slice(0, 28));

    // If FULL_AUDIT_DOSSIER, append Anomaly Feed & Findings sheets too
    if (options.scope === 'FULL_AUDIT_DOSSIER') {
      const anomalies = auditorService.getAnomalyDetectionFeed();
      const findings = auditorService.getFindings();
      if (anomalies.length > 0) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(anomalies), 'Anomaly_Detection_Feed');
      }
      if (findings.length > 0) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(findings), 'Audit_Findings');
      }
    }

    XLSX.writeFile(wb, payload.fileName);
    return payload;
  }

  if (options.format === 'PDF') {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();

    // Header Banner
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageW, 74, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('OROMIA BANK S.C. — INTERNAL AUDIT & NBE SUPERVISORY ASSURANCE DOSSIER', 32, 28);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Scope: ${options.scope} (${options.mode} EXPORT)  |  Officer: ${payload.metadata.exportedBy}  |  Seal: ${payload.tamperSeal}`,
      32,
      46
    );
    doc.text(
      `Total Submissions: ${payload.metadata.performanceOverview.totalSubmissions}  |  Pending Corrections: ${payload.metadata.performanceOverview.pendingCorrections}  |  Approved Today: ${payload.metadata.performanceOverview.approvedToday}  |  Avg. Processing Time: ${payload.metadata.performanceOverview.avgProcessingTimeFormatted}`,
      32,
      62
    );

    let y = 96;
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Exported Records (${payload.recordCount}) — Generated ${new Date(payload.metadata.exportedAt).toLocaleString()}`, 32, y);
    y += 18;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    payload.rows.slice(0, 28).forEach((row, idx) => {
      if (y > 530) {
        doc.addPage();
        y = 40;
      }
      const lineSummary = Object.entries(row)
        .slice(0, 7)
        .map(([k, v]) => `${k}: ${String(v ?? '').slice(0, 32)}`)
        .join('  |  ');
      doc.text(`${idx + 1}. ${lineSummary}`, 32, y);
      y += 14;
    });

    doc.save(payload.fileName);
    return payload;
  }

  // CSV, JSON, XML standard Blob download
  const blob = new Blob([payload.content], { type: payload.mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = payload.fileName;
  a.click();
  URL.revokeObjectURL(url);

  return payload;
}

/**
 * Utility to generate a Blob for an AuditorExportResult for headless testing and custom downloads
 */
export function generateAuditorExportBlob(exportResult: { content: string; mimeType: string }) {
  return new Blob([exportResult.content || ''], { type: exportResult.mimeType });
}
