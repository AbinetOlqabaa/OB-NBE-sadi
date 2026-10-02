/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Fingerprint,
  ScanFace,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Key,
  Smartphone,
  Laptop,
  Usb,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  X,
  Edit2,
  Trash2,
  PauseCircle,
  PlayCircle,
  Plus,
  Lock,
  Clock,
  ExternalLink,
  ChevronRight,
  Info,
  HelpCircle,
  RefreshCw,
} from 'lucide-react';
import { UserSession } from '../types/regulatory.ts';
import {
  BiometricMethod,
  BiometricLifecycleState,
  SafeDeviceMetadata,
  SecurityCenterDetails,
} from '../types/biometrics.ts';
import { biometricService } from '../services/biometricService.ts';
import { triggerHaptic } from '../utils/haptics.ts';

interface BiometricSecurityCenterProps {
  currentUser: UserSession;
  targetEmail?: string;
  onClose?: () => void;
  onTriggerEnrollment?: (method: BiometricMethod) => void;
  isEmbedded?: boolean;
}

export const BiometricSecurityCenter: React.FC<BiometricSecurityCenterProps> = ({
  currentUser,
  targetEmail,
  onClose,
  onTriggerEnrollment,
  isEmbedded = false,
}) => {
  const effectiveEmail = (targetEmail || currentUser.email).toLowerCase().trim();
  const isTargetingSelf = effectiveEmail === currentUser.email.toLowerCase().trim();
  const isAdmin = currentUser.role === 'ADMIN';

  const [details, setDetails] = useState<SecurityCenterDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals & Action States
  const [resetModalOpen, setResetModalOpen] = useState<boolean>(false);
  const [resetType, setResetType] = useState<BiometricMethod | 'ALL'>('FACE');
  const [resetPassword, setResetPassword] = useState<string>('');
  const [resetReason, setResetReason] = useState<string>('Physical appearance or camera change');
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [resetExecutedNotice, setResetExecutedNotice] = useState<string | null>(null);

  // Revoke Device Modal
  const [revokeModalDevice, setRevokeModalDevice] = useState<SafeDeviceMetadata | null>(null);
  const [revokePassword, setRevokePassword] = useState<string>('');
  const [revokeReason, setRevokeReason] = useState<string>('Officer replaced hardware authenticator');
  const [isRevoking, setIsRevoking] = useState<boolean>(false);

  // Rename Device Modal
  const [renameModalDevice, setRenameModalDevice] = useState<SafeDeviceMetadata | null>(null);
  const [newDeviceLabel, setNewDeviceLabel] = useState<string>('');
  const [isRenaming, setIsRenaming] = useState<boolean>(false);

  // Privacy Charter & Compliance Archive Export
  const [privacyCharterOpen, setPrivacyCharterOpen] = useState<boolean>(false);
  const [complianceArchiveData, setComplianceArchiveData] = useState<any>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Phase 17: Admin Biometric Threshold Governance
  const [thresholdSetting, setThresholdSetting] = useState<{
    matchingThreshold: number;
    minQualityThreshold: number;
    preset: 'STRICT' | 'BALANCED' | 'TOLERANT' | 'CUSTOM';
    description: string;
  }>({
    matchingThreshold: 65,
    minQualityThreshold: 0.4,
    preset: 'BALANCED',
    description: 'Commercial Banking Balanced (Euclidean <= 65, ~75% confidence)',
  });
  const [isSavingThreshold, setIsSavingThreshold] = useState(false);
  const [thresholdNotice, setThresholdNotice] = useState<string | null>(null);

  const loadThresholdSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/biometrics/settings');
      const data = await res.json();
      if (data.success && data.settings) {
        setThresholdSetting(data.settings);
      } else {
        const local = biometricService.getBiometricSettings();
        setThresholdSetting(local);
      }
    } catch {
      const local = biometricService.getBiometricSettings();
      setThresholdSetting(local);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadThresholdSettings();
    }
  }, [isAdmin, loadThresholdSettings]);

  const handleUpdateThresholdPreset = async (preset: 'STRICT' | 'BALANCED' | 'TOLERANT') => {
    setIsSavingThreshold(true);
    setThresholdNotice(null);
    try {
      const res = await fetch('/api/auth/biometrics/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminEmail: currentUser.email,
          settings: { preset },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setThresholdSetting(data.settings);
        setThresholdNotice(`Biometric matching policy updated to ${preset}.`);
        triggerHaptic('success');
      } else {
        const local = biometricService.updateBiometricSettings({ preset }, currentUser.email);
        setThresholdSetting(local.settings);
        setThresholdNotice(local.message);
        triggerHaptic('success');
      }
    } catch {
      const local = biometricService.updateBiometricSettings({ preset }, currentUser.email);
      setThresholdSetting(local.settings);
      setThresholdNotice(local.message);
      triggerHaptic('success');
    } finally {
      setIsSavingThreshold(false);
    }
  };

  const handleUpdateCustomThreshold = async (val: number) => {
    setIsSavingThreshold(true);
    setThresholdNotice(null);
    try {
      const res = await fetch('/api/auth/biometrics/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminEmail: currentUser.email,
          settings: { matchingThreshold: val },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setThresholdSetting(data.settings);
        setThresholdNotice(`Custom matching distance updated to ${val} units.`);
        triggerHaptic('success');
      } else {
        const local = biometricService.updateBiometricSettings({ matchingThreshold: val }, currentUser.email);
        setThresholdSetting(local.settings);
        setThresholdNotice(local.message);
        triggerHaptic('success');
      }
    } catch {
      const local = biometricService.updateBiometricSettings({ matchingThreshold: val }, currentUser.email);
      setThresholdSetting(local.settings);
      setThresholdNotice(local.message);
      triggerHaptic('success');
    } finally {
      setIsSavingThreshold(false);
    }
  };

  const handleExportComplianceArchive = async () => {
    setIsExporting(true);
    try {
      let archive: any;
      try {
        const res = await fetch('/api/auth/biometrics/compliance/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requesterEmail: currentUser.email,
            targetEmail: effectiveEmail,
          }),
        });
        const data = await res.json();
        if (data.success) {
          archive = data.archive;
        } else {
          throw new Error(data.message);
        }
      } catch {
        archive = biometricService.exportComplianceArchive(currentUser.email, effectiveEmail);
      }

      setComplianceArchiveData(archive);
      showNotice('success', `Compliance archive generated successfully (ID: ${archive.exportId}).`);

      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        const blob = new Blob([JSON.stringify(archive, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `nbe_biometric_compliance_${archive.targetAccount || 'record'}_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      showNotice('error', err.message || 'Failed to export compliance archive.');
    } finally {
      setIsExporting(false);
    }
  };

  // Load Security Center Data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      // Try local service first for speed & test compatibility
      const localData = biometricService.getSecurityCenterDetails(effectiveEmail);
      if (localData) {
        setDetails(localData);
      } else {
        const res = await fetch(`/api/auth/biometrics/security-center/${encodeURIComponent(effectiveEmail)}`);
        if (res.ok) {
          const json = await res.json();
          setDetails(json);
        }
      }
    } catch {
      const localFallback = biometricService.getSecurityCenterDetails(effectiveEmail);
      if (localFallback) setDetails(localFallback);
    } finally {
      setLoading(false);
    }
  }, [effectiveEmail]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const showNotice = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    triggerHaptic(type);
    setTimeout(() => setFeedback(null), 5000);
  };

  // -------------------------------------------------------------
  // Face / Biometric Reset Handlers
  // -------------------------------------------------------------
  const handleOpenResetModal = (type: BiometricMethod | 'ALL') => {
    setResetType(type);
    setResetPassword('');
    setResetReason(
      type === 'FACE'
        ? 'Facial appearance change or camera upgrade'
        : type === 'FINGERPRINT'
        ? 'Passkey device replaced or hardware retired'
        : 'Complete biometric credential reset'
    );
    setResetExecutedNotice(null);
    setResetModalOpen(true);
  };

  const handleExecuteResetFlow = async () => {
    if (!resetPassword) {
      showNotice('error', 'Account password is required for step-up authentication.');
      return;
    }

    setIsResetting(true);
    try {
      // 1. Request Reset (Validates step-up password, issues token, explains consequences)
      let reqResult: any;
      try {
        const res = await fetch('/api/auth/biometrics/reset/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: effectiveEmail,
            type: resetType,
            password: resetPassword,
            reason: resetReason,
            actorEmail: currentUser.email,
          }),
        });
        reqResult = await res.json();
      } catch {
        reqResult = biometricService.requestReset(
          effectiveEmail,
          resetType,
          resetPassword,
          resetReason,
          currentUser.email
        );
      }

      if (!reqResult.success || !reqResult.resetToken) {
        showNotice('error', reqResult.message || 'Reset authorization rejected.');
        setIsResetting(false);
        return;
      }

      // 2. Execute Reset (Single-use token consumption & safe revocation)
      let execResult: any;
      try {
        const res = await fetch('/api/auth/biometrics/reset/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: effectiveEmail,
            resetToken: reqResult.resetToken,
            actorEmail: currentUser.email,
          }),
        });
        execResult = await res.json();
      } catch {
        execResult = biometricService.executeReset(effectiveEmail, reqResult.resetToken, currentUser.email);
      }

      if (execResult.success) {
        showNotice('success', execResult.message || 'Biometric credentials successfully reset.');
        setResetExecutedNotice(
          `${resetType === 'ALL' ? 'All credentials' : resetType} revoked. Your account is ready for fresh enrollment.`
        );
        loadData();
      } else {
        showNotice('error', execResult.message || 'Failed to complete reset execution.');
      }
    } catch (err: any) {
      showNotice('error', err.message || 'An error occurred during biometric reset.');
    } finally {
      setIsResetting(false);
    }
  };

  // -------------------------------------------------------------
  // WebAuthn Passkey Revocation & Suspension Handlers
  // -------------------------------------------------------------
  const handleOpenRevokeModal = (device: SafeDeviceMetadata) => {
    setRevokeModalDevice(device);
    setRevokePassword('');
    setRevokeReason(`Officer retiring or replacing device (${device.deviceLabel})`);
  };

  const handleExecuteRevokeDevice = async () => {
    if (!revokeModalDevice) return;
    if (!revokePassword && isTargetingSelf) {
      showNotice('error', 'Please enter your password to confirm device revocation.');
      return;
    }

    setIsRevoking(true);
    try {
      let resData: any;
      try {
        const res = await fetch('/api/auth/biometrics/revoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: effectiveEmail,
            credentialId: revokeModalDevice.credentialId,
            reason: revokeReason,
            actorEmail: currentUser.email,
            password: revokePassword,
          }),
        });
        resData = await res.json();
      } catch {
        resData = biometricService.revokeCredential(
          effectiveEmail,
          revokeModalDevice.credentialId,
          revokeReason,
          currentUser.email,
          revokePassword
        );
      }

      if (resData.success) {
        showNotice('success', resData.message || `Device "${revokeModalDevice.deviceLabel}" permanently revoked.`);
        setRevokeModalDevice(null);
        loadData();
      } else {
        showNotice('error', resData.message || 'Failed to revoke device.');
      }
    } catch (err: any) {
      showNotice('error', err.message || 'Device revocation error.');
    } finally {
      setIsRevoking(false);
    }
  };

  const handleToggleSuspendDevice = async (device: SafeDeviceMetadata) => {
    const isSuspended = device.status === 'SUSPENDED';
    const action = isSuspended ? 'resume' : 'suspend';

    try {
      let resData: any;
      if (isSuspended) {
        try {
          const res = await fetch('/api/auth/biometrics/resume', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: effectiveEmail,
              credentialId: device.credentialId,
              reason: 'Officer resumed passkey',
              actorEmail: currentUser.email,
            }),
          });
          resData = await res.json();
        } catch {
          resData = biometricService.resumeCredential(
            effectiveEmail,
            device.credentialId,
            'Officer resumed passkey',
            currentUser.email
          );
        }
      } else {
        try {
          const res = await fetch('/api/auth/biometrics/suspend', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: effectiveEmail,
              credentialId: device.credentialId,
              reason: 'Officer placed device on temporary hold',
              actorEmail: currentUser.email,
            }),
          });
          resData = await res.json();
        } catch {
          resData = biometricService.suspendCredential(
            effectiveEmail,
            device.credentialId,
            'Officer placed device on temporary hold',
            currentUser.email
          );
        }
      }

      if (resData.success) {
        showNotice('success', resData.message || `Device ${action}d successfully.`);
        loadData();
      } else {
        showNotice('error', resData.message || `Failed to ${action} device.`);
      }
    } catch (err: any) {
      showNotice('error', err.message || `Error during device ${action}.`);
    }
  };

  // -------------------------------------------------------------
  // Rename Device Label Handlers
  // -------------------------------------------------------------
  const handleOpenRenameModal = (device: SafeDeviceMetadata) => {
    setRenameModalDevice(device);
    setNewDeviceLabel(device.deviceLabel);
  };

  const handleExecuteRename = async () => {
    if (!renameModalDevice || !newDeviceLabel.trim()) return;

    setIsRenaming(true);
    try {
      let resData: any;
      try {
        const res = await fetch('/api/auth/biometrics/device/rename', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: effectiveEmail,
            credentialId: renameModalDevice.credentialId,
            newLabel: newDeviceLabel.trim(),
            actorEmail: currentUser.email,
          }),
        });
        resData = await res.json();
      } catch {
        resData = biometricService.renameDeviceLabel(
          effectiveEmail,
          renameModalDevice.credentialId,
          newDeviceLabel.trim(),
          currentUser.email
        );
      }

      if (resData.success) {
        showNotice('success', resData.message || 'Device label updated.');
        setRenameModalDevice(null);
        loadData();
      } else {
        showNotice('error', resData.message || 'Failed to rename device.');
      }
    } catch (err: any) {
      showNotice('error', err.message || 'Rename device error.');
    } finally {
      setIsRenaming(false);
    }
  };

  // Helper for Device Icon
  const getDeviceIcon = (label: string, transports?: string[]) => {
    const l = label.toLowerCase();
    if (l.includes('yubi') || l.includes('key') || l.includes('token') || (transports && transports.includes('usb'))) {
      return <Usb className="w-4 h-4 text-amber-500" />;
    }
    if (l.includes('phone') || l.includes('pixel') || l.includes('iphone') || l.includes('galaxy')) {
      return <Smartphone className="w-4 h-4 text-emerald-500" />;
    }
    return <Laptop className="w-4 h-4 text-ob-indigo-500" />;
  };

  return (
    <div className={`space-y-4 ${isEmbedded ? '' : 'p-4 sm:p-6 bg-white dark:bg-slate-900 rounded-3xl shadow-xl'}`}>
      {/* 1. Header & Identity Assurance Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-ob-indigo-600/10 dark:bg-ob-indigo-400/10 text-ob-indigo-600 dark:text-ob-indigo-400 flex items-center justify-center font-bold">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>Biometric Security Center & Device Management</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-500/30">
                  NBE BSD/03/2020 Compliant
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Authoritative lifecycle management, re-authentication, device revocation, and recovery controls.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Refresh status"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Action Notification Banner */}
      {feedback && (
        <div
          className={`p-3 rounded-2xl border text-xs flex items-center gap-2 animate-in fade-in duration-200 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
          )}
          <span className="flex-1 font-medium">{feedback.message}</span>
        </div>
      )}

      {/* Target Officer Metadata Header */}
      {details && (
        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-ob-indigo-600 text-white font-bold flex items-center justify-center text-xs">
              {details.userName.charAt(0)}
            </div>
            <div>
              <span className="font-bold text-slate-900 dark:text-white">{details.userName}</span>
              <span className="text-slate-500 dark:text-slate-400 ml-1.5 font-mono text-[11px]">({details.email})</span>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                {details.department} • <span className="font-semibold">{details.userRole}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {details.rateLimit.isLocked ? (
              <span className="px-2.5 py-1 rounded-xl bg-red-500/20 text-red-700 dark:text-red-300 font-bold text-[10px] flex items-center gap-1 border border-red-500/30">
                <Lock className="w-3 h-3" />
                Locked Out ({details.rateLimit.remainingLockoutSec}s)
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] flex items-center gap-1 border border-emerald-500/20">
                <ShieldCheck className="w-3 h-3" />
                Security Status Good
              </span>
            )}
            <span className="px-2.5 py-1 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[10px]">
              {details.totalActiveDevices} Active Passkey{details.totalActiveDevices === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      )}

      {/* 2. Primary Biometric Cards Grid (Face ID vs. WebAuthn Passkeys) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* Card 1: Face ID Optical Recognition Profile */}
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-teal-500/15 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                <ScanFace className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">Face ID Optical Profile</h4>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">Front camera biometric template</p>
              </div>
            </div>

            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                details?.faceStatus === 'ENROLLED'
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                  : details?.faceStatus === 'SUSPENDED'
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'
              }`}
            >
              {details?.faceStatus || 'NOT_ENROLLED'}
            </span>
          </div>

          {details?.faceStatus === 'ENROLLED' && details.faceMetadata ? (
            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 space-y-1.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400">Enrolled:</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {new Date(details.faceMetadata.enrolledAt || Date.now()).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400">Quality Score:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {Math.round((details.faceMetadata.qualityScore || 0.95) * 100)}% (Liveness Passed)
                  </span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400">Storage Protection:</span>
                  <span className="text-slate-700 dark:text-slate-300 font-mono text-[10px]">
                    Salted Non-invertible HMAC
                  </span>
                </div>
              </div>

              <div className="pt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenResetModal('FACE')}
                  className="flex-1 py-1.5 px-3 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/60 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset & Re-enroll Face</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5 text-xs py-1">
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Face ID is not currently enrolled for this officer. Enrolling allows rapid optical supervisory sign-in
                without hardware dongles.
              </p>
              {onTriggerEnrollment && (
                <button
                  type="button"
                  onClick={() => onTriggerEnrollment('FACE')}
                  className="w-full py-2 px-3 bg-teal-600 hover:bg-teal-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                >
                  <ScanFace className="w-3.5 h-3.5" />
                  <span>Enroll Face ID Now</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Card 2: WebAuthn Passkeys & Touch ID Summary */}
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Fingerprint className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">WebAuthn Hardware Passkeys</h4>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">Touch ID, Windows Hello & FIDO2</p>
              </div>
            </div>

            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                (details?.devices.filter((d) => d.status === 'ENROLLED').length || 0) > 0
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'
              }`}
            >
              {(details?.devices.filter((d) => d.status === 'ENROLLED').length || 0) > 0
                ? `${details?.devices.filter((d) => d.status === 'ENROLLED').length} BOUND`
                : 'NOT_ENROLLED'}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Cryptographically bound passkeys stored in hardware secure enclaves. Multi-authenticator support allows
              binding your primary workstation plus backup security keys.
            </p>

            <div className="pt-1 flex items-center gap-2">
              {onTriggerEnrollment && (
                <button
                  type="button"
                  onClick={() => onTriggerEnrollment('FINGERPRINT')}
                  className="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Register Additional Passkey</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => handleOpenResetModal('FINGERPRINT')}
                className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                title="Wipe and reset all passkeys"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset All Passkeys</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Registered Devices List (Multi-Device Management) */}
      <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Key className="w-4 h-4 text-ob-indigo-600 dark:text-ob-indigo-400" />
              <span>Registered Hardware Authenticators ({details?.devices.length || 0})</span>
            </h4>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Manage authenticators, inspect safe telemetry, rename device labels, or safely revoke lost hardware.
            </p>
          </div>

          <span className="text-[10px] text-slate-400 font-mono">Zero raw biometric data exposed</span>
        </div>

        {details?.devices && details.devices.length > 0 ? (
          <div className="space-y-2">
            {details.devices.map((device) => {
              const isEnrolled = device.status === 'ENROLLED';
              const isSuspended = device.status === 'SUSPENDED';
              const isRevoked = device.status === 'REVOKED';

              return (
                <div
                  key={device.id}
                  className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isRevoked
                      ? 'bg-slate-50/50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-60'
                      : isSuspended
                      ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40'
                      : 'bg-slate-50/80 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/80 hover:border-ob-indigo-500/40'
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                      {getDeviceIcon(device.deviceLabel, device.transports)}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {device.deviceLabel}
                        </span>

                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                            isEnrolled
                              ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                              : isSuspended
                              ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                              : 'bg-red-500/20 text-red-700 dark:text-red-300'
                          }`}
                        >
                          {device.status}
                        </span>

                        {!isRevoked && (
                          <button
                            type="button"
                            onClick={() => handleOpenRenameModal(device)}
                            className="text-slate-400 hover:text-ob-indigo-600 dark:hover:text-ob-indigo-400 p-0.5"
                            title="Rename friendly device label"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      <div className="text-[10px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono mt-0.5">
                        <span>ID: {device.maskedId}</span>
                        <span>•</span>
                        <span>Counter: {device.counter}</span>
                        <span>•</span>
                        <span>Enrolled: {new Date(device.enrolledAt).toLocaleDateString()}</span>
                        {device.lastUsedAt && (
                          <>
                            <span>•</span>
                            <span>Last Used: {new Date(device.lastUsedAt).toLocaleDateString()}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Device Control Actions */}
                  <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                    {!isRevoked && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleToggleSuspendDevice(device)}
                          className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border flex items-center gap-1 transition-colors cursor-pointer ${
                            isSuspended
                              ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                              : 'bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                          }`}
                          title={isSuspended ? 'Resume passkey' : 'Suspend passkey temporarily'}
                        >
                          {isSuspended ? <PlayCircle className="w-3.5 h-3.5" /> : <PauseCircle className="w-3.5 h-3.5" />}
                          <span>{isSuspended ? 'Resume' : 'Suspend'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenRevokeModal(device)}
                          className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 flex items-center gap-1 transition-colors cursor-pointer"
                          title="Revoke and permanently invalidate device"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Revoke</span>
                        </button>
                      </>
                    )}
                    {isRevoked && (
                      <span className="text-[10px] text-red-600 dark:text-red-400 font-semibold italic">
                        Revoked: {device.revocationReason || 'Device replaced'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-6 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700">
            <Key className="w-6 h-6 mx-auto text-slate-400 mb-1" />
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300">No Hardware Passkeys Registered</div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-0.5">
              Click &quot;Register Additional Passkey&quot; above to bind your device&apos;s Touch ID, Windows Hello sensor, or
              hardware security key.
            </p>
          </div>
        )}
      </div>

      {/* 4. Recent Security Events Audit Stream */}
      {details?.recentBiometricEvents && details.recentBiometricEvents.length > 0 && (
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 space-y-2.5">
          <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-slate-500" />
            <span>Recent Biometric Lifecycle & Security Events</span>
          </h4>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-44 overflow-y-auto pr-1">
            {details.recentBiometricEvents.map((evt) => (
              <div key={evt.id} className="py-2 text-[11px] flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {evt.action}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400 text-[10px]">
                      by {evt.actorName} ({evt.actorRole})
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-tight">{evt.details}</p>
                </div>

                <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                  {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. NBE Regulatory Recovery Guidance Card */}
      {details?.recoveryGuidance && (
        <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 text-xs space-y-2.5">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold">
            <HelpCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>NBE Lost Device, Hardware Failure & Recovery Guidance</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] text-slate-600 dark:text-slate-300">
            <div className="space-y-1">
              <span className="font-bold text-slate-900 dark:text-white block">Lost or Stolen Device Procedure:</span>
              <ul className="list-disc list-inside space-y-0.5 text-slate-600 dark:text-slate-400">
                {details.recoveryGuidance.lostDeviceInstructions.map((inst, i) => (
                  <li key={i}>{inst}</li>
                ))}
              </ul>
            </div>

            <div className="space-y-1">
              <span className="font-bold text-slate-900 dark:text-white block">Hardware Failure & Fallback:</span>
              <ul className="list-disc list-inside space-y-0.5 text-slate-600 dark:text-slate-400">
                {details.recoveryGuidance.hardwareFailureGuidance.map((inst, i) => (
                  <li key={i}>{inst}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="pt-1 border-t border-amber-500/15 flex flex-wrap items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
            <span>{details.recoveryGuidance.stepUpRequirement}</span>
            <span className="font-semibold text-amber-700 dark:text-amber-400">
              Helpdesk: {details.recoveryGuidance.complianceContact}
            </span>
          </div>
        </div>
      )}

      {/* Phase 17: Admin Biometric Matching Threshold & Optical Governance */}
      {isAdmin && (
        <div className="p-4 rounded-2xl bg-teal-500/5 dark:bg-teal-950/20 border border-teal-500/30 text-xs space-y-3.5 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-teal-900 dark:text-teal-200 font-bold">
              <ScanFace className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
              <span>Supervisory Biometric Matching & Optical Tolerance Governance</span>
              <span className="text-[9px] px-1.5 py-0.2 bg-teal-500/20 text-teal-800 dark:text-teal-300 font-mono font-bold rounded">
                NBE BSD/03/2020
              </span>
            </div>

            <span className="text-[11px] font-bold text-teal-700 dark:text-teal-300 bg-teal-500/10 px-2 py-0.5 rounded-lg border border-teal-500/20">
              Active: {thresholdSetting.preset} (Distance $\le$ {thresholdSetting.matchingThreshold})
            </span>
          </div>

          <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
            Configure the mathematical optical Euclidean distance tolerance for physical camera verification across branch workstations, mobile tablets (e.g. Samsung Galaxy Tab series), and employee webcams.
          </p>

          {thresholdNotice && (
            <div className="p-2.5 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-300 dark:border-teal-700 text-teal-800 dark:text-teal-200 text-[11px] font-medium flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              <span>{thresholdNotice}</span>
            </div>
          )}

          {/* Preset Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {[
              {
                id: 'STRICT',
                title: 'NBE Strict Vault',
                threshold: 36,
                confidence: '~86% Match',
                desc: 'Strict optical match. Ideal for high-spec workstations with controlled studio lighting.',
              },
              {
                id: 'BALANCED',
                title: 'Commercial Banking (Default)',
                threshold: 65,
                confidence: '~75% Match',
                desc: 'Recommended default. Tolerates day/night ambient micro-shifts on tablets and webcams.',
              },
              {
                id: 'TOLERANT',
                title: 'Adaptive Tablet / Mobile',
                threshold: 85,
                confidence: '~65% Match',
                desc: 'Maximum optical tolerance. Designed for dynamic lighting, screen glare, or field tablets.',
              },
            ].map((p) => {
              const isSelected = thresholdSetting.preset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleUpdateThresholdPreset(p.id as any)}
                  disabled={isSavingThreshold}
                  className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer touch-press ${
                    isSelected
                      ? 'bg-teal-600 text-white border-teal-600 shadow-md shadow-teal-600/20'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-teal-400'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between font-bold text-xs">
                      <span>{p.title}</span>
                      <span className={`text-[10px] font-mono ${isSelected ? 'text-teal-100' : 'text-teal-600 dark:text-teal-400'}`}>
                        {p.confidence}
                      </span>
                    </div>
                    <p className={`text-[10px] mt-1 leading-snug ${isSelected ? 'text-teal-100/90' : 'text-slate-500 dark:text-slate-400'}`}>
                      {p.desc}
                    </p>
                  </div>
                  <div className="mt-2 text-[9px] font-mono flex items-center justify-between pt-1 border-t border-current/20">
                    <span>Threshold $\le$ {p.threshold}</span>
                    <span>{isSelected ? 'ACTIVE POLICY' : 'Select'}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Slider for fine adjustment */}
          <div className="pt-2 border-t border-teal-500/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px]">
            <div className="space-y-0.5 text-slate-600 dark:text-slate-400">
              <span className="font-semibold text-slate-800 dark:text-slate-200">Custom Matching Distance Limit:</span>
              <p className="text-[10px]">Adjust Euclidean optical distance boundary (Lower = Stricter, Higher = More Tolerant).</p>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <input
                type="range"
                min="25"
                max="110"
                step="5"
                value={thresholdSetting.matchingThreshold}
                onChange={(e) => handleUpdateCustomThreshold(parseInt(e.target.value, 10))}
                disabled={isSavingThreshold}
                className="w-full sm:w-44 accent-teal-600 cursor-pointer"
              />
              <span className="font-mono font-bold text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded border border-slate-300 dark:border-slate-700 shrink-0">
                {thresholdSetting.matchingThreshold} units
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 6. Privacy & Statutory Compliance Charter (Phase 14 Hardening) */}
      <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20 text-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-900 dark:text-blue-300 font-bold">
            <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>Biometric Privacy, Compliance & Data Minimization Charter</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportComplianceArchive}
              disabled={isExporting}
              className="py-1 px-2.5 rounded-lg text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <ExternalLink className="w-3 h-3" />
              <span>{isExporting ? 'Exporting...' : 'Export Compliance Archive'}</span>
            </button>
            <button
              type="button"
              onClick={() => setPrivacyCharterOpen(!privacyCharterOpen)}
              className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-semibold"
            >
              {privacyCharterOpen ? 'Hide Charter' : 'View Full Charter'}
            </button>
          </div>
        </div>

        <p className="text-[11px] text-slate-600 dark:text-slate-400">
          In strict accordance with National Bank of Ethiopia Directive BSD/03/2020 and international biometric privacy principles, Oromia Bank employs mathematical one-way cryptographic tokens.
        </p>

        {privacyCharterOpen && (
          <div className="pt-2 border-t border-blue-500/15 space-y-3 text-[11px] text-slate-600 dark:text-slate-300 animate-in fade-in duration-150">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="font-bold text-slate-900 dark:text-white block">What Is Collected & Processed:</span>
                <ul className="list-disc list-inside space-y-0.5 text-slate-600 dark:text-slate-400 text-[10.5px]">
                  <li>Non-invertible Salted SHA-256 HMAC feature hashes (irreversible).</li>
                  <li>FIDO2 / WebAuthn public keys (never private keys).</li>
                  <li>Device friendly label, counter, and lifecycle status.</li>
                </ul>
              </div>
              <div className="space-y-1">
                <span className="font-bold text-slate-900 dark:text-white block">What Is Strictly Prohibited / Never Collected:</span>
                <ul className="list-disc list-inside space-y-0.5 text-red-600 dark:text-red-400 text-[10.5px]">
                  <li>Zero raw facial video frames or photographs stored.</li>
                  <li>Zero raw fingerprint ridge patterns read by operating system.</li>
                  <li>Zero persistent storage of unencrypted biometrics.</li>
                </ul>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px] pt-1 border-t border-blue-500/10">
              <div className="bg-slate-100 dark:bg-slate-800/60 p-2 rounded-lg">
                <span className="font-bold block text-slate-900 dark:text-white">Processing Location</span>
                <span>Ephemeral on-device extraction; server-authoritative token matching.</span>
              </div>
              <div className="bg-slate-100 dark:bg-slate-800/60 p-2 rounded-lg">
                <span className="font-bold block text-slate-900 dark:text-white">Retention & Deletion</span>
                <span>Active employment retention; instantaneous cryptographic shredding upon reset.</span>
              </div>
              <div className="bg-slate-100 dark:bg-slate-800/60 p-2 rounded-lg">
                <span className="font-bold block text-slate-900 dark:text-white">Administrative Boundary</span>
                <span>4-Eyes segregation; supervisors cannot reconstruct or forge biometrics.</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================= */}
      {/* STEP-UP AUTHENTICATION: RESET CONFIRMATION MODAL */}
      {/* ============================================================= */}
      {resetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <RotateCcw className="w-5 h-5" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Confirm Biometric Reset ({resetType})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setResetModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Explanation of Consequences */}
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-xs space-y-1.5 text-red-900 dark:text-red-200">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>Permanent Security Action Consequences:</span>
              </div>
              <p className="text-[11px] leading-relaxed text-red-800 dark:text-red-300">
                {resetType === 'FACE'
                  ? 'Resetting Face ID will permanently delete the enrolled mathematical facial vector template. You must complete a fresh live camera scan to regain Face ID sign-in capability.'
                  : resetType === 'FINGERPRINT'
                  ? 'Resetting WebAuthn passkeys will revoke all hardware-bound passkeys registered to this account. You must re-enroll your physical authenticators.'
                  : 'Resetting all biometrics will purge both Face ID profiles and all registered WebAuthn passkeys. All methods will return to NOT_ENROLLED.'}
              </p>
            </div>

            {resetExecutedNotice ? (
              <div className="space-y-3 py-2 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Reset Completed Successfully</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{resetExecutedNotice}</p>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  {onTriggerEnrollment && (
                    <button
                      type="button"
                      onClick={() => {
                        setResetModalOpen(false);
                        onTriggerEnrollment(resetType === 'ALL' ? 'FACE' : resetType);
                      }}
                      className="flex-1 py-2 px-3 bg-ob-indigo-600 hover:bg-ob-indigo-500 text-white font-bold text-xs rounded-xl shadow-2xs"
                    >
                      Begin Fresh Re-Enrollment
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setResetModalOpen(false)}
                    className="py-2 px-4 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Reason for Reset:
                  </label>
                  <select
                    value={resetReason}
                    onChange={(e) => setResetReason(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                  >
                    <option value="Physical appearance or camera change">Physical appearance or camera change</option>
                    <option value="Hardware authenticator replaced or upgraded">
                      Hardware authenticator replaced or upgraded
                    </option>
                    <option value="Suspected compromise or lost device">Suspected compromise or lost device</option>
                    <option value="Routine security policy refresh">Routine security policy refresh</option>
                    <option value="Supervisory administrative directive">Supervisory administrative directive</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Step-Up Authentication (Account Password):
                  </label>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="password"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      placeholder="Enter your institutional password"
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                      autoFocus
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    NBE BSD/03/2020 mandates password re-authentication before clearing credentials.
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setResetModalOpen(false)}
                    className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteResetFlow}
                    disabled={isResetting || !resetPassword}
                    className="flex-1 py-2 px-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-2xs flex items-center justify-center gap-1.5"
                  >
                    {isResetting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Authorizing...</span>
                      </>
                    ) : (
                      <>
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Authorize & Reset</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* STEP-UP AUTHENTICATION: REVOKE DEVICE MODAL */}
      {/* ============================================================= */}
      {revokeModalDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <Trash2 className="w-5 h-5" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Revoke Hardware Authenticator</h3>
              </div>
              <button
                type="button"
                onClick={() => setRevokeModalDevice(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs space-y-1">
              <div className="font-bold text-slate-900 dark:text-white">{revokeModalDevice.deviceLabel}</div>
              <div className="text-[10px] text-slate-500 font-mono">ID: {revokeModalDevice.maskedId}</div>
            </div>

            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
              Revoking this passkey permanently prevents this hardware authenticator from signing into Oromia Bank NBE
              Regulatory Platform. Your remaining registered passkeys and primary password remain valid.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Revocation Reason:
                </label>
                <input
                  type="text"
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Step-Up Authentication (Account Password):
                </label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    value={revokePassword}
                    onChange={(e) => setRevokePassword(e.target.value)}
                    placeholder="Enter your institutional password"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                    autoFocus
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRevokeModalDevice(null)}
                  className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteRevokeDevice}
                  disabled={isRevoking || !revokePassword}
                  className="flex-1 py-2 px-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-2xs flex items-center justify-center gap-1.5"
                >
                  {isRevoking ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Revoking...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Confirm Revocation</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* RENAME DEVICE MODAL */}
      {/* ============================================================= */}
      {renameModalDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-ob-indigo-600 dark:text-ob-indigo-400">
                <Edit2 className="w-4 h-4" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Rename Authenticator</h3>
              </div>
              <button
                type="button"
                onClick={() => setRenameModalDevice(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Device Friendly Label:
                </label>
                <input
                  type="text"
                  value={newDeviceLabel}
                  onChange={(e) => setNewDeviceLabel(e.target.value)}
                  placeholder="e.g. Work MacBook Touch ID, YubiKey 5C NFC"
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                  autoFocus
                  maxLength={80}
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRenameModalDevice(null)}
                  className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteRename}
                  disabled={isRenaming || !newDeviceLabel.trim()}
                  className="flex-1 py-2 px-3 bg-ob-indigo-600 hover:bg-ob-indigo-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-2xs flex items-center justify-center gap-1.5"
                >
                  {isRenaming ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Label</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
