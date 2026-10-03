/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  FileText,
  Inbox,
  Send,
  Database,
  History,
  HelpCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Users,
  LogOut,
  Search,
  X,
  Network,
  Fingerprint,
  ScanFace,
  Sliders,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Activity,
  ShieldAlert,
  BookOpen,
} from 'lucide-react';
import { UserSession } from '../types/regulatory';
import {
  isBiometricLoginEnabled,
  setBiometricLoginEnabled,
  subscribeToBiometricPreferenceChanges,
  getDeviceCapabilities,
  DeviceCapabilities,
} from '../utils/deviceCapabilities.ts';
import { recordBiometricAuditLog } from './AuditTrailView.tsx';
import { triggerHaptic, vibrate } from '../utils/haptics.ts';
import { UserSettingsModal } from './UserSettingsModal.tsx';

export type ViewTab =
  | 'ADMIN_DASHBOARD'
  | 'DEPT_REPORT_MANAGEMENT'
  | 'MAKER_WORKSPACE'
  | 'LIBRARY'
  | 'CHECKER_INBOX'
  | 'AUDITOR_DASHBOARD'
  | 'NBE_SIMULATOR'
  | 'PHASE2_SSOT'
  | 'AUDIT_TRAIL'
  | 'DOCUMENTATION'
  | 'SYSTEM_HEALTH';

interface SidebarProps {
  activeTab: ViewTab;
  onSelectTab: (tab: ViewTab) => void;
  currentUser: UserSession;
  pendingCheckerCount: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileDrawerOpen?: boolean;
  onCloseMobileDrawer?: () => void;
  onLogout?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenShortcutsModal?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  currentUser,
  pendingCheckerCount,
  isCollapsed,
  onToggleCollapse,
  isMobileDrawerOpen = false,
  onCloseMobileDrawer,
  onLogout,
  onOpenCommandPalette,
  onOpenShortcutsModal,
}) => {
  const isMac = typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const modKey = isMac ? '⌘' : 'Ctrl';

  // User Biometric Login Preference (individual setting per user)
  const [isBiometricEnabled, setIsBiometricEnabled] = useState<boolean>(() =>
    isBiometricLoginEnabled(currentUser.email)
  );
  const [deviceCaps, setDeviceCaps] = useState<DeviceCapabilities | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'SETTINGS' | 'HISTORY'>('SETTINGS');

  // Sync preference state if user changes or external preference event is fired
  useEffect(() => {
    setIsBiometricEnabled(isBiometricLoginEnabled(currentUser.email));
  }, [currentUser.email]);

  useEffect(() => {
    const unsub = subscribeToBiometricPreferenceChanges((detail) => {
      if (!detail.userEmail || detail.userEmail.toLowerCase() === currentUser.email.toLowerCase()) {
        setIsBiometricEnabled(detail.enabled);
      }
    });
    return unsub;
  }, [currentUser.email]);

  // Load hardware status to display sensor feedback next to toggle
  useEffect(() => {
    let isMounted = true;
    getDeviceCapabilities(currentUser.email)
      .then((caps) => {
        if (isMounted) setDeviceCaps(caps);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [currentUser.email, isBiometricEnabled]);

  const handleToggleBiometric = useCallback(() => {
    const nextState = !isBiometricEnabled;
    setIsBiometricEnabled(nextState);
    setBiometricLoginEnabled(nextState, currentUser.email);
    triggerHaptic('selection');
    vibrate(20);

    // Record regulatory audit trail event
    recordBiometricAuditLog({
      actorId: currentUser.email,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      action: nextState ? 'BIOMETRIC_PREFERENCE_ENABLED' : 'BIOMETRIC_PREFERENCE_DISABLED',
      type: 'FINGERPRINT',
      entityId: currentUser.email,
      details: `[User Settings] Biometric Login hardware authentication was ${
        nextState ? 'ENABLED' : 'DISABLED'
      } by user for account ${currentUser.email}.`,
    }).catch(() => {});
  }, [isBiometricEnabled, currentUser]);

  // Listen for Ctrl+B or Cmd+B to toggle sidebar collapse
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        onToggleCollapse();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToggleCollapse]);

  // Handle Escape key to close mobile drawer
  useEffect(() => {
    if (!isMobileDrawerOpen || !onCloseMobileDrawer) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseMobileDrawer();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isMobileDrawerOpen, onCloseMobileDrawer]);

  // Prevent background scrolling when mobile drawer is open
  useEffect(() => {
    if (isMobileDrawerOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isMobileDrawerOpen]);

  // Complete nav items catalog with associated global keyboard shortcuts
  const allNavItems = [
    {
      id: 'ADMIN_DASHBOARD' as ViewTab,
      label: 'Admin Governance',
      shortLabel: 'Admin',
      icon: Users,
      description: 'Super user lifecycle & controls',
      badge: null,
      shortcut: `${modKey}+⇧+A`,
      roles: ['ADMIN'],
    },
    {
      id: 'DEPT_REPORT_MANAGEMENT' as ViewTab,
      label: 'Departments & Reports',
      shortLabel: 'Dept & Reports',
      icon: Network,
      description: 'Bank hierarchy, report types & linkages',
      badge: null,
      shortcut: `${modKey}+⇧+M`,
      roles: ['ADMIN'],
    },
    {
      id: 'MAKER_WORKSPACE' as ViewTab,
      label: 'Maker Workspace',
      shortLabel: 'Maker',
      icon: FileText,
      description: 'Report catalog & dynamic forms',
      badge: null,
      shortcut: `${modKey}+M`,
      roles: ['ADMIN', 'MAKER'],
    },
    {
      id: 'LIBRARY' as ViewTab,
      label: 'Library & Dossiers',
      shortLabel: 'Library',
      icon: BookOpen,
      description: 'Authoritative drafts, in-progress & submissions',
      badge: null,
      shortcut: `${modKey}+L`,
      roles: ['ADMIN', 'MAKER', 'CHECKER', 'AUDITOR'],
    },
    {
      id: 'CHECKER_INBOX' as ViewTab,
      label: 'Checker Inbox',
      shortLabel: 'Checker',
      icon: Inbox,
      description: 'Review & approval workflows',
      badge: pendingCheckerCount > 0 ? pendingCheckerCount : null,
      shortcut: `${modKey}+⇧+C`,
      roles: ['ADMIN', 'CHECKER'],
    },
    {
      id: 'AUDITOR_DASHBOARD' as ViewTab,
      label: 'Auditor Workspace',
      shortLabel: 'Auditor',
      icon: ShieldAlert,
      description: 'Audit work queue, findings & evidence',
      badge: null,
      shortcut: `${modKey}+⇧+A`,
      roles: ['ADMIN', 'AUDITOR'],
    },
    {
      id: 'NBE_SIMULATOR' as ViewTab,
      label: 'NBE Simulator',
      shortLabel: 'Simulator',
      icon: Send,
      description: 'Intake console & test probe',
      badge: null,
      shortcut: `${modKey}+⇧+N`,
      roles: ['ADMIN'],
    },
    {
      id: 'PHASE2_SSOT' as ViewTab,
      label: 'Data Pipeline (SSOT)',
      shortLabel: 'SSOT',
      icon: Database,
      description: 'Lakehouse & GL reconcile',
      badge: null,
      shortcut: `${modKey}+⇧+S`,
      roles: ['ADMIN'],
    },
    {
      id: 'AUDIT_TRAIL' as ViewTab,
      label: 'Audit Trail Ledger',
      shortLabel: 'Audit',
      icon: History,
      description: 'Immutable event history',
      badge: null,
      shortcut: `${modKey}+⇧+L`,
      roles: ['ADMIN', 'CHECKER', 'MAKER', 'NBE_OFFICER', 'AUDITOR'],
    },
    {
      id: 'SYSTEM_HEALTH' as ViewTab,
      label: 'System Health',
      shortLabel: 'Hardware',
      icon: Activity,
      description: 'Real-time sensors & enclave telemetry',
      badge: null,
      shortcut: `${modKey}+⇧+H`,
      roles: ['ADMIN'],
    },
    {
      id: 'DOCUMENTATION' as ViewTab,
      label: 'NBE Specifications',
      shortLabel: 'Docs',
      icon: HelpCircle,
      description: 'Regulatory contracts & formulas',
      badge: null,
      shortcut: `${modKey}+⇧+D`,
      roles: ['ADMIN', 'MAKER', 'CHECKER', 'NBE_OFFICER', 'AUDITOR'],
    },
  ];

  // Filter based on user's authorized role
  const visibleNavItems = allNavItems.filter((item) =>
    item.roles.includes(currentUser.role)
  );

  return (
    <>
      {/* Mobile Slide-Out Drawer (Touch-Optimized for Phones & Small Tablets) */}
      {isMobileDrawerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Navigation Drawer"
          className="fixed inset-0 z-50 md:hidden flex animate-in fade-in duration-200"
        >
          {/* Backdrop Blur Overlay */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobileDrawer}
            aria-hidden="true"
          />

          {/* Drawer Content */}
          <div className="relative w-72 max-w-[85vw] bg-ob-blue-500 text-white flex flex-col justify-between h-full z-10 shadow-2xl border-r border-ob-blue-600/80 animate-in slide-in-from-left duration-200">
            {/* Drawer Header */}
            <div className="p-4 border-b border-ob-blue-600/80 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="bg-white p-1 rounded-lg shrink-0">
                  <img
                    src="/brand/oromia-logo-mark-transparent.png"
                    alt="Oromia Bank"
                    className="w-6 h-6 object-contain"
                  />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white tracking-tight leading-tight">Oromia Bank</h3>
                  <p className="text-[10px] text-white/80 font-medium">Regulatory Portal</p>
                </div>
              </div>

              <button
                type="button"
                onClick={onCloseMobileDrawer}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Close navigation drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Unified Scrollable Workspace Body */}
            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3 touch-scroll-y flex flex-col justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-white/75 px-2 py-1 block">
                  Workspaces & Services
                </span>
                <nav className="space-y-1">
                  {visibleNavItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          onSelectTab(item.id);
                          if (onCloseMobileDrawer) onCloseMobileDrawer();
                        }}
                        className={`w-full min-h-[48px] flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all touch-manipulation touch-press cursor-pointer ${
                          isActive
                            ? 'bg-ob-blue-800 text-white font-bold shadow-md ring-1 ring-white/30'
                            : 'text-white/85 hover:text-white hover:bg-white/10 font-semibold text-xs'
                        }`}
                      >
                        <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-white/80'}`} />
                        <div className="flex-1 truncate">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs">{item.label}</span>
                            {item.badge && item.badge > 0 && (
                              <span className="px-1.5 py-0.2 rounded-full bg-ob-green-500 text-slate-950 font-mono text-[9px] font-bold shadow-xs">
                                {item.badge}
                              </span>
                            )}
                          </div>
                          <span className={`text-[10px] font-normal block truncate ${isActive ? 'text-ob-blue-100' : 'text-white/70'}`}>
                            {item.description}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* Drawer User Settings, Profile & Prominent Logout (Scroll-safe on Mobile Landscape) */}
              <div className="pt-3 border-t border-ob-blue-600/80 bg-ob-blue-600/25 -mx-3 -mb-3 p-3.5 space-y-2.5 shrink-0 pb-safe">
                {/* User Settings: Biometric Login Toggle */}
                <div className="p-2.5 rounded-xl bg-ob-blue-800/60 border border-white/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Fingerprint className="w-3.5 h-3.5 text-ob-green-300" />
                      <span className="text-[11px] font-bold text-white">Biometric Login</span>
                    </div>

                    {/* Toggle Switch */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isBiometricEnabled}
                      onClick={handleToggleBiometric}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-ob-green-400 touch-press ${
                        isBiometricEnabled ? 'bg-ob-green-500' : 'bg-ob-blue-900'
                      }`}
                      title={
                        isBiometricEnabled
                          ? 'Disable hardware authentication'
                          : 'Enable hardware authentication'
                      }
                    >
                      <span className="sr-only">Toggle Biometric Login</span>
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                          isBiometricEnabled ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <p className="text-[10px] text-white/80 leading-tight">
                    {isBiometricEnabled
                      ? 'Hardware authentication active for one-touch sign-in.'
                      : 'Disabled. Password will be required on sign-in.'}
                  </p>

                  {/* Hardware Readiness Status Badges */}
                  {isBiometricEnabled && deviceCaps && (
                    <div className="pt-1.5 border-t border-white/15 flex items-center justify-between text-[9px] text-white/80">
                      <div className="flex items-center gap-1">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            deviceCaps.isFingerprintSupported ? 'bg-ob-green-400' : 'bg-white/40'
                          }`}
                        />
                        <span>Fingerprint: {deviceCaps.isFingerprintSupported ? 'Ready' : 'Unavailable'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            deviceCaps.cameraStatus.statusLevel === 'PERMISSION_DENIED'
                              ? 'bg-rose-300'
                              : deviceCaps.isCameraSupported
                              ? 'bg-ob-green-300'
                              : 'bg-white/40'
                          }`}
                        />
                        <span>
                          Face ID:{' '}
                          {deviceCaps.cameraStatus.statusLevel === 'PERMISSION_DENIED'
                            ? 'Denied'
                            : deviceCaps.isCameraSupported
                            ? 'Ready'
                            : 'Unavailable'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2.5 p-2 rounded-xl bg-ob-blue-800/60 border border-white/20">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-white truncate">{currentUser.name}</div>
                    <div className="text-[10px] text-ob-green-300 font-mono flex items-center gap-1">
                      <span>{currentUser.role}</span>
                      <span className="text-white/40">•</span>
                      <span className="text-white/80 truncate">{currentUser.department || 'Oromia Bank'}</span>
                    </div>
                  </div>
                </div>

                {/* Authentication History & Hardware Settings Buttons */}
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSettingsTab('HISTORY');
                      setIsSettingsOpen(true);
                    }}
                    className="min-h-[40px] flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-semibold text-white/90 hover:text-white bg-white/10 hover:bg-white/20 border border-white/20 transition-colors cursor-pointer"
                    title="View hardware authentication audit history"
                  >
                    <History className="w-3.5 h-3.5 text-ob-green-300" />
                    <span>Auth History</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSettingsTab('SETTINGS');
                      setIsSettingsOpen(true);
                    }}
                    className="min-h-[40px] flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-semibold text-white/90 hover:text-white bg-white/10 hover:bg-white/20 border border-white/20 transition-colors cursor-pointer"
                    title="Configure biometric preferences"
                  >
                    <Sliders className="w-3.5 h-3.5 text-ob-green-300" />
                    <span>Settings</span>
                  </button>
                </div>

                {onLogout && (
                  <button
                    type="button"
                    onClick={() => {
                      if (onCloseMobileDrawer) onCloseMobileDrawer();
                      onLogout();
                    }}
                    className="w-full min-h-[48px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-500/30 hover:bg-rose-600 border border-rose-300/40 hover:border-rose-600 shadow-md transition-colors touch-press cursor-pointer"
                    aria-label="Log Out of OB Regulatory Platform"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Log Out</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Desktop / Tablet Sidebar (Hidden on Mobile phones < 768px) */}
      <aside
        className={`hidden md:flex bg-ob-blue-500 text-white flex-col justify-between shrink-0 h-full transition-all duration-300 ease-in-out border-r border-ob-blue-600/80 z-20 ${
          isCollapsed ? 'w-16' : 'w-64'
        }`}
      >
      {/* Top Header & Navigation */}
      <div className={`flex-1 min-h-0 overflow-y-auto space-y-3 ${isCollapsed ? 'p-2' : 'p-3'}`}>
        {/* Sidebar Header & Collapse Toggle */}
        <div
          className={`flex items-center ${
            isCollapsed ? 'justify-center py-1' : 'justify-between px-2 mb-2'
          }`}
        >
          {!isCollapsed && (
            <span className="text-[10px] uppercase font-bold tracking-wider text-white/80">
              Role Navigation
            </span>
          )}
          <button
            type="button"
            onClick={onToggleCollapse}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors focus:outline-none cursor-pointer"
            title={
              isCollapsed
                ? 'Expand sidebar (Ctrl+B)'
                : 'Collapse sidebar (Ctrl+B)'
            }
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="w-4 h-4 text-white" />
            ) : (
              <PanelLeftClose className="w-4 h-4 text-white/80 hover:text-white" />
            )}
          </button>
        </div>

        {/* Navigation Item Buttons */}
        <nav className="space-y-1" aria-label="Regulatory Navigation">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center transition-all rounded-xl text-left relative group cursor-pointer ${
                  isCollapsed
                    ? 'justify-center p-2.5'
                    : 'gap-3 px-3 py-2 text-xs font-semibold'
                } ${
                  isActive
                    ? 'bg-ob-blue-800 text-white shadow-md ring-1 ring-white/30'
                    : 'text-white/85 hover:text-white hover:bg-white/10'
                }`}
                title={isCollapsed ? `${item.label} - ${item.description}` : undefined}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 transition-transform ${
                    isActive ? 'text-white' : 'text-white/80 group-hover:text-white'
                  }`}
                />

                {!isCollapsed && (
                  <div className="flex-1 truncate">
                    <div className="leading-tight truncate flex items-center justify-between gap-1">
                      <span>{item.label}</span>
                      <kbd className={`text-[9px] font-mono px-1 py-0.2 rounded border ${
                        isActive
                          ? 'bg-ob-blue-900 border-ob-blue-400 text-white'
                          : 'bg-black/20 border-white/20 text-white/80 opacity-75 group-hover:opacity-100'
                      }`}>
                        {item.shortcut}
                      </kbd>
                    </div>
                    <div
                      className={`text-[10px] font-normal truncate ${
                        isActive ? 'text-ob-blue-100' : 'text-white/70 group-hover:text-white/90'
                      }`}
                    >
                      {item.description}
                    </div>
                  </div>
                )}

                {/* Badge if pending items */}
                {item.badge !== null && item.badge > 0 && (
                  <span
                    className={`shrink-0 font-mono font-bold rounded-full ${
                      isCollapsed
                        ? 'absolute top-1.5 right-1.5 w-2 h-2 p-0 bg-ob-green-500 ring-2 ring-ob-blue-600'
                        : 'px-1.5 py-0.2 text-[10px] bg-ob-green-500 text-slate-950 shadow-xs'
                    }`}
                  >
                    {!isCollapsed && item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Profile / Entity / Logout Area */}
      <div className={`p-3 border-t border-ob-blue-600/80 shrink-0 max-h-[50vh] overflow-y-auto touch-scroll-y ${isCollapsed ? 'text-center' : ''}`}>
        {!isCollapsed ? (
          <div className="space-y-2">
            {/* Quick Helper Buttons */}
            <div className="grid grid-cols-2 gap-1.5">
              {onOpenCommandPalette && (
                <button
                  type="button"
                  onClick={onOpenCommandPalette}
                  className="flex items-center justify-center gap-1 p-1.5 rounded-lg text-[11px] font-medium text-white/90 hover:text-white bg-white/10 hover:bg-white/20 border border-white/20 transition-colors cursor-pointer"
                  title={`Command Palette (${modKey}+K)`}
                >
                  <Search className="w-3 h-3 text-ob-green-300" />
                  <span>Search</span>
                  <kbd className="text-[9px] font-mono opacity-80 ml-0.5">{modKey}+K</kbd>
                </button>
              )}

              {onOpenShortcutsModal && (
                <button
                  type="button"
                  onClick={onOpenShortcutsModal}
                  className="flex items-center justify-center gap-1 p-1.5 rounded-lg text-[11px] font-medium text-white/90 hover:text-white bg-white/10 hover:bg-white/20 border border-white/20 transition-colors cursor-pointer"
                  title="Keyboard Shortcuts (?)"
                >
                  <HelpCircle className="w-3 h-3 text-ob-green-300" />
                  <span>Hotkeys</span>
                  <kbd className="text-[9px] font-mono opacity-80 ml-0.5">?</kbd>
                </button>
              )}
            </div>

            {/* User Settings: Biometric Login Toggle Switch */}
            <div className="p-2.5 rounded-xl bg-ob-blue-800/60 border border-white/20 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Fingerprint className="w-3.5 h-3.5 text-ob-green-300" />
                  <span className="text-[11px] font-bold text-white">Biometric Login</span>
                </div>

                {/* Toggle Switch */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={isBiometricEnabled}
                  onClick={handleToggleBiometric}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-ob-green-400 touch-press ${
                    isBiometricEnabled ? 'bg-ob-green-500' : 'bg-ob-blue-900'
                  }`}
                  title={
                    isBiometricEnabled
                      ? 'Disable hardware authentication'
                      : 'Enable hardware authentication'
                  }
                >
                  <span className="sr-only">Toggle Biometric Login</span>
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      isBiometricEnabled ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <p className="text-[10px] text-white/80 leading-tight">
                {isBiometricEnabled
                  ? 'Hardware authentication active for one-touch sign-in.'
                  : 'Disabled. Password will be required on sign-in.'}
              </p>

              {/* Hardware Readiness Status Badges */}
              {isBiometricEnabled && deviceCaps && (
                <div className="pt-1.5 border-t border-white/15 flex items-center justify-between text-[9px] text-white/80">
                  <div className="flex items-center gap-1">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        deviceCaps.isFingerprintSupported ? 'bg-ob-green-400' : 'bg-white/40'
                      }`}
                    />
                    <span>Fingerprint: {deviceCaps.isFingerprintSupported ? 'Ready' : 'Unavailable'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        deviceCaps.cameraStatus.statusLevel === 'PERMISSION_DENIED'
                          ? 'bg-rose-300'
                          : deviceCaps.isCameraSupported
                          ? 'bg-ob-green-300'
                          : 'bg-white/40'
                      }`}
                    />
                    <span>
                      Face ID:{' '}
                      {deviceCaps.cameraStatus.statusLevel === 'PERMISSION_DENIED'
                        ? 'Denied'
                        : deviceCaps.isCameraSupported
                        ? 'Ready'
                        : 'Unavailable'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2.5 p-2 rounded-xl bg-ob-blue-800/60 border border-white/20">
              <div className="w-8 h-8 rounded-lg bg-white p-1 flex items-center justify-center shrink-0 shadow-xs">
                <img
                  src="/brand/oromia-logo-mark-transparent.png"
                  alt="Oromia Bank Mark"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-white truncate">{currentUser.name}</div>
                <div className="text-[10px] text-ob-green-300 font-mono flex items-center gap-1">
                  <span>{currentUser.role}</span>
                  <span className="text-white/40">•</span>
                  <span className="text-white/80 truncate">{currentUser.institutionCode}</span>
                </div>
              </div>
            </div>

            {/* Authentication History & User Settings Quick Actions */}
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setSettingsTab('HISTORY');
                  setIsSettingsOpen(true);
                }}
                className="min-h-[36px] flex items-center justify-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-semibold text-white/90 hover:text-white bg-white/10 hover:bg-white/20 border border-white/20 transition-colors cursor-pointer"
                title="View hardware authentication audit history"
              >
                <History className="w-3.5 h-3.5 text-ob-green-300" />
                <span>Auth History</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSettingsTab('SETTINGS');
                  setIsSettingsOpen(true);
                }}
                className="min-h-[36px] flex items-center justify-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-semibold text-white/90 hover:text-white bg-white/10 hover:bg-white/20 border border-white/20 transition-colors cursor-pointer"
                title="Configure biometric preferences"
              >
                <Sliders className="w-3.5 h-3.5 text-ob-green-300" />
                <span>Settings</span>
              </button>
            </div>

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="w-full min-h-[44px] flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-rose-500/25 hover:bg-rose-600 border border-rose-300/40 hover:border-rose-600 transition-colors cursor-pointer"
                title="Log out of OB Regulatory Platform"
                aria-label="Log Out"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log Out</span>
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            {/* Quick Biometric Toggle Button in Collapsed Sidebar */}
            <button
              type="button"
              onClick={handleToggleBiometric}
              className={`p-2 rounded-lg transition-colors cursor-pointer relative min-h-[40px] min-w-[40px] flex items-center justify-center ${
                isBiometricEnabled
                  ? 'text-ob-green-300 hover:bg-white/10'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
              title={`Biometric Login: ${
                isBiometricEnabled ? 'Enabled' : 'Disabled'
              } (Click to toggle)`}
              aria-label={`Biometric Login ${isBiometricEnabled ? 'Enabled' : 'Disabled'}`}
            >
              <Fingerprint className="w-4 h-4" />
              <span
                className={`absolute top-1 right-1 w-2 h-2 rounded-full ${
                  isBiometricEnabled
                    ? 'bg-ob-green-400 ring-1 ring-ob-blue-700'
                    : 'bg-white/40'
                }`}
              />
            </button>

            {/* Quick Auth History in Collapsed Sidebar */}
            <button
              type="button"
              onClick={() => {
                setSettingsTab('HISTORY');
                setIsSettingsOpen(true);
              }}
              className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
              title="Authentication History"
              aria-label="Authentication History"
            >
              <History className="w-4 h-4 text-white" />
            </button>

            {onOpenShortcutsModal && (
              <button
                type="button"
                onClick={onOpenShortcutsModal}
                className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
                title="Keyboard Shortcuts (?)"
                aria-label="Keyboard Shortcuts"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            )}

            <div
              className="w-8 h-8 rounded-lg bg-white p-1 flex items-center justify-center shadow-xs cursor-pointer"
              title={`${currentUser.name} (${currentUser.role})`}
              onClick={() => {
                setSettingsTab('SETTINGS');
                setIsSettingsOpen(true);
              }}
            >
              <img
                src="/brand/oromia-logo-mark-transparent.png"
                alt="Oromia Bank Mark"
                className="w-full h-full object-contain"
              />
            </div>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-xl text-white/90 hover:text-white bg-rose-500/25 hover:bg-rose-600 transition-colors cursor-pointer"
                title="Log Out"
                aria-label="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </aside>

    {/* Centralized User Settings & Hardware Authentication History Modal */}
    <UserSettingsModal
      isOpen={isSettingsOpen}
      onClose={() => setIsSettingsOpen(false)}
      currentUser={currentUser}
      initialTab={settingsTab}
    />
    </>
  );
};
