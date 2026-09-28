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
import { userService } from './services/userService';
import { departmentService } from './services/departmentService';
import { Navbar } from './components/Navbar';
import { Sidebar, ViewTab } from './components/Sidebar';
import { AdminDashboard } from './components/AdminDashboard';
import { DepartmentReportManagement } from './components/DepartmentReportManagement';
import { MakerWorkspace } from './components/MakerWorkspace';
import { CheckerInbox } from './components/CheckerInbox';
import { DynamicReportForm } from './components/DynamicReportForm';
import { NbeSimulatorView } from './components/NbeSimulatorView';
import { Phase2SSOTView } from './components/Phase2SSOTView';
import { AuditTrailView } from './components/AuditTrailView';
import { DocumentationView } from './components/DocumentationView';
import { LoginPage } from './components/LoginPage';
import { RegisterPage } from './components/RegisterPage';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { ThemeSyncMonitor } from './components/ThemeSyncMonitor';
import { BottomNavigation } from './components/BottomNavigation';
import { InputAccessoryView } from './components/InputAccessoryView';
import { useSwipeGesture } from './hooks/useSwipeGesture';
import { vibrate, haptics } from './utils/haptics';

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
    return 'MAKER_WORKSPACE';
  };

  const [activeTab, setActiveTab] = useState<ViewTab>(() =>
    currentUser ? getInitialTabForRole(currentUser.role) : 'MAKER_WORKSPACE'
  );

  const [templates, setTemplates] = useState<ReportMetadata[]>(getAllReports());
  const [submissions, setSubmissions] = useState<ReportSubmission[]>(submissionService.getAll());
  const [editingSubmission, setEditingSubmission] = useState<ReportSubmission | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
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
    return () => {
      unsubReports();
      unsubDepts();
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Login handler
  const handleLoginSuccess = (user: UserSession, redirectTab?: string) => {
    setCurrentUser(user);
    try {
      localStorage.setItem('ob_logged_in_user', JSON.stringify(user));
    } catch {}

    const targetTab = (redirectTab as ViewTab) || getInitialTabForRole(user.role);
    setActiveTab(targetTab);
    setEditingSubmission(null);
    showToast(`Welcome, ${user.name}! Logged in as ${user.role}.`);
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
    <div className="h-[100dvh] max-h-[100dvh] w-screen overflow-hidden flex flex-col font-sans bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased selection:bg-ob-indigo-600 selection:text-white transition-colors">
      {/* 1. Top Navigation Bar (Strictly Fixed Height h-14 / h-16) */}
      <Navbar
        currentUser={currentUser}
        onSwitchUser={handleSwitchUserSession}
        activeView={activeTab}
        pendingCheckerCount={pendingCheckerCount}
        isSidebarCollapsed={isSidebarCollapsed}
        onToggleSidebar={toggleSidebar}
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
          className="flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden flex flex-col p-2.5 sm:p-4 touch-scroll-y relative"
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

              {activeTab === 'NBE_SIMULATOR' && <NbeSimulatorView />}

              {activeTab === 'PHASE2_SSOT' && (
                <Phase2SSOTView
                  templates={templates}
                  onOpenGeneratedSubmission={handleOpenGeneratedSubmission}
                />
              )}

              {activeTab === 'AUDIT_TRAIL' && <AuditTrailView />}

              {activeTab === 'DOCUMENTATION' && <DocumentationView templates={templates} />}
            </>
          )}
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

      {/* Global Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#121428] text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-2xl border border-ob-indigo-800/80 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <span className="w-2 h-2 rounded-full bg-ob-green-400 animate-pulse"></span>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
