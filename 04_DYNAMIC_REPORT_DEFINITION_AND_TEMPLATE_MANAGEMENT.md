# PHASE 4 — Dynamic Report Definition and Template Management

## Objective
Make report structure professionally configurable so the bank can evolve reporting without requiring developers to hard-code every structural change, while preserving historical meaning.

## Instructions

Inspect the current 24 NBE report definitions, report models/forms, validation, workflow, NBE mappings, versioning and Maker/Checker/Auditor pages before changing anything.

Establish or complete a metadata-driven Report Definition capable of representing:
- report identity/code/name/description/status/frequency
- owning/responsible departments
- sections
- rows/columns/fields
- labels and data types
- required/optional/default values
- validation rules/formulas
- ordering/display metadata
- NBE return key and payload mapping
- version and effective dates

### Versioning
Use a lifecycle such as Draft → Validate → Preview → Publish → Active → Retired. Do not destructively mutate a published version used by historical submissions.

### Administrator report editor
Where appropriate implement:
- add report
- rename/edit metadata
- add/remove/reorder sections, fields, rows and columns
- change types/required status/validation/formulas
- configure department ownership
- configure NBE mapping
- preview
- save draft
- validate
- publish
- retire

### Existing reports
Preserve the existing 24 NBE definitions and payload semantics. Migrate into metadata where safe. If a definition cannot be migrated without missing information, preserve it and document the blocker rather than inventing semantics.

### Dynamic forms
Where the architecture supports it, report-entry UI should consume report metadata. Backend validation remains authoritative.

### Testing
Test create/edit/version/publish/retire, historical rendering, Maker form generation, Checker review, Auditor visibility, NBE payload generation and authorization. Run regression tests for all existing report workflows.

Update `.ai/13_CURRENT_IMPLEMENTATION_STATUS.md` and `.ai/14_CHANGELOG.md`.

## Completion gate
A report administrator must be able to make a safe structural report change without editing React source for every field, while historical report versions remain reproducible.

## Activation Prompt
Read and execute `04_DYNAMIC_REPORT_DEFINITION_AND_TEMPLATE_MANAGEMENT.md`. Inspect the actual report architecture first. Implement the metadata-driven capability using the existing SSOT foundation. Preserve the 24 NBE report definitions and payload semantics. Work autonomously through implementation, testing, debugging, regression and documentation.
