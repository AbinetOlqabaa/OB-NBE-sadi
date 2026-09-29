/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  ReportMetadata,
  ReportSubmission,
  UserSession,
  DynamicRowRecord,
} from './types/regulatory';
import { getAllReports, getReportByKey, subscribeReports } from './data/report-registry';
import { submissionService, DEMO_USERS } from './services/submissionService';
import { indexedDbStorage } from './services/indexedDbStorage';
import { userService } from './services/userService';
import { departmentService } from './services/departmentService';
import { Navbar } from './components/Navbar';
import { Sidebar, ViewTab } from './components/Sidebar';
import { AdminDashboard } from './components/AdminDashboard';
import { DepartmentReportManagement } from './components/DepartmentReportManagement';
import { MakerWorkspace } from './components/MakerWorkspace';
import { CheckerInbox } from './components/CheckerInbox';
import { AuditorDashboard } from './components/AuditorDashboard';
import { DynamicReportForm } from './components/DynamicReportForm';
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
  CheckCircle2,
  X,
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

export default function App() {
  // First visitor starts on the Login Page
  const [currentUser, setCurrentUser] = useState<UserSession | null>(() => {
    try {
      const stored = localStorage.getItem('ob_logged_in_user');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {}
    return null;
  });

  const [authView, setAuthView] = useState<'LOGIN' | 'REGISTER'>('LOGIN');

  // Initial dashboard tab based on role
  const getInitialTabForRole = (role?: string): ViewTab => {
    if (role === 'ADMIN') return 'ADMIN_DASHBOARD';
    if (role === 'CHECKER') return 'CHECKER_INBOX';
    if (role === 'AUDITOR') return 'AUDITOR_DASHBOARD';
    return 'MAKER_WORKSPACE';
  };

  const [activeTab, setActiveTab] = useState<ViewTab>(() =>
    currentUser ? getInitialTabForRole(currentUser.role) : 'MAKER_WORKSPACE'
  );

  const [templates, setTemplates] = useState<ReportMetadata[]>(getAllReports());
  const [submissions, setSubmissions] = useState<ReportSubmission[]>(submissionService.getAll());
  const [editingSubmission, setEditingSubmission] = useState<ReportSubmission | null>(null);
  const [toastNotification, setToastNotification] = useState<ToastNotification | null>(null);
  const toastTimeoutRef = React.useRef<any>(null);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

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
      setActiveTab(tab);
      setEditingSubmission(null);
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
        setActiveTab('MAKER_WORKSPACE');
        setEditingSubmission(null);
        showToast('Navigated to Maker Workspace (Ctrl+M)');
        return;
      }

      // 5. Ctrl+Shift+C / Cmd+Shift+C: Jump to Checker Inbox
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        if (currentUser.role === 'CHECKER' || currentUser.role === 'ADMIN') {
          setActiveTab('CHECKER_INBOX');
          setEditingSubmission(null);
          showToast('Navigated to Checker Inbox (Ctrl+Shift+C)');
        }
        return;
      }

      // 6. Ctrl+Shift+A / Cmd+Shift+A: Jump to Admin Dashboard
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        if (currentUser.role === 'ADMIN') {
          setActiveTab('ADMIN_DASHBOARD');
          setEditingSubmission(null);
          showToast('Navigated to Admin Governance (Ctrl+Shift+A)');
        }
        return;
      }

      // 6b. Ctrl+Shift+M / Cmd+Shift+M: Jump to Departments & Reports Management
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        if (currentUser.role === 'ADMIN') {
          setActiveTab('DEPT_REPORT_MANAGEMENT');
          setEditingSubmission(null);
          showToast('Navigated to Departments & Reports Governance (Ctrl+Shift+M)');
        }
        return;
      }

      // 7. Ctrl+Shift+N / Cmd+Shift+N: Jump to NBE Simulator
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setActiveTab('NBE_SIMULATOR');
        setEditingSubmission(null);
        showToast('Navigated to NBE API Gateway Simulator (Ctrl+Shift+N)');
        return;
      }

      // 8. Ctrl+Shift+S / Cmd+Shift+S: Jump to Phase 2 SSOT
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        setActiveTab('PHASE2_SSOT');
        setEditingSubmission(null);
        showToast('Navigated to Phase 2 SSOT Medallion Lakehouse (Ctrl+Shift+S)');
        return;
      }

      // 9. Ctrl+Shift+L / Cmd+Shift+L: Jump to Audit Trail
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setActiveTab('AUDIT_TRAIL');
        setEditingSubmission(null);
        showToast('Navigated to Regulatory Audit Trail (Ctrl+Shift+L)');
        return;
      }

      // 10. Ctrl+Shift+D / Cmd+Shift+D: Jump to Documentation
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setActiveTab('DOCUMENTATION');
        setEditingSubmission(null);
        showToast('Navigated to NBE Specifications & Documentation (Ctrl+Shift+D)');
        return;
      }

      // 11. Ctrl+Shift+H / Cmd+Shift+H: Jump to System Health
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setActiveTab('SYSTEM_HEALTH');
        setEditingSubmission(null);
        showToast('Navigated to System Health Telemetry Dashboard (Ctrl+Shift+H)');
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
  const handleLoginSuccess = async (user: UserSession, redirectTab?: string) => {
    // 1. Trigger subtle tactile haptic feedback confirming login & verified hardware
    triggerHardwareVerificationHaptic();

    // 2. Set current authenticated user & persist
    setCurrentUser(user);
    try {
      localStorage.setItem('ob_logged_in_user', JSON.stringify(user));
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

  // Logout handler
  const handleLogout = () => {
    setCurrentUser(null);
    setEditingSubmission(null);
    try {
      localStorage.removeItem('ob_logged_in_user');
    } catch {}
    setAuthView('LOGIN');
    showToast('Logged out of Oromia Bank Regulatory Portal.');
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

  // Save changes to current submission
  const handleSaveDraft = (
    values: Record<string, string | number>,
    dynamicRows: Record<number, DynamicRowRecord[]>
  ) => {
    if (!editingSubmission || !currentUser) return;
    try {
      vibrate(25);
      const updated = submissionService.updateDraft(
        editingSubmission.id,
        values,
        dynamicRows,
        currentUser
      );
      setEditingSubmission(updated);
      setSubmissions(submissionService.getAll());
      showToast('Changes saved to draft.');
    } catch (err: any) {
      alert(`Save error: ${err.message}`);
    }
  };

  // Submit to Checker for approval
  const handleSubmitToChecker = (subId: string, comment?: string) => {
    if (!currentUser) return;
    try {
      vibrate([25, 40, 35]);
      const updated = submissionService.submitToChecker(
        subId,
        currentUser,
        comment || 'Prepared and submitted for Checker review.'
      );
      setSubmissions(submissionService.getAll());
      if (editingSubmission?.id === subId) {
        setEditingSubmission(updated);
      }
      showToast(`Return ${updated.reportKey} submitted to Checker queue for 4-eyes sign-off.`);
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
        onLogout={handleLogout}
        onNavigateToSimulator={() => {
          setActiveTab('NBE_SIMULATOR');
          setEditingSubmission(null);
        }}
      />

      {/* 2. Main Window Container (Equal Full Length between Sidebar and Viewport) */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Left Navigation Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={(tab) => {
            setActiveTab(tab);
            setEditingSubmission(null);
            setIsMobileDrawerOpen(false);
          }}
          currentUser={currentUser}
          pendingCheckerCount={pendingCheckerCount}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebar}
          isMobileDrawerOpen={isMobileDrawerOpen}
          onCloseMobileDrawer={() => setIsMobileDrawerOpen(false)}
          onLogout={handleLogout}
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
                editingSubmission.status === 'APPROVED' ||
                editingSubmission.status === 'SENT' ||
                currentUser.role === 'CHECKER'
              }
              onBack={() => setEditingSubmission(null)}
              onSave={handleSaveDraft}
              onSubmitToChecker={(comment) => {
                handleSubmitToChecker(editingSubmission.id, comment);
              }}
            />
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

              {activeTab === 'NBE_SIMULATOR' && <NbeSimulatorView />}

              {activeTab === 'PHASE2_SSOT' && (
                <Phase2SSOTView
                  templates={templates}
                  onOpenGeneratedSubmission={handleOpenGeneratedSubmission}
                />
              )}

              {activeTab === 'AUDIT_TRAIL' && <AuditTrailView />}

              {activeTab === 'SYSTEM_HEALTH' && (
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
    </div>
  );
}
