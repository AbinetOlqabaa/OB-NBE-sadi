/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  ReportMetadata,
  ReportSubmission,
  UserSession,
  DynamicRowRecord,
} from './types/regulatory';
import { getAllReports, getReportByKey, subscribeReports } from './data/report-registry';
import { submissionService, DEMO_USERS } from './services/submissionService';
import { auditService } from './services/auditService';
import { indexedDbStorage } from './services/indexedDbStorage';
import { userService } from './services/userService';
import { departmentService } from './services/departmentService';
import { Navbar } from './components/Navbar';
import { Sidebar, ViewTab } from './components/Sidebar';
import { AdminDashboard } from './components/AdminDashboard';
import { DepartmentReportManagement } from './components/DepartmentReportManagement';
import { MakerWorkspace } from './components/MakerWorkspace';
import { MakerLibraryView } from './components/MakerLibraryView';
import { CheckerInbox } from './components/CheckerInbox';
import { AuditorDashboard } from './components/AuditorDashboard';
import { DynamicReportForm, NavigationGuardHandler } from './components/DynamicReportForm';
import { NbeSimulatorView } from './components/NbeSimulatorView';
import { Phase2SSOTView } from './components/Phase2SSOTView';
import { AuditTrailView } from './components/AuditTrailView';
import { DocumentationView } from './components/DocumentationView';
import { SystemHealthDashboard } from './components/SystemHealthDashboard';
import { LoginPage } from './components/LoginPage';
import { RegisterPage } from './components/RegisterPage';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { ThemeSyncMonitor } from './components/ThemeSyncMonitor';
import { BottomNavigation } from './components/BottomNavigation';
import { InputAccessoryView } from './components/InputAccessoryView';
import { useSwipeGesture } from './hooks/useSwipeGesture';
import { vibrate, haptics } from './utils/haptics';
import {
  getVerifiedHardwareSummary,
  triggerHardwareVerificationHaptic,
} from './utils/deviceCapabilities';
import {
  Fingerprint,
  Camera,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  X,
  AlertTriangle,
  RefreshCw,
  LogOut,
  Loader2,
} from 'lucide-react';

export interface ToastNotification {
  message: string;
  title?: string;
  type?: 'default' | 'hardware' | 'success' | 'warning' | 'error';
  badgeLabel?: string;
  sensorDetails?: string;
  iconType?: 'dual' | 'fingerprint' | 'camera' | 'hardware';
  userName?: string;
  userRole?: string;
}

// Initial dashboard tab based on role
export const getDefaultTabForRole = (role?: string): ViewTab => {
  if (role === 'ADMIN') return 'ADMIN_DASHBOARD';
  if (role === 'CHECKER') return 'CHECKER_INBOX';
  if (role === 'AUDITOR') return 'AUDITOR_DASHBOARD';
  return 'MAKER_WORKSPACE';
};

export const isTabAuthorizedForRole = (tab: ViewTab, role?: string): boolean => {
  if (!role) return false;
  switch (tab) {
    case 'ADMIN_DASHBOARD':
    case 'DEPT_REPORT_MANAGEMENT':
      return role === 'ADMIN';
    case 'MAKER_WORKSPACE':
      return role === 'MAKER';
    case 'LIBRARY':
      return role === 'MAKER' || role === 'CHECKER' || role === 'AUDITOR';
    case 'CHECKER_INBOX':
      return role === 'CHECKER';
    case 'AUDITOR_DASHBOARD':
      return role === 'AUDITOR';
    case 'NBE_SIMULATOR':
      return role === 'ADMIN';
    case 'PHASE2_SSOT':
    case 'SYSTEM_HEALTH':
      return role === 'ADMIN';
    case 'AUDIT_TRAIL':
      return role === 'ADMIN' || role === 'CHECKER' || role === 'AUDITOR' || role === 'MAKER';
    case 'DOCUMENTATION':
      return true;
    default:
      return false;
  }
};
export const isTabAuthorized = isTabAuthorizedForRole;

export default function App() {
  // Phase 29: Only restore persistent session if remember_me was explicitly requested, or transient tab session
  const [currentUser, setCurrentUser] = useState<UserSession | null>(() => {
    try {
      // 1. Check transient session (same browser tab)
      const transient = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('ob_transient_user') : null;
      if (transient) {
        return JSON.parse(transient);
      }
      // 2. Check remembered session only if remember_me was active
      const isRemembered = typeof localStorage !== 'undefined' && localStorage.getItem('ob_remember_me_active') === 'true';
      if (isRemembered) {
        const stored = localStorage.getItem('ob_logged_in_user');
        if (stored) {
          return JSON.parse(stored);
        }
      }
    } catch {}
    return null;
  });

  const [authView, setAuthView] = useState<'LOGIN' | 'REGISTER'>('LOGIN');

  const getInitialTabForRole = getDefaultTabForRole;

  const [activeTab, setActiveTab] = useState<ViewTab>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlTab = (params.get('tab') || window.location.hash.replace('#', '')) as ViewTab;
      if (urlTab && currentUser && isTabAuthorizedForRole(urlTab, currentUser.role)) {
        return urlTab;
      }
    }
    return currentUser ? getInitialTabForRole(currentUser.role) : 'MAKER_WORKSPACE';
  });

  // Security & Phase 35: Intercept direct URL, hash, and browser history popstate navigation
  useEffect(() => {
    const handleUrlAndHistoryNavigation = () => {
      if (typeof window === 'undefined' || !currentUser) return;
      const params = new URLSearchParams(window.location.search);
      const urlTab = (params.get('tab') || window.location.hash.replace('#', '')) as ViewTab;
      if (urlTab && urlTab !== activeTab) {
        if (!isTabAuthorizedForRole(urlTab, currentUser.role)) {
          // Cross-dashboard direct URL/history access strictly rejected and redirected
          const correctTab = getInitialTabForRole(currentUser.role);
          setActiveTab(correctTab);
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.set('tab', correctTab);
          window.history.replaceState({ tab: correctTab }, '', newUrl.toString());
          auditService.log({
            actorId: currentUser.id,
            actorName: currentUser.name,
            actorRole: currentUser.role,
            action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
            entityType: 'SECURITY_RBAC',
            entityId: urlTab,
            correlationId: `corr_sec_url_${Date.now()}`,
            details: `Direct URL/browser history access to unauthorized view ${urlTab} rejected for ${currentUser.role} under NBE BSD/03/2020 segregation rules.`,
          });
        } else {
          setActiveTab(urlTab);
        }
      }
    };

    window.addEventListener('popstate', handleUrlAndHistoryNavigation);
    handleUrlAndHistoryNavigation();
    return () => window.removeEventListener('popstate', handleUrlAndHistoryNavigation);
  }, [currentUser, activeTab]);

  // Security: audit unauthorized view access attempts & immediately redirect to role's authoritative dashboard!
  useEffect(() => {
    if (currentUser && !isTabAuthorizedForRole(activeTab, currentUser.role)) {
      auditService.log({
        actorId: currentUser.id,
        actorName: currentUser.name,
        actorRole: currentUser.role,
        action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        entityType: 'SECURITY_RBAC',
        entityId: activeTab,
        correlationId: `corr_sec_${Date.now()}`,
        details: `Access denied to protected view ${activeTab} for role ${currentUser.role} under NBE BSD/03/2020 segregation rules.`,
      });
      const correctTab = getInitialTabForRole(currentUser.role);
      setActiveTab(correctTab);
    }
  }, [activeTab, currentUser]);

  const [templates, setTemplates] = useState<ReportMetadata[]>(getAllReports());
  const [submissions, setSubmissions] = useState<ReportSubmission[]>(submissionService.getAll());
  const [editingSubmission, setEditingSubmission] = useState<ReportSubmission | null>(null);
  const [toastNotification, setToastNotification] = useState<ToastNotification | null>(null);
  const toastTimeoutRef = React.useRef<any>(null);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Phase 27 & 28: Navigation Guard & Leave-Page Safety State
  const navigationGuardRef = useRef<NavigationGuardHandler | null>(null);
  const [leaveSafetyModalOpen, setLeaveSafetyModalOpen] = useState(false);
  const [pendingNavigationAction, setPendingNavigationAction] = useState<{
    type: 'SWITCH_TAB' | 'CLOSE_FORM';
    targetTab?: ViewTab;
    errorMsg?: string;
  } | null>(null);

  // Phase 28 & 27: Explicit Logout Confirmation Dialog with Autosave Flush
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutFlushError, setLogoutFlushError] = useState<string | null>(null);

  // Subscribe to authoritative SSOT updates from submissionService (Requirement 9)
  useEffect(() => {
    const unsub = submissionService.onSubmissionsUpdated((subs) => {
      setSubmissions([...subs]);
    });
    return () => unsub();
  }, []);

  // Phase 29: End-to-End Server-Controlled Persistent Session Verification & Biometric Policy Re-evaluation (Req 4, 6, 8, 9, 10)
  useEffect(() => {
    let isMounted = true;
    async function verifyServerPersistentSession() {
      // If user is already active via transient session in this tab, keep active
      try {
        const transient = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('ob_transient_user') : null;
        if (transient) {
          const parsed = JSON.parse(transient);
          if (parsed && isMounted && !currentUser) {
            setCurrentUser(parsed);
            return;
          }
        }
      } catch {}

      // Verify persistent session against real server backend
      try {
        const res = await fetch('/api/auth/session', {
          method: 'GET',
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.user && isMounted) {
            // Check biometric policy (Req 10):
            // Remember Me must not bypass explicit biometric policy when biometrics are enrolled/required
            if (data.requiresBiometricVerification) {
              // Biometric policy retains authority: keep user reference in session for 1-click biometric authorization
              sessionStorage.setItem('ob_remembered_biometric_user', JSON.stringify(data.user));
            } else {
              setCurrentUser(data.user);
              localStorage.setItem('ob_logged_in_user', JSON.stringify(data.user));
              localStorage.setItem('ob_remember_me_active', 'true');
            }
          }
        } else {
          // Server returned 401 (Session expired, revoked, account disabled, or password changed)
          // Silently clean up stale local reference so user is NOT restored by old session (Req 8, 9)
          localStorage.removeItem('ob_logged_in_user');
          localStorage.removeItem('ob_remember_me_active');
          if (isMounted && typeof localStorage !== 'undefined' && localStorage.getItem('ob_remember_me_active') !== 'true') {
            // If the user was only loaded from old localStorage without server session, clear them
            const hasTransient = sessionStorage.getItem('ob_transient_user');
            if (!hasTransient) {
              setCurrentUser(null);
            }
          }
        }
      } catch {
        // Fallback for offline / decoupled test runner:
        // Ensure unchecked sessions do not persist across restarts
        try {
          const wasRemembered = localStorage.getItem('ob_remember_me_active') === 'true';
          if (!wasRemembered && !sessionStorage.getItem('ob_transient_user')) {
            localStorage.removeItem('ob_logged_in_user');
            if (isMounted) setCurrentUser(null);
          }
        } catch {}
      }
    }

    verifyServerPersistentSession();
    return () => {
      isMounted = false;
    };
  }, []);

  // Safe navigation helper that flushes pending draft changes before switching view
  const handleSafeTabChange = async (targetTab: ViewTab) => {
    let resolvedTab = targetTab;
    if (!isTabAuthorizedForRole(resolvedTab, currentUser?.role || 'MAKER')) {
      showToast('Access restricted: System Health and SSOT Lakehouse are reserved for Administrator.');
      resolvedTab = getInitialTabForRole(currentUser?.role || 'MAKER');
    }

    if (editingSubmission && navigationGuardRef.current?.hasUnsavedChanges()) {
      try {
        const saved = await navigationGuardRef.current.flush();
        if (!saved) {
          setPendingNavigationAction({ type: 'SWITCH_TAB', targetTab: resolvedTab });
          setLeaveSafetyModalOpen(true);
          return;
        }
      } catch (err: any) {
        setPendingNavigationAction({ type: 'SWITCH_TAB', targetTab: resolvedTab, errorMsg: err.message });
        setLeaveSafetyModalOpen(true);
        return;
      }
    }
    setActiveTab(resolvedTab);
    setEditingSubmission(null);
  };

  const handleCloseEditingSubmission = async () => {
    if (editingSubmission && navigationGuardRef.current?.hasUnsavedChanges()) {
      try {
        const saved = await navigationGuardRef.current.flush();
        if (!saved) {
          setPendingNavigationAction({ type: 'CLOSE_FORM' });
          setLeaveSafetyModalOpen(true);
          return;
        }
      } catch (err: any) {
        setPendingNavigationAction({ type: 'CLOSE_FORM', errorMsg: err.message });
        setLeaveSafetyModalOpen(true);
        return;
      }
    }
    setEditingSubmission(null);
  };

  // Horizontal swipe gesture navigation across Sidebar tabs on mobile viewport
  const {
    containerRef: mainViewportRef,
    touchHandlers: swipeTouchHandlers,
    isSwiping,
    swipeDirection,
    swipeOffset,
    nextTab,
    prevTab,
  } = useSwipeGesture({
    currentTab: activeTab,
    userRole: currentUser?.role,
    onSelectTab: (tab) => {
      handleSafeTabChange(tab as ViewTab);
      setIsMobileDrawerOpen(false);
    },
    enabled: !editingSubmission && Boolean(currentUser),
  });

  // Global Keyboard Shortcuts Listener
  useEffect(() => {
    if (!currentUser) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement;

      // 1. Ctrl+K or Cmd+K: Open Universal Command Palette
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        setIsShortcutsModalOpen(false);
        return;
      }

      // 2. '?' or Ctrl+/ : Open Keyboard Shortcuts Cheat Sheet
      if ((e.key === '?' && !isInput) || ((e.ctrlKey || e.metaKey) && e.key === '/')) {
        e.preventDefault();
        setIsShortcutsModalOpen((prev) => !prev);
        setIsCommandPaletteOpen(false);
        return;
      }

      // 3. Escape: Close modals
      if (e.key === 'Escape') {
        if (isCommandPaletteOpen) {
          setIsCommandPaletteOpen(false);
          return;
        }
        if (isShortcutsModalOpen) {
          setIsShortcutsModalOpen(false);
          return;
        }
      }

      // 4. Ctrl+M or Cmd+M: Jump to Maker Workspace
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        if (currentUser.role === 'MAKER') {
          handleSafeTabChange('MAKER_WORKSPACE');
          showToast('Navigated to Maker Workspace (Ctrl+M)');
        } else {
          showToast(`Access restricted: Maker Workspace is locked to MAKER role (current: ${currentUser.role}).`);
        }
        return;
      }

      // 4b. Ctrl+L or Cmd+L: Jump to Maker Library & Dossiers
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        if (currentUser.role === 'MAKER' || currentUser.role === 'CHECKER' || currentUser.role === 'AUDITOR') {
          handleSafeTabChange('LIBRARY');
          showToast('Navigated to Library & Dossiers (Ctrl+L)');
        }
        return;
      }

      // 5. Ctrl+Shift+C / Cmd+Shift+C: Jump to Checker Inbox
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        if (currentUser.role === 'CHECKER') {
          handleSafeTabChange('CHECKER_INBOX');
          showToast('Navigated to Checker Inbox (Ctrl+Shift+C)');
        } else {
          showToast(`Access restricted: Checker Inbox is locked to CHECKER role (current: ${currentUser.role}).`);
        }
        return;
      }

      // 6. Ctrl+Shift+A / Cmd+Shift+A: Jump to Role-Locked Dashboard (Admin or Auditor)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        if (currentUser.role === 'ADMIN') {
          handleSafeTabChange('ADMIN_DASHBOARD');
          showToast('Navigated to Admin Governance (Ctrl+Shift+A)');
        } else if (currentUser.role === 'AUDITOR') {
          handleSafeTabChange('AUDITOR_DASHBOARD');
          showToast('Navigated to Auditor Workspace (Ctrl+Shift+A)');
        } else {
          showToast(`Access restricted: Admin/Auditor workspace locked (current: ${currentUser.role}).`);
        }
        return;
      }

      // 6b. Ctrl+Shift+M / Cmd+Shift+M: Jump to Departments & Reports Management (Admin Only)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        if (currentUser.role === 'ADMIN') {
          handleSafeTabChange('DEPT_REPORT_MANAGEMENT');
          showToast('Navigated to Departments & Reports Governance (Ctrl+Shift+M)');
        }
        return;
      }

      // 7. Ctrl+Shift+N / Cmd+Shift+N: Jump to NBE Simulator (Admin Only)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        if (currentUser.role === 'ADMIN') {
          handleSafeTabChange('NBE_SIMULATOR');
          showToast('Navigated to NBE API Gateway Simulator (Ctrl+Shift+N)');
        } else {
          showToast(`Access restricted: NBE Simulator is strictly reserved for Administrators (current: ${currentUser.role}).`);
        }
        return;
      }

      // 8. Ctrl+Shift+S / Cmd+Shift+S: Jump to Phase 2 SSOT (Admin Only)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (currentUser.role === 'ADMIN') {
          handleSafeTabChange('PHASE2_SSOT');
          showToast('Navigated to Phase 2 SSOT Medallion Lakehouse (Ctrl+Shift+S)');
        } else {
          showToast('Access restricted: SSOT Lakehouse is reserved for Administrator.');
        }
        return;
      }

      // 9. Ctrl+Shift+L / Cmd+Shift+L: Jump to Audit Trail
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        handleSafeTabChange('AUDIT_TRAIL');
        showToast('Navigated to Regulatory Audit Trail (Ctrl+Shift+L)');
        return;
      }

      // 10. Ctrl+Shift+D / Cmd+Shift+D: Jump to Documentation
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handleSafeTabChange('DOCUMENTATION');
        showToast('Navigated to NBE Specifications & Documentation (Ctrl+Shift+D)');
        return;
      }

      // 11. Ctrl+Shift+H / Cmd+Shift+H: Jump to System Health (Admin Only)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        if (currentUser.role === 'ADMIN') {
          handleSafeTabChange('SYSTEM_HEALTH');
          showToast('Navigated to System Health Telemetry Dashboard (Ctrl+Shift+H)');
        } else {
          showToast('Access restricted: System Health telemetry is reserved for Administrator.');
        }
        return;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [currentUser, isCommandPaletteOpen, isShortcutsModalOpen]);

  // Collapsible Sidebar state persisted in localStorage
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ob_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  // Mobile Slide-Out Drawer State (< 768px)
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  const toggleSidebar = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsMobileDrawerOpen((prev) => !prev);
    } else {
      setIsSidebarCollapsed((prev) => {
        const next = !prev;
        try {
          localStorage.setItem('ob_sidebar_collapsed', String(next));
        } catch {}
        return next;
      });
    }
  };

  // Sync templates & submissions with backend if available
  const refreshData = async () => {
    try {
      const [tplRes, subRes] = await Promise.all([
        fetch('/api/regulatory/templates').then((r) => (r.ok ? r.json() : null)),
        fetch('/api/regulatory/submissions').then((r) => (r.ok ? r.json() : null)),
      ]);
      if (tplRes && Array.isArray(tplRes)) {
        setTemplates(getAllReports());
      }
      if (subRes && Array.isArray(subRes)) {
        setSubmissions(subRes);
      } else {
        setSubmissions(submissionService.getAll());
      }
    } catch {
      setTemplates(getAllReports());
      setSubmissions(submissionService.getAll());
    }
  };

  useEffect(() => {
    refreshData();
    const unsubReports = subscribeReports((updated) => {
      setTemplates(updated);
    });
    const unsubDepts = departmentService.subscribe(() => {
      setTemplates(getAllReports());
    });
    const unsubStorage = indexedDbStorage.subscribe(() => {
      setSubmissions(submissionService.getAll());
    });
    return () => {
      unsubReports();
      unsubDepts();
      unsubStorage();
    };
  }, []);

  const showToast = (toastInput: string | ToastNotification, duration = 4500) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    if (typeof toastInput === 'string') {
      setToastNotification({
        message: toastInput,
        type: 'default',
      });
    } else {
      setToastNotification(toastInput);
    }
    toastTimeoutRef.current = setTimeout(() => {
      setToastNotification(null);
    }, duration);
  };

  // Login handler with subtle haptic feedback & device hardware verification toast alert
  const handleLoginSuccess = async (user: UserSession, redirectTab?: string, rememberMe?: boolean) => {
    // 1. Trigger subtle tactile haptic feedback confirming login & verified hardware
    triggerHardwareVerificationHaptic();

    // 2. Set current authenticated user & persist according to Remember Me policy (Req 4, 5, 11)
    setCurrentUser(user);
    try {
      if (rememberMe) {
        localStorage.setItem('ob_logged_in_user', JSON.stringify(user));
        localStorage.setItem('ob_remember_me_active', 'true');
        sessionStorage.removeItem('ob_transient_user');
      } else {
        // If Remember Me is unchecked, store only in transient tab session (Req 11)
        localStorage.removeItem('ob_logged_in_user');
        localStorage.removeItem('ob_remember_me_active');
        sessionStorage.setItem('ob_transient_user', JSON.stringify(user));
      }
    } catch {}

    const targetTab = (redirectTab as ViewTab) || getInitialTabForRole(user.role);
    setActiveTab(targetTab);
    setEditingSubmission(null);

    // 3. Obtain verified hardware summary from internal diagnostics
    const hwSummary = await getVerifiedHardwareSummary();

    // 4. Present subtle confirmation toast alert verifying device hardware
    showToast(
      {
        type: 'hardware',
        title: hwSummary.title,
        message: hwSummary.message,
        badgeLabel: hwSummary.badgeLabel,
        sensorDetails: hwSummary.sensorDetails,
        iconType: hwSummary.iconType,
        userName: user.name,
        userRole: user.role,
      },
      6000
    );
  };

  // Phase 28 & 27: Explicit Logout Handlers with Pending Report Flush
  const handleInitiateLogout = () => {
    setLogoutFlushError(null);
    setLogoutModalOpen(true);
  };

  const handleConfirmLogout = async () => {
    if (editingSubmission && navigationGuardRef.current?.hasUnsavedChanges()) {
      setIsLoggingOut(true);
      try {
        const saved = await navigationGuardRef.current.flush();
        if (!saved) {
          setLogoutFlushError('Failed to persist pending changes to the server.');
          setIsLoggingOut(false);
          return;
        }
      } catch (err: any) {
        setLogoutFlushError(err.message || 'Server persistence failed.');
        setIsLoggingOut(false);
        return;
      }
    }
    executeLogout();
  };

  const executeLogout = async () => {
    setCurrentUser(null);
    setEditingSubmission(null);
    setLogoutModalOpen(false);
    setIsLoggingOut(false);
    setLogoutFlushError(null);
    try {
      localStorage.removeItem('ob_logged_in_user');
      localStorage.removeItem('ob_remember_me_active');
      sessionStorage.removeItem('ob_transient_user');
      sessionStorage.removeItem('ob_remembered_biometric_user');
      // Invalidate & clear sensitive transient biometric state per existing auth architecture
      sessionStorage.removeItem('ob_internal_hw_diagnostic');
      sessionStorage.removeItem('ob_biometric_challenge');
      sessionStorage.removeItem('ob_face_auth_temp');
      sessionStorage.removeItem('ob_active_session_token');
      sessionStorage.removeItem('ob_auth_history_cache');

      // Phase 29: Explicit Logout invalidates the remembered session on the server (Req 8)
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      }).catch(() => {});
    } catch {}
    setAuthView('LOGIN');
    showToast('Logged out of Oromia Bank Regulatory Portal. Persistent session invalidated.');
  };

  // Fast Login as Administrator for testing pending approval workflows
  const handleFastLoginAdmin = () => {
    const adminUser = userService.getByEmail('admin@oromiabank.com');
    if (adminUser) {
      handleLoginSuccess(adminUser as UserSession, 'ADMIN_DASHBOARD');
    }
  };

  const pendingCheckerCount = submissions.filter((s) => s.status === 'PENDING_CHECKER').length;

  // Open existing or new submission form
  const handleSelectSubmission = (sub: ReportSubmission) => {
    const fresh = submissionService.getById(sub.id) || sub;
    setEditingSubmission(fresh);
  };

  const handleCreateDraft = (reportKey: string) => {
    if (!currentUser) return;
    try {
      const created = submissionService.createSubmission(reportKey, currentUser);
      setSubmissions(submissionService.getAll());
      setEditingSubmission(created);
      showToast(`Draft initiated for ${reportKey}. You can now input return data.`);
    } catch (err: any) {
      alert(`Error creating draft: ${err.message}`);
    }
  };

  const handleDeleteSubmission = (subId: string) => {
    if (!currentUser) return;
    try {
      vibrate([40, 60]);
      submissionService.deleteSubmission(subId, currentUser);
      setSubmissions(submissionService.getAll());
      if (editingSubmission?.id === subId) {
        setEditingSubmission(null);
      }
      showToast('Draft submission deleted.');
    } catch (err: any) {
      alert(`Delete error: ${err.message}`);
    }
  };

  const handleArchiveSubmission = (subId: string) => {
    vibrate(25);
    showToast('Submission archived from Checker queue.');
  };

  // Authoritative Save changes to current submission (SSOT Server Confirmation)
  const handleSaveDraft = async (
    values: Record<string, string | number>,
    dynamicRows: Record<number, DynamicRowRecord[]>,
    expectedVersion?: number
  ): Promise<ReportSubmission> => {
    if (!editingSubmission || !currentUser) {
      throw new Error('No active editing submission or user session');
    }
    vibrate(25);
    const updated = submissionService.updateDraft(
      editingSubmission.id,
      values,
      dynamicRows,
      currentUser,
      expectedVersion
    );
    setEditingSubmission(updated);
    setSubmissions(submissionService.getAll());
    showToast(`Draft ${updated.reportKey} (v${updated.version}) persisted to server SSOT.`);
    return updated;
  };

  // Reuse submitted / historical return as new draft
  const handleReuseSubmission = (subId: string) => {
    if (!currentUser) return;
    try {
      vibrate([30, 45]);
      const reused = submissionService.reuseSubmission(subId, currentUser);
      setSubmissions(submissionService.getAll());
      setEditingSubmission(reused);
      showToast(`Created new draft by reusing return ${reused.reportKey}. Source report remains immutable.`);
    } catch (err: any) {
      alert(`Error reusing report: ${err.message}`);
    }
  };

  // Submit to Checker for approval (Phase 36: supports selectedCheckerIds)
  const handleSubmitToChecker = (subId: string, comment?: string, selectedCheckerIds?: string[]) => {
    if (!currentUser) return;
    try {
      vibrate([25, 40, 35]);
      const updated = submissionService.submitToChecker(
        subId,
        currentUser,
        comment || 'Prepared and submitted for Checker review.',
        undefined,
        selectedCheckerIds
      );
      setSubmissions(submissionService.getAll());
      if (editingSubmission?.id === subId) {
        setEditingSubmission(updated);
      }
      const count = updated.assignedCheckerIds?.length || 1;
      showToast(`Return ${updated.reportKey} submitted to ${count} assigned Checker(s) [${updated.checkerName || 'Checker'}] for 4-eyes sign-off.`);
    } catch (err: any) {
      alert(`Submission error: ${err.message}`);
    }
  };

  // Checker reviews submission
  const handleReviewSubmission = (
    submissionId: string,
    action: 'APPROVE' | 'REJECT' | 'REQUEST_CORRECTION',
    comment: string
  ) => {
    if (!currentUser) return;
    try {
      if (action === 'APPROVE') {
        vibrate([30, 45, 35]);
      } else if (action === 'REQUEST_CORRECTION') {
        vibrate([40, 50, 40]);
      } else {
        vibrate([60, 70]);
      }

      const updated = submissionService.reviewSubmission(submissionId, action, currentUser, comment);
      setSubmissions(submissionService.getAll());
      if (editingSubmission?.id === submissionId) {
        setEditingSubmission(updated);
      }
      showToast(
        action === 'APPROVE'
          ? `Return ${updated.reportKey} approved and ready for delivery to NBE.`
          : action === 'REQUEST_CORRECTION'
          ? `Return ${updated.reportKey} sent back to Maker for corrections.`
          : `Return ${updated.reportKey} rejected.`
      );
    } catch (err: any) {
      alert(`Review error: ${err.message}`);
    }
  };

  // Deliver approved submission to NBE Simulator
  const handleDeliverToNBE = async (submissionId: string) => {
    if (!currentUser) return { success: false, error: 'Unauthenticated' };
    try {
      vibrate([30, 40, 30, 50]);
      const result = await submissionService.deliverToNBE(submissionId, currentUser);
      setSubmissions(submissionService.getAll());
      if (result.success) {
        const receipt = result.response?.submissionReceiptNumber || result.response?.receiptNumber || 'CONFIRMED';
        showToast(`Delivered to NBE! Receipt: ${receipt}`);
      } else {
        showToast(`Delivery failed: ${result.error}`);
      }
      return result;
    } catch (err: any) {
      showToast(`Delivery exception: ${err.message}`);
      return { success: false, error: err.message };
    }
  };

  // Phase 2 auto-open
  const handleOpenGeneratedSubmission = (reportKey: string) => {
    const existing = submissionService.getByFilter({ reportKey })[0];
    if (existing) {
      setEditingSubmission(existing);
      setActiveTab('MAKER_WORKSPACE');
    } else {
      handleCreateDraft(reportKey);
    }
  };

  // Role Switcher in Navbar
  const handleSwitchUserSession = (newUser: UserSession) => {
    setCurrentUser(newUser);
    try {
      localStorage.setItem('ob_logged_in_user', JSON.stringify(newUser));
    } catch {}
    const newTab = getInitialTabForRole(newUser.role);
    setActiveTab(newTab);
    setEditingSubmission(null);
    showToast(`Switched active session to ${newUser.name} (${newUser.role})`);
  };

  // If visitor is NOT authenticated, display Login or Register page
  if (!currentUser) {
    return (
      <>
        {authView === 'REGISTER' ? (
          <RegisterPage
            onRegisterSuccess={() => setAuthView('LOGIN')}
            onNavigateLogin={() => setAuthView('LOGIN')}
            onFastLoginAdmin={handleFastLoginAdmin}
          />
        ) : (
          <LoginPage
            onLoginSuccess={handleLoginSuccess}
            onNavigateRegister={() => setAuthView('REGISTER')}
          />
        )}
        <ThemeSyncMonitor />
        <InputAccessoryView />
      </>
    );
  }

  // Template for current editing submission
  const currentEditingTemplate = editingSubmission
    ? getReportByKey(editingSubmission.reportKey)
    : null;

  return (
    <div className="h-[100dvh] max-h-[100dvh] w-full max-w-full overflow-hidden flex flex-col font-sans bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased selection:bg-ob-indigo-600 selection:text-white transition-colors">
      {/* 1. Top Navigation Bar (Strictly Fixed Height h-14 / h-16) */}
      <Navbar
        currentUser={currentUser}
        onSwitchUser={handleSwitchUserSession}
        activeView={activeTab}
        pendingCheckerCount={pendingCheckerCount}
        isSidebarCollapsed={isSidebarCollapsed}
        onToggleSidebar={toggleSidebar}
        onOpenMobileDrawer={() => setIsMobileDrawerOpen(true)}
        onLogout={handleInitiateLogout}
        onNavigateToSimulator={() => {
          handleSafeTabChange('NBE_SIMULATOR');
        }}
        onSelectTab={(tab) => {
          handleSafeTabChange(tab as ViewTab);
        }}
      />

      {/* 2. Main Window Container (Equal Full Length between Sidebar and Viewport) */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Left Navigation Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={(tab) => {
            handleSafeTabChange(tab);
            setIsMobileDrawerOpen(false);
          }}
          currentUser={currentUser}
          pendingCheckerCount={pendingCheckerCount}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebar}
          isMobileDrawerOpen={isMobileDrawerOpen}
          onCloseMobileDrawer={() => setIsMobileDrawerOpen(false)}
          onLogout={handleInitiateLogout}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onOpenShortcutsModal={() => setIsShortcutsModalOpen(true)}
        />

        {/* Dynamic Main Viewport (Scrollable Workspace Area with Mobile Horizontal Swipe Navigation) */}
        <main
          ref={mainViewportRef as any}
          {...swipeTouchHandlers}
          className="flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden flex flex-col p-2.5 sm:p-4 pb-3 sm:pb-4 touch-scroll-y relative"
        >
          {/* Subtle Mobile Drag/Swipe Navigation Direction Indicator */}
          {isSwiping && Math.abs(swipeOffset) > 25 && (
            <div
              className={`fixed top-1/2 -translate-y-1/2 z-40 px-3.5 py-1.5 rounded-full backdrop-blur-md text-[11px] font-bold shadow-xl border flex items-center gap-1.5 pointer-events-none transition-all duration-75 animate-in fade-in select-none ${
                swipeDirection === 'left' && nextTab
                  ? 'right-3 bg-ob-indigo-900/95 text-white border-ob-indigo-400/60 shadow-ob-indigo-950/40'
                  : swipeDirection === 'right' && prevTab
                  ? 'left-3 bg-ob-indigo-900/95 text-white border-ob-indigo-400/60 shadow-ob-indigo-950/40'
                  : 'hidden'
              }`}
            >
              <span>
                {swipeDirection === 'left' && nextTab
                  ? `Next: ${nextTab.replace(/_/g, ' ')} →`
                  : `← Prev: ${prevTab?.replace(/_/g, ' ')}`}
              </span>
            </div>
          )}

          {editingSubmission && currentEditingTemplate ? (
            <DynamicReportForm
              metadata={currentEditingTemplate}
              submission={editingSubmission}
              currentUser={currentUser}
              readOnly={
                currentUser.role !== 'MAKER' ||
                editingSubmission.status === 'APPROVED' ||
                editingSubmission.status === 'SENT' ||
                editingSubmission.status === 'ARCHIVED' ||
                editingSubmission.status === 'VOIDED' ||
                editingSubmission.status === 'PENDING_CHECKER' ||
                (editingSubmission.status !== 'DRAFT' &&
                  editingSubmission.status !== 'CORRECTION_REQUIRED')
              }
              onBack={handleCloseEditingSubmission}
              onSave={handleSaveDraft}
              onSubmitToChecker={(comment, expectedVer, selectedCheckerIds) => {
                handleSubmitToChecker(editingSubmission.id, comment, selectedCheckerIds);
              }}
              onReuseSubmission={handleReuseSubmission}
              onRegisterNavigationGuard={(guard) => {
                navigationGuardRef.current = guard;
              }}
            />
          ) : !isTabAuthorizedForRole(activeTab, currentUser.role) ? (
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-6 shadow-xl text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center border border-amber-200 dark:border-amber-800">
                  <ShieldAlert className="w-7 h-7" />
                </div>
                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-bold font-mono bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300">
                    NBE DIRECTIVE BSD/03/2020 SEGREGATION OF DUTIES
                  </div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                    403 — Unauthorized Role Access
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Your current operational role (<strong className="font-mono text-amber-600 dark:text-amber-400">{currentUser.role}</strong>) is restricted from accessing the{' '}
                    <strong className="text-slate-800 dark:text-slate-200">{activeTab.replace(/_/g, ' ')}</strong> workspace. Under National Bank of Ethiopia prudential governance standards, Maker preparation, Checker sign-off, Auditor inspection, and Administrator governance functions are strictly segregated.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    handleSafeTabChange(getInitialTabForRole(currentUser.role));
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-ob-indigo-600 hover:bg-ob-indigo-700 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                >
                  Return to Authorized Workspace ({getInitialTabForRole(currentUser.role).replace(/_/g, ' ')})
                </button>
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'ADMIN_DASHBOARD' && (
                <AdminDashboard
                  currentUser={currentUser}
                  onNavigateTab={(tab) => setActiveTab(tab)}
                  onUserStatusChanged={() => refreshData()}
                />
              )}

              {activeTab === 'DEPT_REPORT_MANAGEMENT' && (
                <DepartmentReportManagement
                  currentUser={currentUser}
                  onBackToDashboard={() => setActiveTab('ADMIN_DASHBOARD')}
                />
              )}

              {activeTab === 'MAKER_WORKSPACE' && (
                <MakerWorkspace
                  templates={templates}
                  submissions={submissions}
                  currentUser={currentUser}
                  onSelectSubmission={handleSelectSubmission}
                  onCreateDraft={handleCreateDraft}
                  onSubmitToChecker={handleSubmitToChecker}
                  onDeleteSubmission={handleDeleteSubmission}
                  onReuseSubmission={handleReuseSubmission}
                />
              )}

              {activeTab === 'LIBRARY' && (
                <MakerLibraryView
                  currentUser={currentUser}
                  templates={templates}
                  submissions={submissions}
                  onSelectSubmission={handleSelectSubmission}
                  onCreateDraft={handleCreateDraft}
                  onSubmitToChecker={handleSubmitToChecker}
                  onDeleteSubmission={handleDeleteSubmission}
                  onReuseSubmission={handleReuseSubmission}
                  onRefresh={() => refreshData()}
                />
              )}

              {activeTab === 'CHECKER_INBOX' && (
                <CheckerInbox
                  submissions={submissions}
                  templates={templates}
                  currentUser={currentUser}
                  onReviewSubmission={handleReviewSubmission}
                  onDeliverToNBE={handleDeliverToNBE}
                  onSwitchUser={handleSwitchUserSession}
                  onArchiveSubmission={handleArchiveSubmission}
                  checkerUser={DEMO_USERS[2]}
                />
              )}

              {activeTab === 'AUDITOR_DASHBOARD' && (
                <AuditorDashboard
                  currentUser={currentUser}
                  onNavigateToReport={(reportKey) => {
                    const t = getReportByKey(reportKey);
                    if (t) {
                      const sub = submissions.find((s) => s.reportKey === reportKey);
                      if (sub) {
                        setEditingSubmission(sub);
                      }
                    }
                  }}
                />
              )}

              {activeTab === 'NBE_SIMULATOR' && currentUser?.role === 'ADMIN' && <NbeSimulatorView />}

              {activeTab === 'PHASE2_SSOT' && currentUser?.role === 'ADMIN' && (
                <Phase2SSOTView
                  templates={templates}
                  currentUser={currentUser}
                  onOpenGeneratedSubmission={handleOpenGeneratedSubmission}
                />
              )}

              {activeTab === 'AUDIT_TRAIL' && <AuditTrailView />}

              {activeTab === 'SYSTEM_HEALTH' && currentUser?.role === 'ADMIN' && (
                <SystemHealthDashboard currentUser={currentUser} />
              )}

              {activeTab === 'DOCUMENTATION' && <DocumentationView templates={templates} />}
            </>
          )}

          {/* Centralized Application Shell Workspace Footer */}
          <footer className="mt-auto pt-6 pb-2 text-center text-[11px] text-slate-400 dark:text-slate-500 border-t border-slate-200/60 dark:border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-1 shrink-0 transition-colors">
            <div>© 2026 Oromia Bank S.C. All rights reserved.</div>
            <div className="text-[10px] sm:text-[11px]">
              National Bank of Ethiopia · BSD/03/2020 Supervisory Governance
            </div>
          </footer>
        </main>
      </div>

      {/* 3. Mobile Bottom Tab Navigation Bar (Strictly on Phones & Small Tablets < 768px when not editing) */}
      {!editingSubmission && (
        <BottomNavigation
          activeTab={activeTab}
          onSelectTab={(tab) => {
            setActiveTab(tab);
            setEditingSubmission(null);
            setIsMobileDrawerOpen(false);
          }}
          currentUser={currentUser}
          pendingCheckerCount={pendingCheckerCount}
          onOpenMobileDrawer={() => setIsMobileDrawerOpen(true)}
        />
      )}

      {/* Global Command Palette Modal (Ctrl+K) */}
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigateTab={(tab) => {
          setActiveTab(tab);
          setEditingSubmission(null);
        }}
        onSelectReturn={(key) => handleOpenGeneratedSubmission(key)}
        templates={templates}
        currentUser={currentUser}
        onOpenShortcutsModal={() => setIsShortcutsModalOpen(true)}
      />

      {/* Global Keyboard Shortcuts Cheat Sheet Modal (?) */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />

      {/* Centralized Theme Synchronization & Mismatch Monitor */}
      <ThemeSyncMonitor />

      {/* Global Mobile Input Accessory View that listens for document focus events */}
      {!editingSubmission && <InputAccessoryView />}

      {/* Global Toast / Hardware Verification Notification */}
      {toastNotification && (
        <div
          role="alert"
          aria-live="polite"
          className="fixed bottom-5 right-4 sm:right-6 z-50 max-w-sm sm:max-w-md w-full animate-in fade-in slide-in-from-bottom-3 duration-300 pointer-events-auto"
        >
          {toastNotification.type === 'hardware' ? (
            <div className="bg-slate-900/95 dark:bg-slate-950/98 backdrop-blur-md text-white rounded-2xl p-4 shadow-2xl border border-emerald-500/40 ring-1 ring-emerald-500/20 relative overflow-hidden transition-all">
              {/* Subtle ambient decorative accents */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none -mr-10 -mt-10" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-ob-indigo-500/10 rounded-full blur-xl pointer-events-none -ml-8 -mb-8" />

              <div className="flex items-start gap-3 relative z-10">
                {/* Hardware Verification Icon */}
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-ob-indigo-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0 text-emerald-400 shadow-inner">
                  {toastNotification.iconType === 'dual' ? (
                    <div className="relative flex items-center justify-center">
                      <Fingerprint className="w-5 h-5 text-emerald-400" />
                      <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-900" />
                    </div>
                  ) : toastNotification.iconType === 'camera' ? (
                    <Camera className="w-5 h-5 text-emerald-400" />
                  ) : toastNotification.iconType === 'fingerprint' ? (
                    <Fingerprint className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pr-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs font-bold text-white tracking-tight">
                      {toastNotification.title || 'Device Hardware Verified'}
                    </span>
                    {toastNotification.badgeLabel && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span>{toastNotification.badgeLabel}</span>
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-200 leading-relaxed font-normal">
                    {toastNotification.message}
                  </p>

                  {toastNotification.sensorDetails && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="truncate">{toastNotification.sensorDetails}</span>
                    </div>
                  )}

                  {toastNotification.userName && (
                    <div className="mt-1 text-[10px] text-slate-400">
                      Authenticated session: <span className="font-medium text-slate-300">{toastNotification.userName}</span>{' '}
                      <span className="opacity-70">({toastNotification.userRole})</span>
                    </div>
                  )}
                </div>

                {/* Dismiss button */}
                <button
                  onClick={() => setToastNotification(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors shrink-0"
                  title="Dismiss alert"
                  aria-label="Dismiss alert"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            /* Standard toast */
            <div className="bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-2xl border border-ob-indigo-800/80 flex items-center gap-2 justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-ob-green-400 animate-pulse" />
                <span>{toastNotification.message}</span>
              </div>
              <button
                onClick={() => setToastNotification(null)}
                className="text-slate-400 hover:text-white p-0.5 ml-2 rounded hover:bg-white/10"
                aria-label="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Phase 27: Leave-Page Navigation Safety Modal */}
      {leaveSafetyModalOpen && pendingNavigationAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border-2 border-amber-300 dark:border-amber-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Unsaved Regulatory Return Changes
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  You have unsaved changes in return <strong className="font-mono">{editingSubmission?.reportKey}</strong>.
                  The system attempted to flush them to the server before navigating, but persistence failed:
                </p>
                {pendingNavigationAction.errorMsg && (
                  <div className="mt-2 p-2 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-[11px] font-mono break-words">
                    {pendingNavigationAction.errorMsg}
                  </div>
                )}
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                  Navigating away now will permanently discard your unsaved work.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setLeaveSafetyModalOpen(false);
                  setPendingNavigationAction(null);
                }}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                Stay on Return
              </button>
              <button
                type="button"
                onClick={() => {
                  setLeaveSafetyModalOpen(false);
                  if (pendingNavigationAction.type === 'SWITCH_TAB' && pendingNavigationAction.targetTab) {
                    setActiveTab(pendingNavigationAction.targetTab);
                  }
                  setEditingSubmission(null);
                  setPendingNavigationAction(null);
                }}
                className="px-3.5 py-1.5 text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950 hover:bg-rose-100 dark:hover:bg-rose-900 border border-rose-300 dark:border-rose-800 rounded-lg transition-colors cursor-pointer"
              >
                Discard & Leave
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const saved = await navigationGuardRef.current?.flush();
                    if (saved) {
                      setLeaveSafetyModalOpen(false);
                      if (pendingNavigationAction.type === 'SWITCH_TAB' && pendingNavigationAction.targetTab) {
                        setActiveTab(pendingNavigationAction.targetTab);
                      }
                      setEditingSubmission(null);
                      setPendingNavigationAction(null);
                    }
                  } catch (err: any) {
                    setPendingNavigationAction((prev) => (prev ? { ...prev, errorMsg: err.message } : null));
                  }
                }}
                className="px-4 py-1.5 text-xs font-bold text-white bg-ob-indigo-600 hover:bg-ob-indigo-700 rounded-lg transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Save</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 28 & 27: Explicit Logout Confirmation Dialog with Autosave Flush */}
      {logoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-ob-indigo-100 dark:bg-ob-indigo-950 flex items-center justify-center text-ob-indigo-600 dark:text-ob-indigo-400 shrink-0">
                <LogOut className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Confirm Portal Sign Out
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Are you sure you want to end your session as <strong>{currentUser?.name}</strong> ({currentUser?.role})?
                </p>
                {editingSubmission && navigationGuardRef.current?.hasUnsavedChanges() && (
                  <div className="mt-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Pending return changes detected:</span>
                      <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                        Changes to return <strong>{editingSubmission.reportKey}</strong> will be flushed to the server before sign out.
                      </p>
                    </div>
                  </div>
                )}
                {logoutFlushError && (
                  <div className="mt-2 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs">
                    <span className="font-bold">Save failed: </span>
                    <span>{logoutFlushError}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setLogoutModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              {logoutFlushError ? (
                <>
                  <button
                    type="button"
                    onClick={executeLogout}
                    className="px-3.5 py-1.5 text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950 hover:bg-rose-100 dark:hover:bg-rose-900 border border-rose-300 dark:border-rose-800 rounded-lg transition-colors cursor-pointer"
                  >
                    Discard & Sign Out
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmLogout}
                    disabled={isLoggingOut}
                    className="px-4 py-1.5 text-xs font-bold text-white bg-ob-indigo-600 hover:bg-ob-indigo-700 rounded-lg transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
                  >
                    {isLoggingOut && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Retry Save & Sign Out</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleConfirmLogout}
                  disabled={isLoggingOut}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-ob-indigo-600 hover:bg-ob-indigo-700 rounded-lg transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
                >
                  {isLoggingOut && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm Sign Out</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
