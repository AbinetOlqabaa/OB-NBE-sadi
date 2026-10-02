# Phase 30 — Full Integration, Security, Regression and Acceptance

## Execution prompt
Perform a complete integration, security and acceptance pass over Phases 23–29. Fix defects and rerun failed tests.

### Required flows
1. Maker: create → edit → autosave → Library → reopen → edit → validate → submit.
2. Maker: submitted → reuse as new → edit → save → validate → submit as new; original remains unchanged.
3. Validation: error → explanation → field navigation → manual/approved auto-fix → save → revalidate → genuinely resolved.
4. Library role matrix:
   - Maker: own/authorized drafts, edit authorized drafts, reuse submitted, delete unsubmitted only.
   - Checker: authorized review visibility/actions only.
   - Auditor: authorized audit/history visibility.
   - Admin: governed broad access and deletion/archive where policy permits.
5. Every destructive action requires explicit confirmation.
6. Autosave survives navigation, refresh and logout; network failure is visible and recoverable.
7. Logout: click → confirmation → Cancel preserves session; Yes saves pending work then logs out.
8. Dashboard:
   - Maker/Checker/Auditor: no System Health; no SSOT Lakehouse/Medallion feature.
   - Admin: retains both.
9. Remember Me: checked/unchecked, browser restart, expiry, logout invalidation and revocation.
10. Security: reject unauthorized draft edit/view/delete, cross-department access, forged IDs, validation bypass, reset-other-user attempts and unauthorized configuration changes.
11. SSOT: Library and autosave use authoritative report records; no stale frontend state may override server truth.
12. Performance: Library pagination/search, autosave frequency, validation, reuse and logout save flush.
13. Responsive tests at 1920×1080, 1440×900, 1366×768, 1024×768, 768×1024, 430×932, 390×844 and 320×568, plus the real Android tablet where available.
14. Accessibility: keyboard navigation, focus, labels, dialogs, error association and touch targets.
15. Produce a final evidence report distinguishing IMPLEMENTED, VERIFIED, NOT VERIFIED, DEVICE-DEPENDENT and KNOWN LIMITATIONS.
16. Update `.ai/13_CURRENT_IMPLEMENTATION_STATUS.md`, `.ai/14_CHANGELOG.md` and `.ai/11_COMPLETION_GATES.md` consistently.

Definition of done: all discovered defects are fixed and failed tests are repeated. Never claim a real-device test without actual evidence.
