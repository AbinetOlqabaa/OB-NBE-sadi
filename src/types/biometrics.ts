/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * PHASE 10: Biometric Architecture and Security Foundation Types
 * National Bank of Ethiopia (NBE) BSD/03/2020 Segregation & Identity Assurance Standard.
 */

export type BiometricMethod = 'FINGERPRINT' | 'FACE';

/**
 * Authoritative user biometric lifecycle states.
 * CRITICAL: Distinct from physical device capabilities.
 */
export type BiometricLifecycleState =
  | 'NOT_ENROLLED'
  | 'ENROLLMENT_IN_PROGRESS'
  | 'ENROLLED'
  | 'SUSPENDED'
  | 'REVOKED'
  | 'RESET_REQUESTED'
  | 'RESET_IN_PROGRESS'
  | 'FAILED_LOCKED'
  | 'CAPABILITY_UNAVAILABLE';

export interface ProtectedFaceTemplate {
  vectorHash: string; // Salted HMAC-SHA256 non-invertible representation
  qualityScore: number; // 0.00 to 1.00
  livenessPassed: boolean;
  createdAt: string;
  sampleDimension?: number;
}

export interface BiometricCredentialRecord {
  id: string; // Internal record UUID
  userId: string; // Foreign key to UserAccount.id
  email: string;
  institutionCode: string; // e.g. "0000013"
  type: BiometricMethod;
  status: BiometricLifecycleState;
  credentialId: string; // WebAuthn rawId / Face credential ID
  publicKeyPem?: string; // Stored public key (never private key)
  counter: number; // Monotonically increasing signature counter for replay defense
  aaguid?: string;
  transports?: string[];
  deviceLabel: string;
  enrolledAt: string;
  lastUsedAt?: string;
  revokedAt?: string;
  revocationReason?: string;
  faceTemplate?: ProtectedFaceTemplate;
}

export interface BiometricChallenge {
  id: string;
  challenge: string; // 32-byte cryptographically secure random base64url nonce
  userId: string;
  email: string;
  purpose: 'REGISTRATION' | 'AUTHENTICATION' | 'RESET';
  type: BiometricMethod;
  rpId: string;
  origin: string;
  createdAt: string;
  expiresAt: number; // Unix timestamp in ms (60s lifetime)
  consumed: boolean;
}

export interface FaceQualityMetrics {
  luminance: number; // 0-255, recommended range: [40, 220]
  sharpness: number; // 0.0 - 1.0, recommended >= 0.45
  faceCount: number; // Exactly 1 required (0 = no face, >1 = multiple faces rejected)
  faceBoxRatio: number; // 0.15 - 0.85 of frame
  isQualityAcceptable: boolean;
  qualityScore: number; // Composite quality score 0.0 - 1.0
  reasons: string[];
}

export interface FaceLivenessResult {
  livenessVerified: boolean;
  confidence: number; // 0.0 - 1.0
  motionScore: number;
  spoofProbability: number;
  method: 'TEMPORAL_VARIANCE' | 'EYE_BLINK' | 'CHALLENGE_PROMPT' | 'CANVAS_OPTICAL_CHECK';
}

export interface FaceVerificationRequest {
  email: string;
  challengeId: string;
  featureVector: number[] | string;
  qualityMetrics?: Partial<FaceQualityMetrics>;
  livenessEvidence?: Partial<FaceLivenessResult>;
}

export interface WebAuthnRegistrationOptions {
  challenge: string;
  rp: {
    name: string;
    id: string;
  };
  user: {
    id: string;
    name: string;
    displayName: string;
  };
  pubKeyCredParams: Array<{
    type: 'public-key';
    alg: number; // -7 (ES256), -257 (RS256)
  }>;
  authenticatorSelection: {
    authenticatorAttachment?: 'platform' | 'cross-platform';
    userVerification: 'required' | 'preferred' | 'discouraged';
    requireResidentKey: boolean;
  };
  timeout: number;
  attestation: 'none' | 'indirect' | 'direct';
}

export interface WebAuthnAuthenticationOptions {
  challenge: string;
  rpId: string;
  allowCredentials: Array<{
    id: string;
    type: 'public-key';
    transports?: string[];
  }>;
  userVerification: 'required' | 'preferred' | 'discouraged';
  timeout: number;
}

export interface BiometricAuthResult {
  success: boolean;
  user?: any;
  redirectTab?: string;
  message?: string;
  sessionToken?: string;
  sessionExpiresAt?: string;
  authMethod?: BiometricMethod;
  lockedOut?: boolean;
  remainingLockoutSec?: number;
  qualityMetrics?: FaceQualityMetrics;
}

export interface BiometricResetRequest {
  email: string;
  password: string; // Mandatory step-up re-authentication
  type: BiometricMethod | 'ALL';
  reason: string;
}

export interface BiometricRateLimitState {
  email: string;
  failedAttempts: number;
  lockoutUntil: number; // Unix timestamp in ms
  lastAttemptAt: number;
}

export type BiometricAuditAction =
  | 'BIOMETRIC_CHALLENGE_ISSUED'
  | 'BIOMETRIC_ENROLLED'
  | 'BIOMETRIC_ENROLL_REJECTED'
  | 'BIOMETRIC_AUTH_SUCCESS'
  | 'BIOMETRIC_AUTH_FAILURE'
  | 'BIOMETRIC_REVOKED'
  | 'BIOMETRIC_SUSPENDED'
  | 'BIOMETRIC_RESET_REQUESTED'
  | 'BIOMETRIC_RESET_COMPLETED'
  | 'BIOMETRIC_LOCKOUT'
  | 'BIOMETRIC_MIGRATION';
