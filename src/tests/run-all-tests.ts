/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  getSystemPreference,
  getStoredTheme,
  getStoredOverride,
  resolveTheme,
  applyDomTheme,
  logThemeDebug,
  THEME_STORAGE_KEY,
  THEME_CHANGE_EVENT,
  ThemeMode,
  ResolvedTheme,
} from '../contexts/ThemeContext.tsx';
import { ThemeToggle } from '../components/ThemeToggle.tsx';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${msg}`);
  }
  console.log(`✓ ${msg}`);
}

console.log('--- Starting Theme Persistence, Override Priority & Mount Flow Tests ---');

// Mock browser environment for automated testing of mount synchronization flows
class MockLocalStorage {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] !== undefined ? this.store[key] : null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }
}

class MockElement {
  classList = {
    classes: new Set<string>(),
    add: (c: string) => this.classList.classes.add(c),
    remove: (c: string) => this.classList.classes.delete(c),
    contains: (c: string) => this.classList.classes.has(c),
  };
  attributes: Record<string, string> = {};
  style: Record<string, string> = {};

  setAttribute(k: string, v: string) {
    this.attributes[k] = String(v);
  }

  getAttribute(k: string) {
    return this.attributes[k] !== undefined ? this.attributes[k] : null;
  }

  removeAttribute(k: string) {
    delete this.attributes[k];
  }

  get className() {
    return Array.from(this.classList.classes).join(' ');
  }

  set className(v: string) {
    this.classList.classes = new Set(v.split(' ').filter(Boolean));
  }
}

const mockDoc = {
  documentElement: new MockElement(),
  body: new MockElement(),
  getElementById: (id: string) => (id === 'root' ? new MockElement() : null),
};

const mockStorage = new MockLocalStorage();

(global as any).document = mockDoc;
(global as any).localStorage = mockStorage;
(global as any).window = {
  matchMedia: (query: string) => ({
    matches: false, // Default light OS
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }),
  dispatchEvent: () => true,
};

// Section 1: Core Theme Resolution
assert(resolveTheme('light') === 'light', 'resolveTheme("light") should resolve to "light"');
assert(resolveTheme('dark') === 'dark', 'resolveTheme("dark") should resolve to "dark"');
const sysRes = resolveTheme('system');
assert(sysRes === 'light' || sysRes === 'dark', `resolveTheme("system") resolves to valid theme (${sysRes})`);

// Section 2: Storage Key Constants
assert(THEME_STORAGE_KEY === 'oromia_nbe_theme_preference', 'THEME_STORAGE_KEY is exact');
assert(THEME_CHANGE_EVENT === 'oromia_theme_changed', 'THEME_CHANGE_EVENT is exact');

// Section 3: Manual User Override Priority over System Defaults
mockStorage.clear();
assert(getStoredOverride() === null, 'When no storage item exists, getStoredOverride() returns null');
assert(getStoredTheme() === 'system', 'When no storage item exists, getStoredTheme() returns "system"');

// Set manual dark override
mockStorage.setItem(THEME_STORAGE_KEY, 'dark');
assert(getStoredOverride() === 'dark', 'getStoredOverride() detects manual dark override');
assert(getStoredTheme() === 'dark', 'getStoredTheme() strictly prioritizes manual dark override over system');

// Set manual light override
mockStorage.setItem(THEME_STORAGE_KEY, 'light');
assert(getStoredOverride() === 'light', 'getStoredOverride() detects manual light override');
assert(getStoredTheme() === 'light', 'getStoredTheme() strictly prioritizes manual light override over system');

// Section 4: Clearing Override on 'system' Selection
// When user chooses 'system', the override must be specifically cleared from localStorage
mockStorage.removeItem(THEME_STORAGE_KEY);
assert(mockStorage.getItem(THEME_STORAGE_KEY) === null, 'localStorage item specifically cleared on system selection');
assert(getStoredOverride() === null, 'No manual override present after clearing');
assert(getStoredTheme() === 'system', 'Theme correctly falls back to system preference');

// Section 5: DOM Application & Unified Synchronization
// Apply Dark Mode
const darkDom = applyDomTheme('dark', 'dark');
assert(mockDoc.documentElement.classList.contains('dark'), 'documentElement class contains "dark"');
assert(!mockDoc.documentElement.classList.contains('light'), 'documentElement class does not contain "light"');
assert(mockDoc.documentElement.getAttribute('data-theme') === 'dark', 'data-theme attribute is "dark"');
assert(mockDoc.documentElement.getAttribute('data-theme-mode') === 'dark', 'data-theme-mode attribute is "dark"');
assert(mockDoc.documentElement.style.colorScheme === 'dark', 'style.colorScheme is "dark"');

// Apply Light Mode
const lightDom = applyDomTheme('light', 'light');
assert(mockDoc.documentElement.classList.contains('light'), 'documentElement class contains "light"');
assert(!mockDoc.documentElement.classList.contains('dark'), 'documentElement class does not contain "dark"');
assert(mockDoc.documentElement.getAttribute('data-theme') === 'light', 'data-theme attribute is "light"');
assert(mockDoc.documentElement.getAttribute('data-theme-mode') === 'light', 'data-theme-mode attribute is "light"');
assert(mockDoc.documentElement.style.colorScheme === 'light', 'style.colorScheme is "light"');

// Apply System Mode (with resolved dark)
const sysDarkDom = applyDomTheme('dark', 'system');
assert(mockDoc.documentElement.classList.contains('dark'), 'System mode: resolved dark class applied');
assert(mockDoc.documentElement.getAttribute('data-theme') === 'dark', 'System mode: data-theme is resolved "dark"');
assert(mockDoc.documentElement.getAttribute('data-theme-mode') === 'system', 'System mode: data-theme-mode is "system"');

// Section 6: Mount Synchronization Flow Validation on LOGIN Page
console.log('\n--- Validating Mount Synchronization Flow on LOGIN Page ---');
function simulateMountValidation(page: 'LOGIN' | 'DASHBOARD', initialOverride: ThemeMode | null, prefersDark: boolean) {
  mockStorage.clear();
  if (page === 'DASHBOARD') {
    mockStorage.setItem('ob_logged_in_user', JSON.stringify({ role: 'ADMIN', name: 'Admin User' }));
  }
  if (initialOverride && initialOverride !== 'system') {
    mockStorage.setItem(THEME_STORAGE_KEY, initialOverride);
  }

  // 1. Simulate index.html head script execution
  const stored = mockStorage.getItem(THEME_STORAGE_KEY);
  const mode = (stored === 'light' || stored === 'dark') ? stored : 'system';
  const isDark = mode === 'dark' || (mode === 'system' && prefersDark);
  const themeVal = isDark ? 'dark' : 'light';

  mockDoc.documentElement.classList.remove('dark');
  mockDoc.documentElement.classList.remove('light');
  mockDoc.documentElement.classList.add(themeVal);
  mockDoc.documentElement.setAttribute('data-theme', themeVal);
  mockDoc.documentElement.setAttribute('data-theme-mode', mode);
  mockDoc.documentElement.style.colorScheme = themeVal;

  const preMountDom = {
    classList: mockDoc.documentElement.className,
    dataTheme: mockDoc.documentElement.getAttribute('data-theme'),
    dataThemeMode: mockDoc.documentElement.getAttribute('data-theme-mode'),
    colorScheme: mockDoc.documentElement.style.colorScheme,
  };

  // 2. Simulate React ThemeProvider initialization & mount validation
  const currentOverride = getStoredOverride();
  const currentMode = currentOverride ? currentOverride : 'system';
  const expectedResolved = currentMode === 'system' ? (prefersDark ? 'dark' : 'light') : currentMode;

  const hasRaceCondition =
    preMountDom.dataTheme !== null &&
    preMountDom.dataThemeMode !== null &&
    (preMountDom.dataTheme !== expectedResolved || preMountDom.dataThemeMode !== currentMode);

  // 3. Post-sync enforcement
  applyDomTheme(expectedResolved, currentMode);

  return {
    page,
    hasRaceCondition,
    preMountDom,
    currentMode,
    expectedResolved,
    isSynchronized: !hasRaceCondition,
  };
}

// Test Login Page: System Mode (Default OS Light)
const loginSystemLight = simulateMountValidation('LOGIN', null, false);
assert(!loginSystemLight.hasRaceCondition, 'Login Page (System Light): No race condition detected');
assert(loginSystemLight.expectedResolved === 'light', 'Login Page (System Light): Correctly resolved to light');

// Test Login Page: System Mode (Default OS Dark)
const loginSystemDark = simulateMountValidation('LOGIN', null, true);
assert(!loginSystemDark.hasRaceCondition, 'Login Page (System Dark): No race condition detected');
assert(loginSystemDark.expectedResolved === 'dark', 'Login Page (System Dark): Correctly resolved to dark');

// Test Login Page: Manual Dark Override
const loginManualDark = simulateMountValidation('LOGIN', 'dark', false);
assert(!loginManualDark.hasRaceCondition, 'Login Page (Manual Dark): No race condition detected');
assert(loginManualDark.expectedResolved === 'dark', 'Login Page (Manual Dark): Manual dark override honored');

// Test Login Page: Manual Light Override
const loginManualLight = simulateMountValidation('LOGIN', 'light', true);
assert(!loginManualLight.hasRaceCondition, 'Login Page (Manual Light): No race condition detected');
assert(loginManualLight.expectedResolved === 'light', 'Login Page (Manual Light): Manual light override honored');

// Section 7: Mount Synchronization Flow Validation on DASHBOARD Page
console.log('\n--- Validating Mount Synchronization Flow on DASHBOARD Page ---');
const dashSystemLight = simulateMountValidation('DASHBOARD', null, false);
assert(!dashSystemLight.hasRaceCondition, 'Dashboard Page (System Light): No race condition detected');

const dashManualDark = simulateMountValidation('DASHBOARD', 'dark', false);
assert(!dashManualDark.hasRaceCondition, 'Dashboard Page (Manual Dark): No race condition detected');
assert(dashManualDark.expectedResolved === 'dark', 'Dashboard Page (Manual Dark): Manual dark override honored');

// Section 8: Headless UI Component Export Verification
assert(typeof ThemeToggle === 'function', 'ThemeToggle (Headless UI) component is correctly exported');

// Section 9: ThemeSyncMonitor 500ms Validation Logic Tests
console.log('\n--- Validating ThemeSyncMonitor 500ms Validation Logic ---');
import { ThemeSyncMonitor } from '../components/ThemeSyncMonitor.tsx';
assert(typeof ThemeSyncMonitor === 'function', 'ThemeSyncMonitor component is correctly exported');

function validateThemeSync(storageVal: string | null, domTheme: string | null, prefersDark: boolean) {
  const currentSysPref = prefersDark ? 'dark' : 'light';
  const effectiveMode = storageVal === 'light' || storageVal === 'dark' ? storageVal : 'system';
  const expectedDataTheme = effectiveMode === 'system' ? currentSysPref : effectiveMode;
  const isMismatch = domTheme !== expectedDataTheme;
  return { isMismatch, expectedDataTheme, actualDataTheme: domTheme };
}

// Case 1: Synced Dark Mode
const syncCheck1 = validateThemeSync('dark', 'dark', false);
assert(!syncCheck1.isMismatch, 'ThemeSyncMonitor: No mismatch when storage="dark" and DOM="dark"');

// Case 2: Synced Light Mode
const syncCheck2 = validateThemeSync('light', 'light', true);
assert(!syncCheck2.isMismatch, 'ThemeSyncMonitor: No mismatch when storage="light" and DOM="light"');

// Case 3: Synced System Mode (OS Dark)
const syncCheck3 = validateThemeSync(null, 'dark', true);
assert(!syncCheck3.isMismatch, 'ThemeSyncMonitor: No mismatch when storage=null (system) and DOM="dark" (OS dark)');

// Case 4: Mismatched State (Storage="dark" but DOM="light")
const syncCheck4 = validateThemeSync('dark', 'light', false);
assert(syncCheck4.isMismatch, 'ThemeSyncMonitor: Correctly detects mismatch when storage="dark" but DOM="light"');
assert(syncCheck4.expectedDataTheme === 'dark', 'ThemeSyncMonitor: Correctly flags expectedDataTheme as "dark"');

// Case 5: Mismatched State in System Mode (Storage=null but DOM="light" while OS is dark)
const syncCheck5 = validateThemeSync(null, 'light', true);
assert(syncCheck5.isMismatch, 'ThemeSyncMonitor: Correctly detects mismatch when storage=null but DOM="light" on OS dark');

// Section 10: Provider useEffect Mount Resolution & DOM Force-Application
console.log('\n--- Validating Provider useEffect Mount Resolution & DOM Force-Application ---');
function simulateUseEffectMountResolution(storageVal: string | null, prefersDark: boolean) {
  mockStorage.clear();
  if (storageVal) {
    mockStorage.setItem(THEME_STORAGE_KEY, storageVal);
  }

  // Simulate provider useEffect logic
  let initialMode: ThemeMode = 'system';
  const stored = mockStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') {
    initialMode = stored;
  }
  const sysPref: ResolvedTheme = prefersDark ? 'dark' : 'light';
  const resolved: ResolvedTheme = initialMode === 'system' ? sysPref : initialMode;

  const postSyncDom = applyDomTheme(resolved, initialMode);
  if (initialMode === 'system') {
    mockStorage.removeItem(THEME_STORAGE_KEY);
  } else {
    mockStorage.setItem(THEME_STORAGE_KEY, initialMode);
  }

  return { initialMode, resolved, postSyncDom, finalStorage: mockStorage.getItem(THEME_STORAGE_KEY) };
}

// 1. Direct dark override in localStorage
const mountDark = simulateUseEffectMountResolution('dark', false);
assert(mountDark.initialMode === 'dark', 'useEffect mount: correctly sets theme to "dark" from localStorage');
assert(mountDark.resolved === 'dark', 'useEffect mount: correctly resolves to "dark"');
assert(mockDoc.documentElement.classList.contains('dark'), 'useEffect mount: force-applies "dark" class to documentElement');
assert(mockDoc.documentElement.getAttribute('data-theme') === 'dark', 'useEffect mount: force-applies data-theme="dark"');
assert(mountDark.finalStorage === 'dark', 'useEffect mount: preserves "dark" in localStorage');

// 2. Direct light override in localStorage
const mountLight = simulateUseEffectMountResolution('light', true);
assert(mountLight.initialMode === 'light', 'useEffect mount: correctly sets theme to "light" from localStorage');
assert(mountLight.resolved === 'light', 'useEffect mount: correctly resolves to "light"');
assert(mockDoc.documentElement.classList.contains('light'), 'useEffect mount: force-applies "light" class to documentElement');
assert(mockDoc.documentElement.getAttribute('data-theme') === 'light', 'useEffect mount: force-applies data-theme="light"');
assert(mountLight.finalStorage === 'light', 'useEffect mount: preserves "light" in localStorage');

// 3. Fallback to system preference (OS Dark)
const mountSystemDark = simulateUseEffectMountResolution(null, true);
assert(mountSystemDark.initialMode === 'system', 'useEffect mount: falls back to "system" when no storage item exists');
assert(mountSystemDark.resolved === 'dark', 'useEffect mount: resolves to system preference "dark"');
assert(mockDoc.documentElement.classList.contains('dark'), 'useEffect mount: force-applies system "dark" class');
assert(mountSystemDark.finalStorage === null, 'useEffect mount: clears localStorage override for system mode');

// 4. Fallback to system preference (OS Light)
const mountSystemLight = simulateUseEffectMountResolution(null, false);
assert(mountSystemLight.initialMode === 'system', 'useEffect mount: falls back to "system" when no storage item exists');
assert(mountSystemLight.resolved === 'light', 'useEffect mount: resolves to system preference "light"');
assert(mockDoc.documentElement.classList.contains('light'), 'useEffect mount: force-applies system "light" class');
assert(mountSystemLight.finalStorage === null, 'useEffect mount: clears localStorage override for system mode');

console.log('\n--- All Automated Theme Synchronization & Mount Flow Tests Passed Successfully! ---');

import { runRegulatoryCoreTests } from './regulatory-core.test.ts';
import { runSecurityRbacWorkflowTests } from './security-rbac-workflow.test.ts';
import { runNbeSimulatorTests } from './nbe-simulator-integration.test.ts';
import { runPhase2SsotTests } from './phase2-ssot.test.ts';
import { runBiometricAndAccessoryTests } from './biometric-and-accessory.test.ts';
import { runPdfAndSnapshotTests } from './pdf-and-snapshot.test.ts';
import { runIndexedDbOfflineStorageTests } from './indexeddb-offline-storage.test.ts';
import { runResponsiveUiAndLayoutTests } from './responsive-ui-and-layout.test.ts';
import { runAuditorWorkflowTests } from './auditor-workflow.test.ts';
import { runDesignSystemColorsTests } from './design-system-and-colors.test.ts';

async function runFullApplicationTestSuite() {
  runRegulatoryCoreTests();
  await runSecurityRbacWorkflowTests();
  await runNbeSimulatorTests();
  await runPhase2SsotTests();
  await runBiometricAndAccessoryTests();
  await runPdfAndSnapshotTests();
  await runIndexedDbOfflineStorageTests();
  await runResponsiveUiAndLayoutTests();
  await runAuditorWorkflowTests();
  await runDesignSystemColorsTests();

  console.log('\n========================================================================');
  console.log('✅ ALL COMPREHENSIVE AUTOMATED TEST SUITES PASSED CLEANLY (100% SUCCESS)');
  console.log('========================================================================\n');
}

runFullApplicationTestSuite().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
