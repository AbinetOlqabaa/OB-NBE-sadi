/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import {
  THEME_STORAGE_KEY,
  getSystemPreference,
  useTheme,
  applyDomTheme,
  logThemeDebug,
} from '../contexts/ThemeContext.tsx';

export interface ThemeMismatchDiagnostic {
  timestamp: string;
  count: number;
  localStorageValue: string | null;
  expectedDataTheme: string;
  actualDataTheme: string | null;
  actualDataThemeMode: string | null;
  actualClasses: string;
  componentInsight: {
    activeElementTag: string;
    activeElementId: string;
    activeElementAriaLabel: string;
    activeContainer: string;
    currentRoute: string;
    suspectedCulprit: string;
  };
}

export const THEME_MISMATCH_EVENT = 'theme_sync_mismatch_detected';

/**
 * Heuristically identifies which component or UI element might be failing
 * to propagate theme updates based on current focus and DOM inspection.
 */
function inspectComponentCulprit(activeEl: Element | null): string {
  if (!activeEl) return 'Global documentElement (No active focused element)';

  const formParent = activeEl.closest('form');
  if (formParent) {
    return `Form Component (${formParent.id || formParent.name || 'Unnamed Form'})`;
  }

  const modalParent = activeEl.closest('[role="dialog"], [role="alertdialog"], .modal');
  if (modalParent) {
    return `Modal / Dialog Component (${modalParent.id || 'Modal Dialog'})`;
  }

  const navParent = activeEl.closest('nav, header, [role="navigation"]');
  if (navParent) {
    return 'Navbar / Header Component (Theme selector / Role Switcher)';
  }

  const sidebarParent = activeEl.closest('aside, [role="complementary"]');
  if (sidebarParent) {
    return 'Sidebar Navigation Component';
  }

  const tableParent = activeEl.closest('table, [role="table"], [role="grid"]');
  if (tableParent) {
    return 'Dynamic Area Table / Grid Component';
  }

  return `${activeEl.tagName.toLowerCase()}${activeEl.id ? `#${activeEl.id}` : ''}${
    activeEl.className ? `.${activeEl.className.toString().split(' ')[0]}` : ''
  }`;
}

/**
 * Centralized ThemeSyncMonitor:
 * Validates the 'oromia_nbe_theme_preference' value in localStorage against the
 * documentElement data-theme attribute every 500ms.
 * Logs a detailed warning if a mismatch is detected, providing insight into which
 * component is failing to propagate updates.
 */
export const ThemeSyncMonitor: React.FC = () => {
  const { theme, resolvedTheme } = useTheme();
  const mismatchCountRef = useRef<number>(0);
  const lastLoggedMismatchRef = useRef<string>('');

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const intervalId = setInterval(() => {
      try {
        const storageVal = localStorage.getItem(THEME_STORAGE_KEY);
        const root = document.documentElement;
        const domDataTheme = root.getAttribute('data-theme');
        const domDataThemeMode = root.getAttribute('data-theme-mode');
        const domClasses = root.className;

        // Calculate expected data-theme and mode based on localStorage and system settings
        const currentSysPref = getSystemPreference();
        const effectiveMode =
          storageVal === 'light' || storageVal === 'dark' ? storageVal : 'system';
        const expectedDataTheme =
          effectiveMode === 'system' ? currentSysPref : effectiveMode;

        // Determine if there is a mismatch
        const isDataThemeMismatched = domDataTheme !== expectedDataTheme;
        const isClassMismatched =
          !root.classList.contains(expectedDataTheme) ||
          root.classList.contains(expectedDataTheme === 'dark' ? 'light' : 'dark');
        const isModeMismatched =
          domDataThemeMode !== null && domDataThemeMode !== effectiveMode;

        const isMismatch = isDataThemeMismatched || isClassMismatched || isModeMismatched;

        if (isMismatch) {
          mismatchCountRef.current += 1;
          const activeEl = document.activeElement;
          const culprit = inspectComponentCulprit(activeEl);

          const diagnostic: ThemeMismatchDiagnostic = {
            timestamp: new Date().toISOString(),
            count: mismatchCountRef.current,
            localStorageValue: storageVal,
            expectedDataTheme,
            actualDataTheme: domDataTheme,
            actualDataThemeMode: domDataThemeMode,
            actualClasses: domClasses,
            componentInsight: {
              activeElementTag: activeEl ? activeEl.tagName : 'NONE',
              activeElementId: activeEl ? activeEl.id || '<none>' : 'NONE',
              activeElementAriaLabel: activeEl
                ? activeEl.getAttribute('aria-label') || '<none>'
                : 'NONE',
              activeContainer: activeEl?.parentElement?.tagName || 'ROOT',
              currentRoute: window.location.pathname,
              suspectedCulprit: culprit,
            },
          };

          // Deduplicate identical consecutive console logs while still tracking count
          const mismatchSignature = `${storageVal}-${domDataTheme}-${domClasses}-${culprit}`;
          if (lastLoggedMismatchRef.current !== mismatchSignature) {
            lastLoggedMismatchRef.current = mismatchSignature;

            console.warn(
              `%c[ThemeSyncMonitor | Desync Warning #${mismatchCountRef.current}]`,
              'background: #dc2626; color: #ffffff; font-weight: bold; padding: 2px 8px; border-radius: 4px;',
              {
                message:
                  'Mismatch detected between localStorage["oromia_nbe_theme_preference"] and documentElement DOM attributes!',
                storagePreference: storageVal ?? '<null (System Mode)>',
                expectedTheme: expectedDataTheme,
                actualDomTheme: domDataTheme ?? '<null>',
                actualDomMode: domDataThemeMode ?? '<null>',
                actualClasses: domClasses,
                culpritInsight: culprit,
                activeElement: activeEl,
                diagnostic,
              }
            );

            logThemeDebug('THEME_SYNC_MONITOR_MISMATCH', {
              theme: effectiveMode,
              resolvedTheme: expectedDataTheme,
              source: 'theme_sync_monitor',
              domClasses,
              dataTheme: domDataTheme,
              dataThemeMode: domDataThemeMode,
              extra: diagnostic as any,
            });

            // Dispatch global event for inspector and automated test suites
            window.dispatchEvent(
              new CustomEvent(THEME_MISMATCH_EVENT, { detail: diagnostic })
            );

            // Auto-heal DOM state
            applyDomTheme(expectedDataTheme, effectiveMode);
          }
        } else {
          // Clear mismatch signature once synchronized
          lastLoggedMismatchRef.current = '';
        }
      } catch (err) {
        // Storage access or DOM query failure
      }
    }, 500);

    return () => {
      clearInterval(intervalId);
    };
  }, [theme, resolvedTheme]);

  return null;
};
