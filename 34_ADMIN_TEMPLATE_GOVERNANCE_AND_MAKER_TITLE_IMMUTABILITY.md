# Phase 34 --- Administrator Template Governance & Maker Title Immutability

## Execution prompt

Strengthen the distinction between report-definition ownership and
report-data entry.

### Required policy

-   Administrator owns and governs report-definition content.
-   Maker enters and edits report values only.
-   Maker cannot change report title, subtitle, section title, row
    title, column title, field code, formula definition, NBE mapping,
    API endpoint or validation rule.
-   Administrator can edit titles and report-definition metadata through
    the governed configuration workflow.
-   Structural changes must create a new report-definition version
    rather than silently changing the active version used by historical
    submissions.

### Required implementation

1.  Make all non-changing template metadata read-only in Maker forms.
2.  Remove editable controls for:
    -   main title;
    -   subtitle;
    -   section/topic titles;
    -   row titles;
    -   column titles;
    -   field labels;
    -   codes;
    -   formulas;
    -   endpoint metadata;
    -   NBE mapping.
3.  Enforce the same restriction server-side.
4.  Do not rely on disabled frontend controls as security.
5.  Add an Admin "Edit Definition" workflow that enters the existing
    configuration-governance lifecycle.
6.  Require impact analysis for material structural changes.
7.  Preserve 4-eyes approval for governed high-impact changes.
8.  Make effective versions immutable after publication.
9.  Ensure historical submissions continue to display the exact
    historical title/structure from their frozen template snapshot.
10. Notify affected users when a material report-definition change
    becomes effective.
11. Provide a visible version/effective-date indicator to Makers.

### Tests

Cover frontend and server-side attempts to:

-   edit main title as Maker;
-   edit row/column titles as Maker;
-   change field codes as Maker;
-   alter formulas as Maker;
-   change API endpoint as Maker;
-   alter validation rules as Maker;
-   Admin creates a new version;
-   old submissions remain unchanged;
-   new submissions use the new active version;
-   high-impact change cannot be self-approved;
-   audit trail captures who/what/when/version.

### Acceptance criteria

The Maker experiences a clearly editable data-entry form but cannot
modify the report definition. Administrator changes are governed,
versioned, auditable and historically safe.
