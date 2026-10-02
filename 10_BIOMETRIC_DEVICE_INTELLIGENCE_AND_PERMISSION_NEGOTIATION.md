# PHASE 10 — Biometric Device Intelligence, Camera Detection and Permission Negotiation

## Objective
Establish an intelligent, multi-platform hardware detection and permission negotiation layer for Oromia Bank biometric services, dynamically differentiating Mobile, Tablet, and PC environments, probing camera sensor availability, handling user consent and persistent permissions, and providing graceful fallbacks with real-time notification services.

## Instructions

Inspect `src/utils/deviceCapabilities.ts`, `src/hooks/useBiometricAuth.ts`, `src/pages/LoginPage.tsx`, `src/components/auth/`, and related notification/toast services.

### 1. Multi-Platform Device Intelligence & Sensor Diagnostics
Implement rigorous, multi-factor device classification without relying on brittle user-agent strings alone:
- **Mobile vs. Tablet vs. PC/Desktop Identification**:
  - Differentiate Form Factors: Smartphone (Handheld), Tablet (Medium slate, touch-first), Desktop/Laptop PC (Keyboard/Mouse/Webcam).
  - Platform/OS Detection: Android, iOS (iPhone/iPad with iPadOS touch screen heuristics), macOS, Windows, Linux.
  - Hardware Capabilities Probing: Screen touch points (`navigator.maxTouchPoints`), pointer precision (`matchMedia('(pointer: fine)')` vs. `coarse`), aspect ratio, orientation API.
- **Automated Camera Sensor Availability Discovery**:
  - Invoke `navigator.mediaDevices.enumerateDevices()` to inspect `videoinput` devices.
  - Distinguish built-in front-facing selfie cameras (`facingMode: 'user'`), rear cameras (`facingMode: 'environment'`), and external USB webcams on PC.
  - Detect camera availability, busy states (camera currently claimed by another process), and permission denial states automatically prior to initiating video streaming.

### 2. Interactive Consent & Two-Tier Permission Negotiation
Build a secure, transparent permission negotiation workflow:
- **Pre-Permission Explanatory Briefing (Oromia Bank Trust Banner)**:
  - Before invoking the native browser permission prompt, display an intuitive, institution-branded explanatory dialog.
  - Explain regulatory necessity (NBE BSD/03/2020 two-factor compliance), optical privacy guarantees (raw video is processed locally in memory and never transmitted off-device), and camera usage expectations.
- **Dual-Scope Consent Model**:
  - Tier 1: Immediate session camera access agreement.
  - Tier 2: Persistent consent preference ("Remember this device and allow camera access automatically for future Oromia Bank sessions").
  - Store consent preference in local persistent storage (`ob_camera_consent_persistent`) synced with user account profile preferences in the Single Source of Truth (SSOT).
- **Graceful Decline & Multi-Stage Fallback**:
  - If the user declines the explanation modal, denies the browser camera prompt, or if the device lacks a functioning camera:
    1. Do not crash, throw unhandled exceptions, or block the registration/login flow.
    2. Fall back gracefully to alternative authentication modalities (Fingerprint biometric or Password/MFA).
    3. Display a polite, descriptive notification outlining why camera access was dismissed and how the user can enable it later via settings.
    4. Provide an instant "Retry Permission" button if the user dismissed by accident.

### 3. Comprehensive Notification Service
Integrate real-time notification feeds across both Mobile and PC viewports:
- Display contextual toast/alert notifications for:
  - `CAMERA_DETECTED`: "Front-facing optical sensor detected on [Device Model / OS]."
  - `PERMISSION_GRANTED`: "Camera access authorized. Initializing face detection engine..."
  - `PERMISSION_DENIED`: "Camera access declined. Falling back to alternative authentication."
  - `DEVICE_MISMATCH`: "Selected PC webcam mode on mobile hardware. Auto-switching to mobile camera pipeline."
  - `HARDWARE_UNAVAILABLE`: "No optical camera found on this workstation. Fingerprint or password required."

### 4. UI/UX Responsiveness & Device-Adaptive Modals
- Provide dedicated, touch-optimized layouts for Mobile (iOS Safari, Android Chrome) and high-density widescreen layouts for Desktop PCs.
- Ensure camera preview container dynamically matches device aspect ratios (9:16 mobile portrait vs. 4:3 / 16:9 PC webcam viewports).
- Include responsive device indicator badges ("📱 Mobile Optical Sensor" / "💻 Workstation Webcam").

## Completion Gate
- System correctly classifies Mobile (iOS/Android), Tablet, and PC environments with 100% precision.
- Camera hardware availability is verified before stream acquisition.
- Explanatory consent dialog triggers before browser prompt; user decline triggers graceful fallback and descriptive notification without exceptions.
- Persistent consent preference is recorded and respected on subsequent visits.

## Activation Prompt
Read and execute `10_BIOMETRIC_DEVICE_INTELLIGENCE_AND_PERMISSION_NEGOTIATION.md`. Inspect existing device detection and permission logic first. Implement comprehensive device intelligence, camera hardware diagnostics, interactive consent negotiation, graceful fallbacks, and real-time notification services across Mobile and PC environments. Verify with automated and manual test scenarios.
