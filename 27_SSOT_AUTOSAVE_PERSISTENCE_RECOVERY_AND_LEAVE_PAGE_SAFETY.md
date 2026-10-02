# Phase 27 — SSOT Autosave, Persistence, Recovery and Leave-Page Safety

## Execution prompt
Implement reliable autosave and recovery while keeping the backend/database as the single source of truth.

### Requirements
1. Add controlled debounced/throttled autosave for editable report forms; do not save on every keystroke.
2. Use one logical draft identity. Autosave must update it, not create duplicate reports.
3. Show truthful status: Saving…, Saved just now/at time, Save failed — Retry.
4. Never show “Saved” until the backend confirms persistence.
5. Before route changes, attempt to flush pending changes where practical. If persistence fails, warn instead of silently discarding data.
6. Logout must flush pending report changes before completing logout, integrating with Phase 28.
7. Use server version/updated timestamp/optimistic locking to detect stale concurrent edits and provide a conflict-resolution path.
8. If local recovery state is used, it is subordinate to the server copy and must be reconciled safely; it must never become an alternate source of truth.
9. Library must reflect the latest authoritative state using existing SSOT/invalidation mechanisms.
10. Test typing, debounce, navigation, refresh, browser close/reopen where possible, network failure/retry, concurrent editing and duplicate-prevention.
11. Update status/changelog.

Definition of done: ordinary navigation/logout cannot silently lose successfully entered report data and autosave does not create duplicates.
