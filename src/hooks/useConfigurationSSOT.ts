/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  DepartmentSSOT,
  ReportDefinitionSSOT,
  RoleSSOT,
  WorkflowDefinitionSSOT,
  ConfigSummary,
} from '../services/configService.ts';
import { realtimeSsotClient } from '../services/realtimeSsotClient.ts';
import type { SsotChangeEvent } from '../types/realtime.ts';

export interface UseConfigurationSSOTReturn {
  departments: DepartmentSSOT[];
  flatDepartments: DepartmentSSOT[];
  reports: ReportDefinitionSSOT[];
  roles: RoleSSOT[];
  workflows: WorkflowDefinitionSSOT[];
  summary: ConfigSummary | null;
  isLoading: boolean;
  error: string | null;
  refreshConfig: () => Promise<void>;
  refreshDepartments: () => Promise<void>;
  refreshReports: () => Promise<void>;
  refreshRoles: () => Promise<void>;
  getAuthorizedReports: (user: { id?: string; role?: string; department?: string }) => Promise<string[]>;
  createDepartment: (deptData: any) => Promise<DepartmentSSOT>;
  updateDepartment: (id: string, updates: any) => Promise<DepartmentSSOT>;
  createReportVersion: (returnKey: string, versionData: any) => Promise<any>;
}

export function useConfigurationSSOT(): UseConfigurationSSOTReturn {
  const [departments, setDepartments] = useState<DepartmentSSOT[]>([]);
  const [flatDepartments, setFlatDepartments] = useState<DepartmentSSOT[]>([]);
  const [reports, setReports] = useState<ReportDefinitionSSOT[]>([]);
  const [roles, setRoles] = useState<RoleSSOT[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowDefinitionSSOT[]>([]);
  const [summary, setSummary] = useState<ConfigSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDepartments = useCallback(async () => {
    try {
      const [deptTreeRes, deptFlatRes] = await Promise.all([
        fetch('/api/config/departments'),
        fetch('/api/config/departments?flat=true'),
      ]);
      if (deptTreeRes.ok) {
        const treeData = await deptTreeRes.json();
        setDepartments(treeData);
      }
      if (deptFlatRes.ok) {
        const flatData = await deptFlatRes.json();
        setFlatDepartments(flatData);
      }
    } catch (err: any) {
      console.warn('[useConfigurationSSOT] Failed refreshing departments:', err);
    }
  }, []);

  const fetchReports = useCallback(async () => {
    try {
      const res = await fetch('/api/config/reports');
      if (res.ok) {
        const reportsData = await res.json();
        setReports(reportsData);
      }
    } catch (err: any) {
      console.warn('[useConfigurationSSOT] Failed refreshing reports:', err);
    }
  }, []);

  const fetchRoles = useCallback(async () => {
    try {
      const res = await fetch('/api/config/roles');
      if (res.ok) {
        const rolesData = await res.json();
        setRoles(rolesData);
      }
    } catch (err: any) {
      console.warn('[useConfigurationSSOT] Failed refreshing roles:', err);
    }
  }, []);

  const fetchWorkflows = useCallback(async () => {
    try {
      const res = await fetch('/api/config/workflows');
      if (res.ok) {
        const wfData = await res.json();
        setWorkflows(wfData);
      }
    } catch (err: any) {
      console.warn('[useConfigurationSSOT] Failed refreshing workflows:', err);
    }
  }, []);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/config/summary');
      if (res.ok) {
        const summaryData = await res.json();
        setSummary(summaryData);
      }
    } catch (err: any) {
      console.warn('[useConfigurationSSOT] Failed refreshing summary:', err);
    }
  }, []);

  const fetchConfiguration = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      await Promise.all([
        fetchDepartments(),
        fetchReports(),
        fetchRoles(),
        fetchWorkflows(),
        fetchSummary(),
      ]);
    } catch (err: any) {
      console.warn('[useConfigurationSSOT] Failed fetching configuration SSOT from backend:', err);
      setError(err.message || 'Failed to load backend configuration.');
    } finally {
      setIsLoading(false);
    }
  }, [fetchDepartments, fetchReports, fetchRoles, fetchWorkflows, fetchSummary]);

  // Connect to Real-time WebSocket and SSE
  useEffect(() => {
    fetchConfiguration();

    // 1. Subscribe to Real-Time SSOT WebSocket engine events
    realtimeSsotClient.connect();
    realtimeSsotClient.subscribe('DEPARTMENTS');
    realtimeSsotClient.subscribe('REPORTS');
    realtimeSsotClient.subscribe('WORKFLOWS');

    const onDeptEvent = (evt: SsotChangeEvent) => {
      console.log('[useConfigurationSSOT] Realtime department update:', evt.action, evt.entityId);
      fetchDepartments();
      fetchSummary();
    };

    const onReportEvent = (evt: SsotChangeEvent) => {
      console.log('[useConfigurationSSOT] Realtime report catalog update:', evt.action, evt.entityId);
      fetchReports();
      fetchSummary();
    };

    const onRoleEvent = (evt: SsotChangeEvent) => {
      console.log('[useConfigurationSSOT] Realtime role/RBAC update:', evt.action);
      fetchRoles();
      fetchSummary();
    };

    const onWorkflowEvent = (evt: SsotChangeEvent) => {
      console.log('[useConfigurationSSOT] Realtime workflow update:', evt.action);
      fetchWorkflows();
      fetchSummary();
    };

    const onRevalidateAll = () => {
      console.log('[useConfigurationSSOT] Revalidating all configuration domains after reconnect');
      fetchConfiguration();
    };

    realtimeSsotClient.events.on('DOMAIN:DEPARTMENT', onDeptEvent);
    realtimeSsotClient.events.on('DOMAIN:REPORT', onReportEvent);
    realtimeSsotClient.events.on('DOMAIN:ASSIGNMENT', onReportEvent);
    realtimeSsotClient.events.on('DOMAIN:RBAC', onRoleEvent);
    realtimeSsotClient.events.on('DOMAIN:WORKFLOW', onWorkflowEvent);
    realtimeSsotClient.events.on('REVALIDATE_ALL', onRevalidateAll);

    // 2. Connect to Server-Sent Events (SSE) stream fallback
    let eventSource: EventSource | null = null;
    try {
      if (typeof EventSource !== 'undefined') {
        eventSource = new EventSource('/api/config/events');
        
        eventSource.addEventListener('config_changed', (evt) => {
          try {
            const payload = JSON.parse(evt.data);
            if (payload?.domain === 'DEPARTMENT') {
              fetchDepartments();
            } else if (payload?.domain === 'REPORT' || payload?.domain === 'ASSIGNMENT') {
              fetchReports();
            } else if (payload?.domain === 'RBAC') {
              fetchRoles();
            } else {
              fetchConfiguration();
            }
          } catch (_) {
            fetchConfiguration();
          }
        });

        eventSource.addEventListener('cache_invalidated', (evt) => {
          fetchConfiguration();
        });

        eventSource.onerror = () => {
          eventSource?.close();
        };
      }
    } catch (e) {
      console.warn('[useConfigurationSSOT] SSE initialization notice:', e);
    }

    return () => {
      realtimeSsotClient.events.off('DOMAIN:DEPARTMENT', onDeptEvent);
      realtimeSsotClient.events.off('DOMAIN:REPORT', onReportEvent);
      realtimeSsotClient.events.off('DOMAIN:ASSIGNMENT', onReportEvent);
      realtimeSsotClient.events.off('DOMAIN:RBAC', onRoleEvent);
      realtimeSsotClient.events.off('DOMAIN:WORKFLOW', onWorkflowEvent);
      realtimeSsotClient.events.off('REVALIDATE_ALL', onRevalidateAll);

      if (eventSource) {
        eventSource.close();
      }
    };
  }, [fetchConfiguration, fetchDepartments, fetchReports, fetchRoles, fetchWorkflows, fetchSummary]);

  const getAuthorizedReports = useCallback(
    async (user: { id?: string; role?: string; department?: string }): Promise<string[]> => {
      try {
        const params = new URLSearchParams();
        if (user.id) params.append('userId', user.id);
        if (user.role) params.append('role', user.role);
        if (user.department) params.append('department', user.department);

        const res = await fetch(`/api/config/authorized-reports?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          return data.authorizedReportKeys || [];
        }
      } catch (err) {
        console.warn('[useConfigurationSSOT] Error resolving authorized reports:', err);
      }
      return [];
    },
    []
  );

  const createDepartment = useCallback(
    async (deptData: any): Promise<DepartmentSSOT> => {
      const res = await fetch('/api/config/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deptData),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to create department.');
      }
      const created = await res.json();
      await fetchDepartments();
      await fetchSummary();
      return created;
    },
    [fetchDepartments, fetchSummary]
  );

  const updateDepartment = useCallback(
    async (id: string, updates: any): Promise<DepartmentSSOT> => {
      const res = await fetch(`/api/config/departments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to update department.');
      }
      const updated = await res.json();
      await fetchDepartments();
      await fetchSummary();
      return updated;
    },
    [fetchDepartments, fetchSummary]
  );

  const createReportVersion = useCallback(
    async (returnKey: string, versionData: any): Promise<any> => {
      const res = await fetch(`/api/config/reports/${returnKey}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(versionData),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to create report version.');
      }
      const result = await res.json();
      await fetchReports();
      await fetchSummary();
      return result;
    },
    [fetchReports, fetchSummary]
  );

  return {
    departments,
    flatDepartments,
    reports,
    roles,
    workflows,
    summary,
    isLoading,
    error,
    refreshConfig: fetchConfiguration,
    refreshDepartments: fetchDepartments,
    refreshReports: fetchReports,
    refreshRoles: fetchRoles,
    getAuthorizedReports,
    createDepartment,
    updateDepartment,
    createReportVersion,
  };
}
