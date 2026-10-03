# Phase 36 --- Maker-Selected Checker Assignment & Notification Workflow

## Execution prompt

Allow a Maker to select one or multiple eligible Checkers from the same
department when submitting a report, and make the resulting
collaboration notification-driven.

### Required behavior

1.  At submission time, Maker sees a Checker selector.
2.  The selector contains only active Checkers who are eligible to
    review the report.
3.  Eligibility must be determined server-side using:
    -   same department;
    -   active account;
    -   Checker role;
    -   report/dept authorization;
    -   conflict-of-interest / segregation-of-duties rules;
    -   any existing special-access rules.
4.  Maker may select:
    -   one Checker; or
    -   multiple Checkers.
5.  Store the selected reviewer assignments as part of the submission
    workflow record.
6.  Preserve a clear primary/assigned-reviewer concept if the existing
    workflow requires one.
7.  Do not allow a Maker to select themselves.
8.  Do not allow selection of unauthorized Checkers by forged IDs or
    manipulated requests.
9.  Do not allow a Checker to approve a report outside their effective
    authorization.
10. Define how multiple Checkers interact:
    -   all may be notified;
    -   review actions remain governed by the existing 4-eyes/approval
        rules;
    -   conflicting actions are resolved by the authoritative workflow
        state;
    -   duplicate review actions are prevented.
11. On submission, send smart notifications to selected Checkers.
12. Notify the Maker when:
    -   a Checker accepts/opens the review if such an event is
        supported;
    -   requests correction;
    -   approves;
    -   rejects;
    -   assignment changes;
    -   the report is otherwise blocked.
13. Notify Checkers when a report is assigned/reassigned or requires
    attention.
14. Record all assignment and notification events in the audit trail.
15. Ensure notifications are generated from authoritative server events,
    not only frontend actions.
16. Preserve existing Maker-Checker segregation and immutable submitted
    snapshots.

### UI requirements

The submission panel should show:

-   "Select Checker(s)";
-   eligible Checker names;
-   department;
-   availability/active status where appropriate;
-   selected reviewer chips/list;
-   clear explanation when no eligible Checker exists;
-   confirmation before final submission if reviewer selection is
    mandatory.

Do not expose private information beyond what is needed to select a
reviewer.

### Tests

Cover:

-   same-department Checker filtering;
-   inactive Checker excluded;
-   other-department Checker excluded;
-   Maker cannot select self;
-   forged Checker ID rejected;
-   multiple Checker selection;
-   duplicate selection prevented;
-   assignment persisted;
-   notifications emitted;
-   Maker receives review outcome notification;
-   Checker receives assignment notification;
-   unauthorized review action blocked;
-   audit events created;
-   concurrency/conflicting reviewer actions handled safely.

### Acceptance criteria

A Maker can submit a report to one or multiple eligible same-department
Checkers directly from the submission flow. The selected Checkers
receive authoritative notifications, and all subsequent interactions
remain controlled by the existing Maker/Checker workflow and server-side
access engine.
