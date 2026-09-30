# 29 - CONFIGURATION SINGLE SOURCE OF TRUTH (SSOT) & METADATA ARCHITECTURE

**Application**: Oromia Bank NBE Regulatory Reporting Platform  
**Target Regulator**: National Bank of Ethiopia (BSD & Banking Directives)  
**Licensed Institution**: Oromia Bank S.C. (InstCode: `0000013`)  
**Phase**: Account Phase 2 — Dynamic Configuration & SSOT Foundation  
**Version**: 2.0.0  
**Status**: ACTIVE & AUTHORITATIVE  

---

## 1. Executive Summary & Architectural Motivation

In traditional reporting systems, organizational departments, user-to-report relationships, return field structures, mathematical formulas, and workflow stages are hardcoded directly into frontend components or rigid database schemas. Any changes to central bank directives (such as NBE circular updates, modified loan classification provisioning buckets, new repeating borrower schedule columns, or internal banking department restructurings) would necessitate extensive code rewrites and risk corrupting historical regulatory submissions.

**Account Phase 2** establishes an authoritative, database-backed **Single Source of Truth (SSOT)** and metadata-driven foundation for Oromia Bank. The bank can dynamically adjust organizational departments, report metadata, version schemas, responsibilities, and workflows without requiring manual code changes.

### Key Tenets
1. **Database as Authority**: The backend is the sole authoritative source of truth for business configuration. The React frontend consumes configuration dynamically via `/api/config/*` endpoints and never acts as a business-configuration gatekeeper.
2. **Metadata-Driven Reporting**: All 24 statutory NBE returns are defined as metadata schemas comprising fixed cells, data types, repeating schedule columns, mathematical formulas, validation rules, and NBE gateway mapping contracts.
3. **Immutable Versioning**: Regulatory returns undergo circular revisions over time. New versions (e.g., Version 2, Version 3) are versioned snapshots; past regulatory submissions remain permanently pinned to the exact version under which they were signed off, preserving non-repudiation and auditability.
4. **Organizational Agility**: Departments support hierarchical modeling (divisions, departments, sections, units) with parent-child relationships, status lifecycles, path traversals, and time-aware effective dates.
5. **Explicit Relationship Models**: Relationships between Departments and Reports, and between Users and Reports, are modeled as explicit, first-class relationship entities (`DepartmentReportAssignment`, `UserReportAssignment`) rather than buried string arrays.
6. **Cache Consistency & Invalidation**: Domain-specific version counters and global hashes prevent stale data, supporting immediate invalidation upon configuration mutations.
7. **Real-Time Configuration Events**: A Server-Sent Events (SSE) stream (`/api/config/events`) and internal event emitters notify connected clients of configuration changes in real time.

---

## 2. Core SSOT Entities & Domain Architecture

The configuration domain comprises the following database-backed entities across both the Django ORM (`backend/apps/`) and the full-stack Node runtime (`src/services/configService.ts`):

```
+---------------------------------------------------------------------------------------------------+
|                                  CONFIGURATION SSOT DATABASE                                      |
+---------------------------------------------------------------------------------------------------+
  |
  +---> [Department] <----------- (Self-Reference: parent / children)
  |       |
  |       +---> [DepartmentReportAssignment] <-------+ (Explicit M:N Binding)
  |                                                  |
  +---> [ReportDefinition] (Identity & Rules) -------+
  |       |
  |       +---> [ReportVersion] (Immutable Version Snapshot)
  |               |
  |               +---> [ReportSection] (Logical Sections)
  |               +---> [ReportField] (Fixed Cells, Data Types, Formulas)
  |               +---> [ReportColumn] (Dynamic Schedule Columns)
  |               +---> [ReportRow] (Fixed Row Definitions)
  |
  +---> [UserAccount]
  |       |
  |       +---> [UserReportAssignment] (Maker / Checker / Auditor Duties)
  |       +---> [SpecialAccessGrant] (Time-Bound Cross-Department Delegation)
  |       +---> [DepartmentMember] (Primary / Secondary Department Affiliation)
  |
  +---> [Role] & [Permission] (Enterprise RBAC SSOT)
  |
  +---> [WorkflowDefinition] & [WorkflowStep] (Four-Eyes State Machine SSOT)
  |
  +---> [ConfigurationChange] (Non-Repudiation Audit Trail of all Config Changes)
```

---

## 3. Department Foundation & Hierarchy

Departments are modeled to accommodate future organizational restructuring, mergers, divisions, and new specialized units without database schema changes:

- **Entity Model**: `Department`
  - `id`: Unique immutable identifier (e.g., `dept_credit_ops`).
  - `name`: Full corporate business name.
  - `shortCode`: Unique business acronym (e.g., `COPM`).
  - `division`: Division classification.
  - `parent`: Self-referential foreign key to parent department/division.
  - `hierarchyLevel`: `0` for Division, `1` for Department, `2` for Unit/Section.
  - `path`: Hierarchical path string (e.g., `/div_credit_risk/dept_credit_ops/dept_sme_sec`).
  - `status`: `ACTIVE`, `INACTIVE`, `RESTRUCTURED`, `PLANNED`.
  - `primaryResponsibilities`: JSON list of operational duties.
  - `effectiveFrom` / `effectiveTo`: ISO 8601 temporal validity window.
- **Hierarchy Operations**:
  - `getDepartmentAncestors(id)`: Traverses rootwards to locate executive oversight divisions.
  - `getDepartmentDescendants(id)`: Traverses leafwards to locate all child units and sections.
  - **Cycle Prevention**: Circular assignments (e.g., assigning a department as its own ancestor) are rejected with validation errors.

---

## 4. Metadata-Driven Report Definitions

Each regulatory return is modeled as an authoritative metadata definition:

- **Entity Model**: `ReportDefinition`
  - `id`: Canonical primary key (e.g., `rep_M_LCPLC001`).
  - `returnKey`: Central bank statutory return key (e.g., `M_LCPLC001`).
  - `code`: Circular report code (e.g., `LC001`).
  - `name`: Official return title.
  - `category`: Risk classification (`Classification & Provisioning`, `Credit & Lending`, `Exposures & Concentration`, etc.).
  - `frequency`: `MONTHLY`, `QUARTERLY`, `ANNUAL`, `ON_DEMAND`.
  - `status`: `ACTIVE`, `INACTIVE`, `DECOMMISSIONED`, `DRAFT`.
  - `instCode`: Central bank institution identifier (`0000013`).
  - `finYear`: Regulatory financial year baseline (`2026`).
  - `defaultDepartment`: Primary owning department.
  - `currentVersion`: Pointer to the active `ReportVersion`.
  - `nbeMapping`: Central bank gateway ingestion contract details.
  - `displayConfiguration`: Layout instructions (`HYBRID_TABLE_SCHEDULE`, `FIXED_FORM`).

---

## 5. Versioning Foundation & Historical Integrity

A central bank circular update (e.g., revising collateral haircut rules or adding mandatory dynamic schedule columns) must never destroy historical submissions.

### The Versioning Principle
- Each report possesses one or more `ReportVersion` entities.
- When an administrator bumps a report version:
  1. The new version (e.g., Version 2) is created with status `ACTIVE`.
  2. The previous version (Version 1) is transitioned to status `SUPERSEDED`, and its `effectiveTo` timestamp is recorded.
  3. The `ReportDefinition` current version pointer increments.
  4. **Submissions already prepared under Version 1 remain bound to Version 1** with their original schema snapshot intact.
  5. New drafts created after the version bump automatically consume Version 2.

```
Report Definition: M_LCPLC001
├── Version 1 (Status: SUPERSEDED, Period: 2026-01-01 to 2026-09-30)
│    └── Historical Submissions (Jan, Feb, Mar, Q1, Q2) -> Immutable
└── Version 2 (Status: ACTIVE, Period: 2026-10-01 to Present)
     └── Current Submissions (Oct 2026 onwards) -> New schema rules
```

---

## 6. Explicit Relationship Architecture

To eliminate hidden assumptions and ad-hoc string matching, explicit relationship entities govern ownership and responsibilities:

### 6.1 Department ↔ Report (`DepartmentReportAssignment`)
- Explicitly links a department to a report return key.
- `role`:
  - `PRIMARY_OWNER`: Holds primary responsibility for drafting and filing.
  - `CONTRIBUTOR`: Submits data for dynamic schedules or sub-sections.
  - `REVIEWER`: Departmental review and sign-off.
  - `SUPERVISORY`: Compliance / oversight inspection.
- `isActive`: Boolean flag allowing temporary suspension without deletion.
- `effectiveFrom` / `effectiveTo`: Temporal validity bounds.

### 6.2 User ↔ Report (`UserReportAssignment`)
- Explicitly binds a user account to a report return key.
- `duty`: `MAKER`, `CHECKER`, `AUDITOR`, `VIEWER`.
- Guarantees fine-grained segregation of duties and dual-control compliance.

---

## 7. Dynamic Authorization Matrix

Authorization is dynamically computed by the backend `configService.getAuthorizedReportsForUser`:
1. **ADMIN**: Full supervisory oversight across all 24 returns.
2. **AUDITOR**: Read-only independent inspection across all 24 returns.
3. **MAKER / CHECKER**: Access granted if:
   - User has an explicit active `UserReportAssignment` for the return, OR
   - The return is assigned to the user's home department via `DepartmentReportAssignment`, OR
   - The user holds an active, unexpired, non-revoked `SpecialAccessGrant` covering the report or department.
4. **Deny by Default**: Any access attempt outside these authoritative grants is rejected by the backend with HTTP 403.

---

## 8. REST API Foundation

The platform exposes the authoritative configuration under `/api/config/*`:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/config/summary` | Overall configuration health, version hashes, entity counts |
| `GET` | `/api/config/departments` | Hierarchical department tree (`?flat=true` for flat list) |
| `GET` | `/api/config/departments/:id` | Department detail with ancestors, descendants, and assignments |
| `POST` | `/api/config/departments` | Create new department or sub-unit |
| `PUT` | `/api/config/departments/:id` | Update department metadata, hierarchy parent, or status |
| `GET` | `/api/config/reports` | Report definitions catalog (`?category=&frequency=&status=`) |
| `GET` | `/api/config/reports/:key` | Detailed report metadata with active version snapshot |
| `GET` | `/api/config/reports/:key/versions` | List of all versions for a report |
| `GET` | `/api/config/reports/:key/versions/:v` | Exact historical version schema snapshot |
| `POST` | `/api/config/reports/:key/versions` | Create new report version without destroying history |
| `GET` | `/api/config/authorized-reports` | Authoritative authorized reports for specified/current user |
| `GET` | `/api/config/roles` | Enterprise roles catalog |
| `PUT` | `/api/config/roles/:code/permissions` | Update granular permissions for a role |
| `GET` | `/api/config/permissions` | System-wide granular permissions |
| `GET` | `/api/config/workflows` | Configurable workflow definitions and steps |
| `GET` | `/api/config/assignments/departments` | List Department ↔ Report assignments |
| `POST` | `/api/config/assignments/departments` | Assign Department ↔ Report relationship |
| `DELETE`| `/api/config/assignments/departments/:id`| Revoke Department ↔ Report assignment |
| `GET` | `/api/config/assignments/users` | List User ↔ Report assignments |
| `POST` | `/api/config/assignments/users` | Assign User ↔ Report duty |
| `DELETE`| `/api/config/assignments/users/:id` | Revoke User ↔ Report assignment |
| `GET` | `/api/config/changes` | Configuration change audit trail with diffs |
| `POST` | `/api/config/cache/invalidate` | Invalidate configuration caches |
| `GET` | `/api/config/events` | Real-time Server-Sent Events (SSE) notification stream |

---

## 9. Cache Consistency & Real-Time Updates

To guarantee that configuration changes take effect immediately across all connected clients:
1. **Domain Version Counters**: The backend maintains atomic version numbers for `deptVersion`, `reportsVersion`, `workflowsVersion`, `rbacVersion`, and `assignmentsVersion`.
2. **Global Hash**: A composite hash (e.g., `ssot_2_3_1_1_2`) is computed. Clients compare this hash to determine if their cached state is dirty.
3. **Server-Sent Events (SSE)**: Clients subscribe to `/api/config/events`. Whenever an administrator creates a department, updates permissions, or bumps a report version:
   - The backend increments the domain counter.
   - Emits a `config_changed` event with domain and payload.
   - Emits a `cache_invalidated` event.
   - Connected frontends immediately re-sync without requiring browser reloads.

---

## 10. Django Migrations & Dual-Layer Synchronization

The Django backend models (`backend/apps/`) have been fully synchronized with the SSOT architecture:
- `backend/apps/departments/migrations/0002_add_hierarchy_and_assignments.py`: Adds `parent`, `hierarchy_level`, `path`, `status`, `effective_from`, `effective_to` to `Department` and introduces `DepartmentReportAssignment`.
- `backend/apps/reports/migrations/0001_initial.py`: Introduces `ReportDefinition`, `ReportVersion`, `ReportSection`, `ReportField`, `ReportColumn`, and `ReportRow`.
- `backend/apps/accounts/migrations/0002_add_role_permission_and_assignments.py`: Introduces `Role`, `Permission`, `UserReportAssignment`, and `DepartmentMember`.
- `backend/apps/workflows/migrations/0001_initial.py`: Introduces `Submission`, `WorkflowDefinition`, and `WorkflowStep`.
- `backend/apps/audit/migrations/0003_configurationchange.py`: Introduces `ConfigurationChange`.
- `backend/apps/reports/management/commands/seed_ssot_configuration.py`: Provides management command to seed the SQLite database with all 24 returns, 8 departments, roles, and workflows.

---

## 11. Verification & Compliance Sign-Off

The entire Phase 2 Dynamic Configuration SSOT architecture has been verified with 57 automated tests in `src/tests/phase2-configuration-ssot.test.ts`:
- **Department Hierarchy**: 100% PASS (tree traversal, root divisions, sub-units, circular reference prevention).
- **Report Metadata**: 100% PASS (all 24 returns, field data types, dynamic schedule columns).
- **Immutable Versioning**: 100% PASS (Version 1 -> Version 2 bump, historical submission preserved).
- **Relationship Models**: 100% PASS (`DepartmentReportAssignment`, `UserReportAssignment`, active status, revocation).
- **Authorization Boundaries**: 100% PASS (department isolation, special access delegation, auditor inspection).
- **RBAC SSOT**: 100% PASS (roles, granular permissions, dynamic updates).
- **Workflows SSOT**: 100% PASS (four-eyes sequential steps).
- **Cache & Real-Time**: 100% PASS (hash updates, domain version increments, real-time event broadcasting).
