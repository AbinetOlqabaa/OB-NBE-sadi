/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Shield,
  Lock,
  Mail,
  User,
  CheckCircle2,
  AlertCircle,
  Building2,
  ArrowRight,
  UserPlus,
  KeyRound,
  ShieldCheck,
  Sparkles,
  Fingerprint,
  ScanFace,
  Trash2,
  Eye,
  EyeOff,
  HelpCircle,
  RefreshCw,
} from 'lucide-react';
import { UserSession } from '../types/regulatory.ts';
import { userService } from '../services/userService.ts';
import { ThemeToggle } from './ThemeToggle.tsx';
import { useBiometricAuth } from '../hooks/useBiometricAuth.ts';
import { BiometricPromptModal } from './BiometricPromptModal.tsx';
import { ResetPasswordModal } from './ResetPasswordModal.tsx';
import { triggerHaptic, vibrate } from '../utils/haptics.ts';
import {
  isBiometricLoginEnabled,
  subscribeToBiometricPreferenceChanges,
} from '../utils/deviceCapabilities.ts';

interface LoginPageProps {
  onLoginSuccess: (user: UserSession, redirectTab?: string) => void;
  onNavigateRegister: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
  onNavigateRegister,
}) => {
  const [email, setEmail] = useState('admin@oromiabank.com');
  const [password, setPassword] = useState('password');
  const [showPassword, setShowPassword] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [biometricNotice, setBiometricNotice] = useState<string | null>(null);
  const [isBiometricModalOpen, setIsBiometricModalOpen] = useState(false);
  const [biometricModalMode, setBiometricModalMode] = useState<'REGISTER' | 'AUTHENTICATE'>('AUTHENTICATE');
  const [selectedBiometricMethod, setSelectedBiometricMethod] = useState<'FINGERPRINT' | 'FACE'>('FINGERPRINT');

  // User Biometric Login Preference (individual setting per user)
  const [isBioPrefEnabled, setIsBioPrefEnabled] = useState<boolean>(() => isBiometricLoginEnabled(email));

  useEffect(() => {
    setIsBioPrefEnabled(isBiometricLoginEnabled(email));
  }, [email]);

  useEffect(() => {
    return subscribeToBiometricPreferenceChanges((detail) => {
      if (!detail.userEmail || detail.userEmail.toLowerCase() === email.toLowerCase()) {
        setIsBioPrefEnabled(detail.enabled);
      }
    });
  }, [email]);

  const {
    isSupported: isWebAuthnSupported,
    isPlatformAvailable,
    isFingerprintSupported,
    fingerprintStatus,
    isCameraSupported,
    cameraStatus,
    hasAnyBiometric,
    hasBothBiometrics,
    preferredMethod,
    isRegistered: hasBiometricRegistered,
    registeredEmail,
    registeredUsers,
    isAuthenticating: isBiometricScanning,
    isRegistering: isBiometricRegistering,
    error: biometricError,
    login,
    register,
    authenticateBiometric,
    registerBiometric,
    saveLocalCredential,
    removeBiometric,
    resetError,
  } = useBiometricAuth();

  // Internal diagnostic process: silently evaluates availability of fingerprint scanner and camera on this device
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
        const detectedMethods: string[] = [];
        if (isFingerprintSupported) detectedMethods.push('Fingerprint Scanner');
        if (isCameraSupported) detectedMethods.push('Device Camera (Face ID)');

        const diagnosticSummary = hasBothBiometrics
          ? 'Both fingerprint scanner and device camera availability verified on this device'
          : detectedMethods.length === 1
          ? `Single biometric sensor verified on this device (${detectedMethods[0]})`
          : 'Internal diagnostic complete: No physical biometric hardware detected';

        sessionStorage.setItem(
          'ob_internal_hw_diagnostic',
          JSON.stringify({
            isFingerprintSupported,
            isCameraSupported,
            hasBothBiometrics,
            hasAnyBiometric,
            summary: diagnosticSummary,
            timestamp: new Date().toISOString(),
          })
        );
      }
    } catch {}
  }, [isFingerprintSupported, isCameraSupported, hasBothBiometrics, hasAnyBiometric]);

  // Active target user
  const currentTargetUser = userService.getByEmail(email) || userService.getAll()[0];

  // Auto-prompt on first attempt or after password reset if device supports biometrics and user has not disabled
  useEffect(() => {
    if (!isBioPrefEnabled) return;

    // 1. Check if user just completed password reset
    const resetEmail = localStorage.getItem('ob_prompt_biometric_after_reset');
    if (resetEmail) {
      localStorage.removeItem('ob_prompt_biometric_after_reset');
      setEmail(resetEmail);
      setBiometricNotice('Password reset successfully! Set up or verify your biometric passkey for rapid login.');
      if (hasAnyBiometric) {
        setBiometricModalMode('AUTHENTICATE');
        setSelectedBiometricMethod(isCameraSupported && !isFingerprintSupported ? 'FACE' : 'FINGERPRINT');
        setIsBiometricModalOpen(true);
      }
      return;
    }

    // 2. First visit prompt on supported devices
    const firstVisitPrompted = localStorage.getItem('ob_biometric_first_visit_prompted');
    if (!firstVisitPrompted && hasAnyBiometric) {
      localStorage.setItem('ob_biometric_first_visit_prompted', 'true');
      setBiometricModalMode(hasBiometricRegistered ? 'AUTHENTICATE' : 'REGISTER');
      setSelectedBiometricMethod(isCameraSupported && !isFingerprintSupported ? 'FACE' : 'FINGERPRINT');
      setIsBiometricModalOpen(true);
    }
  }, [hasAnyBiometric, hasBiometricRegistered, isCameraSupported, isFingerprintSupported, isBioPrefEnabled]);

  // Development Seed Accounts Reset Handler
  const [isResettingSeed, setIsResettingSeed] = useState(false);
  const handleResetSeedData = async () => {
    setIsResettingSeed(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/auth/seed-data/reset', { method: 'POST' });
      if (res.ok) {
        removeBiometric();
        setBiometricNotice('Development seed accounts restored with zero pre-seeded biometrics. Accounts are ready for browser enrollment.');
        triggerHaptic('success');
      } else {
        const local = userService.resetDevelopmentSeedData();
        removeBiometric();
        setBiometricNotice(local.message);
        triggerHaptic('success');
      }
    } catch {
      const local = userService.resetDevelopmentSeedData();
      removeBiometric();
      setBiometricNotice(local.message);
      triggerHaptic('success');
    } finally {
      setIsResettingSeed(false);
    }
  };

  const handleOpenBiometricModal = (mode: 'REGISTER' | 'AUTHENTICATE', method?: 'FINGERPRINT' | 'FACE') => {
    if (!isBioPrefEnabled && mode === 'AUTHENTICATE') {
      setBiometricNotice(
        'Biometric hardware authentication is currently turned OFF for this user account in Sidebar settings. Please sign in with your password, or re-enable it in the Sidebar settings.'
      );
      vibrate(25);
      return;
    }

    setBiometricModalMode(mode);
    if (method) {
      setSelectedBiometricMethod(method);
    } else {
      setSelectedBiometricMethod(isCameraSupported && !isFingerprintSupported ? 'FACE' : 'FINGERPRINT');
    }
    setIsBiometricModalOpen(true);
    setErrorMessage(null);
    setBiometricNotice(null);
  };

  const handleBiometricModalSuccess = async (
    method: 'FINGERPRINT' | 'FACE',
    faceData?: { imageBase64?: string; faceHash?: string }
  ) => {
    setIsBiometricModalOpen(false);

    const targetUser = userService.getByEmail(email) || userService.getAll()[0];
    if (biometricModalMode === 'REGISTER' && targetUser) {
      saveLocalCredential(
        {
          id: targetUser.id,
          email: targetUser.email,
          name: targetUser.name,
          role: targetUser.role,
          department: targetUser.department,
          employeeId: targetUser.employeeId,
        },
        undefined,
        method,
        faceData?.faceHash
      );
      triggerHaptic('success');
      setBiometricNotice(
        `${method === 'FACE' ? 'Face ID (Camera)' : 'Biometric fingerprint'} passkey registered for ${targetUser.name} (${targetUser.role})!`
      );
    }

    // Authenticate user session
    const targetEmail = targetUser?.email || email.trim();
    const result = await login(targetEmail, method, faceData);
    if (result.success && result.user) {
      triggerHaptic('success');
      onLoginSuccess(result.user, result.redirectTab);
    } else if (result.error) {
      setErrorMessage(result.error);
    }
  };

  const handleLoginWithBiometrics = async (preferredType: 'FINGERPRINT' | 'FACE' = 'FINGERPRINT') => {
    setErrorMessage(null);
    setBiometricNotice(null);
    const activeEmail = email.trim() || registeredEmail || localStorage.getItem('ob_regulatory_last_user') || '';
    if (!activeEmail) {
      setErrorMessage('Please enter your corporate email address above or register a biometric passkey.');
      return;
    }
    const method = preferredType;
    try {
      const result = await login(activeEmail, method);
      if (result.success && result.user) {
        triggerHaptic('success');
        onLoginSuccess(result.user, result.redirectTab);
        return;
      }
    } catch {}
    setSelectedBiometricMethod(preferredType);
    setBiometricModalMode('AUTHENTICATE');
    setIsBiometricModalOpen(true);
  };

  const handleDirectBiometricSignIn = async () => {
    await handleLoginWithBiometrics(isCameraSupported && !isFingerprintSupported ? 'FACE' : 'FINGERPRINT');
  };

  const handleEnrollCurrentAccount = async () => {
    setErrorMessage(null);
    setBiometricNotice(null);
    if (!email.trim()) {
      setErrorMessage('Please enter your corporate email address before registering biometrics.');
      return;
    }
    handleOpenBiometricModal('REGISTER', isCameraSupported && !isFingerprintSupported ? 'FACE' : 'FINGERPRINT');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMessage('Please enter your Oromia Bank corporate email address.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your account password.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.user) {
        triggerHaptic('success');
        onLoginSuccess(data.user, data.redirectTab);
        return;
      } else if (data.message) {
        setErrorMessage(data.message);
        return;
      }
    } catch {
      // Standalone / client-side fallback
      const localResult = userService.login(email.trim(), password);
      if (localResult.success && localResult.user) {
        triggerHaptic('success');
        onLoginSuccess(localResult.user, localResult.redirectTab);
        return;
      } else {
        setErrorMessage(localResult.message || 'Login failed. Please verify credentials.');
        return;
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-slate-50 dark:bg-slate-950 relative font-sans text-slate-900 dark:text-slate-100 selection:bg-ob-indigo-600 selection:text-white transition-colors">
      {/* Harmonious Oromia Bank Brand Background Accents */}
      <div className="absolute top-0 right-0 w-[550px] h-[550px] bg-ob-indigo-500/10 dark:bg-ob-indigo-600/15 rounded-full blur-3xl pointer-events-none -mr-32 -mt-32"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-ob-green-500/10 dark:bg-ob-green-500/10 rounded-full blur-3xl pointer-events-none -ml-32 -mb-32"></div>

      {/* Top Brand Bar */}
      <header className="px-3.5 sm:px-8 py-2.5 sm:py-3.5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md sticky top-0 z-20 shrink-0 transition-colors">
        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
          <div className="h-8 sm:h-10 bg-white/95 dark:bg-white/90 px-2 py-1 rounded-xl shadow-xs border border-slate-200 dark:border-white/20 flex items-center justify-center shrink-0">
            <img
              src="/brand/oromia-logo-full.png"
              alt="Oromia Bank"
              className="h-6 sm:h-8 w-auto object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/brand/oromia-logo-mark-transparent.png';
              }}
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs sm:text-base font-bold tracking-tight text-ob-indigo-900 dark:text-white truncate">
                Oromia Bank
              </span>
              <span className="px-1.5 py-0.2 rounded text-[9px] sm:text-[10px] font-mono font-bold bg-ob-green-50 dark:bg-ob-green-500/20 text-ob-green-800 dark:text-ob-green-300 border border-ob-green-300 dark:border-ob-green-500/40 shrink-0">
                0000013
              </span>
            </div>
            <span className="hidden sm:block text-[11px] text-slate-500 dark:text-slate-400 truncate">
              National Bank of Ethiopia (NBE) Prudential Reporting Gateway
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden lg:flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 font-medium bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
            <ShieldCheck className="w-4 h-4 text-ob-green-600 dark:text-ob-green-400" />
            <span>Directive BSD/03/2020 Compliant</span>
          </div>

          {/* Dedicated Theme Toggle Dropdown Button (Compact on Mobile) */}
          <ThemeToggle align="right" showLabelOnMobile={false} />
        </div>
      </header>

      {/* Main Login Card Viewport */}
      <main className="flex-1 flex items-center justify-center p-3.5 sm:p-6 py-6 sm:py-8 relative z-10 w-full max-w-lg mx-auto">
        <div className="w-full bg-white dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-7 shadow-xl dark:shadow-2xl backdrop-blur-md space-y-4 transition-colors">
          {/* Card Header with Oromia Bank Emblem */}
          <div className="text-center space-y-1">
            <div className="inline-flex p-2 rounded-2xl bg-white shadow-md border border-ob-indigo-100 dark:border-ob-indigo-900/60 mb-1">
              <img
                src="/brand/oromia-logo-mark-transparent.png"
                alt="Oromia Bank Emblem"
                className="w-7 h-7 sm:w-8 sm:h-8 object-contain"
              />
            </div>
            <h1 className="text-base sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Sign In to OB Regulatory Portal
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-300">
              Enter credentials to navigate to your role dashboard
            </p>
          </div>

          {/* Biometric Sign-in Section: Fingerprint & Face ID Buttons with Hardware Radar Ping */}
          <div className="bg-gradient-to-r from-emerald-950/20 via-teal-950/20 to-slate-900/20 border border-emerald-600/30 dark:border-emerald-500/30 rounded-xl p-3.5 space-y-3 relative overflow-hidden">
            <div className="flex items-center gap-2.5">
              <div className="relative w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-emerald-500/20 border border-emerald-400/40 text-emerald-700 dark:text-emerald-400">
                {hasAnyBiometric && (
                  <span className="absolute -inset-1 rounded-lg bg-emerald-500/20 animate-bio-radar pointer-events-none" />
                )}
                <Fingerprint className="w-4 h-4 text-emerald-600 dark:text-emerald-400 relative z-10" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Biometric Sign-In & Passkeys
                  </span>
                  {!isBioPrefEnabled ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                      Disabled in Settings
                    </span>
                  ) : hasAnyBiometric ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/15 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-80"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                      </span>
                      Hardware Ready
                    </span>
                  ) : null}
                  {hasBiometricRegistered && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                      Enrolled
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">
                  {!isBioPrefEnabled
                    ? 'Hardware authentication is disabled for this user in Sidebar settings'
                    : 'One-touch Sign-In with Fingerprint sensor or Face ID webcam'}
                </span>
              </div>
            </div>

            {/* Primary "Login with Biometrics" Action Button */}
            <button
              type="button"
              onClick={() => handleLoginWithBiometrics(isCameraSupported && !isFingerprintSupported ? 'FACE' : 'FINGERPRINT')}
              disabled={isBiometricScanning || loading}
              className="w-full min-h-[44px] py-2.5 px-4 font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] text-white cursor-pointer touch-press"
            >
              <Fingerprint className="w-4 h-4 text-emerald-100 shrink-0" />
              <span>Login with Biometrics</span>
            </button>

            {/* Dedicated 2-Button Grid: Fingerprint & Face ID with Hardware-Detected Radar Ping */}
            <div className="grid grid-cols-2 gap-2">
              {/* Fingerprint Button */}
              <div className="relative group">
                {isFingerprintSupported && (
                  <span className="absolute -inset-0.5 rounded-xl bg-emerald-500/30 animate-button-radar pointer-events-none" />
                )}
                <button
                  type="button"
                  onClick={() => handleOpenBiometricModal('AUTHENTICATE', 'FINGERPRINT')}
                  disabled={isBiometricScanning || loading}
                  className={`relative z-10 w-full min-h-[44px] py-2.5 px-2 font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white cursor-pointer touch-press overflow-hidden ${
                    isFingerprintSupported ? 'ring-1 ring-emerald-300/60 animate-hardware-glow-emerald' : ''
                  }`}
                >
                  {isFingerprintSupported && (
                    <div className="absolute inset-0 pointer-events-none opacity-25 bg-gradient-to-r from-transparent via-white to-transparent animate-bio-shimmer" />
                  )}
                  <div className="relative flex items-center">
                    <Fingerprint className="w-4 h-4 text-emerald-100 shrink-0" />
                    {isFingerprintSupported && (
                      <span className="absolute -top-1 -right-1 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-200 opacity-80"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-300"></span>
                      </span>
                    )}
                  </div>
                  <span>Fingerprint</span>
                  {isFingerprintSupported && (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-700/90 text-emerald-100 font-semibold uppercase tracking-wider">
                      Ready
                    </span>
                  )}
                </button>
              </div>

              {/* Face ID Button */}
              <div className="relative group">
                {isCameraSupported && (
                  <span className="absolute -inset-0.5 rounded-xl bg-teal-500/30 animate-button-radar pointer-events-none" />
                )}
                <button
                  type="button"
                  onClick={() => handleOpenBiometricModal('AUTHENTICATE', 'FACE')}
                  disabled={isBiometricScanning || loading}
                  className={`relative z-10 w-full min-h-[44px] py-2.5 px-2 font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white cursor-pointer touch-press overflow-hidden ${
                    isCameraSupported ? 'ring-1 ring-teal-300/60 animate-hardware-glow-teal' : ''
                  }`}
                >
                  {isCameraSupported && (
                    <div className="absolute inset-0 pointer-events-none opacity-25 bg-gradient-to-r from-transparent via-white to-transparent animate-bio-shimmer" />
                  )}
                  <div className="relative flex items-center">
                    <ScanFace className="w-4 h-4 text-teal-100 shrink-0" />
                    {isCameraSupported && (
                      <span className="absolute -top-1 -right-1 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-200 opacity-80"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-teal-300"></span>
                      </span>
                    )}
                  </div>
                  <span>Face ID</span>
                  {isCameraSupported && (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-teal-700/90 text-teal-100 font-semibold uppercase tracking-wider">
                      Ready
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Enrollment & Reset Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleOpenBiometricModal('REGISTER')}
                className="flex-1 min-h-[38px] py-1.5 px-3 font-bold text-xs rounded-xl border bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-emerald-700 dark:text-emerald-400 border-emerald-500/40 cursor-pointer touch-press transition-all flex items-center justify-center gap-1.5"
              >
                <Fingerprint className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Register Biometric Passkey</span>
              </button>

              {hasBiometricRegistered && (
                <button
                  type="button"
                  onClick={() => removeBiometric()}
                  className="min-h-[38px] px-2.5 text-rose-600 dark:text-rose-400 hover:bg-rose-950/30 rounded-xl border border-rose-800/40 text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1 shrink-0 touch-press"
                  title="Clear passkey from device"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              )}
            </div>

            <p className="text-[10px] text-slate-500 dark:text-slate-400 text-center">
              Touch your fingerprint sensor or scan with your device webcam to sign in
            </p>
          </div>

          {/* Biometric Prompt Interactive Modal */}
          <BiometricPromptModal
            isOpen={isBiometricModalOpen}
            mode={biometricModalMode}
            userName={currentTargetUser?.name || 'Bank Officer'}
            userEmail={currentTargetUser?.email || email}
            userRole={currentTargetUser?.role || 'MAKER'}
            initialMethod={selectedBiometricMethod}
            onSuccess={handleBiometricModalSuccess}
            onCancel={() => setIsBiometricModalOpen(false)}
          />

          {/* Reset Password Interactive Modal */}
          <ResetPasswordModal
            isOpen={isResetPasswordOpen}
            onClose={() => setIsResetPasswordOpen(false)}
            onResetSuccess={(resetEmail) => {
              setIsResetPasswordOpen(false);
              setEmail(resetEmail);
              setBiometricNotice(`Password reset successfully for ${resetEmail}! You can now sign in with your new password.`);
              if (hasAnyBiometric) {
                setBiometricModalMode('AUTHENTICATE');
                setIsBiometricModalOpen(true);
              }
            }}
            initialEmail={email}
          />

          {/* Biometric Success / Info Notice */}
          {biometricNotice && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-200 text-xs flex items-start gap-2.5 shadow-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="leading-snug">{biometricNotice}</div>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-200 text-xs flex items-start gap-2.5 shadow-sm">
              <AlertCircle className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="leading-snug">{errorMessage}</div>
            </div>
          )}

          {/* Divider */}
          <div className="relative flex py-0.5 items-center">
            <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
            <span className="shrink-0 mx-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Or Sign In with Password
            </span>
            <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Corporate Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  placeholder="username@oromiabank.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full min-h-[44px] pl-9 pr-3 py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-ob-indigo-500 dark:focus:border-ob-indigo-400 focus:ring-1 focus:ring-ob-indigo-500 dark:focus:ring-ob-indigo-400 transition-colors font-medium"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setIsResetPasswordOpen(true)}
                  className="text-[11px] font-bold text-ob-indigo-600 hover:text-ob-indigo-700 dark:text-ob-green-400 dark:hover:text-ob-green-300 transition-colors cursor-pointer touch-press"
                >
                  Forgot / Reset Password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full min-h-[44px] pl-9 pr-10 py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-ob-indigo-500 dark:focus:border-ob-indigo-400 focus:ring-1 focus:ring-ob-indigo-500 dark:focus:ring-ob-indigo-400 transition-colors font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="min-h-[40px] min-w-[40px] absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer touch-press"
                  title={showPassword ? 'Hide password' : 'Show password'}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[44px] sm:min-h-[48px] py-2.5 px-4 bg-ob-indigo-600 hover:bg-ob-indigo-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-ob-indigo-950/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-2 cursor-pointer touch-press"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In to Dashboard'}</span>
              <ArrowRight className="w-4 h-4 text-ob-green-300" />
            </button>
          </form>

          {/* Registration Link */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 text-center space-y-1">
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
              Need access as a new Maker or Checker?
            </p>
            <button
              type="button"
              onClick={onNavigateRegister}
              className="min-h-[40px] inline-flex items-center justify-center gap-1.5 text-xs font-bold text-ob-indigo-700 dark:text-ob-green-400 hover:text-ob-indigo-800 dark:hover:text-ob-green-300 transition-colors cursor-pointer touch-press px-2 py-1"
            >
              <UserPlus className="w-4 h-4" />
              <span>Register for Maker / Checker Account</span>
            </button>
          </div>

          {/* Development Seed Accounts Reference & Reset Mechanism */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
            <details className="group border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/80 dark:bg-slate-800/80 p-2.5 sm:p-3 text-xs transition-all">
              <summary className="font-bold text-[11px] sm:text-xs text-slate-700 dark:text-slate-300 flex items-center justify-between cursor-pointer select-none">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-ob-green-600 dark:text-ob-green-400 shrink-0" />
                  <span>Development Test Accounts Reference</span>
                </span>
                <span className="text-[10px] text-ob-indigo-600 dark:text-ob-green-400 font-semibold group-open:rotate-180 transition-transform">
                  ▼
                </span>
              </summary>

              <div className="mt-2.5 space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    Default dev password: <code className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono font-bold text-slate-800 dark:text-slate-200">password</code>
                  </span>
                  <button
                    type="button"
                    onClick={handleResetSeedData}
                    disabled={isResettingSeed}
                    className="text-[10px] font-semibold text-ob-indigo-700 dark:text-ob-green-400 hover:underline flex items-center gap-1 cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${isResettingSeed ? 'animate-spin' : ''}`} />
                    <span>{isResettingSeed ? 'Resetting...' : 'Reset Seed Data'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {[
                    {
                      role: 'ADMIN',
                      email: 'admin@oromiabank.com',
                      name: 'Dawit Bekele',
                      dept: 'Compliance & Legal Governance',
                    },
                    {
                      role: 'MAKER',
                      email: 'abebe.kebede@oromiabank.com',
                      name: 'Abebe Kebede',
                      dept: 'Credit Operations & Portfolio Mgmt',
                    },
                    {
                      role: 'CHECKER',
                      email: 'chala.desta@oromiabank.com',
                      name: 'Chala Desta',
                      dept: 'Credit Operations & Portfolio Mgmt',
                    },
                    {
                      role: 'AUDITOR',
                      email: 'auditor@oromiabank.com',
                      name: 'Worku Alemu',
                      dept: 'Internal Audit & Regulatory Control',
                    },
                  ].map((acc) => (
                    <div
                      key={acc.email}
                      className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-[11px] flex flex-col justify-between gap-1 shadow-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-slate-900 dark:text-white text-[10px] uppercase tracking-wide">
                            {acc.role}
                          </span>
                          <span className="text-[9px] text-slate-400 dark:text-slate-500 truncate max-w-[120px]">
                            {acc.dept}
                          </span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-600 dark:text-slate-300 truncate">
                          {acc.email}
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-[9px]">
                        <span className="text-slate-400 truncate">{acc.name}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setEmail(acc.email);
                            setPassword('');
                            setErrorMessage(null);
                            setBiometricNotice(`Selected ${acc.name} (${acc.role}). Enter password "password" to authenticate or enroll biometrics.`);
                          }}
                          className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-ob-indigo-50 dark:hover:bg-ob-indigo-950/40 text-ob-indigo-700 dark:text-ob-green-300 font-semibold cursor-pointer transition-colors"
                        >
                          Use Email
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <p className="text-[9px] text-slate-400 dark:text-slate-500 leading-tight italic">
                  Note: Biometrics start un-enrolled so authentic device/browser passkey or camera Face ID registration can be verified.
                </p>
              </div>
            </details>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-4 sm:px-6 py-2.5 sm:py-3 border-t border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 text-center text-slate-500 dark:text-slate-400 text-[11px] sm:text-xs relative z-10 flex flex-col sm:flex-row items-center justify-between gap-1 shrink-0 transition-colors">
        <div>
          © 2026 Oromia Bank S.C. All rights reserved.
        </div>
        <div className="text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500">
          Authorized for National Bank of Ethiopia Commercial Banking Supervision
        </div>
      </footer>
    </div>
  );
};
