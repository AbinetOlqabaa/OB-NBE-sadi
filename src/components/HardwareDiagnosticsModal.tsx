/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  Fingerprint,
  ScanFace,
  Camera,
  CheckCircle2,
  AlertCircle,
  X,
  HelpCircle,
  RefreshCw,
  Video,
  VideoOff,
  Sliders,
  Sparkles,
  Info,
} from 'lucide-react';
import { useBiometricAuth, HardwareOverride } from '../hooks/useBiometricAuth.ts';
import { vibrate, haptics } from '../utils/haptics.ts';

interface HardwareDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HardwareDiagnosticsModal: React.FC<HardwareDiagnosticsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    isFingerprintSupported,
    fingerprintStatus,
    isCameraSupported,
    cameraStatus,
    preferredMethod,
    setFingerprintHardwareStatus,
    setCameraHardwareStatus,
    probeFingerprintSensor,
    startCameraStream,
    stopCameraStream,
    detectHardwareCapabilities,
  } = useBiometricAuth();

  const [probingFingerprint, setProbingFingerprint] = useState(false);
  const [probeResult, setProbeResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isCameraTesting, setIsCameraTesting] = useState(false);
  const [cameraTestError, setCameraTestError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      stopCameraStream();
      setIsCameraTesting(false);
      setProbeResult(null);
    }
  }, [isOpen, stopCameraStream]);

  if (!isOpen) return null;

  const handleRunFingerprintProbe = async () => {
    setProbingFingerprint(true);
    setProbeResult(null);
    vibrate(20);
    haptics.medium();

    try {
      const res = await probeFingerprintSensor();
      setProbeResult(res);
      if (res.success) {
        vibrate([25, 45, 30]);
        haptics.success();
      } else {
        vibrate([50, 60, 50]);
        haptics.error();
      }
    } catch (err: any) {
      setProbeResult({
        success: false,
        message: err?.message || 'Fingerprint sensor probe challenge was not completed.',
      });
    } finally {
      setProbingFingerprint(false);
    }
  };

  const handleToggleCameraTest = async () => {
    if (isCameraTesting) {
      stopCameraStream();
      setIsCameraTesting(false);
      setCameraTestError(null);
    } else {
      setCameraTestError(null);
      setIsCameraTesting(true);
      const res = await startCameraStream(videoRef.current);
      if (!res.success) {
        setIsCameraTesting(false);
        setCameraTestError(res.error || 'Failed to start camera feed.');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[calc(100dvh-2rem)] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-ob-indigo-500/20 text-ob-indigo-600 dark:text-ob-indigo-400 flex items-center justify-center">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Device Sensor Diagnostics
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Oromia Bank Hardware Detection & Sensor Verification
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Overview Banner */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Active Sign-In Mode for this Device:
            </span>
            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
              {preferredMethod === 'FACE'
                ? 'Face Recognition (Webcam)'
                : preferredMethod === 'FINGERPRINT'
                ? 'Fingerprint Passkey'
                : 'Corporate Password Only'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            Browsers protect privacy by hiding sensor specifics unless probed. Use this panel to verify or configure the presence of a physical fingerprint reader or webcam on this machine.
          </p>
        </div>

        {/* Section 1: Fingerprint Scanner */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Fingerprint className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                  Fingerprint / Biometric Sensor
                </h3>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  Touch ID / Windows Hello / Platform Passkey
                </span>
              </div>
            </div>

            {/* Current State Badge */}
            <span
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 border ${
                isFingerprintSupported
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                  : 'bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isFingerprintSupported ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                }`}
              ></span>
              {isFingerprintSupported ? 'Active / Detected' : 'Inactive / Not Present'}
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 text-[11px] space-y-1">
            <div className="text-slate-700 dark:text-slate-300">
              <span className="font-semibold text-slate-500 dark:text-slate-400">Status: </span>
              {fingerprintStatus.label}
            </div>
            {fingerprintStatus.reason && (
              <div className="text-slate-500 dark:text-slate-400 text-[10px] leading-relaxed">
                {fingerprintStatus.reason}
              </div>
            )}
          </div>

          {/* Probe & Configuration Controls */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRunFingerprintProbe}
                disabled={probingFingerprint}
                className="flex-1 min-h-[38px] px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${probingFingerprint ? 'animate-spin' : ''}`} />
                <span>{probingFingerprint ? 'Testing Sensor...' : 'Run Live Sensor Probe'}</span>
              </button>
            </div>

            {/* Explicit Hardware Calibration Toggle */}
            <div className="pt-1 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
              <span>Sensor on this machine:</span>
              <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-white dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => setFingerprintHardwareStatus('DISABLED')}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-colors cursor-pointer ${
                    !isFingerprintSupported
                      ? 'bg-rose-500 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  No Scanner
                </button>
                <button
                  type="button"
                  onClick={() => setFingerprintHardwareStatus('ENABLED')}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-colors cursor-pointer ${
                    isFingerprintSupported
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Has Scanner
                </button>
                <button
                  type="button"
                  onClick={() => setFingerprintHardwareStatus('AUTO')}
                  className="px-2 py-1 text-[10px] font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
                  title="Reset to automated browser detection"
                >
                  Auto
                </button>
              </div>
            </div>

            {probeResult && (
              <div
                className={`p-2.5 rounded-xl border text-[11px] flex items-start gap-2 ${
                  probeResult.success
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300'
                }`}
              >
                {probeResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                )}
                <span>{probeResult.message}</span>
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Webcam / Camera */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                <ScanFace className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                  Device Webcam / Camera
                </h3>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  Facial Recognition & ID Verification
                </span>
              </div>
            </div>

            {/* Current State Badge */}
            <span
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 border ${
                isCameraSupported
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                  : 'bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isCameraSupported ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                }`}
              ></span>
              {isCameraSupported ? 'Ready / Connected' : 'Inactive / Not Detected'}
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 text-[11px] space-y-1">
            <div className="text-slate-700 dark:text-slate-300">
              <span className="font-semibold text-slate-500 dark:text-slate-400">Status: </span>
              {cameraStatus.label}
            </div>
            {cameraStatus.reason && (
              <div className="text-slate-500 dark:text-slate-400 text-[10px] leading-relaxed">
                {cameraStatus.reason}
              </div>
            )}
          </div>

          {/* Live Camera Test Preview */}
          {isCameraTesting && (
            <div className="space-y-2">
              <div className="relative w-full h-44 rounded-xl overflow-hidden bg-slate-950 border border-emerald-500/40 flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-24 h-32 border border-dashed border-emerald-400/70 rounded-[50%] animate-pulse"></div>
                </div>
                <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-slate-900/80 text-[9px] font-mono text-emerald-400 border border-emerald-500/40">
                  LIVE 30FPS
                </div>
              </div>
            </div>
          )}

          {cameraTestError && (
            <div className="p-2.5 rounded-xl border bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300 text-[11px] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{cameraTestError}</span>
            </div>
          )}

          {/* Camera Controls */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleToggleCameraTest}
              className={`w-full min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer ${
                isCameraTesting
                  ? 'bg-rose-600 hover:bg-rose-500 text-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/30'
              }`}
            >
              {isCameraTesting ? (
                <>
                  <VideoOff className="w-3.5 h-3.5" />
                  <span>Stop Live Preview</span>
                </>
              ) : (
                <>
                  <Video className="w-3.5 h-3.5" />
                  <span>Test Camera Live Feed</span>
                </>
              )}
            </button>

            {/* Camera Calibration Toggle */}
            <div className="pt-1 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
              <span>Webcam on this machine:</span>
              <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-white dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => setCameraHardwareStatus('DISABLED')}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-colors cursor-pointer ${
                    !isCameraSupported
                      ? 'bg-rose-500 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Disable
                </button>
                <button
                  type="button"
                  onClick={() => setCameraHardwareStatus('ENABLED')}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-colors cursor-pointer ${
                    isCameraSupported
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Enable
                </button>
                <button
                  type="button"
                  onClick={() => setCameraHardwareStatus('AUTO')}
                  className="px-2 py-1 text-[10px] font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
                  title="Reset to automated browser enumeration"
                >
                  Auto
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 flex items-center justify-between">
          <button
            type="button"
            onClick={detectHardwareCapabilities}
            className="text-[11px] text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 font-semibold flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Re-detect Sensors</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] px-5 bg-ob-indigo-600 hover:bg-ob-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
          >
            Save & Return to Sign In
          </button>
        </div>
      </div>
    </div>
  );
};
