# Phase 47 — Complete Dashboard Component Visibility, Responsive Layout & Full-Page Viewing Audit

## Execution Prompt

Act as the autonomous senior UI/UX, responsive-layout and frontend-quality engineer for the OB application.

Perform a **deep application-wide examination of every component of every dashboard and dashboard-related page before making changes**.

The goal is to ensure that every important component is visible, readable, reachable, correctly contained within page boundaries, touch-friendly, keyboard-accessible, responsive on desktop/tablet/mobile, and conveniently viewable when it contains dense information.

## 1. Complete inventory

Inspect every route and every dashboard, including:

- Administrator Dashboard
- Maker Dashboard
- Checker Dashboard
- Auditor Dashboard
- headers/navbars
- sidebars
- notification panel
- KPI/stat cards
- charts
- tables
- report lists
- Library
- report forms
- validation/remediation panels
- dialogs/modals
- filters/dropdowns
- tabs/accordions
- audit/history views
- activity feeds
- System Health where applicable
- NBE Simulator where applicable
- dynamic report/template components
- loading/empty/error/success states
- authentication transition components
- all shared dashboard components.

For every major component identify its route, role, parent container, width/height behavior, overflow behavior, responsive breakpoints, mobile/tablet behavior, dense-data characteristics, and whether contained scrolling or a maximized viewer would improve usability.

## 2. Page-boundary contract

No important content may:

- disappear below the viewport without an accessible scroll path,
- disappear beyond the right edge,
- overlap another component,
- be clipped by inappropriate `overflow:hidden`,
- hide behind fixed headers/sidebars,
- become inaccessible because of fixed heights,
- break under browser zoom or text scaling,
- become inaccessible when mobile browser toolbars change viewport height.

Eliminate **page-level horizontal overflow**.

Where a genuine wide table/report requires horizontal scrolling, contain that scrolling inside the component rather than making the entire page scroll horizontally.

## 3. Vertical and horizontal scrolling

Implement deliberate scrolling for large:

- tables,
- report rows,
- audit histories,
- logs,
- notifications,
- Library lists,
- configuration panels.

Contained scroll areas must have predictable dimensions, touch scrolling, keyboard accessibility and clear visual boundaries.

Avoid unnecessary nested scrolling.

Use horizontal scrolling only where genuinely necessary, especially for wide regulatory tables and dense report structures.

## 4. Reusable Maximize / Full View feature

Create a reusable **Maximize / Full View** component capability for information-dense components.

Appropriate candidates include:

- large tables,
- dense reports,
- charts,
- audit/history panels,
- logs,
- report-definition previews,
- NBE payload/response inspection,
- large Library lists,
- complex validation/remediation panels.

Do not add maximize controls to every tiny card or simple button.

### Required behavior

When activated:

1. Expand the component into a full-page or near-full-viewport viewer.
2. Clearly identify the maximized component.
3. Transfer scrolling correctly.
4. Prevent page-level horizontal overflow.
5. Provide a visible Restore/Close control.
6. Support Escape where appropriate.
7. Move keyboard focus into the maximized view and restore focus afterward.
8. Work on desktop, tablet and mobile.
9. Respect mobile safe-area insets.
10. Do not rely exclusively on the browser Fullscreen API; an application-level maximized viewer should work reliably.

## 5. Responsive testing

Test at minimum:

- 320×568
- 390×844
- 430×932
- 768×1024
- 844×390
- 1024×768
- 1366×768
- 1440×900
- 1920×1080

Test portrait, landscape, browser zoom, text scaling, touch interaction, virtual keyboard and dynamic mobile browser toolbars.

Use the real Samsung Android tablet when available. Never claim real-device verification without actually performing it.

## 6. Responsive engineering

Audit and improve:

- CSS Grid/Flexbox
- breakpoints
- min/max width and height
- overflow
- fixed/sticky positioning
- viewport units
- typography
- tables
- dialogs
- cards
- report forms.

Prefer fluid layouts using `minmax()`, `clamp()`, flexible tracks, max-width containers and responsive stacking.

Avoid brittle fixed dimensions, excessive absolute positioning, negative-margin hacks, arbitrary viewport heights, hiding content, or page-wide horizontal scrolling.

## 7. Dashboard shell

Deeply inspect header, sidebar, main content and footer.

Verify:

- OB logo visibility,
- notification bell,
- user controls,
- logout,
- responsive collapse,
- sidebar drawer behavior,
- active navigation,
- correct header/sidebar offsets,
- no content behind fixed elements,
- no excessive blank space,
- copyright/footer remains visible without hiding useful content.

## 8. Tables and dense data

Audit every table for:

- column visibility,
- readable headers,
- long text,
- numeric alignment,
- action controls,
- sorting/filtering,
- pagination,
- sticky headers where useful,
- contained horizontal scrolling,
- contained vertical scrolling,
- mobile usability,
- maximize/full-view where beneficial.

Do not shrink regulatory tables until they become unreadable.

## 9. Dynamic reports and forms

Audit titles, subtitles, sections, rows/columns, Maker-editable fields, validation indicators, autosave state, actions, long labels, dates, numbers and dropdowns.

Responsive changes must never allow Makers to edit fixed report titles or alter NBE payload semantics.

## 10. Dialogs/modals

Every dialog must remain within the viewport and support:

- scrolling,
- maximum width/height,
- keyboard navigation,
- focus trap,
- Escape behavior where appropriate,
- mobile usability,
- visible primary/secondary actions,
- long explanatory content.

No important dialog action may be clipped below an inaccessible region.

## 11. Accessibility

Check:

- visible focus,
- keyboard navigation,
- semantic headings,
- labels,
- ARIA where necessary,
- accessible names for icon-only controls,
- tooltip alternatives,
- adequate touch targets,
- screen-reader names,
- focus restoration after maximize,
- validation/error association,
- notification accessibility.

Never communicate important state by color alone.

## 12. Loading/empty/error states

Every major component must have usable loading, empty, error, retry and success states where applicable.

These states must also remain inside page boundaries.

## 13. Performance

While fixing visibility, inspect unnecessary rerenders, oversized DOM trees, large tables, resize listeners, scroll listeners, charts and notification updates.

Use virtualization, debounced resize handling and memoization only where justified.

Do not introduce unnecessary architectural complexity.

## 14. Preserve existing architecture

Reuse the current:

- layout system,
- design tokens,
- responsive utilities,
- RBAC,
- notification service,
- Library,
- dynamic report renderer,
- validation engine,
- SSOT synchronization.

Do not create a parallel dashboard/UI framework.

## 15. Verification

Create/update tests for:

- dashboard rendering,
- viewport changes,
- overflow,
- table scrolling,
- maximize/restore,
- Escape,
- focus restoration,
- modal scrolling,
- mobile navigation,
- report-form visibility,
- Library visibility,
- notification panel,
- role-specific dashboard rendering.

Where possible programmatically detect horizontal document overflow, clipped critical controls and elements extending outside the viewport.

## 16. Final audit report

Produce:

### A. Dashboard inventory
Every dashboard and route examined.

### B. Component inventory
Every major component examined.

### C. Problems found
For each: component, viewport, problem, root cause, severity and fix.

### D. Changes implemented
Responsive, scrolling, maximize/full-view, accessibility, navigation and performance changes.

### E. Verification matrix
For every representative viewport: PASS / FAIL / NOT TESTED / DEVICE-DEPENDENT.

### F. Remaining limitations
Never hide unresolved issues.

### G. Regression results
Confirm that RBAC, reports, Library, notifications, authentication, biometrics, NBE integration, NBE Simulator and autosave remain functional.

## 17. Completion gates

Do not mark this phase complete until:

- every dashboard is inventoried,
- every major component is examined,
- every major viewport is considered,
- page-level horizontal overflow is eliminated,
- genuine wide components have contained horizontal scrolling,
- long components have usable vertical scrolling,
- critical controls are never clipped,
- appropriate dense components have maximize/full-view,
- maximize/restore works on mobile/tablet/desktop,
- dialogs remain usable,
- tables remain usable,
- report forms remain usable,
- notification controls remain accessible,
- navigation remains accessible,
- keyboard/focus behavior works,
- no RBAC/security boundary is weakened,
- regression testing is completed.

**Do not declare success merely because one desktop resolution looks correct.**

The objective is reliable visibility and usability across the complete OB dashboard/component surface.

Finally update:

- `.ai/11_COMPLETION_GATES.md`
- `.ai/13_CURRENT_IMPLEMENTATION_STATUS.md`
- `.ai/14_CHANGELOG.md`

Clearly distinguish IMPLEMENTED from VERIFIED and document anything that could not be tested.
