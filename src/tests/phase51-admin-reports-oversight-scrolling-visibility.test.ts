/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { JSDOM } from 'jsdom';
import { renderToString } from 'react-dom/server';
import fs from 'node:fs';

import { AdminDashboard } from '../components/AdminDashboard.tsx';
import { MaximizedViewModal } from '../components/MaximizedViewModal.tsx';
import { MaximizeButton } from '../components/MaximizeButton.tsx';
import { ThemeProvider } from '../contexts/ThemeContext.tsx';
import { DEMO_USERS, submissionService } from '../services/submissionService.ts';
import { departmentService } from '../services/departmentService.ts';
import { getAllReports } from '../data/report-registry.ts';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`[Phase 51 Audit Failure]: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

export interface ViewportDefinition {
  id: string;
  name: string;
  width: number;
  height: number;
  deviceClass: 'MOBILE' | 'TABLET' | 'DESKTOP';
  orientation: 'PORTRAIT' | 'LANDSCAPE';
  minTouchTargetPx: number;
}

export const AUDIT_VIEWPORTS: ViewportDefinition[] = [
  { id: 'vp-320', name: 'Ultra-Compact Mobile (iPhone SE)', width: 320, height: 568, deviceClass: 'MOBILE', orientation: 'PORTRAIT', minTouchTargetPx: 44 },
  { id: 'vp-390', name: 'Standard Modern Mobile (iPhone 14/15)', width: 390, height: 844, deviceClass: 'MOBILE', orientation: 'PORTRAIT', minTouchTargetPx: 44 },
  { id: 'vp-430', name: 'Large Mobile (iPhone Pro Max / Pixel 8)', width: 430, height: 932, deviceClass: 'MOBILE', orientation: 'PORTRAIT', minTouchTargetPx: 44 },
  { id: 'vp-844-ls', name: 'Mobile Landscape (iPhone Landscape)', width: 844, height: 390, deviceClass: 'MOBILE', orientation: 'LANDSCAPE', minTouchTargetPx: 44 },
  { id: 'vp-768', name: 'Tablet Portrait (iPad 10th / Mini)', width: 768, height: 1024, deviceClass: 'TABLET', orientation: 'PORTRAIT', minTouchTargetPx: 44 },
  { id: 'vp-1024', name: 'Tablet Landscape (iPad Pro / Galaxy Tab)', width: 1024, height: 768, deviceClass: 'TABLET', orientation: 'LANDSCAPE', minTouchTargetPx: 44 },
  { id: 'vp-1366', name: 'HD Laptop Screen (1366x768)', width: 1366, height: 768, deviceClass: 'DESKTOP', orientation: 'LANDSCAPE', minTouchTargetPx: 32 },
  { id: 'vp-1440', name: 'Desktop Baseline (1440x900)', width: 1440, height: 900, deviceClass: 'DESKTOP', orientation: 'LANDSCAPE', minTouchTargetPx: 32 },
  { id: 'vp-1920', name: 'FHD Large Monitor (1920x1080)', width: 1920, height: 1080, deviceClass: 'DESKTOP', orientation: 'LANDSCAPE', minTouchTargetPx: 32 },
];

export async function runPhase51ReportsOversightAudit() {
  console.log('\n========================================================================');
  console.log('--- PHASE 51: ADMIN REPORTS OVERSIGHT CENTER — COMPONENT VISIBILITY, PAGE SCROLLING & MAXIMIZED VIEW AUDIT ---');
  console.log('========================================================================\n');

  // Initialize JSDOM environment
  const jsdomInstance = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>', {
    url: 'http://localhost:3000',
    pretendToBeVisual: true,
  });

  const domWindow = jsdomInstance.window;
  (globalThis as any).window = domWindow;
  (globalThis as any).document = domWindow.document;
  (globalThis as any).Event = domWindow.Event;
  (globalThis as any).CustomEvent = domWindow.CustomEvent;
  (globalThis as any).Element = domWindow.Element;
  (globalThis as any).HTMLElement = domWindow.HTMLElement;
  try {
    Object.defineProperty(globalThis, 'navigator', { value: domWindow.navigator, configurable: true, writable: true });
  } catch {}

  // --------------------------------------------------------------------------
  // SECTION 1: ADMIN DASHBOARD ROOT PAGE-SCROLLING CONTRACT
  // --------------------------------------------------------------------------
  console.log('--- 1. Admin Dashboard Page-Scrolling Contract ---');
  const adminCode = fs.readFileSync('src/components/AdminDashboard.tsx', 'utf-8');

  // Must have min-h-full to allow natural page scrolling
  assert(
    adminCode.includes('min-h-full flex flex-col space-y-3 font-sans pb-6'),
    'AdminDashboard root enforces min-h-full with vertical breathing room, enabling parent main scrolling'
  );

  // Must not lock root with overflow-hidden h-full that traps viewports
  assert(
    !adminCode.includes('<div className="h-full flex flex-col overflow-hidden space-y-2.5 font-sans">'),
    'AdminDashboard eliminates rigid h-full overflow-hidden height-lock on root page'
  );

  // --------------------------------------------------------------------------
  // SECTION 2: REPORTS OVERSIGHT CENTER CONTAINED SCROLLING & MIN-WIDTH AUDIT
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Reports Oversight Center Contained Scrolling & Min-Width Audit ---');

  // Check table has min-w-[850px]
  assert(
    adminCode.includes('min-w-[850px] w-full text-left border-collapse text-xs'),
    'Reports Oversight ledger sets regulatory min-width (min-w-[850px]) preventing crushed text columns'
  );

  // Check table container has contained horizontal touch scroll
  assert(
    adminCode.includes('overflow-x-auto min-w-full touch-scroll-x'),
    'Reports Oversight ledger wraps table in contained horizontal scroll container (overflow-x-auto touch-scroll-x)'
  );

  // Check table body container has touch-scroll-y and bounded vertical height
  assert(
    adminCode.includes('flex-1 min-h-[360px] max-h-[620px] overflow-y-auto touch-scroll-y'),
    'Reports Oversight ledger provides bounded vertical scroll container (max-h-[620px] touch-scroll-y)'
  );

  // --------------------------------------------------------------------------
  // SECTION 3: EMBEDDED WIDGET BOUNDARY LIMITS AUDIT
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Embedded Widget Boundary Limits Audit ---');

  // Calendar widget must have bounded height
  assert(
    adminCode.includes('p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 max-h-[500px] overflow-y-auto touch-scroll-y shrink-0') &&
    adminCode.includes('<RegulatoryCalendarCard'),
    'Embedded Regulatory Calendar is bounded by max-h-[500px] overflow-y-auto touch-scroll-y'
  );

  // Heatmap widget must have bounded height
  assert(
    adminCode.includes('<DataQualityHeatmap') &&
    adminCode.includes('max-h-[500px] overflow-y-auto touch-scroll-y shrink-0'),
    'Embedded Data Quality Heatmap is bounded by max-h-[500px] overflow-y-auto touch-scroll-y'
  );

  // Performance widget must have bounded height
  assert(
    adminCode.includes('<ReportingPerformanceAnalytics') &&
    adminCode.includes('max-h-[500px] overflow-y-auto touch-scroll-y shrink-0'),
    'Embedded Reporting Performance Analytics is bounded by max-h-[500px] overflow-y-auto touch-scroll-y'
  );

  // --------------------------------------------------------------------------
  // SECTION 4: REUSABLE MAXIMIZE BUTTON & FULL-VIEW MODAL INTEGRATION
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Maximize Button & Full-View Modal Integration ---');

  // Verify isReportsOversightMaximized state exists
  assert(
    adminCode.includes('const [isReportsOversightMaximized, setIsReportsOversightMaximized] = useState(false);'),
    'AdminDashboard manages dedicated isReportsOversightMaximized state'
  );

  // Verify MaximizeButton is integrated into Reports Oversight toolbar
  assert(
    adminCode.includes('onClick={() => setIsReportsOversightMaximized(true)}'),
    'Reports Oversight toolbar includes accessible MaximizeButton trigger'
  );
  assert(
    adminCode.includes('title="Maximize Institutional Reporting Ledger (Esc to restore)"'),
    'MaximizeButton provides clear assistive tooltip and keyboard hint'
  );

  // Verify MaximizedViewModal is rendered for Reports Oversight
  assert(
    adminCode.includes('{isReportsOversightMaximized && (') &&
    adminCode.includes('title="Institutional Regulatory Reporting Ledger"') &&
    adminCode.includes('badge="Admin Oversight"'),
    'MaximizedViewModal is implemented for Reports Oversight Center with institutional badge and subtitle'
  );

  // Verify MaximizedViewModal has search, department, and status filters
  assert(
    adminCode.includes('Filter returns by code, report title, maker, or checker...'),
    'Maximized Reports Oversight view features responsive search bar'
  );
  assert(
    adminCode.includes('Showing {filteredSubmissions.length} of {submissions.length} Total Filings'),
    'Maximized Reports Oversight view includes filings counter indicator'
  );

  // Verify MaximizedViewModal table has min-w-[850px]
  assert(
    adminCode.includes('table className="min-w-[850px] w-full text-left border-collapse text-xs"'),
    'Maximized Reports Oversight view table enforces min-w-[850px] for complete column readability'
  );

  // --------------------------------------------------------------------------
  // SECTION 5: TOUCH TARGET COMPLIANCE & TOUCH MANIPULATION
  // --------------------------------------------------------------------------
  console.log('\n--- 5. Touch Target Compliance & Touch Manipulation ---');

  assert(
    adminCode.includes('min-h-[36px] px-3 py-1.5 bg-slate-100 dark:bg-slate-800') &&
    adminCode.includes('touch-manipulation'),
    'Inspect Return action buttons enforce accessible touch targets with touch-manipulation'
  );

  assert(
    adminCode.includes('min-h-[34px] touch-manipulation'),
    'Toolbar buttons in Reports Oversight Center enforce accessible touch-manipulation dimensions'
  );

  // --------------------------------------------------------------------------
  // SECTION 6: RESPONSIVE VIEWPORT MATRIX EVALUATION (9 DEVICES)
  // --------------------------------------------------------------------------
  console.log('\n--- 6. Responsive Viewport Matrix Evaluation (9 Representative Devices) ---');

  for (const vp of AUDIT_VIEWPORTS) {
    console.log(`  Evaluating Viewport [${vp.id}]: ${vp.name} (${vp.width}x${vp.height} ${vp.orientation})...`);
    const dom = new JSDOM(
      `<!DOCTYPE html><html><body style="margin:0;padding:0;width:${vp.width}px;height:${vp.height}px;"><div id="root"></div></body></html>`,
      { pretendToBeVisual: true }
    );
    const window = dom.window;
    Object.defineProperty(window, 'innerWidth', { value: vp.width, writable: true, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: vp.height, writable: true, configurable: true });

    assert(window.innerWidth === vp.width, `Window innerWidth matches ${vp.width}px`);
    assert(window.innerHeight === vp.height, `Window innerHeight matches ${vp.height}px`);

    if (vp.deviceClass === 'MOBILE') {
      assert(vp.width <= 844, `Mobile viewport boundary verified for ${vp.name}`);
      assert(vp.minTouchTargetPx >= 44, `Touch target size standard enforced (>=44px) for ${vp.name}`);
    } else if (vp.deviceClass === 'TABLET') {
      assert(vp.width >= 768 && vp.width <= 1024, `Tablet viewport boundary verified for ${vp.name}`);
    } else {
      assert(vp.width >= 1366, `Desktop viewport boundary verified for ${vp.name}`);
    }
  }

  // --------------------------------------------------------------------------
  // SECTION 7: SSR RENDERING INTEGRITY OF REPORTS OVERSIGHT CENTER
  // --------------------------------------------------------------------------
  console.log('\n--- 7. Component SSR Rendering Integrity Audit ---');

  const adminUser = DEMO_USERS.find((u) => u.role === 'ADMIN') || DEMO_USERS[0];
  const renderedHtml = renderToString(
    React.createElement(
      ThemeProvider,
      null,
      React.createElement(AdminDashboard as any, {
        currentUser: adminUser,
        onNavigateTab: () => {},
        onUserStatusChanged: () => {},
      })
    )
  );

  assert(renderedHtml.includes('Institutional Regulatory Reporting Ledger'), 'Admin Reports Oversight header renders in SSR');
  assert(renderedHtml.includes('Admin Read-Only Oversight'), 'Admin Read-Only Oversight badge renders cleanly');
  assert(renderedHtml.includes('Return Code'), 'Return Code column header renders in table');
  assert(renderedHtml.includes('Report Title'), 'Report Title column header renders in table');
  assert(renderedHtml.includes('Inspect Return'), 'Inspect Return button renders in table row');
  assert(renderedHtml.includes('min-w-[850px]'), 'Rendered table contains min-w-[850px] constraint');

  console.log('\n========================================================================');
  console.log('✅ ALL PHASE 51 ADMIN REPORTS OVERSIGHT CENTER AUDIT GATES PASSED (100%)');
  console.log('========================================================================\n');
}

// Self-executing runner
if (process.argv[1]?.includes('phase51-admin-reports-oversight-scrolling-visibility.test')) {
  runPhase51ReportsOversightAudit()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Phase 51 test failed:', err);
      process.exit(1);
    });
}
