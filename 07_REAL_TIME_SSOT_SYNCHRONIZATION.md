# PHASE 7 — Real-Time Single-Source-of-Truth Synchronization

## Objective
Make authoritative changes propagate reliably across the application without creating competing sources of truth.

The Django/database domain remains authoritative. WebSocket/event transport is only a delivery mechanism.

## Instructions

Inspect Django services, REST APIs, database transactions, Redis, Channels/WebSockets if present, Celery if present, React state/query caching, contexts/hooks and notifications.

Define appropriate change events for:
- user changes
- department changes
- report definition/version changes
- assignment changes
- special-access changes
- relevant workflow status changes

An event must represent a successfully committed authoritative change. Do not broadcast changes that later roll back.

If Django Channels/WebSockets are appropriate, implement authentication, authorization, connection lifecycle, reconnect, heartbeat where needed and subscription scoping. Use the existing stack when possible.

On the frontend, authoritative events should invalidate/update affected data without destroying unsaved user input or refreshing the entire application unnecessarily.

Handle connection loss, reconnect, stale data, duplicate events and missed events. After reconnect, revalidate authoritative state.

Never broadcast sensitive data to unauthorized users.

Test:
- Admin change → affected UI updates
- assignment change → effective access updates
- report publication → catalog updates
- special-access revocation → access disappears
- reconnect
- duplicate event
- stale cache
- unauthorized subscription

Update `.ai/13_CURRENT_IMPLEMENTATION_STATUS.md` and `.ai/14_CHANGELOG.md`.

## Completion gate
Verify the path DATABASE → DOMAIN SERVICE → API/EVENT → CLIENT does not create conflicting sources of truth and clients converge to authoritative state.

## Activation Prompt
Read and execute `07_REAL_TIME_SSOT_SYNCHRONIZATION.md`. Inspect the actual stack first. Implement real synchronization, not simulated timers/fake refreshes. Keep Django/database authoritative. Test mutation, event delivery, reconnect, authorization and stale-state handling.
