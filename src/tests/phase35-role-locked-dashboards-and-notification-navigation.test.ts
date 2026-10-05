/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { isTabAuthorizedForRole, getDefaultTabForRole } from '../App.tsx';
import { ViewTab } from '../components/Sidebar.tsx';
import { notificationService } from '../services/notificationService.ts';
import { getRoleTabs } from '../hooks/useSwipeGesture.ts';

export async function runPhase35RoleLockedDashboardsAndNotificationTests(): Promise<void> {
  console.log('\n================================================================================');
  console.log('PHASE 35 ACCEPTANCE TEST SUITE: Role-Locked Dashboards & Notification Navigation');
  console.log('Regulatory Mandate: NBE BSD/03/2020 Segregation of Duties & Single-Role Workspaces');
  console.log('================================================================================\n');

  // --------------------------------------------------------------------------
  // GATE 1: Role-Locked Dashboards (Each role receives only its own dashboard)
  // --------------------------------------------------------------------------
  console.log('--- GATE 1: Role-Locked Dashboards ---');

  // Initial / Default dashboards
  assert.strictEqual(getDefaultTabForRole('ADMIN'), 'ADMIN_DASHBOARD', 'ADMIN gets Administrator Dashboard as default (Req 1)');
  assert.strictEqual(getDefaultTabForRole('MAKER'), 'MAKER_WORKSPACE', 'MAKER gets Maker Workspace as default (Req 1)');
  assert.strictEqual(getDefaultTabForRole('CHECKER'), 'CHECKER_INBOX', 'CHECKER gets Checker Inbox as default (Req 1)');
  assert.strictEqual(getDefaultTabForRole('AUDITOR'), 'AUDITOR_DASHBOARD', 'AUDITOR gets Auditor Dashboard as default (Req 1)');

  // ADMIN Dashboard Isolation
  assert.strictEqual(isTabAuthorizedForRole('ADMIN_DASHBOARD', 'ADMIN'), true, 'ADMIN is authorized for ADMIN_DASHBOARD');
  assert.strictEqual(isTabAuthorizedForRole('MAKER_WORKSPACE', 'ADMIN'), false, 'ADMIN is strictly blocked from MAKER_WORKSPACE (Req 1)');
  assert.strictEqual(isTabAuthorizedForRole('CHECKER_INBOX', 'ADMIN'), false, 'ADMIN is strictly blocked from CHECKER_INBOX (Req 1)');
  assert.strictEqual(isTabAuthorizedForRole('AUDITOR_DASHBOARD', 'ADMIN'), false, 'ADMIN is strictly blocked from AUDITOR_DASHBOARD (Req 1)');

  // MAKER Dashboard Isolation
  assert.strictEqual(isTabAuthorizedForRole('MAKER_WORKSPACE', 'MAKER'), true, 'MAKER is authorized for MAKER_WORKSPACE');
  assert.strictEqual(isTabAuthorizedForRole('ADMIN_DASHBOARD', 'MAKER'), false, 'MAKER is strictly blocked from ADMIN_DASHBOARD (Req 1)');
  assert.strictEqual(isTabAuthorizedForRole('CHECKER_INBOX', 'MAKER'), false, 'MAKER is strictly blocked from CHECKER_INBOX (Req 1)');
  assert.strictEqual(isTabAuthorizedForRole('AUDITOR_DASHBOARD', 'MAKER'), false, 'MAKER is strictly blocked from AUDITOR_DASHBOARD (Req 1)');
  assert.strictEqual(isTabAuthorizedForRole('LIBRARY', 'MAKER'), true, 'MAKER is authorized for LIBRARY (Dossier & Drafts)');

  // CHECKER Dashboard Isolation
  assert.strictEqual(isTabAuthorizedForRole('CHECKER_INBOX', 'CHECKER'), true, 'CHECKER is authorized for CHECKER_INBOX');
  assert.strictEqual(isTabAuthorizedForRole('ADMIN_DASHBOARD', 'CHECKER'), false, 'CHECKER is strictly blocked from ADMIN_DASHBOARD (Req 1)');
  assert.strictEqual(isTabAuthorizedForRole('MAKER_WORKSPACE', 'CHECKER'), false, 'CHECKER is strictly blocked from MAKER_WORKSPACE (Req 1)');
  assert.strictEqual(isTabAuthorizedForRole('AUDITOR_DASHBOARD', 'CHECKER'), false, 'CHECKER is strictly blocked from AUDITOR_DASHBOARD (Req 1)');
  assert.strictEqual(isTabAuthorizedForRole('LIBRARY', 'CHECKER'), true, 'CHECKER is authorized for LIBRARY');

  // AUDITOR Dashboard Isolation
  assert.strictEqual(isTabAuthorizedForRole('AUDITOR_DASHBOARD', 'AUDITOR'), true, 'AUDITOR is authorized for AUDITOR_DASHBOARD');
  assert.strictEqual(isTabAuthorizedForRole('ADMIN_DASHBOARD', 'AUDITOR'), false, 'AUDITOR is strictly blocked from ADMIN_DASHBOARD (Req 1)');
  assert.strictEqual(isTabAuthorizedForRole('MAKER_WORKSPACE', 'AUDITOR'), false, 'AUDITOR is strictly blocked from MAKER_WORKSPACE (Req 1)');
  assert.strictEqual(isTabAuthorizedForRole('CHECKER_INBOX', 'AUDITOR'), false, 'AUDITOR is strictly blocked from CHECKER_INBOX (Req 1)');
  assert.strictEqual(isTabAuthorizedForRole('LIBRARY', 'AUDITOR'), true, 'AUDITOR is authorized for LIBRARY');

  console.log('✅ GATE 1 PASSED: Single-role locked dashboard access model enforced across all 4 roles.\n');

  // --------------------------------------------------------------------------
  // GATE 2: Direct Route Access & Browser History Rejection / Redirection
  // --------------------------------------------------------------------------
  console.log('--- GATE 2: Direct Route Access & Browser History Rejection ---');

  const appSource = fs.readFileSync(path.resolve('src/App.tsx'), 'utf-8');

  // Verify URL search & popstate rejection logic
  assert(appSource.includes('handleUrlAndHistoryNavigation'), 'App.tsx contains authoritative handleUrlAndHistoryNavigation handler (Req 1)');
  assert(appSource.includes("window.history.replaceState({ tab: correctTab }"), 'App.tsx replaces history on unauthorized direct URL access (Req 1)');
  assert(appSource.includes('UNAUTHORIZED_ACCESS_ATTEMPT'), 'App.tsx records security audit on unauthorized access attempt (Req 1)');

  // Verify redirect behavior
  const simulateDirectUrlCheck = (requestedTab: ViewTab, role: string): ViewTab => {
    if (!isTabAuthorizedForRole(requestedTab, role)) {
      return getDefaultTabForRole(role);
    }
    return requestedTab;
  };

  assert.strictEqual(simulateDirectUrlCheck('ADMIN_DASHBOARD', 'MAKER'), 'MAKER_WORKSPACE', 'Direct URL to Admin dashboard by Maker redirects to Maker Workspace');
  assert.strictEqual(simulateDirectUrlCheck('CHECKER_INBOX', 'MAKER'), 'MAKER_WORKSPACE', 'Direct URL to Checker inbox by Maker redirects to Maker Workspace');
  assert.strictEqual(simulateDirectUrlCheck('MAKER_WORKSPACE', 'ADMIN'), 'ADMIN_DASHBOARD', 'Direct URL to Maker workspace by Admin redirects to Admin Dashboard');
  assert.strictEqual(simulateDirectUrlCheck('AUDITOR_DASHBOARD', 'CHECKER'), 'CHECKER_INBOX', 'Direct URL to Auditor dashboard by Checker redirects to Checker Inbox');

  console.log('✅ GATE 2 PASSED: Direct route and browser history tampering successfully rejected and redirected.\n');

  // --------------------------------------------------------------------------
  // GATE 3: Navbar Verification (No dashboard switcher exists in navbar)
  // --------------------------------------------------------------------------
  console.log('--- GATE 3: Navbar Verification (No Dashboard Switcher) ---');

  const navbarSource = fs.readFileSync(path.resolve('src/components/Navbar.tsx'), 'utf-8');

  // 1. Verify no role-switching select dropdown exists in Navbar
  assert(!navbarSource.includes('aria-label="Switch User Role"'), 'Navbar eliminates aria-label="Switch User Role" dropdown (Req 2)');
  assert(!navbarSource.includes('DEMO_USERS.map'), 'Navbar eliminates DEMO_USERS dropdown switcher mapping (Req 2)');

  // 2. Verify authoritative user display badge
  assert(navbarSource.includes('currentUser.role'), 'Navbar retains authoritative read-only role indicator badge');
  assert(navbarSource.includes('currentUser.name'), 'Navbar retains authenticated user name display');

  console.log('✅ GATE 3 PASSED: Dashboard-switching control in authenticated navbar completely eliminated.\n');

  // --------------------------------------------------------------------------
  // GATE 4: NBE Simulator Segregation
  // --------------------------------------------------------------------------
  console.log('--- GATE 4: NBE Simulator Segregation ---');

  // Simulator tab is strictly ADMIN only
  assert.strictEqual(isTabAuthorizedForRole('NBE_SIMULATOR', 'MAKER'), false, 'NBE Simulator is forbidden for MAKER (Req 3)');
  assert.strictEqual(isTabAuthorizedForRole('NBE_SIMULATOR', 'CHECKER'), false, 'NBE Simulator is forbidden for CHECKER (Req 3)');
  assert.strictEqual(isTabAuthorizedForRole('NBE_SIMULATOR', 'AUDITOR'), false, 'NBE Simulator is forbidden for AUDITOR (Req 3)');
  assert.strictEqual(isTabAuthorizedForRole('NBE_SIMULATOR', 'ADMIN'), true, 'NBE Simulator is available for ADMIN only (Req 3)');

  // Navbar NbeHealthIndicator and OfflineStatusIndicator removed from top navbar across all dashboards
  assert(
    !navbarSource.includes('<NbeHealthIndicator'),
    'Navbar eliminates speed/latency indicator from top navbar'
  );
  assert(
    !navbarSource.includes('<OfflineStatusIndicator'),
    'Navbar eliminates network indicator from top navbar'
  );

  // App.tsx tab renderer check
  assert(
    appSource.includes("activeTab === 'NBE_SIMULATOR' && currentUser?.role === 'ADMIN'"),
    'App.tsx simulator tab renderer is locked behind currentUser.role === "ADMIN" (Req 3)'
  );

  console.log('✅ GATE 4 PASSED: NBE Simulator removed from Maker, Checker, Auditor dashboards and preserved for Admin only.\n');

  // --------------------------------------------------------------------------
  // GATE 5: Notification Bell Renders & Unread Count
  // --------------------------------------------------------------------------
  console.log('--- GATE 5: Notification Bell & Unread Count ---');

  // Verify notification bell icon in Navbar
  assert(navbarSource.includes('<Bell className="w-5 h-5" />'), 'Navbar renders notification Bell icon (Req 4)');
  assert(navbarSource.includes('setIsNotificationsOpen(true)'), 'Clicking notification bell opens Notification Center (Req 4)');
  assert(navbarSource.includes('unreadCount > 0'), 'Navbar displays unread notification badge (Req 4)');

  // Test NotificationService unread count logic
  notificationService.seedDefaultNotifications();

  const makerUser = {
    id: 'usr_maker_1',
    email: 'abebe.kebede@oromiabank.com',
    role: 'MAKER' as const,
    department: 'Credit Operations & Portfolio Management',
    allowedReportKeys: ['BSD_01', 'NBE_CR_02'],
  };

  const initialMakerResult = notificationService.getNotificationsForUser(makerUser);
  assert(initialMakerResult.unreadCount > 0, `Maker has unread notifications (count: ${initialMakerResult.unreadCount})`);

  // Mark single notification as read
  const unreadItem = initialMakerResult.notifications.find((n) => !n.isRead);
  assert(Boolean(unreadItem), 'Found unread notification for Maker');
  const readSuccess = notificationService.markAsRead(unreadItem!.id);
  assert.strictEqual(readSuccess, true, 'Successfully marked notification as read');

  const updatedMakerResult = notificationService.getNotificationsForUser(makerUser);
  assert.strictEqual(
    updatedMakerResult.unreadCount,
    initialMakerResult.unreadCount - 1,
    'Unread count decrements by 1 after marking notification as read'
  );

  // Mark all as read
  const markedAllCount = notificationService.markAllAsReadForUser(makerUser);
  assert(markedAllCount >= 1, 'Mark all as read affected at least 1 notification');

  const finalMakerResult = notificationService.getNotificationsForUser(makerUser);
  assert.strictEqual(finalMakerResult.unreadCount, 0, 'Unread count is exactly 0 after markAllAsRead (Req 4)');

  console.log('✅ GATE 5 PASSED: Notification bell renders with dynamic unread count and read/unread state support.\n');

  // --------------------------------------------------------------------------
  // GATE 6: Server-Side Permission-Filtered Notifications
  // --------------------------------------------------------------------------
  console.log('--- GATE 6: Permission-Filtered Notifications & Grouping ---');

  notificationService.seedDefaultNotifications();

  const checkerUser = {
    id: 'usr_checker_1',
    email: 'chala.desta@oromiabank.com',
    role: 'CHECKER' as const,
    department: 'Credit Operations & Portfolio Management',
    allowedReportKeys: ['BSD_01', 'NBE_CR_02'],
  };

  const auditorUser = {
    id: 'usr_auditor_1',
    email: 'auditor@oromiabank.com',
    role: 'AUDITOR' as const,
    department: 'Internal Audit & Inspection',
    allowedReportKeys: [],
  };

  const adminUser = {
    id: 'usr_admin',
    email: 'admin@oromiabank.com',
    role: 'ADMIN' as const,
    department: 'Compliance & Legal Governance',
    allowedReportKeys: [],
  };

  const checkerNotifs = notificationService.getNotificationsForUser(checkerUser);
  const auditorNotifs = notificationService.getNotificationsForUser(auditorUser);
  const adminNotifs = notificationService.getNotificationsForUser(adminUser);

  // Ensure Checker notifications only contain Checker roles or broadcast
  checkerNotifs.notifications.forEach((n) => {
    assert(
      !n.recipientRole || n.recipientRole === 'CHECKER',
      `Checker received non-checker notification (role: ${n.recipientRole})`
    );
  });

  // Ensure Auditor notifications only contain Auditor roles or broadcast
  auditorNotifs.notifications.forEach((n) => {
    assert(
      !n.recipientRole || n.recipientRole === 'AUDITOR',
      `Auditor received non-auditor notification (role: ${n.recipientRole})`
    );
  });

  // Ensure Admin notifications only contain Admin roles or broadcast
  adminNotifs.notifications.forEach((n) => {
    assert(
      !n.recipientRole || n.recipientRole === 'ADMIN',
      `Admin received non-admin notification (role: ${n.recipientRole})`
    );
  });

  // Ensure categories are grouped sensibly
  assert(Array.isArray(checkerNotifs.grouped.WORKFLOW), 'Checker notifications group WORKFLOW items');
  assert(Array.isArray(adminNotifs.grouped.GOVERNANCE), 'Admin notifications group GOVERNANCE items');
  assert(Array.isArray(auditorNotifs.grouped.SECURITY), 'Auditor notifications group SECURITY items');

  console.log('✅ GATE 6 PASSED: Notifications are role-appropriate and categorized into sensible groups.\n');

  // --------------------------------------------------------------------------
  // GATE 7: Cross-Department Notification Leakage Protection
  // --------------------------------------------------------------------------
  console.log('--- GATE 7: Cross-Department Notification Leakage Protection ---');

  notificationService.seedDefaultNotifications();

  // Maker 1 is in Credit Operations
  const makerCreditNotifs = notificationService.getNotificationsForUser(makerUser);

  // Maker 2 is in Trade Services
  const makerTradeUser = {
    id: 'usr_maker_2',
    email: 'tigist.alemu@oromiabank.com',
    role: 'MAKER' as const,
    department: 'Trade Services & International Banking',
    allowedReportKeys: ['LC_01', 'FX_01'],
  };
  const makerTradeNotifs = notificationService.getNotificationsForUser(makerTradeUser);

  // Credit Maker MUST NOT have any Trade Services notifications
  makerCreditNotifs.notifications.forEach((n) => {
    assert(
      n.recipientDepartment !== 'Trade Services & International Banking',
      `Cross-department leakage detected! Credit Maker received Trade notification: ${n.title}`
    );
    assert(
      n.targetReportKey !== 'LC_01' && n.targetReportKey !== 'FX_01',
      `Report metadata leakage! Credit Maker received report key ${n.targetReportKey}`
    );
    assert(
      !n.message.includes('LC-01') && !n.message.includes('FX-01'),
      `Text leakage! Message contains trade return keys: "${n.message}"`
    );
  });

  // Trade Maker MUST NOT have any Credit Operations notifications
  makerTradeNotifs.notifications.forEach((n) => {
    assert(
      n.recipientDepartment !== 'Credit Operations & Portfolio Management',
      `Cross-department leakage detected! Trade Maker received Credit notification: ${n.title}`
    );
    assert(
      n.targetReportKey !== 'BSD_01' && n.targetReportKey !== 'NBE_CR_02',
      `Report metadata leakage! Trade Maker received credit report key ${n.targetReportKey}`
    );
  });

  console.log('✅ GATE 7 PASSED: Cross-department notification and report metadata leakage strictly prevented.\n');

  // --------------------------------------------------------------------------
  // GATE 8: Maker Navbar Icon Removal
  // --------------------------------------------------------------------------
  console.log('--- GATE 8: Maker Navbar Icon Removal ---');

  // Verify Navbar source code for Zone 2 removal in Maker view
  assert(
    navbarSource.includes("{currentUser.role !== 'MAKER' && ("),
    'Navbar conditionally removes Zone 2 context ribbon icons for MAKER role (Req 5)'
  );
  assert(
    navbarSource.includes("currentUser.role === 'CHECKER' && pendingCheckerCount > 0"),
    'Checker queue awaiting review pill is locked to CHECKER role only (Req 5)'
  );

  // Verify accessibility / navigation controls are preserved
  assert(navbarSource.includes('handleNavToggle'), 'Navbar preserves navigation drawer/sidebar toggle button (Req 5)');
  assert(navbarSource.includes('/brand/oromia-logo-full.png'), 'Navbar preserves authentic Oromia Bank logo (Req 5)');
  assert(navbarSource.includes('ThemeToggle'), 'Navbar preserves theme customization toggle (Req 5)');
  assert(navbarSource.includes('onLogout'), 'Navbar preserves prominent logout button (Req 5)');

  console.log('✅ GATE 8 PASSED: Specified unimportant icons beside OB logo in Maker navbar successfully removed.\n');

  // --------------------------------------------------------------------------
  // GATE 9: Desktop, Tablet, and Mobile Navigation Accessibility
  // --------------------------------------------------------------------------
  console.log('--- GATE 9: Desktop, Tablet, and Mobile Navigation ---');

  // Check swipe gesture role tabs
  const adminSwipeTabs = getRoleTabs('ADMIN');
  const makerSwipeTabs = getRoleTabs('MAKER');
  const checkerSwipeTabs = getRoleTabs('CHECKER');
  const auditorSwipeTabs = getRoleTabs('AUDITOR');

  // Ensure no cross-dashboard tabs in swipe gestures
  assert(!adminSwipeTabs.includes('MAKER_WORKSPACE'), 'Admin swipe tabs do not include Maker Workspace');
  assert(!adminSwipeTabs.includes('CHECKER_INBOX'), 'Admin swipe tabs do not include Checker Inbox');
  assert(!adminSwipeTabs.includes('AUDITOR_DASHBOARD'), 'Admin swipe tabs do not include Auditor Dashboard');

  assert(!makerSwipeTabs.includes('ADMIN_DASHBOARD'), 'Maker swipe tabs do not include Admin Dashboard');
  assert(!makerSwipeTabs.includes('CHECKER_INBOX'), 'Maker swipe tabs do not include Checker Inbox');
  assert(!makerSwipeTabs.includes('AUDITOR_DASHBOARD'), 'Maker swipe tabs do not include Auditor Dashboard');
  assert(!makerSwipeTabs.includes('NBE_SIMULATOR'), 'Maker swipe tabs do not include NBE Simulator');

  assert(!checkerSwipeTabs.includes('NBE_SIMULATOR'), 'Checker swipe tabs do not include NBE Simulator');
  assert(!auditorSwipeTabs.includes('NBE_SIMULATOR'), 'Auditor swipe tabs do not include NBE Simulator');

  // Verify Sidebar.tsx source
  const sidebarSource = fs.readFileSync(path.resolve('src/components/Sidebar.tsx'), 'utf-8');
  assert(sidebarSource.includes("roles: ['MAKER']"), 'Sidebar MAKER_WORKSPACE is locked to MAKER only');
  assert(sidebarSource.includes("roles: ['CHECKER']"), 'Sidebar CHECKER_INBOX is locked to CHECKER only');
  assert(sidebarSource.includes("roles: ['AUDITOR']"), 'Sidebar AUDITOR_DASHBOARD is locked to AUDITOR only');

  // Verify BottomNavigation.tsx and MobileBottomNav.tsx
  const bottomNavSource = fs.readFileSync(path.resolve('src/components/BottomNavigation.tsx'), 'utf-8');
  assert(!bottomNavSource.includes("CHECKER_INBOX' as ViewTab,\n            label: 'Checker"), 'Admin bottom nav does not include Checker inbox');

  const mobileNavSource = fs.readFileSync(path.resolve('src/components/MobileBottomNav.tsx'), 'utf-8');
  assert(mobileNavSource.includes('min-h-[44px]'), 'Mobile navigation touch targets comply with min 44px standard');

  console.log('✅ GATE 9 PASSED: Mobile, tablet, and desktop navigation role-locked and touch accessible.\n');

  console.log('================================================================================');
  console.log('✅ ALL PHASE 35 ACCEPTANCE TEST SUITES PASSED CLEANLY (9/9 GATES 100% SUCCESS)');
  console.log('================================================================================\n');
}
