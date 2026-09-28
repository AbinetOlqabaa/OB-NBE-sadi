/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface DeviceHardwareStatus {
  available: boolean;
  label: string;
  reason?: string;
  isPlatformPasskey?: boolean;
  count?: number;
}

export interface DeviceCapabilities {
  isWebAuthnSupported: boolean;
  isPlatformAuthenticatorAvailable: boolean;
  isFingerprintSupported: boolean;
  isCameraSupported: boolean;
  cameraCount: number;
  cameraDevices: string[];
  hasAnyBiometric: boolean;
  hasBothBiometrics: boolean;
  preferredMethod: 'FINGERPRINT' | 'FACE' | 'PASSWORD';
  fingerprintStatus: DeviceHardwareStatus;
  cameraStatus: DeviceHardwareStatus;
}

/**
 * Checks if the browser supports Web Authentication API (WebAuthn)
 */
export function checkWebAuthnSupport(): boolean {
  return (
    typeof window !== 'undefined' &&
    Boolean(window.PublicKeyCredential) &&
    typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
  );
}

/**
 * Checks if a user-verifying platform authenticator (e.g. Windows Hello, Touch ID, Android Passkey) is available
 */
export async function checkPlatformAuthenticator(): Promise<boolean> {
  if (!checkWebAuthnSupport()) {
    return false;
  }
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/**
 * Checks if the device has connected video camera(s) using navigator.mediaDevices
 */
export async function checkCameraSupport(): Promise<{
  available: boolean;
  count: number;
  devices: string[];
  error?: string;
}> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices ||
    typeof navigator.mediaDevices.getUserMedia !== 'function'
  ) {
    return {
      available: false,
      count: 0,
      devices: [],
      error: 'MediaDevices video capture is not supported in this browser.',
    };
  }

  try {
    if (typeof navigator.mediaDevices.enumerateDevices === 'function') {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = allDevices.filter((d) => d.kind === 'videoinput');
      const count = videoInputs.length;
      return {
        available: count > 0,
        count,
        devices: videoInputs.map((d) => d.label || `Camera ${videoInputs.indexOf(d) + 1}`),
      };
    } else {
      return {
        available: true,
        count: 1,
        devices: ['Default Camera Device'],
      };
    }
  } catch (err: any) {
    return {
      available: false,
      count: 0,
      devices: [],
      error: err?.message || 'Error enumerating camera video devices.',
    };
  }
}

/**
 * Comprehensive device capability evaluation combining PublicKeyCredential and MediaDevices
 */
export async function getDeviceCapabilities(): Promise<DeviceCapabilities> {
  const isWebAuthnSupported = checkWebAuthnSupport();
  const isPlatformAvailable = await checkPlatformAuthenticator();
  const cameraResult = await checkCameraSupport();

  let storedFpOverride: string | null = null;
  let storedCamOverride: string | null = null;
  let probeVerified = false;

  try {
    if (typeof localStorage !== 'undefined') {
      storedFpOverride = localStorage.getItem('ob_hw_fingerprint_status');
      storedCamOverride = localStorage.getItem('ob_hw_camera_status');
      probeVerified = localStorage.getItem('ob_fingerprint_probe_verified') === 'true';
    }
  } catch {}

  const isMobile =
    typeof navigator !== 'undefined' &&
    /Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent || '');

  // 1. Evaluate Fingerprint Scanner Availability
  let isFingerprintSupported = false;
  let fingerprintStatus: DeviceHardwareStatus;

  if (!isWebAuthnSupported) {
    isFingerprintSupported = false;
    fingerprintStatus = {
      available: false,
      label: 'Fingerprint Scanner Inactive',
      reason: 'Web Authentication API is not supported in this browser.',
    };
  } else if (!isPlatformAvailable) {
    isFingerprintSupported = false;
    fingerprintStatus = {
      available: false,
      label: 'Fingerprint Sensor Inactive',
      reason: 'No platform biometric authenticator configured on this system.',
    };
  } else if (storedFpOverride === 'DISABLED') {
    isFingerprintSupported = false;
    fingerprintStatus = {
      available: false,
      label: 'Fingerprint Sensor Inactive',
      reason: 'Marked inactive: device does not have a physical fingerprint scanner.',
    };
  } else if (storedFpOverride === 'ENABLED') {
    isFingerprintSupported = true;
    fingerprintStatus = {
      available: true,
      label: 'Fingerprint Sensor Active',
      reason: 'Fingerprint sensor verified and active on this device.',
    };
  } else if (isMobile) {
    isFingerprintSupported = true;
    fingerprintStatus = {
      available: true,
      label: 'Mobile Biometric Sensor Active',
      reason: 'Mobile platform biometric sensor detected.',
    };
  } else if (probeVerified) {
    isFingerprintSupported = true;
    fingerprintStatus = {
      available: true,
      label: 'Fingerprint Sensor Active (Verified)',
      reason: 'Biometric hardware sensor probe verified on this system.',
    };
  } else {
    // Desktop PC where platform authenticator exists (PIN/passkey) but no physical fingerprint sensor is confirmed
    isFingerprintSupported = false;
    fingerprintStatus = {
      available: false,
      label: 'Fingerprint Inactive (No Sensor Detected)',
      reason: 'Platform passkey/PIN detected, but no physical fingerprint reader was detected.',
      isPlatformPasskey: true,
    };
  }

  // 2. Evaluate Device Camera / Webcam Availability
  let isCameraSupported = false;
  let cameraStatus: DeviceHardwareStatus;

  if (storedCamOverride === 'DISABLED') {
    isCameraSupported = false;
    cameraStatus = {
      available: false,
      label: 'Camera Inactive (Disabled)',
      reason: 'Camera is disabled in device sensor preferences.',
      count: cameraResult.count,
    };
  } else if (storedCamOverride === 'ENABLED') {
    isCameraSupported = true;
    cameraStatus = {
      available: true,
      label: 'Webcam Ready (Enabled)',
      reason: 'Camera manually enabled for this device.',
      count: cameraResult.count,
    };
  } else if (cameraResult.available) {
    isCameraSupported = true;
    cameraStatus = {
      available: true,
      label: 'Webcam Camera Ready',
      reason: `${cameraResult.count} video input device(s) connected.`,
      count: cameraResult.count,
    };
  } else {
    isCameraSupported = false;
    cameraStatus = {
      available: false,
      label: 'Camera Inactive / Not Detected',
      reason: cameraResult.error || 'No webcam or front camera was found on your system.',
      count: 0,
    };
  }

  const hasAnyBiometric = isFingerprintSupported || isCameraSupported;
  const hasBothBiometrics = isFingerprintSupported && isCameraSupported;

  const preferredMethod: 'FINGERPRINT' | 'FACE' | 'PASSWORD' =
    hasBothBiometrics
      ? 'FINGERPRINT'
      : isCameraSupported
      ? 'FACE'
      : isFingerprintSupported
      ? 'FINGERPRINT'
      : 'PASSWORD';

  return {
    isWebAuthnSupported,
    isPlatformAuthenticatorAvailable: isPlatformAvailable,
    isFingerprintSupported,
    isCameraSupported,
    cameraCount: cameraResult.count,
    cameraDevices: cameraResult.devices,
    hasAnyBiometric,
    hasBothBiometrics,
    preferredMethod,
    fingerprintStatus,
    cameraStatus,
  };
}

/**
 * Listens for hardware changes (such as webcams connected or disconnected)
 */
export function subscribeToDeviceChanges(callback: () => void): () => void {
  if (
    typeof navigator !== 'undefined' &&
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.addEventListener === 'function'
  ) {
    navigator.mediaDevices.addEventListener('devicechange', callback);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', callback);
    };
  }
  return () => {};
}
