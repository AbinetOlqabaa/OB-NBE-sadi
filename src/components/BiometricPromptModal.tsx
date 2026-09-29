/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Fingerprint,
  ScanFace,
  CheckCircle2,
  ShieldCheck,
  X,
  Sparkles,
  Camera,
  AlertCircle,
  Lock,
  RefreshCw,
  Sliders,
  Clock,
  TimerOff,
  RotateCcw,
  Smartphone,
  KeyRound,
  ShieldAlert,
} from 'lucide-react';
import { vibrate, haptics } from '../utils/haptics.ts';
import { useBiometricAuth, computeFaceHashFromImageData } from '../hooks/useBiometricAuth.ts';
import { HardwareDiagnosticsModal } from './HardwareDiagnosticsModal.tsx';
import { recordBiometricAuditLog } from './AuditTrailView.tsx';

const INACTIVITY_TIMEOUT_SECONDS = 30;

interface BiometricPromptModalProps {
  isOpen: boolean;
  mode: 'REGISTER' | 'AUTHENTICATE';
  userName?: string;
  userEmail?: string;
  userRole?: string;
  initialMethod?: 'FINGERPRINT' | 'FACE';
  onSuccess: (method: 'FINGERPRINT' | 'FACE', faceData?: { imageBase64?: string; faceHash?: string }) => void;
  onCancel: () => void;
  onTriggerRecovery?: (failedMethod: 'FINGERPRINT' | 'FACE', reason?: string) => void;
}

export const BiometricPromptModal: React.FC<BiometricPromptModalProps> = ({
  isOpen,
  mode,
  userName = 'Bank Officer',
  userEmail = 'officer@oromiabank.com',
  userRole = 'MAKER',
  initialMethod = 'FINGERPRINT',
  onSuccess,
  onCancel,
  onTriggerRecovery,
}) => {
  const {
    isFingerprintSupported,
    fingerprintStatus,
    isCameraSupported,
    cameraStatus,
    startCameraStream,
    stopCameraStream,
    captureFaceFrame,
    register,
    login,
  } = useBiometricAuth();

  const [currentMode, setCurrentMode] = useState<'REGISTER' | 'AUTHENTICATE'>(mode);
  const [authType, setAuthType] = useState<'FINGERPRINT' | 'FACE'>(initialMethod);
  const [scanState, setScanState] = useState<'IDLE' | 'SCANNING' | 'SUCCESS' | 'ERROR' | 'TIMEOUT' | 'NEED_ENROLL'>('IDLE');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(INACTIVITY_TIMEOUT_SECONDS);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const resetTimer = useCallback(() => {
    setTimeLeft(INACTIVITY_TIMEOUT_SECONDS);
  }, []);

  // Sync mode and initial method on open
  useEffect(() => {
    if (isOpen) {
      setCurrentMode(mode);
      setScanState('IDLE');
      setStatusMessage(null);
      resetTimer();
      vibrate(20);

      if (initialMethod) {
        setAuthType(initialMethod);
      }
    } else {
      stopCameraStream();
      setCameraActive(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [isOpen, mode, initialMethod, stopCameraStream, resetTimer]);

  // 30-Second Inactivity Auto-Cancellation Countdown Timer
  useEffect(() => {
    if (!isOpen || scanState === 'SUCCESS' || scanState === 'TIMEOUT') {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleAutoCancelTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isOpen, scanState, authType]);

  const handleAutoCancelTimeout = useCallback(() => {
    stopCameraStream();
    setCameraActive(false);
    setScanState('TIMEOUT');
    setStatusMessage('Authentication attempt auto-cancelled after 30s of inactivity to prevent hardware lock.');
    vibrate([40, 50, 40]);
    haptics.error();

    recordBiometricAuditLog({
      actorId: userEmail,
      actorName: userName,
      actorRole: userRole,
      action: 'BIOMETRIC_AUTH_TIMEOUT',
      type: authType,
      entityId: userEmail,
      details: `[NBE Directive BSD/03/2020 Compliance] Biometric ${authType} authentication auto-cancelled after 30 seconds of inactivity.`,
      errorMessage: 'Inactivity timer expired (30 seconds)',
    }).catch(() => {});
  }, [authType, stopCameraStream, userEmail, userName, userRole]);

  // Request browser camera stream with user permission
  const requestCameraStream = useCallback(async () => {
    setStatusMessage('Requesting camera access...');
    try {
      const res = await startCameraStream(videoRef.current);
      if (res.success) {
        setCameraActive(true);
        setStatusMessage('Center your face in the camera frame');
        return true;
      } else {
        setCameraActive(false);
        setStatusMessage(res.error || 'Live camera access pending. You can also use the Mobile Selfie Camera.');
        return false;
      }
    } catch (err: any) {
      setCameraActive(false);
      setStatusMessage('Live stream unavailable. Tap "Use Mobile Camera" to capture directly.');
      return false;
    }
  }, [startCameraStream]);

  // Manage camera stream when switching to/from FACE mode
  useEffect(() => {
    let active = true;

    if (isOpen && authType === 'FACE' && scanState !== 'TIMEOUT' && scanState !== 'SUCCESS') {
      requestCameraStream().then(() => {});
    } else {
      stopCameraStream();
      setCameraActive(false);
    }

    return () => {
      active = false;
      stopCameraStream();
    };
  }, [isOpen, authType, scanState, requestCameraStream, stopCameraStream]);

  if (!isOpen) return null;

  const handleSwitchType = (type: 'FINGERPRINT' | 'FACE') => {
    vibrate(15);
    setAuthType(type);
    setScanState('IDLE');
    setStatusMessage(null);
    resetTimer();
  };

  /**
   * Handle Retry after Timeout or Error
   */
  const handleRetry = () => {
    vibrate([20, 25]);
    resetTimer();
    setScanState('IDLE');
    setStatusMessage(null);

    if (authType === 'FACE') {
      requestCameraStream();
    }
  };

  /**
   * Process face authentication or registration from a frame or selfie photo
   */
  const processFaceData = async (captured: { imageBase64?: string; faceHash?: string }) => {
    resetTimer();
    setScanState('SCANNING');
    setStatusMessage('Analyzing facial biometric geometry...');
    vibrate([20, 30, 20]);
    haptics.medium();

    try {
      if (currentMode === 'REGISTER') {
        const res = await register(userEmail, 'FACE', captured);
        if (!res.success) throw new Error(res.error || 'Failed to register facial passkey.');

        await recordBiometricAuditLog({
          actorId: userEmail,
          actorName: userName,
          actorRole: userRole,
          action: 'BIOMETRIC_ENROLLED',
          type: 'FACE',
          entityId: userEmail,
          details: `[NBE Directive BSD/03/2020 Compliance] Facial biometric profile registered successfully for ${userEmail}.`,
        });

        setScanState('SUCCESS');
        vibrate([30, 50, 40]);
        haptics.success();
        stopCameraStream();

        setTimeout(() => {
          onSuccess('FACE', captured);
        }, 550);
      } else {
        const res = await login(userEmail, 'FACE', captured);
        if (!res.success) {
          if ((res as any).notEnrolled || res.error?.includes('registered')) {
            setScanState('NEED_ENROLL');
            setStatusMessage(`No facial passkey registered for ${userEmail}. Tap 'Enroll & Sign In' below.`);
            return;
          }
          throw new Error(res.error || 'Facial verification rejected.');
        }

        await recordBiometricAuditLog({
          actorId: userEmail,
          actorName: userName,
          actorRole: userRole,
          action: 'BIOMETRIC_AUTH_SUCCESS',
          type: 'FACE',
          entityId: userEmail,
          details: `[NBE Directive BSD/03/2020 Compliance] Face ID authentication verified for ${userEmail} (${userRole}).`,
        });

        setScanState('SUCCESS');
        vibrate([30, 50, 40]);
        haptics.success();
        stopCameraStream();

        setTimeout(() => {
          onSuccess('FACE', captured);
        }, 550);
      }
    } catch (err: any) {
      setScanState('ERROR');
      const msg = err?.message || 'Face authentication challenge failed.';
      setStatusMessage(msg);
      vibrate([50, 60, 50]);
      haptics.error();

      await recordBiometricAuditLog({
        actorId: userEmail,
        actorName: userName,
        actorRole: userRole,
        action: 'BIOMETRIC_AUTH_FAILURE',
        type: 'FACE',
        entityId: userEmail,
        errorMessage: msg,
        details: `[NBE Directive BSD/03/2020 Compliance] Biometric FACE challenge failed for ${userEmail}: ${msg}`,
      }).catch(() => {});
    }
  };

  /**
   * Handle mobile selfie photo capture from native file camera input
   */
  const handleNativeCameraFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatusMessage('Reading captured selfie photo...');
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, 640, 480);
          const imageBase64 = canvas.toDataURL('image/jpeg', 0.85);
          const imageData = ctx.getImageData(0, 0, 640, 480);
          const faceHash = computeFaceHashFromImageData(imageData);
          await processFaceData({ imageBase64, faceHash });
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    // Reset input so same photo can be re-selected if retried
    e.target.value = '';
  };

  /**
   * Real Execution of Biometric Action
   */
  const handleExecuteBiometric = async () => {
    if (scanState === 'SCANNING' || scanState === 'SUCCESS') return;

    resetTimer();
    setScanState('SCANNING');
    setStatusMessage(null);
    vibrate([20, 30, 20]);
    haptics.medium();

    try {
      if (authType === 'FACE') {
        if (!videoRef.current || !cameraActive) {
          // If live stream is not active, trigger native phone selfie camera directly
          if (fileInputRef.current) {
            fileInputRef.current.click();
            setScanState('IDLE');
            setStatusMessage('Opening phone selfie camera...');
            return;
          }
          throw new Error('Camera not initialized. Please click "Open Mobile Camera".');
        }

        const captured = captureFaceFrame(videoRef.current);
        if (!captured.success || !captured.faceHash) {
          throw new Error(captured.error || 'Please look directly at camera to scan face.');
        }

        await processFaceData(captured);
      } else {
        // Real Fingerprint Authenticator / Platform Passkey
        if (currentMode === 'REGISTER') {
          const res = await register(userEmail, 'FINGERPRINT');
          if (!res.success) throw new Error(res.error || 'Fingerprint registration cancelled or failed.');

          await recordBiometricAuditLog({
            actorId: userEmail,
            actorName: userName,
            actorRole: userRole,
            action: 'BIOMETRIC_ENROLLED',
            type: 'FINGERPRINT',
            entityId: userEmail,
            details: `[NBE Directive BSD/03/2020 Compliance] Fingerprint passkey enrolled successfully for ${userEmail}.`,
          });

          setScanState('SUCCESS');
          vibrate([30, 50, 40]);
          haptics.success();

          setTimeout(() => {
            onSuccess('FINGERPRINT');
          }, 550);
        } else {
          const res = await login(userEmail, 'FINGERPRINT');
          if (!res.success) {
            if ((res as any).notEnrolled || res.error?.includes('registered')) {
              setScanState('NEED_ENROLL');
              setStatusMessage(`No fingerprint passkey registered for ${userEmail}. Tap 'Enroll & Sign In' below.`);
              return;
            }
            throw new Error(res.error || 'Fingerprint verification failed.');
          }

          await recordBiometricAuditLog({
            actorId: userEmail,
            actorName: userName,
            actorRole: userRole,
            action: 'BIOMETRIC_AUTH_SUCCESS',
            type: 'FINGERPRINT',
            entityId: userEmail,
            details: `[NBE Directive BSD/03/2020 Compliance] Fingerprint authentication verified for ${userEmail} (${userRole}).`,
          });

          setScanState('SUCCESS');
          vibrate([30, 50, 40]);
          haptics.success();

          setTimeout(() => {
            onSuccess('FINGERPRINT');
          }, 550);
        }
      }
    } catch (err: any) {
      setScanState('ERROR');
      const msg = err?.message || 'Biometric challenge did not succeed.';
      setStatusMessage(msg);
      vibrate([50, 60, 50]);
      haptics.error();

      await recordBiometricAuditLog({
        actorId: userEmail,
        actorName: userName,
        actorRole: userRole,
        action: 'BIOMETRIC_AUTH_FAILURE',
        type: authType,
        entityId: userEmail,
        errorMessage: msg,
        details: `[NBE Directive BSD/03/2020 Compliance] Biometric ${authType} challenge failed for ${userEmail}: ${msg}`,
      }).catch(() => {});
    }
  };

  /**
   * One-Tap Auto-Enroll and Sign In
   */
  const handleEnrollAndSignIn = async () => {
    setCurrentMode('REGISTER');
    setScanState('IDLE');
    setStatusMessage('Enrolling biometric passkey...');
    vibrate(20);
    setTimeout(() => {
      handleExecuteBiometric();
    }, 150);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Hidden native camera capture input for mobile browsers */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={handleNativeCameraFile}
      />

      <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-3.5 text-center max-h-[calc(100dvh-2rem)] overflow-y-auto touch-scroll-y transition-all animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-2 duration-250">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-xl flex items-center justify-center ${
                authType === 'FACE'
                  ? 'bg-teal-500/20 text-teal-600 dark:text-teal-400'
                  : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {authType === 'FACE' ? <ScanFace className="w-4 h-4" /> : <Fingerprint className="w-4 h-4" />}
            </div>
            <div className="text-left">
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider block">
                {currentMode === 'REGISTER'
                  ? authType === 'FACE'
                    ? 'Register Face ID Passkey'
                    : 'Register Fingerprint Passkey'
                  : authType === 'FACE'
                  ? 'Face ID Sign-In'
                  : 'Fingerprint Sign-In'}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                {currentMode === 'REGISTER' ? 'Device Passkey Enrollment' : 'One-Touch Hardware Verification'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCameraStream();
              onCancel();
            }}
            className="min-h-[44px] min-w-[44px] -mr-2 -my-2 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full transition-colors cursor-pointer touch-press"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* User Account Info with Mode Switcher Tag */}
        <div className="bg-slate-50 dark:bg-[#181C3B] border border-slate-200 dark:border-[#2B3369] rounded-2xl p-2.5 flex items-center justify-between gap-3 text-left">
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
              {userName}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {userEmail}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-ob-indigo-50 dark:bg-ob-indigo-950 text-ob-indigo-700 dark:text-ob-indigo-300 border border-ob-indigo-200 dark:border-ob-indigo-800">
              {userRole}
            </span>
            <button
              type="button"
              onClick={() => {
                vibrate(15);
                setCurrentMode((prev) => (prev === 'AUTHENTICATE' ? 'REGISTER' : 'AUTHENTICATE'));
                setScanState('IDLE');
                setStatusMessage(null);
              }}
              className="text-[10px] text-ob-indigo-600 dark:text-ob-indigo-400 font-semibold hover:underline cursor-pointer"
            >
              {currentMode === 'AUTHENTICATE' ? 'Switch to Register' : 'Switch to Sign In'}
            </button>
          </div>
        </div>

        {/* Biometric Type Selector with Real Hardware Status Badges */}
        <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-800">
          {/* Fingerprint Option */}
          <button
            type="button"
            onClick={() => handleSwitchType('FINGERPRINT')}
            className={`min-h-[48px] p-2 flex flex-col items-center justify-center rounded-xl text-xs font-bold transition-all relative cursor-pointer touch-press ${
              authType === 'FINGERPRINT'
                ? 'bg-white dark:bg-[#1C2145] text-emerald-600 dark:text-emerald-400 shadow-sm border border-emerald-500/40 ring-1 ring-emerald-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Fingerprint className="w-4 h-4" />
              <span>Fingerprint</span>
            </div>
            <span className="text-[9px] flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Sensor Ready
            </span>
          </button>

          {/* Face ID / Webcam Option */}
          <button
            type="button"
            onClick={() => handleSwitchType('FACE')}
            className={`min-h-[48px] p-2 flex flex-col items-center justify-center rounded-xl text-xs font-bold transition-all relative cursor-pointer touch-press ${
              authType === 'FACE'
                ? 'bg-white dark:bg-[#1C2145] text-teal-600 dark:text-teal-400 shadow-sm border border-teal-500/40 ring-1 ring-teal-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <ScanFace className="w-4 h-4" />
              <span>Face ID</span>
            </div>
            <span className="text-[9px] flex items-center gap-1 font-semibold text-teal-600 dark:text-teal-400">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse"></span>
              {cameraActive ? 'Camera Live' : 'Camera Ready'}
            </span>
          </button>
        </div>

        {/* Interactive Biometric Viewport */}
        {scanState === 'TIMEOUT' ? (
          /* 30-Second Inactivity Timeout Screen */
          <div className="py-4 px-3 bg-amber-50/90 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800/80 rounded-2xl text-center space-y-2.5 animate-in fade-in zoom-in-95 duration-200">
            <div className="relative w-14 h-14 mx-auto flex items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-700 shadow-sm">
              <TimerOff className="w-7 h-7 animate-pulse" />
              <span className="absolute -top-1 -right-1 px-1.5 py-0.2 bg-amber-600 text-white text-[9px] font-bold rounded-full">
                30s
              </span>
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Session Inactivity Timeout
              </h4>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 max-w-xs mx-auto leading-relaxed mt-1">
                Biometric authentication was auto-cancelled after 30 seconds of inactivity to release device hardware locks per NBE standards.
              </p>
            </div>
          </div>
        ) : scanState === 'NEED_ENROLL' ? (
          /* Account Not Yet Enrolled -> 1-Tap Enroll & Sign In Card */
          <div className="py-4 px-3 bg-ob-indigo-50/80 dark:bg-ob-indigo-950/50 border border-ob-indigo-200 dark:border-ob-indigo-800/80 rounded-2xl text-center space-y-2.5 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 mx-auto rounded-full bg-ob-indigo-100 dark:bg-ob-indigo-900/60 text-ob-indigo-600 dark:text-ob-indigo-400 flex items-center justify-center shadow-sm">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Set Up Biometric Passkey
              </h4>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 max-w-xs mx-auto leading-relaxed mt-1">
                No {authType === 'FACE' ? 'face recognition profile' : 'fingerprint passkey'} is registered for this account yet. Enroll now for instant one-touch access.
              </p>
            </div>
            <button
              type="button"
              onClick={handleEnrollAndSignIn}
              className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow cursor-pointer touch-press transition-all flex items-center justify-center gap-1.5"
            >
              <Fingerprint className="w-4 h-4" />
              <span>Enroll & Sign In Now</span>
            </button>
          </div>
        ) : (
          <div className="py-1 flex flex-col items-center justify-center space-y-2.5">
            {authType === 'FACE' ? (
              /* Live Camera / Native Camera Selfie Viewport */
              <div className="flex flex-col items-center gap-2">
                <div className="relative w-36 h-36 rounded-full overflow-hidden border-3 border-teal-500/50 bg-slate-900 shadow-lg shadow-teal-500/20 flex items-center justify-center">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover transition-opacity duration-300 ${
                      cameraActive ? 'opacity-100 scale-x-[-1]' : 'opacity-0'
                    }`}
                  />

                  {!cameraActive && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-slate-300 text-xs text-center bg-slate-950/80">
                      <Camera className="w-8 h-8 mb-1.5 text-teal-400 animate-pulse" />
                      <span className="font-semibold text-[11px] text-slate-200">
                        Camera Ready
                      </span>
                      <span className="text-[10px] text-slate-400 mt-0.5">
                        Live Stream or Phone Camera
                      </span>
                    </div>
                  )}

                  {/* Facial Scanning Reticle Ring & Oval Guide */}
                  {cameraActive && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="w-24 h-32 border border-dashed border-teal-400/80 rounded-[50%] animate-pulse"></div>
                      {scanState === 'SCANNING' && (
                        <div className="absolute top-0 left-0 right-0 h-1 bg-teal-400 shadow-md shadow-teal-400 animate-bounce"></div>
                      )}
                    </div>
                  )}

                  {scanState === 'SUCCESS' && (
                    <div className="absolute inset-0 bg-emerald-600/80 flex items-center justify-center text-white backdrop-blur-xs">
                      <CheckCircle2 className="w-12 h-12 text-white animate-in zoom-in-75 duration-200" />
                    </div>
                  )}
                </div>

                {/* Direct Dual Optical Buttons: Live Stream & Mobile Selfie Camera */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1 text-[11px] font-bold bg-teal-600/20 hover:bg-teal-600/30 text-teal-700 dark:text-teal-300 border border-teal-500/40 rounded-lg shadow-xs cursor-pointer touch-press transition-all flex items-center gap-1.5"
                    title="Launch native phone camera directly"
                  >
                    <Smartphone className="w-3.5 h-3.5 text-teal-500" />
                    <span>Mobile Selfie Camera</span>
                  </button>

                  {!cameraActive && (
                    <button
                      type="button"
                      onClick={requestCameraStream}
                      className="px-2.5 py-1 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg shadow-xs cursor-pointer touch-press transition-all flex items-center gap-1.5"
                    >
                      <Camera className="w-3.5 h-3.5 text-slate-500" />
                      <span>Start Webcam</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* Fingerprint Sensor Target with Hardware Ping Animation */
              <div className="relative py-2 flex items-center justify-center">
                <button
                  type="button"
                  onClick={handleExecuteBiometric}
                  disabled={scanState === 'SCANNING' || scanState === 'SUCCESS'}
                  className={`relative w-28 h-28 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer touch-press outline-none ${
                    scanState === 'SUCCESS'
                      ? 'bg-emerald-500 text-white shadow-xl shadow-emerald-500/40 scale-105'
                      : scanState === 'SCANNING'
                      ? 'bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500 animate-pulse shadow-lg shadow-emerald-500/20'
                      : 'bg-emerald-500/10 hover:bg-emerald-500/20 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-2 border-dashed border-emerald-500/60 active:scale-95 shadow-md shadow-emerald-500/10'
                  }`}
                  aria-label="Tap to scan fingerprint"
                >
                  {/* Visual Hardware Radar Ping Ripple Wave */}
                  <span className="absolute -inset-2 rounded-full border border-emerald-500/30 animate-ping opacity-50 pointer-events-none"></span>

                  {scanState === 'SUCCESS' ? (
                    <CheckCircle2 className="w-12 h-12 text-white animate-in zoom-in-75 duration-200" />
                  ) : (
                    <Fingerprint
                      className={`w-12 h-12 transition-transform duration-300 ${
                        scanState === 'SCANNING' ? 'scale-110 text-emerald-400' : ''
                      }`}
                    />
                  )}
                </button>
              </div>
            )}

            {/* Feedback & Instruction Label */}
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                {scanState === 'SUCCESS'
                  ? currentMode === 'REGISTER'
                    ? 'Passkey Enrolled Successfully!'
                    : 'Biometric Verified!'
                  : scanState === 'SCANNING'
                  ? `Verifying ${authType === 'FINGERPRINT' ? 'Fingerprint Sensor' : 'Facial Profile'}...`
                  : scanState === 'ERROR'
                  ? 'Verification Not Completed'
                  : authType === 'FACE'
                  ? cameraActive
                    ? 'Center Face in Reticle'
                    : 'Tap Button to Scan Face'
                  : 'Touch Sensor to Sign In'}
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 max-w-xs mx-auto">
                {statusMessage ||
                  (authType === 'FACE'
                    ? 'Look at webcam or snap a quick selfie with your phone camera'
                    : 'Touch device fingerprint scanner or platform passkey')}
              </p>
            </div>
          </div>
        )}

        {/* Action Controls */}
        <div className="space-y-2 pt-1">
          {scanState === 'TIMEOUT' ? (
            <>
              <button
                type="button"
                onClick={handleRetry}
                className="w-full min-h-[44px] py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer touch-press"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Retry Biometric Scan</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  stopCameraStream();
                  onCancel();
                }}
                className="w-full min-h-[44px] py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer touch-press"
              >
                Continue with Password
              </button>

              {onTriggerRecovery && (
                <button
                  type="button"
                  onClick={() => {
                    stopCameraStream();
                    onTriggerRecovery(authType, statusMessage || 'Biometric scan timed out');
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer touch-press"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Start Biometric Recovery Setup</span>
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleExecuteBiometric}
                disabled={scanState === 'SCANNING' || scanState === 'SUCCESS'}
                className={`w-full min-h-[44px] py-2.5 px-4 disabled:opacity-60 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer touch-press ${
                  authType === 'FACE'
                    ? 'bg-teal-600 hover:bg-teal-500'
                    : 'bg-emerald-600 hover:bg-emerald-500'
                }`}
              >
                {scanState === 'SUCCESS' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Verified • Complete</span>
                  </>
                ) : scanState === 'SCANNING' ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying Hardware...</span>
                  </>
                ) : (
                  <>
                    {authType === 'FINGERPRINT' ? (
                      <Fingerprint className="w-4 h-4" />
                    ) : (
                      <ScanFace className="w-4 h-4" />
                    )}
                    <span>
                      {currentMode === 'REGISTER'
                        ? authType === 'FACE'
                          ? 'Capture & Enroll Face'
                          : 'Touch & Enroll Fingerprint'
                        : authType === 'FACE'
                        ? 'Verify Face to Sign In'
                        : 'Touch Fingerprint to Sign In'}
                    </span>
                  </>
                )}
              </button>

              {scanState === 'ERROR' && onTriggerRecovery && (
                <button
                  type="button"
                  onClick={() => {
                    stopCameraStream();
                    onTriggerRecovery(authType, statusMessage || 'Hardware verification failed');
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/40 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer touch-press"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                  <span>Hardware Issue? Start Biometric Recovery</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  stopCameraStream();
                  onCancel();
                }}
                className="w-full min-h-[44px] py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer touch-press"
              >
                Cancel / Sign In with Password
              </button>
            </>
          )}
        </div>
      </div>

      {/* Embedded Hardware Diagnostics Modal */}
      <HardwareDiagnosticsModal
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
      />
    </div>
  );
};
