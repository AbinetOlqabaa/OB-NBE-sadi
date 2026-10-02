/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserSafeEventEmitter } from '../utils/browserEventEmitter.ts';
import type {
  RealtimeEvent,
  ClientSubscriberIdentity,
  RealtimeEventType,
} from './realtimeSyncEngine.ts';

export type ConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING';

export interface RealtimeClientOptions {
  autoConnect?: boolean;
  heartbeatIntervalMs?: number;
  reconnectIntervalMs?: number;
  maxReconnectIntervalMs?: number;
  wsUrl?: string;
  sseUrl?: string;
}

export class RealtimeClient {
  public readonly events = new BrowserSafeEventEmitter();
  private status: ConnectionStatus = 'DISCONNECTED';
  private ws: WebSocket | null = null;
  private sse: EventSource | null = null;
  private user: ClientSubscriberIdentity | null = null;
  private subscribedTopics = new Set<string>();
  private seenEventIds = new Set<string>();
  private readonly maxSeenIds: number = 1000;
  private lastReceivedSequence: number = 0;
  private reconnectAttempts: number = 0;
  private reconnectTimer: any = null;
  private heartbeatTimer: any = null;
  private lastHeartbeatTime: number = Date.now();
  private isBrowser: boolean = typeof window !== 'undefined';

  private options: Required<RealtimeClientOptions>;

  constructor(options: RealtimeClientOptions = {}) {
    this.events.setMaxListeners(150);
    this.options = {
      autoConnect: options.autoConnect ?? false,
      heartbeatIntervalMs: options.heartbeatIntervalMs ?? 25000,
      reconnectIntervalMs: options.reconnectIntervalMs ?? 1500,
      maxReconnectIntervalMs: options.maxReconnectIntervalMs ?? 15000,
      wsUrl: options.wsUrl ?? '',
      sseUrl: options.sseUrl ?? '/api/realtime/events',
    };
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  public getLastSequence(): number {
    return this.lastReceivedSequence;
  }

  public getLastHeartbeat(): number {
    return this.lastHeartbeatTime;
  }

  public getSubscribedTopics(): string[] {
    return Array.from(this.subscribedTopics);
  }

  /**
   * Initializes or updates the authenticated user identity.
   */
  public setUser(user: ClientSubscriberIdentity): void {
    const changed = !this.user || this.user.id !== user.id || this.user.role !== user.role;
    this.user = user;

    if (changed && this.status === 'CONNECTED') {
      // Re-authenticate and re-subscribe
      this.sendWsMessage({
        type: 'AUTH',
        user: this.user,
      });
      this.resubscribeAll();
    }
  }

  /**
   * Subscribes to a real-time topic channel.
   */
  public subscribeTopic(topic: string): void {
    if (!topic) return;
    this.subscribedTopics.add(topic);

    if (this.status === 'CONNECTED') {
      this.sendWsMessage({
        type: 'SUBSCRIBE',
        topics: [topic],
      });
    }
  }

  /**
   * Unsubscribes from a topic channel.
   */
  public unsubscribeTopic(topic: string): void {
    if (!topic) return;
    this.subscribedTopics.delete(topic);

    if (this.status === 'CONNECTED') {
      this.sendWsMessage({
        type: 'UNSUBSCRIBE',
        topics: [topic],
      });
    }
  }

  /**
   * Establishes connection to the authoritative backend.
   */
  public connect(user?: ClientSubscriberIdentity): void {
    if (user) {
      this.user = user;
    }
    if (this.status === 'CONNECTED' || this.status === 'CONNECTING') {
      return;
    }

    this.setStatus(this.reconnectAttempts > 0 ? 'RECONNECTING' : 'CONNECTING');

    if (!this.isBrowser) {
      // In server/test environments, mark as CONNECTED for local event routing
      this.setStatus('CONNECTED');
      return;
    }

    try {
      this.connectWebSocket();
    } catch (err) {
      console.warn('[RealtimeClient] WebSocket connection failed, trying SSE fallback:', err);
      this.connectSSE();
    }
  }

  private getWebSocketUrl(): string {
    if (this.options.wsUrl) return this.options.wsUrl;
    if (typeof window === 'undefined') return 'ws://127.0.0.1:3000/ws/realtime';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws/realtime`;
  }

  private connectWebSocket(): void {
    const wsUrl = this.getWebSocketUrl();
    try {
      this.ws = new WebSocket(wsUrl);
    } catch (e) {
      this.connectSSE();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.setStatus('CONNECTED');
      this.lastHeartbeatTime = Date.now();

      // Send Auth Handshake
      if (this.user) {
        this.sendWsMessage({
          type: 'AUTH',
          user: this.user,
        });
      }

      // Re-subscribe to all active topics
      this.resubscribeAll();

      // Perform Catch-up sync if we have previous sequence
      if (this.lastReceivedSequence > 0) {
        this.sendWsMessage({
          type: 'SYNC_CATCHUP',
          lastSequence: this.lastReceivedSequence,
        });
      }

      this.startHeartbeat();
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handleInboundMessage(msg);
      } catch (err) {
        console.warn('[RealtimeClient] Failed parsing WebSocket message:', err);
      }
    };

    this.ws.onerror = (err) => {
      console.warn('[RealtimeClient] WebSocket error event:', err);
    };

    this.ws.onclose = () => {
      this.stopHeartbeat();
      this.ws = null;
      if (this.status !== 'DISCONNECTED') {
        this.scheduleReconnect();
      }
    };
  }

  private connectSSE(): void {
    if (typeof EventSource === 'undefined') {
      return;
    }
    const sseUrl = `${this.options.sseUrl}?userId=${encodeURIComponent(this.user?.id || '')}&role=${encodeURIComponent(this.user?.role || '')}&since=${this.lastReceivedSequence}`;
    try {
      this.sse = new EventSource(sseUrl);
      this.sse.onopen = () => {
        this.reconnectAttempts = 0;
        this.setStatus('CONNECTED');
      };
      this.sse.onmessage = (evt) => {
        try {
          const parsed = JSON.parse(evt.data);
          this.handleInboundMessage(parsed);
        } catch {}
      };
      this.sse.onerror = () => {
        this.sse?.close();
        this.sse = null;
        this.scheduleReconnect();
      };
    } catch (err) {
      console.warn('[RealtimeClient] SSE failed:', err);
    }
  }

  private sendWsMessage(payload: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  private resubscribeAll(): void {
    const topics = Array.from(this.subscribedTopics);
    if (topics.length > 0) {
      this.sendWsMessage({
        type: 'SUBSCRIBE',
        topics,
      });
    }
  }

  /**
   * Core message dispatcher and deduplication handler.
   */
  public handleInboundMessage(msg: any): void {
    if (!msg || typeof msg !== 'object') return;

    // Heartbeat ping
    if (msg.type === 'HEARTBEAT' || msg.type === 'PING') {
      this.lastHeartbeatTime = Date.now();
      this.sendWsMessage({ type: 'HEARTBEAT_ACK', timestamp: new Date().toISOString() });
      this.events.emit('HEARTBEAT', { timestamp: this.lastHeartbeatTime });
      return;
    }

    // Replay / Catch-up batch
    if (msg.type === 'SYNC_REPLAY') {
      if (msg.resyncRequired) {
        console.warn('[RealtimeClient] Authoritative resync required by server:', msg.reason);
        this.events.emit('RESYNC_REQUIRED', { reason: msg.reason, currentSequence: msg.currentSequence });
      }
      if (Array.isArray(msg.events)) {
        for (const evt of msg.events) {
          this.processAuthoritativeEvent(evt);
        }
      }
      if (typeof msg.currentSequence === 'number') {
        this.lastReceivedSequence = Math.max(this.lastReceivedSequence, msg.currentSequence);
      }
      return;
    }

    // Subscription authorization rejection
    if (msg.type === 'SUBSCRIPTION_ERROR') {
      console.warn('[RealtimeClient] Subscription rejected by backend:', msg.topic, msg.reason);
      this.events.emit('SUBSCRIPTION_ERROR', { topic: msg.topic, reason: msg.reason });
      return;
    }

    // Standard Real-Time Event
    if (msg.id && msg.type && msg.entityType) {
      this.processAuthoritativeEvent(msg as RealtimeEvent);
    }
  }

  /**
   * Processes an incoming event with strict idempotency and deduplication.
   */
  public processAuthoritativeEvent(evt: RealtimeEvent): boolean {
    if (!evt || !evt.id) return false;

    // Deduplication check: discard if already seen
    if (this.seenEventIds.has(evt.id)) {
      // Duplicate event safely dropped
      this.events.emit('DUPLICATE_DROPPED', { id: evt.id, type: evt.type });
      return false;
    }

    // Record seen ID
    this.seenEventIds.add(evt.id);
    if (this.seenEventIds.size > this.maxSeenIds) {
      const firstId = this.seenEventIds.values().next().value;
      if (firstId) {
        this.seenEventIds.delete(firstId);
      }
    }

    // Advance sequence monotonically
    if (typeof evt.sequence === 'number') {
      this.lastReceivedSequence = Math.max(this.lastReceivedSequence, evt.sequence);
    }

    // Broadcast generic and type-specific events
    this.events.emit('EVENT', evt);
    this.events.emit(evt.type, evt);

    // Entity-level categorized events
    if (evt.entityType === 'USER') {
      this.events.emit('USER_CHANGED', evt);
    } else if (evt.entityType === 'DEPARTMENT') {
      this.events.emit('DEPARTMENT_CHANGED', evt);
    } else if (evt.entityType === 'REPORT') {
      this.events.emit('REPORT_CHANGED', evt);
    } else if (evt.entityType === 'ASSIGNMENT') {
      this.events.emit('ASSIGNMENT_CHANGED', evt);
    } else if (evt.entityType === 'SPECIAL_ACCESS') {
      this.events.emit('SPECIAL_ACCESS_CHANGED', evt);
    } else if (evt.entityType === 'WORKFLOW') {
      this.events.emit('WORKFLOW_CHANGED', evt);
    }

    return true;
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.status === 'CONNECTED') {
        this.sendWsMessage({ type: 'PING', timestamp: Date.now() });
      }
    }, this.options.heartbeatIntervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    this.setStatus('RECONNECTING');
    this.reconnectAttempts++;

    const delay = Math.min(
      this.options.reconnectIntervalMs * Math.pow(1.5, this.reconnectAttempts - 1),
      this.options.maxReconnectIntervalMs
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private setStatus(newStatus: ConnectionStatus): void {
    if (this.status !== newStatus) {
      const prev = this.status;
      this.status = newStatus;
      this.events.emit('STATUS_CHANGED', { current: newStatus, previous: prev });
    }
  }

  /**
   * Disconnects and cleans up resources.
   */
  public disconnect(): void {
    this.setStatus('DISCONNECTED');
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    if (this.sse) {
      try {
        this.sse.close();
      } catch {}
      this.sse = null;
    }
  }

  /**
   * Cleans cached seen IDs and resets sequence for testing.
   */
  public resetClientForTesting(): void {
    this.seenEventIds.clear();
    this.lastReceivedSequence = 0;
    this.subscribedTopics.clear();
    this.disconnect();
    this.events.removeAllListeners();
  }
}

// Global Singleton for application consumption
export const realtimeClient = new RealtimeClient({ autoConnect: true });
