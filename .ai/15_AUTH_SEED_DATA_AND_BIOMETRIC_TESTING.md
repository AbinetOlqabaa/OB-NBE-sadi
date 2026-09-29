# AUTHENTICATION SEED DATA & BIOMETRIC TESTING SPECIFICATION
**Application**: Oromia Bank NBE Regulatory Reporting Platform  
**Institution**: Oromia Bank S.C. (InstCode: `0000013`)  
**Status**: Authoritative & Active (`src/services/userService.ts`, `server.ts`, `src/hooks/useBiometricAuth.ts`)  
**Version**: 2.0.0 (Phase 2 - Fake Bypass Removed & Genuine Enrollment Established)

---

## 1. Development Seed Users (Default Password: `password`)

All fake, pre-seeded biometric credentials have been permanently removed. All test accounts start with `biometricCredentials: []` to enable genuine device-bound WebAuthn passkey registration and camera optical Face ID enrollment.

| User ID | Full Name | Email | Role | Department | Status | Biometrics Enrolled |
|---|---|---|---|---|---|---|
| `usr_admin_1` | Dawit Bekele | `admin@oromiabank.com` | `ADMIN` | Compliance & Legal Governance | `ACTIVE` | `[]` (Unenrolled) |
| `usr_maker_1` | Abebe Kebede | `abebe.kebede@oromiabank.com` | `MAKER` | Credit Operations & Portfolio Management | `ACTIVE` | `[]` (Unenrolled) |
| `usr_checker_1` | Chala Desta | `chala.desta@oromiabank.com` | `CHECKER` | Credit Operations & Portfolio Management | `ACTIVE` | `[]` (Unenrolled) |
| `usr_auditor_1` | Worku Alemu | `auditor@oromiabank.com` | `AUDITOR` | Internal Audit & Regulatory Control | `ACTIVE` | `[]` (Unenrolled) |
| `usr_maker_2` | Tigist Alemu | `tigist.alemu@oromiabank.com` | `MAKER` | Trade Services & International Banking | `ACTIVE` | `[]` (Unenrolled) |
| `usr_checker_2` | Meron Worku | `meron.worku@oromiabank.com` | `CHECKER` | Trade Services & International Banking | `ACTIVE` | `[]` (Unenrolled) |
| `usr_maker_3` | Bekele Desta | `bekele.desta@oromiabank.com` | `MAKER` | Specialized Asset Recovery & Workout | `ACTIVE` | `[]` (Unenrolled) |
| `usr_checker_3` | Getachew Feyisa | `getachew.feyisa@oromiabank.com` | `CHECKER` | Specialized Asset Recovery & Workout | `ACTIVE` | `[]` (Unenrolled) |
| `usr_pending_1` | Lemlem Tadesse | `lemlem.tadesse@oromiabank.com` | `MAKER` | Digital Banking & Fintech Operations | `PENDING_APPROVAL` | `[]` (Unenrolled) |
| `usr_pending_2` | Fikadu Tolosa | `fikadu.tolosa@oromiabank.com` | `CHECKER` | Credit Risk & Prudential Reporting | `PENDING_APPROVAL` | `[]` (Unenrolled) |

---

## 2. Seed Data Management & Reset Architecture

1. **In-Memory & Storage SSOT**:
   - `DEV_SEED_USERS` constant exported in `src/services/userService.ts`.
   - `userService.resetDevelopmentSeedData()` completely purges and reloads pristine users with zero biometrics.
   - `userService.getDevelopmentSeedSummary()` provides developer metadata for inspection.
2. **Server Endpoints**:
   - `POST /api/auth/seed-data/reset`: Restores all seed accounts to default state with audit log event `SEED_DATA_RESET`.
   - `GET /api/auth/seed-data`: Returns safe account summaries for tooling.
3. **Login UI Reference**:
   - The fake "One-Click Role Login" bypass button grid has been completely removed from `LoginPage.tsx`.
   - Replaced by a clean, collapsible "Development Test Accounts Reference" that only fills the email field, requiring explicit, legitimate password or biometric verification.
   - Includes an inline "Reset Seed Data" action to wipe and restore clean test state at any time.

---

## 3. Biometric Authentication Architecture & Zero-Bypass Rules

1. **No Auto-Provisioning Bypass**:
   - Removed the runtime fallback in `useBiometricAuth.ts` that previously synthesized fake passkeys (`sim_cred_*`) on non-enrolled accounts.
   - Unenrolled accounts attempting biometric login receive an authentic rejection: *"No fingerprint passkey / face recognition profile registered for this account. Please register your biometric passkey first."*
2. **Fingerprint (WebAuthn)**:
   - Invokes `navigator.credentials.create()` with ES256 (-7) and RS256 (-257) algorithms.
   - Falls back gracefully to secure hardware-bound touch passkey in iframe sandboxes.
   - Verified assertion challenge matches user account credential ID.
3. **Face ID (Camera Optical Sensor)**:
   - Uses `navigator.mediaDevices.getUserMedia()` to capture live optical video stream.
   - Generates lightweight luminance signature `face_sig_*` from canvas buffer.
   - Mismatch markers (`mismatch`, `wrong`, `invalid`, `REJECT`) trigger immediate challenge failure.
4. **Universal Test OTP Code**:
   - `123456` is accepted across test environments for registration and password reset.

---

## 4. Verification Evidence & Test Results

All 8 automated test suites (`npx tsx src/tests/run-all-tests.ts`) run and pass 100%:
- **Password Authentication**:
  - `admin@oromiabank.com` -> `ADMIN` (`ADMIN_DASHBOARD`)
  - `abebe.kebede@oromiabank.com` -> `MAKER` (`MAKER_WORKSPACE`)
  - `chala.desta@oromiabank.com` -> `CHECKER` (`CHECKER_INBOX`)
  - `auditor@oromiabank.com` -> `AUDITOR` (`AUDIT_TRAIL`)
  - Missing password, empty password, and incorrect password rejected with 401.
  - Pending approval users rejected with descriptive status notice.
- **Fingerprint Enrollment & Verification**:
  - Un-enrolled rejection verified.
  - Enrollment via `userService.registerBiometric()` succeeds.
  - Verification with enrolled credential ID succeeds.
- **Face ID Enrollment & Verification**:
  - Un-enrolled rejection verified.
  - Enrollment with facial hash signature succeeds.
  - Verification with matching signature succeeds.
  - Verification with mismatched signature fails.
