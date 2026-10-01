# PHASE 14 — Biometric Service Hardening, Privacy and Operational Security

## Objective
Harden the complete biometric service after enrollment/login/reset exist.

## Data protection
Audit storage and transport. Ensure TLS expectations, protected/encrypted biometric-derived data, no secrets in logs, no unnecessary raw camera-frame persistence, no raw fingerprint collection, minimized access, retention/deletion rules and safe backups.

## Privacy
Document what is collected, purpose, processing location, retention, deletion/revocation, administrative visibility and recovery. Give concise user-facing explanations.

## Service boundary
If a dedicated biometric service exists, define authenticated service-to-service access, authorization, timeouts, retries, request IDs, health checks and failure behavior. Do not introduce microservices merely for appearance.

## Anti-abuse
Implement/verify rate limiting, progressive delay/lockout where appropriate, replay resistance, fresh challenges, liveness controls, suspicious-attempt audit and lifecycle consistency.

## Notifications
Audit enrollment, login, reset, failure, lockout and revocation notifications. Avoid leaking whether another account has biometric enrollment.

## Testing
Test malformed inputs, replay-like requests, unauthorized service calls, excessive attempts, logging leakage and lifecycle consistency.

## Completion
No obvious raw-biometric leakage path and a documented security/privacy posture.

## Activation Prompt
Read and execute `14_BIOMETRIC_SERVICE_HARDENING_PRIVACY_AND_COMPLIANCE.md`. Perform a security-focused inspection, implement concrete fixes, test them, regression-test authentication and document limitations. Do not merely produce a security report.
