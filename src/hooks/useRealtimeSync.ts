/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  realtimeClient,
  type ConnectionStatus,
} from '../services/realtimeClient.ts';
import type {
  RealtimeEvent,
  ClientSubscriberIdentity,
  RealtimeEventType,
} from '../services/realtimeSyncEngine.ts';

export interface UseRealtimeSyncOptions {
  user?: ClientSubscriberIdentity | null;
  customTopics?: string[];
  onEvent?: (event: RealtimeEvent) => void;
  onUserChanged?: (event: RealtimeEvent) => void;
  onDepartmentChanged?: (event: RealtimeEvent) => void;
  onReportChanged?: (event: RealtimeEvent) => void;
  onAssignmentChanged?: (event: RealtimeEvent) => void;
  onSpecialAccessChanged?: (event: RealtimeEvent) => void;
  onWorkflowChanged?: (event: RealtimeEvent) => void;
  onResyncRequired?: (info: { reason?: string; currentSequence: number }) => void;
}

export interface UseRealtimeSyncReturn {
  status: ConnectionStatus;
  isConnected: boolean;
  lastSequence: number;
  lastHeartbeat: number;
  lastEvent: RealtimeEvent | null;
  subscribeTopic: (topic: string) => void;
  unsubscribeTopic: (topic: string) => void;
  reconnect: () => void;
}

export function useRealtimeSync(options: UseRealtimeSyncOptions = {}): UseRealtimeSyncReturn {
  const [status, setStatus] = useState<ConnectionStatus>(realtimeClient.getStatus());
  const [lastSequence, setLastSequence] = useState<number>(realtimeClient.getLastSequence());
  const [lastHeartbeat, setLastHeartbeat] = useState<number>(realtimeClient.getLastHeartbeat());
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    // 1. Configure Authenticated Identity & Channel Subscriptions
    if (options.user) {
      realtimeClient.setUser(options.user);

      // Default system-wide topic
      realtimeClient.subscribeTopic('system:all');

      // Department-scoped topic
      if (options.user.department) {
        realtimeClient.subscribeTopic(`department:${options.user.department}`);
      }

      // User-private topic
      if (options.user.id) {
        realtimeClient.subscribeTopic(`user:${options.user.id}`);
      }

      // Admin governance topic
      if (options.user.role === 'ADMIN' || options.user.role === 'SUPER_ADMIN') {
        realtimeClient.subscribeTopic('admin:governance');
      }
    }

    // Custom topics
    if (options.customTopics && options.customTopics.length > 0) {
      for (const t of options.customTopics) {
        realtimeClient.subscribeTopic(t);
      }
    }

    // Connect
    realtimeClient.connect();

    // 2. Wire Listeners
    const handleStatusChanged = (info: { current: ConnectionStatus }) => {
      setStatus(info.current);
    };

    const handleHeartbeat = (info: { timestamp: number }) => {
      setLastHeartbeat(info.timestamp);
    };

    const handleAnyEvent = (evt: RealtimeEvent) => {
      setLastEvent(evt);
      setLastSequence(evt.sequence);
      optionsRef.current.onEvent?.(evt);
    };

    const handleUserChanged = (evt: RealtimeEvent) => {
      optionsRef.current.onUserChanged?.(evt);
    };

    const handleDepartmentChanged = (evt: RealtimeEvent) => {
      optionsRef.current.onDepartmentChanged?.(evt);
    };

    const handleReportChanged = (evt: RealtimeEvent) => {
      optionsRef.current.onReportChanged?.(evt);
    };

    const handleAssignmentChanged = (evt: RealtimeEvent) => {
      optionsRef.current.onAssignmentChanged?.(evt);
    };

    const handleSpecialAccessChanged = (evt: RealtimeEvent) => {
      optionsRef.current.onSpecialAccessChanged?.(evt);
    };

    const handleWorkflowChanged = (evt: RealtimeEvent) => {
      optionsRef.current.onWorkflowChanged?.(evt);
    };

    const handleResyncRequired = (info: { reason?: string; currentSequence: number }) => {
      optionsRef.current.onResyncRequired?.(info);
    };

    realtimeClient.events.on('STATUS_CHANGED', handleStatusChanged);
    realtimeClient.events.on('HEARTBEAT', handleHeartbeat);
    realtimeClient.events.on('EVENT', handleAnyEvent);
    realtimeClient.events.on('USER_CHANGED', handleUserChanged);
    realtimeClient.events.on('DEPARTMENT_CHANGED', handleDepartmentChanged);
    realtimeClient.events.on('REPORT_CHANGED', handleReportChanged);
    realtimeClient.events.on('ASSIGNMENT_CHANGED', handleAssignmentChanged);
    realtimeClient.events.on('SPECIAL_ACCESS_CHANGED', handleSpecialAccessChanged);
    realtimeClient.events.on('WORKFLOW_CHANGED', handleWorkflowChanged);
    realtimeClient.events.on('RESYNC_REQUIRED', handleResyncRequired);

    return () => {
      realtimeClient.events.off('STATUS_CHANGED', handleStatusChanged);
      realtimeClient.events.off('HEARTBEAT', handleHeartbeat);
      realtimeClient.events.off('EVENT', handleAnyEvent);
      realtimeClient.events.off('USER_CHANGED', handleUserChanged);
      realtimeClient.events.off('DEPARTMENT_CHANGED', handleDepartmentChanged);
      realtimeClient.events.off('REPORT_CHANGED', handleReportChanged);
      realtimeClient.events.off('ASSIGNMENT_CHANGED', handleAssignmentChanged);
      realtimeClient.events.off('SPECIAL_ACCESS_CHANGED', handleSpecialAccessChanged);
      realtimeClient.events.off('WORKFLOW_CHANGED', handleWorkflowChanged);
      realtimeClient.events.off('RESYNC_REQUIRED', handleResyncRequired);
    };
  }, [options.user?.id, options.user?.role, options.user?.department]);

  const subscribeTopic = useCallback((topic: string) => {
    realtimeClient.subscribeTopic(topic);
  }, []);

  const unsubscribeTopic = useCallback((topic: string) => {
    realtimeClient.unsubscribeTopic(topic);
  }, []);

  const reconnect = useCallback(() => {
    realtimeClient.connect();
  }, []);

  return {
    status,
    isConnected: status === 'CONNECTED',
    lastSequence,
    lastHeartbeat,
    lastEvent,
    subscribeTopic,
    unsubscribeTopic,
    reconnect,
  };
}
