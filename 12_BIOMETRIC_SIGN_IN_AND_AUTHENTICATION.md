# PHASE 12 — Biometric Sign-In and Authentication

## Objective
Implement production-quality biometric login while preserving password authentication as an independent mechanism.

If the user selects Password, execute password authentication. If Fingerprint is selected, execute WebAuthn. If Face ID is selected, execute face authentication. Do not silently invoke or accept another mechanism.

## Fingerprint
Implement secure challenge → WebAuthn assertion → server verification → credential ownership/counter/origin/RP checks as appropriate → session creation → audit → role-dashboard redirect.

Handle unsupported browser, no credential, cancellation, timeout, invalid assertion, revoked credential and server errors.

## Face
Implement explicit camera consent, capability checks, secure capture, quality/one-face checks, liveness where supported, protected feature processing, server-authoritative matching, bounded thresholds, attempt/rate limits, audit and secure session creation.

Never trust a browser-only match.

## Security
Avoid unnecessary account enumeration. Provide retry and recovery. Do not silently fall back to password after explicit biometric selection; fallback must be actively selected and policy-permitted.

## UX
Create accessible preparing, authenticator/camera, verifying, success, failure, rate-limited, unsupported and retry states.

## Testing
Test each method independently, wrong credential/face, cancellation, timeout, revocation, liveness failure, rate limit, session creation and correct role redirect. Test direct API bypass attempts and regression-test password login.

## Completion
All supported mechanisms operate independently and converge on one authoritative authentication/session state.

## Activation Prompt
Read and execute `12_BIOMETRIC_SIGN_IN_AND_AUTHENTICATION.md`. Inspect Login first. Implement genuine biometric sign-in end-to-end. Respect explicit method selection. Use server-authoritative verification, secure sessions, rate limits, audit and recovery. Test every mechanism independently and run regression tests.
