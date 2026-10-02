/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * PHASE 18 ACCEPTANCE TEST SUITE: Production Login Form Cleanup & Empty Default Credentials
 * Compliance: NBE Directive BSD/03/2020 & 18_LOGIN_FORM_PRODUCTION_CLEANUP_AND_EMPTY_DEFAULT_CREDENTIALS.md
 */

import fs from 'node:fs';
import path from 'node:path';
import { userService } from '../services/userService.ts';

function assert(condition: any, msg: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

export async function runPhase18LoginFormProductionCleanupTests() {
  console.log('\n========================================================================');
  console.log('--- PHASE 18: PRODUCTION LOGIN FORM CLEANUP & EMPTY CREDENTIALS SUITE ---');
  console.log('========================================================================\n');

  console.log('--- 1. Login Component Source Inspection ---');
  const loginPath = path.resolve(process.cwd(), 'src/components/LoginPage.tsx');
  assert(fs.existsSync(loginPath), 'LoginPage.tsx source file exists');
  const loginContent = fs.readFileSync(loginPath, 'utf8');

  // Verify email and password default to empty string
  assert(
    loginContent.includes("useState('')") || loginContent.includes('useState("")'),
    'LoginPage initial state initializes with empty string credentials'
  );
  assert(
    !loginContent.includes("useState('admin@oromiabank.com')"),
    'LoginPage strictly does not pre-fill admin@oromiabank.com in initial state'
  );
  assert(
    !loginContent.includes("useState('password')"),
    'LoginPage strictly does not pre-fill "password" in initial state'
  );

  console.log('\n--- 2. Guiding Enterprise Placeholders ---');
  assert(
    loginContent.includes('placeholder="e.g. abebe.kebede@oromiabank.com"'),
    'Corporate email input renders official guiding placeholder "e.g. abebe.kebede@oromiabank.com"'
  );
  assert(
    loginContent.includes('placeholder="Enter your institutional password"'),
    'Password input renders enterprise placeholder "Enter your institutional password"'
  );

  console.log('\n--- 3. Elimination of Development Test Accounts Reference from UI ---');
  assert(
    !loginContent.includes('Development Test Accounts Reference'),
    'Frontend UI strictly does not render "Development Test Accounts Reference" dropdown'
  );
  assert(
    !loginContent.includes('Default dev password:'),
    'Frontend UI strictly does not expose dev password guidance'
  );
  assert(
    !loginContent.includes('Use Email'),
    'Frontend UI does not render developer quick-fill buttons'
  );

  console.log('\n--- 4. Backend Database Seed Integrity & Authenticity ---');
  // Seed accounts must remain fully functional in backend database for authorized tests
  const seedOfficers = [
    { email: 'admin@oromiabank.com', role: 'ADMIN', name: 'Dawit Bekele' },
    { email: 'abebe.kebede@oromiabank.com', role: 'MAKER', name: 'Abebe Kebede' },
    { email: 'chala.desta@oromiabank.com', role: 'CHECKER', name: 'Chala Desta' },
    { email: 'auditor@oromiabank.com', role: 'AUDITOR', name: 'Worku Alemu' },
  ];

  for (const officer of seedOfficers) {
    const user = userService.getByEmail(officer.email);
    assert(Boolean(user), `Database preserves institutional seed account ${officer.email}`);
    assert(user?.role === officer.role, `Account ${officer.email} retains authoritative role ${officer.role}`);

    const authRes = userService.login(officer.email, 'password');
    assert(authRes.success, `Official authentication succeeds for ${officer.email} when credentials entered`);
  }

  console.log('\n========================================================================');
  console.log('✅ ALL PHASE 18 LOGIN FORM PRODUCTION CLEANUP TESTS PASSED');
  console.log('========================================================================\n');
}
