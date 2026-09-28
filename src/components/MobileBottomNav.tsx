/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ViewTab } from './Sidebar.tsx';
import { UserSession } from '../types/regulatory.ts';
import {
  FileText,
  Inbox,
  Users,
  Send,
  Database,
  History,
  HelpCircle,
  Menu,
} from 'lucide-react';

interface MobileBottomNavProps {
  activeTab: ViewTab;
  onSelectTab: (tab: ViewTab) => void;
  currentUser: UserSession;
  pendingCheckerCount: number;
  onOpenMobileDrawer: () => void;
  isDrawerOpen: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onSelectTab,
  currentUser,
  pendingCheckerCount,
  onOpenMobileDrawer,
  isDrawerOpen,
}) => {
  // Determine primary mobile thumb-navigation tabs based on authorized user role
  const getNavItems = () => {
    if (currentUser.role === 'ADMIN') {
      return [
        { id: 'ADMIN_DASHBOARD' as ViewTab, label: 'Admin', icon: Users },
        { id: 'MAKER_WORKSPACE' as ViewTab, label: 'Maker', icon: FileText },
        {
          id: 'CHECKER_INBOX' as ViewTab,
          label: 'Checker',
          icon: Inbox,
          badge: pendingCheckerCount > 0 ? pendingCheckerCount : null,
        },
        { id: 'NBE_SIMULATOR' as ViewTab, label: 'Gateway', icon: Send },
      ];
    }

    if (currentUser.role === 'CHECKER') {
      return [
        {
          id: 'CHECKER_INBOX' as ViewTab,
          label: 'Review Inbox',
          icon: Inbox,
          badge: pendingCheckerCount > 0 ? pendingCheckerCount : null,
        },
        { id: 'NBE_SIMULATOR' as ViewTab, label: 'NBE Probe', icon: Send },
        { id: 'PHASE2_SSOT' as ViewTab, label: 'SSOT Lake', icon: Database },
        { id: 'AUDIT_TRAIL' as ViewTab, label: 'Audit', icon: History },
      ];
    }

    // Default: MAKER role
    return [
      { id: 'MAKER_WORKSPACE' as ViewTab, label: 'Catalog', icon: FileText },
      { id: 'PHASE2_SSOT' as ViewTab, label: 'SSOT Lake', icon: Database },
      { id: 'DOCUMENTATION' as ViewTab, label: 'NBE Docs', icon: HelpCircle },
      { id: 'AUDIT_TRAIL' as ViewTab, label: 'Audit', icon: History },
    ];
  };

  const navItems = getNavItems();

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#121428]/95 backdrop-blur-lg border-t border-slate-200 dark:border-[#22284D] pb-safe shadow-lg select-none transition-colors"
      aria-label="Mobile Bottom Navigation"
    >
      <div className="grid grid-cols-5 items-center h-14 px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id && !isDrawerOpen;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className="group relative flex flex-col items-center justify-center h-full min-h-[44px] min-w-[44px] py-1 text-center touch-manipulation touch-press"
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform duration-150 ${
                    isActive
                      ? 'text-ob-indigo-600 dark:text-ob-indigo-400 scale-105'
                      : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200'
                  }`}
                />
                {item.badge && item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 px-1.5 py-0.2 min-w-4 h-4 rounded-full bg-amber-500 text-white font-mono text-[9px] font-bold flex items-center justify-center shadow-xs">
                    {item.badge}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] mt-0.5 tracking-tight font-medium transition-colors ${
                  isActive
                    ? 'text-ob-indigo-700 dark:text-ob-indigo-300 font-bold'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {item.label}
              </span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-ob-indigo-600 dark:bg-ob-indigo-400 mt-0.5" />
              )}
            </button>
          );
        })}

        {/* 5th slot: More / Slide-out Menu Trigger */}
        <button
          type="button"
          onClick={onOpenMobileDrawer}
          className={`group flex flex-col items-center justify-center h-full min-h-[44px] min-w-[44px] py-1 text-center touch-manipulation touch-press ${
            isDrawerOpen ? 'text-ob-indigo-600 dark:text-ob-indigo-400' : 'text-slate-500 dark:text-slate-400'
          }`}
          aria-label="Open complete navigation drawer"
          title="All Apps & Options"
        >
          <Menu className="w-5 h-5 transition-transform duration-150 group-hover:scale-105" />
          <span className="text-[10px] mt-0.5 tracking-tight font-medium">Menu</span>
          {isDrawerOpen && (
            <span className="w-1.5 h-1.5 rounded-full bg-ob-indigo-600 dark:bg-ob-indigo-400 mt-0.5" />
          )}
        </button>
      </div>
    </nav>
  );
};
