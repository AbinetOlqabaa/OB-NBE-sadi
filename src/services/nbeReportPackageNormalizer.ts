/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  configService,
  type ActorInfo,
  type ReportDefinitionSSOT,
  type ReportVersionSSOT,
  type ReportFieldSSOT,
  type ReportSectionSSOT,
  type ReportColumnSSOT,
  type FieldDataType,
  type ReportFrequency,
  type VersionStatus,
} from './configService.ts';
import { auditService } from './auditService.ts';
import { nbeEndpointRegistry, type ReportIntegrationConfigSSOT } from './nbeEndpointRegistry.ts';

// ============================================================================
// 1. DATA CONTRACTS & INTERFACES (Phase 31 Specification)
// ============================================================================

export type ImportValidationErrorCode =
  | 'INVALID_JSON'
  | 'UNSUPPORTED_SCHEMA_VERSION'
  | 'MISSING_REQUIRED_METADATA'
  | 'DUPLICATE_REPORT_KEY'
  | 'DUPLICATE_FIELD_CODE'
  | 'DUPLICATE_COLUMN_CODE'
  | 'INVALID_FORMULA_DEPENDENCY'
  | 'CIRCULAR_DEPENDENCY'
  | 'INVALID_DATA_TYPE'
  | 'INVALID_ENDPOINT_DECLARATION'
  | 'UNSUPPORTED_PROPERTY'
  | 'PROTOTYPE_POLLUTION_DETECTED'
  | 'PAYLOAD_TOO_LARGE'
  | 'NESTING_TOO_DEEP'
  | 'UNAUTHORIZED_ACCESS';

export interface ImportValidationIssue {
  code: ImportValidationErrorCode;
  message: string;
  field?: string;
  path?: string;
  severity: 'ERROR' | 'WARNING';
}

export interface NbeFieldDefinitionInput {
  id?: string;
  itemId?: string;
  itemCode: string;
  Code?: string; // legacy or alias
  itemDescription?: string;
  _description?: string; // legacy
  sectionCode?: string;
  sectionId?: string;
  dataType?: string;
  _dataType?: string; // legacy
  isRequired?: boolean;
  _required?: boolean; // legacy
  isCalculated?: boolean;
  formulaExpression?: string;
  validationRules?: any[];
  order?: number;
  defaultValue?: string | number | boolean;
  isStructuralDefault?: boolean;
  sampleValue?: any;
  Value?: any; // legacy value
}

export interface NbeColumnDefinitionInput {
  id?: string;
  columnKey: string;
  ItemCode?: string; // legacy
  headerLabel: string;
  ItemDescription?: string; // legacy
  dataType?: string;
  isRequired?: boolean;
  order?: number;
  width?: string;
  defaultValue?: string | number;
  isStructuralDefault?: boolean;
  sampleValue?: any;
}

export interface NbeSectionDefinitionInput {
  id?: string;
  code: string;
  title: string;
  order?: number;
  description?: string;
  isRepeating?: boolean;
}

export interface NbeFormulaDefinitionInput {
  targetCode: string;
  expression: string;
  description?: string;
  dependencies: string[];
}

export interface NbeIntegrationConfigInput {
  apiEndpoint?: string;
  httpMethod?: 'GET' | 'POST' | 'PUT';
  contentType?: string;
  authenticationProfile?: string;
  timeoutMs?: number;
  idempotencyStrategy?: string;
  [key: string]: any;
}

export interface NbeReportPackageReportSection {
  returnKey: string;
  shortCode?: string;
  mainTitle: string;
  subTitles?: string[];
  description?: string;
  frequency: string;
  regulatoryCategory: string;
  sections?: NbeSectionDefinitionInput[];
  fields?: NbeFieldDefinitionInput[];
  columns?: NbeColumnDefinitionInput[];
  formulas?: NbeFormulaDefinitionInput[];
  validationRules?: any[];
  nbeMapping?: Record<string, any>;
  instCode?: string;
  finYear?: number;
}

export interface NbeReportPackageEnvelope {
  packageVersion: string;
  report: NbeReportPackageReportSection;
  integration?: NbeIntegrationConfigInput;
  [key: string]: any;
}

export interface NbeImportedArtifact {
  sourceHash: string;
  normalizedHash: string;
  packageVersion: string;
  returnKey: string;
  reportName: string;
  format: 'MODERN_ENVELOPE' | 'LEGACY_NBE_24';
  rawPackageText: string;
  importedAt: string;
  importedBy: ActorInfo;
  sampleValuesStrippedCount: number;
  structuralDefaultsPreservedCount: number;
}

export interface NbePackageValidationResult {
  valid: boolean;
  packageVersion?: string;
  format: 'MODERN_ENVELOPE' | 'LEGACY_NBE_24' | 'UNKNOWN';
  errors: ImportValidationIssue[];
  warnings: ImportValidationIssue[];
  sampleValuesStrippedCount: number;
  structuralDefaultsPreservedCount: number;
  reportSummary?: {
    returnKey: string;
    code: string;
    name: string;
    description: string;
    frequency: string;
    category: string;
    sectionCount: number;
    fieldCount: number;
    columnCount: number;
    formulaCount: number;
    ruleCount: number;
  };
  sourceHash?: string;
  normalizedHash?: string;
  normalizedPackage?: {
    report: ReportDefinitionSSOT;
    version: ReportVersionSSOT;
  };
}

// ============================================================================
// 2. CRYPTOGRAPHIC & HASH UTILITIES (SHA-256)
// ============================================================================

/**
 * Standard deterministic SHA-256 implementation that executes uniformly
 * across both Node.js server runtimes and browser environments.
 */
export function computeSha256Hex(data: string): string {
  // Use Node.js crypto if present
  try {
    if (typeof process !== 'undefined' && process.versions?.node) {
      // Dynamic require or import of crypto
      const nodeCrypto = (globalThis as any).require
        ? (globalThis as any).require('crypto')
        : null;
      if (nodeCrypto && typeof nodeCrypto.createHash === 'function') {
        return nodeCrypto.createHash('sha256').update(data, 'utf8').digest('hex');
      }
    }
  } catch {}

  // Pure JavaScript deterministic SHA-256 algorithm (FIPS 180-4 standard)
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let i: number, j: number;
  let result = '';

  const words: number[] = [];
  const asciiBitLength = data.length * 8;

  const hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;

  const isComposite: Record<number, boolean> = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) {
        isComposite[i] = true;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  data += '\x80';
  while ((data.length % 64) - 56) data += '\x00';
  for (i = 0; i < data.length; i++) {
    j = data.charCodeAt(i);
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;

  for (j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);

    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];

      const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
      w[i] =
        i < 16
          ? w[i]
          : (((w[i - 16] + s0) | 0) + ((w[i - 7] + s1) | 0)) | 0;

      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const temp1 =
        (((hash[7] + (rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25))) | 0) +
          ((ch + k[i]) | 0) +
          w[i]) |
        0;
      const temp2 =
        ((rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22)) + maj) | 0;

      hash[7] = hash[6];
      hash[6] = hash[5];
      hash[5] = hash[4];
      hash[4] = (hash[3] + temp1) | 0;
      hash[3] = hash[2];
      hash[2] = hash[1];
      hash[1] = hash[0];
      hash[0] = (temp1 + temp2) | 0;
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (let b = 3; b >= 0; b--) {
      const byte = (hash[i] >> (b * 8)) & 255;
      result += (byte < 16 ? '0' : '') + byte.toString(16);
    }
  }

  return result;
}

// Allowed field data types
export const ALLOWED_FIELD_DATA_TYPES = new Set<string>([
  'NUMERIC',
  'PERCENTAGE',
  'CURRENCY',
  'INTEGER',
  'STRING',
  'DATE',
  'BOOLEAN',
  'SELECT',
  'TEXT',
]);

// Allowed regulatory reporting frequencies
export const ALLOWED_FREQUENCIES = new Set<string>([
  'MONTHLY',
  'QUARTERLY',
  'ANNUAL',
  'SEMI_ANNUAL',
  'ON_DEMAND',
]);

// Allowed package versions
export const SUPPORTED_PACKAGE_VERSIONS = new Set<string>([
  '1.0',
  '1.1',
  '2.0',
  'legacy-nbe-v1',
]);

// ============================================================================
// 3. NBE REPORT PACKAGE SERVICE & NORMALIZER CLASS
// ============================================================================

export class NbeReportPackageServiceClass {
  private artifacts: Map<string, NbeImportedArtifact> = new Map();

  /**
   * Resets internal artifact storage (primarily for test idempotency).
   */
  public resetArtifacts(): void {
    this.artifacts.clear();
  }

  /**
   * Retrieves all auditable imported source artifacts.
   */
  public getAllArtifacts(): NbeImportedArtifact[] {
    return Array.from(this.artifacts.values());
  }

  /**
   * Retrieves an auditable imported source artifact by its SHA-256 hash.
   */
  public getArtifactByHash(hash: string): NbeImportedArtifact | undefined {
    return this.artifacts.get(hash);
  }

  /**
   * Parses, inspects security constraints, validates, and normalizes an NBE JSON package.
   * Safe to call without mutating system state.
   */
  public validatePackage(rawJson: string | object): NbePackageValidationResult {
    const errors: ImportValidationIssue[] = [];
    const warnings: ImportValidationIssue[] = [];
    let sampleValuesStrippedCount = 0;
    let structuralDefaultsPreservedCount = 0;

    let rawString = '';
    let parsed: any = null;

    // 1. Raw Payload Size Enforcement (10MB limit)
    if (typeof rawJson === 'string') {
      rawString = rawJson;
      const sizeBytes = new TextEncoder().encode(rawString).length;
      if (sizeBytes > 10 * 1024 * 1024) {
        errors.push({
          code: 'PAYLOAD_TOO_LARGE',
          message: `Package payload size (${(sizeBytes / (1024 * 1024)).toFixed(2)} MB) exceeds statutory maximum limit of 10 MB.`,
          severity: 'ERROR',
        });
        return {
          valid: false,
          format: 'UNKNOWN',
          errors,
          warnings,
          sampleValuesStrippedCount: 0,
          structuralDefaultsPreservedCount: 0,
        };
      }

      // Safe JSON Parse
      try {
        parsed = JSON.parse(rawString);
      } catch (err: any) {
        errors.push({
          code: 'INVALID_JSON',
          message: `JSON syntax error: ${err.message}`,
          severity: 'ERROR',
        });
        return {
          valid: false,
          format: 'UNKNOWN',
          errors,
          warnings,
          sampleValuesStrippedCount: 0,
          structuralDefaultsPreservedCount: 0,
        };
      }
    } else if (typeof rawJson === 'object' && rawJson !== null) {
      parsed = rawJson;
      try {
        rawString = JSON.stringify(rawJson, null, 2);
      } catch (e: any) {
        errors.push({
          code: 'INVALID_JSON',
          message: `Failed to serialize object: ${e.message}`,
          severity: 'ERROR',
        });
        return {
          valid: false,
          format: 'UNKNOWN',
          errors,
          warnings,
          sampleValuesStrippedCount: 0,
          structuralDefaultsPreservedCount: 0,
        };
      }
    } else {
      errors.push({
        code: 'INVALID_JSON',
        message: 'Invalid payload: expected JSON string or parsed object.',
        severity: 'ERROR',
      });
      return {
        valid: false,
        format: 'UNKNOWN',
        errors,
        warnings,
        sampleValuesStrippedCount: 0,
        structuralDefaultsPreservedCount: 0,
      };
    }

    const sourceHash = computeSha256Hex(rawString);

    // 2. Security: Prototype Pollution & Nesting Depth Inspection
    const securityCheck = this.inspectObjectSecurity(parsed);
    if (!securityCheck.safe) {
      securityCheck.violations.forEach((v) => {
        errors.push({
          code: v.code,
          message: v.message,
          path: v.path,
          severity: 'ERROR',
        });
      });
      return {
        valid: false,
        format: 'UNKNOWN',
        sourceHash,
        errors,
        warnings,
        sampleValuesStrippedCount: 0,
        structuralDefaultsPreservedCount: 0,
      };
    }

    // 3. Format Detection & Schema Version Resolution
    let format: 'MODERN_ENVELOPE' | 'LEGACY_NBE_24' | 'UNKNOWN' = 'UNKNOWN';
    let packageVersion = '1.0';
    let reportPayload: NbeReportPackageReportSection;
    let integrationPayload: NbeIntegrationConfigInput | undefined;

    if (parsed.packageVersion && parsed.report) {
      // Modern Envelope Format
      format = 'MODERN_ENVELOPE';
      packageVersion = String(parsed.packageVersion).trim();
      reportPayload = parsed.report;
      integrationPayload = parsed.integration || (parsed.report as any)?.integrationConfig || (parsed.report as any)?.integration;

      if (!SUPPORTED_PACKAGE_VERSIONS.has(packageVersion)) {
        errors.push({
          code: 'UNSUPPORTED_SCHEMA_VERSION',
          message: `Package schema version '${packageVersion}' is unsupported. Supported versions: ${Array.from(
            SUPPORTED_PACKAGE_VERSIONS
          ).join(', ')}.`,
          path: 'packageVersion',
          severity: 'ERROR',
        });
      }
    } else if (parsed.ReturnKey && (parsed.ReturnItemsList || parsed.DynamicItemsList)) {
      // Legacy NBE 24 Report Definition Format
      format = 'LEGACY_NBE_24';
      packageVersion = 'legacy-nbe-v1';
      reportPayload = this.convertLegacyToReportSection(parsed);
      warnings.push({
        code: 'UNSUPPORTED_PROPERTY',
        message: 'Detected legacy NBE 24 report format. Package was automatically adapted into canonical envelope.',
        path: 'root',
        severity: 'WARNING',
      });
    } else {
      errors.push({
        code: 'UNSUPPORTED_SCHEMA_VERSION',
        message:
          'Unrecognized NBE package format. Package must conform to versioned envelope ({ packageVersion, report }) or legacy statutory return ({ ReturnKey, ReturnItemsList }).',
        path: 'root',
        severity: 'ERROR',
      });
      return {
        valid: false,
        format: 'UNKNOWN',
        sourceHash,
        errors,
        warnings,
        sampleValuesStrippedCount: 0,
        structuralDefaultsPreservedCount: 0,
      };
    }

    // 4. Required Report Metadata Validation
    const returnKey = (reportPayload.returnKey || (reportPayload as any).ReturnKey || '').trim().toUpperCase();
    if (!returnKey) {
      errors.push({
        code: 'MISSING_REQUIRED_METADATA',
        message: 'Report definition returnKey is mandatory and cannot be empty.',
        path: 'report.returnKey',
        severity: 'ERROR',
      });
    }

    const mainTitle = (
      reportPayload.mainTitle ||
      (reportPayload as any).name ||
      (reportPayload as any).Title ||
      ''
    ).trim();
    if (!mainTitle) {
      errors.push({
        code: 'MISSING_REQUIRED_METADATA',
        message: 'Report definition mainTitle / name is mandatory and cannot be empty.',
        path: 'report.mainTitle',
        severity: 'ERROR',
      });
    }

    const frequencyRaw = (reportPayload.frequency || 'MONTHLY').trim().toUpperCase();
    if (!ALLOWED_FREQUENCIES.has(frequencyRaw)) {
      errors.push({
        code: 'MISSING_REQUIRED_METADATA',
        message: `Reporting frequency '${frequencyRaw}' is invalid. Allowed: ${Array.from(ALLOWED_FREQUENCIES).join(', ')}.`,
        path: 'report.frequency',
        severity: 'ERROR',
      });
    }

    const category = (reportPayload.regulatoryCategory || (reportPayload as any).category || 'Statutory Prudential Reporting').trim();
    if (!category) {
      errors.push({
        code: 'MISSING_REQUIRED_METADATA',
        message: 'Regulatory category is mandatory and cannot be empty.',
        path: 'report.regulatoryCategory',
        severity: 'ERROR',
      });
    }

    // 5. Duplicate Report Key Check (against active reports)
    if (returnKey) {
      const existing = configService.getReportDefinition(returnKey);
      if (existing) {
        if (existing.status === 'ACTIVE') {
          warnings.push({
            code: 'DUPLICATE_REPORT_KEY',
            message: `Report key '${returnKey}' already exists as an ACTIVE return (${existing.name}). Importing will create a new governed DRAFT version without overwriting active returns.`,
            field: returnKey,
            severity: 'WARNING',
          });
        } else {
          warnings.push({
            code: 'DUPLICATE_REPORT_KEY',
            message: `Report key '${returnKey}' currently exists in '${existing.status}' state. Re-importing will update the draft configuration idempotently.`,
            field: returnKey,
            severity: 'WARNING',
          });
        }
      }
    }

    // 6. Return Fields Validation, Uniqueness & Sample Value Stripping
    const fields = reportPayload.fields || [];
    const fieldCodes = new Set<string>();
    const normalizedFields: ReportFieldSSOT[] = [];

    fields.forEach((f, idx) => {
      const rawCode = (f.itemCode || f.Code || '').trim().toUpperCase();
      const path = `report.fields[${idx}]`;

      if (!rawCode) {
        errors.push({
          code: 'MISSING_REQUIRED_METADATA',
          message: `Field at position ${idx + 1} is missing an itemCode.`,
          path,
          severity: 'ERROR',
        });
        return;
      }

      if (fieldCodes.has(rawCode)) {
        errors.push({
          code: 'DUPLICATE_FIELD_CODE',
          message: `Duplicate field itemCode '${rawCode}' detected at position ${idx + 1}.`,
          path,
          field: rawCode,
          severity: 'ERROR',
        });
      } else {
        fieldCodes.add(rawCode);
      }

      // Data Type Validation
      let rawType = (f.dataType || f._dataType || 'NUMERIC').trim().toUpperCase();
      if (rawType === 'TEXT') rawType = 'STRING';
      if (!ALLOWED_FIELD_DATA_TYPES.has(rawType)) {
        errors.push({
          code: 'INVALID_DATA_TYPE',
          message: `Field '${rawCode}' has unsupported dataType '${rawType}'. Allowed types: ${Array.from(
            ALLOWED_FIELD_DATA_TYPES
          ).join(', ')}.`,
          path: `${path}.dataType`,
          field: rawCode,
          severity: 'ERROR',
        });
      }

      // Sample / Business Value Stripping vs Structural Default Preservation (Req 6)
      let resolvedDefault: string | number | undefined = undefined;
      const isStructural = f.isStructuralDefault === true;

      if (isStructural) {
        // Explicitly declared structural default -> preserve it
        if (f.defaultValue !== undefined && f.defaultValue !== null && f.defaultValue !== '') {
          resolvedDefault = f.defaultValue as any;
          structuralDefaultsPreservedCount++;
        }
      } else {
        // If sampleValue or Value or defaultValue is supplied without structural flag -> STRIP IT
        if (
          (f.sampleValue !== undefined && f.sampleValue !== null && f.sampleValue !== '') ||
          (f.Value !== undefined && f.Value !== null && f.Value !== '') ||
          (f.defaultValue !== undefined && f.defaultValue !== null && f.defaultValue !== '')
        ) {
          sampleValuesStrippedCount++;
        }
      }

      normalizedFields.push({
        id: f.id || `fld_${returnKey}_${rawCode}`,
        itemId: f.itemId || String(idx + 1).padStart(5, '0'),
        itemCode: rawCode,
        itemDescription: (f.itemDescription || f._description || rawCode).trim(),
        sectionId: f.sectionId || f.sectionCode,
        dataType: (ALLOWED_FIELD_DATA_TYPES.has(rawType) ? rawType : 'NUMERIC') as FieldDataType,
        isRequired: f.isRequired === true || f._required === true,
        isCalculated: f.isCalculated === true || Boolean(f.formulaExpression),
        formulaExpression: f.formulaExpression,
        validationRules: Array.isArray(f.validationRules) ? f.validationRules : [],
        order: f.order !== undefined ? f.order : idx + 1,
        defaultValue: resolvedDefault,
      });
    });

    // 7. Dynamic Columns Validation & Uniqueness
    const columns = reportPayload.columns || [];
    const columnKeys = new Set<string>();
    const normalizedColumns: ReportColumnSSOT[] = [];

    columns.forEach((c, idx) => {
      const rawCol = (c.columnKey || c.ItemCode || '').trim().toUpperCase();
      const path = `report.columns[${idx}]`;

      if (!rawCol) {
        errors.push({
          code: 'MISSING_REQUIRED_METADATA',
          message: `Column at position ${idx + 1} is missing a columnKey.`,
          path,
          severity: 'ERROR',
        });
        return;
      }

      if (columnKeys.has(rawCol)) {
        errors.push({
          code: 'DUPLICATE_COLUMN_CODE',
          message: `Duplicate schedule columnKey '${rawCol}' detected at position ${idx + 1}.`,
          path,
          field: rawCol,
          severity: 'ERROR',
        });
      } else {
        columnKeys.add(rawCol);
      }

      let colDefault: string | number | undefined = undefined;
      if (c.isStructuralDefault === true && c.defaultValue !== undefined) {
        colDefault = c.defaultValue;
        structuralDefaultsPreservedCount++;
      } else if (c.sampleValue !== undefined || c.defaultValue !== undefined) {
        sampleValuesStrippedCount++;
      }

      normalizedColumns.push({
        id: c.id || `col_${returnKey}_${rawCol}`,
        columnKey: rawCol,
        headerLabel: (c.headerLabel || c.ItemDescription || rawCol).trim(),
        dataType: c.dataType || 'STRING',
        isRequired: c.isRequired === true,
        order: c.order !== undefined ? c.order : idx + 1,
        width: c.width || '180px',
        defaultValue: colDefault,
      });
    });

    // 8. Formulas & Circular Dependency Detection
    const formulas = reportPayload.formulas || [];
    const formulaGraph: Record<string, string[]> = {};
    const formulaTargets = new Set<string>();

    formulas.forEach((fm, idx) => {
      const target = (fm.targetCode || '').trim().toUpperCase();
      const path = `report.formulas[${idx}]`;

      if (!target) {
        errors.push({
          code: 'MISSING_REQUIRED_METADATA',
          message: `Formula at index ${idx + 1} has an empty targetCode.`,
          path,
          severity: 'ERROR',
        });
        return;
      }

      if (!fieldCodes.has(target)) {
        errors.push({
          code: 'INVALID_FORMULA_DEPENDENCY',
          message: `Formula targets field '${target}' which is not defined in report fields.`,
          path: `${path}.targetCode`,
          field: target,
          severity: 'ERROR',
        });
      }

      if (formulaTargets.has(target)) {
        errors.push({
          code: 'INVALID_FORMULA_DEPENDENCY',
          message: `Multiple formulas target the same field '${target}'.`,
          path: `${path}.targetCode`,
          field: target,
          severity: 'ERROR',
        });
      }
      formulaTargets.add(target);

      const deps = Array.isArray(fm.dependencies)
        ? fm.dependencies.map((d) => String(d).trim().toUpperCase())
        : [];

      deps.forEach((dep) => {
        if (!fieldCodes.has(dep)) {
          errors.push({
            code: 'INVALID_FORMULA_DEPENDENCY',
            message: `Formula targeting '${target}' references non-existent dependency field '${dep}'.`,
            path: `${path}.dependencies`,
            field: dep,
            severity: 'ERROR',
          });
        }
      });

      formulaGraph[target] = deps;
    });

    // Cycle detection in formula dependency graph using DFS
    const visited = new Set<string>();
    const inStack = new Set<string>();

    const checkCycle = (node: string, pathStack: string[]): boolean => {
      visited.add(node);
      inStack.add(node);
      pathStack.push(node);

      const neighbors = formulaGraph[node] || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (checkCycle(neighbor, pathStack)) return true;
        } else if (inStack.has(neighbor)) {
          pathStack.push(neighbor);
          return true;
        }
      }

      inStack.delete(node);
      pathStack.pop();
      return false;
    };

    for (const target of Object.keys(formulaGraph)) {
      if (!visited.has(target)) {
        const pathStack: string[] = [];
        if (checkCycle(target, pathStack)) {
          errors.push({
            code: 'CIRCULAR_DEPENDENCY',
            message: `Circular dependency detected in calculation formulas: ${pathStack.join(' -> ')}.`,
            path: 'report.formulas',
            field: target,
            severity: 'ERROR',
          });
          break;
        }
      }
    }

    // 9. Integration Endpoint Validation
    if (integrationPayload && integrationPayload.apiEndpoint) {
      const ep = String(integrationPayload.apiEndpoint).trim();
      const endpointIssue = this.validateEndpointUrl(ep);
      if (endpointIssue) {
        errors.push({
          code: 'INVALID_ENDPOINT_DECLARATION',
          message: endpointIssue,
          path: 'integration.apiEndpoint',
          severity: 'ERROR',
        });
      }
    }

    // Build Normalized Report Structure Preview
    const isValid = errors.length === 0;
    let normalizedResult: { report: ReportDefinitionSSOT; version: ReportVersionSSOT } | undefined;
    let normalizedHash: string | undefined;

    if (isValid) {
      normalizedResult = this.buildNormalizedDefinition(
        reportPayload,
        normalizedFields,
        normalizedColumns,
        integrationPayload,
        format
      );
      normalizedHash = computeSha256Hex(JSON.stringify(normalizedResult));
    }

    return {
      valid: isValid,
      packageVersion,
      format,
      errors,
      warnings,
      sampleValuesStrippedCount,
      structuralDefaultsPreservedCount,
      reportSummary: {
        returnKey,
        code: reportPayload.shortCode || returnKey,
        name: mainTitle,
        description: reportPayload.description || `Prudential return for ${mainTitle}`,
        frequency: frequencyRaw,
        category,
        sectionCount: (reportPayload.sections || []).length || 1,
        fieldCount: normalizedFields.length,
        columnCount: normalizedColumns.length,
        formulaCount: formulas.length,
        ruleCount: (reportPayload.validationRules || []).length,
      },
      sourceHash,
      normalizedHash,
      normalizedPackage: normalizedResult,
    };
  }

  /**
   * Imports the validated package into configService as a governed DRAFT configuration.
   * Enforces Administrator-only authorization and records auditable source artifact.
   */
  public importPackageAsDraft(
    rawJson: string | object,
    actor: ActorInfo
  ): {
    success: boolean;
    report: ReportDefinitionSSOT;
    version: ReportVersionSSOT;
    validation: NbePackageValidationResult;
    artifact: NbeImportedArtifact;
    message: string;
  } {
    // 1. Mandatory Server-Side Administrator Authorization (Req 1, 11)
    if (!actor || actor.role !== 'ADMIN') {
      const roleStr = actor?.role || 'ANONYMOUS';
      auditService.log({
        actorId: actor?.id || 'unauthorized',
        actorName: actor?.name || 'Unauthorized Actor',
        actorRole: roleStr as any,
        action: 'NBE_IMPORT_UNAUTHORIZED_ATTEMPT',
        entityType: 'REPORT_DEFINITION',
        entityId: 'UNKNOWN',
        correlationId: `imp_unauth_${Date.now()}`,
        details: `Access denied: User with role '${roleStr}' attempted to import NBE Report JSON package. Administrator role is required.`,
      });
      throw new Error(`Unauthorized: Administrator role is strictly required to import NBE Report JSON packages (Attempted by '${roleStr}').`);
    }

    // 2. Perform Complete Validation
    const validation = this.validatePackage(rawJson);
    if (!validation.valid || !validation.normalizedPackage) {
      const errorSummary = validation.errors.map((e) => `[${e.code}] ${e.message}`).join('; ');
      auditService.log({
        actorId: actor.id,
        actorName: actor.name,
        actorRole: 'ADMIN',
        action: 'NBE_PACKAGE_VALIDATION_FAILED',
        entityType: 'REPORT_DEFINITION',
        entityId: validation.reportSummary?.returnKey || 'UNKNOWN',
        correlationId: `imp_val_fail_${Date.now()}`,
        details: `Import validation failed for NBE package: ${errorSummary}`,
      });
      throw new Error(`NBE Package Import Validation Failed (${validation.errors.length} error(s)): ${errorSummary}`);
    }

    const { report: draftReport, version: draftVersion } = validation.normalizedPackage;
    const returnKey = draftReport.returnKey;
    const now = new Date().toISOString();

    // Check if report already exists
    const existingReport = configService.getReportDefinition(returnKey);
    let finalReport: ReportDefinitionSSOT;
    let finalVersion: ReportVersionSSOT;

    if (existingReport) {
      // Package Re-import & Idempotency Behavior (Req 13)
      // If report exists, check if existing draft version is present or create a new draft version
      const allVersions = configService.getReportVersions(returnKey);
      const existingDraft = allVersions.find((v) => v.status === 'DRAFT');

      if (existingDraft) {
        // Update existing draft idempotently
        existingDraft.fields = draftVersion.fields;
        existingDraft.columns = draftVersion.columns;
        existingDraft.sections = draftVersion.sections;
        existingDraft.formulas = draftVersion.formulas;
        existingDraft.validationRules = draftVersion.validationRules;
        existingDraft.changelogSummary = `Updated from NBE JSON package import (Source Hash: ${validation.sourceHash?.slice(0, 12)})`;
        existingDraft.schemaSnapshot = draftVersion.schemaSnapshot;
        finalVersion = existingDraft;
        finalReport = existingReport;
      } else {
        // Create new draft version on top of existing versions
        const newDraftVersion = configService.createDraftVersion(
          returnKey,
          {
            sections: draftVersion.sections,
            fields: draftVersion.fields,
            columns: draftVersion.columns,
            formulas: draftVersion.formulas,
            validationRules: draftVersion.validationRules,
            changelogSummary: `Draft version created from NBE JSON package import (Source Hash: ${validation.sourceHash?.slice(0, 12)})`,
          },
          actor
        );
        finalVersion = newDraftVersion;
        finalReport = configService.getReportDefinition(returnKey)!;
      }
    } else {
      // Create fresh report definition in DRAFT status (Req 8, 10)
      const created = configService.createReportDefinition(
        {
          returnKey: draftReport.returnKey,
          code: draftReport.code,
          name: draftReport.name,
          description: draftReport.description,
          category: draftReport.category,
          frequency: draftReport.frequency,
          status: 'DRAFT', // Strictly DRAFT!
          initialStatus: 'DRAFT', // Strictly DRAFT!
          instCode: draftReport.instCode,
          finYear: draftReport.finYear,
          sections: draftVersion.sections,
          fields: draftVersion.fields,
          columns: draftVersion.columns,
          formulas: draftVersion.formulas,
          validationRules: draftVersion.validationRules,
          nbeMapping: draftReport.nbeMapping,
          displayConfiguration: draftReport.displayConfiguration,
          changelogSummary: `Initial draft imported from NBE JSON package (Source: ${validation.sourceHash?.slice(0, 12)})`,
        },
        actor
      );
      finalReport = created.report;
      finalVersion = created.version;
    }

    // Register integration endpoint with NBE Endpoint Registry (Phase 32)
    const integToRegister =
      (draftVersion as any).integrationConfig ||
      (draftReport as any).integrationConfig ||
      draftReport.displayConfiguration?.integration;
    if (integToRegister) {
      try {
        nbeEndpointRegistry.updateReportEndpoint(
          returnKey,
          {
            reportKey: returnKey,
            versionNumber: finalVersion.versionNumber,
            endpointUrl: integToRegister.endpointUrl || integToRegister.apiEndpoint || '/api/v1/nbe-simulator/submit',
            httpMethod: integToRegister.httpMethod || 'POST',
            contentType: integToRegister.contentType || 'application/json',
            timeoutMs: integToRegister.timeoutMs || 30000,
            authProfileRef: integToRegister.authProfileRef || integToRegister.authenticationProfile || 'auth_local_simulator',
            environmentTarget: integToRegister.environmentTarget ||
              ((integToRegister.endpointUrl?.startsWith('https://') || integToRegister.apiEndpoint?.startsWith('https://')) ? 'PRODUCTION/NBE' : 'LOCAL/SIMULATOR'),
          },
          actor
        );
      } catch {}
    }

    // 3. Store Original Imported Package as Canonical Auditable Artifact (Req 11, 12)
    const rawText = typeof rawJson === 'string' ? rawJson : JSON.stringify(rawJson, null, 2);
    const artifact: NbeImportedArtifact = {
      sourceHash: validation.sourceHash || computeSha256Hex(rawText),
      normalizedHash: validation.normalizedHash || computeSha256Hex(JSON.stringify({ finalReport, finalVersion })),
      packageVersion: validation.packageVersion || '1.0',
      returnKey,
      reportName: finalReport.name,
      format: validation.format === 'LEGACY_NBE_24' ? 'LEGACY_NBE_24' : 'MODERN_ENVELOPE',
      rawPackageText: rawText,
      importedAt: now,
      importedBy: actor,
      sampleValuesStrippedCount: validation.sampleValuesStrippedCount,
      structuralDefaultsPreservedCount: validation.structuralDefaultsPreservedCount,
    };

    this.artifacts.set(artifact.sourceHash, artifact);

    // 4. Record Governance Audit Trail (Req 11, 14)
    auditService.log({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: 'ADMIN',
      action: 'NBE_PACKAGE_IMPORTED',
      entityType: 'REPORT_DEFINITION',
      entityId: returnKey,
      correlationId: `imp_${artifact.sourceHash.slice(0, 12)}`,
      details: `Administrator ${actor.name} imported NBE Report JSON package for '${returnKey}' (${finalReport.name}). Version: ${validation.packageVersion}. Created as DRAFT (Status: DRAFT). Stripped ${validation.sampleValuesStrippedCount} sample value(s), preserved ${validation.structuralDefaultsPreservedCount} structural default(s). Source SHA-256: ${artifact.sourceHash}`,
    });

    return {
      success: true,
      report: finalReport,
      version: finalVersion,
      validation,
      artifact,
      message: `Successfully imported NBE Report package for '${returnKey}'. Report created as DRAFT. In accordance with Oromia Bank 4-Eyes Governance Policy, this report requires Checker review and approval before publication.`,
    };
  }

  // ============================================================================
  // 4. PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Recursively inspects object keys and depth to prevent prototype pollution and denial-of-service.
   */
  private inspectObjectSecurity(
    obj: any,
    currentDepth = 0,
    currentPath = 'root'
  ): { safe: boolean; violations: { code: ImportValidationErrorCode; message: string; path: string }[] } {
    const violations: { code: ImportValidationErrorCode; message: string; path: string }[] = [];

    if (currentDepth > 20) {
      violations.push({
        code: 'NESTING_TOO_DEEP',
        message: `Object nesting depth exceeds maximum statutory limit of 20 at '${currentPath}'.`,
        path: currentPath,
      });
      return { safe: false, violations };
    }

    if (obj === null || typeof obj !== 'object') {
      return { safe: true, violations };
    }

    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        const sub = this.inspectObjectSecurity(obj[i], currentDepth + 1, `${currentPath}[${i}]`);
        if (!sub.safe) {
          violations.push(...sub.violations);
        }
      }
      return { safe: violations.length === 0, violations };
    }

    const keys = Object.keys(obj);
    for (const key of keys) {
      const lower = key.toLowerCase();
      // Prototype Pollution Keys Check
      if (lower === '__proto__' || lower === 'constructor' || lower === 'prototype') {
        violations.push({
          code: 'PROTOTYPE_POLLUTION_DETECTED',
          message: `Forbidden prototype pollution key '${key}' detected in imported JSON payload.`,
          path: `${currentPath}.${key}`,
        });
      }

      const sub = this.inspectObjectSecurity(obj[key], currentDepth + 1, `${currentPath}.${key}`);
      if (!sub.safe) {
        violations.push(...sub.violations);
      }
    }

    return { safe: violations.length === 0, violations };
  }

  /**
   * Validates integration endpoint URLs to prevent SSRF and dangerous protocols.
   */
  private validateEndpointUrl(url: string): string | null {
    if (!url) return null;
    const trimmed = url.trim();

    // Allow safe relative API endpoints
    if (trimmed.startsWith('/') || trimmed.startsWith('./')) {
      if (trimmed.includes('..')) {
        return 'Relative endpoint cannot contain directory traversal (..) sequences.';
      }
      return null;
    }

    try {
      const parsed = new URL(trimmed);
      const protocol = parsed.protocol.toLowerCase();

      // Only https: and http: permitted
      if (protocol !== 'https:' && protocol !== 'http:') {
        return `Unsupported endpoint protocol '${protocol}'. Only HTTPS or HTTP URLs are permitted.`;
      }

      // Check credentials in URL
      if (parsed.username || parsed.password) {
        return 'Endpoint URL must not contain embedded user credentials.';
      }

      // Reject AWS/GCP cloud metadata IP
      const hostname = parsed.hostname.toLowerCase();
      if (
        hostname === '169.254.169.254' ||
        hostname === 'metadata.google.internal' ||
        hostname === '0.0.0.0'
      ) {
        return `Endpoint URL target '${hostname}' is a restricted infrastructure or cloud metadata address.`;
      }

      return null;
    } catch {
      return `Malformed endpoint URL: '${url}'. Must be a valid URL or relative API path.`;
    }
  }

  /**
   * Converts legacy NBE 24 report format into canonical envelope report section.
   */
  private convertLegacyToReportSection(legacy: any): NbeReportPackageReportSection {
    const returnKey = (legacy.ReturnKey || '').trim().toUpperCase();
    const returnItems: any[] = legacy.ReturnItemsList || [];
    const dynamicItems: any[] = legacy.DynamicItemsList || [];

    const seenLegacyCodes = new Set<string>();
    const fields: NbeFieldDefinitionInput[] = returnItems.map((item, idx) => {
      let code = (item.Code || `ITEM_${idx + 1}`).trim().toUpperCase();
      if (seenLegacyCodes.has(code)) {
        code = `${code}_ROW_${idx + 1}`;
      }
      seenLegacyCodes.add(code);

      return {
        itemId: String(idx + 1).padStart(5, '0'),
        itemCode: code,
        itemDescription: item._description || item.Code || code,
        dataType: item._dataType === 'TEXT' ? 'STRING' : item._dataType || 'NUMERIC',
        isRequired: item._required === true,
        sampleValue: item.Value, // Marked as sample -> stripped during validation!
        order: idx + 1,
      };
    });

    const rawDynamicItems: any[] = [];
    (legacy.DynamicItemsList || []).forEach((entry: any) => {
      if (entry && Array.isArray(entry.DynamicItems)) {
        entry.DynamicItems.forEach((sub: any) => rawDynamicItems.push(sub));
      } else if (entry) {
        rawDynamicItems.push(entry);
      }
    });

    const seenColKeys = new Set<string>();
    const columns: NbeColumnDefinitionInput[] = rawDynamicItems.map((col, idx) => {
      let colKey = (col.ItemCode || col.columnKey || col.Code || `COL_${idx + 1}`).trim().toUpperCase();
      if (seenColKeys.has(colKey)) {
        colKey = `${colKey}_${idx + 1}`;
      }
      seenColKeys.add(colKey);

      return {
        columnKey: colKey,
        headerLabel: (col.ItemDescription || col.headerLabel || col._description || col.ItemCode || col.Code || `Column ${idx + 1}`).trim(),
        dataType: col.dataType || (col._dataType === 'TEXT' ? 'STRING' : col._dataType) || 'STRING',
        isRequired: col.isRequired === true || col._required === true,
        order: idx + 1,
      };
    });

    // Generate readable title from ReturnKey
    const readableTitle = returnKey
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return {
      returnKey,
      shortCode: returnKey,
      mainTitle: legacy.Title || `National Bank of Ethiopia Return: ${readableTitle}`,
      description: `Authoritative statutory prudential return ${returnKey} imported from NBE legacy package.`,
      frequency: legacy.Frequency || 'MONTHLY',
      regulatoryCategory: legacy.Category || 'Credit & Risk Regulatory Reporting',
      sections: [
        {
          id: `sec_${returnKey}_main`,
          code: 'MAIN',
          title: `Statutory Schedule: ${returnKey}`,
          order: 1,
          isRepeating: false,
        },
      ],
      fields,
      columns,
      formulas: [],
      validationRules: [],
      instCode: legacy.InstCode || '0000013',
      finYear: legacy.FinYear || 2026,
    };
  }

  /**
   * Constructs the full normalized ReportDefinitionSSOT and ReportVersionSSOT in DRAFT state.
   */
  private buildNormalizedDefinition(
    reportPayload: NbeReportPackageReportSection,
    fields: ReportFieldSSOT[],
    columns: ReportColumnSSOT[],
    integration: NbeIntegrationConfigInput | undefined,
    format: 'MODERN_ENVELOPE' | 'LEGACY_NBE_24'
  ): { report: ReportDefinitionSSOT; version: ReportVersionSSOT } {
    const returnKey = (reportPayload.returnKey || '').trim().toUpperCase();
    const now = new Date().toISOString();
    const frequency = (reportPayload.frequency || 'MONTHLY') as ReportFrequency;

    const sections: ReportSectionSSOT[] =
      reportPayload.sections && reportPayload.sections.length > 0
        ? reportPayload.sections.map((s, idx) => ({
            id: s.id || `sec_${returnKey}_${s.code.toLowerCase()}`,
            code: s.code.toUpperCase(),
            title: s.title,
            order: s.order !== undefined ? s.order : idx + 1,
            description: s.description || '',
            isRepeating: s.isRepeating === true,
          }))
        : [
            {
              id: `sec_${returnKey}_main`,
              code: 'MAIN',
              title: reportPayload.mainTitle,
              order: 1,
              description: reportPayload.description || '',
              isRepeating: false,
            },
          ];

    const formulas = (reportPayload.formulas || []).map((fm) => ({
      targetCode: fm.targetCode.trim().toUpperCase(),
      expression: fm.expression,
      description: fm.description || `Calculated value for ${fm.targetCode}`,
      dependencies: (fm.dependencies || []).map((d) => d.trim().toUpperCase()),
    }));

    const version: ReportVersionSSOT = {
      versionId: `ver_${returnKey}_v1`,
      reportKey: returnKey,
      versionNumber: 1,
      status: 'DRAFT' as VersionStatus, // Strictly DRAFT!
      effectiveFrom: now,
      effectiveTo: null,
      changelogSummary: `Imported from NBE JSON package (${format})`,
      changeDiff: [],
      createdBy: 'NBE Package Import Service',
      createdAt: now,
      publishedAt: null, // Strictly null!
      sections,
      fields,
      columns,
      rows: [],
      formulas,
      validationRules: reportPayload.validationRules || [],
      nbeMapping: reportPayload.nbeMapping || {
        returnKey,
        instCode: reportPayload.instCode || '0000013',
        finYear: reportPayload.finYear || 2026,
      },
      schemaSnapshot: {
        itemCount: fields.length,
        dynamicAreaCount: columns.length,
        formulaCount: formulas.length,
        validationRuleCount: (reportPayload.validationRules || []).length,
        ReturnItemsList: fields.map((f) => ({
          ItemId: f.itemId,
          ItemCode: f.itemCode,
          ItemDescription: f.itemDescription,
          IsCalculated: f.isCalculated,
          FormulaExpression: f.formulaExpression,
        })),
        DynamicItemsList: columns.map((c) => ({
          ItemCode: c.columnKey,
          ItemDescription: c.headerLabel,
        })),
      },
    };

    const integrationConfig: ReportIntegrationConfigSSOT | undefined = integration
      ? {
          reportKey: returnKey,
          versionNumber: 1,
          environmentTarget: (integration.apiEndpoint && integration.apiEndpoint.startsWith('https://')) ? 'PRODUCTION/NBE' : 'LOCAL/SIMULATOR',
          endpointUrl: integration.apiEndpoint || '/api/v1/nbe-simulator/submit',
          httpMethod: (integration.httpMethod === 'PUT' ? 'PUT' : 'POST'),
          contentType: integration.contentType || 'application/json',
          expectedResponseType: 'application/json',
          timeoutMs: integration.timeoutMs || 30000,
          nbeReportIdentifier: `NBE_RET_${returnKey}`,
          idempotencyStrategy: (integration.idempotencyStrategy as any) || 'HEADER_UUID',
          authProfileRef: integration.authenticationProfile || 'auth_local_simulator',
          productionEnabled: false,
          updatedAt: now,
        }
      : undefined;

    (version as any).integrationConfig = integrationConfig;

    const report: ReportDefinitionSSOT = {
      id: `rep_${returnKey}`,
      returnKey,
      code: (reportPayload.shortCode || returnKey).toUpperCase(),
      name: reportPayload.mainTitle,
      description: reportPayload.description || `Prudential return for ${reportPayload.mainTitle}`,
      category: reportPayload.regulatoryCategory || 'Credit & Risk Management',
      frequency,
      status: 'DRAFT', // Strictly DRAFT!
      instCode: reportPayload.instCode || '0000013',
      finYear: reportPayload.finYear || 2026,
      defaultDepartmentId: 'dept_credit_ops',
      departmentIds: ['dept_credit_ops'],
      currentVersion: 1,
      effectiveFrom: now,
      effectiveTo: null,
      nbeMapping: reportPayload.nbeMapping || {
        returnKey,
        instCode: reportPayload.instCode || '0000013',
        finYear: reportPayload.finYear || 2026,
      },
      displayConfiguration: {
        layout: 'STANDARD_TABLE',
        subTitles: reportPayload.subTitles || [],
        integration: integration || null,
        importedAt: now,
        packageFormat: format,
      },
      createdAt: now,
      updatedAt: now,
      activeVersionSnapshot: undefined, // Strictly undefined while in DRAFT!
      integrationConfig,
    };

    return { report, version };
  }
}

export const nbeReportPackageService = new NbeReportPackageServiceClass();
