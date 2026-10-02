/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  X,
  Fingerprint,
  ScanFace,
  KeyRound,
  RotateCcw,
  Sparkles,
  Lock,
  ArrowRight,
} from 'lucide-react';
import { biometricService } from '../services/biometricService.ts';
import { vibrate, haptics } from '../utils/haptics.ts';

interface SmartBiometricResetModalProps {
  isOpen: boolean;
  initialEmail?: string;
  initialPassword?: string;
  onClose: () => void;
  onResetComplete: (resetEmail: string, resetType: string) => void;
  onNavigateEnroll?: (method: 'FINGERPRINT' | 'FACE') => void;
}

export const SmartBiometricResetModal: React.FC<SmartBiometricResetModalProps> = ({
  isOpen,
  initialEmail = '',
  initialPassword = '',
  onClose,
  onResetComplete,
  onNavigateEnroll,
}) => {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState(initialPassword);
  const [resetType, setResetType] = useState<'ALL' | 'FINGERPRINT' | 'FACE'>('ALL');
  const [reason, setReason] = useState('Hardware device replacement / authenticator reset');
  const [stage, setStage] = useState<'REQUEST' | 'CONFIRM' | 'SUCCESS'>('REQUEST');
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [consequences, setConsequences] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestedMethod, setSuggestedMethod] = useState<'FINGERPRINT' | 'FACE'>('FINGERPRINT');

  useEffect(() => {
    if (isOpen) {
      setEmail(initialEmail);
      setPassword(initialPassword);
      setStage('REQUEST');
      setError(null);
      setResetToken(null);
    }
  }, [isOpen, initialEmail, initialPassword]);

  if (!isOpen) return null;

  const handleAuthorizeReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    vibrate(20);

    try {
      const res = biometricService.requestReset(email, resetType, password, reason, email);
      if (!res.success) {
        setError(res.message || 'Reset authorization failed.');
        haptics.error();
        return;
      }

      setResetToken(res.resetToken!);
      setConsequences(res.consequences || 'Resetting biometrics invalidates enrolled templates.');
      setStage('CONFIRM');
      haptics.success();
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred during reset request.');
      haptics.error();
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecuteReset = async () => {
    if (!resetToken) return;
    setError(null);
    setIsLoading(true);
    vibrate(20);

    try {
      const res = biometricService.executeReset(email, resetToken, email);
      if (!res.success) {
        setError(res.message || 'Failed to execute reset.');
        haptics.error();
        return;
      }

      setStage('SUCCESS');
      if (res.reEnrollmentMethod) {
        setSuggestedMethod(res.reEnrollmentMethod);
      }
      onResetComplete(email, resetType);
      haptics.success();
    } catch (err: any) {
      setError(err.message || 'Failed to complete reset.');
      haptics.error();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-xl">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                Smart Biometric Reset
              </h3>
              <p className="text-slate-500 text-xs">Step-up authentication required</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {stage === 'REQUEST' && (
            <form onSubmit={handleAuthorizeReset} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Corporate Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="officer@oromiabank.com"
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-ob-indigo-500 focus:outline-none dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Biometric Credential to Reset
                </label>
                <select
                  value={resetType}
                  onChange={(e) => setResetType(e.target.value as any)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-ob-indigo-500 focus:outline-none dark:text-white cursor-pointer"
                >
                  <option value="ALL">All Biometrics (Face ID & WebAuthn Keys)</option>
                  <option value="FINGERPRINT">WebAuthn / Passkeys Only</option>
                  <option value="FACE">Face ID Recognition Profile Only</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Institutional Account Password (Step-Up)
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your current password"
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-ob-indigo-500 focus:outline-none dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Reset
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-ob-indigo-500 focus:outline-none dark:text-white"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 bg-ob-indigo-600 hover:bg-ob-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{isLoading ? 'Verifying...' : 'Authorize Reset'}</span>
                </button>
              </div>
            </form>
          )}

          {stage === 'CONFIRM' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 text-xs font-bold">
                  <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>Confirm Biometric Credential Purge</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">
                  {consequences}
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStage('REQUEST')}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleExecuteReset}
                  disabled={isLoading}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{isLoading ? 'Executing...' : 'Purge Credentials & Invalidate'}</span>
                </button>
              </div>
            </div>
          )}

          {stage === 'SUCCESS' && (
            <div className="text-center py-4 space-y-4 animate-in fade-in">
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 rounded-2xl mx-auto flex items-center justify-center shadow-xs">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                  Credentials Reset Successfully
                </h4>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  Your biometric credentials have been purged. You may now perform a fresh enrollment with your updated hardware.
                </p>
              </div>

              <div className="flex justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  Done
                </button>
                {onNavigateEnroll && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigateEnroll(suggestedMethod);
                    }}
                    className="px-4 py-2 bg-ob-indigo-600 hover:bg-ob-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <span>Re-Enroll Now</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
