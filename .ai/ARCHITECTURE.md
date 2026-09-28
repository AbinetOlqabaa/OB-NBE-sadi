# ARCHITECTURE & SYSTEM DESIGN SPECIFICATION
**Application**: Oromia Bank NBE Regulatory Reporting Platform  
**Architecture Style**: Clean Full-Stack Architecture (Node.js/Express + React 19 SPA)  
**Port**: 3000  
**Version**: 1.0.0  

---

## 1. High-Level Architecture Overview

```
                                  +-------------------------------------------------------------+
                                  |                     CLIENT LAYER (REACT 19)                 |
                                  |  MakerWorkspace | CheckerInbox | AdminDashboard | Simulator |
                                  +-------------------------------------------------------------+
                                                                 |
                                              REST APIs (Fetch / JSON / XLSX Binary)
                                                                 v
+-------------------------------------------------------------------------------------------------------------------------------+
|                                            FULL-STACK SERVER (server.ts on Port 3000)                                         |
|                                                                                                                               |
|  +---------------------------+  +---------------------------+  +---------------------------+  +----------------------------+  |
|  |   Regulatory API Routes   |  |     User & Auth Routes    |  |    NBE Simulator Routes   |  |      Phase 2 SSOT Routes   |  |
|  +---------------------------+  +---------------------------+  +---------------------------+  +----------------------------+  |
|               |                              |                              |                              |                  |
|               v                              v                              v                              v                  |
|  +---------------------------+  +---------------------------+  +---------------------------+  +----------------------------+  |
|  |     SubmissionService     |  |        UserService        |  |        NBESimulator       |  |       Phase2Pipeline       |  |
|  +---------------------------+  +---------------------------+  +---------------------------+  +----------------------------+  |
|         /        |       \                   |                              ^                              |                  |
|        /         |        \                  |                              |                              v                  |
|       v          v         v                 v                              |                      +-------------------+      |
|  +---------+ +---------+ +---------+  +-------------+                 +-------------+              |    SSOTRegistry   |      |
|  | Formula | | Validate| | Workflow|  | AuditService|                 |  NBEAdapter |              | (Bronze/Silv/Gold)|      |
|  | Engine  | | Engine  | | Engine  |  +-------------+                 +-------------+              +-------------------+      |
|  +---------+ +---------+ +---------+         |                              |                                                 |
|               |                              v                              |                                                 |
|               v                     +-----------------+                     v                                                 |
|        +-------------+              | Immutable Audit |              [NBE BSD Core]                                           |
|        | Report      |              | Log Store       |              (Gateway API)                                            |
|        | Registry    |              +-----------------+                                                                       |
|        | (24 Reports)|                                                                                                        |
|        +-------------+                                                                                                        |
+-------------------------------------------------------------------------------------------------------------------------------+
```

---

## 2. Key Modules & Separation of Concerns

1. **Metadata Registry** (`src/data/report-registry.ts`):
   - Canonical definitions for all 24 returns.
   - Declarative schemas, dynamic table area definitions, formula graphs, and validation constraints.
2. **Formula AST Engine** (`src/utils/formulaEngine.ts`):
   - Pure recursive-descent math parser.
   - Evaluates arithmetic expressions with precedence, banking rounding, and zero-division protection without `eval()`.
3. **Multi-Tier Validation Engine** (`src/utils/validationEngine.ts`):
   - Checks mandatory fields, numeric types, ISO dates, dynamic column requirements, and business total checks.
4. **Workflow State Machine** (`src/services/workflowEngine.ts`):
   - Strict transition table enforcing Segregation of Duties and Maker/Checker conflict-of-interest prohibitions.
5. **Security & User Service** (`src/services/userService.ts`):
   - Password authentication, controlled registration, status approvals, department isolation, and special cross-department access delegations.
6. **NBE Adapter & Realistic Simulator** (`src/services/nbeAdapter.ts` & `src/services/nbeSimulator.ts`):
   - Full simulator handling correlation IDs, idempotency deduplication, and 6 configurable failure modes.
7. **Excel (XLSX) Service** (`src/utils/excelService.ts`):
   - SheetJS integration exporting structured workbooks with separate sheets for fixed return items and dynamic schedules.
8. **Phase 2 SSOT & Data Integration** (`src/services/phase2Pipeline.ts` & `src/services/ssotRegistry.ts`):
   - Automated Bronze/Silver/Gold ingestion, data quality evaluation, and general ledger reconciliation.
