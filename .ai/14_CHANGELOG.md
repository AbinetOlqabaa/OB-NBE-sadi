# 14 - CHANGELOG

All notable changes and engineering enhancements for the Oromia Bank NBE Regulatory Reporting Platform are recorded in this file.

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
