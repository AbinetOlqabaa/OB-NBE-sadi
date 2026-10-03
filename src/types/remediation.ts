/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type RemediationSeverity = 'BLOCKING_ERROR' | 'WARNING' | 'INFO';

export type RemediationCategory =
  | 'DATA_ERROR'                  // User-entered value/row violation (remedied by report Maker)
  | 'REPORT_DEFINITION_ERROR'     // Report template definition / metadata / formula configuration issue (Admin only)
  | 'BUSINESS_RULE_ERROR'         // Multi-item consistency / regulatory cross-field directive rule violation
  | 'NBE_GATEWAY_ERROR';          // Format rejection expected by NBE Gateway parser

export type RemediationConstraintType =
  | 'MANDATORY'
  | 'CURRENCY_PRECISION'
  | 'CURRENCY_NEGATIVE'
  | 'RANGE'
  | 'FORMAT'
  | 'TYPE_MISMATCH'
  | 'FORMULA_OUT_OF_SYNC'
  | 'CROSS_FIELD_RULE'
  | 'SCHEMA_STRUCTURAL';

export interface ExplanationDetails {
  whatIsWrong: string;    // WHAT IS WRONG: Clear statement of the exact invalid condition
  whyItMatters: string;   // WHY IT MATTERS: Regulatory and business consequence (NBE directive citation)
  howToFix: string;       // HOW TO FIX IT: Concrete actionable steps for the user
  expectedFormat: string; // WHAT IS EXPECTED: The exact format, range, or value syntax expected
}

export interface ProposedFix {
  targetField: string;
  targetPath?: string; // for dynamic rows e.g. "1:row_id:COL"
  areaId?: number;
  rowId?: string;
  currentValue: any;
  proposedValue: any;
  description: string;
  isDeterministic: boolean;
  requiresReview: boolean; // if true, must show CURRENT -> PROPOSED before applying
  ruleSource: string;
}

export interface NormalizedValidationItem {
  id: string;
  severity: RemediationSeverity;
  category: RemediationCategory;
  constraintType: RemediationConstraintType;
  fieldCode: string;
  fieldTitle: string;
  path?: string; // "Code" or "Area:RowId:ColCode"
  areaId?: number;
  rowId?: string;
  rowIndex?: number;
  message: string;
  explanation: ExplanationDetails;
  suggestedAction: string;
  ruleSource: string;
  autoFixable: boolean;
  proposedFix?: ProposedFix;
}

export interface NormalizedValidationSummary {
  isValid: boolean;
  isSubmissionReady: boolean;
  blockingErrorsCount: number;
  warningsCount: number;
  autoFixableCount: number;
  dataErrorsCount: number;
  reportDefinitionErrorsCount: number;
  businessRuleErrorsCount: number;
  items: NormalizedValidationItem[];
  timestamp: string;
}

export interface RemediationAuditEvent {
  action: 'VALIDATION_REMEDIATION_APPLIED';
  actorId: string;
  actorName: string;
  actorRole: string;
  submissionId: string;
  reportKey: string;
  fieldCode: string;
  path?: string;
  remediationType: string;
  ruleSource: string;
  wasDeterministic: boolean;
  appliedAt: string;
  safeMetadata: {
    fieldCode: string;
    ruleSource: string;
    remediationType: string;
    valueType: string;
    redactedValueNotice: string;
  };
}
