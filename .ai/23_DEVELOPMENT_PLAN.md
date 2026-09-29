# DEVELOPMENT PLAN & ARCHITECTURE

## 1. Architectural Strategy
The Oromia Bank NBE Platform is designed as a metadata-driven regulatory reporting system. Rather than creating 24 bespoke, hard-coded report forms, a unified **Report Engine** interprets canonical JSON schemas discovered from the 24 supplied report assets.

### High-Level Architecture
\`\`\`text
                  [ React 19 Frontend - TypeScript + Tailwind ]
            ┌───────────────────┬───────────────────┬───────────────────┐
      [ Maker Workspace ] [ Checker Inbox ] [ Admin Panel ] [ NBE Simulator UI ]
            └───────────────────┴───────────────────┴───────────────────┘
                                       │ REST / API
                                       ▼
                   [ Full-Stack Express Server (server.ts) ]
            ┌───────────────────────────────────────────────────────────┐
            │ • Regulatory API Gateway (/api/regulatory/*)              │
            │ • NBE API Adapter & Transport Client                      │
            │ • Built-in Local NBE Simulator (/api/nbe-simulator/*)     │
            │ • Audit Logging & Integrity Service                       │
            │ • Phase 2 Connectors & SSOT Data Pipeline                 │
            └───────────────────────────────────────────────────────────┘
                                       │
            ┌──────────────────────────┴──────────────────────────┐
            ▼                                                     ▼
 [ In-Memory / File Persistent Store ]                [ Canonical Metadata Registry ]
  • Report Submissions & Revisions                    • 24 NBE Return Templates
  • Dynamic Schedules Rows                            • Formula Expression Rules
  • Audit Trail Logs                                  • Cross-Field Validation Rules
  • Delivery Attempt Logs                             • Dynamic Table Schemas
\`\`\`

## 2. Core Subsystems

### A. Report Engine & Metadata Registry
- **Canonical Schemas**: Normalized definitions derived from supplied \`.txt\` assets.
- **Dynamic Forms**: Renders fields based on \`_dataType\` (NUMERIC, TEXT, DATE) and required flags.
- **Dynamic Schedules**: Repeatable tabular row editor with multi-column support, row insertion, deletion, and validation.

### B. Safe Formula Engine
- Restrictive expression evaluator operating on parsed tokens (Addition, Subtraction, Multiplication, Division, Sum, Average, Ratio).
- Zero \`eval()\` or unsafe script execution.
- Circular dependency detection and division-by-zero protection.
- Live reactive calculations on form input.

### C. Maker-Checker Segregation of Duties
- Strict server-authoritative state transitions:
  \`DRAFT\` -> \`PENDING_CHECKER\` -> \`APPROVED\` (or \`REJECTED\`, \`CORRECTION_REQUIRED\`) -> \`SENDING\` -> \`SENT\` (or \`FAILED\`).
- Prohibition on Maker self-approval: server rejects approval requests if \`actorId === makerId\`.

### D. NBE API Adapter & Local NBE Simulator
- Transport abstraction handles correlation IDs, timeout budgets, and exponential backoff retry.
- Idempotency enforced via unique \`Idempotency-Key\` headers per report submission.
- Simulator provides real endpoints for testing intake, authentication, schema validation, and failure scenarios.

### E. Excel (XLSX) Round-Trip Engine
- Powered by SheetJS (\`xlsx\`).
- Generates clean workbook templates with metadata, field codes, descriptions, and dynamic areas.
- Re-imports Excel files, resolves cells by \`Code\`, enforces data types, and updates values without loss of precision.

### F. Phase 2 SSOT & Data Integration
- Mock connector adapters for Core Banking (T24/Finacle), ERP, and Treasury.
- 3-tier pipeline: Bronze (Raw ingestion) -> Silver (Cleansed/Deduplicated) -> Gold (Report-ready aggregates).
- Automated regulatory data reconciliation comparing operational GL balances against NBE return totals.
