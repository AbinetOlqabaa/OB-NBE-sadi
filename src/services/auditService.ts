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
