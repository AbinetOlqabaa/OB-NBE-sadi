# PHASE 13 — Unified Biometric Sign-In and Multi-Modal Authentication Architecture

## Objective
Architect and implement a unified, multi-modal sign-in engine for Oromia Bank that harmonizes Face ID, Fingerprint (WebAuthn), and Password/MFA authentication into a seamless, zero-interference login experience backed by a Single Source of Truth, advanced security validity checking, dynamic UI animations, and comprehensive notification services.

## Instructions

Inspect `src/pages/LoginPage.tsx`, `src/hooks/useBiometricAuth.ts`, `src/services/userService.ts`, `server.ts`, and session management pipelines.

### 1. Unified Authentication Gateway & Zero-Interference Modal Architecture
- **Single Source of Truth (SSOT) Credentials Model**:
  - The user account profile in `userService` / database serves as the sole authoritative record for all authentication modalities:
    - Password hash & salt
    - Enrolled Face ID biometric feature vectors
    - Enrolled WebAuthn Fingerprint public keys
    - Account lifecycle status (`ACTIVE`, `PENDING_APPROVAL`, `LOCKED`, `SUSPENDED`)
- **Seamless Multi-Modal Switching (Zero-Interference)**:
  - Enable instant, fluid switching between:
    1. **Password Authentication** (Standard corporate credentials + OTP)
    2. **Face ID Recognition** (Optical sensor face detection & vector comparison)
    3. **Fingerprint Passkey** (Hardware-backed WebAuthn biometric assertion)
  - Switching between modes must never wipe the entered email, reset unsaved form fields, trigger duplicate requests, or corrupt active validation states.
  - Dynamically display biometric login buttons only when the user email matches an enrolled account and device hardware is capable.

### 2. Biometric Sign-In Workflows
- **Face ID Sign-In Workflow**:
  - Automatically acquire video stream upon user initiating Face ID sign-in.
  - Execute optical face detection engine with live confidence scoring.
  - Extract candidate facial feature vector from live stream.
  - Send candidate vector to `/api/auth/biometrics/verify` along with account identifier.
  - Backend verifies vector against stored SSOT template using mathematical similarity threshold (cosine distance / Euclidean similarity > 0.85).
  - Enforce liveness check: reject static photographs or replay attacks.
  - On match: issue authenticated JWT session token, update last login timestamp, log audit event, and transition to user role workspace.
- **Fingerprint (WebAuthn) Sign-In Workflow**:
  - Retrieve registered credential ID for user account.
  - Request server challenge via `POST /api/auth/biometrics/challenge`.
  - Invoke `navigator.credentials.get({ publicKey: { challenge, allowCredentials: [...] } })`.
  - Authenticator prompts user for physical touch/fingerprint verification.
  - Send signed assertion (authenticator data, client data JSON, signature) to `/api/auth/biometrics/verify`.
  - Backend verifies signature against stored public key, increments signature counter (replay protection), and issues authenticated session.

### 3. Enterprise Security Validity Checkups & Rate Limiting
- **Account Status Guardrails**:
  - Strictly reject biometric login attempts for accounts in `PENDING_APPROVAL`, `LOCKED`, or `SUSPENDED` status, displaying explicit regulatory compliance notices.
- **Biometric Brute-Force & Lockout Protection**:
  - Track consecutive failed biometric attempts per account and IP address.
  - After 3 consecutive failed biometric attempts:
    - Temporarily disable biometric login for 15 minutes.
    - Require standard password + OTP re-authentication.
    - Dispatch immediate security warning notification.
- **Un-Enrolled Account Defense**:
  - Explicitly reject biometric authentication attempts for un-enrolled accounts with descriptive guidance rather than generic errors or silent bypasses.

### 4. High-Fidelity UI Animations & Interaction Design
- Build fluid, synchronized animations for the authentication interface:
  - **Modal Expansion & Mode Toggle**: Smooth spring-animated expansion between compact password form and biometric scanner viewports.
  - **Live Face Scanner Overlay**: Circular biometric target with rotating radial sweep, depth parallax, and glowing edge detection lines.
  - **Fingerprint Sensor Pulse**: Ambient breathing animation inviting the user to place finger on sensor.
  - **Success Transition**: Biometric reticle morphs into an animated Oromia Bank golden shield with smooth page dissolve into Maker/Checker/Admin/Auditor dashboards.

### 5. Multi-Channel Notification Service
- Implement comprehensive notification events during sign-in:
  - `BIOMETRIC_LOGIN_SUCCESS`: "Welcome back, [User Name]. Authenticated via [Face ID / Fingerprint]."
  - `BIOMETRIC_MATCH_FAILED`: "Biometric verification unsuccessful. Please ensure your face is well-lit or try your fingerprint/password."
  - `ACCOUNT_LOCKED_NOTICE`: "Account temporarily locked due to multiple failed biometric attempts."
  - `NEW_DEVICE_ALERT`: "Biometric sign-in detected from a new browser/workstation: [OS / Browser]."

## Completion Gate
- Users can log in using Password, Face ID, or Fingerprint without modality conflicts or UI glitches.
- Face ID sign-in performs optical capture, vector extraction, server-side template matching, and session establishment.
- Fingerprint sign-in executes WebAuthn challenge-response assertion and cryptographic verification.
- Account status (inactive, locked) is strictly enforced with zero bypasses.
- UI transitions and animations execute smoothly without layout shifts.
- Complete audit logging and security notifications are triggered for every sign-in event.

## Activation Prompt
Read and execute `13_UNIFIED_BIOMETRIC_SIGN_IN_AND_MULTI_MODAL_AUTHENTICATION.md`. Inspect `LoginPage.tsx`, `useBiometricAuth.ts`, and server authentication routes. Implement unified multi-modal sign-in supporting Face ID, Fingerprint, and Password authentication, strict validity checking, anti-replay protection, stage-driven UI animations, and notification services. Verify with comprehensive automated tests.
