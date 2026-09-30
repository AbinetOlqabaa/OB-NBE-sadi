# SINGLE SOURCE OF TRUTH (SSOT) SPECIFICATION
**Institution**: Oromia Bank S.C.  
**System**: NBE Regulatory Reporting Platform  
**Status**: ACTIVE & CANONICAL  
**Version**: 1.0.0  

---

## 1. Governance Principles
1. **No Duplicated Business Rules**: Core business rules (departments, roles, report schemas, formulas, validation rules, workflow states) are defined centrally in metadata.
2. **Authoritative Backend**: Backend verification is the authoritative gatekeeper. Frontend components mirror backend permissions for user experience.
3. **Data Quality Tiers**:
   - **Bronze Layer**: Raw ingested records from Core Banking (Finacle / T24), ERP ledgers (Oracle / SAP), and payment switches.
   - **Silver Layer**: Normalized, deduplicated, cleansed, and reconciled entities (Customers, Accounts, Collaterals, General Ledger).
   - **Gold Layer**: Canonical regulatory aggregates mapped directly to the 24 NBE returns.

---

## 2. Core SSOT Entities & Registries
- **Dynamic Configuration & SSOT Engine**: `src/services/configService.ts` & `backend/apps/*` (Documented in `.ai/29_CONFIGURATION_SSOT_AND_METADATA_ARCHITECTURE.md`)
- **Department Hierarchy SSOT**: `configService.getDepartments()` & `/api/config/departments` (supports divisions, parent-child, levels, and paths)
- **Report Definitions & Metadata SSOT**: `configService.getReports()` & `/api/config/reports` (24 returns, fields, data types, columns, formulas, validations)
- **Report Versioning SSOT**: `configService.getReportVersions()` & `/api/config/reports/:key/versions` (immutable version snapshots, historical preservation)
- **Relationship Assignments SSOT**: `DepartmentReportAssignment` and `UserReportAssignment` (explicit M:N ownership and duties)
- **User & RBAC SSOT**: `src/services/userService.ts` & `/api/config/roles`
- **Workflow State Machine SSOT**: `src/services/workflowEngine.ts` & `/api/config/workflows`
- **Data Integration SSOT**: `src/services/ssotRegistry.ts`
- **Audit Logging & Governance SSOT**: `src/services/auditService.ts` & `/api/config/changes`
- **Real-Time Notification Stream**: `GET /api/config/events` (SSE update stream)

The backend is authoritative for identity, roles, permissions, department access, report ownership, workflow transitions, audit records and NBE submission authorization. The frontend is a presentation/client layer and must never be trusted to enforce security-sensitive rules.