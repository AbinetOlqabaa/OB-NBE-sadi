# PHASE 6 — Safe Bulk Operations, Import, Export and File Workflows

## Objective
Implement professional bulk management over Users, Departments, Reports and their relationships without bypassing authorization, validation, transactions or audit.

## Instructions

Inspect existing management screens, relationship engine, import/export utilities, file upload code, audit logging and transaction handling.

Support appropriate bulk operations such as:
- Users: activate/deactivate, department assignment, role assignment where permitted, report assignment, special-access grant/revoke
- Departments: safe bulk relationship changes
- Reports: activation/retirement/assignment/export

Avoid destructive bulk deletion by default.

### Mandatory workflow
Select/upload → parse → validate → detect conflicts → preview → explicit confirmation → transactional execution → audit → result report.

Never mutate authoritative data merely because a file was uploaded.

Support CSV/XLSX where appropriate. Validate required columns, types, identifiers, duplicate rows, unknown entities, unauthorized changes and invalid relationships.

Provide dry-run results showing valid, invalid, unchanged, created, updated, conflicting and rejected rows.

Prefer atomic transactions for atomic batches. If partial success is intentionally supported, report exact row results and audit them.

Exports must respect role/department/report permissions and important exports should be audited.

Protect against malicious files, oversized uploads, unsupported formats, formula injection where relevant, path traversal, mass assignment and privilege escalation. Never trust client-side validation.

Use pagination for large previews/results.

Test valid/invalid imports, duplicates, unknown departments/reports, unauthorized changes, rollback, export authorization and large datasets.

Update `.ai/13_CURRENT_IMPLEMENTATION_STATUS.md` and `.ai/14_CHANGELOG.md`.

## Completion gate
Bulk operations must not bypass normal authorization, SSOT or audit mechanisms.

## Activation Prompt
Read and execute `06_BULK_OPERATIONS_IMPORT_EXPORT.md`. Inspect existing infrastructure first. Implement safe, transactional, auditable bulk operations. Do not create shortcuts around authorization or SSOT. Test valid, invalid, unauthorized and rollback scenarios.
