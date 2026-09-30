# 00 - OB REGULATORY REPORTING GATEWAY — MASTER AI INDEX & START HERE

You are continuing development on the **Oromia Bank NBE Regulatory Reporting Platform**, a high-precision, production-grade regulatory reporting, validation, simulation, and data integration gateway engineered for the National Bank of Ethiopia (NBE) regulatory framework under Bank Supervision Directorate (BSD) directives.

---

## 1. Executive Instructions for Incoming AI Sessions

**DO NOT REINVENT OR REDESIGN THE APPLICATION.**  
**DO NOT START FROM SCRATCH.**  
The repository represents a fully functioning, tested full-stack banking application. Your primary responsibility is to maintain architectural integrity, adhere strictly to the Single Source of Truth (SSOT), and continue implementation autonomously without scope creep.

### Standard Verification Commands
Verify system health before and after every engineering operation:
```bash
# 1. Static type checking (must be 0 errors)
npm run lint

# 2. Automated test suite (Theme, Formula AST, Validation, RBAC, Workflows, Auditor, NBE Simulator, SSOT)
npx tsx src/tests/run-all-tests.ts

# 3. Production Vite build compilation
npm run build
```

---

## 2. Definitive Knowledge Base Map (`.ai/` Canonical Directory)

The `.ai/` directory is the canonical project memory and architectural constitution. Every canonical engineering specification strictly follows the `NUMBER_CANONICAL_NAME.md` naming convention:

| Number | Filename | Purpose & Scope | When an AI Agent Should Read It |
|:---:|---|---|---|
| **00** | `00_START_HERE.md` | Master entry point, knowledge base catalog, session reading order, and migration safety protocol | Mandatory first read on every new AI session, account migration, or ZIP restoration |
| **01** | `01_MASTER_AUTONOMOUS_ENGINEER.md` | Autonomous engineer directive for identity, authentication, biometrics, security, and hardware diagnostics | When implementing or debugging authentication, security, biometric hardware, or identity systems |
| **02** | `02_OB_SYSTEM_SPECIFICATION.md` | Comprehensive regulatory reporting platform master prompt, design system, and banking specifications | During system onboarding, architectural review, or full-system feature development |
| **03** | `03_CONTINUATION_AND_RECOVERY.md` | Quick health verification commands, system architecture map, and task resumption checklist | When resuming work, recovering from timeouts/quotas, or verifying build and test health |
| **04** | `04_PROJECT_MEMORY.md` | Persistent project memory, institutional facts (InstCode 0000013), stack baseline, and verification gates | Before starting any task; consulted on every turn for verified system state |
| **05** | `05_SYSTEM_REQUIREMENTS.md` | Functional (P0-P2), technical, and SLA requirements for NBE regulatory returns and workflows | When verifying business logic, compliance directives, or feature requirements |
| **06** | `06_ARCHITECTURE.md` | Clean full-stack architecture (Express on port 3000 + React 19 SPA) and end-to-end data pipelines | When reviewing or modifying system topology, data flow, or server-client boundaries |
| **07** | `07_SSOT.md` | Single Source of Truth governance principles and authoritative registry definitions | When adding or updating business rules, schemas, or role configurations |
| **08** | `08_DEPARTMENT_CATALOG.md` | 8 official Oromia Bank departments, short codes, return mappings, and isolation principles | When working on departmental data isolation, report assignment, or access scopes |
| **09** | `09_REPORT_CATALOG.md` | Index of all 24 NBE regulatory returns, cryptographic SHA-256 hashes, field counts, and dynamic schedules | When inspecting return definitions, field codes, or dynamic schedule properties |
| **10** | `10_REPORT_SCHEMA_ANALYSIS.md` | Global NBE report envelope contract, field validation schemas, and mathematical formula specifications | When implementing or debugging report rendering, validation rules, or AST formulas |
| **11** | `11_NBE_CONTRACT.md` | NBE regulatory intake contract, confirmed facts, simulator failure modes, and API settings | When working on NBE transmission, HTTP adapter, simulator scenarios, or network retries |
| **12** | `12_RBAC_MATRIX.md` | Role matrix (Admin, Maker, Checker, Auditor, System), Segregation of Duties, and BSD/03/2020 rules | When modifying authorization, route guards, user permissions, or 4-eyes workflows |
| **13** | `13_CURRENT_IMPLEMENTATION_STATUS.md` | Comprehensive implementation status, module matrix, 16-component route inventory across 9 viewports, and gates | To check verified features, recent phase completions, and outstanding work |
| **14** | `14_CHANGELOG.md` | Chronological version history, feature additions, fixes, and architectural adjustments | To review past engineering actions and record all new modifications |
| **15** | `15_AUTH_SEED_DATA_AND_BIOMETRIC_TESTING.md` | Authoritative development seed accounts, credentials, and biometric test harness specifications | When testing authentication, login presets, WebAuthn passkeys, or facial recognition |
| **16** | `16_BACKEND_DJANGO_ARCHITECTURE.md` | Clarification on Node.js/Express full-stack reality and audit notice regarding Django references | When examining backend structure to prevent misconceptions about runtime stack |
| **17** | `17_UI_UX_RESPONSIVENESS_AUDIT_AND_ENHANCEMENT.md` | Frontend Design Constitution, zero-pill discipline, 9-viewport responsive matrix, and UI audit | When styling, designing layouts, or fixing responsive UI behavior |
| **18** | `18_NBE_SIMULATOR_MICROSERVICE.md` | Local NBE Central Bank simulator microservice, 6 configurable failure modes, receipts, and mTLS | When testing submission workflows, error resilience, or simulated NBE responses |
| **19** | `19_AUDITOR_ROLE_AND_AUDIT_WORKFLOW.md` | First-class Compliance Auditor role, 7 audit modules, cryptographic evidence seals, and reports | When working on compliance audits, findings lifecycles, evidence seals, or auditor UX |
| **20** | `20_ACCOUNT_MIGRATION_AND_CONTINUATION.md` | Account migration protocol, ZIP transfer procedures, quota safety rules, and post-migration checks | During or immediately after account migration or ZIP import/export |
| **21** | `21_WORKFLOW_MODEL.md` | Regulatory submission lifecycle, state machine transitions, and conflict-of-interest guards | When implementing or testing report states (Draft -> Submitted -> Approved -> Sent) |
| **22** | `22_SECURITY_MODEL.md` | Defense-in-depth security model, IDOR protection, CSRF, TLS, idempotency keys, and audit logs | When implementing or auditing security-critical endpoints, data access, or cryptography |
| **23** | `23_DEVELOPMENT_PLAN.md` | Metadata-driven dynamic engine design, Excel service, and Phase 2 SSOT pipelines | When extending platform capabilities, data connectors, or dynamic area tables |
| **24** | `24_DECISIONS.md` | ADRs 001 through 006 capturing foundational technical choices and rationale | When questioning architectural patterns or evaluating alternative approaches |
| **25** | `25_TASK_QUEUE.md` | Master engineering task queue, priorities, dependencies, acceptance criteria, and status | To identify the next assigned engineering task and track implementation progress |
| **26** | `26_REQUIREMENTS_TRACEABILITY.md` | Traceability matrix linking NBE regulatory requirements to code files and test suites | To verify that regulatory requirements have corresponding implementations and tests |
| **27** | `27_KNOWN_ISSUES.md` | Known issues, edge cases, mitigation strategies, and resolved bug histories | Before investigating anomalies or reporting new defects |
| **28** | `28_COMPLETION_EVIDENCE.md` | Executable verification evidence, gate-by-gate test results, and sign-off criteria | To verify that all quality gates pass before declaring any engineering phase complete |
| **29** | `29_CONFIGURATION_SSOT_AND_METADATA_ARCHITECTURE.md` | Phase 2 Dynamic Configuration SSOT, Department Hierarchy, Metadata Reports, Versioning & REST API | When working on enterprise configuration, department restructuring, report metadata, or versioning |

---

## 3. Recommended Reading Order for a New AI Session

When initializing a new session or resuming development, read documents in this exact logical order:

### Phase A: Orientation & State Verification (Mandatory First 5 Minutes)
1. **`.ai/00_START_HERE.md`** (This file) — Map the knowledge base, verify rules, and review commands.
2. **`.ai/04_PROJECT_MEMORY.md`** — Review current system baseline, institutional parameters, and tech stack facts.
3. **`.ai/13_CURRENT_IMPLEMENTATION_STATUS.md`** — Review verified modules, viewports, and passing completion gates.
4. **`.ai/25_TASK_QUEUE.md`** — Locate your assigned task, dependencies, acceptance criteria, and status.

### Phase B: Core Domain & System Architecture
5. **`.ai/01_MASTER_AUTONOMOUS_ENGINEER.md`** — Understand identity, authentication, biometrics, and security requirements.
6. **`.ai/02_OB_SYSTEM_SPECIFICATION.md`** — Understand overall platform rules, report lifecycle, and UI standards.
7. **`.ai/06_ARCHITECTURE.md`** — Review Node/Express backend on port 3000 and React 19 SPA topology.
8. **`.ai/07_SSOT.md`** — Review Single Source of Truth governance and authoritative file locations.

### Phase C: Regulatory & Compliance Deep Dive
9. **`.ai/08_DEPARTMENT_CATALOG.md`** — Understand 8 bank departments and isolation rules.
10. **`.ai/09_REPORT_CATALOG.md`** & **`.ai/10_REPORT_SCHEMA_ANALYSIS.md`** — Understand the 24 NBE returns, field schemas, and formulas.
11. **`.ai/11_NBE_CONTRACT.md`** & **`.ai/18_NBE_SIMULATOR_MICROSERVICE.md`** — Understand NBE intake gateway and 6 simulation scenarios.
12. **`.ai/12_RBAC_MATRIX.md`** & **`.ai/21_WORKFLOW_MODEL.md`** — Understand Maker-Checker 4-eyes segregation and state machines.
13. **`.ai/19_AUDITOR_ROLE_AND_AUDIT_WORKFLOW.md`** — Understand independent Compliance Auditor role and cryptographic evidence seals.

### Phase D: Quality Assurance & Gate Sign-Off
14. **`.ai/26_REQUIREMENTS_TRACEABILITY.md`** — Verify requirements mapping to code and automated test suites.
15. **`.ai/27_KNOWN_ISSUES.md`** — Check existing mitigations before reporting or fixing anomalies.
16. **`.ai/28_COMPLETION_EVIDENCE.md`** — Confirm all gate criteria are satisfied before declaring completion.

---

## 4. Mandatory Post-Migration & ZIP Transfer Protocol

After every ZIP archive migration or repository transfer between AI Studio accounts:
1. **Inspect `.ai/` directory**: Ensure no temporary or competing files were created.
2. **Verify Canonical Filenames**: Every engineering document must adhere to `NUMBER_CANONICAL_NAME.md` (`00_` to `28_`).
3. **Detect & Eliminate Duplicates**: If any duplicate or unnumbered document appears, compare content immediately, preserve unique valid information in the canonical document, and remove the duplicate.
4. **Repair Broken References**: Never leave unnumbered references (e.g. `02_OB_SYSTEM_SPECIFICATION.md`); point them directly to canonical files (e.g. `.ai/02_OB_SYSTEM_SPECIFICATION.md`).
5. **Never Create Competing Specifications**: Maintain exactly one canonical document per engineering subject.
6. **Consult `.ai/20_ACCOUNT_MIGRATION_AND_CONTINUATION.md`** for detailed continuation protocols and quota-safety rules.

---

## 5. Architectural Non-Negotiables

- **Runtime**: Node.js full-stack Express server listening on **port 3000** (`server.ts`). Mounts Vite middleware in dev and serves `dist/` in prod.
- **No Django Backend**: Node.js and Express are authoritative for all API routes, storage, and mock simulation.
- **Frontend Design Constitution**: Oromia Bank primary palette (Green `#8CC51F`, Blue `#5962AB`, Gold `#DDA63A`). Zero-pill discipline on static metadata. Dual icon+text indicators for accessibility.
- **Security & RBAC**: Defense-in-depth, 4-eyes segregation of duties, immutable audit trail, non-repudiation evidence seals.
