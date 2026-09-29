# AUDITOR ROLE & AUDIT WORKFLOW SPECIFICATION
**Application**: Oromia Bank NBE Regulatory Reporting Platform  
**Compliance Authority**: National Bank of Ethiopia Directive BSD/03/2020  
**Implementation**: `src/services/auditService.ts` & `src/components/AuditTrailView.tsx`  

---

## 1. Compliance Audit Trail Overview
The audit service maintains an append-only, non-repudiation event ledger tracking all significant actions across the platform:
- `USER_LOGIN` / `USER_REGISTER` / `PASSWORD_RESET`
- `BIOMETRIC_ENROLLED` / `BIOMETRIC_LOGIN`
- `USER_STATUS_ACTIVE` / `USER_STATUS_DISABLED`
- `SPECIAL_ACCESS_GRANTED` / `SPECIAL_ACCESS_REVOKED`
- `SUBMISSION_CREATED` / `SUBMISSION_DRAFT_UPDATED`
- `SUBMITTED_TO_CHECKER` / `SUBMISSION_APPROVED` / `SUBMISSION_REJECTED` / `CORRECTION_REQUESTED`
- `NBE_DELIVERY_SUCCESS` / `NBE_DELIVERY_FAILURE`
- `OFFLINE_SYNC_SUBMISSION`

## 2. Administrator & Auditor Inspection Capabilities
- **Read-Only Oversight**: Administrators and Compliance Auditors possess read-only inspection access to all submissions across all 8 bank departments.
- **No In-Flight Tampering**: Administrative roles are strictly forbidden from modifying report values directly or signing off on 4-eyes reviews; review approval must originate from an authorized Checker in the designated department.
- **Export Formats**: Audit logs can be filtered by actor, date range, action type, and exported to JSON format for internal bank audit archives.
