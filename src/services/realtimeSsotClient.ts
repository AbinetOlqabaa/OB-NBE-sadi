/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserSafeEventEmitter } from '../utils/browserEventEmitter.ts';
import type {
  SsotChangeEvent,
  RealtimeEventType,
  RealtimeDomain,
  ClientMessage,
  ServerMessage,
} from '../types/realtime.ts';

export type ConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING';

export interface RealtimeClientOptions {
  wsUrl?: string;
  autoReconnect?: boolean;
  maxReconnectDelayMs?: number;
  initialReconnectDelayMs?: number;
}

export class RealtimeSsotClient {
  private static instance: RealtimeSsotClient | null = null;
  public events = new BrowserSafeEventEmitter();

  private ws: any = null; // WebSocket | null
  private status: ConnectionStatus = 'DISCONNECTED';
  private userSession: { userId: string; role: string; department: string } | null = null;
  private subscribedTopics: Set<string> = new Set(['GLOBAL']);

  // Deduplication cache (stores up to 1000 recently processed event IDs)
  private processedEventIds: Set<string> = new Set();
  private processedEventHistory: string[] = [];
  private maxDedupCacheSize = 1000;

  // Stale state tracking
  private lastObservedSequence = 0;
  private lastObservedHash = '';
  private reconnectAttempts = 0;
  private reconnectTimer: any = null;
  private pingTimer: any = null;

  private options: Required<RealtimeClientOptions>;

  private constructor(options: RealtimeClientOptions = {}) {
    this.options = {
      wsUrl: options.wsUrl || this.getDefaultWsUrl(),
      autoReconnect: options.autoReconnect !== false,
      maxReconnectDelayMs: options.maxReconnectDelayMs || 10000,
      initialReconnectDelayMs: options.initialReconnectDelayMs || 1000,
    };
  }

  public static getInstance(options?: RealtimeClientOptions): RealtimeSsotClient {
    if (!RealtimeSsotClient.instance) {
      RealtimeSsotClient.instance = new RealtimeSsotClient(options);
    }
    return RealtimeSsotClient.instance;
  }

  private getDefaultWsUrl(): string {
    if (typeof window !== 'undefined' && window.location) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${window.location.host}/ws/ssot`;
    }
    return 'ws://127.0.0.1:3000/ws/ssot';
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  public getLastSequence(): number {
    return this.lastObservedSequence;
  }

  public getLastHash(): string {
    return this.lastObservedHash;
  }

  /**
   * Set authenticated user session for role-scoped subscriptions
   */
  public setUserSession(session: { userId: string; role: string; department: string } | null): void {
    this.userSession = session;
    if (this.status === 'CONNECTED' && session) {
      this.send({
        type: 'AUTH',
        userId: session.userId,
        role: session.role,
        department: session.department,
      });
    }
  }

  /**
   * Connect to authoritative WebSocket stream
   */
  public connect(): void {
    if (this.status === 'CONNECTED' || this.status === 'CONNECTING') {
      return;
    }

    if (typeof WebSocket === 'undefined') {
      console.warn('[RealtimeSsotClient] WebSocket environment unavailable in this runtime.');
      return;
    }

    this.setStatus(this.reconnectAttempts > 0 ? 'RECONNECTING' : 'CONNECTING');

    try {
      this.ws = new WebSocket(this.options.wsUrl);

      this.ws.onopen = () => {
        this.setStatus('CONNECTED');
        this.reconnectAttempts = 0;

        // Send AUTH if session exists
        if (this.userSession) {
          this.send({
            type: 'AUTH',
            userId: this.userSession.userId,
            role: this.userSession.role,
            department: this.userSession.department,
          });
        }

        // Re-subscribe to any previously active topics
        for (const topic of this.subscribedTopics) {
          if (topic !== 'GLOBAL') {
            this.send({ type: 'SUBSCRIBE', topic });
          }
        }

        // Send SYNC_REQUEST to recover any missed events during disconnect
        this.send({
          type: 'SYNC_REQUEST',
          lastSequenceNumber: this.lastObservedSequence,
          lastHash: this.lastObservedHash,
        });

        // Setup ping timer
        this.startHeartbeat();
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const msg: ServerMessage = JSON.parse(event.data);
          this.handleServerMessage(msg);
        } catch (err: any) {
          console.warn('[RealtimeSsotClient] Failed parsing incoming message:', err.message);
        }
      };

      this.ws.onclose = () => {
        this.stopHeartbeat();
        this.setStatus('DISCONNECTED');
        if (this.options.autoReconnect) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (err: any) => {
        console.warn('[RealtimeSsotClient] Connection notice:', err.message || 'socket error');
      };
    } catch (e: any) {
      console.warn('[RealtimeSsotClient] Connection creation notice:', e.message);
      this.setStatus('DISCONNECTED');
      if (this.options.autoReconnect) {
        this.scheduleReconnect();
      }
    }
  }

  public disconnect(): void {
    this.options.autoReconnect = false;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch (_) {}
      this.ws = null;
    }
    this.setStatus('DISCONNECTED');
  }

  private setStatus(newStatus: ConnectionStatus): void {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.events.emit('STATUS_CHANGE', newStatus);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    this.reconnectAttempts++;
    const backoff = Math.min(
      this.options.initialReconnectDelayMs * Math.pow(1.5, this.reconnectAttempts - 1),
      this.options.maxReconnectDelayMs
    );
    const jitter = Math.random() * 500;
    const delay = Math.round(backoff + jitter);

    this.setStatus('RECONNECTING');
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingTimer = setInterval(() => {
      if (this.status === 'CONNECTED') {
        this.send({ type: 'PING', timestamp: Date.now() });
      }
    }, 20000);
  }

  private stopHeartbeat(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  public send(msg: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(msg));
      } catch (err: any) {
        console.warn('[RealtimeSsotClient] Send error:', err.message);
      }
    }
  }

  public subscribe(topic: string): void {
    const norm = (topic || '').trim().toUpperCase();
    this.subscribedTopics.add(norm);
    if (this.status === 'CONNECTED') {
      this.send({ type: 'SUBSCRIBE', topic: norm });
    }
  }

  public unsubscribe(topic: string): void {
    const norm = (topic || '').trim().toUpperCase();
    this.subscribedTopics.delete(norm);
    if (this.status === 'CONNECTED') {
      this.send({ type: 'UNSUBSCRIBE', topic: norm });
    }
  }

  /**
   * Handle incoming messages from the authoritative server
   */
  public handleServerMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case 'AUTH_SUCCESS':
        this.events.emit('AUTH_SUCCESS', msg.session);
        break;

      case 'AUTH_ERROR':
        this.events.emit('AUTH_ERROR', msg.message);
        break;

      case 'SUBSCRIBE_ACK':
        this.events.emit('SUBSCRIBE_ACK', msg.topic);
        break;

      case 'SUBSCRIBE_REJECTED':
        this.events.emit('SUBSCRIBE_REJECTED', { topic: msg.topic, reason: msg.reason });
        break;

      case 'EVENT':
        this.processEvent(msg.event);
        break;

      case 'SYNC_RESPONSE':
        this.handleSyncResponse(msg);
        break;

      case 'PONG':
        // Heartbeat confirmed
        break;

      case 'ERROR':
        console.warn('[RealtimeSsotClient] Server error message:', msg.message);
        this.events.emit('SERVER_ERROR', msg);
        break;
    }
  }

  /**
   * Idempotent event processor with deduplication check
   */
  public processEvent(event: SsotChangeEvent): boolean {
    if (!event || !event.eventId) return false;

    // Deduplication check: if seen before, discard immediately
    if (this.processedEventIds.has(event.eventId)) {
      this.events.emit('DUPLICATE_EVENT_DROPPED', event);
      return false;
    }

    // Mark as processed
    this.processedEventIds.add(event.eventId);
    this.processedEventHistory.push(event.eventId);
    if (this.processedEventHistory.length > this.maxDedupCacheSize) {
      const oldestId = this.processedEventHistory.shift();
      if (oldestId) this.processedEventIds.delete(oldestId);
    }

    // Sequence tracking
    if (event.sequenceNumber > this.lastObservedSequence) {
      this.lastObservedSequence = event.sequenceNumber;
    }
    if (event.globalConfigHash) {
      this.lastObservedHash = event.globalConfigHash;
    }

    // Emit event on bus
    this.events.emit('EVENT', event);
    this.events.emit(event.eventType, event);
    this.events.emit(`DOMAIN:${event.domain}`, event);

    return true;
  }

  private handleSyncResponse(resp: {
    currentHash: string;
    currentSequence: number;
    missedEvents: SsotChangeEvent[];
    requiresFullRevalidation: boolean;
  }): void {
    if (resp.requiresFullRevalidation) {
      // Gap is too wide; trigger full revalidation on domain listeners
      this.lastObservedSequence = resp.currentSequence;
      this.lastObservedHash = resp.currentHash;
      this.events.emit('REVALIDATE_ALL', {
        reason: 'SYNC_GAP_FULL_REVALIDATION',
        currentHash: resp.currentHash,
      });
      return;
    }

    // Process all missed events idempotently in sequence
    for (const evt of resp.missedEvents) {
      this.processEvent(evt);
    }

    this.lastObservedSequence = resp.currentSequence;
    this.lastObservedHash = resp.currentHash;
  }

  /**
   * Explicitly purge deduplication cache (useful for testing or cache reset)
   */
  public clearDedupCache(): void {
    this.processedEventIds.clear();
    this.processedEventHistory = [];
  }
}

export const realtimeSsotClient = RealtimeSsotClient.getInstance();
