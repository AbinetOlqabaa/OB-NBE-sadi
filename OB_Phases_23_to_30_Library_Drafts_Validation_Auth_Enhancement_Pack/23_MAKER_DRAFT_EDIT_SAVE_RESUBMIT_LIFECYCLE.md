# Phase 23 — Maker Draft/Edit/Save/Resubmit Lifecycle

## Execution prompt
Implement a complete Maker report lifecycle for every authorized report form:

CREATE → EDIT → SAVE DRAFT → LEAVE → RETURN → CONTINUE → VALIDATE → SUBMIT

and:

SUBMITTED REPORT → REUSE AS NEW → NEW DRAFT → MODIFY → SAVE → SUBMIT

### Requirements
1. Inspect the current report models, report-definition versions, form state, workflow states, Maker permissions, Checker workflow, NBE submission state, audit history and existing save logic before modifying anything.
2. Reuse the existing lifecycle architecture; do not create a parallel report system.
3. Normalize states as appropriate to the current implementation, including DRAFT, SAVED/IN_PROGRESS, RETURNED_FOR_CORRECTION, READY_FOR_SUBMISSION and SUBMITTED/accepted/rejected states where already supported.
4. Makers may edit authorized non-final reports and returned reports.
5. Saving must persist the current report state to the backend.
6. A previously submitted report must NEVER be edited in place. “Reuse” creates a new report identity linked to the source report/version.
7. The new reused report must be editable, saveable, validatable and submitable as a new submission.
8. Protect against concurrent tabs/stale versions using the existing optimistic-lock/version mechanism where available.
9. Record meaningful lifecycle audit events without auditing every keystroke.
10. Preserve NBE payload semantics and report-definition authority.
11. Test create/save/reopen/edit/submit, returned-and-resubmit, reuse-submitted, unauthorized access, cross-department access and concurrent-edit conflicts.
12. Update `.ai/13_CURRENT_IMPLEMENTATION_STATUS.md` and `.ai/14_CHANGELOG.md`.

Definition of done: no submitted record can be silently mutated and every Maker-editable report has a persistent edit/save/reopen path.
