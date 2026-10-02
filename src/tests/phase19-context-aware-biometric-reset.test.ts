/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * PHASE 19 ACCEPTANCE TEST SUITE: Context-Aware Biometric Reset & Enrollment Discovery
 * Compliance: NBE Directive BSD/03/2020 & 19_CONTEXT_AWARE_BIOMETRIC_RESET_AND_ENROLLMENT_DISCOVERY.md
 */

import { biometricService } from '../services/biometricService.ts';
import { userService } from '../services/userService.ts';

function assert(condition: any, msg: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

export async function runPhase19ContextAwareBiometricResetTests() {
  console.log('\n========================================================================');
  console.log('--- PHASE 19: CONTEXT-AWARE BIOMETRIC RESET & ENROLLMENT SUITE ---');
  console.log('========================================================================\n');

  console.log('--- 1. Discovery Assessment for Non-Enrolled User ---');
  const freshEmail = `fresh_officer_${Date.now()}@oromiabank.com`;
  const reg1 = userService.register({
    email: freshEmail,
    name: 'Aster Aweke',
    role: 'CHECKER',
    department: 'Internal Audit & Regulatory Control',
    employeeId: `EMP_FRESH_${Date.now()}`,
  });
  if (reg1.user) userService.updateUserStatus(reg1.user.id, 'ACTIVE', 'Super Admin');

  const freshState = biometricService.getBiometricUserState(freshEmail);
  assert(freshState.faceState === 'NOT_ENROLLED', 'Fresh officer has faceState NOT_ENROLLED');
  assert(freshState.fingerprintState === 'NOT_ENROLLED', 'Fresh officer has fingerprintState NOT_ENROLLED');
  assert(freshState.credentials.length === 0, 'Zero credentials registered');

  console.log('\n--- 2. Face ID Only Enrolled Officer Scenario ---');
  const faceOnlyEmail = `face_only_${Date.now()}@oromiabank.com`;
  const reg2 = userService.register({
    email: faceOnlyEmail,
    name: 'Solomon Bogale',
    role: 'MAKER',
    department: 'Trade Services & Foreign Exchange',
    employeeId: `EMP_FACE_${Date.now()}`,
  });
  if (reg2.user) userService.updateUserStatus(reg2.user.id, 'ACTIVE', 'Super Admin');

  const faceCh = biometricService.createChallenge(faceOnlyEmail, 'FACE', 'REGISTRATION');
  const faceEnroll = biometricService.enrollFaceBiometric(
    faceOnlyEmail,
    faceCh.id,
    'face_optical_135_130_125_lum_130_dim_640x480'
  );
  assert(faceEnroll.success, 'Face ID enrolled for officer');

  const faceOnlyState = biometricService.getBiometricUserState(faceOnlyEmail);
  assert(faceOnlyState.faceState === 'ENROLLED', 'Face state is ENROLLED');
  assert(faceOnlyState.fingerprintState === 'NOT_ENROLLED', 'Fingerprint state is NOT_ENROLLED');

  // Request reset for FACE with valid password
  const resetFaceReq = biometricService.requestReset(faceOnlyEmail, 'FACE', 'password', 'Camera upgrade');
  assert(resetFaceReq.success, 'Step-up authorized reset request succeeds for Face ID');
  assert(Boolean(resetFaceReq.resetToken), 'One-time resetToken issued');

  // Execute reset
  const execFaceReset = biometricService.executeReset(faceOnlyEmail, resetFaceReq.resetToken!);
  assert(execFaceReset.success, 'Face ID reset executes successfully');
  assert(execFaceReset.revokedCount === 1, 'Exactly 1 face credential revoked');

  const afterFaceResetState = biometricService.getBiometricUserState(faceOnlyEmail);
  assert(afterFaceResetState.faceState === 'NOT_ENROLLED', 'Face ID state transitioned back to NOT_ENROLLED');

  console.log('\n--- 3. WebAuthn Fingerprint Only Enrolled Officer Scenario ---');
  const fpOnlyEmail = `fp_only_${Date.now()}@oromiabank.com`;
  const reg3 = userService.register({
    email: fpOnlyEmail,
    name: 'Derartu Tulu',
    role: 'AUDITOR',
    department: 'Compliance & Legal Governance',
    employeeId: `EMP_FP_${Date.now()}`,
  });
  if (reg3.user) userService.updateUserStatus(reg3.user.id, 'ACTIVE', 'Super Admin');

  const fpCh = biometricService.createChallenge(fpOnlyEmail, 'FINGERPRINT', 'REGISTRATION');
  const fpReg = biometricService.verifyWebAuthnRegistration(
    fpOnlyEmail,
    fpCh.id,
    {
      credentialId: `raw_fp_${Date.now()}`,
      publicKeyPem: 'PUBLIC_KEY_PEM_DATA',
      counter: 0,
      deviceLabel: 'YubiKey 5 FIDO2 USB-C Authenticator',
    }
  );
  assert(fpReg.success, 'WebAuthn passkey registered');

  const fpOnlyState = biometricService.getBiometricUserState(fpOnlyEmail);
  assert(fpOnlyState.fingerprintState === 'ENROLLED', 'Fingerprint state is ENROLLED');
  assert(fpOnlyState.faceState === 'NOT_ENROLLED', 'Face state is NOT_ENROLLED');

  // Reset FINGERPRINT
  const resetFpReq = biometricService.requestReset(fpOnlyEmail, 'FINGERPRINT', 'password', 'Key replaced');
  assert(resetFpReq.success, 'Step-up reset request succeeds for Fingerprint');
  const execFpReset = biometricService.executeReset(fpOnlyEmail, resetFpReq.resetToken!);
  assert(execFpReset.success, 'Fingerprint credential revoked successfully');

  console.log('\n--- 4. Multi-Modal Officer Scenario (Both Enrolled -> Selective or ALL Reset) ---');
  const dualEmail = `dual_bio_${Date.now()}@oromiabank.com`;
  const reg4 = userService.register({
    email: dualEmail,
    name: 'Kenenisa Bekele',
    role: 'MAKER',
    department: 'Credit Operations & Portfolio Management',
    employeeId: `EMP_DUAL_${Date.now()}`,
  });
  if (reg4.user) userService.updateUserStatus(reg4.user.id, 'ACTIVE', 'Super Admin');

  const dualFaceCh = biometricService.createChallenge(dualEmail, 'FACE', 'REGISTRATION');
  biometricService.enrollFaceBiometric(dualEmail, dualFaceCh.id, 'face_optical_142_138_130_lum_136');
  const dualFpCh = biometricService.createChallenge(dualEmail, 'FINGERPRINT', 'REGISTRATION');
  biometricService.verifyWebAuthnRegistration(dualEmail, dualFpCh.id, {
    credentialId: `raw_dual_${Date.now()}`,
    publicKeyPem: 'PUBKEY',
    counter: 0,
    deviceLabel: 'Touch ID',
  });

  const dualState = biometricService.getBiometricUserState(dualEmail);
  assert(dualState.faceState === 'ENROLLED', 'Dual user face is ENROLLED');
  assert(dualState.fingerprintState === 'ENROLLED', 'Dual user fingerprint is ENROLLED');

  // Execute ALL reset
  const resetAllReq = biometricService.requestReset(dualEmail, 'ALL', 'password', 'Complete hardware re-provisioning');
  assert(resetAllReq.success, 'Reset request for ALL biometrics authorized');
  const execAllReset = biometricService.executeReset(dualEmail, resetAllReq.resetToken!);
  assert(execAllReset.success, 'ALL biometrics wiped cleanly');
  assert(execAllReset.revokedCount === 2, 'Both Face and Fingerprint credentials revoked (count 2)');

  const afterAllState = biometricService.getBiometricUserState(dualEmail);
  assert(afterAllState.faceState === 'NOT_ENROLLED', 'Face state cleared');
  assert(afterAllState.fingerprintState === 'NOT_ENROLLED', 'Fingerprint state cleared');

  console.log('\n--- 5. Corporate Email Validation & Matching Security ---');
  // 5A: Non-corporate email rejection
  const nonCorpAttempt = biometricService.requestReset(
    'officer@gmail.com',
    'FACE',
    'password',
    'Unauthorized external email'
  );
  assert(!nonCorpAttempt.success, 'Non-corporate email rejected for biometric reset');
  assert(
    nonCorpAttempt.message?.includes('Corporate email format required'),
    'Clear notification explaining corporate email requirement (@oromiabank.com)'
  );

  // 5B: Malformed email string
  const malformedAttempt = biometricService.requestReset(
    'invalid-email-format',
    'FACE',
    'password',
    'Malformed email'
  );
  assert(!malformedAttempt.success, 'Malformed email rejected for biometric reset');

  // 5C: Non-existent corporate email in directory
  const nonExistentEmail = `unknown_officer_${Date.now()}@oromiabank.com`;
  const nonExistentAttempt = biometricService.requestReset(
    nonExistentEmail,
    'FACE',
    'password',
    'Non existent account'
  );
  assert(!nonExistentAttempt.success, 'Non-existent corporate user rejected');
  assert(
    nonExistentAttempt.message?.includes('No active officer account registered'),
    'Diagnostic message indicating user account not found in directory'
  );

  console.log('\n--- 6. Step-Up Password Verification & Remaining Trials Feedback ---');
  const enrolledUserEmail = `enrolled_pw_${Date.now()}@oromiabank.com`;
  const regUser = userService.register({
    email: enrolledUserEmail,
    name: 'Password Test Officer',
    role: 'MAKER',
    department: 'Credit Operations',
    employeeId: `EMP_PW_${Date.now()}`,
  });
  if (regUser.user) userService.updateUserStatus(regUser.user.id, 'ACTIVE', 'Super Admin');
  const pwFaceCh = biometricService.createChallenge(enrolledUserEmail, 'FACE', 'REGISTRATION');
  biometricService.enrollFaceBiometric(enrolledUserEmail, pwFaceCh.id, 'face_optical_130_130_130_lum_130');

  // Attempt 1 with wrong password
  const badPw1 = biometricService.requestReset(enrolledUserEmail, 'FACE', 'wrong_password_1', 'Trial 1');
  assert(!badPw1.success, 'Invalid password attempt 1 rejected');
  assert(badPw1.remainingAttempts === 4, 'Remaining acceptable trials correctly reported as 4');
  assert(badPw1.message?.includes('4 trial(s) remaining'), 'Error notification contains remaining trials');

  // Attempt 2 with wrong password
  const badPw2 = biometricService.requestReset(enrolledUserEmail, 'FACE', 'wrong_password_2', 'Trial 2');
  assert(!badPw2.success, 'Invalid password attempt 2 rejected');
  assert(badPw2.remainingAttempts === 3, 'Remaining acceptable trials correctly reported as 3');

  // Attempt 3 with wrong password
  const badPw3 = biometricService.requestReset(enrolledUserEmail, 'FACE', 'wrong_password_3', 'Trial 3');
  assert(!badPw3.success, 'Invalid password attempt 3 rejected');
  assert(badPw3.remainingAttempts === 2, 'Remaining acceptable trials correctly reported as 2');

  // Attempt 4 with wrong password
  const badPw4 = biometricService.requestReset(enrolledUserEmail, 'FACE', 'wrong_password_4', 'Trial 4');
  assert(!badPw4.success, 'Invalid password attempt 4 rejected');
  assert(badPw4.remainingAttempts === 1, 'Remaining acceptable trials correctly reported as 1');

  console.log('\n--- 7. Repetitive Failure Service Denial (Account Lockout) ---');
  // Attempt 5 with wrong password (triggers service denial)
  const badPw5 = biometricService.requestReset(enrolledUserEmail, 'FACE', 'wrong_password_5', 'Trial 5 (Threshold)');
  assert(!badPw5.success, 'Trial 5 strictly rejected');
  assert(badPw5.lockedOut === true, 'Service denial / lockout triggered after 5 repetitive failed trials');
  assert(typeof badPw5.remainingLockoutSec === 'number' && badPw5.remainingLockoutSec > 0, 'Lockout countdown seconds returned');
  assert(badPw5.message?.includes('Service denied'), 'Explicit "Service denied" notification displayed');

  // Subsequent attempt during active service denial is blocked immediately
  const lockedAttempt = biometricService.requestReset(enrolledUserEmail, 'FACE', 'password', 'Attempt during lockout');
  assert(!lockedAttempt.success, 'Attempt during active service denial is rejected even with valid password');
  assert(lockedAttempt.lockedOut === true, 'Locked out status confirmed');
  assert(lockedAttempt.message?.includes('Service denied'), 'Service denial message displayed during lockout');

  console.log('\n--- 8. Service Denial Expiration & Auto-Reset to Default ---');
  // Simulate passage of service denial moment / lockout expiration
  biometricService.resetRateLimit(enrolledUserEmail);
  const defaultRateState = biometricService.checkRateLimit(enrolledUserEmail);
  assert(!defaultRateState.isLocked, 'Rate limit state is no longer locked after reset to default');
  assert(defaultRateState.failedAttempts === 0, 'Failed attempts reset to default (0)');

  // Legitimate user now successfully authenticates with valid credentials
  const validResetReq = biometricService.requestReset(
    enrolledUserEmail,
    'FACE',
    'password',
    'Post-lockout authorized reset'
  );
  assert(validResetReq.success, 'Reset request succeeds after service denial reset to default');
  assert(Boolean(validResetReq.resetToken), 'One-time cryptographic reset token issued');

  // Execute reset with issued token
  const validExec = biometricService.executeReset(enrolledUserEmail, validResetReq.resetToken!);
  assert(validExec.success, 'Biometric reset executes successfully');
  assert(validExec.revokedCount === 1, 'Credential revoked');

  // Token anti-replay protection
  const replayExec = biometricService.executeReset(enrolledUserEmail, validResetReq.resetToken!);
  assert(!replayExec.success, 'Single-use token cannot be re-consumed (anti-replay defense)');

  console.log('\n--- 9. Cross-User IDOR Tampering Prevention ---');
  const otherUserEmail = `target_user_${Date.now()}@oromiabank.com`;
  const regOther = userService.register({
    email: otherUserEmail,
    name: 'Target Officer',
    role: 'MAKER',
    department: 'Credit Operations',
    employeeId: `EMP_OTHER_${Date.now()}`,
  });
  if (regOther.user) userService.updateUserStatus(regOther.user.id, 'ACTIVE', 'Super Admin');
  const otherCh = biometricService.createChallenge(otherUserEmail, 'FACE', 'REGISTRATION');
  const otherEnroll = biometricService.enrollFaceBiometric(otherUserEmail, otherCh.id, 'face_optical_168_172_175_lum_145');
  assert(otherEnroll.success, 'Face enrolled for target user');

  const attackerEmail = `attacker_${Date.now()}@oromiabank.com`;
  const regAttacker = userService.register({
    email: attackerEmail,
    name: 'Malicious Maker',
    role: 'MAKER',
    department: 'Credit Operations',
    employeeId: `EMP_ATT_${Date.now()}`,
  });
  if (regAttacker.user) userService.updateUserStatus(regAttacker.user.id, 'ACTIVE', 'Super Admin');

  const crossUserAttempt = biometricService.requestReset(
    otherUserEmail,
    'FACE',
    'password',
    'Cross-user deletion attempt',
    attackerEmail
  );
  assert(!crossUserAttempt.success, 'Unauthorized cross-user reset attempt strictly blocked (IDOR defense)');
  assert(crossUserAttempt.message?.includes('Cross-user biometric reset unauthorized'), 'Security violation error returned');

  console.log('\n========================================================================');
  console.log('✅ ALL PHASE 19 CONTEXT-AWARE BIOMETRIC RESET TESTS PASSED');
  console.log('========================================================================\n');
}
