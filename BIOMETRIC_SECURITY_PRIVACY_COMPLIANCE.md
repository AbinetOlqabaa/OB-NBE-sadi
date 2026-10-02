# Biometric Security, Privacy, and Operational Compliance Architecture
**National Bank of Ethiopia (NBE) Directive BSD/03/2020 Segregation & Identity Assurance Standard**
**Oromia Bank S.C. — Regulatory Return Reporting Platform**
**Phase 14 Security Hardening & Privacy Posture Specification**

---

## 1. Executive Summary & Regulatory Authority

Under **NBE Directive BSD/03/2020** governing Internal Controls, Segregation of Duties, and Identity Assurance in Financial Institutions, electronic submissions of regulatory returns (e.g. Daily Liquidity BSD-01, Quarterly Capital Adequacy, FX Exposure) require strict non-repudiation and multifactor authentication (MFA).

To satisfy these statutory mandates without compromising employee privacy or creating centralized repositories of vulnerable biological traits, Oromia Bank implements a **decentralized, privacy-preserving, server-authoritative biometric architecture**. 

This system pairs:
1. **FIDO2 / WebAuthn Level 2 Platform Passkeys** (hardware-backed Touch ID, Face ID, Windows Hello, and USB security keys).
2. **Server-Authoritative Optical Facial Verification** with non-invertible salted SHA-256 HMAC feature hashes and client-side temporal liveness detection.

---

## 2. Data Protection Architecture

### 2.1 Cryptographic Non-Invertibility (No Raw Biometrics)
The platform strictly complies with the **Data Minimization Principle**:
* **Zero Raw Facial Image Persistence**: Video camera frames are captured in client memory via HTML5 Canvas, analyzed ephemerally for optical quality (luminance, sharpness, bounding box, liveness), converted to a normalized mathematical vector, and immediately discarded.
* **Salted SHA-256 HMAC One-Way Signatures**: Facial vectors are passed through a cryptographic hash keyed with institution-specific salt (`computeProtectedFaceSignature`). It is mathematically impossible to reconstruct the officer's face, photograph, or physiological features from this signature.
* **Zero Raw Fingerprint Collection**: Fingerprint ridges are processed exclusively within the hardware device's Secure Enclave (Apple Silicon, Android Keystore, or PC TPM chip). The operating system and banking platform never receive or store dermal images; only asymmetric cryptographic signatures signed by the hardware private key are exchanged.
* **Asymmetric Public Key Cryptography**: WebAuthn registrations store only public keys (`SubjectPublicKeyInfo` PEM, ES256/RS256). Private keys remain permanently non-exportable within the physical device enclave.

### 2.2 Transport Security & Confidentiality
* All biometric exchange endpoints (`/api/auth/biometrics/*`) mandate **TLS 1.3 encryption** in production.
* Requests include security boundary headers: `X-Request-ID` for end-to-end tracing and `X-Biometric-TLS-Expectation: TLS_1_3_STRICT`.
* Sensitive headers and payloads are isolated from browser logs, analytics, and service proxies.

### 2.3 Audit Log Sanitization & Anti-Leakage
Persistent audit records are scrubbed by `sanitizeAuditPayload()` before storage in memory or IndexedDB:
* Passwords (`password`, `adminPassword`, `userPassword`) are replaced with `[REDACTED_SECRET]`.
* Raw base64 image strings (`data:image/...`) are replaced with `[REDACTED_IMAGE_BUFFER]`.
* Raw high-dimensional numeric arrays are replaced with `[PROTECTED_NUMERIC_VECTOR: dim=X]`.
* Authenticator counters and device identifiers are masked (`id.substring(0, 10)...`).

---

## 3. Privacy & Statutory Compliance Framework

### 3.1 Transparent Privacy Disclosure
Officers are provided with clear, accessible disclosures directly within the **Biometric Security Center** UI and during live scanning:

| Category | Policy / Implementation |
| :--- | :--- |
| **What Is Collected** | Salted HMAC-SHA256 signature (`face_sig_...`), WebAuthn public key, device friendly label, counter, enrollment timestamp. |
| **What Is Prohibited** | Raw photographs, raw video streams, raw fingerprint images, private cryptographic keys, GPS location. |
| **Processing Location** | Ephemeral feature extraction and optical quality on user device; authoritative challenge verification on secured bank server. |
| **Retention Period** | Credential metadata is preserved only while officer has active employment in reporting roles. |
| **Cryptographic Shredding** | Initiating a biometric reset or credential revocation immediately shreds the template record and marks it `REVOKED`. |
| **Regulatory Audit Retention** | Immutable, append-only audit trail preserved for 10 years per NBE Directive BSD/03/2020. |
| **Right to Erasure & Reset** | Officers may reset or revoke individual biometric credentials at any time using their master institutional password. |

### 3.2 Administrative Visibility & Segregation of Duties (4-Eyes Principle)
* **No Administrative Biometric Spoofing**: Administrators and Compliance Auditors cannot view, export, or forge an officer's facial signatures or passkeys.
* **Sanitized Supervisory Metadata**: Supervisors see only device label, enrollment timestamp, status (`ENROLLED`, `SUSPENDED`, `REVOKED`), and recent audit timestamps.
* **4-Eyes Segregation**: Administrators cannot approve their own high-risk overrides or self-reset without compliance logging.
* **Compliance Archive Export**: Authorized Auditors can generate an encrypted, checksum-verified Compliance Archive (`exportComplianceArchive`) containing sanitized device metadata and audit logs for NBE regulatory examiners.

---

## 4. Service Boundary & Operational Security

### 4.1 Boundary Architecture & Health Check
The Biometric Service runs as an authoritative domain service behind the unified API gateway:
* **Health Check Endpoint** (`GET /api/auth/biometrics/health`):
  Returns runtime operational metrics:
  - Service status (`HEALTHY`, `DEGRADED`)
  - Cryptographic engine status (`SALTED-SHA256-HMAC`, `FIDO2 Level 2`)
  - Active challenge pool size and rate-limited accounts
  - Monotonic counter validation and memory registry health
* **Correlation & Request Tracing**:
  Every biometric interaction receives a unique `X-Request-ID` propagated through server logs and regulatory audit records.
* **Service-to-Service Authorization**:
  Administrative endpoints (`/admin/reset`, `/admin/unlock`, `/retention/purge`, `/compliance/export`) strictly validate caller roles (`ADMIN`, `AUDITOR`), rejecting unauthorized cross-user calls with HTTP 403 Forbidden.

### 4.2 Graceful Degradation & Timeout Fallback
* In the event of sensor malfunction, network timeout (30-second boundary), or camera unavailability, the platform allows immediate fallback to **primary institutional password authentication**.
* A biometric failure or lockout **never locks the officer's primary password**, ensuring business continuity for time-sensitive statutory return filings.

---

## 5. Anti-Abuse, Rate Limiting & Threat Defenses

### 5.1 Progressive Delay & Anti-Brute Force Lockout
Biometric authentication requests are guarded by progressive delays to defeat automated attacks:

| Consecutive Failures | Enforcement Action | Delay / Lockout |
| :---: | :--- | :---: |
| **1 Failure** | Log audit event | 0s |
| **2 Failures** | Progressive delay enforced | 1s delay |
| **3 Failures** | Progressive delay enforced | 2s delay |
| **4 Failures** | Progressive delay enforced | 4s delay |
| **5 Failures** | **Temporary Account Biometric Lockout** | **15 minutes (900s)** |

* Requests received during an active progressive delay window trigger a `BIOMETRIC_SUSPICIOUS_ATTEMPT` audit alert.
* Officers locked out by excessive failures can immediately unlock via **authenticated password step-up verification** or contact a Compliance Administrator for emergency unlock.

### 5.2 Cryptographic Replay Defense
1. **Fresh Cryptographic Nonces**: Challenges are cryptographically random 32-byte nonces with a strict **60-second Time-To-Live (TTL)**.
2. **Single-Use Atomicity**: Challenges and reset tokens are marked `consumed: true` and deleted immediately upon first presentation; reuse is rejected as a security violation.
3. **Monotonic Signature Counters**: WebAuthn assertions enforce strictly increasing counters (`counter > enrolled.counter`). Replayed assertions or cloned authenticators with counter rollbacks are instantly rejected.

### 5.3 Strict Template Matching (Elimination of Insecure Wildcards)
* Facial template comparisons enforce **strict cryptographic equality** (`sampleHash === enrolled.vectorHash || sampleStr === enrolled.vectorHash`).
* Prefix wildcard matching (`face_sig_*`) is strictly prohibited, closing vulnerabilities where arbitrary signatures could authenticate.

### 5.4 Account Enumeration & Reconnaissance Defense
* Endpoints for authentication options (`/webauthn/auth-options`) return a **uniform error message** for non-existent users and users without biometrics:
  `"Biometric passkey authentication is not configured or available for this account."`
* Reconnaissance queries on `/security-center/:email` and `/lifecycle/:email` require matching identity or supervisory authority (`ADMIN`/`AUDITOR`), returning HTTP 403 Forbidden on unauthorized cross-account lookups.

---

## 6. Documented Technical & Operational Limitations

To maintain operational integrity, engineering officers and compliance auditors must be aware of the following concrete technical boundaries:

### 6.1 Optical Environment & Ambient Illumination
* **Luminance Thresholds**: The facial optical engine requires ambient lighting between **35 and 235 luminance units** (on a 0–255 scale). Deep shadows (< 35) or direct sunlight/glare (> 235) cause optical quality rejections.
* **Sharpness / Motion Blur**: Frames with Laplacian gradient sharpness below **0.35** are rejected to prevent blurry captures from degrading matching accuracy.
* **Framing & Proximity**: The user's face must occupy between **12% and 90%** of the frame dimensions.

### 6.2 Liveness Verification vs. 3D Hardware Depth Sensors
* **Software-Based Optical Liveness**: The web application evaluates 2D temporal variance, motion score (>= 0.10), and optical micro-fluctuations. While effective against basic static photo presentations and screen replays, it does not possess hardware infrared depth sensing (such as dedicated Apple TrueDepth or Intel RealSense cameras).
* **High-Security Recommendation**: For high-risk statutory return approvals (e.g. BSD-01 Daily Liquidity exceeding ETB 100M), officers should pair optical verification with hardware-backed platform passkeys (Touch ID / TPM).

### 6.3 Hardware-Bound Passkey Portability
* **Platform Authenticator Isolation**: Passkeys registered via Apple Touch ID or Windows Hello are bound to the specific physical motherboard/workstation. Logging in from a different terminal requires enrolling that device as a secondary passkey or utilizing the primary institutional password.
* **Multi-Device Support**: Officers are encouraged to enroll at least two authenticators (e.g., primary bank laptop Touch ID + backup FIDO2 hardware security key).

### 6.4 Single Active Facial Profile per Account
* To prevent identity confusion, each officer account supports exactly **one active facial recognition template**. Enrolling a new face profile revokes the prior template and records an audit log.

### 6.5 Recovery Dependencies
* Biometric resets mandate step-up authentication using the officer's **primary institutional password**. If an officer loses both their physical biometric authenticator and their institutional password, recovery requires administrative 4-eyes identity verification by the Compliance Administrator.

---

## 7. Verification & Compliance Sign-Off

The hardened biometric service satisfies all criteria established under:
* **NBE Directive BSD/03/2020** (Segregation of Duties, Authenticity & Non-Repudiation)
* **FIDO2 / W3C Web Authentication Level 2** Security Architecture
* **ISO/IEC 27701 & 29159** Biometric Privacy & Data Protection Standard
