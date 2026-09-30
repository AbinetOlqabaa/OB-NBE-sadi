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
} from '../types/regulatory.ts';
import { getReportByKey } from '../data/report-registry.ts';
import { getDepartmentForReport } from '../data/organizationHierarchy.ts';
import { WorkflowEngine } from './workflowEngine.ts';
import { FormulaEngine } from '../utils/formulaEngine.ts';
import { ValidationEngine } from '../utils/validationEngine.ts';
import type { ValidationSummary } from '../utils/validationEngine.ts';
import { nbeAdapter } from './nbeAdapter.ts';
import type { DeliveryResult } from './nbeAdapter.ts';
import { auditService } from './auditService.ts';
import { userService } from './userService.ts';
import { departmentService } from './departmentService.ts';
import { configService } from './configService.ts';
import { indexedDbStorage } from './indexedDbStorage.ts';

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

  constructor() {
    this.seedInitialSubmissions();
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
  public createSubmission(reportKey: string, user: UserSession): ReportSubmission {
    if (user.role !== 'MAKER') {
      throw new Error(
        `Role violation: Only registered Makers can create report drafts. Current role: ${user.role}`
      );
    }

    const report = getReportByKey(reportKey);
    if (!report) {
      throw new Error(`Report template not found for key: ${reportKey}`);
    }

    const reportDept = report.department || getDepartmentForReport(report.ReturnKey);

    // Verify Maker department / special access authorization
    const isAuthorized = userService.canMakerAccessReport(user, report.ReturnKey);
    if (!isAuthorized) {
      throw new Error(
        `Department restriction: Your department (${user.department || 'Unassigned'}) is not authorized to prepare return "${report.Title}" (${report.ReturnKey}). This return belongs to "${reportDept}". Contact Administrator for Special Cross-Department Access.`
      );
    }

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
    const initialValuesCopy = JSON.parse(JSON.stringify(initialValues));
    const initialDynamicCopy = JSON.parse(JSON.stringify(initialDynamicRows));
    const integrityHash = this.computeIntegrityHash({
      id,
      reportKey: report.ReturnKey,
      version: 1,
      templateVersion: 1,
      values: initialValuesCopy,
      status: 'DRAFT',
    });

    const initialSnapshot: SubmissionSnapshot = {
      snapshotId: `snap_${id}_v1_${Date.now()}`,
      version: 1,
      templateVersion: 1,
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
      templateVersion: 1,
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

    const isOnline = typeof navigator !== 'undefined' ? Boolean(navigator.onLine) : true;
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
   * Enforces: Checkers and Admins CANNOT modify report draft data!
   */
  public updateDraft(
    id: string,
    values: Record<string, string | number>,
    dynamicRows: Record<number, DynamicRowRecord[]>,
    user: UserSession
  ): ReportSubmission {
    if (user.role !== 'MAKER') {
      throw new Error(
        `Role violation: Only authorized Makers can edit report draft data. User role "${user.role}" is restricted from data modifications.`
      );
    }

    const sub = this.submissions.get(id);
    if (!sub) throw new Error(`Submission not found: ${id}`);

    if (sub.status !== 'DRAFT' && sub.status !== 'CORRECTION_REQUIRED') {
      throw new Error(`Cannot modify submission in status ${sub.status}`);
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

    const isOnline = typeof navigator !== 'undefined' ? Boolean(navigator.onLine) : true;
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

    return updated;
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
   * Maker submits report to Checker.
   */
  public submitToChecker(id: string, user: UserSession, commentText?: string): ReportSubmission {
    if (user.role !== 'MAKER') {
      throw new Error('Only the Maker who prepared the report can submit it to the Checker.');
    }

    const sub = this.submissions.get(id);
    if (!sub) throw new Error(`Submission not found: ${id}`);

    // Pre-submission validation gate
    const valSummary = this.validateSubmission(id);
    if (!valSummary.isValid) {
      throw new Error(
        `Validation failed with ${valSummary.errorsCount} errors. Please correct all validation issues before submitting to Checker.`
      );
    }

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
      reason: commentText || 'Submitted to Checker for 4-eyes review',
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

    auditService.log({
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: 'SUBMIT_TO_CHECKER',
      entityType: 'REPORT_SUBMISSION',
      entityId: id,
      correlationId: 'corr_' + id,
      details: `Submission submitted for 4-eyes review by Maker ${user.name} (${user.department})`,
    });

    return finalSubWithSnapshot;
  }

  /**
   * Checker reviews submission (Approve, Reject, Request Correction).
   * Enforces:
   * 1. Only CHECKERS can review. (Makers cannot approve; Admins are read-only).
   * 2. Checker must be from the same department, OR have Admin-granted special access.
   */
  public reviewSubmission(
    id: string,
    action: 'APPROVE' | 'REJECT' | 'REQUEST_CORRECTION',
    user: UserSession,
    commentText?: string
  ): ReportSubmission {
    const sub = this.submissions.get(id);
    if (!sub) throw new Error(`Submission not found: ${id}`);

    // Department & Segregation Verification
    const checkAuth = userService.canCheckerReviewSubmission(user, sub);
    if (!checkAuth.allowed) {
      throw new Error(`Review denied: ${checkAuth.reason}`);
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
    if (user.role !== 'MAKER') {
      throw new Error(
        `Segregation of duties rule: It is the Maker who makes the final submission of the report to the NBE. Current user role: ${user.role}`
      );
    }

    const sub = this.submissions.get(id);
    if (!sub) throw new Error(`Submission not found: ${id}`);

    if (sub.status !== 'APPROVED' && sub.status !== 'FAILED') {
      throw new Error(`Only APPROVED or FAILED submissions can be delivered to NBE. Current: ${sub.status}`);
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

  public deleteSubmission(id: string, user: UserSession): boolean {
    const sub = this.submissions.get(id);
    if (!sub) return false;

    if (sub.status !== 'DRAFT' && sub.status !== 'CORRECTION_REQUIRED' && sub.status !== 'FAILED' && user.role !== 'ADMIN') {
      throw new Error(`Cannot delete submission in ${sub.status} state. Only drafts can be deleted.`);
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
      details: `${user.role} ${user.name} deleted draft ${sub.reportKey}`,
    });
    return true;
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
