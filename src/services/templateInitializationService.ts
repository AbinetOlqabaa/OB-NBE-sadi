/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  ReportMetadata,
  ReportItemDefinition,
  DynamicAreaDefinition,
  DynamicColumnDefinition,
  DynamicRowRecord,
  ReportSubmission,
  UserSession,
} from '../types/regulatory.ts';
import { FormulaEngine } from '../utils/formulaEngine.ts';

/**
 * Standard known UI placeholder strings that must never be sent to NBE
 * or treated as real business data.
 */
export const KNOWN_PLACEHOLDER_STRINGS = new Set([
  '0.00 ETB',
  '0.00',
  '0.00%',
  '0%',
  'YYYY-MM-DD',
  'Auto',
  'Auto-calculated',
  'Auto-Calculated',
  'Calculated',
  'Enter text...',
  'Optional note',
  'Required value',
  '-',
  'N/A',
]);

/**
 * Phase 33: Empty Template Initialization & Maker Data-Entry Semantics Service
 *
 * Implements:
 * 1. Clean separation of report-definition structural metadata from submission business values.
 * 2. Schema-aware initialization without copying sample values from old JSON definitions.
 * 3. Schema-aware neutral initial values (numeric, percentages, counts, dates, texts, repeating tables).
 * 4. UI placeholder resolution distinct from actual business data.
 * 5. Sanitization guaranteeing placeholder text is never transmitted to NBE.
 * 6. Untouched vs touched field tracking and premature validation noise suppression.
 * 7. Reset to template defaults for unsubmitted drafts without modifying the report definition.
 */
export class TemplateInitializationService {
  /**
   * Determines if a field represents a percentage or ratio.
   */
  public static isPercentageRatioField(item: ReportItemDefinition | DynamicColumnDefinition): boolean {
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
   * Determines if a field represents an integer count.
   */
  public static isCountField(item: ReportItemDefinition | DynamicColumnDefinition): boolean {
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
   * Checks whether a value string is a UI display placeholder.
   */
  public static isPlaceholderString(val: any): boolean {
    if (typeof val !== 'string') return false;
    const trimmed = val.trim();
    if (!trimmed) return false;

    if (KNOWN_PLACEHOLDER_STRINGS.has(trimmed)) return true;
    if (trimmed.startsWith('Enter ') || trimmed.startsWith('e.g. ')) return true;
    if (trimmed.endsWith(' ETB') && trimmed.startsWith('0.00')) return true;
    if (trimmed.endsWith('%') && (trimmed === '0.00%' || trimmed.startsWith('e.g.'))) return true;

    return false;
  }

  /**
   * Checks if an actual business value has been supplied by the Maker.
   * Untouched empty fields, nulls, and UI placeholder strings return false.
   */
  public static isFieldSupplied(val: any): boolean {
    if (val === undefined || val === null) return false;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed === '') return false;
      if (this.isPlaceholderString(trimmed)) return false;
      return true;
    }
    if (typeof val === 'number') {
      return !isNaN(val);
    }
    return Boolean(val);
  }

  /**
   * Phase 33: Determines if the Maker has entered any actual business data into the report.
   * Excludes pre-computed formula totals and structural schema defaults.
   * Used to suppress premature cross-field balancing and arithmetic rule warnings
   * on untouched clean templates.
   */
  public static hasMakerEnteredBusinessData(
    template: ReportMetadata,
    values: Record<string, any>,
    dynamicRows: Record<number, DynamicRowRecord[]> = {}
  ): boolean {
    const formulaTargets = new Set((template.Formulas || []).map((f) => f.targetCode));

    // 1. Check fixed return items (ignoring formula targets)
    for (const item of template.ReturnItemsList) {
      if (formulaTargets.has(item.Code)) continue;
      const rawItem = item as any;
      const isStructural = rawItem.isStructuralDefault === true || rawItem.defaultValue !== undefined;
      const val = values[item.Code];
      if (this.isFieldSupplied(val)) {
        if (isStructural && val === rawItem.defaultValue) {
          continue;
        }
        return true;
      }
    }

    // 2. Check dynamic rows (excluding structural default rows)
    for (const area of template.DynamicItemsList || []) {
      const rows = dynamicRows[area.Area] || [];
      const areaDef = area as any;
      const structRowCount = Array.isArray(areaDef.structuralRows) ? areaDef.structuralRows.length : 0;
      if (rows.length > structRowCount) return true;

      for (const row of rows) {
        for (const col of area.DynamicItems) {
          const colVal = row.values?.[col.Code];
          if (this.isFieldSupplied(colVal)) {
            const rawCol = col as any;
            const isColStruct = rawCol.isStructuralDefault === true || rawCol.defaultValue !== undefined;
            if (isColStruct && colVal === rawCol.defaultValue) {
              continue;
            }
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Returns the schema-aware initial value for a field.
   *
   * Crucial Regulatory Rule (Phase 33):
   * Do not solve validation noise by inventing financial facts. A placeholder
   * must never be mistaken for a real ETB amount, ratio, account count, date or regulatory value.
   * Where the existing NBE schema explicitly defines a structural default, use that default.
   * Otherwise keep the business value unset ('').
   */
  public static getSchemaAwareInitialValue(
    item: ReportItemDefinition | DynamicColumnDefinition
  ): string | number {
    // 1. Explicit structural default declared in the schema
    const rawItem = item as any;
    if (
      rawItem.isStructuralDefault === true &&
      rawItem.defaultValue !== undefined &&
      rawItem.defaultValue !== null &&
      rawItem.defaultValue !== ''
    ) {
      return rawItem.defaultValue;
    }

    if (rawItem.defaultValue !== undefined && rawItem.defaultValue !== null && rawItem.defaultValue !== '') {
      return rawItem.defaultValue;
    }

    // 2. Otherwise keep unset ('') so no business figures are invented
    return '';
  }

  /**
   * Generates a schema-aware UI placeholder for a form field.
   * Used for HTML input placeholder attributes, distinct from actual values.
   */
  public static getSchemaAwarePlaceholder(
    item: ReportItemDefinition | DynamicColumnDefinition,
    isFormula: boolean = false
  ): string {
    if (isFormula) {
      return 'Auto-calculated';
    }

    if (item._dataType === 'NUMERIC') {
      if (this.isPercentageRatioField(item)) {
        return '0.00%';
      }
      if (this.isCountField(item)) {
        return '0';
      }
      return '0.00 ETB';
    }

    if (item._dataType === 'DATE') {
      return 'YYYY-MM-DD';
    }

    // TEXT / STRING
    if (item._description) {
      const cleanDesc = item._description.replace(/_/g, ' ').trim();
      return cleanDesc.length > 28 ? 'Enter text...' : `Enter ${cleanDesc}...`;
    }

    return 'Enter text...';
  }

  /**
   * Initializes a clean draft dataset from a report template.
   * Guarantees:
   * 1. Preserves all titles, subtitles, row labels, column labels, categories, and structural topics.
   * 2. Initializes editable fields to clean schema-aware initial states.
   * 3. Does not copy sample values from old JSON definitions or legacy template objects.
   * 4. Initializes repeating dynamic schedules without invented figures.
   */
  public static initializeDraftFromTemplate(template: ReportMetadata): {
    values: Record<string, string | number>;
    dynamicRows: Record<number, DynamicRowRecord[]>;
  } {
    const values: Record<string, string | number> = {};

    // 1. Initialize fixed return items
    for (const item of template.ReturnItemsList) {
      values[item.Code] = this.getSchemaAwareInitialValue(item);
    }

    // 2. Initialize dynamic schedule areas
    const dynamicRows: Record<number, DynamicRowRecord[]> = {};
    for (const area of template.DynamicItemsList) {
      const areaDef = area as any;
      if (Array.isArray(areaDef.structuralRows) && areaDef.structuralRows.length > 0) {
        // Initialize declared structural rows without invented business amounts
        dynamicRows[area.Area] = areaDef.structuralRows.map((sr: any, idx: number) => {
          const rowVals: Record<string, string | number> = {};
          for (const col of area.DynamicItems) {
            rowVals[col.Code] = sr[col.Code] !== undefined ? sr[col.Code] : this.getSchemaAwareInitialValue(col);
          }
          return {
            id: `row_${area.Area}_struct_${idx + 1}`,
            areaId: area.Area,
            values: rowVals,
          };
        });
      } else {
        dynamicRows[area.Area] = [];
      }
    }

    // 3. Pre-calculate formula totals if applicable
    if (template.Formulas && template.Formulas.length > 0) {
      try {
        const calculated = FormulaEngine.calculateReport(template, values, dynamicRows);
        for (const [code, val] of Object.entries(calculated)) {
          if (template.Formulas.some((f) => f.targetCode === code)) {
            values[code] = val;
          }
        }
      } catch (_) {}
    }

    return { values, dynamicRows };
  }

  /**
   * Sanitizes a value before submission to the NBE supervisory gateway.
   * Ensures UI placeholder text is NEVER transmitted to NBE.
   */
  public static sanitizeFieldValue(val: any): string | number {
    if (val === undefined || val === null) {
      return '';
    }

    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (this.isPlaceholderString(trimmed)) {
        return '';
      }
      return trimmed;
    }

    if (typeof val === 'number') {
      return isNaN(val) ? '' : val;
    }

    return String(val);
  }

  /**
   * Sanitizes complete submission values and dynamic rows for NBE payload transmission.
   */
  public static sanitizePayloadForNBE(
    values: Record<string, any>,
    dynamicRows: Record<number, DynamicRowRecord[]> = {}
  ): {
    values: Record<string, string | number>;
    dynamicRows: Record<number, DynamicRowRecord[]>;
  } {
    const cleanValues: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(values)) {
      cleanValues[k] = this.sanitizeFieldValue(v);
    }

    const cleanDynamic: Record<number, DynamicRowRecord[]> = {};
    for (const [areaIdStr, rows] of Object.entries(dynamicRows)) {
      const areaId = Number(areaIdStr);
      cleanDynamic[areaId] = (rows || []).map((r) => {
        const rowValues: Record<string, string | number> = {};
        for (const [colCode, cellVal] of Object.entries(r.values || {})) {
          rowValues[colCode] = this.sanitizeFieldValue(cellVal);
        }
        return {
          ...r,
          values: rowValues,
        };
      });
    }

    return { values: cleanValues, dynamicRows: cleanDynamic };
  }

  /**
   * Resets an unsubmitted draft's values and schedules back to template defaults,
   * without mutating the underlying report definition in any way.
   */
  public static resetDraftToTemplateDefaults(
    submission: ReportSubmission,
    template: ReportMetadata
  ): {
    values: Record<string, string | number>;
    dynamicRows: Record<number, DynamicRowRecord[]>;
  } {
    return this.initializeDraftFromTemplate(template);
  }
}

export const templateInitializationService = TemplateInitializationService;
