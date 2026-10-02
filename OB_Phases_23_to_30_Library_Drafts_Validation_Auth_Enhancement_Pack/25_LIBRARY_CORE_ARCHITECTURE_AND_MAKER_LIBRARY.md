# Phase 25 — Library Core Architecture and Maker Library

## Execution prompt
Add a first-class “Library” sidebar feature and implement its authoritative backend architecture and Maker workflow.

### Requirements
1. Library must be backed by the existing authoritative report records/versions, not a disconnected duplicate database.
2. Support clear lifecycle states such as DRAFT, IN_PROGRESS, RETURNED, SUBMITTED and REUSED_COPY, adapting to existing terminology.
3. Makers can save unfinished/finished unsubmitted reports, reopen them, continue, edit, validate and submit.
4. Makers can reuse submitted reports as new reports. Reuse must create a new report identity/version and preserve the source reference; the original remains immutable.
5. Makers may delete unsubmitted saved reports only.
6. Makers must never receive a delete action or backend permission for submitted reports.
7. Add Library search, filtering, status, report type, dates, sorting and pagination using server-side permission filtering.
8. Responsive desktop/tablet/mobile UI; use cards or compact tables where appropriate.
9. Every deletion requires a confirmation dialog with Cancel/Delete.
10. Backend authorization must enforce ownership, department, report-type and special-access rules. Never fetch all records and hide unauthorized records only in the frontend.
11. Library data must survive refresh, logout/login and device restart.
12. Add loading, empty, error and permission-denied states.
13. Test the entire Maker lifecycle from Phase 23 through Library.
14. Update status/changelog.

Definition of done: Maker Library is end-to-end functional and references the authoritative report lifecycle.
