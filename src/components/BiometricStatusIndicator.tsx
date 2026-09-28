/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Fingerprint,
  ScanFace,
  Camera,
  AlertCircle,
  Lock,
  Sliders,
  CheckCircle2,
  Radio,
  Sparkles,
  RefreshCw,
  Eye,
} from 'lucide-react';

export type BiometricState = 'IDLE' | 'SEARCHING' | 'INITIALIZING' | 'SCANNING' | 'SUCCESS' | 'ERROR';

export interface BiometricStatusIndicatorProps {
  isFingerprintSupported: boolean;
  fingerprintLabel?: string;
  fingerprintReason?: string;
  isCameraSupported: boolean;
  cameraLabel?: string;
  cameraReason?: string;
  onOpenDiagnostics?: () => void;
  showDiagnosticsButton?: boolean;
  className?: string;

  // Active authentication & search animation states
  isAuthenticating?: boolean;
  isScanning?: boolean;
  isFingerprintSearching?: boolean;
  isCameraInitializing?: boolean;
  activeMethod?: 'FINGERPRINT' | 'FACE' | 'ALL' | null;
  fingerprintState?: BiometricState;
  cameraState?: BiometricState;
  statusMessage?: string;
  showActiveBanner?: boolean;
}

export const BiometricStatusIndicator: React.FC<BiometricStatusIndicatorProps> = ({
  isFingerprintSupported,
  fingerprintLabel,
  fingerprintReason,
  isCameraSupported,
  cameraLabel,
  cameraReason,
  onOpenDiagnostics,
  showDiagnosticsButton = true,
  className = '',
  isAuthenticating = false,
  isScanning = false,
  isFingerprintSearching = false,
  isCameraInitializing = false,
  activeMethod,
  fingerprintState,
  cameraState,
  statusMessage,
  showActiveBanner = true,
}) => {
  const hasAnyBiometric = isFingerprintSupported || isCameraSupported;

  // Derive active searching / initializing states
  const isOverallActive = isAuthenticating || isScanning;

  const isFpActive = Boolean(
    isFingerprintSearching ||
      fingerprintState === 'SEARCHING' ||
      fingerprintState === 'SCANNING' ||
      (isOverallActive && isFingerprintSupported && (activeMethod === 'FINGERPRINT' || activeMethod === 'ALL' || (!activeMethod && isFingerprintSupported)))
  );

  const isCamActive = Boolean(
    isCameraInitializing ||
      cameraState === 'INITIALIZING' ||
      cameraState === 'SCANNING' ||
      (isOverallActive && isCameraSupported && (activeMethod === 'FACE' || activeMethod === 'ALL' || (!activeMethod && !isFingerprintSupported)))
  );

  // Case 1: Neither biometric hardware detected on this device
  if (!hasAnyBiometric) {
    return (
      <div
        className={`p-2.5 sm:p-3 rounded-xl bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-1.5 transition-all ${className}`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-bold text-[11px] sm:text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>Biometrics Not Available</span>
          </div>

          {showDiagnosticsButton && onOpenDiagnostics && (
            <button
              type="button"
              onClick={onOpenDiagnostics}
              className="flex items-center gap-1 text-[10px] text-ob-indigo-600 dark:text-ob-indigo-400 font-semibold hover:underline cursor-pointer"
              title="Test & calibrate hardware sensors"
            >
              <Sliders className="w-3 h-3" />
              <span>Diagnostics</span>
            </button>
          )}
        </div>

        <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
          Neither a fingerprint scanner nor a camera was detected on this hardware. Please use your corporate password to authenticate.
        </p>
      </div>
    );
  }

  // Determine dynamic badge text
  const displayFpLabel = isFpActive
    ? 'Searching for fingerprint...'
    : fingerprintLabel || (isFingerprintSupported ? 'Fingerprint Active' : 'Fingerprint Inactive');

  const displayCamLabel = isCamActive
    ? 'Camera Initializing...'
    : cameraLabel || (isCameraSupported ? 'Webcam Camera Ready' : 'Camera Inactive');

  return (
    <div className={`space-y-2 ${className}`}>
      {/* 2-Column Sensor Status Grid */}
      <div className="grid grid-cols-2 gap-2 text-[10px]">
        {/* Fingerprint Sensor Badge */}
        <div
          className={`relative overflow-hidden flex items-center justify-between gap-1 px-2.5 py-1.5 rounded-lg border transition-all duration-300 ${
            isFpActive
              ? 'bg-emerald-500/20 dark:bg-emerald-950/60 border-emerald-500 dark:border-emerald-400 text-emerald-900 dark:text-emerald-100 shadow-xs shadow-emerald-500/20 ring-1 ring-emerald-500/50'
              : isFingerprintSupported
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
              : 'bg-slate-100 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400'
          }`}
          title={
            isFpActive
              ? 'Sensor Active: Searching for fingerprint or touch...'
              : fingerprintReason || (isFingerprintSupported ? 'Fingerprint Scanner Active' : 'Fingerprint Scanner Inactive')
          }
        >
          {/* Active Shimmer Line */}
          {isFpActive && (
            <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-bio-shimmer pointer-events-none" />
          )}

          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {/* Pulsing Beacon / Radar Ring */}
            <div className="relative flex items-center justify-center shrink-0 w-2.5 h-2.5">
              {isFpActive ? (
                <>
                  <span className="absolute w-3.5 h-3.5 rounded-full bg-emerald-400 opacity-75 animate-ping"></span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-xs shadow-emerald-400"></span>
                </>
              ) : (
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isFingerprintSupported ? 'bg-emerald-500' : 'bg-slate-400'
                  }`}
                />
              )}
            </div>

            <div className="flex items-center gap-1 truncate min-w-0">
              <Fingerprint
                className={`w-3.5 h-3.5 shrink-0 transition-transform duration-300 ${
                  isFpActive
                    ? 'text-emerald-600 dark:text-emerald-300 animate-pulse scale-110'
                    : isFingerprintSupported
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-400'
                }`}
              />
              <span className={`truncate font-semibold ${isFpActive ? 'font-bold' : ''}`}>
                {displayFpLabel}
              </span>
            </div>
          </div>

          {onOpenDiagnostics && (
            <button
              type="button"
              onClick={onOpenDiagnostics}
              className="text-[9px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 underline cursor-pointer shrink-0 ml-1 z-10"
              title="Configure fingerprint scanner"
            >
              Test
            </button>
          )}
        </div>

        {/* Webcam / Camera Badge */}
        <div
          className={`relative overflow-hidden flex items-center justify-between gap-1 px-2.5 py-1.5 rounded-lg border transition-all duration-300 ${
            isCamActive
              ? 'bg-teal-500/20 dark:bg-teal-950/60 border-teal-500 dark:border-teal-400 text-teal-900 dark:text-teal-100 shadow-xs shadow-teal-500/20 ring-1 ring-teal-500/50'
              : isCameraSupported
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
              : 'bg-slate-100 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400'
          }`}
          title={
            isCamActive
              ? 'Sensor Active: Initializing camera & facial recognition...'
              : cameraReason || (isCameraSupported ? 'Webcam Camera Ready' : 'Webcam Camera Inactive')
          }
        >
          {/* Active Shimmer Line */}
          {isCamActive && (
            <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-teal-400 to-transparent animate-bio-shimmer pointer-events-none" />
          )}

          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {/* Pulsing Beacon / Aperture Ring */}
            <div className="relative flex items-center justify-center shrink-0 w-2.5 h-2.5">
              {isCamActive ? (
                <>
                  <span className="absolute w-3.5 h-3.5 rounded-full bg-teal-400 opacity-75 animate-ping"></span>
                  <span className="w-2 h-2 rounded-full bg-teal-500 shadow-xs shadow-teal-400"></span>
                </>
              ) : (
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isCameraSupported ? 'bg-emerald-500' : 'bg-slate-400'
                  }`}
                />
              )}
            </div>

            <div className="flex items-center gap-1 truncate min-w-0">
              <ScanFace
                className={`w-3.5 h-3.5 shrink-0 transition-transform duration-300 ${
                  isCamActive
                    ? 'text-teal-600 dark:text-teal-300 animate-pulse scale-110'
                    : isCameraSupported
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-400'
                }`}
              />
              <span className={`truncate font-semibold ${isCamActive ? 'font-bold' : ''}`}>
                {displayCamLabel}
              </span>
            </div>
          </div>

          {onOpenDiagnostics && (
            <button
              type="button"
              onClick={onOpenDiagnostics}
              className="text-[9px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 underline cursor-pointer shrink-0 ml-1 z-10"
              title="Test webcam camera"
            >
              Test
            </button>
          )}
        </div>
      </div>

      {/* Visual Live Trust Feedback Banner during Active Authentication Process */}
      {showActiveBanner && (isFpActive || isCamActive) && (
        <div
          className={`relative overflow-hidden p-2.5 rounded-xl border text-xs transition-all duration-300 animate-in fade-in zoom-in-95 ${
            isFpActive
              ? 'bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-emerald-500/15 border-emerald-500/40 text-emerald-950 dark:text-emerald-100 shadow-xs'
              : 'bg-gradient-to-r from-teal-500/15 via-cyan-500/10 to-teal-500/15 border-teal-500/40 text-teal-950 dark:text-teal-100 shadow-xs'
          }`}
        >
          {/* Shimmer sweep bar across the banner */}
          <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 dark:via-emerald-300 to-transparent animate-bio-shimmer pointer-events-none" />

          <div className="flex items-start gap-2.5">
            {isFpActive ? (
              <div className="relative mt-0.5">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-600 dark:text-emerald-300">
                  <Fingerprint className="w-3.5 h-3.5 animate-pulse" />
                </div>
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              </div>
            ) : (
              <div className="relative mt-0.5">
                <div className="w-6 h-6 rounded-lg bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-600 dark:text-teal-300">
                  <Camera className="w-3.5 h-3.5 animate-pulse" />
                </div>
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-teal-400 animate-ping" />
              </div>
            )}

            <div className="space-y-0.5 min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-[11px] sm:text-xs tracking-tight text-slate-900 dark:text-white">
                  {isFpActive ? 'Searching for fingerprint...' : 'Camera Initializing...'}
                </span>
                <span className="flex items-center gap-1 text-[9px] uppercase tracking-wider font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Active
                </span>
              </div>

              <p className="text-[10px] sm:text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
                {statusMessage ||
                  (isFpActive
                    ? 'Place your finger on the biometric sensor or touch your physical passkey.'
                    : 'Warming up optical feed. Position your face in front of the camera to verify.')}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
