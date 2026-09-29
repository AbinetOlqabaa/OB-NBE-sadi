/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type DataType = "NUMERIC" | "TEXT" | "DATE";

export type ReportingFrequency = "MONTHLY" | "QUARTERLY" | "ANNUAL";

export type SubmissionStatus =
  | "DRAFT"
  | "PENDING_CHECKER"
  | "CORRECTION_REQUIRED"
  | "REJECTED"
  | "APPROVED"
  | "SENDING"
  | "SENT"
  | "FAILED";

export interface ReportItemDefinition {
  Code: string;
  Value: string | number;
  _description: string;
  _dataType: DataType;
  _required: boolean;
  section?: string;
  category?: string;
  isTotal?: boolean;
}

export interface DynamicColumnDefinition {
  Code: string;
  Value: string | number;
  _description: string;
  _dataType: DataType;
  _required: boolean;
}

export interface DynamicAreaDefinition {
  Area: number;
  _areaName: string;
  DynamicItems: DynamicColumnDefinition[];
}

export interface FormulaDefinition {
  targetCode: string;
  expression: string;
  description: string;
  dependencies: string[];
}

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  severity: "ERROR" | "WARNING";
  check: (values: Record<string, string | number>, dynamicRows?: Record<number, Record<string, any>[]>) => boolean;
}

export interface SpecialAccessGrant {
  id: string;
  reportKey?: string;
  department?: string;
  departments?: string[];
  grantedBy: string;
  grantedAt: string;
  reason: string;
  expiresAt?: string;
}

export interface ReportMetadata {
  ReturnKey: string;
  Code: string; // short code e.g. POBEPE001, M_LCPLC001
  Title: string;
  Category: "Credit & Lending" | "Classification & Provisioning" | "Exposures & Concentration" | "Assets & Collateral" | "Restructuring" | "Sector Breakdown";
  department?: string;
  departments?: string[]; // M:N department linkages
  Frequency: ReportingFrequency;
  InstCode: string;
  FinYear: number;
  StartDate: string;
  EndDate: string;
  Description: string;
  ReturnItemsList: ReportItemDefinition[];
  DynamicItemsList: DynamicAreaDefinition[];
  Formulas: FormulaDefinition[];
  ValidationRules: ValidationRule[];
  SourceFilename: string;
  SourceHash: string;
  isCustom?: boolean;
}

export interface ReportValueRecord {
  code: string;
  value: string | number;
  calculated?: boolean;
}

export interface DynamicRowRecord {
  id: string;
  areaId: number;
  values: Record<string, string | number>;
}

export interface SubmissionSnapshot {
  snapshotId: string;
  version: number;
  templateVersion: number;
  dataVersion?: number;
  timestamp: string;
  status: SubmissionStatus;
  capturedBy: string;
  capturedByRole?: string;
  reason: string;
  values: Record<string, string | number>;
  dynamicRows: Record<number, DynamicRowRecord[]>;
  templateSnapshot: ReportMetadata;
  structuralHash?: string;
  integrityHash?: string;
  nbeReferenceNumber?: string;
}

export interface ReportSubmission {
  id: string;
  reportKey: string;
  department?: string;
  periodYear: number;
  periodStart: string;
  periodEnd: string;
  institutionCode: string;
  status: SubmissionStatus;
  version: number;
  templateVersion: number;
  dataVersion?: number;
  submittedVersion?: number;
  templateSnapshot?: ReportMetadata;
  dataSnapshot?: Record<string, string | number>;
  dynamicRowsSnapshot?: Record<number, DynamicRowRecord[]>;
  historicalSnapshots?: SubmissionSnapshot[];
  structuralHash?: string;
  integrityHash?: string;
  revisionHistory?: Array<{
    version: number;
    modifiedAt: string;
    modifiedBy: string;
    modifiedByRole?: string;
    values: Record<string, string | number>;
    dynamicRows: Record<number, DynamicRowRecord[]>;
    reason?: string;
    templateSnapshot?: ReportMetadata;
    integrityHash?: string;
  }>;
  values: Record<string, string | number>;
  dynamicRows: Record<number, DynamicRowRecord[]>;
  makerId: string;
  makerName: string;
  makerEmail: string;
  makerDepartment?: string;
  checkerId?: string;
  checkerName?: string;
  checkerEmail?: string;
  checkerDepartment?: string;
  comments: SubmissionComment[];
  deliveryAttempts: DeliveryAttempt[];
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  reviewedAt?: string;
  approvedAt?: string;
  finalSubmittedAt?: string;
  finalSubmittedBy?: string;
  nbeReferenceNumber?: string;
  idempotencyKey?: string;
  syncStatus?: OfflineSyncStatus;
  isOfflineDraft?: boolean;
  offlineSavedAt?: string;
}

export type OfflineSyncStatus = "SYNCED" | "PENDING_SYNC" | "LOCAL_DRAFT";

export interface OfflineStorageStats {
  draftCount: number;
  auditCount: number;
  pendingDrafts: number;
  pendingAuditLogs: number;
  isIndexedDBSupported: boolean;
  storageName: string;
  lastSyncTimestamp: string | null;
  estimatedSizeBytes?: number;
}

export interface SubmissionComment {
  id: string;
  userId: string;
  userName: string;
  userRole: "MAKER" | "CHECKER" | "ADMIN";
  comment: string;
  action: "SUBMIT" | "APPROVE" | "REJECT" | "REQUEST_CORRECTION" | "SAVE_DRAFT" | "NOTE";
  timestamp: string;
}

export interface DeliveryAttempt {
  id: string;
  timestamp: string;
  endpointUrl: string;
  status: "SUCCESS" | "FAILED" | "TIMEOUT" | "REJECTED";
  statusCode: number;
  correlationId: string;
  idempotencyKey: string;
  requestPayload: any;
  responsePayload: any;
  error?: string;
  attemptNumber: number;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  correlationId: string;
  oldState?: any;
  newState?: any;
  details: string;
  syncStatus?: 'SYNCED' | 'PENDING_SYNC';
  isOfflineRecord?: boolean;
  persistedAt?: string;
}

export interface UserSession {
  id: string;
  name: string;
  email: string;
  role: "MAKER" | "CHECKER" | "ADMIN" | "NBE_OFFICER" | "AUDITOR";
  institutionCode: string;
  status?: "ACTIVE" | "PENDING_APPROVAL" | "DISABLED";
  department?: string;
  employeeId?: string;
  specialAccessGrants?: SpecialAccessGrant[];
}

export interface SimulationScenarioConfig {
  mode: "ALWAYS_SUCCESS" | "VALIDATION_FAILURE" | "AUTH_FAILURE" | "TIMEOUT" | "SERVER_ERROR" | "RANDOM_FLAKY";
  failureRatePercent: number;
  latencyMs: number;
}

export interface Phase2DataSource {
  id: string;
  name: string;
  type: "CORE_BANKING" | "ERP" | "TREASURY" | "LOAN_ORIGINATION";
  status: "CONNECTED" | "SYNCING" | "IDLE" | "ERROR";
  lastIngestionTime?: string;
  recordCount: number;
  qualityScore: number;
}

export type AuditFindingSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';
export type AuditFindingStatus = 'OPEN' | 'UNDER_REVIEW' | 'REMEDIATION_PENDING' | 'RESOLVED' | 'CLOSED' | 'ACCEPTED_RISK';
export type AuditNoteCategory = 'OBSERVATION' | 'METHODOLOGY' | 'RISK_NOTE' | 'INQUIRY';
export type RemediationStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE' | 'VERIFIED_BY_AUDITOR';

export interface AuditFinding {
  id: string;
  submissionId: string;
  reportKey: string;
  department: string;
  title: string;
  description: string;
  severity: AuditFindingSeverity;
  status: AuditFindingStatus;
  regulatoryReference?: string;
  affectedField?: string;
  financialVariance?: number;
  auditorId: string;
  auditorName: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEvidence {
  id: string;
  submissionId: string;
  reportKey: string;
  findingId?: string;
  title: string;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  sha256Checksum: string;
  tamperSeal: string;
  verificationStatus: 'VERIFIED' | 'PENDING_REVIEW' | 'FLAGGED';
  uploadedBy: string;
  uploadedAt: string;
  notes?: string;
}

export interface AuditWorkingNote {
  id: string;
  submissionId: string;
  reportKey: string;
  category: AuditNoteCategory;
  authorId: string;
  authorName: string;
  content: string;
  isPrivate: boolean;
  createdAt: string;
}

export interface RemediationAction {
  id: string;
  findingId: string;
  actionPlan: string;
  assignedDepartment: string;
  assignedTo: string;
  targetDate: string;
  status: RemediationStatus;
  remediationProof?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  createdAt: string;
}

export interface AuditReportPackage {
  id: string;
  title: string;
  period: string;
  scopeDepartments: string[];
  generatedBy: string;
  findingsCount: number;
  criticalCount: number;
  highCount: number;
  executiveSummary: string;
  tamperSeal: string;
  createdAt: string;
}

export interface AuditWorkQueueItem {
  submissionId: string;
  reportKey: string;
  department: string;
  makerName: string;
  version: number;
  submissionStatus: SubmissionStatus;
  submittedAt?: string;
  nbeReference?: string;
  auditStatus: 'IN_DRAFTING' | 'IN_CHECKER_REVIEW' | 'CHECKER_APPROVED' | 'NBE_DELIVERED_PENDING_AUDIT' | 'FINDINGS_OPEN' | 'FLAGGED_HIGH_RISK';
  totalFindings: number;
  openFindings: number;
  criticalFindings: number;
  highFindings: number;
  evidenceCount: number;
  notesCount: number;
  pendingRemediations: number;
  updatedAt: string;
}

