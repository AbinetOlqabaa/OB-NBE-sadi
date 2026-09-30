# 04 - DYNAMIC REPORT DEFINITION AND TEMPLATE MANAGEMENT
**Application**: Oromia Bank NBE Regulatory Reporting Platform  
**Compliance Authority**: National Bank of Ethiopia (Bank Supervision Directorate)  
**Licensed Institution**: Oromia Bank S.C. (InstCode: `0000013`)  
**Phase**: Phase 4 — Dynamic Report Definition & Template Management  
**Status**: ACTIVE & AUTHORITATIVE  

---

## 1. Executive Summary & Regulatory Purpose

The Dynamic Report Definition and Template Management subsystem empowers Oromia Bank to evolve regulatory reporting structures, statutory returns, and schedule templates without requiring software developers to hard-code schema changes for every new NBE circular or directive.

### Core Architectural Mandates:
1. **Preserve Baseline Statutory Catalog**: All 24 statutory NBE prudential returns are preserved with exact central bank payload semantics and field calculations.
2. **Metadata-Driven Structure**: Declarative representation of return identity, ownership, sections, balance fields, dynamic breakdown columns, rows, calculation formulas, and validation rules.
3. **Immutable Versioning Lifecycle**: `Draft` → `Validate` → `Preview` → `Publish` → `Active` → `Retired`. Published report versions used by historical submissions are strictly immutable to maintain legal and regulatory reproducibility.
4. **Authoritative DFS Validation**: Cycle detection via Depth-First Search (DFS) ensures calculation graphs have no circular dependencies before versions are published.
5. **Segregation of Duties & 4-Eyes Control**: Maker drafts, Checker verifies, Auditor inspects, and Admin configures.

---

## 2. Report Definition Data Contract (SSOT)

```typescript
export interface ReportDefinitionSSOT {
  id: string;
  returnKey: string;           // Canonical identifier e.g. "LOA_PORT_EP001"
  code: string;                // Short identifier e.g. "EP001"
  name: string;                // Full statutory title
  description: string;         // Directive reference and scope
  category: string;            // Credit & Lending, Assets & Collateral, etc.
  frequency: ReportFrequency;  // MONTHLY, QUARTERLY, ANNUAL, ON_DEMAND
  status: ReportStatus;        // ACTIVE, DRAFT, RETIRED, INACTIVE
  instCode: string;            // "0000013" (Oromia Bank)
  finYear: number;             // Ethiopian/Gregorian fiscal year
  defaultDepartmentId: string; // Owning department ID e.g. "dept_credit_ops"
  departmentIds: string[];     // M:N authorized department linkages
  currentVersion: number;      // Latest published version number
  effectiveFrom: string;       // ISO 8601 timestamp
  effectiveTo: string | null;  // Retirement timestamp (if applicable)
  nbeMapping?: Record<string, any>;
  displayConfiguration?: Record<string, any>;
  activeVersionSnapshot?: ReportVersionSSOT;
}
```

---

## 3. Structural Versioning Contract

```typescript
export interface ReportVersionSSOT {
  versionId: string;
  reportKey: string;
  versionNumber: number;
  status: 'DRAFT' | 'VALIDATED' | 'PREVIEW' | 'PUBLISHED' | 'ACTIVE' | 'SUPERSEDED' | 'RETIRED';
  effectiveFrom: string;
  effectiveTo: string | null;
  changelogSummary: string;
  createdBy: string;
  createdAt: string;
  publishedAt?: string | null;
  sections: ReportSectionSSOT[];
  fields: ReportFieldSSOT[];
  columns: ReportColumnSSOT[];
  rows: ReportRowSSOT[];
  formulas: FormulaDefinition[];
  validationRules: ValidationRule[];
  nbeMapping?: Record<string, any>;
}
```

---

## 4. Lifecycle State Machine

1. **DRAFT**: Created when adding a new template or initiating a version bump on an existing template. Editable in the Administrator Template Studio.
2. **VALIDATED**: State achieved after passing structural checks:
   - Field code uniqueness across all return items.
   - Column key uniqueness across dynamic schedules.
   - Formula dependency resolution: all referenced fields must exist.
   - DFS topological cycle detection: calculation graph must be a Directed Acyclic Graph (DAG).
3. **PREVIEW**: Generates an immediate in-memory `ReportMetadata` preview to simulate Maker form entry.
4. **ACTIVE (Published)**: Authoritatively promoted. Supersedes any previous active version by setting `effectiveTo = now` and updating `currentVersion`. Synchronizes immediately with the active regulatory catalog.
5. **SUPERSEDED**: Historical version. Immutable and frozen. Past submissions referencing this version retain their original schema.
6. **RETIRED**: Obsolete return marked decommissioned with statutory reasoning. Surviving submissions remain verifiable in the audit ledger.

---

## 5. Dual-Template Historical Reproducibility

When a report is evolved from Version 1 to Version 2:
- Submissions created under Version 1 retain `templateVersion: 1` and a sealed `templateSnapshot` preserving the exact Version 1 fields and calculations.
- New submissions created under Version 2 consume `templateVersion: 2` and its extended fields.
- Checkers and Auditors inspecting historical submissions see the exact schema valid at the time the submission was created.

---

## 6. Verification and Compliance Gates

- **Unit and Integration Tests**: 10 comprehensive test suites in `src/tests/dynamic-report-definition.test.ts`.
- **Full Test Runner**: 16/16 test suites passing in `src/tests/run-all-tests.ts`.
- **TypeScript Linting**: 0 errors via `npm run lint`.
- **Applet Compilation**: Succeeded via `compile_applet`.
