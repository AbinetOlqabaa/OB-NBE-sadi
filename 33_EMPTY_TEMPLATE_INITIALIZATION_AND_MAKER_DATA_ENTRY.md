# Phase 33 --- Empty Template Initialization & Maker Data-Entry Semantics

## Execution prompt

Make every newly created report instance a clean, usable NBE reporting
template while preventing meaningless validation warnings/errors before
the Maker has entered business data.

### Required implementation

1.  Separate report-definition metadata from submission/business values.
2.  When a Maker creates a report from a newly imported template:
    -   preserve all titles, subtitles, row labels, column labels and
        structural topics;
    -   initialize all editable data fields according to their schema
        type;
    -   do not copy sample values from old JSON definitions.
3.  Implement schema-aware initial-value rules:
    -   numeric fields: use an approved neutral initial state only where
        allowed;
    -   percentages: use a schema-defined neutral state where allowed;
    -   counts: use an integer-safe neutral state where allowed;
    -   text/date fields: use an empty or explicit display placeholder;
    -   repeating tables: initialize with the required structural rows
        but no invented business figures.
4.  Distinguish UI placeholders from actual submitted values.
5.  Placeholder text must never be sent to NBE.
6.  Required fields must still be identifiable as "not yet supplied" and
    must block final submission when appropriate.
7.  Optional fields must not generate unnecessary warnings merely
    because they are untouched.
8.  Validation must not produce duplicate warnings for an untouched
    field.
9.  The validation/remediation assistant must explain genuinely missing
    required values clearly.
10. Provide a "Reset to template defaults" operation for unsubmitted
    drafts without modifying the report definition.
11. Preserve autosave and Library behavior.
12. Preserve submitted-report immutability and Reuse as New behavior.

### Important regulatory/data rule

Do not solve validation noise by inventing financial facts. A
placeholder must never be mistaken for a real ETB amount, ratio, account
count, date or regulatory value.

Where the existing NBE schema explicitly defines a default, use that
default. Otherwise keep the business value unset while suppressing
premature warning noise until the appropriate validation stage.

### Tests

Cover:

-   new report starts clean;
-   no legacy sample values copied;
-   titles preserved;
-   placeholders do not enter NBE payload;
-   optional empty fields do not generate useless warnings;
-   required empty fields remain blocking at submission;
-   numeric/percentage/count initialization is schema-safe;
-   reset-to-template does not modify definition;
-   autosave persists initialized state correctly;
-   reuse-as-new creates an independent clean draft;
-   validation/remediation remains authoritative.

### Acceptance criteria

A Maker can open a newly added report and immediately understand what to
enter without being confronted by a screen full of meaningless
negative/empty-value warnings. At the same time, the system must never
hide a genuinely required business-data error at submission.
