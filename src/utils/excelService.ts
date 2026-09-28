/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from 'xlsx';
import type { ReportMetadata, ReportSubmission, DynamicRowRecord } from '../types/regulatory.ts';

export interface ExcelImportResult {
  success: boolean;
  values: Record<string, string | number>;
  dynamicRows: Record<number, DynamicRowRecord[]>;
  warnings: string[];
  errors: string[];
}

export class ExcelService {
  /**
   * Generates an XLSX workbook for a report (template or populated submission).
   */
  public static exportToWorkbook(
    metadata: ReportMetadata,
    values: Record<string, string | number> = {},
    dynamicRows: Record<number, DynamicRowRecord[]> = {}
  ): XLSX.WorkBook {
    const wb = XLSX.utils.book_new();

    // 1. Overview & Return Items Sheet
    const overviewData: any[][] = [
      ['NBE REGULATORY REPORTING PORTAL - OROMIA BANK'],
      ['ReturnKey', metadata.ReturnKey],
      ['Report Title', metadata.Title],
      ['Institution Code', metadata.InstCode],
      ['Financial Year', metadata.FinYear],
      ['Reporting Period', `${metadata.StartDate.split('T')[0]} to ${metadata.EndDate.split('T')[0]}`],
      ['Frequency', metadata.Frequency],
      [],
      ['Code', 'Description', 'Data Type', 'Required', 'Value']
    ];

    for (const item of metadata.ReturnItemsList) {
      const val = values[item.Code] !== undefined ? values[item.Code] : item.Value;
      overviewData.push([
        item.Code,
        item._description,
        item._dataType,
        item._required ? 'YES' : 'NO',
        val
      ]);
    }

    const wsOverview = XLSX.utils.aoa_to_sheet(overviewData);
    XLSX.utils.book_append_sheet(wb, wsOverview, 'Return Items');

    // 2. Dynamic Schedule Sheets (if present)
    for (const area of metadata.DynamicItemsList) {
      const areaRows = dynamicRows[area.Area] || [];
      const sheetName = `Area ${area.Area}`.slice(0, 31);

      const headerRow = area.DynamicItems.map((col) => `${col.Code} - ${col._description}`);
      const codeRow = area.DynamicItems.map((col) => col.Code);
      const rowsData: any[][] = [
        [`DYNAMIC SCHEDULE: ${area._areaName || 'Area ' + area.Area}`],
        headerRow,
        codeRow
      ];

      for (const r of areaRows) {
        const rowVals = area.DynamicItems.map((col) => r.values[col.Code] !== undefined ? r.values[col.Code] : '');
        rowsData.push(rowVals);
      }

      const wsArea = XLSX.utils.aoa_to_sheet(rowsData);
      XLSX.utils.book_append_sheet(wb, wsArea, sheetName);
    }

    return wb;
  }

  /**
   * Exports workbook to an ArrayBuffer or binary data for download.
   */
  public static exportToBinary(
    metadata: ReportMetadata,
    values: Record<string, string | number> = {},
    dynamicRows: Record<number, DynamicRowRecord[]> = {}
  ): Uint8Array {
    const wb = this.exportToWorkbook(metadata, values, dynamicRows);
    const out = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return out instanceof Uint8Array ? out : new Uint8Array(out);
  }

  /**
   * Imports an XLSX workbook buffer and extracts field values and dynamic rows.
   */
  public static importFromBuffer(
    buffer: ArrayBuffer | Uint8Array,
    metadata: ReportMetadata
  ): ExcelImportResult {
    const values: Record<string, string | number> = {};
    const dynamicRows: Record<number, DynamicRowRecord[]> = {};
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      const wb = XLSX.read(buffer, { type: 'array' });
      if (!wb || !wb.SheetNames || wb.SheetNames.length === 0) {
        return { success: false, values: {}, dynamicRows: {}, warnings: [], errors: ['Invalid or empty Excel file'] };
      }

      // 1. Process "Return Items" Sheet
      const overviewSheet = wb.Sheets['Return Items'] || wb.Sheets[wb.SheetNames[0]];
      if (overviewSheet) {
        const rawJson: any[][] = XLSX.utils.sheet_to_json(overviewSheet, { header: 1 });
        
        let headerRowIdx = -1;
        for (let i = 0; i < rawJson.length; i++) {
          const row = rawJson[i];
          if (row && (row[0] === 'Code' || row.includes('Code'))) {
            headerRowIdx = i;
            break;
          }
        }

        if (headerRowIdx !== -1) {
          for (let i = headerRowIdx + 1; i < rawJson.length; i++) {
            const row = rawJson[i];
            if (!row || row.length === 0) continue;
            const code = String(row[0] || '').trim();
            const val = row[4] !== undefined ? row[4] : row[1]; // Value column or second column

            if (code && metadata.ReturnItemsList.some((it) => it.Code === code)) {
              values[code] = val !== undefined && val !== null ? val : '';
            }
          }
        } else {
          warnings.push("Could not locate standardized 'Code' header row in first sheet; attempting fallback mapping.");
        }
      }

      // 2. Process Dynamic Area Sheets
      for (const area of metadata.DynamicItemsList) {
        const sheetNameMatch = wb.SheetNames.find((s) => s.includes(`Area ${area.Area}`) || s.toLowerCase().includes('schedule') || s.toLowerCase().includes('dynamic'));
        if (sheetNameMatch) {
          const areaSheet = wb.Sheets[sheetNameMatch];
          const rawAreaJson: any[][] = XLSX.utils.sheet_to_json(areaSheet, { header: 1 });
          
          let codeRowIdx = -1;
          for (let i = 0; i < rawAreaJson.length; i++) {
            const r = rawAreaJson[i];
            if (r && r.some((c: any) => area.DynamicItems.some((di) => String(c).trim() === di.Code))) {
              codeRowIdx = i;
              break;
            }
          }

          if (codeRowIdx !== -1) {
            const codeMapping: string[] = rawAreaJson[codeRowIdx].map((c: any) => String(c || '').trim());
            const parsedRows: DynamicRowRecord[] = [];

            for (let rIdx = codeRowIdx + 1; rIdx < rawAreaJson.length; rIdx++) {
              const dataRow = rawAreaJson[rIdx];
              if (!dataRow || dataRow.length === 0) continue;

              const rowVals: Record<string, string | number> = {};
              let hasAnyData = false;

              codeMapping.forEach((colCode, colIdx) => {
                if (colCode && dataRow[colIdx] !== undefined && dataRow[colIdx] !== null && dataRow[colIdx] !== '') {
                  rowVals[colCode] = dataRow[colIdx];
                  hasAnyData = true;
                }
              });

              if (hasAnyData) {
                parsedRows.push({
                  id: 'row_' + Math.random().toString(36).substring(2, 9),
                  areaId: area.Area,
                  values: rowVals,
                });
              }
            }

            dynamicRows[area.Area] = parsedRows;
          }
        }
      }

      return {
        success: errors.length === 0,
        values,
        dynamicRows,
        warnings,
        errors,
      };
    } catch (err: any) {
      return {
        success: false,
        values: {},
        dynamicRows: {},
        warnings: [],
        errors: [`XLSX parsing failed: ${err.message}`],
      };
    }
  }
}
