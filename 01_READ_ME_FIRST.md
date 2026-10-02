# OB Biometric Enhancement — Phases 10–15

Use one phase per Google AI Studio quota cycle.

For each phase: upload the previous complete ZIP, save/import it, read `.ai/00_START_HERE.md`, `.ai/13_CURRENT_IMPLEMENTATION_STATUS.md`, `.ai/14_CHANGELOG.md`, inspect the real implementation, then execute the matching phase prompt. Before quota ends, update status/changelog and download the complete ZIP.

## Critical security principles

The browser must not pretend to read raw fingerprints. Use WebAuthn/passkeys/platform authenticators where supported; the server stores credential/public-key metadata, not raw fingerprint data.

For face authentication, do not use insecure client-only image comparison. Use a protected biometric service boundary, authenticated enrollment, quality checks, bounded thresholds, liveness/anti-spoofing where available, rate limits, audit logging, encryption/access controls, retention rules and secure recovery.

Camera permission must be explicit. Do not claim browsers can reliably identify exact device make/model or OS when they cannot. Device/browser hints may guide UI but must not be security authority.

Frontend state is never the authentication authority. Backend/domain state is the SSOT.

Always distinguish IMPLEMENTED from VERIFIED. Never claim physical hardware/browser testing that was not actually performed.
