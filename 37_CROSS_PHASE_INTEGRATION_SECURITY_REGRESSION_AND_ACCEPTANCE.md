# Phase 37 --- Cross-Phase Integration, Security, Regression & Acceptance

## Execution prompt

Perform the final integration and acceptance pass for Phases 31--36
without weakening any previously verified behavior.

### End-to-end scenarios

#### Scenario 1 --- Import to usable report

Admin: 1. imports an NBE JSON package; 2. receives schema validation; 3.
previews normalized report definition; 4. reviews
titles/sections/columns/formulas; 5. configures or verifies API
endpoint; 6. publishes through governed approval; 7. sees the report
appear in the Admin NBE Simulator.

Maker: 8. sees the new report according to department authorization; 9.
creates a clean instance; 10. sees correct titles and row/column labels;
11. enters values; 12. autosaves; 13. validates; 14. submits.

#### Scenario 2 --- Maker cannot alter definition

Attempt: - title editing; - subtitle editing; - row/column title
editing; - formula editing; - endpoint editing; - validation-rule
editing; - field-code editing.

All must be rejected both in UI and server-side.

#### Scenario 3 --- Checker assignment

Maker selects one or multiple eligible Checkers, submits, and all
authorized notifications are generated. Unauthorized Checkers cannot be
selected even through forged requests.

#### Scenario 4 --- Dashboard isolation

Verify each role can access only its own dashboard and that NBE
Simulator is Admin-only.

#### Scenario 5 --- Empty-template behavior

Create a report with every editable field untouched. Confirm: - no
meaningless warning storm; - placeholders are not submitted as business
values; - required fields become blocking at the correct
validation/submission stage; - optional fields remain clean; - no
invented financial facts are stored.

#### Scenario 6 --- Historical safety

Change the report title/structure in a new Admin version. Confirm old
submitted reports retain the old title/structure and new reports use the
new active version.

### Security regression matrix

Attempt:

-   cross-role dashboard URL access;
-   cross-department report access;
-   forged report IDs;
-   forged Checker IDs;
-   unauthorized endpoint changes;
-   unauthorized template changes;
-   unauthorized simulator access;
-   direct API modification of titles by Maker;
-   direct API modification of formulas by Maker;
-   notification enumeration;
-   notification access across departments;
-   duplicate assignment;
-   stale version update;
-   race-condition submission;
-   validation bypass;
-   sample-value injection.

All must be blocked or safely handled.

### Performance and resilience

Measure:

-   JSON import;
-   schema normalization;
-   template preview;
-   report creation;
-   validation;
-   notification dispatch;
-   simulator registration/discovery;
-   Library search;
-   dashboard route authorization.

Verify autosave, refresh, logout-save flush, offline recovery and
optimistic locking continue to work.

### Regression

Run the full existing test suite, including the Phase 30 acceptance
suite. Do not claim a real-device result without actual device evidence.

### Required documentation

Update consistently:

-   `.ai/13_CURRENT_IMPLEMENTATION_STATUS.md`
-   `.ai/14_CHANGELOG.md`
-   `.ai/11_COMPLETION_GATES.md`

Add evidence categories:

-   IMPLEMENTED;
-   VERIFIED;
-   NOT VERIFIED;
-   DEVICE-DEPENDENT;
-   KNOWN LIMITATIONS.

### Definition of done

All discovered defects are fixed and failed tests are repeated. No
existing verified Phase 30 behavior is regressed. New report types can
be introduced through governed JSON import/configuration rather than
hardcoded source changes, and the complete Admin → Template → Maker →
Checker → Notification → NBE Simulator lifecycle is demonstrably
functional.
