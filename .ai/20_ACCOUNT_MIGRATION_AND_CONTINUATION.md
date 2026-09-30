# 20 - ACCOUNT MIGRATION & CONTINUATION PROTOCOL
**Application**: Oromia Bank NBE Regulatory Reporting Platform  
**Authority**: Abinet Alemu & National Bank of Ethiopia BSD Guidelines  
**Status**: ACTIVE & CANONICAL  
**Document Version**: 2.0.0 (Phase 0 Post-Migration Normalization)

---

## 1. Technical Stack Reality & Baseline

- **Frontend**: React 19 SPA, TypeScript, Vite, Tailwind CSS v4, Lucide icons, Motion (`src/`).
- **Express Backend**: Real Express server running in Node.js on port 3000 (`server.ts`). Serves client assets in production, provides REST endpoints under `/api/*`, proxies simulator endpoints, and auto-supervises the Django NBE Simulator on port 8001.
- **Django Core Backend**: Real Django 5.2 application in `/backend` (`ob_nbe_platform`), with modular apps (`accounts`, `departments`, `permissions`, `reports`, `workflows`, `audit`, `notifications`, `nbe_gateway`) and persistent SQLite database (`backend/db.sqlite3`).
- **Django NBE Simulator Microservice**: Real independent Django project in `/nbe_simulator_service` (`simulator_project`) running on port 8001 with its own persistent SQLite database (`nbe_simulator_service/simulator_db.sqlite3`).
- **Client Storage**: Real browser `IndexedDB` (`OromiaBank_NBE_Regulatory_DB`) supporting offline field drafts and audit trail caching.
- **NBE Central Bank Adapter**: Outbound HTTP adapter (`src/services/nbeAdapter.ts` and `backend/apps/nbe_gateway/gateway_service.py`) targeting port 8001 with retry backoff, correlation tracking, and idempotency protection.

---

## 2. Mandatory Account Migration Protocol

Every new AI Studio account or session must assume that it has no access to the previous conversation history.
The uploaded project ZIP plus the `.ai/` directory contains all authoritative specifications and persistent state to reconstruct project state without loss.

Before writing code, every incoming agent MUST:
1. **Inspect `.ai/00_START_HERE.md`** to review the knowledge base index and recommended reading order.
2. **Inspect the source tree** (`src/`, `server.ts`, `backend/`, `nbe_simulator_service/`).
3. **Read `.ai/13_CURRENT_IMPLEMENTATION_STATUS.md`** for current verified module status.
4. **Read `.ai/14_CHANGELOG.md`** for past milestone history.
5. **Identify the previous completed phase**.
6. **Verify previous-phase functionality** by running `npm run lint` and `npx tsx src/tests/run-all-tests.ts`.
7. **Identify incomplete work or current assigned task** in `.ai/25_TASK_QUEUE.md`.
8. **Implement only the assigned phase / task** without scope creep or unsolicited refactoring.
9. **Test the implementation** across all relevant unit, integration, and security gates.
10. **Update `.ai/13_CURRENT_IMPLEMENTATION_STATUS.md`** with exact verified results.
11. **Update `.ai/14_CHANGELOG.md`** recording all changes.
12. **Leave the project in a buildable, recoverable state**.
13. **Save the project before quota exhaustion**.

---

## 3. Post-Migration .ai Knowledge Base Integrity & Safety Rules

After every ZIP migration or repository unpack, the incoming agent MUST:
1. **Inspect `.ai/` directory**: Ensure no foreign, temporary, or uncommitted files were introduced during archive extraction.
2. **Verify Canonical Filenames**: Confirm that every active engineering document adheres to the strict canonical naming convention: `NUMBER_CANONICAL_NAME.md` (`00_` through `28_`).
3. **Detect & Eliminate Duplicates**: If any duplicate documents, unnumbered clones, or outdated copies exist, compare content immediately, preserve any unique valid information into the canonical document, and eliminate competing duplicates.
4. **Repair Internal References**: Confirm that all markdown links and documentation references resolve to canonical numbered filenames.
5. **Never Create Competing Copies**: Under no circumstances should an agent create secondary or alternative copies of existing specifications (e.g. `NEW_SPEC.md`, `DRAFT_ARCHITECTURE.md`). All updates must be made directly to the canonical Single Source of Truth document.

---

## 4. Quota Safety & Graceful Handoff Rules

When the agent detects that the current session is approaching a practical token or quota limit, it must NOT begin another large task.
It must first:
1. Finish the current safe code operation.
2. Run available verification tests (`npm run lint`, `npx tsx src/tests/run-all-tests.ts`).
3. Save all modified files.
4. Update `.ai/13_CURRENT_IMPLEMENTATION_STATUS.md`.
5. Update `.ai/14_CHANGELOG.md`.
6. Record the exact unfinished task.
7. Record the exact files being modified.
8. Record any known errors in `.ai/27_KNOWN_ISSUES.md`.
9. Record the next action in `.ai/25_TASK_QUEUE.md`.
10. Leave the project in a buildable state (`npm run build` succeeds).

The next agent will continue seamlessly from these canonical files without reconstructing previous conversation.

---

## 5. Completed Phase Summary: First-Class Auditor Role

The Auditor role has been fully elevated from a basic read-only credential to a **first-class enterprise regulatory audit subsystem**:
1. **Auditor Registration & Admin Approval**:
   - `RegisterPage.tsx` and `userService.ts` allow registration with specific audit scope and BSD/03/2020 regulatory justification.
   - `AdminDashboard.tsx` provides review and authorization workflows.
2. **Auditor Authentication & Workspace Routing**:
   - `LoginPage.tsx` and `userService.ts` automatically navigate approved auditors to `AUDITOR_DASHBOARD`.
3. **Auditor Dashboard (`AuditorDashboard.tsx`)**:
   - Multi-device responsive interface adhering to Oromia Bank Design Constitution.
   - Top KPI metrics: total returns indexed, open findings, critical risk exposures, compliance health score.
   - 7 primary audit modules:
     - `WORK_QUEUE`: Cross-departmental statutory returns index with search, department filtering, and status filtering.
     - `REPORT_AUDIT`: Deep inspection of submitted values, AST formulas, dynamic schedule tables, Maker/Checker signatures, and historical snapshots.
     - `FINDINGS`: Formal findings lifecycle with severity levels (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `INFORMATIONAL`) and statuses (`OPEN`, `UNDER_REVIEW`, `REMEDIATION_PENDING`, `RESOLVED`, `CLOSED`).
     - `EVIDENCE`: Cryptographic evidence management with SHA-256 tamper seals (`OB-EVID-SEAL-...`).
     - `WORKING_NOTES`: Confidential auditor work papers with risk and compliance tagging.
     - `REMEDIATION`: Action assignment, target resolution dates, proof submission, and auditor verification sign-off.
     - `AUDIT_REPORTS`: Official audit report generation with executive summary and verification stamp.
4. **Strict Segregation of Duties (Abinet Alemu Directive)**:
   - In both frontend (`userService.ts`) and Django backend (`apps/permissions/authorization.py` and `apps/workflows/workflow_engine.py`), the Auditor role is explicitly prevented from drafting, editing, submitting, or signing off on reports as a Maker or Checker.
5. **Authoritative Automated Tests**:
   - `src/tests/auditor-workflow.test.ts`: 10 comprehensive test suites (100% pass).
   - `backend/apps/audit/tests.py`: 9 Django test cases (100% pass).
   - Total regression test suite: 9 TypeScript test suites (100% pass), 21 Django test cases (100% pass).

---

## 6. Next Actions for Continuing Engineering

1. **Production Deployment Gate**: Ensure system is packaged cleanly with `npm run build` and `python3 backend/manage.py check --deploy`.
2. **Further Enhancements**: Continued expansion of dynamic schedule templates as new NBE directives are published.
