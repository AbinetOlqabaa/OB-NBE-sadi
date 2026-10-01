/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type RealtimeEventType =
  | 'USER_CHANGED'
  | 'DEPARTMENT_CHANGED'
  | 'REPORT_CHANGED'
  | 'ASSIGNMENT_CHANGED'
  | 'SPECIAL_ACCESS_CHANGED'
  | 'WORKFLOW_STATUS_CHANGED'
  | 'ROLE_CHANGED'
  | 'CONFIG_SYNC_TRIGGER';

export type RealtimeDomain =
  | 'USER'
  | 'DEPARTMENT'
  | 'REPORT'
  | 'ASSIGNMENT'
  | 'SPECIAL_ACCESS'
  | 'WORKFLOW'
  | 'RBAC';

export interface EventActor {
  id: string;
  name: string;
  role: string;
}

export interface SsotChangeEvent<T = Record<string, any>> {
  eventId: string;
  sequenceNumber: number;
  eventType: RealtimeEventType;
  action: string;
  domain: RealtimeDomain;
  entityId: string;
  topic: string;
  timestamp: string; // ISO 8601
  actor: EventActor;
  summary: string;
  globalConfigHash: string;
  payload: T;
}

// Client-to-Server Messages
export type ClientMessage =
  | { type: 'AUTH'; token?: string; userId?: string; role?: string; department?: string }
  | { type: 'SUBSCRIBE'; topic: string }
  | { type: 'UNSUBSCRIBE'; topic: string }
  | { type: 'PING'; timestamp: number }
  | { type: 'SYNC_REQUEST'; lastSequenceNumber?: number; lastEventId?: string; lastHash?: string };

// Server-to-Client Messages
export type ServerMessage =
  | { type: 'AUTH_SUCCESS'; session: { userId: string; role: string; authorizedTopics: string[] } }
  | { type: 'AUTH_ERROR'; message: string }
  | { type: 'SUBSCRIBE_ACK'; topic: string }
  | { type: 'SUBSCRIBE_REJECTED'; topic: string; reason: string }
  | { type: 'UNSUBSCRIBE_ACK'; topic: string }
  | { type: 'EVENT'; event: SsotChangeEvent }
  | { type: 'PONG'; timestamp: number }
  | {
      type: 'SYNC_RESPONSE';
      currentHash: string;
      currentSequence: number;
      missedEvents: SsotChangeEvent[];
      requiresFullRevalidation: boolean;
    }
  | { type: 'ERROR'; message: string; code?: string };
