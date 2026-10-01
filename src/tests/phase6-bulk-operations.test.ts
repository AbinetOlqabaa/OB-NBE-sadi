/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  bulkOperationsEngine,
  sanitizeFormulaInjection,
  parseCsvRows,
  serializeToCsv,
  type BulkActor,
} from '../services/bulkOperationsEngine.ts';
import { userService } from '../services/userService.ts';
import { departmentService } from '../services/departmentService.ts';
import { configService } from '../services/configService.ts';
import { auditService } from '../services/auditService.ts';
import { submissionService } from '../services/submissionService.ts';
import { getAllReports, getReportByKey } from '../data/report-registry.ts';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`[Bulk Operations Assertion Failed]: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

export async function runPhase6BulkOperationsTests(): Promise<void> {
  console.log('\n========================================================================');
  console.log('--- PHASE 6: SAFE BULK OPERATIONS, IMPORT, EXPORT & FILE WORKFLOWS ---');
  console.log('========================================================================');

  const adminActor: BulkActor = {
    id: 'usr_admin_1',
    name: 'Dawit Bekele',
    email: 'admin@oromiabank.com',
    role: 'ADMIN',
    department: 'Compliance & Legal Governance',
  };

  const makerActor: BulkActor = {
    id: 'usr_maker_1',
    name: 'Abebe Kebede',
    email: 'abebe.kebede@oromiabank.com',
    role: 'MAKER',
    department: 'Credit Operations & Portfolio Management',
  };

  const checkerActor: BulkActor = {
    id: 'usr_checker_1',
    name: 'Chala Desta',
    email: 'chala.desta@oromiabank.com',
    role: 'CHECKER',
    department: 'Credit Operations & Portfolio Management',
  };

  const auditorActor: BulkActor = {
    id: 'usr_auditor_1',
    name: 'Worku Alemu',
    email: 'auditor@oromiabank.com',
    role: 'AUDITOR',
    department: 'Internal Audit & Regulatory Control',
  };

  // -------------------------------------------------------------------------
  // TEST 1: FORMULA INJECTION (CWE-1236) SANITIZATION
  // -------------------------------------------------------------------------
  console.log('\n--- 1. Formula Injection (CSV / Excel Injection) Sanitization ---');

  const dangerousInputs = [
    '=cmd|\'/C calc\'!A0',
    '+12345',
    '-2+5+cmd',
    '@SUM(1,2)',
    '\tDDE("cmd";"calc")',
    '\rDangerous',
    'Normal Officer Name',
  ];

  const sanitized = dangerousInputs.map(sanitizeFormulaInjection);
  assert(sanitized[0].startsWith("'="), 'Prepends single quote to formula starting with =');
  assert(sanitized[1].startsWith("'+"), 'Prepends single quote to formula starting with +');
  assert(sanitized[2].startsWith("'-"), 'Prepends single quote to formula starting with -');
  assert(sanitized[3].startsWith("'@"), 'Prepends single quote to formula starting with @');
  assert(sanitized[4].startsWith("'\t"), 'Prepends single quote to formula starting with tab');
  assert(sanitized[5].startsWith("'\r"), 'Prepends single quote to formula starting with return');
  assert(sanitized[6] === 'Normal Officer Name', 'Leaves safe alphanumeric strings intact');

  // CSV serialization test
  const csvHeaders = ['Name', 'FormulaPayload'];
  const csvRows = [['Test User', '=cmd|\'calc\'!A0']];
  const csvOutput = serializeToCsv(csvHeaders, csvRows);
  assert(csvOutput.includes("'=cmd|"), 'Serialized CSV neutralizes formula injection');

  // -------------------------------------------------------------------------
  // TEST 2: DRY-RUN ZERO-MUTATION MANDATORY WORKFLOW
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Mandatory Workflow & Zero-Mutation Dry-Run Guarantee ---');

  const initialUserCount = userService.getAll().length;
  const testNewEmail = `test_bulk_officer_${Date.now()}@oromiabank.com`;

  const validUserCsv = `Name,Email,Role,Department,EmployeeId,Status
Marta Tolosa,${testNewEmail},MAKER,Credit Operations & Portfolio Management,OB-MKR-999,ACTIVE`;

  // Generate Dry Run
  const dryRun = bulkOperationsEngine.generateDryRun({
    targetType: 'USERS',
    format: 'CSV',
    rawPayload: validUserCsv,
    conflictStrategy: 'UPDATE',
    actor: adminActor,
  });

  assert(dryRun.summary.totalRows === 1, 'Dry run parses 1 total row');
  assert(dryRun.summary.validRows === 1, 'Dry run validates row as VALID');
  assert(dryRun.summary.createdRows === 1, 'Identifies row as CREATE action');
  assert(dryRun.canExecute === true, 'Dry run indicates operation can be safely executed');
  assert(!!dryRun.dryRunId, 'Generates unique dry-run preview session token');

  // CRITICAL CHECK: Ensure authoritative registry was NOT mutated on dry run
  const countAfterDryRun = userService.getAll().length;
  assert(countAfterDryRun === initialUserCount, 'Authoritative database was NOT mutated by file upload/parsing');
  assert(!userService.getByEmail(testNewEmail), 'User record does not exist prior to explicit confirmation');

  // -------------------------------------------------------------------------
  // TEST 3: VALID TRANSACTIONAL EXECUTION WITH EXPLICIT CONFIRMATION
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Explicit Confirmation & Transactional Execution ---');

  // 1. Rejection without confirmation
  let rejectedNoConfirm = false;
  try {
    bulkOperationsEngine.executeDryRun({
      dryRunId: dryRun.dryRunId,
      mode: 'ATOMIC',
      actor: adminActor,
      confirmed: false,
    });
  } catch (err: any) {
    rejectedNoConfirm = true;
  }
  assert(rejectedNoConfirm, 'Execution strictly rejected without explicit confirmation flag');

  // 2. Confirmed Execution
  const execResult = bulkOperationsEngine.executeDryRun({
    dryRunId: dryRun.dryRunId,
    mode: 'ATOMIC',
    actor: adminActor,
    confirmed: true,
  });

  assert(execResult.success === true, 'Bulk execution succeeds with explicit confirmation');
  assert(execResult.summary.succeeded === 1, 'Summary reports 1 row successfully mutated');
  assert(userService.getByEmail(testNewEmail) !== undefined, 'User now authoritatively exists in registry');
  assert(userService.getAll().length === initialUserCount + 1, 'User registry reflects exactly +1 record');

  // -------------------------------------------------------------------------
  // TEST 4: CONFLICT RESOLUTION (UPDATE VS SKIP VS FAIL_ON_CONFLICT)
  // -------------------------------------------------------------------------
  console.log('\n--- 4. Conflict Strategies (Update, Skip, Fail) ---');

  // A. UPDATE Strategy: Update existing user's department & employeeId
  const updateCsv = `Name,Email,Role,Department,EmployeeId,Status
Marta Tolosa (Promoted),${testNewEmail},MAKER,Trade Services & International Banking,OB-MKR-999-PROMO,ACTIVE`;

  const dryRunUpdate = bulkOperationsEngine.generateDryRun({
    targetType: 'USERS',
    format: 'CSV',
    rawPayload: updateCsv,
    conflictStrategy: 'UPDATE',
    actor: adminActor,
  });

  assert(dryRunUpdate.summary.updatedRows === 1, 'Conflict strategy UPDATE marks existing row for UPDATE');
  const execUpdate = bulkOperationsEngine.executeDryRun({
    dryRunId: dryRunUpdate.dryRunId,
    mode: 'ATOMIC',
    actor: adminActor,
    confirmed: true,
  });
  assert(execUpdate.success === true, 'Update executes cleanly');
  const updatedUser = userService.getByEmail(testNewEmail)!;
  assert(updatedUser.department === 'Trade Services & International Banking', 'User department updated to Trade Services');
  assert(updatedUser.employeeId === 'OB-MKR-999-PROMO', 'User employeeId updated');

  // B. SKIP Strategy: Existing user is skipped without modification
  const skipCsv = `Name,Email,Role,Department,EmployeeId,Status
Marta Tolosa (Ignored),${testNewEmail},MAKER,Finance & Accounts Division,OB-MKR-IGNORE,ACTIVE`;

  const dryRunSkip = bulkOperationsEngine.generateDryRun({
    targetType: 'USERS',
    format: 'CSV',
    rawPayload: skipCsv,
    conflictStrategy: 'SKIP',
    actor: adminActor,
  });

  assert(dryRunSkip.rows[0].action === 'SKIP', 'Conflict strategy SKIP marks existing row as SKIP');
  const execSkip = bulkOperationsEngine.executeDryRun({
    dryRunId: dryRunSkip.dryRunId,
    mode: 'ATOMIC',
    actor: adminActor,
    confirmed: true,
  });
  assert(execSkip.summary.skipped === 1, 'Summary reports 1 row skipped');
  assert(userService.getByEmail(testNewEmail)!.department === 'Trade Services & International Banking', 'User was NOT modified when skipped');

  // C. FAIL_ON_CONFLICT Strategy
  const dryRunFail = bulkOperationsEngine.generateDryRun({
    targetType: 'USERS',
    format: 'CSV',
    rawPayload: skipCsv,
    conflictStrategy: 'FAIL_ON_CONFLICT',
    actor: adminActor,
  });
  assert(dryRunFail.summary.conflictingRows === 1, 'FAIL_ON_CONFLICT identifies conflict');
  assert(dryRunFail.canExecute === false, 'FAIL_ON_CONFLICT prevents execution');

  // -------------------------------------------------------------------------
  // TEST 5: INVALID IMPORTS & DEEP DATA VALIDATION
  // -------------------------------------------------------------------------
  console.log('\n--- 5. Invalid Data Validations & Error Detection ---');

  const invalidCsv = `Name,Email,Role,Department,EmployeeId
,no_name@oromiabank.com,MAKER,Credit Operations & Portfolio Management,OB-101
John Doe,invalid-email-format,MAKER,Credit Operations & Portfolio Management,OB-102
Jane Doe,jane.doe@oromiabank.com,SUPER_ADMIN,Credit Operations & Portfolio Management,OB-103
Unknown Dept User,unknown@oromiabank.com,MAKER,Fictitious Alien Department,OB-104
Dup User,dup@oromiabank.com,MAKER,Credit Operations & Portfolio Management,OB-105
Dup User 2,dup@oromiabank.com,MAKER,Credit Operations & Portfolio Management,OB-106`;

  const dryRunInvalid = bulkOperationsEngine.generateDryRun({
    targetType: 'USERS',
    format: 'CSV',
    rawPayload: invalidCsv,
    conflictStrategy: 'UPDATE',
    actor: adminActor,
  });

  assert(dryRunInvalid.canExecute === false, 'Cannot execute batch containing validation errors');
  assert(dryRunInvalid.rows[0].errors.some((e) => e.includes('Name')), 'Detects missing Name on Row 1');
  assert(dryRunInvalid.rows[1].errors.some((e) => e.includes('email')), 'Detects malformed email format on Row 2');
  assert(dryRunInvalid.rows[2].errors.some((e) => e.includes('Invalid role')), 'Detects invalid role on Row 3');
  assert(dryRunInvalid.rows[3].errors.some((e) => e.includes('Unknown department')), 'Detects unknown department on Row 4');
  assert(dryRunInvalid.rows[5].errors.some((e) => e.includes('Duplicate email')), 'Detects batch duplicate email on Row 6');

  // -------------------------------------------------------------------------
  // TEST 6: AUTHORIZATION, ROLE GUARDS & PRIVILEGE ESCALATION
  // -------------------------------------------------------------------------
  console.log('\n--- 6. Zero-Bypass Authorization & Privilege Escalation Checks ---');

  // A. Non-admin (Maker) trying to perform user bulk dry-run
  let makerBlocked = false;
  try {
    bulkOperationsEngine.generateDryRun({
      targetType: 'USERS',
      format: 'CSV',
      rawPayload: validUserCsv,
      actor: makerActor,
    });
  } catch (err: any) {
    makerBlocked = true;
    assert(err.message.includes('Unauthorized'), 'Maker is blocked with Unauthorized message');
  }
  assert(makerBlocked, 'Non-admin role (MAKER) is strictly prohibited from user bulk operations');

  // B. Checker trying to perform department bulk operations
  let checkerBlocked = false;
  try {
    bulkOperationsEngine.generateDryRun({
      targetType: 'DEPARTMENTS',
      format: 'CSV',
      rawPayload: 'name,shortCode,division\nTest,TST,Div',
      actor: checkerActor,
    });
  } catch (err: any) {
    checkerBlocked = true;
  }
  assert(checkerBlocked, 'Checker is strictly prohibited from department bulk operations');

  // C. Root Administrator (usr_admin_1) Protection
  const tamperAdminCsv = `Name,Email,Role,Department,EmployeeId,Status
Tampered Admin,admin@oromiabank.com,MAKER,Credit Operations & Portfolio Management,OB-ADM-001,DISABLED`;

  const dryRunTamper = bulkOperationsEngine.generateDryRun({
    targetType: 'USERS',
    format: 'CSV',
    rawPayload: tamperAdminCsv,
    conflictStrategy: 'UPDATE',
    actor: adminActor,
  });

  assert(dryRunTamper.rows[0].status === 'INVALID', 'Tampering with root admin account status/role is marked INVALID');
  assert(
    dryRunTamper.rows[0].errors.some((e) => e.includes('usr_admin_1')),
    'Protects primary compliance governance administrator from deactivation or demotion'
  );

  // -------------------------------------------------------------------------
  // TEST 7: ATOMIC TRANSACTION & AUTOMATIC ROLLBACK
  // -------------------------------------------------------------------------
  console.log('\n--- 7. Atomic Transaction Safety & Automatic Rollback ---');

  const baselineUsers = userService.getAll().length;
  const userA = `atomic_a_${Date.now()}@oromiabank.com`;
  const userB = `atomic_b_${Date.now()}@oromiabank.com`;

  // Row 1 is valid, Row 2 has non-existent department to force failure
  const batchCsv = `Name,Email,Role,Department,EmployeeId,Status
Atomic Alpha,${userA},MAKER,Credit Operations & Portfolio Management,OB-ATM-1,ACTIVE
Atomic Beta,${userB},MAKER,NON_EXISTENT_DEPARTMENT,OB-ATM-2,ACTIVE`;

  const dryRunAtomic = bulkOperationsEngine.generateDryRun({
    targetType: 'USERS',
    format: 'CSV',
    rawPayload: batchCsv,
    conflictStrategy: 'UPDATE',
    actor: adminActor,
  });

  // Attempt atomic execution
  const atomicExec = bulkOperationsEngine.executeDryRun({
    dryRunId: dryRunAtomic.dryRunId,
    mode: 'ATOMIC',
    actor: adminActor,
    confirmed: true,
  });

  assert(atomicExec.success === false, 'Atomic execution fails on invalid row');
  assert(atomicExec.rolledBack === true, 'System confirms atomic rollback occurred');

  // Verify total rollback: Neither User A nor User B should exist!
  assert(!userService.getByEmail(userA), 'User A was completely rolled back and does not exist');
  assert(!userService.getByEmail(userB), 'User B does not exist');
  assert(userService.getAll().length === baselineUsers, 'Pristine state restored: user count matches baseline exactly');

  // Verify audit log has recorded the rollback event
  const rollbackLogs = auditService.getAll().filter((l) => l.action === 'BULK_OPERATION_ROLLBACK');
  assert(rollbackLogs.length > 0, 'BULK_OPERATION_ROLLBACK recorded in authoritative audit ledger');

  // -------------------------------------------------------------------------
  // TEST 8: PARTIAL SUCCESS EXECUTION MODE
  // -------------------------------------------------------------------------
  console.log('\n--- 8. Partial Success Execution Mode ---');

  const userC = `partial_c_${Date.now()}@oromiabank.com`;
  const userD = `partial_d_${Date.now()}@oromiabank.com`;

  const partialCsv = `Name,Email,Role,Department,EmployeeId,Status
Partial Charlie,${userC},MAKER,Credit Operations & Portfolio Management,OB-PRT-1,ACTIVE
Partial Delta,${userD},MAKER,NON_EXISTENT_DEPT,OB-PRT-2,ACTIVE`;

  const dryRunPartial = bulkOperationsEngine.generateDryRun({
    targetType: 'USERS',
    format: 'CSV',
    rawPayload: partialCsv,
    conflictStrategy: 'UPDATE',
    actor: adminActor,
  });

  const partialExec = bulkOperationsEngine.executeDryRun({
    dryRunId: dryRunPartial.dryRunId,
    mode: 'PARTIAL',
    actor: adminActor,
    confirmed: true,
  });

  assert(partialExec.summary.succeeded === 1, 'Partial mode succeeds for valid row (User C)');
  assert(partialExec.summary.failed === 1, 'Partial mode logs failure for invalid row (User D)');
  assert(userService.getByEmail(userC) !== undefined, 'User C was created');
  assert(userService.getByEmail(userD) === undefined, 'User D was skipped/failed');

  // -------------------------------------------------------------------------
  // TEST 9: BULK USER LIFECYCLE ACTIONS (MULTI-SELECT)
  // -------------------------------------------------------------------------
  console.log('\n--- 9. Bulk User Lifecycle Actions (Activate, Deactivate, Reassign) ---');

  const testUser = userService.getByEmail(userC)!;
  assert(testUser.status === 'ACTIVE', 'Test user initial status is ACTIVE');

  // Bulk Deactivate
  const deactRes = bulkOperationsEngine.executeBulkUserAction({
    userIds: [testUser.id],
    action: 'DEACTIVATE',
    actor: adminActor,
  });
  assert(deactRes.success === true, 'Bulk deactivate executes successfully');
  assert(userService.getById(testUser.id)!.status === 'DISABLED', 'User status transitioned to DISABLED');

  // Bulk Activate
  const actRes = bulkOperationsEngine.executeBulkUserAction({
    userIds: [testUser.id],
    action: 'ACTIVATE',
    actor: adminActor,
  });
  assert(actRes.success === true, 'Bulk activate executes successfully');
  assert(userService.getById(testUser.id)!.status === 'ACTIVE', 'User status transitioned back to ACTIVE');

  // Bulk Department Reassignment
  const reassignRes = bulkOperationsEngine.executeBulkUserAction({
    userIds: [testUser.id],
    action: 'ASSIGN_DEPARTMENT',
    payload: { department: 'Trade Services & International Banking' },
    actor: adminActor,
  });
  assert(reassignRes.success === true, 'Bulk department reassignment executes cleanly');
  assert(
    userService.getById(testUser.id)!.department === 'Trade Services & International Banking',
    'User reassigned to Trade Services'
  );

  // Bulk Role Assignment
  const roleRes = bulkOperationsEngine.executeBulkUserAction({
    userIds: [testUser.id],
    action: 'ASSIGN_ROLE',
    payload: { role: 'CHECKER' },
    actor: adminActor,
  });
  assert(roleRes.success === true, 'Bulk role assignment succeeds');
  assert(userService.getById(testUser.id)!.role === 'CHECKER', 'User role updated to CHECKER');

  // Bulk Direct Report Assignment
  const assignRepRes = bulkOperationsEngine.executeBulkUserAction({
    userIds: [testUser.id],
    action: 'ASSIGN_REPORTS',
    payload: { reportKeys: ['POBEPE001', 'M_LCPLC001'] },
    actor: adminActor,
  });
  assert(assignRepRes.success === true, 'Bulk report assignment succeeds');

  // Bulk Special Access Grant & Revoke
  const grantRes = bulkOperationsEngine.executeBulkUserAction({
    userIds: [testUser.id],
    action: 'GRANT_SPECIAL_ACCESS',
    payload: {
      specialAccess: {
        reportKey: 'DigitalLendingDL001',
        reason: 'Temporary regulatory coverage during fintech examination audit',
      },
    },
    actor: adminActor,
  });
  assert(grantRes.success === true, 'Bulk special access grant succeeds');
  assert(userService.getById(testUser.id)!.specialAccessGrants.length > 0, 'User has active special access grant');

  const revokeRes = bulkOperationsEngine.executeBulkUserAction({
    userIds: [testUser.id],
    action: 'REVOKE_SPECIAL_ACCESS',
    actor: adminActor,
  });
  assert(revokeRes.success === true, 'Bulk special access revoke succeeds');

  // -------------------------------------------------------------------------
  // TEST 10: BULK REPORT RETIREMENT & HISTORICAL PRESERVATION
  // -------------------------------------------------------------------------
  console.log('\n--- 10. Bulk Report Retirement & Historical Preservation ---');

  // Test report retirement
  const testReportKey = 'M_LCPLC001';
  const initialSubmissions = submissionService.getAll().filter((s) => s.reportKey === testReportKey);

  const retireRes = bulkOperationsEngine.executeBulkReportAction({
    reportKeys: [testReportKey],
    action: 'RETIRE',
    payload: { reason: 'NBE Circular SBR/02/2026 Template Refresh' },
    actor: adminActor,
  });
  assert(retireRes.success === true, 'Bulk report retirement succeeds');

  // Historical Submissions Must Remain Intact
  const afterSubmissions = submissionService.getAll().filter((s) => s.reportKey === testReportKey);
  assert(afterSubmissions.length === initialSubmissions.length, 'Historical report submissions preserved intact upon retirement');

  // Reactivate Report for Normal Operations
  const reactivateRes = bulkOperationsEngine.executeBulkReportAction({
    reportKeys: [testReportKey],
    action: 'ACTIVATE',
    actor: adminActor,
  });
  assert(reactivateRes.success === true, 'Bulk report reactivation succeeds');

  // -------------------------------------------------------------------------
  // TEST 11: AUTHORIZED DATA EXPORTS & AUDITING
  // -------------------------------------------------------------------------
  console.log('\n--- 11. Authorized & Audited Data Exports (CSV & XLSX) ---');

  // A. Admin user export (CSV)
  const adminExportCsv = bulkOperationsEngine.exportData({
    target: 'USERS',
    format: 'CSV',
    actor: adminActor,
  });
  assert(adminExportCsv.rowsCount > 0, 'Admin successfully exported user list');
  assert(typeof adminExportCsv.content === 'string', 'CSV content is valid string');
  assert(!(adminExportCsv.content as string).includes('password'), 'Passwords/credentials are omitted from export');

  // B. Admin user export (XLSX)
  const adminExportXlsx = bulkOperationsEngine.exportData({
    target: 'USERS',
    format: 'XLSX',
    actor: adminActor,
  });
  assert(adminExportXlsx.content instanceof Uint8Array, 'XLSX content is binary buffer');

  // C. Unauthorized user export attempt by Maker
  let makerExportBlocked = false;
  try {
    bulkOperationsEngine.exportData({
      target: 'USERS',
      format: 'CSV',
      actor: makerActor,
    });
  } catch (err: any) {
    makerExportBlocked = true;
    assert(err.message.includes('restricted to ADMIN and AUDITOR'), 'Maker export blocked with authorization error');
  }
  assert(makerExportBlocked, 'Maker export of enterprise users roster strictly barred');

  // D. Auditor can export users
  const auditorExport = bulkOperationsEngine.exportData({
    target: 'USERS',
    format: 'CSV',
    actor: auditorActor,
  });
  assert(auditorExport.rowsCount > 0, 'Auditor authorized to export user roster for regulatory audit');

  // E. Verify export audit logs
  const exportLogs = auditService.getAll().filter((l) => l.action === 'DATA_EXPORTED');
  assert(exportLogs.length >= 3, 'Audit ledger records all sensitive data export operations');

  // -------------------------------------------------------------------------
  // TEST 12: DRY-RUN PAGINATION & LARGE DATASETS
  // -------------------------------------------------------------------------
  console.log('\n--- 12. Large Datasets & Dry-Run Pagination ---');

  // Generate 50 rows
  const largeRows = ['Name,Email,Role,Department,EmployeeId,Status'];
  for (let i = 1; i <= 50; i++) {
    largeRows.push(`Batch Officer ${i},batch_${i}_${Date.now()}@oromiabank.com,MAKER,Credit Operations & Portfolio Management,OB-MKR-${1000 + i},ACTIVE`);
  }
  const largeCsv = largeRows.join('\n');

  const largeDryRun = bulkOperationsEngine.generateDryRun({
    targetType: 'USERS',
    format: 'CSV',
    rawPayload: largeCsv,
    actor: adminActor,
    page: 1,
    pageSize: 10,
  });

  assert(largeDryRun.summary.totalRows === 50, 'Parsed all 50 rows');
  assert(largeDryRun.totalPages === 5, '50 rows with pageSize 10 yields 5 total pages');
  assert(largeDryRun.paginatedRows?.length === 10, 'First page contains exactly 10 rows');

  // Fetch page 3
  const page3 = bulkOperationsEngine.getDryRun(largeDryRun.dryRunId, 3, 10);
  assert(page3?.page === 3, 'Retrieved cached dry run page 3');
  assert(page3?.paginatedRows?.length === 10, 'Page 3 contains 10 rows');
  assert(page3?.paginatedRows?.[0].rowNumber === 21, 'Page 3 starts at row 21');

  console.log('\n========================================================================');
  console.log('✅ ALL PHASE 6 BULK OPERATIONS, IMPORT, EXPORT & FILE WORKFLOW TESTS PASSED');
  console.log('========================================================================\n');
}
