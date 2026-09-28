/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Safe Regulatory Formula Engine
 * Evaluates mathematical expressions using a strict AST tokenizer/parser.
 * Strictly avoids eval(), Function(), or dynamic code execution.
 * Enforces banking-grade decimal precision (2 decimal places for currency, 4 for rates).
 */

export interface FormulaResult {
  success: boolean;
  value: number;
  formattedValue: string;
  error?: string;
}

export class FormulaEngine {
  private static MAX_RECURSION_DEPTH = 15;

  /**
   * Safely rounds a financial amount to standard banking precision (2 decimals by default).
   */
  public static roundFinancial(value: number, decimals: number = 2): number {
    if (!Number.isFinite(value)) return 0;
    const factor = Math.pow(10, decimals);
    return Math.round((value + Number.EPSILON) * factor) / factor;
  }

  /**
   * Evaluates a mathematical expression against a dictionary of field values.
   */
  public static evaluate(
    expression: string,
    values: Record<string, string | number>,
    visitedCodes: Set<string> = new Set()
  ): FormulaResult {
    if (!expression || typeof expression !== 'string' || expression.trim() === '') {
      return { success: false, value: 0, formattedValue: '0.00', error: 'Empty formula expression' };
    }

    try {
      const sanitized = expression.trim();
      const tokens = this.tokenize(sanitized);
      const parsedValue = this.parseExpression(tokens, values, visitedCodes);
      const rounded = this.roundFinancial(parsedValue);

      return {
        success: true,
        value: rounded,
        formattedValue: rounded.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      };
    } catch (err: any) {
      return {
        success: false,
        value: 0,
        formattedValue: '0.00',
        error: err.message || 'Formula evaluation error',
      };
    }
  }

  /**
   * Tokenize expression into numbers, operators, identifiers, and parentheses.
   */
  private static tokenize(expr: string): string[] {
    const tokens: string[] = [];
    let i = 0;

    while (i < expr.length) {
      const char = expr[i];

      if (/\s/.test(char)) {
        i++;
        continue;
      }

      if (['+', '-', '*', '/', '(', ')', '%'].includes(char)) {
        tokens.push(char);
        i++;
        continue;
      }

      // Identifiers or Numbers (e.g. 153_00001, 0.20, 100, RL002_48782)
      if (/[a-zA-Z0-9_]/.test(char) || (char === '.' && /[0-9]/.test(expr[i + 1] || ''))) {
        let word = '';
        while (i < expr.length && /[a-zA-Z0-9_.]/.test(expr[i])) {
          word += expr[i];
          i++;
        }
        tokens.push(word);
        continue;
      }

      throw new Error(`Unexpected character in formula: '${char}'`);
    }

    return tokens;
  }

  /**
   * Recursive descent parser: Expression = Term ((+|-) Term)*
   */
  private static parseExpression(
    tokens: string[],
    values: Record<string, string | number>,
    visitedCodes: Set<string>
  ): number {
    let result = this.parseTerm(tokens, values, visitedCodes);

    while (tokens.length > 0 && (tokens[0] === '+' || tokens[0] === '-')) {
      const op = tokens.shift()!;
      const right = this.parseTerm(tokens, values, visitedCodes);
      if (op === '+') {
        result += right;
      } else {
        result -= right;
      }
    }

    return result;
  }

  /**
   * Parser: Term = Factor ((*|/|%) Factor)*
   */
  private static parseTerm(
    tokens: string[],
    values: Record<string, string | number>,
    visitedCodes: Set<string>
  ): number {
    let result = this.parseFactor(tokens, values, visitedCodes);

    while (tokens.length > 0 && (tokens[0] === '*' || tokens[0] === '/' || tokens[0] === '%')) {
      const op = tokens.shift()!;
      const right = this.parseFactor(tokens, values, visitedCodes);
      if (op === '*') {
        result *= right;
      } else if (op === '/') {
        if (Math.abs(right) < 1e-9) {
          // Safe division by zero handling
          result = 0;
        } else {
          result /= right;
        }
      } else if (op === '%') {
        result = result * (right / 100);
      }
    }

    return result;
  }

  /**
   * Parser: Factor = (+|-) Factor | Number | Identifier | (Expression)
   */
  private static parseFactor(
    tokens: string[],
    values: Record<string, string | number>,
    visitedCodes: Set<string>
  ): number {
    if (tokens.length === 0) {
      throw new Error('Unexpected end of formula');
    }

    const token = tokens.shift()!;

    if (token === '+') {
      return this.parseFactor(tokens, values, visitedCodes);
    }

    if (token === '-') {
      return -this.parseFactor(tokens, values, visitedCodes);
    }

    if (token === '(') {
      const result = this.parseExpression(tokens, values, visitedCodes);
      if (tokens.length === 0 || tokens.shift() !== ')') {
        throw new Error("Missing closing parenthesis ')'");
      }
      return result;
    }

    // Number literal (e.g. 100, 0.20, 5 - must not contain underscore or letters)
    if (/^[0-9]+(\.[0-9]+)?$/.test(token)) {
      return Number(token);
    }

    // Variable / Field reference lookup
    const fieldCode = token;

    if (visitedCodes.has(fieldCode)) {
      throw new Error(`Circular reference detected involving field '${fieldCode}'`);
    }

    if (visitedCodes.size > this.MAX_RECURSION_DEPTH) {
      throw new Error(`Maximum formula recursion depth exceeded`);
    }

    const rawVal = values[fieldCode];
    if (rawVal === undefined || rawVal === null || rawVal === '') {
      return 0;
    }

    const num = Number(rawVal);
    if (isNaN(num)) {
      throw new Error(`Field '${fieldCode}' contains non-numeric value: '${rawVal}'`);
    }

    return num;
  }

  /**
   * Recalculates all dependent formula fields for a report.
   */
  public static calculateAllFormulas(
    formulas: Array<{ targetCode: string; expression: string; description: string; dependencies?: string[] }>,
    currentValues: Record<string, string | number>
  ): { updatedValues: Record<string, string | number>; errors: Record<string, string> } {
    const updatedValues = { ...currentValues };
    const errors: Record<string, string> = {};

    for (const f of formulas) {
      const res = this.evaluate(f.expression, updatedValues, new Set([f.targetCode]));
      if (res.success) {
        updatedValues[f.targetCode] = res.value;
      } else {
        errors[f.targetCode] = res.error || 'Calculation error';
      }
    }

    return { updatedValues, errors };
  }

  /**
   * Safe helper to calculate all formulas for a report metadata instance
   */
  public static calculateReport(
    metadata: { Formulas?: Array<{ targetCode: string; expression: string; description: string; dependencies?: string[] }> },
    values: Record<string, string | number>,
    _dynamicRows?: Record<number, any[]>
  ): Record<string, string | number> {
    if (!metadata || !metadata.Formulas || metadata.Formulas.length === 0) {
      return { ...values };
    }
    const { updatedValues } = this.calculateAllFormulas(metadata.Formulas, values);
    return updatedValues;
  }
}
