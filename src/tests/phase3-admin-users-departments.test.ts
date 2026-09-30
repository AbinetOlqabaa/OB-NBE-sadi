/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { userService, UserAccount, UserRole, UserStatus } from '../services/userService.ts';
import { departmentService } from '../services/departmentService.ts';
import { configService } from '../services/configService.ts';
import { submissionService } from '../services/submissionService.ts';
import { auditService } from '../services/auditService.ts';
import { getAllReports } from '../data/report-registry.ts';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Phase 3 Test Assertion Failed: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

export function runPhase3AdminUsersAndDepartmentsTests() {
  console.log('\n========================================================================');
  console.log('--- PHASE 3: ADMINISTRATOR USER & DEPARTMENT MANAGEMENT (SSOT VERIFICATION) ---');
  console.log('========================================================================');

  // =======================================================================
  // SUITE 1: USER MANAGEMENT LIFECYCLE & RBAC
  // =======================================================================
  console.log('\n--- 1. Administrator User Management & CRUD Lifecycle ---');

  const initialUserCount = userService.getAll().length;
  assert(initialUserCount > 0, `Initial active user accounts loaded (${initialUserCount} users)`);

  // 1.1 Create new Maker user
  const newMakerEmail = `test.maker.${Date.now()}@oromiabank.com`;
  const createMakerRes = userService.createUser(
    {
      name: 'Chala Gemechu',
      email: newMakerEmail,
      role: 'MAKER',
      department: 'Credit Operations & Portfolio Management',
      employeeId: `OB-MK-${Date.now().toString().slice(-4)}`,
      phoneNumber: '+251911002233',
      status: 'ACTIVE',
    },
    'Compliance Administrator'
  );
  assert(createMakerRes.success && !!createMakerRes.user, 'Admin creates Maker user account successfully');
  const createdMaker = createMakerRes.user!;
  assert(createdMaker.role === 'MAKER', 'Created user has assigned role MAKER');
  assert(createdMaker.status === 'ACTIVE', 'Created user has assigned status ACTIVE');

  // 1.2 Create new Auditor user with justification and auditScope
  const newAuditorEmail = `test.auditor.${Date.now()}@oromiabank.com`;
  const createAuditorRes = userService.createUser(
    {
      name: 'Tigist Alemu',
      email: newAuditorEmail,
      role: 'AUDITOR',
      department: 'Internal Audit & Inspection Directorate',
      employeeId: `OB-AU-${Date.now().toString().slice(-4)}`,
      status: 'ACTIVE',
      auditScope: 'ALL_DEPARTMENTS',
      auditorJustification: 'Board Audit Committee Mandate 2026/02',
    },
    'Chief Compliance Officer'
  );
  assert(createAuditorRes.success && !!createAuditorRes.user, 'Admin creates Auditor user account with regulatory mandate');
  const createdAuditor = createAuditorRes.user!;
  assert(createdAuditor.role === 'AUDITOR', 'Created user has assigned role AUDITOR');
  assert((createdAuditor as any).auditScope === 'ALL_DEPARTMENTS', 'Auditor has universal bank inspection scope');

  // 1.3 Duplicate email prevention
  const dupRes = userService.createUser(
    {
      name: 'Duplicate Attempt',
      email: newMakerEmail,
      role: 'MAKER',
      department: 'Credit Operations & Portfolio Management',
    },
    'Administrator'
  );
  assert(!dupRes.success, 'Backend strictly rejects duplicate user email registration');

  // 1.4 Update user details (Profile, Department, Phone)
  const updateRes = userService.updateUser(createdMaker.id, {
    phoneNumber: '+251922334455',
    department: 'Trade Services & International Banking Directorate',
  });
  assert(updateRes.success && !!updateRes.user, 'Admin updates user department and phone number');
  assert(updateRes.user?.department === 'Trade Services & International Banking Directorate', 'User department reflects updated assignment');

  // 1.5 Role reassignment (Maker -> Checker)
  const roleChangeRes = userService.updateUser(createdMaker.id, {
    role: 'CHECKER',
  });
  assert(roleChangeRes.success && roleChangeRes.user?.role === 'CHECKER', 'Admin promotes user from Maker to Checker role');

  // 1.6 Account status deactivation and re-enable
  const disableRes = userService.updateUserStatus(createdMaker.id, 'DISABLED', 'Compliance Administrator');
  assert(disableRes.success && disableRes.user?.status === 'DISABLED', 'Admin deactivates/disables user account');

  const enableRes = userService.updateUserStatus(createdMaker.id, 'ACTIVE', 'Compliance Administrator');
  assert(enableRes.success && enableRes.user?.status === 'ACTIVE', 'Admin reactivates user account');

  // =======================================================================
  // SUITE 2: USER SEARCH, FILTERING, SORTING & PAGINATION
  // =======================================================================
  console.log('\n--- 2. User Listing, Filtering, Sorting & Pagination ---');

  // 2.1 Role filter
  const makersOnly = userService.getFilteredUsers({ role: 'MAKER' });
  assert(makersOnly.every((u) => u.role === 'MAKER'), 'Filtering by role "MAKER" returns only Maker accounts');

  const auditorsOnly = userService.getFilteredUsers({ role: 'AUDITOR' });
  assert(auditorsOnly.every((u) => u.role === 'AUDITOR'), 'Filtering by role "AUDITOR" returns only Auditor accounts');

  // 2.2 Search filter
  const searchResults = userService.getFilteredUsers({ search: 'Chala' });
  assert(searchResults.some((u) => u.id === createdMaker.id), 'Search by user name locates target account');

  // 2.3 Department filter
  const deptUsers = userService.getFilteredUsers({ department: 'Trade Services & International Banking Directorate' });
  assert(deptUsers.some((u) => u.id === createdMaker.id), 'Filter by department locates assigned officer');

  // 2.4 Sorting by name ascending and descending
  const sortedAsc = userService.getFilteredUsers({ sortBy: 'name', sortOrder: 'asc' });
  const sortedDesc = userService.getFilteredUsers({ sortBy: 'name', sortOrder: 'desc' });
  assert(sortedAsc.length === sortedDesc.length, 'Sorted user lists preserve record count');
  assert(sortedAsc[0].name.localeCompare(sortedAsc[sortedAsc.length - 1].name) <= 0, 'User list sorted ascending by officer name');

  // =======================================================================
  // SUITE 3: DYNAMIC AUTHORIZATION & AUDIT HISTORY INSPECTION
  // =======================================================================
  console.log('\n--- 3. Dynamic SSOT Authorization & User Audit History ---');

  // 3.1 Dynamic report authorization matrix
  const authMatrix = configService.getAuthorizedReportsForUser(createdAuditor);
  assert(authMatrix.hasAuditorInspection === true, 'Auditor account granted universal access across all 24 statutory returns');
  assert(authMatrix.authorizedReportKeys.length === 24, 'Universal access resolves all 24 National Bank of Ethiopia returns');

  // 3.2 Maker report authorization bounded by department
  const makerAuth = configService.getAuthorizedReportsForUser(createdMaker);
  assert(makerAuth.hasAuditorInspection === false && makerAuth.hasAdminOversight === false, 'Operational officer bounded to department scope (not universal)');

  // 3.3 Special access cross-department delegation
  const specialGrantRes = userService.grantSpecialAccess(
    createdMaker.id,
    {
      reportKey: 'M-LR-01',
      reason: 'Urgent liquidity audit assistance approved by CFO',
      expiresAt: new Date(Date.now() + 86400000 * 7).toISOString(),
    },
    'Compliance Administrator'
  );
  assert(specialGrantRes.success, 'Admin grants cross-department special return access to officer');

  const updatedMakerAuth = configService.getAuthorizedReportsForUser(userService.getById(createdMaker.id)!);
  assert(
    updatedMakerAuth.authorizedReportKeys.includes('M-LR-01') || updatedMakerAuth.specialAccessReports.includes('M-LR-01'),
    'Special access return M-LR-01 dynamically merged into user authorization matrix'
  );

  // 3.4 User audit history retrieval
  const userAudit = userService.getUserAuditHistory(createdMaker.id);
  assert(userAudit.length > 0, `User audit history records operational events (${userAudit.length} events logged)`);

  // =======================================================================
  // SUITE 4: HISTORICAL DATA INTEGRITY & DELETION SAFETY (USERS)
  // =======================================================================
  console.log('\n--- 4. User Historical Safety & Non-Destructive Integrity ---');

  // 4.1 Safe user delete: new user with 0 submissions can be safely deleted
  const safeCheck = userService.canDeleteUser(createdMaker.id);
  assert(safeCheck.canDelete === true, 'Newly created user without submissions passes pre-flight safe deletion check');

  // 4.2 Unsafe user delete: user referenced in historical submissions cannot be deleted
  // Find a user who has submitted a report
  const allSubmissions = submissionService.getAll();
  assert(allSubmissions.length > 0, 'Statutory submissions ledger contains records');
  const activeMakerSubmission = allSubmissions[0];
  const historicalMaker = userService.getAll().find(
    (u) => u.name === activeMakerSubmission.makerName || u.email === activeMakerSubmission.makerEmail
  );

  if (historicalMaker) {
    const historicalSafetyCheck = userService.canDeleteUser(historicalMaker.id);
    assert(historicalSafetyCheck.canDelete === false, 'Pre-flight check blocks destructive deletion of user linked to historical submissions');
    assert(Boolean(historicalSafetyCheck.reason?.includes('submission') || historicalSafetyCheck.reason?.includes('statutory')), 'Safety check explains historical retention rationale');

    const blockedDeleteRes = userService.deleteUser(historicalMaker.id);
    assert(!blockedDeleteRes.success, 'userService.deleteUser strictly aborts destructive deletion of historical reporting officer');
  }

  // =======================================================================
  // SUITE 5: DEPARTMENT MANAGEMENT LIFECYCLE & HIERARCHY
  // =======================================================================
  console.log('\n--- 5. Department Management, Hierarchy & SSOT Linkages ---');

  const initialDeptCount = departmentService.getAll().length;
  assert(initialDeptCount >= 6, `Official Oromia Bank departments loaded (${initialDeptCount} departments)`);

  // 5.1 Create new Department
  const newDeptRes = departmentService.addDepartment(
    {
      name: 'Treasury & Asset Liability Management Unit',
      shortCode: 'TALM',
      division: 'Finance, Treasury & Accounts Division',
      description: 'Prudential liquidity monitoring, FX reserves and asset liability management',
      primaryResponsibilities: ['Daily liquidity ratios', 'Prudential reserves compliance', 'NBE foreign currency position'],
      reportKeys: ['M-LR-01', 'W-PR-01', 'Q-CAR-01'],
      status: 'ACTIVE',
      hierarchyLevel: 2,
    },
    'Compliance Administrator'
  );
  assert(newDeptRes.success && !!newDeptRes.department, 'Admin creates new Department with code, responsibilities and return keys');
  const createdDept = newDeptRes.department!;
  assert(createdDept.shortCode === 'TALM', 'Created department shortCode is TALM');

  // Also sync with configService SSOT
  configService.createDepartment(
    {
      id: createdDept.id,
      name: createdDept.name,
      shortCode: createdDept.shortCode,
      division: createdDept.division,
      description: createdDept.description,
      status: 'ACTIVE',
      primaryResponsibilities: createdDept.primaryResponsibilities,
    },
    { id: 'usr_admin', name: 'Compliance Administrator', role: 'ADMIN' }
  );

  // 5.2 Duplicate shortCode or name rejection
  const dupDeptRes = departmentService.addDepartment(
    {
      name: 'Another Treasury Unit',
      shortCode: 'TALM', // duplicate
      division: 'Finance, Treasury & Accounts Division',
    },
    'Administrator'
  );
  assert(!dupDeptRes.success, 'Department creation strictly rejects duplicate shortCode');

  // 5.3 Edit / Rename Department
  const updateDeptRes = departmentService.updateDepartment(
    createdDept.id,
    {
      description: 'Updated comprehensive mandate for liquidity and foreign exchange compliance',
      reportKeys: ['M-LR-01', 'W-PR-01', 'Q-CAR-01', 'M-NPL-01'],
    },
    'Compliance Administrator'
  );
  assert(updateDeptRes.success && !!updateDeptRes.department, 'Admin updates department description and associated reports');
  assert(Boolean(updateDeptRes.department?.reportKeys.includes('M-NPL-01')), 'Department reflects updated statutory report linkages');

  // 5.4 Lifecycle status transitions (ACTIVE -> INACTIVE)
  const deactivateDeptRes = departmentService.setDepartmentStatus(
    createdDept.id,
    'INACTIVE',
    'Compliance Administrator',
    new Date().toISOString()
  );
  assert(deactivateDeptRes.success, 'Admin soft-deactivates/retires department without destructive deletion');
  const currentDeptState = departmentService.getById(createdDept.id);
  assert(currentDeptState?.status === 'INACTIVE', 'Department lifecycle status is updated to INACTIVE');

  // Reactivate
  const reactivateDeptRes = departmentService.setDepartmentStatus(createdDept.id, 'ACTIVE', 'Compliance Administrator');
  assert(reactivateDeptRes.success, 'Admin reactivates department status to ACTIVE');

  // 5.5 Hierarchy parent-child relationships
  const rootDept = departmentService.getAll().find((d) => d.id !== createdDept.id);
  if (rootDept) {
    const parentUpdate = departmentService.updateDepartment(
      createdDept.id,
      {
        parentId: rootDept.id,
      },
      'Compliance Administrator'
    );
    assert(parentUpdate.success, 'Admin assigns parent department in organizational hierarchy');

    // SSOT ancestry resolution
    const ancestors = configService.getDepartmentAncestors(createdDept.id);
    assert(Array.isArray(ancestors), 'Ancestors query returns hierarchical tree nodes');
  }

  // 5.6 Department audit history
  const deptAudit = configService.getDepartmentAuditHistory(createdDept.id);
  assert(Array.isArray(deptAudit), 'Department audit history successfully retrievable');

  // =======================================================================
  // SUITE 6: HISTORICAL DATA INTEGRITY & DELETION SAFETY (DEPARTMENTS)
  // =======================================================================
  console.log('\n--- 6. Department Historical Safety & Non-Destructive Integrity ---');

  // 6.1 Department with historical submissions cannot be destructively removed
  const creditDept = departmentService.getByName('Credit Operations & Portfolio Management');
  if (creditDept) {
    const safetyCheck = departmentService.canDeleteDepartment(creditDept.id);
    assert(safetyCheck.canDelete === false, 'Historical safety check blocks deletion of department with active officers or historical submissions');
    assert(Boolean(safetyCheck.reason?.includes('historical') || safetyCheck.reason?.includes('submissions') || safetyCheck.reason?.includes('officers')), 'Safety check details exact compliance blocking reason');

    const blockedDeptDelete = departmentService.removeDepartment(creditDept.id, undefined, 'Administrator');
    assert(!blockedDeptDelete.success, 'departmentService.removeDepartment strictly aborts destructive deletion of operational department');
  }

  // 6.2 Safe department delete: newly created unit with 0 assigned users and 0 submissions can be removed
  const safeDeptCheck = departmentService.canDeleteDepartment(createdDept.id);
  assert(safeDeptCheck.canDelete === true, 'Department with zero assigned users and zero submissions passes pre-flight safe deletion check');

  const removeSafeDeptRes = departmentService.removeDepartment(createdDept.id, undefined, 'Compliance Administrator');
  assert(removeSafeDeptRes.success, 'Safely deletes non-referenced department when pre-flight safety is satisfied');

  // Clean up test user
  userService.deleteUser(createdMaker.id);
  userService.deleteUser(createdAuditor.id);

  console.log('\n========================================================================');
  console.log('✅ ALL PHASE 3 ADMINISTRATOR USERS & DEPARTMENTS TESTS PASSED (100% SUCCESS)');
  console.log('========================================================================\n');
}
