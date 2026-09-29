# PROJECT MEMORY & STATE

## System Overview
- **System**: Oromia Bank NBE Regulatory Reporting, Simulation & Data Integration Platform
- **Institution**: Oromia Bank (InstCode: \`0000013\`)
- **Reporting Period Baseline**: FinYear 2026 (Monthly & Quarterly Returns)
- **Architecture**: Full-Stack TypeScript (Node/Express backend + React 19 frontend on Vite)
- **Port**: 3000

## Major Modules
1. **Report Registry** (\`src/data/report-registry.ts\`): 24 canonical NBE returns, schema signatures, item definitions, and dynamic table definitions.
2. **Formula Engine** (\`src/utils/formulaEngine.ts\`): Safe AST math parser executing regulatory formulas without \`eval()\`.
3. **Validation Engine** (\`src/utils/validationEngine.ts\`): Type checks, required field checks, and business reconciliation constraints.
4. **Workflow Engine** (\`src/services/workflowEngine.ts\`): Enforces Maker/Checker segregation of duties, transitions, and rejection/correction flows.
5. **NBE Adapter & Client** (\`src/services/nbeAdapter.ts\`): HTTP transport client with correlation IDs, idempotency keys, timeouts, and retries.
6. **NBE Simulator** (\`src/services/nbeSimulator.ts\`): Intake server simulating NBE intake gateway with configurable failure scenarios.
7. **Excel (XLSX) Service** (\`src/utils/excelService.ts\`): High-fidelity import/export using SheetJS (\`xlsx\`).
8. **Phase 2 Ingestion & SSOT** (\`src/services/phase2*\`): Core Banking/ERP connectors, Bronze/Silver/Gold data transformation, and GL reconciliation.
9. **Audit Trail** (\`src/services/auditService.ts\`): Immutable event logging for compliance and governance.

## API Conventions
- \`GET /api/regulatory/templates\`: List all 24 registered report templates.
- \`GET /api/regulatory/templates/:key\`: Get full template metadata, fields, and dynamic areas.
- \`GET /api/regulatory/submissions\`: Query submissions with filter by status/key/maker.
- \`POST /api/regulatory/submissions\`: Create new report submission draft.
- \`PUT /api/regulatory/submissions/:id\`: Update draft values and dynamic rows.
- \`POST /api/regulatory/submissions/:id/submit\`: Maker submits report to Checker.
- \`POST /api/regulatory/submissions/:id/review\`: Checker review (Approve, Reject, Request Correction).
- \`POST /api/regulatory/submissions/:id/deliver\`: Deliver approved report to NBE portal.
- \`POST /api/regulatory/submissions/:id/export/xlsx\`: Export report to Excel.
- \`POST /api/regulatory/submissions/:id/import/xlsx\`: Import and map Excel file into report.
- \`GET /api/nbe-simulator/submissions\`: Query received payloads on simulator.
- \`POST /api/nbe-simulator/submit\`: Simulator intake endpoint.
- \`POST /api/nbe-simulator/scenario\`: Configure simulator failure scenario mode.
- \`GET /api/audit-logs\`: Query regulatory compliance audit trail.

## Test Commands & Verification
- `npm run lint` (`tsc --noEmit`): Static type checking (0 errors).
- `npm run build`: Production Vite build compilation (Passes).
- `npx tsx src/tests/run-all-tests.ts`: Complete automated test suite covering Theme Mount Sync, Regulatory Core, Formula AST, Validation Engine, Security/RBAC, Department Isolation, Special Access, Maker/Checker Segregation, Workflow, NBE Simulator & Adapter, Phase 2 SSOT Ingestion, and GL Reconciliation.
- See `.ai/COMPLETION_EVIDENCE.md` for executable gate-by-gate verification logs.
