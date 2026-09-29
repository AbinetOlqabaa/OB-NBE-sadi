/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  FileText,
  Inbox,
  Send,
  Database,
  Users,
  Menu,
  History,
  HelpCircle,
  ShieldAlert,
} from 'lucide-react';
import { UserSession } from '../types/regulatory.ts';
import { ViewTab } from './Sidebar.tsx';

interface BottomNavigationProps {
  activeTab: ViewTab;
  onSelectTab: (tab: ViewTab) => void;
  currentUser: UserSession;
  pendingCheckerCount: number;
  pendingUsersCount?: number;
  onOpenMobileDrawer: () => void;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  onSelectTab,
  currentUser,
  pendingCheckerCount,
  pendingUsersCount = 0,
  onOpenMobileDrawer,
}) => {
  // Construct dynamic thumb-friendly tabs based on current authenticated role
  const getNavItems = () => {
    switch (currentUser.role) {
      case 'ADMIN':
        return [
          {
            id: 'ADMIN_DASHBOARD' as ViewTab,
            label: 'Admin',
            icon: Users,
            badge: pendingUsersCount > 0 ? pendingUsersCount : null,
          },
          {
            id: 'CHECKER_INBOX' as ViewTab,
            label: 'Checker',
            icon: Inbox,
            badge: pendingCheckerCount > 0 ? pendingCheckerCount : null,
          },
          {
            id: 'MAKER_WORKSPACE' as ViewTab,
            label: 'Maker',
            icon: FileText,
            badge: null,
          },
          {
            id: 'NBE_SIMULATOR' as ViewTab,
            label: 'Simulator',
            icon: Send,
            badge: null,
          },
        ];
      case 'CHECKER':
        return [
          {
            id: 'CHECKER_INBOX' as ViewTab,
            label: 'Inbox',
            icon: Inbox,
            badge: pendingCheckerCount > 0 ? pendingCheckerCount : null,
          },
          {
            id: 'NBE_SIMULATOR' as ViewTab,
            label: 'Simulator',
            icon: Send,
            badge: null,
          },
          {
            id: 'PHASE2_SSOT' as ViewTab,
            label: 'SSOT',
            icon: Database,
            badge: null,
          },
          {
            id: 'AUDIT_TRAIL' as ViewTab,
            label: 'Audit',
            icon: History,
            badge: null,
          },
        ];
      case 'AUDITOR':
        return [
          {
            id: 'AUDITOR_DASHBOARD' as ViewTab,
            label: 'Auditor',
            icon: ShieldAlert,
            badge: null,
          },
          {
            id: 'AUDIT_TRAIL' as ViewTab,
            label: 'Audit',
            icon: History,
            badge: null,
          },
          {
            id: 'PHASE2_SSOT' as ViewTab,
            label: 'SSOT',
            icon: Database,
            badge: null,
          },
          {
            id: 'DOCUMENTATION' as ViewTab,
            label: 'Specs',
            icon: HelpCircle,
            badge: null,
          },
        ];
      case 'MAKER':
      default:
        return [
          {
            id: 'MAKER_WORKSPACE' as ViewTab,
            label: 'Maker',
            icon: FileText,
            badge: null,
          },
          {
            id: 'PHASE2_SSOT' as ViewTab,
            label: 'SSOT',
            icon: Database,
            badge: null,
          },
          {
            id: 'AUDIT_TRAIL' as ViewTab,
            label: 'Audit',
            icon: History,
            badge: null,
          },
          {
            id: 'DOCUMENTATION' as ViewTab,
            label: 'Catalog',
            icon: HelpCircle,
            badge: null,
          },
        ];
    }
  };

  const navItems = getNavItems();

  return (
    <nav
      className="md:hidden shrink-0 bg-white/95 dark:bg-slate-900/95 border-t border-slate-200 dark:border-slate-800 backdrop-blur-lg px-2 pt-1 pb-safe shadow-lg z-30 transition-colors"
      aria-label="Mobile Bottom Navigation"
    >
      <div className="flex items-center justify-around max-w-md mx-auto h-14">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`flex-1 flex flex-col items-center justify-center min-h-[48px] py-1 px-1 rounded-xl transition-all touch-manipulation touch-press cursor-pointer relative ${
                isActive
                  ? 'text-ob-indigo-600 dark:text-ob-indigo-400 font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                {item.badge !== null && item.badge > 0 && (
                  <span className="absolute -top-1 -right-2 px-1 py-0.2 rounded-full bg-amber-500 text-white font-mono text-[9px] font-bold min-w-[15px] h-[15px] flex items-center justify-center border-2 border-white dark:border-slate-900 animate-pulse">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight leading-none truncate max-w-[64px]">
                {item.label}
              </span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-ob-indigo-600 dark:bg-ob-indigo-400 absolute bottom-0.5"></span>
              )}
            </button>
          );
        })}

        {/* 5th Tab: Mobile Drawer / All Menu */}
        <button
          type="button"
          onClick={onOpenMobileDrawer}
          className="flex-1 flex flex-col items-center justify-center min-h-[48px] py-1 px-1 rounded-xl text-slate-500 dark:text-slate-400 hover:text-ob-indigo-600 dark:hover:text-ob-indigo-400 transition-all touch-manipulation touch-press cursor-pointer"
          aria-label="Open Full Navigation Drawer"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] mt-0.5 tracking-tight leading-none">Menu</span>
        </button>
      </div>
    </nav>
  );
};
