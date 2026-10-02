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
import {
  useBiometricAuth,
  computeFaceHashFromImageData,
  analyzeFaceQuality,
  analyzeFaceLiveness,
} from '../hooks/useBiometricAuth.ts';
import { HardwareDiagnosticsModal } from './HardwareDiagnosticsModal.tsx';
import { recordBiometricAuditLog } from './AuditTrailView.tsx';
import { biometricService } from '../services/biometricService.ts';
import { cameraService } from '../services/cameraService.ts';

const INACTIVITY_TIMEOUT_SECONDS = 30;

export type FaceEnrollStage =
  | 'PREPARING'
  | 'PERMISSION'
  | 'CAMERA_START'
  | 'FACE_SEARCH'
  | 'QUALITY'
  | 'QUALITY_CHECK'
  | 'LIVENESS'
  | 'LIVENESS_CHECK'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'FAILURE'
  | 'RETRY';

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
    cameraState,
    startCameraStream,
    stopCameraStream,
    captureFaceFrame,
    register,
    login,
  } = useBiometricAuth();

  const [currentMode, setCurrentMode] = useState<'REGISTER' | 'AUTHENTICATE'>(mode);
  const [authType, setAuthType] = useState<'FINGERPRINT' | 'FACE'>(initialMethod);
  const [scanState, setScanState] = useState<
    'IDLE' | 'PREPARING' | 'SCANNING' | 'VERIFYING' | 'SUCCESS' | 'ERROR' | 'TIMEOUT' | 'RATE_LIMITED' | 'UNSUPPORTED' | 'NEED_ENROLL'
  >('IDLE');
  const [faceEnrollStage, setFaceEnrollStage] = useState<FaceEnrollStage>('PREPARING');
  const [specificErrorReason, setSpecificErrorReason] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [liveQuality, setLiveQuality] = useState<{
    score: number;
    luminance: number;
    sharpness: number;
    tier: 'EXCELLENT' | 'GOOD' | 'POOR';
    reason?: string;
  } | null>(null);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(INACTIVITY_TIMEOUT_SECONDS);
  const [stepUpPassword, setStepUpPassword] = useState('');
  const [stepUpLoading, setStepUpLoading] = useState(false);
  const [stepUpError, setStepUpError] = useState<string | null>(null);
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
          setTimeout(() => handleAutoCancelTimeout(), 0);
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
  }, [isOpen, scanState, authType, handleAutoCancelTimeout]);

  // Request browser camera stream with user permission (re-entrant safe)
  const requestCameraStream = useCallback(async () => {
    // If active stream is already live, reuse it directly without calling getUserMedia() again!
    const active = cameraService.getActiveStream();
    if (active && cameraService.isStreamAlive(active)) {
      setCameraActive(true);
      setFaceEnrollStage('FACE_SEARCH');
      setStatusMessage('Center your face in the optical frame guide');
      cameraService.resetToStreamReady();
      if (videoRef.current && videoRef.current.srcObject !== active) {
        videoRef.current.srcObject = active;
        videoRef.current.play().catch(() => {});
      }
      return true;
    }

    setFaceEnrollStage('PERMISSION');
    setStatusMessage('Requesting camera access permission from browser...');
    setSpecificErrorReason(null);
    try {
      const res = await startCameraStream(videoRef.current);
      if (res.success) {
        setCameraActive(true);
        setFaceEnrollStage('CAMERA_START');
        setTimeout(() => {
          setFaceEnrollStage('FACE_SEARCH');
          setStatusMessage('Center your face in the optical frame guide');
        }, 200);
        return true;
      } else {
        setCameraActive(false);
        setFaceEnrollStage('FAILURE');
        setSpecificErrorReason(res.error || 'Camera permission denied or camera device busy.');
        setStatusMessage(res.error || 'Live camera access pending. You can also use the Mobile Selfie Camera.');
        return false;
      }
    } catch (err: any) {
      setCameraActive(false);
      setFaceEnrollStage('FAILURE');
      setSpecificErrorReason(err?.message || 'Live stream initialization failed.');
      setStatusMessage('Live stream unavailable. Tap "Use Mobile Camera" to capture directly.');
      return false;
    }
  }, [startCameraStream]);

  // Manage camera stream strictly when modal is open and in FACE mode
  // CRITICAL: scanState MUST NOT be in the dependency array to prevent stopping stream when user presses Verify Face
  useEffect(() => {
    if (isOpen && authType === 'FACE') {
      requestCameraStream().then(() => {});
    }

    return () => {
      // Release camera hardware only when modal closes or switches away from FACE mode
      if (!isOpen || authType !== 'FACE') {
        stopCameraStream();
        setCameraActive(false);
      }
    };
  }, [isOpen, authType, requestCameraStream, stopCameraStream]);

  // Synchronize cameraActive with cameraService stream status
  useEffect(() => {
    const unsub = cameraService.subscribe(() => {
      const active = cameraService.getActiveStream();
      setCameraActive(Boolean(active && cameraService.isStreamAlive(active)));
    });
    return unsub;
  }, []);

  // Phase 17: Real-time Live Optical Image Quality Evaluator (Poor, Good, Excellent)
  useEffect(() => {
    if (!cameraActive || authType !== 'FACE' || !isOpen) {
      setLiveQuality(null);
      return;
    }

    let intervalId: any;
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = 160;
    sampleCanvas.height = 120;
    const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });

    const evaluateLiveFrame = () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;
      try {
        if (!sampleCtx) return;
        sampleCtx.drawImage(videoRef.current, 0, 0, 160, 120);
        const imgData = sampleCtx.getImageData(0, 0, 160, 120);
        const q = analyzeFaceQuality(imgData);

        let tier: 'EXCELLENT' | 'GOOD' | 'POOR' = 'POOR';
        if (q.isQualityAcceptable && q.qualityScore >= 0.80) {
          tier = 'EXCELLENT';
        } else if (q.isQualityAcceptable && q.qualityScore >= 0.50) {
          tier = 'GOOD';
        } else {
          tier = 'POOR';
        }

        setLiveQuality({
          score: q.qualityScore,
          luminance: q.luminance,
          sharpness: q.sharpness,
          tier,
          reason: q.reasons[0] || (tier === 'POOR' ? 'Suboptimal illumination or focus' : undefined),
        });
      } catch {}
    };

    // Initial evaluation and continuous polling at ~350ms
    evaluateLiveFrame();
    intervalId = setInterval(evaluateLiveFrame, 350);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [cameraActive, authType, isOpen]);

  if (!isOpen) return null;

  const handleSwitchType = (type: 'FINGERPRINT' | 'FACE') => {
    vibrate(15);
    setAuthType(type);
    setScanState('IDLE');
    setFaceEnrollStage('PREPARING');
    setSpecificErrorReason(null);
    setStatusMessage(null);
    resetTimer();
  };

  /**
   * Handle Retry after Timeout or Error (re-uses existing live stream)
   */
  const handleRetry = () => {
    vibrate([20, 25]);
    resetTimer();
    setScanState('IDLE');
    setFaceEnrollStage('PREPARING');
    setSpecificErrorReason(null);
    setStatusMessage(null);

    if (authType === 'FACE') {
      const active = cameraService.getActiveStream();
      if (active && cameraService.isStreamAlive(active)) {
        cameraService.resetToStreamReady();
        setCameraActive(true);
        setFaceEnrollStage('FACE_SEARCH');
        setStatusMessage('Center your face in the optical frame guide');
      } else {
        requestCameraStream();
      }
    }
  };

  /**
   * Process face authentication or registration from a frame or selfie photo
   */
  const processFaceData = async (captured: { imageBase64?: string; faceHash?: string }) => {
    resetTimer();
    setScanState('SCANNING');
    setFaceEnrollStage('QUALITY_CHECK');
    setStatusMessage('Validating facial illumination & sharpness...');
    vibrate([20, 30, 20]);
    haptics.medium();

    try {
      if (currentMode === 'REGISTER') {
        setFaceEnrollStage('LIVENESS_CHECK');
        setStatusMessage('Evaluating optical liveness & anti-spoofing...');

        setFaceEnrollStage('PROCESSING');
        setStatusMessage('Encrypting protected non-invertible facial template in NBE vault...');

        const res = await register(userEmail, 'FACE', captured);
        if (!res.success) {
          setFaceEnrollStage('FAILURE');
          setSpecificErrorReason(res.error || 'Failed to register facial passkey.');
          throw new Error(res.error || 'Failed to register facial passkey.');
        }

        await recordBiometricAuditLog({
          actorId: userEmail,
          actorName: userName,
          actorRole: userRole,
          action: 'BIOMETRIC_ENROLLED',
          type: 'FACE',
          entityId: userEmail,
          details: `[NBE Directive BSD/03/2020 Compliance] Facial biometric profile registered successfully for ${userEmail}.`,
        });

        setFaceEnrollStage('SUCCESS');
        setScanState('SUCCESS');
        setStatusMessage('Facial profile enrolled and secured in NBE vault.');
        vibrate([30, 50, 40]);
        haptics.success();
        stopCameraStream();

        setTimeout(() => {
          onSuccess('FACE', captured);
        }, 550);
      } else {
        const res = await login(userEmail, 'FACE', captured);
        if (!res.success) {
          if ((res as any).lockedOut || res.error?.includes('locked')) {
            setScanState('RATE_LIMITED');
            setSpecificErrorReason(res.error || 'Account is temporarily locked due to excessive failed attempts.');
            stopCameraStream();
            return;
          }
          if ((res as any).notEnrolled || res.error?.includes('registered') || res.error?.includes('No face')) {
            setScanState('NEED_ENROLL');
            setStatusMessage(`No facial passkey registered for ${userEmail}. Tap 'Enroll & Sign In' below.`);
            stopCameraStream();
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
      setFaceEnrollStage('FAILURE');
      const msg = err?.message || 'Face authentication challenge failed.';
      setSpecificErrorReason(msg);
      setStatusMessage(msg);
      vibrate([50, 60, 50]);
      haptics.error();

      // Keep live camera stream running and restore stream_ready state for easy retry
      cameraService.resetToStreamReady();

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
   * Re-uses existing live camera stream; does NOT invoke getUserMedia() again!
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
        const liveStream = cameraService.getActiveStream();
        const hasLiveStream = Boolean(liveStream && cameraService.isStreamAlive(liveStream));

        if (!hasLiveStream || !videoRef.current) {
          // Only start camera if not already active!
          const started = await requestCameraStream();
          if (!started) {
            if (fileInputRef.current) {
              fileInputRef.current.click();
              setScanState('IDLE');
              setStatusMessage('Opening phone selfie camera...');
              return;
            }
            throw new Error(specificErrorReason || 'Camera is not active. Please allow camera access.');
          }
        }

        const captured = await captureFaceFrame(videoRef.current);
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
            if ((res as any).lockedOut || res.error?.includes('locked')) {
              setScanState('RATE_LIMITED');
              setSpecificErrorReason(res.error || 'Account is temporarily locked due to excessive failed attempts.');
              return;
            }
            if (
              (res as any).notEnrolled ||
              res.error?.includes('registered') ||
              res.error?.includes('No enrolled') ||
              res.error?.includes('No fingerprint')
            ) {
              setScanState('NEED_ENROLL');
              setStatusMessage(`No fingerprint passkey registered for ${userEmail}. Tap 'Enroll & Sign In' below.`);
              return;
            }
            if (res.error?.includes('not supported')) {
              setScanState('UNSUPPORTED');
              setStatusMessage('Platform fingerprint authenticator is not supported on this browser or device.');
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
        details: `[NBE Directive BSD/03/2020 Compliance] Biometric ${authType} verification failed for ${userEmail}: ${msg}`,
      }).catch(() => {});
    }
  };

  /**
   * Compliance unlock via step-up authenticated password verification
   */
  const handleStepUpUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stepUpPassword) return;
    setStepUpLoading(true);
    setStepUpError(null);
    try {
      const res = await fetch('/api/auth/biometrics/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, password: stepUpPassword }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setScanState('IDLE');
        setSpecificErrorReason(null);
        setStatusMessage('Biometric lockout successfully unlocked via step-up verification.');
        setStepUpPassword('');
      } else {
        setStepUpError(data.message || 'Incorrect password.');
      }
    } catch {
      const local = biometricService.unlockWithStepUp(userEmail, stepUpPassword);
      if (local.success) {
        setScanState('IDLE');
        setSpecificErrorReason(null);
        setStatusMessage('Biometric lockout successfully unlocked via step-up verification.');
        setStepUpPassword('');
      } else {
        setStepUpError(local.message || 'Incorrect password.');
      }
    } finally {
      setStepUpLoading(false);
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
        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-2.5 flex items-center justify-between gap-3 text-left">
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
                ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm border border-emerald-500/40 ring-1 ring-emerald-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Fingerprint className="w-4 h-4" />
              <span>Fingerprint</span>
            </div>
            <span className="text-[9px] flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Platform WebAuthn
            </span>
          </button>

          {/* Face ID / Webcam Option */}
          <button
            type="button"
            onClick={() => handleSwitchType('FACE')}
            className={`min-h-[48px] p-2 flex flex-col items-center justify-center rounded-xl text-xs font-bold transition-all relative cursor-pointer touch-press ${
              authType === 'FACE'
                ? 'bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 shadow-sm border border-teal-500/40 ring-1 ring-teal-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <ScanFace className="w-4 h-4" />
              <span>Face ID</span>
            </div>
            <span className="text-[9px] flex items-center gap-1 font-semibold text-teal-600 dark:text-teal-400">
              <span className={`w-1.5 h-1.5 rounded-full ${cameraActive ? 'bg-teal-500 animate-pulse' : 'bg-slate-400'}`}></span>
              {cameraActive
                ? 'Camera Live'
                : cameraState === 'requesting_permission' || cameraState === 'stream_starting'
                ? 'Connecting...'
                : 'Camera Off'}
            </span>
          </button>
        </div>

        {/* Phase 11: Staged Accessible Animation Pipeline for Face ID Registration */}
        {currentMode === 'REGISTER' && authType === 'FACE' && (
          <div
            className="bg-slate-50 dark:bg-slate-850 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-left space-y-1.5"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <span>Enrollment Stage</span>
              <span className="text-teal-600 dark:text-teal-400 font-mono">
                {faceEnrollStage === 'PREPARING'
                  ? 'Stage 1/7: Preparing'
                  : faceEnrollStage === 'PERMISSION'
                  ? 'Stage 2/7: Permission'
                  : faceEnrollStage === 'CAMERA_START'
                  ? 'Stage 3/7: Camera Start'
                  : faceEnrollStage === 'FACE_SEARCH'
                  ? 'Stage 4/7: Face Search'
                  : faceEnrollStage === 'QUALITY' || faceEnrollStage === 'QUALITY_CHECK'
                  ? 'Stage 5/7: Quality Analysis'
                  : faceEnrollStage === 'LIVENESS' || faceEnrollStage === 'LIVENESS_CHECK'
                  ? 'Stage 6/7: Anti-Spoofing Liveness'
                  : faceEnrollStage === 'PROCESSING'
                  ? 'Stage 7/7: Protected Vault Encryption'
                  : faceEnrollStage === 'SUCCESS'
                  ? 'Verified • Enrolled'
                  : faceEnrollStage === 'RETRY'
                  ? 'Retrying Capture'
                  : 'Enrollment Action Needed'}
              </span>
            </div>

            {/* Accessible Stepper Indicators */}
            <div className="grid grid-cols-7 gap-1" aria-hidden="true">
              <div
                className={`h-1.5 rounded-full transition-all ${
                  faceEnrollStage !== 'FAILURE' ? 'bg-teal-500' : 'bg-slate-300 dark:bg-slate-700'
                }`}
                title="Preparing"
              />
              <div
                className={`h-1.5 rounded-full transition-all ${
                  faceEnrollStage !== 'PREPARING' && faceEnrollStage !== 'FAILURE'
                    ? 'bg-teal-500'
                    : 'bg-slate-200 dark:bg-slate-700'
                }`}
                title="Permission"
              />
              <div
                className={`h-1.5 rounded-full transition-all ${
                  cameraActive ||
                  ['CAMERA_START', 'FACE_SEARCH', 'QUALITY', 'QUALITY_CHECK', 'LIVENESS', 'LIVENESS_CHECK', 'PROCESSING', 'SUCCESS'].includes(
                    faceEnrollStage
                  )
                    ? 'bg-teal-500'
                    : 'bg-slate-200 dark:bg-slate-700'
                }`}
                title="Camera Start"
              />
              <div
                className={`h-1.5 rounded-full transition-all ${
                  ['FACE_SEARCH', 'QUALITY', 'QUALITY_CHECK', 'LIVENESS', 'LIVENESS_CHECK', 'PROCESSING', 'SUCCESS'].includes(
                    faceEnrollStage
                  )
                    ? 'bg-teal-500'
                    : 'bg-slate-200 dark:bg-slate-700'
                }`}
                title="Face Search"
              />
              <div
                className={`h-1.5 rounded-full transition-all ${
                  ['QUALITY', 'QUALITY_CHECK', 'LIVENESS', 'LIVENESS_CHECK', 'PROCESSING', 'SUCCESS'].includes(
                    faceEnrollStage
                  )
                    ? 'bg-teal-500'
                    : 'bg-slate-200 dark:bg-slate-700'
                }`}
                title="Quality"
              />
              <div
                className={`h-1.5 rounded-full transition-all ${
                  ['LIVENESS', 'LIVENESS_CHECK', 'PROCESSING', 'SUCCESS'].includes(faceEnrollStage)
                    ? 'bg-teal-500'
                    : 'bg-slate-200 dark:bg-slate-700'
                }`}
                title="Liveness"
              />
              <div
                className={`h-1.5 rounded-full transition-all ${
                  faceEnrollStage === 'SUCCESS'
                    ? 'bg-emerald-500'
                    : faceEnrollStage === 'PROCESSING'
                    ? 'bg-teal-400 animate-pulse'
                    : 'bg-slate-200 dark:bg-slate-700'
                }`}
                title="Encryption"
              />
            </div>
          </div>
        )}

        {/* Phase 11: WebAuthn Platform Identity Context Banner for Fingerprint */}
        {currentMode === 'REGISTER' && authType === 'FINGERPRINT' && (
          <div className="bg-emerald-50/70 dark:bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-200/80 dark:border-emerald-800/60 text-left space-y-1">
            <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>WebAuthn Authenticated Context (NBE InstCode: 0000013)</span>
            </div>
            <p className="text-[10px] text-emerald-700/80 dark:text-emerald-400">
              Platform authenticator bound to <span className="font-semibold">{userEmail}</span>. No raw biometric templates leave your device enclave.
            </p>
          </div>
        )}

        {/* Specific Error Recovery Notification Card */}
        {specificErrorReason && (
          <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/80 text-left space-y-1 animate-in fade-in">
            <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400 font-bold text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{currentMode === 'REGISTER' ? 'Enrollment Notice' : 'Verification Notice'}</span>
            </div>
            <p className="text-[11px] text-rose-600 dark:text-rose-300 leading-snug">
              {specificErrorReason}
            </p>
            {authType === 'FACE' && (
              <div className="pt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2 py-1 bg-rose-600 text-white rounded-lg text-[10px] font-bold hover:bg-rose-500 cursor-pointer"
                >
                  Use Mobile Camera
                </button>
                <button
                  type="button"
                  onClick={handleRetry}
                  className="px-2 py-1 bg-white dark:bg-slate-800 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700 rounded-lg text-[10px] font-bold cursor-pointer"
                >
                  Retry Camera
                </button>
              </div>
            )}
          </div>
        )}

        {/* Interactive Biometric Viewport */}
        {scanState === 'RATE_LIMITED' ? (
          /* Lockout Screen with Step-Up Password Unlock Form */
          <div className="py-4 px-3 bg-rose-50/90 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 rounded-2xl text-center space-y-3 animate-in fade-in zoom-in-95 duration-200">
            <div className="relative w-14 h-14 mx-auto flex items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-700 shadow-sm">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Biometric Lockout Active
              </h4>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 max-w-xs mx-auto leading-relaxed mt-1">
                {specificErrorReason ||
                  'Account temporarily locked due to excessive failed attempts. Please unlock using your corporate password.'}
              </p>
            </div>

            {/* Step-Up Password Unlock Form */}
            <form
              onSubmit={handleStepUpUnlock}
              className="space-y-2 pt-2 border-t border-rose-200 dark:border-rose-800/80 text-left"
            >
              <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Step-Up Password Verification
              </label>
              <div className="relative">
                <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  placeholder="Enter corporate account password"
                  value={stepUpPassword}
                  onChange={(e) => setStepUpPassword(e.target.value)}
                  className="w-full text-xs pl-8 pr-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>
              {stepUpError && (
                <div className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold">{stepUpError}</div>
              )}
              <button
                type="submit"
                disabled={stepUpLoading}
                className="w-full py-2 px-3 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow cursor-pointer transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>{stepUpLoading ? 'Unlocking Lockout...' : 'Unlock Account with Password'}</span>
              </button>
            </form>
          </div>
        ) : scanState === 'UNSUPPORTED' ? (
          /* Hardware / Browser Unsupported Screen */
          <div className="py-4 px-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-center space-y-2.5 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center shadow-sm">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Biometric Sensor Unavailable
              </h4>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 max-w-xs mx-auto leading-relaxed mt-1">
                {statusMessage ||
                  'This device or browser does not have an active biometric sensor available. Please sign in using your corporate password.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                stopCameraStream();
                onCancel();
              }}
              className="w-full py-2.5 px-3 bg-ob-indigo-600 hover:bg-ob-indigo-500 text-white font-bold text-xs rounded-xl shadow cursor-pointer transition-all"
            >
              Sign In with Password
            </button>
          </div>
        ) : scanState === 'TIMEOUT' ? (
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
                        {cameraState === 'requesting_permission'
                          ? 'Awaiting Permission'
                          : cameraState === 'stream_starting'
                          ? 'Starting Camera...'
                          : cameraState === 'permission_denied' || cameraState === 'permission_blocked'
                          ? 'Camera Permission Blocked'
                          : cameraState === 'camera_busy'
                          ? 'Camera In Use'
                          : 'Camera Offline'}
                      </span>
                      <span className="text-[10px] text-slate-400 mt-0.5 leading-tight max-w-[140px]">
                        {cameraState === 'permission_denied' || cameraState === 'permission_blocked'
                          ? 'Allow camera in browser settings'
                          : cameraState === 'camera_busy'
                          ? 'Close other camera apps and retry'
                          : 'Tap below to start camera or use photo'}
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

                {/* Phase 17: Live Image Quality Indicator (Poor / Good / Excellent) */}
                {cameraActive && liveQuality && (
                  <div className="w-full max-w-[270px] flex flex-col items-center gap-1 animate-in fade-in duration-200">
                    <div
                      className={`px-3 py-1 rounded-full text-[11px] font-bold border flex items-center gap-1.5 transition-all shadow-xs ${
                        liveQuality.tier === 'EXCELLENT'
                          ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-700 dark:text-emerald-300 shadow-emerald-500/10'
                          : liveQuality.tier === 'GOOD'
                          ? 'bg-teal-500/15 border-teal-500/50 text-teal-700 dark:text-teal-300 shadow-teal-500/10'
                          : 'bg-amber-500/15 border-amber-500/50 text-amber-700 dark:text-amber-300 animate-pulse'
                      }`}
                    >
                      {liveQuality.tier === 'EXCELLENT' ? (
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      ) : liveQuality.tier === 'GOOD' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                      )}
                      <span>
                        Quality: {liveQuality.tier === 'EXCELLENT' ? 'Excellent' : liveQuality.tier === 'GOOD' ? 'Good' : 'Poor'}
                      </span>
                      <span className="text-[10px] font-mono opacity-80 font-normal">
                        ({Math.round(liveQuality.score * 100)}%)
                      </span>
                    </div>

                    {liveQuality.reason && liveQuality.tier === 'POOR' && (
                      <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 text-center leading-tight">
                        {liveQuality.reason}
                      </span>
                    )}

                    {/* Mini Optical Metrics Pill Bar */}
                    <div className="flex items-center justify-center gap-2.5 text-[10px] text-slate-500 dark:text-slate-400">
                      <span title={`Luminance: ${liveQuality.luminance}/255`}>
                        💡 Light: <span className="font-semibold text-slate-700 dark:text-slate-200">{liveQuality.luminance > 185 ? 'High' : liveQuality.luminance < 60 ? 'Low' : 'Optimal'}</span>
                      </span>
                      <span>•</span>
                      <span title={`Laplacian Sharpness: ${Math.round(liveQuality.sharpness * 100)}%`}>
                        🔍 Focus: <span className="font-semibold text-slate-700 dark:text-slate-200">{Math.round(liveQuality.sharpness * 100)}%</span>
                      </span>
                    </div>
                  </div>
                )}

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
                  ? authType === 'FACE'
                    ? cameraState === 'capturing'
                      ? 'Capturing face...'
                      : cameraState === 'processing'
                      ? 'Verifying your identity...'
                      : 'Verifying Facial Profile...'
                    : 'Verifying Fingerprint Sensor...'
                  : scanState === 'ERROR'
                  ? 'Face Verification Failed'
                  : authType === 'FACE'
                  ? cameraState === 'stream_ready'
                    ? 'Camera Ready'
                    : cameraState === 'requesting_permission'
                    ? 'Requesting Camera Permission...'
                    : cameraState === 'stream_starting'
                    ? 'Starting Camera Feed...'
                    : cameraState === 'permission_denied' || cameraState === 'permission_blocked'
                    ? 'Camera Permission Blocked'
                    : cameraState === 'camera_busy'
                    ? 'Camera Unavailable'
                    : 'Camera Offline — Tap Below'
                  : 'Touch Sensor to Sign In'}
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 max-w-xs mx-auto">
                {scanState === 'ERROR'
                  ? specificErrorReason || statusMessage || 'Face verification was not successful. Please try again.'
                  : authType === 'FACE'
                  ? cameraState === 'stream_ready'
                    ? statusMessage || 'Camera is ready. Position your face inside the frame.'
                    : cameraState === 'capturing'
                    ? 'Capturing face...'
                    : cameraState === 'processing'
                    ? 'Verifying your identity...'
                    : cameraState === 'permission_denied' || cameraState === 'permission_blocked'
                    ? 'Camera permission is blocked. Allow camera access for this site, then retry.'
                    : cameraState === 'camera_busy'
                    ? 'The camera is currently unavailable. Close other applications using the camera and retry.'
                    : statusMessage || 'Look at camera or snap a quick selfie with your phone camera'
                  : statusMessage || 'Touch device fingerprint scanner or platform passkey'}
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
          ) : scanState === 'RATE_LIMITED' ? (
            <>
              <button
                type="button"
                onClick={() => {
                  stopCameraStream();
                  onCancel();
                }}
                className="w-full min-h-[44px] py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer touch-press"
              >
                <span>Continue with Password</span>
              </button>
              <button
                type="button"
                onClick={handleRetry}
                className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                Check / Refresh Lockout Status
              </button>
            </>
          ) : scanState === 'UNSUPPORTED' ? (
            <button
              type="button"
              onClick={() => {
                stopCameraStream();
                onCancel();
              }}
              className="w-full min-h-[44px] py-2.5 px-4 bg-ob-indigo-600 hover:bg-ob-indigo-500 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer touch-press"
            >
              <span>Continue with Password</span>
            </button>
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
                          ? cameraActive
                            ? 'Capture & Enroll Face'
                            : 'Start Camera & Enroll'
                          : 'Touch & Enroll Fingerprint'
                        : authType === 'FACE'
                        ? cameraActive
                          ? 'Verify Face to Sign In'
                          : 'Start Camera & Sign In'
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
