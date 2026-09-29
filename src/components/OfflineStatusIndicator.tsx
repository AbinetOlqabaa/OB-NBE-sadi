/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Wifi,
  WifiOff,
  Database,
  CloudUpload,
  RefreshCw,
  HardDrive,
  ShieldCheck,
} from 'lucide-react';
import { useOfflineStorage } from '../hooks/useOfflineStorage.ts';
import { OfflineStorageModal } from './OfflineStorageModal.tsx';

interface OfflineStatusIndicatorProps {
  className?: string;
}

export const OfflineStatusIndicator: React.FC<OfflineStatusIndicatorProps> = ({ className = '' }) => {
  const {
    isOnline,
    isRemoteSiteVisitMode,
    isEffectiveOffline,
    stats,
    isSyncing,
    syncFeedback,
    syncWithServer,
  } = useOfflineStorage();

  const [isModalOpen, setIsModalOpen] = useState(false);

  const hasPending = stats.pendingDrafts > 0 || stats.pendingAuditLogs > 0;

  return (
    <>
      <div className={`flex items-center gap-1.5 ${className}`}>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className={`min-h-[44px] px-2 sm:px-3 rounded-xl border flex items-center justify-center gap-1.5 sm:gap-2 text-xs font-semibold transition-all shadow-2xs touch-manipulation cursor-pointer ${
            isEffectiveOffline
              ? isRemoteSiteVisitMode
                ? 'bg-amber-500/10 border-amber-500/40 text-amber-800 dark:text-amber-300 hover:bg-amber-500/20'
                : 'bg-rose-500/10 border-rose-500/40 text-rose-800 dark:text-rose-300 hover:bg-rose-500/20'
              : hasPending
              ? 'bg-blue-500/10 border-blue-500/40 text-blue-800 dark:text-blue-300 hover:bg-blue-500/20'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/20'
          }`}
          title="NBE Remote Site Visit & IndexedDB Offline Storage Status. Click to manage offline data."
          aria-label="IndexedDB Storage & Network Connectivity Status"
        >
          {/* Status Icon */}
          {isEffectiveOffline ? (
            <WifiOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
          ) : (
            <Wifi className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          )}

          {/* Status Label (Hidden on mobile and tablets < 1024px to preserve header space) */}
          <div className="hidden lg:flex flex-col text-left leading-none">
            <span className="text-[11px] font-bold tracking-tight">
              {isEffectiveOffline
                ? isRemoteSiteVisitMode
                  ? 'Site Visit (Offline)'
                  : 'Disconnected'
                : 'Online'}
            </span>
            <span className="text-[9px] opacity-80 font-mono">
              IndexedDB: {stats.draftCount} drafts
            </span>
          </div>

          {/* Pending Sync Badge */}
          {hasPending && (
            <span
              className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold font-mono shrink-0 flex items-center gap-1 ${
                isEffectiveOffline
                  ? 'bg-amber-200 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200'
                  : 'bg-blue-200 dark:bg-blue-900/80 text-blue-900 dark:text-blue-200'
              }`}
              title={`${stats.pendingDrafts} drafts and ${stats.pendingAuditLogs} audit logs pending sync with central server`}
            >
              <Database className="w-2.5 h-2.5" />
              {stats.pendingDrafts + stats.pendingAuditLogs}
            </span>
          )}
        </button>
      </div>

      {/* Modal Inspector */}
      {isModalOpen && (
        <OfflineStorageModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
};
