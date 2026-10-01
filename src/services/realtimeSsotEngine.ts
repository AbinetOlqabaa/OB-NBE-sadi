/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WebSocket, WebSocketServer } from 'ws';
import type { IncomingMessage } from 'http';
import { BrowserSafeEventEmitter } from '../utils/browserEventEmitter.ts';
import type {
  SsotChangeEvent,
  RealtimeEventType,
  RealtimeDomain,
  EventActor,
  ClientMessage,
  ServerMessage,
} from '../types/realtime.ts';

interface ConnectedClient {
  id: string;
  ws: WebSocket;
  isAlive: boolean;
  authenticated: boolean;
  userId?: string;
  role?: string;
  department?: string;
  subscribedTopics: Set<string>;
  connectedAt: string;
}

export class RealtimeSsotEngine {
  private static instance: RealtimeSsotEngine | null = null;
  public events = new BrowserSafeEventEmitter();

  private wss: WebSocketServer | null = null;
  private clients: Map<string, ConnectedClient> = new Map();
  private eventHistory: Array<SsotChangeEvent<any>> = [];
  private maxHistorySize = 500;
  private sequenceCounter = 0;
  private pingIntervalTimer: NodeJS.Timeout | null = null;

  private constructor() {}

  public static getInstance(): RealtimeSsotEngine {
    if (!RealtimeSsotEngine.instance) {
      RealtimeSsotEngine.instance = new RealtimeSsotEngine();
    }
    return RealtimeSsotEngine.instance;
  }

  /**
   * Attach WebSocket server to an existing HTTP server
   */
  public attachServer(server: any, path: string = '/ws/ssot'): void {
    if (this.wss) {
      console.log('[RealtimeSsotEngine] WebSocket server already attached');
      return;
    }

    this.wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', (request: IncomingMessage, socket: any, head: Buffer) => {
      const url = request.url || '';
      if (url.startsWith(path) || url.startsWith('/ws')) {
        this.wss!.handleUpgrade(request, socket, head, (ws) => {
          this.wss!.emit('connection', ws, request);
        });
      }
    });

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      this.handleConnection(ws, req);
    });

    // Start heartbeat timer (every 25 seconds)
    if (!this.pingIntervalTimer) {
      this.pingIntervalTimer = setInterval(() => {
        this.checkHeartbeats();
      }, 25000);
    }

    console.log(`[RealtimeSsotEngine] WebSocket Server mounted at ${path}`);
  }

  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const client: ConnectedClient = {
      id: clientId,
      ws,
      isAlive: true,
      authenticated: false,
      subscribedTopics: new Set(['GLOBAL']), // Default global broadcast topic
      connectedAt: new Date().toISOString(),
    };

    this.clients.set(clientId, client);

    ws.on('pong', () => {
      client.isAlive = true;
    });

    ws.on('message', (data: any) => {
      try {
        const message: ClientMessage = JSON.parse(data.toString());
        this.processClientMessage(client, message);
      } catch (err: any) {
        this.sendToClient(client, {
          type: 'ERROR',
          message: `Malformed message payload: ${err.message}`,
        });
      }
    });

    ws.on('close', () => {
      this.clients.delete(clientId);
    });

    ws.on('error', (err) => {
      console.warn(`[RealtimeSsotEngine] Client socket error (${clientId}):`, err.message);
      this.clients.delete(clientId);
    });
  }

  private checkHeartbeats(): void {
    for (const [id, client] of this.clients.entries()) {
      if (!client.isAlive) {
        try {
          client.ws.terminate();
        } catch (_) {}
        this.clients.delete(id);
        continue;
      }
      client.isAlive = false;
      try {
        client.ws.ping();
      } catch (_) {}
    }
  }

  /**
   * Process incoming client message according to protocol
   */
  public processClientMessage(client: ConnectedClient, msg: ClientMessage): void {
    switch (msg.type) {
      case 'AUTH': {
        const { userId, role, department } = msg;
        client.authenticated = true;
        client.userId = userId || 'usr_anonymous';
        client.role = role || 'VIEWER';
        client.department = department || 'General';

        // Auto-subscribe to default topics based on user identity
        client.subscribedTopics.add('GLOBAL');
        client.subscribedTopics.add('DEPARTMENTS');
        client.subscribedTopics.add('REPORTS');
        client.subscribedTopics.add('WORKFLOWS');
        if (client.userId) {
          client.subscribedTopics.add(`USER:${client.userId}`);
        }
        if (client.department) {
          client.subscribedTopics.add(`DEPT:${client.department}`);
        }
        if (client.role === 'ADMIN') {
          client.subscribedTopics.add('ADMIN:CONFIG');
          client.subscribedTopics.add('AUDIT:EVENTS');
        } else if (client.role === 'AUDITOR') {
          client.subscribedTopics.add('AUDIT:EVENTS');
        }

        const authorizedTopics = Array.from(client.subscribedTopics);
        this.sendToClient(client, {
          type: 'AUTH_SUCCESS',
          session: {
            userId: client.userId,
            role: client.role,
            authorizedTopics,
          },
        });
        break;
      }

      case 'SUBSCRIBE': {
        const topic = (msg.topic || '').trim().toUpperCase();
        if (!topic) {
          this.sendToClient(client, {
            type: 'SUBSCRIBE_REJECTED',
            topic: msg.topic,
            reason: 'Topic cannot be empty',
          });
          return;
        }

        // Authorization check
        const authResult = this.authorizeSubscription(client, topic);
        if (!authResult.allowed) {
          this.sendToClient(client, {
            type: 'SUBSCRIBE_REJECTED',
            topic,
            reason: authResult.reason,
          });
          return;
        }

        client.subscribedTopics.add(topic);
        this.sendToClient(client, {
          type: 'SUBSCRIBE_ACK',
          topic,
        });
        break;
      }

      case 'UNSUBSCRIBE': {
        const topic = (msg.topic || '').trim().toUpperCase();
        client.subscribedTopics.delete(topic);
        this.sendToClient(client, {
          type: 'UNSUBSCRIBE_ACK',
          topic,
        });
        break;
      }

      case 'PING': {
        client.isAlive = true;
        this.sendToClient(client, {
          type: 'PONG',
          timestamp: msg.timestamp || Date.now(),
        });
        break;
      }

      case 'SYNC_REQUEST': {
        const { lastSequenceNumber, lastHash } = msg;
        const currentHash = this.getGlobalHash();
        const currentSequence = this.sequenceCounter;

        if (
          lastSequenceNumber !== undefined &&
          lastSequenceNumber >= 0 &&
          this.eventHistory.length > 0 &&
          lastSequenceNumber >= this.eventHistory[0].sequenceNumber
        ) {
          // Missed events are still in history buffer
          const missed = this.eventHistory.filter(
            (e) => e.sequenceNumber > lastSequenceNumber && this.isClientAuthorizedForEvent(client, e)
          );

          this.sendToClient(client, {
            type: 'SYNC_RESPONSE',
            currentHash,
            currentSequence,
            missedEvents: missed,
            requiresFullRevalidation: false,
          });
        } else {
          // Gap is too wide or no sequence provided; client must revalidate authoritative domains
          this.sendToClient(client, {
            type: 'SYNC_RESPONSE',
            currentHash,
            currentSequence,
            missedEvents: [],
            requiresFullRevalidation: true,
          });
        }
        break;
      }
    }
  }

  /**
   * Verifies if a client is authorized to subscribe to a topic
   */
  public authorizeSubscription(
    client: { userId?: string; role?: string; department?: string },
    topic: string
  ): { allowed: boolean; reason: string } {
    const role = client.role || 'VIEWER';
    const userId = client.userId || '';
    const userDept = client.department || '';

    // Public / general topics
    if (['GLOBAL', 'DEPARTMENTS', 'REPORTS', 'WORKFLOWS'].includes(topic)) {
      return { allowed: true, reason: 'Public operational topic' };
    }

    // Admin exclusive topic
    if (topic === 'ADMIN:CONFIG') {
      if (role === 'ADMIN') {
        return { allowed: true, reason: 'Admin authorized' };
      }
      return { allowed: false, reason: 'Insufficient privileges: ADMIN role required' };
    }

    // Audit topic
    if (topic === 'AUDIT:EVENTS') {
      if (role === 'ADMIN' || role === 'AUDITOR') {
        return { allowed: true, reason: 'Auditor authorized' };
      }
      return { allowed: false, reason: 'Insufficient privileges: AUDITOR or ADMIN role required' };
    }

    // User private topic: USER:<id>
    if (topic.startsWith('USER:')) {
      const targetUserId = topic.substring(5);
      if (role === 'ADMIN' || targetUserId === userId) {
        return { allowed: true, reason: 'Authorized user channel' };
      }
      return { allowed: false, reason: 'Access denied: cannot subscribe to another user channel' };
    }

    // Department topic: DEPT:<deptId>
    if (topic.startsWith('DEPT:')) {
      const targetDept = topic.substring(5);
      if (role === 'ADMIN' || role === 'AUDITOR' || userDept.toUpperCase() === targetDept.toUpperCase()) {
        return { allowed: true, reason: 'Authorized department channel' };
      }
      return { allowed: false, reason: 'Access denied: department mismatch' };
    }

    // Custom report topic: REPORT:<returnKey>
    if (topic.startsWith('REPORT:')) {
      return { allowed: true, reason: 'Report topic authorized' };
    }

    return { allowed: false, reason: `Unknown or restricted topic '${topic}'` };
  }

  /**
   * Sanitize event payload to ensure no sensitive credentials or hashes leak
   */
  public sanitizePayload(payload: any): any {
    if (!payload || typeof payload !== 'object') return payload;
    const sanitized = JSON.parse(JSON.stringify(payload));

    const sensitiveKeys = [
      'password',
      'passwordHash',
      'password_hash',
      'salt',
      'secret',
      'token',
      'authToken',
      'refreshToken',
      'totpSecret',
    ];

    const stripKeys = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;
      for (const key of Object.keys(obj)) {
        if (sensitiveKeys.includes(key)) {
          delete obj[key];
        } else if (typeof obj[key] === 'object') {
          stripKeys(obj[key]);
        }
      }
    };

    stripKeys(sanitized);
    return sanitized;
  }

  /**
   * Publishes an authoritative, successfully committed change event
   */
  public publishEvent<T = any>(params: {
    eventType: RealtimeEventType;
    action: string;
    domain: RealtimeDomain;
    entityId: string;
    topic?: string;
    actor?: EventActor;
    summary: string;
    globalConfigHash?: string;
    payload?: T;
  }): SsotChangeEvent<T> {
    this.sequenceCounter++;

    const topic = (params.topic || this.resolveDefaultTopic(params.domain, params.entityId)).toUpperCase();
    const event: SsotChangeEvent<T> = {
      eventId: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      sequenceNumber: this.sequenceCounter,
      eventType: params.eventType,
      action: params.action,
      domain: params.domain,
      entityId: params.entityId,
      topic,
      timestamp: new Date().toISOString(),
      actor: params.actor || {
        id: 'sys_ssot',
        name: 'System SSOT Kernel',
        role: 'SYSTEM',
      },
      summary: params.summary,
      globalConfigHash: params.globalConfigHash || this.getGlobalHash(),
      payload: this.sanitizePayload(params.payload || {}),
    };

    // Store in bounded history buffer
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    // Broadcast to authorized connected WebSocket clients
    this.broadcastEvent(event);

    // Emit on local node event bus (for SSE and in-process subscribers)
    this.events.emit('SSOT_EVENT', event);
    this.events.emit(event.eventType, event);

    return event;
  }

  private resolveDefaultTopic(domain: RealtimeDomain, entityId: string): string {
    switch (domain) {
      case 'USER':
        return `USER:${entityId}`;
      case 'DEPARTMENT':
        return 'DEPARTMENTS';
      case 'REPORT':
        return 'REPORTS';
      case 'WORKFLOW':
        return 'WORKFLOWS';
      case 'SPECIAL_ACCESS':
        return `USER:${entityId}`;
      case 'ASSIGNMENT':
        return 'REPORTS';
      case 'RBAC':
        return 'ADMIN:CONFIG';
      default:
        return 'GLOBAL';
    }
  }

  private isClientAuthorizedForEvent(client: ConnectedClient, event: SsotChangeEvent): boolean {
    // If client subscribed to the specific topic
    if (client.subscribedTopics.has(event.topic)) {
      return true;
    }
    // If client subscribed to GLOBAL and event topic is GLOBAL
    if (client.subscribedTopics.has('GLOBAL') && event.topic === 'GLOBAL') {
      return true;
    }
    // Admin receives all events
    if (client.role === 'ADMIN') {
      return true;
    }
    // Auditor receives all workflow, report and audit events
    if (client.role === 'AUDITOR' && ['REPORTS', 'WORKFLOWS', 'AUDIT:EVENTS'].includes(event.topic)) {
      return true;
    }
    return false;
  }

  private broadcastEvent(event: SsotChangeEvent<any>): void {
    const payloadStr = JSON.stringify({
      type: 'EVENT',
      event,
    });

    for (const client of this.clients.values()) {
      if (this.isClientAuthorizedForEvent(client, event)) {
        this.sendRaw(client, payloadStr);
      }
    }
  }

  private sendToClient(client: ConnectedClient, message: ServerMessage): void {
    this.sendRaw(client, JSON.stringify(message));
  }

  private sendRaw(client: ConnectedClient, str: string): void {
    if (client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(str);
      } catch (e: any) {
        console.warn(`[RealtimeSsotEngine] Failed sending to client ${client.id}:`, e.message);
      }
    }
  }

  private hashProvider: (() => string) | null = null;

  public setHashProvider(provider: () => string): void {
    this.hashProvider = provider;
  }

  public getGlobalHash(): string {
    if (this.hashProvider) {
      try {
        return this.hashProvider();
      } catch (_) {}
    }
    return `ssot_seq_${this.sequenceCounter}`;
  }

  public getConnectedClientsCount(): number {
    return this.clients.size;
  }

  public getRecentEvents(limit: number = 50): SsotChangeEvent[] {
    return this.eventHistory.slice(-limit);
  }

  public clearHistory(): void {
    this.eventHistory = [];
    this.sequenceCounter = 0;
  }
}

export const realtimeSsotEngine = RealtimeSsotEngine.getInstance();
