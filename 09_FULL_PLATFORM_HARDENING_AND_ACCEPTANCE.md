# PHASE 9 — Full Platform Integration, Security, E2E and Production Hardening

## Objective
Perform comprehensive engineering hardening and acceptance after the dynamic configuration platform is implemented. This is not merely a cosmetic review.

## Instructions

Read the complete `.ai` knowledge base and inspect Django, database/migrations, React, APIs, authentication/biometrics, RBAC, relationship engine, report engine, NBE integration/simulator, bulk operations, real-time synchronization, governance/versioning, audit logging and all role dashboards.

### Architecture audit
Find and fix:
- duplicated business logic
- hard-coded departments
- hard-coded report relationships
- hard-coded permissions
- duplicated report definitions
- frontend sources of truth
- stale caches
- conflicting APIs
- unsafe bypasses
- dead/incomplete code
- incomplete migrations
- placeholder functionality

### Role E2E
Verify Admin, Maker, Checker and Auditor authentication, authorization, dashboard behavior, reporting workflows, special access and boundaries.

### Configuration mutation tests
Actually perform scenarios such as:
1. Rename a department and verify authoritative views update.
2. Change a department/report relationship and verify access changes.
3. Add a report and verify authorized catalogues update.
4. Retire a report and verify new submissions are blocked while historical records remain.
5. Create a new report version and verify old submissions remain reproducible.
6. Grant special access and verify access.
7. Revoke it and verify access disappears.
8. Change a role and verify effective permissions.

### Security
Test authentication, object authorization, privilege escalation, direct API manipulation, CSRF where applicable, input validation, file upload security, export security, sensitive-data exposure, audit integrity, session/token behavior.

### NBE
Verify simulator/API contracts, payload generation, response handling, errors, timeouts, retries, reference IDs and audit trail. Do not invent real NBE behavior not supplied by NBE.

### Responsive regression
Test desktop/laptop/tablet/mobile portrait/landscape, including navigation, dashboards, tables, pagination, forms, modals, notifications, Login, Registration and biometric screens.

### Performance
Investigate API latency, large tables, reports, dashboards, bulk operations, real-time updates, unnecessary repeated requests and N+1 queries.

### Failure testing
Test unavailable API/database/NBE, timeout, WebSocket disconnect, malformed data, invalid report configuration, unauthorized access, expired session and failed bulk import.

### Automated testing
Run the available backend, API, authorization, frontend, integration and E2E suites. Add missing high-value tests. Never claim a test was run if it was not.

### Data integrity
Verify migrations, seed data, SSOT uniqueness, relationships, report versions, historical records and audit events.

### Documentation
Update `.ai/13_CURRENT_IMPLEMENTATION_STATUS.md` and `.ai/14_CHANGELOG.md`.

Clearly distinguish:
- IMPLEMENTED
- VERIFIED
- NOT YET VERIFIED
- KNOWN LIMITATION

## Final acceptance gate
Do not declare OB complete merely because the UI loads. Completion requires evidence that core workflows, authorization, SSOT configuration, report versioning, bulk safety, real-time synchronization, governance, NBE simulation/integration, responsive behavior and major E2E workflows work as implemented.

## Activation Prompt
Read and execute `09_FULL_PLATFORM_HARDENING_AND_ACCEPTANCE.md`. Treat this as full engineering acceptance and hardening. Inspect the actual application, execute tests, find defects, fix them, retest and regression-test. Do not produce only a report. Continue until gates are satisfied or a genuine external blocker prevents completion, and document limitations honestly.
