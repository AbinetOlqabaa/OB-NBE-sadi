# OB Phases 3–9 Continuation Pack

Use one phase per Google AI Studio account/quota cycle.

For every phase:
1. Upload the complete ZIP from the previous account.
2. Save/import the project.
3. Read `.ai/00_START_HERE.md`, `.ai/13_CURRENT_IMPLEMENTATION_STATUS.md`, and `.ai/14_CHANGELOG.md`.
4. Read the matching phase prompt in this pack.
5. Paste its Activation Prompt into Gemini.
6. Require inspection before implementation.
7. Require implementation, testing, debugging, regression testing, and documentation.
8. Before quota ends, update the project status/changelog and download the complete ZIP.

## Core continuation rule

Source code is authoritative for what actually exists. `.ai` is authoritative for intended architecture, requirements, decisions, and accumulated engineering knowledge. If they disagree, inspect, preserve valid behavior, document the discrepancy, and update the appropriate `.ai` document.

The long-term architecture is database/backend SSOT driven. React must not become a competing source of truth for users, departments, reports, permissions, relationships, or workflows.

Prefer versioning, activation/deactivation, archival, effective dates, audit trails, transactions, and governed publication over destructive deletion of historically important records.

Never claim a browser, device, API, WebSocket, migration, bulk operation, or E2E test was verified unless it was actually performed.

Every phase must update:
- `.ai/13_CURRENT_IMPLEMENTATION_STATUS.md`
- `.ai/14_CHANGELOG.md`

Every phase must distinguish IMPLEMENTED from VERIFIED.
