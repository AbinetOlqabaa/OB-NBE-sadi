/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Keyboard,
  X,
  FileText,
  Inbox,
  Send,
  Database,
  History,
  HelpCircle,
  Users,
  Save,
  Command,
  Search,
  PanelLeftClose,
  Shield,
  Zap,
  SunMoon,
} from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
  context: 'Global' | 'Navigation' | 'Maker Workspace' | 'Checker Inbox';
  icon?: React.ElementType;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const isMac = typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const modKey = isMac ? '⌘' : 'Ctrl';

  const shortcuts: ShortcutItem[] = [
    // Global & Editing
    {
      keys: [modKey, 'S'],
      description: 'Save draft changes (in dynamic report editor)',
      context: 'Maker Workspace',
      icon: Save,
    },
    {
      keys: [modKey, 'K'],
      description: 'Open Command Palette & Universal Search',
      context: 'Global',
      icon: Command,
    },
    {
      keys: [modKey, 'Shift', 'T'],
      description: 'Cycle Theme Mode (Light / Dark / Device)',
      context: 'Global',
      icon: SunMoon,
    },
    {
      keys: ['?'],
      description: 'Show this Keyboard Shortcuts cheat sheet',
      context: 'Global',
      icon: Keyboard,
    },
    {
      keys: [modKey, 'B'],
      description: 'Toggle Navigation Sidebar (collapse / expand)',
      context: 'Global',
      icon: PanelLeftClose,
    },
    {
      keys: ['Esc'],
      description: 'Close modals, Command Palette, or active popovers',
      context: 'Global',
      icon: X,
    },

    // Navigation
    {
      keys: [modKey, 'M'],
      description: 'Jump to Maker Workspace (Report Catalog & Drafts)',
      context: 'Navigation',
      icon: FileText,
    },
    {
      keys: [modKey, 'Shift', 'C'],
      description: 'Jump to Checker Inbox (4-Eyes Reviews)',
      context: 'Navigation',
      icon: Inbox,
    },
    {
      keys: [modKey, 'Shift', 'A'],
      description: 'Jump to Admin Governance Dashboard',
      context: 'Navigation',
      icon: Users,
    },
    {
      keys: [modKey, 'Shift', 'N'],
      description: 'Jump to NBE API Gateway Simulator & Traffic Logs',
      context: 'Navigation',
      icon: Send,
    },
    {
      keys: [modKey, 'Shift', 'S'],
      description: 'Jump to Phase 2 SSOT Medallion Lakehouse',
      context: 'Navigation',
      icon: Database,
    },
    {
      keys: [modKey, 'Shift', 'L'],
      description: 'Jump to Compliance Audit Trail & Export',
      context: 'Navigation',
      icon: History,
    },
    {
      keys: [modKey, 'Shift', 'D'],
      description: 'Jump to Regulatory Directives & Catalog Documentation',
      context: 'Navigation',
      icon: HelpCircle,
    },
  ];

  const contexts = ['Global', 'Maker Workspace', 'Navigation'] as const;

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-150 transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 bg-slate-900 dark:bg-slate-950 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-ob-indigo-600 text-white border border-ob-indigo-500">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Power User Keyboard Shortcuts</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-ob-green-500/20 text-ob-green-300 border border-ob-green-500/40">
                  Productivity Boost
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Navigate the Oromia Bank NBE Regulatory Platform with lightning speed.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs">
          {contexts.map((ctx) => {
            const group = shortcuts.filter((s) => s.context === ctx);
            if (group.length === 0) return null;

            return (
              <div key={ctx} className="space-y-2">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-1">
                  <span>{ctx} Shortcuts</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {group.map((item, idx) => {
                    const IconComp = item.icon || Zap;
                    return (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/60 hover:bg-slate-100/70 dark:hover:bg-slate-800 transition-colors flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <IconComp className="w-3.5 h-3.5 text-ob-indigo-600 dark:text-ob-indigo-400 shrink-0" />
                          <span className="text-slate-700 dark:text-slate-300 font-medium truncate text-xs" title={item.description}>
                            {item.description}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {item.keys.map((k, kIdx) => (
                            <kbd
                              key={kIdx}
                              className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 shadow-2xs font-mono font-bold text-[10px] min-w-[20px] text-center"
                            >
                              {k}
                            </kbd>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <Command className="w-3.5 h-3.5 text-slate-400" />
            <span>Tip: Press <kbd className="px-1 py-0.2 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono text-[10px] text-slate-800 dark:text-slate-200">?</kbd> anywhere to open this menu</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer shadow-2xs"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
