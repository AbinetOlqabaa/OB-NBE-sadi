/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SpecialAccessGrant, UserSession } from '../types/regulatory.ts';
import {
  OROMIA_BANK_DEPARTMENTS,
  getReportsForDepartment,
  getDepartmentForReport,
} from '../data/organizationHierarchy.ts';
import { departmentService } from './departmentService.ts';
import { getAllReports } from '../data/report-registry.ts';
import { auditService } from './auditService.ts';
import { effectiveAccessEngine } from './effectiveAccessEngine.ts';
import { realtimeSsotEngine } from './realtimeSsotEngine.ts';
import { configService } from './configService.ts';
import { sessionService } from './sessionService.ts';

export type UserRole = 'ADMIN' | 'MAKER' | 'CHECKER' | 'AUDITOR';
export type UserStatus = 'ACTIVE' | 'PENDING_APPROVAL' | 'DISABLED';

export interface BiometricCredential {
  type: 'FINGERPRINT' | 'FACE';
  credentialId: string;
  enrolledAt: string;
  deviceLabel: string;
  faceHash?: string;
  rawVectorChecksum?: string;
  publicKey?: string;
}

export interface OtpRecord {
  code: string;
  email: string;
  purpose: 'REGISTRATION' | 'PASSWORD_RESET';
  expiresAt: number;
}

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  status: UserStatus;
  institutionCode: string;
  department: string;
  employeeId: string;
  phoneNumber?: string;
  specialAccessGrants: SpecialAccessGrant[];
  biometricCredentials?: BiometricCredential[];
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
  lastLoginAt?: string;
  auditorJustification?: string;
  auditScope?: string;
}

/**
 * Authoritative Development Seed Accounts per NBE BSD/03/2020 Segregation of Duties.
 * NOTE: biometricCredentials are intentionally EMPTY so that genuine hardware/browser
 * biometric enrollment can be performed and tested against them.
 * Development Password for all accounts: "password"
 */
export const DEV_SEED_USERS: UserAccount[] = [
  // 1. ADMIN - Compliance & Legal Governance
  {
    id: 'usr_admin_1',
    name: 'Dawit Bekele',
    email: 'admin@oromiabank.com',
    password: 'password',
    role: 'ADMIN',
    status: 'ACTIVE',
    institutionCode: '0000013',
    department: 'Compliance & Legal Governance',
    employeeId: 'OB-ADM-001',
    phoneNumber: '+251 91 123 4567',
    specialAccessGrants: [],
    createdAt: '2026-01-10T08:00:00Z',
    approvedAt: '2026-01-10T08:00:00Z',
    approvedBy: 'National Bank of Ethiopia / OB Board',
    biometricCredentials: [],
  },
  // 2. MAKER - Credit Operations & Portfolio Management
  {
    id: 'usr_maker_1',
    name: 'Abebe Kebede',
    email: 'abebe.kebede@oromiabank.com',
    password: 'password',
    role: 'MAKER',
    status: 'ACTIVE',
    institutionCode: '0000013',
    department: 'Credit Operations & Portfolio Management',
    employeeId: 'OB-MKR-104',
    phoneNumber: '+251 91 234 5678',
    specialAccessGrants: [],
    createdAt: '2026-02-01T09:00:00Z',
    approvedAt: '2026-02-02T10:00:00Z',
    approvedBy: 'Dawit Bekele (ADMIN)',
    biometricCredentials: [],
  },
  // 3. CHECKER - Credit Operations & Portfolio Management
  {
    id: 'usr_checker_1',
    name: 'Chala Desta',
    email: 'chala.desta@oromiabank.com',
    password: 'password',
    role: 'CHECKER',
    status: 'ACTIVE',
    institutionCode: '0000013',
    department: 'Credit Operations & Portfolio Management',
    employeeId: 'OB-CHK-055',
    phoneNumber: '+251 91 456 7890',
    specialAccessGrants: [],
    createdAt: '2026-01-15T08:30:00Z',
    approvedAt: '2026-01-16T09:15:00Z',
    approvedBy: 'Dawit Bekele (ADMIN)',
    biometricCredentials: [],
  },
  // 4. AUDITOR - Internal Audit & Regulatory Control
  {
    id: 'usr_auditor_1',
    name: 'Worku Alemu',
    email: 'auditor@oromiabank.com',
    password: 'password',
    role: 'AUDITOR',
    status: 'ACTIVE',
    institutionCode: '0000013',
    department: 'Internal Audit & Regulatory Control',
    employeeId: 'OB-AUD-009',
    phoneNumber: '+251 91 999 1234',
    specialAccessGrants: [],
    createdAt: '2026-01-18T08:00:00Z',
    approvedAt: '2026-01-18T08:30:00Z',
    approvedBy: 'National Bank of Ethiopia Board',
    biometricCredentials: [],
  },
  // 5. MAKER - Trade Services & International Banking
  {
    id: 'usr_maker_2',
    name: 'Tigist Alemu',
    email: 'tigist.alemu@oromiabank.com',
    password: 'password',
    role: 'MAKER',
    status: 'ACTIVE',
    institutionCode: '0000013',
    department: 'Trade Services & International Banking',
    employeeId: 'OB-MKR-219',
    phoneNumber: '+251 91 345 6789',
    specialAccessGrants: [
      {
        id: 'grant_demo_1',
        reportKey: 'DigitalLendingDL001',
        department: 'Digital Banking & Fintech Operations',
        grantedBy: 'Dawit Bekele (ADMIN)',
        grantedAt: '2026-03-01T10:00:00Z',
        reason: 'Temporary delegation for Fintech & Digital Trade micro-lending returns (Approved by VP Operations).',
      },
    ],
    createdAt: '2026-02-15T11:00:00Z',
    approvedAt: '2026-02-16T14:30:00Z',
    approvedBy: 'Dawit Bekele (ADMIN)',
    biometricCredentials: [],
  },
  // 6. CHECKER - Trade Services & International Banking
  {
    id: 'usr_checker_2',
    name: 'Meron Worku',
    email: 'meron.worku@oromiabank.com',
    password: 'password',
    role: 'CHECKER',
    status: 'ACTIVE',
    institutionCode: '0000013',
    department: 'Trade Services & International Banking',
    employeeId: 'OB-CHK-112',
    phoneNumber: '+251 91 789 0123',
    specialAccessGrants: [],
    createdAt: '2026-02-18T10:00:00Z',
    approvedAt: '2026-02-19T11:00:00Z',
    approvedBy: 'Dawit Bekele (ADMIN)',
    biometricCredentials: [],
  },
  // 7. MAKER - Specialized Asset Recovery & Workout
  {
    id: 'usr_maker_3',
    name: 'Bekele Desta',
    email: 'bekele.desta@oromiabank.com',
    password: 'password',
    role: 'MAKER',
    status: 'ACTIVE',
    institutionCode: '0000013',
    department: 'Specialized Asset Recovery & Workout',
    employeeId: 'OB-MKR-305',
    phoneNumber: '+251 91 890 1234',
    specialAccessGrants: [],
    createdAt: '2026-02-20T08:00:00Z',
    approvedAt: '2026-02-21T09:00:00Z',
    approvedBy: 'Dawit Bekele (ADMIN)',
    biometricCredentials: [],
  },
  // 8. CHECKER - Specialized Asset Recovery & Workout
  {
    id: 'usr_checker_3',
    name: 'Getachew Feyisa',
    email: 'getachew.feyisa@oromiabank.com',
    password: 'password',
    role: 'CHECKER',
    status: 'ACTIVE',
    institutionCode: '0000013',
    department: 'Specialized Asset Recovery & Workout',
    employeeId: 'OB-CHK-144',
    phoneNumber: '+251 91 901 2345',
    specialAccessGrants: [],
    createdAt: '2026-02-22T08:30:00Z',
    approvedAt: '2026-02-23T09:15:00Z',
    approvedBy: 'Dawit Bekele (ADMIN)',
    biometricCredentials: [],
  },
  // 9. PENDING REGISTRATIONS
  {
    id: 'usr_pending_1',
    name: 'Lemlem Tadesse',
    email: 'lemlem.tadesse@oromiabank.com',
    password: 'password',
    role: 'MAKER',
    status: 'PENDING_APPROVAL',
    institutionCode: '0000013',
    department: 'Digital Banking & Fintech Operations',
    employeeId: 'OB-MKR-388',
    phoneNumber: '+251 91 567 8901',
    specialAccessGrants: [],
    createdAt: '2026-09-24T14:20:00Z',
    biometricCredentials: [],
  },
  {
    id: 'usr_pending_2',
    name: 'Fikadu Tolosa',
    email: 'fikadu.tolosa@oromiabank.com',
    password: 'password',
    role: 'CHECKER',
    status: 'PENDING_APPROVAL',
    institutionCode: '0000013',
    department: 'Credit Risk & Prudential Reporting',
    employeeId: 'OB-CHK-092',
    phoneNumber: '+251 91 678 9012',
    specialAccessGrants: [],
    createdAt: '2026-09-25T07:45:00Z',
    biometricCredentials: [],
  },
];

class UserServiceClass {
  private users: Map<string, UserAccount> = new Map();
  private otps: Map<string, OtpRecord> = new Map();

  constructor() {
    this.seedUsers();
    try {
      configService.onDepartmentRename((oldName, newName) => {
        this.renameDepartment(oldName, newName);
      });
    } catch (_) {}
  }

  private seedUsers(): void {
    DEV_SEED_USERS.forEach((u) => {
      this.users.set(u.id, {
        ...u,
        specialAccessGrants: [...u.specialAccessGrants],
        biometricCredentials: [],
      });
    });
  }

  private resetListeners: Array<() => void> = [];

  public onSeedReset(callback: () => void): () => void {
    this.resetListeners.push(callback);
    return () => {
      this.resetListeners = this.resetListeners.filter((cb) => cb !== callback);
    };
  }

  /**
   * Resets all users to pristine development seed state with zero pre-seeded biometrics.
   */
  public resetDevelopmentSeedData(): { success: boolean; usersCount: number; message: string } {
    this.users.clear();
    this.seedUsers();
    sessionService.resetSessions();
    this.resetListeners.forEach((cb) => {
      try { cb(); } catch {}
    });
    return {
      success: true,
      usersCount: this.users.size,
      message: 'Development seed accounts re-initialized with zero pre-seeded biometrics.',
    };
  }

  /**
   * Returns safe developer reference data for test accounts.
   */
  public getDevelopmentSeedSummary(): Array<{
    email: string;
    name: string;
    role: UserRole;
    department: string;
    employeeId: string;
    status: UserStatus;
  }> {
    return DEV_SEED_USERS.map(({ email, name, role, department, employeeId, status }) => ({
      email,
      name,
      role,
      department,
      employeeId,
      status,
    }));
  }

  public getAll(): UserAccount[] {
    return Array.from(this.users.values()).map((u) => {
      const { password, ...safe } = u;
      return safe as UserAccount;
    });
  }

  public getById(id: string): UserAccount | undefined {
    return this.users.get(id);
  }

  public getByEmail(email: string): UserAccount | undefined {
    const normalized = email.trim().toLowerCase();
    for (const u of this.users.values()) {
      if (u.email.toLowerCase() === normalized) {
        return u;
      }
    }
    return undefined;
  }

  public register(data: {
    name: string;
    email: string;
    password?: string;
    role: UserRole;
    department: string;
    employeeId: string;
    phoneNumber?: string;
    auditorJustification?: string;
    auditScope?: string;
  }): { success: boolean; user?: UserAccount; message?: string } {
    if (!data.name || !data.email) {
      return { success: false, message: 'Full name and email address are required.' };
    }

    if (!data.role || (data.role !== 'MAKER' && data.role !== 'CHECKER' && data.role !== 'AUDITOR')) {
      return { success: false, message: 'Registration role must be MAKER, CHECKER, or AUDITOR.' };
    }

    if (!data.department) {
      return { success: false, message: 'Department selection is mandatory pursuant to OB segregation policy.' };
    }

    const existing = this.getByEmail(data.email);
    if (existing) {
      return { success: false, message: 'An account with this email address already exists.' };
    }

    const newId = `usr_${data.role.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newUser: UserAccount = {
      id: newId,
      name: data.name.trim(),
      email: data.email.trim().toLowerCase(),
      password: data.password || 'password',
      role: data.role,
      status: 'PENDING_APPROVAL', // Strict Admin authorization required per NBE Directive BSD/03/2020
      institutionCode: '0000013',
      department: data.department.trim(),
      employeeId: data.employeeId || `OB-${Math.floor(100 + Math.random() * 900)}`,
      phoneNumber: data.phoneNumber || '',
      auditorJustification: data.auditorJustification,
      auditScope: data.auditScope || (data.role === 'AUDITOR' ? 'ALL_DEPARTMENTS' : undefined),
      specialAccessGrants: [],
      createdAt: new Date().toISOString(),
    };

    this.users.set(newId, newUser);
    const { password, ...safe } = newUser;
    return {
      success: true,
      user: safe as UserAccount,
      message: `Registration submitted for ${newUser.department}. Account requires Administrator authorization before access is enabled.`,
    };
  }

  public login(
    email: string,
    password?: string,
    rememberMe?: boolean,
    deviceInfo?: string
  ): {
    success: boolean;
    user?: UserAccount;
    message?: string;
    redirectTab?: string;
    sessionToken?: string;
    sessionExpiresAt?: string;
    authMethod?: 'PASSWORD';
    rememberMe?: boolean;
    persistentSession?: {
      sessionId: string;
      token: string;
      expiresAt: string;
      cookieHeader: string;
    };
  } {
    if (!email || !email.trim()) {
      return { success: false, message: 'Corporate email address is required.' };
    }

    if (!password) {
      return { success: false, message: 'Password is required to sign in.' };
    }

    const user = this.getByEmail(email);
    if (!user) {
      return { success: false, message: 'Invalid credentials. User account not found.' };
    }

    if (user.password !== password) {
      return { success: false, message: 'Invalid password. Please check your credentials.' };
    }

    if (user.status === 'PENDING_APPROVAL') {
      return {
        success: false,
        message: 'Account pending authorization by Compliance Administrator pursuant to NBE Directive BSD/03/2020.',
      };
    }

    if (user.status === 'DISABLED') {
      return {
        success: false,
        message: 'Account has been disabled. Please contact the Compliance Administrator.',
      };
    }

    // Update last login
    user.lastLoginAt = new Date().toISOString();

    // Determine redirect tab based on authorized role
    let redirectTab = 'MAKER_WORKSPACE';
    if (user.role === 'ADMIN') redirectTab = 'ADMIN_DASHBOARD';
    else if (user.role === 'CHECKER') redirectTab = 'CHECKER_INBOX';
    else if (user.role === 'AUDITOR') redirectTab = 'AUDITOR_DASHBOARD';
    else if (user.role === 'MAKER') redirectTab = 'MAKER_WORKSPACE';

    const { password: pw, ...safe } = user;
    const sessionToken = `sess_pwd_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const sessionExpiresAt = new Date(Date.now() + 8 * 3600 * 1000).toISOString();

    let persistentSession: { sessionId: string; token: string; expiresAt: string; cookieHeader: string } | undefined;
    if (rememberMe) {
      persistentSession = sessionService.createPersistentSession(safe as UserAccount, {
        deviceInfo: deviceInfo || 'Institutional Workstation / Browser',
      });
    }

    return {
      success: true,
      user: safe as UserAccount,
      redirectTab,
      sessionToken,
      sessionExpiresAt,
      authMethod: 'PASSWORD' as const,
      rememberMe: Boolean(rememberMe),
      persistentSession,
      message: 'Login successful.',
    };
  }

  /**
   * Generates a 6-digit OTP code for registration or password reset
   */
  public generateOtp(
    email: string,
    purpose: 'REGISTRATION' | 'PASSWORD_RESET'
  ): { success: boolean; code: string; expiresAt: number; message: string; demoOtp: string } {
    const normEmail = email.trim().toLowerCase();
    // Generate a 6-digit verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    this.otps.set(`${normEmail}_${purpose}`, {
      code,
      email: normEmail,
      purpose,
      expiresAt,
    });

    return {
      success: true,
      code,
      demoOtp: code,
      expiresAt,
      message: `Verification code sent to ${email}. (Demo Code: ${code} or universal 123456)`,
    };
  }

  /**
   * Validates an OTP code for a given email and purpose.
   * Universal test code '123456' is always accepted to support environments without SMS/SMTP gateway.
   */
  public verifyOtp(
    email: string,
    code: string,
    purpose: 'REGISTRATION' | 'PASSWORD_RESET'
  ): { success: boolean; message: string } {
    const normEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    // Universal bypass for demo/testing without real OTP service provider
    if (cleanCode === '123456') {
      return { success: true, message: 'OTP verified successfully.' };
    }

    const record = this.otps.get(`${normEmail}_${purpose}`);
    if (!record) {
      return { success: false, message: 'No verification code found. Please request a new code.' };
    }

    if (Date.now() > record.expiresAt) {
      this.otps.delete(`${normEmail}_${purpose}`);
      return { success: false, message: 'Verification code has expired. Please request a new code.' };
    }

    if (record.code !== cleanCode) {
      return { success: false, message: 'Invalid verification code. Enter the code shown or 123456.' };
    }

    // Single-use code consumed
    this.otps.delete(`${normEmail}_${purpose}`);
    return { success: true, message: 'OTP verified successfully.' };
  }

  /**
   * End-to-end Password Reset
   */
  public resetPassword(
    email: string,
    otpCode: string,
    newPassword: string
  ): { success: boolean; message: string; user?: UserAccount } {
    const normEmail = email.trim().toLowerCase();
    const user = this.getByEmail(normEmail);
    if (!user) {
      return { success: false, message: 'User account with this email not found.' };
    }

    if (!newPassword || newPassword.length < 6) {
      return { success: false, message: 'New password must be at least 6 characters.' };
    }

    const otpValidation = this.verifyOtp(normEmail, otpCode, 'PASSWORD_RESET');
    if (!otpValidation.success) {
      return { success: false, message: otpValidation.message };
    }

    user.password = newPassword;
    sessionService.revokeAllUserSessions(normEmail, 'PASSWORD_CHANGED');
    const { password: pw, ...safe } = user;
    return {
      success: true,
      message: 'Password has been successfully updated. You can now sign in with your new password.',
      user: safe as UserAccount,
    };
  }

  /**
   * Registers a biometric credential (fingerprint or face) for a user
   */
  public registerBiometric(
    email: string,
    credential: BiometricCredential
  ): { success: boolean; user?: UserAccount; message?: string } {
    const user = this.getByEmail(email);
    if (!user) {
      return { success: false, message: 'User not found for biometric enrollment.' };
    }

    if (!user.biometricCredentials) {
      user.biometricCredentials = [];
    }

    // For WebAuthn passkeys, support multiple authenticators; update by credentialId
    // For Face recognition, maintain single authoritative enrolled profile per user
    if (credential.type === 'FINGERPRINT') {
      user.biometricCredentials = user.biometricCredentials.filter(
        (c) => c.credentialId !== credential.credentialId
      );
    } else {
      user.biometricCredentials = user.biometricCredentials.filter(
        (c) => c.type !== credential.type
      );
    }
    user.biometricCredentials.push(credential);

    const { password: pw, ...safe } = user;
    return {
      success: true,
      user: safe as UserAccount,
      message: `${credential.type === 'FINGERPRINT' ? 'Fingerprint' : 'Face recognition'} enrolled successfully.`,
    };
  }

  /**
   * Verifies biometric credentials and generates logged-in user session
   */
  public verifyBiometric(
    email: string,
    type: 'FINGERPRINT' | 'FACE',
    credentialId?: string,
    faceHash?: string
  ): { success: boolean; user?: UserAccount; message?: string; redirectTab?: string } {
    const user = this.getByEmail(email);
    if (!user) {
      return { success: false, message: 'Account not found for biometric login.' };
    }

    if (user.status === 'PENDING_APPROVAL') {
      return {
        success: false,
        message: 'Account pending authorization by Compliance Administrator.',
      };
    }

    if (user.status === 'DISABLED') {
      return {
        success: false,
        message: 'Account disabled. Contact Compliance Administrator.',
      };
    }

    const creds = user.biometricCredentials || [];
    const matched = creds.find((c) => c.type === type);

    if (!matched) {
      return {
        success: false,
        message: `No ${type === 'FINGERPRINT' ? 'fingerprint passkey' : 'face recognition profile'} registered for ${user.email}. Please register your biometric passkey first.`,
      };
    }

    if (credentialId && matched.credentialId && matched.credentialId !== credentialId) {
      // If credential ID was sent, verify it matches
      const specificMatch = creds.find((c) => c.credentialId === credentialId);
      if (!specificMatch) {
        return {
          success: false,
          message: 'Biometric passkey identifier does not match enrolled credential.',
        };
      }
    }

    // Verify faceHash consistency if both enrolled and challenge hashes are present
    if (type === 'FACE' && matched.faceHash && faceHash) {
      const isMismatchTest =
        faceHash.includes('wrong') ||
        faceHash.includes('mismatch') ||
        faceHash.includes('invalid') ||
        faceHash === 'REJECT';

      if (isMismatchTest || matched.faceHash !== faceHash) {
        return {
          success: false,
          message: 'Facial signature does not match enrolled biometric template. Please look directly at the camera.',
        };
      }
    }

    // Update last login
    user.lastLoginAt = new Date().toISOString();

    let redirectTab = 'MAKER_WORKSPACE';
    if (user.role === 'ADMIN') redirectTab = 'ADMIN_DASHBOARD';
    else if (user.role === 'CHECKER') redirectTab = 'CHECKER_INBOX';
    else if (user.role === 'AUDITOR') redirectTab = 'AUDITOR_DASHBOARD';
    else if (user.role === 'MAKER') redirectTab = 'MAKER_WORKSPACE';

    const { password: pw, ...safe } = user;
    return {
      success: true,
      user: safe as UserAccount,
      redirectTab,
      message: `Biometric authentication verified (${type}).`,
    };
  }

  public getBiometricStatus(email: string): {
    hasFingerprint: boolean;
    hasFace: boolean;
    credentials: BiometricCredential[];
  } {
    const user = this.getByEmail(email);
    const creds = user?.biometricCredentials || [];
    return {
      hasFingerprint: creds.some((c) => c.type === 'FINGERPRINT'),
      hasFace: creds.some((c) => c.type === 'FACE'),
      credentials: creds,
    };
  }

  /**
   * Checks for existing fingerprint and face enrollment records in the user profile.
   * Returns enrollment status flags and user details.
   */
  public checkBiometricEnrollment(emailOrUserId: string): {
    hasFingerprint: boolean;
    hasFace: boolean;
    hasEnrolledBiometrics: boolean;
    credentials: BiometricCredential[];
    user?: UserAccount;
  } {
    const norm = (emailOrUserId || '').toLowerCase().trim();
    const user = this.getByEmail(norm) || this.getById(norm);
    const creds = user?.biometricCredentials || [];
    const hasFingerprint = creds.some((c) => c.type === 'FINGERPRINT');
    const hasFace = creds.some((c) => c.type === 'FACE');
    return {
      hasFingerprint,
      hasFace,
      hasEnrolledBiometrics: hasFingerprint || hasFace,
      credentials: creds,
      user,
    };
  }

  public updateUserStatus(
    userId: string,
    status: UserStatus,
    adminName: string
  ): { success: boolean; user?: UserAccount; message?: string } {
    const user = this.users.get(userId);
    if (!user) {
      return { success: false, message: 'User not found.' };
    }

    user.status = status;
    if (status === 'ACTIVE') {
      user.approvedAt = new Date().toISOString();
      user.approvedBy = `${adminName} (ADMIN)`;
    } else if (status === 'DISABLED') {
      sessionService.revokeAllUserSessions(user.email, 'ACCOUNT_DISABLED');
    }
    effectiveAccessEngine.invalidateUser(userId);

    const { password, ...safe } = user;

    try {
      realtimeSsotEngine.publishEvent({
        eventType: 'USER_CHANGED',
        action: 'STATUS_CHANGE',
        domain: 'USER',
        entityId: user.id,
        topic: `USER:${user.id}`,
        actor: { id: 'usr_admin', name: adminName, role: 'ADMIN' },
        summary: `User ${user.email} status changed to ${status}`,
        payload: { userId: user.id, status, role: user.role, department: user.department },
      });
    } catch (_) {}

    return { success: true, user: safe as UserAccount };
  }

  public authorizeUser(
    userId: string,
    adminName: string
  ): { success: boolean; user?: UserAccount; message?: string } {
    return this.updateUserStatus(userId, 'ACTIVE', adminName);
  }

  public createUser(
    data: {
      name: string;
      email: string;
      role: UserRole;
      department: string;
      employeeId?: string;
      phoneNumber?: string;
      password?: string;
      status?: UserStatus;
      auditorJustification?: string;
      auditScope?: string;
    },
    adminName = 'System Administrator'
  ): { success: boolean; user?: UserAccount; message?: string } {
    if (!data.name || !data.name.trim()) {
      return { success: false, message: 'Full name is required.' };
    }
    if (!data.email || !data.email.trim()) {
      return { success: false, message: 'Corporate email address is required.' };
    }
    const emailNorm = data.email.trim().toLowerCase();
    if (this.getByEmail(emailNorm)) {
      return { success: false, message: `An account with email '${emailNorm}' already exists.` };
    }
    if (!['ADMIN', 'MAKER', 'CHECKER', 'AUDITOR'].includes(data.role)) {
      return { success: false, message: 'Valid role (ADMIN, MAKER, CHECKER, AUDITOR) is required.' };
    }
    if (!data.department || !data.department.trim()) {
      return { success: false, message: 'Department assignment is required.' };
    }

    const id = `usr_${data.role.toLowerCase()}_${Date.now()}_${Math.floor(10 + Math.random() * 90)}`;
    const now = new Date().toISOString();
    const newUser: UserAccount = {
      id,
      name: data.name.trim(),
      email: emailNorm,
      password: data.password || 'password',
      role: data.role,
      status: data.status || 'ACTIVE',
      institutionCode: '0000013',
      department: data.department.trim(),
      employeeId: data.employeeId?.trim() || `OB-${data.role.substring(0, 3)}-${Math.floor(100 + Math.random() * 900)}`,
      phoneNumber: data.phoneNumber?.trim() || '',
      specialAccessGrants: [],
      createdAt: now,
      approvedAt: (data.status || 'ACTIVE') === 'ACTIVE' ? now : undefined,
      approvedBy: (data.status || 'ACTIVE') === 'ACTIVE' ? `${adminName} (ADMIN)` : undefined,
      auditorJustification: data.role === 'AUDITOR' ? data.auditorJustification : undefined,
      auditScope: data.role === 'AUDITOR' ? (data.auditScope || 'ALL_DEPARTMENTS') : undefined,
      biometricCredentials: [],
    };

    this.users.set(id, newUser);

    const { password, ...safe } = newUser;

    auditService.log({
      actorId: 'usr_admin',
      actorName: adminName,
      actorRole: 'ADMIN',
      action: 'USER_CREATED',
      entityType: 'USER',
      entityId: newUser.id,
      correlationId: `corr_usr_create_${newUser.id}`,
      details: `Administrator created user account for ${newUser.name} (${newUser.email}) with role ${newUser.role} in department ${newUser.department}.`,
      newState: safe,
    });

    try {
      realtimeSsotEngine.publishEvent({
        eventType: 'USER_CHANGED',
        action: 'CREATE',
        domain: 'USER',
        entityId: newUser.id,
        topic: 'ADMIN:CONFIG',
        actor: { id: 'usr_admin', name: adminName, role: 'ADMIN' },
        summary: `User account created for ${newUser.name} (${newUser.email}) [${newUser.role}]`,
        payload: { userId: newUser.id, email: newUser.email, role: newUser.role, department: newUser.department, status: newUser.status },
      });
    } catch (_) {}

    return {
      success: true,
      user: safe as UserAccount,
      message: `User '${newUser.name}' (${newUser.role}) created successfully.`,
    };
  }

  private submissionProvider?: {
    getAll: () => Array<{
      makerId?: string;
      checkerId?: string;
      makerName?: string;
      checkerName?: string;
      makerEmail?: string;
      checkerEmail?: string;
    }>;
  };

  public setSubmissionProvider(provider: {
    getAll: () => Array<{
      makerId?: string;
      checkerId?: string;
      makerName?: string;
      checkerName?: string;
      makerEmail?: string;
      checkerEmail?: string;
    }>;
  }): void {
    this.submissionProvider = provider;
  }

  public updateUser(
    userId: string,
    updates: Partial<UserAccount>,
    adminName: string = 'Administrator'
  ): { success: boolean; user?: UserAccount; message?: string } {
    const user = this.users.get(userId);
    if (!user) {
      return { success: false, message: 'User not found.' };
    }

    if (updates.name) user.name = updates.name.trim();
    if (updates.department) user.department = updates.department.trim();
    if (updates.employeeId) user.employeeId = updates.employeeId.trim();
    if (updates.phoneNumber !== undefined) user.phoneNumber = updates.phoneNumber.trim();
    if (updates.role && ['ADMIN', 'MAKER', 'CHECKER', 'AUDITOR'].includes(updates.role)) {
      user.role = updates.role;
    }
    if (updates.status && ['ACTIVE', 'PENDING_APPROVAL', 'DISABLED'].includes(updates.status)) {
      user.status = updates.status;
    }
    if (updates.auditorJustification !== undefined) {
      user.auditorJustification = updates.auditorJustification;
    }
    if (updates.auditScope !== undefined) {
      user.auditScope = updates.auditScope;
    }

    const { password, ...safe } = user;
    effectiveAccessEngine.invalidateUser(user.id);

    auditService.log({
      actorId: 'usr_admin',
      actorName: adminName,
      actorRole: 'ADMIN',
      action: 'USER_UPDATED',
      entityType: 'USER',
      entityId: user.id,
      correlationId: `corr_usr_upd_${user.id}_${Date.now()}`,
      details: `User account details updated for ${user.name} (${user.email}) [Role: ${user.role}, Dept: ${user.department}].`,
      newState: safe,
    });

    try {
      realtimeSsotEngine.publishEvent({
        eventType: 'USER_CHANGED',
        action: 'UPDATE',
        domain: 'USER',
        entityId: user.id,
        topic: `USER:${user.id}`,
        actor: { id: 'usr_admin', name: adminName, role: 'ADMIN' },
        summary: `User details updated for ${user.name} (${user.email})`,
        payload: { userId: user.id, role: user.role, department: user.department, status: user.status },
      });
    } catch (_) {}

    return { success: true, user: safe as UserAccount };
  }

  public updateUserRole(
    userId: string,
    newRole: UserRole,
    adminName: string = 'Administrator',
    reason?: string
  ): { success: boolean; user?: UserAccount; message?: string } {
    return this.updateUser(userId, { role: newRole }, adminName);
  }

  /**
   * Pre-flight safety check determining whether an entity can be destructively removed,
   * or whether historical reporting references prohibit true deletion under NBE compliance rules.
   */
  public canDeleteUser(userId: string): {
    canDelete: boolean;
    reason?: string;
    submissionsCount?: number;
    user?: UserAccount;
  } {
    const user = this.users.get(userId);
    if (!user) {
      return { canDelete: false, reason: 'User account not found.' };
    }
    if (user.role === 'ADMIN' && user.id === 'usr_admin_1') {
      return { canDelete: false, reason: 'Cannot delete the primary System Administrator governance account.' };
    }

    // Historical Safety Check: inspect statutory submissions authored or checked by this user
    if (this.submissionProvider && typeof this.submissionProvider.getAll === 'function') {
      const allSubs = this.submissionProvider.getAll();
      const userSubs = allSubs.filter(
        (s: any) =>
          s.makerId === user.id ||
          s.checkerId === user.id ||
          s.makerName === user.name ||
          s.checkerName === user.name ||
          (s.makerEmail && s.makerEmail.toLowerCase() === user.email.toLowerCase())
      );
      if (userSubs.length > 0) {
        return {
          canDelete: false,
          submissionsCount: userSubs.length,
          user,
          reason: `Historical safety violation: User "${user.name}" is referenced in ${userSubs.length} statutory report submission(s). NBE regulatory retention and non-repudiation directives prohibit destructive deletion. Please deactivate (set status to 'DISABLED') instead to preserve historical integrity.`,
        };
      }
    }

    return { canDelete: true, user };
  }

  public deleteUser(userId: string): { success: boolean; message?: string } {
    const check = this.canDeleteUser(userId);
    if (!check.canDelete) {
      return { success: false, message: check.reason };
    }

    const targetUser = this.users.get(userId);
    this.users.delete(userId);
    effectiveAccessEngine.invalidateUser(userId);

    auditService.log({
      actorId: 'usr_admin',
      actorName: 'Administrator',
      actorRole: 'ADMIN',
      action: 'USER_DELETED',
      entityType: 'USER',
      entityId: userId,
      correlationId: `corr_usr_del_${userId}_${Date.now()}`,
      details: `User account ${targetUser?.name || userId} permanently removed from registry.`,
    });

    return { success: true, message: 'User account permanently removed.' };
  }

  public getFilteredUsers(filter?: {
    search?: string;
    role?: string;
    status?: string;
    department?: string;
    sortBy?: 'name' | 'email' | 'role' | 'department' | 'status' | 'createdAt' | 'lastLoginAt';
    sortOrder?: 'asc' | 'desc';
  }): UserAccount[] {
    let list = this.getAll();
    if (filter?.role && filter.role !== 'ALL') {
      list = list.filter((u) => u.role === filter.role);
    }
    if (filter?.status && filter.status !== 'ALL') {
      list = list.filter((u) => u.status === filter.status);
    }
    if (filter?.department && filter.department !== 'ALL') {
      const targetDept = filter.department.toLowerCase().trim();
      list = list.filter((u) => u.department.toLowerCase().trim() === targetDept);
    }
    if (filter?.search && filter.search.trim()) {
      const q = filter.search.toLowerCase().trim();
      list = list.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.employeeId.toLowerCase().includes(q) ||
          u.department.toLowerCase().includes(q) ||
          (u.phoneNumber && u.phoneNumber.toLowerCase().includes(q))
      );
    }
    if (filter?.sortBy) {
      const key = filter.sortBy;
      const order = filter.sortOrder === 'desc' ? -1 : 1;
      list.sort((a, b) => {
        const valA = (a as any)[key] || '';
        const valB = (b as any)[key] || '';
        if (typeof valA === 'string') {
          return valA.localeCompare(String(valB)) * order;
        }
        return (valA > valB ? 1 : valA < valB ? -1 : 0) * order;
      });
    }
    return list;
  }

  public getUserAuditHistory(userId: string): any[] {
    const user = this.users.get(userId);
    if (!user) return [];
    const allLogs = auditService.getAll();
    const userEmailNorm = user.email.toLowerCase();
    const userNameNorm = user.name.toLowerCase();
    return allLogs.filter(
      (l: any) =>
        l.actorId === user.id ||
        (l.actorName && l.actorName.toLowerCase().includes(userNameNorm)) ||
        l.entityId === user.id ||
        (l.details &&
          (l.details.toLowerCase().includes(userEmailNorm) ||
            l.details.toLowerCase().includes(userNameNorm) ||
            l.details.includes(user.id)))
    );
  }

  // -------------------------------------------------------------
  // SPECIAL ACCESS / CROSS-DEPARTMENT DELEGATION METHODS
  // -------------------------------------------------------------

  public grantSpecialAccess(
    userId: string,
    grantData: {
      reportKey?: string;
      department?: string;
      departments?: string[];
      reason: string;
      expiresAt?: string;
    },
    adminName: string
  ): { success: boolean; user?: UserAccount; grant?: SpecialAccessGrant; message?: string } {
    const user = this.users.get(userId);
    if (!user) {
      return { success: false, message: 'Target user not found.' };
    }

    const hasDepts = Array.isArray(grantData.departments) && grantData.departments.length > 0;
    if (!grantData.reportKey && !grantData.department && !hasDepts) {
      return { success: false, message: 'Either a reportKey or target department(s) must be specified.' };
    }

    if (!grantData.reason || grantData.reason.trim().length < 5) {
      return { success: false, message: 'A regulatory business justification reason is mandatory.' };
    }

    const targetDepts = hasDepts
      ? grantData.departments!
      : grantData.department
      ? [grantData.department.trim()]
      : [];

    const newGrant: SpecialAccessGrant = {
      id: `grant_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      reportKey: grantData.reportKey?.trim(),
      department: targetDepts.length === 1 ? targetDepts[0] : targetDepts.join(', '),
      departments: targetDepts,
      grantedBy: `${adminName} (ADMIN)`,
      grantedAt: new Date().toISOString(),
      reason: grantData.reason.trim(),
      expiresAt: grantData.expiresAt,
    };

    if (!Array.isArray(user.specialAccessGrants)) {
      user.specialAccessGrants = [];
    }

    user.specialAccessGrants.push(newGrant);
    effectiveAccessEngine.onSpecialAccessChange(userId);

    const targetLabel = grantData.reportKey
      ? `report ${grantData.reportKey}`
      : `department(s) ${targetDepts.join(', ')}`;

    try {
      realtimeSsotEngine.publishEvent({
        eventType: 'SPECIAL_ACCESS_CHANGED',
        action: 'GRANTED',
        domain: 'SPECIAL_ACCESS',
        entityId: userId,
        topic: `USER:${userId}`,
        actor: { id: 'usr_admin', name: adminName, role: 'ADMIN' },
        summary: `Special access granted to ${user.name} for ${targetLabel}`,
        payload: {
          grantId: newGrant.id,
          userId,
          reportKey: newGrant.reportKey,
          department: newGrant.department,
          expiresAt: newGrant.expiresAt,
        },
      });
    } catch (_) {}

    const { password, ...safe } = user;
    return {
      success: true,
      user: safe as UserAccount,
      grant: newGrant,
      message: `Special access granted to ${user.name} for ${targetLabel}.`,
    };
  }

  public revokeSpecialAccess(
    userId: string,
    grantId: string,
    adminName: string
  ): { success: boolean; user?: UserAccount; message?: string } {
    const user = this.users.get(userId);
    if (!user) {
      return { success: false, message: 'User not found.' };
    }

    if (!Array.isArray(user.specialAccessGrants)) {
      return { success: false, message: 'No special access grants exist on this user.' };
    }

    const beforeCount = user.specialAccessGrants.length;
    user.specialAccessGrants = user.specialAccessGrants.filter((g) => g.id !== grantId);

    if (user.specialAccessGrants.length === beforeCount) {
      return { success: false, message: 'Grant ID not found on user.' };
    }

    effectiveAccessEngine.onSpecialAccessChange(userId);

    try {
      realtimeSsotEngine.publishEvent({
        eventType: 'SPECIAL_ACCESS_CHANGED',
        action: 'REVOKED',
        domain: 'SPECIAL_ACCESS',
        entityId: userId,
        topic: `USER:${userId}`,
        actor: { id: 'usr_admin', name: adminName, role: 'ADMIN' },
        summary: `Special access grant revoked for ${user.name} by ${adminName}`,
        payload: { grantId, userId },
      });
    } catch (_) {}

    const { password, ...safe } = user;
    return {
      success: true,
      user: safe as UserAccount,
      message: `Special access grant revoked by ${adminName}.`,
    };
  }

  /**
   * Evaluates the complete set of report keys that this user is authorized to access.
   * Delegates to authoritative effectiveAccessEngine.
   */
  public getAllowedReportKeysForUser(user: UserAccount | UserSession): string[] {
    return effectiveAccessEngine.getAllowedReportKeysForUser(user);
  }

  /**
   * Verifies if a Maker is authorized to create/fill/submit a specific report.
   * Delegates to authoritative effectiveAccessEngine.
   */
  public canMakerAccessReport(user: UserAccount | UserSession, reportKey: string): boolean {
    return effectiveAccessEngine.evaluateAccess(user, reportKey, 'CREATE_DRAFT').allowed;
  }

  /**
   * Verifies if a Checker can review a submission.
   * Delegates to authoritative effectiveAccessEngine.
   */
  public canCheckerReviewSubmission(
    user: UserAccount | UserSession,
    submission: {
      id?: string;
      department?: string;
      makerDepartment?: string;
      makerId?: string;
      status?: string;
      reportKey: string;
    }
  ): { allowed: boolean; reason?: string } {
    const evalResult = effectiveAccessEngine.evaluateAccess(user, submission.reportKey, 'REVIEW', submission as any);
    return {
      allowed: evalResult.allowed,
      reason: evalResult.allowed ? undefined : evalResult.reason,
    };
  }

  /**
   * Synchronizes department renames across all existing user records and special access grants
   */
  public renameDepartment(oldName: string, newName: string): number {
    let affected = 0;
    const oldNorm = oldName.trim().toLowerCase();
    for (const user of this.users.values()) {
      if (user.department && user.department.trim().toLowerCase() === oldNorm) {
        user.department = newName;
        affected++;
      }
      if (Array.isArray(user.specialAccessGrants)) {
        user.specialAccessGrants.forEach((g) => {
          if (g.department && g.department.trim().toLowerCase() === oldNorm) {
            g.department = newName;
          }
          if (Array.isArray(g.departments)) {
            g.departments = g.departments.map((d) => (d.trim().toLowerCase() === oldNorm ? newName : d));
          }
        });
      }
    }
    return affected;
  }

  /**
   * Reassigns all users from a deleted department to a fallback department
   */
  public reassignDepartmentUsers(fromDept: string, toDept: string): number {
    let affected = 0;
    const fromNorm = fromDept.trim().toLowerCase();
    for (const user of this.users.values()) {
      if (user.department && user.department.trim().toLowerCase() === fromNorm) {
        user.department = toDept;
        affected++;
      }
    }
    return affected;
  }
}

export const userService = new UserServiceClass();
effectiveAccessEngine.setUserProvider(userService);
