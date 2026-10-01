# PHASE 3 — Administrator User and Department Management

## Objective
Build professional Administrator management for Users and Departments on top of the Phase 2 dynamic configuration/SSOT foundation.

## Instructions

First read `.ai/00_START_HERE.md`, current implementation status, changelog, architecture, RBAC, security, workflow, database and report specifications. Inspect the real Django models, migrations, APIs, services, React routes and existing dashboards. Do not duplicate existing architecture.

### Users
Implement secure management for:
- list/search/filter/sort/paginate users
- inspect user details
- create/edit where appropriate
- activate/deactivate
- role assignment
- department assignment
- authorized report access
- special access visibility
- account status
- relevant audit history

Support Administrator, Maker, Checker and Auditor. Backend authorization must enforce every sensitive operation.

### Departments
Implement:
- create
- rename/edit
- code/description
- active/inactive
- parent department/hierarchy
- responsibilities
- related reports
- effective dates
- user/report counts
- audit history

Do not assume today's organizational structure is permanent.

### Historical safety
Do not destructively delete entities referenced by historical reporting. Prefer inactive/archived/retired/effective dates. A true delete requires backend proof that it is safe.

### SSOT
Department membership and department/report relationships must use the authoritative backend model. Do not hard-code them in React.

### UX
Use responsive professional tables, pagination, filters, details, confirmation dialogs, validation, loading/empty/error states and permission-denied states. Large datasets must not create endlessly tall pages.

### Security
Enforce role/object authorization server-side, transaction safety and audit logging. Never trust frontend role flags.

### Testing
Test user creation/update/deactivation, role/department changes, department changes, unauthorized mutations, historical integrity, filtering, pagination and relevant API validation. Run regression tests for Admin/Maker/Checker/Auditor/login/report workflows.

Update `.ai/13_CURRENT_IMPLEMENTATION_STATUS.md` and `.ai/14_CHANGELOG.md`.

## Completion gate
Do not declare completion until Users and Departments are genuinely managed through the backend, relationships use SSOT, history is preserved, server authorization works, UI is responsive/paginated, and tests provide evidence.

## Activation Prompt
Read and execute `03_ADMIN_USERS_AND_DEPARTMENTS.md`. Inspect the actual implementation first. Implement the phase completely; do not stop at analysis or recommendations. Work autonomously: inspect → plan → implement → test → debug → retest → regression-test → document. Do not declare completion without evidence.
