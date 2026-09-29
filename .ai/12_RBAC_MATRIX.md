# ROLE-BASED ACCESS CONTROL (RBAC) MATRIX
**Application**: Oromia Bank NBE Regulatory Reporting Platform  
**Compliance Directive**: NBE Directive BSD/03/2020 (Prudential Governance & Segregation of Duties)  
**Version**: 1.0.0  

---

## 1. Operational Roles

| Role | Definition | Scope | Principle |
|---|---|---|---|
| `ADMIN` | Compliance & System Administrator | Oversight, User Management, Special Access Delegation, System Config | **Read-Only on Report Data**: Cannot create, edit, approve, or submit regulatory returns. Superintends security and governance. |
| `MAKER` | Regulatory Preparation Officer | Home Department Reports | **Maker / Preparer**: Prepares returns, edits drafts, auto-calculates formulas, validates, submits to Checker, revises upon correction requests, and executes final delivery to NBE portal upon approval. |
| `CHECKER` | 4-Eyes Review & Sign-off Officer | Home Department Submissions | **Checker / Sign-Off**: Inspects submitted drafts, validates numbers, requests corrections, approves or rejects. **Cannot edit draft data** and **cannot execute NBE delivery**. |

---

## 2. Granular Permissions Matrix

| Capability / Operation | ADMIN | MAKER | CHECKER | Enforced In Backend |
|---|:---:|:---:|:---:|:---:|
| **View Template Catalog** | YES | YES (Dept Filtered) | YES (Dept Filtered) | `server.ts` & `userService.ts` |
| **Create Report Draft** | NO | YES (Home Dept) | NO | `submissionService.ts` |
| **Edit Draft Values & Rows** | NO | YES (Own Drafts) | NO | `submissionService.ts` |
| **Run Formula Engine** | YES | YES | YES | `FormulaEngine.ts` |
| **Run Validation Engine** | YES | YES | YES | `ValidationEngine.ts` |
| **Submit Draft to Checker** | NO | YES | NO | `WorkflowEngine.ts` |
| **Review Submission (Approve/Reject/Correction)** | NO | NO | YES | `WorkflowEngine.ts` |
| **Self-Approval (Maker approves own submission)** | **DENIED** | **DENIED** | **DENIED** | `WorkflowEngine.ts` & `userService.ts` |
| **Final Delivery to NBE Portal** | NO | YES (Approved only) | NO | `submissionService.ts` |
| **Export Return to Excel (XLSX)** | YES | YES | YES | `server.ts` & `excelService.ts` |
| **Import Return from Excel (XLSX)** | NO | YES (Draft only) | NO | `server.ts` & `excelService.ts` |
| **User Status Management (Approve/Disable)** | YES | NO | NO | `userService.ts` |
| **Grant Special Cross-Department Access** | YES | NO | NO | `userService.ts` |
| **Revoke Special Access** | YES | NO | NO | `userService.ts` |
| **View Audit Trail Logs** | YES | NO | NO | `server.ts` & `auditService.ts` |
| **Configure NBE Simulator Failure Scenarios** | YES | NO | NO | `server.ts` & `nbeSimulator.ts` |
| **Execute Phase 2 SSOT Ingestion Pipeline** | YES | NO | NO | `server.ts` & `phase2Pipeline.ts` |

---

## 3. Segregation of Duties Rules
1. **Self-Review Prohibition**: The user who created or submitted a report draft CANNOT review, approve, or reject that report under any circumstances, even if their account also possesses a Checker role.
2. **Read-Only Supervisory Admin**: The Administrator cannot mutate report numbers, fill templates, impersonate makers, or sign off on returns.
3. **Execution Responsibility**: Only the Maker who prepared the approved report can perform the final cryptographic transmission to the NBE.
4. **Deny By Default**: All access to external departments' reports is denied by default unless an active, time-bound, administrative Special Access Grant exists.
