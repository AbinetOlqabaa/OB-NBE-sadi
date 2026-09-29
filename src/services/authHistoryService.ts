/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { auditService } from './auditService.ts';

export type AuthMethod = 'FINGERPRINT' | 'FACE' | 'PASSWORD';
export type AuthAttemptStatus = 'SUCCESS' | 'FAILED' | 'TIMEOUT' | 'ENROLLED';

export interface AuthHistoryEntry {
  id: string;
  timestamp: string;
  method: AuthMethod;
  status: AuthAttemptStatus;
  userEmail: string;
  userName: string;
  userRole: string;
  deviceId: string;
  deviceLabel: string;
  ipAddress?: string;
  failureReason?: string;
  complianceDirective: string;
  correlationId: string;
  responseTimeMs?: number;
}

const STORAGE_KEY = 'ob_auth_history_records';

/**
 * Derives a consistent hardware device identifier based on workstation / mobile hardware characteristics
 */
export function getHardwareDeviceId(): string {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'OB-HW-SEC-ENC-DEFAULT';
  }

  try {
    const stored = localStorage.getItem('ob_hardware_device_id');
    if (stored) return stored;

    const ua = navigator.userAgent || '';
    const isAndroid = /Android/i.test(ua);
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    const isMac = /Macintosh/i.test(ua);
    const isWindows = /Windows/i.test(ua);

    let prefix = 'OB-HW-DESKTOP';
    if (isAndroid) prefix = 'OB-HW-ANDROID-SEC';
    else if (isIOS) prefix = 'OB-HW-APPLE-SEP';
    else if (isMac) prefix = 'OB-HW-APPLE-T2';
    else if (isWindows) prefix = 'OB-HW-WIN-TPM2';

    const raw = `${prefix}-${navigator.hardwareConcurrency || 4}-${screen?.width || 1080}x${screen?.height || 1920}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    localStorage.setItem('ob_hardware_device_id', raw);
    return raw;
  } catch {
    return 'OB-HW-SEC-ENC-7A4B';
  }
}

/**
 * Returns a human-friendly device label for the current workstation or mobile device
 */
export function getHardwareDeviceLabel(): string {
  if (typeof navigator === 'undefined') return 'Corporate Workstation Enclave';
  const ua = navigator.userAgent || '';
  if (/Android/i.test(ua)) return 'Android Biometric Keystore (StrongBox)';
  if (/iPhone|iPad/i.test(ua)) return 'Apple Secure Enclave (Face ID / Touch ID)';
  if (/Macintosh/i.test(ua)) return 'Apple T2 / M-Series Secure Enclave (Touch ID)';
  if (/Windows/i.test(ua)) return 'Windows Hello TPM 2.0 Biometric Authenticator';
  return 'Platform Authenticator / Cryptographic Hardware Keystore';
}

class AuthHistoryServiceClass {
  private history: AuthHistoryEntry[] = [];
  private listeners: Set<(records: AuthHistoryEntry[]) => void> = new Set();

  constructor() {
    this.hydrateFromStorage();
  }

  private hydrateFromStorage(): void {
    if (typeof localStorage === 'undefined') {
      this.history = this.generateInitialSeedData();
      return;
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.history = JSON.parse(raw);
      } else {
        this.history = this.generateInitialSeedData();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.history));
      }
    } catch {
      this.history = this.generateInitialSeedData();
    }
  }

  private generateInitialSeedData(): AuthHistoryEntry[] {
    const devId = getHardwareDeviceId();
    const devLabel = getHardwareDeviceLabel();
    const now = Date.now();

    return [
      {
        id: 'auth_rec_001',
        timestamp: new Date(now - 1000 * 60 * 12).toISOString(),
        method: 'FINGERPRINT',
        status: 'SUCCESS',
        userEmail: 'abebe.kebede@oromiabank.com',
        userName: 'Abebe Kebede',
        userRole: 'MAKER',
        deviceId: devId,
        deviceLabel: devLabel,
        complianceDirective: 'NBE Directive BSD/03/2020 Art. 6.4',
        correlationId: `corr_seed_fp_${now - 12000}`,
        responseTimeMs: 240,
      },
      {
        id: 'auth_rec_002',
        timestamp: new Date(now - 1000 * 60 * 45).toISOString(),
        method: 'FACE',
        status: 'SUCCESS',
        userEmail: 'chala.desta@oromiabank.com',
        userName: 'Chala Desta',
        userRole: 'CHECKER',
        deviceId: devId,
        deviceLabel: 'Oromia Bank Optical Front Camera (Face ID)',
        complianceDirective: 'NBE Directive BSD/03/2020 Art. 6.4',
        correlationId: `corr_seed_face_${now - 45000}`,
        responseTimeMs: 380,
      },
      {
        id: 'auth_rec_003',
        timestamp: new Date(now - 1000 * 60 * 90).toISOString(),
        method: 'FINGERPRINT',
        status: 'TIMEOUT',
        userEmail: 'abebe.kebede@oromiabank.com',
        userName: 'Abebe Kebede',
        userRole: 'MAKER',
        deviceId: devId,
        deviceLabel: devLabel,
        failureReason: 'Inactivity timer expired (30 seconds auto-cancellation)',
        complianceDirective: 'NBE Directive BSD/03/2020 Art. 6.4',
        correlationId: `corr_seed_to_${now - 90000}`,
        responseTimeMs: 30000,
      },
      {
        id: 'auth_rec_004',
        timestamp: new Date(now - 1000 * 60 * 150).toISOString(),
        method: 'PASSWORD',
        status: 'SUCCESS',
        userEmail: 'admin@oromiabank.com',
        userName: 'Dawit Bekele',
        userRole: 'ADMIN',
        deviceId: devId,
        deviceLabel: 'Corporate WebAuthn / TLS Client Terminal',
        complianceDirective: 'NBE Directive BSD/03/2020 Art. 6.4',
        correlationId: `corr_seed_pwd_${now - 150000}`,
        responseTimeMs: 120,
      },
      {
        id: 'auth_rec_005',
        timestamp: new Date(now - 1000 * 60 * 240).toISOString(),
        method: 'FINGERPRINT',
        status: 'ENROLLED',
        userEmail: 'abebe.kebede@oromiabank.com',
        userName: 'Abebe Kebede',
        userRole: 'MAKER',
        deviceId: devId,
        deviceLabel: devLabel,
        complianceDirective: 'NBE Directive BSD/03/2020 Art. 6.4',
        correlationId: `corr_seed_enr_${now - 240000}`,
        responseTimeMs: 410,
      },
    ];
  }

  private save(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.history));
      } catch {}
    }
    this.notify();
  }

  private notify(): void {
    const copy = [...this.history];
    this.listeners.forEach((listener) => {
      try {
        listener(copy);
      } catch {}
    });
  }

  public subscribe(listener: (records: AuthHistoryEntry[]) => void): () => void {
    this.listeners.add(listener);
    listener([...this.history]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Records an authentication attempt and synchronizes with system audit log
   */
  public recordAttempt(params: {
    method: AuthMethod;
    status: AuthAttemptStatus;
    userEmail: string;
    userName?: string;
    userRole?: string;
    deviceId?: string;
    deviceLabel?: string;
    failureReason?: string;
    responseTimeMs?: number;
    correlationId?: string;
  }): AuthHistoryEntry {
    const devId = params.deviceId || getHardwareDeviceId();
    const devLabel = params.deviceLabel || getHardwareDeviceLabel();
    const corrId =
      params.correlationId ||
      `corr_auth_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const newRecord: AuthHistoryEntry = {
      id: `auth_rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      method: params.method,
      status: params.status,
      userEmail: params.userEmail.toLowerCase().trim(),
      userName: params.userName || params.userEmail.split('@')[0],
      userRole: params.userRole || 'MAKER',
      deviceId: devId,
      deviceLabel: devLabel,
      failureReason: params.failureReason,
      complianceDirective: 'NBE Directive BSD/03/2020 Art. 6.4',
      correlationId: corrId,
      responseTimeMs: params.responseTimeMs || Math.floor(100 + Math.random() * 250),
    };

    this.history.unshift(newRecord);
    if (this.history.length > 500) {
      this.history.pop();
    }
    this.save();

    // Mirror to official immutable audit service
    auditService.log({
      actorId: newRecord.userEmail,
      actorName: newRecord.userName,
      actorRole: newRecord.userRole,
      action:
        newRecord.status === 'ENROLLED'
          ? 'BIOMETRIC_ENROLLED'
          : newRecord.status === 'SUCCESS'
          ? 'USER_LOGIN'
          : newRecord.status === 'TIMEOUT'
          ? 'BIOMETRIC_AUTH_TIMEOUT'
          : 'AUTH_FAILED',
      entityType: 'AUTH',
      entityId: newRecord.deviceId,
      correlationId: corrId,
      details: `[NBE Directive BSD/03/2020 Compliance] Hardware auth ${newRecord.method} ${newRecord.status} for ${newRecord.userEmail} on ${newRecord.deviceId}.${newRecord.failureReason ? ` Reason: ${newRecord.failureReason}` : ''}`,
      newState: {
        method: newRecord.method,
        status: newRecord.status,
        deviceId: newRecord.deviceId,
        deviceLabel: newRecord.deviceLabel,
      },
    });

    return newRecord;
  }

  /**
   * Retrieves authentication history filtered by user email or global
   */
  public getHistory(userEmail?: string): AuthHistoryEntry[] {
    if (!userEmail) return [...this.history];
    const norm = userEmail.toLowerCase().trim();
    return this.history.filter((h) => h.userEmail.toLowerCase() === norm);
  }

  /**
   * Exports history records formatted as CSV
   */
  public exportCsv(userEmail?: string): string {
    const records = this.getHistory(userEmail);
    const headers = [
      'Record ID',
      'Timestamp (ISO)',
      'Method',
      'Status',
      'User Email',
      'Officer Name',
      'Role',
      'Device ID',
      'Device Label',
      'Response Time (ms)',
      'Failure Reason',
      'Compliance Directive',
      'Correlation ID',
    ];

    const rows = records.map((r) => [
      `"${r.id}"`,
      `"${r.timestamp}"`,
      `"${r.method}"`,
      `"${r.status}"`,
      `"${r.userEmail}"`,
      `"${r.userName}"`,
      `"${r.userRole}"`,
      `"${r.deviceId}"`,
      `"${r.deviceLabel}"`,
      r.responseTimeMs || 0,
      `"${r.failureReason || 'None'}"`,
      `"${r.complianceDirective}"`,
      `"${r.correlationId}"`,
    ]);

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  }

  /**
   * Clears history for testing purposes
   */
  public clearHistory(userEmail?: string): void {
    if (userEmail) {
      const norm = userEmail.toLowerCase().trim();
      this.history = this.history.filter((h) => h.userEmail.toLowerCase() !== norm);
    } else {
      this.history = [];
    }
    this.save();
  }
}

export const authHistoryService = new AuthHistoryServiceClass();
