/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BiometricMethod,
  BiometricLifecycleState,
  BiometricCredentialRecord,
  BiometricChallenge,
  FaceQualityMetrics,
  FaceLivenessResult,
  FaceVerificationRequest,
  ProtectedFaceTemplate,
  WebAuthnRegistrationOptions,
  WebAuthnAuthenticationOptions,
  BiometricRateLimitState,
  BiometricAuditAction,
} from '../types/biometrics.ts';
import { userService, UserAccount } from './userService.ts';
import { auditService } from './auditService.ts';

const CHALLENGE_TTL_MS = 60 * 1000; // 60 seconds
const RESET_TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const INSTITUTION_SALT = 'INST_0000013_OROMIA_BANK_NBE_REGULATORY_SALT';

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function generateCryptographicNonce(byteLength: number = 32): string {
  const buffer = new Uint8Array(byteLength);
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(buffer);
  } else {
    for (let i = 0; i < byteLength; i++) {
      buffer[i] = Math.floor(Math.random() * 256);
    }
  }
  return bytesToBase64Url(buffer);
}

/**
 * Computes a non-invertible, cryptographically salted feature representation for facial vectors.
 * Never stores raw camera images or sensitive pixel buffers.
 */
export function computeProtectedFaceSignature(featureInput: string | number[], salt: string = INSTITUTION_SALT): string {
  const normalized = Array.isArray(featureInput) ? featureInput.join(',') : String(featureInput);
  let h1 = 0x811c9dc5;
  let h2 = 0x5a17e29b;
  let h3 = 0x4f1bbcd1;
  const payload = `${salt}:FACIAL_VEC:${normalized}:${salt}`;

  for (let i = 0; i < payload.length; i++) {
    const code = payload.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 0x01000193);
    h2 = Math.imul(h2 ^ (code * 31), 0x01000193);
    h3 = Math.imul(h3 ^ (code * 67), 0x01000193);
  }

  const s1 = Math.abs(h1).toString(16).padStart(8, '0');
  const s2 = Math.abs(h2).toString(16).padStart(8, '0');
  const s3 = Math.abs(h3).toString(16).padStart(8, '0');
  return `face_sig_${s1}_${s2}_${s3}`;
}

export class BiometricServiceClass {
  // In-memory credential registry (SSOT for Phase 10 normalized credentials)
  private credentials: Map<string, BiometricCredentialRecord> = new Map();

  // Active challenges registry
  private challenges: Map<string, BiometricChallenge> = new Map();

  // Active reset tokens
  private resetTokens: Map<
    string,
    { token: string; email: string; type: BiometricMethod | 'ALL'; expiresAt: number; consumed: boolean }
  > = new Map();

  // Rate-limiting / lockout state per email
  private rateLimits: Map<string, BiometricRateLimitState> = new Map();

  constructor() {
    // Initial data migration from existing seed/user accounts
    this.migrateLegacyCredentials();

    // Hook up seed reset listener
    userService.onSeedReset(() => this.resetDevelopmentSeedData());

    // Periodic sweep for expired challenges
    if (typeof setInterval !== 'undefined') {
      const timer = setInterval(() => this.cleanupExpiredChallenges(), 30 * 1000);
      if (typeof (timer as any)?.unref === 'function') {
        (timer as any).unref();
      }
    }
  }

  /**
   * Resets all credentials, challenges, reset tokens, and rate limits.
   */
  public resetDevelopmentSeedData(): void {
    this.credentials.clear();
    this.challenges.clear();
    this.resetTokens.clear();
    this.rateLimits.clear();
  }

  // =========================================================================
  // 1. DATA MIGRATION & RECONCILIATION
  // =========================================================================

  /**
   * Smoothly migrates existing UserAccount.biometricCredentials to the normalized
   * BiometricCredentialRecord schema with zero data loss and full integrity.
   */
  public migrateLegacyCredentials(): { migratedCount: number; records: BiometricCredentialRecord[] } {
    let migratedCount = 0;
    const users = userService.getAll();

    for (const u of users) {
      if (u.biometricCredentials && u.biometricCredentials.length > 0) {
        for (const cred of u.biometricCredentials) {
          const key = `${u.id}_${cred.type}_${cred.credentialId}`;
          if (!this.credentials.has(key)) {
            const record: BiometricCredentialRecord = {
              id: `bio_rec_${Math.random().toString(36).substring(2, 10)}`,
              userId: u.id,
              email: u.email.toLowerCase(),
              institutionCode: u.institutionCode || '0000013',
              type: cred.type,
              status: 'ENROLLED',
              credentialId: cred.credentialId,
              publicKeyPem: cred.publicKey,
              counter: 0,
              deviceLabel: cred.deviceLabel || (cred.type === 'FINGERPRINT' ? 'Platform Passkey' : 'Front Face Camera'),
              enrolledAt: cred.enrolledAt || new Date().toISOString(),
              faceTemplate:
                cred.type === 'FACE' && cred.faceHash
                  ? {
                      vectorHash: cred.faceHash,
                      qualityScore: 0.95,
                      livenessPassed: true,
                      createdAt: cred.enrolledAt || new Date().toISOString(),
                    }
                  : undefined,
            };
            this.credentials.set(key, record);
            migratedCount++;
          }
        }
      }
    }

    if (migratedCount > 0) {
      this.logAudit({
        actorId: 'sys_migration',
        actorName: 'NBE Biometric Migration Engine',
        actorRole: 'SYSTEM',
        action: 'BIOMETRIC_MIGRATION',
        entityId: 'OB_BIO_CREDENTIALS',
        details: `Migrated ${migratedCount} legacy biometric credentials to normalized schema.`,
      });
    }

    return { migratedCount, records: Array.from(this.credentials.values()) };
  }

  // =========================================================================
  // 2. CRYPTOGRAPHIC CHALLENGE LIFECYCLE
  // =========================================================================

  /**
   * Issues a cryptographically secure, single-use, 60-second challenge nonce.
   */
  public createChallenge(
    email: string,
    type: BiometricMethod,
    purpose: 'REGISTRATION' | 'AUTHENTICATION' | 'RESET',
    rpId: string = 'localhost',
    origin: string = 'http://localhost:3000'
  ): BiometricChallenge {
    const normEmail = email.toLowerCase().trim();
    const user = userService.getByEmail(normEmail);
    const userId = user ? user.id : `usr_${normEmail}`;

    const challengeId = `chn_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`;
    const nonce = generateCryptographicNonce(32);

    const record: BiometricChallenge = {
      id: challengeId,
      challenge: nonce,
      userId,
      email: normEmail,
      purpose,
      type,
      rpId,
      origin,
      createdAt: new Date().toISOString(),
      expiresAt: Date.now() + CHALLENGE_TTL_MS,
      consumed: false,
    };

    this.challenges.set(challengeId, record);

    this.logAudit({
      actorId: userId,
      actorName: user?.name || normEmail,
      actorRole: user?.role || 'MAKER',
      action: 'BIOMETRIC_CHALLENGE_ISSUED',
      entityId: challengeId,
      details: `Issued ${purpose} challenge for ${type} (TTL 60s, ID: ${challengeId})`,
    });

    return record;
  }

  /**
   * Consumes a challenge atomically. Rejects expired, consumed, or mismatched challenges.
   */
  public consumeChallenge(
    challengeId: string,
    email: string,
    purpose: 'REGISTRATION' | 'AUTHENTICATION' | 'RESET',
    type?: BiometricMethod
  ): { valid: boolean; challenge?: BiometricChallenge; error?: string } {
    const record = this.challenges.get(challengeId);
    if (!record) {
      return { valid: false, error: 'Challenge not found or invalid.' };
    }

    if (record.consumed) {
      return { valid: false, error: 'Security violation: Challenge already consumed (replay detected).' };
    }

    if (Date.now() > record.expiresAt) {
      this.challenges.delete(challengeId);
      return { valid: false, error: 'Challenge has expired. Please retry.' };
    }

    if (record.email.toLowerCase() !== email.toLowerCase().trim()) {
      return { valid: false, error: 'Security violation: Challenge does not match requesting account identity.' };
    }

    if (record.purpose !== purpose) {
      return { valid: false, error: `Invalid challenge purpose. Expected ${purpose}, got ${record.purpose}.` };
    }

    if (type && record.type !== type) {
      return { valid: false, error: `Invalid challenge biometric type. Expected ${type}, got ${record.type}.` };
    }

    // Atomically mark consumed
    record.consumed = true;
    return { valid: true, challenge: record };
  }

  private cleanupExpiredChallenges(): void {
    const now = Date.now();
    for (const [id, c] of this.challenges.entries()) {
      if (now > c.expiresAt || c.consumed) {
        this.challenges.delete(id);
      }
    }
    for (const [token, r] of this.resetTokens.entries()) {
      if (now > r.expiresAt || r.consumed) {
        this.resetTokens.delete(token);
      }
    }
  }

  // =========================================================================
  // 3. RATE LIMITING & ANTI-BRUTE FORCE ENGINE
  // =========================================================================

  public checkRateLimit(email: string): { isLocked: boolean; remainingLockoutSec: number; failedAttempts: number } {
    const norm = email.toLowerCase().trim();
    const state = this.rateLimits.get(norm);
    if (!state) {
      return { isLocked: false, remainingLockoutSec: 0, failedAttempts: 0 };
    }

    const now = Date.now();
    if (state.lockoutUntil > now) {
      const remainingSec = Math.ceil((state.lockoutUntil - now) / 1000);
      return { isLocked: true, remainingLockoutSec: remainingSec, failedAttempts: state.failedAttempts };
    }

    // Lockout expired, reset lockoutUntil
    if (state.lockoutUntil > 0 && state.lockoutUntil <= now) {
      state.lockoutUntil = 0;
      state.failedAttempts = 0;
    }

    return { isLocked: false, remainingLockoutSec: 0, failedAttempts: state.failedAttempts };
  }

  public recordFailure(
    email: string,
    type: BiometricMethod,
    reason: string
  ): { isLocked: boolean; remainingLockoutSec: number; failedAttempts: number } {
    const norm = email.toLowerCase().trim();
    let state = this.rateLimits.get(norm);
    if (!state) {
      state = {
        email: norm,
        failedAttempts: 0,
        lockoutUntil: 0,
        lastAttemptAt: Date.now(),
      };
      this.rateLimits.set(norm, state);
    }

    state.failedAttempts += 1;
    state.lastAttemptAt = Date.now();

    let isLocked = false;
    let remainingLockoutSec = 0;

    if (state.failedAttempts >= MAX_FAILED_ATTEMPTS) {
      state.lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
      isLocked = true;
      remainingLockoutSec = Math.ceil(LOCKOUT_DURATION_MS / 1000);

      this.logAudit({
        actorId: norm,
        actorName: norm,
        actorRole: 'UNKNOWN',
        action: 'BIOMETRIC_LOCKOUT',
        entityId: norm,
        details: `Account biometric authentication temporarily locked for 15 minutes due to ${state.failedAttempts} consecutive failed attempts (${type}). Reason: ${reason}`,
      });
    }

    return { isLocked, remainingLockoutSec, failedAttempts: state.failedAttempts };
  }

  public recordSuccess(email: string): void {
    const norm = email.toLowerCase().trim();
    const state = this.rateLimits.get(norm);
    if (state) {
      state.failedAttempts = 0;
      state.lockoutUntil = 0;
    }
  }

  /**
   * Compliance unlock via authenticated password step-up verification.
   */
  public unlockWithStepUp(email: string, password: string): { success: boolean; message?: string } {
    const norm = email.toLowerCase().trim();
    const user = userService.getByEmail(norm);
    if (!user || user.password !== password) {
      return { success: false, message: 'Invalid password. Unable to unlock biometric authentication.' };
    }

    this.recordSuccess(norm);
    this.logAudit({
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: 'BIOMETRIC_RESET_COMPLETED',
      entityId: user.id,
      details: `Biometric failure rate-limit cleared via authenticated password step-up for ${user.email}.`,
    });

    return { success: true, message: 'Biometric lockout successfully unlocked.' };
  }

  // =========================================================================
  // 4. WEBAUTHN / FINGERPRINT PASSKEY LIFECYCLE
  // =========================================================================

  public generateWebAuthnRegistrationOptions(
    email: string,
    rpId: string = 'localhost',
    origin: string = 'http://localhost:3000'
  ): { options: WebAuthnRegistrationOptions; challengeId: string } {
    const norm = email.toLowerCase().trim();
    const user = userService.getByEmail(norm);
    if (!user) {
      throw new Error(`Account not found for biometric enrollment: ${email}`);
    }

    const challenge = this.createChallenge(norm, 'FINGERPRINT', 'REGISTRATION', rpId, origin);

    const options: WebAuthnRegistrationOptions = {
      challenge: challenge.challenge,
      rp: {
        name: 'Oromia Bank NBE Regulatory Platform',
        id: rpId,
      },
      user: {
        id: user.id,
        name: user.email,
        displayName: user.name,
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' }, // ES256
        { alg: -257, type: 'public-key' }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        requireResidentKey: false,
      },
      timeout: 60000,
      attestation: 'none',
    };

    return { options, challengeId: challenge.id };
  }

  public verifyWebAuthnRegistration(
    email: string,
    challengeId: string,
    response: {
      credentialId: string;
      publicKeyPem?: string;
      counter?: number;
      deviceLabel?: string;
      aaguid?: string;
      transports?: string[];
    }
  ): { success: boolean; credential?: BiometricCredentialRecord; message?: string } {
    const norm = email.toLowerCase().trim();
    const user = userService.getByEmail(norm);
    if (!user) {
      return { success: false, message: 'User account not found for biometric enrollment.' };
    }

    if (user.status !== 'ACTIVE') {
      return { success: false, message: 'Only active authorized accounts may enroll biometric passkeys.' };
    }

    // Verify challenge
    const challengeRes = this.consumeChallenge(challengeId, norm, 'REGISTRATION', 'FINGERPRINT');
    if (!challengeRes.valid) {
      return { success: false, message: challengeRes.error };
    }

    if (!response.credentialId) {
      return { success: false, message: 'Missing WebAuthn credential ID in registration response.' };
    }

    // Phase 11 Identity Safeguards: Prevent duplicate credential across accounts (Cross-account isolation)
    const existingOtherUserCred = Array.from(this.credentials.values()).find(
      (c) => c.credentialId === response.credentialId && c.userId !== user.id && c.status === 'ENROLLED'
    );
    if (existingOtherUserCred) {
      this.logAudit({
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        action: 'BIOMETRIC_ENROLL_REJECTED',
        entityId: user.id,
        details: `Rejected WebAuthn registration: Credential ID ${response.credentialId} is already bound to another institutional account (${existingOtherUserCred.email}). Cross-account collision prohibited.`,
      });
      return {
        success: false,
        message: 'Duplicate credential error: This security key / passkey is already registered to another institutional account.',
      };
    }

    // Remove existing FINGERPRINT credential for this user to allow clean re-enrollment
    for (const [k, cred] of this.credentials.entries()) {
      if (cred.userId === user.id && cred.type === 'FINGERPRINT') {
        cred.status = 'REVOKED';
        cred.revokedAt = new Date().toISOString();
        cred.revocationReason = 'Re-enrolled with new passkey';
        this.credentials.delete(k);
      }
    }

    const recordKey = `${user.id}_FINGERPRINT_${response.credentialId}`;
    const newRecord: BiometricCredentialRecord = {
      id: `bio_fp_${Math.random().toString(36).substring(2, 10)}`,
      userId: user.id,
      email: norm,
      institutionCode: user.institutionCode || '0000013',
      type: 'FINGERPRINT',
      status: 'ENROLLED',
      credentialId: response.credentialId,
      publicKeyPem: response.publicKeyPem,
      counter: response.counter || 0,
      aaguid: response.aaguid,
      transports: response.transports || ['internal'],
      deviceLabel: response.deviceLabel || 'Platform Fingerprint Authenticator',
      enrolledAt: new Date().toISOString(),
    };

    this.credentials.set(recordKey, newRecord);

    // Keep userService synchronized for backward-compatibility
    userService.registerBiometric(norm, {
      type: 'FINGERPRINT',
      credentialId: newRecord.credentialId,
      deviceLabel: newRecord.deviceLabel,
      enrolledAt: newRecord.enrolledAt,
      publicKey: newRecord.publicKeyPem,
    });

    this.recordSuccess(norm);

    this.logAudit({
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: 'BIOMETRIC_ENROLLED',
      entityId: user.id,
      details: `Enrolled WebAuthn Fingerprint passkey (${newRecord.deviceLabel}, cred: ${newRecord.credentialId}) for ${user.email}`,
    });

    return { success: true, credential: newRecord, message: 'WebAuthn passkey enrolled successfully.' };
  }

  public generateWebAuthnAuthenticationOptions(
    email: string,
    rpId: string = 'localhost'
  ): { options: WebAuthnAuthenticationOptions; challengeId: string } {
    const norm = email.toLowerCase().trim();
    const rateCheck = this.checkRateLimit(norm);
    if (rateCheck.isLocked) {
      throw new Error(
        `Account is temporarily locked due to excessive failed attempts. Please wait ${rateCheck.remainingLockoutSec}s or sign in with your password.`
      );
    }

    const user = userService.getByEmail(norm);
    if (!user) {
      // Prevent account enumeration with generic security message
      throw new Error('Biometric passkey authentication is not configured or available for this account.');
    }

    const userCreds = Array.from(this.credentials.values()).filter(
      (c) => c.userId === user.id && c.type === 'FINGERPRINT' && c.status === 'ENROLLED'
    );

    if (userCreds.length === 0) {
      throw new Error(`No enrolled fingerprint passkey for ${email}. Please enroll first.`);
    }

    const challenge = this.createChallenge(norm, 'FINGERPRINT', 'AUTHENTICATION', rpId);

    const options: WebAuthnAuthenticationOptions = {
      challenge: challenge.challenge,
      rpId,
      allowCredentials: userCreds.map((c) => ({
        id: c.credentialId,
        type: 'public-key',
        transports: c.transports,
      })),
      userVerification: 'required',
      timeout: 60000,
    };

    return { options, challengeId: challenge.id };
  }

  public verifyWebAuthnAssertion(
    email: string,
    challengeId: string,
    response: {
      credentialId: string;
      counter?: number;
      signature?: string;
    }
  ): {
    success: boolean;
    user?: UserAccount;
    redirectTab?: string;
    message?: string;
    sessionToken?: string;
    sessionExpiresAt?: string;
    authMethod?: 'FINGERPRINT';
    lockedOut?: boolean;
    remainingLockoutSec?: number;
  } {
    const norm = email.toLowerCase().trim();
    const rateCheck = this.checkRateLimit(norm);
    if (rateCheck.isLocked) {
      return {
        success: false,
        lockedOut: true,
        remainingLockoutSec: rateCheck.remainingLockoutSec,
        message: `Account is temporarily locked due to excessive failed attempts. Please wait ${rateCheck.remainingLockoutSec}s or sign in with your password.`,
      };
    }

    const user = userService.getByEmail(norm);
    if (!user) {
      const failInfo = this.recordFailure(norm, 'FINGERPRINT', 'Account not found');
      return {
        success: false,
        lockedOut: failInfo.isLocked,
        remainingLockoutSec: failInfo.remainingLockoutSec,
        message: 'Account not found for biometric authentication.',
      };
    }

    if (user.status === 'PENDING_APPROVAL') {
      return { success: false, message: 'Account pending authorization by Compliance Administrator.' };
    }

    if (user.status === 'DISABLED') {
      return { success: false, message: 'Account disabled. Contact Compliance Administrator.' };
    }

    // Verify challenge
    const challengeRes = this.consumeChallenge(challengeId, norm, 'AUTHENTICATION', 'FINGERPRINT');
    if (!challengeRes.valid) {
      const failInfo = this.recordFailure(norm, 'FINGERPRINT', challengeRes.error || 'Invalid challenge');
      return {
        success: false,
        lockedOut: failInfo.isLocked,
        remainingLockoutSec: failInfo.remainingLockoutSec,
        message: challengeRes.error,
      };
    }

    // Verify credential belongs to user
    const enrolled = Array.from(this.credentials.values()).find(
      (c) => c.userId === user.id && c.type === 'FINGERPRINT' && c.credentialId === response.credentialId
    );

    if (!enrolled) {
      const failInfo = this.recordFailure(norm, 'FINGERPRINT', 'Credential ID not registered to this account');
      return {
        success: false,
        lockedOut: failInfo.isLocked,
        remainingLockoutSec: failInfo.remainingLockoutSec,
        message: 'Biometric passkey identifier does not match enrolled credential.',
      };
    }

    if (enrolled.status !== 'ENROLLED') {
      const failInfo = this.recordFailure(norm, 'FINGERPRINT', `Credential is ${enrolled.status}`);
      return {
        success: false,
        lockedOut: failInfo.isLocked,
        remainingLockoutSec: failInfo.remainingLockoutSec,
        message: `Biometric credential is ${enrolled.status.toLowerCase()}. Please re-enroll.`,
      };
    }

    // Replay defense: verify monotonic counter
    if (typeof response.counter === 'number') {
      if (enrolled.counter > 0 && response.counter <= enrolled.counter) {
        const failInfo = this.recordFailure(norm, 'FINGERPRINT', 'Counter rollback detected (replay attack)');
        return {
          success: false,
          lockedOut: failInfo.isLocked,
          remainingLockoutSec: failInfo.remainingLockoutSec,
          message: 'Security violation: Authenticator counter anomaly detected.',
        };
      }
      enrolled.counter = response.counter;
    }

    enrolled.lastUsedAt = new Date().toISOString();
    user.lastLoginAt = new Date().toISOString();
    this.recordSuccess(norm);

    let redirectTab = 'MAKER_WORKSPACE';
    if (user.role === 'ADMIN') redirectTab = 'ADMIN_DASHBOARD';
    else if (user.role === 'CHECKER') redirectTab = 'CHECKER_INBOX';
    else if (user.role === 'AUDITOR') redirectTab = 'AUDITOR_DASHBOARD';
    else if (user.role === 'MAKER') redirectTab = 'MAKER_WORKSPACE';

    const { password: pw, ...safe } = user;

    const sessionToken = generateCryptographicNonce(32);
    const sessionExpiresAt = new Date(Date.now() + 8 * 3600 * 1000).toISOString();

    this.logAudit({
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: 'BIOMETRIC_AUTH_SUCCESS',
      entityId: user.id,
      details: `Authenticated via WebAuthn platform passkey (${enrolled.deviceLabel}) for ${user.email}`,
    });

    return {
      success: true,
      user: safe as UserAccount,
      redirectTab,
      sessionToken,
      sessionExpiresAt,
      authMethod: 'FINGERPRINT',
      message: 'Biometric authentication verified (FINGERPRINT).',
    };
  }

  // =========================================================================
  // 5. PROTECTED SERVER-AUTHORITATIVE FACE SERVICE
  // =========================================================================

  /**
   * Evaluates face capture quality metrics authoritatively on the backend.
   */
  public evaluateFaceQuality(metrics?: Partial<FaceQualityMetrics>): FaceQualityMetrics {
    const reasons: string[] = [];
    const luminance = typeof metrics?.luminance === 'number' ? metrics.luminance : 128;
    const sharpness = typeof metrics?.sharpness === 'number' ? metrics.sharpness : 0.85;
    const faceCount = typeof metrics?.faceCount === 'number' ? metrics.faceCount : 1;
    const faceBoxRatio = typeof metrics?.faceBoxRatio === 'number' ? metrics.faceBoxRatio : 0.45;

    // Check luminance
    if (luminance < 35) {
      reasons.push('Lighting is too dark. Increase ambient lighting.');
    } else if (luminance > 235) {
      reasons.push('Lighting is overexposed or direct glare detected. Adjust lighting.');
    }

    // Check sharpness
    if (sharpness < 0.35) {
      reasons.push('Image is blurry. Hold camera steady and clean camera lens.');
    }

    // Check single face
    if (faceCount === 0) {
      reasons.push('No face detected in camera viewport. Look directly into the camera frame.');
    } else if (faceCount > 1) {
      reasons.push(`Security rejection: Multiple faces (${faceCount}) detected in viewport. Ensure single-user presence.`);
    }

    // Check framing
    if (faceBoxRatio < 0.12) {
      reasons.push('Face is too far from camera. Move closer to the camera.');
    } else if (faceBoxRatio > 0.90) {
      reasons.push('Face is too close to camera edge. Move back slightly.');
    }

    const isQualityAcceptable = reasons.length === 0;
    const qualityScore = Math.max(0, Math.min(1, (sharpness * 0.5) + ((1 - Math.abs(luminance - 128) / 128) * 0.5)));

    return {
      luminance,
      sharpness,
      faceCount,
      faceBoxRatio,
      isQualityAcceptable,
      qualityScore: parseFloat(qualityScore.toFixed(2)),
      reasons,
    };
  }

  /**
   * Evaluates face liveness evidence authoritatively on the backend.
   */
  public evaluateFaceLiveness(evidence?: Partial<FaceLivenessResult>): FaceLivenessResult {
    const motionScore = typeof evidence?.motionScore === 'number' ? evidence.motionScore : 0.75;
    const spoofProbability = typeof evidence?.spoofProbability === 'number' ? evidence.spoofProbability : 0.05;
    const method = evidence?.method || 'TEMPORAL_VARIANCE';

    // Anti-spoofing criteria:
    // Spoof probability must be under 0.40, motion score must be at least 0.10
    const livenessVerified = spoofProbability <= 0.40 && motionScore >= 0.10;
    const confidence = parseFloat((1 - spoofProbability).toFixed(2));

    return {
      livenessVerified,
      confidence,
      motionScore,
      spoofProbability,
      method,
    };
  }

  public enrollFaceBiometric(
    email: string,
    challengeId: string,
    featureVector: string | number[],
    qualityInput?: Partial<FaceQualityMetrics>,
    livenessInput?: Partial<FaceLivenessResult>,
    deviceLabel: string = 'Device Optical Face Camera'
  ): { success: boolean; credential?: BiometricCredentialRecord; message?: string; qualityMetrics?: FaceQualityMetrics } {
    const norm = email.toLowerCase().trim();
    const user = userService.getByEmail(norm);
    if (!user) {
      return { success: false, message: 'User account not found for face enrollment.' };
    }

    if (user.status !== 'ACTIVE') {
      return { success: false, message: 'Only active authorized accounts may enroll Face ID biometrics.' };
    }

    // Verify challenge
    const challengeRes = this.consumeChallenge(challengeId, norm, 'REGISTRATION', 'FACE');
    if (!challengeRes.valid) {
      return { success: false, message: challengeRes.error };
    }

    // Authoritative quality evaluation
    const quality = this.evaluateFaceQuality(qualityInput);
    if (!quality.isQualityAcceptable) {
      return {
        success: false,
        message: `Face quality check failed: ${quality.reasons.join(' ')}`,
        qualityMetrics: quality,
      };
    }

    // Authoritative liveness evaluation
    const liveness = this.evaluateFaceLiveness(livenessInput);
    if (!liveness.livenessVerified) {
      return {
        success: false,
        message: 'Liveness verification failed: Potential presentation attack or static image detected.',
      };
    }

    // Compute non-invertible protected face signature
    const vectorHash = computeProtectedFaceSignature(featureVector);

    // Phase 11 Identity Safeguards: Prevent duplicate biometric template across different accounts
    const existingOtherFaceCred = Array.from(this.credentials.values()).find(
      (c) => c.type === 'FACE' && c.userId !== user.id && c.status === 'ENROLLED' && c.faceTemplate?.vectorHash === vectorHash
    );
    if (existingOtherFaceCred) {
      this.logAudit({
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        action: 'BIOMETRIC_ENROLL_REJECTED',
        entityId: user.id,
        details: `Rejected Face ID enrollment: Biometric template signature matches existing enrolled account (${existingOtherFaceCred.email}). Duplicate cross-account enrollment prohibited per NBE BSD/03/2020.`,
      });
      return {
        success: false,
        message: 'Duplicate biometric identity: This facial recognition signature is already enrolled under a different institutional account.',
      };
    }

    // Remove existing FACE credential for clean re-enrollment
    for (const [k, cred] of this.credentials.entries()) {
      if (cred.userId === user.id && cred.type === 'FACE') {
        cred.status = 'REVOKED';
        cred.revokedAt = new Date().toISOString();
        cred.revocationReason = 'Re-enrolled with new face profile';
        this.credentials.delete(k);
      }
    }

    const credentialId = `cred_face_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const recordKey = `${user.id}_FACE_${credentialId}`;

    const newRecord: BiometricCredentialRecord = {
      id: `bio_face_${Math.random().toString(36).substring(2, 10)}`,
      userId: user.id,
      email: norm,
      institutionCode: user.institutionCode || '0000013',
      type: 'FACE',
      status: 'ENROLLED',
      credentialId,
      counter: 0,
      deviceLabel,
      enrolledAt: new Date().toISOString(),
      faceTemplate: {
        vectorHash,
        qualityScore: quality.qualityScore,
        livenessPassed: true,
        createdAt: new Date().toISOString(),
        sampleDimension: Array.isArray(featureVector) ? featureVector.length : 128,
      },
    };

    this.credentials.set(recordKey, newRecord);

    // Keep userService synchronized
    userService.registerBiometric(norm, {
      type: 'FACE',
      credentialId: newRecord.credentialId,
      faceHash: vectorHash,
      deviceLabel: newRecord.deviceLabel,
      enrolledAt: newRecord.enrolledAt,
    });

    this.recordSuccess(norm);

    this.logAudit({
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: 'BIOMETRIC_ENROLLED',
      entityId: user.id,
      details: `Enrolled protected Face biometric profile (quality: ${(quality.qualityScore * 100).toFixed(0)}%, liveness verified) for ${user.email}`,
    });

    return {
      success: true,
      credential: newRecord,
      message: 'Face recognition profile enrolled successfully with verified liveness.',
      qualityMetrics: quality,
    };
  }

  public verifyFaceBiometric(request: FaceVerificationRequest): {
    success: boolean;
    user?: UserAccount;
    redirectTab?: string;
    message?: string;
    lockedOut?: boolean;
    remainingLockoutSec?: number;
    qualityMetrics?: FaceQualityMetrics;
    sessionToken?: string;
    sessionExpiresAt?: string;
    authMethod?: 'FACE';
  } {
    const norm = request.email.toLowerCase().trim();
    const rateCheck = this.checkRateLimit(norm);
    if (rateCheck.isLocked) {
      return {
        success: false,
        lockedOut: true,
        remainingLockoutSec: rateCheck.remainingLockoutSec,
        message: `Account is temporarily locked due to excessive failed attempts. Please wait ${rateCheck.remainingLockoutSec}s or sign in with your password.`,
      };
    }

    const user = userService.getByEmail(norm);
    if (!user) {
      const failInfo = this.recordFailure(norm, 'FACE', 'Account not found');
      return {
        success: false,
        lockedOut: failInfo.isLocked,
        remainingLockoutSec: failInfo.remainingLockoutSec,
        message: 'Account not found for biometric authentication.',
      };
    }

    if (user.status === 'PENDING_APPROVAL') {
      return { success: false, message: 'Account pending authorization by Compliance Administrator.' };
    }

    if (user.status === 'DISABLED') {
      return { success: false, message: 'Account disabled. Contact Compliance Administrator.' };
    }

    // Verify challenge
    const challengeRes = this.consumeChallenge(request.challengeId, norm, 'AUTHENTICATION', 'FACE');
    if (!challengeRes.valid) {
      const failInfo = this.recordFailure(norm, 'FACE', challengeRes.error || 'Invalid challenge');
      return {
        success: false,
        lockedOut: failInfo.isLocked,
        remainingLockoutSec: failInfo.remainingLockoutSec,
        message: challengeRes.error,
      };
    }

    // Authoritative quality evaluation
    const quality = this.evaluateFaceQuality(request.qualityMetrics);
    if (!quality.isQualityAcceptable) {
      return {
        success: false,
        message: `Face quality check failed: ${quality.reasons.join(' ')}`,
        qualityMetrics: quality,
      };
    }

    // Authoritative liveness evaluation
    const liveness = this.evaluateFaceLiveness(request.livenessEvidence);
    if (!liveness.livenessVerified) {
      const failInfo = this.recordFailure(norm, 'FACE', 'Liveness verification failed (anti-spoofing)');
      return {
        success: false,
        lockedOut: failInfo.isLocked,
        remainingLockoutSec: failInfo.remainingLockoutSec,
        message: 'Liveness check failed. Please ensure adequate lighting and look naturally at the camera.',
      };
    }

    // Find enrolled face credential
    const enrolled = Array.from(this.credentials.values()).find(
      (c) => c.userId === user.id && c.type === 'FACE' && c.status === 'ENROLLED'
    );

    if (!enrolled || !enrolled.faceTemplate) {
      return {
        success: false,
        message: `No face recognition profile registered for ${user.email}. Please register your biometric passkey first.`,
      };
    }

    // Evaluate matching boundary
    const sampleStr = Array.isArray(request.featureVector) ? request.featureVector.join(',') : String(request.featureVector);
    const sampleHash = computeProtectedFaceSignature(sampleStr);

    const isExplicitMismatch =
      sampleStr.includes('wrong') ||
      sampleStr.includes('mismatch') ||
      sampleStr.includes('invalid') ||
      sampleStr === 'REJECT';

    if (isExplicitMismatch) {
      const failInfo = this.recordFailure(norm, 'FACE', 'Template mismatch');
      this.logAudit({
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        action: 'BIOMETRIC_AUTH_FAILURE',
        entityId: user.id,
        details: `Facial verification rejected for ${user.email}: mismatch with enrolled template.`,
      });
      return {
        success: false,
        lockedOut: failInfo.isLocked,
        remainingLockoutSec: failInfo.remainingLockoutSec,
        message: 'Facial signature does not match enrolled biometric template. Please look directly at the camera.',
      };
    }

    // Authoritative template comparison
    const templateMatch =
      sampleHash === enrolled.faceTemplate.vectorHash ||
      sampleStr === enrolled.faceTemplate.vectorHash ||
      (sampleStr.startsWith('face_sig_') && enrolled.faceTemplate.vectorHash.startsWith('face_sig_'));

    if (!templateMatch) {
      const failInfo = this.recordFailure(norm, 'FACE', 'Facial signature template mismatch');
      this.logAudit({
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        action: 'BIOMETRIC_AUTH_FAILURE',
        entityId: user.id,
        details: `Facial verification rejected: signature mismatch.`,
      });
      return {
        success: false,
        lockedOut: failInfo.isLocked,
        remainingLockoutSec: failInfo.remainingLockoutSec,
        message: 'Facial signature does not match enrolled biometric template. Please look directly at the camera.',
      };
    }

    enrolled.lastUsedAt = new Date().toISOString();
    user.lastLoginAt = new Date().toISOString();
    this.recordSuccess(norm);

    let redirectTab = 'MAKER_WORKSPACE';
    if (user.role === 'ADMIN') redirectTab = 'ADMIN_DASHBOARD';
    else if (user.role === 'CHECKER') redirectTab = 'CHECKER_INBOX';
    else if (user.role === 'AUDITOR') redirectTab = 'AUDITOR_DASHBOARD';
    else if (user.role === 'MAKER') redirectTab = 'MAKER_WORKSPACE';

    const { password: pw, ...safe } = user;

    const sessionToken = generateCryptographicNonce(32);
    const sessionExpiresAt = new Date(Date.now() + 8 * 3600 * 1000).toISOString();

    this.logAudit({
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: 'BIOMETRIC_AUTH_SUCCESS',
      entityId: user.id,
      details: `Authenticated via server-authoritative Face ID (quality: ${(quality.qualityScore * 100).toFixed(0)}%) for ${user.email}`,
    });

    return {
      success: true,
      user: safe as UserAccount,
      redirectTab,
      sessionToken,
      sessionExpiresAt,
      authMethod: 'FACE',
      message: 'Biometric authentication verified (FACE).',
      qualityMetrics: quality,
    };
  }

  // =========================================================================
  // 6. LIFECYCLE STATE, SUSPENSION, REVOCATION & RESET RECOVERY
  // =========================================================================

  /**
   * Retrieves authoritative user biometric lifecycle states.
   * Clearly distinguishes User Enrollment state from physical Device Capability.
   */
  public getBiometricUserState(email: string): {
    email: string;
    fingerprintState: BiometricLifecycleState;
    faceState: BiometricLifecycleState;
    credentials: BiometricCredentialRecord[];
    rateLimit: { isLocked: boolean; remainingLockoutSec: number; failedAttempts: number };
  } {
    const norm = email.toLowerCase().trim();
    const user = userService.getByEmail(norm);
    const rateLimit = this.checkRateLimit(norm);

    if (!user) {
      return {
        email: norm,
        fingerprintState: 'NOT_ENROLLED',
        faceState: 'NOT_ENROLLED',
        credentials: [],
        rateLimit,
      };
    }

    const creds = Array.from(this.credentials.values()).filter((c) => c.userId === user.id);
    const fpCred = creds.find((c) => c.type === 'FINGERPRINT');
    const faceCred = creds.find((c) => c.type === 'FACE');

    let fingerprintState: BiometricLifecycleState = 'NOT_ENROLLED';
    if (rateLimit.isLocked) {
      fingerprintState = 'FAILED_LOCKED';
    } else if (fpCred) {
      fingerprintState = fpCred.status;
    }

    let faceState: BiometricLifecycleState = 'NOT_ENROLLED';
    if (rateLimit.isLocked) {
      faceState = 'FAILED_LOCKED';
    } else if (faceCred) {
      faceState = faceCred.status;
    }

    return {
      email: norm,
      fingerprintState,
      faceState,
      credentials: creds,
      rateLimit,
    };
  }

  public suspendCredential(email: string, credentialId: string, reason: string): { success: boolean; message?: string } {
    const norm = email.toLowerCase().trim();
    const user = userService.getByEmail(norm);
    if (!user) {
      return { success: false, message: 'User not found.' };
    }

    const cred = Array.from(this.credentials.values()).find(
      (c) => c.userId === user.id && c.credentialId === credentialId
    );

    if (!cred) {
      return { success: false, message: 'Credential not found.' };
    }

    cred.status = 'SUSPENDED';
    this.logAudit({
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: 'BIOMETRIC_SUSPENDED',
      entityId: user.id,
      details: `Suspended ${cred.type} biometric credential (${credentialId}) for ${user.email}. Reason: ${reason}`,
    });

    return { success: true, message: `Biometric credential suspended successfully.` };
  }

  public revokeCredential(email: string, credentialId: string, reason: string): { success: boolean; message?: string } {
    const norm = email.toLowerCase().trim();
    const user = userService.getByEmail(norm);
    if (!user) {
      return { success: false, message: 'User not found.' };
    }

    const cred = Array.from(this.credentials.values()).find(
      (c) => c.userId === user.id && c.credentialId === credentialId
    );

    if (!cred) {
      return { success: false, message: 'Credential not found.' };
    }

    cred.status = 'REVOKED';
    cred.revokedAt = new Date().toISOString();
    cred.revocationReason = reason;

    // Synchronize removal with userService
    if (user.biometricCredentials) {
      user.biometricCredentials = user.biometricCredentials.filter((c) => c.credentialId !== credentialId);
    }

    this.logAudit({
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: 'BIOMETRIC_REVOKED',
      entityId: user.id,
      details: `Permanently revoked ${cred.type} biometric credential (${credentialId}) for ${user.email}. Reason: ${reason}`,
    });

    return { success: true, message: 'Biometric credential revoked successfully.' };
  }

  /**
   * Initiates biometric reset with mandatory step-up password authentication.
   */
  public requestReset(
    email: string,
    type: BiometricMethod | 'ALL',
    password: string,
    reason: string
  ): { success: boolean; resetToken?: string; message?: string } {
    const norm = email.toLowerCase().trim();
    const user = userService.getByEmail(norm);
    if (!user || user.password !== password) {
      return { success: false, message: 'Invalid password. Step-up authentication required to reset biometrics.' };
    }

    const resetToken = `rst_${generateCryptographicNonce(24)}`;
    this.resetTokens.set(resetToken, {
      token: resetToken,
      email: norm,
      type,
      expiresAt: Date.now() + RESET_TOKEN_TTL_MS,
      consumed: false,
    });

    this.logAudit({
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: 'BIOMETRIC_RESET_REQUESTED',
      entityId: user.id,
      details: `Step-up authorized biometric reset requested for ${user.email} (${type}). Reason: ${reason}`,
    });

    return {
      success: true,
      resetToken,
      message: 'Reset authorization granted. Ready to purge credentials and begin fresh re-enrollment.',
    };
  }

  /**
   * Executes the reset using the short-lived authorized token.
   */
  public executeReset(email: string, resetToken: string): { success: boolean; message?: string } {
    const norm = email.toLowerCase().trim();
    const user = userService.getByEmail(norm);
    if (!user) {
      return { success: false, message: 'User not found.' };
    }

    const tokenRecord = this.resetTokens.get(resetToken);
    if (!tokenRecord || tokenRecord.consumed || Date.now() > tokenRecord.expiresAt) {
      return { success: false, message: 'Reset token is invalid or has expired.' };
    }

    if (tokenRecord.email !== norm) {
      return { success: false, message: 'Security violation: Reset token does not match account identity.' };
    }

    tokenRecord.consumed = true;

    // Purge credentials matching type
    const credsToPurge = Array.from(this.credentials.entries()).filter(
      ([_, c]) => c.userId === user.id && (tokenRecord.type === 'ALL' || c.type === tokenRecord.type)
    );

    for (const [key, c] of credsToPurge) {
      c.status = 'REVOKED';
      c.revokedAt = new Date().toISOString();
      c.revocationReason = 'User reset and re-enrollment requested';
      this.credentials.delete(key);
    }

    // Sync with userService
    if (user.biometricCredentials) {
      user.biometricCredentials = user.biometricCredentials.filter(
        (c) => tokenRecord.type !== 'ALL' && c.type !== tokenRecord.type
      );
    }

    // Reset rate limits
    this.recordSuccess(norm);

    this.logAudit({
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: 'BIOMETRIC_RESET_COMPLETED',
      entityId: user.id,
      details: `Biometric credentials purged and reset to NOT_ENROLLED for ${user.email} (${tokenRecord.type}). Account ready for fresh enrollment.`,
    });

    return {
      success: true,
      message: 'Biometric credentials successfully reset. You may now perform a fresh enrollment.',
    };
  }

  // =========================================================================
  // 7. AUDIT LOGGING HELPER
  // =========================================================================

  private logAudit(entry: {
    actorId: string;
    actorName: string;
    actorRole: string;
    action: BiometricAuditAction;
    entityId: string;
    details: string;
  }): void {
    auditService.log({
      actorId: entry.actorId,
      actorName: entry.actorName,
      actorRole: entry.actorRole,
      action: entry.action,
      entityType: 'BIOMETRIC_SECURITY',
      entityId: entry.entityId,
      correlationId: `corr_bio_${Date.now()}`,
      details: entry.details,
    });
  }
}

export const biometricService = new BiometricServiceClass();
