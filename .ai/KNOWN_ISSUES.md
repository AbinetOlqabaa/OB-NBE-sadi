# KNOWN ISSUES & RESOLUTION LOG
**Application**: Oromia Bank NBE Regulatory Reporting Platform  
**Updated**: 2026-09-27  

---

## 1. Resolved Issues

| ID | Issue Description | Root Cause | Resolution | Evidence |
|---|---|---|---|---|
| **ISS-001** | Tokenizer in FormulaEngine failed on field codes starting with digits (e.g. `153_00016`). | Numeric regex matched digits before checking if character sequence was an alphanumeric identifier with underscore. | Updated `tokenize` to parse alphanumeric tokens containing `_` as field codes, and restricted number literals to pure digits/decimals. | Formula AST test passes with 100% precision. |
| **ISS-002** | JavaScript `Number("153_00016")` evaluated to `15300016` due to ES2021 numeric separator syntax. | `!isNaN(Number(token))` returned true for field codes with underscores. | Added regex `/^[0-9]+(\.[0-9]+)?$/` check to ensure only pure numeric literals without underscores are parsed as numbers. | Passed. |
| **ISS-003** | Checker delivery segregation test threw unhandled promise rejection. | `deliverToNBE` is an asynchronous method returning a Promise, but was invoked synchronously in test catch block. | Made test function `async` and awaited `submissionService.deliverToNBE(...)`. | Passed. |
| **ISS-004** | Ingestion pipeline automated report generation assigned non-Maker user. | `DEMO_USERS[3]` (Checker) was referenced instead of an authorized department Maker. | Updated `generateReportFromSSOT` to dynamically select the authorized department Maker or issue an audited Special Access grant. | Passed. |
| **ISS-005** | Missing `nbeReferenceNumber` property on `ReportSubmission` type. | Interface omitted optional NBE receipt reference. | Added `nbeReferenceNumber?: string` to `ReportSubmission` in `src/types/regulatory.ts`. | `lint_applet` passed with 0 errors. |

---

## 2. Active Design Constraints
- **Production NBE Gateway**: Live National Bank of Ethiopia endpoints require private VPN and physical mTLS smart cards. The application uses a local NBE intake simulator (`src/services/nbeSimulator.ts`) with configurable failure modes to enable complete end-to-end verification.
- **Port 3000**: Platform runtime constraint mandates dev server running on port 3000. Express server mounts Vite middleware seamlessly.
