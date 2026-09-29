# OB — COMPLETE UI/UX, RESPONSIVE DESIGN AND PAGE-LAYOUT ENGINEERING TASK

## AUTONOMOUS FULL-STACK UI/UX ENHANCEMENT DIRECTIVE

You are continuing development of the OB application as an autonomous senior:

- UI/UX engineer
- React frontend engineer
- responsive web engineer
- accessibility engineer
- design-system engineer
- frontend performance engineer
- QA engineer
- E2E testing engineer.

This task is specifically focused on performing a COMPLETE UI/UX AND RESPONSIVE DESIGN AUDIT AND IMPLEMENTATION across the entire OB application.

Do not limit the work to the currently visible dashboard.

Inspect EVERY accessible page, route, component, modal, dialog, form, table, card, navigation system, notification, authentication page, registration page, settings page, report page, administrative page and responsive state that exists in the application.

The objective is not simply to make the application "look better".

The objective is to make the entire application:

- modern
- professional
- visually consistent
- intuitive
- accessible
- responsive
- touch-friendly
- keyboard-friendly
- readable
- performant
- structurally robust
- usable on different screen sizes
- usable on different device types
- usable across supported modern browsers
- resistant to overflow and clipping
- resistant to layout collapse
- consistent across all dashboards and pages.

Do not declare completion until the complete UI/UX and responsive verification process has been performed.

---

# 1. FIRST: AUDIT BEFORE MODIFYING

Do NOT immediately start changing random CSS.

First inspect the entire frontend.

Identify:

- all routes
- all pages
- all layouts
- all dashboards
- all shared components
- all navigation components
- all forms
- all tables
- all cards
- all modals
- all dialogs
- all dropdowns
- all menus
- all notifications
- all loading states
- all error states
- all empty states
- all authentication screens
- all report-management screens
- all administrator screens
- all Maker screens
- all Checker screens
- all profile/settings screens
- all system-health screens
- all biometric screens
- all responsive CSS
- all breakpoints
- all fixed-width elements
- all fixed-height elements
- all components that use absolute positioning
- all components that may overflow.

Determine which components are shared and which are page-specific.

Do not unnecessarily duplicate components.

---

# 2. CREATE AN INTERNAL PAGE INVENTORY

Build an internal inventory similar to:

PAGE
→ ROUTE
→ ROLE ACCESS
→ COMPONENTS
→ DESKTOP STATE
→ TABLET STATE
→ MOBILE STATE
→ LANDSCAPE MOBILE STATE
→ POTENTIAL PROBLEMS
→ REQUIRED FIXES
→ TEST STATUS.

Every page must eventually have a verified responsive state.

Do not assume that because one dashboard works responsively, all other pages work responsively.

---

# 3. RESPONSIVE DESIGN PRINCIPLE

The application must adapt to the available viewport.

Do NOT design only for:

- 1920 × 1080
- 1366 × 768
- one desktop monitor.

The application must gracefully adapt to:

- large desktop
- normal desktop
- laptop
- tablet landscape
- tablet portrait
- large mobile
- normal mobile
- small mobile
- mobile landscape.

Where technically relevant, also consider:

- browser zoom
- operating-system text scaling
- dynamic browser toolbars
- safe-area insets
- touch input
- virtual keyboard
- orientation changes.

---

# 4. NO HORIZONTAL OVERFLOW

This is a mandatory acceptance requirement.

Pages must not unexpectedly exceed the viewport width.

Audit for:

- horizontal page scrolling
- overflowing cards
- overflowing tables
- oversized buttons
- long text
- long report names
- long department names
- long user names
- unbroken identifiers
- wide forms
- oversized charts
- wide navigation bars
- modal overflow
- code/data displays
- notification overflow.

Do not simply hide overflow with:

overflow: hidden;

if doing so would hide important information.

Fix the underlying layout.

When data genuinely requires horizontal scrolling, contain the scroll inside the appropriate component rather than allowing the entire page to overflow.

---

# 5. RESPONSIVE LAYOUT STRATEGY

Use a coherent responsive layout system.

Prefer:

- CSS Grid
- Flexbox
- fluid widths
- max-width containers
- minmax()
- clamp()
- responsive typography
- responsive spacing
- container-aware layouts where appropriate.

Avoid excessive:

- fixed pixel widths
- fixed heights
- absolute positioning for normal layout
- viewport-specific hacks
- device-specific duplicated pages.

The same component should adapt rather than being unnecessarily recreated for every device.

---

# 6. PAGE WIDTH

Every major page should have an appropriate content container.

Use a sensible:

max-width

where appropriate.

The application should not appear:

- excessively stretched on huge screens
- cramped on laptops
- clipped on tablets
- horizontally overflowing on phones.

The page should maintain comfortable reading width.

---

# 7. NAVIGATION RESPONSIVENESS

Audit:

- sidebar
- top navigation
- breadcrumbs
- menus
- profile menu
- notifications
- role navigation
- dashboard navigation.

Desktop may use:

sidebar + top navigation.

Tablet may use:

collapsible sidebar.

Mobile may use:

drawer / bottom navigation / compact header depending on the application's existing design language.

Do not allow navigation controls to consume the entire mobile viewport.

Navigation must remain accessible.

The currently selected page must remain visually identifiable.

---

# 8. DASHBOARD RESPONSIVENESS

Every dashboard must be independently audited.

This includes, where present:

- Administrator Dashboard
- Maker Dashboard
- Checker Dashboard
- System Health Dashboard
- User/Profile Dashboard
- Report Dashboard
- any other role-specific dashboard.

Dashboard cards must adapt.

Example:

Desktop:

4 cards across

Tablet:

2 cards across

Mobile:

1 card across

But do not blindly apply this exact pattern.

Use the actual content and available width to determine the appropriate layout.

Cards must not:

- overlap
- clip text
- become unusably narrow
- create horizontal overflow.

---

# 9. DATA TABLES

Tables require special attention.

Audit every table.

On large screens:

display appropriate columns.

On smaller screens:

do not simply shrink the table until it becomes unreadable.

Use an appropriate strategy such as:

- controlled horizontal scrolling inside the table container
- responsive column prioritization
- expandable row details
- stacked mobile representation
- card-based representation
- abbreviated labels with accessible full labels.

Choose the best solution for each table.

Actions must remain accessible.

Do not allow important action buttons to disappear outside the viewport.

---

# 10. FORMS

Audit every form.

Forms must work properly on:

- desktop
- tablet
- mobile.

Inputs must not be too small for touch.

Labels must remain readable.

Validation messages must not cause layout collapse.

Long validation messages must wrap.

Multi-column forms should collapse intelligently on smaller screens.

Do not create unnecessarily long vertical forms on desktop.

Do not create cramped multi-column forms on mobile.

---

# 11. REGISTRATION PAGE

Specifically audit and improve:

- registration layout
- role selection
- department selection
- password fields
- biometric registration
- camera-related UI
- validation
- progress indicators
- confirmation states.

The registration experience should remain usable when the viewport becomes narrow.

If registration is multi-step:

desktop should make good use of available space.

mobile should use an appropriate vertical workflow.

---

# 12. LOGIN PAGE

Audit:

- username/email field
- password
- authentication-method selector
- Face Authentication
- Device Biometric
- password recovery
- error messages
- loading state
- camera interface
- biometric instructions.

The login page must remain usable on small mobile screens.

Do not allow the biometric UI to extend beyond the viewport.

Camera preview must resize correctly.

---

# 13. FACE AUTHENTICATION UI

Audit the Face Authentication screen.

The camera preview should:

- maintain correct aspect ratio
- remain within the viewport
- adapt to portrait and landscape
- avoid cropping the user's face unnecessarily
- provide understandable guidance.

Instructions should not overlap the camera.

Status messages should not cover important camera content.

Buttons must remain reachable.

The interface must gracefully handle:

- camera unavailable
- permission denied
- no camera
- initialization failure
- timeout
- no face detected
- poor image quality
- authentication failure
- success.

---

# 14. DEVICE BIOMETRIC / WEBAUTHN UI

The UI should NOT pretend that a fingerprint scanner is physically being read by the webpage.

The interface should communicate that the device's platform authenticator is being invoked.

The screen must handle:

- supported
- unsupported
- available
- unavailable
- cancelled
- timeout
- authentication failure
- success.

Do not create misleading animations that suggest raw fingerprint data is being captured by the web application.

---

# 15. MODALS AND DIALOGS

Audit every modal/dialog.

A modal must:

- fit within the viewport
- remain centered appropriately
- scroll internally when content is long
- never extend beyond the viewport
- maintain accessible focus
- support keyboard navigation
- provide an obvious close/cancel mechanism.

On mobile, large dialogs may need to become near-full-screen panels.

Do not let desktop-sized dialogs remain unchanged on mobile.

---

# 16. DROPDOWNS AND SELECTORS

Audit all:

- select fields
- custom dropdowns
- command menus
- date pickers
- role selectors
- department selectors
- report selectors.

Ensure they:

- remain usable on mobile
- do not extend outside the viewport
- remain keyboard accessible
- do not become clipped by parent containers.

---

# 17. TYPOGRAPHY

Create a coherent responsive typography system.

Audit:

- headings
- body text
- labels
- table text
- dashboard metrics
- buttons
- notifications.

Prevent:

- text clipping
- excessive line length
- tiny mobile text
- oversized headings that dominate small screens.

Use responsive sizing where appropriate.

Prefer a consistent design scale rather than arbitrary font sizes.

---

# 18. SPACING

Audit:

- page margins
- section spacing
- card padding
- form spacing
- dashboard gaps
- navigation spacing.

Desktop should not feel empty.

Mobile should not feel cramped.

Use a coherent spacing system.

---

# 19. TOUCH TARGETS

Interactive controls must be usable on touch devices.

Ensure:

- buttons
- icons
- navigation items
- checkboxes
- switches
- dropdowns
- table actions

have adequate touch target sizes and spacing.

Do not place tiny icon-only buttons next to each other without sufficient separation.

---

# 20. ACCESSIBILITY

Audit all pages for:

- semantic HTML
- labels
- keyboard navigation
- visible focus
- screen-reader compatibility
- form error association
- dialog focus
- accessible names
- color contrast
- non-color status indicators.

Do not communicate critical information through color alone.

Examples:

Approved:

icon + color + text

Error:

icon + color + text

Warning:

icon + color + text.

---

# 21. LOADING / EMPTY / ERROR STATES

Every page that loads data should have deliberate states.

LOADING:

Use an appropriate skeleton/spinner/progress indicator.

EMPTY:

Explain what the user is seeing and what they can do next.

ERROR:

Explain the problem in human language and provide recovery where possible.

SUCCESS:

Provide clear confirmation.

Do not allow pages to appear broken simply because an API request is still loading.

---

# 22. DASHBOARD INFORMATION HIERARCHY

Review the visual hierarchy of every dashboard.

Important information should be immediately understandable.

Consider:

- page title
- summary metrics
- alerts
- pending tasks
- recent activity
- primary actions
- workflow status
- detailed data.

Do not make every card visually equally important.

The UI should communicate what requires attention.

Do not change business meaning while improving visual hierarchy.

---

# 23. ROLE-SPECIFIC UX

Administrator:

Focus on:

- monitoring
- system health
- reports
- users
- status
- audit
- security
- diagnostics.

Do not accidentally expose modification controls where Administrator is read-only.

Maker:

Focus on:

- assigned reports
- drafts
- pending submissions
- checker feedback
- report completion
- NBE submission.

Checker:

Focus on:

- reports awaiting review
- review status
- comments
- flags
- approval/request-for-correction actions.

The visual design should make each role's primary work obvious.

---

# 24. RESPONSIVE REPORT FORMS

Report forms are especially important.

Audit all 24 report workflows/pages.

Fields should adapt according to:

- viewport
- field type
- content length
- validation state.

On mobile:

- single-column forms where appropriate
- full-width inputs
- accessible controls
- clear section grouping.

On desktop:

- use available space efficiently
- group related fields
- avoid unnecessarily long forms.

Do not change the underlying NBE payload semantics while changing presentation.

---

# 25. NBE / JSON DATA DISPLAY

If JSON or API payload information is displayed:

Do not allow long JSON values to destroy page layout.

Use:

- wrapping
- controlled scrolling
- expandable sections
- formatted JSON viewer where appropriate.

Sensitive information must not be exposed unnecessarily.

---

# 26. NOTIFICATIONS

Audit:

- toast messages
- alerts
- confirmation messages
- validation messages.

They must:

- remain visible long enough
- not cover critical controls
- adapt to mobile
- wrap text
- remain accessible.

On mobile, notifications should not extend beyond the screen.

---

# 27. DEVICE ORIENTATION

Where appropriate, verify:

PORTRAIT
LANDSCAPE

especially for:

- camera
- dashboards
- tables
- report forms
- charts.

Do not assume portrait orientation.

---

# 28. BROWSER RESPONSIVENESS

Test the application in supported modern browsers where the environment allows:

- Chromium-based browser
- Firefox
- Safari/WebKit where available.

Pay attention to:

- viewport sizing
- camera APIs
- WebAuthn
- CSS compatibility
- form controls
- sticky positioning
- dialogs
- scrolling.

Do not claim browser testing that was not actually performed.

---

# 29. VISUAL REGRESSION

After modifying shared components, revisit every page that uses them.

A shared component change can create regressions elsewhere.

Perform a complete route-by-route regression review.

Do not stop after checking only the page you modified.

---

# 30. PERFORMANCE

Do not sacrifice performance for visual effects.

Avoid unnecessary:

- animations
- large images
- excessive shadows
- expensive rendering
- unnecessary re-renders.

Use animations intentionally.

Respect reduced-motion preferences where appropriate.

---

# 31. DESIGN CONSISTENCY

Create or improve a coherent visual design system.

Standardize:

- colors
- typography
- spacing
- border radius
- shadows
- buttons
- inputs
- cards
- badges
- alerts
- tables
- navigation
- modal behavior.

Avoid each page looking like it was designed by a different person.

---

# 32. DO NOT DESTROY FUNCTIONALITY

During UI/UX improvements:

DO NOT remove:

- API functionality
- validation
- permissions
- role behavior
- report workflows
- audit logging
- security controls
- biometric functionality
- backend integration.

Visual improvements must preserve application behavior.

If a UI problem reveals an underlying functional problem, fix the underlying problem as well.

---

# 33. IMPLEMENTATION STRATEGY

Use this process:

PHASE 1
Inspect the complete frontend.

PHASE 2
Inventory every page and component.

PHASE 3
Identify shared design-system opportunities.

PHASE 4
Fix global layout/responsive foundations first.

PHASE 5
Fix navigation.

PHASE 6
Fix dashboards.

PHASE 7
Fix forms.

PHASE 8
Fix tables.

PHASE 9
Fix authentication/registration/biometric screens.

PHASE 10
Fix report forms and report pages.

PHASE 11
Fix administrator/system-health pages.

PHASE 12
Fix modals, notifications and secondary components.

PHASE 13
Run responsive testing.

PHASE 14
Fix discovered problems.

PHASE 15
Run complete regression testing.

PHASE 16
Perform final visual/UX audit.

Do not modify hundreds of unrelated files unnecessarily.

Reuse shared components.

Fix problems at the correct abstraction level.

---

# 34. RESPONSIVE TEST MATRIX

Where testing tools are available, test representative viewport classes.

At minimum:

## Large Desktop

1920 × 1080

## Desktop

1440 × 900

## Laptop

1366 × 768

## Tablet Landscape

1024 × 768

## Tablet Portrait

768 × 1024

## Large Mobile

430 × 932

## Mobile

390 × 844

## Small Mobile

320 × 568

## Mobile Landscape

844 × 390

These are representative test viewports, not assumptions that only these devices exist.

The application must use fluid responsive behavior rather than device-specific hacks.

---

# 35. ACCEPTANCE CRITERIA

A page is NOT considered responsive merely because it technically fits.

It must remain usable.

For each page verify:

[ ] No unexpected horizontal page overflow
[ ] No clipped important content
[ ] No overlapping controls
[ ] No inaccessible buttons
[ ] No unreadable text
[ ] No broken navigation
[ ] No broken dialogs
[ ] No unusable tables
[ ] No broken forms
[ ] No hidden primary actions
[ ] No broken loading states
[ ] No broken error states
[ ] No broken empty states
[ ] Touch interactions work
[ ] Keyboard navigation works
[ ] Focus remains visible
[ ] Content hierarchy remains clear
[ ] Role-specific functionality remains intact
[ ] Backend/API functionality remains intact.

---

# 36. AUTOMATED TESTING

Where the project's test infrastructure supports it, create or update tests for:

- responsive navigation
- responsive dashboard rendering
- form rendering
- table behavior
- modal behavior
- authentication pages
- role-specific pages
- protected routes
- responsive report forms.

Use browser automation/E2E tooling where available.

Test actual viewport sizes.

Do not rely exclusively on unit tests for responsive behavior.

---

# 37. MANUAL / VISUAL VERIFICATION

Where the environment allows browser interaction, inspect the actual rendered application.

Do not rely exclusively on source-code inspection.

Look for:

- unexpected overflow
- clipping
- spacing problems
- visual hierarchy problems
- unreadable content
- broken mobile navigation
- poor touch interaction
- dialogs extending beyond viewport
- table usability.

If screenshots or browser inspection tools are available, use them.

---

# 38. REGRESSION REQUIREMENT

After the UI/UX enhancement:

Verify that:

Registration still works.

Login still works.

Password reset still works.

Face authentication still works.

Device biometric authentication still works.

Maker dashboard still works.

Checker dashboard still works.

Administrator dashboard still works.

Report creation still works.

Report review still works.

Report submission still works.

NBE integration remains intact.

Audit logs remain intact.

System Health Dashboard remains intact.

Hardware Diagnostics History remains intact.

Permissions remain intact.

---

# 39. COMPLETION GATE

DO NOT report completion until:

1. Every route has been inventoried.
2. Every major page has been inspected.
3. Every dashboard has been reviewed.
4. Shared components have been reviewed.
5. Responsive foundations have been reviewed.
6. Mobile layouts have been tested.
7. Tablet layouts have been tested.
8. Desktop layouts have been tested.
9. Forms have been tested.
10. Tables have been tested.
11. Modals have been tested.
12. Navigation has been tested.
13. Authentication screens have been tested.
14. Biometric screens have been tested.
15. Report screens have been tested.
16. Administrator pages have been tested.
17. Maker pages have been tested.
18. Checker pages have been tested.
19. Accessibility has been reviewed.
20. No unintended page-level horizontal overflow remains.
21. Shared-component regressions have been checked.
22. Existing business functionality remains operational.
23. E2E tests have been executed where available.
24. Discovered issues have been fixed and retested.

---

# 40. FINAL REPORT

Only after verification provide a concise report containing:

## UI/UX AUDIT
Number of pages/routes inspected.

## COMPONENT AUDIT
Shared components inspected and improved.

## RESPONSIVE IMPROVEMENTS
Major improvements implemented.

## MOBILE
Verified behavior.

## TABLET
Verified behavior.

## DESKTOP
Verified behavior.

## ACCESSIBILITY
Improvements made.

## DASHBOARDS
Administrator:
Maker:
Checker:
System Health:

## REPORT PAGES
24 report workflows reviewed where available.

## TESTING
Tests actually executed.

## E2E
Workflows actually verified.

## REMAINING LIMITATIONS
Only genuine limitations.

Do not claim visual/device/browser verification that was not actually performed.

Distinguish:

IMPLEMENTED

from:

VERIFIED.

---

# FINAL INSTRUCTION

Begin immediately.

First inspect the entire existing React frontend and create an internal route/component inventory.

Then identify the highest-impact structural responsive problems.

Then implement the improvements.

Then test.

Then fix.

Then test again.

Continue autonomously until all completion gates have been satisfied.

Do not stop after producing an audit.

The desired result is a fully implemented and verified OB frontend that behaves professionally and remains usable across different browser viewport sizes and device classes without breaking existing functionality.