# SYSTEM REQUIREMENTS SPECIFICATION (SRS)
**Project**: Oromia Bank NBE Regulatory Reporting, Simulation & Integration Platform  
**Target Regulator**: National Bank of Ethiopia (NBE)  
**Reporting Year**: FinYear 2026 (Monthly & Quarterly Returns)  
**Version**: 1.0.0  

---

## 1. Functional Requirements

### 1.1 Report Catalog & Ingestion (P0)
- Ingest and maintain canonical schemas for all 24 NBE regulatory returns.
- Maintain SHA-256 cryptographic hashes for authoritative schemas.
- Provide dynamic table support for 9 returns containing repeatable multi-row schedules (e.g. Top 20 Borrowers, Foreclosed Assets, Insider Loans).

### 1.2 Mathematical & Formula Engine (P0)
- Parse and evaluate regulatory mathematical expressions (e.g. `D = B + C`, `E = A - D`, `G = E * F`, ratios, sums).
- Strict AST tokenizer/parser without `eval()` or arbitrary code execution.
- Auto-calculate dependent formula fields in real time as makers enter figures.

### 1.3 Validation Engine (P0)
- Multi-tier validation: Level 1 (Browser), Level 2 (Backend), Level 3 (Business Constraints), Level 4 (NBE Schema).
- Enforce mandatory fields, non-negative loan figures, date formats (YYYY-MM-DD), and balance sheet reconciliations.

### 1.4 Maker-Checker Governance & Workflow (P0)
- Enforce strict Segregation of Duties: Makers prepare; Checkers approve.
- Conflict-of-Interest Protection: Self-approval or self-review is forbidden.
- Support revision lifecycle: DRAFT -> PENDING_CHECKER -> CORRECTION_REQUIRED -> APPROVED -> SENDING -> SENT.

### 1.5 Departmental Model & Special Access (P0)
- 8 canonical Oromia Bank departments mapped to report ownership.
- Normal makers/checkers only access returns belonging to their home department.
- Administrator can grant explicit, time-bound cross-department Special Access.

### 1.6 NBE Gateway Adapter & Realistic Simulator (P0)
- Real HTTP adapter client with idempotency keys, correlation IDs, timeouts, and retries.
- Local NBE Simulator supporting 6 scenario modes (`ALWAYS_SUCCESS`, `VALIDATION_FAILURE`, `AUTH_FAILURE`, `TIMEOUT`, `SERVER_ERROR`, `RANDOM_FLAKY`).
- Deduplication of identical idempotency keys returning existing receipts.

### 1.7 Excel (XLSX) Import & Export (P0)
- Export official regulatory templates and populated returns to XLSX format.
- Import Excel spreadsheets with cell mapping, validation, and error reporting.

### 1.8 Phase 2 SSOT & Data Integration (P1)
- Bronze -> Silver -> Gold automated data pipeline.
- Connectors to Core Banking (Finacle / T24) and ERP General Ledger (Oracle / SAP).
- Data quality scorecards (Completeness, Uniqueness, Referential Integrity, Range Validity, Deduplication).
- Automated general ledger reconciliation and on-demand return generation.

---

## 2. Technical & Performance Requirements
- **Runtime**: Node.js full-stack Express server with Vite middleware mounting on port 3000.
- **Frontend**: React 19 SPA with TypeScript, Tailwind CSS, Headless UI, Lucide icons.
- **Precision**: 2 decimal places for ETB currency amounts, 4 decimal places for interest rates and provisioning percentages.
- **Auditability**: Complete audit trail with timestamps, actor IDs, roles, actions, and correlation IDs.
