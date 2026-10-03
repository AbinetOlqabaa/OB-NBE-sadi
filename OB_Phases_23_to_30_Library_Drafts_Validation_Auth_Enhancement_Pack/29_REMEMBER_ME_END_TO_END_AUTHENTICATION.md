# Phase 29 — Remember Me End-to-End Authentication

## Execution prompt
Implement a secure, fully functional “Remember Me” login feature.

### Requirements
1. Add a Remember Me checkbox to Login, unchecked by default.
2. Email/password fields remain empty by default with helpful placeholders and no test credentials.
3. Inspect and reuse the existing Django session/token/cookie/CSRF architecture.
4. Remember Me must create a server-controlled persistent authentication session according to the existing architecture.
5. Never store plaintext passwords, password hashes, biometric templates or sensitive credentials in localStorage.
6. Prefer secure HttpOnly/Secure/SameSite cookies where compatible with the existing architecture.
7. Persistent sessions must have a defined maximum lifetime and be revocable.
8. Explicit Logout must invalidate the remembered session so the user is not silently restored by the old session.
9. Password change/account disable/session revocation must invalidate or appropriately re-evaluate remembered sessions.
10. Remember Me must not bypass the application's biometric policy. Explicit Face/Fingerprint authentication remains authoritative.
11. Test checked/unchecked behavior, browser restart, expiration, logout, revocation, multiple sessions and account disablement.
12. Security-test direct attempts to forge/extend remembered authentication.
13. Update status/changelog.

Definition of done: Remember Me works end-to-end in the real authentication backend and is not merely a UI checkbox.
