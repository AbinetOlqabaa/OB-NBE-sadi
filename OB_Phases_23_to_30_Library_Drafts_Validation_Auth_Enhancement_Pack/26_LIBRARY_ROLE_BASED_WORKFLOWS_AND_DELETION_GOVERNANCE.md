# Phase 26 — Library Role-Based Workflows and Deletion Governance

## Execution prompt
Extend Library to Checker, Auditor and Administrator with strict role-based behavior.

### Requirements
1. Checker Library: show only authorized review records and provide view/review/comment/flag/request-correction/approve actions already allowed by workflow. Library access must not grant Maker editing.
2. Auditor Library: provide authorized audit/trace visibility, report history, version history and event inspection. Do not grant ordinary report editing unless explicitly authorized by existing policy.
3. Administrator Library: provide governed broad monitoring/configuration visibility consistent with existing Admin permissions.
4. Use the existing effective-access engine for role, department, report type and special access.
5. Server-side permission filtering is mandatory for all Library queries, search, autocomplete, counts and pagination.
6. Makers cannot delete submitted reports.
7. If Admin is authorized to remove submitted records, prefer archive/void/soft-delete where regulatory retention requires it. Never silently destroy regulatory history.
8. Any destructive Admin action requires authorization, impact warning, explicit confirmation and audit logging.
9. Distinguish view/reuse/edit/review/delete permissions per role.
10. Test cross-department isolation, special access, unauthorized IDs, search leakage, draft deletion and governed submitted-record deletion.
11. Update status/changelog.

Definition of done: all four roles have useful Library workflows without crossing their authorization boundaries.
