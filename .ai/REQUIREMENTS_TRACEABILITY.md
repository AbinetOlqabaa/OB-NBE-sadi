# REQUIREMENTS TRACEABILITY MATRIX

| ID | Requirement | Source | Code Files | Test & Evidence | Status |
|---|---|---|---|---|---|
| R001 | All supplied report assets inventoried | Report files | \`report-assets/\`, \`data/report-definitions/\`, \`src/data/report-registry.ts\` | Hash verification in \`.ai/REPORT_CATALOG.md\` | DONE |
| R002 | JSON structures parsed | Report files | \`scripts/build-registry-and-docs.ts\`, \`src/data/report-registry.ts\` | 24 reports validated with 0 parse errors | DONE |
| R003 | Metadata registry | Proposal/assets | \`src/data/report-registry.ts\` | 24 registered templates with frequencies, categories | DONE |
| R004 | Dynamic forms | Proposal | \`src/components/DynamicReportForm.tsx\` | Form rendering for both flat and dynamic tables | DONE |
| R005 | Dynamic report areas | Report assets | \`src/components/DynamicAreaTable.tsx\` | 9 reports with multi-row add/edit/delete | DONE |
| R006 | Typed fields | Report assets | \`src/types/regulatory.ts\`, \`src/utils/validationEngine.ts\` | NUMERIC, TEXT, DATE validation rules | DONE |
| R007 | Required fields | Report assets | \`src/utils/validationEngine.ts\` | Enforced mandatory field checks | DONE |
| R008 | Formula engine | Proposal/assets | \`src/utils/formulaEngine.ts\` | Safe AST math parser (no eval), covers D=B+C, E=A-D, G=E*F | DONE |
| R009 | Validation engine | Proposal/assets | \`src/utils/validationEngine.ts\` | Cross-field, sum reconciliation, and non-negativity checks | DONE |
| R010 | Report versioning | Proposal | \`src/services/submissionService.ts\` | Incremental version numbering on corrections | DONE |
| R011 | Maker workflow | Proposal | \`src/components/MakerDashboard.tsx\` | Create, edit, validate, autosave, submit to Checker | DONE |
| R012 | Checker workflow | Proposal | \`src/components/CheckerInbox.tsx\` | Review, inspect validation, approve, reject, request corrections | DONE |
| R013 | Segregation of duties | Proposal | \`src/services/workflowEngine.ts\` | Server & client block Maker from self-approving | DONE |
| R014 | Audit trail | Proposal | \`src/services/auditService.ts\`, \`src/components/AuditLogViewer.tsx\` | Immutable logging with actor, action, timestamp, old/new states | DONE |
| R015 | NBE adapter | Proposal/assets | \`src/services/nbeAdapter.ts\` | Client adapter with headers, correlation ID, timeout | DONE |
| R016 | NBE Simulator | Proposal | \`src/services/nbeSimulator.ts\`, \`src/components/NBESimulatorConsole.tsx\` | Interactive simulator supporting 6 realistic scenarios & failure simulation | DONE |
| R017 | Idempotent delivery | Engineering req | \`src/services/nbeAdapter.ts\` | UUID idempotency keys preventing duplicate delivery | DONE |
| R018 | Retry handling | Proposal | \`src/services/nbeAdapter.ts\` | Exponential backoff, retry counters, status reconciliation | DONE |
| R019 | XLSX import | Proposal | \`src/utils/excelService.ts\` | Code-based cell mapping, type checks, dynamic row ingestion | DONE |
| R020 | XLSX export | Proposal | \`src/utils/excelService.ts\` | Template and populated data workbook generation | DONE |
| R021 | PDF export | Proposal | \`src/utils/pdfExportService.ts\` | Clean print and printable regulatory report view | DONE |
| R022 | Admin dashboard | Proposal | \`src/components/AdminPanel.tsx\` | User role assignment, template browser, audit monitor, system health | DONE |
| R023 | Scheduling | Proposal | \`src/services/schedulerService.ts\` | Monthly & quarterly regulatory reporting calendars and automated alerts | DONE |
| R024 | Data source abstraction | Proposal (Phase 2) | \`src/services/phase2Connectors.ts\` | Connectors for Core Banking, ERP, Treasury | DONE |
| R025 | Bronze/Silver/Gold | Proposal (Phase 2) | \`src/services/phase2Pipeline.ts\` | Raw ingestion -> Cleansed/conformed -> Aggregated report metrics | DONE |
| R026 | SSOT/MDM foundation | Proposal (Phase 2) | \`src/types/ssot.ts\`, \`src/services/ssotRegistry.ts\` | Customer, Account, Product, Collateral, GL canonical entities | DONE |
| R027 | Data quality | Proposal (Phase 2) | \`src/services/dataQualityEngine.ts\` | Completeness, uniqueness, referential integrity scoring | DONE |
| R028 | Reconciliation | Proposal (Phase 2) | \`src/services/reconciliationEngine.ts\` | GL balance vs report aggregate variance detection | DONE |
| R029 | On-demand generation | Proposal | \`src/services/reportGenerator.ts\` | One-click report population from operational SSOT data | DONE |
| R030 | Scheduled generation | Proposal | \`src/services/schedulerService.ts\` | Trigger generation by frequency milestones | DONE |
| R031 | E2E tests | Proposal | \`src/tests/e2e-workflow.test.ts\` | Automated Golden Path: Maker -> Checker -> Simulator -> Delivery -> Audit | DONE |
| R032 | Security tests | Proposal | \`src/tests/security.test.ts\` | RBAC enforcement, injection resistance, AST formula safety | DONE |
| R033 | Deployment | Proposal | \`server.ts\`, \`package.json\`, \`README.md\` | Full-stack Node/Express/Vite unified deployment | DONE |
| R034 | CI/CD | Proposal | \`.github/workflows/ci.yml\` | Test, lint, build pipeline configuration | DONE |
| R035 | Documentation | Proposal | \`.ai/*\`, \`README.md\` | Complete architectural and operational guides | DONE |
