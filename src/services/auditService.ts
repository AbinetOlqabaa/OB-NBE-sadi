/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AuditLogEntry } from '../types/regulatory.ts';
import { indexedDbStorage } from './indexedDbStorage.ts';

const SENSITIVE_KEY_REGEX = /(password|private_?key|secret|credential_?private|admin_?password|seed_?phrase)/i;
const BASE64_IMAGE_REGEX = /data:image\/[a-zA-Z]+;base64,[A-Za-z0-9+/=]{40,}/g;

/**
 * Strips or redacts sensitive credentials, raw camera image buffers,
 * and secret keys from audit log payloads to prevent persistent data leakage.
 */
export function sanitizeAuditPayload<T>(value: T, depth: number = 0): T {
  if (depth > 6 || value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    let sanitized = value.replace(BASE64_IMAGE_REGEX, '[REDACTED_IMAGE_BUFFER]');
    if (sanitized.includes('password') || sanitized.includes('Password')) {
      sanitized = sanitized.replace(/(password["':\s=]+)([^"'\s,;]+)/gi, '$1[REDACTED]');
    }
    return sanitized as unknown as T;
  }

  if (Array.isArray(value)) {
    // If it is a large numeric vector (e.g. 128-d facial embedding array), redact it
    if (value.length > 32 && typeof value[0] === 'number') {
      return `[PROTECTED_NUMERIC_VECTOR: dim=${value.length}]` as unknown as T;
    }
    return value.map((item) => sanitizeAuditPayload(item, depth + 1)) as unknown as T;
  }

  if (typeof value === 'object') {
    const sanitizedObj: Record<string, any> = {};
    for (const [k, v] of Object.entries(value as Record<string, any>)) {
      if (SENSITIVE_KEY_REGEX.test(k)) {
        sanitizedObj[k] = '[REDACTED_SECRET]';
      } else if (k === 'featureVector' && (Array.isArray(v) || typeof v === 'string')) {
        sanitizedObj[k] = typeof v === 'string' && v.startsWith('face_sig_') ? v : '[PROTECTED_VECTOR]';
      } else if (k === 'imageBase64' || k === 'imageData') {
        sanitizedObj[k] = '[REDACTED_RAW_FRAME]';
      } else {
        sanitizedObj[k] = sanitizeAuditPayload(v, depth + 1);
      }
    }
    return sanitizedObj as T;
  }

  return value;
}

class AuditServiceClass {
  private logs: AuditLogEntry[] = [];

  constructor() {
    // Seed initial system startup audit log
    this.log({
      actorId: 'sys_root',
      actorName: 'NBE Regulatory Engine',
      actorRole: 'SYSTEM',
      action: 'SYSTEM_BOOTSTRAP',
      entityType: 'PLATFORM',
      entityId: 'OB_NBE_PORTAL',
      correlationId: 'boot_' + Date.now(),
      details: 'Oromia Bank NBE Platform initialized with 24 canonical returns',
    });

    // Hydrate existing audit logs from IndexedDB if in browser
    this.hydrateFromIndexedDB().catch(() => {});
  }

  public async hydrateFromIndexedDB(): Promise<void> {
    try {
      const stored = await indexedDbStorage.getAllAuditLogs();
      if (stored && stored.length > 0) {
        const idSet = new Set(this.logs.map((l) => l.id));
        for (const item of stored) {
          if (!idSet.has(item.id)) {
            this.logs.push(item);
            idSet.add(item.id);
          }
        }
        this.logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      }
    } catch {
      // Ignored in non-browser runtimes
    }
  }

  public log(entry: Omit<AuditLogEntry, 'id' | 'timestamp'> & { isOffline?: boolean; syncStatus?: 'SYNCED' | 'PENDING_SYNC' }): AuditLogEntry {
    const isOnline = typeof navigator !== 'undefined' ? Boolean(navigator.onLine) : true;
    const syncStatus = entry.syncStatus || (isOnline ? 'SYNCED' : 'PENDING_SYNC');
    const isOfflineRecord = entry.isOffline !== undefined ? entry.isOffline : !isOnline;

    const sanitizedDetails = sanitizeAuditPayload(entry.details);
    const sanitizedOld = entry.oldState ? sanitizeAuditPayload(entry.oldState) : undefined;
    const sanitizedNew = entry.newState ? sanitizeAuditPayload(entry.newState) : undefined;

    const fullEntry: AuditLogEntry = {
      ...entry,
      details: sanitizedDetails,
      oldState: sanitizedOld,
      newState: sanitizedNew,
      id: 'aud_' + Math.random().toString(36).substring(2, 10),
      timestamp: new Date().toISOString(),
      syncStatus,
      isOfflineRecord,
      persistedAt: new Date().toISOString(),
    };

    // Immutable append to in-memory active list
    this.logs.unshift(fullEntry);

    // Keep up to 1000 entries in active memory
    if (this.logs.length > 1000) {
      this.logs.pop();
    }

    // Persist to IndexedDB asynchronously for permanent offline preservation
    indexedDbStorage.saveAuditLog(fullEntry, {
      syncStatus,
      isOffline: isOfflineRecord,
    }).catch((err) => {
      console.warn('[AuditService] IndexedDB save warning:', err);
    });

    return fullEntry;
  }

  public logBiometricEvent(params: {
    actorId?: string;
    actorName?: string;
    actorRole?: string;
    action: 'BIOMETRIC_AUTH_SUCCESS' | 'BIOMETRIC_AUTH_FAILURE' | 'BIOMETRIC_AUTH_TIMEOUT' | 'BIOMETRIC_LOGIN' | 'BIOMETRIC_ENROLLED' | 'BIOMETRIC_PROBE';
    type?: 'FINGERPRINT' | 'FACE' | 'WEBAUTHN_PLATFORM';
    entityId?: string;
    details?: string;
    errorMessage?: string;
    correlationId?: string;
    metadata?: Record<string, any>;
  }): AuditLogEntry {
    const typeLabel = params.type || 'FINGERPRINT';
    const statusLabel =
      params.action === 'BIOMETRIC_AUTH_SUCCESS' || params.action === 'BIOMETRIC_LOGIN' || params.action === 'BIOMETRIC_ENROLLED'
        ? 'SUCCESS'
        : params.action === 'BIOMETRIC_AUTH_TIMEOUT'
        ? 'TIMEOUT (30s auto-cancel)'
        : 'FAILURE';

    const narrative =
      params.details ||
      `[NBE Directive BSD/03/2020 Compliance] Biometric ${typeLabel} authentication attempt: ${statusLabel}.${
        params.errorMessage ? ` Error: ${params.errorMessage}` : ''
      }`;

    return this.log({
      actorId: params.actorId || 'bio_actor',
      actorName: params.actorName || 'Bank Officer',
      actorRole: params.actorRole || 'MAKER',
      action: params.action,
      entityType: 'BIOMETRIC_AUTH',
      entityId: params.entityId || 'OB_BIOMETRIC_SENSOR',
      correlationId: params.correlationId || `corr_bio_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      details: narrative,
      newState: params.metadata,
    });
  }

  public getLogs(limit: number = 100): AuditLogEntry[] {
    return [...this.logs.slice(0, limit)];
  }

  public getAllLogs(): AuditLogEntry[] {
    return [...this.logs];
  }

  public getAll(): AuditLogEntry[] {
    return [...this.logs];
  }

  public getLogsByEntity(entityId: string): AuditLogEntry[] {
    return this.logs.filter((l) => l.entityId === entityId);
  }

  public getLogsByCorrelation(correlationId: string): AuditLogEntry[] {
    return this.logs.filter((l) => l.correlationId === correlationId);
  }
}

export const auditService = new AuditServiceClass();
