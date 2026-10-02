/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import {
  indexedDbStorage,
  type OfflineDraftRecord,
  type OfflineAuditRecord,
} from '../services/indexedDbStorage.ts';
import { submissionService } from '../services/submissionService.ts';
import { auditService } from '../services/auditService.ts';
import type { OfflineStorageStats } from '../types/regulatory.ts';
import { vibrate } from '../utils/haptics.ts';

const SITE_VISIT_STORAGE_KEY = 'ob_remote_site_visit_mode';

export function useOfflineStorage() {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? Boolean(navigator.onLine) : true;
  });

  const [isRemoteSiteVisitMode, setIsRemoteSiteVisitMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SITE_VISIT_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [stats, setStats] = useState<OfflineStorageStats>({
    draftCount: 0,
    auditCount: 0,
    pendingDrafts: 0,
    pendingAuditLogs: 0,
    isIndexedDBSupported: indexedDbStorage.isBrowserIndexedDBAvailable(),
    storageName: 'OromiaBank_NBE_Regulatory_DB',
    lastSyncTimestamp: null,
  });

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // When either network drops OR remote site visit mode is explicitly toggled
  const isEffectiveOffline = !isOnline || isRemoteSiteVisitMode;

  // Refresh storage statistics
  const refreshStats = useCallback(async () => {
    try {
      const currentStats = await indexedDbStorage.getStorageStats();
      setStats(currentStats);
    } catch (err) {
      console.warn('[useOfflineStorage] Error reading storage stats:', err);
    }
  }, []);

  // Listen for browser online / offline network events
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOnline(true);
      refreshStats();
    };

    const handleOffline = () => {
      setIsOnline(false);
      refreshStats();
      vibrate([40, 50, 40]);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Subscribe to IndexedDB changes
    const unsub = indexedDbStorage.subscribe(() => {
      refreshStats();
    });

    refreshStats();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsub();
    };
  }, [refreshStats]);

  // Toggle Remote NBE Regulatory Site Visit mode
  const toggleRemoteSiteVisitMode = useCallback((forceState?: boolean) => {
    setIsRemoteSiteVisitMode((prev) => {
      const next = forceState !== undefined ? forceState : !prev;
      try {
        localStorage.setItem(SITE_VISIT_STORAGE_KEY, String(next));
      } catch {}

      // Record audit log for regulatory compliance and transparency
      auditService.log({
        actorId: 'bio_officer',
        actorName: 'Regulatory Examiner',
        actorRole: 'MAKER',
        action: next ? 'REMOTE_SITE_VISIT_MODE_ENABLED' : 'REMOTE_SITE_VISIT_MODE_DISABLED',
        entityType: 'DEVICE_STORAGE',
        entityId: 'OB_INDEXEDDB_STORAGE',
        correlationId: `site_visit_${Date.now()}`,
        details: next
          ? '[NBE Directive BSD/03/2020 Compliance] Switched into Remote NBE Regulatory Site Visit Mode (Simulated Network Loss). All return drafts and audit logs will be preserved in IndexedDB offline storage.'
          : '[NBE Directive BSD/03/2020 Compliance] Returned to Central Online Server Mode. Ready to synchronize IndexedDB offline drafts and audit logs with Addis Ababa HQ.',
      });

      vibrate(next ? [30, 40] : [20, 20]);
      return next;
    });
  }, []);

  // Full synchronization with Central Server
  const syncWithServer = useCallback(async (): Promise<{
    success: boolean;
    syncedDrafts: number;
    syncedAuditLogs: number;
    error?: string;
  }> => {
    if (isSyncing) {
      return { success: false, syncedDrafts: 0, syncedAuditLogs: 0, error: 'Sync already in progress' };
    }

    setIsSyncing(true);
    setSyncFeedback('Connecting to Central Regulatory Server...');

    try {
      // 1. Sync pending drafts
      const draftResult = await submissionService.syncPendingDraftsWithServer();

      // 2. Sync pending audit logs
      const pendingLogs = await indexedDbStorage.getPendingAuditLogs();
      let syncedAuditLogsCount = 0;

      if (pendingLogs.length > 0) {
        setSyncFeedback(`Uploading ${pendingLogs.length} audit logs from remote site visit...`);
        const res = await fetch('/api/audit-logs/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ logs: pendingLogs }),
        });

        if (res.ok) {
          const syncedLogIds = pendingLogs.map((l) => l.id);
          await indexedDbStorage.markAuditLogsAsSynced(syncedLogIds);
          syncedAuditLogsCount = pendingLogs.length;
        }
      }

      const now = new Date().toISOString();
      await indexedDbStorage.setMetadata('last_sync_timestamp', now);

      auditService.log({
        actorId: 'sys_sync',
        actorName: 'Offline Sync Engine',
        actorRole: 'SYSTEM',
        action: 'OFFLINE_INDEXEDDB_BATCH_SYNC',
        entityType: 'STORAGE_ENGINE',
        entityId: 'OB_INDEXEDDB_STORAGE',
        correlationId: `sync_${Date.now()}`,
        details: `[NBE Remote Site Visit] Synchronized ${draftResult.syncedCount} drafts and ${syncedAuditLogsCount} audit logs from IndexedDB to central servers`,
      });

      vibrate([30, 45, 30, 50]);
      setSyncFeedback('Synchronization complete!');
      await refreshStats();

      setTimeout(() => {
        setSyncFeedback(null);
      }, 4000);

      return {
        success: true,
        syncedDrafts: draftResult.syncedCount,
        syncedAuditLogs: syncedAuditLogsCount,
      };
    } catch (err: any) {
      setSyncFeedback(`Sync failed: ${err.message}`);
      vibrate([60, 60]);
      return {
        success: false,
        syncedDrafts: 0,
        syncedAuditLogs: 0,
        error: err.message,
      };
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, refreshStats]);

  // Download encrypted tamper-evident JSON archive for on-site NBE field inspectors
  const exportOfflineVaultBundle = useCallback(async () => {
    try {
      const bundle = await indexedDbStorage.exportOfflineVaultBundle();
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `OromiaBank_NBE_SiteVisit_Vault_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      auditService.log({
        actorId: 'usr_mkr',
        actorName: 'Field Officer',
        actorRole: 'MAKER',
        action: 'OFFLINE_VAULT_EXPORTED',
        entityType: 'REGULATORY_BACKUP',
        entityId: 'OB_OFFLINE_BUNDLE',
        correlationId: `exp_${Date.now()}`,
        details: `Exported offline regulatory vault archive containing ${bundle.drafts.length} drafts and ${bundle.auditLogs.length} audit logs for NBE inspection team (Seal: ${bundle.integritySeal})`,
      });

      vibrate([25, 40]);
    } catch (err: any) {
      alert(`Export error: ${err.message}`);
    }
  }, []);

  return {
    isOnline,
    isRemoteSiteVisitMode,
    isEffectiveOffline,
    stats,
    isSyncing,
    syncFeedback,
    refreshStats,
    toggleRemoteSiteVisitMode,
    syncWithServer,
    exportOfflineVaultBundle,
  };
}
