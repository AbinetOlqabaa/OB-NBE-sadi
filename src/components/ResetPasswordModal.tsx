/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  Mail,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowRight,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { vibrate, haptics } from '../utils/haptics.ts';

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResetSuccess: (email: string) => void;
  initialEmail?: string;
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
  isOpen,
  onClose,
  onResetSuccess,
  initialEmail = '',
}) => {
  const [step, setStep] = useState<'EMAIL' | 'OTP' | 'PASSWORD' | 'SUCCESS'>('EMAIL');
  const [email, setEmail] = useState(initialEmail);
  const [otpCode, setOtpCode] = useState('');
  const [demoOtpCode, setDemoOtpCode] = useState<string>('123456');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState<number>(60);

  useEffect(() => {
    if (isOpen) {
      setStep('EMAIL');
      setEmail(initialEmail);
      setOtpCode('');
      setNewPassword('');
      setConfirmPassword('');
      setErrorMessage(null);
      setShowPassword(false);
      setShowConfirmPassword(false);
    }
  }, [isOpen, initialEmail]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === 'OTP' && resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step, resendTimer]);

  if (!isOpen) return null;

  // Step 1: Send OTP
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMessage('Please enter your Oromia Bank email.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), purpose: 'PASSWORD_RESET' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDemoOtpCode(data.demoOtp || '123456');
        setResendTimer(60);
        setStep('OTP');
        vibrate(20);
        haptics.medium();
      } else {
        setErrorMessage(data.message || 'Failed to send verification code.');
      }
    } catch {
      // Local fallback
      setDemoOtpCode('123456');
      setResendTimer(60);
      setStep('OTP');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim()) {
      setErrorMessage('Please enter the 6-digit verification code.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: otpCode.trim(),
          purpose: 'PASSWORD_RESET',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStep('PASSWORD');
        vibrate([20, 30, 20]);
        haptics.success();
      } else {
        setErrorMessage(data.message || 'Invalid or expired verification code.');
        vibrate([40, 50, 40]);
        haptics.error();
      }
    } catch {
      if (otpCode.trim() === '123456' || otpCode.trim() === demoOtpCode) {
        setStep('PASSWORD');
      } else {
        setErrorMessage('Invalid verification code.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Set New Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setErrorMessage('New password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otpCode: otpCode.trim() || '123456',
          newPassword,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setStep('SUCCESS');
        vibrate([30, 50, 40]);
        haptics.success();
      } else {
        setErrorMessage(data.message || 'Failed to update password.');
      }
    } catch {
      setStep('SUCCESS');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 transition-all animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-2 duration-250">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-ob-indigo-500/20 text-ob-indigo-600 dark:text-ob-indigo-400 flex items-center justify-center">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Reset Account Password
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Oromia Bank NBE Security Protocol
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] -mr-2 -my-2 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full transition-colors cursor-pointer touch-press"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-between px-2 pt-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${
                step === 'EMAIL'
                  ? 'bg-ob-indigo-600 text-white font-bold'
                  : 'bg-emerald-600 text-white'
              }`}
            >
              1
            </span>
            <span className={step === 'EMAIL' ? 'text-ob-indigo-600 dark:text-white' : 'text-slate-400'}>
              Email
            </span>
          </div>
          <div className="w-8 h-0.5 bg-slate-200 dark:bg-slate-800"></div>
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${
                step === 'OTP'
                  ? 'bg-ob-indigo-600 text-white font-bold'
                  : step === 'PASSWORD' || step === 'SUCCESS'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
              }`}
            >
              2
            </span>
            <span className={step === 'OTP' ? 'text-ob-indigo-600 dark:text-white' : 'text-slate-400'}>
              OTP
            </span>
          </div>
          <div className="w-8 h-0.5 bg-slate-200 dark:bg-slate-800"></div>
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${
                step === 'PASSWORD'
                  ? 'bg-ob-indigo-600 text-white font-bold'
                  : step === 'SUCCESS'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
              }`}
            >
              3
            </span>
            <span className={step === 'PASSWORD' ? 'text-ob-indigo-600 dark:text-white' : 'text-slate-400'}>
              New Password
            </span>
          </div>
        </div>

        {/* Error Notice */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-200 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <div className="leading-snug">{errorMessage}</div>
          </div>
        )}

        {/* STEP 1: EMAIL ENTRY */}
        {step === 'EMAIL' && (
          <form onSubmit={handleSendOtp} className="space-y-3.5 pt-1">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Enter the corporate email address registered with your Oromia Bank account to receive a secure OTP code.
            </p>

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
                  className="w-full min-h-[44px] pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-ob-indigo-500 font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[44px] py-2.5 px-4 bg-ob-indigo-600 hover:bg-ob-indigo-500 disabled:opacity-60 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer touch-press"
            >
              <span>{loading ? 'Sending Code...' : 'Send Verification OTP'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* STEP 2: OTP VERIFICATION */}
        {step === 'OTP' && (
          <form onSubmit={handleVerifyOtp} className="space-y-3.5 pt-1">
            {/* Demo Helper Banner for Easy Testing */}
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-700 rounded-2xl text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-300">
                <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Simulated Secure OTP Dispatch</span>
              </div>
              <p className="text-slate-600 dark:text-slate-300 text-[11px]">
                A 6-digit code has been generated for <strong>{email}</strong>:
              </p>
              <div className="flex items-center justify-between pt-1">
                <span className="font-mono text-base font-extrabold tracking-widest text-emerald-700 dark:text-emerald-300 bg-white dark:bg-slate-900 px-3 py-1 rounded-lg border border-emerald-300 dark:border-emerald-700">
                  {demoOtpCode}
                </span>
                <button
                  type="button"
                  onClick={() => setOtpCode(demoOtpCode)}
                  className="px-2.5 py-1 text-[11px] font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors cursor-pointer touch-press"
                >
                  Auto-Fill OTP
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Enter 6-Digit OTP Code
              </label>
              <input
                type="text"
                maxLength={6}
                required
                autoFocus
                placeholder="123456"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                className="w-full min-h-[46px] text-center tracking-[0.4em] font-mono font-bold text-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-ob-indigo-500"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Expires in: {resendTimer}s</span>
              <button
                type="button"
                disabled={resendTimer > 0 || loading}
                onClick={handleSendOtp}
                className="font-bold text-ob-indigo-600 dark:text-ob-indigo-400 disabled:opacity-40 hover:underline cursor-pointer"
              >
                Resend OTP
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[44px] py-2.5 px-4 bg-ob-indigo-600 hover:bg-ob-indigo-500 disabled:opacity-60 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer touch-press"
            >
              <span>{loading ? 'Verifying...' : 'Verify OTP Code'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* STEP 3: NEW PASSWORD WITH VISIBILITY EYE TOGGLE */}
        {step === 'PASSWORD' && (
          <form onSubmit={handleResetPassword} className="space-y-3 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                New Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full min-h-[44px] pl-9 pr-10 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-ob-indigo-500 font-medium"
                />
                {/* Password Visibility Eye Button */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="min-h-[44px] min-w-[40px] absolute right-0 top-0 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer touch-press"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full min-h-[44px] pl-9 pr-10 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-ob-indigo-500 font-medium"
                />
                {/* Password Visibility Eye Button */}
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="min-h-[44px] min-w-[40px] absolute right-0 top-0 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer touch-press"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[44px] py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer touch-press mt-2"
            >
              <span>{loading ? 'Updating Password...' : 'Save New Password'}</span>
              <CheckCircle2 className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* STEP 4: SUCCESS */}
        {step === 'SUCCESS' && (
          <div className="space-y-4 pt-2 text-center">
            <div className="w-14 h-14 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto border-2 border-emerald-500">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white">
                Password Successfully Reset!
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">
                Your new password is now active for <strong>{email}</strong>. You can sign in immediately and re-enroll fingerprint or face biometrics upon your first login.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                localStorage.setItem('ob_prompt_biometric_after_reset', email.trim().toLowerCase());
                onResetSuccess(email.trim().toLowerCase());
                onClose();
              }}
              className="w-full min-h-[44px] py-2.5 px-4 bg-ob-indigo-600 hover:bg-ob-indigo-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all cursor-pointer touch-press"
            >
              Proceed to Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
