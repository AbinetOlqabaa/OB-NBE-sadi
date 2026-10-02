/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Wifi, WifiOff, RefreshCw, Radio, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useRealtimeSync } from '../hooks/useRealtimeSync.ts';
import { realtimeClient } from '../services/realtimeClient.ts';

export const RealtimeStatusIndicator: React.FC = () => {
  const { status, isConnected, lastSequence, reconnect } = useRealtimeSync();
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowDetails((p) => !p)}
        title={`SSOT Real-Time Sync: ${status} (Sequence #${lastSequence})`}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
          isConnected
            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100'
            : status === 'RECONNECTING' || status === 'CONNECTING'
            ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800 hover:bg-amber-100 animate-pulse'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:bg-slate-200'
        }`}
      >
        <span className="relative flex h-2 w-2">
          {isConnected && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          )}
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${
              isConnected
                ? 'bg-emerald-500'
                : status === 'RECONNECTING'
                ? 'bg-amber-500'
                : 'bg-slate-400'
            }`}
          ></span>
        </span>
        <span className="hidden lg:inline font-mono">
          {isConnected ? 'SSOT LIVE' : status === 'RECONNECTING' ? 'SYNCING...' : 'OFFLINE'}
        </span>
      </button>

      {showDetails && (
        <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 p-3.5 text-xs text-slate-700 dark:text-slate-300">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
              <Radio className="w-4 h-4 text-ob-indigo-600 dark:text-ob-indigo-400" />
              <span>Real-Time SSOT Engine</span>
            </div>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                isConnected
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
              }`}
            >
              {status}
            </span>
          </div>

          <div className="space-y-1.5 mb-3 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-500">Committed Sequence:</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                #{lastSequence}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Transport:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                WebSocket + SSE
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Source of Truth:</span>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                Django / SQLite Authoritative
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Active Topics:</span>
              <span className="font-mono text-slate-800 dark:text-slate-200 truncate max-w-[130px]">
                {realtimeClient.getSubscribedTopics().join(', ') || 'system:all'}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex gap-2">
            <button
              type="button"
              onClick={() => {
                reconnect();
                setShowDetails(false);
              }}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-ob-indigo-600 hover:bg-ob-indigo-700 text-white font-medium rounded-lg text-xs transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Force Re-sync</span>
            </button>
            <button
              type="button"
              onClick={() => setShowDetails(false)}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
