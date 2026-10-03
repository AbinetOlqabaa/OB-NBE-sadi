# Phase 35 --- Role-Locked Dashboards & Notification-Centered Navigation

## Execution prompt

Remove cross-dashboard switching and replace the current
dashboard-switching control in the authenticated navbar with a
notification bell.

### Required role access model

-   ADMIN → Administrator Dashboard only.
-   MAKER → Maker Dashboard/Workspace only.
-   CHECKER → Checker Dashboard/Inbox only.
-   AUDITOR → Auditor Dashboard only.

A user must not be able to reach another role's dashboard by: - navbar
controls; - dropdowns; - direct URL; - browser history; - command
palette; - sidebar; - mobile navigation; - swipe gestures; - forged
route/state values; - API calls that return unauthorized dashboard data.

### NBE Simulator

Remove NBE Simulator from: - Maker dashboard; - Checker dashboard; -
Auditor dashboard.

Keep NBE Simulator in the Administrator dashboard only.

Do not remove the underlying NBE adapter/simulator service or Admin
functionality.

### Navbar changes

1.  Remove the dashboard-switching dropdown/button.
2.  Add a notification bell icon.
3.  Show unread notification count.
4.  Clicking the bell opens the user's notification center.
5.  Notifications must be role-appropriate and permission-filtered
    server-side.
6.  Support read/unread state and sensible notification grouping.
7.  Do not reveal another department's report metadata through
    notification text.

### Remove Maker-only unimportant icons

Remove the two unimportant icons currently displayed beside the OB logo
in the Maker navbar, while preserving required navigation/accessibility
controls.

### Tests

Cover:

-   each role receives only its own dashboard;
-   direct route access to another dashboard is rejected/redirected;
-   no dashboard switcher exists in navbar;
-   simulator unavailable to Maker/Checker/Auditor;
-   simulator remains available to Admin;
-   notification bell renders;
-   unread count is correct;
-   notification list is permission-filtered;
-   cross-department notification leakage is impossible;
-   Maker navbar has the two specified icons removed;
-   desktop/tablet/mobile navigation remains accessible.

### Acceptance criteria

A logged-in user has one role-specific dashboard context. The navbar no
longer offers dashboard switching. Notifications become the central
cross-workflow attention mechanism.
