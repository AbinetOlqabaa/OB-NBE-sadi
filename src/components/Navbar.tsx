/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { UserSession } from '../types/regulatory.ts';
import {
  Building2,
  Shield,
  UserCheck,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  Users,
  Menu,
  ClipboardCheck,
  Bell,
} from 'lucide-react';
import { ThemeToggle } from './ThemeToggle.tsx';
import { NotificationCenter } from './NotificationCenter.tsx';
import { notificationService, AppNotification } from '../services/notificationService.ts';

interface NavbarProps {
  currentUser: UserSession;
  onSwitchUser?: (user: UserSession) => void;
  activeView: string;
  pendingCheckerCount: number;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  onOpenMobileDrawer?: () => void;
  onLogout?: () => void;
  onNavigateToSimulator?: () => void;
  onSelectTab?: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  pendingCheckerCount,
  isSidebarCollapsed = false,
  onToggleSidebar,
  onOpenMobileDrawer,
  onLogout,
  onNavigateToSimulator,
  onSelectTab,
}) => {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [userNotifications, setUserNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  // Sync notifications from authoritative notificationService
  const refreshNotifications = () => {
    const res = notificationService.getNotificationsForUser(currentUser);
    setUserNotifications(res.notifications);
    setUnreadCount(res.unreadCount);
  };

  useEffect(() => {
    refreshNotifications();
    const unsub = notificationService.subscribe(() => {
      refreshNotifications();
    });
    return () => unsub();
  }, [currentUser]);

  const handleNavToggle = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768 && onOpenMobileDrawer) {
      onOpenMobileDrawer();
    } else if (onToggleSidebar) {
      onToggleSidebar();
    }
  };

  const handleMarkAsRead = (id: string) => {
    notificationService.markAsRead(id);
    refreshNotifications();
  };

  const handleMarkAllAsRead = () => {
    notificationService.markAllAsReadForUser(currentUser);
    refreshNotifications();
  };

  return (
    <header className="h-14 sm:h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-2.5 sm:px-5 flex items-center justify-between sticky top-0 z-30 shadow-2xs shrink-0 select-none transition-colors">
      {/* Zone 1: Sidebar / Drawer Toggle + Official Oromia Bank Brand */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {(onToggleSidebar || onOpenMobileDrawer) && (
          <button
            type="button"
            onClick={handleNavToggle}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:text-ob-indigo-700 dark:hover:text-ob-indigo-300 hover:bg-ob-indigo-50 dark:hover:bg-ob-indigo-950/50 transition-colors focus:outline-none focus:ring-2 focus:ring-ob-indigo-400 touch-manipulation touch-press cursor-pointer"
            title={isSidebarCollapsed ? 'Expand navigation (Ctrl+B)' : 'Collapse navigation (Ctrl+B)'}
            aria-label="Toggle navigation drawer"
          >
            {/* On mobile, show intuitive Menu Hamburger icon; on tablet/desktop, show Panel toggle */}
            <span className="md:hidden">
              <Menu className="w-5 h-5" />
            </span>
            <span className="hidden md:inline">
              {isSidebarCollapsed ? (
                <PanelLeftOpen className="w-5 h-5 text-ob-indigo-700 dark:text-ob-indigo-400" />
              ) : (
                <PanelLeftClose className="w-5 h-5 text-slate-600 dark:text-slate-300" />
              )}
            </span>
          </button>
        )}

        {/* Authentic Oromia Bank Brand Logo */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="bg-white/95 dark:bg-white/90 p-1 rounded-xl shadow-xs border border-slate-200/60 dark:border-white/20 shrink-0">
            <img
              src="/brand/oromia-logo-full.png"
              alt="Oromia Bank"
              className="h-6 sm:h-8 w-auto object-contain hidden sm:block"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/brand/oromia-logo-mark-transparent.png';
              }}
            />
            <img
              src="/brand/oromia-logo-mark-transparent.png"
              alt="Oromia Bank"
              className="h-6 w-6 object-contain sm:hidden"
            />
          </div>
        </div>
      </div>

      {/* Zone 2: Context Ribbon (Removed for Maker to eliminate unimportant icons beside OB logo) */}
      {currentUser.role !== 'MAKER' && (
        <div className="hidden xl:flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-1.5 font-medium bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-xl">
            <Building2 className="w-3.5 h-3.5 text-ob-indigo-600 dark:text-ob-indigo-400" />
            <span className="font-semibold text-slate-800 dark:text-slate-200">Financial Year 2026</span>
          </div>

          {currentUser.role === 'CHECKER' && pendingCheckerCount > 0 && (
            <span className="font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 px-2.5 py-1 rounded-xl text-[11px] flex items-center gap-1.5 shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              <span>{pendingCheckerCount} awaiting review</span>
            </span>
          )}
        </div>
      )}

      {/* Zone 3: Theme + Notifications + Authoritative User Badge + Logout */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        {/* Notification Bell Button (Replaces cross-dashboard switching control) */}
        <button
          type="button"
          onClick={() => setIsNotificationsOpen(true)}
          className="relative min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:text-ob-indigo-700 dark:hover:text-ob-indigo-300 hover:bg-ob-indigo-50 dark:hover:bg-ob-indigo-950/50 transition-colors focus:outline-none focus:ring-2 focus:ring-ob-indigo-400 touch-manipulation touch-press cursor-pointer"
          title={unreadCount > 0 ? `Notification Center (${unreadCount} unread)` : 'Notification Center'}
          aria-label={unreadCount > 0 ? `Notification Center, ${unreadCount} unread` : 'Notification Center'}
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-2 right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold font-mono flex items-center justify-center ring-2 ring-white dark:ring-slate-900 animate-pulse">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* Theme Switcher Dropdown (Light / Dark / Device) */}
        <ThemeToggle align="right" />

        {/* Authoritative Single-Role User Badge (Read-only, no cross-dashboard dropdown switcher) */}
        <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl p-1 px-2.5 shadow-2xs min-h-[44px]">
          {currentUser.role === 'ADMIN' ? (
            <Users className="w-3.5 h-3.5 text-ob-indigo-600 dark:text-ob-indigo-400 shrink-0" />
          ) : currentUser.role === 'CHECKER' ? (
            <Shield className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
          ) : currentUser.role === 'AUDITOR' ? (
            <ClipboardCheck className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
          ) : (
            <UserCheck className="w-3.5 h-3.5 text-ob-green-600 dark:text-ob-green-400 shrink-0" />
          )}

          <div className="flex flex-col text-left">
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate max-w-[80px] sm:max-w-[110px]">
              {currentUser.name}
            </span>
            <span
              className={`text-[9px] uppercase font-bold tracking-wider ${
                currentUser.role === 'ADMIN'
                  ? 'text-ob-indigo-700 dark:text-ob-indigo-300'
                  : currentUser.role === 'CHECKER'
                  ? 'text-amber-700 dark:text-amber-400'
                  : currentUser.role === 'AUDITOR'
                  ? 'text-purple-700 dark:text-purple-400'
                  : currentUser.role === 'NBE_OFFICER'
                  ? 'text-purple-700 dark:text-purple-400'
                  : 'text-ob-green-700 dark:text-ob-green-400'
              }`}
            >
              {currentUser.role}
            </span>
          </div>
        </div>

        {/* Prominent Log Out Button */}
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="min-h-[44px] min-w-[44px] sm:px-2.5 rounded-xl bg-slate-100 hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-950/60 text-slate-600 hover:text-rose-700 dark:text-slate-300 dark:hover:text-rose-400 border border-slate-200 hover:border-rose-200 dark:border-slate-700 dark:hover:border-rose-800 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-2xs touch-manipulation touch-press cursor-pointer"
            title="Log Out and return to Login Screen"
            aria-label="Log Out"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Log Out</span>
          </button>
        )}
      </div>

      {/* Global Notification Center Modal / Slide-out */}
      <NotificationCenter
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={userNotifications}
        unreadCount={unreadCount}
        onMarkAsRead={handleMarkAsRead}
        onMarkAllAsRead={handleMarkAllAsRead}
        onNavigateToTab={onSelectTab}
      />
    </header>
  );
};
