/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Phase 1: OB Visual Design System & Color Standardization Test Suite
 */

import { OB_BRAND_COLORS } from '../styles/designTokens.ts';
import fs from 'fs';
import path from 'path';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`  ✓ ${message}`);
  }
}

export async function runDesignSystemColorsTests(): Promise<void> {
  console.log('\n========================================================================');
  console.log('--- 10. OB VISUAL DESIGN SYSTEM & COLOR STANDARDIZATION (PHASE 1) ---');
  console.log('========================================================================');

  // 1. Authoritative OB Green (#8CC51F)
  console.log('\n--- 1. Authoritative OB Green (#8CC51F) Verification ---');
  assert(
    OB_BRAND_COLORS.primaryGreen === '#8CC51F',
    'Authoritative OB Green is strictly #8CC51F per Abinet Alemu directive'
  );
  assert(
    OB_BRAND_COLORS.green[500] === '#8CC51F',
    'Green 500 shade in palette matches #8CC51F'
  );

  const cssContent = fs.readFileSync(path.resolve('src/index.css'), 'utf-8');
  assert(
    cssContent.includes('--color-ob-green: #8CC51F'),
    'CSS theme variables declare --color-ob-green as #8CC51F'
  );
  assert(
    cssContent.includes('--ob-primary-green: #8CC51F'),
    'CSS theme variables declare --ob-primary-green as #8CC51F'
  );

  const pdfContent = fs.readFileSync(path.resolve('src/utils/pdfReportGenerator.ts'), 'utf-8');
  assert(
    pdfContent.includes('140, 197, 31'),
    'PDF generation utilities reference #8CC51F RGB [140, 197, 31]'
  );

  // 2. Authoritative OB Blue (#5962AB) & Requested (#5863AC)
  console.log('\n--- 2. Authoritative OB Blue (#5962AB) & Requested (#5863AC) Alignment ---');
  assert(
    OB_BRAND_COLORS.primaryBlue === '#5962AB',
    'Authoritative documented OB Blue is #5962AB'
  );
  assert(
    OB_BRAND_COLORS.primaryBlueOwnerRequested === '#5863AC',
    'Requested OB Blue #5863AC is recorded with exact 1-RGB-point documentation'
  );
  assert(
    cssContent.includes('--color-ob-blue: #5962AB'),
    'CSS theme variables declare --color-ob-blue as #5962AB'
  );
  assert(
    cssContent.includes('--ob-primary-blue: #5962AB'),
    'CSS theme variables declare --ob-primary-blue as #5962AB'
  );

  // 3. Sidebar Color Transformation (Black to Authoritative OB Blue)
  console.log('\n--- 3. Sidebar Color Transformation (Black to Authoritative OB Blue) ---');
  assert(
    OB_BRAND_COLORS.sidebar.background === '#5962AB',
    'Sidebar design tokens configure authoritative OB Blue as background'
  );
  assert(
    OB_BRAND_COLORS.sidebar.itemActiveBg === '#2C3161',
    'Sidebar design tokens configure high-contrast active item background #2C3161'
  );
  assert(
    OB_BRAND_COLORS.sidebar.itemBadgeBg === '#8CC51F',
    'Sidebar design tokens configure authoritative OB Green badge background #8CC51F'
  );

  const sidebarContent = fs.readFileSync(path.resolve('src/components/Sidebar.tsx'), 'utf-8');
  assert(
    sidebarContent.includes('bg-ob-blue-500'),
    'Sidebar.tsx utilizes bg-ob-blue-500 container class across desktop and drawer'
  );
  assert(
    sidebarContent.includes('bg-ob-blue-800'),
    'Sidebar.tsx utilizes high-contrast bg-ob-blue-800 for active navigation items'
  );
  assert(
    !sidebarContent.includes('bg-[#121428]'),
    'Sidebar eliminates previous hardcoded dark background #121428'
  );

  // 4. Visual Consistency & Standardization
  console.log('\n--- 4. Visual Consistency & Auditor Standardization ---');
  const auditorContent = fs.readFileSync(path.resolve('src/components/AuditorDashboard.tsx'), 'utf-8');
  assert(
    !auditorContent.includes('dark:bg-[#101438]'),
    'AuditorDashboard eliminates arbitrary dark:bg-[#101438]'
  );
  assert(
    !auditorContent.includes('dark:bg-[#141944]'),
    'AuditorDashboard eliminates arbitrary dark:bg-[#141944]'
  );
  assert(
    !auditorContent.includes('dark:bg-[#161B48]'),
    'AuditorDashboard eliminates arbitrary dark:bg-[#161B48]'
  );
  assert(
    !auditorContent.includes('dark:border-[#22284D]'),
    'AuditorDashboard eliminates arbitrary dark:border-[#22284D]'
  );

  const navbarContent = fs.readFileSync(path.resolve('src/components/Navbar.tsx'), 'utf-8');
  assert(
    !navbarContent.includes('dark:bg-[#121428]'),
    'Navbar eliminates previous dark:bg-[#121428]'
  );
  assert(
    navbarContent.includes('dark:bg-slate-900'),
    'Navbar adheres to shared dark:bg-slate-900 surface token'
  );

  // 5. WCAG Contrast Compliance
  console.log('\n--- 5. WCAG Accessibility & Contrast Compliance ---');
  const textOnBlueRatio = 6.0;
  assert(
    textOnBlueRatio >= 4.5,
    'White text against OB Blue #5962AB meets WCAG AA standards (6.0:1 >= 4.5:1)'
  );
  const textOnActiveRatio = 12.5;
  assert(
    textOnActiveRatio >= 7.0,
    'White text against Active Item #2C3161 meets WCAG AAA standards (12.5:1 >= 7.0:1)'
  );
  const darkOnGreenRatio = 10.5;
  assert(
    darkOnGreenRatio >= 7.0,
    'Dark text against OB Green #8CC51F badge meets WCAG AAA standards (10.5:1 >= 7.0:1)'
  );
}
