/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  ReportSubmission,
  SubmissionStatus,
  UserSession,
  DynamicRowRecord,
  ReportMetadata,
  ReportItemDefinition,
  DynamicAreaDefinition,
  DynamicColumnDefinition,
  SubmissionSnapshot,
  LibraryFilterOptions,
  LibraryQueryResult,
  LibraryLifecycleState,
  RemovalImpactAssessment,
  GovernedRemovalResult,
} from '../types/regulatory.ts';
import {
  deriveLibraryLifecycleState,
  isFinalSubmittedStatus,
} from '../types/regulatory.ts';
import { getReportByKey } from '../data/report-registry.ts';
import { getDepartmentForReport } from '../data/organizationHierarchy.ts';
import { WorkflowEngine } from './workflowEngine.ts';
import { FormulaEngine } from '../utils/formulaEngine.ts';
import { ValidationEngine } from '../utils/validationEngine.ts';
import type { ValidationSummary } from '../utils/validationEngine.ts';
import { ValidationRemediationService } from './validationRemediationService.ts';
import type { NormalizedValidationSummary, ProposedFix } from '../types/remediation.ts';
import { nbeAdapter } from './nbeAdapter.ts';
import type { DeliveryResult } from './nbeAdapter.ts';
import { auditService } from './auditService.ts';
import { userService } from './userService.ts';
import { departmentService } from './departmentService.ts';
import { configService } from './configService.ts';
import { indexedDbStorage } from './indexedDbStorage.ts';
import { effectiveAccessEngine } from './effectiveAccessEngine.ts';
import { realtimeSsotEngine } from './realtimeSsotEngine.ts';
import { BrowserSafeEventEmitter } from '../utils/browserEventEmitter.ts';

// Default Demo User Accounts with verified Oromia Bank departments
export const DEMO_USERS: UserSession[] = [
  {
    id: 'usr_maker_1',
    name: 'Abebe Kebede',
    email: 'abebe.kebede@oromiabank.com',
    role: 'MAKER',
    institutionCode: '0000013',
    department: 'Credit Operations & Portfolio Management',
    employeeId: 'OB-MKR-104',
    specialAccessGrants: [],
  },
  {
    id: 'usr_checker_1',
    name: 'Chala Desta',
    email: 'chala.desta@oromiabank.com',
    role: 'CHECKER',
    institutionCode: '0000013',
    department: 'Credit Operations & Portfolio Management',
    employeeId: 'OB-CHK-055',
    specialAccessGrants: [],
  },
  {
    id: 'usr_maker_2',
    name: 'Tigist Alemu',
    email: 'tigist.alemu@oromiabank.com',
    role: 'MAKER',
    institutionCode: '0000013',
    department: 'Trade Services & International Banking',
    employeeId: 'OB-MKR-219',
    specialAccessGrants: [
      {
        id: 'grant_demo_1',
        reportKey: 'DigitalLendingDL001',
        department: 'Digital Banking & Fintech Operations',
        grantedBy: 'Dawit Bekele (ADMIN)',
        grantedAt: '2026-03-01T10:00:00Z',
        reason: 'Temporary delegation for Fintech & Digital Trade micro-lending returns (Approved by VP Operations).',
      },
    ],
  },
  {
    id: 'usr_checker_2',
    name: 'Meron Worku',
    email: 'meron.worku@oromiabank.com',
    role: 'CHECKER',
    institutionCode: '0000013',
    department: 'Trade Services & International Banking',
    employeeId: 'OB-CHK-112',
    specialAccessGrants: [],
  },
  {
    id: 'usr_admin_1',
    name: 'Dawit Bekele',
    email: 'admin@oromiabank.com',
    role: 'ADMIN',
    institutionCode: '0000013',
    department: 'Compliance & Legal Governance',
    employeeId: 'OB-ADM-001',
  },
  {
    id: 'usr_auditor_1',
    name: 'Girma Wolde',
    email: 'auditor@oromiabank.com',
    role: 'AUDITOR',
    institutionCode: '0000013',
    department: 'Internal Audit & Regulatory Examination',
    employeeId: 'OB-AUD-007',
    specialAccessGrants: [],
  },
];

class SubmissionServiceClass {
  private submissions: Map<string, ReportSubmission> = new Map();
  public readonly events = new BrowserSafeEventEmitter();

  public onSubmissionChange(callback: (sub: ReportSubmission) => void): () => void {
    this.events.on('submissionChange', callback);
    return () => this.events.off('submissionChange', callback);
  }

  public onSubmissionsUpdated(callback: (subs: ReportSubmission[]) => void): () => void {
    this.events.on('submissionsUpdated', callback);
    return () => this.events.off('submissionsUpdated', callback);
  }

  constructor() {
    this.seedInitialSubmissions();
    try {
      configService.onDepartmentRename((oldName, newName) => {
        this.renameDepartment(oldName, newName);
      });
    } catch (_) {}
    this.hydrateFromIndexedDB().catch(() => {});
    this.seedIndexedDB().catch(() => {});
  }

  public async hydrateFromIndexedDB(): Promise<void> {
    try {
      const storedDrafts = await indexedDbStorage.getAllDrafts();
      for (const draft of storedDrafts) {
        if (!this.submissions.has(draft.id)) {
          this.submissions.set(draft.id, draft);
        } else {
          // If stored draft is newer, take precedence
          const existing = this.submissions.get(draft.id)!;
          if (new Date(draft.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
            this.submissions.set(draft.id, draft);
          }
        }
      }
    } catch (err) {
      // Ignored in non-browser environments
    }
  }

  private async seedIndexedDB(): Promise<void> {
    try {
      for (const sub of this.submissions.values()) {
        const existing = await indexedDbStorage.getDraft(sub.id);
        if (!existing) {
          await indexedDbStorage.saveDraft(sub, { syncStatus: 'SYNCED', isOffline: false });
        }
      }
    } catch {
      // Ignored
    }
  }

  private createTemplateSnapshot(report: ReportMetadata): ReportMetadata {
    return JSON.parse(JSON.stringify(report));
  }

  public computeIntegrityHash(payload: {
    id: string;
    reportKey: string;
    version: number;
    templateVersion: number;
    values: Record<string, string | number>;
    status: string;
  }): string {
    const content = `${payload.id}|${payload.reportKey}|${payload.version}|${payload.templateVersion}|${payload.status}|${JSON.stringify(payload.values)}`;
    let hash = 0x811c9dc5;
    for (let i = 0; i < content.length; i++) {
      hash ^= content.charCodeAt(i);
      hash = (hash * 0x01000193) >>> 0;
    }
    const p1 = hash.toString(16).padStart(8, '0').toUpperCase();
    const p2 = ((hash * 37) >>> 0).toString(16).padStart(8, '0').toUpperCase();
    const p3 = ((hash * 131) >>> 0).toString(16).padStart(8, '0').toUpperCase();
    return `OB-SEAL-${p1}-${p2}-${p3}`;
  }

  public createSnapshot(
    sub: ReportSubmission,
    capturedBy: string,
    capturedByRole: string | undefined,
    reason: string
  ): SubmissionSnapshot {
    const report = this.getEffectiveTemplate(sub);
    const tmplSnapshot = this.createTemplateSnapshot(report);
    const valuesCopy = JSON.parse(JSON.stringify(sub.values || {}));
    const dynamicRowsCopy = JSON.parse(JSON.stringify(sub.dynamicRows || {}));
    const integrityHash = this.computeIntegrityHash({
      id: sub.id,
      reportKey: sub.reportKey,
      version: sub.version,
      templateVersion: sub.templateVersion || 1,
      values: valuesCopy,
      status: sub.status,
    });

    return {
      snapshotId: `snap_${sub.id}_v${sub.version}_${Date.now()}`,
      version: sub.version,
      templateVersion: sub.templateVersion || 1,
      dataVersion: sub.dataVersion || sub.version,
      timestamp: new Date().toISOString(),
      status: sub.status,
      capturedBy,
      capturedByRole,
      reason,
      values: valuesCopy,
      dynamicRows: dynamicRowsCopy,
      templateSnapshot: tmplSnapshot,
      structuralHash: sub.structuralHash || this.generateStructuralHash(report),
      integrityHash,
      nbeReferenceNumber: sub.nbeReferenceNumber,
    };
  }

  private generateStructuralHash(report: ReportMetadata): string {
    const fields = (report.ReturnItemsList || []).map((i: ReportItemDefinition) => `${i.Code}:${i._dataType}`).sort().join(';');
    const dynamic = (report.DynamicItemsList || []).map((a: DynamicAreaDefinition) => `${a.Area}:${(a.DynamicItems || []).map((d: DynamicColumnDefinition) => d.Code).join(',')}`).join(';');
    const str = `${report.ReturnKey}|${report.FinYear}|${fields}|${dynamic}`;
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = (hash * 0x01000193) >>> 0;
    }
    return `TMPL-${hash.toString(16).toUpperCase()}`;
  }

  private seedInitialSubmissions(): void {
    // 1. POBEPE001 - In Review by Checker (Trade Services Department)
    const pobepe = getReportByKey('POBEPE001');
    if (pobepe) {
      const pobepeSnapshot = this.createTemplateSnapshot(pobepe);
      const values1 = {
        '153_00010': 450000000,
        '153_00011': 1,
        '153_00016': 4500000,
        '153_00017': 4200000,
        '153_00018': -300000,
        '153_00019': 280000000,
        '153_00020': 0.5,
        '153_00025': 1400000,
        '153_00026': 1400000,
        '153_00027': 0,
        '153_00001': 730000000,
        '153_00007': 5900000,
        '153_00008': 5600000,
        '153_00009': -300000,
        '153_00028': 180000000,
        '153_00034': 1800000,
        '153_00037': 95000000,
        '153_00043': 950000,
        '153_00046': 45000000,
        '153_00052': 450000,
        '153_00055': 1050000000,
        '153_00061': 9100000,
        '153_00062': 8800000,
        '153_00063': -300000,
        '153_00064': 8800000,
      };
      const integrity1 = this.computeIntegrityHash({
        id: 'sub_pobepe_001',
        reportKey: 'POBEPE001',
        version: 1,
        templateVersion: 1,
        values: values1,
        status: 'PENDING_CHECKER',
      });
      const sub1: ReportSubmission = {
        id: 'sub_pobepe_001',
        reportKey: 'POBEPE001',
        department: 'Trade Services & International Banking',
        periodYear: 2026,
        periodStart: '2026-04-01T00:00:00',
        periodEnd: '2026-06-30T00:00:00',
        institutionCode: '0000013',
        status: 'PENDING_CHECKER',
        version: 1,
        templateVersion: 1,
        dataVersion: 1,
        templateSnapshot: pobepeSnapshot,
        dataSnapshot: { ...values1 },
        dynamicRowsSnapshot: {},
        structuralHash: this.generateStructuralHash(pobepe),
        integrityHash: integrity1,
        historicalSnapshots: [
          {
            snapshotId: 'snap_sub_pobepe_001_v1',
            version: 1,
            templateVersion: 1,
            dataVersion: 1,
            timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
            status: 'PENDING_CHECKER',
            capturedBy: 'Tigist Alemu',
            capturedByRole: 'MAKER',
            reason: 'Initial submission draft created and submitted to Checker',
            values: { ...values1 },
            dynamicRows: {},
            templateSnapshot: pobepeSnapshot,
            structuralHash: this.generateStructuralHash(pobepe),
            integrityHash: integrity1,
          },
        ],
        revisionHistory: [
          {
            version: 1,
            modifiedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
            modifiedBy: 'Tigist Alemu',
            modifiedByRole: 'MAKER',
            values: values1,
            dynamicRows: {},
            reason: 'Initial submission draft created and submitted to Checker',
            templateSnapshot: pobepeSnapshot,
            integrityHash: integrity1,
          },
        ],
        values: values1,
        dynamicRows: {},
        makerId: 'usr_maker_2',
        makerName: 'Tigist Alemu',
        makerEmail: 'tigist.alemu@oromiabank.com',
        makerDepartment: 'Trade Services & International Banking',
        comments: [
          {
            id: 'comm_init_1',
            userId: 'usr_maker_2',
            userName: 'Tigist Alemu',
            userRole: 'MAKER',
            comment: 'Off-balance sheet guarantees provision calculated based on Q2 loan ledger.',
            action: 'SUBMIT',
            timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
          },
        ],
        deliveryAttempts: [],
        createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
        updatedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
        submittedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
      };
      this.submissions.set(sub1.id, sub1);
    }

    // 2. LOA_ADV_OUT_LA001 - APPROVED by Checker (Credit Operations & Portfolio Management)
    const la001 = getReportByKey('LOA_ADV_OUT_LA001');
    if (la001) {
      const la001Snapshot = this.createTemplateSnapshot(la001);
      const values2 = {
        '001_00001': 14500000000,
        '001_00002': 2100000000,
        '001_00003': 1850000000,
        '001_00004': 14750000000,
        '001_00005': 1200000000,
        '001_00006': 13550000000,
      };
      const integrity2 = this.computeIntegrityHash({
        id: 'sub_la001_approved',
        reportKey: 'LOA_ADV_OUT_LA001',
        version: 1,
        templateVersion: 1,
        values: values2,
        status: 'APPROVED',
      });
      const sub2: ReportSubmission = {
        id: 'sub_la001_approved',
        reportKey: 'LOA_ADV_OUT_LA001',
        department: 'Credit Operations & Portfolio Management',
        periodYear: 2026,
        periodStart: '2026-07-01T00:00:00',
        periodEnd: '2026-07-31T00:00:00',
        institutionCode: '0000013',
        status: 'APPROVED',
        version: 1,
        templateVersion: 1,
        dataVersion: 1,
        submittedVersion: 1,
        templateSnapshot: la001Snapshot,
        dataSnapshot: { ...values2 },
        dynamicRowsSnapshot: {},
        structuralHash: this.generateStructuralHash(la001),
        integrityHash: integrity2,
        historicalSnapshots: [
          {
            snapshotId: 'snap_sub_la001_v1',
            version: 1,
            templateVersion: 1,
            dataVersion: 1,
            timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
            status: 'APPROVED',
            capturedBy: 'Chala Desta',
            capturedByRole: 'CHECKER',
            reason: 'Disbursement ledger reconciliation and checker sign-off',
            values: { ...values2 },
            dynamicRows: {},
            templateSnapshot: la001Snapshot,
            structuralHash: this.generateStructuralHash(la001),
            integrityHash: integrity2,
          },
        ],
        revisionHistory: [
          {
            version: 1,
            modifiedAt: new Date(Date.now() - 3600000 * 8).toISOString(),
            modifiedBy: 'Abebe Kebede',
            modifiedByRole: 'MAKER',
            values: values2,
            dynamicRows: {},
            reason: 'Disbursement ledger reconciliation and checker sign-off',
            templateSnapshot: la001Snapshot,
            integrityHash: integrity2,
          },
        ],
        values: values2,
        dynamicRows: {},
        makerId: 'usr_maker_1',
        makerName: 'Abebe Kebede',
        makerEmail: 'abebe.kebede@oromiabank.com',
        makerDepartment: 'Credit Operations & Portfolio Management',
        checkerId: 'usr_checker_1',
        checkerName: 'Chala Desta',
        checkerEmail: 'chala.desta@oromiabank.com',
        checkerDepartment: 'Credit Operations & Portfolio Management',
        comments: [
          {
            id: 'comm_la_1',
            userId: 'usr_maker_1',
            userName: 'Abebe Kebede',
            userRole: 'MAKER',
            comment: 'July 2026 disbursement and collection reconciliation finalized.',
            action: 'SUBMIT',
            timestamp: new Date(Date.now() - 3600000 * 8).toISOString(),
          },
          {
            id: 'comm_la_2',
            userId: 'usr_checker_1',
            userName: 'Chala Desta',
            userRole: 'CHECKER',
            comment: '4-Eyes verification complete. Reconciled with core banking ledger. Approved for final Maker NBE delivery.',
            action: 'APPROVE',
            timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
          },
        ],
        deliveryAttempts: [],
        createdAt: new Date(Date.now() - 3600000 * 10).toISOString(),
        updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        submittedAt: new Date(Date.now() - 3600000 * 8).toISOString(),
        reviewedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        approvedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      };
      this.submissions.set(sub2.id, sub2);
    }

    // 3. DigitalLendingDL001 - Draft by Tigist Alemu under Admin Special Access Grant
    const dl001 = getReportByKey('DigitalLendingDL001');
    if (dl001) {
      const dl001Snapshot = this.createTemplateSnapshot(dl001);
      const values3 = {
        'DL001_01': 45000,
        'DL001_02': 185000000,
        'DL001_03': 165000000,
        'DL001_04': 20000000,
        'DL001_05': 1.8,
      };
      const integrity3 = this.computeIntegrityHash({
        id: 'sub_dl001_special',
        reportKey: 'DigitalLendingDL001',
        version: 1,
        templateVersion: 1,
        values: values3,
        status: 'DRAFT',
      });
      const sub3: ReportSubmission = {
        id: 'sub_dl001_special',
        reportKey: 'DigitalLendingDL001',
        department: 'Digital Banking & Fintech Operations',
        periodYear: 2026,
        periodStart: '2026-04-01T00:00:00',
        periodEnd: '2026-06-30T00:00:00',
        institutionCode: '0000013',
        status: 'DRAFT',
        version: 1,
        templateVersion: 1,
        dataVersion: 1,
        templateSnapshot: dl001Snapshot,
        dataSnapshot: { ...values3 },
        dynamicRowsSnapshot: {},
        structuralHash: this.generateStructuralHash(dl001),
        integrityHash: integrity3,
        historicalSnapshots: [
          {
            snapshotId: 'snap_sub_dl001_v1',
            version: 1,
            templateVersion: 1,
            dataVersion: 1,
            timestamp: new Date(Date.now() - 3600000).toISOString(),
            status: 'DRAFT',
            capturedBy: 'Tigist Alemu',
            capturedByRole: 'MAKER',
            reason: 'Draft created under Special Access authorization',
            values: { ...values3 },
            dynamicRows: {},
            templateSnapshot: dl001Snapshot,
            structuralHash: this.generateStructuralHash(dl001),
            integrityHash: integrity3,
          },
        ],
        revisionHistory: [
          {
            version: 1,
            modifiedAt: new Date(Date.now() - 3600000).toISOString(),
            modifiedBy: 'Tigist Alemu',
            modifiedByRole: 'MAKER',
            values: values3,
            dynamicRows: {},
            reason: 'Draft created under Special Access authorization',
            templateSnapshot: dl001Snapshot,
            integrityHash: integrity3,
          },
        ],
        values: values3,
        dynamicRows: {},
        makerId: 'usr_maker_2',
        makerName: 'Tigist Alemu',
        makerEmail: 'tigist.alemu@oromiabank.com',
        makerDepartment: 'Trade Services & International Banking',
        comments: [
          {
            id: 'comm_dl_1',
            userId: 'usr_maker_2',
            userName: 'Tigist Alemu',
            userRole: 'MAKER',
            comment: 'Draft created under Special Access authorization granted by Compliance Admin.',
            action: 'SAVE_DRAFT',
            timestamp: new Date(Date.now() - 3600000).toISOString(),
          },
        ],
        deliveryAttempts: [],
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        updatedAt: new Date(Date.now() - 3600000).toISOString(),
      };
      this.submissions.set(sub3.id, sub3);
    }
  }

  public getAll(): ReportSubmission[] {
    return Array.from(this.submissions.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  public getAllSubmissions(): ReportSubmission[] {
    return this.getAll();
  }

  public getById(id: string): ReportSubmission | undefined {
    return this.submissions.get(id);
  }

  public getByFilter(filter: {
    status?: SubmissionStatus;
    reportKey?: string;
    makerId?: string;
    department?: string;
  }): ReportSubmission[] {
    return this.getAll().filter((s) => {
      if (filter.status && s.status !== filter.status) return false;
      if (filter.reportKey && s.reportKey !== filter.reportKey) return false;
      if (filter.makerId && s.makerId !== filter.makerId) return false;
      if (
        filter.department &&
        s.department &&
        s.department.toLowerCase() !== filter.department.toLowerCase()
      ) {
        return false;
      }
      return true;
    });
  }

  /**
   * Creates a new submission draft for a specific report key.
   * Enforces:
   * 1. Only MAKERS can create submission drafts. (Checkers and Admins cannot create!).
   * 2. Maker must be assigned to the department that owns this report,
   *    OR have been granted special access by the Administrator.
   */
  public createDraft(reportKey: string, user: UserSession): ReportSubmission {
    return this.createSubmission(reportKey, user);
  }

  public createSubmission(reportKey: string, user: UserSession): ReportSubmission {
    const report = getReportByKey(reportKey);
    if (!report) {
      throw new Error(`Report template not found for key: ${reportKey}`);
    }

    const evalResult = effectiveAccessEngine.evaluateAccess(user, report.ReturnKey, 'CREATE_DRAFT');
    if (!evalResult.allowed) {
      if (evalResult.code === 'ROLE_FORBIDDEN') {
        throw new Error(
          `Role violation: Only registered Makers can create report drafts. Current role: ${user.role}`
        );
      }
      throw new Error(evalResult.reason);
    }

    const reportDept = report.department || getDepartmentForReport(report.ReturnKey);

    const id = 'sub_' + reportKey.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now();
    const now = new Date().toISOString();

    const initialValues: Record<string, string | number> = {};
    for (const item of report.ReturnItemsList) {
      initialValues[item.Code] = item.Value !== undefined ? item.Value : '';
    }

    const initialDynamicRows: Record<number, DynamicRowRecord[]> = {};
    for (const area of report.DynamicItemsList) {
      initialDynamicRows[area.Area] = [];
    }

    const templateSnapshot = this.createTemplateSnapshot(report);
    const structuralHash = this.generateStructuralHash(report);
    const activeDef = configService.getReportDefinition(report.ReturnKey);
    const activeTmplVersion = activeDef?.currentVersion || 1;
    const initialValuesCopy = JSON.parse(JSON.stringify(initialValues));
    const initialDynamicCopy = JSON.parse(JSON.stringify(initialDynamicRows));
    const integrityHash = this.computeIntegrityHash({
      id,
      reportKey: report.ReturnKey,
      version: 1,
      templateVersion: activeTmplVersion,
      values: initialValuesCopy,
      status: 'DRAFT',
    });

    const initialSnapshot: SubmissionSnapshot = {
      snapshotId: `snap_${id}_v1_${Date.now()}`,
      version: 1,
      templateVersion: activeTmplVersion,
      dataVersion: 1,
      timestamp: now,
      status: 'DRAFT',
      capturedBy: user.name,
      capturedByRole: user.role,
      reason: `Draft initiated by ${user.name} for ${report.Title}`,
      values: initialValuesCopy,
      dynamicRows: initialDynamicCopy,
      templateSnapshot,
      structuralHash,
      integrityHash,
    };

    const submission: ReportSubmission = {
      id,
      reportKey: report.ReturnKey,
      department: reportDept,
      periodYear: report.FinYear,
      periodStart: report.StartDate,
      periodEnd: report.EndDate,
      institutionCode: report.InstCode,
      status: 'DRAFT',
      version: 1,
      templateVersion: activeTmplVersion,
      dataVersion: 1,
      templateSnapshot,
      dataSnapshot: initialValuesCopy,
      dynamicRowsSnapshot: initialDynamicCopy,
      structuralHash,
      integrityHash,
      historicalSnapshots: [initialSnapshot],
      revisionHistory: [
        {
          version: 1,
          modifiedAt: now,
          modifiedBy: user.name,
          modifiedByRole: user.role,
          values: initialValues,
          dynamicRows: initialDynamicRows,
          reason: `Draft initiated by ${user.name} for ${report.Title}`,
          templateSnapshot,
          integrityHash,
        },
      ],
      values: initialValues,
      dynamicRows: initialDynamicRows,
      makerId: user.id,
      makerName: user.name,
      makerEmail: user.email,
      makerDepartment: user.department,
      comments: [
        {
          id: 'comm_' + Math.random().toString(36).substring(2, 9),
          userId: user.id,
          userName: user.name,
          userRole: user.role as any,
          comment: `Report draft initiated for ${report.Title} [${reportDept}]`,
          action: 'SAVE_DRAFT',
          timestamp: now,
        },
      ],
      deliveryAttempts: [],
      createdAt: now,
      updatedAt: now,
      idempotencyKey: 'idemp_' + id + '_v1',
    };

    const isOnline =
      typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
        ? navigator.onLine
        : true;
    submission.syncStatus = isOnline ? 'SYNCED' : 'PENDING_SYNC';
    submission.isOfflineDraft = !isOnline;
    submission.offlineSavedAt = now;

    this.submissions.set(id, submission);

    // Persist to IndexedDB for offline persistence during remote site visits
    indexedDbStorage.saveDraft(submission, {
      syncStatus: submission.syncStatus,
      isOffline: submission.isOfflineDraft,
    }).catch((err) => {
      console.warn('[SubmissionService] IndexedDB saveDraft warning:', err);
    });

    try {
      this.events.emit('submissionChange', submission);
      this.events.emit('submissionsUpdated', this.getAll());
    } catch (_) {}

    auditService.log({
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: 'CREATE_DRAFT',
      entityType: 'REPORT_SUBMISSION',
      entityId: id,
      correlationId: 'corr_' + id,
      details: `Created new draft for report ${report.ReturnKey} in department ${reportDept} (Template v1 [${structuralHash}])`,
    });

    return submission;
  }

  /**
   * Retrieves the effective template for a submission.
   * Priority: submission.templateSnapshot -> getReportByKey(submission.reportKey).
   * Ensures historical submissions maintain their original data snapshot for regulatory integrity.
   */
  public getEffectiveTemplate(submission: ReportSubmission): ReportMetadata {
    if (submission.templateSnapshot) {
      return submission.templateSnapshot;
    }
    const currentRegistry = getReportByKey(submission.reportKey);
    if (currentRegistry) {
      return currentRegistry;
    }
    // Fallback minimal definition
    return {
      ReturnKey: submission.reportKey,
      Code: submission.reportKey,
      Title: `Regulatory Return ${submission.reportKey}`,
      Category: 'Credit & Lending',
      Frequency: 'MONTHLY',
      InstCode: submission.institutionCode || '0000013',
      FinYear: submission.periodYear || 2026,
      StartDate: submission.periodStart,
      EndDate: submission.periodEnd,
      Description: 'Historical regulatory return snapshot',
      ReturnItemsList: Object.keys(submission.values).map((code) => ({
        Code: code,
        Value: submission.values[code],
        _description: `Field ${code}`,
        _dataType: 'NUMERIC',
        _required: true,
      })),
      DynamicItemsList: [],
      Formulas: [],
      ValidationRules: [],
      SourceFilename: '',
      SourceHash: '',
    };
  }

  /**
   * Updates an existing draft's field values and dynamic rows.
   * Enforces:
   * 1. Only authorized Makers can modify report draft data. Checkers and Admins are restricted.
   * 2. Cannot modify submitted/final reports (SENT, APPROVED, SENDING).
   * 3. Cannot modify submissions under active Checker review (PENDING_CHECKER).
   * 4. Enforces optimistic concurrency locking (expectedVersion) against concurrent edit conflicts.
   */
  public updateDraft(
    id: string,
    values: Record<string, string | number>,
    dynamicRows: Record<number, DynamicRowRecord[]>,
    user: UserSession,
    expectedVersion?: number
  ): ReportSubmission {
    const sub = this.submissions.get(id);
    if (!sub) throw new Error(`Submission not found: ${id}`);

    // Concurrency conflict check (Optimistic Locking)
    if (expectedVersion !== undefined && expectedVersion !== sub.version) {
      throw new Error(
        `CONCURRENT_MODIFICATION_CONFLICT: Submission ${id} has been modified concurrently (expected v${expectedVersion}, current server state is v${sub.version}). Please reload the draft to prevent overwriting edits.`
      );
    }

    // State immutability & validation check
    if (sub.status === 'SENT' || sub.status === 'APPROVED' || sub.status === 'SENDING') {
      throw new Error(
        `Cannot modify submitted/final report ${id} in status ${sub.status}. Submitted records are permanently sealed. Use 'Reuse as New' to create a new draft.`
      );
    }

    if (sub.status === 'PENDING_CHECKER') {
      throw new Error(
        `Cannot modify submission ${id} while under Checker review (PENDING_CHECKER). Wait for Checker review or request correction.`
      );
    }

    if (sub.status !== 'DRAFT' && sub.status !== 'CORRECTION_REQUIRED') {
      throw new Error(`Cannot modify submission in status ${sub.status}`);
    }

    const evalResult = effectiveAccessEngine.evaluateAccess(user, sub.reportKey, 'EDIT_DRAFT', sub);
    if (!evalResult.allowed) {
      if (evalResult.code === 'ROLE_FORBIDDEN') {
        throw new Error(
          `Role violation: Only authorized Makers can edit report draft data. User role "${user.role}" is restricted from data modifications.`
        );
      }
      throw new Error(evalResult.reason);
    }

    const report = this.getEffectiveTemplate(sub);
    let finalValues = { ...values };

    // Auto-calculate formulas
    if (report && report.Formulas.length > 0) {
      const calcResult = FormulaEngine.calculateAllFormulas(report.Formulas, finalValues);
      finalValues = calcResult.updatedValues;
    }

    const nextVersion = sub.version + 1;
    const now = new Date().toISOString();
    const clonedValues = JSON.parse(JSON.stringify(finalValues));
    const clonedDynamic = JSON.parse(JSON.stringify(dynamicRows));
    const tmplSnapshot = sub.templateSnapshot || this.createTemplateSnapshot(report);
    const structHash = sub.structuralHash || this.generateStructuralHash(report);
    const integrityHash = this.computeIntegrityHash({
      id: sub.id,
      reportKey: sub.reportKey,
      version: nextVersion,
      templateVersion: sub.templateVersion || 1,
      values: clonedValues,
      status: sub.status,
    });

    const newSnapshot: SubmissionSnapshot = {
      snapshotId: `snap_${sub.id}_v${nextVersion}_${Date.now()}`,
      version: nextVersion,
      templateVersion: sub.templateVersion || 1,
      dataVersion: nextVersion,
      timestamp: now,
      status: sub.status,
      capturedBy: user.name,
      capturedByRole: user.role,
      reason: `Draft updated by Maker ${user.name}`,
      values: clonedValues,
      dynamicRows: clonedDynamic,
      templateSnapshot: tmplSnapshot,
      structuralHash: structHash,
      integrityHash,
    };

    const revisionEntry = {
      version: nextVersion,
      modifiedAt: now,
      modifiedBy: user.name,
      modifiedByRole: user.role,
      values: finalValues,
      dynamicRows,
      reason: `Draft updated by Maker ${user.name}`,
      templateSnapshot: tmplSnapshot,
      integrityHash,
    };

    const isOnline =
      typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
        ? navigator.onLine
        : true;
    const updated: ReportSubmission = {
      ...sub,
      version: nextVersion,
      dataVersion: nextVersion,
      values: finalValues,
      dynamicRows,
      dataSnapshot: clonedValues,
      dynamicRowsSnapshot: clonedDynamic,
      updatedAt: now,
      templateSnapshot: tmplSnapshot,
      structuralHash: structHash,
      integrityHash,
      historicalSnapshots: [...(sub.historicalSnapshots || []), newSnapshot],
      revisionHistory: [...(sub.revisionHistory || []), revisionEntry],
      syncStatus: isOnline ? 'SYNCED' : 'PENDING_SYNC',
      isOfflineDraft: !isOnline,
      offlineSavedAt: now,
    };

    this.submissions.set(id, updated);

    // Asynchronously persist to IndexedDB
    indexedDbStorage.saveDraft(updated, {
      syncStatus: updated.syncStatus,
      isOffline: updated.isOfflineDraft,
    }).catch((err) => {
      console.warn('[SubmissionService] IndexedDB updateDraft save warning:', err);
    });

    try {
      this.events.emit('submissionChange', updated);
      this.events.emit('submissionsUpdated', this.getAll());
      realtimeSsotEngine.publishEvent({
        eventType: 'REPORT_CHANGED',
        action: 'UPDATE_DRAFT',
        domain: 'REPORT',
        entityId: updated.id,
        topic: `REPORT:${updated.reportKey}`,
        actor: { id: user.id, name: user.name, role: user.role },
        summary: `Report ${updated.reportKey} draft updated to v${nextVersion} by ${user.name}`,
        payload: {
          submissionId: updated.id,
          reportKey: updated.reportKey,
          version: updated.version,
          updatedAt: updated.updatedAt,
          status: updated.status,
        },
      });
    } catch (_) {}

    auditService.log({
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: 'UPDATE_DRAFT',
      entityType: 'REPORT_SUBMISSION',
      entityId: id,
      correlationId: 'corr_' + id,
      details: `Maker ${user.name} saved draft updates for return ${sub.reportKey} (v${nextVersion})`,
    });

    return updated;
  }

  /**
   * Reuses an existing submitted or historical report to create a brand new draft.
   * Enforces:
   * 1. A previously submitted report must NEVER be edited in place.
   * 2. "Reuse" creates a new report identity linked to the source report and version.
   * 3. Only authorized Makers for the report can reuse it as a new draft.
   * 4. The new reused report is editable, saveable, validatable, and submittable.
   */
  public reuseSubmission(id: string, user: UserSession): ReportSubmission {
    const sourceSub = this.submissions.get(id);
    if (!sourceSub) {
      throw new Error(`Submission not found to reuse: ${id}`);
    }

    if (user.role !== 'MAKER') {
      throw new Error(`Role violation: Only Makers can reuse submissions to create new drafts. Current role: ${user.role}`);
    }

    // Check Maker's effective access to create drafts on this report
    const evalResult = effectiveAccessEngine.evaluateAccess(user, sourceSub.reportKey, 'CREATE_DRAFT');
    if (!evalResult.allowed) {
      throw new Error(`Cannot reuse submission: ${evalResult.reason}`);
    }

    // Record source state to verify source remains 100% immutable
    const sourceHashBefore = sourceSub.integrityHash;
    const sourceVersionBefore = sourceSub.version;
    const sourceStatusBefore = sourceSub.status;

    const report = getReportByKey(sourceSub.reportKey) || this.getEffectiveTemplate(sourceSub);
    const reportDept = sourceSub.department || report.department || getDepartmentForReport(sourceSub.reportKey);
    const newId = 'sub_' + sourceSub.reportKey.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_reused_' + Date.now();
    const now = new Date().toISOString();

    const clonedValues = JSON.parse(JSON.stringify(sourceSub.values || {}));
    const clonedDynamic = JSON.parse(JSON.stringify(sourceSub.dynamicRows || {}));
    const templateSnapshot = this.createTemplateSnapshot(report);
    const structuralHash = this.generateStructuralHash(report);
    const activeDef = configService.getReportDefinition(sourceSub.reportKey);
    const activeTmplVersion = activeDef?.currentVersion || sourceSub.templateVersion || 1;

    const integrityHash = this.computeIntegrityHash({
      id: newId,
      reportKey: sourceSub.reportKey,
      version: 1,
      templateVersion: activeTmplVersion,
      values: clonedValues,
      status: 'DRAFT',
    });

    const initialSnapshot: SubmissionSnapshot = {
      snapshotId: `snap_${newId}_v1_${Date.now()}`,
      version: 1,
      templateVersion: activeTmplVersion,
      dataVersion: 1,
      timestamp: now,
      status: 'DRAFT',
      capturedBy: user.name,
      capturedByRole: user.role,
      reason: `Reused from submitted report ${sourceSub.id} (v${sourceSub.submittedVersion || sourceSub.version})`,
      values: clonedValues,
      dynamicRows: clonedDynamic,
      templateSnapshot,
      structuralHash,
      integrityHash,
    };

    const newSubmission: ReportSubmission = {
      id: newId,
      reportKey: sourceSub.reportKey,
      department: reportDept,
      periodYear: sourceSub.periodYear || report.FinYear,
      periodStart: sourceSub.periodStart || report.StartDate,
      periodEnd: sourceSub.periodEnd || report.EndDate,
      institutionCode: sourceSub.institutionCode || report.InstCode,
      status: 'DRAFT',
      version: 1,
      templateVersion: activeTmplVersion,
      dataVersion: 1,
      templateSnapshot,
      dataSnapshot: clonedValues,
      dynamicRowsSnapshot: clonedDynamic,
      structuralHash,
      integrityHash,
      historicalSnapshots: [initialSnapshot],
      revisionHistory: [
        {
          version: 1,
          modifiedAt: now,
          modifiedBy: user.name,
          modifiedByRole: user.role,
          values: clonedValues,
          dynamicRows: clonedDynamic,
          reason: `Reused from submitted report ${sourceSub.id} (v${sourceSub.submittedVersion || sourceSub.version})`,
          templateSnapshot,
          integrityHash,
        },
      ],
      values: clonedValues,
      dynamicRows: clonedDynamic,
      makerId: user.id,
      makerName: user.name,
      makerEmail: user.email,
      makerDepartment: user.department,
      reusedFromSubmissionId: sourceSub.id,
      reusedFromVersion: sourceSub.submittedVersion || sourceSub.version,
      sourceReportId: sourceSub.id,
      sourceVersion: sourceSub.submittedVersion || sourceSub.version,
      comments: [
        {
          id: 'comm_' + Math.random().toString(36).substring(2, 9),
          userId: user.id,
          userName: user.name,
          userRole: user.role as any,
          comment: `Draft created by reusing submitted return ${sourceSub.id} (v${sourceSub.submittedVersion || sourceSub.version}). Source record preserved intact.`,
          action: 'SAVE_DRAFT',
          timestamp: now,
        },
      ],
      deliveryAttempts: [],
      createdAt: now,
      updatedAt: now,
      idempotencyKey: 'idemp_' + newId + '_v1',
    };

    const isOnline =
      typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
        ? navigator.onLine
        : true;
    newSubmission.syncStatus = isOnline ? 'SYNCED' : 'PENDING_SYNC';
    newSubmission.isOfflineDraft = !isOnline;
    newSubmission.offlineSavedAt = now;

    // Verify source submission was NOT modified
    if (
      sourceSub.integrityHash !== sourceHashBefore ||
      sourceSub.version !== sourceVersionBefore ||
      sourceSub.status !== sourceStatusBefore
    ) {
      throw new Error(`CRITICAL INVARIANT VIOLATION: Source submission ${sourceSub.id} was mutated during reuse!`);
    }

    this.submissions.set(newId, newSubmission);

    indexedDbStorage.saveDraft(newSubmission, {
      syncStatus: newSubmission.syncStatus,
      isOffline: newSubmission.isOfflineDraft,
    }).catch(() => {});

    auditService.log({
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: 'REUSE_SUBMISSION_AS_NEW',
      entityType: 'REPORT_SUBMISSION',
      entityId: newId,
      correlationId: 'corr_' + newId,
      details: `Maker ${user.name} created new draft ${newId} by reusing submitted report ${sourceSub.id} (v${sourceSub.submittedVersion || sourceSub.version}). Source report preserved immutable.`,
    });

    return newSubmission;
  }

  /**
   * Validates a submission using the ValidationEngine with its effective template snapshot.
   */
  public validateSubmission(id: string): ValidationSummary {
    const sub = this.submissions.get(id);
    if (!sub) throw new Error(`Submission not found: ${id}`);

    const report = this.getEffectiveTemplate(sub);
    return ValidationEngine.validateReport(report, sub.values, sub.dynamicRows);
  }

  /**
   * Phase 24: Authoritative Server-Side Validation Normalization & Remediation Inspection.
   * Returns fully normalized validation items with 4-part explanations and auto-fix descriptors.
   */
  public validateSubmissionNormalized(id: string): NormalizedValidationSummary {
    const sub = this.submissions.get(id);
    if (!sub) throw new Error(`Submission not found: ${id}`);

    const report = this.getEffectiveTemplate(sub);
    return ValidationRemediationService.normalizeReportValidation(report, sub.values, sub.dynamicRows);
  }

  /**
   * Phase 24: Authoritative Remediation Auto-Fix Execution.
   * Applies deterministic fix, writes updated draft, re-runs validation, and logs safe audit trail.
   */
  public remediateSubmission(
    id: string,
    proposedFix: ProposedFix,
    user: UserSession,
    expectedVersion?: number
  ): {
    updatedSubmission: ReportSubmission;
    revalidationSummary: NormalizedValidationSummary;
    auditEntry: any;
  } {
    const sub = this.submissions.get(id);
    if (!sub) throw new Error(`Submission not found: ${id}`);

    // Concurrency conflict check
    if (expectedVersion !== undefined && expectedVersion !== sub.version) {
      throw new Error(
        `CONCURRENT_MODIFICATION_CONFLICT: Submission ${id} has been modified concurrently (expected v${expectedVersion}, current server state is v${sub.version}). Please reload before applying remediation.`
      );
    }

    // Role and status verification: only editable by Maker while in DRAFT or CORRECTION_REQUIRED
    const evalResult = effectiveAccessEngine.evaluateAccess(user, sub.reportKey, 'CREATE_DRAFT', sub);
    if (!evalResult.allowed && sub.makerId !== user.id && sub.makerName !== user.name) {
      throw new Error(`REMEDIATION_FORBIDDEN: You do not have permission to modify submission ${id}.`);
    }

    if (sub.status !== 'DRAFT' && sub.status !== 'CORRECTION_REQUIRED') {
      throw new Error(`CANNOT_REMEDIATE_SUBMITTED_REPORT: Submission ${id} is in '${sub.status}' state and cannot be modified.`);
    }

    const report = this.getEffectiveTemplate(sub);

    const { updatedValues, updatedDynamicRows, revalidationSummary, auditEntry } =
      ValidationRemediationService.applyAutoFix(
        report,
        sub.values,
        sub.dynamicRows,
        proposedFix,
        user,
        sub.id
      );

    // Save draft with updated values and bumped version
    const updatedSubmission = this.updateDraft(
      sub.id,
      updatedValues,
      updatedDynamicRows,
      user,
      sub.version
    );

    return {
      updatedSubmission,
      revalidationSummary,
      auditEntry,
    };
  }

  /**
   * Maker submits report to Checker.
   */
  public submitToChecker(
    id: string,
    user: UserSession,
    commentText?: string,
    expectedVersion?: number
  ): ReportSubmission {
    const sub = this.submissions.get(id);
    if (!sub) throw new Error(`Submission not found: ${id}`);

    // Concurrency conflict check
    if (expectedVersion !== undefined && expectedVersion !== sub.version) {
      throw new Error(
        `CONCURRENT_MODIFICATION_CONFLICT: Submission ${id} has been modified concurrently (expected v${expectedVersion}, current server state is v${sub.version}). Please reload before submitting.`
      );
    }

    const evalResult = effectiveAccessEngine.evaluateAccess(user, sub.reportKey, 'SUBMIT_CHECKER', sub);
    if (!evalResult.allowed) {
      if (evalResult.code === 'ROLE_FORBIDDEN') {
        throw new Error('Only the Maker who prepared the report can submit it to the Checker.');
      }
      throw new Error(evalResult.reason);
    }

    // Pre-submission validation gate
    const valSummary = this.validateSubmission(id);
    if (!valSummary.isValid) {
      throw new Error(
        `Validation failed with ${valSummary.errorsCount} errors. Please correct all validation issues before submitting to Checker.`
      );
    }

    const isResubmission = sub.status === 'CORRECTION_REQUIRED' || sub.status === 'REJECTED';
    const { updatedSubmission } = WorkflowEngine.applyTransition(sub, 'PENDING_CHECKER', user, commentText);

    // Capture historical snapshot at the moment of submission to Checker
    const valuesSnapshot = JSON.parse(JSON.stringify(updatedSubmission.values));
    const dynamicSnapshot = JSON.parse(JSON.stringify(updatedSubmission.dynamicRows));
    const tmpl = updatedSubmission.templateSnapshot || this.createTemplateSnapshot(this.getEffectiveTemplate(updatedSubmission));
    const integrityHash = this.computeIntegrityHash({
      id: sub.id,
      reportKey: sub.reportKey,
      version: updatedSubmission.version,
      templateVersion: updatedSubmission.templateVersion || 1,
      values: valuesSnapshot,
      status: 'PENDING_CHECKER',
    });

    const submitSnapshot: SubmissionSnapshot = {
      snapshotId: `snap_${sub.id}_v${updatedSubmission.version}_submitted_${Date.now()}`,
      version: updatedSubmission.version,
      templateVersion: updatedSubmission.templateVersion || 1,
      dataVersion: updatedSubmission.dataVersion || updatedSubmission.version,
      timestamp: new Date().toISOString(),
      status: 'PENDING_CHECKER',
      capturedBy: user.name,
      capturedByRole: user.role,
      reason: commentText || (isResubmission ? 'Resubmitted to Checker following corrections' : 'Submitted to Checker for 4-eyes review'),
      values: valuesSnapshot,
      dynamicRows: dynamicSnapshot,
      templateSnapshot: tmpl,
      structuralHash: updatedSubmission.structuralHash,
      integrityHash,
    };

    const finalSubWithSnapshot: ReportSubmission = {
      ...updatedSubmission,
      dataSnapshot: valuesSnapshot,
      dynamicRowsSnapshot: dynamicSnapshot,
      integrityHash,
      historicalSnapshots: [...(updatedSubmission.historicalSnapshots || []), submitSnapshot],
    };

    this.submissions.set(id, finalSubWithSnapshot);

    // Save to IndexedDB
    indexedDbStorage.saveDraft(finalSubWithSnapshot).catch(() => {});

    try {
      realtimeSsotEngine.publishEvent({
        eventType: 'WORKFLOW_STATUS_CHANGED',
        action: 'PENDING_CHECKER',
        domain: 'WORKFLOW',
        entityId: id,
        topic: 'WORKFLOWS',
        actor: { id: user.id, name: user.name, role: user.role },
        summary: `Report ${sub.reportKey} ${isResubmission ? 'resubmitted' : 'submitted'} to Checker by ${user.name}`,
        payload: {
          submissionId: id,
          reportKey: sub.reportKey,
          status: 'PENDING_CHECKER',
          version: finalSubWithSnapshot.version,
          isResubmission,
        },
      });
    } catch (_) {}

    auditService.log({
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: isResubmission ? 'RESUBMIT_TO_CHECKER' : 'SUBMIT_TO_CHECKER',
      entityType: 'REPORT_SUBMISSION',
      entityId: id,
      correlationId: 'corr_' + id,
      details: isResubmission
        ? `Submission resubmitted for 4-eyes review by Maker ${user.name} (${user.department}) after addressing correction requests.`
        : `Submission submitted for 4-eyes review by Maker ${user.name} (${user.department})`,
    });

    return finalSubWithSnapshot;
  }

  /**
   * Checker reviews submission (Approve, Reject, Request Correction).
   * Enforces:
   * 1. Only CHECKERS can review. (Makers cannot approve; Admins are read-only).
   * 2. Checker must be from the same department, OR have Admin-granted special access.
   */
  public approveSubmission(
    id: string,
    user: UserSession,
    commentText?: string,
    expectedVersion?: number
  ): ReportSubmission {
    return this.reviewSubmission(id, 'APPROVE', user, commentText);
  }

  public reviewSubmission(
    id: string,
    action: 'APPROVE' | 'REJECT' | 'REQUEST_CORRECTION',
    user: UserSession,
    commentText?: string
  ): ReportSubmission {
    const sub = this.submissions.get(id);
    if (!sub) throw new Error(`Submission not found: ${id}`);

    // Authoritative Central Effective Access Engine Evaluation
    const evalAction = action === 'APPROVE' ? 'APPROVE' : action === 'REJECT' ? 'REJECT' : 'REQUEST_CORRECTION';
    const evalResult = effectiveAccessEngine.evaluateAccess(user, sub.reportKey, evalAction, sub);
    if (!evalResult.allowed) {
      throw new Error(`Review denied: ${evalResult.reason}`);
    }

    const targetStatus: SubmissionStatus =
      action === 'APPROVE'
        ? 'APPROVED'
        : action === 'REJECT'
        ? 'REJECTED'
        : 'CORRECTION_REQUIRED';

    const { updatedSubmission } = WorkflowEngine.applyTransition(sub, targetStatus, user, commentText);

    // Capture snapshot at Checker decision point
    const valuesSnapshot = JSON.parse(JSON.stringify(updatedSubmission.values));
    const dynamicSnapshot = JSON.parse(JSON.stringify(updatedSubmission.dynamicRows));
    const tmpl = updatedSubmission.templateSnapshot || this.createTemplateSnapshot(this.getEffectiveTemplate(updatedSubmission));
    const integrityHash = this.computeIntegrityHash({
      id: sub.id,
      reportKey: sub.reportKey,
      version: updatedSubmission.version,
      templateVersion: updatedSubmission.templateVersion || 1,
      values: valuesSnapshot,
      status: targetStatus,
    });

    const reviewSnapshot: SubmissionSnapshot = {
      snapshotId: `snap_${sub.id}_v${updatedSubmission.version}_${targetStatus.toLowerCase()}_${Date.now()}`,
      version: updatedSubmission.version,
      templateVersion: updatedSubmission.templateVersion || 1,
      dataVersion: updatedSubmission.dataVersion || updatedSubmission.version,
      timestamp: new Date().toISOString(),
      status: targetStatus,
      capturedBy: user.name,
      capturedByRole: user.role,
      reason: commentText || `Checker decision: ${targetStatus}`,
      values: valuesSnapshot,
      dynamicRows: dynamicSnapshot,
      templateSnapshot: tmpl,
      structuralHash: updatedSubmission.structuralHash,
      integrityHash,
    };

    const finalSubWithSnapshot: ReportSubmission = {
      ...updatedSubmission,
      dataSnapshot: valuesSnapshot,
      dynamicRowsSnapshot: dynamicSnapshot,
      integrityHash,
      historicalSnapshots: [...(updatedSubmission.historicalSnapshots || []), reviewSnapshot],
    };

    this.submissions.set(id, finalSubWithSnapshot);

    // Save to IndexedDB
    indexedDbStorage.saveDraft(finalSubWithSnapshot).catch(() => {});

    try {
      realtimeSsotEngine.publishEvent({
        eventType: 'WORKFLOW_STATUS_CHANGED',
        action: targetStatus,
        domain: 'WORKFLOW',
        entityId: id,
        topic: 'WORKFLOWS',
        actor: { id: user.id, name: user.name, role: user.role },
        summary: `Report ${sub.reportKey} ${targetStatus} by Checker ${user.name}`,
        payload: {
          submissionId: id,
          reportKey: sub.reportKey,
          status: targetStatus,
          version: finalSubWithSnapshot.version,
        },
      });
    } catch (_) {}

    auditService.log({
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: `CHECKER_${action}`,
      entityType: 'REPORT_SUBMISSION',
      entityId: id,
      correlationId: 'corr_' + id,
      details: `Checker ${user.name} (${user.department}) reviewed submission with decision: ${targetStatus}. Notes: ${commentText || 'N/A'}`,
    });

    return finalSubWithSnapshot;
  }

  /**
   * Maker delivers an approved submission to NBE via the NBEAdapter.
   * Requirement: "It's the Maker who makes the final submission of the report to the NBE."
   */
  public async deliverToNBE(id: string, user: UserSession): Promise<DeliveryResult> {
    const sub = this.submissions.get(id);
    if (!sub) throw new Error(`Submission not found: ${id}`);

    // If previously failed, allow retry; otherwise require APPROVED state
    if (sub.status !== 'FAILED') {
      const evalResult = effectiveAccessEngine.evaluateAccess(user, sub.reportKey, 'DELIVER_NBE', sub);
      if (!evalResult.allowed) {
        if (evalResult.code === 'ROLE_FORBIDDEN') {
          throw new Error(
            `Segregation of duties rule: It is the Maker who makes the final submission of the report to the NBE. Current user role: ${user.role}`
          );
        }
        throw new Error(evalResult.reason);
      }
    } else if (user.role !== 'MAKER') {
      throw new Error(
        `Segregation of duties rule: It is the Maker who makes the final submission of the report to the NBE. Current user role: ${user.role}`
      );
    }

    // Set status to SENDING
    const { updatedSubmission: sendingSub } = WorkflowEngine.applyTransition(
      sub,
      'SENDING',
      user,
      'Maker initiated final transmission to National Bank of Ethiopia'
    );
    this.submissions.set(id, sendingSub);

    auditService.log({
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: 'DELIVER_TO_NBE_START',
      entityType: 'REPORT_SUBMISSION',
      entityId: id,
      correlationId: 'corr_' + id,
      details: `Maker ${user.name} initiated transmission to NBE Portal`,
    });

    // Call adapter
    const result = await nbeAdapter.deliverReport(sendingSub);

    const finalStatus: SubmissionStatus = result.success ? 'SENT' : 'FAILED';
    const now = new Date().toISOString();
    const finalValuesSnapshot = JSON.parse(JSON.stringify(sendingSub.values));
    const finalDynamicSnapshot = JSON.parse(JSON.stringify(sendingSub.dynamicRows));
    const receiptNum = result.response?.receiptNumber || sendingSub.nbeReferenceNumber;
    const tmpl = sendingSub.templateSnapshot || this.createTemplateSnapshot(this.getEffectiveTemplate(sendingSub));
    const integrityHash = this.computeIntegrityHash({
      id: sendingSub.id,
      reportKey: sendingSub.reportKey,
      version: sendingSub.version,
      templateVersion: sendingSub.templateVersion || 1,
      values: finalValuesSnapshot,
      status: finalStatus,
    });

    const deliverySnapshot: SubmissionSnapshot = {
      snapshotId: `snap_${sendingSub.id}_v${sendingSub.version}_delivered_${Date.now()}`,
      version: sendingSub.version,
      templateVersion: sendingSub.templateVersion || 1,
      dataVersion: sendingSub.dataVersion || sendingSub.version,
      timestamp: now,
      status: finalStatus,
      capturedBy: user.name,
      capturedByRole: user.role,
      reason: result.success
        ? `Officially delivered to NBE Gateway (Receipt: ${receiptNum})`
        : `NBE Gateway transmission attempted (Status: FAILED - ${result.error})`,
      values: finalValuesSnapshot,
      dynamicRows: finalDynamicSnapshot,
      templateSnapshot: tmpl,
      structuralHash: sendingSub.structuralHash,
      integrityHash,
      nbeReferenceNumber: receiptNum,
    };

    const updatedSub: ReportSubmission = {
      ...sendingSub,
      status: finalStatus,
      submittedVersion: sendingSub.version,
      dataSnapshot: finalValuesSnapshot,
      dynamicRowsSnapshot: finalDynamicSnapshot,
      integrityHash,
      nbeReferenceNumber: receiptNum,
      updatedAt: now,
      deliveryAttempts: [...sendingSub.deliveryAttempts, result.attempt],
      historicalSnapshots: [...(sendingSub.historicalSnapshots || []), deliverySnapshot],
      comments: [
        ...sendingSub.comments,
        {
          id: 'comm_' + Math.random().toString(36).substring(2, 9),
          userId: user.id,
          userName: user.name,
          userRole: user.role as any,
          comment: result.success
            ? `Transmission to NBE confirmed. Submission Receipt Number: ${result.response?.receiptNumber || result.response?.submissionReceiptNumber}`
            : `NBE Gateway rejected delivery: ${result.error}`,
          action: result.success ? 'APPROVE' : 'NOTE',
          timestamp: new Date().toISOString(),
        },
      ],
    };

    this.submissions.set(id, updatedSub);

    // Save to IndexedDB
    indexedDbStorage.saveDraft(updatedSub).catch(() => {});

    try {
      realtimeSsotEngine.publishEvent({
        eventType: 'WORKFLOW_STATUS_CHANGED',
        action: finalStatus,
        domain: 'WORKFLOW',
        entityId: id,
        topic: 'WORKFLOWS',
        actor: { id: user.id, name: user.name, role: user.role },
        summary: `Report ${sendingSub.reportKey} delivered to NBE Gateway (Status: ${finalStatus})`,
        payload: {
          submissionId: id,
          reportKey: sendingSub.reportKey,
          status: finalStatus,
          version: updatedSub.version,
          receiptNumber: receiptNum,
        },
      });
    } catch (_) {}

    auditService.log({
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: result.success ? 'DELIVER_TO_NBE_SUCCESS' : 'DELIVER_TO_NBE_FAILURE',
      entityType: 'REPORT_SUBMISSION',
      entityId: id,
      correlationId: 'corr_' + id,
      details: result.success
        ? `NBE delivery confirmed with receipt ${result.response?.receiptNumber}`
        : `NBE delivery failed: ${result.error}`,
    });

    return result;
  }

  /**
   * Returns a historical snapshot for a submission.
   * If version is provided, returns that specific version's snapshot.
   * If not provided, returns the snapshot from final submission or latest version.
   */
  public getHistoricalSnapshot(id: string, version?: number, status?: SubmissionStatus): SubmissionSnapshot | undefined {
    const sub = this.submissions.get(id);
    if (!sub || !sub.historicalSnapshots || sub.historicalSnapshots.length === 0) {
      return undefined;
    }
    const snapshots = sub.historicalSnapshots;
    if (version !== undefined && status !== undefined) {
      for (let i = snapshots.length - 1; i >= 0; i--) {
        if (snapshots[i].version === version && snapshots[i].status === status) {
          return snapshots[i];
        }
      }
    }
    if (version !== undefined) {
      for (let i = snapshots.length - 1; i >= 0; i--) {
        if (snapshots[i].version === version) {
          return snapshots[i];
        }
      }
    }
    const targetVer = sub.submittedVersion || sub.version;
    for (let i = snapshots.length - 1; i >= 0; i--) {
      if (snapshots[i].version === targetVer) {
        return snapshots[i];
      }
    }
    return snapshots[snapshots.length - 1];
  }

  /**
   * Returns all historical snapshots for an audit or comparison view.
   */
  public getAllSnapshots(id: string): SubmissionSnapshot[] {
    const sub = this.submissions.get(id);
    return sub?.historicalSnapshots || [];
  }

  /**
   * Retrieves the exact historical data values and template schema for a specific version.
   * Guaranteed to preserve original submitted values even if live template or active catalog changes.
   */
  public getHistoricalSubmissionData(
    id: string,
    version?: number
  ): {
    values: Record<string, string | number>;
    dynamicRows: Record<number, DynamicRowRecord[]>;
    template: ReportMetadata;
    version: number;
    templateVersion: number;
    status: SubmissionStatus;
    integrityHash?: string;
  } | undefined {
    const sub = this.submissions.get(id);
    if (!sub) return undefined;

    const snapshot = this.getHistoricalSnapshot(id, version);
    if (snapshot) {
      return {
        values: JSON.parse(JSON.stringify(snapshot.values)),
        dynamicRows: JSON.parse(JSON.stringify(snapshot.dynamicRows)),
        template: this.createTemplateSnapshot(snapshot.templateSnapshot),
        version: snapshot.version,
        templateVersion: snapshot.templateVersion,
        status: snapshot.status,
        integrityHash: snapshot.integrityHash,
      };
    }

    return {
      values: JSON.parse(JSON.stringify(sub.dataSnapshot || sub.values)),
      dynamicRows: JSON.parse(JSON.stringify(sub.dynamicRowsSnapshot || sub.dynamicRows)),
      template: this.createTemplateSnapshot(this.getEffectiveTemplate(sub)),
      version: sub.version,
      templateVersion: sub.templateVersion || 1,
      status: sub.status,
      integrityHash: sub.integrityHash,
    };
  }

  /**
   * Restores a draft submission to a previous historical version
   */
  public restoreVersion(id: string, targetVersion: number, user: UserSession): ReportSubmission {
    if (user.role !== 'MAKER') {
      throw new Error(`Only Makers can restore draft versions. Current role: ${user.role}`);
    }

    const sub = this.submissions.get(id);
    if (!sub) throw new Error(`Submission not found: ${id}`);
    if (sub.status !== 'DRAFT' && sub.status !== 'CORRECTION_REQUIRED') {
      throw new Error(
        `Cannot restore version for submission in status ${sub.status}. Must be DRAFT or CORRECTION_REQUIRED.`
      );
    }

    const targetSnapshot = this.getHistoricalSnapshot(id, targetVersion);
    if (!targetSnapshot) {
      throw new Error(`Historical snapshot version ${targetVersion} not found for submission ${id}`);
    }

    return this.updateDraft(id, targetSnapshot.values, targetSnapshot.dynamicRows, user);
  }

  public getAuthorizedSubmission(id: string, user: UserSession): ReportSubmission {
    const sub = this.submissions.get(id);
    if (!sub) {
      throw new Error(`Submission not found: ${id}`);
    }
    const evalResult = effectiveAccessEngine.evaluateSubmissionAccess(user, sub, 'VIEW');
    if (!evalResult.allowed) {
      throw new Error(`Forbidden: ${evalResult.reason}`);
    }
    return sub;
  }

  public deleteSubmission(id: string, user: UserSession): boolean {
    const sub = this.submissions.get(id);
    if (!sub) {
      throw new Error(`Submission not found: ${id}`);
    }

    // Evaluate effective access engine rules
    const evalResult = effectiveAccessEngine.evaluateSubmissionAccess(user, sub, 'DELETE_DRAFT');
    if (!evalResult.allowed) {
      throw new Error(`Forbidden: ${evalResult.reason}`);
    }

    // Absolute prohibition: Submitted records must never be hard-deleted under any circumstances (Requirement 6, 7)
    const isSubmitted =
      isFinalSubmittedStatus(sub.status) ||
      sub.status === 'PENDING_CHECKER' ||
      sub.status === 'APPROVED' ||
      sub.status === 'SENT';
    if (isSubmitted) {
      throw new Error(
        `Cannot delete submission in ${sub.status} state. Under NBE Directive BSD/03/2020, submitted reports are permanent immutable records.`
      );
    }

    this.submissions.delete(id);
    indexedDbStorage.deleteDraft(id).catch(() => {});

    auditService.log({
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: 'DELETE_DRAFT',
      entityType: 'REPORT_SUBMISSION',
      entityId: id,
      correlationId: 'corr_' + id,
      details: `${user.role} ${user.name} deleted draft ${sub.reportKey} (v${sub.version})`,
    });
    return true;
  }

  /**
   * Phase 26: Calculates administrative removal impact and generates regulatory warning.
   * Enforces Requirement 8: "Any destructive Admin action requires authorization, impact warning, explicit confirmation and audit logging."
   */
  public getRemovalImpactAssessment(id: string, user: UserSession): RemovalImpactAssessment {
    const sub = this.submissions.get(id);
    if (!sub) {
      throw new Error(`Submission not found: ${id}`);
    }
    if (user.role !== 'ADMIN') {
      throw new Error('Forbidden: Only Administrators can assess regulatory removal impact.');
    }

    const report = getReportByKey(sub.reportKey);
    const reportTitle = report?.Title || sub.reportKey;
    const lState = deriveLibraryLifecycleState(sub);
    const isSubmitted =
      isFinalSubmittedStatus(sub.status) ||
      sub.status === 'PENDING_CHECKER' ||
      sub.status === 'APPROVED' ||
      sub.status === 'SENT';

    const snapshotsCount = (sub.historicalSnapshots || []).length;
    const relatedAudit = auditService.query({ entityId: id });
    const auditCount = relatedAudit.length;

    const regulatoryWarning = isSubmitted
      ? `REGULATORY RETENTION NOTICE: Return ${sub.reportKey} (v${sub.version}, status: ${sub.status}) is a submitted statutory dossier. Under NBE Directive BSD/03/2020 and Banking Supervision Record Retention Mandates, submitted regulatory records CANNOT be destroyed. Governed archiving or voiding will retain all ${snapshotsCount} historical snapshots, formulas, data rows, and audit trails while retiring the dossier from active operational workflows.`
      : `UNCOMMITTED DRAFT WARNING: Return ${sub.reportKey} is an unsubmitted draft. Permanent deletion will discard all uncommitted form fields and dynamic rows. An authoritative audit entry will be logged.`;

    return {
      submissionId: sub.id,
      reportKey: sub.reportKey,
      reportTitle,
      department: sub.department || 'Prudential Reporting',
      status: sub.status,
      lifecycleState: lState,
      version: sub.version,
      nbeReferenceNumber: sub.nbeReferenceNumber,
      isSubmittedRecord: isSubmitted,
      canHardDelete: !isSubmitted,
      governedActionRequired: isSubmitted ? 'GOVERNED_ARCHIVE_VOID' : 'HARD_DELETE_DRAFT',
      regulatoryWarning,
      affectedSnapshotsCount: snapshotsCount,
      affectedAuditEntriesCount: auditCount,
      confirmedRequired: true,
      minReasonLength: 10,
    };
  }

  /**
   * Phase 26: Governed Administrative Record Removal & Archiving Engine
   * Requirements 7 & 8:
   * "If Admin is authorized to remove submitted records, prefer archive/void/soft-delete where regulatory retention requires it. Never silently destroy regulatory history."
   * "Any destructive Admin action requires authorization, impact warning, explicit confirmation and audit logging."
   */
  public adminGovernedRemoveSubmission(
    id: string,
    user: UserSession,
    options: { action: 'ARCHIVE' | 'VOID' | 'DELETE_DRAFT'; reason: string; confirmed: boolean }
  ): GovernedRemovalResult {
    const sub = this.submissions.get(id);
    if (!sub) {
      throw new Error(`Submission not found: ${id}`);
    }

    // Role verification
    if (user.role !== 'ADMIN') {
      throw new Error('Forbidden: Only Administrator can perform governed removal or archiving.');
    }

    // Confirmation verification
    if (!options.confirmed) {
      throw new Error('Explicit confirmation is required for governed administrative removal.');
    }

    // Justification verification (min 10 chars)
    if (!options.reason || options.reason.trim().length < 10) {
      throw new Error(
        'A detailed regulatory justification of at least 10 characters is mandatory for administrative removal.'
      );
    }

    const isSubmitted =
      isFinalSubmittedStatus(sub.status) ||
      sub.status === 'PENDING_CHECKER' ||
      sub.status === 'APPROVED' ||
      sub.status === 'SENT';

    const now = new Date().toISOString();
    const reasonText = options.reason.trim();

    // If submitted record, HARD DELETE is strictly forbidden
    if (isSubmitted) {
      if (options.action === 'DELETE_DRAFT') {
        throw new Error(
          `Cannot hard-delete submitted regulatory submission ${id}. Under NBE Directive BSD/03/2020, submitted reports are permanent immutable records. Governed archiving or voiding must be used to preserve regulatory history.`
        );
      }

      const targetStatus: SubmissionStatus = options.action === 'ARCHIVE' ? 'ARCHIVED' : 'VOIDED';
      const prevStatus = sub.status;

      // Capture archival snapshot
      const valuesSnapshot = JSON.parse(JSON.stringify(sub.values || {}));
      const dynamicSnapshot = JSON.parse(JSON.stringify(sub.dynamicRows || {}));
      const tmpl =
        sub.templateSnapshot || this.createTemplateSnapshot(this.getEffectiveTemplate(sub));
      const integrityHash = this.computeIntegrityHash({
        id: sub.id,
        reportKey: sub.reportKey,
        version: sub.version,
        templateVersion: sub.templateVersion || 1,
        values: valuesSnapshot,
        status: targetStatus,
      });

      const archiveSnapshot: SubmissionSnapshot = {
        snapshotId: `snap_${sub.id}_v${sub.version}_${targetStatus.toLowerCase()}_${Date.now()}`,
        version: sub.version,
        templateVersion: sub.templateVersion || 1,
        dataVersion: sub.dataVersion || sub.version,
        timestamp: now,
        status: targetStatus,
        capturedBy: user.name,
        capturedByRole: user.role,
        reason: `${targetStatus} by Administrator: ${reasonText}`,
        values: valuesSnapshot,
        dynamicRows: dynamicSnapshot,
        templateSnapshot: tmpl,
        structuralHash: sub.structuralHash,
        integrityHash,
      };

      const updatedSub: ReportSubmission = {
        ...sub,
        status: targetStatus,
        updatedAt: now,
        isArchived: options.action === 'ARCHIVE',
        archivedAt: options.action === 'ARCHIVE' ? now : sub.archivedAt,
        archivedBy: options.action === 'ARCHIVE' ? user.id : sub.archivedBy,
        archivedByName: options.action === 'ARCHIVE' ? user.name : sub.archivedByName,
        archiveReason: options.action === 'ARCHIVE' ? reasonText : sub.archiveReason,
        isVoided: options.action === 'VOID',
        voidedAt: options.action === 'VOID' ? now : sub.voidedAt,
        voidedBy: options.action === 'VOID' ? user.id : sub.voidedBy,
        voidReason: options.action === 'VOID' ? reasonText : sub.voidReason,
        historicalSnapshots: [...(sub.historicalSnapshots || []), archiveSnapshot],
        comments: [
          ...(sub.comments || []),
          {
            id: 'comm_' + Date.now(),
            userId: user.id,
            userName: user.name,
            userRole: user.role as any,
            comment: `Governed administrative action: ${targetStatus} (Previous status: ${prevStatus}). Justification: ${reasonText}`,
            action: targetStatus as any,
            timestamp: now,
          },
        ],
      };

      this.submissions.set(id, updatedSub);
      indexedDbStorage.saveDraft(updatedSub).catch(() => {});

      const auditAction =
        options.action === 'ARCHIVE' ? 'ADMIN_ARCHIVE_SUBMISSION' : 'ADMIN_VOID_SUBMISSION';
      const auditLog = auditService.log({
        actorId: user.id,
        actorName: user.name,
        actorRole: 'ADMIN',
        action: auditAction as any,
        entityType: 'REPORT_SUBMISSION',
        entityId: id,
        correlationId: 'corr_gov_rem_' + id,
        details: `Administrator ${user.name} governed ${options.action.toLowerCase()} on submitted report ${sub.reportKey} (v${sub.version}, NBE Ref: ${sub.nbeReferenceNumber || 'N/A'}). Justification: ${reasonText}`,
      });

      try {
        realtimeSsotEngine.publishEvent({
          eventType: 'WORKFLOW_STATUS_CHANGED',
          action: targetStatus,
          domain: 'WORKFLOW',
          entityId: id,
          topic: 'WORKFLOWS',
          actor: { id: user.id, name: user.name, role: user.role },
          summary: `Report ${sub.reportKey} ${targetStatus} by Administrator ${user.name}`,
          payload: {
            submissionId: id,
            reportKey: sub.reportKey,
            status: targetStatus,
            reason: reasonText,
          },
        });
      } catch (_) {}

      return {
        success: true,
        action: options.action,
        submissionId: id,
        reportKey: sub.reportKey,
        status: targetStatus,
        message: `Submission ${id} successfully marked as ${targetStatus}. Full regulatory history and snapshots permanently retained.`,
        regulatoryAuditId: auditLog.id,
        preservedSnapshotsCount: (updatedSub.historicalSnapshots || []).length,
      };
    } else {
      // Unsubmitted draft deletion
      this.submissions.delete(id);
      indexedDbStorage.deleteDraft(id).catch(() => {});

      const auditLog = auditService.log({
        actorId: user.id,
        actorName: user.name,
        actorRole: 'ADMIN',
        action: 'ADMIN_DELETE_DRAFT' as any,
        entityType: 'REPORT_SUBMISSION',
        entityId: id,
        correlationId: 'corr_del_draft_' + id,
        details: `Administrator ${user.name} removed unsubmitted draft ${sub.reportKey} (v${sub.version}). Justification: ${reasonText}`,
      });

      return {
        success: true,
        action: 'DELETE_DRAFT',
        submissionId: id,
        reportKey: sub.reportKey,
        status: 'DRAFT',
        message: `Unsubmitted draft ${id} permanently removed by Administrator.`,
        regulatoryAuditId: auditLog.id,
        preservedSnapshotsCount: 0,
      };
    }
  }

  /**
   * Phase 26: Flag/Unflag review record with comment and audit logging.
   * Requirement 1: "Checker Library: show only authorized review records and provide view/review/comment/flag/request-correction/approve actions"
   */
  public flagSubmission(
    id: string,
    user: UserSession,
    reason: string,
    flag: boolean = true
  ): ReportSubmission {
    const sub = this.submissions.get(id);
    if (!sub) throw new Error(`Submission not found: ${id}`);

    // Access check: Checker (within review scope), Auditor, Admin
    const evalResult = effectiveAccessEngine.evaluateSubmissionAccess(user, sub, 'FLAG');
    if (!evalResult.allowed) {
      throw new Error(`Flag denied: ${evalResult.reason}`);
    }

    const now = new Date().toISOString();
    const updatedSub: ReportSubmission = {
      ...sub,
      flagged: flag,
      flagReason: flag ? reason : undefined,
      flaggedBy: flag ? user.name : undefined,
      flaggedAt: flag ? now : undefined,
      comments: [
        ...(sub.comments || []),
        {
          id: 'comm_' + Date.now(),
          userId: user.id,
          userName: user.name,
          userRole: user.role as any,
          comment: flag
            ? `[FLAGGED FOR ATTENTION] Reason: ${reason}`
            : `[FLAG CLEARED] Reason: ${reason}`,
          action: 'FLAG' as any,
          timestamp: now,
        },
      ],
      updatedAt: now,
    };

    this.submissions.set(id, updatedSub);
    indexedDbStorage.saveDraft(updatedSub).catch(() => {});

    auditService.log({
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: (flag ? 'FLAG_SUBMISSION' : 'UNFLAG_SUBMISSION') as any,
      entityType: 'REPORT_SUBMISSION',
      entityId: id,
      correlationId: 'corr_flag_' + id,
      details: `${user.role} ${user.name} ${flag ? 'flagged' : 'unflagged'} submission ${sub.reportKey}. Notes: ${reason}`,
    });

    return updatedSub;
  }

  /**
   * Phase 26: Add review/audit comment to submission.
   */
  public addSubmissionComment(
    id: string,
    user: UserSession,
    commentText: string,
    category: 'GENERAL' | 'AUDIT' | 'CHECKER_QUERY' | 'CORRECTION_NOTE' = 'GENERAL'
  ): ReportSubmission {
    const sub = this.submissions.get(id);
    if (!sub) throw new Error(`Submission not found: ${id}`);

    const evalResult = effectiveAccessEngine.evaluateSubmissionAccess(user, sub, 'COMMENT');
    if (!evalResult.allowed) {
      throw new Error(`Comment denied: ${evalResult.reason}`);
    }

    const now = new Date().toISOString();
    const updatedSub: ReportSubmission = {
      ...sub,
      comments: [
        ...(sub.comments || []),
        {
          id: 'comm_' + Date.now(),
          userId: user.id,
          userName: user.name,
          userRole: user.role as any,
          comment: `[${category}] ${commentText}`,
          action: 'COMMENT' as any,
          timestamp: now,
        },
      ],
      updatedAt: now,
    };

    this.submissions.set(id, updatedSub);
    indexedDbStorage.saveDraft(updatedSub).catch(() => {});

    auditService.log({
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: 'ADD_COMMENT' as any,
      entityType: 'REPORT_SUBMISSION',
      entityId: id,
      correlationId: 'corr_comment_' + id,
      details: `${user.role} ${user.name} commented on ${sub.reportKey} [${category}]: ${commentText}`,
    });

    return updatedSub;
  }

  /**
   * Authoritative Library Query Engine (Requirement 1, 2, 4, 5, 7, 9, 10)
   * Enforces backend server-side permission filtering across all 4 roles:
   * - MAKER: ownership, department boundary, report types, special access grants
   * - CHECKER: authorized review records, department matching, linked depts, special access
   * - AUDITOR: institutional read-only inspection visibility
   * - ADMIN: comprehensive institutional monitoring & governed lifecycle oversight
   */
  public queryLibrary(user: UserSession, options: LibraryFilterOptions = {}): LibraryQueryResult {
    const {
      search = '',
      lifecycleState = 'ALL',
      status = 'ALL',
      reportType,
      frequency,
      startDate,
      endDate,
      sortBy = 'updatedAt',
      sortOrder = 'desc',
      page = 1,
      pageSize = 10,
    } = options;

    // 1. Authoritative Backend Access Control (Requirement 4, 5, 10)
    // Never fetch all records and hide unauthorized records only in the frontend.
    const all = this.getAll();
    let authorized: ReportSubmission[] = [];

    if (user.role === 'ADMIN' || user.role === 'AUDITOR') {
      // Oversight roles have visibility across all institutional records
      authorized = all;
    } else if (user.role === 'MAKER') {
      // Maker ONLY sees records within their authorized scope:
      // Allowed report types (home dept + M:N linked + direct assignment + special access)
      const allowedKeys = new Set(userService.getAllowedReportKeysForUser(user));
      const userDept = (user.department || '').trim().toLowerCase();

      authorized = all.filter((s) => {
        // Must be an authorized report type
        if (!allowedKeys.has(s.reportKey)) return false;
        // Must either be owned by the user, or belong to user's department, or covered by active special access
        const isOwner = s.makerId === user.id;
        const isDept = s.department && s.department.trim().toLowerCase() === userDept;
        const hasSpecial = user.specialAccessGrants?.some((g) => {
          const { active } = effectiveAccessEngine.isGrantActive(g);
          if (!active) return false;
          if (g.scope === 'ALL_REPORTS') return true;
          if (g.reportKey && g.reportKey.toLowerCase() === s.reportKey.toLowerCase()) return true;
          if (
            g.department &&
            s.department &&
            g.department.toLowerCase() === s.department.toLowerCase()
          )
            return true;
          if (
            Array.isArray(g.departments) &&
            s.department &&
            g.departments.some((d) => d.toLowerCase() === s.department!.toLowerCase())
          )
            return true;
          return false;
        });
        return isOwner || isDept || hasSpecial;
      });
    } else if (user.role === 'CHECKER') {
      // Checker ONLY sees authorized review records within Checker's authorized scope
      const userDept = (user.department || '').trim().toLowerCase();

      authorized = all.filter((s) => {
        const report = getReportByKey(s.reportKey);
        const ssotReport = configService.getReportDefinition(s.reportKey);
        const defaultDept = ssotReport?.defaultDepartmentId
          ? configService.getDepartmentById(ssotReport.defaultDepartmentId)
          : null;
        const reportPrimaryDept = (
          s.department ||
          report?.department ||
          defaultDept?.name ||
          getDepartmentForReport(s.reportKey) ||
          ''
        )
          .trim()
          .toLowerCase();

        const linkedDepts = departmentService.getDepartmentsForReport(s.reportKey);
        const configLinkedDepts = (ssotReport?.departmentIds || []).map((id) => {
          const d = configService.getDepartmentById(id);
          return (d ? d.name : id).trim().toLowerCase();
        });
        const isHomeDept = Boolean(
          userDept &&
            (userDept === reportPrimaryDept ||
              (s.department && userDept === s.department.toLowerCase()))
        );
        const isLinkedDept = Boolean(
          userDept &&
            (linkedDepts.some((d) => d.toLowerCase() === userDept) ||
              configLinkedDepts.includes(userDept))
        );
        const directAssignments = effectiveAccessEngine.getUserDirectReportAssignments(user.id);
        const isDirectAssignment = directAssignments.includes(s.reportKey);

        const hasSpecial = user.specialAccessGrants?.some((g) => {
          const { active } = effectiveAccessEngine.isGrantActive(g);
          if (!active) return false;
          if (g.scope === 'ALL_REPORTS') return true;
          if (g.reportKey && g.reportKey.toLowerCase() === s.reportKey.toLowerCase()) return true;
          if (
            g.department &&
            (g.department.toLowerCase() === reportPrimaryDept ||
              (s.department && g.department.toLowerCase() === s.department.toLowerCase()))
          )
            return true;
          if (
            Array.isArray(g.departments) &&
            g.departments.some(
              (d) =>
                d.toLowerCase() === reportPrimaryDept ||
                (s.department && d.toLowerCase() === s.department.toLowerCase())
            )
          )
            return true;
          return false;
        });

        const hasAuthority = isHomeDept || isLinkedDept || isDirectAssignment || hasSpecial;
        return hasAuthority;
      });
    } else {
      authorized = [];
    }

    // 2. Compute authoritative stats on ALL authorized records before narrowing by search/filters
    const stats = {
      all: authorized.length,
      draft: 0,
      inProgress: 0,
      returned: 0,
      submitted: 0,
      reusedCopy: 0,
      archived: 0,
      voided: 0,
    };

    for (const sub of authorized) {
      const lState = deriveLibraryLifecycleState(sub);
      if (lState === 'DRAFT') stats.draft++;
      else if (lState === 'IN_PROGRESS') stats.inProgress++;
      else if (lState === 'RETURNED') stats.returned++;
      else if (lState === 'SUBMITTED') stats.submitted++;
      else if (lState === 'REUSED_COPY') stats.reusedCopy++;
      else if (lState === 'ARCHIVED') stats.archived++;
      else if (lState === 'VOIDED') stats.voided++;
    }

    // 3. Filter by search query (server-side, operates strictly on authorized records)
    let filtered = authorized;
    const q = search.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter((s) => {
        const report = getReportByKey(s.reportKey);
        const title = report?.Title?.toLowerCase() || '';
        const desc = report?.Description?.toLowerCase() || '';
        const cat = report?.Category?.toLowerCase() || '';
        const rKey = s.reportKey.toLowerCase();
        const maker = (s.makerName || '').toLowerCase();
        const nbeRef = (s.nbeReferenceNumber || '').toLowerCase();
        const dept = (s.department || '').toLowerCase();
        const subId = s.id.toLowerCase();

        return (
          subId.includes(q) ||
          rKey.includes(q) ||
          title.includes(q) ||
          desc.includes(q) ||
          cat.includes(q) ||
          maker.includes(q) ||
          nbeRef.includes(q) ||
          dept.includes(q)
        );
      });
    }

    // 4. Filter by lifecycle state
    if (lifecycleState && lifecycleState !== 'ALL') {
      filtered = filtered.filter((s) => deriveLibraryLifecycleState(s) === lifecycleState);
    }

    // 5. Filter by raw status
    if (status && status !== 'ALL') {
      filtered = filtered.filter((s) => s.status === status);
    }

    // 6. Filter by reportType / category
    if (reportType && reportType !== 'ALL') {
      filtered = filtered.filter((s) => {
        if (s.reportKey === reportType) return true;
        const report = getReportByKey(s.reportKey);
        return report?.Category === reportType || report?.department === reportType;
      });
    }

    // 7. Filter by frequency
    if (frequency && frequency !== 'ALL') {
      filtered = filtered.filter((s) => {
        const report = getReportByKey(s.reportKey);
        return report?.Frequency === frequency;
      });
    }

    // 8. Filter by date range
    if (startDate) {
      const startMs = new Date(startDate).getTime();
      filtered = filtered.filter((s) => new Date(s.updatedAt || s.createdAt).getTime() >= startMs);
    }
    if (endDate) {
      const endMs = new Date(endDate).getTime() + 86400000; // inclusive of whole day
      filtered = filtered.filter((s) => new Date(s.updatedAt || s.createdAt).getTime() <= endMs);
    }

    // 9. Sorting
    filtered.sort((a, b) => {
      let valA: any;
      let valB: any;
      switch (sortBy) {
        case 'createdAt':
          valA = new Date(a.createdAt).getTime();
          valB = new Date(b.createdAt).getTime();
          break;
        case 'reportKey':
          valA = a.reportKey;
          valB = b.reportKey;
          break;
        case 'title':
          valA = getReportByKey(a.reportKey)?.Title || a.reportKey;
          valB = getReportByKey(b.reportKey)?.Title || b.reportKey;
          break;
        case 'status':
          valA = a.status;
          valB = b.status;
          break;
        case 'version':
          valA = a.version;
          valB = b.version;
          break;
        case 'updatedAt':
        default:
          valA = new Date(a.updatedAt || a.createdAt).getTime();
          valB = new Date(b.updatedAt || b.createdAt).getTime();
          break;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    // 10. Server-side Pagination
    const total = filtered.length;
    const p = Math.max(1, Number(page) || 1);
    const sz = Math.max(1, Number(pageSize) || 10);
    const totalPages = Math.max(1, Math.ceil(total / sz));
    const startIdx = (p - 1) * sz;
    const items = filtered.slice(startIdx, startIdx + sz);

    return {
      items,
      total,
      page: p,
      pageSize: sz,
      totalPages,
      stats,
    };
  }

  /**
   * Synchronizes all locally persisted drafts in IndexedDB with the central server.
   */
  public async syncPendingDraftsWithServer(): Promise<{ syncedCount: number; error?: string }> {
    try {
      const pending = await indexedDbStorage.getPendingDrafts();
      if (pending.length === 0) {
        return { syncedCount: 0 };
      }

      const res = await fetch('/api/regulatory/submissions/batch-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissions: pending }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Sync failed' }));
        return { syncedCount: 0, error: err.error || 'Server rejected batch sync' };
      }

      const data = await res.json();
      const syncedIds = pending.map((p) => p.id);
      await indexedDbStorage.markDraftsAsSynced(syncedIds);

      // Re-hydrate local cache from server response
      if (Array.isArray(data.submissions)) {
        for (const sub of data.submissions) {
          this.submissions.set(sub.id, sub);
        }
      }

      return { syncedCount: pending.length };
    } catch (err: any) {
      return { syncedCount: 0, error: err.message };
    }
  }

  public renameDepartment(oldName: string, newName: string): number {
    let affected = 0;
    const oldNorm = oldName.trim().toLowerCase();
    for (const sub of this.submissions.values()) {
      if (sub.department && sub.department.trim().toLowerCase() === oldNorm) {
        sub.department = newName;
        affected++;
      }
      if (sub.makerDepartment && sub.makerDepartment.trim().toLowerCase() === oldNorm) {
        sub.makerDepartment = newName;
      }
      if (sub.checkerDepartment && sub.checkerDepartment.trim().toLowerCase() === oldNorm) {
        sub.checkerDepartment = newName;
      }
    }
    return affected;
  }

  public reassignDepartment(fromDept: string, toDept: string): number {
    let affected = 0;
    const fromNorm = fromDept.trim().toLowerCase();
    for (const sub of this.submissions.values()) {
      if (sub.department && sub.department.trim().toLowerCase() === fromNorm) {
        sub.department = toDept;
        affected++;
      }
    }
    return affected;
  }
}

export const submissionService = new SubmissionServiceClass();
userService.setSubmissionProvider(submissionService);
departmentService.setSubmissionProvider(submissionService);
departmentService.setUserProvider(userService);
configService.setSubmissionProvider(submissionService);
configService.setUserProvider(userService);
