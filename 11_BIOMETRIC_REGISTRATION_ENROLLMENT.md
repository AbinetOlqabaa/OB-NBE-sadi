# PHASE 11 — Secure Biometric Registration and Enrollment

## Objective
Implement complete authenticated Face ID and Fingerprint/WebAuthn enrollment. The user selects one method at a time; methods remain independent.

## Face enrollment
Provide mobile-camera and PC/webcam options when actually available. Detect browser capabilities, request explicit permission, show live preview, detect one face, check capture quality, perform liveness/anti-spoofing where supported, create protected biometric features/templates and submit securely to the backend.

Handle permission granted/denied/dismissed, no camera, camera busy, unsupported browser, initialization failure, no face, multiple faces, poor quality, timeout, liveness failure and server failure with clear recovery notifications.

Use staged accessible animations: preparing, permission, camera start, face search, quality, liveness, processing, success/failure/retry.

Do not claim exact device hardware identity unless the browser actually provides reliable information.

## Fingerprint
Use WebAuthn:
1. authenticated identity context
2. server challenge
3. platform authenticator
4. server verification
5. credential/public-key metadata storage
6. audit
7. success state

Handle unsupported browser, unavailable authenticator, cancellation, timeout, duplicate credential and server failure.

## Identity safeguards
Bind enrollment to the correct authenticated account. Do not let another person enroll into an account through a weak client-only flow.

## Testing
Test capability, permission, cancellation, retry, refresh and cross-account isolation. Update status/changelog.

## Completion gate
A new user can genuinely enroll supported Face ID and/or Fingerprint with authoritative server state and graceful failures.

## Activation Prompt
Read and execute `11_BIOMETRIC_REGISTRATION_ENROLLMENT.md`. Inspect registration and biometric code first. Implement genuine end-to-end enrollment, not simulated success. Keep methods independent. Use WebAuthn for fingerprint/platform authentication and a protected face-biometric service for face enrollment. Test real capabilities where available and document what could not be physically tested.
