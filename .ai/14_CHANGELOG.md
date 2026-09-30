# 14 - CHANGELOG

All notable changes and engineering enhancements for the Oromia Bank NBE Regulatory Reporting Platform are recorded in this file.

---

## [3.0.0-phase3-admin-users-and-departments] - 2026-09-30

### Added
- **Administrator User Management Subsystem (`src/services/userService.ts`, `server.ts`, `src/components/AdminDashboard.tsx`)**:
  - Full CRUD and lifecycle management for bank user accounts: Administrator, Maker, Checker, and Auditor.
  - Server-side role enforcement on `POST /api/users`, `PUT /api/users/:id`, `POST /api/users/:id/status`, and `DELETE /api/users/:id` ensuring only callers with `ADMIN` role can mutate users.
  - First-class support for `AUDITOR` creation with specific statutory scope (`auditScope`) and formal appointment justification (`auditorJustification`).
  - Search, filter (by role, status, department), multi-column sorting (name, email, role, department, status, creation date), and standalone pagination contract (`page`, `page_size`, `limit`).
  - Single User Inspector (`GET /api/users/:id`) returning full profile, credentials overview, and linked department.
  - Dynamically resolved reporting authorization matrix (`GET /api/users/:id/authorized-reports`) computed from authoritative `configService` SSOT.
  - Special cross-department delegation access grants (`POST /api/users/:id/special-access`) for specific returns or multi-department assignments.
  - User-specific audit history compilation (`GET /api/users/:id/audit`).
  - Pre-flight historical safety checks (`GET /api/users/:id/can-delete` / `canDeleteUser`) preventing destructive deletion of users referenced in past statutory submissions.
- **Administrator Department Management Subsystem (`src/services/departmentService.ts`, `src/services/configService.ts`, `server.ts`, `src/components/AdminDashboard.tsx`)**:
  - Full management of bank organizational structure: create, edit, rename, code/description validation, and parent-child hierarchy.
  - Lifecycle statuses (`ACTIVE`, `INACTIVE`, `RESTRUCTURED`, `PLANNED`) and effective date management (`effectiveFrom`, `effectiveTo`).
  - SSOT synchronization: changes made in `departmentService` are immediately synced with `configService.createDepartment` and `configService.updateDepartment`.
  - Department inspection (`GET /api/departments/:id`) providing hierarchy ancestors, descendant units, assigned user rosters, and submission statistics.
  - Department configuration audit trail (`GET /api/departments/:id/audit`).
  - Pre-flight historical safety checks (`GET /api/departments/:id/can-delete` / `canDeleteDepartment`) blocking destructive deletion of departments referenced by historical reports or active assigned officers.
- **Administrator UX Enhancements (`src/components/AdminDashboard.tsx`)**:
  - Sub-tab navigation: Reports Oversight, Special Access & Delegation, Pending Authorizations, User Accounts & RBAC, Departments & Structure, Directives & Role Matrix.
  - Custom responsive modals:
    - `CreateUserModal`: Direct provisioning of officers with role selector and conditional Auditor scope inputs.
    - `UserInspectorModal`: Detailed profile card, dynamic authorized returns list, special access grants, and audit activity history.
    - `CreateDepartmentModal`: Operational unit creation with division, parent department, responsibilities, and statutory returns multi-selection.
    - `EditDepartmentModal`: In-place editing of responsibilities, hierarchy, and retirement dates.
    - `DepartmentInspectorModal`: Hierarchy tree position, live statistics cards, assigned officers list, and configuration audit trail.
    - `HistoricalSafetyNoticeModal`: NBE-grounded modal explaining why destructive deletion was blocked and offering non-destructive deactivation (`DISABLED`/`INACTIVE`).
    - `DeleteConfirmationModal`: Permanent deletion dialog for verified safe entities.
- **Automated Verification & Regression Suite (`src/tests/phase3-admin-users-departments.test.ts`)**:
  - Comprehensive automated tests covering user CRUD, role transitions, Auditor scopes, dynamic report authorization, user audit trail, user historical safety pre-flights, department creation/editing/hierarchy, lifecycle transitions, and department historical safety pre-flights.
  - Integrated into `src/tests/run-all-tests.ts`.

---

## [2.0.0-phase2-dynamic-configuration-ssot] - 2026-09-30

### Added
- **Dynamic Configuration & SSOT Engine (`src/services/configService.ts`)**:
  - Implemented authoritative in-memory & database-backed SSOT engine governing Departments, Reports, Versions, Roles, Permissions, Assignments, and Workflows.
  - Implemented hierarchical department modeling with self-referential parent/children relations, hierarchy levels (0: Division, 1: Department, 2: Unit/Section), hierarchical path strings, and cycle prevention.
  - Implemented metadata-driven report definitions capable of representing return identity, frequency, risk categories, central bank mappings, fixed fields, dynamic schedule columns, and mathematical formulas.
  - Implemented non-destructive report versioning (Version 1, Version 2, etc.) ensuring historical regulatory submissions stay pinned to their original version schema snapshot without corruption.
  - Implemented explicit relationship entities: `DepartmentReportAssignment` (roles: PRIMARY_OWNER, CONTRIBUTOR, REVIEWER, SUPERVISORY) and `UserReportAssignment` (duties: MAKER, CHECKER, AUDITOR, VIEWER).
  - Implemented dynamic authorization matrix resolving user access across explicit duties, home departments, and time-bound special access grants.
  - Implemented domain version counters and composite cache hash (`deptVersion`, `reportsVersion`, `workflowsVersion`, `rbacVersion`, `assignmentsVersion`, `globalConfigHash`) with atomic cache invalidation.
  - Implemented real-time configuration event emitter broadcasting typed events (`CONFIG_CHANGED`, `CACHE_INVALIDATED`).
- **REST Configuration API (`server.ts`)**:
  - Exposed comprehensive configuration endpoints under `/api/config/*`: `/api/config/summary`, `/api/config/departments`, `/api/config/reports`, `/api/config/authorized-reports`, `/api/config/roles`, `/api/config/permissions`, `/api/config/workflows`, `/api/config/assignments/*`, `/api/config/changes`, and `/api/config/cache/invalidate`.
  - Added real-time Server-Sent Events (SSE) notification stream (`GET /api/config/events`) enabling instantaneous client updates upon backend mutations.
- **Frontend Configuration SSOT Client Hook (`src/hooks/useConfigurationSSOT.ts`)**:
  - React hook querying authoritative backend `/api/config/*` endpoints on mount.
  - Subscribes to `/api/config/events` SSE stream for automatic UI re-synchronization on backend updates.
- **Django Backend Domain Architecture & Migrations (`backend/apps/`)**:
  - Enhanced `Department` with `parent`, `hierarchy_level`, `path`, `status`, `effective_from`, and `effective_to`.
  - Added `DepartmentReportAssignment` model in `departments/models.py`.
  - Added `ReportDefinition`, `ReportVersion`, `ReportSection`, `ReportField`, `ReportColumn`, and `ReportRow` in `reports/models.py`.
  - Added `Role`, `Permission`, `UserReportAssignment`, and `DepartmentMember` in `accounts/models.py`.
  - Added `Submission`, `WorkflowDefinition`, and `WorkflowStep` in `workflows/models.py`.
  - Added `ConfigurationChange` audit model in `audit/models.py`.
  - Created safe Django migrations: `departments/0002_add_hierarchy_and_assignments.py`, `reports/0001_initial.py`, `accounts/0002_add_role_permission_and_assignments.py`, `workflows/0001_initial.py`, and `audit/0003_configurationchange.py`.
  - Created Django seeding command `reports/management/commands/seed_ssot_configuration.py`.
- **Dedicated Architecture Specification (`.ai/29_CONFIGURATION_SSOT_AND_METADATA_ARCHITECTURE.md`)**:
  - Complete architectural specification detailing governance principles, entity models, hierarchy traversal, versioning mechanics, relationship schemas, and cache invalidation.
- **Automated Verification Suite (`src/tests/phase2-configuration-ssot.test.ts`)**:
  - 57 automated tests covering department hierarchy, report metadata, versioning historical integrity, explicit relationships, dynamic authorization boundaries, RBAC SSOT, workflow definitions, and cache consistency.
  - Added to master test runner `src/tests/run-all-tests.ts`.

---

## [1.9.2-phase1-login-registration-terminology] - 2026-09-30

### Changed
- **Login Registration Prompt (`src/components/LoginPage.tsx`)**:
  - Replaced prompt with exact required terminology: `"Need access as a new Maker / Checker / Auditor?"`.
  - Maintained responsive typography (`text-[11px] sm:text-xs text-slate-500 dark:text-slate-400`).
- **Login Registration Button (`src/components/LoginPage.tsx`)**:
  - Replaced button label with exact required terminology: `"Register for Maker / Checker / Auditor Account"`.
  - Preserved `min-h-[44px]` touch target, `UserPlus` icon, and smooth transition.
- **Registration Page Title (`src/components/RegisterPage.tsx`)**:
  - Updated page header with exact required terminology: `"Request Maker / Checker / Auditor Credentials"`.
  - Maintained responsive typography (`text-base sm:text-xl font-bold tracking-tight`).
- **Auditor Role Availability**:
  - Verified `AUDITOR` option remains fully active in the registration role selection dropdown with Abinet Alemu directive permission boundary notice.
- **Automated Verification**:
  - Added dedicated test assertions in `src/tests/responsive-ui-and-layout.test.ts` verifying all three exact strings, absence of obsolete text, and active Auditor option.

---

## [1.9.1-phase0-ai-normalization] - 2026-09-30

### Added
- **Canonical Knowledge Base Map & Master AI Index (`.ai/00_START_HERE.md`)**:
  - Ingested and indexed all 29 canonical engineering specifications (`00_` through `28_`).
  - Defined explicit reading order, purpose, and trigger conditions for incoming AI agents.
  - Formulated mandatory Account Migration and Quota Safety rules.
- **Dedicated Continuation and Recovery Guide (`.ai/03_CONTINUATION_AND_RECOVERY.md`)**:
  - Restored canonical quick verification commands and architectural layout map.
- **Account Migration & Continuation Protocol (`.ai/20_ACCOUNT_MIGRATION_AND_CONTINUATION.md`)**:
  - Consolidated multi-account handoff protocols, quota-safety discipline, and post-migration integrity rules.

### Changed
- **Standardized Canonical File Naming**:
  - Standardized all 29 engineering documents with uniform two-digit numeric prefixes (`00_` to `28_`).
- **Complete Reference Repair**:
  - Repaired all internal Markdown cross-references across all `.ai/*.md` documents to use canonical numbered filenames.
  - Eliminated broken and un-prefixed references.
- **Duplicate & Redundant Document Elimination**:
  - Merged unique content from unnumbered and partial duplicates into their canonical counterparts.
  - Removed all redundant unnumbered clones and 0-byte placeholder files.

---

## [1.9.0-phase5-final-verification-and-completion-gate] - 2026-09-29

### Added
- **Phase 5 Automated End-to-End Verification Test Suite (`src/tests/phase5-final-verification.test.ts`)**:
  - Implemented automated verification of all 14 mandatory end-to-end flows:
    1. Admin Login & Dashboard Routing
    2. Maker Login & Workspace Routing
    3. Checker Login & Inbox Routing
    4. Auditor Login & Independent Dashboard Routing
    5. User Registration & Admin Approval Flow
    6. Password Authentication & Zero-Bypass Checks
    7. Biometric Passkey (WebAuthn) & Optical Face ID Enrollment
    8. Biometric Authentication & Verification (distinguishing Code Verified from physical hardware unavailability in headless CI)
    9. Complete Maker Reporting Lifecycle (Create -> Save -> Edit -> Submit)
    10. Complete Checker Review Lifecycle (Review -> Request Correction -> Re-review -> Approve)
    11. Auditor Independent Inspection Lifecycle (Work Queue -> Findings -> Evidence -> Remediations -> Working Notes -> Audit Package)
    12. Central Bank Transmission to NBE Gateway (Receipt number, delivery timestamp, idempotency)
    13. User Session Logout Flow & Audit Trail Attribution
    14. Deliberate Unauthorized Access Attempts (Maker self-approval blocked, Checker NBE delivery blocked, Cross-department submission blocked)
- **Unified Full-Stack Test Command (`npm run test:all`)**:
  - Chains TypeScript/React unit & integration tests (`npm test`), Django backend app tests (`npm run test:backend`), and NBE simulator microservice tests (`npm run test:simulator`).
- **Python Dependencies in Backend Requirements (`backend/requirements.txt`)**:
  - Added `requests>=2.31.0` and validated execution against Django 5.2.

### Verified
- **Architectural & Security Integrity**:
  - Multi-tier architecture: React SPA -> Node/Express Proxy -> Django Core Services -> SQLite DB -> NBE Gateway Service -> NBE Simulator Daemon.
  - Zero-bypass authorization: Operational actions (create, edit, approve, deliver) rejected by backend when attempted by unauthorized roles or across department boundaries.
  - 4-Eyes principle enforced both client-side and server-side.
- **Completion Gates**:
  - All 12 completion gates evaluated and certified **PASS**.

---

## [1.8.0-phase4-ui-ux-regression-and-hardening] - 2026-09-29

### Added
- **Automated Phase 4 Regression & Hardening Test Suite (`src/tests/phase4-regression-hardening.test.ts`)**:
  - Full route and component inventory verification covering 22 distinct views, workspaces, and modals.
  - Verification of authoritative brand tokens (`#8CC51F` green, `#5962AB` blue, `#2C3161` active item, `#47509A` border).
  - Validation of zero isolated dark hex code policy across all application components.
  - End-to-end reporting lifecycle and dual-control workflow test: Maker draft creation -> Checker approval -> Maker transmission to NBE simulator.
  - Non-color accessibility and semantic status indicator audits.
  - Standalone pagination contract verification with edge case clamping.
- **Integrated Test Execution Runner**:
  - Expanded `src/tests/run-all-tests.ts` to 12 comprehensive automated test suites (100% passing).

### Changed
- **Application-Wide Color Standardization & Hex Eradication**:
  - Eliminated lingering isolated dark hex codes (`dark:bg-[#121428]`, `dark:bg-[#161933]`, `dark:bg-[#101226]`, `dark:border-[#22284D]`, `dark:border-[#262D55]`, `dark:border-[#2B3369]`, `dark:divide-[#1C203F]`) across `DepartmentReportManagement.tsx`, `ChangeHistoryView.tsx`, `BulkImportModal.tsx`, `HardwareDiagnosticsModal.tsx`, `BiometricRecoveryModal.tsx`, `SystemHealthDashboard.tsx`, `UserSettingsModal.tsx`, `BiometricPromptModal.tsx`, and `OfflineStorageModal.tsx`.
  - Migrated entirely to unified design tokens (`dark:bg-slate-900`, `dark:bg-slate-800`, `dark:border-slate-800`, `dark:border-slate-700`, `dark:divide-slate-800`).
- **Zero-Pill Discipline Across Workspace Badges & Tabs**:
  - Replaced `rounded-full text-[10px]` with `rounded-md font-mono text-[10px]` on counts and status tags in `MakerWorkspace.tsx`, `CheckerInbox.tsx`, `AdminDashboard.tsx`, `AuditorDashboard.tsx`, `DepartmentReportManagement.tsx`, `ChangeHistoryView.tsx`, and `SystemHealthDashboard.tsx`.
- **Viewport Immunity on Modal Dialogs**:
  - Hardened `CommandPaletteModal.tsx` with dynamic height constraints (`max-h-[calc(100dvh-4rem)] flex flex-col overflow-hidden` and `overflow-y-auto` results) to eliminate any risk of viewport clipping on short displays or mobile landscape.

---

## [1.7.0-phase3-auditor-ux-and-pagination] - 2026-09-29

### Added
- **Design System Rule Injected into Master Prompts (`/.ai/02_OB_SYSTEM_SPECIFICATION.md`, `/.ai/02_OB_SYSTEM_SPECIFICATION.md`)**:
  - Formal rule prohibiting page-specific overrides when solutions belong to shared design tokens, themes, components, or application shells.
- **Account Migration Protocol (`/.ai/20_ACCOUNT_MIGRATION_AND_CONTINUATION.md`)**:
  - Permanent protocol guaranteeing self-contained project state reconstruction for subsequent AI Studio sessions.
- **First-Class Auditor Workflow & Integration (`src/components/AuditorDashboard.tsx`)**:
  - Full adherence to the shared OB design system (zero arbitrary custom color tokens).
  - Complete integration of Auditor sub-views: Audit Summary KPIs, Audit Work Queue, Statutory Return Deep Inspection, Lifecycle Workflow Timeline, Audit Findings & Severity Tracker, Evidence Vault with SHA-256 seals, Confidential Working Papers, Remediation Action Tracker with Auditor verification, and Cryptographically Sealed Audit Package Generator.
  - Added Auditor demo user (`usr_auditor_1`) to `DEMO_USERS` in `src/services/submissionService.ts` and Navbar role switcher for dual-control testing.
- **Standalone Server & Client Pagination Architecture (`src/utils/paginationUtils.ts`)**:
  - Contract: `{ items, total, page, page_size, total_pages, has_next, has_previous }`.
  - Backend integration: Express routes (`server.ts`) and Django views (`backend/apps/audit/views.py`) supporting query parameters `page`, `page_size`, and `limit`.
- **Responsive Standard Pagination UI (`src/components/Pagination.tsx`)**:
  - Desktop: `[First] [Previous] [1] [2] [3] ... [Next] [Last]` with `Page X of Y` indicator and configurable page sizes.
  - Mobile: Compact responsive representation `[Previous] Page X / Y [Next]` with $\ge 44$px touch targets.
  - Automatic control hiding when all items fit on a single page.
- **Application-Wide List Audit & Pagination Implementation**:
  - Auditor Dashboard: Work Queue, Findings, Evidence Vault, Working Papers, Remediation Tracker, and Audit Packages.
  - Version History: `ReportVersionHistoryModal.tsx` paginated with dynamic sizing.
  - Audit Trail Ledger: `AuditTrailView.tsx` resets to Page 1 upon search query or filter modifications.
- **Automated Test Suite for Pagination (`src/tests/pagination-suite.test.ts`)**:
  - Unit tests covering 0 records, 1 record, exact 1 page, exact 2 pages, safe out-of-bounds page clamping, 1,250-record datasets, and dynamic page-size changes.

---

## [1.6.0-phase2-responsive-viewport-and-application-shell] - 2026-09-29

### Added
- **Modern 100dvh Application Shell Architecture (`src/App.tsx`, `src/index.css`)**:
  - Established a controlled application shell utilizing `100dvh` viewport units without document-level expansion or blind `overflow:hidden` clipping.
  - Header and navigation remain accessible at all times while the dynamic workspace provides a controlled internal scrolling region (`overflow-y-auto min-h-0 flex-1`).
  - Added centralized application workspace footer inside `<main>` with `mt-auto pt-6 pb-2` ensuring proper bottom anchoring without awkward gaps or floating.
- **Header Mobile Drawer Access (`src/components/Navbar.tsx`)**:
  - Added `onOpenMobileDrawer` prop to `Navbar`, allowing mobile users to open the navigation drawer directly from the header hamburger button on any viewport orientation or when editing reports.
  - Responsive tablet header optimization: compact indicator presentation on `< 1024px` preserving ample breathing room at 768px tablet portrait.
- **Scroll-Safe Mobile Navigation Drawer (`src/components/Sidebar.tsx`)**:
  - Converted mobile drawer body into a unified, scroll-safe container (`overflow-y-auto flex-1 min-h-0 touch-scroll-y flex flex-col justify-between`).
  - Guarantees that the Logout control, user profile, and hardware preferences are NEVER pushed outside the viewport or clipped on mobile landscape (e.g., 844x390, 667x375).
- **Responsive Dialog & Modal Constraints**:
  - Enforced `max-h-[calc(100dvh-2rem)] overflow-y-auto` across all modals (`BiometricPromptModal`, `UserSettingsModal`, `ReportVersionHistoryModal`, `OfflineStorageModal`, `HardwareDiagnosticsModal`, `KeyboardShortcutsModal`, `CommandPaletteModal`, `BulkImportModal`, `BiometricRecoveryModal`).
- **Phase 2 Automated Test Matrix (`src/tests/responsive-ui-and-layout.test.ts`)**:
  - Added test suites for 100dvh shell architecture, Logout accessibility across mobile/tablet/desktop ($\ge 44$px touch targets), footer whitespace discipline, and tablet validation matrix (768x1024 portrait & 1024x768 landscape).

### Changed
- **Footer Whitespace Discipline (`src/components/LoginPage.tsx`, `src/components/RegisterPage.tsx`, `src/App.tsx`)**:
  - Removed unnecessary vertical empty space beneath "All rights reserved." on login and registration pages.
  - Replaced `min-h-screen min-h-[100dvh]` with pure `min-h-[100dvh]` and normalized footer padding (`py-2.5 sm:py-3`), preventing mobile address-bar height expansion.
  - Removed redundant mobile `pb-20` on `<main>` in `App.tsx` (reduced to `pb-3 sm:pb-4`), eliminating empty gaps above `BottomNavigation`.
- **Desktop Sidebar Height Protection (`src/components/Sidebar.tsx`)**:
  - Added `max-h-[50vh] overflow-y-auto` to the bottom actions container of the desktop sidebar, preventing clipping on short desktop or tablet landscape viewports (e.g. 1024x768 or 600px height).
  - Enforced $\ge 44$px touch targets on both expanded and collapsed Logout buttons.
- **Color Standardization Cleanups**:
  - Standardized remaining dark hex palettes in `DynamicReportForm.tsx`, `BiometricPromptModal.tsx`, `UserSettingsModal.tsx`, `BulkImportModal.tsx`, and `BiometricRecoveryModal.tsx` to shared tokens.
  - Updated `index.html` dark `theme-color` meta tag to `#0B0F19`.

---

## [1.5.0-phase1-visual-design-system] - 2026-09-29

### Added
- **Centralized Design System Tokens (`src/styles/designTokens.ts`)**:
  - Authoritative OB primary green codified as `#8CC51F` with calibrated tonal scales (50–950).
  - Authoritative OB primary blue codified as `#5962AB` with calibrated tonal scales (50–950).
  - Documented requested color `#5863AC` with exact 1-RGB-point delta analysis against official logo assets.
  - Standardized surface, border, text, typography, semantic feedback, and sidebar token configurations.
- **CSS Variables & Tailwind v4 Theme Tokens (`src/index.css`)**:
  - Configured `:root` and `.dark` variables (`--ob-primary-green`, `--ob-primary-blue`, `--ob-sidebar-bg`, `--ob-sidebar-border`, `--ob-sidebar-text`, `--ob-sidebar-active-bg`, `--ob-sidebar-badge-bg`).
  - Added `--color-ob-blue` alongside `--color-ob-indigo` for 100% backward compatibility.
  - Standardized `--color-ob-green` to `#8CC51F`.
- **Automated Test Suite for Design System & Colors (`src/tests/design-system-and-colors.test.ts`)**:
  - Added 5 test sections validating color values, token mapping, sidebar container classes, visual consistency, and WCAG AA/AAA contrast ratios.
  - Integrated into `src/tests/run-all-tests.ts` (10 comprehensive test suites, 100% pass).

### Changed
- **Dashboard Sidebar Visual Transformation (`src/components/Sidebar.tsx`)**:
  - Replaced the dark/black background (`#121428`) with the authoritative OB Blue (`bg-ob-blue-500`, `#5962AB`) across both the desktop sidebar and the responsive mobile slide-out drawer.
  - Automatically propagated across all authenticated dashboards (Admin, Maker, Checker, Auditor, NBE Simulator, SSOT Lakehouse, Audit Trail, and System Health).
  - Enhanced contrast: navigation text in high-legibility white ($6.0:1$), active item in deep blue `#2C3161` ($12.5:1$), and notification badges in authoritative OB green `#8CC51F` ($10.5:1$).
- **Application-Wide Color Standardization**:
  - Standardized `AuditorDashboard.tsx` by eliminating isolated dark hex palettes (`#101438`, `#141944`, `#161B48`, `#202866`, `#101226`, `#22284D`, `#2B3369`) and unifying with shared tokens.
  - Standardized `Navbar.tsx`, `BottomNavigation.tsx`, `MobileBottomNav.tsx`, `LoginPage.tsx`, `RegisterPage.tsx`, `ResetPasswordModal.tsx`, `ReportVersionHistoryModal.tsx`, and `ThemeToggle.tsx`.
  - Updated PDF generators (`src/utils/pdfReportGenerator.ts` and `src/utils/pdfGenerator.ts`) to use `#8CC51F` (`[140, 197, 31]`).

---

## [1.4.0-auditor-first-class-role] - 2026-09-29

### Added
- **First-Class Auditor Role & Regulatory Audit Workflow** (`.ai/19_AUDITOR_ROLE_AND_AUDIT_WORKFLOW.md`):
  - Implemented comprehensive `AuditorDashboard.tsx` with responsive multi-device design, zero-pill typography, and dark mode support.
  - Added dedicated Auditor registration workflow in `RegisterPage.tsx` capturing audit oversight scope and regulatory mandate justifications (BSD/03/2020).
  - Implemented Auditor approval workflow in `AdminDashboard.tsx` with administrative authorization and timestamping.
  - Implemented automatic redirection to `AUDITOR_DASHBOARD` upon auditor login in `LoginPage.tsx` and `userService.ts`.
  - Implemented **Audit Work Queue** with cross-departmental filtering (department, submission status, audit status, search query) and real-time finding aggregates.
  - Implemented **Deep Report Audit Inspection View** enabling line-by-line examination of submitted values, AST formulas, dynamic schedule tables, Maker/Checker signatures, and historical snapshots.
  - Implemented **Audit Findings Register** (`FIND-YYYYMMDD-XXXX`) tracking severity (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `INFORMATIONAL`), regulatory citations, financial variances, and lifecycle states (`OPEN`, `UNDER_REVIEW`, `REMEDIATION_PENDING`, `RESOLVED`, `CLOSED`).
  - Implemented **Evidence Management Repository** with Oromia Bank cryptographic tamper seals (`OB-EVID-SEAL-...`) and verification workflows.
  - Implemented **Confidential Auditor Work Papers & Notes** categorized by risk, compliance, data quality, and general observations.
  - Implemented **Remediation Action Tracking** with assigned department accountability, target completion dates, proof verification, and auditor sign-off.
  - Implemented **Formal Audit Reports Generator & Export** compiling executive memorandums, findings summaries, and official cryptographic verification seals.
  - Implemented dedicated backend REST API endpoints in `server.ts` under `/api/audit/*` for work queue, findings, evidence, notes, remediations, and report exports.
  - Implemented Django backend models, serializers, views, and migrations in `backend/apps/audit/` (`AuditFinding`, `AuditEvidence`, `AuditWorkingNote`, `RemediationAction`, `AuditReportPackage`).
  - Enforced strict segregation of duties (Abinet Alemu directive): In `backend/apps/permissions/authorization.py` and `backend/apps/workflows/workflow_engine.py`, the Auditor role is barred from drafting, editing, submitting, or approving reports (compliance oversight boundary).
  - Added automated test suite `src/tests/auditor-workflow.test.ts` integrated into `src/tests/run-all-tests.ts` (10 test sections, 100% pass).
  - Added Django unit test suite `backend/apps/audit/tests.py` (9 tests, 100% pass).
  - Standardized all 28 `.ai` documentation files with uniform `number_` prefixes (`01_` through `28_`) and cleaned up all duplicate files.

---

## [1.3.0-auditor-assessment] - 2026-09-28

### Added
- **Full Recovery Assessment for Auditor Role Implementation** (`.ai/19_AUDITOR_ROLE_AND_AUDIT_WORKFLOW.md`):
  - Completed thorough inspection across the entire project and all `.ai` documentation.
  - Formulated precise answers for all 10 recovery inquiries in `.ai/13_CURRENT_IMPLEMENTATION_STATUS.md`.
  - Clarified technical stack reality: both Express (`server.ts` port 3000), Django Core (`/backend` SQLite `db.sqlite3`), and Django NBE Simulator (`/nbe_simulator_service` SQLite `simulator_db.sqlite3` port 8001) are active and functional.
  - Cataloged gap analysis for first-class Auditor role: registration request, approval workflow, auditor dashboard, work queue, report audit view, revision history, evidence management, findings system (severity/status), audit notes, remediation tracking, formal audit reports, and Django boundary enforcement.

---

## [1.2.0-nbe-simulator] - 2026-09-28

### Added
- **Independent NBE Simulator Django Microservice** (`/nbe_simulator_service`):
  - Standalone Django project with own `manage.py`, settings, SQLite store (`simulator_db.sqlite3`), and dedicated port `8001`.
  - Models: `SimulatorScenario`, `SimulatorSubmission`, `SimulatorRequestLog`.
  - Full schema and envelope validation for all 24 NBE report definitions and institutional code `0000013`.
  - 6 runtime simulation modes: `ALWAYS_SUCCESS` (200/201 + cryptographic receipt `NBE-REC-YYYYMMDD-XXXX`), `VALIDATION_ERROR` (422), `AUTH_FAILURE` (401), `TIMEOUT` (504), `SERVER_ERROR` (500), `RANDOM_FLAKY`.
  - Deterministic test triggers: `X-Simulator-Force-Scenario` headers and query parameter overrides.
  - Idempotency deduplication: `Idempotency-Key` header prevents duplicate processing and returns existing receipts (`SUCCESS_IDEMPOTENT_DUPLICATE`).
  - Unit test suite (`nbe_simulator_service/apps/simulator/tests.py`): 11 tests covering all scenarios and 24 return definitions.
- **NBE Gateway & Adapter Integration**:
  - `backend/apps/nbe_gateway/gateway_service.py` and `src/services/nbeAdapter.ts`: Outbound HTTP client communicating with port 8001 with exponential retry backoff.
  - `server.ts`: Reverse-proxy endpoints for `/api/nbe-simulator/*` and auto-supervision of the Django simulator process.
  - Integration documentation in `.ai/18_NBE_SIMULATOR_MICROSERVICE.md`.

---

## [1.2.0-auth-seed-users] - 2026-09-28

### Removed
- **One-Click Role Login Visual Block**: Removed the testing shortcut button container (`ONE-CLICK ROLE LOGIN (TESTING)`) from `LoginPage.tsx`.
- **Underlying Shortcut/Bypass Logic**:
  - Removed `handleQuickPreset` and silent email default fallback in `LoginPage.tsx`.
  - Removed auto-provisioning bypass in `useBiometricAuth.ts` which previously generated fake simulated passkeys for unenrolled accounts.
  - Enforced strict password checks on `/api/auth/login` (missing password rejected with HTTP 400).
  - Removed all fake pre-seeded biometric credentials from initial user accounts in `userService.ts`.

### Added
- **Authoritative Development Seed Accounts**:
  - `admin@oromiabank.com` (Role: `ADMIN`, Dept: `Compliance & Legal Governance`, Password: `password`, Biometrics: `[]`).
  - `abebe.kebede@oromiabank.com` (Role: `MAKER`, Dept: `Credit Operations & Portfolio Management`, Password: `password`, Biometrics: `[]`).
  - `chala.desta@oromiabank.com` (Role: `CHECKER`, Dept: `Credit Operations & Portfolio Management`, Password: `password`, Biometrics: `[]`).
  - `auditor@oromiabank.com` (Role: `AUDITOR`, Dept: `Internal Audit & Regulatory Control`, Password: `password`, Biometrics: `[]`).
  - Additional users for Trade Services, Asset Recovery, and Pending Registration tests.
- **Seed Data Management & Reset Architecture**:
  - `userService.resetDevelopmentSeedData()` resets seed accounts cleanly.
  - `userService.getDevelopmentSeedSummary()` outputs developer reference data.
  - `POST /api/auth/seed-data/reset` server endpoint with non-repudiation audit logging.
  - `GET /api/auth/seed-data` server endpoint for configuration tooling.
- **Collapsible Development Test Reference UI**:
  - Added clean reference accordion on `LoginPage.tsx` displaying accounts and roles.
  - Provides "Use Email" filler (populates email only, preserving real password validation) and "Reset Seed Data" trigger.

---

## [1.1.0-ui-ux] - 2026-09-28

### Added
- **Dedicated Automated Responsive UI & Layout Test Suite** (`src/tests/responsive-ui-and-layout.test.ts`):
  - 9 viewport classification matrix (Small Mobile 320px to Large Desktop 1920px).
  - 16-component React export and inventory verification.
  - Minimum 44px mobile touch target enforcement (`min-h-[44px]`, `min-w-[44px]`).
  - Horizontal page overflow prevention testing (`overflow-x-auto`, `truncate`, `line-clamp`).
  - Zero-pill compliance audit on static metadata.
  - Multi-breakpoint navigation adaptation verification.
  - Dynamic area table dual card/table view mode verification.
  - Non-color status indicator audit (dual icon + text pairing for WCAG AA).
- **Integrated into Root Test Runner** (`src/tests/run-all-tests.ts`):
  - Now executes 8 complete test suites sequentially with 100% green verification.

### Changed
- **Zero-Pill Discipline Refinements (Frontend Design Constitution)**:
  - `src/components/DynamicReportForm.tsx`: Replaced static pill capsules (`rounded-full`) in validation summary strips with clean unboxed metadata and subtle rounded tags (`rounded-md`).
  - `src/App.tsx`: Replaced `rounded-full` badge in toast hardware verification notifications with clean `rounded-md` metadata tags.
  - `src/components/AdminDashboard.tsx`: Cleaned tab count indicators from `rounded-full` to clean `rounded-md` indicators.
  - `src/components/OfflineStorageModal.tsx`: Replaced `rounded-full` sync status tags with clean unboxed/rounded-md tags.
  - `src/components/UserSettingsModal.tsx`: Replaced `rounded-full` authentication history count tag with clean `rounded-md` tag.
  - `src/components/NbeHealthIndicator.tsx`: Updated status telemetry badge from `rounded-full` to `rounded-md`.
  - `src/components/KeyboardShortcutsModal.tsx`: Updated badge tag from `rounded-full` to `rounded-md`.
  - `src/components/OfflineStatusIndicator.tsx`: Updated sync counter from `rounded-full` to `rounded-md`.

### Verified
- `compile_applet`: Succeeded cleanly.
- `lint_applet` (`npm run lint` / `tsc --noEmit`): Exited with 0 errors.
- `npx tsx src/tests/run-all-tests.ts`: All 8 automated test suites passed 100% green.

---

## [1.0.0-audit] - 2026-09-28
### Added
- Comprehensive recovery assessment answering all 10 architectural inquiries.
- Confirmation of Express/Node.js architecture and clarification of Django non-existence.
- Verified test suites for core regulatory engines, RBAC, NBE simulator, biometrics, PDF generation, and IndexedDB storage.
