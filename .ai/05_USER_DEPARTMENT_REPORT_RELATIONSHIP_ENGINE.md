# 05 - USER / DEPARTMENT / REPORT / ROLE RELATIONSHIP ENGINE
**Application**: Oromia Bank NBE Regulatory Reporting Platform  
**Compliance Directive**: NBE Directive BSD/03/2020 (Prudential Governance & Segregation of Duties)  
**Security Standard**: Strict Server-Enforced Effective Access Engine  
**Version**: 1.0.0 — Production Architecture  

---

## 1. Executive Summary & Purpose

The **Relationship & Effective-Access Engine** (`src/services/effectiveAccessEngine.ts`) establishes an authoritative, centralized, server-enforced security boundary governing all access to National Bank of Ethiopia (NBE) regulatory reporting operations across Oromia Bank.

In accordance with strict regulatory directives:
1. **No scattered frontend conditionals**: React UI elements only reflect user authorization for UX purposes (e.g., disabling buttons or displaying guidance tooltips). The backend authorization engine is the true security boundary.
2. **Authoritative derivation formula**: Effective access is calculated dynamically from the combination of User Account, Role, Account Lifecycle Status, Department Hierarchy, Report Definitions, Direct User-Report Assignments, Special Access Grants, and Workflow State.
3. **Segregation of duties**: No role may accidentally inherit another role's capabilities, and the 4-eyes dual control rule prohibits self-approval under all circumstances.

---

## 2. Authoritative Effective-Access Mathematical Formula

```
EffectiveAccess(User, Action, Report, Submission) = 
    IsAuthenticated(User)
  ∧ IsAccountActive(User.Status)
  ∧ IsRolePermitted(User.Role, Action)
  ∧ IsReportActive(Report.Status, Action)
  ∧ HasAuthorityOverReport(User, Report, Action)
  ∧ SatisfiesSegregationOfDuties(User, Action, Submission)
  ∧ SatisfiesWorkflowState(Submission.Status, Action)
```

Where:
- **`IsAccountActive`**:
  - `ACTIVE` -> Allowed.
  - `PENDING_APPROVAL` -> Denied (`ACCOUNT_PENDING`).
  - `DISABLED` -> Denied (`ACCOUNT_INACTIVE`).
  - `SUSPENDED` -> Denied (`ACCOUNT_SUSPENDED`).
- **`HasAuthorityOverReport`**:
  - `isHomeDepartment` (User's department matches report's primary department)
  - OR `isLinkedDepartment` (User's department is dynamically linked in M:N report registry)
  - OR `isDirectAssignment` (Report is explicitly assigned to User by Administrator)
  - OR `isSpecialAccess` (User holds active, unexpired, non-revoked Special Access Grant)
- **`SatisfiesSegregationOfDuties`**:
  - For `REVIEW`, `APPROVE`, `REJECT`, `REQUEST_CORRECTION`: User ID must NOT match `Submission.makerId` (`DUTIES_SEGREGATION_VIOLATION`).
  - For `DELIVER_NBE`: Only authorized Maker can deliver; Checker and Admin are forbidden.
  - For `CREATE_DRAFT`, `EDIT_DRAFT`: Only authorized Maker can create or mutate; Checker, Auditor, and Admin are forbidden.

---

## 3. Separation of Role Capabilities

| Capability / Action | ADMIN | MAKER | CHECKER | AUDITOR |
|---|:---:|:---:|:---:|:---:|
| **View Catalog & Reports** | YES | YES | YES | YES |
| **Export Excel (XLSX)** | YES | YES | YES | YES |
| **Create Report Draft** | **NO** | **YES** (Authorized Dept) | **NO** | **NO** |
| **Edit Draft Figures & Dynamic Rows** | **NO** | **YES** (Own / Dept Drafts) | **NO** | **NO** |
| **Validate Figures & Cross-Field Rules** | YES | YES | YES | YES |
| **Submit to Checker (4-Eyes Gate)** | **NO** | **YES** | **NO** | **NO** |
| **Review & Sign-Off (Approve/Reject/Correction)** | **NO** | **NO** | **YES** (4-Eyes Independent) | **NO** |
| **Maker Self-Approval** | **DENIED** | **DENIED** | **DENIED** | **DENIED** |
| **Final Delivery to NBE Portal** | **NO** | **YES** (Approved only) | **NO** | **NO** |
| **Independent Audit Inspection & Findings** | YES (Oversight) | **NO** | **NO** | **YES** |
| **Attach Audit Evidence & Working Papers** | YES | **NO** | **NO** | **YES** |
| **User Identity & Status Management** | **YES** | **NO** | **NO** | **NO** |
| **Department Registry & Linkage Management** | **YES** | **NO** | **NO** | **NO** |
| **Grant / Revoke Special Cross-Dept Access** | **YES** | **NO** | **NO** | **NO** |
| **Configure NBE Simulator Scenarios** | **YES** | **NO** | **NO** | **NO** |
| **Trigger SSOT Data Quality Pipeline** | **YES** | **NO** | **NO** | **NO** |

---

## 4. Controlled Special Access Mechanism

Special Access Grants allow compliance administrators to delegate cross-department or emergency preparation and review permissions while maintaining a tamper-evident audit trail.

### 4.1 Structure of Special Access Grant
```typescript
export interface SpecialAccessGrant {
  id: string;                                     // Unique grant identifier
  userId?: string;                                // Target user ID
  scope: 'REPORT' | 'DEPARTMENT' | 'MULTI_DEPARTMENT' | 'ALL_REPORTS';
  reportKey?: string;                             // Specific return when scope == 'REPORT'
  department?: string;                            // Target department when scope == 'DEPARTMENT'
  departments?: string[];                         // Target departments when scope == 'MULTI_DEPARTMENT'
  grantedBy: string;                              // Admin name & designation
  grantedAt: string;                              // ISO timestamp
  effectiveFrom?: string;                         // Effective start timestamp (future scheduling)
  expiresAt?: string;                             // Strict time-bound expiration
  revoked?: boolean;                              // Revocation flag
  revokedAt?: string;                             // Revocation timestamp
  revokedBy?: string;                             // Revoking administrator
  reason: string;                                 // Mandatory compliance business justification
  auditTrail?: SpecialAccessAuditEntry[];         // Non-repudiation lifecycle audit trail
}
```

### 4.2 Lifecycle Rules
1. **Future Effective Date**: If `now < grant.effectiveFrom`, access is denied.
2. **Time-Bound Expiration**: If `now > grant.expiresAt`, access is denied immediately without requiring code or database changes.
3. **Immediate Administrative Revocation**: Once marked `revoked: true`, cache is purged and access is barred instantly.
4. **Mandatory Justification**: Cannot create grants with empty or trivial justification reasons.

---

## 5. Direct User ↔ Report Assignments

In addition to department-level authority, administrators can assign specific returns directly to an individual user via `effectiveAccessEngine.assignReportToUser(userId, reportKey, adminName)`.
- Allows targeted operational assignments without changing the user's home department.
- Removal via `effectiveAccessEngine.removeReportFromUser(...)` immediately revokes access without code changes.

---

## 6. Authorization Caching & Real-Time Invalidation

To achieve sub-millisecond access evaluation performance across high-frequency UI rendering and API requests, the engine employs a deterministic memory cache:

### 6.1 Cache Key Design
```
CacheKey = userId : userRole : userStatus : userDept : grantsHash : reportKey : action : submissionState
```

### 6.2 Invalidation Triggers
The cache automatically purges when:
- User role or status is updated (`effectiveAccessEngine.onRoleChange`, `invalidateUser`).
- User department is modified or restructured (`effectiveAccessEngine.onDepartmentChange`).
- Special Access is granted, renewed, or revoked (`effectiveAccessEngine.onSpecialAccessChange`).
- Direct report assignment is added or removed (`assignReportToUser`, `removeReportFromUser`).
- Report definition is retired or updated in SSOT (`configService.events.on('CONFIG_CHANGED')`).
- Department registry is modified (`departmentService.subscribe`).

---

## 7. REST API Endpoints

The central server exposes the following direct API endpoints:
- `POST /api/access/evaluate`: Evaluates access authoritatively for (user, reportKey, action, submissionId).
- `GET /api/access/matrix/:userId`: Returns the complete 24-report effective permissions matrix for a user.
- `GET /api/access/user-assignments/:userId`: Returns direct report assignments for a user.
- `POST /api/access/user-assignments`: Admin creates direct report assignment.
- `DELETE /api/access/user-assignments`: Admin removes direct report assignment.
- `POST /api/access/cache/invalidate`: Forces cache purge.
- `POST /api/access/special-grants`: Grants structured special access with audit trail.
- `DELETE /api/access/special-grants/:grantId`: Revokes special access with audit trail.

---

## 8. Verification & Test Evidence

All 10 test matrix categories pass with 100% success in `src/tests/relationship-effective-access-engine.test.ts`:
- [x] All 4 roles tested for positive and negative capabilities.
- [x] Same vs different department isolation verified.
- [x] Direct user-report assignments tested (add -> allow, remove -> deny).
- [x] Special access scopes (`REPORT`, `DEPARTMENT`) verified.
- [x] Time-bound expired grants verified denied.
- [x] Formally revoked grants verified denied.
- [x] Account statuses (`PENDING_APPROVAL`, `DISABLED`, `SUSPENDED`) verified blocked.
- [x] Retired reports verified blocked from creation/modification while preserving view.
- [x] 4-eyes segregation of duties verified (Maker self-approval strictly barred).
- [x] Cache invalidation tested and confirmed.
