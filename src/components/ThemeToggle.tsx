/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Fragment } from 'react';
import { Menu, MenuButton, MenuItem, MenuItems, Transition } from '@headlessui/react';
import { Sun, Moon, Laptop, ChevronDown, Check, Sparkles } from 'lucide-react';
import { useTheme, ThemeMode } from '../contexts/ThemeContext.tsx';

interface ThemeToggleProps {
  className?: string;
  align?: 'left' | 'right';
  showLabelOnMobile?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className = '',
  align = 'right',
  showLabelOnMobile = false,
}) => {
  const { theme, resolvedTheme, setTheme } = useTheme();

  const themeOptions: {
    key: ThemeMode;
    label: string;
    sublabel: string;
    icon: React.FC<{ className?: string }>;
    accentColor: string;
    bgAccent: string;
  }[] = [
    {
      key: 'light',
      label: 'Light',
      sublabel: 'Crisp bright interface',
      icon: Sun,
      accentColor: 'text-amber-500 dark:text-amber-400',
      bgAccent:
        'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700/60',
    },
    {
      key: 'dark',
      label: 'Dark',
      sublabel: 'Low-light high contrast',
      icon: Moon,
      accentColor: 'text-indigo-600 dark:text-indigo-400',
      bgAccent:
        'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border-indigo-300 dark:border-indigo-700/60',
    },
    {
      key: 'system',
      label: 'System',
      sublabel: 'Sync with operating system',
      icon: Laptop,
      accentColor: 'text-ob-green-600 dark:text-ob-green-400',
      bgAccent:
        'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700/60',
    },
  ];

  const activeOption = themeOptions.find((opt) => opt.key === theme) || themeOptions[2];
  const ActiveIcon = activeOption.icon;

  return (
    <Menu as="div" className={`relative inline-block text-left select-none ${className}`}>
      {({ open }) => (
        <>
          {/* Accessible Headless UI Trigger Button */}
          <MenuButton
            id="theme-dropdown-trigger"
            aria-label={`Theme selector: Currently ${activeOption.label}. Click to expand options.`}
            className={`group flex items-center gap-2 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl border text-xs font-semibold transition-all duration-150 cursor-pointer shadow-xs focus:outline-none focus:ring-2 focus:ring-ob-indigo-500/30 ${
              open
                ? 'bg-slate-100 dark:bg-[#1B2042] border-ob-indigo-400 dark:border-ob-indigo-500 ring-2 ring-ob-indigo-500/20 text-slate-900 dark:text-white'
                : 'bg-white hover:bg-slate-50 dark:bg-[#151933] dark:hover:bg-[#1C2144] border-slate-200 dark:border-[#28305A] text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-[#38437A]'
            }`}
          >
            {/* Active Themed Icon Indicator */}
            <div
              className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 border transition-transform group-hover:scale-105 ${activeOption.bgAccent}`}
            >
              <ActiveIcon className="w-3.5 h-3.5 shrink-0" />
            </div>

            {/* Displayed Selected Mode Label */}
            <div className="flex items-center gap-1.5 text-left min-w-0">
              <span
                className={`font-bold tracking-tight text-slate-800 dark:text-slate-100 truncate ${
                  showLabelOnMobile ? 'inline' : 'hidden sm:inline'
                }`}
              >
                {activeOption.label}
              </span>
              {theme === 'system' && (
                <span
                  className={`text-[10px] font-mono font-medium px-1 py-0.2 rounded bg-slate-100 dark:bg-[#202750] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#2E3770] ${
                    showLabelOnMobile ? 'inline' : 'hidden sm:inline'
                  }`}
                >
                  {resolvedTheme === 'dark' ? 'Dark' : 'Light'}
                </span>
              )}
            </div>

            {/* Animated Dropdown Chevron */}
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 dark:text-slate-400 transition-transform duration-200 shrink-0 ${
                open ? 'rotate-180 text-ob-indigo-600 dark:text-ob-indigo-400' : ''
              }`}
            />
          </MenuButton>

          {/* Accessible Headless UI Menu Items with Transition */}
          <Transition
            as={Fragment}
            enter="transition ease-out duration-150"
            enterFrom="transform opacity-0 scale-95 -translate-y-1"
            enterTo="transform opacity-100 scale-100 translate-y-0"
            leave="transition ease-in duration-100"
            leaveFrom="transform opacity-100 scale-100 translate-y-0"
            leaveTo="transform opacity-0 scale-95 -translate-y-1"
          >
            <MenuItems
              id="theme-dropdown-menu"
              className={`absolute ${
                align === 'right' ? 'right-0' : 'left-0'
              } top-full mt-2 w-60 bg-white dark:bg-[#151933] border border-slate-200 dark:border-[#28305A] rounded-2xl shadow-2xl p-1.5 z-50 backdrop-blur-lg focus:outline-none`}
            >
              {/* Header Title */}
              <div className="px-2.5 py-1.5 border-b border-slate-100 dark:border-[#22284D] mb-1 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Appearance Theme
                </span>
                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-300 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5 text-ob-green-500" />
                  <span>NBE Portal</span>
                </span>
              </div>

              {/* Mode Selection Options */}
              <div className="space-y-1">
                {themeOptions.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = theme === opt.key;

                  return (
                    <MenuItem key={opt.key}>
                      {({ focus }) => (
                        <button
                          type="button"
                          id={`theme-option-${opt.key}`}
                          onClick={() => setTheme(opt.key)}
                          className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all duration-100 cursor-pointer focus:outline-none ${
                            isSelected
                              ? 'bg-ob-indigo-50/90 dark:bg-ob-indigo-950/70 border border-ob-indigo-200 dark:border-ob-indigo-700/80 text-slate-900 dark:text-white shadow-2xs'
                              : focus
                              ? 'bg-slate-100 dark:bg-[#1F254D] border border-slate-200 dark:border-[#333D73] text-slate-900 dark:text-white'
                              : 'border border-transparent text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1A2044]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                                isSelected
                                  ? opt.bgAccent
                                  : 'bg-slate-100 dark:bg-[#1B2042] border-slate-200 dark:border-[#2C3566] text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              <Icon className={`w-4 h-4 ${isSelected ? opt.accentColor : ''}`} />
                            </div>

                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold truncate">{opt.label}</span>
                                {opt.key === 'system' && (
                                  <span className="text-[9px] px-1 py-0.2 rounded bg-slate-200 dark:bg-[#222B59] text-slate-600 dark:text-slate-300 font-mono">
                                    Auto
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-500 dark:text-slate-300 truncate">
                                {opt.sublabel}
                              </span>
                            </div>
                          </div>

                          {/* Active Selected Checkmark */}
                          {isSelected && (
                            <div className="w-5 h-5 rounded-full bg-ob-indigo-600 dark:bg-ob-indigo-500 text-white flex items-center justify-center shrink-0 shadow-xs ml-2">
                              <Check className="w-3 h-3 stroke-[2.5]" />
                            </div>
                          )}
                        </button>
                      )}
                    </MenuItem>
                  );
                })}
              </div>

              {/* Bottom Status Footer displaying Active Resolved Theme */}
              <div className="mt-1.5 pt-1.5 border-t border-slate-100 dark:border-[#22284D] px-2.5 py-1 text-[10px] text-slate-500 dark:text-slate-300 flex items-center justify-between">
                <span>Active Output:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize flex items-center gap-1">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      resolvedTheme === 'dark' ? 'bg-indigo-400' : 'bg-amber-400'
                    }`}
                  />
                  <span>{resolvedTheme} mode</span>
                </span>
              </div>
            </MenuItems>
          </Transition>
        </>
      )}
    </Menu>
  );
};
