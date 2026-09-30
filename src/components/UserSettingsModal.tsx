/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Sliders,
  History,
  Fingerprint,
  ScanFace,
  Lock,
  CheckCircle2,
  AlertCircle,
  Clock,
  Download,
  Filter,
  Search,
  RotateCcw,
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  Cpu,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { UserSession } from '../types/regulatory.ts';
import {
  authHistoryService,
  AuthHistoryEntry,
  AuthMethod,
  AuthAttemptStatus,
  getHardwareDeviceId,
  getHardwareDeviceLabel,
} from '../services/authHistoryService.ts';
import {
  isBiometricLoginEnabled,
  setBiometricLoginEnabled,
  getDeviceCapabilities,
  DeviceCapabilities,
} from '../utils/deviceCapabilities.ts';
import { triggerHaptic, vibrate } from '../utils/haptics.ts';

interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserSession;
  initialTab?: 'SETTINGS' | 'HISTORY';
}

export const UserSettingsModal: React.FC<UserSettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  initialTab = 'SETTINGS',
}) => {
  const [activeTab, setActiveTab] = useState<'SETTINGS' | 'HISTORY'>(initialTab);
  const [records, setRecords] = useState<AuthHistoryEntry[]>([]);
  const [methodFilter, setMethodFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Biometric toggle state
  const [isBioEnabled, setIsBioEnabled] = useState<boolean>(() =>
    isBiometricLoginEnabled(currentUser.email)
  );
  const [deviceCaps, setDeviceCaps] = useState<DeviceCapabilities | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setIsBioEnabled(isBiometricLoginEnabled(currentUser.email));
      getDeviceCapabilities(currentUser.email).then(setDeviceCaps);
    }
  }, [isOpen, initialTab, currentUser.email]);

  useEffect(() => {
    const unsub = authHistoryService.subscribe((allRecords) => {
      setRecords(allRecords);
    });
    return unsub;
  }, []);

  if (!isOpen) return null;

  const handleToggleBio = () => {
    const next = !isBioEnabled;
    setIsBioEnabled(next);
    setBiometricLoginEnabled(next, currentUser.email);
    vibrate(20);
    triggerHaptic(next ? 'success' : 'selection');

    // Record audit event
    authHistoryService.recordAttempt({
      method: 'FINGERPRINT',
      status: next ? 'SUCCESS' : 'FAILED',
      userEmail: currentUser.email,
      userName: currentUser.name,
      userRole: currentUser.role,
      failureReason: next ? 'Biometric login preference enabled' : 'Biometric login preference disabled by user',
    });
  };

  const handleExportCsv = () => {
    const csv = authHistoryService.exportCsv(currentUser.email);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `OB_Auth_History_${currentUser.email.split('@')[0]}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    triggerHaptic('success');
  };

  const handleSimulateTestAuth = (method: AuthMethod, status: AuthAttemptStatus) => {
    vibrate(15);
    authHistoryService.recordAttempt({
      method,
      status,
      userEmail: currentUser.email,
      userName: currentUser.name,
      userRole: currentUser.role,
      failureReason: status === 'FAILED' ? 'Simulated biometric template mismatch for compliance testing' : undefined,
    });
    triggerHaptic('success');
  };

  // Filter records
  const filteredRecords = records.filter((r) => {
    if (methodFilter !== 'ALL' && r.method !== methodFilter) return false;
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'SUCCESS' && r.status !== 'SUCCESS' && r.status !== 'ENROLLED') return false;
      if (statusFilter === 'FAILED' && r.status !== 'FAILED' && r.status !== 'TIMEOUT') return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchText = `${r.deviceId} ${r.deviceLabel} ${r.method} ${r.status} ${r.failureReason || ''} ${r.timestamp}`.toLowerCase();
      if (!matchText.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)] transition-all">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-ob-indigo-500/15 text-ob-indigo-600 dark:text-ob-indigo-400 flex items-center justify-center border border-ob-indigo-500/30">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>User Settings & Hardware Governance</span>
                <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-ob-green-50 dark:bg-ob-green-950 text-ob-green-700 dark:text-ob-green-400 border border-ob-green-300 dark:border-ob-green-800">
                  BSD/03/2020
                </span>
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {currentUser.name} ({currentUser.email}) • Role: {currentUser.role}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-900 px-5 pt-2 gap-2">
          <button
            type="button"
            onClick={() => {
              vibrate(10);
              setActiveTab('SETTINGS');
            }}
            className={`py-2 px-3 text-xs font-bold rounded-t-xl border-b-2 transition-all flex items-center gap-1.5 cursor-pointer touch-press ${
              activeTab === 'SETTINGS'
                ? 'border-ob-indigo-600 text-ob-indigo-600 dark:text-ob-indigo-400 bg-white dark:bg-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Fingerprint className="w-3.5 h-3.5" />
            <span>Hardware & Biometrics</span>
          </button>

          <button
            type="button"
            onClick={() => {
              vibrate(10);
              setActiveTab('HISTORY');
            }}
            className={`py-2 px-3 text-xs font-bold rounded-t-xl border-b-2 transition-all flex items-center gap-1.5 cursor-pointer touch-press relative ${
              activeTab === 'HISTORY'
                ? 'border-ob-indigo-600 text-ob-indigo-600 dark:text-ob-indigo-400 bg-white dark:bg-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Authentication History</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-ob-indigo-100 dark:bg-ob-indigo-950/80 text-ob-indigo-700 dark:text-ob-indigo-300 font-mono font-bold">
              {records.length}
            </span>
          </button>
        </div>

        {/* Tab 1: Hardware & Biometrics Content */}
        {activeTab === 'SETTINGS' && (
          <div className="p-5 overflow-y-auto space-y-4">
            {/* Biometric Toggle Switch Card */}
            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                    <Fingerprint className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Biometric Login & Hardware Passkeys
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Enable one-touch sign-in using your device touch sensor or front camera
                    </p>
                  </div>
                </div>

                {/* Switch */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={isBioEnabled}
                  onClick={handleToggleBio}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out touch-press ${
                    isBioEnabled ? 'bg-emerald-600' : 'bg-slate-400 dark:bg-slate-700'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      isBioEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-2">
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                  <span>Current Setting:</span>
                  <span className="font-bold flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    {isBioEnabled ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Enabled (Hardware Touch & Face ID Active)</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
                        <span>Disabled (Password required on login)</span>
                      </>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                  <span>Registered Hardware Device:</span>
                  <span className="font-mono text-[10px] text-slate-800 dark:text-slate-200 truncate max-w-[240px]">
                    {getHardwareDeviceId()}
                  </span>
                </div>
              </div>
            </div>

            {/* Hardware Telemetry Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
                    <Fingerprint className="w-4 h-4 text-emerald-500" />
                    <span>Touch Biometric Sensor</span>
                  </div>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                    Ready
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Physical sensor active with WebAuthn and touch passkey fallback.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
                    <ScanFace className="w-4 h-4 text-teal-500" />
                    <span>Face ID Optical Camera</span>
                  </div>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-teal-500/20 text-teal-700 dark:text-teal-300">
                    Ready
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Front camera live stream and mobile selfie photo capture active.
                </p>
              </div>
            </div>

            {/* Quick Test Simulation Tool */}
            <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800 space-y-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white block">
                Audit Log Self-Test & Simulation:
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Generate a simulated hardware audit attempt to test real-time audit trail persistence.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleSimulateTestAuth('FINGERPRINT', 'SUCCESS')}
                  className="px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer touch-press"
                >
                  + Simulate Fingerprint Success
                </button>
                <button
                  type="button"
                  onClick={() => handleSimulateTestAuth('FACE', 'SUCCESS')}
                  className="px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-teal-600 hover:bg-teal-500 text-white cursor-pointer touch-press"
                >
                  + Simulate Face ID Success
                </button>
                <button
                  type="button"
                  onClick={() => handleSimulateTestAuth('FINGERPRINT', 'TIMEOUT')}
                  className="px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-amber-600 hover:bg-amber-500 text-white cursor-pointer touch-press"
                >
                  + Simulate Timeout (30s)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Authentication History Content */}
        {activeTab === 'HISTORY' && (
          <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 flex-1 flex flex-col">
            {/* Filter Controls Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-slate-50 dark:bg-slate-800 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 flex-1">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search device ID, timestamp, status..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-ob-indigo-500"
                  />
                </div>

                {/* Method Filter */}
                <select
                  value={methodFilter}
                  onChange={(e) => setMethodFilter(e.target.value)}
                  className="text-xs py-1.5 px-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none"
                >
                  <option value="ALL">All Methods</option>
                  <option value="FINGERPRINT">Fingerprint</option>
                  <option value="FACE">Face ID</option>
                  <option value="PASSWORD">Password</option>
                </select>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="text-xs py-1.5 px-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none"
                >
                  <option value="ALL">All Status</option>
                  <option value="SUCCESS">Success Only</option>
                  <option value="FAILED">Failed / Timeout</option>
                </select>
              </div>

              <button
                type="button"
                onClick={handleExportCsv}
                className="px-3 py-1.5 text-xs font-bold rounded-xl bg-ob-green-600 hover:bg-ob-green-500 text-white flex items-center justify-center gap-1.5 shrink-0 cursor-pointer touch-press shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>

            {/* Records List View */}
            <div className="space-y-2 flex-1 overflow-y-auto">
              {filteredRecords.length === 0 ? (
                <div className="py-10 text-center text-slate-400 space-y-1">
                  <Clock className="w-8 h-8 mx-auto opacity-50 mb-2" />
                  <p className="text-xs font-semibold">No authentication attempts found</p>
                  <p className="text-[11px]">Matching attempts will appear here with hardware device IDs.</p>
                </div>
              ) : (
                filteredRecords.map((rec) => {
                  const isSuccess = rec.status === 'SUCCESS' || rec.status === 'ENROLLED';
                  const isTimeout = rec.status === 'TIMEOUT';

                  return (
                    <div
                      key={rec.id}
                      className="p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-ob-indigo-400/50 transition-colors space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                              rec.method === 'FINGERPRINT'
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                : rec.method === 'FACE'
                                ? 'bg-teal-500/15 text-teal-600 dark:text-teal-400'
                                : 'bg-ob-indigo-500/15 text-ob-indigo-600 dark:text-ob-indigo-400'
                            }`}
                          >
                            {rec.method === 'FINGERPRINT' ? (
                              <Fingerprint className="w-3.5 h-3.5" />
                            ) : rec.method === 'FACE' ? (
                              <ScanFace className="w-3.5 h-3.5" />
                            ) : (
                              <Lock className="w-3.5 h-3.5" />
                            )}
                          </div>

                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-slate-900 dark:text-white">
                                {rec.method === 'FINGERPRINT'
                                  ? 'Fingerprint Passkey'
                                  : rec.method === 'FACE'
                                  ? 'Face ID Optical Scan'
                                  : 'Corporate Password'}
                              </span>
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider ${
                                  isSuccess
                                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                                    : isTimeout
                                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                                    : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                                }`}
                              >
                                {rec.status}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">
                              {rec.userName} ({rec.userRole}) • {rec.userEmail}
                            </span>
                          </div>
                        </div>

                        {/* Timestamp & Latency */}
                        <div className="text-right shrink-0">
                          <span className="text-[11px] font-mono text-slate-600 dark:text-slate-300 block">
                            {new Date(rec.timestamp).toLocaleTimeString()}
                          </span>
                          <span className="text-[9px] text-slate-400 font-mono">
                            {new Date(rec.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      {/* Hardware Device ID & Failure Details */}
                      <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-1 text-[10px]">
                        <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                          <Smartphone className="w-3 h-3 text-slate-400" />
                          <span className="font-mono text-ob-indigo-600 dark:text-ob-indigo-300 bg-slate-100 dark:bg-black/30 px-1.5 py-0.5 rounded">
                            {rec.deviceId}
                          </span>
                          <span className="truncate max-w-[150px]">({rec.deviceLabel})</span>
                        </div>

                        {rec.responseTimeMs && (
                          <span className="text-slate-400 font-mono">
                            Latency: {rec.responseTimeMs}ms
                          </span>
                        )}
                      </div>

                      {rec.failureReason && (
                        <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-[10px] text-rose-700 dark:text-rose-300">
                          <strong>Reason:</strong> {rec.failureReason}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between text-xs">
          <span className="text-slate-400 text-[11px]">
            Supervisory Governance Directive BSD/03/2020 Compliance
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold cursor-pointer touch-press transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
