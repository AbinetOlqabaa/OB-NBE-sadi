/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ReportMetadata, DynamicRowRecord } from '../types/regulatory.ts';

export interface FieldValidationError {
  code: string;
  fieldTitle: string;
  message: string;
  severity: 'ERROR' | 'WARNING';
}

export interface DynamicRowValidationError {
  areaId: number;
  rowId: string;
  rowIndex: number;
  columnCode: string;
  columnTitle: string;
  message: string;
}

export interface ValidationSummary {
  isValid: boolean;
  errorsCount: number;
  warningsCount: number;
  fieldErrors: FieldValidationError[];
  dynamicErrors: DynamicRowValidationError[];
  ruleErrors: { id: string; name: string; description: string; severity: 'ERROR' | 'WARNING' }[];
}

export class ValidationEngine {
  /**
   * Validates a complete report submission payload.
   */
  public static validateReport(
    metadata: ReportMetadata,
    values: Record<string, string | number>,
    dynamicRows: Record<number, DynamicRowRecord[]> = {}
  ): ValidationSummary {
    const fieldErrors: FieldValidationError[] = [];
    const dynamicErrors: DynamicRowValidationError[] = [];
    const ruleErrors: { id: string; name: string; description: string; severity: 'ERROR' | 'WARNING' }[] = [];

    // 1. Validate Fixed ReturnItemsList
    for (const item of metadata.ReturnItemsList) {
      const val = values[item.Code];
      const hasValue = val !== undefined && val !== null && val !== '';

      if (item._required && !hasValue) {
        fieldErrors.push({
          code: item.Code,
          fieldTitle: item._description,
          message: `Mandatory field '${item._description}' cannot be empty`,
          severity: 'ERROR',
        });
        continue;
      }

      if (hasValue) {
        if (item._dataType === 'NUMERIC') {
          const num = Number(val);
          if (isNaN(num)) {
            fieldErrors.push({
              code: item.Code,
              fieldTitle: item._description,
              message: `Field '${item._description}' must be a valid numeric figure`,
              severity: 'ERROR',
            });
          }
        } else if (item._dataType === 'DATE') {
          const dateVal = String(val);
          const parsed = Date.parse(dateVal);
          if (isNaN(parsed) && !/^\d{4}-\d{2}-\d{2}/.test(dateVal)) {
            fieldErrors.push({
              code: item.Code,
              fieldTitle: item._description,
              message: `Field '${item._description}' must be a valid ISO date (YYYY-MM-DD)`,
              severity: 'ERROR',
            });
          }
        }
      }
    }

    // 2. Validate Dynamic Areas
    for (const area of metadata.DynamicItemsList) {
      const rows = dynamicRows[area.Area] || [];

      rows.forEach((row, index) => {
        for (const col of area.DynamicItems) {
          const colVal = row.values[col.Code];
          const hasVal = colVal !== undefined && colVal !== null && colVal !== '';

          if (col._required && !hasVal) {
            dynamicErrors.push({
              areaId: area.Area,
              rowId: row.id,
              rowIndex: index + 1,
              columnCode: col.Code,
              columnTitle: col._description,
              message: `Row #${index + 1}: Required column '${col._description}' is missing in Area ${area.Area}`,
            });
          }

          if (hasVal && col._dataType === 'NUMERIC') {
            const num = Number(colVal);
            if (isNaN(num)) {
              dynamicErrors.push({
                areaId: area.Area,
                rowId: row.id,
                rowIndex: index + 1,
                columnCode: col.Code,
                columnTitle: col._description,
                message: `Row #${index + 1}: Column '${col._description}' must be numeric`,
              });
            }
          }
        }
      });
    }

    // 3. Custom Business Validation Rules
    if (metadata.ValidationRules) {
      for (const rule of metadata.ValidationRules) {
        try {
          const dynRowsMapped: Record<number, Record<string, any>[]> = {};
          for (const [aId, rList] of Object.entries(dynamicRows)) {
            dynRowsMapped[Number(aId)] = rList.map((r) => r.values);
          }

          const passed = rule.check(values, dynRowsMapped);
          if (!passed) {
            ruleErrors.push({
              id: rule.id,
              name: rule.name,
              description: rule.description,
              severity: rule.severity,
            });
          }
        } catch {
          // If check threw an error, count as warning
          ruleErrors.push({
            id: rule.id,
            name: rule.name,
            description: rule.description,
            severity: 'WARNING',
          });
        }
      }
    }

    const errorsCount =
      fieldErrors.filter((e) => e.severity === 'ERROR').length +
      dynamicErrors.length +
      ruleErrors.filter((r) => r.severity === 'ERROR').length;

    const warningsCount =
      fieldErrors.filter((e) => e.severity === 'WARNING').length +
      ruleErrors.filter((r) => r.severity === 'WARNING').length;

    return {
      isValid: errorsCount === 0,
      errorsCount,
      warningsCount,
      fieldErrors,
      dynamicErrors,
      ruleErrors,
    };
  }
}
