# PHASE 10 — Biometric Architecture and Security Foundation

## Objective
Establish the secure backend/domain foundation for biometric enrollment, authentication, reset/re-enrollment, device capability state, camera permissions, WebAuthn credentials, face-template lifecycle, audit, recovery and rate limiting.

## Inspect first
Read the complete `.ai` knowledge base and inspect Login, Registration, authentication APIs, user/session models, WebAuthn, face detection/matching, biometric fields, encryption, audit, notifications, Redis/cache and migrations. Do not duplicate existing systems.

## Authoritative states
Define appropriate states such as not enrolled, enrollment in progress, enrolled, suspended/revoked, reset requested/in progress, failed and capability unavailable. Do not confuse device capability with user enrollment.

## Fingerprint
Use WebAuthn/passkeys/platform authenticators. Never request raw fingerprint data from JavaScript. Implement secure challenge, origin/RP/credential ownership and assertion/registration verification appropriate to the existing stack.

## Face
Define protected capture/feature representation, quality checks, matching boundary, liveness boundary, threshold/sensitivity semantics, retention/deletion and audit. Do not make client-only matching authoritative.

## Threat model
Address replay, credential theft, spoofing/deepfake/photo presentation where relevant, camera permission abuse, takeover, reset abuse, brute force, enumeration, biometric leakage, stale enrollment, cross-user matching and race conditions.

Use normalized biometric/credential models and migrations where appropriate.

## Testing
Add security tests for credential ownership, enrollment authorization, reset authorization, challenge lifecycle, failed attempts, revocation and audit.

## Completion
Architecture, server authority, fingerprint/WebAuthn model, face-data handling, reset/recovery boundaries and security controls must be coherent and documented.

## Activation Prompt
Read and execute `10_BIOMETRIC_ARCHITECTURE_AND_SECURITY_FOUNDATION.md`. Inspect authentication and biometric implementation first. Establish a secure architecture and migrations before cosmetic UI work. Use WebAuthn for fingerprint/platform authentication. Use a protected server-authoritative face service. Work autonomously: inspect → threat-model → design → implement → migrate → test → debug → retest → document.
