# Phase 24 — Validation Error/Warning Remediation Assistant

## Execution prompt
Build a unified validation and remediation experience for every report form.

### Requirements
1. Inspect all current frontend, backend, report-definition, business-rule and NBE payload validation layers.
2. Keep authoritative validation server-side.
3. Normalize validation results with severity, field/path, message, explanation, expected format/value, suggested action, rule/source and whether a safe automatic fix exists.
4. Every error/warning must have an understandable explanation: WHAT IS WRONG, WHY IT MATTERS, HOW TO FIX IT, WHAT IS EXPECTED.
5. Clicking a validation item navigates to and highlights the relevant field(s) where practical.
6. Add a safe “Auto Fix” capability only for deterministic corrections such as formatting normalization, safe date/number normalization, or explicitly defined calculations.
7. Never automatically change ambiguous business values.
8. For non-trivial automatic fixes, show CURRENT → PROPOSED and the reason before applying. Safe normalizations may be applied directly if clearly documented.
9. After every fix, save and rerun authoritative validation. Remove a message only when the underlying problem is genuinely resolved.
10. Show a concise validation summary: errors, warnings and readiness.
11. Blocking errors must prevent submission according to current business policy.
12. Distinguish DATA ERROR from REPORT-DEFINITION/RULE ERROR. Only authorized configuration users can change report definitions.
13. Audit meaningful remediation actions without logging sensitive report values unnecessarily.
14. Test required-field, numeric, date, cross-field, warning, multiple-error, auto-fix, ambiguous-fix, revalidation and submission-blocking cases.
15. Update status/changelog.

Definition of done: no validation item is unexplained, automatic fixes are safe/reviewable, and backend validation remains authoritative.
