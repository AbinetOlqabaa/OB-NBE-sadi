/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import type {
  DepartmentSSOT,
  ReportDefinitionSSOT,
  RoleSSOT,
  WorkflowDefinitionSSOT,
  ConfigSummary,
} from '../services/configService.ts';

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

  const fetchConfiguration = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [deptTreeRes, deptFlatRes, reportsRes, rolesRes, wfRes, summaryRes] = await Promise.all([
        fetch('/api/config/departments'),
        fetch('/api/config/departments?flat=true'),
        fetch('/api/config/reports'),
        fetch('/api/config/roles'),
        fetch('/api/config/workflows'),
        fetch('/api/config/summary'),
      ]);

      if (deptTreeRes.ok) {
        const treeData = await deptTreeRes.json();
        setDepartments(treeData);
      }
      if (deptFlatRes.ok) {
        const flatData = await deptFlatRes.json();
        setFlatDepartments(flatData);
      }
      if (reportsRes.ok) {
        const reportsData = await reportsRes.json();
        setReports(reportsData);
      }
      if (rolesRes.ok) {
        const rolesData = await rolesRes.json();
        setRoles(rolesData);
      }
      if (wfRes.ok) {
        const wfData = await wfRes.json();
        setWorkflows(wfData);
      }
      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        setSummary(summaryData);
      }
    } catch (err: any) {
      console.warn('[useConfigurationSSOT] Failed fetching configuration SSOT from backend:', err);
      setError(err.message || 'Failed to load backend configuration.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfiguration();

    // Connect to Real-Time Server-Sent Events (SSE) stream for configuration updates
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/config/events');
      
      eventSource.addEventListener('config_changed', (evt) => {
        try {
          const payload = JSON.parse(evt.data);
          console.log('[useConfigurationSSOT] Real-time config change notification received:', payload);
          fetchConfiguration();
        } catch (e) {
          fetchConfiguration();
        }
      });

      eventSource.addEventListener('cache_invalidated', (evt) => {
        try {
          const payload = JSON.parse(evt.data);
          console.log('[useConfigurationSSOT] Cache invalidation event received:', payload);
          fetchConfiguration();
        } catch (e) {
          fetchConfiguration();
        }
      });

      eventSource.onerror = () => {
        // SSE connection failure, fallback to polling if needed
        eventSource?.close();
      };
    } catch (e) {
      console.warn('[useConfigurationSSOT] SSE initialization notice:', e);
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [fetchConfiguration]);

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
      await fetchConfiguration();
      return created;
    },
    [fetchConfiguration]
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
      await fetchConfiguration();
      return updated;
    },
    [fetchConfiguration]
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
      await fetchConfiguration();
      return result;
    },
    [fetchConfiguration]
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
    getAuthorizedReports,
    createDepartment,
    updateDepartment,
    createReportVersion,
  };
}
