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
} from 'lucide-react';
import { UserSession } from '../types/regulatory.ts';
import { userService } from '../services/userService.ts';
import { ThemeToggle } from './ThemeToggle.tsx';
import { useBiometricAuth } from '../hooks/useBiometricAuth.ts';
import { BiometricPromptModal } from './BiometricPromptModal.tsx';

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
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [biometricNotice, setBiometricNotice] = useState<string | null>(null);
  const [isBiometricModalOpen, setIsBiometricModalOpen] = useState(false);
  const [biometricModalMode, setBiometricModalMode] = useState<'REGISTER' | 'AUTHENTICATE'>('AUTHENTICATE');

  const {
    isSupported: isWebAuthnSupported,
    isPlatformAvailable,
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

  // Active target user
  const currentTargetUser = userService.getByEmail(email) || userService.getAll()[0];

  // Quick Preset Selector for 1-Click Testing
  const handleQuickPreset = (presetEmail: string) => {
    setEmail(presetEmail);
    setPassword('password');
    setErrorMessage(null);
    setBiometricNotice(null);
    resetError();
  };

  const handleOpenBiometricModal = (mode: 'REGISTER' | 'AUTHENTICATE') => {
    setBiometricModalMode(mode);
    setIsBiometricModalOpen(true);
    setErrorMessage(null);
    setBiometricNotice(null);
  };

  const handleBiometricModalSuccess = async () => {
    setIsBiometricModalOpen(false);

    if (biometricModalMode === 'REGISTER') {
      const targetUser = userService.getByEmail(email) || userService.getAll()[0];
      if (targetUser) {
        saveLocalCredential({
          id: targetUser.id,
          email: targetUser.email,
          name: targetUser.name,
          role: targetUser.role,
          department: targetUser.department,
          employeeId: targetUser.employeeId,
        });
        setBiometricNotice(`Biometric hardware passkey registered for ${targetUser.name} (${targetUser.role})! You can now sign in with one touch.`);
      }
    } else {
      // Authenticate
      const result = await login(email);
      if (result.success && result.user) {
        onLoginSuccess(result.user, result.redirectTab);
      }
    }
  };

  const handleLoginWithBiometrics = async () => {
    setErrorMessage(null);
    setBiometricNotice(null);
    setLoading(true);
    try {
      const result = await login(email);
      if (result.success && result.user) {
        onLoginSuccess(result.user, result.redirectTab);
      } else if (result.error) {
        setErrorMessage(result.error);
      } else {
        handleOpenBiometricModal('AUTHENTICATE');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Biometric authentication challenge failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleDirectBiometricSignIn = async () => {
    await handleLoginWithBiometrics();
  };

  const handleEnrollCurrentAccount = async () => {
    setErrorMessage(null);
    setBiometricNotice(null);
    handleOpenBiometricModal('REGISTER');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMessage('Please enter your Oromia Bank email address.');
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
    <div className="min-h-screen min-h-[100dvh] flex flex-col justify-between overflow-y-auto bg-slate-50 dark:bg-[#0D0F1F] relative font-sans text-slate-900 dark:text-slate-100 selection:bg-ob-indigo-600 selection:text-white transition-colors">
      {/* Harmonious Oromia Bank Brand Background Accents */}
      <div className="absolute top-0 right-0 w-[550px] h-[550px] bg-ob-indigo-500/10 dark:bg-ob-indigo-600/15 rounded-full blur-3xl pointer-events-none -mr-32 -mt-32"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-ob-green-500/10 dark:bg-ob-green-500/10 rounded-full blur-3xl pointer-events-none -ml-32 -mb-32"></div>

      {/* Top Brand Bar */}
      <header className="px-3.5 sm:px-8 py-2.5 sm:py-3.5 flex items-center justify-between border-b border-slate-200 dark:border-[#22284D] bg-white/90 dark:bg-[#121428]/90 backdrop-blur-md sticky top-0 z-20 shrink-0 transition-colors">
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
          <div className="hidden lg:flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 font-medium bg-slate-100 dark:bg-[#1B2042] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#2B3369]">
            <ShieldCheck className="w-4 h-4 text-ob-green-600 dark:text-ob-green-400" />
            <span>Directive BSD/03/2020 Compliant</span>
          </div>

          {/* Dedicated Theme Toggle Dropdown Button (Compact on Mobile) */}
          <ThemeToggle align="right" showLabelOnMobile={false} />
        </div>
      </header>

      {/* Main Login Card Viewport */}
      <main className="flex-1 flex items-center justify-center p-3.5 sm:p-6 py-6 sm:py-8 relative z-10 w-full max-w-lg mx-auto">
        <div className="w-full bg-white dark:bg-[#161933]/95 border border-slate-200 dark:border-[#262D55] rounded-2xl p-4 sm:p-7 shadow-xl dark:shadow-2xl backdrop-blur-md space-y-4 transition-colors">
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

          {/* Quick Demo Role Fill Selector */}
          <div className="bg-slate-50 dark:bg-[#101226]/80 border border-slate-200 dark:border-[#22284D] rounded-xl p-2.5 sm:p-3 space-y-1.5 sm:space-y-2">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-ob-green-600 dark:text-ob-green-400 shrink-0" />
              <span>One-Click Role Login (Testing):</span>
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => handleQuickPreset('admin@oromiabank.com')}
                className={`min-h-[40px] sm:min-h-[42px] px-2 py-1.5 rounded-lg text-xs font-semibold transition-all border text-center cursor-pointer flex items-center justify-center touch-press ${
                  email.includes('admin')
                    ? 'bg-ob-indigo-600 text-white border-ob-indigo-400 shadow-sm ring-1 ring-ob-indigo-400/40 font-bold'
                    : 'bg-white dark:bg-[#181C3B] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#262D55] hover:bg-slate-100 dark:hover:bg-[#20254D]'
                }`}
              >
                <span className="sm:hidden">Admin</span>
                <span className="hidden sm:inline">Administrator</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset('abebe.kebede@oromiabank.com')}
                className={`min-h-[40px] sm:min-h-[42px] px-2 py-1.5 rounded-lg text-xs font-semibold transition-all border text-center cursor-pointer flex items-center justify-center touch-press ${
                  email.includes('abebe')
                    ? 'bg-ob-green-600 text-white border-ob-green-400 shadow-sm ring-1 ring-ob-green-400/40 font-bold'
                    : 'bg-white dark:bg-[#181C3B] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#262D55] hover:bg-slate-100 dark:hover:bg-[#20254D]'
                }`}
              >
                Maker
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset('chala.desta@oromiabank.com')}
                className={`min-h-[40px] sm:min-h-[42px] px-2 py-1.5 rounded-lg text-xs font-semibold transition-all border text-center cursor-pointer flex items-center justify-center touch-press ${
                  email.includes('chala')
                    ? 'bg-amber-600 text-white border-amber-400 shadow-sm ring-1 ring-amber-400/40 font-bold'
                    : 'bg-white dark:bg-[#181C3B] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#262D55] hover:bg-slate-100 dark:hover:bg-[#20254D]'
                }`}
              >
                Checker
              </button>
            </div>
          </div>

          {/* Biometric WebAuthn Quick Sign-in Section */}
          <div className="bg-gradient-to-r from-emerald-950/20 via-teal-950/20 to-slate-900/20 border border-emerald-600/30 dark:border-emerald-500/30 rounded-xl p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
                  <Fingerprint className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1">
                    <span>Biometric Passkey Sign-In</span>
                    {hasBiometricRegistered && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                        Enrolled
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                    Web Authentication API (Face ID / Touch ID / Fingerprint)
                  </span>
                </div>
              </div>
            </div>

            {/* If registered on device or for quick enrollment */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleLoginWithBiometrics}
                disabled={isBiometricScanning || loading}
                className="w-full min-h-[44px] py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer touch-press disabled:opacity-50"
              >
                <Fingerprint className="w-4 h-4 text-emerald-200" />
                <span>
                  {isBiometricScanning ? 'Verifying Biometrics...' : 'Login with Biometrics'}
                </span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenBiometricModal('REGISTER')}
                  className="flex-1 min-h-[42px] py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold text-xs rounded-xl border border-emerald-500/40 transition-all flex items-center justify-center gap-1.5 cursor-pointer touch-press"
                >
                  <ScanFace className="w-4 h-4 text-emerald-400" />
                  <span>Register Biometrics</span>
                </button>

                {hasBiometricRegistered && (
                  <button
                    type="button"
                    onClick={() => removeBiometric()}
                    className="min-h-[42px] px-2.5 text-rose-600 dark:text-rose-400 hover:bg-rose-950/30 rounded-xl border border-rose-800/40 text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1 shrink-0 touch-press"
                    title="Clear passkey from device"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>
                )}
              </div>

              <p className="text-[10px] text-slate-500 dark:text-slate-400 text-center">
                Touch fingerprint sensor or use face recognition to sign in
              </p>
            </div>
          </div>

          {/* Biometric Prompt Interactive Modal */}
          <BiometricPromptModal
            isOpen={isBiometricModalOpen}
            mode={biometricModalMode}
            userName={currentTargetUser?.name || 'Bank Officer'}
            userEmail={currentTargetUser?.email || email}
            userRole={currentTargetUser?.role || 'MAKER'}
            onSuccess={handleBiometricModalSuccess}
            onCancel={() => setIsBiometricModalOpen(false)}
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
                  className="w-full min-h-[44px] pl-9 pr-3 py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-[#101226]/90 border border-slate-200 dark:border-[#2B3369] rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-ob-indigo-500 dark:focus:border-ob-indigo-400 focus:ring-1 focus:ring-ob-indigo-500 dark:focus:ring-ob-indigo-400 transition-colors font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full min-h-[44px] pl-9 pr-3 py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-[#101226]/90 border border-slate-200 dark:border-[#2B3369] rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-ob-indigo-500 dark:focus:border-ob-indigo-400 focus:ring-1 focus:ring-ob-indigo-500 dark:focus:ring-ob-indigo-400 transition-colors font-medium"
                />
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
          <div className="pt-3 border-t border-slate-200 dark:border-[#22284D] text-center space-y-1">
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
        </div>
      </main>

      {/* Footer */}
      <footer className="px-4 sm:px-6 py-3 border-t border-slate-200 dark:border-[#22284D] bg-white/90 dark:bg-[#121428]/90 text-center text-slate-500 dark:text-slate-400 text-[11px] sm:text-xs relative z-10 flex flex-col sm:flex-row items-center justify-between gap-1 shrink-0 transition-colors pb-safe">
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
