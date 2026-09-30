# CONTINUATION & RECOVERY PROTOCOL
**Application**: Oromia Bank NBE Regulatory Reporting Platform  
**Target Agent**: Any subsequent Gemini session or build agent  
**Protocol Version**: 1.0.0  

---

## 1. Quick Verification Commands
To quickly verify that the application remains in a 100% healthy, verified state:

```bash
# 1. Run static type analysis (must be 0 errors)
npm run lint

# 2. Run the complete automated test suite
npx tsx src/tests/run-all-tests.ts

# 3. Test production bundle compilation
npm run build
```

---

## 2. Architecture Map
- `server.ts`: Express backend listening on port 3000, mounting Vite middlewares in dev and serving static assets in prod.
- `src/data/report-registry.ts`: 24 canonical returns with complete metadata, schemas, dynamic areas, and formulas.
- `src/data/organizationHierarchy.ts`: 8 official Oromia Bank departments mapped to report ownership.
- `src/utils/formulaEngine.ts`: Safe AST math parser without `eval()`.
- `src/utils/validationEngine.ts`: Multi-tier regulatory validation engine.
- `src/services/workflowEngine.ts`: Maker-Checker state machine with segregation of duties.
- `src/services/userService.ts`: Authentication, user status, department isolation, and special access grants.
- `src/services/nbeSimulator.ts` & `src/services/nbeAdapter.ts`: Local NBE intake gateway simulator and client.
- `src/services/phase2Pipeline.ts` & `src/services/ssotRegistry.ts`: Bronze/Silver/Gold data ingestion and GL reconciliation.
- `src/tests/run-all-tests.ts`: Orchestrates all 4 automated test suites and theme mount flow tests.

---

## 3. Resumption Checklist
If continuing development or adding new features:
1. Inspect `.ai/28_COMPLETION_EVIDENCE.md` to review the verified gates.
2. Check `.ai/25_TASK_QUEUE.md` for any remaining or newly requested tasks.
3. Make atomic, single-responsibility changes.
4. Run `npx tsx src/tests/run-all-tests.ts` and `npm run lint` before committing work.
5. Record changes in `.ai/14_CHANGELOG.md` and `.ai/04_PROJECT_MEMORY.md`.
