# PHASE 17 — LIVE IMAGE QUALITY INDICATOR & ADAPTIVE BIOMETRIC MATCHING ENGINE

## Executive Summary & Objectives
Address real-world tablet/mobile/webcam authentication failures ("image do not match") caused by optical variance between enrollment and sign-in frames. Introduce an elegant, real-time optical quality indicator (Poor / Good / Excellent) and administrator-adjustable biometric matching thresholds compliant with NBE Directive BSD/03/2020.

---

## 1. Problem Identification & Root Cause
1. **Raw Vector Checksum Dropout:** During enrollment (`enrollFaceBiometric`), `rawVectorChecksum` was omitted from the `faceTemplate` record, forcing `verifyFaceBiometric` to rely exclusively on strict SHA-256 HMAC equality rather than optical tolerance calculation.
2. **Ambient Lighting Variance:** Natural shifts in ambient lighting, tablet screen reflections, and camera exposure between enrollment and login alter average RGB and luminance channels, causing strict hash comparisons to fail.
3. **Lack of User Feedback:** Users have no live visual feedback indicating whether camera illumination, contrast, sharpness, and distance are adequate prior to tapping capture.
4. **Rigid Thresholds:** Biometric matching tolerance was hardcoded with no mechanism for bank administrators to tune tolerance thresholds to fit specific hardware deployment environments (e.g. branch tablets vs. desktop webcams).

---

## 2. Architecture & Technical Specifications

### A. Live Optical Image Quality Engine (Client & Server)
Real-time frame evaluation running at 30-60fps:
- **Luminance:** Evaluates average luminance across frame (target: 80 - 180, acceptable: 35 - 235).
- **Sharpness:** Spatial 2D Laplacian gradient calculation (sharpness >= 0.35).
- **Face Positioning:** Central bounding ratio verification (0.30 - 0.70 of viewport).
- **Tier Classification:**
  - **POOR (Score < 0.50):** Red/Amber badge with actionable diagnostic tips ("Low lighting", "Blurry frame", "Center your face").
  - **GOOD (Score 0.50 - 0.79):** Emerald/Teal badge ("Good quality — ready to scan").
  - **EXCELLENT (Score >= 0.80):** Vibrant Emerald/Cyan badge with sparkles ("Optimal optical quality").

### B. Adaptive Optical Vector Tolerance Matching
- Store `rawVectorChecksum` (`face_optical_R_G_B_lum_L_dim_WxH`) alongside salted SHA-256 signature in both backend vault and local storage.
- Calculate Euclidean channel distance:
  $$D = \sqrt{(\Delta R)^2 + (\Delta G)^2 + (\Delta B)^2 + (\Delta Lum)^2}$$
- Compare against administrator-configured threshold.

### C. Administrator Biometric Threshold Governance
Configurable via `/api/auth/biometrics/settings` with audit logging:
- **NBE Strict (Vault Grade):** Distance $\le 36$ (~86% confidence)
- **Balanced (Standard Banking - Default):** Distance $\le 65$ (~75% confidence)
- **Tolerant (High Ambient Light / Mobile Tablets):** Distance $\le 85$ (~65% confidence)
- **Custom Admin Slider:** Range 25 - 110 units.

---

## 3. Implementation Steps & Acceptance Gates
- [x] Fix `enrollFaceBiometric` to preserve `rawVectorChecksum` in template storage.
- [x] Enhance `parseOpticalVector` in `biometricService` to handle optical tokens and dimensions.
- [x] Implement `getBiometricSettings` and `updateBiometricSettings` API in `biometricService` and `server.ts`.
- [x] Build live `ImageQualityBadge` component inside `BiometricPromptModal.tsx` for real-time video feedback.
- [x] Add Biometric Threshold Governance card in `BiometricSecurityCenter.tsx` for ADMIN role.
- [x] Build and pass automated test suite `phase17-image-quality-adaptive-matching.test.ts`.
