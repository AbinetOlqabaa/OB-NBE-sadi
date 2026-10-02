/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  X,
  Fingerprint,
  ScanFace,
  Lock,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  RefreshCw,
  KeyRound,
  Trash2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { triggerHaptic } from '../utils/haptics.ts';
import { biometricService } from '../services/biometricService.ts';
import { userService } from '../services/userService.ts';
import { useBiometricAuth } from '../hooks/useBiometricAuth.ts';
import { recordBiometricAuditLog } from './AuditTrailView.tsx';

interface SmartBiometricResetModalProps {
  isOpen: boolean;
  initialEmail?: string;
  initialPassword?: string;
  onClose: () => void;
  onResetComplete: (email: string, resetType: 'FACE' | 'FINGERPRINT' | 'ALL') => void;
  onNavigateEnroll: (method: 'FACE' | 'FINGERPRINT') => void;
}

export const SmartBiometricResetModal: React.FC<SmartBiometricResetModalProps> = ({
  isOpen,
  initialEmail = '',
  initialPassword = '',
  onClose,
  onResetComplete,
  onNavigateEnroll,
}) => {
  // Credentials Inputs
  const [emailInput, setEmailInput] = useState<string>(initialEmail);
  const [passwordInput, setPasswordInput] = useState<string>(initialPassword);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Verification & Status States
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [noBiometricsNotice, setNoBiometricsNotice] = useState<string | null>(null);

  // Verified User & Enrollment Status
  const [userName, setUserName] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [hasFaceId, setHasFaceId] = useState<boolean>(false);
  const [hasFingerprint, setHasFingerprint] = useState<boolean>(false);
  const [rateLimitInfo, setRateLimitInfo] = useState<{
    isLocked: boolean;
    remainingSec: number;
    failedAttempts?: number;
  } | null>(null);
  const [remainingTrialsNotice, setRemainingTrialsNotice] = useState<number | null>(null);

  // Multi-Step Workflow:
  // 1. 'VERIFY_CREDENTIALS': User enters email and password. System checks validity AND checks prior biometric enrollment.
  // 2. 'RESET_SELECTION': Only reachable if credentials are valid AND at least one biometric method was previously enrolled.
  // 3. 'SUCCESS': Reset executed successfully.
  const [step, setStep] = useState<'VERIFY_CREDENTIALS' | 'RESET_SELECTION' | 'SUCCESS'>('VERIFY_CREDENTIALS');
  const [selectedTarget, setSelectedTarget] = useState<'FACE' | 'FINGERPRINT' | 'ALL'>('FACE');
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const { removeBiometric, refreshEnrolledStatus } = useBiometricAuth();

  // Active live lockout countdown timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (rateLimitInfo && rateLimitInfo.isLocked && rateLimitInfo.remainingSec > 0) {
      interval = setInterval(() => {
        setRateLimitInfo((prev) => {
          if (!prev || !prev.isLocked) return null;
          const nextSec = prev.remainingSec - 1;
          if (nextSec <= 0) {
            // Lockout expired: auto-reset to default
            if (emailInput.trim()) {
              biometricService.resetRateLimit(emailInput.trim());
            }
            return null;
          }
          return { ...prev, remainingSec: nextSec };
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [rateLimitInfo?.isLocked, rateLimitInfo?.remainingSec, emailInput]);

  // On open or props change, reset workflow to clean state
  useEffect(() => {
    if (isOpen) {
      setEmailInput(initialEmail);
      setPasswordInput(initialPassword);
      setShowPassword(false);
      setStep('VERIFY_CREDENTIALS');
      setVerificationError(null);
      setNoBiometricsNotice(null);
      setExecutionError(null);
      setSuccessNotice(null);
      setRemainingTrialsNotice(null);

      if (initialEmail.trim()) {
        const rateCheck = biometricService.checkRateLimit(initialEmail.trim().toLowerCase());
        if (rateCheck.isLocked) {
          setRateLimitInfo({
            isLocked: true,
            remainingSec: rateCheck.remainingLockoutSec,
            failedAttempts: rateCheck.failedAttempts,
          });
        } else {
          setRateLimitInfo(null);
        }
      } else {
        setRateLimitInfo(null);
      }
    }
  }, [isOpen, initialEmail, initialPassword]);

  /**
   * Step 1 Verification:
   * Validates corporate email format, verifies account password, and checks whether
   * Face ID or/and Fingerprint enrollment has been done previously.
   * Only allows proceeding to the reset process if BOTH credentials are valid AND prior enrollment exists.
   */
  const handleVerifyCredentialsAndProceed = async () => {
    const norm = emailInput.toLowerCase().trim();

    if (!norm) {
      setVerificationError('Please enter your corporate email address.');
      setNoBiometricsNotice(null);
      return;
    }

    if (!norm.includes('@') || !norm.endsWith('@oromiabank.com')) {
      setVerificationError('Corporate email domain (@oromiabank.com) is strictly required.');
      setNoBiometricsNotice(null);
      return;
    }

    if (!passwordInput || !passwordInput.trim()) {
      setVerificationError('Please enter your corporate account password to continue.');
      setNoBiometricsNotice(null);
      return;
    }

    setIsVerifying(true);
    setVerificationError(null);
    setNoBiometricsNotice(null);
    setExecutionError(null);

    try {
      // 1. Try server endpoint first, fallback to client-side biometricService
      let result: any = null;
      try {
        const res = await fetch('/api/auth/biometrics/reset/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: norm, password: passwordInput }),
        });
        result = await res.json();
      } catch {
        // Fallback to client service
      }

      if (!result) {
        result = biometricService.verifyResetCredentialsAndEnrollment(norm, passwordInput);
      }

      // Handle Lockout / Rate Limits
      if (result.lockedOut) {
        setRateLimitInfo({
          isLocked: true,
          remainingSec: result.remainingLockoutSec || 900,
          failedAttempts: 5,
        });
        setVerificationError(result.message || 'Service denied: Account temporarily locked due to repetitive failed trials.');
        triggerHaptic('error');
        return;
      }

      if (typeof result.remainingAttempts === 'number' && result.remainingAttempts < 5) {
        setRemainingTrialsNotice(result.remainingAttempts);
      } else {
        setRemainingTrialsNotice(null);
      }

      // Check Credential Validity
      if (!result.validCredentials) {
        setVerificationError(result.message || 'Invalid corporate account password. Please enter your valid institutional password.');
        triggerHaptic('error');
        return;
      }

      // Populate verified user details
      const user = result.user || userService.getByEmail(norm);
      if (user) {
        setUserName(user.name);
        setUserRole(user.role);
      }

      setHasFaceId(Boolean(result.hasFaceId));
      setHasFingerprint(Boolean(result.hasFingerprint));

      // Check if fingerprint or/and face enrollment has been done previously
      if (!result.hasEnrolledBiometrics) {
        // Block proceeding to any biometric resetting process!
        setNoBiometricsNotice(
          `No enrolled biometrics found: ${user?.name || norm} does not have any active Face ID or Fingerprint passkeys enrolled previously. Biometric reset cannot proceed without pre-existing biometric enrollments.`
        );
        triggerHaptic('warning');
        return;
      }

      // Both credentials and prior biometric enrollment are valid!
      // Set appropriate default target
      if (result.hasFaceId && !result.hasFingerprint) {
        setSelectedTarget('FACE');
      } else if (!result.hasFaceId && result.hasFingerprint) {
        setSelectedTarget('FINGERPRINT');
      } else if (result.hasFaceId && result.hasFingerprint) {
        setSelectedTarget('ALL');
      }

      triggerHaptic('success');
      // Advance to Step 2: Reset Selection & Execution
      setStep('RESET_SELECTION');
    } catch (err: any) {
      setVerificationError(err?.message || 'Failed to verify account credentials.');
      triggerHaptic('error');
    } finally {
      setIsVerifying(false);
    }
  };

  /**
   * Step 2 Execution:
   * Authorizes and executes the revocation of the selected biometric credential(s).
   */
  const handleExecuteReset = async () => {
    const norm = emailInput.toLowerCase().trim();

    setIsExecuting(true);
    setExecutionError(null);

    try {
      // 1. Authoritative password verification & token request
      let reqResult: any = null;
      try {
        const reqRes = await fetch('/api/auth/biometrics/reset/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: norm,
            type: selectedTarget,
            password: passwordInput,
            reason: `Self-service biometric reset by officer (${selectedTarget})`,
          }),
        });
        reqResult = await reqRes.json();
      } catch {}

      if (!reqResult) {
        reqResult = biometricService.requestReset(
          norm,
          selectedTarget,
          passwordInput,
          `Self-service biometric reset (${selectedTarget})`
        );
      }

      if (!reqResult.success || !reqResult.resetToken) {
        if (reqResult.lockedOut) {
          setRateLimitInfo({
            isLocked: true,
            remainingSec: reqResult.remainingLockoutSec || 900,
            failedAttempts: 5,
          });
          throw new Error(reqResult.message || 'Service denied: Account temporarily locked due to repetitive failed trials.');
        }

        if (typeof reqResult.remainingAttempts === 'number') {
          setRemainingTrialsNotice(reqResult.remainingAttempts);
        }
        throw new Error(reqResult.message || 'Invalid institutional password or authorization failed.');
      }

      // 2. Token consumption and revocation execution
      let execResult: any = null;
      try {
        const execRes = await fetch('/api/auth/biometrics/reset/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: norm,
            resetToken: reqResult.resetToken,
          }),
        });
        execResult = await execRes.json();
      } catch {}

      if (!execResult) {
        execResult = biometricService.executeReset(norm, reqResult.resetToken);
      }

      if (!execResult.success) {
        throw new Error(execResult.message || 'Failed to execute credential revocation.');
      }

      // 3. Local storage cleanup & synchronization
      removeBiometric(norm);
      refreshEnrolledStatus();

      // Synchronize client userService
      const user = userService.getByEmail(norm);
      if (user && user.biometricCredentials) {
        if (selectedTarget === 'ALL') {
          user.biometricCredentials = [];
        } else {
          user.biometricCredentials = user.biometricCredentials.filter((c) => c.type !== selectedTarget);
        }
      }

      // 4. Record Audit Log
      await recordBiometricAuditLog({
        actorId: norm,
        actorName: userName || norm,
        actorRole: userRole || 'MAKER',
        action: 'BIOMETRIC_PREFERENCE_DISABLED',
        type: selectedTarget === 'ALL' ? 'FINGERPRINT' : selectedTarget,
        entityId: norm,
        details: `[NBE Directive BSD/03/2020 Compliance] Officer executed authenticated biometric reset for ${selectedTarget}. Prior credentials revoked and purged.`,
      });

      triggerHaptic('success');
      setSuccessNotice(
        `Biometric passkeys (${selectedTarget === 'ALL' ? 'Face ID and Fingerprint' : selectedTarget === 'FACE' ? 'Face ID Profile' : 'WebAuthn Passkey'}) were permanently revoked and cleared from this device.`
      );
      setStep('SUCCESS');
      onResetComplete(norm, selectedTarget);
    } catch (err: any) {
      setExecutionError(err?.message || 'Biometric reset failed.');
      triggerHaptic('error');
    } finally {
      setIsExecuting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)] overflow-y-auto transition-all">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-850">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-500/30 shrink-0">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>Smart Biometric Reset</span>
                <span className="text-[9px] px-1.5 py-0.2 bg-rose-500/15 text-rose-700 dark:text-rose-300 font-mono font-bold rounded">
                  NBE BSD/03/2020
                </span>
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {step === 'VERIFY_CREDENTIALS' && 'Step 1 of 2: Verify corporate credentials & prior enrollment'}
                {step === 'RESET_SELECTION' && 'Step 2 of 2: Select biometric passkey to revoke'}
                {step === 'SUCCESS' && 'Biometric passkeys successfully revoked'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          {/* ============================================================ */}
          {/* STEP 1: VERIFY CORPORATE CREDENTIALS & PRIOR ENROLLMENT      */}
          {/* ============================================================ */}
          {step === 'VERIFY_CREDENTIALS' && (
            <div className="space-y-4">
              <div className="p-3 bg-ob-indigo-50 dark:bg-ob-indigo-950/40 border border-ob-indigo-200 dark:border-ob-indigo-800 rounded-2xl flex items-start gap-2.5 text-xs text-ob-indigo-900 dark:text-ob-indigo-200">
                <ShieldCheck className="w-4 h-4 text-ob-indigo-600 shrink-0 mt-0.5" />
                <p className="leading-snug text-[11px]">
                  <strong>Security Policy:</strong> You must enter your valid corporate email and password to proceed. The system will verify both credential validity and prior biometric enrollment before any resetting process is allowed.
                </p>
              </div>

              {/* Form Inputs */}
              <div className="space-y-3">
                {/* 1. Corporate Email Field */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Officer Corporate Email Address
                  </label>
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleVerifyCredentialsAndProceed();
                    }}
                    placeholder="e.g. abebe.kebede@oromiabank.com"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-ob-indigo-500 font-medium"
                  />
                </div>

                {/* 2. Password Entry Field (Required by Acceptance Criterion 26) */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Corporate Account Password</span>
                    </span>
                    <span className="text-[10px] text-rose-500 font-bold">*Required</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleVerifyCredentialsAndProceed();
                      }}
                      placeholder="Enter your institutional password to continue"
                      className="w-full px-3 py-2 pr-10 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-ob-indigo-500 font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer p-1"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Rate Limit Alert */}
              {rateLimitInfo && rateLimitInfo.isLocked && (
                <div className="p-3.5 bg-rose-50 dark:bg-rose-950/50 border-2 border-rose-300 dark:border-rose-800 rounded-2xl flex items-start gap-2.5 text-xs text-rose-900 dark:text-rose-200 animate-in fade-in">
                  <Lock className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">Service Denied — Account Temporarily Locked</p>
                    <p className="leading-snug text-[11px] text-rose-700 dark:text-rose-300">
                      Service denial triggered due to {rateLimitInfo.failedAttempts || 5} consecutive failed trials. Service will automatically reset to default in{' '}
                      <span className="font-mono font-bold underline">{rateLimitInfo.remainingSec}s</span>.
                    </p>
                  </div>
                </div>
              )}

              {/* Remaining Trials Notice */}
              {remainingTrialsNotice !== null && remainingTrialsNotice > 0 && !rateLimitInfo?.isLocked && (
                <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl flex items-center gap-2 text-xs text-amber-800 dark:text-amber-200">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="font-medium text-[11px]">
                    Warning: <strong>{remainingTrialsNotice}</strong> acceptable trial(s) remaining before temporary service denial.
                  </span>
                </div>
              )}

              {/* Verification Error Box */}
              {verificationError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 rounded-2xl flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-200 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <p className="leading-snug">{verificationError}</p>
                </div>
              )}

              {/* No Biometrics Enrolled Blocker Notice (Phase 26 Acceptance Criterion) */}
              {noBiometricsNotice && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center space-y-2.5 animate-in fade-in duration-200">
                  <div className="w-10 h-10 mx-auto rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      No Enrolled Biometrics Found
                    </h4>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug max-w-xs mx-auto mt-0.5">
                      {noBiometricsNotice}
                    </p>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onNavigateEnroll('FACE');
                      }}
                      className="flex-1 py-2 px-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow cursor-pointer transition-all flex items-center justify-center gap-1.5 touch-press"
                    >
                      <ScanFace className="w-3.5 h-3.5" />
                      <span>Enroll Face ID</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onNavigateEnroll('FINGERPRINT');
                      }}
                      className="flex-1 py-2 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow cursor-pointer transition-all flex items-center justify-center gap-1.5 touch-press"
                    >
                      <Fingerprint className="w-3.5 h-3.5" />
                      <span>Enroll Fingerprint</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Action Button: Verify Credentials & Continue */}
              <button
                type="button"
                onClick={handleVerifyCredentialsAndProceed}
                disabled={isVerifying || !emailInput.trim() || !passwordInput.trim() || Boolean(rateLimitInfo?.isLocked)}
                className="w-full py-2.5 px-4 bg-ob-indigo-600 hover:bg-ob-indigo-700 text-white font-bold text-xs rounded-xl shadow cursor-pointer transition-all flex items-center justify-center gap-2 disabled:opacity-50 touch-press"
              >
                {isVerifying ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Verifying Credentials & Biometric Status...</span>
                  </>
                ) : (
                  <>
                    <span>Verify Credentials & Continue</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          )}

          {/* ============================================================ */}
          {/* STEP 2: SELECT BIOMETRIC CREDENTIAL TO RESET & EXECUTE       */}
          {/* ============================================================ */}
          {step === 'RESET_SELECTION' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Back to Step 1 Button */}
              <button
                type="button"
                onClick={() => setStep('VERIFY_CREDENTIALS')}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Change Credentials</span>
              </button>

              {/* Verified Account Details Badge */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block">{userName}</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    {emailInput.toLowerCase().trim()} • {userRole}
                  </span>
                </div>
                <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold rounded-lg border border-emerald-500/20">
                  Credentials Verified
                </span>
              </div>

              {/* Selection Options */}
              <div className="space-y-2.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Select Enrolled Biometric Credential to Reset:
                </label>

                <div className="space-y-2">
                  {/* Option 1: Face ID */}
                  <label
                    className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                      !hasFaceId
                        ? 'opacity-40 bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 cursor-not-allowed'
                        : selectedTarget === 'FACE'
                        ? 'bg-rose-500/10 border-rose-500/60 shadow-xs'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="resetTarget"
                        value="FACE"
                        disabled={!hasFaceId}
                        checked={selectedTarget === 'FACE'}
                        onChange={() => setSelectedTarget('FACE')}
                        className="accent-rose-600"
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <ScanFace className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                          <span className="font-bold text-xs text-slate-900 dark:text-white">Face ID Profile</span>
                        </div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block leading-tight mt-0.5">
                          {hasFaceId ? 'Active template registered in NBE vault' : 'Not currently enrolled'}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                        hasFaceId
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-500 border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {hasFaceId ? 'ENROLLED' : 'UNENROLLED'}
                    </span>
                  </label>

                  {/* Option 2: Fingerprint */}
                  <label
                    className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                      !hasFingerprint
                        ? 'opacity-40 bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 cursor-not-allowed'
                        : selectedTarget === 'FINGERPRINT'
                        ? 'bg-rose-500/10 border-rose-500/60 shadow-xs'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="resetTarget"
                        value="FINGERPRINT"
                        disabled={!hasFingerprint}
                        checked={selectedTarget === 'FINGERPRINT'}
                        onChange={() => setSelectedTarget('FINGERPRINT')}
                        className="accent-rose-600"
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <Fingerprint className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <span className="font-bold text-xs text-slate-900 dark:text-white">WebAuthn Passkey</span>
                        </div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block leading-tight mt-0.5">
                          {hasFingerprint ? 'Hardware authenticator bound' : 'Not currently enrolled'}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                        hasFingerprint
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-500 border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {hasFingerprint ? 'ENROLLED' : 'UNENROLLED'}
                    </span>
                  </label>

                  {/* Option 3: Both (if both enrolled) */}
                  {hasFaceId && hasFingerprint && (
                    <label
                      className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                        selectedTarget === 'ALL'
                          ? 'bg-rose-500/15 border-rose-500/70 shadow-xs'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="resetTarget"
                          value="ALL"
                          checked={selectedTarget === 'ALL'}
                          onChange={() => setSelectedTarget('ALL')}
                          className="accent-rose-600"
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <RotateCcw className="w-4 h-4 text-rose-600" />
                            <span className="font-bold text-xs text-slate-900 dark:text-white">
                              Purge All Biometrics
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block leading-tight mt-0.5">
                            Revoke both Face ID profile and platform passkeys
                          </span>
                        </div>
                      </div>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                        COMPLETE WIPE
                      </span>
                    </label>
                  )}
                </div>
              </div>

              {/* Regulatory Consequences Notice */}
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl text-[11px] text-amber-800 dark:text-amber-200 space-y-1">
                <span className="font-bold block">NBE BSD/03/2020 Statutory Consequence:</span>
                <p className="leading-snug">
                  Resetting will permanently revoke and purge enrolled biometric public keys and vector templates from the device and server vault. Subsequent logins will require your corporate password until fresh biometrics are re-enrolled.
                </p>
              </div>

              {executionError && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{executionError}</span>
                </div>
              )}

              {/* Action Button: Execute Reset */}
              <button
                type="button"
                onClick={handleExecuteReset}
                disabled={isExecuting || Boolean(rateLimitInfo?.isLocked)}
                className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow cursor-pointer transition-all flex items-center justify-center gap-2 disabled:opacity-50 touch-press"
              >
                {isExecuting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Verifying & Revoking Passkeys...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Authorize & Revoke {selectedTarget} Passkeys</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* ============================================================ */}
          {/* STEP 3: SUCCESS CONFIRMATION                                 */}
          {/* ============================================================ */}
          {step === 'SUCCESS' && (
            <div className="space-y-4 text-center py-2 animate-in zoom-in-95 duration-200">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-md">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Biometric Reset Successful
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 max-w-xs mx-auto leading-relaxed mt-1">
                  {successNotice}
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 text-left text-[11px] space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Account:</span>
                  <span className="font-mono font-medium text-slate-700 dark:text-slate-300">{emailInput}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Revocation Scope:</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">{selectedTarget}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Audit Reference:</span>
                  <span className="font-mono text-[10px] text-slate-600 dark:text-slate-400">
                    OB-NBE-REV-{Date.now().toString(16).toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigateEnroll(selectedTarget === 'FINGERPRINT' ? 'FINGERPRINT' : 'FACE');
                  }}
                  className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow cursor-pointer touch-press transition-all flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Re-Enroll Fresh Biometrics</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="py-2 px-3 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl cursor-pointer transition-all"
                >
                  Return to Sign In
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
