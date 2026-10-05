/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { UserSession } from '../types/regulatory.ts';
import { getDepartmentForReport } from '../data/organizationHierarchy.ts';
import { BrowserSafeEventEmitter } from '../utils/browserEventEmitter.ts';

export type NotificationCategory = 'WORKFLOW' | 'GOVERNANCE' | 'SECURITY' | 'SYSTEM';
export type NotificationPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export interface AppNotification {
  id: string;
  recipientUserId?: string;
  recipientRole?: 'ADMIN' | 'MAKER' | 'CHECKER' | 'AUDITOR';
  recipientDepartment?: string;
  targetReportKey?: string;
  title: string;
  message: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  isRead: boolean;
  createdAt: string;
  actionUrl?: string;
  actionTab?: string;
  metadata?: Record<string, any>;
}

export interface UserNotificationQueryResult {
  notifications: AppNotification[];
  unreadCount: number;
  grouped: {
    WORKFLOW: AppNotification[];
    GOVERNANCE: AppNotification[];
    SECURITY: AppNotification[];
    SYSTEM: AppNotification[];
  };
}

const STORAGE_KEY = 'ob_authoritative_notifications_v1';

class NotificationService extends BrowserSafeEventEmitter {
  private notifications: AppNotification[] = [];

  constructor() {
    super();
    this.hydrateFromStorage();
    if (this.notifications.length === 0) {
      this.seedDefaultNotifications();
    }
  }

  private hydrateFromStorage(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.notifications = JSON.parse(stored);
      }
    } catch {
      // Storage hydration fallback
    }
  }

  private persist(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.notifications.slice(0, 500)));
    } catch {
      // Persistence error fallback
    }
  }

  public seedDefaultNotifications(): void {
    const now = Date.now();
    const d = (minutesAgo: number) => new Date(now - minutesAgo * 60000).toISOString();

    this.notifications = [
      // -------------------------------------------------------------
      // MAKER 1 (Credit Operations) NOTIFICATIONS
      // -------------------------------------------------------------
      {
        id: 'notif_mkr1_1',
        recipientUserId: 'usr_maker_1',
        recipientRole: 'MAKER',
        recipientDepartment: 'Credit Operations & Portfolio Management',
        targetReportKey: 'BSD_01',
        title: 'Review Complete: Return BSD-01 Approved',
        message: 'Your Daily Liquidity return BSD-01 has been reviewed and approved by Checker Chala Desta.',
        category: 'WORKFLOW',
        priority: 'HIGH',
        isRead: false,
        createdAt: d(15),
        actionTab: 'MAKER_WORKSPACE',
      },
      {
        id: 'notif_mkr1_2',
        recipientUserId: 'usr_maker_1',
        recipientRole: 'MAKER',
        recipientDepartment: 'Credit Operations & Portfolio Management',
        targetReportKey: 'NBE_CR_02',
        title: 'Correction Requested: Return NBE-CR-02',
        message: 'Checker requested correction on NBE-CR-02: Please verify collateral revaluation figures in Schedule B.',
        category: 'WORKFLOW',
        priority: 'HIGH',
        isRead: false,
        createdAt: d(95),
        actionTab: 'MAKER_WORKSPACE',
      },
      {
        id: 'notif_mkr1_3',
        recipientRole: 'MAKER',
        recipientDepartment: 'Credit Operations & Portfolio Management',
        targetReportKey: 'BSD_01',
        title: 'Credit Portfolio Schedule Notice',
        message: 'Supervisory notice: Please ensure end-of-month liquidity reserves reflect updated cash ratio.',
        category: 'GOVERNANCE',
        priority: 'MEDIUM',
        isRead: true,
        createdAt: d(360),
        actionTab: 'MAKER_WORKSPACE',
      },

      // -------------------------------------------------------------
      // MAKER 2 (Trade Services) NOTIFICATIONS (MUST NEVER LEAK TO MAKER 1)
      // -------------------------------------------------------------
      {
        id: 'notif_mkr2_1',
        recipientUserId: 'usr_maker_2',
        recipientRole: 'MAKER',
        recipientDepartment: 'Trade Services & International Banking',
        targetReportKey: 'LC_01',
        title: 'Return LC-01 Trade Draft Saved',
        message: 'Trade Services Letter of Credit return LC-01 draft is saved and awaiting submission to Checker.',
        category: 'WORKFLOW',
        priority: 'MEDIUM',
        isRead: false,
        createdAt: d(45),
        actionTab: 'MAKER_WORKSPACE',
      },
      {
        id: 'notif_mkr2_2',
        recipientUserId: 'usr_maker_2',
        recipientRole: 'MAKER',
        recipientDepartment: 'Trade Services & International Banking',
        targetReportKey: 'FX_01',
        title: 'Foreign Exchange Position Validated',
        message: 'FX-01 schedule formulas passed statutory cross-validation.',
        category: 'GOVERNANCE',
        priority: 'LOW',
        isRead: false,
        createdAt: d(180),
        actionTab: 'MAKER_WORKSPACE',
      },

      // -------------------------------------------------------------
      // CHECKER 1 (Credit Operations) NOTIFICATIONS
      // -------------------------------------------------------------
      {
        id: 'notif_chk1_1',
        recipientRole: 'CHECKER',
        recipientDepartment: 'Credit Operations & Portfolio Management',
        targetReportKey: 'BSD_01',
        title: 'New Return Pending 4-Eyes Review',
        message: 'Return BSD-01 (Daily Liquidity & Reserve) was submitted by Maker Abebe Kebede and requires your verification.',
        category: 'WORKFLOW',
        priority: 'HIGH',
        isRead: false,
        createdAt: d(20),
        actionTab: 'CHECKER_INBOX',
      },
      {
        id: 'notif_chk1_2',
        recipientRole: 'CHECKER',
        recipientDepartment: 'Credit Operations & Portfolio Management',
        title: 'Quarterly Prudential Review Window Open',
        message: 'The National Bank of Ethiopia quarterly supervisory review window is now open for Credit Operations.',
        category: 'GOVERNANCE',
        priority: 'MEDIUM',
        isRead: false,
        createdAt: d(240),
        actionTab: 'CHECKER_INBOX',
      },

      // -------------------------------------------------------------
      // AUDITOR NOTIFICATIONS
      // -------------------------------------------------------------
      {
        id: 'notif_aud_1',
        recipientRole: 'AUDITOR',
        title: 'NBE Filing Receipt Issued',
        message: 'Digital confirmation receipt REC-2026-NBE-00492 issued for verified return filing.',
        category: 'WORKFLOW',
        priority: 'HIGH',
        isRead: false,
        createdAt: d(30),
        actionTab: 'AUDITOR_DASHBOARD',
      },
      {
        id: 'notif_aud_2',
        recipientRole: 'AUDITOR',
        title: 'Audit Trail Verification Event',
        message: 'Dual-control sign-off logged with immutable SHA-256 fingerprint for regulatory inspection.',
        category: 'SECURITY',
        priority: 'MEDIUM',
        isRead: false,
        createdAt: d(120),
        actionTab: 'AUDITOR_DASHBOARD',
      },

      // -------------------------------------------------------------
      // ADMIN NOTIFICATIONS
      // -------------------------------------------------------------
      {
        id: 'notif_adm_1',
        recipientRole: 'ADMIN',
        title: 'Template Governance: Proposal Published',
        message: 'Governance proposal for BSD-01 statutory template versioning has been approved and published to production.',
        category: 'GOVERNANCE',
        priority: 'HIGH',
        isRead: false,
        createdAt: d(60),
        actionTab: 'ADMIN_DASHBOARD',
      },
      {
        id: 'notif_adm_2',
        recipientRole: 'ADMIN',
        title: 'User Governance: Pending Approvals',
        message: 'New user registration requests are awaiting superuser role assignment and biometric policy verification.',
        category: 'SECURITY',
        priority: 'MEDIUM',
        isRead: false,
        createdAt: d(150),
        actionTab: 'ADMIN_DASHBOARD',
      },
      {
        id: 'notif_adm_3',
        recipientRole: 'ADMIN',
        title: 'API Gateway Simulator Status',
        message: 'All probe endpoints responding within 30ms latency SLA.',
        category: 'SYSTEM',
        priority: 'LOW',
        isRead: true,
        createdAt: d(300),
        actionTab: 'ADMIN_DASHBOARD',
      },
    ];

    this.persist();
    this.emit('notifications_updated', this.notifications);
  }

  /**
   * Evaluates if a notification contains sensitive cross-department report metadata
   * that must be shielded from an unauthorized user.
   */
  private containsUnauthorizedReportMetadata(
    text: string,
    userAllowedKeys: string[],
    allKnownReports: Array<{ key: string; department: string }>,
    userDept?: string
  ): boolean {
    if (!text) return false;
    for (const r of allKnownReports) {
      // If user is already authorized for this report, it is not a leak
      if (userAllowedKeys.includes(r.key)) continue;
      if (userDept && r.department.toLowerCase() === userDept.toLowerCase()) continue;

      // Check if report key appears as an isolated word or prefix in text
      const regexKey = new RegExp(`\\b${r.key}\\b`, 'i');
      if (regexKey.test(text)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Authoritative server-side notification retrieval with role filtering
   * and strict cross-department leakage prevention.
   */
  public getNotificationsForUser(user: {
    id?: string;
    email?: string;
    role?: string;
    department?: string;
    allowedReportKeys?: string[];
  }): UserNotificationQueryResult {
    const role = user.role || 'MAKER';
    const dept = user.department || '';
    const userId = user.id || '';
    const userEmail = (user.email || '').toLowerCase();
    const allowedKeys = user.allowedReportKeys || [];

    // Filter notifications based on role, recipient, and department access
    const filtered = this.notifications.filter((n) => {
      // 1. Role-locked filter:
      if (n.recipientRole && n.recipientRole !== role) {
        return false;
      }

      // 2. Specific recipient user filter:
      if (n.recipientUserId) {
        const matchesId = n.recipientUserId === userId;
        const matchesEmail = n.recipientUserId.toLowerCase() === userEmail;
        if (!matchesId && !matchesEmail) {
          return false;
        }
      }

      // 3. Department isolation for MAKER and CHECKER:
      if (role === 'MAKER' || role === 'CHECKER') {
        // If notification explicitly targets a department other than user's department
        if (n.recipientDepartment && dept && n.recipientDepartment.toLowerCase() !== dept.toLowerCase()) {
          return false;
        }

        // If notification targets a specific report key, user must have access to that report
        if (n.targetReportKey) {
          const reportDept = getDepartmentForReport(n.targetReportKey);
          const hasDeptAccess = dept && reportDept && reportDept.toLowerCase() === dept.toLowerCase();
          const hasKeyAccess = allowedKeys.includes(n.targetReportKey);
          if (!hasDeptAccess && !hasKeyAccess) {
            return false;
          }
        }
      }

      return true;
    });

    const unreadCount = filtered.filter((n) => !n.isRead).length;

    const grouped = {
      WORKFLOW: filtered.filter((n) => n.category === 'WORKFLOW'),
      GOVERNANCE: filtered.filter((n) => n.category === 'GOVERNANCE'),
      SECURITY: filtered.filter((n) => n.category === 'SECURITY'),
      SYSTEM: filtered.filter((n) => n.category === 'SYSTEM'),
    };

    return {
      notifications: filtered,
      unreadCount,
      grouped,
    };
  }

  public markAsRead(id: string): boolean {
    const n = this.notifications.find((item) => item.id === id);
    if (n) {
      n.isRead = true;
      this.persist();
      this.emit('notifications_updated', this.notifications);
      return true;
    }
    return false;
  }

  public markAllAsReadForUser(user: {
    id?: string;
    email?: string;
    role?: string;
    department?: string;
    allowedReportKeys?: string[];
  }): number {
    const { notifications } = this.getNotificationsForUser(user);
    let count = 0;
    notifications.forEach((n) => {
      if (!n.isRead) {
        n.isRead = true;
        count++;
      }
    });
    if (count > 0) {
      this.persist();
      this.emit('notifications_updated', this.notifications);
    }
    return count;
  }

  public addNotification(notif: Omit<AppNotification, 'id' | 'createdAt' | 'isRead'>): AppNotification {
    const newNotif: AppNotification = {
      ...notif,
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
      isRead: false,
    };
    this.notifications.unshift(newNotif);
    this.persist();
    this.emit('notifications_updated', this.notifications);
    return newNotif;
  }

  public getAllAuthoritativeNotifications(): AppNotification[] {
    return [...this.notifications];
  }

  public clearAll(): void {
    this.notifications = [];
    this.persist();
    this.emit('notifications_updated', this.notifications);
  }

  public subscribe(listener: () => void): () => void {
    this.on('notifications_updated', listener);
    return () => {
      this.off('notifications_updated', listener);
    };
  }
}

export const notificationService = new NotificationService();
