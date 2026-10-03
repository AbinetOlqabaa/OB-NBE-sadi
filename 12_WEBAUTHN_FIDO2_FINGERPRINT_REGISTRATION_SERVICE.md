# PHASE 12 — WebAuthn / FIDO2 Hardware-Backed Fingerprint Biometric Service

## Objective
Implement an enterprise-grade, hardware-backed fingerprint biometric enrollment and verification service using modern FIDO2 / WebAuthn standards, supporting platform authenticators (Apple Touch ID, Windows Hello, Android BiometricPrompt), asymmetric key-pair generation, challenge-response attestation, and secure database persistence with user enrollment flagging.

## Instructions

Inspect `src/hooks/useBiometricAuth.ts`, `src/utils/deviceCapabilities.ts`, `src/services/userService.ts`, `server.ts`, and security audit services.

### 1. Platform Authenticator Probing & Readiness Diagnostic
- Query platform authenticator readiness via `PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()` and `PublicKeyCredential.isConditionalMediationAvailable()`.
- Identify available hardware touch sensors:
  - Apple Touch ID (macOS Safari/Chrome, iOS Safari).
  - Windows Hello Fingerprint / PIN sensor (Windows 10/11 Edge/Chrome).
  - Android BiometricPrompt (In-display fingerprint scanner, capacitive power button reader).
- Differentiate platform authenticators (built-in fingerprint sensors) from roaming security keys (YubiKey USB dongles) with `authenticatorAttachment: 'platform'`.

### 2. Cryptographic Registration Protocol (WebAuthn Attestation)
- **Challenge Generation & Registration Options**:
  - Request server-originated cryptographically random challenge (32 bytes base64url).
  - Configure relying party parameters:
    - `rp: { name: 'Oromia Bank S.C. Regulatory Reporting Portal', id: window.location.hostname }`.
    - `user: { id: bufferFromUuid(user.id), name: user.email, displayName: user.name }`.
    - `pubKeyCredParams: [{ alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }]` (ES256 and RS256).
    - `authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', requireResidentKey: true }`.
    - `timeout: 60000` (60 seconds).
- **Client Execution (`navigator.credentials.create`)**:
  - Invoke native browser/OS biometric prompt.
  - Handle user touch/fingerprint interaction on physical hardware sensor.
  - Extract credential ID, raw public key buffer, attestation object, and client data JSON.
- **Iframe Sandbox & Environment Resilience**:
  - Detect whether execution is confined inside an iframe sandbox with restricted WebAuthn permissions.
  - Provide a secure, device-bound cryptographic fallback that complies with institutional security guidelines without throwing fatal errors.

### 3. Database Persistence & User Enrollment Flagging
- **Server Registration Endpoint (`POST /api/auth/biometrics/register`)**:
  - Validate attestation challenge and origin match.
  - Store public key, credential ID, algorithm ID, sign count (initialized to 0), and device descriptor in user account profile.
  - Set `hasFingerprintEnrolled: true` in authoritative SSOT user record.
  - Append immutable audit event: `BIOMETRIC_ENROLLED` (`type: 'FINGERPRINT'`, `actor: user.id`, `device: platformInfo`).

### 4. Fingerprint UI Animations & Multi-Stage Visuals
- Create responsive touch biometric animations:
  - **Stage 1 (Prompt)**: Floating biometric fingerprint icon with gentle concentric acoustic ripple waves.
  - **Stage 2 (Scanning)**: Fingerprint ridge line illumination animation sweeping from bottom to top in institutional gold (`#00A859` / `#C5A059`).
  - **Stage 3 (Validation)**: Success burst with tactile sound effect/haptic feedback trigger (where supported on mobile).
  - **Stage 4 (Enrolled)**: Green shield badge with credential fingerprint summary.

### 5. Notification Service Integration
- Dispatch targeted notification events:
  - `FINGERPRINT_PROMPT_ACTIVE`: "Touch the fingerprint sensor or use Windows Hello / Touch ID to register."
  - `FINGERPRINT_ENROLLED_SUCCESS`: "Fingerprint biometric credential registered successfully."
  - `FINGERPRINT_CANCELLED`: "Fingerprint enrollment cancelled by user. You may try again or sign in with password."
  - `FINGERPRINT_NOT_SUPPORTED`: "No platform fingerprint sensor detected on this device."

## Completion Gate
- System correctly probes and detects hardware platform authenticators across Apple, Windows, and Android devices.
- FIDO2 / WebAuthn `navigator.credentials.create()` workflow generates valid cryptographic public keys.
- Sandbox constraints are handled gracefully with fallback resilience.
- User account in SSOT database is flagged with `hasFingerprintEnrolled: true` and credential details are persisted.
- Touch animations and notification alerts function seamlessly across viewports.

## Activation Prompt
Read and execute `12_WEBAUTHN_FIDO2_FINGERPRINT_REGISTRATION_SERVICE.md`. Inspect existing biometric hook and server endpoints. Implement enterprise-grade WebAuthn/FIDO2 fingerprint enrollment, platform authenticator detection, challenge-response validation, SSOT database persistence, responsive UI animations, and notification services. Verify with automated test suites.
