/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  ReportMetadata,
  ReportItemDefinition,
  DynamicRowRecord,
  UserSession,
} from '../types/regulatory.ts';
import type {
  NormalizedValidationItem,
  NormalizedValidationSummary,
  ExplanationDetails,
  ProposedFix,
  RemediationAuditEvent,
} from '../types/remediation.ts';
import { FormulaEngine } from '../utils/formulaEngine.ts';
import { auditService } from './auditService.ts';
import { templateInitializationService } from './templateInitializationService.ts';

/**
 * Checks whether an item represents an asset, capital, paid-up capital, deposit, or reserve
 * that strictly cannot carry a negative balance under NBE statutory guidelines.
 */
function isStrictlyNonNegativeCurrencyField(item: ReportItemDefinition): boolean {
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
    desc.includes('reconciliation');

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
    desc.includes('facility limit') ||
    desc.includes('collateral') ||
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
 * Phase 24: Unified Validation & Remediation Assistant Service
 *
 * Provides authoritative server-side validation normalization,
 * 4-part explanations (WHAT IS WRONG, WHY IT MATTERS, HOW TO FIX IT, WHAT IS EXPECTED),
 * distinction of DATA ERROR vs REPORT-DEFINITION/RULE ERROR,
 * and safe deterministic Auto-Fix capabilities with pre-application review.
 */
export class ValidationRemediationService {
  /**
   * Normalizes validation results across fixed items, dynamic schedules,
   * business rules, and report definitions.
   */
  public static normalizeReportValidation(
    metadata: ReportMetadata,
    values: Record<string, string | number>,
    dynamicRows: Record<number, DynamicRowRecord[]> = {}
  ): NormalizedValidationSummary {
    const items: NormalizedValidationItem[] = [];

    // Precalculate formulas to detect formula desynchronization
    const computedValues = FormulaEngine.calculateReport(metadata, values, dynamicRows);

    // 0. Check Report Definition & Metadata Integrity (Requirement 12: REPORT-DEFINITION ERROR)
    this.inspectReportDefinition(metadata, items);

    // 1. Inspect Fixed Return Items (DATA ERRORS)
    for (const item of metadata.ReturnItemsList) {
      const val = values[item.Code];
      const isFormula = metadata.Formulas.some((f) => f.targetCode === item.Code);
      const formulaDef = metadata.Formulas.find((f) => f.targetCode === item.Code);

      const hasValue = templateInitializationService.isFieldSupplied(val);

      // 1A. Mandatory Field Blank Check
      if (item._required && !hasValue) {
        items.push({
          id: `VAL_${item.Code}_MANDATORY`,
          severity: 'BLOCKING_ERROR',
          category: 'DATA_ERROR',
          constraintType: 'MANDATORY',
          fieldCode: item.Code,
          fieldTitle: item._description,
          path: item.Code,
          message: `Mandatory regulatory field '${item._description}' (${item.Code}) is blank.`,
          explanation: {
            whatIsWrong: `The required field '${item._description}' (${item.Code}) contains no value or has not yet been supplied.`,
            whyItMatters: `NBE Directive BSD/03/2020 strictly requires all mandatory schedule line items to be populated before submission. Blank mandatory items cause automated rejection at the supervisory gateway.`,
            howToFix: `Enter the verified balance or figure from your department's core banking general ledger or trial balance.`,
            expectedFormat: `A non-empty ${item._dataType.toLowerCase()} figure compliant with the reporting period.`,
          },
          suggestedAction: `Populate '${item._description}' from trial balance`,
          ruleSource: 'NBE Directive BSD/03/2020 Statutory Return Completeness Mandate',
          autoFixable: false, // Requirement 7: Never automatically change ambiguous business values
        });
        continue;
      }

      // 1B. Formula Cell Desynchronization Check
      if (isFormula && hasValue && computedValues[item.Code] !== undefined) {
        const currentNum = typeof val === 'number' ? val : Number(String(val).replace(/,/g, ''));
        const expectedNum = computedValues[item.Code];
        if (!isNaN(currentNum) && typeof expectedNum === 'number' && Math.abs(currentNum - expectedNum) > 0.001) {
          items.push({
            id: `VAL_${item.Code}_FORMULA_DESYNC`,
            severity: 'BLOCKING_ERROR',
            category: 'DATA_ERROR',
            constraintType: 'FORMULA_OUT_OF_SYNC',
            fieldCode: item.Code,
            fieldTitle: item._description,
            path: item.Code,
            message: `Computed total '${item._description}' (${val}) is out of sync with formula calculation (${expectedNum}).`,
            explanation: {
              whatIsWrong: `The current value (${val}) does not match the authoritative formula evaluation (${expectedNum}). Expression: ${formulaDef?.expression || 'N/A'}.`,
              whyItMatters: `Internal mathematical consistency across parent and child items is mandatory. The NBE validation gateway automatically recalculates all formula totals and rejects submissions with discrepancies.`,
              howToFix: `Click 'Auto Fix' to synchronize this total with its underlying component items, or manually adjust component items.`,
              expectedFormat: `Exact calculated value: ${expectedNum}`,
            },
            suggestedAction: `Synchronize formula total to ${expectedNum}`,
            ruleSource: `Statutory Calculation Rule: ${formulaDef?.description || formulaDef?.expression || 'Formula'}`,
            autoFixable: true,
            proposedFix: {
              targetField: item.Code,
              currentValue: val,
              proposedValue: expectedNum,
              description: `Recompute formula '${formulaDef?.expression || item.Code}'`,
              isDeterministic: true,
              requiresReview: true,
              ruleSource: `Formula Synchronization (${formulaDef?.expression})`,
            },
          });
        }
      }

      // If value is present, evaluate type, format, ranges, and precision
      if (hasValue) {
        if (item._dataType === 'NUMERIC') {
          // Check for string formatting errors
          if (typeof val === 'string') {
            const trimmed = val.trim();
            const hasSurroundingWhitespace = val !== trimmed;

            // Check if string contains comma separators or untrimmed spaces
            if (hasSurroundingWhitespace || (val.includes(',') && !isNaN(Number(val.replace(/,/g, '').trim())))) {
              const cleanNum = Number(val.replace(/,/g, '').trim());
              items.push({
                id: `VAL_${item.Code}_FORMAT_NUMERIC_STR`,
                severity: 'WARNING',
                category: 'DATA_ERROR',
                constraintType: 'FORMAT',
                fieldCode: item.Code,
                fieldTitle: item._description,
                path: item.Code,
                message: `Numeric input '${val}' contains unnormalized commas or whitespace.`,
                explanation: {
                  whatIsWrong: `The numeric field contains formatting characters ('${val}') that should be stored as clean numeric representation.`,
                  whyItMatters: `Standardized numeric encoding prevents parser ambiguity during automated electronic export to the NBE gateway.`,
                  howToFix: `Click 'Auto Fix' to normalize the figure to clean numeric value (${cleanNum}).`,
                  expectedFormat: `Clean numeric figure without extraneous spaces: ${cleanNum}`,
                },
                suggestedAction: `Normalize formatting to ${cleanNum}`,
                ruleSource: 'NBE Data Encoding Standard (Numeric Normalization)',
                autoFixable: true,
                proposedFix: {
                  targetField: item.Code,
                  currentValue: val,
                  proposedValue: cleanNum,
                  description: 'Remove comma separators and whitespace',
                  isDeterministic: true,
                  requiresReview: false, // safe formatting normalization
                  ruleSource: 'NBE Data Encoding Standard',
                },
              });
            }

            // Check for unparseable numeric strings
            const cleanStr = val.replace(/,/g, '').trim();
            if (isNaN(Number(cleanStr)) || !/^-?\d*(\.\d+)?$/.test(cleanStr)) {
              items.push({
                id: `VAL_${item.Code}_NAN`,
                severity: 'BLOCKING_ERROR',
                category: 'DATA_ERROR',
                constraintType: 'TYPE_MISMATCH',
                fieldCode: item.Code,
                fieldTitle: item._description,
                path: item.Code,
                message: `Invalid numeric value '${val}' in '${item._description}'.`,
                explanation: {
                  whatIsWrong: `The entry '${val}' cannot be parsed as a valid numeric amount.`,
                  whyItMatters: `Non-numeric text in financial return items corrupts arithmetic aggregations and violates data integrity rules.`,
                  howToFix: `Replace '${val}' with a valid decimal or integer figure.`,
                  expectedFormat: `Standard decimal number, e.g. 1500000.00`,
                },
                suggestedAction: `Enter valid numeric digits`,
                ruleSource: 'Supervisory Data Format Specification',
                autoFixable: false,
              });
              continue;
            }
          }

          const num = Number(typeof val === 'string' ? val.replace(/,/g, '').trim() : val);

          // 1C. Currency Precision Check (Max 2 decimals for ETB)
          const isRatio = isPercentageRatioField(item);
          const isCount = isCountField(item);

          if (!isRatio && !isCount) {
            const valStr = String(val).replace(/,/g, '').trim();
            if (valStr.includes('.')) {
              const decimals = valStr.split('.')[1] || '';
              if (decimals.length > 2) {
                const roundedVal = FormulaEngine.roundFinancial(num, 2);
                items.push({
                  id: `VAL_${item.Code}_PRECISION`,
                  severity: 'BLOCKING_ERROR',
                  category: 'DATA_ERROR',
                  constraintType: 'CURRENCY_PRECISION',
                  fieldCode: item.Code,
                  fieldTitle: item._description,
                  path: item.Code,
                  message: `Currency figure '${val}' has ${decimals.length} decimal places (max 2 allowed for ETB).`,
                  explanation: {
                    whatIsWrong: `Ethiopian Birr figure '${val}' exceeds the 2-decimal statutory precision limit with ${decimals.length} decimal places.`,
                    whyItMatters: `Under NBE Directive BSD/03/2020, financial balances are denominated to cents (0.01 ETB). Fractional fractions cause rounding divergence across supervisory consolidations.`,
                    howToFix: `Click 'Auto Fix' to safely round this figure to 2 decimal places (${roundedVal}), or adjust your source journal.`,
                    expectedFormat: `ETB currency with at most 2 decimal places, e.g. ${roundedVal}`,
                  },
                  suggestedAction: `Round to 2 decimal places (${roundedVal} ETB)`,
                  ruleSource: 'NBE Directive BSD/03/2020 Currency Precision Standard',
                  autoFixable: true,
                  proposedFix: {
                    targetField: item.Code,
                    currentValue: val,
                    proposedValue: roundedVal,
                    description: `Round currency to 2 decimal places (${roundedVal} ETB)`,
                    isDeterministic: true,
                    requiresReview: true, // Non-trivial fix: show CURRENT -> PROPOSED before applying (Requirement 8)
                    ruleSource: 'NBE Directive BSD/03/2020 Currency Precision Standard',
                  },
                });
              }
            }
          }

          // 1D. Non-Negative Currency Constraints
          if (num < 0 && isStrictlyNonNegativeCurrencyField(item)) {
            items.push({
              id: `VAL_${item.Code}_NEGATIVE_CAPITAL`,
              severity: 'BLOCKING_ERROR',
              category: 'DATA_ERROR',
              constraintType: 'CURRENCY_NEGATIVE',
              fieldCode: item.Code,
              fieldTitle: item._description,
              path: item.Code,
              message: `Prohibited negative balance (${num.toLocaleString()} ETB) in '${item._description}'.`,
              explanation: {
                whatIsWrong: `The field '${item._description}' reports a negative balance (${num.toLocaleString()} ETB).`,
                whyItMatters: `Capital, asset, deposit, and statutory reserve accounts must maintain positive balances under prudential standards. Negative balances signal ledger mapping errors or unposted adjustments.`,
                howToFix: `Verify your trial balance and reverse the inadvertent debit/credit sign. If this account is legitimately in deficit, file an explanatory exception request with the Compliance Officer.`,
                expectedFormat: `A non-negative ETB figure (>= 0.00 ETB)`,
              },
              suggestedAction: `Investigate negative balance and adjust in trial balance`,
              ruleSource: 'NBE Prudential Directive on Asset & Capital Integrity',
              autoFixable: false, // Never automatically change ambiguous business values!
            });
          } else if (num < 0 && !isRatio && !isCount) {
            // General warning for other negative balances
            items.push({
              id: `VAL_${item.Code}_NEGATIVE_WARN`,
              severity: 'WARNING',
              category: 'DATA_ERROR',
              constraintType: 'CURRENCY_NEGATIVE',
              fieldCode: item.Code,
              fieldTitle: item._description,
              path: item.Code,
              message: `Negative balance warning (${num.toLocaleString()} ETB) reported in '${item._description}'.`,
              explanation: {
                whatIsWrong: `'${item._description}' has a negative figure (${num.toLocaleString()}).`,
                whyItMatters: `While not strictly prohibited for all variance lines, negative values frequently indicate inverted sign convention in Excel imports.`,
                howToFix: `Confirm whether this line is expected to carry a debit or credit balance.`,
                expectedFormat: `Appropriate positive or negative figure consistent with accounting convention.`,
              },
              suggestedAction: `Verify accounting sign convention with Finance`,
              ruleSource: 'Internal Accounting Sanity Check',
              autoFixable: false,
            });
          }

          // 1E. Ratio / Percentage Constraints (0.00% to 100.00%)
          if (isRatio) {
            if (num < 0) {
              items.push({
                id: `VAL_${item.Code}_RATIO_NEG`,
                severity: 'BLOCKING_ERROR',
                category: 'DATA_ERROR',
                constraintType: 'RANGE',
                fieldCode: item.Code,
                fieldTitle: item._description,
                path: item.Code,
                message: `Percentage ratio '${item._description}' cannot be negative (${num}%).`,
                explanation: {
                  whatIsWrong: `Reported percentage ratio is negative (${num}%).`,
                  whyItMatters: `Supervisory ratios (such as CAR, liquidity ratio, loan-to-deposit ratio) have a mathematical domain starting at 0.00%.`,
                  howToFix: `Recalculate numerator and denominator from the underlying regulatory capital computation sheet.`,
                  expectedFormat: `Percentage ratio between 0.00% and 100.00%`,
                },
                suggestedAction: `Correct ratio numerator and denominator`,
                ruleSource: 'NBE Directive BSD/03/2020 Statutory Ratio Rules',
                autoFixable: false,
              });
            } else if (num > 100) {
              items.push({
                id: `VAL_${item.Code}_RATIO_EXCESS`,
                severity: 'WARNING',
                category: 'DATA_ERROR',
                constraintType: 'RANGE',
                fieldCode: item.Code,
                fieldTitle: item._description,
                path: item.Code,
                message: `Percentage ratio '${item._description}' exceeds 100.00% (${num}%).`,
                explanation: {
                  whatIsWrong: `Reported ratio is ${num}%, which exceeds standard 100% threshold.`,
                  whyItMatters: `Certain statutory ratios may legitimately exceed 100% under specific capitalization structures, but unusually high ratios usually indicate a missing percentage scale factor (e.g. entering 1500 instead of 15%).`,
                  howToFix: `Verify if this ratio is entered as a percentage (e.g. 18.5 for 18.5%) or decimal fraction.`,
                  expectedFormat: `Percentage figure (0.00% to 100.00% typical range)`,
                },
                suggestedAction: `Verify scaling factor for ratio`,
                ruleSource: 'Statutory Supervisory Ratio Boundary Guidelines',
                autoFixable: false,
              });
            }
          }

          // 1F. Whole Integer Count Constraints
          if (isCount) {
            if (num < 0 || !Number.isInteger(num)) {
              items.push({
                id: `VAL_${item.Code}_COUNT_INTEGER`,
                severity: 'BLOCKING_ERROR',
                category: 'DATA_ERROR',
                constraintType: 'RANGE',
                fieldCode: item.Code,
                fieldTitle: item._description,
                path: item.Code,
                message: `Count field '${item._description}' must be a non-negative whole integer (Current: ${num}).`,
                explanation: {
                  whatIsWrong: `The count field contains a fractional or negative value (${num}).`,
                  whyItMatters: `Borrower, account, facility, and staffing counts represent indivisible entities. Fractional counts are invalid in supervisory statistics.`,
                  howToFix: `Enter the discrete integer count of entities.`,
                  expectedFormat: `Non-negative whole integer (e.g. 0, 1, 2, ...)`,
                },
                suggestedAction: `Enter exact integer count`,
                ruleSource: 'NBE Statistical Reporting Directive',
                autoFixable: false, // Never guess whether 124.6 was 124 or 125 without audit source
              });
            }
          }

          // 1G. Upper Bound Sanity Check (100 Trillion ETB)
          if (Math.abs(num) > 1e14) {
            items.push({
              id: `VAL_${item.Code}_UPPER_BOUND`,
              severity: 'BLOCKING_ERROR',
              category: 'DATA_ERROR',
              constraintType: 'RANGE',
              fieldCode: item.Code,
              fieldTitle: item._description,
              path: item.Code,
              message: `Anomaly: '${item._description}' value exceeds 100,000,000,000,000 ETB.`,
              explanation: {
                whatIsWrong: `The entered value (${num.toExponential()}) exceeds total national macroeconomic limits.`,
                whyItMatters: `Extreme outliers indicate unit scale errors (such as entering cents as Birr or typing accidental repeating digits).`,
                howToFix: `Verify the magnitude and correct unit denomination.`,
                expectedFormat: `Realistic banking ledger figure < 100 Trillion ETB`,
              },
              suggestedAction: `Verify unit magnitude`,
              ruleSource: 'Supervisory Sanity Bounds',
              autoFixable: false,
            });
          }
        } else if (item._dataType === 'DATE') {
          // Date format validation
          const dateStr = String(val);
          const trimmedDate = dateStr.trim();
          const isIso = /^\d{4}-\d{2}-\d{2}$/.test(trimmedDate);
          const parsed = Date.parse(trimmedDate);

          // Check if date can be normalized from common alternate formats (e.g. " 2026-03-31 ", "2026/03/31", "31/03/2026")
          if (!isIso || isNaN(parsed)) {
            let normalizedIso: string | null = null;

            // Pattern: YYYY/MM/DD
            if (/^\d{4}\/\d{2}\/\d{2}$/.test(trimmedDate)) {
              normalizedIso = trimmedDate.replace(/\//g, '-');
            }
            // Pattern: DD/MM/YYYY
            else if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmedDate)) {
              const [d, m, y] = trimmedDate.split('/');
              normalizedIso = `${y}-${m}-${d}`;
            }
            // Pattern: DD-MM-YYYY
            else if (/^\d{2}-\d{2}-\d{4}$/.test(trimmedDate)) {
              const [d, m, y] = trimmedDate.split('-');
              normalizedIso = `${y}-${m}-${d}`;
            }

            if (normalizedIso && !isNaN(Date.parse(normalizedIso))) {
              items.push({
                id: `VAL_${item.Code}_DATE_FORMAT`,
                severity: 'BLOCKING_ERROR',
                category: 'DATA_ERROR',
                constraintType: 'FORMAT',
                fieldCode: item.Code,
                fieldTitle: item._description,
                path: item.Code,
                message: `Date '${val}' is not in standard ISO format (YYYY-MM-DD).`,
                explanation: {
                  whatIsWrong: `The date format '${val}' does not comply with the ISO-8601 YYYY-MM-DD supervisory requirement.`,
                  whyItMatters: `Standardized date format ensures deterministic date arithmetic and cross-system database interoperability.`,
                  howToFix: `Click 'Auto Fix' to convert '${val}' to standard ISO format '${normalizedIso}'.`,
                  expectedFormat: `ISO Date: YYYY-MM-DD (e.g. ${normalizedIso})`,
                },
                suggestedAction: `Convert to ISO format (${normalizedIso})`,
                ruleSource: 'ISO-8601 Regulatory Date Interchange Standard',
                autoFixable: true,
                proposedFix: {
                  targetField: item.Code,
                  currentValue: val,
                  proposedValue: normalizedIso,
                  description: `Normalize date to ISO-8601 format (${normalizedIso})`,
                  isDeterministic: true,
                  requiresReview: true,
                  ruleSource: 'ISO-8601 Standard',
                },
              });
            } else {
              items.push({
                id: `VAL_${item.Code}_DATE_INVALID`,
                severity: 'BLOCKING_ERROR',
                category: 'DATA_ERROR',
                constraintType: 'FORMAT',
                fieldCode: item.Code,
                fieldTitle: item._description,
                path: item.Code,
                message: `Invalid calendar date '${val}' in '${item._description}'.`,
                explanation: {
                  whatIsWrong: `The date '${val}' cannot be parsed as a valid calendar date.`,
                  whyItMatters: `Reporting period cutoff dates must resolve to valid calendar days for supervisory periodization.`,
                  howToFix: `Enter a valid date formatted as YYYY-MM-DD.`,
                  expectedFormat: `ISO-8601 date (YYYY-MM-DD, e.g. 2026-03-31)`,
                },
                suggestedAction: `Enter valid ISO calendar date`,
                ruleSource: 'ISO-8601 Regulatory Date Interchange Standard',
                autoFixable: false,
              });
            }
          } else if (dateStr !== trimmedDate) {
            // Safe whitespace trim
            items.push({
              id: `VAL_${item.Code}_DATE_WHITESPACE`,
              severity: 'WARNING',
              category: 'DATA_ERROR',
              constraintType: 'FORMAT',
              fieldCode: item.Code,
              fieldTitle: item._description,
              path: item.Code,
              message: `Date '${val}' has unnecessary whitespace.`,
              explanation: {
                whatIsWrong: `The date value has leading or trailing spaces.`,
                whyItMatters: `Trailing spaces can disrupt strict regex matching during gateway schema validation.`,
                howToFix: `Click 'Auto Fix' to trim whitespace.`,
                expectedFormat: `Trimmed date: ${trimmedDate}`,
              },
              suggestedAction: `Trim spaces to '${trimmedDate}'`,
              ruleSource: 'NBE Data Encoding Standard',
              autoFixable: true,
              proposedFix: {
                targetField: item.Code,
                currentValue: val,
                proposedValue: trimmedDate,
                description: 'Trim extraneous whitespace from date',
                isDeterministic: true,
                requiresReview: false,
                ruleSource: 'NBE Data Encoding Standard',
              },
            });
          }
        }
      }
    }

    // 2. Inspect Repeatable Dynamic Schedule Areas (DATA ERRORS)
    if (metadata.DynamicItemsList && metadata.DynamicItemsList.length > 0) {
      for (const area of metadata.DynamicItemsList) {
        const rows = dynamicRows[area.Area] || [];

        rows.forEach((row, index) => {
          for (const col of area.DynamicItems) {
            const rawVal =
              row.values && row.values[col.Code] !== undefined
                ? row.values[col.Code]
                : (row as any)[col.Code];

            const cellKey = `${area.Area}:${row.id}:${col.Code}`;
            const hasCellVal = templateInitializationService.isFieldSupplied(rawVal);

            // Mandatory dynamic cell check
            if (col._required && !hasCellVal) {
              items.push({
                id: `VAL_DYN_${cellKey}_MANDATORY`,
                severity: 'BLOCKING_ERROR',
                category: 'DATA_ERROR',
                constraintType: 'MANDATORY',
                fieldCode: col.Code,
                fieldTitle: `${area._areaName} - Row #${index + 1} (${col._description})`,
                path: cellKey,
                areaId: area.Area,
                rowId: row.id,
                rowIndex: index + 1,
                message: `Row #${index + 1} in '${area._areaName}': Column '${col._description}' is required.`,
                explanation: {
                  whatIsWrong: `Schedule row #${index + 1} is missing mandatory column '${col._description}'.`,
                  whyItMatters: `Repeatable schedules (such as large exposures and collateral items) must have complete row attributes to pass NBE supervisory database ingestion.`,
                  howToFix: `Enter the required '${col._description}' for row #${index + 1}.`,
                  expectedFormat: `Valid ${col._dataType.toLowerCase()} entry`,
                },
                suggestedAction: `Fill column in dynamic row #${index + 1}`,
                ruleSource: `Dynamic Schedule Completeness: ${area._areaName}`,
                autoFixable: false,
              });
            }

            // Numeric check for dynamic cell
            if (hasCellVal && col._dataType === 'NUMERIC') {
              const num = Number(typeof rawVal === 'string' ? rawVal.replace(/,/g, '').trim() : rawVal);
              if (isNaN(num)) {
                items.push({
                  id: `VAL_DYN_${cellKey}_NAN`,
                  severity: 'BLOCKING_ERROR',
                  category: 'DATA_ERROR',
                  constraintType: 'TYPE_MISMATCH',
                  fieldCode: col.Code,
                  fieldTitle: `${area._areaName} - Row #${index + 1} (${col._description})`,
                  path: cellKey,
                  areaId: area.Area,
                  rowId: row.id,
                  rowIndex: index + 1,
                  message: `Row #${index + 1}: Value '${rawVal}' in '${col._description}' is not numeric.`,
                  explanation: {
                    whatIsWrong: `Non-numeric value '${rawVal}' entered in dynamic numeric column.`,
                    whyItMatters: `Schedule amounts must be aggregated into balance sheet totals. Non-numeric values cause calculation failures.`,
                    howToFix: `Enter valid numeric figure for row #${index + 1}.`,
                    expectedFormat: `Numeric amount (e.g. 5000000.00)`,
                  },
                  suggestedAction: `Enter valid numeric figure`,
                  ruleSource: `Dynamic Schedule Format: ${area._areaName}`,
                  autoFixable: false,
                });
              } else {
                // Precision check for dynamic currency
                const rawStr = String(rawVal).replace(/,/g, '').trim();
                if (rawStr.includes('.')) {
                  const dec = rawStr.split('.')[1] || '';
                  if (dec.length > 2) {
                    const rounded = FormulaEngine.roundFinancial(num, 2);
                    items.push({
                      id: `VAL_DYN_${cellKey}_PRECISION`,
                      severity: 'BLOCKING_ERROR',
                      category: 'DATA_ERROR',
                      constraintType: 'CURRENCY_PRECISION',
                      fieldCode: col.Code,
                      fieldTitle: `${area._areaName} - Row #${index + 1} (${col._description})`,
                      path: cellKey,
                      areaId: area.Area,
                      rowId: row.id,
                      rowIndex: index + 1,
                      message: `Row #${index + 1}: Amount '${rawVal}' has ${dec.length} decimal places (max 2 allowed).`,
                      explanation: {
                        whatIsWrong: `Dynamic row figure '${rawVal}' exceeds 2 decimal places.`,
                        whyItMatters: `ETB currency amounts are strictly denominated to cents.`,
                        howToFix: `Click 'Auto Fix' to round row #${index + 1} amount to ${rounded}.`,
                        expectedFormat: `ETB amount with max 2 decimals (${rounded})`,
                      },
                      suggestedAction: `Round row #${index + 1} to 2 decimals (${rounded})`,
                      ruleSource: 'NBE Currency Standard',
                      autoFixable: true,
                      proposedFix: {
                        targetField: col.Code,
                        targetPath: cellKey,
                        areaId: area.Area,
                        rowId: row.id,
                        currentValue: rawVal,
                        proposedValue: rounded,
                        description: `Round dynamic cell to 2 decimals (${rounded})`,
                        isDeterministic: true,
                        requiresReview: true,
                        ruleSource: 'NBE Currency Precision Standard',
                      },
                    });
                  }
                }
              }
            }
          }
        });
      }
    }

    // 3. Inspect Higher-Order Business Rules (BUSINESS_RULE_ERROR)
    if (metadata.ValidationRules && metadata.ValidationRules.length > 0) {
      // Phase 33 Requirement 8: Check if any business data has been supplied.
      // If template is completely untouched/clean, mandatory missing checks already flag unsupplied fields.
      // Do not produce duplicate balancing errors across untouched empty templates.
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

          let passed = false;
          if (typeof rule.check === 'function') {
            passed = rule.check(values, dynRowsMapped);
          }

          if (!passed) {
            const isError = rule.severity === 'ERROR';
            items.push({
              id: `VAL_RULE_${rule.id}`,
              severity: isError ? 'BLOCKING_ERROR' : 'WARNING',
              category: 'BUSINESS_RULE_ERROR',
              constraintType: 'CROSS_FIELD_RULE',
              fieldCode: rule.id,
              fieldTitle: rule.name,
              path: rule.id,
              message: `Business rule check '${rule.name}' failed: ${rule.description}`,
              explanation: {
                whatIsWrong: `Cross-item balancing condition failed: ${rule.description}`,
                whyItMatters: `NBE supervisory validation algorithms verify internal consistency across accounting schedules. Mismatched cross-field balances trigger immediate audit inquiries and rejection.`,
                howToFix: `Reconcile the component line items specified in rule '${rule.name}' with your general ledger so that the equations balance.`,
                expectedFormat: `Condition must evaluate to true: ${rule.description}`,
              },
              suggestedAction: `Reconcile cross-field components`,
              ruleSource: `Statutory Business Rule: ${rule.name}`,
              autoFixable: false, // Never automatically alter business balances
            });
          }
        } catch (err: any) {
          // Rule evaluation failure
          items.push({
            id: `VAL_RULE_EXCEPTION_${rule.id}`,
            severity: 'WARNING',
            category: 'BUSINESS_RULE_ERROR',
            constraintType: 'CROSS_FIELD_RULE',
            fieldCode: rule.id,
            fieldTitle: rule.name,
            path: rule.id,
            message: `Rule '${rule.name}' could not be evaluated: ${err.message || 'Syntax exception'}`,
            explanation: {
              whatIsWrong: `The business validation rule threw an unexpected exception during execution.`,
              whyItMatters: `Supervisory rules must be able to evaluate return data cleanly.`,
              howToFix: `Ensure all dependent fields have valid numeric values.`,
              expectedFormat: `Valid numeric figures in dependent items`,
            },
            suggestedAction: `Check dependent line items`,
            ruleSource: `Internal Rule Engine: ${rule.name}`,
            autoFixable: false,
          });
        }
      }
    }

    // 4. Summarize counts and readiness
    const blockingErrorsCount = items.filter((i) => i.severity === 'BLOCKING_ERROR').length;
    const warningsCount = items.filter((i) => i.severity === 'WARNING').length;
    const autoFixableCount = items.filter((i) => i.autoFixable).length;
    const dataErrorsCount = items.filter((i) => i.category === 'DATA_ERROR').length;
    const reportDefinitionErrorsCount = items.filter((i) => i.category === 'REPORT_DEFINITION_ERROR').length;
    const businessRuleErrorsCount = items.filter((i) => i.category === 'BUSINESS_RULE_ERROR').length;

    const isValid = blockingErrorsCount === 0;
    const isSubmissionReady = isValid;

    return {
      isValid,
      isSubmissionReady,
      blockingErrorsCount,
      warningsCount,
      autoFixableCount,
      dataErrorsCount,
      reportDefinitionErrorsCount,
      businessRuleErrorsCount,
      items,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Inspects the report template metadata for structural defects.
   * Requirement 12: Distinguish DATA ERROR from REPORT-DEFINITION/RULE ERROR.
   * Only authorized configuration users (ADMIN) can change report definitions.
   */
  private static inspectReportDefinition(metadata: ReportMetadata, items: NormalizedValidationItem[]): void {
    if (!metadata.ReturnItemsList || metadata.ReturnItemsList.length === 0) {
      items.push({
        id: `VAL_DEF_NO_ITEMS`,
        severity: 'BLOCKING_ERROR',
        category: 'REPORT_DEFINITION_ERROR',
        constraintType: 'SCHEMA_STRUCTURAL',
        fieldCode: metadata.ReturnKey,
        fieldTitle: `Report Definition: ${metadata.Title}`,
        path: 'ReturnItemsList',
        message: `Report definition '${metadata.Code}' contains no line items.`,
        explanation: {
          whatIsWrong: `The report template definition has an empty ReturnItemsList.`,
          whyItMatters: `Submissions cannot be prepared or validated against an empty template structure.`,
          howToFix: `Only authorized configuration users (ADMIN) can modify report definitions. Contact your System Administrator to update this template in Report Template Studio.`,
          expectedFormat: `Template must define at least one valid ReturnItemDefinition`,
        },
        suggestedAction: `Contact Compliance Administrator to configure template`,
        ruleSource: 'Configuration Governance Policy',
        autoFixable: false,
      });
    }

    // Check for duplicate field codes in report definition
    const seenCodes = new Set<string>();
    for (const item of metadata.ReturnItemsList || []) {
      if (seenCodes.has(item.Code)) {
        items.push({
          id: `VAL_DEF_DUP_${item.Code}`,
          severity: 'BLOCKING_ERROR',
          category: 'REPORT_DEFINITION_ERROR',
          constraintType: 'SCHEMA_STRUCTURAL',
          fieldCode: item.Code,
          fieldTitle: `Duplicate Code: ${item.Code}`,
          path: item.Code,
          message: `Report definition contains duplicate field code '${item.Code}'.`,
          explanation: {
            whatIsWrong: `The field code '${item.Code}' is defined multiple times in this template definition.`,
            whyItMatters: `Duplicate codes cause ambiguous state mapping and corrupt report serialization.`,
            howToFix: `Only authorized configuration users (ADMIN) can modify report definitions in Report Template Studio. Contact your System Administrator.`,
            expectedFormat: `Strictly unique field codes across the return template`,
          },
          suggestedAction: `Contact Administrator to fix duplicate code in template definition`,
          ruleSource: 'Configuration Governance Policy',
          autoFixable: false,
        });
      }
      seenCodes.add(item.Code);
    }
  }

  /**
   * Applies a safe, deterministic Auto-Fix to the report values or dynamic rows.
   * Requirement 6: Deterministic corrections only.
   * Requirement 9: Save and rerun authoritative validation.
   * Requirement 13: Audit meaningful remediation actions without logging sensitive report values unnecessarily.
   */
  public static applyAutoFix(
    metadata: ReportMetadata,
    currentValues: Record<string, string | number>,
    currentDynamicRows: Record<number, DynamicRowRecord[]>,
    proposedFix: ProposedFix,
    actor: UserSession,
    submissionId: string
  ): {
    updatedValues: Record<string, string | number>;
    updatedDynamicRows: Record<number, DynamicRowRecord[]>;
    revalidationSummary: NormalizedValidationSummary;
    auditEntry: RemediationAuditEvent;
  } {
    if (!proposedFix.isDeterministic) {
      throw new Error(`AMBIGUOUS_FIX_PROHIBITED: Cannot automatically apply non-deterministic fix on '${proposedFix.targetField}'.`);
    }

    const newValues = { ...currentValues };
    const newDynamicRows: Record<number, DynamicRowRecord[]> = {};

    // Deep clone dynamic rows
    for (const [aId, rList] of Object.entries(currentDynamicRows)) {
      newDynamicRows[Number(aId)] = rList.map((r) => ({
        ...r,
        values: { ...r.values },
      }));
    }

    // Apply the fix
    if (proposedFix.areaId !== undefined && proposedFix.rowId !== undefined) {
      // Dynamic row fix
      const areaList = newDynamicRows[proposedFix.areaId];
      if (areaList) {
        const row = areaList.find((r) => r.id === proposedFix.rowId);
        if (row) {
          row.values[proposedFix.targetField] = proposedFix.proposedValue;
        }
      }
    } else {
      // Fixed item fix
      newValues[proposedFix.targetField] = proposedFix.proposedValue;
    }

    // Authoritative Recalculation
    const calculatedValues = FormulaEngine.calculateReport(metadata, newValues, newDynamicRows);

    // Authoritative Rerun of Validation (Requirement 9)
    const revalidationSummary = this.normalizeReportValidation(metadata, calculatedValues, newDynamicRows);

    // Requirement 13: Safe audit record without leaking sensitive financial figures
    const auditRecord: RemediationAuditEvent = {
      action: 'VALIDATION_REMEDIATION_APPLIED',
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      submissionId,
      reportKey: metadata.ReturnKey,
      fieldCode: proposedFix.targetField,
      path: proposedFix.targetPath || proposedFix.targetField,
      remediationType: proposedFix.description,
      ruleSource: proposedFix.ruleSource,
      wasDeterministic: true,
      appliedAt: new Date().toISOString(),
      safeMetadata: {
        fieldCode: proposedFix.targetField,
        ruleSource: proposedFix.ruleSource,
        remediationType: proposedFix.description,
        valueType: typeof proposedFix.proposedValue,
        redactedValueNotice: '[REDACTED_FINANCIAL_VALUE_PROTECTED_UNDER_NBE_POLICY]',
      },
    };

    // Log to auditService
    auditService.log({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'VALIDATION_REMEDIATION_APPLIED',
      entityType: 'REPORT_SUBMISSION',
      entityId: submissionId,
      correlationId: `remed_${submissionId}_${Date.now()}`,
      details: `Remediation applied to '${proposedFix.targetField}': ${proposedFix.description} (${proposedFix.ruleSource}). Sensitive figures redacted.`,
    });

    return {
      updatedValues: calculatedValues,
      updatedDynamicRows: newDynamicRows,
      revalidationSummary,
      auditEntry: auditRecord,
    };
  }
}
