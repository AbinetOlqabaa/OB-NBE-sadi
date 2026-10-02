# OB AI Agent Continuation Pack — Phases 23–30

This pack continues the OB/NBE application with report editing/drafts, validation remediation, Library, autosave/persistence, logout safety, dashboard responsibility cleanup, Remember Me, and final integration.

## One-account-per-phase execution
For each phase, start from the complete ZIP produced by the previous account. Read `.ai/00_START_HERE.md`, `.ai/13_CURRENT_IMPLEMENTATION_STATUS.md`, `.ai/14_CHANGELOG.md`, then this phase file. Inspect the actual source before changing it. Implement backend, database, API, frontend, authorization, persistence, testing and documentation. Fix failures, retest, update status/changelog, and download the complete ZIP.

## Phase order
23 — Maker Draft/Edit/Save/Resubmit Lifecycle
24 — Validation Error/Warning Remediation Assistant
25 — Library Core Architecture and Maker Library
26 — Library Role-Based Workflows and Deletion Governance
27 — SSOT Autosave, Persistence, Recovery and Leave-Page Safety
28 — Logout Confirmation and Dashboard Responsibility Cleanup
29 — Remember Me End-to-End Authentication
30 — Full Integration, Security, Regression and Acceptance

## Global rules
- Backend/database is authoritative; do not solve requirements with frontend-only state.
- Preserve the existing 24 NBE payload semantics.
- Never silently mutate a submitted report.
- Reusing a submitted report creates a new report identity/version.
- Makers cannot delete submitted reports.
- Destructive actions require explicit confirmation.
- Autosave must not create duplicate reports or lose data.
- Automatic validation fixes must be safe, explainable, reviewable and revalidated.
- Use the existing dynamic RBAC/department/report/special-access engine.
- Do not claim verification that was not actually performed.
