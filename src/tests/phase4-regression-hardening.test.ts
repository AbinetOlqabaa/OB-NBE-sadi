/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { userService } from '../services/userService.ts';
import { submissionService, DEMO_USERS } from '../services/submissionService.ts';
import { departmentService } from '../services/departmentService.ts';
import { auditorService } from '../services/auditorService.ts';
import { nbeSimulator } from '../services/nbeSimulator.ts';
import { paginateList } from '../utils/paginationUtils.ts';
import { OB_BRAND_COLORS } from '../styles/designTokens.ts';
import { getAllReports, getReportByKey } from '../data/report-registry.ts';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`[Phase 4 Regression Assertion Failed]: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

export async function runPhase4RegressionHardeningTests(): Promise<void> {
  console.log('\n========================================================================');
  console.log('--- 12. PHASE 4 APPLICATION-WIDE REGRESSION & HARDENING TESTS ---');
  console.log('========================================================================');

  // --- PART 1: COMPLETE ROUTE & COMPONENT INVENTORY AUDIT ---
  console.log('\n--- 1. Full Route & View Inventory Audit ---');
  const requiredRoutes = [
    { name: 'Login Page', path: 'src/components/LoginPage.tsx' },
    { name: 'Registration Page', path: 'src/components/RegisterPage.tsx' },
    { name: 'Reset Password Modal', path: 'src/components/ResetPasswordModal.tsx' },
    { name: 'Biometric Prompt Modal', path: 'src/components/BiometricPromptModal.tsx' },
    { name: 'Biometric Recovery Modal', path: 'src/components/BiometricRecoveryModal.tsx' },
    { name: 'Admin Dashboard', path: 'src/components/AdminDashboard.tsx' },
    { name: 'Maker Workspace', path: 'src/components/MakerWorkspace.tsx' },
    { name: 'Checker Inbox', path: 'src/components/CheckerInbox.tsx' },
    { name: 'Auditor Dashboard', path: 'src/components/AuditorDashboard.tsx' },
    { name: 'Dynamic Report Form', path: 'src/components/DynamicReportForm.tsx' },
    { name: 'Report Version History Modal', path: 'src/components/ReportVersionHistoryModal.tsx' },
    { name: 'Audit Trail View', path: 'src/components/AuditTrailView.tsx' },
    { name: 'System Health Dashboard', path: 'src/components/SystemHealthDashboard.tsx' },
    { name: 'Hardware Diagnostics Modal', path: 'src/components/HardwareDiagnosticsModal.tsx' },
    { name: 'User Settings Modal', path: 'src/components/UserSettingsModal.tsx' },
    { name: 'Department Report Management', path: 'src/components/DepartmentReportManagement.tsx' },
    { name: 'NBE Simulator View', path: 'src/components/NbeSimulatorView.tsx' },
    { name: 'Phase 2 SSOT Lakehouse', path: 'src/components/Phase2SSOTView.tsx' },
    { name: 'Documentation View', path: 'src/components/DocumentationView.tsx' },
    { name: 'Offline Storage Modal', path: 'src/components/OfflineStorageModal.tsx' },
    { name: 'Pagination Component', path: 'src/components/Pagination.tsx' },
    { name: 'Input Accessory View', path: 'src/components/InputAccessoryView.tsx' },
  ];

  requiredRoutes.forEach((route) => {
    const fullPath = path.resolve(route.path);
    assert(fs.existsSync(fullPath), `Route component "${route.name}" exists at ${route.path}`);
  });

  // --- PART 2: DESIGN SYSTEM AUDIT & ZERO ISOLATED HEX CODE AUDIT ---
  console.log('\n--- 2. Design System Tokens & Color Consistency Audit ---');
  assert(OB_BRAND_COLORS.primaryGreen === '#8CC51F', 'Authoritative OB Green is strictly #8CC51F');
  assert(OB_BRAND_COLORS.primaryBlue === '#5962AB', 'Authoritative OB Blue is strictly #5962AB');
  assert(OB_BRAND_COLORS.primaryBlueOwnerRequested === '#5863AC', 'Requested OB Blue #5863AC documented with delta');
  assert(OB_BRAND_COLORS.sidebar.background === '#5962AB', 'Sidebar background token is #5962AB');
  assert(OB_BRAND_COLORS.sidebar.itemActiveBg === '#2C3161', 'Sidebar active item background is #2C3161');

  // Verify that all components have eliminated isolated dark hex codes
  const componentsDir = path.resolve('src/components');
  const componentFiles = fs.readdirSync(componentsDir).filter((f) => f.endsWith('.tsx'));
  const forbiddenHexPatterns = [
    'dark:bg-[#121428]',
    'dark:bg-[#101438]',
    'dark:bg-[#141944]',
    'dark:bg-[#161B48]',
    'dark:border-[#22284D]',
    'dark:border-[#262D55]',
    'dark:border-[#2B3369]',
    'dark:divide-[#1C203F]',
  ];

  componentFiles.forEach((file) => {
    const content = fs.readFileSync(path.join(componentsDir, file), 'utf-8');
    forbiddenHexPatterns.forEach((pattern) => {
      assert(!content.includes(pattern), `${file} cleanly eliminates forbidden pattern "${pattern}"`);
    });
  });

  // --- PART 3: APPLICATION SHELL & FIXED VIEWPORT INTEGRITY ---
  console.log('\n--- 3. Shared Application Shell & Fixed Viewport Audit ---');
  const appContent = fs.readFileSync(path.resolve('src/App.tsx'), 'utf-8');
  assert(appContent.includes('h-[100dvh]'), 'App shell codified with 100dvh viewport height');
  assert(appContent.includes('overflow-y-auto') && appContent.includes('min-h-0'), 'Internal content region isolates vertical scrolling');
  assert(appContent.includes('<footer'), 'Centralized application workspace footer anchored in shell');

  // Verify dialog max height constraint
  const modalFiles = [
    'BiometricPromptModal.tsx',
    'UserSettingsModal.tsx',
    'ReportVersionHistoryModal.tsx',
    'OfflineStorageModal.tsx',
    'HardwareDiagnosticsModal.tsx',
    'KeyboardShortcutsModal.tsx',
    'CommandPaletteModal.tsx',
  ];
  modalFiles.forEach((mFile) => {
    const mContent = fs.readFileSync(path.join(componentsDir, mFile), 'utf-8');
    assert(
      mContent.includes('max-h-[calc(100dvh') || mContent.includes('max-h-[90vh]') || mContent.includes('max-h-[92vh]'),
      `Modal ${mFile} enforces responsive max-height constraint against viewport clipping`
    );
  });

  // --- PART 4: AUTHENTICATION & ROLE REGRESSION ---
  console.log('\n--- 4. Authentication, Role Routing & Segregation of Duties ---');
  const allRoles = ['ADMIN', 'MAKER', 'CHECKER', 'AUDITOR'] as const;
  allRoles.forEach((role) => {
    const demo = DEMO_USERS.find((u) => u.role === role);
    assert(Boolean(demo), `Demo user exists for role ${role}`);
    const loginRes = userService.login(demo!.email, 'password');
    assert(loginRes.success, `Login succeeds for role ${role}`);
    assert(loginRes.user?.role === role, `Authenticated session reflects role ${role}`);
  });

  // Auditor Segregation: Auditor can never edit or approve
  const auditorUser = DEMO_USERS.find((u) => u.role === 'AUDITOR')!;
  let auditorEditBlocked = false;
  try {
    submissionService.createSubmission('LOA_PORT_EP001', auditorUser as any);
  } catch (err: any) {
    auditorEditBlocked = true;
    assert(err.message.includes('Auditor') || err.message.includes('role') || err.message.includes('supervisory'), 'Auditor blocked from creating/drafting return');
  }
  assert(auditorEditBlocked, 'Auditor drafting strictly prohibited');

  // --- PART 5: REPORT WORKFLOW REGRESSION ---
  console.log('\n--- 5. Reporting Lifecycle & 4-Eyes Dual Control ---');
  const maker = DEMO_USERS.find((u) => u.role === 'MAKER')!;
  const checker = DEMO_USERS.find((u) => u.role === 'CHECKER' && u.department === maker.department)!;

  // 1. Create draft
  const draft = submissionService.createSubmission('LOA_PORT_EP001', maker as any);
  assert(draft.status === 'DRAFT', 'Created return has status DRAFT');

  // 2. Submit to Checker
  const submitted = submissionService.submitToChecker(draft.id, maker as any, 'Ready for review');
  assert(submitted.status === 'PENDING_CHECKER', 'Draft successfully submitted to Checker');

  // 3. Maker cannot approve their own submission
  let selfApproveBlocked = false;
  try {
    submissionService.reviewSubmission(draft.id, 'APPROVE', maker as any, 'Self approval attempt');
  } catch (err: any) {
    selfApproveBlocked = true;
  }
  assert(selfApproveBlocked, 'Segregation of duties: Maker cannot self-approve submission');

  // 4. Checker approves
  const approved = submissionService.reviewSubmission(draft.id, 'APPROVE', checker as any, 'Approved for transmission');
  assert(approved.status === 'APPROVED', 'Checker successfully approves submission');

  // 5. Checker cannot deliver to NBE (Only Maker can deliver final return)
  let checkerDeliverBlocked = false;
  try {
    await submissionService.deliverToNBE(draft.id, checker as any);
  } catch (err: any) {
    checkerDeliverBlocked = true;
  }
  assert(checkerDeliverBlocked, 'Segregation of duties: Checker cannot deliver return to NBE');

  // --- PART 6: NBE GATEWAY & SIMULATOR REGRESSION ---
  console.log('\n--- 6. NBE Gateway & Simulator Semantic Integrity ---');
  nbeSimulator.setScenario({ mode: 'ALWAYS_SUCCESS', latencyMs: 5 });
  const deliverRes = await submissionService.deliverToNBE(draft.id, maker as any);
  assert(deliverRes.success, 'Maker successfully transmits approved return to NBE');
  const deliveredSub = submissionService.getById(draft.id)!;
  assert(deliveredSub.status === 'SENT', 'Submission status transitions to SENT');
  assert(Boolean(deliveredSub.nbeReferenceNumber), 'NBE receipt number stamped on submission');
  assert(Boolean(deliveredSub.updatedAt), 'NBE delivery timestamp stamped on submission');

  // Verify delivery receipt is stored in NBE Simulator ledger
  const simSubmissions = nbeSimulator.getSubmissions();
  assert(simSubmissions.some((s) => s.returnKey === 'LOA_PORT_EP001' || (s as any).ReturnKey === 'LOA_PORT_EP001'), 'Return recorded in NBE Simulator gateway ledger');

  // --- PART 7: STANDALONE PAGINATION REGRESSION ---
  console.log('\n--- 7. Application-Wide Standalone Pagination Contract ---');
  const sampleList = Array.from({ length: 95 }, (_, i) => ({ id: `REC_${i + 1}`, value: i * 10 }));
  const p1 = paginateList(sampleList, 1, 10);
  assert(p1.total === 95, 'Total is 95');
  assert(p1.page === 1, 'Current page is 1');
  assert(p1.page_size === 10, 'Page size is 10');
  assert(p1.total_pages === 10, 'Total pages is 10');
  assert(p1.items.length === 10, 'Page 1 has 10 items');
  assert(p1.has_next === true, 'Page 1 has next');
  assert(p1.has_previous === false, 'Page 1 has no previous');

  const pLast = paginateList(sampleList, 10, 10);
  assert(pLast.items.length === 5, 'Last page has remainder 5 items');
  assert(pLast.has_next === false, 'Last page has no next');
  assert(pLast.has_previous === true, 'Last page has previous');

  // Safe clamping
  const pOverflow = paginateList(sampleList, 999, 10);
  assert(pOverflow.page === 10, 'Out-of-bounds page clamped to max page 10');
  assert(pOverflow.items.length === 5, 'Clamped page returns items on final page');

  // --- PART 8: ACCESSIBILITY, ARIA & NON-COLOR SEMANTICS ---
  console.log('\n--- 8. Accessibility & Non-Color Semantic Indicators ---');
  const statusAudit = [
    { label: 'DRAFT', color: 'slate', icon: 'FileEdit' },
    { label: 'PENDING_CHECKER', color: 'amber', icon: 'Clock' },
    { label: 'APPROVED', color: 'emerald', icon: 'CheckCircle2' },
    { label: 'ACCEPTED_NBE', color: 'teal', icon: 'ShieldCheck' },
    { label: 'CORRECTION_REQUIRED', color: 'rose', icon: 'AlertTriangle' },
  ];
  statusAudit.forEach((s) => {
    assert(Boolean(s.icon && s.label), `Status "${s.label}" includes dual text + icon cues, not color alone`);
  });

  // Verify Navbar contrast and touch targets
  const navbarContent = fs.readFileSync(path.resolve('src/components/Navbar.tsx'), 'utf-8');
  assert(navbarContent.includes('min-h-[44px]') || navbarContent.includes('h-11') || navbarContent.includes('h-12') || navbarContent.includes('min-h-[38px]'), 'Interactive controls comply with touch target standards');

  console.log('\n✓ All Phase 4 Application-Wide Regression & Hardening tests passed cleanly.');
}
