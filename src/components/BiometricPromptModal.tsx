/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Fingerprint,
  ScanFace,
  CheckCircle2,
  ShieldCheck,
  X,
  Sparkles,
  Lock,
  Smartphone,
} from 'lucide-react';
import { vibrate, haptics } from '../utils/haptics.ts';

interface BiometricPromptModalProps {
  isOpen: boolean;
  mode: 'REGISTER' | 'AUTHENTICATE';
  userName?: string;
  userEmail?: string;
  userRole?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export const BiometricPromptModal: React.FC<BiometricPromptModalProps> = ({
  isOpen,
  mode,
  userName = 'Bank Officer',
  userEmail = 'user@oromiabank.com',
  userRole = 'MAKER',
  onSuccess,
  onCancel,
}) => {
  const [authType, setAuthType] = useState<'FINGERPRINT' | 'FACE_ID'>('FINGERPRINT');
  const [scanState, setScanState] = useState<'IDLE' | 'SCANNING' | 'SUCCESS'>('IDLE');

  useEffect(() => {
    if (isOpen) {
      setScanState('IDLE');
      vibrate(20);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTriggerScan = () => {
    if (scanState === 'SCANNING' || scanState === 'SUCCESS') return;

    setScanState('SCANNING');
    vibrate([20, 30, 20]);
    haptics.medium();

    // High fidelity biometric scanning simulation
    setTimeout(() => {
      setScanState('SUCCESS');
      vibrate([30, 50, 40]);
      haptics.success();

      setTimeout(() => {
        onSuccess();
      }, 650);
    }, 1100);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-white dark:bg-[#121428] border border-slate-200 dark:border-[#262D55] rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5 text-center transition-all animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-2 duration-250">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              {mode === 'REGISTER' ? 'Register Biometrics' : 'Biometric Verification'}
            </span>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] min-w-[44px] -mr-2 -my-2 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full transition-colors cursor-pointer touch-press"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* User Badge Info */}
        <div className="bg-slate-50 dark:bg-[#181C3B] border border-slate-200 dark:border-[#2B3369] rounded-2xl p-3 flex items-center justify-between gap-3 text-left">
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
              {userName}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {userEmail}
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-ob-indigo-50 dark:bg-ob-indigo-950 text-ob-indigo-700 dark:text-ob-indigo-300 border border-ob-indigo-200 dark:border-ob-indigo-800 shrink-0">
            {userRole}
          </span>
        </div>

        {/* Biometric Type Selector (Fingerprint vs Face ID) */}
        <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl border border-slate-200/80 dark:border-slate-800">
          <button
            type="button"
            onClick={() => {
              vibrate(15);
              setAuthType('FINGERPRINT');
              setScanState('IDLE');
            }}
            className={`min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer touch-press ${
              authType === 'FINGERPRINT'
                ? 'bg-white dark:bg-[#1C2145] text-emerald-600 dark:text-emerald-400 shadow-xs border border-emerald-500/30'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Fingerprint className="w-4 h-4" />
            <span>Fingerprint</span>
          </button>

          <button
            type="button"
            onClick={() => {
              vibrate(15);
              setAuthType('FACE_ID');
              setScanState('IDLE');
            }}
            className={`min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer touch-press ${
              authType === 'FACE_ID'
                ? 'bg-white dark:bg-[#1C2145] text-emerald-600 dark:text-emerald-400 shadow-xs border border-emerald-500/30'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ScanFace className="w-4 h-4" />
            <span>Face ID</span>
          </button>
        </div>

        {/* Interactive Biometric Sensor Target */}
        <div className="py-2 flex flex-col items-center justify-center space-y-3">
          <button
            type="button"
            onClick={handleTriggerScan}
            disabled={scanState === 'SCANNING' || scanState === 'SUCCESS'}
            className={`relative w-28 h-28 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer touch-press outline-none ${
              scanState === 'SUCCESS'
                ? 'bg-emerald-500 text-white shadow-xl shadow-emerald-500/40 scale-105'
                : scanState === 'SCANNING'
                ? 'bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500 animate-pulse shadow-lg shadow-emerald-500/20'
                : 'bg-slate-100 hover:bg-emerald-50 dark:bg-slate-800/80 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-emerald-400 border-2 border-dashed border-emerald-500/40 active:scale-95'
            }`}
            aria-label="Tap to scan biometric"
          >
            {/* Pulsing Aura */}
            {scanState === 'SCANNING' && (
              <span className="absolute inset-0 rounded-full border-2 border-emerald-400 animate-ping opacity-60"></span>
            )}

            {scanState === 'SUCCESS' ? (
              <CheckCircle2 className="w-12 h-12 text-white animate-in zoom-in-75 duration-200" />
            ) : authType === 'FINGERPRINT' ? (
              <Fingerprint
                className={`w-12 h-12 transition-transform duration-300 ${
                  scanState === 'SCANNING' ? 'scale-110 text-emerald-400' : ''
                }`}
              />
            ) : (
              <ScanFace
                className={`w-12 h-12 transition-transform duration-300 ${
                  scanState === 'SCANNING' ? 'scale-110 text-emerald-400' : ''
                }`}
              />
            )}
          </button>

          {/* Status Label */}
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              {scanState === 'SUCCESS'
                ? mode === 'REGISTER'
                  ? 'Biometric Enrolled Successfully!'
                  : 'Biometric Verified!'
                : scanState === 'SCANNING'
                ? `Scanning ${authType === 'FINGERPRINT' ? 'Fingerprint' : 'Face'}...`
                : `Tap Sensor to ${mode === 'REGISTER' ? 'Register' : 'Authenticate'}`}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {scanState === 'SCANNING'
                ? 'Hold your finger on the sensor'
                : mode === 'REGISTER'
                ? 'Enrolls hardware passkey for 1-touch sign-in'
                : 'Touch sensor or look at screen to confirm sign-in'}
            </p>
          </div>
        </div>

        {/* Primary Action Button */}
        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={handleTriggerScan}
            disabled={scanState === 'SCANNING' || scanState === 'SUCCESS'}
            className="w-full min-h-[44px] py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer touch-press"
          >
            {scanState === 'SUCCESS' ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Verified • Logging In</span>
              </>
            ) : scanState === 'SCANNING' ? (
              <>
                <Sparkles className="w-4 h-4 animate-spin" />
                <span>Scanning Biometrics...</span>
              </>
            ) : (
              <>
                {authType === 'FINGERPRINT' ? (
                  <Fingerprint className="w-4 h-4" />
                ) : (
                  <ScanFace className="w-4 h-4" />
                )}
                <span>
                  {mode === 'REGISTER'
                    ? 'Scan & Register Biometrics'
                    : 'Scan & Sign In to Portal'}
                </span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onCancel}
            className="w-full min-h-[44px] py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer touch-press"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
