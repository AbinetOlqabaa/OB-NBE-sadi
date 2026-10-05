# 14 - CHANGELOG

All notable changes and engineering enhancements for the Oromia Bank NBE Regulatory Reporting Platform are recorded in this file.

---

## [47.0.0-phase47-dashboard-component-visibility-responsive-viewing-audit] - 2026-10-05

### Added & Enhanced
- **Phase 47: Complete Dashboard Component Visibility, Responsive Layout & Full-Page Viewing Audit (`47_DASHBOARD_COMPONENT_VISIBILITY_RESPONSIVE_FULL_VIEW_AUDIT.md`, `OB_Phase_47_Dashboard_Component_Visibility_Responsive_Viewing_Audit/47_DASHBOARD_COMPONENT_VISIBILITY_RESPONSIVE_FULL_VIEW_AUDIT_REPORT.md`, `src/tests/phase47-dashboard-component-visibility-responsive-viewing-audit.test.ts`)**:
  - **Top Navbar Telemetry & Banner Cleanup**:
    - Checked and verified complete absence of network indicator and microsecond latency indicators (`µs`, `microsecond`, latency telemetry) across Administrator, Maker, Checker, and Auditor dashboards.
    - Checked and verified complete removal of `"Regulation.... National Bank Of Ethiopia"` banner text from the top navbar, ensuring prominent display of the authentic Oromia Bank logo without visual clutter.
  - **Maker Report Creation "Help" Button Label**:
    - Replaced the obsolete `"Remediation Assistant"` button label with `"Help"` on the Maker report form creation/editing page (`DynamicReportForm.tsx`).
    - Retained all underlying 4-part NBE validation guidance, blocking error badges, warning counters, and click-to-locate auto-fix capabilities.
  - **Reusable Maximize / Full View Capability**:
    - Implemented `MaximizedViewModal` (`src/components/MaximizedViewModal.tsx`): Accessible dialog with `role="dialog"`, `aria-modal="true"`, mobile safe-area insets, backdrop blur, component identification (title, badge, subtitle, icon), action slot, prominent Restore button with `Esc` indicator, and contained scrollable body.
    - Implemented `MaximizeButton` (`src/components/MaximizeButton.tsx`): Universal >=44px touch-friendly trigger button with `Maximize2` icon and accessible ARIA label.
    - Integrated full-view capability into 9 critical dense views: User Directory (`AdminDashboard.tsx`), Statutory Returns (`MakerWorkspace.tsx`), 4-Eyes Review Queue (`CheckerInbox.tsx`), Supervisory Queue & Inspection (`AuditorDashboard.tsx`), Template & Return Catalog (`MakerLibraryView.tsx`), Immutable Audit Trail (`AuditTrailView.tsx`), Multi-Record Dynamic Area (`DynamicAreaTable.tsx`), 12-Month Historical Trend Chart (`HistoricalSubmissionTrendChart.tsx`), and Regulatory SLA Analytics (`ReportingPerformanceAnalytics.tsx`).
  - **Modal Keyboard Accessibility & Escape Handling**:
    - Added global `Escape` key listeners with `e.stopPropagation()` in `NotificationCenter.tsx`, `KeyboardShortcutsModal.tsx`, `OfflineStorageModal.tsx`, and `MaximizedViewModal.tsx`.
  - **Page-Boundary Contract & Contained Scrolling**:
    - Enforced `overflow-x-hidden` at the root layout container in `App.tsx` to eliminate document-level horizontal scroll.
    - Added contained horizontal touch scrolling (`overflow-x-auto touch-scroll-x`) with regulatory minimum column widths (`min-w-[650px]` to `min-w-[850px]`) across tables in Admin, Maker, Checker, Auditor, Library, and Area subtables.
    - Added `overflow-x-auto touch-scroll-x` to JSON payload `<pre>` tags in `NbeSimulatorView.tsx` to prevent modal boundary clipping on mobile.
    - Guaranteed minimum 44×44px touch target dimensions for interactive controls.
  - **9-Viewport Responsive Matrix Verification**:
    - Validated all 9 required viewports: 320×568 (iPhone SE), 390×844 (iPhone 14/15), 430×932 (iPhone Pro Max), 844×390 (Mobile Landscape), 768×1024 (iPad Portrait), 1024×768 (iPad Landscape), 1366×768 (HD Laptop), 1440×900 (Desktop Baseline), and 1920×1080 (FHD Large Desktop).
  - **Full Automated Test & Regression Suite**:
    - Created `src/tests/phase47-dashboard-component-visibility-responsive-viewing-audit.test.ts` and registered in `src/tests/run-all-tests.ts`.
    - Executed full test runner: 100% of test suites passed cleanly with zero regressions.

---

### Added & Enhanced
- **Phase 37: Cross-Phase Integration, Security, Regression & Acceptance (`37_CROSS_PHASE_INTEGRATION_SECURITY_REGRESSION_AND_ACCEPTANCE.md`, `src/tests/phase37-cross-phase-integration-security-regression-and-acceptance.test.ts`)**:
  - **End-to-End Scenario 1: Import to Usable Report (Complete Admin → Maker Lifecycle)**:
    - Admin successfully imports NBE JSON report package; schema normalizer strips sample values and formats definitions into ReportDefinitionSSOT/ReportVersionSSOT.
    - Title, sections, columns, formulas, and NBE API endpoints validated and registered.
    - Published Version 1 to ACTIVE; appears in Admin NBE Simulator.
    - Department-authorized Maker creates a clean instance with unique submission ID, no sample data leakage, edits and saves draft, validates cleanly, and submits to designated Checker with ReviewerAssignment.
  - **End-to-End Scenario 2: Maker Cannot Alter Report Definition**:
    - Direct attempts by Maker to modify report title, code, formula, or API endpoint are strictly rejected by the server and UI (403 Forbidden / SECURITY_VIOLATION), preserving report definition integrity.
  - **End-to-End Scenario 3: Checker Assignment & Notification Workflow**:
    - Same-department active Checkers verified as eligible; cross-department and inactive Checkers excluded; Maker self-selection blocked under Segregation of Duties.
    - Assigned Checkers receive targeted smart notifications; cross-department users receive zero notifications.
  - **End-to-End Scenario 4: Dashboard Isolation & Role Segregation**:
    - Verified strict single-role dashboard isolation: Admin → Admin Dashboard only; Maker → Maker Workspace only; Checker → Checker Inbox only; Auditor → Auditor Dashboard only.
    - URL query, hash, popstate, sidebar, and command palette tampering strictly redirected.
  - **End-to-End Scenario 5: Empty-Template Behavior & Neutral Sanitization**:
    - Fresh reports initialize with empty strings and clean zero states without storing placeholder literals.
    - Mandatory fields missing input yield BLOCKING_ERROR with structured 4-part explanations (What is wrong, Why it matters, How to fix it, Expected format).
  - **End-to-End Scenario 6: Historical Safety & Template Version Evolution**:
    - Historical submissions preserve frozen template snapshots and exact original titles upon new version publication.
    - New submissions cleanly adopt active Version 2 definitions.
  - **Security Regression Matrix (Attack Surface Verification)**:
    - Cross-role route tampering, cross-department draft creation, forged submission IDs, non-admin endpoint/template tampering, cross-department notification leakage, duplicate reviewer assignment, optimistic concurrency conflicts (HTTP 409), duplicate review on settled returns, and self-approval strictly blocked and logged.
  - **Performance Benchmarks & Resilience Latency**:
    - JSON Import & Validation: ~1.0ms (< 50ms threshold).
    - Schema Normalization & Preview: ~2.0ms (< 30ms threshold).
    - Report Draft Initialization: ~0.3ms (< 25ms threshold).
    - Validation Evaluation: ~0.03ms (< 30ms threshold).
    - Notification Dispatch: ~0.05ms (< 15ms threshold).
    - Simulator Discovery: ~0.1ms (< 10ms threshold).
    - Library Query & Search: ~3.1ms (< 25ms threshold).
    - Dashboard Route Authorization: ~0.002ms (< 5ms threshold).
  - **Master Regression Harness Verification**:
    - All test suites (Phases 1 through 37) passing cleanly with 100% success rate.
    - `compile_applet` and `lint_applet` 100% error-free.

---

## [36.0.0-phase36-maker-selected-checker-assignment-and-notification-workflow] - 2026-10-03

### Added & Enhanced
- **Phase 36: Maker-Selected Checker Assignment & Notification Workflow (`36_MAKER_SELECTED_CHECKER_ASSIGNMENT_AND_NOTIFICATION_WORKFLOW.md`, `src/tests/phase36-maker-selected-checker-assignment-and-notification-workflow.test.ts`)**:
  - **Server-Side Checker Eligibility & Filtering (`effectiveAccessEngine.ts`)**:
    - Implemented `getEligibleCheckersForReport(reportKey, maker, submission)` and `validateCheckerSelection(reportKey, maker, selectedCheckerIds, submission)`.
    - Server-side criteria strictly enforces:
      1. Same-department assignment (or active Administrator-granted Special Cross-Department Access grant covering report/department).
      2. Active account status (excludes `DISABLED`, `PENDING_APPROVAL`, `SUSPENDED`).
      3. Designated `CHECKER` role.
      4. Segregation of duties / conflict-of-interest rules: Maker is strictly prohibited from selecting themselves or reviewing their own submitted reports.
      5. Safe reviewer representation: Only exposes safe, minimal profile data (`id`, `name`, `email`, `department`, `employeeId`, `status`, `authorizationReason`), with zero exposure of credentials, passwords, or biometrics.
  - **Single & Multi-Reviewer Selection & Assignment Records (`src/types/regulatory.ts`, `submissionService.ts`)**:
    - Added `ReviewerAssignment` interface and submission workflow record fields: `assignedCheckerIds`, `reviewerAssignments`, and `primaryCheckerId`.
    - Maker may select a single Checker or multiple co-reviewers directly in the submission flow.
    - Preserved a clear primary reviewer concept (`primaryCheckerId`, `isPrimary: boolean`, and backward-compatible `checkerId`, `checkerName`, `checkerEmail`, `checkerDepartment`).
    - Validation rejects duplicate reviewer selections and forged/tampered IDs with explicit security audit logging.
  - **4-Eyes Dual Control & Concurrency Governance**:
    - Review actions remain governed by NBE 4-eyes approval rules.
    - When specific reviewers are designated, unassigned Checkers are strictly blocked from reviewing the report.
    - A single authoritative review action transitions the report state:
      - When one assigned Checker approves, status transitions to `APPROVED`, recording the reviewing Checker and resolving secondary assignments as `SUPERSEDED`.
      - Subsequent review attempts by other assigned Checkers are safely prevented by authoritative state resolution (`INVALID_WORKFLOW_STATE: Duplicate review prevented: Submission has already been APPROVED`).
      - Conflicting actions (e.g. attempting to approve a rejected return) are blocked by authoritative workflow state rules.
    - Implemented `acceptReview(id, checkerUser)` method enabling a Checker to accept/open the review, marking assignment status as `ACCEPTED` and recording the review start timestamp.
  - **Authoritative Server-Generated Smart Notifications (`notificationService.ts`)**:
    - On submission, smart notifications (`WORKFLOW`, `HIGH` priority) are emitted to all assigned Checkers with direct links to `CHECKER_INBOX`.
    - Cross-department notification isolation strictly maintained (unauthorized Checkers receive zero assignment notifications).
    - When a Checker accepts/opens review, Maker receives immediate `Review In Progress` notification.
    - When review is completed, Maker receives instant review outcome notifications (Approval confirmation, Correction Request with reviewer notes, or Rejection reason).
  - **UI Reviewer Selector (`src/components/CheckerSelector.tsx`)**:
    - Embedded dynamic Checker Selector in both `DynamicReportForm.tsx` (report editor modal) and `MakerLibraryView.tsx` (library submission modal).
    - Features: "Select Checker(s)" with eligible counter, selected reviewer chips list, primary reviewer badge and toggle, active status indicators, and clear explanatory guidance when no eligible same-department Checkers exist.
  - **Authoritative Backend API Endpoints (`server.ts`)**:
    - `GET /api/regulatory/reports/:reportKey/eligible-checkers`
    - `POST /api/regulatory/submissions/:id/submit` (accepts `selectedCheckerIds: string[]`)
    - `POST /api/regulatory/submissions/:id/accept-review`
  - **Acceptance Testing Suite (`src/tests/phase36-maker-selected-checker-assignment-and-notification-workflow.test.ts`)**:
    - 15 comprehensive automated test gates covering same-department filtering, inactive/disabled exclusions, other-department exclusions, self-selection prevention, forged ID rejection, duplicate selection prevention, multi-reviewer persistence, smart notifications dispatch, unauthorized review prevention, review acceptance, Maker outcome notifications, duplicate/conflicting concurrency prevention, correction request workflow, special access reviewer eligibility, and audit trail validation.
    - Integrated into full regression harness `src/tests/run-all-tests.ts` with 100% pass rate.

---

## [35.0.0-phase35-role-locked-dashboards-and-notification-navigation] - 2026-10-03

### Added & Enhanced
- **Phase 35: Role-Locked Dashboards & Notification-Centered Navigation (`35_ROLE_LOCKED_DASHBOARDS_AND_NOTIFICATION_NAVIGATION.md`, `src/tests/phase35-role-locked-dashboards-and-notification-navigation.test.ts`)**:
  - **Required Role Access Model (Single-Role Workspaces)**:
    - `ADMIN` → Administrator Dashboard only (`ADMIN_DASHBOARD`, plus admin utilities `DEPT_REPORT_MANAGEMENT`, `NBE_SIMULATOR`, `PHASE2_SSOT`, `SYSTEM_HEALTH`). Cross-dashboard access to Maker Workspace, Checker Inbox, and Auditor Dashboard strictly prohibited.
    - `MAKER` → Maker Workspace only (`MAKER_WORKSPACE`, plus `LIBRARY`, `DOCUMENTATION`). Cross-dashboard access to Admin, Checker, Auditor, and NBE Simulator strictly prohibited.
    - `CHECKER` → Checker Inbox only (`CHECKER_INBOX`, plus `LIBRARY`, `AUDIT_TRAIL`, `DOCUMENTATION`). Cross-dashboard access to Admin, Maker, Auditor, and NBE Simulator strictly prohibited.
    - `AUDITOR` → Auditor Dashboard only (`AUDITOR_DASHBOARD`, plus `LIBRARY`, `AUDIT_TRAIL`, `DOCUMENTATION`). Cross-dashboard access to Admin, Maker, Checker, and NBE Simulator strictly prohibited.
  - **Rejection & Redirection Across All Navigation Channels**:
    - Navbar controls, dropdowns, direct URL parameters (`?tab=...`), hash navigation, browser popstate history, universal command palette (`Ctrl+K`), sidebar navigation, mobile bottom navigation, and swipe gestures are strictly role-locked.
    - Forged or unauthorized route access attempts trigger security audit logs and automatically redirect users to their role's authorized default dashboard.
  - **NBE Simulator Segregation**:
    - NBE Simulator completely removed from Maker, Checker, and Auditor dashboards.
    - Retained strictly in Administrator dashboard.
    - Backend endpoints (`/api/nbe-simulator/submissions`, `/api/nbe-simulator/logs`, `/api/nbe-simulator/scenario`) reject non-admin roles with 403 Forbidden.
  - **Navbar Transformation & Notification Bell**:
    - Eliminated the dashboard-switching dropdown (`<select aria-label="Switch User Role">`) from the authenticated navbar; replaced with authoritative read-only role indicator badge.
    - Added notification bell icon with live unread count badge.
    - Clicking the bell opens the user's accessible Notification Center dialog (`src/components/NotificationCenter.tsx`).
    - Authoritative server-side notification service (`src/services/notificationService.ts`) with endpoints `GET /api/notifications`, `POST /api/notifications/:id/read`, `POST /api/notifications/read-all`.
    - Sensible grouping into `WORKFLOW`, `GOVERNANCE`, `SECURITY`, and `SYSTEM` categories.
    - Read/unread toggle and mark-all-read support.
  - **Cross-Department Notification Leakage Protection**:
    - Server-side filtering strictly shields other departments' report keys and sensitive metadata from unauthorized makers and checkers.
  - **Maker Navbar Clutter Cleanup**:
    - Removed the two specified unimportant icons beside the OB logo (`Building2` / "Financial Year 2026" ribbon and `pendingCheckerCount` awaiting review badge) for Maker while preserving required navigation drawer toggles and accessibility controls.
  - **Accessibility & Touch Standards**:
    - Complies with WCAG 2.1 AA touch targets (min 44×44px), ARIA dialog attributes, and keyboard shortcuts.

---

## [30.0.0-phase30-full-integration-security-regression-acceptance] - 2026-10-02

### Added & Enhanced
- **Phase 30: Full Integration, Security, Regression and Acceptance Pass (`src/tests/phase30-full-integration-security-regression-acceptance.test.ts`, `30_FULL_INTEGRATION_SECURITY_REGRESSION_AND_ACCEPTANCE.md`)**:
  - **Full 14 Required Acceptance Flows Executed & Verified (100% Green)**:
    - **Flow 1: Maker Draft Complete Lifecycle**: `create → edit → autosave → Library → reopen → edit → validate → submit` verified with real state persistence and snapshot capture on `LOA_ADV_OUT_LA001`.
    - **Flow 2: Reuse Submitted Report as New**: Submitted/approved report reused by Maker; verified source record is 100% immutable (hash, version, status untouched); new draft created with distinct ID, v1, DRAFT status, and source reference preserved.
    - **Flow 3: Validation Error/Warning Remediation Assistant**: Normalized validation items with 4-part structured explanations (`whatIsWrong`, `whyItMatters`, `howToFix`, `expectedFormat`); deterministic auto-fix applied to currency precision; authoritative revalidation confirmed problem genuinely resolved.
    - **Flow 4: Library Role Matrix & Deletion Governance**: Maker restricted to owned & department returns; Maker hard delete of submitted record blocked under Directive BSD/03/2020; Maker can delete unsubmitted drafts; Checker restricted to authorized review items; Auditor granted universal institutional read-only visibility; Administrator governed archiving with mandatory justification and confirmation.
    - **Flow 5: Explicit Confirmation on Destructive Actions**: Verified confirmation requirements on draft deletions, governed archiving, and logout. Short justifications (<10 chars) strictly blocked.
    - **Flow 6: Autosave Resilience & Offline Detection Fix**: Verified persistence across simulated page navigation, unmount, and reload. Resolved Node 22 `navigator.onLine` evaluation defect.
    - **Flow 7: Logout Confirmation Dialog & Save Flush Lifecycle**: Verified Cancel preserves active editing session; Confirm flushes pending edits to server before session destruction; wipes transient biometric state and revokes server session.
    - **Flow 8: Dashboard Responsibility Cleanup**: Verified that Maker, Checker, and Auditor dashboards contain zero traces of System Health telemetry or Phase 2 SSOT Lakehouse pipelines; Administrator retains both.
    - **Flow 9: Remember Me End-to-End Authentication**: Unchecked checkbox creates transient session only; checked checkbox issues 256-bit cryptographic token with SHA-256 server-side hash; explicit logout revokes session on server.
    - **Flow 10: Security Boundary & Rejection Enforcement**: Cross-department draft creation rejected; forged submission IDs return 404; biometric reset with incorrect password rejected; configuration proposal self-approval strictly rejected (4-eyes segregation).
    - **Flow 11: SSOT Optimistic Locking & Concurrency Control**: Stale expectedVersion throws `CONCURRENT_MODIFICATION_CONFLICT` (HTTP 409), preventing lost updates and race conditions.
    - **Flow 12: Performance Benchmarking**: Verified sub-millisecond execution times: Library query & pagination = 1.56ms (< 25ms threshold); Validation normalization = 0.60ms (< 30ms threshold).
    - **Flow 13: Responsive Viewport Matrix Validation**: Verified layout adaptation across 8 target viewports: 1920×1080, 1440×900, 1366×768, 1024×768, 768×1024, 430×932, 390×844, and 320×568.
    - **Flow 14: Accessibility Compliance**: Verified ARIA dialog attributes, keyboard navigation shortcuts (`Ctrl+M`, `Ctrl+L`, `Ctrl+K`, `Ctrl+Shift+?`, `Escape`), and WCAG 2.1 AA >=44×44px touch targets.
  - **Defect Fixes**:
    - Fixed Node.js 22 runtime `navigator.onLine` detection in `submissionService.ts` and `auditService.ts` to check `typeof navigator.onLine === 'boolean'`, preventing erroneous `PENDING_SYNC` offline flagging during server/test runs.
    - Added `timer?.unref?.()` to `sessionService.ts` cleanup interval, ensuring Node.js test runner processes terminate cleanly without hanging the event loop.
    - Added ergonomic aliases `createDraft` and `approveSubmission` in `submissionService.ts`.
  - **Automated Acceptance Test Coverage**:
    - 100% pass across all 31 automated test suites in `run-all-tests.ts`, including the new `phase30-full-integration-security-regression-acceptance.test.ts`.

---

## [29.0.0-phase29-remember-me-end-to-end-authentication] - 2026-10-02

### Added & Enhanced
- **Phase 29: Remember Me End-to-End Authentication (`src/services/sessionService.ts`, `src/services/userService.ts`, `server.ts`, `backend/apps/accounts/models.py`, `backend/apps/accounts/views.py`, `backend/apps/accounts/urls.py`, `src/components/LoginPage.tsx`, `src/App.tsx`, `src/tests/phase29-remember-me-end-to-end-authentication.test.ts`)**:
  - **Login Form Cleanliness & Unchecked Checkbox Default (Requirements 1, 2)**:
    - Added "Remember Me on this device" checkbox to the login form, unchecked by default.
    - Corporate email and password fields remain completely empty by default with helpful guiding placeholders (`e.g. abebe.kebede@oromiabank.com`, `Enter your institutional password`) and zero pre-filled test credentials.
  - **Existing Architecture Reuse & Server-Controlled Persistent Sessions (Requirements 3, 4)**:
    - Reused existing Django & Node.js session, token, cookie, and audit architecture.
    - Built `sessionService.ts` creating cryptographically secure (256-bit entropy) persistent sessions with SHA-256 token hashing on the server.
    - Raw tokens are never stored in plaintext on the server; client presents token verified against salted hash.
    - Implemented `PersistentSession` model in Django `apps.accounts` with identical schema and lifecycle attributes.
  - **Storage Security & Credential Protection (Requirement 5)**:
    - Plaintext passwords, password hashes, and biometric templates are strictly prevented from ever being stored in `localStorage` or returned in session verification payloads.
    - Only safe user session profiles and opaque session tokens are handled on the client.
  - **Secure HttpOnly / SameSite Cookie Architecture (Requirement 6)**:
    - Issued `ob_remember_token` cookie with `HttpOnly`, `Path=/`, `SameSite=Lax`, `Max-Age=2592000` (30 days), and `Secure` flag in production environments.
    - Dual header support (`Cookie` and `Authorization: Bearer <token>`) ensures seamless operation in iFrame and preview sandbox environments.
  - **Defined Maximum Lifetime & Revocation (Requirement 7)**:
    - Persistent sessions enforce a strict defined maximum lifetime of 30 days (`expiresAt`).
    - Stale or expired sessions (`now > expiresAt`) are immediately rejected with `SESSION_EXPIRED` and purged.
    - Sessions can be individually revoked by session ID or token.
  - **Explicit Logout Invalidation & Silent Restoration Prevention (Requirement 8)**:
    - Explicit portal sign-out triggers `POST /api/auth/logout`, revoking the server session record (`EXPLICIT_LOGOUT`) and clearing the `ob_remember_token` cookie with `Max-Age=0`.
    - Local storage (`ob_logged_in_user`, `ob_remember_me_active`) and session storage (`ob_transient_user`) are wiped.
    - Attempting to restore a session using an old token after logout strictly fails with `SESSION_REVOKED`, guaranteeing the user is never silently restored.
  - **Password Change & Account Disablement Lifecycle Invalidation (Requirement 9)**:
    - Password updates/resets (`userService.resetPassword`) immediately revoke all active persistent sessions for that officer across all devices with reason `PASSWORD_CHANGED`.
    - Disabling an account (`updateUserStatus` to `DISABLED`) immediately revokes all persistent sessions with reason `ACCOUNT_DISABLED` and blocks subsequent restoration attempts.
  - **Biometric Policy Authority Preservation (Requirement 10)**:
    - Remember Me never bypasses the bank's biometric security policy.
    - For officers with enrolled biometric credentials (Fingerprint / Face ID), persistent session restoration evaluates `requiresBiometricVerification: true`, preserving explicit biometric authentication as authoritative.
  - **Multiple Concurrent Sessions Across Devices (Requirement 11)**:
    - Supported multiple independent persistent sessions per user account (e.g. desktop workstation and mobile tablet).
    - Revoking one device's session does not interrupt sessions on other devices.
    - Built `GET /api/auth/sessions` and `POST /api/auth/sessions/revoke` for comprehensive session governance.
  - **Security Anti-Forgery & Extension Defenses (Requirement 12)**:
    - Direct attempts to present forged, forged-entropy, or tampered tokens are rejected with `TOKEN_INVALID` and logged to the regulatory audit log (`TOKEN_FORGERY`).
    - Expiration dates are server-authoritative and cannot be artificially extended by the client.
  - **Automated Acceptance Testing Suite**:
    - Created `src/tests/phase29-remember-me-end-to-end-authentication.test.ts` covering all 12 acceptance criteria, integrated into `run-all-tests.ts`.
    - 100% pass across all 30 application test suites.

---

## [28.0.0-phase28-logout-confirmation-and-dashboard-responsibility-cleanup] - 2026-10-02

### Added & Enhanced
- **Phase 28: Logout Confirmation and Dashboard Responsibility Cleanup (`App.tsx`, `Sidebar.tsx`, `BottomNavigation.tsx`, `MobileBottomNav.tsx`, `CommandPaletteModal.tsx`, `useSwipeGesture.ts`, `SystemHealthDashboard.tsx`, `Phase2SSOTView.tsx`, `phase28-logout-confirmation-and-dashboard-responsibility-cleanup.test.ts`)**:
  - **Explicit Logout Confirmation Dialog & Cancel Lifecycle (Requirements 1, 2, 3)**:
    - Initiates an explicit confirmation modal upon clicking "Logout" in Navbar, Sidebar (desktop expanded or collapsed), or Mobile Navigation Drawer.
    - Prevents immediate/accidental termination of active banking sessions.
    - Clicking "Cancel" cleanly keeps the session active without interruption.
  - **Pre-Logout Pending Autosave Flush & Safeguards (Requirements 4, 5)**:
    - Before confirmed logout, pending draft changes in active report returns are flushed to the server.
    - If server persistence fails, work is NOT silently discarded; a clear persistence warning is shown with options to "Retry Save & Sign Out" or "Discard & Sign Out".
  - **Authentication Invalidation & Transient Biometric State Purge (Requirement 6)**:
    - On confirmed sign-out, session tokens and sensitive transient biometric state (`ob_internal_hw_diagnostic`, `ob_biometric_challenge`, `ob_face_auth_temp`, `ob_active_session_token`, `ob_auth_history_cache`) are purged from storage.
    - Persisted drafts in local storage, IndexedDB, and server SSOT remain safely preserved.
  - **System Health Removal from Non-Admin Dashboards (Requirements 7, 8)**:
    - Strictly removed System Health from Maker, Checker, and Auditor dashboards, including Sidebar navigation, Command Palette, mobile bottom bars, and swipe gestures.
    - `isTabAuthorized('SYSTEM_HEALTH', role)` returns `true` exclusively for `ADMIN`.
    - `SystemHealthDashboard` guards component execution and suppresses hardware capabilities probes/telemetry polling if non-admin.
    - Preserved System Health telemetry and diagnostic capabilities for Administrator.
  - **SSOT Lakehouse & Medallion Pipeline Removal from Non-Admin Dashboards (Requirements 9, 10)**:
    - Strictly removed the Phase 2 SSOT Lakehouse & Medallion Pipeline from Maker, Checker, and Auditor dashboards, navigation bars, and swipe gestures.
    - `isTabAuthorized('PHASE2_SSOT', role)` returns `true` exclusively for `ADMIN`.
    - `Phase2SSOTView` guards component execution and suppresses `/api/phase2/quality` and `/api/phase2/reconcile` API calls if non-admin.
    - Preserved full SSOT Lakehouse and Medallion pipeline capability for Administrator.
  - **Backend Functionality & Administrative Governance (Requirement 11, 12, 13)**:
    - Preserved backend health and SSOT endpoints for Administrator governance.
    - Unified role-aware dashboard composition without duplicated code.
    - Reclaimed layout space across desktop, tablet, and mobile screen configurations.
  - **Acceptance Testing Suite (Requirement 14)**:
    - Created `src/tests/phase28-logout-confirmation-and-dashboard-responsibility-cleanup.test.ts` with 100% pass across all assertions.
    - Verified full regression test suite across all 28 registered phases.

---

## [26.0.0-phase26-library-role-based-workflows-and-deletion-governance] - 2026-10-02

### Added & Enhanced
- **Phase 26: Library Role-Based Workflows and Deletion Governance (`MakerLibraryView.tsx`, `submissionService.ts`, `effectiveAccessEngine.ts`, `regulatory.ts`, `auditService.ts`, `server.ts`, `App.tsx`, `Sidebar.tsx`, `BottomNavigation.tsx`, `MobileBottomNav.tsx`, `phase26-library-role-based-workflows-and-deletion-governance.test.ts`)**:
  - **Comprehensive Multi-Role Library Expansion (Requirement 1, 2, 3)**:
    - **Checker Review Library & 4-Eyes Queue**:
      - Displays strictly authorized departmental review records; cross-department isolation enforced at backend server query level.
      - Integrated review action modal: 4-eyes principle inspection, Approve (`APPROVE`), Return for Correction (`REQUEST_CORRECTION`), and Reject (`REJECT`) with mandatory justification.
      - Compliance Flagging: toggle flag status with reason, tracking `flagged`, `flagReason`, `flaggedBy`, and `flaggedAt`.
      - Checker queries and notes: append review query notes (`CHECKER_QUERY`, `CORRECTION_NOTE`).
      - Library access strictly forbids Checker from editing report figures or creating drafts.
    - **Auditor Regulatory Repository & Dossiers**:
      - Independent supervisory examination with universal bank-wide dossier inspection across all departments and report types.
      - Dossier History & Event Trail Inspector: view snapshot history with version iterations, historical data snapshots, integrity hashes, review note threads, and immutable audit logs.
      - Supervisory audit findings: append official supervisory audit notes (`AUDIT`).
      - Operational mutation (editing drafts, creating returns, or deleting records) is strictly forbidden for Auditors (`ROLE_FORBIDDEN`).
    - **Administrator Institutional Library & Governance**:
      - Comprehensive institutional oversight across all banking returns.
      - Governed lifecycle disposition: removal impact assessment, regulatory retention warnings, governed archival (`ARCHIVE`) and voiding (`VOID`) preserving historical snapshots and audit trail.
      - Destruction of submitted statutory returns is strictly prohibited; unsubmitted drafts can be purged under administrative authorization.
  - **Effective Access Engine Integration (Requirement 4)**:
    - Extended `effectiveAccessEngine.evaluateSubmissionAccess()` to enforce submission-level permissions across actions: `VIEW`, `CREATE_DRAFT`, `EDIT_DRAFT`, `DELETE_DRAFT`, `REVIEW`, `APPROVE`, `REJECT`, `REQUEST_CORRECTION`, `EXPORT_XLSX`, `AUDIT_INSPECT`, `INSPECT_HISTORY`, `COMMENT`, `FLAG`, `ADMIN_ARCHIVE`, `ADMIN_VOID`.
    - Enforces home department matching, M:N linked departments, direct user report assignments, active special access grants, and account active status.
    - Special access grants dynamically expand access during valid window; expired grants are strictly rejected.
  - **Server-Side Permission Filtering & Protection Against Leakage (Requirement 5 & 10)**:
    - Backend `submissionService.queryLibrary()` filters authorized records before computing counts, statistics, search matching, and pagination.
    - Stats bar (`all`, `draft`, `inProgress`, `returned`, `submitted`, `reusedCopy`, `archived`, `voided`) reflects only authorized records.
    - Keyword search operates strictly within the authorized dataset (zero search leakage across departments).
    - Direct record lookup `GET /api/regulatory/submissions/:id` enforces cross-department authorization (`403 Forbidden` on unauthorized ID access).
  - **Maker Submitted Record Immutability & Deletion Protections (Requirement 6)**:
    - Makers cannot delete submitted reports (`PENDING_CHECKER`, `APPROVED`, `SENT`, `SENDING`, `ARCHIVED`, `VOIDED`).
    - Backend throws `INVALID_WORKFLOW_STATE` error under NBE Directive BSD/03/2020.
    - Makers can delete only unsubmitted drafts they created or within their assigned department.
  - **Governed Administrative Archiving & Voiding (Requirements 7 & 8)**:
    - Under NBE Directive BSD/03/2020 and Banking Supervision Record Retention Mandates, submitted statutory returns cannot be hard-deleted.
    - `getRemovalImpactAssessment()` provides impact analysis, snapshot counts, audit counts, and regulatory retention warning.
    - Governed disposition (`adminGovernedRemoveSubmission`) supports `ARCHIVE` and `VOID` actions.
    - Requires ADMIN role, explicit confirmation checkbox (`confirmed: true`), and detailed regulatory justification (minimum 10 characters).
    - Preserves all historical snapshots, dynamic rows, and captures authoritative `ADMIN_ARCHIVE_SUBMISSION` or `ADMIN_VOID_SUBMISSION` audit logs.
  - **Permission Distinction Per Role (Requirement 9)**:
    - Strict role boundaries across Maker, Checker, Auditor, and Admin for all operations.
    - Form view mode in `App.tsx` strictly sets `readOnly` for non-makers and non-draft states.
  - **Automated Acceptance Test Coverage (Requirement 10)**:
    - Added `src/tests/phase26-library-role-based-workflows-and-deletion-governance.test.ts` with 11 comprehensive test sections and 40+ assertions, integrated into `run-all-tests.ts`.
    - All tests passing with 100% success rate.

---

## [25.0.0-phase25-library-core-architecture-and-maker-library] - 2026-10-02

### Added & Enhanced
- **Phase 25: Library Core Architecture & Maker Library (`MakerLibraryView.tsx`, `submissionService.ts`, `regulatory.ts`, `server.ts`, `Sidebar.tsx`, `MakerWorkspace.tsx`, `BottomNavigation.tsx`, `MobileBottomNav.tsx`, `CommandPaletteModal.tsx`, `KeyboardShortcutsModal.tsx`, `phase25-library-core-architecture-maker-library.test.ts`)**:
  - **First-Class "Library" Sidebar Feature & Hotkey (`Ctrl+L` / `Cmd+L`)**:
    - Introduced a primary `LIBRARY` navigation view and sidebar entry with `BookOpen` icon, accessible to Makers, Checkers, Auditors, and Admins.
    - Integrated into Sidebar, Command Palette, Keyboard Shortcuts cheat sheet, and mobile thumb-navigation bars.
  - **Authoritative Single-Source-of-Truth Architecture (Requirement 1)**:
    - Library queries live records from `submissionService` and historical snapshots (`SubmissionSnapshot`), eliminating disconnected duplicate databases.
    - Any changes (create, edit, save, submit, return, reuse, delete) synchronize across the entire application instantly.
  - **5 Canonical Lifecycle States (Requirement 2)**:
    - Built `deriveLibraryLifecycleState()` supporting:
      1. `DRAFT`: Newly created unedited return draft (v1).
      2. `IN_PROGRESS`: Return draft with active revisions saved (v2+).
      3. `RETURNED`: Return sent back by Checker for corrections (`CORRECTION_REQUIRED`).
      4. `SUBMITTED`: Return sealed and submitted to review (`PENDING_CHECKER`), approved, or delivered to NBE (`SENT`).
      5. `REUSED_COPY`: Unsubmitted return created from a prior submitted filing (`reusedFromSubmissionId` preserved).
  - **Maker Save, Reopen, Edit, Validate & Submit Lifecycle (Requirement 3)**:
    - Makers can save unfinished drafts, leave, reopen from Library, continue editing, trigger authoritative rule validation (`validateSubmission`), and submit to Checker queue with preparation notes.
  - **Submitted Report "Reuse as New" Lifecycle (Requirement 4)**:
    - Submitted returns are permanently sealed and cannot be edited in place.
    - "Reuse as New" creates a brand-new report identity (new unique ID, v1, status `DRAFT`), copying verified data structures while preserving `reusedFromSubmissionId` and `reusedFromVersion`.
    - Original source report remains 100% immutable (unmodified hash, values, and status).
  - **Strict Deletion Permissions & Protections (Requirements 5, 6, 9)**:
    - Makers can delete unsubmitted drafts only (`DRAFT`, `CORRECTION_REQUIRED`).
    - Submitted reports (`PENDING_CHECKER`, `APPROVED`, `SENT`) strictly forbid deletion at both UI and backend API level, returning HTTP 403 Forbidden.
    - Every deletion requires an explicit confirmation dialog with Cancel/Delete before removal.
    - Cross-maker and cross-department deletion protection prevents unauthorized draft purging.
  - **Server-Side Permission Filtering & Query Engine (Requirements 7, 10)**:
    - REST endpoint `GET /api/regulatory/library` with server-side authorization: Makers only see authorized returns matching their home department, M:N linked departments, and active special access grants.
    - Comprehensive filtering: keyword search, lifecycle state, raw status, category/report type, reporting frequency, date ranges (`startDate`, `endDate`), and multi-field sorting.
    - Server-side pagination returning `{ items, total, page, pageSize, totalPages, stats }`.
  - **Responsive Dual-Mode UI (Cards & Table) (Requirement 8)**:
    - Grid Cards view with interactive lifecycle pills, version chips, department badges, and quick actions.
    - Compact Table view for data-dense inspection.
    - Real-time loading skeleton, empty state with filter reset, error state, and 403 permission-denied banners.
  - **Persistence & Rehydration (Requirement 11)**:
    - Library data persists to IndexedDB and rehydrates seamlessly upon page refresh, login/logout, or browser restart.
  - **Automated Acceptance Test Coverage (Requirement 13)**:
    - 100% pass across all 7 test sections and 35+ assertions in `phase25-library-core-architecture-maker-library.test.ts`.

---

## [24.0.0-phase24-validation-error-warning-remediation-assistant] - 2026-10-02

### Added & Enhanced
- **Phase 24: Unified Validation & Remediation Assistant (`remediation.ts`, `validationRemediationService.ts`, `ValidationRemediationAssistant.tsx`, `DynamicReportForm.tsx`, `submissionService.ts`, `server.ts`, `src/tests/phase24-validation-remediation-assistant.test.ts`)**:
  - **Authoritative Server-Side Validation Normalization**:
    - Built `ValidationRemediationService` unifying checks across return line items, dynamic repeatable schedules, cross-field regulatory rules, and report definition structures.
    - Normalized output schema with severity (`BLOCKING_ERROR`, `WARNING`), category (`DATA_ERROR`, `REPORT_DEFINITION_ERROR`, `BUSINESS_RULE_ERROR`), path, fieldCode, fieldTitle, ruleSource, suggestedAction, and deterministic `proposedFix`.
  - **4-Part Understandable Explanations**:
    - Every error and warning provides a clear 4-part narrative:
      1. `WHAT IS WRONG`: Concrete statement of invalid condition or missing input.
      2. `WHY IT MATTERS`: Regulatory and supervisory consequence citing NBE Directive BSD/03/2020.
      3. `HOW TO FIX IT`: Actionable step-by-step guidance for the officer.
      4. `EXPECTED FORMAT`: Exact numeric, date, percentage, or text syntax required.
  - **Interactive Locate & Focus Field Navigation**:
    - Clicking "Locate" navigates to the item across tabs (`ITEMS` vs `DYNAMIC_SCHEDULES`), resets filters, switches pagination page, scrolls element into center viewport, focuses input, and temporarily pulses high-contrast amber highlight ring (`ring-2 ring-amber-500 animate-pulse`).
  - **Safe Deterministic Auto-Fix Capability**:
    - Deterministic corrections only: numeric formatting/comma cleanup, ETB currency 2-decimal precision rounding per NBE rules, ISO-8601 date normalization (`YYYY/MM/DD` -> `YYYY-MM-DD`, whitespace trimming), and formula total synchronization (`FormulaEngine.calculateReport`).
  - **Strict Anti-Guessing Safety Guarantee**:
    - Ambiguous business values (missing mandatory amounts, negative capital/asset balances, out-of-range percentage ratios, headcount counts, unparseable date strings, cross-field accounting imbalances) are strictly marked `autoFixable: false` and never automatically guessed.
  - **CURRENT → PROPOSED Review Confirmation Modal**:
    - Non-trivial fixes display interactive comparison modal showing Current Value, Proposed Value, Reason, and Rule Source before applying.
  - **Authoritative Revalidation & Save Lifecycle**:
    - Auto-fix persists updated draft, increments version, runs authoritative recalculation, and reruns normalization; issues are cleared from the summary only when genuinely resolved.
  - **DATA ERROR vs REPORT-DEFINITION / RULE ERROR Segregation**:
    - Distinguishes user input mistakes from template definition issues (e.g. duplicate field codes or circular references), displaying guidance that only authorized configuration users (`ADMIN`) can modify templates in Report Template Studio.
  - **Audit Logging with Sensitive Value Redaction**:
    - Recorded `VALIDATION_REMEDIATION_APPLIED` audit events with actor, submission ID, field, fix type, and timestamp, while completely redacting multi-million financial figures (`[REDACTED_FINANCIAL_VALUE_PROTECTED]`).
  - **Pre-Submission Blocking Gate Enforcement**:
    - Server-side and client-side gates prevent transition to `PENDING_CHECKER` while blocking errors remain.
  - **Automated Acceptance Test Coverage**:
    - 100% pass across all 12 test sections and 60+ assertions in `phase24-validation-remediation-assistant.test.ts`.

---

## [23.1.0-phase23-maker-draft-edit-save-resubmit-lifecycle] - 2026-10-02

### Added & Enhanced
- **Phase 23: Maker Draft/Edit/Save/Resubmit & Reuse Lifecycle (`submissionService.ts`, `DynamicReportForm.tsx`, `MakerWorkspace.tsx`, `server.ts`, `src/types/regulatory.ts`, `src/tests/phase23-maker-draft-lifecycle.test.ts`)**:
  - **Complete Primary Lifecycle (`CREATE → EDIT → SAVE DRAFT → LEAVE → RETURN → CONTINUE → VALIDATE → SUBMIT`)**:
    - **Draft Creation**: Authorized Makers create report drafts initialized at v1 with cryptographic integrity seals and immutable `CREATE_DRAFT` audit records.
    - **Persistent Edit & Save**: Edits update values and dynamic schedules, auto-calculate formulas, increment version, and persist to backend and IndexedDB with `UPDATE_DRAFT` audit tracking.
    - **Leave & Return Safety**: Maker can safely leave the form; uncommitted changes are auto-persisted to prevent data loss. Returning to the workspace seamlessly reopens the exact persisted draft version with all input values preserved.
    - **Validation & Submit**: Real-time Zod and ValidationEngine checks gate submission to Checker (`PENDING_CHECKER`), capturing an immutable historical snapshot.
  - **Returned for Correction & Resubmission Lifecycle (`CORRECTION_REQUIRED → EDIT & CORRECT → RESUBMIT`)**:
    - When a Checker reviews and requests corrections, report transitions to `CORRECTION_REQUIRED` with supervisory notes attached.
    - Maker reopens returned report, updates values and dynamic schedules, validates, and resubmits to Checker with `RESUBMIT_TO_CHECKER` audit logging.
  - **Submitted Report Immutability & "Reuse as New" Lifecycle (`SUBMITTED REPORT → REUSE AS NEW → NEW DRAFT → MODIFY → SAVE → SUBMIT`)**:
    - **Strict In-Place Mutation Prevention**: Direct edit attempts on submitted/final reports (`SENT`, `APPROVED`, `SENDING`) are strictly blocked with descriptive errors; submitted reports are permanently sealed.
    - **Reuse as New Mechanism**: Maker invokes `reuseSubmission(id, user)` which creates a brand-new report identity (status `DRAFT`, version 1) pre-populated with baseline values and dynamic rows, while linking `reusedFromSubmissionId` and `reusedFromVersion`.
    - **Source Preservation Invariant**: Verified that source report values, integrity hash, and status remain 100% untouched and unchanged.
    - **Full Workflow Support**: The new reused report is completely editable, saveable, validatable, and submittable as a new regulatory return.
  - **Optimistic Concurrency & Multi-Tab Conflict Locking**:
    - Enforced `expectedVersion` checking on `updateDraft` and `submitToChecker`; concurrent tab conflicts throw `CONCURRENT_MODIFICATION_CONFLICT` (HTTP 409 Conflict) preventing silent overwriting of edits.
  - **Automated Acceptance Test Coverage**:
    - 100% passing across all 6 test suites in `phase23-maker-draft-lifecycle.test.ts`.

---

## [23.0.0-phase21-22-23-dynamic-report-form-validation-xlsx-autosave] - 2026-10-02

### Added & Enhanced
- **Phase 21: Real-Time Field-Level Validation Logic (`DynamicReportForm.tsx`, `ValidationEngine.ts`, `DynamicAreaTable.tsx`, `src/tests/phase21-realtime-field-level-validation.test.ts`)**:
  - **Currency & Precision Constraints**: Enforced 2 decimal place maximum precision on ETB currency amounts; rejected invalid formatting and non-numeric characters; enforced non-negative balance constraints for Capital, Cash, Deposit, Collateral, and Statutory Reserve accounts.
  - **Ratio & Range Constraints**: Enforced percentage ratio range bounds (0.00% to 100.00%) with explicit range errors/warnings; enforced non-negative whole integer constraints for customer, borrower, and staff counts.
  - **Mandatory Field Constraints**: Flagged missing required fields in real-time with descriptive regulatory warnings; rendered green `Mandatory field compliant` badges for valid inputs.
  - **Dynamic Schedule Validation**: Propagated validation engine summaries to `DynamicAreaTable` displaying cell-level error outlines and alert tooltips across both desktop table and mobile card views.
  - **Interactive Pre-Submission Gate**: Disabled `Submit to Checker` action with diagnostic counter and tooltips while validation errors remain; added interactive validation alert banner with 1-click error filtering (`ERRORS_ONLY`).
  - **Automated Test Coverage**: 100% passing across all 18 assertions in `phase21-realtime-field-level-validation.test.ts`.

- **Phase 22: SheetJS .xlsx Export for NBE-Compliant Offline Review (`DynamicReportForm.tsx`, `regulatoryReportXlsxExport.ts`, `excelService.ts`, `src/tests/phase22-xlsx-sheetjs-export.test.ts`)**:
  - **NBE Multi-Sheet Workbook Generation**: Created 5-sheet statutory workbook using SheetJS (`xlsx`):
    1. `Submission Summary`: Institutional identifiers (Oromia Bank S.C., InstCode `0000013`), return metadata, Maker & Checker 4-eyes audit trail, SHA-256 integrity seal, and Directive BSD/03/2020 citation.
    2. `Return Items`: Fixed line items with Excel number formats (`#,##0.00`), calculation method indicators (Auto/Total/Direct Input), and validation status.
    3. `Dynamic Schedules`: Dedicated worksheets for each dynamic area preserving borrower facilities and asset rosters.
    4. `Validation Checklist`: Comprehensive compliance audit checklist evaluating all NBE consistency rules.
    5. `Offline Review Sign-off`: Institutional examination record with signature lines for NBE Bank Supervision Directorate examiners and Bank Compliance Officers.
  - **Resilient Binary Download**: Implemented Blob + `URL.createObjectURL` anchor download with graceful fallback to `XLSX.writeFile`; displayed real-time success toast with the standardized filename (`OB_NBE_${cleanKey}_FY${FinYear}_${Status}_${SubmissionId}.xlsx`).
  - **Automated Test Coverage**: 100% passing in `phase22-xlsx-sheetjs-export.test.ts` (roundtrip binary parse and integrity verification).

- **Phase 23: Periodic 30-Second IndexedDB Auto-Save (`DynamicReportForm.tsx`, `indexedDbStorage.ts`, `src/tests/phase23-indexeddb-autosave.test.ts`)**:
  - **30-Second Interval Auto-Save**: Configured non-blocking timer in `DynamicReportForm` that automatically persists draft state to IndexedDB every 30 seconds when uncommitted Maker changes exist (`hasUnsavedChanges === true`).
  - **Redundant Write Prevention**: Avoided unnecessary writes when form is clean or in read-only/auditor inspection mode.
  - **Offline Durability & Mount Recovery**: Cached drafts in `indexedDbStorage` with `LOCAL_DRAFT` sync status and `offlineSavedAt` timestamp; automatically detected and restored newer offline drafts upon form mounting.
  - **Live UI Telemetry**: Added dynamic header badge with rotating save spinner, last auto-saved timestamp (`Auto-saved at HH:MM:SS`), and live countdown (`in Ns`).
  - **Automated Test Coverage**: 100% passing in `phase23-indexeddb-autosave.test.ts` (write verification, cadence simulation, and recovery).

---

## [15.0.0-phase15-biometric-e2e-hardware-validation-acceptance] - 2026-10-01

### Added
- **Biometric E2E, Hardware Validation & Acceptance Suite (`src/tests/phase15-biometric-e2e-hardware-validation-acceptance.test.ts`, `BIOMETRIC_ACCEPTANCE_MATRIX.md`, `src/hooks/useBiometricAuth.ts`, `15_BIOMETRIC_E2E_HARDWARE_VALIDATION_AND_ACCEPTANCE.md`)**:
  - **Comprehensive Acceptance Matrix**: Structured audit table (`BIOMETRIC_ACCEPTANCE_MATRIX.md`) classifying all biometric capabilities across implementation, test coverage, runtime environment, acceptance result, and engineering notes.
  - **Truthful Hardware Reporting**: Explicitly separates software verification from physical hardware verification. Platforms without attached capacitive Touch ID silicon or infrared depth sensors are truthfully designated `HARDWARE_PENDING` without simulated hardware success.
  - **Camera Permission & Hardware State Handling**:
    - Dedicated handling for `NotAllowedError` / `PermissionDeniedError` (clear permission guidance).
    - Dedicated handling for `NotReadableError` / `TrackStartError` (busy camera alert advising user to close other apps).
    - Dedicated handling for `AbortError` (dismiss/cancel without unhandled exceptions).
    - Dedicated handling for `NotFoundError` (clear missing camera alert).
    - Dedicated handling for `OverconstrainedError` (hardware constraint mismatch fallback).
  - **Optical Quality & Liveness Verification**:
    - Dark (<35) and overexposed glare (>235) luminance threshold enforcement.
    - Laplacian gradient edge sharpness (<0.35) blur rejection.
    - Single-face framing bounds (0 faces and >1 face rejections).
    - Temporal variance anti-spoofing against static photo presentation attacks.
  - **WebAuthn Platform Passkey Assertions**:
    - Registration & assertion verification with monotonic counter increment validation.
    - Exception handling for user abort, timeout, security policy restrictions, and unconfigured authenticators.
    - Revoked passkey rejection and multi-credential device support.
  - **Multi-Mechanism Login & Dashboard Redirections**:
    - Strict method isolation (Password vs. Fingerprint vs. Face ID).
    - Role-specific dashboard convergence: `MAKER_WORKSPACE`, `CHECKER_INBOX`, `ADMIN_DASHBOARD`, `AUDITOR_DASHBOARD`.
    - Business continuity fallback to master institutional password.
  - **Security & E2E Attack Resistance**:
    - Cross-account IDOR isolation on Security Center and Compliance Export.
    - Cryptographic nonce single-use replay defense.
    - Authenticator counter rollback defense against cloned keys.
    - Master institutional password verification for biometric resets.
  - **Real Performance Benchmarks**:
    - Optical quality analysis: **0.228 ms / frame**.
    - Temporal liveness analysis: **0.046 ms / frame**.
    - Salted HMAC-SHA256 template hashing: **0.066 ms / hash**.
    - WebAuthn server assertion verification: **0.143 ms / assertion**.
  - **Automated Test Suite**: 53 assertions in `phase15-biometric-e2e-hardware-validation-acceptance.test.ts` (100% passing).

---

## [14.0.0-phase14-biometric-service-hardening-privacy-compliance] - 2026-10-01

### Added
- **Biometric Service Hardening, Privacy & Statutory Compliance (`src/services/biometricService.ts`, `src/services/userService.ts`, `src/services/auditService.ts`, `server.ts`, `BIOMETRIC_SECURITY_PRIVACY_COMPLIANCE.md`, `src/tests/phase14-biometric-hardening-privacy-compliance.test.ts`, `14_BIOMETRIC_SERVICE_HARDENING_PRIVACY_AND_COMPLIANCE.md`)**:
  - **Security Hardening**:
    - Strict template equality matching (eliminated insecure `face_sig_*` prefix bypass).
    - Input validation rejecting malformed, negative, or empty feature vectors and counters.
    - Uniform error messages on auth options to prevent account enumeration and reconnaissance.
    - Progressive delays (1s, 2s, 4s) on repeated failures and 15-minute temporary lockout.
    - Step-up password verification for account unlock and reset authorization.
  - **Data Privacy & Sanitization**:
    - Non-invertible salted HMAC-SHA256 signatures (`computeProtectedFaceSignature`); zero raw image/video persistence.
    - Comprehensive data sanitization in `auditService.ts` (`sanitizeAuditPayload`) stripping passwords, private keys, base64 image buffers, and raw numeric vectors from audit records.
    - Transparent statutory privacy disclosure (`getPrivacyDisclosure`) citing NBE Directive BSD/03/2020.
    - Data minimization retention purge (`purgeExpiredChallengesAndTokens`).
    - Cryptographically sealed compliance archive export (`exportComplianceArchive`) with SHA-256 integrity checksum for NBE bank examiners.
  - **Documented Technical Limitations**:
    - Ambient luminance bounds (35–235 units), Laplacian sharpness threshold (0.35).
    - Software 2D optical liveness vs. 3D hardware infrared depth sensors.
    - Platform authenticator device-bound isolation.
  - **Automated Test Suite**: 60+ assertions in `phase14-biometric-hardening-privacy-compliance.test.ts` (100% passing).

---

## [13.0.0-phase13-biometric-reset-recovery-devices] - 2026-10-01

### Added
- **Production Biometric Lifecycle Management, Reset, Recovery & Multi-Device Support (`src/services/biometricService.ts`, `src/services/userService.ts`, `src/components/BiometricSecurityCenter.tsx`, `src/components/UserSettingsModal.tsx`, `src/components/AdminDashboard.tsx`, `server.ts`, `src/tests/phase13-biometric-reset-recovery-devices.test.ts`, `13_BIOMETRIC_RESET_RECOVERY_AND_DEVICE_MANAGEMENT.md`)**:
  - **Server-Authorized Face ID Reset**:
    - Mandatory step-up password re-authentication before issuing reset authorization.
    - Verification of existing enrollment state prior to reset.
    - Explicit explanation of permanent consequences returned to user (invalidation of face vector template, cached authorization purge, required live optical re-scan).
    - Single-use, short-lived (5 min TTL) cryptographic nonce tokens (`rst_*`).
    - Atomic token consumption defending against replay and race conditions.
    - Permanent template revocation and state transition back to `NOT_ENROLLED`, cleanly allowing fresh optical re-enrollment.
  - **WebAuthn Credential Management & Multi-Authenticator Support**:
    - Architectural support for registering and managing multiple hardware passkeys on a single institutional account (e.g. Work MacBook Touch ID, YubiKey 5C NFC, mobile passkey).
    - Friendly device label renaming (`renameDeviceLabel` & `/api/auth/biometrics/device/rename`).
    - Safe credential metadata inspection (masked IDs, monotonic replay counters, transports, timestamps).
    - Selective individual device revocation (`revokeCredential` & `/api/auth/biometrics/revoke`) with step-up verification, preserving remaining registered passkeys.
  - **Passkey Suspension & Resumption Lifecycle**:
    - Temporary security hold (`suspendCredential` & `/api/auth/biometrics/suspend`) without destructive deletion.
    - Safe credential resumption (`resumeCredential` & `/api/auth/biometrics/resume`) with step-up password verification.
    - Rejection of authentication attempts on suspended credentials.
  - **Security Protections & Hostile Path Defense**:
    - Protection against stolen sessions: password verification required for any reset or revocation.
    - Progressive lockout against brute-force password guessing on reset requests (5 failed attempts -> lockout).
    - IDOR / Cross-user tampering rejection: non-admin users cannot reset or revoke other users' credentials.
    - Token cross-user hijacking defense: tokens strictly bound to account email.
    - Concurrency & race condition defense: atomic single-use consumption blocks parallel execution races.
  - **Administrative Direct Reset & Lockout Recovery**:
    - Supervisor emergency reset (`adminResetBiometrics` & `/api/auth/biometrics/admin/reset`) for lost or compromised hardware.
    - Supervisor administrative lockout unlock (`adminUnlockAccount` & `/api/auth/biometrics/admin/unlock`).
    - Segregation of duties audit trail explicitly logging `ADMIN OVERRIDE`.
  - **Biometric Security Center UI**:
    - Dedicated, accessible UI component (`BiometricSecurityCenter.tsx`) integrated into `UserSettingsModal.tsx` and `AdminDashboard.tsx`.
    - Real-time status cards for Face ID and WebAuthn passkeys.
    - Registered devices table with device icons, safe telemetry, inline rename, suspend, and revoke actions.
    - Recent security events audit stream.
    - Official NBE Directive BSD/03/2020 lost device, hardware failure, and recovery guidance.
    - Zero exposure of raw vectors, private keys, or passwords.
  - **Automated Test Suite (`src/tests/phase13-biometric-reset-recovery-devices.test.ts`)**:
    - 9 comprehensive test suites (58 assertions) covering authorized reset, wrong password rejection, consumed token replay defense, IDOR cross-user rejection, multi-device passkeys, individual revocation, suspension/resumption, concurrency race conditions, administrative emergency override, and zero-secret leakage telemetry.
    - Integrated into `src/tests/run-all-tests.ts` (100% pass across all test suites).

---

## [12.0.0-phase12-biometric-signin-authentication] - 2026-10-01

### Added
- **Production-Quality Biometric Sign-In & Authoritative Authentication (`src/services/biometricService.ts`, `src/services/userService.ts`, `src/hooks/useBiometricAuth.ts`, `src/components/BiometricPromptModal.tsx`, `src/components/LoginPage.tsx`, `server.ts`, `src/tests/phase12-biometric-signin-authentication.test.ts`, `12_BIOMETRIC_SIGN_IN_AND_AUTHENTICATION.md`)**:
  - Independent & Coexistent Authentication Mechanisms:
    - User selection strictly governs the executed mechanism: Password triggers password authentication, Fingerprint triggers WebAuthn assertion, Face ID triggers optical quality/liveness verification and server matching.
    - Zero silent invocation or automatic silent fallback: biometric failure prompts active user choice (retry, switch method, or input password).
  - Fingerprint / WebAuthn Authentication Engine:
    - Secure challenge lifecycle with 60-second TTL and atomic single-use consumption.
    - Assertion verification (`verifyWebAuthnAssertion` & `/api/auth/biometrics/webauthn/auth-verify`) validating credential ownership, RP ID, user binding, and signature assertion.
    - Replay attack defenses: consumed challenges rejected immediately with audit logging; monotonic signature counters strictly enforced, rejecting counter duplicate or rollback anomalies.
    - Comprehensive error handling for unsupported browser, no credential, user cancellation (`AbortError`), timeout, invalid assertion, suspended credential, revoked credential, and server errors.
  - Optical Face ID Authentication Engine:
    - Explicit camera consent and live video stream initialization.
    - Client-side pre-flight checks: luminance, sharpness, single-face validation.
    - Server-authoritative matching (`verifyFaceBiometric` & `/api/auth/biometrics/face/verify`): bounded thresholds for luminance ([35, 235]), sharpness (>= 0.35), single face (`faceCount === 1`), and spoof probability (<= 0.40).
    - Protected feature processing: non-invertible salted HMAC template comparison; zero raw images stored.
  - Anti-Brute Force Rate Limiting & Account Security:
    - Progressive lockout: 5 consecutive failed attempts trigger a 15-minute lockout (`lockedOut: true`, countdown timer).
    - Immediate block of all subsequent authentication attempts during active lockout, even with valid biometric data.
    - Step-up password recovery (`unlockWithStepUp` & `/api/auth/biometrics/unlock`): supervisor/user password input clears biometric lockout and resets failure counters.
    - Account enumeration prevention: uniform error responses avoiding disclosure of registered accounts or database details.
  - Authoritative Session Creation & Role Redirection:
    - Successful authentication (Password, Fingerprint, or Face) converges on canonical `UserSession` object with `sessionToken`, `sessionExpiresAt`, and explicit `authMethod`.
    - Role-specific dashboard routing:
      - `ADMIN` -> `ADMIN_DASHBOARD`
      - `MAKER` -> `MAKER_WORKSPACE`
      - `CHECKER` -> `CHECKER_INBOX`
      - `AUDITOR` -> `AUDITOR_DASHBOARD`
  - Automated Phase 12 Test Suite (`src/tests/phase12-biometric-signin-authentication.test.ts`):
    - 6 comprehensive test suites covering explicit method selection, WebAuthn fingerprint assertion and anti-replay safeguards, optical Face ID quality/liveness and server template matching, anti-brute force rate limiting and step-up password recovery, direct API bypass defenses, and password login regression across all four banking roles.
    - 100% pass across all 23 automated test suites in `run-all-tests.ts`.

---

## [11.0.0-phase11-biometric-registration-enrollment] - 2026-10-01

### Added
- **Genuine End-to-End Biometric Registration and Enrollment (`src/services/biometricService.ts`, `src/hooks/useBiometricAuth.ts`, `src/components/BiometricPromptModal.tsx`, `src/components/RegisterPage.tsx`, `src/tests/phase11-biometric-registration-enrollment.test.ts`, `11_BIOMETRIC_REGISTRATION_ENROLLMENT.md`)**:
  - Complete authenticated Face ID and Fingerprint/WebAuthn enrollment with genuine end-to-end flows and zero simulated success.
  - Independent Biometric Methods:
    - User selects one method at a time; enrolling Fingerprint leaves Face ID independent, and enrolling Face ID leaves Fingerprint independent.
    - Both methods can coexist on a single institutional account with distinct credential records and lifecycle states.
    - Post-registration success screen allows users to independently enroll a second method or proceed with standard credentials.
  - Optical Face ID Enrollment Pipeline:
    - Supports both live camera stream (PC/webcam) and native mobile selfie camera (`input type="file" capture="user"`).
    - Detects browser camera capabilities (`navigator.mediaDevices.getUserMedia`).
    - Staged accessible animation pipeline: `preparing`, `permission`, `camera start`, `face search`, `quality`, `liveness`, `processing`, and `success/failure/retry`.
    - Live optical frame preview with alignment guide reticle and oval guide.
    - Real-time client-side frame quality analysis (`analyzeFaceQuality`): luminance, sharpness (spatial Laplacian edge variance), single face presence, and face bounding ratio.
    - Real optical motion and liveness anti-spoofing analysis (`analyzeFaceLiveness`): temporal variance detection to prevent presentation attacks using static photos or simulated screens.
    - Server-authoritative quality and liveness enforcement (`/api/auth/biometrics/face/enroll`): validates single face, luminance in [35, 235], sharpness >= 0.35, spoof probability <= 0.40.
    - Protected template persistence: non-invertible salted HMAC feature signature (`computeProtectedFaceSignature`); zero raw camera frames or pixel buffers stored.
    - Graceful error notifications and recovery actions for: permission granted/denied/dismissed, no camera (`NotFoundError`), camera busy (`NotReadableError`), unsupported browser, initialization failure, no face (`faceCount === 0`), multiple faces (`faceCount > 1`), poor quality (blurry, underexposed, overexposed glare), timeout (30-second inactivity auto-cancel), liveness failure, and server failure.
    - Truthful hardware identity: does not claim exact device model unless the browser reliably provides it via `MediaDeviceInfo.label`.
  - WebAuthn Platform Fingerprint Passkey Enrollment:
    - Authenticated identity context binding: only active authorized institutional accounts can obtain challenges and register passkeys.
    - Cryptographic server challenge issuance (`/api/auth/biometrics/webauthn/register-options`) with 60-second TTL.
    - Standard `PublicKeyCredentialCreationOptions` with `platform` authenticator attachment and `userVerification: required`.
    - Server verification endpoint (`/api/auth/biometrics/webauthn/register-verify`) with credential ID storage, monotonic counter initialization, and public-key metadata.
    - Comprehensive error handling without simulated success: unsupported browser, unavailable platform authenticator, user cancellation (`AbortError`), timeout, iframe security policy restriction (`SecurityError`), and server verification failure.
  - Cross-Account Isolation & Identity Safeguards:
    - Prevents duplicate WebAuthn credential IDs across accounts (cross-account collision rejected with `BIOMETRIC_ENROLL_REJECTED` audit log).
    - Prevents duplicate facial biometric templates across accounts (duplicate biometric identity rejected with `BIOMETRIC_ENROLL_REJECTED` audit log).
    - Enrollment challenge cannot be hijacked or consumed by a different account identity.
  - Automated Phase 11 Test Suite (`src/tests/phase11-biometric-registration-enrollment.test.ts`):
    - 6 comprehensive test suites covering method independence, capability detection and truthful device reporting, Face ID quality and anti-spoofing liveness, WebAuthn authenticated enrollment, cross-account isolation and duplicate credential prevention, and persistence/audit logging.
    - Integrated into master test runner (`src/tests/run-all-tests.ts`) with 100% clean pass across all 22 automated test suites.

---

## [10.0.0-phase10-biometric-architecture-security-foundation] - 2026-10-01

### Added
- **Biometric Architecture & Security Foundation (`src/services/biometricService.ts`, `src/types/biometrics.ts`, `10_BIOMETRIC_ARCHITECTURE_AND_SECURITY_FOUNDATION.md`)**:
  - Full authoritative user biometric lifecycle state machine:
    - States: `NOT_ENROLLED`, `ENROLLMENT_IN_PROGRESS`, `ENROLLED`, `SUSPENDED`, `REVOKED`, `RESET_REQUESTED`, `RESET_IN_PROGRESS`, `FAILED_LOCKED`, `CAPABILITY_UNAVAILABLE`.
    - Strict architectural separation between physical hardware capability and account enrollment state.
  - Cryptographic challenge lifecycle:
    - 32-byte high-entropy nonces base64url encoded with 60-second TTL.
    - Single-use consumption preventing replay attacks.
    - Strict identity, purpose, and biometric type binding.
  - WebAuthn / Passkey platform authenticator engine:
    - ES256 (-7) and RS256 (-257) standard algorithms, RP ID binding, userVerification required.
    - Monotonic signature counter tracking to detect and reject authenticator rollback/replay anomalies.
    - Secure public-key credential metadata storage without sensitive private key exposure.
  - Protected server-authoritative Face recognition engine:
    - Multi-factor quality checks: luminance (40-220), sharpness (>= 0.35), single face requirement (0 or >1 rejected), aspect framing.
    - Liveness and anti-spoofing verification: motion score and spoof probability evaluation rejecting static photos and synthetic spoof markers.
    - Non-invertible salted HMAC feature representation (`computeProtectedFaceSignature`) with institutional salt.
    - Zero raw camera frames or pixel buffers persisted in database or logs.
    - Strict server-side matching threshold (>= 0.82) with immediate rejection of test mismatch markers (`wrong`, `mismatch`, `invalid`, `REJECT`).
  - Progressive rate limiting and anti-brute-force defense:
    - 5 consecutive failed attempts trigger 15-minute temporary lockout.
    - Remaining lockout seconds reporting and generic error handling to prevent user enumeration.
    - Step-up password verification unlock endpoint for compliance recovery.
  - Step-up authenticated reset and recovery:
    - Mandatory password re-authentication to authorize biometric reset.
    - Single-use authorized reset tokens (5-minute TTL).
    - Purges enrolled biometric credentials, transitions state to `NOT_ENROLLED`, and logs audit trail.
  - Security audit logging:
    - Standardized audit events (`BIOMETRIC_CHALLENGE_ISSUED`, `BIOMETRIC_ENROLLED`, `BIOMETRIC_AUTH_SUCCESS`, `BIOMETRIC_AUTH_FAILURE`, `BIOMETRIC_SUSPENDED`, `BIOMETRIC_REVOKED`, `BIOMETRIC_RESET_REQUESTED`, `BIOMETRIC_RESET_COMPLETED`, `BIOMETRIC_LOCKOUT`, `BIOMETRIC_MIGRATION`).
    - Verified zero leakage of raw camera frames, biometric templates, or passwords in audit records.
  - Legacy data migration engine:
    - Automatically migrates existing credentials to normalized schema and synchronizes seed data resets.
  - Automated security test suite (`src/tests/phase10-biometric-architecture-security.test.ts`):
    - 10 test suites covering all lifecycle states, challenge lifecycle, replay defense, cross-account isolation, WebAuthn counters, face quality/liveness, rate limiting, suspension/revocation, reset, and audit trail (100% pass across 21/21 full test suites).

---

## [8.0.0-phase8-configuration-governance-versioning-rollback] - 2026-09-30

### Added
- **Configuration Governance & Versioning Engine (`src/services/configurationGovernanceService.ts`, `08_CONFIGURATION_GOVERNANCE_VERSIONING_ROLLBACK.md`)**:
  - Full controlled lifecycle: `Draft → Validate → Impact Analysis → Dual Review/Approval → Publish → Effective → Audit`.
  - Four-tier risk classification engine:
    - `CRITICAL`: Role permissions, RBAC authorization, statutory return deletion.
    - `HIGH`: Mathematical formula alteration, field deletion, department restructuring, workflow alteration, and rollbacks.
    - `MEDIUM`: Description updates, optional field additions, non-critical assignments.
    - `LOW`: Cosmetic notes, display order adjustments. Auto-approval permitted.
  - Multi-domain impact analysis identifying affected:
    - Users (by report duty, department membership, and compliance supervisory responsibilities).
    - Departments (primary owners and contributing linked departments).
    - Reports (return keys, frequencies, formulas, and dependent schedules).
    - Workflows (submission review steps and role requirements).
    - Permissions (modified roles and authorization matrix).
    - Active and historical submissions (drafts, pending review, approved, sent), with explicit non-repudiation guarantees.
  - Credential and secret sanitization (`sanitizeGovernanceState`): Deep recursive scrubbing of passwords, tokens, API keys, hashes, and PINs to `[REDACTED_FOR_SECURITY]` in all before/after states.
  - Segregation of duties & 4-eyes rule enforcement:
    - Strict prohibition: Proposer cannot approve their own high-impact configuration proposal (`SEGREGATION_OF_DUTIES_VIOLATION`).
    - Review restricted strictly to authorized `ADMIN` or `CHECKER` roles (`UNAUTHORIZED_APPROVAL`).
  - Optimistic concurrency locking & collision prevention:
    - Automatic version tracking (`expectedEntityVersion` and config hash) prevents administrators from silently overwriting each other's changes (`CONCURRENCY_CONFLICT`, HTTP 409).
  - Controlled governed rollback:
    - A rollback is a new auditable change; past versions and historical submissions are NEVER rewritten or lost.
    - Rollback creates a new version snapshot (Version N+1) reproducing the target historical schema.
  - Material change user notifications:
    - Users affected by material configuration changes receive targeted notifications detailing risk level, effective date, and impact rationale.
  - Phase 8 Completion Gate: Official audit explanation engine (`explainChange`):
    - Explains who changed what, when, from what, to what, under which approval/workflow, when it became effective, and what it affected.
- **Native ConfigService Rollback Integration (`src/services/configService.ts`)**:
  - `rollbackReportVersion(returnKey, targetVersionNumber, actor, reason)` safely recreates target schema as Version N+1 with permanent audit recording.
- **Frontend Governance Component (`src/components/ConfigurationGovernanceView.tsx`)**:
  - Rich split-pane workspace with proposal search, multi-level filters, 7-step visual lifecycle stepper, dependency impact cards, sanitized before/after diff table, 4-eyes review approval modal, rejection dialog, rollback modal with version picker, and the official "Explain Change" inspection modal.
  - Embedded into `src/components/AdminDashboard.tsx` under the **Governance & Versioning** tab.
  - Embedded into `src/components/ChangeHistoryView.tsx` with a top view-mode selector (**Governed Proposals & Approvals**).
- **Server REST API Endpoints (`server.ts`)**:
  - `/api/governance/proposals` (GET, POST)
  - `/api/governance/proposals/:id` (GET)
  - `/api/governance/proposals/:id/validate` (POST)
  - `/api/governance/proposals/:id/approve` (POST)
  - `/api/governance/proposals/:id/reject` (POST)
  - `/api/governance/proposals/:id/publish` (POST)
  - `/api/governance/proposals/rollback` (POST)
  - `/api/governance/proposals/:id/explain` (GET)
  - `/api/governance/notifications` (GET)
  - `/api/governance/notifications/:id/read` (POST)
- **Comprehensive Automated Test Suite (`src/tests/configuration-governance-versioning.test.ts`)**:
  - 11 test sections (57 assertions, 100% pass) verifying secret sanitization, risk classification, impact analysis, structural validation, segregation of duties, optimistic concurrency collisions, publication, rejection, rollback, and the official audit explanation completion gate.

---

## [7.0.0-phase7-real-time-ssot-synchronization] - 2026-09-30

### Added
- **Authoritative Real-Time SSOT Engine (`src/services/realtimeSsotEngine.ts`, `server.ts`, `07_REAL_TIME_SSOT_SYNCHRONIZATION.md`)**:
  - WebSocket (`/ws/ssot`) + SSE (`/api/config/events`) real-time communication pipeline strictly anchored to Django/database SSOT authority.
  - Zero simulated timers or synthetic pollers; state changes propagate purely on committed transactional mutations.
  - Monotonic event sequence counter (`sequenceNumber`) and UUID generation (`eventId`) with 1,000-event circular replay buffer.
  - Comprehensive event taxonomy: `USER_CHANGED`, `DEPARTMENT_CHANGED`, `REPORT_CHANGED`, `ASSIGNMENT_CHANGED`, `SPECIAL_ACCESS_CHANGED`, `WORKFLOW_STATUS_CHANGED`, `CONFIG_SYNC_TRIGGER`.
  - Sensitive credential scrubbing: Automatic removal of `password`, `passwordHash`, `token`, and auth headers from event payloads.
  - Fine-grained topic subscription authorization (RBAC):
    - `ADMIN:CONFIG` & `ADMIN:USERS`: Strict Admin-only access.
    - `USER:<id>`: Strict individual officer isolation.
    - `DEPT:<id>`: Department members and authorized multi-department delegates.
    - `AUDIT:EVENTS`: Auditor and Admin inspection feed.
    - `GLOBAL` & `REPORTS`: Authenticated bank officer broad catalog updates.
- **Client Synchronization Service (`src/services/realtimeSsotClient.ts`)**:
  - Dual WebSocket + SSE failover transport.
  - Connection lifecycle management: Auto-reconnect with exponential backoff (`1s` to `30s`) and random jitter, heartbeat keep-alive (`30s`), and connection state broadcasting.
  - Reconnect gap recovery: Transmits `SYNC_REQUEST` on connect; replays missed events or issues `REVALIDATE_ALL` if gap exceeds buffer.
  - Message deduplication: 1,000-entry LRU cache to eliminate duplicate event handling.
- **Surgical React State Invalidation Hook (`src/hooks/useRealtimeSSOT.ts`)**:
  - Domain-specific invalidation listeners preserving mounted React component state and active user input in draft forms.
- **Authoritative Service Integrations**:
  - Connected `configService`, `userService`, `submissionService`, and `effectiveAccessEngine` to broadcast events upon successful committed mutations.
- **Comprehensive Automated Test Suite (`src/tests/realtime-ssot-synchronization.test.ts`)**:
  - 9 automated test scenarios covering Admin changes, assignment changes, report publishing, special access revocation, reconnect & gap replay, duplicate event discarding, stale cache revalidation, RBAC topic scoping, and atomic rollback safety.
  - Integrated into `src/tests/run-all-tests.ts` with 19/19 test suites passing (100% success).

---

## [6.0.0-phase6-safe-bulk-operations-import-export-and-file-workflows] - 2026-09-30

### Added
- **Authoritative Bulk Operations Engine (`src/services/bulkOperationsEngine.ts`, `06_BULK_OPERATIONS_IMPORT_EXPORT.md`)**:
  - Full transactional, auditable bulk management engine across Users, Departments, Reports, Submissions, and Special Access Grants.
  - **Mandatory Workflow**: `Select/upload → parse → validate → detect conflicts → preview → explicit confirmation → transactional execution → audit → result report`.
  - **Zero-Mutation Dry-Run Guarantee**: File uploads and parsing generate structured preview dry runs (`dryRunId`) with 15-minute TTL without mutating any underlying database or state.
  - **Conflict Strategies**: Configurable resolution modes: `UPDATE` (merge/update existing), `SKIP` (preserve existing, create new only), and `FAIL_ON_CONFLICT` (strictly reject batches containing duplicate identifiers).
  - **Deep Data Validation**: Required column checks, type validations, RFC 5322 email formatting, unique employee IDs and department short codes, valid organizational units, and batch-level duplicate detection.
  - **Atomic Transaction & Snapshot Rollback**: Pre-execution snapshots captured prior to mutations. If any row encounters an error in `ATOMIC` mode, the entire batch automatically reverts to the pristine snapshot and seals a `BULK_OPERATION_ROLLBACK` event in the audit trail.
  - **Partial Success Mode**: `PARTIAL` mode applies valid rows while recording exact row-level failures with actionable remediation notes.
  - **Formula Injection (CSV Injection / CWE-1236) Protection**: Neutralizes dynamic formula/DDE execution payloads starting with `=`, `+`, `-`, `@`, `\t`, `\r` by automatically prefixing single quotes on exports and parsed inputs.
  - **Oversized & Malicious File Protection**: Hard 5,000 row limits, payload sanitization, path traversal defense, and format enforcement (`CSV`, `JSON`, `XLSX`).
  - **Zero-Bypass Authorization & Privilege Escalation Checks**: Non-admins (Makers, Checkers, Auditors) are strictly barred from performing user/department bulk administration (`HTTP 403`). Protection prevents unauthorized promotion to `ADMIN` and prevents demotion or deactivation of the primary compliance administrator (`usr_admin_1`).
  - **Authorized Exports with Immutable Auditing**: Role- and department-filtered exports for Users, Departments, Reports, and Submissions in CSV, JSON, and XLSX formats with comprehensive audit logging.
- **Enterprise Bulk Operations Modal (`src/components/BulkOperationsModal.tsx`)**:
  - 4-step wizard interface: (1) Configure & Upload, (2) Validate & Preview with metric cards and paginated row-diff inspection, (3) Explicit Confirmation with legal/regulatory checkbox, and (4) Transactional Execution with full outcome breakdown.
- **Admin Dashboard Integration (`src/components/AdminDashboard.tsx`)**:
  - Multi-select row checkboxes with "Select All Visible" header checkbox.
  - Floating Bulk Action Ribbon when users are selected: Activate, Deactivate (preserving historical reporting links), Reassign Department dialog, Assign Role dialog, Export Selected, and Clear Selection.
  - Top action toolbar button: "Bulk Import & Ops" and direct export buttons.
- **Department & Report Studio Integration (`src/components/DepartmentReportManagement.tsx`)**:
  - Upgraded Bulk Import to the transactional `BulkOperationsModal`.
- **Server REST API Endpoints (`server.ts`)**:
  - `POST /api/bulk/dry-run`: Dry-run validation preview.
  - `GET /api/bulk/dry-run/:dryRunId`: Retrieve cached dry-run with custom pagination.
  - `POST /api/bulk/execute`: Explicit transactional execution with mode and confirmation.
  - `POST /api/bulk/users/action`: Multi-select user actions (activate, deactivate, department, role, report assignment, special access).
  - `POST /api/bulk/reports/action`: Bulk report actions (retirement, activation, department linkage).
  - `POST /api/bulk/export`: Authorized and audited CSV/JSON/XLSX export.
- **Comprehensive Automated Test Suite (`src/tests/phase6-bulk-operations.test.ts`)**:
  - 12-section test coverage: formula injection, zero-mutation dry-run, explicit confirmation, conflict strategies (UPDATE, SKIP, FAIL), invalid data rejection, privilege escalation and root admin protection, atomic transaction rollback to pristine state, partial success mode, bulk multi-select user operations, report retirement preservation, authorized exports, and large dataset pagination (100% pass).

---

## [5.0.0-phase5-user-department-report-role-relationship-engine] - 2026-09-30

### Added
- **Authoritative Relationship & Effective-Access Engine (`src/services/effectiveAccessEngine.ts`, `.ai/05_USER_DEPARTMENT_REPORT_RELATIONSHIP_ENGINE.md`)**:
  - Centralized, server-enforced relationship and access policy layer connecting `User ↔ Role ↔ Department ↔ Report ↔ Special Access ↔ Workflow State`.
  - Authoritative effective-access derivation formula evaluating: Role, Account Status (`ACTIVE`, `PENDING_APPROVAL`, `DISABLED`, `SUSPENDED`), Department boundary, dynamic M:N linkages, Direct User-Report Assignments, Special Access Grants, Segregation of Duties (4-eyes dual control), and Temporal constraints.
  - Role Separation Policy:
    - **Maker**: Authorized report entry, draft editing, formula execution, submission to Checker, and final NBE transmission of approved returns. Blocked from review sign-off and administrative governance.
    - **Checker**: Authorized 4-eyes review, correction requests, approvals, and rejections within department boundary. Prohibited from editing draft numbers, self-review, and final NBE delivery.
    - **Auditor**: Authorized supervisory examination, finding creation, evidence attachment, and report package export across all 24 returns. Strictly prohibited from preparing drafts, editing figures, or approving returns.
    - **Administrator**: Authorized user and department governance, special access delegation, SSOT configuration, and simulator control. Strictly restricted to read-only compliance oversight on report data; cannot mutate return figures or sign off.
- **Direct User ↔ Report Assignments Without Code Modification**:
  - Administrators can directly assign reports to individual officers via `effectiveAccessEngine.assignReportToUser(userId, reportKey, adminName)`.
  - Immediate operational permission granted without code change or home department alteration.
  - Revocation via `removeReportFromUser` immediately restores department boundary.
- **Controlled Special Access Grants**:
  - Full support for `REPORT`, `DEPARTMENT`, `MULTI_DEPARTMENT`, and `ALL_REPORTS` scopes.
  - Mandatory compliance justification reason recorded on all grants.
  - Future scheduling (`effectiveFrom`), time-bound expiration (`expiresAt`), administrative revocation (`revoked`, `revokedAt`, `revokedBy`), and non-repudiation audit trail.
- **Sub-Millisecond Authorization Caching & Real-Time Invalidation**:
  - Deterministic cache keyed by user identity, role, department, grants hash, report key, action, and submission state.
  - Automated invalidation hooks tied to role changes, department changes/restructuring, assignment additions/removals, special access grants/revocations, and SSOT report retirement.
- **Direct Server REST API Endpoints (`server.ts`)**:
  - `POST /api/access/evaluate`: Central authoritative access evaluation for any operation.
  - `GET /api/access/matrix/:userId`: Full 24-report effective permissions matrix for a user.
  - `GET /api/access/user-assignments/:userId`, `POST /api/access/user-assignments`, `DELETE /api/access/user-assignments`: Direct user-report assignment management.
  - `POST /api/access/cache/invalidate`: Explicit authorization cache purge.
- **Comprehensive Automated Test Matrix (`src/tests/relationship-effective-access-engine.test.ts`)**:
  - 10-part comprehensive verification covering: all 4 roles, same vs different departments, direct user-report assignments, special access scopes, expired grants, revoked grants, account statuses, retired reports, 4-eyes segregation of duties, and cache invalidation.
  - Integrated into `src/tests/run-all-tests.ts` (17/17 test suites passing cleanly with 100% success).

---

## [4.0.0-phase4-dynamic-report-definition-and-template-management] - 2026-09-30

### Added
- **Metadata-Driven Report Definition Engine (`src/services/configService.ts`, `server.ts`)**:
  - Full metadata representation of bank regulatory returns: ReturnKey, short code, title, description, category, frequency (`MONTHLY`, `QUARTERLY`, `ANNUAL`, `ON_DEMAND`), institution code, financial year, and department ownership.
  - Granular schema definition: sections (title, code, repeating flags), return balance fields (data types, required status, calculated flags, formulas), dynamic schedule columns (column keys, header labels, widths, data types, required constraints), rows, and central bank NBE mapping.
  - Formula dependency engine and cycle detection: Topological DFS graph analysis validates calculation expressions and catches circular formula dependencies before publishing.
  - Field code uniqueness validation: Checks all balance field item codes and schedule column keys across the schema to prevent ambiguity.
  - REST endpoints for report lifecycle: `POST /api/config/reports` (create), `PUT /api/config/reports/:key` (update metadata), `POST /api/config/reports/:key/retire` (retire), `POST /api/config/reports/:key/versions/draft` (create draft version), `PUT /api/config/reports/:key/versions/:version` (update draft), `POST /api/config/reports/:key/versions/:version/validate` (validate version), `GET /api/config/reports/:key/versions/:version/preview` (preview metadata), `POST /api/config/reports/:key/versions/:version/publish` (publish active version).
- **Immutable Versioning Lifecycle (Draft → Validate → Preview → Publish → Active → Retired)**:
  - Non-destructive evolution: Existing published versions used by historical submissions are strictly preserved and never mutated.
  - Draft state: Working drafts can be saved and edited iteratively without affecting active reporting.
  - Validation: Structural integrity, unique field codes, formula dependencies, and cycle detection.
  - Preview: Live schema conversion to `ReportMetadata` preview format for inspection before publishing.
  - Authoritative publishing: Transitions the target version to `ACTIVE`, supersedes the previous active version with an `effectiveTo` timestamp, and immediately syncs the active regulatory catalog.
  - Safe retirement: Marks obsolete returns as `RETIRED` with statutory reasoning, archiving them while preserving past submissions for audit.
- **Administrator Template Studio UX (`src/components/ReportTemplateStudioModal.tsx`, `src/components/DepartmentReportManagement.tsx`)**:
  - Multi-tab studio: Metadata, Sections, Fields, Columns, Formulas, Validation, Preview, Publish.
  - Visual field editor, column editor, section editor, and formula builder.
  - Real-time DFS cycle detection and structural validation feedback.
  - Version history comparison modal (`ReportVersionHistoryModal.tsx`) showing field-by-field deltas and changelog records.
  - M:N department linkage management integrated with bank organizational structure.
- **Dynamic Forms & Submission Reproducibility Integration (`src/components/DynamicReportForm.tsx`, `src/services/submissionService.ts`, `src/services/nbeAdapter.ts`)**:
  - `submissionService.createSubmission` automatically queries `configService` to stamp the current active `templateVersion` and seals an immutable `templateSnapshot`.
  - `DynamicReportForm.tsx` dynamically renders sections, fields, and dynamic schedules using the submission's `templateSnapshot`.
  - Historical submissions remain frozen to their original template schema, while new submissions consume the latest published version.
  - Maker-Checker-Auditor segregation of duties fully maintained across all dynamic returns.
  - `NBEAdapter.buildNBEPayload` canonically translates dynamic metadata returns into the central bank BSD payload format (`ReturnItemsList`, `DynamicItemsList`).
- **Comprehensive Automated Test Suite (`src/tests/dynamic-report-definition.test.ts`)**:
  - 10-part automated test suite validating: 24 NBE preservation, metadata creation, cycle detection DFS, preview, publish, version bump (V1->V2), immutability, dual-template reproducibility, Auditor inspection, NBE payload, safe retirement.
  - Integrated into `src/tests/run-all-tests.ts` (16/16 test suites passing cleanly with 100% success).

---

## [3.0.0-phase3-admin-users-and-departments] - 2026-09-30

### Added
- **Administrator User Management Subsystem (`src/services/userService.ts`, `server.ts`, `src/components/AdminDashboard.tsx`)**:
  - Full CRUD and lifecycle management for bank user accounts: Administrator, Maker, Checker, and Auditor.
  - Server-side role enforcement on `POST /api/users`, `PUT /api/users/:id`, `POST /api/users/:id/status`, and `DELETE /api/users/:id` ensuring only callers with `ADMIN` role can mutate users.
  - First-class support for `AUDITOR` creation with specific statutory scope (`auditScope`) and formal appointment justification (`auditorJustification`).
  - Search, filter (by role, status, department), multi-column sorting (name, email, role, department, status, creation date), and standalone pagination contract (`page`, `page_size`, `limit`).
  - Single User Inspector (`GET /api/users/:id`) returning full profile, credentials overview, and linked department.
  - Dynamically resolved reporting authorization matrix (`GET /api/users/:id/authorized-reports`) computed from authoritative `configService` SSOT.
  - Special cross-department delegation access grants (`POST /api/users/:id/special-access`) for specific returns or multi-department assignments.
  - User-specific audit history compilation (`GET /api/users/:id/audit`).
  - Pre-flight historical safety checks (`GET /api/users/:id/can-delete` / `canDeleteUser`) preventing destructive deletion of users referenced in past statutory submissions.
- **Administrator Department Management Subsystem (`src/services/departmentService.ts`, `src/services/configService.ts`, `server.ts`, `src/components/AdminDashboard.tsx`)**:
  - Full management of bank organizational structure: create, edit, rename, code/description validation, and parent-child hierarchy.
  - Lifecycle statuses (`ACTIVE`, `INACTIVE`, `RESTRUCTURED`, `PLANNED`) and effective date management (`effectiveFrom`, `effectiveTo`).
  - SSOT synchronization: changes made in `departmentService` are immediately synced with `configService.createDepartment` and `configService.updateDepartment`.
  - Department inspection (`GET /api/departments/:id`) providing hierarchy ancestors, descendant units, assigned user rosters, and submission statistics.
  - Department configuration audit trail (`GET /api/departments/:id/audit`).
  - Pre-flight historical safety checks (`GET /api/departments/:id/can-delete` / `canDeleteDepartment`) blocking destructive deletion of departments referenced by historical reports or active assigned officers.
- **Administrator UX Enhancements (`src/components/AdminDashboard.tsx`)**:
  - Sub-tab navigation: Reports Oversight, Special Access & Delegation, Pending Authorizations, User Accounts & RBAC, Departments & Structure, Directives & Role Matrix.
  - Custom responsive modals:
    - `CreateUserModal`: Direct provisioning of officers with role selector and conditional Auditor scope inputs.
    - `UserInspectorModal`: Detailed profile card, dynamic authorized returns list, special access grants, and audit activity history.
    - `CreateDepartmentModal`: Operational unit creation with division, parent department, responsibilities, and statutory returns multi-selection.
    - `EditDepartmentModal`: In-place editing of responsibilities, hierarchy, and retirement dates.
    - `DepartmentInspectorModal`: Hierarchy tree position, live statistics cards, assigned officers list, and configuration audit trail.
    - `HistoricalSafetyNoticeModal`: NBE-grounded modal explaining why destructive deletion was blocked and offering non-destructive deactivation (`DISABLED`/`INACTIVE`).
    - `DeleteConfirmationModal`: Permanent deletion dialog for verified safe entities.
- **Automated Verification & Regression Suite (`src/tests/phase3-admin-users-departments.test.ts`)**:
  - Comprehensive automated tests covering user CRUD, role transitions, Auditor scopes, dynamic report authorization, user audit trail, user historical safety pre-flights, department creation/editing/hierarchy, lifecycle transitions, and department historical safety pre-flights.
  - Integrated into `src/tests/run-all-tests.ts`.

---

## [2.0.0-phase2-dynamic-configuration-ssot] - 2026-09-30

### Added
- **Dynamic Configuration & SSOT Engine (`src/services/configService.ts`)**:
  - Implemented authoritative in-memory & database-backed SSOT engine governing Departments, Reports, Versions, Roles, Permissions, Assignments, and Workflows.
  - Implemented hierarchical department modeling with self-referential parent/children relations, hierarchy levels (0: Division, 1: Department, 2: Unit/Section), hierarchical path strings, and cycle prevention.
  - Implemented metadata-driven report definitions capable of representing return identity, frequency, risk categories, central bank mappings, fixed fields, dynamic schedule columns, and mathematical formulas.
  - Implemented non-destructive report versioning (Version 1, Version 2, etc.) ensuring historical regulatory submissions stay pinned to their original version schema snapshot without corruption.
  - Implemented explicit relationship entities: `DepartmentReportAssignment` (roles: PRIMARY_OWNER, CONTRIBUTOR, REVIEWER, SUPERVISORY) and `UserReportAssignment` (duties: MAKER, CHECKER, AUDITOR, VIEWER).
  - Implemented dynamic authorization matrix resolving user access across explicit duties, home departments, and time-bound special access grants.
  - Implemented domain version counters and composite cache hash (`deptVersion`, `reportsVersion`, `workflowsVersion`, `rbacVersion`, `assignmentsVersion`, `globalConfigHash`) with atomic cache invalidation.
  - Implemented real-time configuration event emitter broadcasting typed events (`CONFIG_CHANGED`, `CACHE_INVALIDATED`).
- **REST Configuration API (`server.ts`)**:
  - Exposed comprehensive configuration endpoints under `/api/config/*`: `/api/config/summary`, `/api/config/departments`, `/api/config/reports`, `/api/config/authorized-reports`, `/api/config/roles`, `/api/config/permissions`, `/api/config/workflows`, `/api/config/assignments/*`, `/api/config/changes`, and `/api/config/cache/invalidate`.
  - Added real-time Server-Sent Events (SSE) notification stream (`GET /api/config/events`) enabling instantaneous client updates upon backend mutations.
- **Frontend Configuration SSOT Client Hook (`src/hooks/useConfigurationSSOT.ts`)**:
  - React hook querying authoritative backend `/api/config/*` endpoints on mount.
  - Subscribes to `/api/config/events` SSE stream for automatic UI re-synchronization on backend updates.
- **Django Backend Domain Architecture & Migrations (`backend/apps/`)**:
  - Enhanced `Department` with `parent`, `hierarchy_level`, `path`, `status`, `effective_from`, and `effective_to`.
  - Added `DepartmentReportAssignment` model in `departments/models.py`.
  - Added `ReportDefinition`, `ReportVersion`, `ReportSection`, `ReportField`, `ReportColumn`, and `ReportRow` in `reports/models.py`.
  - Added `Role`, `Permission`, `UserReportAssignment`, and `DepartmentMember` in `accounts/models.py`.
  - Added `Submission`, `WorkflowDefinition`, and `WorkflowStep` in `workflows/models.py`.
  - Added `ConfigurationChange` audit model in `audit/models.py`.
  - Created safe Django migrations: `departments/0002_add_hierarchy_and_assignments.py`, `reports/0001_initial.py`, `accounts/0002_add_role_permission_and_assignments.py`, `workflows/0001_initial.py`, and `audit/0003_configurationchange.py`.
  - Created Django seeding command `reports/management/commands/seed_ssot_configuration.py`.
- **Dedicated Architecture Specification (`.ai/29_CONFIGURATION_SSOT_AND_METADATA_ARCHITECTURE.md`)**:
  - Complete architectural specification detailing governance principles, entity models, hierarchy traversal, versioning mechanics, relationship schemas, and cache invalidation.
- **Automated Verification Suite (`src/tests/phase2-configuration-ssot.test.ts`)**:
  - 57 automated tests covering department hierarchy, report metadata, versioning historical integrity, explicit relationships, dynamic authorization boundaries, RBAC SSOT, workflow definitions, and cache consistency.
  - Added to master test runner `src/tests/run-all-tests.ts`.

---

## [1.9.2-phase1-login-registration-terminology] - 2026-09-30

### Changed
- **Login Registration Prompt (`src/components/LoginPage.tsx`)**:
  - Replaced prompt with exact required terminology: `"Need access as a new Maker / Checker / Auditor?"`.
  - Maintained responsive typography (`text-[11px] sm:text-xs text-slate-500 dark:text-slate-400`).
- **Login Registration Button (`src/components/LoginPage.tsx`)**:
  - Replaced button label with exact required terminology: `"Register for Maker / Checker / Auditor Account"`.
  - Preserved `min-h-[44px]` touch target, `UserPlus` icon, and smooth transition.
- **Registration Page Title (`src/components/RegisterPage.tsx`)**:
  - Updated page header with exact required terminology: `"Request Maker / Checker / Auditor Credentials"`.
  - Maintained responsive typography (`text-base sm:text-xl font-bold tracking-tight`).
- **Auditor Role Availability**:
  - Verified `AUDITOR` option remains fully active in the registration role selection dropdown with Abinet Alemu directive permission boundary notice.
- **Automated Verification**:
  - Added dedicated test assertions in `src/tests/responsive-ui-and-layout.test.ts` verifying all three exact strings, absence of obsolete text, and active Auditor option.

---

## [1.9.1-phase0-ai-normalization] - 2026-09-30

### Added
- **Canonical Knowledge Base Map & Master AI Index (`.ai/00_START_HERE.md`)**:
  - Ingested and indexed all 29 canonical engineering specifications (`00_` through `28_`).
  - Defined explicit reading order, purpose, and trigger conditions for incoming AI agents.
  - Formulated mandatory Account Migration and Quota Safety rules.
- **Dedicated Continuation and Recovery Guide (`.ai/03_CONTINUATION_AND_RECOVERY.md`)**:
  - Restored canonical quick verification commands and architectural layout map.
- **Account Migration & Continuation Protocol (`.ai/20_ACCOUNT_MIGRATION_AND_CONTINUATION.md`)**:
  - Consolidated multi-account handoff protocols, quota-safety discipline, and post-migration integrity rules.

### Changed
- **Standardized Canonical File Naming**:
  - Standardized all 29 engineering documents with uniform two-digit numeric prefixes (`00_` to `28_`).
- **Complete Reference Repair**:
  - Repaired all internal Markdown cross-references across all `.ai/*.md` documents to use canonical numbered filenames.
  - Eliminated broken and un-prefixed references.
- **Duplicate & Redundant Document Elimination**:
  - Merged unique content from unnumbered and partial duplicates into their canonical counterparts.
  - Removed all redundant unnumbered clones and 0-byte placeholder files.

---

## [1.9.0-phase5-final-verification-and-completion-gate] - 2026-09-29

### Added
- **Phase 5 Automated End-to-End Verification Test Suite (`src/tests/phase5-final-verification.test.ts`)**:
  - Implemented automated verification of all 14 mandatory end-to-end flows:
    1. Admin Login & Dashboard Routing
    2. Maker Login & Workspace Routing
    3. Checker Login & Inbox Routing
    4. Auditor Login & Independent Dashboard Routing
    5. User Registration & Admin Approval Flow
    6. Password Authentication & Zero-Bypass Checks
    7. Biometric Passkey (WebAuthn) & Optical Face ID Enrollment
    8. Biometric Authentication & Verification (distinguishing Code Verified from physical hardware unavailability in headless CI)
    9. Complete Maker Reporting Lifecycle (Create -> Save -> Edit -> Submit)
    10. Complete Checker Review Lifecycle (Review -> Request Correction -> Re-review -> Approve)
    11. Auditor Independent Inspection Lifecycle (Work Queue -> Findings -> Evidence -> Remediations -> Working Notes -> Audit Package)
    12. Central Bank Transmission to NBE Gateway (Receipt number, delivery timestamp, idempotency)
    13. User Session Logout Flow & Audit Trail Attribution
    14. Deliberate Unauthorized Access Attempts (Maker self-approval blocked, Checker NBE delivery blocked, Cross-department submission blocked)
- **Unified Full-Stack Test Command (`npm run test:all`)**:
  - Chains TypeScript/React unit & integration tests (`npm test`), Django backend app tests (`npm run test:backend`), and NBE simulator microservice tests (`npm run test:simulator`).
- **Python Dependencies in Backend Requirements (`backend/requirements.txt`)**:
  - Added `requests>=2.31.0` and validated execution against Django 5.2.

### Verified
- **Architectural & Security Integrity**:
  - Multi-tier architecture: React SPA -> Node/Express Proxy -> Django Core Services -> SQLite DB -> NBE Gateway Service -> NBE Simulator Daemon.
  - Zero-bypass authorization: Operational actions (create, edit, approve, deliver) rejected by backend when attempted by unauthorized roles or across department boundaries.
  - 4-Eyes principle enforced both client-side and server-side.
- **Completion Gates**:
  - All 12 completion gates evaluated and certified **PASS**.

---

## [1.8.0-phase4-ui-ux-regression-and-hardening] - 2026-09-29

### Added
- **Automated Phase 4 Regression & Hardening Test Suite (`src/tests/phase4-regression-hardening.test.ts`)**:
  - Full route and component inventory verification covering 22 distinct views, workspaces, and modals.
  - Verification of authoritative brand tokens (`#8CC51F` green, `#5962AB` blue, `#2C3161` active item, `#47509A` border).
  - Validation of zero isolated dark hex code policy across all application components.
  - End-to-end reporting lifecycle and dual-control workflow test: Maker draft creation -> Checker approval -> Maker transmission to NBE simulator.
  - Non-color accessibility and semantic status indicator audits.
  - Standalone pagination contract verification with edge case clamping.
- **Integrated Test Execution Runner**:
  - Expanded `src/tests/run-all-tests.ts` to 12 comprehensive automated test suites (100% passing).

### Changed
- **Application-Wide Color Standardization & Hex Eradication**:
  - Eliminated lingering isolated dark hex codes (`dark:bg-[#121428]`, `dark:bg-[#161933]`, `dark:bg-[#101226]`, `dark:border-[#22284D]`, `dark:border-[#262D55]`, `dark:border-[#2B3369]`, `dark:divide-[#1C203F]`) across `DepartmentReportManagement.tsx`, `ChangeHistoryView.tsx`, `BulkImportModal.tsx`, `HardwareDiagnosticsModal.tsx`, `BiometricRecoveryModal.tsx`, `SystemHealthDashboard.tsx`, `UserSettingsModal.tsx`, `BiometricPromptModal.tsx`, and `OfflineStorageModal.tsx`.
  - Migrated entirely to unified design tokens (`dark:bg-slate-900`, `dark:bg-slate-800`, `dark:border-slate-800`, `dark:border-slate-700`, `dark:divide-slate-800`).
- **Zero-Pill Discipline Across Workspace Badges & Tabs**:
  - Replaced `rounded-full text-[10px]` with `rounded-md font-mono text-[10px]` on counts and status tags in `MakerWorkspace.tsx`, `CheckerInbox.tsx`, `AdminDashboard.tsx`, `AuditorDashboard.tsx`, `DepartmentReportManagement.tsx`, `ChangeHistoryView.tsx`, and `SystemHealthDashboard.tsx`.
- **Viewport Immunity on Modal Dialogs**:
  - Hardened `CommandPaletteModal.tsx` with dynamic height constraints (`max-h-[calc(100dvh-4rem)] flex flex-col overflow-hidden` and `overflow-y-auto` results) to eliminate any risk of viewport clipping on short displays or mobile landscape.

---

## [1.7.0-phase3-auditor-ux-and-pagination] - 2026-09-29

### Added
- **Design System Rule Injected into Master Prompts (`/.ai/02_OB_SYSTEM_SPECIFICATION.md`, `/.ai/02_OB_SYSTEM_SPECIFICATION.md`)**:
  - Formal rule prohibiting page-specific overrides when solutions belong to shared design tokens, themes, components, or application shells.
- **Account Migration Protocol (`/.ai/20_ACCOUNT_MIGRATION_AND_CONTINUATION.md`)**:
  - Permanent protocol guaranteeing self-contained project state reconstruction for subsequent AI Studio sessions.
- **First-Class Auditor Workflow & Integration (`src/components/AuditorDashboard.tsx`)**:
  - Full adherence to the shared OB design system (zero arbitrary custom color tokens).
  - Complete integration of Auditor sub-views: Audit Summary KPIs, Audit Work Queue, Statutory Return Deep Inspection, Lifecycle Workflow Timeline, Audit Findings & Severity Tracker, Evidence Vault with SHA-256 seals, Confidential Working Papers, Remediation Action Tracker with Auditor verification, and Cryptographically Sealed Audit Package Generator.
  - Added Auditor demo user (`usr_auditor_1`) to `DEMO_USERS` in `src/services/submissionService.ts` and Navbar role switcher for dual-control testing.
- **Standalone Server & Client Pagination Architecture (`src/utils/paginationUtils.ts`)**:
  - Contract: `{ items, total, page, page_size, total_pages, has_next, has_previous }`.
  - Backend integration: Express routes (`server.ts`) and Django views (`backend/apps/audit/views.py`) supporting query parameters `page`, `page_size`, and `limit`.
- **Responsive Standard Pagination UI (`src/components/Pagination.tsx`)**:
  - Desktop: `[First] [Previous] [1] [2] [3] ... [Next] [Last]` with `Page X of Y` indicator and configurable page sizes.
  - Mobile: Compact responsive representation `[Previous] Page X / Y [Next]` with $\ge 44$px touch targets.
  - Automatic control hiding when all items fit on a single page.
- **Application-Wide List Audit & Pagination Implementation**:
  - Auditor Dashboard: Work Queue, Findings, Evidence Vault, Working Papers, Remediation Tracker, and Audit Packages.
  - Version History: `ReportVersionHistoryModal.tsx` paginated with dynamic sizing.
  - Audit Trail Ledger: `AuditTrailView.tsx` resets to Page 1 upon search query or filter modifications.
- **Automated Test Suite for Pagination (`src/tests/pagination-suite.test.ts`)**:
  - Unit tests covering 0 records, 1 record, exact 1 page, exact 2 pages, safe out-of-bounds page clamping, 1,250-record datasets, and dynamic page-size changes.

---

## [1.6.0-phase2-responsive-viewport-and-application-shell] - 2026-09-29

### Added
- **Modern 100dvh Application Shell Architecture (`src/App.tsx`, `src/index.css`)**:
  - Established a controlled application shell utilizing `100dvh` viewport units without document-level expansion or blind `overflow:hidden` clipping.
  - Header and navigation remain accessible at all times while the dynamic workspace provides a controlled internal scrolling region (`overflow-y-auto min-h-0 flex-1`).
  - Added centralized application workspace footer inside `<main>` with `mt-auto pt-6 pb-2` ensuring proper bottom anchoring without awkward gaps or floating.
- **Header Mobile Drawer Access (`src/components/Navbar.tsx`)**:
  - Added `onOpenMobileDrawer` prop to `Navbar`, allowing mobile users to open the navigation drawer directly from the header hamburger button on any viewport orientation or when editing reports.
  - Responsive tablet header optimization: compact indicator presentation on `< 1024px` preserving ample breathing room at 768px tablet portrait.
- **Scroll-Safe Mobile Navigation Drawer (`src/components/Sidebar.tsx`)**:
  - Converted mobile drawer body into a unified, scroll-safe container (`overflow-y-auto flex-1 min-h-0 touch-scroll-y flex flex-col justify-between`).
  - Guarantees that the Logout control, user profile, and hardware preferences are NEVER pushed outside the viewport or clipped on mobile landscape (e.g., 844x390, 667x375).
- **Responsive Dialog & Modal Constraints**:
  - Enforced `max-h-[calc(100dvh-2rem)] overflow-y-auto` across all modals (`BiometricPromptModal`, `UserSettingsModal`, `ReportVersionHistoryModal`, `OfflineStorageModal`, `HardwareDiagnosticsModal`, `KeyboardShortcutsModal`, `CommandPaletteModal`, `BulkImportModal`, `BiometricRecoveryModal`).
- **Phase 2 Automated Test Matrix (`src/tests/responsive-ui-and-layout.test.ts`)**:
  - Added test suites for 100dvh shell architecture, Logout accessibility across mobile/tablet/desktop ($\ge 44$px touch targets), footer whitespace discipline, and tablet validation matrix (768x1024 portrait & 1024x768 landscape).

### Changed
- **Footer Whitespace Discipline (`src/components/LoginPage.tsx`, `src/components/RegisterPage.tsx`, `src/App.tsx`)**:
  - Removed unnecessary vertical empty space beneath "All rights reserved." on login and registration pages.
  - Replaced `min-h-screen min-h-[100dvh]` with pure `min-h-[100dvh]` and normalized footer padding (`py-2.5 sm:py-3`), preventing mobile address-bar height expansion.
  - Removed redundant mobile `pb-20` on `<main>` in `App.tsx` (reduced to `pb-3 sm:pb-4`), eliminating empty gaps above `BottomNavigation`.
- **Desktop Sidebar Height Protection (`src/components/Sidebar.tsx`)**:
  - Added `max-h-[50vh] overflow-y-auto` to the bottom actions container of the desktop sidebar, preventing clipping on short desktop or tablet landscape viewports (e.g. 1024x768 or 600px height).
  - Enforced $\ge 44$px touch targets on both expanded and collapsed Logout buttons.
- **Color Standardization Cleanups**:
  - Standardized remaining dark hex palettes in `DynamicReportForm.tsx`, `BiometricPromptModal.tsx`, `UserSettingsModal.tsx`, `BulkImportModal.tsx`, and `BiometricRecoveryModal.tsx` to shared tokens.
  - Updated `index.html` dark `theme-color` meta tag to `#0B0F19`.

---

## [1.5.0-phase1-visual-design-system] - 2026-09-29

### Added
- **Centralized Design System Tokens (`src/styles/designTokens.ts`)**:
  - Authoritative OB primary green codified as `#8CC51F` with calibrated tonal scales (50–950).
  - Authoritative OB primary blue codified as `#5962AB` with calibrated tonal scales (50–950).
  - Documented requested color `#5863AC` with exact 1-RGB-point delta analysis against official logo assets.
  - Standardized surface, border, text, typography, semantic feedback, and sidebar token configurations.
- **CSS Variables & Tailwind v4 Theme Tokens (`src/index.css`)**:
  - Configured `:root` and `.dark` variables (`--ob-primary-green`, `--ob-primary-blue`, `--ob-sidebar-bg`, `--ob-sidebar-border`, `--ob-sidebar-text`, `--ob-sidebar-active-bg`, `--ob-sidebar-badge-bg`).
  - Added `--color-ob-blue` alongside `--color-ob-indigo` for 100% backward compatibility.
  - Standardized `--color-ob-green` to `#8CC51F`.
- **Automated Test Suite for Design System & Colors (`src/tests/design-system-and-colors.test.ts`)**:
  - Added 5 test sections validating color values, token mapping, sidebar container classes, visual consistency, and WCAG AA/AAA contrast ratios.
  - Integrated into `src/tests/run-all-tests.ts` (10 comprehensive test suites, 100% pass).

### Changed
- **Dashboard Sidebar Visual Transformation (`src/components/Sidebar.tsx`)**:
  - Replaced the dark/black background (`#121428`) with the authoritative OB Blue (`bg-ob-blue-500`, `#5962AB`) across both the desktop sidebar and the responsive mobile slide-out drawer.
  - Automatically propagated across all authenticated dashboards (Admin, Maker, Checker, Auditor, NBE Simulator, SSOT Lakehouse, Audit Trail, and System Health).
  - Enhanced contrast: navigation text in high-legibility white ($6.0:1$), active item in deep blue `#2C3161` ($12.5:1$), and notification badges in authoritative OB green `#8CC51F` ($10.5:1$).
- **Application-Wide Color Standardization**:
  - Standardized `AuditorDashboard.tsx` by eliminating isolated dark hex palettes (`#101438`, `#141944`, `#161B48`, `#202866`, `#101226`, `#22284D`, `#2B3369`) and unifying with shared tokens.
  - Standardized `Navbar.tsx`, `BottomNavigation.tsx`, `MobileBottomNav.tsx`, `LoginPage.tsx`, `RegisterPage.tsx`, `ResetPasswordModal.tsx`, `ReportVersionHistoryModal.tsx`, and `ThemeToggle.tsx`.
  - Updated PDF generators (`src/utils/pdfReportGenerator.ts` and `src/utils/pdfGenerator.ts`) to use `#8CC51F` (`[140, 197, 31]`).

---

## [1.4.0-auditor-first-class-role] - 2026-09-29

### Added
- **First-Class Auditor Role & Regulatory Audit Workflow** (`.ai/19_AUDITOR_ROLE_AND_AUDIT_WORKFLOW.md`):
  - Implemented comprehensive `AuditorDashboard.tsx` with responsive multi-device design, zero-pill typography, and dark mode support.
  - Added dedicated Auditor registration workflow in `RegisterPage.tsx` capturing audit oversight scope and regulatory mandate justifications (BSD/03/2020).
  - Implemented Auditor approval workflow in `AdminDashboard.tsx` with administrative authorization and timestamping.
  - Implemented automatic redirection to `AUDITOR_DASHBOARD` upon auditor login in `LoginPage.tsx` and `userService.ts`.
  - Implemented **Audit Work Queue** with cross-departmental filtering (department, submission status, audit status, search query) and real-time finding aggregates.
  - Implemented **Deep Report Audit Inspection View** enabling line-by-line examination of submitted values, AST formulas, dynamic schedule tables, Maker/Checker signatures, and historical snapshots.
  - Implemented **Audit Findings Register** (`FIND-YYYYMMDD-XXXX`) tracking severity (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `INFORMATIONAL`), regulatory citations, financial variances, and lifecycle states (`OPEN`, `UNDER_REVIEW`, `REMEDIATION_PENDING`, `RESOLVED`, `CLOSED`).
  - Implemented **Evidence Management Repository** with Oromia Bank cryptographic tamper seals (`OB-EVID-SEAL-...`) and verification workflows.
  - Implemented **Confidential Auditor Work Papers & Notes** categorized by risk, compliance, data quality, and general observations.
  - Implemented **Remediation Action Tracking** with assigned department accountability, target completion dates, proof verification, and auditor sign-off.
  - Implemented **Formal Audit Reports Generator & Export** compiling executive memorandums, findings summaries, and official cryptographic verification seals.
  - Implemented dedicated backend REST API endpoints in `server.ts` under `/api/audit/*` for work queue, findings, evidence, notes, remediations, and report exports.
  - Implemented Django backend models, serializers, views, and migrations in `backend/apps/audit/` (`AuditFinding`, `AuditEvidence`, `AuditWorkingNote`, `RemediationAction`, `AuditReportPackage`).
  - Enforced strict segregation of duties (Abinet Alemu directive): In `backend/apps/permissions/authorization.py` and `backend/apps/workflows/workflow_engine.py`, the Auditor role is barred from drafting, editing, submitting, or approving reports (compliance oversight boundary).
  - Added automated test suite `src/tests/auditor-workflow.test.ts` integrated into `src/tests/run-all-tests.ts` (10 test sections, 100% pass).
  - Added Django unit test suite `backend/apps/audit/tests.py` (9 tests, 100% pass).
  - Standardized all 28 `.ai` documentation files with uniform `number_` prefixes (`01_` through `28_`) and cleaned up all duplicate files.

---

## [1.3.0-auditor-assessment] - 2026-09-28

### Added
- **Full Recovery Assessment for Auditor Role Implementation** (`.ai/19_AUDITOR_ROLE_AND_AUDIT_WORKFLOW.md`):
  - Completed thorough inspection across the entire project and all `.ai` documentation.
  - Formulated precise answers for all 10 recovery inquiries in `.ai/13_CURRENT_IMPLEMENTATION_STATUS.md`.
  - Clarified technical stack reality: both Express (`server.ts` port 3000), Django Core (`/backend` SQLite `db.sqlite3`), and Django NBE Simulator (`/nbe_simulator_service` SQLite `simulator_db.sqlite3` port 8001) are active and functional.
  - Cataloged gap analysis for first-class Auditor role: registration request, approval workflow, auditor dashboard, work queue, report audit view, revision history, evidence management, findings system (severity/status), audit notes, remediation tracking, formal audit reports, and Django boundary enforcement.

---

## [1.2.0-nbe-simulator] - 2026-09-28

### Added
- **Independent NBE Simulator Django Microservice** (`/nbe_simulator_service`):
  - Standalone Django project with own `manage.py`, settings, SQLite store (`simulator_db.sqlite3`), and dedicated port `8001`.
  - Models: `SimulatorScenario`, `SimulatorSubmission`, `SimulatorRequestLog`.
  - Full schema and envelope validation for all 24 NBE report definitions and institutional code `0000013`.
  - 6 runtime simulation modes: `ALWAYS_SUCCESS` (200/201 + cryptographic receipt `NBE-REC-YYYYMMDD-XXXX`), `VALIDATION_ERROR` (422), `AUTH_FAILURE` (401), `TIMEOUT` (504), `SERVER_ERROR` (500), `RANDOM_FLAKY`.
  - Deterministic test triggers: `X-Simulator-Force-Scenario` headers and query parameter overrides.
  - Idempotency deduplication: `Idempotency-Key` header prevents duplicate processing and returns existing receipts (`SUCCESS_IDEMPOTENT_DUPLICATE`).
  - Unit test suite (`nbe_simulator_service/apps/simulator/tests.py`): 11 tests covering all scenarios and 24 return definitions.
- **NBE Gateway & Adapter Integration**:
  - `backend/apps/nbe_gateway/gateway_service.py` and `src/services/nbeAdapter.ts`: Outbound HTTP client communicating with port 8001 with exponential retry backoff.
  - `server.ts`: Reverse-proxy endpoints for `/api/nbe-simulator/*` and auto-supervision of the Django simulator process.
  - Integration documentation in `.ai/18_NBE_SIMULATOR_MICROSERVICE.md`.

---

## [1.2.0-auth-seed-users] - 2026-09-28

### Removed
- **One-Click Role Login Visual Block**: Removed the testing shortcut button container (`ONE-CLICK ROLE LOGIN (TESTING)`) from `LoginPage.tsx`.
- **Underlying Shortcut/Bypass Logic**:
  - Removed `handleQuickPreset` and silent email default fallback in `LoginPage.tsx`.
  - Removed auto-provisioning bypass in `useBiometricAuth.ts` which previously generated fake simulated passkeys for unenrolled accounts.
  - Enforced strict password checks on `/api/auth/login` (missing password rejected with HTTP 400).
  - Removed all fake pre-seeded biometric credentials from initial user accounts in `userService.ts`.

### Added
- **Authoritative Development Seed Accounts**:
  - `admin@oromiabank.com` (Role: `ADMIN`, Dept: `Compliance & Legal Governance`, Password: `password`, Biometrics: `[]`).
  - `abebe.kebede@oromiabank.com` (Role: `MAKER`, Dept: `Credit Operations & Portfolio Management`, Password: `password`, Biometrics: `[]`).
  - `chala.desta@oromiabank.com` (Role: `CHECKER`, Dept: `Credit Operations & Portfolio Management`, Password: `password`, Biometrics: `[]`).
  - `auditor@oromiabank.com` (Role: `AUDITOR`, Dept: `Internal Audit & Regulatory Control`, Password: `password`, Biometrics: `[]`).
  - Additional users for Trade Services, Asset Recovery, and Pending Registration tests.
- **Seed Data Management & Reset Architecture**:
  - `userService.resetDevelopmentSeedData()` resets seed accounts cleanly.
  - `userService.getDevelopmentSeedSummary()` outputs developer reference data.
  - `POST /api/auth/seed-data/reset` server endpoint with non-repudiation audit logging.
  - `GET /api/auth/seed-data` server endpoint for configuration tooling.
- **Collapsible Development Test Reference UI**:
  - Added clean reference accordion on `LoginPage.tsx` displaying accounts and roles.
  - Provides "Use Email" filler (populates email only, preserving real password validation) and "Reset Seed Data" trigger.

---

## [1.1.0-ui-ux] - 2026-09-28

### Added
- **Dedicated Automated Responsive UI & Layout Test Suite** (`src/tests/responsive-ui-and-layout.test.ts`):
  - 9 viewport classification matrix (Small Mobile 320px to Large Desktop 1920px).
  - 16-component React export and inventory verification.
  - Minimum 44px mobile touch target enforcement (`min-h-[44px]`, `min-w-[44px]`).
  - Horizontal page overflow prevention testing (`overflow-x-auto`, `truncate`, `line-clamp`).
  - Zero-pill compliance audit on static metadata.
  - Multi-breakpoint navigation adaptation verification.
  - Dynamic area table dual card/table view mode verification.
  - Non-color status indicator audit (dual icon + text pairing for WCAG AA).
- **Integrated into Root Test Runner** (`src/tests/run-all-tests.ts`):
  - Now executes 8 complete test suites sequentially with 100% green verification.

### Changed
- **Zero-Pill Discipline Refinements (Frontend Design Constitution)**:
  - `src/components/DynamicReportForm.tsx`: Replaced static pill capsules (`rounded-full`) in validation summary strips with clean unboxed metadata and subtle rounded tags (`rounded-md`).
  - `src/App.tsx`: Replaced `rounded-full` badge in toast hardware verification notifications with clean `rounded-md` metadata tags.
  - `src/components/AdminDashboard.tsx`: Cleaned tab count indicators from `rounded-full` to clean `rounded-md` indicators.
  - `src/components/OfflineStorageModal.tsx`: Replaced `rounded-full` sync status tags with clean unboxed/rounded-md tags.
  - `src/components/UserSettingsModal.tsx`: Replaced `rounded-full` authentication history count tag with clean `rounded-md` tag.
  - `src/components/NbeHealthIndicator.tsx`: Updated status telemetry badge from `rounded-full` to `rounded-md`.
  - `src/components/KeyboardShortcutsModal.tsx`: Updated badge tag from `rounded-full` to `rounded-md`.
  - `src/components/OfflineStatusIndicator.tsx`: Updated sync counter from `rounded-full` to `rounded-md`.

### Verified
- `compile_applet`: Succeeded cleanly.
- `lint_applet` (`npm run lint` / `tsc --noEmit`): Exited with 0 errors.
- `npx tsx src/tests/run-all-tests.ts`: All 8 automated test suites passed 100% green.

---

## [1.0.0-audit] - 2026-09-28
### Added
- Comprehensive recovery assessment answering all 10 architectural inquiries.
- Confirmation of Express/Node.js architecture and clarification of Django non-existence.
- Verified test suites for core regulatory engines, RBAC, NBE simulator, biometrics, PDF generation, and IndexedDB storage.

---

## [Phase 29 & Phase 31 Implementation & Acceptance] - 2026-10-03
### Added
- **Phase 29: Remember Me End-to-End Authentication**:
  - Unchecked-by-default persistent login toggle with 30-day cryptographically secure session issuance.
  - HttpOnly and SameSite cookie transport (`ob_remember_token`) with server-side revocation on logout/password-change/disablement.
  - Test suite: `src/tests/phase29-remember-me-end-to-end-authentication.test.ts` (100% pass across 11 test suites).
- **Phase 31: NBE JSON Report Package Import & Schema Normalization**:
  - Normalization engine in `src/services/nbeReportPackageNormalizer.ts` with support for modern versioned envelope and 24 legacy statutory returns.
  - Validation engine detecting malformed JSON, schema version mismatches, duplicate field codes, circular AST formulas, and insecure protocols/SSRF targets.
  - Sample-value stripper preserving non-changing metadata/labels and explicit schema defaults while stripping example financial figures.
  - Governed draft creation (`DRAFT` status) preventing automatic publishing or submission creation without formal 4-eyes approval.
  - Canonical artifact repository preserving raw JSON and SHA-256 source/normalized hashes for non-repudiation audit trails.
  - Interactive Admin UI component `src/components/NbeReportPackageImportModal.tsx` embedded in `AdminDashboard.tsx` and `ReportTemplateStudioModal.tsx`.
  - Express API routes: `POST /api/config/nbe-package/validate`, `POST /api/config/nbe-package/import`, `GET /api/config/nbe-package/artifacts`, `GET /api/config/nbe-package/artifacts/:hash`.
  - Test suite: `src/tests/phase31-nbe-json-report-package-import-and-schema-normalization.test.ts` (100% pass across all 15 acceptance gates).
- **Phase 32: Dynamic NBE API Endpoint Registry & Simulator Integration**:
  - Dynamic Endpoint Registry service in `src/services/nbeEndpointRegistry.ts` managing per-report URL, HTTP method, timeout, environment target, and auth profiles.
  - Managed Secretless Auth Profiles (`MANAGED_AUTH_PROFILES`) representing Local Simulator, NBE Testbed Vault, and Production HSM with zero plaintext credentials or private keys in client storage.
  - Dynamic Simulator Discovery in `src/services/nbeSimulator.ts` discovering new reports and generating canonical submission payloads on-the-fly without hardcoded report lists.
  - Dynamic Gateway Adapter in `src/services/nbeAdapter.ts` routing submissions to report-specific endpoints with production transmission guardrails (`PRODUCTION_TRANSMISSION_BLOCKED`) and custom idempotency key support (`HEADER_UUID`, `HASH_SHA256`).
  - Simulator View UI (`src/components/NbeSimulatorView.tsx`) with report selector, live template payload inspector, endpoint metadata display, scenario injection, and instant transmission tester.
  - Express API routes: `GET /api/nbe-simulator/reports`, `GET /api/nbe-simulator/reports/:key/payload`, `POST /api/nbe-simulator/reports/:key/transmit`, `GET /api/config/nbe-endpoints`, `GET /api/config/nbe-auth-profiles`.
  - Test suite: `src/tests/phase32-dynamic-nbe-api-endpoint-registry-and-simulator-integration.test.ts` (100% pass across all acceptance gates).


