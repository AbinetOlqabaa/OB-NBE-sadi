# PHASE 19 — CONTEXT-AWARE BIOMETRIC RESET & ENROLLMENT DISCOVERY ENGINE

## Executive Summary & Objectives
Upgrade the biometric reset functionality on the login screen into a smart, context-aware recovery workflow. The "Reset" button will always be visible and intelligently responsive to the user's validity and enrollment status (Face ID only, Fingerprint only, or both).

---

## 1. Problem Statement & Functional Requirements
1. **Hidden or Inflexible Reset:** The previous reset button was only visible if client-side localStorage had recorded a registration, which broke if a user switched devices, cleared browser data, or enrolled on another workstation.
2. **Missing Granular Awareness:** When an officer initiated reset, the application did not distinguish whether the officer had enrolled in Face ID only, Fingerprint only, or both options.
3. **Always-Available & Context-Aware:**
   - The "Reset" button must always be visible/accessible in the biometric authentication section.
   - When clicked, it assesses the user's corporate email and validity.
   - It fetches authoritative enrollment information from `/api/auth/biometrics/lifecycle/:email`.
   - If the user has not entered an email, it guides them to provide their corporate email.
   - If the user has no biometrics enrolled, it explains that no active passkeys exist and offers to launch the enrollment flow.
   - If the user has Face ID enrolled, it activates Face ID reset.
   - If the user has Fingerprint enrolled, it activates Fingerprint reset.
   - If the user has both enrolled, it provides a smart choice: reset Face ID, reset Fingerprint, or reset All biometrics.
   - Enforces password step-up authentication before executing the revocation to prevent unauthorized credential tampering per NBE BSD/03/2020.

---

## 2. Technical Specifications
- In `src/components/LoginPage.tsx`:
  - Enhance Biometric Reset trigger to open an interactive `SmartBiometricResetModal`.
  - Fetch real-time lifecycle state from `/api/auth/biometrics/lifecycle/:email`.
  - Allow seamless step-up re-authentication using the password entered in the login form or prompted inside the modal.
- In `src/components/SmartBiometricResetModal.tsx`:
  - Step 1: Account identification & lifecycle detection.
  - Step 2: Method selection (dynamic badges for Face ID, Fingerprint, All).
  - Step 3: Institutional password step-up verification.
  - Step 4: Token-based revocation execution via `/api/auth/biometrics/reset/execute` and immediate prompt to re-enroll.
