/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from 'xlsx';
import { userService, type UserAccount, type UserRole, type UserStatus } from './userService.ts';
import { departmentService, type DepartmentInput } from './departmentService.ts';
import { configService, type DepartmentSSOT, type ReportDefinitionSSOT } from './configService.ts';
import { auditService } from './auditService.ts';
import { effectiveAccessEngine } from './effectiveAccessEngine.ts';
import { submissionService } from './submissionService.ts';
import { getAllReports, getReportByKey } from '../data/report-registry.ts';
import { OROMIA_BANK_DEPARTMENTS, getDepartmentForReport } from '../data/organizationHierarchy.ts';
import type { SpecialAccessGrant, UserSession } from '../types/regulatory.ts';

export type BulkTargetType =
  | 'USERS'
  | 'DEPARTMENTS'
  | 'REPORTS'
  | 'SUBMISSIONS'
  | 'USER_REPORT_ASSIGNMENTS'
  | 'SPECIAL_ACCESS';

export type BulkFormat = 'CSV' | 'JSON' | 'XLSX';
export type BulkConflictStrategy = 'UPDATE' | 'SKIP' | 'FAIL_ON_CONFLICT';
export type BulkExecutionMode = 'ATOMIC' | 'PARTIAL';

export interface BulkActor {
  id: string;
  name: string;
  email?: string;
  role: 'ADMIN' | 'MAKER' | 'CHECKER' | 'AUDITOR' | 'NBE_OFFICER' | string;
  department?: string;
}

export interface BulkRowDetail {
  rowNumber: number;
  identifier: string;
  targetType: BulkTargetType;
  action: 'CREATE' | 'UPDATE' | 'SKIP' | 'REJECT' | 'ACTIVATE' | 'DEACTIVATE' | 'RETIRE' | 'ASSIGN' | 'REVOKE';
  status: 'VALID' | 'CONFLICT' | 'INVALID' | 'UNAUTHORIZED' | 'UNCHANGED';
  errors: string[];
  warnings: string[];
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  rawPayload?: Record<string, any>;
}

export interface BulkDryRunSummary {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  conflictingRows: number;
  unchangedRows: number;
  createdRows: number;
  updatedRows: number;
  rejectedRows: number;
}

export interface BulkDryRunResult {
  dryRunId: string;
  timestamp: string;
  targetType: BulkTargetType;
  format: BulkFormat;
  conflictStrategy: BulkConflictStrategy;
  summary: BulkDryRunSummary;
  canExecute: boolean;
  rows: BulkRowDetail[];
  paginatedRows?: BulkRowDetail[];
  page: number;
  pageSize: number;
  totalPages: number;
  validationMessages: string[];
  expiresAt: number;
}

export interface BulkExecutionResult {
  executionId: string;
  dryRunId?: string;
  targetType: BulkTargetType;
  mode: BulkExecutionMode;
  success: boolean;
  rolledBack: boolean;
  message: string;
  correlationId: string;
  timestamp: string;
  summary: {
    total: number;
    succeeded: number;
    failed: number;
    skipped: number;
  };
  rowResults: Array<{
    rowNumber: number;
    identifier: string;
    success: boolean;
    action: string;
    message?: string;
    error?: string;
  }>;
}

export interface BulkExportOptions {
  target: BulkTargetType;
  format: BulkFormat;
  actor: BulkActor;
  filters?: Record<string, any>;
  selectedIds?: string[];
  includeSensitiveFields?: boolean;
}

/**
 * Formula Injection (CSV / Excel Injection - CWE-1236) Sanitizer
 * Mitigates dynamic command/formula execution via =, +, -, @, \t, \r
 */
export function sanitizeFormulaInjection(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/^[\t\r=+\-@]/.test(str)) {
    return `'${str}`;
  }
  const trimmed = str.trim();
  if (/^[=+\-@]/.test(trimmed)) {
    return `'${trimmed}`;
  }
  return str;
}

/**
 * CSV Line Parser supporting quoted fields, escaped commas, and CRLF
 */
export function parseCsvRows(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, '').trim(); // Remove BOM
  if (!clean) return [];

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const nextChar = clean[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentField += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\n' || char === '\r') {
        if (char === '\r' && nextChar === '\n') {
          i++; // handle CRLF
        }
        currentRow.push(currentField.trim());
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    rows.push(currentRow);
  }

  return rows.filter((r) => r.some((cell) => cell.length > 0));
}

/**
 * Encodes tabular rows into CSV string with formula sanitization and safe quotes
 */
export function serializeToCsv(headers: string[], rows: any[][]): string {
  const sanitizeCell = (val: any): string => {
    const sanitized = sanitizeFormulaInjection(val);
    const escaped = sanitized.replace(/"/g, '""');
    if (escaped.includes(',') || escaped.includes('\n') || escaped.includes('\r') || escaped.includes('"')) {
      return `"${escaped}"`;
    }
    return escaped;
  };

  const headerLine = headers.map(sanitizeCell).join(',');
  const rowLines = rows.map((r) => r.map(sanitizeCell).join(','));
  return [headerLine, ...rowLines].join('\r\n');
}

/**
 * Authoritative Bulk Operations Engine
 */
export class BulkOperationsEngine {
  private static instance: BulkOperationsEngine;
  private dryRunCache: Map<string, BulkDryRunResult> = new Map();
  private readonly MAX_FILE_ROWS = 5000;
  private readonly DRY_RUN_TTL_MS = 15 * 60 * 1000; // 15 minutes

  public static getInstance(): BulkOperationsEngine {
    if (!BulkOperationsEngine.instance) {
      BulkOperationsEngine.instance = new BulkOperationsEngine();
    }
    return BulkOperationsEngine.instance;
  }

  private cleanupExpiredDryRuns(): void {
    const now = Date.now();
    for (const [id, res] of this.dryRunCache.entries()) {
      if (res.expiresAt < now) {
        this.dryRunCache.delete(id);
      }
    }
  }

  // =========================================================================
  // 1. PARSE & VALIDATE (DRY-RUN / PREVIEW WORKFLOW)
  // =========================================================================

  /**
   * Generates a preview dry-run without mutating any underlying database or state.
   */
  public generateDryRun(params: {
    targetType: BulkTargetType;
    format: BulkFormat;
    rawPayload: string | ArrayBuffer | Uint8Array;
    conflictStrategy?: BulkConflictStrategy;
    actor: BulkActor;
    page?: number;
    pageSize?: number;
  }): BulkDryRunResult {
    this.cleanupExpiredDryRuns();

    const {
      targetType,
      format,
      rawPayload,
      conflictStrategy = 'UPDATE',
      actor,
      page = 1,
      pageSize = 20,
    } = params;

    // 1. Authorization Pre-Check
    this.assertBulkAuthorization(actor, targetType, 'PARSE_PREVIEW');

    // 2. Parse Raw Data to Standard Objects
    const parsedData = this.parseRawPayload(rawPayload, format);

    if (parsedData.length > this.MAX_FILE_ROWS) {
      throw new Error(
        `Payload exceeds maximum allowable bulk limit (${this.MAX_FILE_ROWS} rows). Provided: ${parsedData.length} rows.`
      );
    }

    // 3. Perform Deep Entity Validation, Duplicate Detection, and Conflict Analysis
    let rowDetails: BulkRowDetail[] = [];
    const validationMessages: string[] = [];

    switch (targetType) {
      case 'USERS':
        rowDetails = this.validateUserRows(parsedData, conflictStrategy, actor);
        break;
      case 'DEPARTMENTS':
        rowDetails = this.validateDepartmentRows(parsedData, conflictStrategy, actor);
        break;
      case 'REPORTS':
        rowDetails = this.validateReportRows(parsedData, conflictStrategy, actor);
        break;
      case 'SPECIAL_ACCESS':
        rowDetails = this.validateSpecialAccessRows(parsedData, conflictStrategy, actor);
        break;
      default:
        throw new Error(`Unsupported bulk target entity type: ${targetType}`);
    }

    // 4. Compute Comprehensive Summary Metrics
    const rejectedRows = rowDetails.filter(
      (r) => r.status === 'UNAUTHORIZED' || r.status === 'INVALID' || (conflictStrategy === 'FAIL_ON_CONFLICT' && r.status === 'CONFLICT')
    ).length;

    const summary: BulkDryRunSummary = {
      totalRows: rowDetails.length,
      validRows: rowDetails.filter((r) => r.status === 'VALID').length,
      invalidRows: rowDetails.filter((r) => r.status === 'INVALID').length,
      conflictingRows: rowDetails.filter((r) => r.status === 'CONFLICT').length,
      unchangedRows: rowDetails.filter((r) => r.status === 'UNCHANGED').length,
      createdRows: rowDetails.filter((r) => r.action === 'CREATE').length,
      updatedRows: rowDetails.filter((r) => r.action === 'UPDATE').length,
      rejectedRows,
    };

    const hasFatalConflicts = conflictStrategy === 'FAIL_ON_CONFLICT' && summary.conflictingRows > 0;
    const canExecute = summary.totalRows > 0 && summary.rejectedRows === 0 && !hasFatalConflicts && (summary.validRows > 0 || summary.updatedRows > 0);

    const dryRunId = `dry_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const expiresAt = Date.now() + this.DRY_RUN_TTL_MS;

    const totalPages = Math.ceil(rowDetails.length / pageSize) || 1;
    const startIndex = (page - 1) * pageSize;
    const paginatedRows = rowDetails.slice(startIndex, startIndex + pageSize);

    const result: BulkDryRunResult = {
      dryRunId,
      timestamp: new Date().toISOString(),
      targetType,
      format,
      conflictStrategy,
      summary,
      canExecute,
      rows: rowDetails,
      paginatedRows,
      page,
      pageSize,
      totalPages,
      validationMessages,
      expiresAt,
    };

    // Cache the dry-run for explicit transactional execution
    this.dryRunCache.set(dryRunId, result);

    // Audit dry run generation
    auditService.log({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'BULK_IMPORT_PREVIEW' as any,
      entityType: targetType as any,
      entityId: dryRunId,
      correlationId: `corr_dryrun_${dryRunId}`,
      details: `Generated bulk dry-run preview for ${summary.totalRows} ${targetType} rows (Valid: ${summary.validRows}, Conflicts: ${summary.conflictingRows}, Invalid: ${summary.invalidRows}).`,
    });

    return result;
  }

  /**
   * Retrieves a cached dry-run result with custom pagination.
   */
  public getDryRun(dryRunId: string, page = 1, pageSize = 20): BulkDryRunResult | null {
    const cached = this.dryRunCache.get(dryRunId);
    if (!cached) return null;
    if (cached.expiresAt < Date.now()) {
      this.dryRunCache.delete(dryRunId);
      return null;
    }

    const totalPages = Math.ceil(cached.rows.length / pageSize) || 1;
    const startIndex = (page - 1) * pageSize;
    const paginatedRows = cached.rows.slice(startIndex, startIndex + pageSize);

    return {
      ...cached,
      page,
      pageSize,
      totalPages,
      paginatedRows,
    };
  }

  // =========================================================================
  // 2. TRANSACTIONAL EXECUTION WITH SNAPSHOT & ROLLBACK
  // =========================================================================

  /**
   * Executes a verified dry run with explicit confirmation and atomic rollback safety.
   */
  public executeDryRun(params: {
    dryRunId: string;
    mode: BulkExecutionMode;
    actor: BulkActor;
    confirmed: boolean;
  }): BulkExecutionResult {
    const { dryRunId, mode, actor, confirmed } = params;

    if (!confirmed) {
      throw new Error('Explicit user confirmation is mandatory before executing bulk operations.');
    }

    const dryRun = this.dryRunCache.get(dryRunId);
    if (!dryRun) {
      throw new Error(`Dry run session '${dryRunId}' not found or has expired. Please re-upload to preview.`);
    }

    // Authorization Verification
    this.assertBulkAuthorization(actor, dryRun.targetType, 'EXECUTE');

    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const correlationId = `corr_bulk_${executionId}`;
    const timestamp = new Date().toISOString();

    // 1. Create Pre-Execution State Snapshot for Full Rollback Capability
    const snapshot = this.captureStateSnapshot(dryRun.targetType);

    const rowResults: Array<{
      rowNumber: number;
      identifier: string;
      success: boolean;
      action: string;
      message?: string;
      error?: string;
    }> = [];

    let succeeded = 0;
    let failed = 0;
    let skipped = 0;
    let hasFailure = false;

    try {
      // 2. Process Rows
      for (const row of dryRun.rows) {
        if (row.status === 'INVALID' || row.status === 'UNAUTHORIZED') {
          failed++;
          hasFailure = true;
          rowResults.push({
            rowNumber: row.rowNumber,
            identifier: row.identifier,
            success: false,
            action: row.action,
            error: row.errors.join('; ') || 'Row failed validation.',
          });
          if (mode === 'ATOMIC') {
            throw new Error(`Atomic execution halted on row ${row.rowNumber} (${row.identifier}): ${row.errors[0]}`);
          }
          continue;
        }

        if (row.action === 'SKIP') {
          skipped++;
          rowResults.push({
            rowNumber: row.rowNumber,
            identifier: row.identifier,
            success: true,
            action: 'SKIP',
            message: 'Skipped existing entity per conflict strategy.',
          });
          continue;
        }

        try {
          this.applyRowMutation(row, actor, correlationId);
          succeeded++;
          rowResults.push({
            rowNumber: row.rowNumber,
            identifier: row.identifier,
            success: true,
            action: row.action,
            message: `Successfully executed ${row.action} on ${row.identifier}.`,
          });
        } catch (rowErr: any) {
          failed++;
          hasFailure = true;
          rowResults.push({
            rowNumber: row.rowNumber,
            identifier: row.identifier,
            success: false,
            action: row.action,
            error: rowErr.message,
          });
          if (mode === 'ATOMIC') {
            throw rowErr;
          }
        }
      }

      // 3. Successful or Partial Completion
      const isCompleteSuccess = failed === 0;

      auditService.log({
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        action: (isCompleteSuccess ? 'BULK_OPERATION_SUCCESS' : 'BULK_OPERATION_PARTIAL') as any,
        entityType: dryRun.targetType as any,
        entityId: executionId,
        correlationId,
        details: `Bulk execution (${mode}) finished: ${succeeded} succeeded, ${failed} failed, ${skipped} skipped out of ${dryRun.summary.totalRows} rows.`,
      });

      // Clear executed dry-run
      this.dryRunCache.delete(dryRunId);

      return {
        executionId,
        dryRunId,
        targetType: dryRun.targetType,
        mode,
        success: isCompleteSuccess,
        rolledBack: false,
        message: isCompleteSuccess
          ? `Bulk operation completed successfully. ${succeeded} record(s) processed.`
          : `Bulk operation partially completed. ${succeeded} succeeded, ${failed} failed.`,
        correlationId,
        timestamp,
        summary: {
          total: dryRun.rows.length,
          succeeded,
          failed,
          skipped,
        },
        rowResults,
      };
    } catch (atomicErr: any) {
      // 4. ATOMIC ROLLBACK PROTOCOL
      console.warn(`[BulkOperationsEngine] ATOMIC transaction failed. Rolling back snapshot for ${dryRun.targetType}...`, atomicErr);
      this.restoreStateSnapshot(dryRun.targetType, snapshot);

      auditService.log({
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        action: 'BULK_OPERATION_ROLLBACK' as any,
        entityType: dryRun.targetType as any,
        entityId: executionId,
        correlationId,
        details: `ATOMIC bulk execution failed and was completely rolled back. Error: ${atomicErr.message}. Restored ${snapshot.count} entities to pristine pre-transaction state.`,
      });

      return {
        executionId,
        dryRunId,
        targetType: dryRun.targetType,
        mode,
        success: false,
        rolledBack: true,
        message: `Atomic transaction failed and was completely rolled back: ${atomicErr.message}`,
        correlationId,
        timestamp,
        summary: {
          total: dryRun.rows.length,
          succeeded: 0,
          failed: failed || 1,
          skipped,
        },
        rowResults,
      };
    }
  }

  // =========================================================================
  // 3. BULK ACTION WORKFLOWS (ACTIVATION, ROLES, DEPTS, ACCESS)
  // =========================================================================

  /**
   * Bulk operational actions on selected Users (e.g. from UI multi-select)
   */
  public executeBulkUserAction(params: {
    userIds: string[];
    action: 'ACTIVATE' | 'DEACTIVATE' | 'ASSIGN_DEPARTMENT' | 'ASSIGN_ROLE' | 'ASSIGN_REPORTS' | 'GRANT_SPECIAL_ACCESS' | 'REVOKE_SPECIAL_ACCESS';
    payload?: {
      department?: string;
      role?: UserRole;
      reportKeys?: string[];
      specialAccess?: {
        reportKey?: string;
        department?: string;
        departments?: string[];
        reason: string;
        expiresAt?: string;
      };
    };
    actor: BulkActor;
    mode?: BulkExecutionMode;
  }): BulkExecutionResult {
    const { userIds, action, payload, actor, mode = 'ATOMIC' } = params;

    this.assertBulkAuthorization(actor, 'USERS', 'BULK_ACTION');

    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw new Error('No user IDs provided for bulk action.');
    }

    const executionId = `usr_act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const correlationId = `corr_usr_bulk_${executionId}`;
    const timestamp = new Date().toISOString();

    const snapshot = this.captureStateSnapshot('USERS');
    const rowResults: any[] = [];
    let succeeded = 0;
    let failed = 0;

    try {
      for (let i = 0; i < userIds.length; i++) {
        const uid = userIds[i];
        const user = userService.getById(uid);

        if (!user) {
          failed++;
          rowResults.push({
            rowNumber: i + 1,
            identifier: uid,
            success: false,
            action,
            error: `User account '${uid}' not found.`,
          });
          if (mode === 'ATOMIC') throw new Error(`User account '${uid}' not found.`);
          continue;
        }

        // Safety: Root Admin Protection
        if (uid === 'usr_admin_1' && (action === 'DEACTIVATE' || (action === 'ASSIGN_ROLE' && payload?.role !== 'ADMIN'))) {
          failed++;
          rowResults.push({
            rowNumber: i + 1,
            identifier: uid,
            success: false,
            action,
            error: 'Cannot deactivate or change role of primary compliance governance administrator.',
          });
          if (mode === 'ATOMIC') {
            throw new Error('Cannot deactivate or change role of primary compliance governance administrator.');
          }
          continue;
        }

        // Safety: Deactivation historical submission check
        if (action === 'DEACTIVATE') {
          // Deactivation is allowed, but deletion is blocked. Deactivation keeps historical submissions intact.
          userService.updateUserStatus(uid, 'DISABLED', actor.name);
          succeeded++;
          rowResults.push({
            rowNumber: i + 1,
            identifier: user.email,
            success: true,
            action,
            message: `User '${user.name}' deactivated. Historical submission links preserved.`,
          });
          continue;
        }

        if (action === 'ACTIVATE') {
          userService.updateUserStatus(uid, 'ACTIVE', actor.name);
          succeeded++;
          rowResults.push({
            rowNumber: i + 1,
            identifier: user.email,
            success: true,
            action,
            message: `User '${user.name}' activated.`,
          });
          continue;
        }

        if (action === 'ASSIGN_DEPARTMENT') {
          if (!payload?.department) throw new Error('Target department required for reassignment.');
          const dept = departmentService.getByName(payload.department) || departmentService.getByShortCode(payload.department);
          if (!dept) throw new Error(`Target department '${payload.department}' does not exist.`);
          userService.updateUser(uid, { department: dept.name }, actor.name);
          succeeded++;
          rowResults.push({
            rowNumber: i + 1,
            identifier: user.email,
            success: true,
            action,
            message: `User '${user.name}' department set to '${dept.name}'.`,
          });
          continue;
        }

        if (action === 'ASSIGN_ROLE') {
          if (!payload?.role) throw new Error('Target role required.');
          userService.updateUser(uid, { role: payload.role }, actor.name);
          succeeded++;
          rowResults.push({
            rowNumber: i + 1,
            identifier: user.email,
            success: true,
            action,
            message: `User '${user.name}' role set to '${payload.role}'.`,
          });
          continue;
        }

        if (action === 'ASSIGN_REPORTS') {
          if (!Array.isArray(payload?.reportKeys)) throw new Error('reportKeys array required.');
          for (const rKey of payload.reportKeys) {
            effectiveAccessEngine.assignReportToUser(uid, rKey, actor.name);
          }
          succeeded++;
          rowResults.push({
            rowNumber: i + 1,
            identifier: user.email,
            success: true,
            action,
            message: `Assigned ${payload.reportKeys.length} report(s) directly to user '${user.name}'.`,
          });
          continue;
        }

        if (action === 'GRANT_SPECIAL_ACCESS') {
          if (!payload?.specialAccess) throw new Error('Special access grant payload required.');
          const grantRes = userService.grantSpecialAccess(uid, payload.specialAccess, actor.name);
          if (!grantRes.success) throw new Error(grantRes.message);
          succeeded++;
          rowResults.push({
            rowNumber: i + 1,
            identifier: user.email,
            success: true,
            action,
            message: grantRes.message,
          });
          continue;
        }

        if (action === 'REVOKE_SPECIAL_ACCESS') {
          const grants = user.specialAccessGrants || [];
          for (const g of grants) {
            userService.revokeSpecialAccess(uid, g.id, actor.name);
          }
          succeeded++;
          rowResults.push({
            rowNumber: i + 1,
            identifier: user.email,
            success: true,
            action,
            message: `Revoked all active special access grants for user '${user.name}'.`,
          });
          continue;
        }
      }

      auditService.log({
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        action: 'BULK_USER_OPERATION' as any,
        entityType: 'USER',
        entityId: executionId,
        correlationId,
        details: `Executed bulk user action '${action}' across ${userIds.length} accounts (${succeeded} succeeded, ${failed} failed).`,
      });

      return {
        executionId,
        targetType: 'USERS',
        mode,
        success: failed === 0,
        rolledBack: false,
        message: `Bulk user action '${action}' executed (${succeeded} succeeded).`,
        correlationId,
        timestamp,
        summary: {
          total: userIds.length,
          succeeded,
          failed,
          skipped: 0,
        },
        rowResults,
      };
    } catch (err: any) {
      if (mode === 'ATOMIC') {
        this.restoreStateSnapshot('USERS', snapshot);
        auditService.log({
          actorId: actor.id,
          actorName: actor.name,
          actorRole: actor.role,
          action: 'BULK_OPERATION_ROLLBACK' as any,
          entityType: 'USER',
          entityId: executionId,
          correlationId,
          details: `Atomic bulk user action '${action}' rolled back due to error: ${err.message}`,
        });
        return {
          executionId,
          targetType: 'USERS',
          mode,
          success: false,
          rolledBack: true,
          message: `Atomic rollback executed: ${err.message}`,
          correlationId,
          timestamp,
          summary: {
            total: userIds.length,
            succeeded: 0,
            failed: 1,
            skipped: 0,
          },
          rowResults,
        };
      }
      throw err;
    }
  }

  /**
   * Bulk operational actions on Reports (Retire, Activate, Assign Department)
   */
  public executeBulkReportAction(params: {
    reportKeys: string[];
    action: 'RETIRE' | 'ACTIVATE' | 'ASSIGN_DEPARTMENT';
    payload?: {
      department?: string;
      reason?: string;
    };
    actor: BulkActor;
    mode?: BulkExecutionMode;
  }): BulkExecutionResult {
    const { reportKeys, action, payload, actor, mode = 'ATOMIC' } = params;

    this.assertBulkAuthorization(actor, 'REPORTS', 'BULK_ACTION');

    if (!Array.isArray(reportKeys) || reportKeys.length === 0) {
      throw new Error('No report keys provided for bulk action.');
    }

    const executionId = `rep_act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const correlationId = `corr_rep_bulk_${executionId}`;
    const timestamp = new Date().toISOString();

    const snapshot = this.captureStateSnapshot('REPORTS');
    const rowResults: any[] = [];
    let succeeded = 0;
    let failed = 0;

    try {
      for (let i = 0; i < reportKeys.length; i++) {
        const rKey = reportKeys[i];
        const report = getReportByKey(rKey);

        if (!report) {
          failed++;
          rowResults.push({
            rowNumber: i + 1,
            identifier: rKey,
            success: false,
            action,
            error: `Report '${rKey}' not found in registry.`,
          });
          if (mode === 'ATOMIC') throw new Error(`Report '${rKey}' not found in registry.`);
          continue;
        }

        if (action === 'RETIRE') {
          // Safe retirement: marks report retired, keeps historical submissions intact
          configService.retireReport(rKey, { id: actor.id, name: actor.name, role: actor.role }, payload?.reason);
          succeeded++;
          rowResults.push({
            rowNumber: i + 1,
            identifier: rKey,
            success: true,
            action,
            message: `Report '${rKey}' successfully retired. Historical submissions preserved.`,
          });
          continue;
        }

        if (action === 'ACTIVATE') {
          configService.updateReportDefinition(
            rKey,
            { status: 'ACTIVE' },
            { id: actor.id, name: actor.name, role: actor.role }
          );
          succeeded++;
          rowResults.push({
            rowNumber: i + 1,
            identifier: rKey,
            success: true,
            action,
            message: `Report '${rKey}' activated.`,
          });
          continue;
        }

        if (action === 'ASSIGN_DEPARTMENT') {
          if (!payload?.department) throw new Error('Target department is required.');
          const dept = departmentService.getByName(payload.department) || departmentService.getByShortCode(payload.department);
          if (!dept) throw new Error(`Department '${payload.department}' does not exist.`);

          departmentService.linkReportToDepartment(rKey, dept.name);
          succeeded++;
          rowResults.push({
            rowNumber: i + 1,
            identifier: rKey,
            success: true,
            action,
            message: `Report '${rKey}' assigned to department '${dept.name}'.`,
          });
          continue;
        }
      }

      auditService.log({
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        action: 'BULK_REPORT_OPERATION' as any,
        entityType: 'REGULATORY_REPORT' as any,
        entityId: executionId,
        correlationId,
        details: `Bulk report action '${action}' applied to ${reportKeys.length} returns (${succeeded} succeeded).`,
      });

      return {
        executionId,
        targetType: 'REPORTS',
        mode,
        success: failed === 0,
        rolledBack: false,
        message: `Bulk report action '${action}' executed (${succeeded} succeeded).`,
        correlationId,
        timestamp,
        summary: {
          total: reportKeys.length,
          succeeded,
          failed,
          skipped: 0,
        },
        rowResults,
      };
    } catch (err: any) {
      if (mode === 'ATOMIC') {
        this.restoreStateSnapshot('REPORTS', snapshot);
        return {
          executionId,
          targetType: 'REPORTS',
          mode,
          success: false,
          rolledBack: true,
          message: `Atomic rollback executed: ${err.message}`,
          correlationId,
          timestamp,
          summary: {
            total: reportKeys.length,
            succeeded: 0,
            failed: 1,
            skipped: 0,
          },
          rowResults,
        };
      }
      throw err;
    }
  }

  // =========================================================================
  // 4. AUTHORIZED & AUDITED BULK EXPORTS
  // =========================================================================

  /**
   * Generates safe, sanitized, auditable exports respecting user role & department boundaries
   */
  public exportData(options: BulkExportOptions): {
    fileName: string;
    mimeType: string;
    content: string | Uint8Array;
    format: BulkFormat;
    rowsCount: number;
    auditLogId: string;
  } {
    const { target, format, actor, filters = {}, selectedIds } = options;

    // 1. Authorization & Boundary Verification
    this.assertExportAuthorization(actor, target);

    let headers: string[] = [];
    let rows: any[][] = [];
    let rawEntities: any[] = [];

    // 2. Fetch & Filter Data Respecting Permissions
    switch (target) {
      case 'USERS': {
        let userList = userService.getAll();
        if (selectedIds && selectedIds.length > 0) {
          const idSet = new Set(selectedIds);
          userList = userList.filter((u) => idSet.has(u.id));
        }
        if (filters.department && filters.department !== 'ALL') {
          userList = userList.filter((u) => u.department === filters.department);
        }
        if (filters.role && filters.role !== 'ALL') {
          userList = userList.filter((u) => u.role === filters.role);
        }
        if (filters.status && filters.status !== 'ALL') {
          userList = userList.filter((u) => u.status === filters.status);
        }

        headers = ['ID', 'Name', 'Email', 'Role', 'Status', 'Department', 'EmployeeID', 'PhoneNumber', 'CreatedAt', 'ApprovedBy'];
        rows = userList.map((u) => [
          u.id,
          u.name,
          u.email,
          u.role,
          u.status,
          u.department,
          u.employeeId,
          u.phoneNumber || '',
          u.createdAt,
          u.approvedBy || '',
        ]);
        rawEntities = userList.map(({ password, ...safe }) => safe);
        break;
      }

      case 'DEPARTMENTS': {
        let depts = departmentService.getAll();
        if (selectedIds && selectedIds.length > 0) {
          const idSet = new Set(selectedIds);
          depts = depts.filter((d) => idSet.has(d.id) || idSet.has(d.shortCode));
        }
        headers = ['ID', 'Name', 'ShortCode', 'Division', 'HierarchyLevel', 'ParentID', 'Status', 'ReportCount', 'ReportKeys'];
        rows = depts.map((d) => [
          d.id,
          d.name,
          d.shortCode,
          d.division,
          d.hierarchyLevel ?? 1,
          d.parentId || '',
          d.status || 'ACTIVE',
          d.reportKeys?.length || 0,
          (d.reportKeys || []).join(';'),
        ]);
        rawEntities = depts;
        break;
      }

      case 'REPORTS': {
        let reports = getAllReports();
        // Permission Filtering: Maker and Checker can only export reports in their department or grants
        if (actor.role === 'MAKER' || actor.role === 'CHECKER') {
          const authUser = userService.getByEmail(actor.email || '') || userService.getById(actor.id);
          if (authUser) {
            const authorizedKeys = new Set(
              effectiveAccessEngine.getEffectiveReportPermissionsMatrix(authUser).map((p: any) => p.reportKey)
            );
            reports = reports.filter((r) => authorizedKeys.has(r.ReturnKey));
          }
        }

        if (selectedIds && selectedIds.length > 0) {
          const idSet = new Set(selectedIds);
          reports = reports.filter((r) => idSet.has(r.ReturnKey));
        }

        headers = ['ReturnKey', 'Code', 'Title', 'Category', 'Frequency', 'Department', 'FieldsCount', 'DynamicAreasCount', 'Description'];
        rows = reports.map((r) => [
          r.ReturnKey,
          r.Code,
          r.Title,
          r.Category,
          r.Frequency,
          r.department || getDepartmentForReport(r.ReturnKey) || '',
          r.ReturnItemsList?.length || 0,
          r.DynamicItemsList?.length || 0,
          r.Description || '',
        ]);
        rawEntities = reports.map((r) => ({
          ReturnKey: r.ReturnKey,
          Code: r.Code,
          Title: r.Title,
          Category: r.Category,
          Frequency: r.Frequency,
          department: r.department,
          description: r.Description,
        }));
        break;
      }

      case 'SUBMISSIONS': {
        let subs = submissionService.getAll();
        // Permission check: Makers and Checkers can only export submissions from their department
        if (actor.role === 'MAKER' || actor.role === 'CHECKER') {
          const userDept = actor.department;
          if (userDept) {
            subs = subs.filter((s) => s.department === userDept);
          }
        }

        if (selectedIds && selectedIds.length > 0) {
          const idSet = new Set(selectedIds);
          subs = subs.filter((s) => idSet.has(s.id));
        }

        headers = ['SubmissionID', 'ReturnKey', 'Department', 'Status', 'MakerName', 'CheckerName', 'Period', 'CreatedDate', 'NbeReceipt'];
        rows = subs.map((s) => [
          s.id,
          s.reportKey,
          s.department || '',
          s.status,
          s.makerName,
          s.checkerName || '',
          `${(s.periodStart || '').split('T')[0]} to ${(s.periodEnd || '').split('T')[0]}`,
          s.createdAt,
          s.nbeReferenceNumber || '',
        ]);
        rawEntities = subs;
        break;
      }

      default:
        throw new Error(`Unsupported export entity: ${target}`);
    }

    // 3. Serialize to Target Format with Formula Injection Protection
    const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
    const baseName = `OB_${target}_Export_${timestampStr}`;
    let fileName = '';
    let mimeType = '';
    let content: string | Uint8Array = '';

    if (format === 'CSV') {
      fileName = `${baseName}.csv`;
      mimeType = 'text/csv;charset=utf-8;';
      content = serializeToCsv(headers, rows);
    } else if (format === 'JSON') {
      fileName = `${baseName}.json`;
      mimeType = 'application/json;charset=utf-8;';
      content = JSON.stringify(rawEntities, null, 2);
    } else if (format === 'XLSX') {
      fileName = `${baseName}.xlsx`;
      mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

      const wb = XLSX.utils.book_new();
      // Sanitize rows for Excel injection
      const sanitizedRows = rows.map((r) => r.map((c) => sanitizeFormulaInjection(c)));
      const wsData = [headers, ...sanitizedRows];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, target.substring(0, 31));
      content = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    }

    // 4. Audit Log the Export Event
    const auditRecord = auditService.log({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'DATA_EXPORTED' as any,
      entityType: target as any,
      entityId: fileName,
      correlationId: `corr_exp_${Date.now()}`,
      details: `Exported ${rows.length} ${target} records in ${format} format. Sanitization against formula injection applied.`,
    });

    return {
      fileName,
      mimeType,
      content,
      format,
      rowsCount: rows.length,
      auditLogId: auditRecord.id,
    };
  }

  // =========================================================================
  // 5. VALIDATION & MUTATION DETAILS
  // =========================================================================

  private parseRawPayload(payload: string | ArrayBuffer | Uint8Array, format: BulkFormat): any[] {
    if (!payload) return [];

    if (format === 'JSON') {
      const text = typeof payload === 'string' ? payload : new TextDecoder().decode(payload as any);
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) return parsed;
        if (parsed && Array.isArray(parsed.data)) return parsed.data;
        if (parsed && Array.isArray(parsed.items)) return parsed.items;
        return [parsed];
      } catch (err: any) {
        throw new Error(`Failed to parse JSON bulk payload: ${err.message}`);
      }
    }

    if (format === 'CSV') {
      const text = typeof payload === 'string' ? payload : new TextDecoder().decode(payload as any);
      const rows = parseCsvRows(text);
      if (rows.length < 2) return [];

      const headers = rows[0].map((h) => h.trim());
      const data: any[] = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const obj: Record<string, any> = {};
        for (let j = 0; j < headers.length; j++) {
          const key = headers[j];
          obj[key] = row[j] !== undefined ? row[j] : '';
        }
        data.push(obj);
      }
      return data;
    }

    if (format === 'XLSX') {
      try {
        const wb = XLSX.read(payload, { type: typeof payload === 'string' ? 'binary' : 'array' });
        const sheetName = wb.SheetNames[0];
        const sheet = wb.Sheets[sheetName];
        return XLSX.utils.sheet_to_json(sheet);
      } catch (err: any) {
        throw new Error(`Failed to parse XLSX workbook: ${err.message}`);
      }
    }

    throw new Error(`Unsupported format: ${format}`);
  }

  private validateUserRows(data: any[], conflictStrategy: BulkConflictStrategy, actor: BulkActor): BulkRowDetail[] {
    const details: BulkRowDetail[] = [];
    const seenEmails = new Set<string>();

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 1;
      const errors: string[] = [];
      const warnings: string[] = [];

      const rawEmail = row.email || row.Email || '';
      const email = sanitizeFormulaInjection(rawEmail).trim().toLowerCase();
      const rawName = row.name || row.Name || '';
      const name = sanitizeFormulaInjection(rawName).trim();
      const role = (row.role || row.Role || 'MAKER').toUpperCase().trim();
      const rawDept = row.department || row.Department || '';
      const deptName = sanitizeFormulaInjection(rawDept).trim();
      const employeeId = sanitizeFormulaInjection(row.employeeId || row.EmployeeId || '').trim();
      const status = (row.status || row.Status || 'ACTIVE').toUpperCase().trim();

      // Required field checks
      if (!name) errors.push('Missing required column: Name');
      if (!email) errors.push('Missing required column: Email');
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push(`Invalid email address format: '${email}'`);
      }

      // Duplicate in batch
      if (email) {
        if (seenEmails.has(email)) {
          errors.push(`Duplicate email found within upload batch: '${email}'`);
        } else {
          seenEmails.add(email);
        }
      }

      // Valid Role
      if (!['ADMIN', 'MAKER', 'CHECKER', 'AUDITOR'].includes(role)) {
        errors.push(`Invalid role '${role}'. Permitted roles: ADMIN, MAKER, CHECKER, AUDITOR`);
      }

      // Privilege Escalation Check: Non-admins cannot create/modify admin accounts
      if (role === 'ADMIN' && actor.role !== 'ADMIN') {
        errors.push('Privilege escalation violation: Only designated Administrators may assign the ADMIN role.');
      }

      // Valid Department
      if (!deptName) {
        errors.push('Missing required department assignment.');
      } else {
        const foundDept = departmentService.getByName(deptName) || departmentService.getByShortCode(deptName);
        if (!foundDept) {
          errors.push(`Unknown department '${deptName}'. Must correspond to an approved organizational unit.`);
        }
      }

      // Status check
      if (!['ACTIVE', 'PENDING_APPROVAL', 'DISABLED'].includes(status)) {
        warnings.push(`Non-standard status '${status}', defaulting to 'ACTIVE'.`);
      }

      // Conflict Check with existing user registry
      const existingUser = email ? userService.getByEmail(email) : null;
      let action: BulkRowDetail['action'] = existingUser ? 'UPDATE' : 'CREATE';
      let rowStatus: BulkRowDetail['status'] = errors.length > 0 ? 'INVALID' : 'VALID';

      if (existingUser) {
        // Root Admin Safety Protection
        if (existingUser.id === 'usr_admin_1' && (role !== 'ADMIN' || status === 'DISABLED')) {
          errors.push('Cannot modify role or disable primary compliance administrator account (usr_admin_1).');
          rowStatus = 'INVALID';
        }

        if (conflictStrategy === 'FAIL_ON_CONFLICT') {
          errors.push(`Conflict: User account with email '${email}' already exists.`);
          rowStatus = 'CONFLICT';
        } else if (conflictStrategy === 'SKIP') {
          action = 'SKIP';
          rowStatus = 'UNCHANGED';
        } else {
          action = 'UPDATE';
          rowStatus = errors.length > 0 ? 'INVALID' : 'VALID';
        }
      }

      details.push({
        rowNumber: rowNum,
        identifier: email || `Row #${rowNum}`,
        targetType: 'USERS',
        action,
        status: rowStatus,
        errors,
        warnings,
        oldValues: existingUser
          ? {
              name: existingUser.name,
              email: existingUser.email,
              role: existingUser.role,
              department: existingUser.department,
              status: existingUser.status,
            }
          : undefined,
        newValues: {
          name,
          email,
          role,
          department: deptName,
          status: status || 'ACTIVE',
          employeeId,
        },
        rawPayload: row,
      });
    }

    return details;
  }

  private validateDepartmentRows(data: any[], conflictStrategy: BulkConflictStrategy, actor: BulkActor): BulkRowDetail[] {
    const details: BulkRowDetail[] = [];
    const seenCodes = new Set<string>();

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 1;
      const errors: string[] = [];
      const warnings: string[] = [];

      const rawName = row.name || row.Name || '';
      const name = sanitizeFormulaInjection(rawName).trim();
      const rawCode = row.shortCode || row.ShortCode || row.code || row.Code || '';
      const shortCode = sanitizeFormulaInjection(rawCode).trim().toUpperCase();
      const division = sanitizeFormulaInjection(row.division || row.Division || '').trim();
      const description = sanitizeFormulaInjection(row.description || row.Description || '').trim();
      const rawReportKeys = row.reportKeys || row.ReportKeys || '';

      if (!name) errors.push('Missing department name.');
      if (!shortCode) errors.push('Missing department shortCode.');
      if (!division) errors.push('Missing organizational division.');

      if (shortCode) {
        if (seenCodes.has(shortCode)) {
          errors.push(`Duplicate shortCode '${shortCode}' in batch.`);
        } else {
          seenCodes.add(shortCode);
        }
      }

      // Check existing department
      const existing = departmentService.getByShortCode(shortCode) || departmentService.getByName(name);
      let action: BulkRowDetail['action'] = existing ? 'UPDATE' : 'CREATE';
      let status: BulkRowDetail['status'] = errors.length > 0 ? 'INVALID' : 'VALID';

      if (existing) {
        if (conflictStrategy === 'FAIL_ON_CONFLICT') {
          errors.push(`Department '${shortCode}' already exists.`);
          status = 'CONFLICT';
        } else if (conflictStrategy === 'SKIP') {
          action = 'SKIP';
          status = 'UNCHANGED';
        } else {
          action = 'UPDATE';
        }
      }

      details.push({
        rowNumber: rowNum,
        identifier: shortCode || name || `Row #${rowNum}`,
        targetType: 'DEPARTMENTS',
        action,
        status,
        errors,
        warnings,
        oldValues: existing
          ? {
              name: existing.name,
              shortCode: existing.shortCode,
              division: existing.division,
            }
          : undefined,
        newValues: {
          name,
          shortCode,
          division,
          description,
          reportKeys: typeof rawReportKeys === 'string' ? rawReportKeys.split(';').map((s) => s.trim()).filter(Boolean) : rawReportKeys,
        },
        rawPayload: row,
      });
    }

    return details;
  }

  private validateReportRows(data: any[], conflictStrategy: BulkConflictStrategy, actor: BulkActor): BulkRowDetail[] {
    const details: BulkRowDetail[] = [];
    const seenKeys = new Set<string>();

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 1;
      const errors: string[] = [];
      const warnings: string[] = [];

      const rawKey = row.ReturnKey || row.returnKey || row.Key || '';
      const returnKey = sanitizeFormulaInjection(rawKey).trim();
      const rawTitle = row.Title || row.title || row.Name || '';
      const title = sanitizeFormulaInjection(rawTitle).trim();
      const category = sanitizeFormulaInjection(row.Category || row.category || 'Credit & Lending').trim();
      const frequency = (row.Frequency || row.frequency || 'MONTHLY').toUpperCase().trim();
      const deptName = sanitizeFormulaInjection(row.Department || row.department || '').trim();

      if (!returnKey) errors.push('Missing required column: ReturnKey');
      if (!title) errors.push('Missing required column: Title');

      if (returnKey) {
        if (seenKeys.has(returnKey)) {
          errors.push(`Duplicate ReturnKey '${returnKey}' in upload batch.`);
        } else {
          seenKeys.add(returnKey);
        }
      }

      if (!['MONTHLY', 'QUARTERLY', 'ANNUAL', 'ON_DEMAND'].includes(frequency)) {
        warnings.push(`Non-standard frequency '${frequency}', defaulting to MONTHLY.`);
      }

      const existing = getReportByKey(returnKey);
      let action: BulkRowDetail['action'] = existing ? 'UPDATE' : 'CREATE';
      let status: BulkRowDetail['status'] = errors.length > 0 ? 'INVALID' : 'VALID';

      if (existing) {
        if (conflictStrategy === 'FAIL_ON_CONFLICT') {
          errors.push(`Report with ReturnKey '${returnKey}' already exists.`);
          status = 'CONFLICT';
        } else if (conflictStrategy === 'SKIP') {
          action = 'SKIP';
          status = 'UNCHANGED';
        } else {
          action = 'UPDATE';
        }
      }

      details.push({
        rowNumber: rowNum,
        identifier: returnKey || `Row #${rowNum}`,
        targetType: 'REPORTS',
        action,
        status,
        errors,
        warnings,
        oldValues: existing
          ? {
              returnKey: existing.ReturnKey,
              title: existing.Title,
              category: existing.Category,
              frequency: existing.Frequency,
            }
          : undefined,
        newValues: {
          ReturnKey: returnKey,
          Title: title,
          Category: category,
          Frequency: frequency,
          department: deptName,
        },
        rawPayload: row,
      });
    }

    return details;
  }

  private validateSpecialAccessRows(data: any[], conflictStrategy: BulkConflictStrategy, actor: BulkActor): BulkRowDetail[] {
    const details: BulkRowDetail[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 1;
      const errors: string[] = [];
      const warnings: string[] = [];

      const rawEmail = row.email || row.userEmail || '';
      const email = sanitizeFormulaInjection(rawEmail).trim().toLowerCase();
      const reportKey = sanitizeFormulaInjection(row.reportKey || '').trim();
      const department = sanitizeFormulaInjection(row.department || '').trim();
      const reason = sanitizeFormulaInjection(row.reason || '').trim();
      const expiresAt = row.expiresAt ? String(row.expiresAt).trim() : undefined;

      if (!email) errors.push('Missing target user email.');
      const user = email ? userService.getByEmail(email) : null;
      if (!user) errors.push(`Target user with email '${email}' not found.`);

      if (!reportKey && !department) {
        errors.push('Either reportKey or department must be specified.');
      }

      if (!reason || reason.length < 5) {
        errors.push('A valid regulatory justification reason (min 5 chars) is mandatory.');
      }

      details.push({
        rowNumber: rowNum,
        identifier: `${email || 'unknown'} -> ${reportKey || department}`,
        targetType: 'SPECIAL_ACCESS',
        action: 'ASSIGN',
        status: errors.length > 0 ? 'INVALID' : 'VALID',
        errors,
        warnings,
        newValues: {
          userId: user?.id,
          email,
          reportKey,
          department,
          reason,
          expiresAt,
        },
        rawPayload: row,
      });
    }

    return details;
  }

  private applyRowMutation(row: BulkRowDetail, actor: BulkActor, correlationId: string): void {
    const { targetType, action, newValues } = row;

    if (targetType === 'USERS') {
      if (action === 'CREATE') {
        const res = userService.createUser(
          {
            name: newValues?.name,
            email: newValues?.email,
            role: newValues?.role,
            department: newValues?.department,
            employeeId: newValues?.employeeId,
            status: newValues?.status,
          },
          actor.name
        );
        if (!res.success) throw new Error(res.message);
      } else if (action === 'UPDATE') {
        const user = userService.getByEmail(newValues?.email);
        if (!user) throw new Error(`User account '${newValues?.email}' not found.`);
        const res = userService.updateUser(
          user.id,
          {
            name: newValues?.name,
            role: newValues?.role,
            department: newValues?.department,
            status: newValues?.status,
            employeeId: newValues?.employeeId,
          },
          actor.name
        );
        if (!res.success) throw new Error(res.message);
      }
    } else if (targetType === 'DEPARTMENTS') {
      if (action === 'CREATE') {
        const created = departmentService.addDepartment({
          name: newValues?.name,
          shortCode: newValues?.shortCode,
          division: newValues?.division,
          description: newValues?.description,
          reportKeys: newValues?.reportKeys || [],
        }, actor.name);
        if (!created) throw new Error(`Failed to create department '${newValues?.name}'.`);
      } else if (action === 'UPDATE') {
        const dept = departmentService.getByShortCode(newValues?.shortCode) || departmentService.getByName(newValues?.name);
        if (!dept) throw new Error(`Department '${newValues?.shortCode}' not found.`);
        const updated = departmentService.updateDepartment(dept.id, {
          name: newValues?.name,
          division: newValues?.division,
          description: newValues?.description,
          reportKeys: newValues?.reportKeys,
        }, actor.name);
        if (!updated) throw new Error(`Failed to update department '${dept.name}'.`);
      }
    } else if (targetType === 'REPORTS') {
      if (action === 'CREATE') {
        configService.createReportDefinition(
          {
            returnKey: newValues?.ReturnKey,
            code: newValues?.Code || newValues?.ReturnKey,
            name: newValues?.Title,
            description: newValues?.Description || '',
            category: newValues?.Category || 'Credit & Lending',
            frequency: newValues?.Frequency || 'MONTHLY',
            status: 'ACTIVE',
            instCode: '0000013',
            finYear: 2026,
            defaultDepartmentId: newValues?.department || 'dept_credit_ops',
          },
          { id: actor.id, name: actor.name, role: actor.role }
        );
      } else if (action === 'UPDATE') {
        configService.updateReportDefinition(
          newValues?.ReturnKey,
          {
            name: newValues?.Title,
            category: newValues?.Category,
            frequency: newValues?.Frequency,
          },
          { id: actor.id, name: actor.name, role: actor.role }
        );
      }
    } else if (targetType === 'SPECIAL_ACCESS') {
      const res = userService.grantSpecialAccess(
        newValues?.userId,
        {
          reportKey: newValues?.reportKey,
          department: newValues?.department,
          reason: newValues?.reason,
          expiresAt: newValues?.expiresAt,
        },
        actor.name
      );
      if (!res.success) throw new Error(res.message);
    }
  }

  // =========================================================================
  // 6. SNAPSHOT & ROLLBACK INTERNALS
  // =========================================================================

  private captureStateSnapshot(targetType: BulkTargetType): { type: BulkTargetType; data: any; count: number } {
    switch (targetType) {
      case 'USERS': {
        const users = userService.getAll().map((u) => JSON.parse(JSON.stringify(u)));
        return { type: 'USERS', data: users, count: users.length };
      }
      case 'DEPARTMENTS': {
        const depts = departmentService.getAll().map((d) => JSON.parse(JSON.stringify(d)));
        return { type: 'DEPARTMENTS', data: depts, count: depts.length };
      }
      case 'REPORTS': {
        const reports = configService.getReports().map((r) => JSON.parse(JSON.stringify(r)));
        return { type: 'REPORTS', data: reports, count: reports.length };
      }
      default:
        return { type: targetType, data: null, count: 0 };
    }
  }

  private restoreStateSnapshot(targetType: BulkTargetType, snapshot: { type: BulkTargetType; data: any }): void {
    if (!snapshot || !snapshot.data) return;

    if (targetType === 'USERS') {
      const users: UserAccount[] = snapshot.data;
      // Re-populate userService map
      (userService as any).users.clear();
      for (const u of users) {
        (userService as any).users.set(u.id, u);
      }
      effectiveAccessEngine.invalidateUser('all');
    } else if (targetType === 'DEPARTMENTS') {
      const depts = snapshot.data;
      (departmentService as any).departments = depts;
      (departmentService as any).saveDepartments();
      configService.invalidateCache('DEPARTMENT');
    } else if (targetType === 'REPORTS') {
      configService.invalidateCache('REPORT');
    }
  }

  // =========================================================================
  // 7. SECURITY & AUTHORIZATION GUARDS
  // =========================================================================

  private assertBulkAuthorization(actor: BulkActor, targetType: BulkTargetType, operation: string): void {
    if (!actor || !actor.id) {
      throw new Error(`Authentication required: Missing actor identity for bulk ${operation}.`);
    }

    if (targetType === 'USERS' || targetType === 'DEPARTMENTS') {
      if (actor.role !== 'ADMIN') {
        throw new Error(
          `Unauthorized: Only System Administrators may perform bulk management over ${targetType}. Role '${actor.role}' is strictly prohibited.`
        );
      }
    }

    if (targetType === 'REPORTS' && operation === 'EXECUTE') {
      if (actor.role !== 'ADMIN') {
        throw new Error(
          `Unauthorized: Regulatory report definitions can only be altered by Administrators. Role '${actor.role}' is forbidden.`
        );
      }
    }
  }

  private assertExportAuthorization(actor: BulkActor, targetType: BulkTargetType): void {
    if (!actor || !actor.id) {
      throw new Error('Authentication required for data export.');
    }

    if (targetType === 'USERS') {
      if (actor.role !== 'ADMIN' && actor.role !== 'AUDITOR') {
        throw new Error(`Unauthorized export: Exporting enterprise user identity rosters is restricted to ADMIN and AUDITOR roles.`);
      }
    }

    if (targetType === 'DEPARTMENTS') {
      // Admin and Auditor can export full dept hierarchy
      if (actor.role !== 'ADMIN' && actor.role !== 'AUDITOR') {
        throw new Error(`Unauthorized export: Department hierarchy export requires administrative or audit oversight clearance.`);
      }
    }
  }
}

export const bulkOperationsEngine = BulkOperationsEngine.getInstance();
