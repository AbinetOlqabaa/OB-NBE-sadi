# ARCHITECTURAL DECISION RECORDS (ADR)

## ADR-001: Metadata-Driven Dynamic Engine vs. 24 Hardcoded Components
- **Decision**: Build a single generic \`DynamicReportForm\` and \`DynamicAreaTable\` driven by a canonical schema registry instead of 24 separate forms.
- **Context**: The bank must support 24 distinct regulatory returns, with frequent NBE circular updates and formula revisions.
- **Alternatives Considered**: 24 separate React forms with bespoke state handling.
- **Reason**: 24 hardcoded forms violate DRY, invite maintenance divergence, make Excel round-trip difficult, and cannot dynamically adapt to new NBE templates.
- **Consequences**: Adding or modifying an NBE return only requires registering schema metadata without UI code refactoring.
- **Date**: 2026-09-24

## ADR-002: AST Token-Based Safe Formula Engine vs. JavaScript eval()
- **Decision**: Implement a restricted, safe mathematical parser supporting arithmetic, percentages, and aggregation without any \`eval()\` or \`Function()\` invocation.
- **Context**: Report definitions contain regulatory formulas (e.g. \`D = B + C\`, \`E = A - D\`, \`G = E * F\`, \`I = H - G\`).
- **Alternatives Considered**: Direct JavaScript \`eval()\` or math.js dependency.
- **Reason**: Security requirement: executing arbitrary code from metadata or templates creates severe injection vulnerabilities in enterprise banking applications.
- **Consequences**: Formulas are guaranteed safe, deterministic, and sandboxed.
- **Date**: 2026-09-24

## ADR-003: Full-Stack Express Server with Native Vite Middleware Mounting
- **Decision**: Implement \`server.ts\` as a unified entry point serving both backend REST API routes (\`/api/*\`) and mounting Vite middlewares in development.
- **Context**: The application requires backend APIs for Maker/Checker workflow, the NBE Simulator, audit trails, and Phase 2 connectors, while adhering to the environment constraint: "server.ts entry point running Express with vite.middlewares mounted in dev ('dev': 'tsx server.ts'). Never mount Express inside vite.config.ts."
- **Alternatives Considered**: Separate client and server processes or client-only mock state.
- **Reason**: Complies with the platform specification and enables unified testing of real HTTP API interactions and the NBE Simulator.
- **Consequences**: Both backend and frontend run seamlessly on port 3000.
- **Date**: 2026-09-24

## ADR-004: In-Memory Persistent Store with Atomic JSON File Backup
- **Decision**: Implement an in-memory repository with file persistence for report submissions, audit logs, and delivery history.
- **Context**: Autonomous start-from-scratch environment where external database provisioning is reserved for explicit tools.
- **Alternatives Considered**: Transient React state only.
- **Reason**: Submissions and audit logs must persist across page refreshes, and the NBE Simulator must query historical delivery attempts.
- **Consequences**: Immediate persistence without external database configuration overhead.
- **Date**: 2026-09-24

## ADR-005: Realistic Local NBE Simulator with Configurable Failure Modes
- **Decision**: Build a full local NBE intake simulator with 6 scenario modes (\`ALWAYS_SUCCESS\`, \`VALIDATION_FAILURE\`, \`AUTH_FAILURE\`, \`TIMEOUT\`, \`SERVER_ERROR\`, \`RANDOM_FLAKY\`).
- **Context**: Live NBE production endpoints and credentials are not accessible in the sandbox development environment.
- **Alternatives Considered**: Fake frontend alerts or static mocks.
- **Reason**: Guarantees contract testing, real network round-trips, idempotency key verification, and negative path testing.
- **Consequences**: Complete verification of banking regulatory submission without live external dependencies.
- **Date**: 2026-09-24
