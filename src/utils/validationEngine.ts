/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ReportMetadata, DynamicRowRecord } from '../types/regulatory.ts';
import { templateInitializationService } from '../services/templateInitializationService.ts';

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
      const hasValue = templateInitializationService.isFieldSupplied(val);

      if (item._required && !hasValue) {
        fieldErrors.push({
          code: item.Code,
          fieldTitle: item._description,
          message: `Mandatory field: '${item._description}' (${item.Code}) cannot be left blank for regulatory compliance.`,
          severity: 'ERROR',
        });
        continue;
      }

      if (hasValue) {
        if (item._dataType === 'NUMERIC') {
          // Check for string values that fail numeric conversion
          if (typeof val === 'string' && val.trim() !== '') {
            const cleanStr = val.replace(/,/g, '').trim();
            if (isNaN(Number(cleanStr)) || !/^-?\d*(\.\d+)?$/.test(cleanStr)) {
              fieldErrors.push({
                code: item.Code,
                fieldTitle: item._description,
                message: `Currency / Numeric format error: '${val}' must be a valid numeric figure.`,
                severity: 'ERROR',
              });
              continue;
            }
          }

          const num = Number(typeof val === 'string' ? val.replace(/,/g, '') : val);
          if (isNaN(num)) {
            fieldErrors.push({
              code: item.Code,
              fieldTitle: item._description,
              message: `Field '${item._description}' must be a valid numeric figure.`,
              severity: 'ERROR',
            });
          } else {
            // Range & boundary constraints
            const descLower = item._description.toLowerCase();
            const isRatioOrPercent = descLower.includes('percent') || descLower.includes('ratio') || descLower.includes('rate (%)') || descLower.includes('car (%)');
            const isCountField = descLower.includes('number of') || descLower.includes('count') || descLower.includes('quantity');
            const isAssetOrCapitalOrReserve = !descLower.includes('variance') && !descLower.includes('net change') && !descLower.includes('loss') && !descLower.includes('adjustment') && !descLower.includes('reconciliation');

            // Currency precision check: maximum 2 decimal places for ETB currency
            if (!isRatioOrPercent && !isCountField) {
              const valStr = String(val).replace(/,/g, '').trim();
              if (valStr.includes('.')) {
                const decimalPart = valStr.split('.')[1];
                if (decimalPart && decimalPart.length > 2) {
                  fieldErrors.push({
                    code: item.Code,
                    fieldTitle: item._description,
                    message: `Currency precision error: '${val}' cannot have more than 2 decimal places for ETB currency figures.`,
                    severity: 'ERROR',
                  });
                }
              }
            }

            if (isRatioOrPercent) {
              if (num < 0 || num > 100) {
                fieldErrors.push({
                  code: item.Code,
                  fieldTitle: item._description,
                  message: `Range constraint: '${item._description}' is a ratio/percentage and must be between 0.00% and 100.00% (Current: ${num}%).`,
                  severity: num < 0 ? 'ERROR' : 'WARNING',
                });
              }
            } else if (isCountField) {
              if (num < 0 || !Number.isInteger(num)) {
                fieldErrors.push({
                  code: item.Code,
                  fieldTitle: item._description,
                  message: `Count constraint: '${item._description}' must be a non-negative whole integer (Current: ${num}).`,
                  severity: 'ERROR',
                });
              }
            } else if (
              num < 0 &&
              (descLower.includes('paid-up') ||
                descLower.includes('capital') ||
                descLower.includes('deposit') ||
                descLower.includes('statutory reserve') ||
                descLower.includes('cash on hand') ||
                descLower.includes('facility limit') ||
                descLower.includes('collateral'))
            ) {
              fieldErrors.push({
                code: item.Code,
                fieldTitle: item._description,
                message: `Currency constraint: '${item._description}' cannot have a negative balance (${num.toLocaleString()} ETB). Verify if negative balance is authorized under NBE directives.`,
                severity: 'ERROR',
              });
            } else if (isAssetOrCapitalOrReserve && num < 0) {
              fieldErrors.push({
                code: item.Code,
                fieldTitle: item._description,
                message: `Constraint warning: '${item._description}' is reported with negative value (${num.toLocaleString()}). Verify if negative balance is authorized.`,
                severity: 'WARNING',
              });
            }

            // Upper sanity bound constraint (100 Trillion ETB)
            if (Math.abs(num) > 1e14) {
              fieldErrors.push({
                code: item.Code,
                fieldTitle: item._description,
                message: `Upper bound anomaly: Value exceeds 100,000,000,000,000 ETB. Please verify scaling.`,
                severity: 'ERROR',
              });
            }
          }
        } else if (item._dataType === 'DATE') {
          const dateVal = String(val).trim();
          const isIsoFormat = /^\d{4}-\d{2}-\d{2}$/.test(dateVal);
          const parsed = Date.parse(dateVal);
          if (!isIsoFormat || isNaN(parsed)) {
            fieldErrors.push({
              code: item.Code,
              fieldTitle: item._description,
              message: `Date format error: '${dateVal}' must follow standard ISO format (YYYY-MM-DD).`,
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
          const hasVal = templateInitializationService.isFieldSupplied(colVal);

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
      const hasAnyBusinessData = templateInitializationService.hasMakerEnteredBusinessData(
        metadata,
        values,
        dynamicRows
      );

      for (const rule of metadata.ValidationRules) {
        if (!hasAnyBusinessData) {
          continue;
        }

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

  /**
   * Helper to retrieve active validation error for a specific field code.
   */
  public static getFieldError(
    summary: ValidationSummary | null,
    code: string
  ): FieldValidationError | undefined {
    if (!summary || !summary.fieldErrors) return undefined;
    return summary.fieldErrors.find((e) => e.code === code);
  }

  /**
   * Helper to check if a specific field currently has an active error.
   */
  public static hasFieldError(
    summary: ValidationSummary | null,
    code: string
  ): boolean {
    const err = this.getFieldError(summary, code);
    return !!err && err.severity === 'ERROR';
  }

  /**
   * Helper to retrieve active validation error for a dynamic schedule cell.
   */
  public static getDynamicCellError(
    summary: ValidationSummary | null,
    areaId: number,
    rowId: string,
    colCode: string
  ): DynamicRowValidationError | undefined {
    if (!summary || !summary.dynamicErrors) return undefined;
    return summary.dynamicErrors.find(
      (e) => e.areaId === areaId && e.rowId === rowId && e.columnCode === colCode
    );
  }
}
