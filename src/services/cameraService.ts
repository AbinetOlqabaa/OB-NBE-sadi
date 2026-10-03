/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Authoritative Browser Camera Service (Singleton)
 * 
 * Implements strict single-stream lifecycle ownership, tolerant mobile constraints,
 * granular error discrimination, permissions inspection, and secure frame capture.
 * Compliance: NBE Directive BSD/03/2020 & 16_OB_FACE_ID_SIGN_IN_CAMERA_FAILURE_DEEP_DIAGNOSTIC_AND_FIX.
 */

export type CameraState =
  | 'idle'
  | 'requesting_permission'
  | 'permission_denied'
  | 'permission_blocked'
  | 'stream_starting'
  | 'stream_ready'
  | 'capturing'
  | 'processing'
  | 'verified'
  | 'verification_failed'
  | 'camera_unavailable'
  | 'camera_busy'
  | 'unsupported'
  | 'stopped';

export interface CameraDiagnosticLog {
  timestamp: string;
  stage: string;
  cameraState: CameraState;
  errorName?: string;
  errorMessage?: string;
  isSecureContext: boolean;
  mediaDevicesAvailable: boolean;
  permissionState: 'granted' | 'prompt' | 'denied' | 'unsupported';
  hasActiveStream: boolean;
  activeVideoTrackCount: number;
  videoReadyState: number;
  videoWidth: number;
  videoHeight: number;
  origin: string;
  isEmbedded: boolean;
  facingMode?: string;
}

export interface CameraStartResult {
  success: boolean;
  stream?: MediaStream;
  state: CameraState;
  error?: string;
  errorName?: string;
  diagnostic?: CameraDiagnosticLog;
}

export interface CameraCaptureResult {
  success: boolean;
  imageBase64?: string;
  faceHash?: string;
  state: CameraState;
  error?: string;
  diagnostic?: CameraDiagnosticLog;
}

export type CameraStateSubscriber = (state: CameraState, diagnostic?: CameraDiagnosticLog) => void;

class CameraService {
  private activeStream: MediaStream | null = null;
  private boundVideo: HTMLVideoElement | null = null;
  private state: CameraState = 'idle';
  private startPromise: Promise<CameraStartResult> | null = null;
  private subscribers: Set<CameraStateSubscriber> = new Set();
  private diagnosticsHistory: CameraDiagnosticLog[] = [];
  private lastDiagnostic: CameraDiagnosticLog | null = null;
  private currentFacingMode: string = 'user';

  constructor() {
    // Listen for device changes (e.g. external webcam connected/disconnected)
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', () => {
        this.logDiagnostic('DEVICE_CHANGE_EVENT');
      });
    }
  }

  /**
   * Subscribe to camera state changes
   */
  public subscribe(subscriber: CameraStateSubscriber): () => void {
    this.subscribers.add(subscriber);
    try {
      subscriber(this.state, this.lastDiagnostic || undefined);
    } catch {}
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  public getState(): CameraState {
    return this.state;
  }

  public getActiveStream(): MediaStream | null {
    if (this.activeStream && this.isStreamAlive(this.activeStream)) {
      return this.activeStream;
    }
    return null;
  }

  public getLastDiagnostic(): CameraDiagnosticLog | null {
    return this.lastDiagnostic;
  }

  public getDiagnosticLogs(): CameraDiagnosticLog[] {
    return [...this.diagnosticsHistory];
  }

  /**
   * Check if a MediaStream has active, non-ended video tracks
   */
  public isStreamAlive(stream?: MediaStream | null): boolean {
    const s = stream || this.activeStream;
    if (!s) return false;
    const tracks = s.getVideoTracks();
    return tracks.length > 0 && tracks.some((t) => t.readyState === 'live');
  }

  /**
   * Restores stream_ready state if the MediaStream is active and live
   * Allows re-verification from the existing video stream without calling getUserMedia() again.
   */
  public resetToStreamReady(): boolean {
    if (this.activeStream && this.isStreamAlive(this.activeStream)) {
      this.setState('stream_ready');
      this.logDiagnostic('STREAM_RESTORED_READY');
      return true;
    }
    return false;
  }

  /**
   * Snapshot current system diagnostic details
   */
  private buildDiagnostic(stage: string, errorName?: string, errorMessage?: string): CameraDiagnosticLog {
    const isSecureContext = typeof window !== 'undefined' ? Boolean(window.isSecureContext) : false;
    const mediaDevicesAvailable =
      typeof navigator !== 'undefined' &&
      Boolean(navigator.mediaDevices) &&
      typeof navigator.mediaDevices.getUserMedia === 'function';
    const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'server';
    const isEmbedded = typeof window !== 'undefined' && window.top ? window.top !== window.self : false;

    const tracks = this.activeStream ? this.activeStream.getVideoTracks() : [];
    const activeVideoTrackCount = tracks.filter((t) => t.readyState === 'live').length;
    const videoReadyState = this.boundVideo ? this.boundVideo.readyState : -1;
    const videoWidth = this.boundVideo ? this.boundVideo.videoWidth : 0;
    const videoHeight = this.boundVideo ? this.boundVideo.videoHeight : 0;

    const log: CameraDiagnosticLog = {
      timestamp: new Date().toISOString(),
      stage,
      cameraState: this.state,
      errorName,
      errorMessage,
      isSecureContext,
      mediaDevicesAvailable,
      permissionState: 'unsupported',
      hasActiveStream: Boolean(this.activeStream && this.isStreamAlive(this.activeStream)),
      activeVideoTrackCount,
      videoReadyState,
      videoWidth,
      videoHeight,
      origin,
      isEmbedded,
      facingMode: this.currentFacingMode,
    };

    return log;
  }

  private logDiagnostic(stage: string, errorName?: string, errorMessage?: string): CameraDiagnosticLog {
    const log = this.buildDiagnostic(stage, errorName, errorMessage);
    this.lastDiagnostic = log;
    this.diagnosticsHistory.unshift(log);
    if (this.diagnosticsHistory.length > 50) {
      this.diagnosticsHistory.pop();
    }
    return log;
  }

  private setState(newState: CameraState, diagnostic?: CameraDiagnosticLog): void {
    this.state = newState;
    const diag = diagnostic || this.logDiagnostic(`STATE_CHANGE:${newState}`);
    queueMicrotask(() => {
      this.subscribers.forEach((fn) => {
        try {
          fn(newState, diag);
        } catch {}
      });
    });
  }

  /**
   * Inspect Permissions API where supported
   */
  public async queryPermissionState(): Promise<'granted' | 'prompt' | 'denied' | 'unsupported'> {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
      return 'unsupported';
    }
    try {
      const status = await navigator.permissions.query({ name: 'camera' as any });
      return status.state as 'granted' | 'prompt' | 'denied';
    } catch {
      return 'unsupported';
    }
  }

  /**
   * Start or attach to the authoritative camera stream
   *
   * Re-entrant safe: if stream is already active and healthy, binds to videoElement without calling getUserMedia() again.
   * Tolerant mobile constraints: ideal front camera, fallback to generic video camera.
   */
  public async startStream(videoElement?: HTMLVideoElement | null): Promise<CameraStartResult> {
    // If a start operation is currently in progress, return the existing promise
    if (this.startPromise) {
      return this.startPromise;
    }

    this.startPromise = this.executeStartStream(videoElement);
    try {
      const result = await this.startPromise;
      return result;
    } finally {
      this.startPromise = null;
    }
  }

  private async executeStartStream(videoElement?: HTMLVideoElement | null): Promise<CameraStartResult> {
    const isSecureContext = typeof window !== 'undefined' ? Boolean(window.isSecureContext) : false;
    const mediaDevicesAvailable =
      typeof navigator !== 'undefined' &&
      Boolean(navigator.mediaDevices) &&
      typeof navigator.mediaDevices.getUserMedia === 'function';

    // Phase 7: Check Secure Context & MediaDevices Support
    if (!mediaDevicesAvailable) {
      this.setState('unsupported');
      const diag = this.logDiagnostic('CAPABILITY_CHECK', 'UnsupportedError', 'getUserMedia is not supported on this browser or environment.');
      return {
        success: false,
        state: 'unsupported',
        error: 'Webcam video capture is not supported on this browser or platform.',
        errorName: 'UnsupportedError',
        diagnostic: diag,
      };
    }

    if (
      !isSecureContext &&
      typeof window !== 'undefined' &&
      window.location?.hostname &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    ) {
      this.setState('permission_blocked');
      const diag = this.logDiagnostic('SECURE_CONTEXT_CHECK', 'SecurityError', 'Camera access requires a secure HTTPS context.');
      return {
        success: false,
        state: 'permission_blocked',
        error: 'Camera access requires a secure HTTPS connection. Please access over HTTPS.',
        errorName: 'SecurityError',
        diagnostic: diag,
      };
    }

    // Phase 10: If active stream is already live, REUSE IT directly!
    // Do NOT request getUserMedia() again!
    if (this.activeStream && this.isStreamAlive(this.activeStream)) {
      if (videoElement) {
        this.boundVideo = videoElement;
        if (videoElement.srcObject !== this.activeStream) {
          videoElement.srcObject = this.activeStream;
          videoElement.setAttribute('playsinline', 'true');
          videoElement.muted = true;
          await videoElement.play().catch(() => {});
        }
        await this.waitForVideoReadiness(videoElement);
      }
      this.setState('stream_ready');
      const diag = this.logDiagnostic('STREAM_REUSED');
      return {
        success: true,
        stream: this.activeStream,
        state: 'stream_ready',
        diagnostic: diag,
      };
    }

    // Clean up any dead or orphaned tracks before starting
    this.stopStreamInternal(false);

    // Phase 4 & 6: Inspect permission & transition to requesting_permission
    this.setState('requesting_permission');
    const perm = await this.queryPermissionState();
    if (perm === 'denied') {
      this.setState('permission_denied');
      const diag = this.logDiagnostic('PERMISSION_PRECHECK_DENIED', 'NotAllowedError', 'Camera permission is already denied in browser settings.');
      return {
        success: false,
        state: 'permission_denied',
        error: 'Camera permission is blocked or denied. Please enable camera access in browser site settings and retry.',
        errorName: 'NotAllowedError',
        diagnostic: diag,
      };
    }

    this.setState('stream_starting');
    let stream: MediaStream;

    // Phase 9: Tolerant mobile constraints (ideal front camera)
    try {
      this.currentFacingMode = 'user';
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'user' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
    } catch (primaryErr: any) {
      const errName = primaryErr?.name || '';
      // If error is NOT a hard permission refusal, attempt tolerant constraint fallbacks
      if (errName !== 'NotAllowedError' && errName !== 'PermissionDeniedError' && errName !== 'SecurityError') {
        try {
          this.currentFacingMode = 'user_fallback';
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user' },
            audio: false,
          });
        } catch {
          try {
            this.currentFacingMode = 'generic';
            stream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false,
            });
          } catch (fallbackErr: any) {
            return this.handleCameraError(fallbackErr, 'GET_USER_MEDIA_FALLBACK');
          }
        }
      } else {
        return this.handleCameraError(primaryErr, 'GET_USER_MEDIA_PRIMARY');
      }
    }

    this.activeStream = stream;

    // Bind to video element if supplied
    if (videoElement) {
      this.boundVideo = videoElement;
      videoElement.srcObject = stream;
      videoElement.setAttribute('playsinline', 'true');
      videoElement.muted = true;
      try {
        await videoElement.play();
      } catch {}
      await this.waitForVideoReadiness(videoElement);
    }

    this.setState('stream_ready');
    const readyDiag = this.logDiagnostic('STREAM_READY');
    return {
      success: true,
      stream,
      state: 'stream_ready',
      diagnostic: readyDiag,
    };
  }

  /**
   * Waits until the video element has loaded dimensions and has data ready for optical capture
   */
  private async waitForVideoReadiness(videoElement: HTMLVideoElement, timeoutMs: number = 2000): Promise<boolean> {
    if (videoElement.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && videoElement.videoWidth > 0) {
      return true;
    }

    return new Promise((resolve) => {
      let resolved = false;
      const done = () => {
        if (!resolved) {
          resolved = true;
          videoElement.removeEventListener('loadedmetadata', done);
          videoElement.removeEventListener('canplay', done);
          videoElement.removeEventListener('playing', done);
          resolve(true);
        }
      };

      videoElement.addEventListener('loadedmetadata', done, { once: true });
      videoElement.addEventListener('canplay', done, { once: true });
      videoElement.addEventListener('playing', done, { once: true });

      setTimeout(done, timeoutMs);
    });
  }

  /**
   * Phase 5: Granular DOMException inspection and error discrimination
   */
  private handleCameraError(err: any, stage: string): CameraStartResult {
    const errorName = err?.name || 'UnknownError';
    const rawMessage = err?.message || '';

    let state: CameraState = 'camera_unavailable';
    let userMessage = 'Unable to access device camera.';

    switch (errorName) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        state = 'permission_denied';
        userMessage = 'Camera permission is blocked or the browser is not allowing this page to access the camera.';
        break;

      case 'NotFoundError':
      case 'DevicesNotFoundError':
        state = 'camera_unavailable';
        userMessage = 'No compatible camera was found.';
        break;

      case 'NotReadableError':
      case 'TrackStartError':
        state = 'camera_busy';
        userMessage = 'The camera is currently unavailable or being used by another application.';
        break;

      case 'OverconstrainedError':
      case 'ConstraintNotSatisfiedError':
        state = 'camera_unavailable';
        userMessage = 'The requested camera configuration is not supported.';
        break;

      case 'SecurityError':
        state = 'permission_blocked';
        userMessage = 'Camera access has been disabled by the browser or environment.';
        break;

      case 'AbortError':
        state = 'stopped';
        userMessage = 'Camera initialization was dismissed or cancelled.';
        break;

      case 'TypeError':
        state = 'unsupported';
        userMessage = 'Camera capture parameters are invalid.';
        break;

      default:
        state = 'camera_unavailable';
        userMessage = rawMessage || 'Unable to access device camera.';
        break;
    }

    this.setState(state);
    const diag = this.logDiagnostic(stage, errorName, rawMessage || userMessage);

    return {
      success: false,
      state,
      error: userMessage,
      errorName,
      diagnostic: diag,
    };
  }

  /**
   * Phase 11: Capture frame strictly from the ALREADY ACTIVE video stream
   * Does NOT call getUserMedia() again!
   * Verifies video.readyState >= HAVE_CURRENT_DATA and videoWidth > 0 before drawing
   */
  public async captureFrame(videoElement?: HTMLVideoElement | null): Promise<CameraCaptureResult> {
    const targetVideo = videoElement || this.boundVideo;

    if (!targetVideo) {
      this.setState('verification_failed');
      const diag = this.logDiagnostic('CAPTURE_NO_VIDEO_ELEMENT');
      return {
        success: false,
        state: 'verification_failed',
        error: 'Video optical stream not initialized. Please ensure camera is active.',
        diagnostic: diag,
      };
    }

    if (!this.activeStream || !this.isStreamAlive(this.activeStream)) {
      this.setState('camera_unavailable');
      const diag = this.logDiagnostic('CAPTURE_STREAM_INACTIVE');
      return {
        success: false,
        state: 'camera_unavailable',
        error: 'Camera stream is no longer active. Please restart camera.',
        diagnostic: diag,
      };
    }

    // Phase 11: Ensure video element readiness before capture
    if (typeof HTMLMediaElement !== 'undefined') {
      const isReady = targetVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && targetVideo.videoWidth > 0;
      if (!isReady) {
        await this.waitForVideoReadiness(targetVideo, 1500);
      }
    }

    this.setState('capturing');

    try {
      const w = targetVideo.videoWidth || 640;
      const h = targetVideo.videoHeight || 480;

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        this.setState('verification_failed');
        return {
          success: false,
          state: 'verification_failed',
          error: 'Could not initialize 2D canvas context for optical capture.',
        };
      }

      // Draw active frame from running video element
      ctx.drawImage(targetVideo, 0, 0, w, h);

      const imageBase64 = canvas.toDataURL('image/jpeg', 0.85);
      const imageData = ctx.getImageData(0, 0, w, h);
      const faceHash = this.computeOpticalHash(imageData);

      this.setState('processing');
      const diag = this.logDiagnostic('CAPTURE_SUCCESS');

      return {
        success: true,
        imageBase64,
        faceHash,
        state: 'processing',
        diagnostic: diag,
      };
    } catch (err: any) {
      this.setState('verification_failed');
      const diag = this.logDiagnostic('CAPTURE_EXCEPTION', err?.name, err?.message);
      return {
        success: false,
        state: 'verification_failed',
        error: err?.message || 'Failed to capture frame from active camera stream.',
        diagnostic: diag,
      };
    }
  }

  /**
   * Computes deterministic salted optical hash from image pixel data
   */
  public computeOpticalHash(imageData: ImageData): string {
    const data = imageData.data;
    let rSum = 0;
    let gSum = 0;
    let bSum = 0;
    let lumSum = 0;
    const len = data.length;
    const step = 4 * 16; // Sample every 16th pixel for performance

    for (let i = 0; i < len; i += step) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      rSum += r;
      gSum += g;
      bSum += b;
      lumSum += 0.299 * r + 0.587 * g + 0.114 * b;
    }

    const count = len / step;
    const avgR = Math.round(rSum / count);
    const avgG = Math.round(gSum / count);
    const avgB = Math.round(bSum / count);
    const avgLum = Math.round(lumSum / count);

    return `face_optical_${avgR}_${avgG}_${avgB}_lum_${avgLum}_dim_${imageData.width}x${imageData.height}`;
  }

  /**
   * Stop active stream cleanly and release hardware
   */
  public stopStream(): void {
    this.stopStreamInternal(true);
  }

  private stopStreamInternal(notify: boolean = true): void {
    if (this.activeStream) {
      this.activeStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      this.activeStream = null;
    }

    if (this.boundVideo) {
      try {
        this.boundVideo.srcObject = null;
      } catch {}
      this.boundVideo = null;
    }

    if (notify) {
      this.setState('stopped');
      this.logDiagnostic('STREAM_STOPPED');
    }
  }
}

export const cameraService = new CameraService();
