# SECURITY MODEL & COMPLIANCE SPECIFICATION
**Application**: Oromia Bank NBE Regulatory Reporting Platform  
**Classification**: Strictly Confidential / National Bank of Ethiopia Regulatory Interface  
**Version**: 1.0.0  

---

## 1. Authentication & Identity Management
- **Controlled Registration**: Self-registration does not automatically enable privileged access. New users receive `PENDING_APPROVAL` status and cannot authenticate until activated by a Compliance Administrator.
- **Admin Privilege Protection**: Registration endpoints strictly forbid selecting the `ADMIN` role. Administrators must be provisioned via controlled enterprise governance.
- **Session Context**: Every API request and mutation captures `UserSession` containing `id`, `name`, `email`, `role`, `department`, `employeeId`, and `specialAccessGrants`.

---

## 2. Server-Side & Object-Level Authorization
- **Department Boundary Enforcement**: When creating or submitting returns, the backend verifies that the report's responsible department matches the Maker's assigned department.
- **Special Cross-Department Access Mechanism**:
  - Grants must be explicitly issued by an Administrator with documented business justification.
  - Grants can be scoped to a single `reportKey` or an entire external `department`.
  - Supports time-bound expiration (`expiresAt`).
  - Grants can be immediately revoked by the Administrator.
- **Read-Only Supervisory Admin**: The Administrator dashboard is restricted to oversight, user management, audit review, and simulator scenario management. Admins are blocked from altering report data or performing 4-eyes approval.

---

## 3. Mathematical Safety & Sandboxing
- **Safe Formula Engine**: All regulatory arithmetic and ratio formulas are evaluated using a strict AST tokenizer/parser in `src/utils/formulaEngine.ts`.
- **Zero Eval / Zero Function()**: Direct execution of JavaScript `eval()` or dynamic code generation is strictly forbidden to eliminate template-injection risks.
- **Safe Precision**: Financial calculations use 2 decimal places for currency and 4 for ratios, with safe zero-division handling.

---

## 4. Audit Trail Immutability
- **Event Logging**: Every authentication event, report creation, draft update, validation check, Maker submission, Checker sign-off, correction request, NBE delivery attempt, and special access delegation is appended to `src/services/auditService.ts`.
- **Correlation Tracking**: Every operation carries an immutable `correlationId` linking frontend user action, backend processing, and NBE receipt.
- **Non-Repudiation**: Logs record timestamp, actor ID, actor name, actor role, action type, target entity ID, and comprehensive metadata.

---

## 5. NBE Gateway Security & Idempotency
- **Idempotency Protection**: Every NBE transmission generates an `idempotencyKey` formatted as `idemp_{submissionId}_v{version}`. The NBE Simulator and real gateway verify keys to prevent duplicate transactions.
- **Transport Security**: Configured for TLSv1.3 / mTLS mutual certificate authentication and standard Bearer tokens.
- **Automatic Retry with Exponential Backoff**: The NBE Adapter implements resilient retries on 500/504 status codes before marking a transmission as FAILED.
