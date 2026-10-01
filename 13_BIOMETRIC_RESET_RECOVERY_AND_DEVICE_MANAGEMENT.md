# PHASE 13 — Biometric Reset, Recovery and Device Management

## Objective
Implement secure lifecycle management for enrolled Face ID and WebAuthn credentials.

## Face reset
Require current-user verification and appropriate re-authentication/step-up authentication. Where policy requires, verify the password or another approved recovery factor. Verify existing enrollment, explain consequences, revoke/invalidate the old enrollment safely, begin re-enrollment and audit every transition.

## WebAuthn
Support credential management/revocation and multiple authenticators if the architecture supports it. Show safe credential metadata only.

## Security
Protect reset from stolen sessions, takeover, replay, race conditions, stale client state and cross-user deletion. Every reset is a server-authorized state transition.

## Security center
Provide:
- Face enrollment status
- WebAuthn/passkey status
- authenticator metadata
- relevant last event
- reset/re-enrollment controls
- recovery guidance

Never expose raw biometric data.

## Testing
Test authorized/unauthorized reset, wrong password, stale session, revoked credentials, re-enrollment, concurrency and audit records.

## Completion
Users can safely manage biometric lifecycle without exposing raw biometric material.

## Activation Prompt
Read and execute `13_BIOMETRIC_RESET_RECOVERY_AND_DEVICE_MANAGEMENT.md`. Inspect existing reset/recovery code. Implement secure server-authorized lifecycle management, re-authentication, revocation, audit and recovery UX. Test hostile and authorized paths.
