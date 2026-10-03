# PHASE 11 — Real-Time Face Detection, Liveness Verification and Optical Feature Extraction Engine

## Objective
Implement a high-performance, client-side optical face detection and feature extraction engine for Oromia Bank registration and authentication workflows, featuring dynamic detection thresholding, timeout lifecycle management, mathematical facial feature vector generation, anti-spoofing/liveness verification, modern stage-driven UI animations, and automated Single-Source-of-Truth database persistence.

## Instructions

Inspect `src/hooks/useBiometricAuth.ts`, `src/services/userService.ts`, `server.ts`, `src/components/auth/`, and canvas/video rendering pipelines.

### 1. Live Camera Stream Lifecycle & Canvas Pipeline
- **Adaptive Stream Acquisition**:
  - Request user video stream with platform-tailored constraints:
    - Mobile: `{ video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 1280 } } }`.
    - PC/Webcam: `{ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } }`.
  - Handle video element binding, autoplay policies, stream teardown (`stream.getTracks().forEach(t => t.stop())`), and background tab throttling.
- **In-Memory Optical Canvas Engine**:
  - Render live video frames to an off-screen processing canvas for frame analysis at 24-30 FPS.
  - Zero raw image transmission: all pixel processing occurs strictly in client memory. Never transmit raw video streams or uncompressed photographic images over network transport.

### 2. Multi-Stage Face Detection & Adaptive Confidence Threshold
- **Detection Algorithm & Confidence Scoring**:
  - Implement optical facial geometry and luminance gradient analysis:
    - Landmark identification (facial oval boundary, eye distance ratio, nose bridge vertical axis, mouth line symmetry).
    - Lighting and contrast validation: detect under-exposed (too dark) or over-exposed (washed out) conditions.
    - Centering and scale checks: ensure face occupies between 30% and 70% of frame area.
  - Establish a configurable confidence threshold (e.g., minimum 80% confidence score for valid detection).
- **Time-Bounded Registration Lifecycle (Timeout & Countdown)**:
  - Enforce a reasonable timeout window (e.g., 20 seconds maximum per detection attempt).
  - Display an interactive visual countdown timer and dynamic guidance messages:
    - "Hold still, detecting face..."
    - "Move slightly closer to the camera."
    - "Increase room lighting for optimal scanning."
  - If the timeout expires without satisfying the confidence threshold:
    - Stop the camera stream cleanly.
    - Provide a friendly, non-blocking failure dialog with options to "Try Again", "Switch to Mobile/PC Camera", or "Use Fingerprint / Password".

### 3. Liveness Probing & Anti-Spoofing Verification
- Implement anti-spoofing checks to prevent static 2D photograph or printed paper attacks:
  - Micro-movement detection: verify natural micro-saccades and head orientation jitter across 5 consecutive candidate frames.
  - Optical challenge prompt (optional active liveness): brief prompt asking the user to blink or gently tilt head within the detection reticle before finalizing capture.

### 4. Mathematical Facial Feature Vector Extraction & Database Persistence
- **Feature Vector Generation**:
  - Transform detected facial geometry and spatial luminance matrices into a normalized mathematical biometric vector representation (e.g., a 128-dimensional floating-point array or high-entropy hash signature `face_sig_...`).
  - Calculate template quality metrics (entropy, resolution sharpness, landmark stability).
- **Single-Source-of-Truth Database Storage**:
  - Register extracted biometric vector via `userService.registerBiometric()` and `POST /api/auth/biometrics/register`.
  - Record metadata: `credentialId`, `type: 'FACE'`, `deviceName`, `platform`, `qualityScore`, `enrolledAt`, `version: 1`.
  - Update user state: mark user with `hasFaceEnrolled: true` in authoritative SSOT.
  - Prevent duplicate or corrupted vectors from polluting user profiles.

### 5. Modern Stage-Driven UI Animations
Create sleek, enterprise-grade biometric interface animations tailored to each registration stage:
- **Stage 1 (Initializing/Permission)**: Smooth fade-in with camera sensor pulse and glowing institutional ring.
- **Stage 2 (Searching/Scanning)**: Sci-fi inspired glowing biometric reticle, vertical laser scanline sweep, and dynamic corner brackets tracking face bounds.
- **Stage 3 (Locking & Analyzing)**: Reticle snaps from amber to Oromia Gold (`#C5A059`) with circular progress bar filling as confidence threshold is reached.
- **Stage 4 (Verified & Enrolled)**: Morphing SVG checkmark with celebratory particle pulse and green confirmation badge.
- Fully accessible with `prefers-reduced-motion` compliance.

### 6. Notification Service Integration
- Dispatch contextual system notifications:
  - `FACE_DETECTED`: "Face locked (Confidence: 94%). Extracting biometric vector..."
  - `FACE_ENROLLED_SUCCESS`: "Face ID enrolled successfully. You can now use facial recognition to sign in."
  - `DETECTION_TIMEOUT`: "Face detection timed out. Please ensure good lighting and try again."
  - `FACE_ALREADY_EXISTS`: "Face ID is already enrolled on this account. Use Face ID Reset if you wish to re-enroll."

## Completion Gate
- Face detection initiates cleanly on both Mobile and PC viewports.
- Confidence scoring accurately differentiates valid faces from background noise or empty frames.
- Timeout lifecycle triggers gracefully after the prescribed duration without uncaught errors.
- Extracted mathematical feature vectors are persisted to SSOT database and user is flagged as enrolled.
- Stage-based UI animations transition seamlessly across all 4 stages.

## Activation Prompt
Read and execute `11_REAL_TIME_FACE_DETECTION_AND_FEATURE_EXTRACTION_ENGINE.md`. Inspect canvas rendering and biometric storage services. Implement real-time client-side face detection, confidence thresholding, timeout lifecycles, liveness verification, mathematical vector extraction, database persistence, and modern stage-driven UI animations. Validate with automated and manual test scenarios.
