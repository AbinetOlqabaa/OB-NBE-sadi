/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  realtimeSsotClient,
  ConnectionStatus,
} from '../services/realtimeSsotClient.ts';
import type { SsotChangeEvent, RealtimeDomain, RealtimeEventType } from '../types/realtime.ts';

export interface UseRealtimeSSOTOptions {
  user?: { id?: string; role?: string; department?: string } | null;
  domains?: RealtimeDomain[];
  onEvent?: (event: SsotChangeEvent) => void;
  onDomainChange?: (domain: RealtimeDomain, event: SsotChangeEvent) => void;
}

export function useRealtimeSSOT(options: UseRealtimeSSOTOptions = {}) {
  const [status, setStatus] = useState<ConnectionStatus>(realtimeSsotClient.getStatus());
  const [lastEvent, setLastEvent] = useState<SsotChangeEvent | null>(null);
  const [lastHash, setLastHash] = useState<string>(realtimeSsotClient.getLastHash());

  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    // Synchronize session credentials if provided
    if (options.user?.id) {
      realtimeSsotClient.setUserSession({
        userId: options.user.id,
        role: options.user.role || 'VIEWER',
        department: options.user.department || 'General',
      });
    }

    // Connect to WebSocket stream if not already connected
    realtimeSsotClient.connect();

    // Subscribe to requested domains/topics
    if (options.domains && options.domains.length > 0) {
      for (const domain of options.domains) {
        if (domain === 'DEPARTMENT') realtimeSsotClient.subscribe('DEPARTMENTS');
        if (domain === 'REPORT') realtimeSsotClient.subscribe('REPORTS');
        if (domain === 'WORKFLOW') realtimeSsotClient.subscribe('WORKFLOWS');
        if (domain === 'RBAC') realtimeSsotClient.subscribe('ADMIN:CONFIG');
      }
    }

    const onStatusChange = (newStatus: ConnectionStatus) => {
      setStatus(newStatus);
    };

    const onEventReceived = (evt: SsotChangeEvent) => {
      setLastEvent(evt);
      if (evt.globalConfigHash) {
        setLastHash(evt.globalConfigHash);
      }

      // Check if event matches targeted domains
      if (
        !optionsRef.current.domains ||
        optionsRef.current.domains.length === 0 ||
        optionsRef.current.domains.includes(evt.domain)
      ) {
        if (optionsRef.current.onEvent) {
          optionsRef.current.onEvent(evt);
        }
        if (optionsRef.current.onDomainChange) {
          optionsRef.current.onDomainChange(evt.domain, evt);
        }
      }
    };

    const onRevalidateAll = (payload: any) => {
      if (payload?.currentHash) {
        setLastHash(payload.currentHash);
      }
      if (optionsRef.current.onEvent) {
        optionsRef.current.onEvent({
          eventId: `revalidate_${Date.now()}`,
          sequenceNumber: 0,
          eventType: 'CONFIG_SYNC_TRIGGER',
          action: 'REVALIDATE_ALL',
          domain: 'REPORT',
          entityId: 'ALL',
          topic: 'GLOBAL',
          timestamp: new Date().toISOString(),
          actor: { id: 'sys', name: 'System', role: 'SYSTEM' },
          summary: 'Authoritative state revalidation triggered after reconnect gap',
          globalConfigHash: payload?.currentHash || '',
          payload: {},
        });
      }
    };

    realtimeSsotClient.events.on('STATUS_CHANGE', onStatusChange);
    realtimeSsotClient.events.on('EVENT', onEventReceived);
    realtimeSsotClient.events.on('REVALIDATE_ALL', onRevalidateAll);

    return () => {
      realtimeSsotClient.events.off('STATUS_CHANGE', onStatusChange);
      realtimeSsotClient.events.off('EVENT', onEventReceived);
      realtimeSsotClient.events.off('REVALIDATE_ALL', onRevalidateAll);
    };
  }, [options.user?.id, options.user?.role, options.user?.department]);

  const sendEvent = useCallback((event: any) => {
    realtimeSsotClient.send(event);
  }, []);

  return {
    status,
    lastEvent,
    lastHash,
    sendEvent,
  };
}
