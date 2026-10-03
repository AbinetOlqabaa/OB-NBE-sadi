/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from 'zod';
import type {
  ReportMetadata,
  ReportItemDefinition,
  DynamicAreaDefinition,
  DynamicRowRecord,
} from '../types/regulatory.ts';
import type {
  ValidationSummary,
  FieldValidationError,
  DynamicRowValidationError,
} from '../utils/validationEngine.ts';
import { templateInitializationService } from './templateInitializationService.ts';

export type ConstraintType =
  | 'MANDATORY'
  | 'CURRENCY_PRECISION'
  | 'CURRENCY_NEGATIVE'
  | 'RANGE'
  | 'FORMAT'
  | 'TYPE_MISMATCH';

export interface ZodFieldError {
  code: string;
  fieldTitle: string;
  message: string;
  severity: 'ERROR' | 'WARNING';
  constraintType: ConstraintType;
  path?: string;
  value?: any;
}

export interface FormValidationState extends ValidationSummary {
  fieldErrorsMap: Record<string, ZodFieldError>;
  dynamicCellErrorsMap: Record<string, ZodFieldError>;
  allErrors: ZodFieldError[];
  hasError: (code: string) => boolean;
  getFieldError: (code: string) => ZodFieldError | undefined;
  getDynamicError: (areaId: number, rowId: string, colCode: string) => ZodFieldError | undefined;
  timestamp: string;
}

/**
 * Checks whether an item represents an asset, capital, paid-up capital, deposit, or reserve
 * that strictly cannot carry a negative balance under NBE statutory guidelines.
 */
function isStrictlyNonNegativeCurrencyField(item: ReportItemDefinition): boolean {
  if (isPercentageRatioField(item) || isCountField(item)) {
    return false;
  }

  const desc = (item._description || '').toLowerCase();
  const code = (item.Code || '').toUpperCase();

  const isContraOrVariance =
    desc.includes('variance') ||
    desc.includes('change') ||
    desc.includes('net') ||
    desc.includes('loss') ||
    desc.includes('allowance') ||
    desc.includes('provision') ||
    desc.includes('adjustment') ||
    desc.includes('revaluation');

  if (isContraOrVariance) return false;

  const isAssetOrCapitalOrReserve =
    desc.includes('capital') ||
    desc.includes('paid-up') ||
    desc.includes('asset') ||
    desc.includes('principal') ||
    desc.includes('deposit') ||
    desc.includes('reserve') ||
    desc.includes('cash') ||
    desc.includes('balance with nbe') ||
    code.startsWith('CAP_') ||
    code.startsWith('AST_') ||
    code.startsWith('DEP_') ||
    code.startsWith('RES_');

  return isAssetOrCapitalOrReserve;
}

/**
 * Checks whether an item is a ratio or percentage.
 */
function isPercentageRatioField(item: ReportItemDefinition): boolean {
  const desc = (item._description || '').toLowerCase();
  const code = (item.Code || '').toUpperCase();
  return (
    desc.includes('%') ||
    desc.includes('ratio') ||
    desc.includes('rate') ||
    desc.includes('percentage') ||
    code.includes('RATIO') ||
    code.includes('CAR_') ||
    code.includes('PCT')
  );
}

/**
 * Checks whether an item represents an integer count.
 */
function isCountField(item: ReportItemDefinition): boolean {
  const desc = (item._description || '').toLowerCase();
  const code = (item.Code || '').toUpperCase();
  return (
    desc.includes('count') ||
    desc.includes('number of') ||
    desc.includes('no.') ||
    desc.includes('quantity') ||
    code.includes('COUNT') ||
    code.includes('NUM')
  );
}

/**
 * Real-Time Validation Service powered by Zod Schema Engine.
 * Attaches directly to DynamicReportForm to process field-level constraints in real time
 * and exposes a structured error state object to the UI.
 */
export class ZodValidationService {
  /**
   * Generates a dynamic Zod validator for a single regulatory return item.
   */
  public static createItemZodSchema(item: ReportItemDefinition): z.ZodTypeAny {
    let schema: z.ZodTypeAny = z.any();

    if (item._dataType === 'NUMERIC') {
      schema = z.union([z.number(), z.string(), z.null(), z.undefined()]).superRefine((val, ctx) => {
        const isSupplied = templateInitializationService.isFieldSupplied(val);

        // Mandatory check
        if (item._required && !isSupplied) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Field "${item._description}" (${item.Code}) is a mandatory regulatory field and cannot be left blank.`,
            params: { constraintType: 'MANDATORY', severity: 'ERROR' },
          });
          return;
        }

        // Optional and empty: allowed
        if (!item._required && !isSupplied) {
          return;
        }

        // Numeric parsing
        const num = Number(typeof val === 'string' ? val.replace(/,/g, '') : val);
        if (isNaN(num)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Numeric format error: "${item._description}" (${item.Code}) must be a valid numeric figure.`,
            params: { constraintType: 'FORMAT', severity: 'ERROR' },
          });
          return;
        }

        // Currency precision check (max 2 decimal places for ETB currency figures)
        if (!isPercentageRatioField(item) && !isCountField(item)) {
          const numStr = String(val).trim();
          if (numStr.includes('.')) {
            const decimals = numStr.split('.')[1];
            if (decimals && decimals.length > 2) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Currency precision error: Field "${item._description}" cannot exceed 2 decimal places for ETB figures (reported: ${numStr}).`,
                params: { constraintType: 'CURRENCY_PRECISION', severity: 'ERROR' },
              });
            }
          }
        }

        // Non-negative currency balance constraint
        if (num < 0) {
          if (isStrictlyNonNegativeCurrencyField(item)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Currency constraint error: Field "${item._description}" (${item.Code}) cannot carry a negative balance (${num.toLocaleString('en-US')}).`,
              params: { constraintType: 'CURRENCY_NEGATIVE', severity: 'ERROR' },
            });
          } else if (!isPercentageRatioField(item)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Warning: Negative value entered for "${item._description}" (${num.toLocaleString('en-US')}). Please confirm this represents an eligible debit balance.`,
              params: { constraintType: 'RANGE', severity: 'WARNING' },
            });
          }
        }

        // Percentage range constraints (0% to 100%)
        if (isPercentageRatioField(item)) {
          if (num < 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Range error: Percentage ratio for "${item._description}" cannot be negative (${num}%).`,
              params: { constraintType: 'RANGE', severity: 'ERROR' },
            });
          } else if (num > 100) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Range warning: Percentage ratio for "${item._description}" exceeds 100% (${num}%).`,
              params: { constraintType: 'RANGE', severity: 'WARNING' },
            });
          }
        }

        // Whole number count constraints
        if (isCountField(item)) {
          if (!Number.isInteger(num) || num < 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Constraint error: "${item._description}" must be a non-negative whole integer (${num}).`,
              params: { constraintType: 'RANGE', severity: 'ERROR' },
            });
          }
        }

        // Maximum upper bound sanity check
        if (Math.abs(num) > 1e14) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Range overflow: Value for "${item._description}" exceeds maximum regulatory threshold of 100 Trillion ETB.`,
            params: { constraintType: 'RANGE', severity: 'ERROR' },
          });
        }
      });
    } else if (item._dataType === 'DATE') {
      schema = z.union([z.string(), z.null(), z.undefined()]).superRefine((val, ctx) => {
        const isSupplied = templateInitializationService.isFieldSupplied(val);

        if (item._required && !isSupplied) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Mandatory date field "${item._description}" (${item.Code}) cannot be blank.`,
            params: { constraintType: 'MANDATORY', severity: 'ERROR' },
          });
          return;
        }

        if (!item._required && !isSupplied) {
          return;
        }

        if (isSupplied) {
          const dateVal = new Date(String(val));
          if (isNaN(dateVal.getTime())) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Invalid date format for "${item._description}". Expected YYYY-MM-DD.`,
              params: { constraintType: 'FORMAT', severity: 'ERROR' },
            });
          }
        }
      });
    } else {
      // TEXT or other types
      schema = z.union([z.string(), z.number(), z.null(), z.undefined()]).superRefine((val, ctx) => {
        const isSupplied = templateInitializationService.isFieldSupplied(val);

        if (item._required && !isSupplied) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Mandatory field "${item._description}" (${item.Code}) cannot be left blank.`,
            params: { constraintType: 'MANDATORY', severity: 'ERROR' },
          });
          return;
        }

        if (!item._required && !isSupplied) {
          return;
        }
      });
    }

    return schema;
  }

  /**
   * Generates a dynamic Zod schema for the entire fixed return items list.
   */
  public static buildReportSchema(metadata: ReportMetadata): z.ZodObject<Record<string, z.ZodTypeAny>> {
    const shape: Record<string, z.ZodTypeAny> = {};
    for (const item of metadata.ReturnItemsList) {
      shape[item.Code] = this.createItemZodSchema(item);
    }
    return z.object(shape);
  }

  /**
   * Validates a single return item instantly (used during field onChange/onBlur).
   */
  public static validateSingleField(item: ReportItemDefinition, value: any): ZodFieldError | null {
    const schema = this.createItemZodSchema(item);
    const result = schema.safeParse(value);

    if (!result.success && result.error.issues.length > 0) {
      const issue = result.error.issues[0];
      const params = (issue as any).params || {};
      return {
        code: item.Code,
        fieldTitle: item._description,
        message: issue.message,
        severity: params.severity || 'ERROR',
        constraintType: params.constraintType || 'FORMAT',
        value,
      };
    }

    return null;
  }

  /**
   * Processes all field-level and dynamic schedule constraints against the given metadata,
   * returning a unified, highly optimized FormValidationState object for the UI.
   */
  public static validateReport(
    metadata: ReportMetadata,
    values: Record<string, string | number>,
    dynamicRows: Record<number, DynamicRowRecord[]> = {}
  ): FormValidationState {
    const fieldErrorsMap: Record<string, ZodFieldError> = {};
    const dynamicCellErrorsMap: Record<string, ZodFieldError> = {};
    const fieldErrorsArray: FieldValidationError[] = [];
    const dynamicErrorsArray: DynamicRowValidationError[] = [];
    const allErrors: ZodFieldError[] = [];
    const ruleErrors: Array<{ id: string; name: string; description: string; severity: 'ERROR' | 'WARNING' }> = [];

    // 1. Process Fixed Return Items via Zod schemas
    for (const item of metadata.ReturnItemsList) {
      const val = values[item.Code];
      const err = this.validateSingleField(item, val);
      if (err) {
        fieldErrorsMap[item.Code] = err;
        fieldErrorsArray.push({
          code: err.code,
          fieldTitle: err.fieldTitle,
          message: err.message,
          severity: err.severity,
        });
        allErrors.push(err);
      }
    }

    // 2. Process Dynamic Schedule Repeatable Areas via Zod
    if (metadata.DynamicItemsList && metadata.DynamicItemsList.length > 0) {
      for (const area of metadata.DynamicItemsList) {
        const rows = dynamicRows[area.Area] || [];

        // Check if area is required and has at least one row
        if (area.DynamicItems.some((col) => col._required) && rows.length === 0) {
          ruleErrors.push({
            id: `RULE_AREA_${area.Area}_EMPTY`,
            name: `${area._areaName} Schedule Empty`,
            description: `The repeatable schedule "${area._areaName}" contains mandatory fields but currently has no populated rows.`,
            severity: 'WARNING',
          });
        }

        rows.forEach((row, index) => {
          for (const col of area.DynamicItems) {
            const rawVal =
              row.values && row.values[col.Code] !== undefined
                ? row.values[col.Code]
                : (row as any)[col.Code];

            // Build item representation for dynamic column
            const colItemDef: ReportItemDefinition = {
              Code: col.Code,
              _description: `${area._areaName} - ${col._description}`,
              _dataType: col._dataType,
              _required: col._required,
              Value: 0,
            };

            const cellErr = this.validateSingleField(colItemDef, rawVal);
            if (cellErr) {
              const cellKey = `${area.Area}:${row.id}:${col.Code}`;
              cellErr.path = cellKey;
              dynamicCellErrorsMap[cellKey] = cellErr;
              dynamicErrorsArray.push({
                areaId: area.Area,
                rowId: row.id,
                rowIndex: index + 1,
                columnCode: col.Code,
                columnTitle: col._description,
                message: cellErr.message,
              });
              allErrors.push(cellErr);
            }
          }
        });
      }
    }

    // 3. Process Higher-Order Validation Rules (Cross-Item & NBE Compliance Rules)
    if (metadata.ValidationRules && metadata.ValidationRules.length > 0) {
      const hasAnyBusinessData = Object.values(values).some((v) =>
        templateInitializationService.isFieldSupplied(v)
      );

      for (const rule of metadata.ValidationRules) {
        if (!hasAnyBusinessData) {
          continue;
        }

        try {
          let isPassed = false;
          if (typeof rule.check === 'function') {
            const dynRowsMapped: Record<number, Record<string, any>[]> = {};
            for (const [aId, rList] of Object.entries(dynamicRows)) {
              dynRowsMapped[Number(aId)] = rList.map((r) => r.values);
            }
            isPassed = rule.check(values, dynRowsMapped);
          } else if ((rule as any).expression) {
            const ruleExpr = String((rule as any).expression);
            const cleanExpression = ruleExpr.replace(/([A-Z0-9_]+)/g, (match: string) => {
              if (match === 'Math' || match === 'true' || match === 'false') return match;
              const item = metadata.ReturnItemsList.find((i) => i.Code === match);
              if (item) {
                const v = values[match];
                const n = typeof v === 'number' ? v : Number(v) || 0;
                return `(${n})`;
              }
              return match;
            });

            // Safe math evaluator
            // eslint-disable-next-line no-new-func
            const evalFn = new Function(`try { return Boolean(${cleanExpression}); } catch(e) { return false; }`);
            isPassed = evalFn();
          }

          if (!isPassed) {
            ruleErrors.push({
              id: rule.id,
              name: rule.name,
              description: rule.description,
              severity: rule.severity === 'WARNING' ? 'WARNING' : 'ERROR',
            });
          }
        } catch {
          // Ignore formula syntax parsing issues gracefully
        }
      }
    }

    // Counts calculation
    const fatalErrorsCount =
      allErrors.filter((e) => e.severity === 'ERROR').length +
      ruleErrors.filter((r) => r.severity === 'ERROR').length;
    const warningsCount =
      allErrors.filter((e) => e.severity === 'WARNING').length +
      ruleErrors.filter((r) => r.severity === 'WARNING').length;

    const isValid = fatalErrorsCount === 0;

    return {
      isValid,
      errorsCount: fatalErrorsCount,
      warningsCount,
      fieldErrors: fieldErrorsArray,
      dynamicErrors: dynamicErrorsArray,
      fieldErrorsMap,
      dynamicCellErrorsMap,
      allErrors,
      ruleErrors,
      hasError: (code: string) => Boolean(fieldErrorsMap[code] && fieldErrorsMap[code].severity === 'ERROR'),
      getFieldError: (code: string) => fieldErrorsMap[code],
      getDynamicError: (areaId: number, rowId: string, colCode: string) =>
        dynamicCellErrorsMap[`${areaId}:${rowId}:${colCode}`],
      timestamp: new Date().toISOString(),
    };
  }
}
