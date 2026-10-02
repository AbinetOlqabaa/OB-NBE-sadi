/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from 'zod';
import type {
  ReportMetadata,
  DynamicRowRecord,
  ReportItemDefinition,
  DynamicAreaDefinition,
} from '../types/regulatory.ts';
import {
  ValidationEngine,
  ValidationSummary,
  FieldValidationError,
  DynamicRowValidationError,
} from '../utils/validationEngine.ts';

export interface ZodFieldError {
  code: string;
  fieldTitle: string;
  message: string;
  severity: 'ERROR' | 'WARNING';
  constraintType?:
    | 'MANDATORY'
    | 'CURRENCY_PRECISION'
    | 'NON_NEGATIVE'
    | 'PERCENTAGE_RANGE'
    | 'INTEGER_COUNT'
    | 'FORMAT'
    | 'RULE';
  path?: (string | number)[];
}

export interface FormValidationState {
  isValid: boolean;
  errorsCount: number;
  warningsCount: number;
  fieldErrors: ZodFieldError[];
  dynamicErrors: DynamicRowValidationError[];
  ruleErrors: { id: string; name: string; description: string; severity: 'ERROR' | 'WARNING' }[];
  allErrors: ZodFieldError[];
  fieldErrorsMap: Record<string, ZodFieldError>;
  getFieldError: (code: string) => ZodFieldError | undefined;
  hasFieldError: (code: string) => boolean;
}

export class ZodValidationService {
  /**
   * Builds dynamic Zod schema for a specific return item based on regulatory constraints.
   */
  public static buildItemSchema(item: ReportItemDefinition) {
    const descLower = item._description.toLowerCase();
    const isRatio =
      descLower.includes('percent') ||
      descLower.includes('ratio') ||
      descLower.includes('rate (%)') ||
      descLower.includes('car (%)');
    const isCount =
      descLower.includes('number of') ||
      descLower.includes('count') ||
      descLower.includes('quantity');
    const isNonNegativeBalance =
      !descLower.includes('variance') &&
      !descLower.includes('net change') &&
      !descLower.includes('loss') &&
      !descLower.includes('adjustment') &&
      !descLower.includes('reconciliation') &&
      (descLower.includes('paid-up') ||
        descLower.includes('capital') ||
        descLower.includes('deposit') ||
        descLower.includes('statutory reserve') ||
        descLower.includes('cash on hand') ||
        descLower.includes('facility limit') ||
        descLower.includes('collateral'));

    if (item._dataType === 'NUMERIC') {
      let numSchema = z.union([z.number(), z.string()]).superRefine((val, ctx) => {
        if (val === '' || val === null || val === undefined) {
          if (item._required) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Mandatory field: '${item._description}' (${item.Code}) cannot be left blank for regulatory compliance.`,
              params: { constraintType: 'MANDATORY' },
            });
          }
          return;
        }

        const rawStr = String(val).replace(/,/g, '').trim();
        const num = Number(rawStr);

        if (isNaN(num) || !/^-?\d*(\.\d+)?$/.test(rawStr)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Currency / Numeric format error: '${val}' must be a valid numeric figure.`,
            params: { constraintType: 'FORMAT' },
          });
          return;
        }

        // Precision check: max 2 decimals for currency
        if (!isRatio && !isCount && rawStr.includes('.')) {
          const dec = rawStr.split('.')[1];
          if (dec && dec.length > 2) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Currency precision error: '${val}' cannot have more than 2 decimal places for ETB currency figures.`,
              params: { constraintType: 'CURRENCY_PRECISION' },
            });
          }
        }

        // Percentage bounds
        if (isRatio) {
          if (num < 0 || num > 100) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Range constraint: '${item._description}' is a ratio/percentage and must be between 0.00% and 100.00% (Current: ${num}%).`,
              params: { constraintType: 'PERCENTAGE_RANGE' },
            });
          }
        } else if (isCount) {
          if (num < 0 || !Number.isInteger(num)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Count constraint: '${item._description}' must be a non-negative whole integer (Current: ${num}).`,
              params: { constraintType: 'INTEGER_COUNT' },
            });
          }
        } else if (isNonNegativeBalance && num < 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Currency constraint: '${item._description}' cannot have a negative balance (${num.toLocaleString()} ETB). Verify if negative balance is authorized under NBE directives.`,
            params: { constraintType: 'NON_NEGATIVE' },
          });
        }
      });

      return numSchema;
    }

    // Default string / text / date schema
    if (item._required) {
      return z
        .string()
        .min(1, `Mandatory field: '${item._description}' (${item.Code}) cannot be left blank for regulatory compliance.`);
    }
    return z.string().optional();
  }

  /**
   * Validates report values and dynamic rows using Zod schema combined with ValidationEngine rules.
   */
  public static validateReport(
    metadata: ReportMetadata,
    values: Record<string, string | number>,
    dynamicRows: Record<number, DynamicRowRecord[]> = {}
  ): FormValidationState {
    const fieldErrors: ZodFieldError[] = [];
    const fieldErrorsMap: Record<string, ZodFieldError> = {};

    // 1. Zod schema evaluation for each fixed line item
    for (const item of metadata.ReturnItemsList) {
      const schema = this.buildItemSchema(item);
      const val = values[item.Code];
      const result = schema.safeParse(val);

      if (!result.success) {
        for (const issue of result.error.issues) {
          const constraintType =
            ((issue as any).params as any)?.constraintType ||
            (issue.message.includes('Mandatory') ? 'MANDATORY' : 'FORMAT');
          const errorObj: ZodFieldError = {
            code: item.Code,
            fieldTitle: item._description,
            message: issue.message,
            severity: 'ERROR',
            constraintType,
            path: [item.Code],
          };
          fieldErrors.push(errorObj);
          if (!fieldErrorsMap[item.Code]) {
            fieldErrorsMap[item.Code] = errorObj;
          }
        }
      }
    }

    // 2. Cross-check with ValidationEngine for dynamic areas and statutory rule checks
    const baseSummary = ValidationEngine.validateReport(metadata, values, dynamicRows);

    // Merge any missing warnings/errors from ValidationEngine
    for (const err of baseSummary.fieldErrors) {
      if (!fieldErrorsMap[err.code]) {
        const errorObj: ZodFieldError = {
          code: err.code,
          fieldTitle: err.fieldTitle,
          message: err.message,
          severity: err.severity,
          constraintType: err.severity === 'WARNING' ? 'PERCENTAGE_RANGE' : 'FORMAT',
        };
        fieldErrors.push(errorObj);
        fieldErrorsMap[err.code] = errorObj;
      }
    }

    // Dynamic row errors to allErrors
    const allErrors: ZodFieldError[] = [...fieldErrors];
    for (const dErr of baseSummary.dynamicErrors) {
      allErrors.push({
        code: `${dErr.areaId}_${dErr.rowId}_${dErr.columnCode}`,
        fieldTitle: `${dErr.columnTitle} (Row ${dErr.rowIndex + 1})`,
        message: dErr.message,
        severity: 'ERROR',
        constraintType: 'MANDATORY',
      });
    }

    const errorsCount = allErrors.filter((e) => e.severity === 'ERROR').length;
    const warningsCount = allErrors.filter((e) => e.severity === 'WARNING').length;

    const state: FormValidationState = {
      isValid: errorsCount === 0 && baseSummary.isValid,
      errorsCount,
      warningsCount,
      fieldErrors,
      dynamicErrors: baseSummary.dynamicErrors,
      ruleErrors: baseSummary.ruleErrors,
      allErrors,
      fieldErrorsMap,
      getFieldError: (code: string) => fieldErrorsMap[code],
      hasFieldError: (code: string) => {
        const err = fieldErrorsMap[code];
        return !!err && err.severity === 'ERROR';
      },
    };

    return state;
  }
}
