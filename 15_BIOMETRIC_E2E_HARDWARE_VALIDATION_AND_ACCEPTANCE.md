# PHASE 15 — Biometric E2E, Browser/Device Validation and Acceptance

## Objective
Perform comprehensive acceptance testing across actual environments available to the development team. Separate software verification from physical hardware verification.

## Device/browser matrix
Where physically available test desktop/laptop webcam, Android phone/tablet, iPhone/iPad where available, and supported desktop/mobile browsers. Never claim unavailable hardware was tested.

## Face enrollment
Verify allow/deny/dismiss camera permission, no camera, busy camera, initialization failure, face/no-face/multiple-face, poor quality, timeout, liveness, success, retry, cancel and reset/re-enrollment.

## WebAuthn
Verify supported platform authenticator, successful registration/authentication, cancellation, timeout, unavailable authenticator, revoked credential and multiple credentials if supported.

## Login
For every mechanism verify selected method only, success, wrong biometric, cancellation, timeout, rate limiting, session creation, correct role dashboard redirect and explicitly selected/allowed fallback.

## Security/E2E
Test cross-account isolation, direct API attacks, session expiry, reset authorization, audit trail, notifications and logout/re-login.

## UI/UX
Inspect animations, progress indicators, permission explanations, mobile/tablet/desktop layouts, accessibility, error recovery, loading states and overlays.

## Performance
Measure actual camera initialization, face processing, WebAuthn and API latency where possible. Do not invent universal thresholds.

## Acceptance matrix
Produce:
Capability | Implemented | Tested | Environment | Result | Notes

Never mark hardware-dependent capabilities VERIFIED without actual evidence.

Update `.ai/13_CURRENT_IMPLEMENTATION_STATUS.md` and `.ai/14_CHANGELOG.md`.

## Completion
Biometric registration, login, reset, recovery, audit, notifications and redirects work as implemented, with every unverified hardware-dependent item explicitly identified.

## Activation Prompt
Read and execute `15_BIOMETRIC_E2E_HARDWARE_VALIDATION_AND_ACCEPTANCE.md`. Treat this as real acceptance testing. Run actual automated/browser/device tests available. Do not simulate hardware verification. Fix defects, retest, regression-test and document exact evidence.
