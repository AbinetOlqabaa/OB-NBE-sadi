# NBE REGULATORY CONTRACT ANALYSIS

This document establishes the exact contractual facts, requirements, and assumptions for the integration between Oromia Bank (OB) and the National Bank of Ethiopia (NBE) regulatory portal, strictly governed by Section 5 and Section 29 of the Master Autonomous Development Prompt.

---

## 1. Confirmed Facts (Directly established from supplied assets)
These facts are mathematically and structurally verified from the 24 supplied report template files:

1. **Payload Root Envelope Structure**:
   - \`ReturnKey\` (string): Unique identifier for the regulatory return (e.g. \`POBEPE001\`, \`M_LCPLC001\`, \`TOP_20_BOR_TB001\`, \`LOAN_CLA&PROV_LP001\`).
   - \`InstCode\` (string): Institutional code of Oromia Bank, confirmed as \`"0000013"\`.
   - \`FinYear\` (integer): Ethiopian/Fiscal reporting year, confirmed as \`2026\`.
   - \`StartDate\` (ISO 8601 string): e.g. \`"2026-04-01T00:00:00"\` or \`"2026-07-01T00:00:00"\`.
   - \`EndDate\` (ISO 8601 string): e.g. \`"2026-06-30T00:00:00"\` or \`"2026-07-31T00:00:00"\`.
   - \`ReturnItemsList\` (array of items): Fixed structural cells and summary lines.
   - \`DynamicItemsList\` (array of dynamic area blocks): Multi-row variable schedules.

2. **Item Field Schema**:
   - \`Code\` (string): Unique field identifier (e.g. \`153_00001\`, \`122_00004\`, \`RL002_48782\`).
   - \`Value\` (string | number): Cell content submitted to NBE.
   - \`_description\` (string): Human-readable field title, category hierarchies, and embedded calculation rules.
   - \`_dataType\` (enum): Confirmed types are \`"NUMERIC"\`, \`"TEXT"\`, and \`"DATE"\`.
   - \`_required\` (boolean): Mandatory entry indicator (\`true\` / \`false\`).

3. **Dynamic Schedules Schema**:
   - \`Area\` (integer): Area ID (e.g. \`188\` for Top 20 Borrowers, \`171\` for Top 20 NPLs, \`226\` for Large Exposures >10%, \`225\` for Related Parties, \`187\` for Foreclosed Properties Sold, \`172\` for Foreclosed Properties Acquired, \`198\`/\`199\` for Insider Loans, \`196\`/\`197\` for Building & Construction, \`195\` for Restructured Loans, \`179\` for Top 6 Branches NPL).
   - \`_areaName\` (string): Descriptive area name.
   - \`DynamicItems\` (array): Schema of columns for every repeating row in the area. Column codes typically use decimal dotted notation like \`"1.1"\`, \`"1.2"\`, \`"1.3"\`.

4. **Regulatory Formula Clues**:
   - Deductible collateral: \`D = B + C\` (Cash/substitute + Net recoverable value).
   - Net exposure: \`E = A - D\` (Gross amount - Deductible collateral).
   - Specific provisions: \`G = E * F\` (Net exposure * Provisioning rate).
   - Rate categories:
     - Pass = 1%
     - Special Mention = 3%
     - Substandard = 20%
     - Doubtful = 50%
     - Loss = 100%
   - Provision Excess / Shortfall: \`I = H - G\` (Held - Required).
   - Large Exposure Capital Percentage: \`% of Capital = Total Exposure / Capital * 100\`.
   - NPL Ratio: \`NPLs to Total Loans Ratio = (Total NPL / Total Loans) * 100\`.
   - Net Realized Auction Value: \`G = E - F\` (Sales value - Expenses).
   - Average Market Value: \`D = (B + C) / 2\` (Reserve price + Highest bid / 2).

---

## 2. Proposal-Defined Requirements (From OB Platform Proposal v1.0)
1. **Maker-Checker Segregation of Duties**:
   - Maker creates, edits, validates, saves drafts, imports Excel, and submits to Checker.
   - Checker reviews, checks validation, rejects with remarks, requests correction, or approves.
   - Maker cannot approve or submit directly to NBE.
   - Checker cannot alter figures without Maker correction or audit note.
2. **NBE Simulator**:
   - Realistic mock server mirroring NBE intake endpoints.
   - Configurable response behaviors (Success, Validation Error, Authentication Failure, Timeout, Server Error 500, Duplicate Payload).
3. **Idempotent Delivery & Safe Retries**:
   - UUID-based \`Idempotency-Key\` and \`X-Correlation-ID\` per approved delivery.
   - Retry counter, exponential backoff, and duplicate detection.
4. **Excel (XLSX) Round-Trip**:
   - Export report templates and populated submissions to XLSX.
   - Re-import XLSX and validate field-by-field preserving exact decimal figures.
5. **Phase 2 Ingestion & SSOT**:
   - Connector abstraction for Core Banking, ERP, Treasury.
   - Bronze / Silver / Gold data tiers and data quality verification.

---

## 3. Inferred Engineering Conventions
1. **API Transport Architecture**:
   - REST/JSON transport adapter pattern (\`NBEClient\`, \`NBEReportTransport\`).
   - Endpoint convention: \`POST /api/v1/regulatory/submissions\` and \`POST /api/v1/nbe-simulator/submit\`.
2. **Precision & Scale**:
   - Exact decimal handling using fixed 2 decimal places (\`ETB\`) and 4 decimal places for rates/ratios.
3. **Authentication**:
   - Bearer token / OAuth2 client credentials grant protocol abstraction.

---

## 4. Missing External Facts (Must be supplied by NBE in Production)
- Production NBE host URL, port, and gateway paths.
- Mutual TLS (mTLS) client certificate authorities and key-pairs.
- Official NBE OAuth2 token issuance endpoint and client credentials.
- Actual production NBE error code catalog beyond HTTP status codes.

---

## 5. Configurable Settings (Represented as Environment Variables)
- \`NBE_BASE_URL\` (Defaults to internal NBE Simulator: \`http://localhost:3000/api/nbe-simulator\`)
- \`NBE_AUTH_URL\`
- \`NBE_CLIENT_ID\`
- \`NBE_CLIENT_SECRET\`
- \`NBE_TIMEOUT_MS\` (default: 15000)
- \`NBE_MAX_RETRIES\` (default: 3)
- \`NBE_SIMULATOR_SCENARIO\` (default: \`ALWAYS_SUCCESS\`)
