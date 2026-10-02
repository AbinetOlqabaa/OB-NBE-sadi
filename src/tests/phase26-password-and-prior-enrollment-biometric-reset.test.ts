/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * PHASE 26 ACCEPTANCE TEST SUITE: Password Verification & Prior Enrollment Gating for Biometric Reset
 * Compliance: NBE Directive BSD/03/2020 Step-Up Authentication & Anti-Account-Takeover
 */

import { biometricService } from '../services/biometricService.ts';
import { userService } from '../services/userService.ts';

function assert(condition: any, msg: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

export async function runPhase26PasswordAndPriorEnrollmentBiometricResetTests() {
  console.log('\n========================================================================');
  console.log('--- PHASE 26: PASSWORD & PRIOR ENROLLMENT BIOMETRIC RESET SUITE ---');
  console.log('========================================================================\n');

  console.log('--- 1. Mandatory Email & Password Input Validation ---');
  // 1A: Missing email
  const missingEmailRes = biometricService.verifyResetCredentialsAndEnrollment('', 'ValidPassword123');
  assert(!missingEmailRes.success, 'Fails when email is missing');
  assert(!missingEmailRes.validCredentials, 'validCredentials is false when email is missing');
  assert(missingEmailRes.message?.includes('Corporate email format required'), 'Message cites corporate email requirement');

  // 1B: Non-corporate email domain
  const nonCorpEmailRes = biometricService.verifyResetCredentialsAndEnrollment('officer@gmail.com', 'ValidPassword123');
  assert(!nonCorpEmailRes.success, 'Fails when email domain is not @oromiabank.com');
  assert(nonCorpEmailRes.message?.includes('@oromiabank.com'), 'Message specifies @oromiabank.com domain constraint');

  // 1C: Missing password (Acceptance Criterion: User must provide both email and password)
  const missingPwRes = biometricService.verifyResetCredentialsAndEnrollment('test.officer@oromiabank.com', '');
  assert(!missingPwRes.success, 'Fails when password is empty');
  assert(missingPwRes.message?.includes('password is required'), 'Message specifies password entry is required');

  console.log('\n--- 2. Credential Validity Verification (Email & Password Matching) ---');
  const testUserEmail = `officer_phase26_${Date.now()}@oromiabank.com`;
  const correctPassword = 'InstitutionalSecretPass#2026';
  const wrongPassword = 'WrongPasswordAttempt#999';

  const reg = userService.register({
    email: testUserEmail,
    name: 'Tirunesh Dibaba',
    role: 'MAKER',
    department: 'Treasury & International Banking',
    employeeId: `EMP_P26_${Date.now()}`,
    password: correctPassword,
  });
  assert(Boolean(reg.user), 'Test officer registered in Oromia Bank directory');
  userService.updateUserStatus(reg.user!.id, 'ACTIVE', 'Super Admin');

  // 2A: Non-existent user email
  const nonExistentRes = biometricService.verifyResetCredentialsAndEnrollment(
    `unknown_officer_${Date.now()}@oromiabank.com`,
    correctPassword
  );
  assert(!nonExistentRes.success, 'Fails when user account does not exist');
  assert(!nonExistentRes.validCredentials, 'validCredentials is false for non-existent user');
  assert(nonExistentRes.message?.includes('No active officer account found'), 'Descriptive account not found error returned');

  // 2B: Correct email but WRONG password
  const wrongPwRes = biometricService.verifyResetCredentialsAndEnrollment(testUserEmail, wrongPassword);
  assert(!wrongPwRes.success, 'Fails when incorrect password is provided');
  assert(!wrongPwRes.validCredentials, 'validCredentials is false on wrong password');
  assert(wrongPwRes.message?.includes('Invalid corporate account password'), 'Cites invalid password');
  assert(typeof wrongPwRes.remainingAttempts === 'number', 'Reports remaining trials before service denial');

  console.log('\n--- 3. Prior Biometric Enrollment Gate: Neither Enrolled ---');
  // At this stage, Tirunesh has valid credentials (email & password match), but has NO enrolled biometrics.
  // The system MUST check if fingerprint or/and face enrollment has been done previously,
  // and block proceeding to any biometric resetting process!
  const noEnrollmentRes = biometricService.verifyResetCredentialsAndEnrollment(testUserEmail, correctPassword);
  assert(!noEnrollmentRes.success, 'Reset verification fails when user has NO prior biometric enrollments');
  assert(noEnrollmentRes.validCredentials === true, 'Credentials itself were successfully validated');
  assert(noEnrollmentRes.hasEnrolledBiometrics === false, 'hasEnrolledBiometrics is false');
  assert(noEnrollmentRes.hasFaceId === false, 'hasFaceId is false');
  assert(noEnrollmentRes.hasFingerprint === false, 'hasFingerprint is false');
  assert(
    noEnrollmentRes.message?.includes('No enrolled biometrics found'),
    'Explicit notice that reset cannot proceed without pre-existing biometric enrollments'
  );
  assert(
    noEnrollmentRes.message?.includes(reg.user!.name),
    'Notice cites the specific officer name to guide the user'
  );

  console.log('\n--- 4. Prior Biometric Enrollment Gate: Face ID Enrolled Scenario ---');
  // Enroll Face ID for the user
  const faceChallenge = biometricService.createChallenge(testUserEmail, 'FACE', 'REGISTRATION');
  const faceEnrollRes = biometricService.enrollFaceBiometric(
    testUserEmail,
    faceChallenge.id,
    'face_optical_140_135_130_lum_135_dim_640x480'
  );
  assert(faceEnrollRes.success, 'Face ID enrolled successfully for officer');

  // Verify credentials and prior enrollment now:
  const faceVerifiedRes = biometricService.verifyResetCredentialsAndEnrollment(testUserEmail, correctPassword);
  assert(faceVerifiedRes.success === true, 'Verification succeeds when credentials are valid AND Face ID is enrolled');
  assert(faceVerifiedRes.validCredentials === true, 'Credentials confirmed valid');
  assert(faceVerifiedRes.hasEnrolledBiometrics === true, 'Prior biometric enrollment confirmed');
  assert(faceVerifiedRes.hasFaceId === true, 'hasFaceId is true');
  assert(faceVerifiedRes.hasFingerprint === false, 'hasFingerprint is false');
  assert(faceVerifiedRes.message?.includes('Face ID Profile'), 'Identifies Face ID Profile as available reset target');

  console.log('\n--- 5. Prior Biometric Enrollment Gate: WebAuthn Fingerprint Enrolled Scenario ---');
  const fpOfficerEmail = `fp_officer_phase26_${Date.now()}@oromiabank.com`;
  const regFp = userService.register({
    email: fpOfficerEmail,
    name: 'Kenenisa Bekele',
    role: 'CHECKER',
    department: 'Internal Audit & Regulatory Control',
    employeeId: `EMP_FP_${Date.now()}`,
    password: correctPassword,
  });
  userService.updateUserStatus(regFp.user!.id, 'ACTIVE', 'Super Admin');

  // Register WebAuthn passkey
  const fpChallenge = biometricService.createChallenge(fpOfficerEmail, 'FINGERPRINT', 'REGISTRATION');
  const fpRegRes = biometricService.verifyWebAuthnRegistration(
    fpOfficerEmail,
    fpChallenge.id,
    {
      credentialId: `cred_fp_passkey_${Date.now()}`,
      publicKeyPem: 'PUBLIC_KEY_PEM_DATA',
      counter: 0,
      deviceLabel: 'Oromia Bank Workstation Biometric Sensor',
    }
  );
  assert(fpRegRes.success, 'Fingerprint passkey registered');

  // Verify credentials and prior enrollment for fingerprint user
  const fpVerifiedRes = biometricService.verifyResetCredentialsAndEnrollment(fpOfficerEmail, correctPassword);
  assert(fpVerifiedRes.success === true, 'Verification succeeds for user with WebAuthn fingerprint enrolled');
  assert(fpVerifiedRes.validCredentials === true, 'Credentials confirmed valid');
  assert(fpVerifiedRes.hasEnrolledBiometrics === true, 'hasEnrolledBiometrics is true');
  assert(fpVerifiedRes.hasFaceId === false, 'hasFaceId is false');
  assert(fpVerifiedRes.hasFingerprint === true, 'hasFingerprint is true');
  assert(fpVerifiedRes.message?.includes('WebAuthn Passkey'), 'Identifies WebAuthn Passkey as available target');

  console.log('\n--- 6. Prior Biometric Enrollment Gate: Both Enrolled Scenario ---');
  // Add Face ID to the second user so both Face ID and Fingerprint are enrolled
  const fpFaceCh = biometricService.createChallenge(fpOfficerEmail, 'FACE', 'REGISTRATION');
  biometricService.enrollFaceBiometric(
    fpOfficerEmail,
    fpFaceCh.id,
    'face_optical_142_138_132_lum_138_dim_640x480'
  );

  const bothVerifiedRes = biometricService.verifyResetCredentialsAndEnrollment(fpOfficerEmail, correctPassword);
  assert(bothVerifiedRes.success === true, 'Verification succeeds when both Face ID and Fingerprint are enrolled');
  assert(bothVerifiedRes.hasFaceId === true, 'hasFaceId is true');
  assert(bothVerifiedRes.hasFingerprint === true, 'hasFingerprint is true');
  assert(bothVerifiedRes.message?.includes('Face ID and Fingerprint'), 'Identifies both biometrics are available for reset');

  console.log('\n--- 7. End-to-End Reset Execution After Gating Verification ---');
  // Step 2: Request Reset Token with password
  const resetReq = biometricService.requestReset(fpOfficerEmail, 'ALL', correctPassword, 'Authorized reset');
  assert(resetReq.success, 'Reset token issued following successful credential verification');
  assert(Boolean(resetReq.resetToken), 'Valid one-time resetToken returned');

  // Step 3: Execute Revocation
  const execReset = biometricService.executeReset(fpOfficerEmail, resetReq.resetToken!);
  assert(execReset.success, 'Revocation executed successfully');
  assert(execReset.revokedCount === 2, 'Revoked both Face ID and Fingerprint passkeys');

  // Now verify that checking after revocation returns no enrolled biometrics:
  const postResetCheck = biometricService.verifyResetCredentialsAndEnrollment(fpOfficerEmail, correctPassword);
  assert(!postResetCheck.success, 'Subsequent reset verification blocked after passkeys revoked');
  assert(postResetCheck.hasEnrolledBiometrics === false, 'hasEnrolledBiometrics is false post-reset');
  assert(postResetCheck.hasFaceId === false, 'hasFaceId is false post-reset');
  assert(postResetCheck.hasFingerprint === false, 'hasFingerprint is false post-reset');

  console.log('\n========================================================================');
  console.log('✅ ALL PHASE 26 PASSWORD & PRIOR ENROLLMENT BIOMETRIC RESET TESTS PASSED (100%)');
  console.log('========================================================================\n');
}
