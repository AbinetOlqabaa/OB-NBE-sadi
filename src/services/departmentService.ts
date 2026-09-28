/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DepartmentDefinition, OROMIA_BANK_DEPARTMENTS } from '../data/organizationHierarchy.ts';
import { auditService } from './auditService.ts';
import type { ReportMetadata } from '../types/regulatory.ts';

const DEPARTMENTS_STORAGE_KEY = 'ob_departments_registry';
const REPORT_VERSIONS_STORAGE_KEY = 'ob_report_versions_history';
const GOVERNANCE_LOGS_STORAGE_KEY = 'ob_governance_change_logs';
const DEPT_CHANGE_EVENT = 'ob:departments:changed';
const VERSION_CHANGE_EVENT = 'ob:report_versions:changed';
const LOGS_CHANGE_EVENT = 'ob:governance_logs:changed';

export type DepartmentChangeListener = (departments: DepartmentDefinition[]) => void;
export type ReportVersionChangeListener = (versions: Record<string, ReportVersionRecord[]>) => void;
export type GovernanceLogsChangeListener = (logs: GovernanceChangeLog[]) => void;

export type GovernanceEntityType = 'DEPARTMENT' | 'REPORT_TYPE' | 'LINKAGE';

export interface GovernanceChangeLogFilter {
  entityType?: GovernanceEntityType | 'ALL';
  action?: string;
  search?: string;
  department?: string;
  reportType?: string;
  userId?: string;
  dateRange?: 'ALL' | 'TODAY' | '7_DAYS' | '30_DAYS' | 'CUSTOM';
  startDate?: string;
  endDate?: string;
}

export interface GovernanceChangeLog {
  id: string;
  timestamp: string; // ISO 8601 string
  actor: string;
  actorRole: string;
  entityType: GovernanceEntityType;
  entityId: string;
  entityName: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'RENAME' | 'LINK_REPORTS' | 'BULK_IMPORT' | 'RESTORE';
  summary: string;
  details?: string;
  department?: string;
  reportKey?: string;
  userId?: string;
  diff?: Array<{
    field: string;
    oldValue: any;
    newValue: any;
  }>;
  oldState?: any;
  newState?: any;
}

export interface DepartmentInput {
  name: string;
  shortCode: string;
  division: string;
  description?: string;
  primaryResponsibilities?: string[];
  reportKeys?: string[];
}

export interface DepartmentUpdateInput {
  name?: string;
  shortCode?: string;
  division?: string;
  description?: string;
  primaryResponsibilities?: string[];
  reportKeys?: string[];
}

export interface ReportTypeInput {
  ReturnKey: string;
  Code?: string;
  Title: string;
  Category?: "Credit & Lending" | "Classification & Provisioning" | "Exposures & Concentration" | "Assets & Collateral" | "Restructuring" | "Sector Breakdown";
  Frequency?: "MONTHLY" | "QUARTERLY" | "ANNUAL";
  Description?: string;
  departments?: string[];
  department?: string;
  initialFieldsCount?: number;
}

export interface ReportTypeUpdateInput {
  Title?: string;
  Code?: string;
  Category?: "Credit & Lending" | "Classification & Provisioning" | "Exposures & Concentration" | "Assets & Collateral" | "Restructuring" | "Sector Breakdown";
  Frequency?: "MONTHLY" | "QUARTERLY" | "ANNUAL";
  Description?: string;
  departments?: string[];
  department?: string;
}

export type ReportChangeType =
  | 'CREATED'
  | 'STRUCTURE_UPDATED'
  | 'RENAMED'
  | 'METADATA_CHANGED'
  | 'DEPARTMENTS_REASSIGNED'
  | 'FORMULAS_UPDATED'
  | 'DECOMMISSIONED'
  | 'RESTORED'
  | 'BULK_IMPORTED';

export interface ReportVersionDiff {
  field: string;
  oldValue: any;
  newValue: any;
}

export interface ReportVersionRecord {
  versionId: string;
  versionNumber: number;
  reportKey: string;
  timestamp: string; // ISO 8601 string
  changedBy: string; // Admin user name
  changeType: ReportChangeType;
  changeSummary: string;
  snapshot: {
    ReturnKey: string;
    Code: string;
    Title: string;
    Category: string;
    Frequency: string;
    Description: string;
    departments: string[];
    department: string;
    itemCount?: number;
    formulaCount?: number;
    validationRuleCount?: number;
    isCustom?: boolean;
  };
  previousSnapshot?: {
    Title?: string;
    Code?: string;
    Category?: string;
    Frequency?: string;
    Description?: string;
    departments?: string[];
    department?: string;
  };
  diff?: ReportVersionDiff[];
}

export interface BulkImportResult<T> {
  success: boolean;
  totalParsed: number;
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
  errors: Array<{ row: number; identifier: string; error: string }>;
  items: T[];
  message: string;
}

class DepartmentServiceClass {
  private departments: DepartmentDefinition[] = [];
  private reportVersions: Record<string, ReportVersionRecord[]> = {};
  private governanceLogs: GovernanceChangeLog[] = [];
  private deptListeners: Set<DepartmentChangeListener> = new Set();
  private versionListeners: Set<ReportVersionChangeListener> = new Set();
  private logsListeners: Set<GovernanceLogsChangeListener> = new Set();

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined') {
      this.departments = JSON.parse(JSON.stringify(OROMIA_BANK_DEPARTMENTS));
      return;
    }

    try {
      const storedDepts = localStorage.getItem(DEPARTMENTS_STORAGE_KEY);
      if (storedDepts) {
        const parsed = JSON.parse(storedDepts);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.departments = parsed;
        } else {
          this.departments = JSON.parse(JSON.stringify(OROMIA_BANK_DEPARTMENTS));
        }
      } else {
        this.departments = JSON.parse(JSON.stringify(OROMIA_BANK_DEPARTMENTS));
      }
    } catch (err) {
      console.warn('[DepartmentService] Failed reading departments from localStorage, using defaults:', err);
      this.departments = JSON.parse(JSON.stringify(OROMIA_BANK_DEPARTMENTS));
    }

    try {
      const storedVersions = localStorage.getItem(REPORT_VERSIONS_STORAGE_KEY);
      if (storedVersions) {
        const parsedVersions = JSON.parse(storedVersions);
        if (parsedVersions && typeof parsedVersions === 'object') {
          this.reportVersions = parsedVersions;
        }
      }
    } catch (err) {
      console.warn('[DepartmentService] Failed reading report versions from localStorage:', err);
      this.reportVersions = {};
    }

    try {
      const storedLogs = localStorage.getItem(GOVERNANCE_LOGS_STORAGE_KEY);
      if (storedLogs) {
        const parsedLogs = JSON.parse(storedLogs);
        if (Array.isArray(parsedLogs)) {
          this.governanceLogs = parsedLogs;
        }
      }
    } catch (err) {
      console.warn('[DepartmentService] Failed reading governance logs from localStorage:', err);
      this.governanceLogs = [];
    }

    this.saveToStorage();
  }

  private saveToStorage(): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(DEPARTMENTS_STORAGE_KEY, JSON.stringify(this.departments));
        localStorage.setItem(REPORT_VERSIONS_STORAGE_KEY, JSON.stringify(this.reportVersions));
        localStorage.setItem(GOVERNANCE_LOGS_STORAGE_KEY, JSON.stringify(this.governanceLogs));
        window.dispatchEvent(new CustomEvent(DEPT_CHANGE_EVENT, { detail: this.departments }));
        window.dispatchEvent(new CustomEvent(VERSION_CHANGE_EVENT, { detail: this.reportVersions }));
        window.dispatchEvent(new CustomEvent(LOGS_CHANGE_EVENT, { detail: this.governanceLogs }));
      } catch (err) {
        console.warn('[DepartmentService] Failed persisting to localStorage:', err);
      }
    }
    this.notifyDeptListeners();
    this.notifyVersionListeners();
    this.notifyLogsListeners();
  }

  private notifyDeptListeners(): void {
    const list = this.getAll();
    this.deptListeners.forEach((listener) => {
      try {
        listener(list);
      } catch (e) {
        console.error('[DepartmentService] Dept listener error:', e);
      }
    });
  }

  private notifyVersionListeners(): void {
    const versions = this.getAllReportVersionHistories();
    this.versionListeners.forEach((listener) => {
      try {
        listener(versions);
      } catch (e) {
        console.error('[DepartmentService] Version listener error:', e);
      }
    });
  }

  private notifyLogsListeners(): void {
    const logs = this.getChangeLogs();
    this.logsListeners.forEach((listener) => {
      try {
        listener(logs);
      } catch (e) {
        console.error('[DepartmentService] Logs listener error:', e);
      }
    });
  }

  public subscribe(listener: DepartmentChangeListener): () => void {
    this.deptListeners.add(listener);
    return () => this.deptListeners.delete(listener);
  }

  public subscribeVersionHistory(listener: ReportVersionChangeListener): () => void {
    this.versionListeners.add(listener);
    return () => this.versionListeners.delete(listener);
  }

  public subscribeChangeLogs(listener: GovernanceLogsChangeListener): () => void {
    this.logsListeners.add(listener);
    return () => this.logsListeners.delete(listener);
  }

  // =========================================================================
  // GOVERNANCE CHANGE LOG STORAGE & RETRIEVAL
  // =========================================================================

  public logChange(
    logData: Omit<GovernanceChangeLog, 'id' | 'timestamp'>
  ): GovernanceChangeLog {
    const newLog: GovernanceChangeLog = {
      id: `gov_log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...logData,
    };

    this.governanceLogs.unshift(newLog); // Prepend latest log
    // Retain maximum 500 logs in storage
    if (this.governanceLogs.length > 500) {
      this.governanceLogs = this.governanceLogs.slice(0, 500);
    }
    this.saveToStorage();
    return newLog;
  }

  public getChangeLogs(filter?: GovernanceChangeLogFilter): GovernanceChangeLog[] {
    let result = [...this.governanceLogs];
    if (!filter) return JSON.parse(JSON.stringify(result));

    if (filter.entityType && filter.entityType !== 'ALL') {
      result = result.filter((l) => l.entityType === filter.entityType);
    }

    if (filter.action && filter.action !== 'ALL') {
      result = result.filter((l) => l.action === filter.action);
    }

    if (filter.department && filter.department !== 'ALL') {
      const targetDept = filter.department.toLowerCase().trim();
      result = result.filter((l) => {
        if (l.department && l.department.toLowerCase() === targetDept) return true;
        if (l.entityType === 'DEPARTMENT' && (l.entityName.toLowerCase() === targetDept || l.entityId.toLowerCase() === targetDept)) return true;
        if (l.details && l.details.toLowerCase().includes(targetDept)) return true;
        if (l.summary && l.summary.toLowerCase().includes(targetDept)) return true;
        return false;
      });
    }

    if (filter.reportType && filter.reportType !== 'ALL') {
      const targetRep = filter.reportType.toLowerCase().trim();
      result = result.filter((l) => {
        if (l.reportKey && l.reportKey.toLowerCase() === targetRep) return true;
        if (l.entityType === 'REPORT_TYPE' && (l.entityId.toLowerCase() === targetRep || l.entityName.toLowerCase().includes(targetRep))) return true;
        if (l.details && l.details.toLowerCase().includes(targetRep)) return true;
        if (l.summary && l.summary.toLowerCase().includes(targetRep)) return true;
        return false;
      });
    }

    if (filter.userId && filter.userId !== 'ALL') {
      const targetUser = filter.userId.toLowerCase().trim();
      result = result.filter((l) => {
        if (l.userId && l.userId.toLowerCase() === targetUser) return true;
        if (l.actor && (l.actor.toLowerCase() === targetUser || l.actor.toLowerCase().includes(targetUser))) return true;
        if (l.details && l.details.toLowerCase().includes(targetUser)) return true;
        return false;
      });
    }

    if (filter.dateRange && filter.dateRange !== 'ALL') {
      const now = Date.now();
      if (filter.dateRange === 'TODAY') {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        result = result.filter((l) => new Date(l.timestamp).getTime() >= todayStart.getTime());
      } else if (filter.dateRange === '7_DAYS') {
        const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
        result = result.filter((l) => new Date(l.timestamp).getTime() >= sevenDaysAgo);
      } else if (filter.dateRange === '30_DAYS') {
        const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
        result = result.filter((l) => new Date(l.timestamp).getTime() >= thirtyDaysAgo);
      }
    }

    if (filter.startDate) {
      const startMs = new Date(filter.startDate).getTime();
      if (!isNaN(startMs)) {
        result = result.filter((l) => new Date(l.timestamp).getTime() >= startMs);
      }
    }

    if (filter.endDate) {
      const endMs = new Date(filter.endDate).getTime() + 86400000; // End of day
      if (!isNaN(endMs)) {
        result = result.filter((l) => new Date(l.timestamp).getTime() <= endMs);
      }
    }

    if (filter.search && filter.search.trim()) {
      const q = filter.search.toLowerCase().trim();
      result = result.filter(
        (l) =>
          l.entityName.toLowerCase().includes(q) ||
          l.entityId.toLowerCase().includes(q) ||
          l.actor.toLowerCase().includes(q) ||
          l.summary.toLowerCase().includes(q) ||
          (l.department && l.department.toLowerCase().includes(q)) ||
          (l.reportKey && l.reportKey.toLowerCase().includes(q)) ||
          (l.userId && l.userId.toLowerCase().includes(q)) ||
          (l.details && l.details.toLowerCase().includes(q))
      );
    }

    return JSON.parse(JSON.stringify(result));
  }

  public clearChangeLogs(): void {
    this.governanceLogs = [];
    this.saveToStorage();
  }

  // =========================================================================
  // DEPARTMENT READ OPERATIONS
  // =========================================================================

  /**
   * Returns a clean copy of all current department definitions
   */
  public getAll(): DepartmentDefinition[] {
    return JSON.parse(JSON.stringify(this.departments));
  }

  public getById(id: string): DepartmentDefinition | undefined {
    return this.departments.find((d) => d.id === id);
  }

  public getByName(name: string): DepartmentDefinition | undefined {
    const target = name.trim().toLowerCase();
    return this.departments.find((d) => d.name.trim().toLowerCase() === target);
  }

  public getByShortCode(code: string): DepartmentDefinition | undefined {
    const target = code.trim().toUpperCase();
    return this.departments.find((d) => d.shortCode.trim().toUpperCase() === target);
  }

  public getAllNames(): string[] {
    return this.departments.map((d) => d.name);
  }

  // =========================================================================
  // DEPARTMENT CRUD MUTATIONS
  // =========================================================================

  /**
   * Adds a new department to the bank structure with uniqueness validation
   */
  public addDepartment(
    deptData: DepartmentInput,
    adminName = 'Administrator'
  ): { success: boolean; department?: DepartmentDefinition; message?: string } {
    const trimmedName = deptData.name.trim();
    if (!trimmedName) {
      return { success: false, message: 'Department name is required.' };
    }

    if (this.getByName(trimmedName)) {
      return { success: false, message: `A department named "${trimmedName}" already exists.` };
    }

    const shortCode = (deptData.shortCode || trimmedName.substring(0, 4)).trim().toUpperCase();
    if (this.getByShortCode(shortCode)) {
      return { success: false, message: `Short code "${shortCode}" is already in use by another department.` };
    }

    const newDept: DepartmentDefinition = {
      id: `dept_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: trimmedName,
      shortCode,
      division: deptData.division?.trim() || 'General Operations Division',
      description: deptData.description?.trim() || `Operational department for ${trimmedName}.`,
      primaryResponsibilities: deptData.primaryResponsibilities || [
        `Regulatory return compilation for ${trimmedName}`,
        'Four-eyes operational review and supervisory compliance',
      ],
      reportKeys: Array.isArray(deptData.reportKeys) ? Array.from(new Set(deptData.reportKeys)) : [],
    };

    this.departments.push(newDept);
    this.saveToStorage();

    this.logChange({
      actor: adminName,
      actorRole: 'ADMIN',
      entityType: 'DEPARTMENT',
      entityId: newDept.id,
      entityName: newDept.name,
      action: 'CREATE',
      summary: `Created new department "${newDept.name}" (${newDept.shortCode})`,
      details: `Assigned to division "${newDept.division}" with ${newDept.reportKeys.length} linked report(s).`,
      newState: newDept,
    });

    auditService.log({
      actorId: 'usr_admin',
      actorName: adminName,
      actorRole: 'ADMIN',
      action: 'ADD_DEPARTMENT',
      entityType: 'DEPARTMENT',
      entityId: newDept.id,
      correlationId: `corr_dept_add_${newDept.id}`,
      details: `Created new department "${newDept.name}" (${newDept.shortCode}) with ${newDept.reportKeys.length} linked report(s).`,
      newState: newDept,
    });

    return { success: true, department: newDept, message: `Department "${trimmedName}" created successfully.` };
  }

  /**
   * Updates an existing department (name, code, division, description, responsibilities, or report linkages)
   * and propagates name changes throughout all users, submissions, and report linkages.
   */
  public updateDepartment(
    id: string,
    updates: DepartmentUpdateInput,
    adminName = 'Administrator'
  ): { success: boolean; department?: DepartmentDefinition; message?: string; oldName?: string } {
    const dept = this.departments.find((d) => d.id === id);
    if (!dept) {
      return { success: false, message: 'Department not found.' };
    }

    const oldName = dept.name;
    const oldState = { ...dept };
    const diff: Array<{ field: string; oldValue: any; newValue: any }> = [];

    if (updates.name && updates.name.trim() !== oldName) {
      const nextName = updates.name.trim();
      const duplicate = this.departments.find(
        (d) => d.id !== id && d.name.trim().toLowerCase() === nextName.toLowerCase()
      );
      if (duplicate) {
        return { success: false, message: `Another department named "${nextName}" already exists.` };
      }
      diff.push({ field: 'name', oldValue: oldName, newValue: nextName });
      dept.name = nextName;
    }

    if (updates.shortCode) {
      const nextCode = updates.shortCode.trim().toUpperCase();
      if (nextCode !== dept.shortCode) {
        const duplicateCode = this.departments.find(
          (d) => d.id !== id && d.shortCode.trim().toUpperCase() === nextCode
        );
        if (duplicateCode) {
          return { success: false, message: `Short code "${nextCode}" is already in use by "${duplicateCode.name}".` };
        }
        diff.push({ field: 'shortCode', oldValue: dept.shortCode, newValue: nextCode });
        dept.shortCode = nextCode;
      }
    }

    if (updates.division && updates.division.trim() !== dept.division) {
      diff.push({ field: 'division', oldValue: dept.division, newValue: updates.division.trim() });
      dept.division = updates.division.trim();
    }
    if (updates.description !== undefined && updates.description.trim() !== dept.description) {
      diff.push({ field: 'description', oldValue: dept.description, newValue: updates.description.trim() });
      dept.description = updates.description.trim();
    }
    if (Array.isArray(updates.primaryResponsibilities)) {
      dept.primaryResponsibilities = updates.primaryResponsibilities;
    }
    if (Array.isArray(updates.reportKeys)) {
      const oldKeys = dept.reportKeys.sort().join(', ');
      const newKeys = [...updates.reportKeys].sort().join(', ');
      if (oldKeys !== newKeys) {
        diff.push({ field: 'reportKeys', oldValue: dept.reportKeys, newValue: updates.reportKeys });
      }
      dept.reportKeys = Array.from(new Set(updates.reportKeys));
    }

    this.saveToStorage();

    // Propagate department name change globally
    if (oldName !== dept.name) {
      try {
        import('./userService.ts').then(({ userService }) => {
          userService.renameDepartment(oldName, dept.name);
        }).catch(() => {});
        import('./submissionService.ts').then(({ submissionService }) => {
          submissionService.renameDepartment(oldName, dept.name);
        }).catch(() => {});
        import('../data/report-registry.ts').then(({ renameDepartmentInReports }) => {
          renameDepartmentInReports(oldName, dept.name);
        }).catch(() => {});
      } catch {}
    }

    this.logChange({
      actor: adminName,
      actorRole: 'ADMIN',
      entityType: 'DEPARTMENT',
      entityId: dept.id,
      entityName: dept.name,
      action: oldName !== dept.name ? 'RENAME' : 'UPDATE',
      summary: oldName !== dept.name
        ? `Renamed department "${oldName}" to "${dept.name}"`
        : `Updated department metadata for "${dept.name}"`,
      diff: diff.length > 0 ? diff : undefined,
      oldState,
      newState: dept,
    });

    auditService.log({
      actorId: 'usr_admin',
      actorName: adminName,
      actorRole: 'ADMIN',
      action: 'UPDATE_DEPARTMENT',
      entityType: 'DEPARTMENT',
      entityId: dept.id,
      correlationId: `corr_dept_update_${dept.id}`,
      details: `Updated department "${oldName}" ${oldName !== dept.name ? `to "${dept.name}"` : ''} with ${dept.reportKeys.length} linked report(s).`,
      oldState,
      newState: dept,
    });

    return {
      success: true,
      department: dept,
      oldName: oldName !== dept.name ? oldName : undefined,
      message: `Department "${dept.name}" updated successfully.`,
    };
  }

  /**
   * Helper to rename a department by name
   */
  public renameDepartment(
    oldName: string,
    newName: string,
    adminName = 'Administrator'
  ): { success: boolean; department?: DepartmentDefinition; message?: string } {
    const dept = this.getByName(oldName);
    if (!dept) {
      return { success: false, message: `Department "${oldName}" not found.` };
    }
    return this.updateDepartment(dept.id, { name: newName }, adminName);
  }

  /**
   * Removes a department from the bank structure gently and gracefully.
   * If officers currently belong to it, reassigns them to the fallback department.
   */
  public removeDepartment(
    id: string,
    fallbackDepartmentName?: string,
    adminName = 'Administrator'
  ): {
    success: boolean;
    removedDepartment?: DepartmentDefinition;
    fallbackDepartment?: string;
    message?: string;
  } {
    if (this.departments.length <= 1) {
      return { success: false, message: 'Cannot remove the last remaining department in the institution.' };
    }

    const index = this.departments.findIndex((d) => d.id === id);
    if (index === -1) {
      return { success: false, message: 'Department not found.' };
    }

    const removed = this.departments[index];

    // Determine safe fallback department
    const remainingDepts = this.departments.filter((d) => d.id !== id);
    const resolvedFallback =
      fallbackDepartmentName && remainingDepts.some((d) => d.name === fallbackDepartmentName)
        ? fallbackDepartmentName
        : remainingDepts[0].name;

    this.departments.splice(index, 1);
    this.saveToStorage();

    try {
      import('./userService.ts').then(({ userService }) => {
        userService.reassignDepartmentUsers(removed.name, resolvedFallback);
      }).catch(() => {});
      import('./submissionService.ts').then(({ submissionService }) => {
        submissionService.reassignDepartment(removed.name, resolvedFallback);
      }).catch(() => {});
      import('../data/report-registry.ts').then(({ reassignDepartmentInReports }) => {
        reassignDepartmentInReports(removed.name, resolvedFallback);
      }).catch(() => {});
    } catch {}

    this.logChange({
      actor: adminName,
      actorRole: 'ADMIN',
      entityType: 'DEPARTMENT',
      entityId: removed.id,
      entityName: removed.name,
      action: 'DELETE',
      summary: `Removed department "${removed.name}" from organizational hierarchy`,
      details: `Reassigned existing officers and return linkages to fallback department "${resolvedFallback}".`,
      oldState: removed,
    });

    auditService.log({
      actorId: 'usr_admin',
      actorName: adminName,
      actorRole: 'ADMIN',
      action: 'REMOVE_DEPARTMENT',
      entityType: 'DEPARTMENT',
      entityId: removed.id,
      correlationId: `corr_dept_rem_${removed.id}`,
      details: `Removed department "${removed.name}". Active officers/reports reassigned to "${resolvedFallback}".`,
      oldState: removed,
    });

    return {
      success: true,
      removedDepartment: removed,
      fallbackDepartment: resolvedFallback,
      message: `Department "${removed.name}" removed successfully. Associated records reassigned to "${resolvedFallback}".`,
    };
  }

  /**
   * Helper to delete a department by its name
   */
  public deleteDepartmentByName(
    name: string,
    fallbackDepartmentName?: string,
    adminName = 'Administrator'
  ) {
    const dept = this.getByName(name);
    if (!dept) {
      return { success: false, message: `Department "${name}" not found.` };
    }
    return this.removeDepartment(dept.id, fallbackDepartmentName, adminName);
  }

  // =========================================================================
  // REPORT LINKAGE & ASSIGNMENT OPERATIONS
  // =========================================================================

  /**
   * Returns all report keys mapped to a specific department (including multi-linked reports)
   */
  public getReportsForDepartment(departmentName: string): string[] {
    const target = departmentName.trim().toLowerCase();
    const dept = this.departments.find((d) => d.name.trim().toLowerCase() === target);
    return dept ? [...dept.reportKeys] : [];
  }

  /**
   * Returns all departments that are linked to a specific reportKey (M:N relationship)
   */
  public getDepartmentsForReport(reportKey: string): string[] {
    const normKey = reportKey.trim().toUpperCase();
    const matched = this.departments.filter((d) =>
      d.reportKeys.some((k) => k.trim().toUpperCase() === normKey)
    );
    if (matched.length > 0) {
      return matched.map((d) => d.name);
    }
    return ['Credit Operations & Portfolio Management'];
  }

  /**
   * Sets the complete linkage between a reportKey and multiple departments
   */
  public setReportDepartments(reportKey: string, departmentNames: string[]): void {
    const normKey = reportKey.trim().toUpperCase();
    const selectedSet = new Set(departmentNames.map((n) => n.trim().toLowerCase()));

    for (const dept of this.departments) {
      const isSelected = selectedSet.has(dept.name.trim().toLowerCase());
      const hasKey = dept.reportKeys.some((k) => k.trim().toUpperCase() === normKey);

      if (isSelected && !hasKey) {
        dept.reportKeys.push(reportKey);
      } else if (!isSelected && hasKey) {
        dept.reportKeys = dept.reportKeys.filter((k) => k.trim().toUpperCase() !== normKey);
      }
    }

    this.saveToStorage();
  }

  /**
   * Updates report linkages for a single department
   */
  public setDepartmentReports(departmentId: string, reportKeys: string[]): boolean {
    const dept = this.departments.find((d) => d.id === departmentId);
    if (!dept) return false;

    const oldKeys = [...dept.reportKeys];
    dept.reportKeys = Array.from(new Set(reportKeys));
    this.saveToStorage();

    this.logChange({
      actor: 'Administrator',
      actorRole: 'ADMIN',
      entityType: 'LINKAGE',
      entityId: dept.id,
      entityName: dept.name,
      action: 'LINK_REPORTS',
      summary: `Updated return authorizations for department "${dept.name}" (${dept.reportKeys.length} linked)`,
      details: `Active linked keys: ${dept.reportKeys.join(', ') || 'None'}`,
      diff: [{ field: 'reportKeys', oldValue: oldKeys, newValue: dept.reportKeys }],
    });

    return true;
  }

  /**
   * Links a single report to a department
   */
  public linkReportToDepartment(reportKey: string, departmentName: string): boolean {
    const dept = this.getByName(departmentName);
    if (!dept) return false;
    const normKey = reportKey.trim().toUpperCase();
    if (!dept.reportKeys.some((k) => k.toUpperCase() === normKey)) {
      dept.reportKeys.push(reportKey);
      this.saveToStorage();
      this.logChange({
        actor: 'Administrator',
        actorRole: 'ADMIN',
        entityType: 'LINKAGE',
        entityId: dept.id,
        entityName: dept.name,
        action: 'LINK_REPORTS',
        summary: `Authorized report "${normKey}" for department "${dept.name}"`,
      });
    }
    return true;
  }

  /**
   * Unlinks a single report from a department
   */
  public unlinkReportFromDepartment(reportKey: string, departmentName: string): boolean {
    const dept = this.getByName(departmentName);
    if (!dept) return false;
    const normKey = reportKey.trim().toUpperCase();
    dept.reportKeys = dept.reportKeys.filter((k) => k.toUpperCase() !== normKey);
    this.saveToStorage();
    this.logChange({
      actor: 'Administrator',
      actorRole: 'ADMIN',
      entityType: 'LINKAGE',
      entityId: dept.id,
      entityName: dept.name,
      action: 'LINK_REPORTS',
      summary: `Unlinked report "${normKey}" from department "${dept.name}"`,
    });
    return true;
  }

  // =========================================================================
  // REPORT VERSION HISTORY TRACKING SYSTEM
  // =========================================================================

  /**
   * Retrieves full version history audit trail for a specific report return key
   */
  public getReportVersionHistory(reportKey: string): ReportVersionRecord[] {
    const normKey = reportKey.trim().toUpperCase();
    const history = this.reportVersions[normKey] || [];
    return JSON.parse(JSON.stringify(history));
  }

  /**
   * Retrieves all report version records across all report templates
   */
  public getAllReportVersionHistories(): Record<string, ReportVersionRecord[]> {
    return JSON.parse(JSON.stringify(this.reportVersions));
  }

  /**
   * Records a new immutable version record for a report return template
   */
  public recordReportVersion(
    reportKey: string,
    changeType: ReportChangeType,
    changedBy: string,
    changeSummary: string,
    currentSnapshot: ReportMetadata,
    previousSnapshot?: Partial<ReportMetadata>
  ): ReportVersionRecord {
    const normKey = reportKey.trim().toUpperCase();
    if (!this.reportVersions[normKey]) {
      this.reportVersions[normKey] = [];
    }

    const currentHistory = this.reportVersions[normKey];
    const versionNumber = currentHistory.length + 1;

    // Calculate field-by-field diff
    const diff: ReportVersionDiff[] = [];
    if (previousSnapshot) {
      const compareKeys: Array<keyof ReportMetadata> = [
        'Title',
        'Code',
        'Category',
        'Frequency',
        'Description',
        'department',
      ];
      compareKeys.forEach((k) => {
        if (previousSnapshot[k] !== undefined && (currentSnapshot as any)[k] !== previousSnapshot[k]) {
          diff.push({
            field: String(k),
            oldValue: previousSnapshot[k],
            newValue: (currentSnapshot as any)[k],
          });
        }
      });

      if (previousSnapshot.departments && currentSnapshot.departments) {
        const oldDepts = [...previousSnapshot.departments].sort().join(', ');
        const newDepts = [...currentSnapshot.departments].sort().join(', ');
        if (oldDepts !== newDepts) {
          diff.push({
            field: 'departments',
            oldValue: previousSnapshot.departments,
            newValue: currentSnapshot.departments,
          });
        }
      }
    }

    const linkedDepts = currentSnapshot.departments && currentSnapshot.departments.length > 0
      ? currentSnapshot.departments
      : currentSnapshot.department
      ? [currentSnapshot.department]
      : this.getDepartmentsForReport(normKey);

    const versionRecord: ReportVersionRecord = {
      versionId: `ver_${normKey}_v${versionNumber}_${Date.now()}`,
      versionNumber,
      reportKey: normKey,
      timestamp: new Date().toISOString(),
      changedBy: changedBy || 'Administrator',
      changeType,
      changeSummary: changeSummary || `Version ${versionNumber} (${changeType})`,
      snapshot: {
        ReturnKey: currentSnapshot.ReturnKey,
        Code: currentSnapshot.Code || currentSnapshot.ReturnKey,
        Title: currentSnapshot.Title,
        Category: currentSnapshot.Category,
        Frequency: currentSnapshot.Frequency,
        Description: currentSnapshot.Description,
        departments: linkedDepts,
        department: linkedDepts[0] || 'Credit Operations & Portfolio Management',
        itemCount: currentSnapshot.ReturnItemsList?.length || 0,
        formulaCount: currentSnapshot.Formulas?.length || 0,
        validationRuleCount: currentSnapshot.ValidationRules?.length || 0,
        isCustom: currentSnapshot.isCustom,
      },
      previousSnapshot: previousSnapshot
        ? {
            Title: previousSnapshot.Title,
            Code: previousSnapshot.Code,
            Category: previousSnapshot.Category,
            Frequency: previousSnapshot.Frequency,
            Description: previousSnapshot.Description,
            departments: previousSnapshot.departments,
            department: previousSnapshot.department,
          }
        : undefined,
      diff: diff.length > 0 ? diff : undefined,
    };

    currentHistory.unshift(versionRecord); // Latest version first
    this.saveToStorage();

    // Also log into centralized governance audit logs
    this.logChange({
      actor: changedBy || 'Administrator',
      actorRole: 'ADMIN',
      entityType: 'REPORT_TYPE',
      entityId: normKey,
      entityName: currentSnapshot.Title,
      action: changeType === 'CREATED' ? 'CREATE' : changeType === 'RENAMED' ? 'RENAME' : changeType === 'DECOMMISSIONED' ? 'DELETE' : 'UPDATE',
      summary: `v${versionNumber}: ${changeSummary}`,
      details: `Category: ${currentSnapshot.Category}, Frequency: ${currentSnapshot.Frequency}, Linked Depts: ${linkedDepts.join(', ')}`,
      diff: diff.length > 0 ? diff : undefined,
      oldState: previousSnapshot,
      newState: versionRecord.snapshot,
    });

    auditService.log({
      actorId: 'usr_admin',
      actorName: changedBy || 'Administrator',
      actorRole: 'ADMIN',
      action: 'RECORD_REPORT_VERSION',
      entityType: 'REPORT_VERSION',
      entityId: versionRecord.versionId,
      correlationId: `corr_ver_${normKey}_${versionNumber}`,
      details: `Logged Version ${versionNumber} for report template ${normKey}: ${changeSummary}`,
      newState: versionRecord,
    });

    return versionRecord;
  }

  /**
   * Restores a report template to a previous version snapshot
   */
  public async restoreReportVersion(
    reportKey: string,
    versionId: string,
    adminName = 'Administrator'
  ): Promise<{ success: boolean; message: string; report?: ReportMetadata }> {
    const normKey = reportKey.trim().toUpperCase();
    const history = this.reportVersions[normKey] || [];
    const targetVersion = history.find((v) => v.versionId === versionId);

    if (!targetVersion) {
      return { success: false, message: `Version ${versionId} not found for report ${normKey}.` };
    }

    const { updateReportType: registryUpdateReportType, getReportByKey } = await import('../data/report-registry.ts');
    const existing = getReportByKey(normKey);
    const prevSnapshot = existing ? { ...existing } : undefined;

    const result = registryUpdateReportType(normKey, {
      Title: targetVersion.snapshot.Title,
      Category: targetVersion.snapshot.Category as any,
      Frequency: targetVersion.snapshot.Frequency as any,
      Description: targetVersion.snapshot.Description,
      departments: targetVersion.snapshot.departments,
      department: targetVersion.snapshot.department,
    });

    if (result.success && result.report) {
      this.recordReportVersion(
        normKey,
        'RESTORED',
        adminName,
        `Restored to Version ${targetVersion.versionNumber} (originally created ${new Date(targetVersion.timestamp).toLocaleString()})`,
        result.report,
        prevSnapshot
      );

      this.logChange({
        actor: adminName,
        actorRole: 'ADMIN',
        entityType: 'REPORT_TYPE',
        entityId: normKey,
        entityName: targetVersion.snapshot.Title,
        action: 'RESTORE',
        summary: `Restored report template ${normKey} to Version ${targetVersion.versionNumber}`,
        details: `Snapshot restored from ${new Date(targetVersion.timestamp).toLocaleString()}`,
        newState: result.report,
      });

      auditService.log({
        actorId: 'usr_admin',
        actorName: adminName,
        actorRole: 'ADMIN',
        action: 'RESTORE_REPORT_VERSION',
        entityType: 'REPORT_VERSION',
        entityId: targetVersion.versionId,
        correlationId: `corr_restore_${normKey}_${Date.now()}`,
        details: `Restored report template ${normKey} to snapshot Version ${targetVersion.versionNumber}`,
      });

      return {
        success: true,
        message: `Successfully rolled back ${normKey} to Version ${targetVersion.versionNumber}.`,
        report: result.report,
      };
    }

    return { success: false, message: result.message || 'Failed to rollback report version.' };
  }

  /**
   * Clears version history for a report or all reports
   */
  public clearReportVersionHistory(reportKey?: string): void {
    if (reportKey) {
      const norm = reportKey.trim().toUpperCase();
      delete this.reportVersions[norm];
    } else {
      this.reportVersions = {};
    }
    this.saveToStorage();
  }

  // =========================================================================
  // BULK IMPORT PARSERS & IMPORTERS (CSV & JSON)
  // =========================================================================

  /**
   * Parses CSV or JSON text into DepartmentInput array
   */
  public parseDepartmentsPayload(rawText: string, format: 'CSV' | 'JSON'): {
    success: boolean;
    data: DepartmentInput[];
    errors: string[];
  } {
    const trimmed = rawText.trim();
    if (!trimmed) {
      return { success: false, data: [], errors: ['Payload text is empty.'] };
    }

    if (format === 'JSON') {
      try {
        const parsed = JSON.parse(trimmed);
        const list = Array.isArray(parsed) ? parsed : [parsed];
        const data: DepartmentInput[] = [];
        const errors: string[] = [];

        list.forEach((item, index) => {
          if (!item.name || typeof item.name !== 'string') {
            errors.push(`Row ${index + 1}: Missing 'name' field.`);
            return;
          }
          data.push({
            name: item.name.trim(),
            shortCode: (item.shortCode || item.name.substring(0, 4)).trim().toUpperCase(),
            division: (item.division || 'General Operations Division').trim(),
            description: item.description?.trim() || '',
            primaryResponsibilities: Array.isArray(item.primaryResponsibilities)
              ? item.primaryResponsibilities
              : item.primaryResponsibilities
              ? String(item.primaryResponsibilities).split(';').map((s: string) => s.trim()).filter(Boolean)
              : [],
            reportKeys: Array.isArray(item.reportKeys)
              ? item.reportKeys
              : item.reportKeys
              ? String(item.reportKeys).split(';').map((s: string) => s.trim().toUpperCase()).filter(Boolean)
              : [],
          });
        });

        return { success: errors.length === 0, data, errors };
      } catch (err: any) {
        return { success: false, data: [], errors: [`Invalid JSON: ${err.message}`] };
      }
    }

    // CSV Parsing
    try {
      const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) {
        return { success: false, data: [], errors: ['CSV must have a header row and at least one data row.'] };
      }

      const header = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));
      const nameIdx = header.findIndex((h) => h.includes('name') || h.includes('department'));
      const codeIdx = header.findIndex((h) => h.includes('code') || h.includes('short'));
      const divIdx = header.findIndex((h) => h.includes('div') || h.includes('directorate'));
      const descIdx = header.findIndex((h) => h.includes('desc') || h.includes('mandate'));
      const reportsIdx = header.findIndex((h) => h.includes('report') || h.includes('return'));

      if (nameIdx === -1) {
        return { success: false, data: [], errors: ["CSV header must include a 'Name' or 'Department' column."] };
      }

      const data: DepartmentInput[] = [];
      const errors: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const rowLine = lines[i];
        const matchRegex = /(?:,|\n|^)("(?:(?:"")*[^"]*)*"|[^",\n]*|(?:\n|$))/g;
        const columns: string[] = [];
        let match;
        while ((match = matchRegex.exec(rowLine)) !== null) {
          let col = match[1] || '';
          if (col.startsWith('"') && col.endsWith('"')) {
            col = col.substring(1, col.length - 1).replace(/""/g, '"');
          }
          columns.push(col.trim());
          if (matchRegex.lastIndex >= rowLine.length) break;
        }

        const name = columns[nameIdx]?.trim();
        if (!name) {
          errors.push(`Line ${i + 1}: Department name is blank.`);
          continue;
        }

        const shortCode = (codeIdx !== -1 && columns[codeIdx] ? columns[codeIdx] : name.substring(0, 4))
          .trim()
          .toUpperCase();
        const division = (divIdx !== -1 && columns[divIdx] ? columns[divIdx] : 'Credit Business & Operations Division').trim();
        const description = (descIdx !== -1 && columns[descIdx] ? columns[descIdx] : `Operational department for ${name}`).trim();
        const reportKeys = (reportsIdx !== -1 && columns[reportsIdx]
          ? columns[reportsIdx].split(';').map((s) => s.trim().toUpperCase()).filter(Boolean)
          : []);

        data.push({
          name,
          shortCode,
          division,
          description,
          reportKeys,
        });
      }

      return { success: errors.length === 0, data, errors };
    } catch (err: any) {
      return { success: false, data: [], errors: [`CSV Parse Error: ${err.message}`] };
    }
  }

  /**
   * Bulk Imports departments with conflict resolution strategy
   */
  public bulkImportDepartments(
    departmentsList: DepartmentInput[],
    options: { conflictMode: 'SKIP' | 'UPDATE' } = { conflictMode: 'UPDATE' },
    adminName = 'Administrator'
  ): BulkImportResult<DepartmentDefinition> {
    let importedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const errors: Array<{ row: number; identifier: string; error: string }> = [];
    const results: DepartmentDefinition[] = [];

    departmentsList.forEach((input, index) => {
      const trimmedName = input.name.trim();
      const existing = this.getByName(trimmedName);

      if (existing) {
        if (options.conflictMode === 'SKIP') {
          skippedCount++;
          results.push(existing);
          return;
        }

        // UPDATE mode
        const updateRes = this.updateDepartment(
          existing.id,
          {
            shortCode: input.shortCode,
            division: input.division,
            description: input.description,
            reportKeys: input.reportKeys && input.reportKeys.length > 0 ? input.reportKeys : existing.reportKeys,
          },
          adminName
        );

        if (updateRes.success && updateRes.department) {
          updatedCount++;
          results.push(updateRes.department);
        } else {
          errors.push({
            row: index + 1,
            identifier: trimmedName,
            error: updateRes.message || 'Failed to update existing department.',
          });
        }
      } else {
        // ADD mode
        const addRes = this.addDepartment(input, adminName);
        if (addRes.success && addRes.department) {
          importedCount++;
          results.push(addRes.department);
        } else {
          errors.push({
            row: index + 1,
            identifier: trimmedName,
            error: addRes.message || 'Failed to add department.',
          });
        }
      }
    });

    this.logChange({
      actor: adminName,
      actorRole: 'ADMIN',
      entityType: 'DEPARTMENT',
      entityId: `bulk_${Date.now()}`,
      entityName: 'Bulk Department Import',
      action: 'BULK_IMPORT',
      summary: `Bulk imported ${departmentsList.length} departments (${importedCount} added, ${updatedCount} updated, ${skippedCount} skipped)`,
      details: `Mode: ${options.conflictMode}`,
    });

    auditService.log({
      actorId: 'usr_admin',
      actorName: adminName,
      actorRole: 'ADMIN',
      action: 'BULK_IMPORT_DEPARTMENTS',
      entityType: 'DEPARTMENT',
      entityId: `bulk_dept_${Date.now()}`,
      correlationId: `corr_bulk_dept_${Date.now()}`,
      details: `Bulk imported departments: ${importedCount} created, ${updatedCount} updated, ${skippedCount} skipped, ${errors.length} failed.`,
    });

    return {
      success: errors.length === 0,
      totalParsed: departmentsList.length,
      importedCount,
      updatedCount,
      skippedCount,
      errors,
      items: results,
      message: `Bulk import completed: ${importedCount} created, ${updatedCount} updated, ${skippedCount} skipped.`,
    };
  }

  /**
   * Parses CSV or JSON text into ReportTypeInput array
   */
  public parseReportTypesPayload(rawText: string, format: 'CSV' | 'JSON'): {
    success: boolean;
    data: ReportTypeInput[];
    errors: string[];
  } {
    const trimmed = rawText.trim();
    if (!trimmed) {
      return { success: false, data: [], errors: ['Payload text is empty.'] };
    }

    if (format === 'JSON') {
      try {
        const parsed = JSON.parse(trimmed);
        const list = Array.isArray(parsed) ? parsed : [parsed];
        const data: ReportTypeInput[] = [];
        const errors: string[] = [];

        list.forEach((item, index) => {
          if (!item.ReturnKey || typeof item.ReturnKey !== 'string') {
            errors.push(`Row ${index + 1}: Missing 'ReturnKey' field.`);
            return;
          }
          if (!item.Title || typeof item.Title !== 'string') {
            errors.push(`Row ${index + 1}: Missing 'Title' field.`);
            return;
          }

          const depts = Array.isArray(item.departments)
            ? item.departments
            : item.department
            ? [item.department]
            : item.departments
            ? String(item.departments).split(';').map((s: string) => s.trim()).filter(Boolean)
            : ['Credit Operations & Portfolio Management'];

          data.push({
            ReturnKey: item.ReturnKey.trim().toUpperCase(),
            Code: (item.Code || item.ReturnKey).trim().toUpperCase(),
            Title: item.Title.trim(),
            Category: item.Category || 'Credit & Lending',
            Frequency: item.Frequency || 'MONTHLY',
            Description: item.Description?.trim() || `Mandatory return for ${item.Title}`,
            departments: depts,
            department: depts[0],
            initialFieldsCount: item.initialFieldsCount || 4,
          });
        });

        return { success: errors.length === 0, data, errors };
      } catch (err: any) {
        return { success: false, data: [], errors: [`Invalid JSON: ${err.message}`] };
      }
    }

    // CSV Parsing for Reports
    try {
      const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) {
        return { success: false, data: [], errors: ['CSV must have a header row and at least one data row.'] };
      }

      const header = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));
      const keyIdx = header.findIndex((h) => h.includes('key') || h.includes('returnkey') || h.includes('code'));
      const titleIdx = header.findIndex((h) => h.includes('title') || h.includes('name'));
      const catIdx = header.findIndex((h) => h.includes('cat') || h.includes('type'));
      const freqIdx = header.findIndex((h) => h.includes('freq') || h.includes('period'));
      const descIdx = header.findIndex((h) => h.includes('desc') || h.includes('directive'));
      const deptsIdx = header.findIndex((h) => h.includes('dept') || h.includes('department'));

      if (keyIdx === -1 || titleIdx === -1) {
        return { success: false, data: [], errors: ["CSV header must include 'ReturnKey' and 'Title' columns."] };
      }

      const data: ReportTypeInput[] = [];
      const errors: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const rowLine = lines[i];
        const matchRegex = /(?:,|\n|^)("(?:(?:"")*[^"]*)*"|[^",\n]*|(?:\n|$))/g;
        const columns: string[] = [];
        let match;
        while ((match = matchRegex.exec(rowLine)) !== null) {
          let col = match[1] || '';
          if (col.startsWith('"') && col.endsWith('"')) {
            col = col.substring(1, col.length - 1).replace(/""/g, '"');
          }
          columns.push(col.trim());
          if (matchRegex.lastIndex >= rowLine.length) break;
        }

        const returnKey = columns[keyIdx]?.trim().toUpperCase();
        const title = columns[titleIdx]?.trim();

        if (!returnKey || !title) {
          errors.push(`Line ${i + 1}: ReturnKey and Title are required.`);
          continue;
        }

        const category = (catIdx !== -1 && columns[catIdx] ? columns[catIdx] : 'Credit & Lending') as any;
        const frequency = (freqIdx !== -1 && columns[freqIdx] ? columns[freqIdx].toUpperCase() : 'MONTHLY') as any;
        const description = (descIdx !== -1 && columns[descIdx] ? columns[descIdx] : `Mandatory return for ${title}`).trim();
        const depts = (deptsIdx !== -1 && columns[deptsIdx]
          ? columns[deptsIdx].split(';').map((s) => s.trim()).filter(Boolean)
          : ['Credit Operations & Portfolio Management']);

        data.push({
          ReturnKey: returnKey,
          Code: returnKey,
          Title: title,
          Category: category,
          Frequency: frequency,
          Description: description,
          departments: depts,
          department: depts[0],
          initialFieldsCount: 4,
        });
      }

      return { success: errors.length === 0, data, errors };
    } catch (err: any) {
      return { success: false, data: [], errors: [`CSV Parse Error: ${err.message}`] };
    }
  }

  /**
   * Bulk Imports report types with version logging and conflict resolution
   */
  public async bulkImportReportTypes(
    reportsList: ReportTypeInput[],
    options: { conflictMode: 'SKIP' | 'UPDATE' } = { conflictMode: 'UPDATE' },
    adminName = 'Administrator'
  ): Promise<BulkImportResult<ReportMetadata>> {
    const {
      addReportType: registryAdd,
      updateReportType: registryUpdate,
      getReportByKey,
    } = await import('../data/report-registry.ts');

    let importedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const errors: Array<{ row: number; identifier: string; error: string }> = [];
    const results: ReportMetadata[] = [];

    for (let i = 0; i < reportsList.length; i++) {
      const input = reportsList[i];
      const normKey = input.ReturnKey.trim().toUpperCase();
      const existing = getReportByKey(normKey);

      if (existing) {
        if (options.conflictMode === 'SKIP') {
          skippedCount++;
          results.push(existing);
          continue;
        }

        const prevSnapshot = { ...existing };
        const updateRes = registryUpdate(normKey, {
          Title: input.Title.trim(),
          Category: input.Category,
          Frequency: input.Frequency,
          Description: input.Description,
          departments: input.departments,
          department: input.department || (input.departments && input.departments[0]),
        });

        if (updateRes.success && updateRes.report) {
          updatedCount++;
          results.push(updateRes.report);
          this.recordReportVersion(
            normKey,
            'BULK_IMPORTED',
            adminName,
            `Bulk import updated report template`,
            updateRes.report,
            prevSnapshot
          );
        } else {
          errors.push({
            row: i + 1,
            identifier: normKey,
            error: updateRes.message || 'Failed to update report template.',
          });
        }
      } else {
        // Add new
        const addRes = registryAdd(input as any, adminName);
        if (addRes.success && addRes.report) {
          importedCount++;
          results.push(addRes.report);
          this.recordReportVersion(
            normKey,
            'CREATED',
            adminName,
            `Bulk import registered new report template`,
            addRes.report
          );
        } else {
          errors.push({
            row: i + 1,
            identifier: normKey,
            error: addRes.message || 'Failed to add report template.',
          });
        }
      }
    }

    this.logChange({
      actor: adminName,
      actorRole: 'ADMIN',
      entityType: 'REPORT_TYPE',
      entityId: `bulk_rep_${Date.now()}`,
      entityName: 'Bulk Report Types Import',
      action: 'BULK_IMPORT',
      summary: `Bulk imported ${reportsList.length} report types (${importedCount} added, ${updatedCount} updated, ${skippedCount} skipped)`,
      details: `Mode: ${options.conflictMode}`,
    });

    auditService.log({
      actorId: 'usr_admin',
      actorName: adminName,
      actorRole: 'ADMIN',
      action: 'BULK_IMPORT_REPORTS',
      entityType: 'REPORT_TYPE',
      entityId: `bulk_rep_${Date.now()}`,
      correlationId: `corr_bulk_rep_${Date.now()}`,
      details: `Bulk imported report types: ${importedCount} created, ${updatedCount} updated, ${skippedCount} skipped, ${errors.length} failed.`,
    });

    return {
      success: errors.length === 0,
      totalParsed: reportsList.length,
      importedCount,
      updatedCount,
      skippedCount,
      errors,
      items: results,
      message: `Bulk import completed: ${importedCount} created, ${updatedCount} updated, ${skippedCount} skipped.`,
    };
  }

  /**
   * Reset to initial bank hierarchy if needed
   */
  public resetToDefault(): void {
    this.departments = JSON.parse(JSON.stringify(OROMIA_BANK_DEPARTMENTS));
    this.saveToStorage();
  }
}

export const departmentService = new DepartmentServiceClass();

// =========================================================================
// FUNCTIONAL EXPORTS FOR CONVENIENCE
// =========================================================================

export const getAllDepartments = () => departmentService.getAll();
export const getDepartmentById = (id: string) => departmentService.getById(id);
export const getDepartmentByName = (name: string) => departmentService.getByName(name);
export const getDepartmentByShortCode = (code: string) => departmentService.getByShortCode(code);
export const getAllDepartmentNames = () => departmentService.getAllNames();

export const addDepartment = (deptData: DepartmentInput, adminName?: string) =>
  departmentService.addDepartment(deptData, adminName);
export const updateDepartment = (id: string, updates: DepartmentUpdateInput, adminName?: string) =>
  departmentService.updateDepartment(id, updates, adminName);
export const renameDepartment = (oldName: string, newName: string, adminName?: string) =>
  departmentService.renameDepartment(oldName, newName, adminName);
export const removeDepartment = (id: string, fallbackDept?: string, adminName?: string) =>
  departmentService.removeDepartment(id, fallbackDept, adminName);
export const deleteDepartmentByName = (name: string, fallbackDept?: string, adminName?: string) =>
  departmentService.deleteDepartmentByName(name, fallbackDept, adminName);

export const getReportsForDepartment = (deptName: string) =>
  departmentService.getReportsForDepartment(deptName);
export const getDepartmentsForReport = (reportKey: string) =>
  departmentService.getDepartmentsForReport(reportKey);
export const setReportDepartments = (reportKey: string, depts: string[]) =>
  departmentService.setReportDepartments(reportKey, depts);
export const linkReportToDepartment = (reportKey: string, deptName: string) =>
  departmentService.linkReportToDepartment(reportKey, deptName);
export const unlinkReportFromDepartment = (reportKey: string, deptName: string) =>
  departmentService.unlinkReportFromDepartment(reportKey, deptName);

export const getReportVersionHistory = (reportKey: string) =>
  departmentService.getReportVersionHistory(reportKey);
export const getAllReportVersionHistories = () =>
  departmentService.getAllReportVersionHistories();
export const recordReportVersion = (
  reportKey: string,
  changeType: ReportChangeType,
  changedBy: string,
  changeSummary: string,
  currentSnapshot: ReportMetadata,
  previousSnapshot?: Partial<ReportMetadata>
) =>
  departmentService.recordReportVersion(
    reportKey,
    changeType,
    changedBy,
    changeSummary,
    currentSnapshot,
    previousSnapshot
  );
export const restoreReportVersion = (reportKey: string, versionId: string, adminName?: string) =>
  departmentService.restoreReportVersion(reportKey, versionId, adminName);
export const bulkImportDepartments = (
  departmentsList: DepartmentInput[],
  options?: { conflictMode: 'SKIP' | 'UPDATE' },
  adminName?: string
) => departmentService.bulkImportDepartments(departmentsList, options, adminName);
export const bulkImportReportTypes = (
  reportsList: ReportTypeInput[],
  options?: { conflictMode: 'SKIP' | 'UPDATE' },
  adminName?: string
) => departmentService.bulkImportReportTypes(reportsList, options, adminName);

export const getChangeLogs = (filter?: { entityType?: GovernanceEntityType; action?: string; search?: string }) =>
  departmentService.getChangeLogs(filter);
export const subscribeChangeLogs = (listener: GovernanceLogsChangeListener) =>
  departmentService.subscribeChangeLogs(listener);
export const clearChangeLogs = () => departmentService.clearChangeLogs();
