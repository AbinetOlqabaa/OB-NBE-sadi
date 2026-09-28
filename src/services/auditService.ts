/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AuditLogEntry } from '../types/regulatory.ts';

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
  }

  public log(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): AuditLogEntry {
    const fullEntry: AuditLogEntry = {
      ...entry,
      id: 'aud_' + Math.random().toString(36).substring(2, 10),
      timestamp: new Date().toISOString(),
    };

    // Immutable append
    this.logs.unshift(fullEntry);

    // Keep up to 1000 entries in active memory
    if (this.logs.length > 1000) {
      this.logs.pop();
    }

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

  public getLogsByEntity(entityId: string): AuditLogEntry[] {
    return this.logs.filter((l) => l.entityId === entityId);
  }

  public getLogsByCorrelation(correlationId: string): AuditLogEntry[] {
    return this.logs.filter((l) => l.correlationId === correlationId);
  }
}

export const auditService = new AuditServiceClass();
