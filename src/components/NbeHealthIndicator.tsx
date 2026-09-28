/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Server,
  RefreshCw,
  Radio,
  WifiOff,
  AlertTriangle,
  Lock,
  ExternalLink,
  Activity,
  Zap,
} from 'lucide-react';

export type NbeGatewayHealthState = 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'CHECKING';

export interface NbeHealthData {
  status: NbeGatewayHealthState;
  healthy: boolean;
  gateway: string;
  endpoint: string;
  institutionCode: string;
  latencyMs: number;
  tlsVersion: string;
  directives: string[];
  mode?: string;
  timestamp?: string;
}

interface NbeHealthIndicatorProps {
  onOpenSimulator?: () => void;
  className?: string;
}

export const NbeHealthIndicator: React.FC<NbeHealthIndicatorProps> = ({
  onOpenSimulator,
  className = '',
}) => {
  const [healthData, setHealthData] = useState<NbeHealthData>({
    status: 'ONLINE',
    healthy: true,
    gateway: 'National Bank of Ethiopia (NBE) BSD Gateway',
    endpoint: 'https://nbe.gov.et/api/v2/regulatory/gateway',
    institutionCode: '0000013',
    latencyMs: 32,
    tlsVersion: 'TLSv1.3 / mTLS',
    directives: ['BSD/03/2020', 'SBR/2026'],
    mode: 'ALWAYS_SUCCESS',
  });
  const [isPinging, setIsPinging] = useState<boolean>(false);
  const [lastChecked, setLastChecked] = useState<Date>(new Date());
  const [showPopover, setShowPopover] = useState<boolean>(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Health poll function: polls NBE API health status
  const pollGatewayHealth = async () => {
    setIsPinging(true);
    const start = performance.now();
    try {
      const res = await fetch('/api/nbe-simulator/gateway-health', {
        headers: { Accept: 'application/json' },
      });
      const end = performance.now();
      const elapsed = Math.round(end - start) || Math.floor(25 + Math.random() * 18);

      if (res.ok) {
        const data = await res.json();
        setHealthData({
          status: data.status || (data.healthy ? 'ONLINE' : 'DEGRADED'),
          healthy: data.healthy ?? true,
          gateway: data.gateway || 'National Bank of Ethiopia (NBE) BSD Gateway',
          endpoint: data.endpoint || 'https://nbe.gov.et/api/v2/regulatory/gateway',
          institutionCode: data.institutionCode || '0000013',
          latencyMs: data.latencyMs ?? elapsed,
          tlsVersion: data.tlsVersion || 'TLSv1.3 / mTLS',
          directives: data.directives || ['BSD/03/2020', 'SBR/2026'],
          mode: data.mode || 'ALWAYS_SUCCESS',
          timestamp: data.timestamp,
        });
      } else {
        setHealthData((prev) => ({
          ...prev,
          status: 'DEGRADED',
          healthy: false,
          latencyMs: elapsed + 50,
        }));
      }
    } catch {
      setHealthData((prev) => ({
        ...prev,
        status: 'OFFLINE',
        healthy: false,
        latencyMs: 0,
      }));
    } finally {
      setLastChecked(new Date());
      setIsPinging(false);
    }
  };

  // Polls NBE API health status every 30 seconds
  useEffect(() => {
    pollGatewayHealth();
    const interval = setInterval(() => {
      pollGatewayHealth();
    }, 30000); // 30 seconds polling interval

    return () => clearInterval(interval);
  }, []);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setShowPopover(false);
      }
    };
    if (showPopover) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPopover]);

  const getTimeAgo = () => {
    const seconds = Math.floor((new Date().getTime() - lastChecked.getTime()) / 1000);
    if (seconds < 5) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    const mins = Math.floor(seconds / 60);
    return `${mins}m ago`;
  };

  // Determine visual color schemes based on status
  const getStatusVisuals = () => {
    switch (healthData.status) {
      case 'ONLINE':
        return {
          pillBg: 'bg-emerald-50/80 hover:bg-emerald-100/90 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/70 border-emerald-300/90 dark:border-emerald-800/80 text-emerald-900 dark:text-emerald-300',
          dotBg: 'bg-emerald-500',
          pingColor: 'bg-emerald-400',
          textColor: 'text-emerald-800 dark:text-emerald-300',
          badgeBg: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
          label: 'NBE Online',
          icon: Radio,
        };
      case 'DEGRADED':
        return {
          pillBg: 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-950/70 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-300',
          dotBg: 'bg-amber-500',
          pingColor: 'bg-amber-400',
          textColor: 'text-amber-800 dark:text-amber-300',
          badgeBg: 'bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-800',
          label: 'NBE Degraded',
          icon: AlertTriangle,
        };
      case 'OFFLINE':
      default:
        return {
          pillBg: 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950/70 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-300',
          dotBg: 'bg-rose-600',
          pingColor: 'bg-rose-400',
          textColor: 'text-rose-800 dark:text-rose-300',
          badgeBg: 'bg-rose-100 dark:bg-rose-950 text-rose-900 dark:text-rose-300 border-rose-300 dark:border-rose-800',
          label: 'NBE Offline',
          icon: WifiOff,
        };
    }
  };

  const visuals = getStatusVisuals();

  return (
    <div className={`relative inline-flex items-center ${className}`} ref={popoverRef}>
      {/* Visual Health Indicator Trigger Button */}
      <button
        type="button"
        onClick={() => setShowPopover(!showPopover)}
        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer shadow-2xs select-none ${visuals.pillBg}`}
        title={`NBE API Gateway Health: ${healthData.status} (${healthData.latencyMs}ms). Click for live telemetry.`}
        aria-label="NBE Gateway Health Status"
      >
        {/* Animated Light Indicator Dot */}
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          {healthData.status === 'ONLINE' && (
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${visuals.pingColor}`}
            ></span>
          )}
          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${visuals.dotBg}`}></span>
        </span>

        {/* Text Details with Status Light Label */}
        <div className="flex items-center gap-1.5 leading-none">
          <span className="font-bold text-slate-800 dark:text-slate-200 hidden sm:inline">NBE Gateway:</span>
          <span className={`font-mono text-[11px] font-bold ${visuals.textColor}`}>
            {healthData.status === 'ONLINE'
              ? `${healthData.latencyMs}ms`
              : healthData.status}
          </span>
        </div>

        {isPinging ? (
          <RefreshCw className="w-3 h-3 animate-spin text-slate-500 dark:text-slate-400" />
        ) : (
          <Activity className="w-3 h-3 text-slate-400 dark:text-slate-500 opacity-70" />
        )}
      </button>

      {/* Interactive Telemetry Popover Card */}
      {showPopover && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-3.5 text-xs">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
              <div className="p-1 rounded-lg bg-ob-indigo-50 dark:bg-ob-indigo-950 text-ob-indigo-700 dark:text-ob-indigo-300 border border-ob-indigo-200 dark:border-ob-indigo-800">
                <Server className="w-3.5 h-3.5" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold leading-tight">NBE Gateway Health</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
                  National Bank of Ethiopia · BSD
                </span>
              </div>
            </div>

            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border ${visuals.badgeBg}`}
            >
              {healthData.status}
            </span>
          </div>

          {/* Telemetry Metrics Grid */}
          <div className="space-y-2 text-[11px] text-slate-600 dark:text-slate-300 bg-slate-50/70 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">API Endpoint:</span>
              <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold truncate max-w-[155px]" title={healthData.endpoint}>
                nbe.gov.et/api/v2
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Round-Trip Latency:</span>
              <span className="font-mono font-bold text-ob-indigo-700 dark:text-ob-indigo-400 flex items-center gap-1">
                <Zap className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span>{healthData.latencyMs} ms</span>
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Transport Security:</span>
              <span className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1">
                <Lock className="w-3 h-3 text-ob-indigo-600 dark:text-ob-indigo-400" />
                <span>{healthData.tlsVersion}</span>
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Bank Code / Entity:</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                {healthData.institutionCode} (Oromia Bank)
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Regulatory Directives:</span>
              <span className="font-semibold text-ob-green-800 dark:text-ob-green-300 bg-ob-green-50 dark:bg-ob-green-950/60 px-1.5 py-0.2 rounded border border-ob-green-200 dark:border-ob-green-800 text-[10px]">
                {healthData.directives.join(', ')}
              </span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
              <span className="text-slate-500 dark:text-slate-400">Last Verified:</span>
              <span className="text-slate-700 dark:text-slate-300 font-semibold">{getTimeAgo()}</span>
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-[10px] text-slate-400 dark:text-slate-500">Auto-polls every 30s</span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={pollGatewayHealth}
                disabled={isPinging}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-[11px] transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isPinging ? 'animate-spin text-ob-indigo-600 dark:text-ob-indigo-400' : ''}`} />
                <span>Poll Now</span>
              </button>

              {onOpenSimulator && (
                <button
                  type="button"
                  onClick={() => {
                    setShowPopover(false);
                    onOpenSimulator();
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-ob-indigo-600 hover:bg-ob-indigo-700 text-white font-bold text-[11px] transition-colors cursor-pointer shadow-2xs"
                >
                  <span>Gateway Console</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
