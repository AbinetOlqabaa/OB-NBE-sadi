/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type CameraState =
  | 'idle'
  | 'requesting_permission'
  | 'stream_starting'
  | 'stream_ready'
  | 'stream_active'
  | 'capturing'
  | 'processing'
  | 'permission_denied'
  | 'permission_blocked'
  | 'camera_busy'
  | 'hardware_unavailable'
  | 'streaming_error'
  | 'stopped';

export interface CameraDiagnosticLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  details?: any;
}

class CameraService {
  private activeStream: MediaStream | null = null;
  private state: CameraState = 'idle';
  private listeners: Set<(state: CameraState) => void> = new Set();
  private diagnosticLogs: CameraDiagnosticLog[] = [];

  constructor() {
    this.logDiagnostic('info', 'CameraService initialized.');
  }

  public getState(): CameraState {
    return this.state;
  }

  public getActiveStream(): MediaStream | null {
    return this.activeStream;
  }

  public isStreamAlive(stream: MediaStream | null): boolean {
    if (!stream) return false;
    const tracks = stream.getVideoTracks();
    return tracks.length > 0 && tracks.some((t) => t.readyState === 'live' && t.enabled);
  }

  public subscribe(callback: (state: CameraState) => void): () => void {
    this.listeners.add(callback);
    callback(this.state);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (e) {
        console.error('Error in CameraService subscriber:', e);
      }
    }
  }

  private setState(newState: CameraState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.logDiagnostic('info', `Camera state changed to: ${newState}`);
      this.notifyListeners();
    }
  }

  public resetToStreamReady(): void {
    if (this.activeStream && this.isStreamAlive(this.activeStream)) {
      this.setState('stream_ready');
    } else {
      this.setState('idle');
    }
  }

  public logDiagnostic(level: 'info' | 'warn' | 'error', message: string, details?: any): void {
    const log: CameraDiagnosticLog = {
      timestamp: new Date().toISOString(),
      level,
      message,
      details,
    };
    this.diagnosticLogs.push(log);
    if (this.diagnosticLogs.length > 100) {
      this.diagnosticLogs.shift();
    }
  }

  public getLastDiagnostic(): CameraDiagnosticLog | null {
    return this.diagnosticLogs.length > 0 ? this.diagnosticLogs[this.diagnosticLogs.length - 1] : null;
  }

  public getDiagnosticLogs(): CameraDiagnosticLog[] {
    return [...this.diagnosticLogs];
  }

  public async startStream(
    videoElement?: HTMLVideoElement | null
  ): Promise<{
    success: boolean;
    stream?: MediaStream;
    error?: string;
    state?: CameraState;
    diagnostic?: CameraDiagnosticLog;
  }> {
    // If an existing live stream exists, reuse it directly
    if (this.activeStream && this.isStreamAlive(this.activeStream)) {
      this.setState('stream_ready');
      if (videoElement && videoElement.srcObject !== this.activeStream) {
        videoElement.srcObject = this.activeStream;
        videoElement.play().catch(() => {});
      }
      return { success: true, stream: this.activeStream, state: 'stream_ready' };
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.setState('hardware_unavailable');
      this.logDiagnostic('error', 'navigator.mediaDevices.getUserMedia is unavailable in this environment.');
      return {
        success: false,
        error: 'Webcam hardware is not supported or accessible in this browser.',
        state: 'hardware_unavailable',
        diagnostic: this.getLastDiagnostic() || undefined,
      };
    }

    this.setState('requesting_permission');
    this.logDiagnostic('info', 'Requesting webcam media access...');

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.activeStream = stream;
      this.setState('stream_ready');
      this.logDiagnostic('info', 'Webcam stream acquired successfully.');

      // Listen for unexpected track stops
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          this.logDiagnostic('warn', 'Active video track ended externally.');
          this.activeStream = null;
          this.setState('stopped');
        };
      }

      if (videoElement) {
        videoElement.srcObject = stream;
        videoElement.play().catch((err) => {
          this.logDiagnostic('warn', 'videoElement play error:', err);
        });
      }

      return { success: true, stream, state: 'stream_ready' };
    } catch (err: any) {
      let state: CameraState = 'streaming_error';
      let errorMsg = 'Failed to access camera.';

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        state = 'permission_denied';
        errorMsg = 'Camera permission was denied by the user or browser.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        state = 'hardware_unavailable';
        errorMsg = 'No camera hardware found on this workstation.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        state = 'hardware_unavailable';
        errorMsg = 'Camera hardware is already in use by another application.';
      }

      this.setState(state);
      this.logDiagnostic('error', errorMsg, { name: err.name, message: err.message });

      return {
        success: false,
        error: errorMsg,
        state,
        diagnostic: this.getLastDiagnostic() || undefined,
      };
    }
  }

  public stopStream(): void {
    if (this.activeStream) {
      try {
        const tracks = this.activeStream.getTracks();
        for (const track of tracks) {
          track.stop();
        }
      } catch (e) {
        console.error('Error stopping media tracks:', e);
      }
      this.activeStream = null;
    }
    this.setState('stopped');
    this.logDiagnostic('info', 'Camera stream stopped and hardware released.');
  }

  public async captureFrame(
    videoElement?: HTMLVideoElement | null
  ): Promise<{ success: boolean; imageBase64?: string; faceHash?: string; error?: string }> {
    if (!videoElement || videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
      return { success: false, error: 'Video element not ready or no video feed available.' };
    }

    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoElement.videoWidth || 320;
      canvas.height = videoElement.videoHeight || 240;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return { success: false, error: 'Canvas 2D context creation failed.' };
      }

      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const faceHash = this.computeOpticalHash(imageData);
      const imageBase64 = canvas.toDataURL('image/jpeg', 0.85);

      return {
        success: true,
        imageBase64,
        faceHash,
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Frame capture failed.' };
    }
  }

  public computeOpticalHash(imageData: ImageData): string {
    const data = imageData.data;
    let rSum = 0;
    let gSum = 0;
    let bSum = 0;
    const len = data.length;
    const step = 16; // Sample every 4th pixel (4 components per pixel)
    let samples = 0;

    for (let i = 0; i < len; i += step) {
      rSum += data[i];
      gSum += data[i + 1];
      bSum += data[i + 2];
      samples++;
    }

    const rAvg = Math.round(rSum / Math.max(1, samples));
    const gAvg = Math.round(gSum / Math.max(1, samples));
    const bAvg = Math.round(bSum / Math.max(1, samples));

    // Fast deterministic non-sensitive spatial vector
    return `face_optical_${rAvg.toString(16).padStart(2, '0')}${gAvg.toString(16).padStart(2, '0')}${bAvg.toString(16).padStart(2, '0')}_len${len}`;
  }
}

export const cameraService = new CameraService();
