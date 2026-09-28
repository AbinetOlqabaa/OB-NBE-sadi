/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export interface ThemeSyncMountValidation {
  timestamp: string;
  pageContext: 'LOGIN' | 'DASHBOARD' | 'UNKNOWN';
  preMountDom: {
    classList: string;
    dataTheme: string | null;
    dataThemeMode: string | null;
    colorScheme: string;
  };
  localStorageOverride: string | null;
  systemPreference: ResolvedTheme;
  reactState: {
    theme: ThemeMode;
    resolvedTheme: ResolvedTheme;
    hasManualOverride: boolean;
  };
  postSyncDom: {
    classList: string;
    dataTheme: string | null;
    dataThemeMode: string | null;
    colorScheme: string;
  };
  hasRaceCondition: boolean;
  isSynchronized: boolean;
}

export interface ThemeDebugLog {
  id: string;
  timestamp: string;
  event: string;
  theme: ThemeMode;
  resolvedTheme: ResolvedTheme;
  domClasses: string;
  dataTheme: string | null;
  dataThemeMode: string | null;
  colorScheme: string;
  details?: Record<string, any>;
}

export interface ThemeContextType {
  theme: ThemeMode;
  resolvedTheme: ResolvedTheme;
  systemTheme: ResolvedTheme;
  hasOverride: boolean;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  forceSync: () => void;
  debugLogs: ThemeDebugLog[];
  mountValidation: ThemeSyncMountValidation | null;
  mutationCount: number;
  isObserverActive: boolean;
  clearLogs: () => void;
}

export const THEME_STORAGE_KEY = 'oromia_nbe_theme_preference';
export const THEME_CHANGE_EVENT = 'oromia_theme_changed';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Temporary & Real-Time debug logger in ThemeContext that logs theme changes
 * to the console every time they are triggered and verifies synchronization with localStorage & DOM.
 */
export function logThemeDebug(
  event: string,
  details: {
    theme: ThemeMode;
    resolvedTheme: ResolvedTheme;
    previousTheme?: ThemeMode;
    source?: string;
    domClasses?: string;
    dataTheme?: string | null;
    dataThemeMode?: string | null;
    colorScheme?: string;
    extra?: Record<string, any>;
  }
): ThemeDebugLog {
  const timestamp = new Date().toISOString();
  const id = `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const currentDomClasses =
    details.domClasses ||
    (typeof document !== 'undefined' ? document.documentElement.className : '');
  const currentDataTheme =
    details.dataTheme !== undefined
      ? details.dataTheme
      : typeof document !== 'undefined'
      ? document.documentElement.getAttribute('data-theme')
      : null;
  const currentDataThemeMode =
    details.dataThemeMode !== undefined
      ? details.dataThemeMode
      : typeof document !== 'undefined'
      ? document.documentElement.getAttribute('data-theme-mode')
      : null;
  const currentColorSheme =
    details.colorScheme ||
    (typeof document !== 'undefined' ? document.documentElement.style.colorScheme : '');

  const logEntry: ThemeDebugLog = {
    id,
    timestamp,
    event,
    theme: details.theme,
    resolvedTheme: details.resolvedTheme,
    domClasses: currentDomClasses,
    dataTheme: currentDataTheme,
    dataThemeMode: currentDataThemeMode,
    colorScheme: currentColorSheme,
    details: {
      ...details.extra,
      source: details.source,
      previousTheme: details.previousTheme,
    },
  };

  if (typeof console !== 'undefined' && console.log) {
    const isErrorOrMutation = event.includes('MUTATION') || event.includes('DESYNC');
    const badgeBg = isErrorOrMutation ? '#e11d48' : '#0f172a';
    const textColor = isErrorOrMutation ? '#ffffff' : '#38bdf8';

    console.log(
      `%c[ThemeContext | ${timestamp.slice(11, 19)}] ${event}`,
      `background: ${badgeBg}; color: ${textColor}; font-weight: bold; padding: 2px 6px; border-radius: 4px;`,
      {
        ...details,
        storageValue:
          typeof localStorage !== 'undefined' ? localStorage.getItem(THEME_STORAGE_KEY) : 'N/A',
        timestamp,
      }
    );
  }

  // Dispatch custom window event for inspector sync
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(
        new CustomEvent(THEME_CHANGE_EVENT, {
          detail: logEntry,
        })
      );
    } catch {}
  }

  return logEntry;
}

export function getSystemPreference(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  try {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  } catch {
    return 'light';
  }
}

/**
 * Checks for an explicit user manual override in localStorage.
 * Returns 'light' | 'dark' if permanent local override exists, or null for system mode.
 */
export function getStoredOverride(): 'light' | 'dark' | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
  } catch {
    // Storage access disabled or restricted in iframe
  }
  return null;
}

/**
 * Resolves the initial stored theme:
 * Strictly prioritizes manual user overrides ('light' | 'dark') from localStorage.
 * If no override in localStorage (i.e. 'system' mode selected or unconfigured),
 * standardizes on 'system' mode allowing natural browser preference reflection.
 */
export function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'system';

  // Strict priority: Manual user override in localStorage
  const override = getStoredOverride();
  if (override) {
    return override;
  }

  // When no permanent override exists in localStorage, standard is 'system'
  return 'system';
}

export function resolveTheme(mode: ThemeMode, systemPreference?: ResolvedTheme): ResolvedTheme {
  if (mode === 'system') {
    return systemPreference || getSystemPreference();
  }
  return mode;
}

/**
 * Explicitly forces an update to the documentElement classes, data-theme,
 * data-theme-mode attributes, and body/root elements to ensure the DOM is kept
 * perfectly in sync with React state and localStorage.
 */
export function applyDomTheme(
  resolved: ResolvedTheme,
  mode: ThemeMode
): {
  classes: string;
  dataTheme: string | null;
  dataThemeMode: string | null;
  colorScheme: string;
} {
  if (typeof document === 'undefined') {
    return { classes: '', dataTheme: null, dataThemeMode: null, colorScheme: '' };
  }

  const isDark = resolved === 'dark';
  const root = document.documentElement;
  const body = document.body;
  const appRoot = document.getElementById('root');

  if (isDark) {
    // Force documentElement to dark
    root.classList.remove('light');
    root.classList.add('dark');
    root.setAttribute('data-theme', 'dark');
    root.setAttribute('data-theme-mode', mode);
    root.style.colorScheme = 'dark';

    // Force body to dark
    if (body) {
      body.classList.remove('light');
      body.classList.add('dark');
      body.setAttribute('data-theme', 'dark');
      body.setAttribute('data-theme-mode', mode);
    }

    // Force root container to dark
    if (appRoot) {
      appRoot.classList.remove('light');
      appRoot.classList.add('dark');
      appRoot.setAttribute('data-theme', 'dark');
      appRoot.setAttribute('data-theme-mode', mode);
    }
  } else {
    // Force documentElement to light
    root.classList.remove('dark');
    root.classList.add('light');
    root.setAttribute('data-theme', 'light');
    root.setAttribute('data-theme-mode', mode);
    root.style.colorScheme = 'light';

    // Force body to light
    if (body) {
      body.classList.remove('dark');
      body.classList.add('light');
      body.setAttribute('data-theme', 'light');
      body.setAttribute('data-theme-mode', mode);
    }

    // Force root container to light
    if (appRoot) {
      appRoot.classList.remove('dark');
      appRoot.classList.add('light');
      appRoot.setAttribute('data-theme', 'light');
      appRoot.setAttribute('data-theme-mode', mode);
    }
  }

  return {
    classes: root.className,
    dataTheme: root.getAttribute('data-theme'),
    dataThemeMode: root.getAttribute('data-theme-mode'),
    colorScheme: root.style.colorScheme,
  };
}

// Immediately apply theme and log initial sync upon module load
if (typeof window !== 'undefined') {
  try {
    const initialMode = getStoredTheme();
    const initialResolved = resolveTheme(initialMode);
    const domState = applyDomTheme(initialResolved, initialMode);
    logThemeDebug('MODULE_INITIALIZATION', {
      theme: initialMode,
      resolvedTheme: initialResolved,
      source: 'module_load',
      domClasses: domState.classes,
      dataTheme: domState.dataTheme,
      dataThemeMode: domState.dataThemeMode,
      colorScheme: domState.colorScheme,
    });
  } catch {}
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => getStoredTheme());
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => getSystemPreference());
  const [debugLogs, setDebugLogs] = useState<ThemeDebugLog[]>([]);
  const [mountValidation, setMountValidation] = useState<ThemeSyncMountValidation | null>(null);
  const [mutationCount, setMutationCount] = useState<number>(0);
  const [isObserverActive, setIsObserverActive] = useState<boolean>(false);

  // Guard flag to prevent MutationObserver infinite feedback loops when applyDomTheme executes
  const isEnforcingRef = useRef<boolean>(false);

  // Strict check for user manual override
  const hasOverride = theme === 'light' || theme === 'dark';

  // Derived resolved theme: if theme is 'system', uses systemTheme; otherwise uses user override
  const resolvedTheme: ResolvedTheme = useMemo(() => {
    if (theme === 'system') {
      return systemTheme;
    }
    return theme;
  }, [theme, systemTheme]);

  // Robust useLayoutEffect on provider initialization:
  // Runs synchronously before browser paint and before component hydration completes.
  // Prioritizes user's manual selection over system preference logic, locking in DOM classes
  // and ensuring no post-render race conditions can alter documentElement classes.
  useLayoutEffect(() => {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;

    // Snapshot pre-mount DOM state (as prepared by index.html head script)
    const preMountDom = {
      classList: root.className,
      dataTheme: root.getAttribute('data-theme'),
      dataThemeMode: root.getAttribute('data-theme-mode'),
      colorScheme: root.style.colorScheme,
    };

    // Determine current page context
    let pageContext: 'LOGIN' | 'DASHBOARD' | 'UNKNOWN' = 'LOGIN';
    try {
      const user = localStorage.getItem('ob_logged_in_user');
      pageContext = user ? 'DASHBOARD' : 'LOGIN';
    } catch {
      pageContext = 'UNKNOWN';
    }

    // 1. Check for explicit permanent manual user override in localStorage
    const manualOverride = getStoredOverride();
    const currentSysPref = getSystemPreference();

    // Determine authoritative mode: manual override STRICTLY takes priority over system logic
    const authoritativeMode: ThemeMode = manualOverride ? manualOverride : 'system';
    const authoritativeResolved: ResolvedTheme =
      authoritativeMode === 'system' ? currentSysPref : authoritativeMode;

    // 2. Synchronize React state if out of sync
    if (theme !== authoritativeMode) {
      setThemeState(authoritativeMode);
    }
    if (systemTheme !== currentSysPref) {
      setSystemTheme(currentSysPref);
    }

    // 3. Immediately and forcefully re-apply classes and attributes on documentElement before paint
    isEnforcingRef.current = true;
    let postSyncDom: {
      classes: string;
      dataTheme: string | null;
      dataThemeMode: string | null;
      colorScheme: string;
    };

    try {
      postSyncDom = applyDomTheme(authoritativeResolved, authoritativeMode);

      // Standardize system mode: if system, clear localStorage to allow natural browser reflection.
      // If manual override (light/dark), preserve permanent local override.
      if (authoritativeMode === 'system') {
        localStorage.removeItem(THEME_STORAGE_KEY);
      } else {
        localStorage.setItem(THEME_STORAGE_KEY, authoritativeMode);
      }
    } finally {
      setTimeout(() => {
        isEnforcingRef.current = false;
      }, 10);
    }

    // Check for race condition between index.html head script and React hydration
    const hasRaceCondition =
      preMountDom.dataTheme !== null &&
      preMountDom.dataThemeMode !== null &&
      (preMountDom.dataTheme !== authoritativeResolved ||
        preMountDom.dataThemeMode !== authoritativeMode);

    const validationReport: ThemeSyncMountValidation = {
      timestamp: new Date().toISOString(),
      pageContext,
      preMountDom,
      localStorageOverride: manualOverride,
      systemPreference: currentSysPref,
      reactState: {
        theme: authoritativeMode,
        resolvedTheme: authoritativeResolved,
        hasManualOverride: authoritativeMode !== 'system',
      },
      postSyncDom: {
        classList: postSyncDom.classes,
        dataTheme: postSyncDom.dataTheme,
        dataThemeMode: postSyncDom.dataThemeMode,
        colorScheme: postSyncDom.colorScheme,
      },
      hasRaceCondition,
      isSynchronized: true,
    };

    setMountValidation(validationReport);

    // Expose global validation report for automated testing and diagnostics
    if (typeof window !== 'undefined') {
      (window as any).__THEME_SYNC_VALIDATION__ = validationReport;
    }

    // Log detailed mount validation
    if (typeof console !== 'undefined' && console.log) {
      console.log(
        `%c[ThemeSyncValidator | Mount Validation - ${pageContext}]`,
        'background: #0284c7; color: #ffffff; font-weight: bold; padding: 2px 8px; border-radius: 4px;',
        validationReport
      );
    }

    const log = logThemeDebug(`MOUNT_VALIDATION (${pageContext})`, {
      theme: authoritativeMode,
      resolvedTheme: authoritativeResolved,
      source: `mount_validation_${pageContext.toLowerCase()}`,
      domClasses: postSyncDom.classes,
      dataTheme: postSyncDom.dataTheme,
      dataThemeMode: postSyncDom.dataThemeMode,
      colorScheme: postSyncDom.colorScheme,
      extra: {
        hasRaceCondition,
        pageContext,
        localStorageOverride: manualOverride,
      },
    });

    setDebugLogs((prev) => [log, ...prev].slice(0, 30));
  }, []); // Run synchronously on provider initialization before paint

  // Set initial 'theme' state during the provider's 'useEffect' hook,
  // reading directly from localStorage with fallback to system preference,
  // and simultaneously force-applying the correct classes to document.documentElement
  // to completely prevent any style or attribute mismatches.
  useEffect(() => {
    let initialMode: ThemeMode = 'system';
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') {
        initialMode = stored;
      }
    } catch {
      // Storage access restricted or disabled
    }

    const sysPref = getSystemPreference();
    const resolved: ResolvedTheme =
      initialMode === 'system' ? sysPref : initialMode;

    // Set initial React state
    setThemeState(initialMode);
    setSystemTheme(sysPref);

    // Simultaneously force-apply the correct classes to document.documentElement
    isEnforcingRef.current = true;
    let postSyncDom: {
      classes: string;
      dataTheme: string | null;
      dataThemeMode: string | null;
      colorScheme: string;
    };

    try {
      postSyncDom = applyDomTheme(resolved, initialMode);
      if (initialMode === 'system') {
        try {
          localStorage.removeItem(THEME_STORAGE_KEY);
        } catch {}
      } else {
        try {
          localStorage.setItem(THEME_STORAGE_KEY, initialMode);
        } catch {}
      }
    } finally {
      setTimeout(() => {
        isEnforcingRef.current = false;
      }, 10);
    }

    const log = logThemeDebug('INITIAL_USE_EFFECT_STORAGE_SYNC', {
      theme: initialMode,
      resolvedTheme: resolved,
      source: 'provider_use_effect_mount',
      domClasses: postSyncDom.classes,
      dataTheme: postSyncDom.dataTheme,
      dataThemeMode: postSyncDom.dataThemeMode,
      colorScheme: postSyncDom.colorScheme,
      extra: {
        readFromLocalStorage: localStorage.getItem(THEME_STORAGE_KEY),
        fallbackSystemPreference: sysPref,
      },
    });

    setDebugLogs((prev) => [log, ...prev].slice(0, 30));
  }, []);

  // Central Unified Synchronization useEffect:
  // Synchronizes with localStorage, document.documentElement.classList,
  // and the data-theme / data-theme-mode attributes whenever theme or resolvedTheme changes.
  useEffect(() => {
    isEnforcingRef.current = true;

    let domState: {
      classes: string;
      dataTheme: string | null;
      dataThemeMode: string | null;
      colorScheme: string;
    };

    try {
      domState = applyDomTheme(resolvedTheme, theme);

      // Standardize system mode: if system, clear localStorage to allow natural browser preference reflection.
      // If explicit light or dark, persist as permanent local override.
      if (theme === 'system') {
        try {
          localStorage.removeItem(THEME_STORAGE_KEY);
        } catch {}
      } else {
        try {
          localStorage.setItem(THEME_STORAGE_KEY, theme);
        } catch {}
      }
    } finally {
      setTimeout(() => {
        isEnforcingRef.current = false;
      }, 10);
    }

    // Record central sync debug log
    const log = logThemeDebug('CENTRAL_THEME_SYNC', {
      theme,
      resolvedTheme,
      source: 'central_use_effect',
      domClasses: domState.classes,
      dataTheme: domState.dataTheme,
      dataThemeMode: domState.dataThemeMode,
      colorScheme: domState.colorScheme,
      extra: {
        hasOverride,
        storageItemCleared: theme === 'system',
      },
    });

    setDebugLogs((prev) => [log, ...prev].slice(0, 30));
  }, [theme, resolvedTheme, hasOverride]);

  // System Preference Listener:
  // Monitors OS theme media query changes.
  // Strictly prioritizes manual user overrides: if user has chosen 'light' or 'dark',
  // system preference changes are acknowledged but do NOT override user's manual choice.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleMediaChange = (e: MediaQueryListEvent | MediaQueryList) => {
      const newSystemScheme: ResolvedTheme = e.matches ? 'dark' : 'light';
      setSystemTheme(newSystemScheme);

      // Check current state: if user has an active manual override, strictly prioritize it!
      const currentOverride = getStoredOverride();

      if (currentOverride) {
        // Log that system default changed but was ignored due to user manual override
        const log = logThemeDebug('SYSTEM_CHANGE_IGNORED_DUE_TO_USER_OVERRIDE', {
          theme: currentOverride,
          resolvedTheme: currentOverride,
          source: 'os_media_query_listener',
          extra: {
            detectedSystemScheme: newSystemScheme,
            manualOverridePreserved: currentOverride,
          },
        });
        setDebugLogs((prev) => [log, ...prev].slice(0, 30));
        return;
      }

      // If user is in 'system' mode:
      // Verify override remains cleared and apply new system theme
      try {
        localStorage.removeItem(THEME_STORAGE_KEY);
      } catch {}

      const log = logThemeDebug('SYSTEM_MEDIA_QUERY_APPLIED', {
        theme: 'system',
        resolvedTheme: newSystemScheme,
        source: 'os_media_query_listener',
        extra: {
          newSystemScheme,
          overrideCleared: true,
        },
      });
      setDebugLogs((prev) => [log, ...prev].slice(0, 30));
    };

    try {
      mediaQuery.addEventListener('change', handleMediaChange);
    } catch {
      try {
        (mediaQuery as any).addListener(handleMediaChange);
      } catch {}
    }

    // Cross-tab synchronization listener
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY) {
        if (!e.newValue || e.newValue === 'system') {
          // Override was cleared in another tab -> switch to 'system'
          setThemeState('system');
        } else if (e.newValue === 'light' || e.newValue === 'dark') {
          // Manual override set in another tab -> switch to override
          setThemeState(e.newValue);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      try {
        mediaQuery.removeEventListener('change', handleMediaChange);
      } catch {
        try {
          (mediaQuery as any).removeListener(handleMediaChange);
        } catch {}
      }
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Robust MutationObserver Effect:
  // Continuously monitors and actively enforces the data-theme attribute & classes on documentElement,
  // bypassing potential browser-level caching, CSS conflicts, or external DOM alterations.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof MutationObserver === 'undefined') {
      return;
    }

    const targetNode = document.documentElement;
    const currentResolved = resolvedTheme;
    const currentMode = theme;

    const observer = new MutationObserver((mutations) => {
      if (isEnforcingRef.current) return;

      let needsReEnforce = false;
      let mutationReason = '';

      for (const mutation of mutations) {
        if (mutation.type === 'attributes') {
          const attrName = mutation.attributeName;

          if (attrName === 'data-theme') {
            const currentDataTheme = targetNode.getAttribute('data-theme');
            if (currentDataTheme !== currentResolved) {
              needsReEnforce = true;
              mutationReason = `data-theme changed from "${mutation.oldValue}" to "${currentDataTheme}" (expected "${currentResolved}")`;
              break;
            }
          }

          if (attrName === 'data-theme-mode') {
            const currentDataThemeMode = targetNode.getAttribute('data-theme-mode');
            if (currentDataThemeMode !== currentMode) {
              needsReEnforce = true;
              mutationReason = `data-theme-mode changed from "${mutation.oldValue}" to "${currentDataThemeMode}" (expected "${currentMode}")`;
              break;
            }
          }

          if (attrName === 'class') {
            const hasCorrectClass = targetNode.classList.contains(currentResolved);
            const opposingClass = currentResolved === 'dark' ? 'light' : 'dark';
            const hasOpposingClass = targetNode.classList.contains(opposingClass);

            if (!hasCorrectClass || hasOpposingClass) {
              needsReEnforce = true;
              mutationReason = `classList modified (${targetNode.className}) missing "${currentResolved}"`;
              break;
            }
          }

          if (attrName === 'style') {
            const currentColorScheme = targetNode.style.colorScheme;
            if (currentColorScheme && currentColorScheme !== currentResolved) {
              needsReEnforce = true;
              mutationReason = `style.colorScheme changed to "${currentColorScheme}" (expected "${currentResolved}")`;
              break;
            }
          }
        }
      }

      if (needsReEnforce) {
        isEnforcingRef.current = true;
        setMutationCount((cnt) => cnt + 1);

        try {
          const domState = applyDomTheme(currentResolved, currentMode);
          const log = logThemeDebug('MUTATION_OBSERVER_ENFORCED', {
            theme: currentMode,
            resolvedTheme: currentResolved,
            source: 'mutation_observer',
            domClasses: domState.classes,
            dataTheme: domState.dataTheme,
            dataThemeMode: domState.dataThemeMode,
            colorScheme: domState.colorScheme,
            extra: { mutationReason },
          });
          setDebugLogs((prev) => [log, ...prev].slice(0, 30));
        } finally {
          setTimeout(() => {
            isEnforcingRef.current = false;
          }, 20);
        }
      }
    });

    observer.observe(targetNode, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-theme-mode', 'class', 'style'],
      attributeOldValue: true,
    });

    setIsObserverActive(true);

    return () => {
      observer.disconnect();
      setIsObserverActive(false);
    };
  }, [resolvedTheme, theme]);

  // Set Theme:
  // If 'system', specifically clears the localStorage override item to allow natural browser reflection.
  // If 'light' or 'dark', stores the permanent manual user override.
  const setTheme = useCallback((newTheme: ThemeMode) => {
    if (newTheme === 'system') {
      try {
        localStorage.removeItem(THEME_STORAGE_KEY);
      } catch {}
    } else {
      try {
        localStorage.setItem(THEME_STORAGE_KEY, newTheme);
      } catch {}
    }
    setThemeState(newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    const nextTheme: ThemeMode =
      theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
    setTheme(nextTheme);
  }, [theme, setTheme]);

  const forceSync = useCallback(() => {
    applyDomTheme(resolvedTheme, theme);
    if (theme === 'system') {
      try {
        localStorage.removeItem(THEME_STORAGE_KEY);
      } catch {}
    } else {
      try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
      } catch {}
    }
  }, [resolvedTheme, theme]);

  const clearLogs = useCallback(() => {
    setDebugLogs([]);
  }, []);

  const contextValue = useMemo(
    () => ({
      theme,
      resolvedTheme,
      systemTheme,
      hasOverride,
      setTheme,
      toggleTheme,
      forceSync,
      debugLogs,
      mountValidation,
      mutationCount,
      isObserverActive,
      clearLogs,
    }),
    [
      theme,
      resolvedTheme,
      systemTheme,
      hasOverride,
      setTheme,
      toggleTheme,
      forceSync,
      debugLogs,
      mountValidation,
      mutationCount,
      isObserverActive,
      clearLogs,
    ]
  );

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
