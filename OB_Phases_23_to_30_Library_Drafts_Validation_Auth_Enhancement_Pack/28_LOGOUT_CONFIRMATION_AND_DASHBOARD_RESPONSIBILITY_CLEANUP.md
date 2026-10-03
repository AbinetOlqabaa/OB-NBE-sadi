# Phase 28 — Logout Confirmation and Dashboard Responsibility Cleanup

## Execution prompt
Add explicit logout confirmation and remove non-Administrator system-monitoring features from other dashboards.

### Requirements
1. Clicking Logout opens a confirmation dialog.
2. Logout occurs only after explicit confirmation.
3. Cancel keeps the session active.
4. Before confirmed logout, flush pending autosave and wait for server confirmation where possible.
5. If save fails, warn the user and do not silently discard work.
6. On successful logout, invalidate/clear the authentication session and sensitive transient biometric state according to existing auth architecture, while preserving persisted drafts.
7. Remove System Health from Maker, Checker and Auditor dashboards, including cards, navigation, unnecessary API calls, polling/subscriptions and dead imports/routes that are exclusively non-admin.
8. Keep System Health for Administrator.
9. Remove the “Phase 2 Single Source of Truth (SSOT) Lakehouse & Medallion Pipeline” feature/display from Maker, Checker and Auditor dashboards.
10. Keep the SSOT Lakehouse/Medallion capability for Administrator.
11. Do not delete backend functionality still needed by Admin.
12. Use role-aware dashboard composition rather than duplicated dashboard code where practical.
13. Reclaim empty layout space and test desktop/tablet/mobile.
14. Test logout and dashboard navigation for all roles.
15. Update status/changelog.

Definition of done: logout is safe and explicit, and only Administrator sees the two specified monitoring features.
