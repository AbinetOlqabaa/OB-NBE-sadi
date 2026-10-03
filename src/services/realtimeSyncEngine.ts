/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserSafeEventEmitter } from '../utils/browserEventEmitter.ts';

// ============================================================================
// 1. REAL-TIME DATA CONTRACTS & EVENT ENVELOPE
// ============================================================================

export type RealtimeEventType =
  // User changes
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_DEACTIVATED'
  | 'USER_STATUS_CHANGED'
  | 'USER_ROLE_CHANGED'
  // Department changes
  | 'DEPARTMENT_CREATED'
  | 'DEPARTMENT_UPDATED'
  | 'DEPARTMENT_DELETED'
  | 'DEPARTMENT_RESTRUCTURED'
  // Report definition / version changes
  | 'REPORT_CREATED'
  | 'REPORT_UPDATED'
  | 'REPORT_PUBLISHED'
  | 'REPORT_RETIRED'
  | 'REPORT_VERSION_PUBLISHED'
  // Assignment changes
  | 'USER_REPORT_ASSIGNED'
  | 'USER_REPORT_REVOKED'
  | 'DEPARTMENT_REPORT_ASSIGNED'
  | 'DEPARTMENT_REPORT_REVOKED'
  // Special access changes
  | 'SPECIAL_ACCESS_GRANTED'
  | 'SPECIAL_ACCESS_REVOKED'
  | 'SPECIAL_ACCESS_EXPIRED'
  // Workflow status changes
  | 'WORKFLOW_DRAFT_CREATED'
  | 'WORKFLOW_DRAFT_UPDATED'
  | 'WORKFLOW_SUBMITTED'
  | 'WORKFLOW_APPROVED'
  | 'WORKFLOW_REJECTED'
  | 'WORKFLOW_NBE_TRANSMITTED'
  // System SSOT Sync / Invalidation
  | 'CACHE_INVALIDATED'
  | 'CONFIG_CHANGED'
  | 'BATCH_SYNC'
  | 'HEARTBEAT';

export type RealtimeEventScope =
  | 'PUBLIC'
  | 'AUTHENTICATED'
  | 'ADMIN_ONLY'
  | 'DEPARTMENT'
  | 'USER_DIRECT';

export type RealtimeEntityType =
  | 'USER'
  | 'DEPARTMENT'
  | 'REPORT'
  | 'ASSIGNMENT'
  | 'SPECIAL_ACCESS'
  | 'WORKFLOW'
  | 'SYSTEM';

export type RealtimeAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'STATUS_CHANGE'
  | 'ASSIGN'
  | 'REVOKE'
  | 'PUBLISH'
  | 'TRANSMIT'
  | 'INVALIDATE'
  | 'BATCH';

export interface RealtimeActor {
  id: string;
  name: string;
  role: string;
  department?: string;
}

export interface RealtimeEvent<T = any> {
  id: string;
  sequence: number;
  type: RealtimeEventType;
  entityType: RealtimeEntityType;
  entityId: string;
  action: RealtimeAction;
  timestamp: string;
  versionHash: string;
  actor: RealtimeActor;
  affectedUserIds?: string[];
  affectedDepartmentIds?: string[];
  affectedReportKeys?: string[];
  scope: RealtimeEventScope;
  payload: T;
}

export interface ClientSubscriberIdentity {
  id: string;
  role: string;
  department?: string;
  name?: string;
}

export interface SubscriptionAuthResult {
  allowed: boolean;
  reason?: string;
}

export interface CatchupResult {
  events: RealtimeEvent[];
  currentSequence: number;
  resyncRequired: boolean;
  reason?: string;
}

// ============================================================================
// 2. AUTHORITATIVE REAL-TIME SSOT ENGINE
// ============================================================================

export class RealtimeSyncEngine {
  public readonly events = new BrowserSafeEventEmitter();
  private sequenceCounter: number = 0;
  private readonly eventLogBuffer: RealtimeEvent[] = [];
  private readonly maxBufferSize: number = 500;
  private globalVersionHash: string = `ssot_v1_${Date.now()}`;

  constructor() {
    this.events.setMaxListeners(250);
  }

  /**
   * Resets internal state for unit testing or test isolation.
   */
  public resetStateForTesting(): void {
    this.sequenceCounter = 0;
    this.eventLogBuffer.length = 0;
    this.globalVersionHash = `ssot_v1_${Date.now()}`;
    this.events.removeAllListeners();
  }

  /**
   * Generates a UUID v4 string.
   */
  private generateUUID(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'ev_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
  }

  /**
   * Generates a hash representing state version.
   */
  private updateVersionHash(entityType: string, action: string): string {
    this.globalVersionHash = `ssot_seq${this.sequenceCounter}_${entityType}_${action}_${Date.now()}`;
    return this.globalVersionHash;
  }

  public getCurrentSequence(): number {
    return this.sequenceCounter;
  }

  public getCurrentVersionHash(): string {
    return this.globalVersionHash;
  }

  /**
   * Authoritatively checks if a user is permitted to subscribe to a topic.
   * Enforces zero-bypass role and department boundary constraints.
   */
  public canUserSubscribe(user: ClientSubscriberIdentity, topic: string): SubscriptionAuthResult {
    if (!topic || typeof topic !== 'string') {
      return { allowed: false, reason: 'Invalid or missing topic name.' };
    }

    const trimmed = topic.trim();

    // 1. System-wide public / broadcast topics
    if (trimmed === 'system:all' || trimmed === 'system:heartbeat' || trimmed === 'system:status') {
      return { allowed: true };
    }

    // 2. Admin governance topic: strictly ADMIN or SUPER_ADMIN
    if (trimmed === 'admin:governance' || trimmed.startsWith('admin:')) {
      if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: `Subscription to '${trimmed}' is restricted to compliance administrators (current role: ${user.role}).`,
      };
    }

    // 3. Department-scoped topics: format 'department:<deptId>'
    if (trimmed.startsWith('department:')) {
      const targetDept = trimmed.substring('department:'.length).trim();
      // Admin and Auditor can inspect any department topic
      if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' || user.role === 'AUDITOR') {
        return { allowed: true };
      }
      // User must belong to the department
      if (user.department && (user.department === targetDept || targetDept === 'ALL')) {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: `Department boundary violation: User assigned to '${user.department || 'None'}' cannot subscribe to department topic '${targetDept}'.`,
      };
    }

    // 4. User-direct private topics: format 'user:<userId>'
    if (trimmed.startsWith('user:')) {
      const targetUserId = trimmed.substring('user:'.length).trim();
      if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' || user.role === 'AUDITOR') {
        return { allowed: true };
      }
      if (user.id === targetUserId) {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: `Privacy violation: Cannot subscribe to private event channel of user '${targetUserId}'.`,
      };
    }

    // 5. Report-specific topics: format 'report:<returnKey>'
    if (trimmed.startsWith('report:')) {
      // Accessible to Admin, Auditor, or Authenticated operators
      if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' || user.role === 'AUDITOR') {
        return { allowed: true };
      }
      // Allowed for authenticated users (effective access checks are applied at report view time)
      if (user.id && user.role) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Authentication required for report subscription.' };
    }

    // Default allow for standard authenticated operational channels
    if (user.id && user.role) {
      return { allowed: true };
    }

    return { allowed: false, reason: 'Unauthorized subscription topic.' };
  }

  /**
   * Sanitizes and filters an event for a specific recipient to prevent data leakage.
   * Never broadcasts sensitive passwords, secrets, or unentitled data.
   */
  public filterEventForUser<T = any>(
    user: ClientSubscriberIdentity,
    event: RealtimeEvent<T>
  ): RealtimeEvent<T> | null {
    // 1. Admin-only scope check
    if (event.scope === 'ADMIN_ONLY') {
      if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
        return null;
      }
    }

    // 2. User-direct scope check
    if (event.scope === 'USER_DIRECT') {
      const isTarget = event.affectedUserIds?.includes(user.id) || event.entityId === user.id;
      const isSupervisor = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' || user.role === 'AUDITOR';
      if (!isTarget && !isSupervisor) {
        return null;
      }
    }

    // 3. Department boundary check
    if (event.scope === 'DEPARTMENT') {
      const inDept = event.affectedDepartmentIds?.includes(user.department || '');
      const isSupervisor = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' || user.role === 'AUDITOR';
      if (!inDept && !isSupervisor) {
        return null;
      }
    }

    // 4. Sanitize sensitive fields from payload
    let safePayload = event.payload;
    if (safePayload && typeof safePayload === 'object') {
      safePayload = { ...safePayload };
      delete (safePayload as any).password;
      delete (safePayload as any).passwordHash;
      delete (safePayload as any).biometricCredentials;
      delete (safePayload as any).secret;
      delete (safePayload as any).privateKey;
    }

    return {
      ...event,
      payload: safePayload,
    };
  }

  /**
   * Publishes an authoritative, successfully committed change event.
   * CRITICAL SSOT RULE: Call this ONLY AFTER database / domain commit succeeds.
   * Never broadcast changes that later roll back!
   */
  public publish<T = any>(
    eventData: {
      type: RealtimeEventType;
      entityType: RealtimeEntityType;
      entityId: string;
      action: RealtimeAction;
      actor: RealtimeActor;
      affectedUserIds?: string[];
      affectedDepartmentIds?: string[];
      affectedReportKeys?: string[];
      scope?: RealtimeEventScope;
      payload?: T;
    }
  ): RealtimeEvent<T> {
    this.sequenceCounter++;
    const vHash = this.updateVersionHash(eventData.entityType, eventData.action);

    const event: RealtimeEvent<T> = {
      id: this.generateUUID(),
      sequence: this.sequenceCounter,
      type: eventData.type,
      entityType: eventData.entityType,
      entityId: eventData.entityId,
      action: eventData.action,
      timestamp: new Date().toISOString(),
      versionHash: vHash,
      actor: eventData.actor,
      affectedUserIds: eventData.affectedUserIds || [],
      affectedDepartmentIds: eventData.affectedDepartmentIds || [],
      affectedReportKeys: eventData.affectedReportKeys || [],
      scope: eventData.scope || 'AUTHENTICATED',
      payload: (eventData.payload !== undefined ? eventData.payload : {}) as T,
    };

    // Maintain bounded ring buffer
    this.eventLogBuffer.push(event);
    if (this.eventLogBuffer.length > this.maxBufferSize) {
      this.eventLogBuffer.shift();
    }

    // Emit to internal listeners
    this.events.emit('EVENT', event);
    this.events.emit(event.type, event);

    return event;
  }

  /**
   * Retrieves events that occurred since a given sequence number for reconnect / catch-up.
   * If sequence is 0 or precedes buffer retention, triggers authoritative resync.
   */
  public getEventsSince(
    sinceSequence: number,
    user: ClientSubscriberIdentity,
    topics?: string[]
  ): CatchupResult {
    const currentSeq = this.sequenceCounter;

    // Fresh client or no events yet
    if (sinceSequence >= currentSeq) {
      return {
        events: [],
        currentSequence: currentSeq,
        resyncRequired: false,
      };
    }

    if (this.eventLogBuffer.length === 0) {
      return {
        events: [],
        currentSequence: currentSeq,
        resyncRequired: sinceSequence > 0,
      };
    }

    const oldestInBuffer = this.eventLogBuffer[0].sequence;

    // If client is too far behind (oldest available event is newer than sinceSequence),
    // a full authoritative state revalidation is required.
    if (sinceSequence < oldestInBuffer - 1) {
      return {
        events: [],
        currentSequence: currentSeq,
        resyncRequired: true,
        reason: `Client sequence ${sinceSequence} is older than buffer threshold ${oldestInBuffer}. Authoritative state re-validation required.`,
      };
    }

    // Retrieve and filter events strictly for this user
    const filteredEvents: RealtimeEvent[] = [];
    for (const evt of this.eventLogBuffer) {
      if (evt.sequence > sinceSequence) {
        const safe = this.filterEventForUser(user, evt);
        if (safe) {
          filteredEvents.push(safe);
        }
      }
    }

    return {
      events: filteredEvents,
      currentSequence: currentSeq,
      resyncRequired: false,
    };
  }

  /**
   * Returns recent event history for audit or debugging.
   */
  public getRecentEvents(limit: number = 50): RealtimeEvent[] {
    return this.eventLogBuffer.slice(-Math.min(limit, this.eventLogBuffer.length));
  }
}

// Global Singleton Instance
export const realtimeSyncEngine = new RealtimeSyncEngine();
