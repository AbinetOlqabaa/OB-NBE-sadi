# TASK QUEUE

| ID | Description | Priority | Dependencies | Files | Acceptance Criteria | Status | Test Evidence | Known Blockers | Next Action |
|---|---|---|---|---|---|---|---|---|---|
| T01 | Ingest & catalog all 24 report assets | P0 | None | \`report-assets/*\`, \`data/report-definitions/*\`, \`.ai/09_REPORT_CATALOG.md\`, \`.ai/10_REPORT_SCHEMA_ANALYSIS.md\` | 24 reports parsed as valid JSON, SHA256 computed, catalog generated | DONE | 24 files in data/report-definitions/ with valid hashes | None | Complete |
| T02 | Discover NBE Contract & map assumptions | P0 | T01 | \`.ai/11_NBE_CONTRACT.md\` | Confirmed, proposal-defined, inferred, missing, configurable items separated | DONE | Verified against supplied files | None | Complete |
| T03 | Establish Type Definitions & Data Model | P0 | T02 | \`src/types/regulatory.ts\`, \`src/types/ssot.ts\` | Comprehensive TypeScript definitions for submissions, items, dynamic rows, audit, users | DONE | Type checks cleanly | None | Complete |
| T04 | Safe Formula Engine & AST Parser | P0 | T03 | \`src/utils/formulaEngine.ts\` | Evaluates formulas (D=B+C, E=A-D, G=E*F, ratios, sums) without \`eval\` or arbitrary code execution | DONE | Formula tests pass | None | Complete |
| T05 | Validation Engine & Cross-Field Rules | P0 | T03, T04 | \`src/utils/validationEngine.ts\` | Validates required fields, numbers, dates, ranges, totals | DONE | Validation test suite | None | Complete |
| T06 | Metadata-driven Report Registry | P0 | T01, T03 | \`src/data/report-registry.ts\` | Canonical registry of all 24 reports with schemas, formulas, dynamic tables | DONE | Full registry exported | None | Complete |
| T07 | Maker-Checker Workflow & Submission State Machine | P0 | T03, T05 | \`src/services/workflowEngine.ts\`, \`src/services/submissionService.ts\` | Strict state machine: DRAFT -> PENDING_CHECKER -> APPROVED / REJECTED / CORRECTION_REQUIRED. Segregation of duties enforced. | DONE | Self-approval blocked, audit logged | None | Complete |
| T08 | NBE Adapter & Realistic NBE Simulator | P0 | T02, T07 | \`src/services/nbeAdapter.ts\`, \`src/services/nbeSimulator.ts\` | Real adapter with correlation ID, idempotency key, timeout, retry; Simulator with 6 failure/success modes | DONE | Simulator tests pass | None | Complete |
| T09 | Excel (XLSX) Import & Export Engine | P0 | T06 | \`src/utils/excelService.ts\` | Export template/data to XLSX; import XLSX with cell mapping, validation, error reporting | DONE | Round-trip test verified | None | Complete |
| T10 | Full-Stack Express Server with API Endpoints | P0 | T07, T08 | \`server.ts\` | REST APIs for submissions, simulator, audit, templates, health | DONE | Backend API integration tests | None | Complete |
| T11 | Frontend UI: Maker, Checker, Admin, Simulator | P0 | T06, T07, T08, T09 | \`src/components/*\`, \`src/App.tsx\` | Complete, responsive dashboard obeying frontend design constitution (zero pills, 1440px desktop baseline, tabular figures) | DONE | Full browser UI operational | None | Complete |
| T12 | Phase 2 SSOT, Ingestion & Data Quality | P1 | T06 | \`src/services/phase2* , src/types/ssot.ts\` | Core Banking & ERP connectors, Bronze/Silver/Gold pipeline, reconciliation, on-demand report generation | DONE | SSOT tests pass | None | Complete |
| T13 | Comprehensive Automated Test Suite | P0 | All | \`src/tests/*\` | Unit tests, API tests, negative tests, E2E Golden Path test, security tests | DONE | All tests pass with detailed output | None | Complete |
| T14 | Final Verification & Completion Report | P0 | T13 | \`.ai/28_COMPLETION_EVIDENCE.md\` | Zero error compile, clean verification evidence | DONE | Evidence documented | None | Final signoff |


# OB AUTONOMOUS TASK QUEUE

## STATUS DEFINITIONS

TODO
IN_PROGRESS
BLOCKED
DONE
VERIFIED

A task may only become VERIFIED after executable evidence exists.
All tasks below are VERIFIED with executable evidence recorded in `.ai/28_COMPLETION_EVIDENCE.md`.

---

## P0 — FOUNDATION

- [x] Inspect complete repository (VERIFIED)
- [x] Inspect all authoritative NBE files (VERIFIED - 24 canonical returns)
- [x] Inspect organizational chart (VERIFIED - 8 bank departments)
- [x] Build SSOT (VERIFIED - `.ai/07_SSOT.md`, `src/services/ssotRegistry.ts`)
- [x] Build department catalog (VERIFIED - `.ai/08_DEPARTMENT_CATALOG.md`)
- [x] Build report catalog (VERIFIED - `.ai/09_REPORT_CATALOG.md`)
- [x] Build RBAC matrix (VERIFIED - `.ai/12_RBAC_MATRIX.md`)
- [x] Build workflow model (VERIFIED - `.ai/21_WORKFLOW_MODEL.md`)

## P0 — SECURITY

- [x] Authentication (VERIFIED - login, password checks, pending activation)
- [x] Server-side authorization (VERIFIED - role checks on all mutations)
- [x] Object-level authorization (VERIFIED - submission access checks)
- [x] Department isolation (VERIFIED - makers restricted to home dept)
- [x] Special-access mechanism (VERIFIED - admin grants, expiry, revoke)
- [x] Maker/checker separation (VERIFIED - self-approval & self-review blocked)
- [x] Admin report read-only enforcement (VERIFIED - admin mutations blocked)
- [x] Audit integrity (VERIFIED - non-repudiation event logs)
- [x] NBE idempotency (VERIFIED - deduplication & receipt caching)

## P1 — REPORTING

- [x] Dynamic report engine (VERIFIED - metadata-driven rendering)
- [x] Dynamic report forms (VERIFIED - `DynamicReportForm.tsx`)
- [x] Validation engine (VERIFIED - `ValidationEngine.ts` multi-tier)
- [x] Report versioning (VERIFIED - version increments on lifecycle)
- [x] Draft persistence (VERIFIED - values & dynamic rows preserved)
- [x] Report lifecycle (VERIFIED - DRAFT to SENT state machine)

## P1 — WORKFLOW

- [x] Maker submission (VERIFIED - pre-validation & PENDING_CHECKER)
- [x] Checker review (VERIFIED - 4-eyes inspection)
- [x] Request changes (VERIFIED - CORRECTION_REQUIRED transition)
- [x] Maker revision (VERIFIED - draft update & resubmit)
- [x] Checker approval (VERIFIED - APPROVED transition)
- [x] Maker final NBE submission (VERIFIED - Maker-only delivery gate)

## P1 — NBE

- [x] NBE contract adapter (VERIFIED - HTTP client with headers)
- [x] Simulator (VERIFIED - 6 configurable failure/success modes)
- [x] Payload generation (VERIFIED - structured JSON contracts)
- [x] Error handling (VERIFIED - 400, 401, 500, 504 handled cleanly)
- [x] Retry handling (VERIFIED - exponential backoff in adapter)
- [x] Idempotency (VERIFIED - duplicate keys return existing receipt)
- [x] Submission history (VERIFIED - delivery attempts appended)

## P1 — AUDIT

- [x] Audit events (VERIFIED - comprehensive event types)
- [x] Report history (VERIFIED - submission comments & revisions)
- [x] User activity (VERIFIED - login & status updates logged)
- [x] Access grants (VERIFIED - special access issuance & revocation logged)
- [x] Security events (VERIFIED - authorization failures audited)

## P2 — UX

- [x] Registration (VERIFIED - `RegisterPage.tsx` with department selector)
- [x] Login (VERIFIED - `LoginPage.tsx` with role switching & quick sign-in)
- [x] Maker dashboard (VERIFIED - `MakerWorkspace.tsx`)
- [x] Checker dashboard (VERIFIED - `CheckerInbox.tsx`)
- [x] Admin dashboard (VERIFIED - `AdminDashboard.tsx`)
- [x] Report catalog (VERIFIED - dynamic template browser)
- [x] Report forms (VERIFIED - `DynamicReportForm.tsx` & `DynamicAreaTable.tsx`)
- [x] Review pages (VERIFIED - diff view, comments, 4-eyes sign-off)
- [x] History (VERIFIED - audit logs & delivery attempts table)
- [x] Notifications (VERIFIED - toast alerts for all workflow actions)
- [x] Error states (VERIFIED - inline field errors, validation summary)
- [x] Responsive UI (VERIFIED - 1440px desktop baseline, dark/light theme sync)

## P1 — TESTING

- [x] Unit tests (VERIFIED - Formula AST, Validation, Excel)
- [x] Integration tests (VERIFIED - Simulator, Adapter, Submissions)
- [x] Authorization tests (VERIFIED - Maker, Checker, Admin, Special Access)
- [x] Security tests (VERIFIED - Segregation of duties, registration restrictions)
- [x] E2E tests (VERIFIED - Maker draft -> Checker review -> Maker NBE delivery)
- [x] Regression tests (VERIFIED - full runner executes all 4 suites cleanly)
- [x] Failure/retry tests (VERIFIED - simulator 401, 422, 500, 504 tested)

## P0 — FINAL

- [x] Build passes (VERIFIED - `npm run build` succeeds)
- [x] Application starts (VERIFIED - Express server on port 3000)
- [x] Database works (VERIFIED - persistent submission & audit store)
- [x] Authentication works (VERIFIED - login & session handling)
- [x] RBAC works (VERIFIED - permissions strictly enforced)
- [x] Workflow works (VERIFIED - 100% compliant state machine)
- [x] NBE simulation works (VERIFIED - 6 modes & receipt generation)
- [x] Audit works (VERIFIED - non-repudiation compliance logs)
- [x] Security tests pass (VERIFIED - `run-all-tests.ts` 100% green)
- [x] E2E tests pass (VERIFIED - end-to-end golden path confirmed)
- [x] Completion evidence recorded (VERIFIED - recorded in `.ai/28_COMPLETION_EVIDENCE.md`)