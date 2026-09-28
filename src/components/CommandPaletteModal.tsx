/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  FileText,
  Inbox,
  Send,
  Database,
  History,
  HelpCircle,
  Users,
  X,
  ArrowRight,
  Sparkles,
  Command,
  Zap,
  Sun,
  Moon,
  Laptop,
  Network,
  Activity,
} from 'lucide-react';
import { ViewTab } from './Sidebar.tsx';
import { ReportMetadata, UserSession } from '../types/regulatory.ts';
import { useTheme, ThemeMode } from '../contexts/ThemeContext.tsx';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: ViewTab) => void;
  onSelectReturn?: (reportKey: string) => void;
  templates: ReportMetadata[];
  currentUser: UserSession;
  onOpenShortcutsModal: () => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  onSelectReturn,
  templates,
  currentUser,
  onOpenShortcutsModal,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { setTheme } = useTheme();

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isMac = typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const modKey = isMac ? '⌘' : 'Ctrl';

  const navActions = [
    {
      id: 'MAKER_WORKSPACE' as ViewTab,
      title: 'Maker Workspace',
      subtitle: 'Browse 24 NBE returns, prepare and edit drafts',
      icon: FileText,
      shortcut: `${modKey}+M`,
      category: 'Views',
      allowedRoles: ['ADMIN', 'MAKER'],
    },
    {
      id: 'CHECKER_INBOX' as ViewTab,
      title: 'Checker Inbox',
      subtitle: 'Review submissions, 4-eyes approval & NBE delivery',
      icon: Inbox,
      shortcut: `${modKey}+Shift+C`,
      category: 'Views',
      allowedRoles: ['ADMIN', 'CHECKER'],
    },
    {
      id: 'ADMIN_DASHBOARD' as ViewTab,
      title: 'Admin Governance',
      subtitle: 'User management, approval queue & role assignments',
      icon: Users,
      shortcut: `${modKey}+Shift+A`,
      category: 'Views',
      allowedRoles: ['ADMIN'],
    },
    {
      id: 'DEPT_REPORT_MANAGEMENT' as ViewTab,
      title: 'Departments & Reports Management',
      subtitle: 'Dynamic bank hierarchy, custom returns & Many-to-Many linkages',
      icon: Network,
      shortcut: `${modKey}+Shift+M`,
      category: 'Views',
      allowedRoles: ['ADMIN'],
    },
    {
      id: 'NBE_SIMULATOR' as ViewTab,
      title: 'NBE Gateway Simulator',
      subtitle: 'API traffic logs, failure injection & schema tests',
      icon: Send,
      shortcut: `${modKey}+Shift+N`,
      category: 'Views',
      allowedRoles: ['ADMIN', 'CHECKER'],
    },
    {
      id: 'PHASE2_SSOT' as ViewTab,
      title: 'Phase 2 SSOT Medallion Lakehouse',
      subtitle: 'Automated data ingestion & GL reconciliation engine',
      icon: Database,
      shortcut: `${modKey}+Shift+S`,
      category: 'Views',
      allowedRoles: ['ADMIN', 'MAKER', 'CHECKER'],
    },
    {
      id: 'AUDIT_TRAIL' as ViewTab,
      title: 'Compliance Audit Trail',
      subtitle: 'Immutable event history & regulatory CSV export',
      icon: History,
      shortcut: `${modKey}+Shift+L`,
      category: 'Views',
      allowedRoles: ['ADMIN', 'MAKER', 'CHECKER', 'NBE_OFFICER'],
    },
    {
      id: 'SYSTEM_HEALTH' as ViewTab,
      title: 'Authentication Hardware & System Health',
      subtitle: 'Real-time sensors (Camera, Fingerprint, Secure Enclave) status & diagnostics',
      icon: Activity,
      shortcut: `${modKey}+Shift+H`,
      category: 'Views',
      allowedRoles: ['ADMIN', 'MAKER', 'CHECKER', 'NBE_OFFICER'],
    },
    {
      id: 'DOCUMENTATION' as ViewTab,
      title: 'Regulatory Directives & Documentation',
      subtitle: 'BSD/03/2020 guidelines, formula specifications & return catalog',
      icon: HelpCircle,
      shortcut: `${modKey}+Shift+D`,
      category: 'Views',
      allowedRoles: ['ADMIN', 'MAKER', 'CHECKER', 'NBE_OFFICER'],
    },
  ].filter((a) => a.allowedRoles.includes(currentUser.role));

  const themeActions = [
    {
      id: 'THEME_LIGHT',
      title: 'Set Appearance: Light Mode',
      subtitle: 'Switch to crisp high-contrast light theme',
      icon: Sun,
      action: () => setTheme('light'),
      shortcut: `${modKey}+⇧+T`,
    },
    {
      id: 'THEME_DARK',
      title: 'Set Appearance: Dark Mode',
      subtitle: 'Switch to immersive low-light dark theme',
      icon: Moon,
      action: () => setTheme('dark'),
      shortcut: `${modKey}+⇧+T`,
    },
    {
      id: 'THEME_SYSTEM',
      title: 'Set Appearance: Device / System Mode',
      subtitle: 'Synchronize theme automatically with OS preferences',
      icon: Laptop,
      action: () => setTheme('system'),
      shortcut: `${modKey}+⇧+T`,
    },
  ];

  // Matched Returns
  const matchedTemplates = templates
    .filter(
      (t) =>
        t.Code.toLowerCase().includes(query.toLowerCase()) ||
        t.Title.toLowerCase().includes(query.toLowerCase()) ||
        t.Category.toLowerCase().includes(query.toLowerCase())
    )
    .slice(0, 5);

  const matchedNav = navActions.filter(
    (a) =>
      a.title.toLowerCase().includes(query.toLowerCase()) ||
      a.subtitle.toLowerCase().includes(query.toLowerCase())
  );

  const matchedThemes = themeActions.filter(
    (t) =>
      t.title.toLowerCase().includes(query.toLowerCase()) ||
      t.subtitle.toLowerCase().includes(query.toLowerCase()) ||
      'theme dark light appearance system mode'.includes(query.toLowerCase())
  );

  const allResults = [
    ...matchedNav.map((n) => ({ type: 'NAV' as const, data: n })),
    ...matchedTemplates.map((t) => ({ type: 'RETURN' as const, data: t })),
    ...matchedThemes.map((t) => ({ type: 'THEME' as const, data: t })),
    {
      type: 'ACTION' as const,
      data: {
        id: 'SHORTCUTS',
        title: 'View Keyboard Shortcuts',
        subtitle: 'Show the complete cheatsheet of hotkeys',
        icon: Zap,
        shortcut: '?',
      },
    },
  ];

  const handleSelect = (index: number) => {
    const item = allResults[index];
    if (!item) return;

    if (item.type === 'NAV') {
      onNavigateTab(item.data.id);
      onClose();
    } else if (item.type === 'RETURN') {
      if (onSelectReturn) {
        onSelectReturn(item.data.ReturnKey);
      } else {
        onNavigateTab('MAKER_WORKSPACE');
      }
      onClose();
    } else if (item.type === 'THEME') {
      item.data.action();
      onClose();
    } else if (item.type === 'ACTION') {
      onClose();
      onOpenShortcutsModal();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % allResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + allResults.length) % allResults.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSelect(selectedIndex);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs flex items-start justify-center p-4 pt-20 z-50 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full max-h-[75vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-150 transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2.5 bg-slate-50/50 dark:bg-slate-800/50">
          <Search className="w-4 h-4 text-ob-indigo-600 dark:text-ob-indigo-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command, theme, view name, or return code (e.g., POBEPE001, Dark)..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className="w-full bg-transparent text-slate-900 dark:text-slate-100 text-xs sm:text-sm font-medium placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
          />
          <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 text-[10px] font-mono shrink-0">
            Esc
          </kbd>
        </div>

        {/* Results List */}
        <div className="p-2 overflow-y-auto max-h-96 space-y-1 text-xs">
          {allResults.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400">
              <Search className="w-6 h-6 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="font-semibold text-slate-700 dark:text-slate-300">No matching commands or returns</p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Try searching for "Dark", "Balance", "Maker", or "SSOT".</p>
            </div>
          ) : (
            allResults.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              if (item.type === 'NAV') {
                const IconComp = item.data.icon;
                return (
                  <button
                    key={`nav_${item.data.id}`}
                    type="button"
                    onClick={() => handleSelect(idx)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full p-2.5 rounded-xl text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-ob-indigo-50 dark:bg-ob-indigo-950/70 border border-ob-indigo-200 dark:border-ob-indigo-800 text-ob-indigo-950 dark:text-ob-indigo-200'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-ob-indigo-700 dark:text-ob-indigo-400 shrink-0">
                        <IconComp className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold truncate text-slate-900 dark:text-slate-100">{item.data.title}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{item.data.subtitle}</div>
                      </div>
                    </div>
                    <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[10px] text-slate-500 dark:text-slate-400 shrink-0">
                      {item.data.shortcut}
                    </kbd>
                  </button>
                );
              } else if (item.type === 'THEME') {
                const IconComp = item.data.icon;
                return (
                  <button
                    key={`theme_${item.data.id}`}
                    type="button"
                    onClick={() => handleSelect(idx)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full p-2.5 rounded-xl text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-950 dark:text-amber-200'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 shrink-0">
                        <IconComp className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold truncate text-slate-900 dark:text-slate-100">{item.data.title}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{item.data.subtitle}</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-100/80 dark:bg-amber-950 px-1.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                      Theme
                    </span>
                  </button>
                );
              } else if (item.type === 'RETURN') {
                return (
                  <button
                    key={`return_${item.data.ReturnKey}`}
                    type="button"
                    onClick={() => handleSelect(idx)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full p-2.5 rounded-xl text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-ob-green-50 dark:bg-ob-green-950/60 border border-ob-green-300 dark:border-ob-green-800 text-ob-green-950 dark:text-ob-green-200'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-1.5 rounded-lg bg-ob-green-100 dark:bg-ob-green-950 text-ob-green-800 dark:text-ob-green-300 shrink-0 font-mono text-[10px] font-bold">
                        {item.data.Code}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold truncate text-slate-900 dark:text-slate-100">{item.data.Title}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                          {item.data.Category} · {item.data.Frequency}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-ob-green-700 dark:text-ob-green-400 shrink-0" />
                  </button>
                );
              } else {
                const IconComp = item.data.icon;
                return (
                  <button
                    key={`action_${item.data.id}`}
                    type="button"
                    onClick={() => handleSelect(idx)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full p-2.5 rounded-xl text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0">
                        <IconComp className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold truncate text-slate-900 dark:text-slate-100">{item.data.title}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{item.data.subtitle}</div>
                      </div>
                    </div>
                    <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[10px] text-slate-500 dark:text-slate-400 shrink-0">
                      {item.data.shortcut}
                    </kbd>
                  </button>
                );
              }
            })
          )}
        </div>

        {/* Footer info */}
        <div className="p-2.5 px-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span>Use <kbd className="px-1 py-0.2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-[9px]">↑</kbd> <kbd className="px-1 py-0.2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-[9px]">↓</kbd> to navigate</span>
            <span>·</span>
            <span><kbd className="px-1 py-0.2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-[9px]">↵</kbd> to select</span>
          </div>
          <span className="font-medium text-ob-indigo-700 dark:text-ob-indigo-400">Oromia Bank NBE Platform</span>
        </div>
      </div>
    </div>
  );
};
