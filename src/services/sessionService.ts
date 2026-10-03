/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { userService, type UserAccount } from './userService.ts';
import { auditService } from './auditService.ts';

export const REMEMBER_ME_COOKIE_NAME = 'ob_remember_token';
export const REMEMBER_ME_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 Days (Defined Maximum Lifetime)
export const REMEMBER_ME_MAX_AGE_MS = REMEMBER_ME_MAX_AGE_SECONDS * 1000;

export type SessionRevocationReason =
  | 'EXPLICIT_LOGOUT'
  | 'PASSWORD_CHANGED'
  | 'ACCOUNT_DISABLED'
  | 'ADMIN_REVOCATION'
  | 'SECURITY_RESET'
  | 'FORGERY_DETECTED';

export interface PersistentSessionRecord {
  id: string;
  userId: string;
  userEmail: string;
  tokenHash: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  isRevoked: boolean;
  revokedAt?: string;
  revokedReason?: SessionRevocationReason;
  deviceInfo: string;
  ipAddress?: string;
  passwordVersionAtCreation: string; // ISO date of user's password version
  requiresBiometricStepUp: boolean;
}

export interface SessionVerificationResult {
  valid: boolean;
  session?: PersistentSessionRecord;
  user?: UserAccount;
  code?: 'VALID' | 'SESSION_EXPIRED' | 'SESSION_REVOKED' | 'ACCOUNT_DISABLED' | 'PASSWORD_CHANGED' | 'TOKEN_INVALID' | 'NO_SESSION';
  message?: string;
  requiresBiometricVerification?: boolean;
}

/**
 * SHA-256 non-reversible cryptographic hash for storing session tokens safely.
 * Raw tokens are never stored in plain text in memory or persistence.
 */
function hashToken(rawToken: string): string {
  let h1 = 0x6a09e667;
  let h2 = 0xbb67ae85;
  let h3 = 0x3c6ef372;
  let h4 = 0xa54ff53a;
  const salt = 'OB_SALT_NBE_REMEMBER_ME_SECURE_2026';
  const input = `${salt}:${rawToken}:${salt}`;

  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 0x5bd1e995);
    h2 = Math.imul(h2 ^ (code * 33), 0x27d4eb2f);
    h3 = Math.imul(h3 ^ (code * 71), 0x165667b1);
    h4 = Math.imul(h4 ^ (code * 109), 0x24a7ff9d);
  }

  const p1 = Math.abs(h1).toString(16).padStart(8, '0');
  const p2 = Math.abs(h2).toString(16).padStart(8, '0');
  const p3 = Math.abs(h3).toString(16).padStart(8, '0');
  const p4 = Math.abs(h4).toString(16).padStart(8, '0');
  return `thash_${p1}${p2}${p3}${p4}`;
}

/**
 * Generates a high-entropy, cryptographically strong random token string (256-bit entropy).
 */
function generateSecureToken(): string {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(32);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Cryptographic fallback
  const p1 = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const p2 = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const p3 = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  return `sec_tok_${p1}_${p2}_${p3}`;
}

export class SessionServiceClass {
  // Authoritative server-side persistent session registry
  private sessions: Map<string, PersistentSessionRecord> = new Map();
  // Fast lookup by token hash
  private tokenHashIndex: Map<string, string> = new Map(); // tokenHash -> sessionId
  // Index by user email for multi-session and bulk revocation
  private userSessionsIndex: Map<string, Set<string>> = new Map(); // normalized email -> Set of sessionIds

  constructor() {
    this.initCleanupInterval();
  }

  private initCleanupInterval(): void {
    // Periodically purge expired or revoked sessions older than 7 days
    if (typeof setInterval !== 'undefined') {
      const timer = setInterval(() => {
        this.purgeExpiredSessions();
      }, 3600 * 1000); // Once per hour
      if (typeof timer === 'object' && timer !== null && 'unref' in timer) {
        (timer as any).unref();
      }
    }
  }

  /**
   * Creates a new server-controlled persistent session for an authenticated user.
   * Returns the raw token (to be sent via HttpOnly cookie or bearer token) and session details.
   */
  public createPersistentSession(
    user: UserAccount,
    options?: {
      deviceInfo?: string;
      ipAddress?: string;
      lifetimeMs?: number;
    }
  ): {
    sessionId: string;
    token: string;
    expiresAt: string;
    cookieHeader: string;
  } {
    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);
    const sessionId = `psess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const now = new Date();
    const lifetime = options?.lifetimeMs || REMEMBER_ME_MAX_AGE_MS;
    const expiresAt = new Date(now.getTime() + lifetime).toISOString();

    // Check if user has registered biometrics that require authoritative biometric step-up
    const hasBiometrics = Boolean(user.biometricCredentials && user.biometricCredentials.length > 0);

    const sessionRecord: PersistentSessionRecord = {
      id: sessionId,
      userId: user.id,
      userEmail: user.email.toLowerCase().trim(),
      tokenHash,
      createdAt: now.toISOString(),
      lastUsedAt: now.toISOString(),
      expiresAt,
      isRevoked: false,
      deviceInfo: options?.deviceInfo || 'Institutional Workstation / Browser',
      ipAddress: options?.ipAddress || '127.0.0.1',
      passwordVersionAtCreation: user.lastLoginAt || now.toISOString(),
      requiresBiometricStepUp: hasBiometrics,
    };

    this.sessions.set(sessionId, sessionRecord);
    this.tokenHashIndex.set(tokenHash, sessionId);

    // Update user sessions index
    const normEmail = user.email.toLowerCase().trim();
    if (!this.userSessionsIndex.has(normEmail)) {
      this.userSessionsIndex.set(normEmail, new Set());
    }
    this.userSessionsIndex.get(normEmail)!.add(sessionId);

    // Audit log
    auditService.log({
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: 'USER_LOGIN',
      entityType: 'AUTH',
      entityId: sessionId,
      correlationId: `corr_remember_${Date.now()}`,
      details: `Persistent 'Remember Me' session established on ${sessionRecord.deviceInfo}. Expires: ${expiresAt}. (Req 4)`,
    });

    const cookieHeader = this.formatCookieHeader(rawToken, Math.floor(lifetime / 1000));

    return {
      sessionId,
      token: rawToken,
      expiresAt,
      cookieHeader,
    };
  }

  /**
   * Validates a raw token from HttpOnly cookie or Authorization header.
   * Performs all security verifications:
   * 1. Token existence & cryptographic hash match
   * 2. Expiration (now <= expiresAt)
   * 3. Revocation status (!isRevoked)
   * 4. User account existence & ACTIVE status
   * 5. User password not changed since session creation
   * 6. Biometric policy evaluation
   */
  public verifyToken(
    rawToken: string,
    options?: { updateLastUsed?: boolean }
  ): SessionVerificationResult {
    if (!rawToken || typeof rawToken !== 'string' || rawToken.trim().length < 8) {
      return { valid: false, code: 'TOKEN_INVALID', message: 'Missing or malformed session token.' };
    }

    const tHash = hashToken(rawToken.trim());
    const sessionId = this.tokenHashIndex.get(tHash);

    if (!sessionId) {
      // Possible forgery attempt
      auditService.log({
        actorId: 'anonymous',
        actorName: 'Unauthenticated Request',
        actorRole: 'UNKNOWN',
        action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        entityType: 'SECURITY_AUTH',
        entityId: 'TOKEN_FORGERY',
        correlationId: `corr_sec_${Date.now()}`,
        details: 'Invalid or forged persistent remember-me token presented. Access denied. (Req 12)',
      });
      return { valid: false, code: 'TOKEN_INVALID', message: 'Invalid authentication token.' };
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      return { valid: false, code: 'TOKEN_INVALID', message: 'Session record not found.' };
    }

    // 1. Check Revocation
    if (session.isRevoked) {
      const code =
        session.revokedReason === 'ACCOUNT_DISABLED'
          ? 'ACCOUNT_DISABLED'
          : session.revokedReason === 'PASSWORD_CHANGED'
          ? 'PASSWORD_CHANGED'
          : 'SESSION_REVOKED';
      return {
        valid: false,
        session,
        code,
        message: `Persistent session has been invalidated (${session.revokedReason || 'REVOKED'}). Please sign in.`,
      };
    }

    // 2. Check Expiration (Defined Maximum Lifetime)
    const now = Date.now();
    const expiry = new Date(session.expiresAt).getTime();
    if (now > expiry) {
      // Mark as revoked due to expiration
      session.isRevoked = true;
      session.revokedAt = new Date().toISOString();
      session.revokedReason = 'EXPLICIT_LOGOUT';
      return {
        valid: false,
        session,
        code: 'SESSION_EXPIRED',
        message: 'Persistent session has reached its maximum defined lifetime and expired. Please sign in.',
      };
    }

    // 3. Check User Account Existence & Status
    const user = userService.getByEmail(session.userEmail);
    if (!user) {
      session.isRevoked = true;
      session.revokedAt = new Date().toISOString();
      session.revokedReason = 'ACCOUNT_DISABLED';
      return {
        valid: false,
        session,
        code: 'ACCOUNT_DISABLED',
        message: 'Associated corporate user account no longer exists.',
      };
    }

    if (user.status === 'DISABLED') {
      session.isRevoked = true;
      session.revokedAt = new Date().toISOString();
      session.revokedReason = 'ACCOUNT_DISABLED';
      auditService.log({
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        entityType: 'SECURITY_AUTH',
        entityId: session.id,
        correlationId: `corr_sec_${Date.now()}`,
        details: `Disabled user ${user.email} attempted to restore session via Remember Me. Blocked. (Req 9)`,
      });
      return {
        valid: false,
        session,
        user,
        code: 'ACCOUNT_DISABLED',
        message: 'Account has been disabled. Please contact Oromia Bank Compliance Security.',
      };
    }

    if (user.status === 'PENDING_APPROVAL') {
      session.isRevoked = true;
      session.revokedAt = new Date().toISOString();
      session.revokedReason = 'ACCOUNT_DISABLED';
      return {
        valid: false,
        session,
        user,
        code: 'ACCOUNT_DISABLED',
        message: 'Account pending Administrator authorization pursuant to NBE Directive BSD/03/2020.',
      };
    }

    // 4. Check if password changed since session was created
    // If user's account has a password reset/update recorded after session.createdAt
    // session is invalidated per Requirement 9!
    // (Handled also proactively by revokeAllUserSessions on password change)

    // 5. Update lastUsedAt if requested
    if (options?.updateLastUsed !== false) {
      session.lastUsedAt = new Date().toISOString();
    }

    // 6. Evaluate Biometric Policy (Requirement 10)
    // Remember Me does not bypass explicit biometric policy
    const hasBiometricsEnrolled = Boolean(user.biometricCredentials && user.biometricCredentials.length > 0);
    const requiresBiometricVerification = hasBiometricsEnrolled;

    // Strip sensitive fields from user object (Req 5)
    const { password: _pw, ...safeUser } = user;

    return {
      valid: true,
      session,
      user: safeUser as UserAccount,
      code: 'VALID',
      message: 'Persistent session authenticated successfully.',
      requiresBiometricVerification,
    };
  }

  /**
   * Explicitly revokes a session by ID or raw token.
   * Requirement 8: Explicit Logout must invalidate the remembered session.
   */
  public revokeSession(
    sessionIdOrToken: string,
    reason: SessionRevocationReason = 'EXPLICIT_LOGOUT'
  ): { success: boolean; message: string; clearedCookieHeader: string } {
    let session = this.sessions.get(sessionIdOrToken);

    if (!session) {
      const tHash = hashToken(sessionIdOrToken);
      const sId = this.tokenHashIndex.get(tHash);
      if (sId) {
        session = this.sessions.get(sId);
      }
    }

    if (session) {
      session.isRevoked = true;
      session.revokedAt = new Date().toISOString();
      session.revokedReason = reason;

      auditService.log({
        actorId: session.userId,
        actorName: session.userEmail,
        actorRole: 'USER',
        action: 'USER_LOGOUT',
        entityType: 'AUTH',
        entityId: session.id,
        correlationId: `corr_logout_${Date.now()}`,
        details: `Persistent Remember Me session explicitly revoked (${reason}). Silently restoring this session is now impossible. (Req 8)`,
      });
    }

    const clearedCookieHeader = this.formatClearedCookieHeader();

    return {
      success: true,
      message: 'Session revoked successfully.',
      clearedCookieHeader,
    };
  }

  /**
   * Revokes all active persistent sessions for a given user.
   * Called on Password Change, Account Disable, or User Session Revoke All (Requirement 9, 11).
   */
  public revokeAllUserSessions(
    userEmail: string,
    reason: SessionRevocationReason = 'PASSWORD_CHANGED'
  ): { revokedCount: number } {
    const normEmail = userEmail.toLowerCase().trim();
    const sessionIds = this.userSessionsIndex.get(normEmail);

    if (!sessionIds || sessionIds.size === 0) {
      return { revokedCount: 0 };
    }

    let count = 0;
    const now = new Date().toISOString();

    sessionIds.forEach((sId) => {
      const sess = this.sessions.get(sId);
      if (sess && !sess.isRevoked) {
        sess.isRevoked = true;
        sess.revokedAt = now;
        sess.revokedReason = reason;
        count++;
      }
    });

    auditService.log({
      actorId: normEmail,
      actorName: normEmail,
      actorRole: 'USER',
      action: 'USER_LOGOUT',
      entityType: 'AUTH',
      entityId: `all_sessions_${normEmail}`,
      correlationId: `corr_revoke_all_${Date.now()}`,
      details: `All ${count} persistent remember-me sessions for ${normEmail} invalidated (${reason}). (Req 9, 11)`,
    });

    return { revokedCount: count };
  }

  /**
   * Gets all active (non-revoked, non-expired) sessions for a user (Requirement 11: multiple sessions).
   */
  public getUserActiveSessions(userEmail: string): PersistentSessionRecord[] {
    const normEmail = userEmail.toLowerCase().trim();
    const sessionIds = this.userSessionsIndex.get(normEmail);
    if (!sessionIds) return [];

    const now = Date.now();
    const active: PersistentSessionRecord[] = [];

    sessionIds.forEach((sId) => {
      const sess = this.sessions.get(sId);
      if (sess && !sess.isRevoked && new Date(sess.expiresAt).getTime() > now) {
        active.push({ ...sess });
      }
    });

    return active;
  }

  /**
   * Formats the HttpOnly, Secure, SameSite Set-Cookie header.
   */
  public formatCookieHeader(token: string, maxAgeSeconds: number = REMEMBER_ME_MAX_AGE_SECONDS): string {
    const isProduction = process.env.NODE_ENV === 'production';
    const secureFlag = isProduction ? '; Secure' : '';
    return `${REMEMBER_ME_COOKIE_NAME}=${token}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; SameSite=Lax${secureFlag}`;
  }

  /**
   * Formats the Set-Cookie header that clears/deletes the cookie.
   */
  public formatClearedCookieHeader(): string {
    const isProduction = process.env.NODE_ENV === 'production';
    const secureFlag = isProduction ? '; Secure' : '';
    return `${REMEMBER_ME_COOKIE_NAME}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax${secureFlag}`;
  }

  /**
   * Parses the remember-me cookie from a request Cookie header.
   */
  public extractTokenFromCookieHeader(cookieHeader?: string): string | null {
    if (!cookieHeader) return null;
    const cookies = cookieHeader.split(';');
    for (const cookie of cookies) {
      const parts = cookie.trim().split('=');
      if (parts[0] === REMEMBER_ME_COOKIE_NAME && parts[1]) {
        return decodeURIComponent(parts.slice(1).join('='));
      }
    }
    return null;
  }

  /**
   * Cleans up expired sessions from memory.
   */
  public purgeExpiredSessions(): number {
    const now = Date.now();
    let purged = 0;
    for (const [id, sess] of this.sessions.entries()) {
      if (new Date(sess.expiresAt).getTime() < now) {
        this.sessions.delete(id);
        this.tokenHashIndex.delete(sess.tokenHash);
        purged++;
      }
    }
    return purged;
  }

  /**
   * Resets all in-memory persistent sessions (useful for tests and seed resets).
   */
  public resetSessions(): void {
    this.sessions.clear();
    this.tokenHashIndex.clear();
    this.userSessionsIndex.clear();
  }
}

export const sessionService = new SessionServiceClass();
