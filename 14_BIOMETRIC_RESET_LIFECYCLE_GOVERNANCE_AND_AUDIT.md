# PHASE 14 — Biometric Reset Lifecycle, Security Governance and Audit Integrity

## Objective
Establish a secure, audited lifecycle management and resetting service for Oromia Bank biometric credentials (Face ID and Fingerprint passkeys), mandating strict user identity re-authentication, previous feature vector verification, multi-step confirmation workflows, tamper-evident audit logging, and automated security notification services.

## Instructions

Inspect `src/services/userService.ts`, `src/hooks/useBiometricAuth.ts`, `server.ts`, `src/services/auditService.ts`, and user settings / profile views.

### 1. Mandatory User Validity Checkups & Identity Re-Authentication
- **Pre-Reset Re-Authentication Gate**:
  - Never allow resetting, modifying, or wiping biometric credentials from an ambient or cached session without explicit, step-up re-authentication.
  - Require the user to re-enter their current account password.
  - For high-privilege roles (Checker, Admin, Compliance Officer), require second-factor verification (OTP code or institutional confirmation).
  - Verify password hash on the backend (`POST /api/auth/biometrics/reset-verify`) before issuing a short-lived, single-use Biometric Reset Authorization Token (valid for 5 minutes).

### 2. Previous Biometric Feature Verification & Archival
- **Stored Feature Availability Check**:
  - Check whether the user currently possesses enrolled biometric credentials (`hasFaceEnrolled` / `hasFingerprintEnrolled`).
  - Retrieve and inspect the active biometric metadata (credential ID, enrollment timestamp, hardware device descriptor, template version).
- **Graceful Vector Invalidation & Historical Archival**:
  - Rather than hard-deleting the historical vector without a trace, archive the previous biometric record with status `REVOKED`:
    - Record `revocationReason` (e.g., "User initiated Face ID reset", "Device lost or replaced", "Administrative compliance wipe").
    - Record `revokedAt` timestamp and `revokingActor` (self or administrator).
    - Invalidate the active cryptographic key / vector immediately so it can never be used to authenticate again.

### 3. Secure Multi-Step Reset & Re-Enrollment Workflow
Implement an intuitive, secure multi-step reset wizard in the user profile/security settings:
- **Step 1: Security Notice & Authorization**:
  - Display regulatory notice explaining the implications of resetting biometric credentials.
  - Perform password re-authentication and obtain single-use reset authorization token.
- **Step 2: Previous Credential Review & Invalidation**:
  - Display details of existing biometric enrollment (enrolled device, date, modality).
  - Explicit confirmation: "Revoke Current Face ID / Fingerprint".
  - Backend executes revocation in an atomic transaction and clears the active enrollment flag.
- **Step 3: Fresh Biometric Enrollment**:
  - Immediately launch the Face ID optical camera detection pipeline (Phase 11) or WebAuthn Fingerprint enrollment (Phase 12).
  - Extract and store the fresh biometric template.
  - Set `hasFaceEnrolled: true` or `hasFingerprintEnrolled: true`.
- **Step 4: Completion & Security Receipt**:
  - Display confirmation screen with cryptographic receipt hash, device information, and updated security score.

### 4. Administrative Biometric Governance & Emergency Revocation
- **Admin Security Console Controls**:
  - Enable System Administrators and Compliance Officers to view biometric enrollment status across bank personnel (without viewing raw biometric templates or vectors).
  - Provide an emergency "Administrative Biometric Wipe" feature if an employee reports a lost, stolen, or compromised laptop or mobile device.
  - Mandatory audit reason required for administrative wipes.

### 5. Tamper-Evident Audit Logging & Notification Dispatch
- **Immutable Audit Log Events**:
  - Log every lifecycle state change to the SSOT audit trail:
    - `BIOMETRIC_RESET_REQUESTED`
    - `BIOMETRIC_REAUTH_FAILED`
    - `BIOMETRIC_REVOKED`
    - `BIOMETRIC_RE_ENROLLED`
    - `ADMIN_BIOMETRIC_WIPE`
  - Include metadata: `userId`, `actorId`, `ipAddress`, `userAgent`, `credentialType`, `timestamp`, `reason`.
- **High-Priority Transactional Notifications**:
  - Dispatch real-time security alerts via in-app toast, notification center, and simulated SMS/Email:
    - "Security Alert: Face ID reset initiated on your Oromia Bank account."
    - "Your previous biometric credential was revoked on [Timestamp]."
    - "If you did not initiate this action, contact Oromia Bank Information Security immediately."

## Completion Gate
- Biometric reset cannot be executed without successful password re-authentication.
- Previous biometric feature availability is checked, validated, and archived with `REVOKED` status.
- Re-enrolled biometric functions immediately for sign-in while revoked credentials are permanently rejected.
- Audit trail accurately records who requested the reset, when, under what authorization, and what credentials were affected.
- High-priority security notifications are dispatched across both Mobile and PC interfaces.

## Activation Prompt
Read and execute `14_BIOMETRIC_RESET_LIFECYCLE_GOVERNANCE_AND_AUDIT.md`. Inspect existing user service and profile settings. Implement mandatory step-up re-authentication, previous biometric vector verification, multi-step reset workflows, administrative emergency revocation, tamper-evident audit logging, and security notification services. Verify with automated test suites.
