/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { biometricService, computeProtectedFaceSignature } from '../services/biometricService.ts';
import { userService } from '../services/userService.ts';
import { auditService } from '../services/auditService.ts';

function assert(condition: any, msg: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

export async function runPhase12BiometricSignInAuthenticationTests() {
  console.log('\n========================================================================');
  console.log('--- PHASE 12: BIOMETRIC SIGN-IN & AUTHORITATIVE AUTHENTICATION TESTS ---');
  console.log('========================================================================');

  // Reset seed data for isolated, repeatable testing
  userService.resetDevelopmentSeedData();

  const makerUser = userService.getByEmail('abebe.kebede@oromiabank.com')!;
  const checkerUser = userService.getByEmail('chala.desta@oromiabank.com')!;
  const auditorUser = userService.getByEmail('auditor@oromiabank.com')!;
  const adminUser = userService.getByEmail('admin@oromiabank.com')!;

  assert(Boolean(makerUser), 'Maker user (abebe.kebede@oromiabank.com) loaded');
  assert(Boolean(checkerUser), 'Checker user (chala.desta@oromiabank.com) loaded');
  assert(Boolean(auditorUser), 'Auditor user (auditor@oromiabank.com) loaded');
  assert(Boolean(adminUser), 'Admin user (admin@oromiabank.com) loaded');

  // =========================================================================
  // TEST SUITE 1: Explicit Method Selection & Separation
  // =========================================================================
  console.log('\n--- 1. Explicit Method Selection & Strict Separation ---');

  // 1a. Password login operates completely independently without invoking biometrics
  const pwdLoginResult = userService.login('abebe.kebede@oromiabank.com', 'password');
  assert(pwdLoginResult.success === true, 'Password login succeeds independently');
  assert(pwdLoginResult.authMethod === 'PASSWORD', 'Password login records authMethod === "PASSWORD"');
  assert(Boolean(pwdLoginResult.sessionToken), 'Password login creates secure sessionToken');
  assert(Boolean(pwdLoginResult.sessionExpiresAt), 'Password login establishes session expiration');
  assert(pwdLoginResult.redirectTab === 'MAKER_WORKSPACE', 'Maker redirects to MAKER_WORKSPACE');

  // 1b. Enroll Fingerprint for Maker
  const fpRegChallenge = biometricService.createChallenge(makerUser.email, 'FINGERPRINT', 'REGISTRATION');
  const fpRegResult = biometricService.verifyWebAuthnRegistration(makerUser.email, fpRegChallenge.id, {
    credentialId: 'cred_fp_maker_01',
    publicKeyPem: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----',
    counter: 10,
    deviceLabel: 'Platform Fingerprint Sensor',
  });
  assert(fpRegResult.success === true, 'Maker Fingerprint credential enrolled');

  // 1c. Enroll Face ID for Maker
  const faceRegChallenge = biometricService.createChallenge(makerUser.email, 'FACE', 'REGISTRATION');
  const faceRegResult = biometricService.enrollFaceBiometric(
    makerUser.email,
    faceRegChallenge.id,
    'face_vec_maker_signature_canonical_vector',
    {
      luminance: 125,
      sharpness: 0.88,
      faceCount: 1,
      faceBoxRatio: 0.46,
    },
    {
      motionScore: 0.75,
      spoofProbability: 0.03,
      method: 'TEMPORAL_VARIANCE',
    },
    'Device Front Optical Camera'
  );
  assert(faceRegResult.success === true, 'Maker Face ID profile enrolled');

  // 1d. Cross-Method Challenge Rejection: Face challenge cannot verify WebAuthn assertion
  const crossFaceCh = biometricService.createChallenge(makerUser.email, 'FACE', 'AUTHENTICATION');
  const crossFpAttempt = biometricService.verifyWebAuthnAssertion(makerUser.email, crossFaceCh.id, {
    credentialId: 'cred_fp_maker_01',
    counter: 11,
  });
  assert(crossFpAttempt.success === false, 'WebAuthn assertion rejected when presented with Face challenge');
  assert(
    crossFpAttempt.message?.includes('Invalid challenge biometric type') || crossFpAttempt.message?.includes('Invalid challenge'),
    'Server explicitly blocks cross-method challenge misuse'
  );

  // 1e. Cross-Method Challenge Rejection: WebAuthn challenge cannot verify Face biometric
  const crossFpCh = biometricService.createChallenge(makerUser.email, 'FINGERPRINT', 'AUTHENTICATION');
  const crossFaceAttempt = biometricService.verifyFaceBiometric({
    email: makerUser.email,
    challengeId: crossFpCh.id,
    featureVector: 'face_vec_maker_signature_canonical_vector',
    qualityMetrics: { luminance: 125, sharpness: 0.88, faceCount: 1, faceBoxRatio: 0.46 },
    livenessEvidence: { motionScore: 0.75, spoofProbability: 0.03, method: 'TEMPORAL_VARIANCE' },
  });
  assert(crossFaceAttempt.success === false, 'Face verification rejected when presented with WebAuthn challenge');

  // =========================================================================
  // TEST SUITE 2: Fingerprint / WebAuthn Authentication Engine
  // =========================================================================
  console.log('\n--- 2. WebAuthn Fingerprint Authentication & Security Safeguards ---');

  // 2a. Valid WebAuthn Authentication
  const authOpts = biometricService.generateWebAuthnAuthenticationOptions(makerUser.email, 'localhost');
  assert(Boolean(authOpts.challengeId), 'WebAuthn options issued with challengeId');
  assert(authOpts.options.allowCredentials.length > 0, 'WebAuthn options include enrolled credential IDs');

  const fpAuthSuccess = biometricService.verifyWebAuthnAssertion(makerUser.email, authOpts.challengeId, {
    credentialId: 'cred_fp_maker_01',
    counter: 12,
  });
  assert(fpAuthSuccess.success === true, 'WebAuthn assertion verified successfully');
  assert(fpAuthSuccess.authMethod === 'FINGERPRINT', 'Session records authMethod === "FINGERPRINT"');
  assert(Boolean(fpAuthSuccess.sessionToken), 'Session token generated for WebAuthn authentication');
  assert(fpAuthSuccess.redirectTab === 'MAKER_WORKSPACE', 'Maker redirected to MAKER_WORKSPACE');

  // 2b. Replay Attack Defense 1: Consumed challenge reuse
  const replayChAttempt = biometricService.verifyWebAuthnAssertion(makerUser.email, authOpts.challengeId, {
    credentialId: 'cred_fp_maker_01',
    counter: 13,
  });
  assert(replayChAttempt.success === false, 'Replaying consumed challenge is strictly rejected');
  assert(replayChAttempt.message?.includes('consumed') || replayChAttempt.message?.includes('replay'), 'Audit logs challenge replay detection');

  // 2c. Replay Attack Defense 2: Monotonic counter rollback / duplicate
  const ch2 = biometricService.createChallenge(makerUser.email, 'FINGERPRINT', 'AUTHENTICATION');
  const counterRollbackAttempt = biometricService.verifyWebAuthnAssertion(makerUser.email, ch2.id, {
    credentialId: 'cred_fp_maker_01',
    counter: 12, // Equal to previous counter (must be strictly greater)
  });
  assert(counterRollbackAttempt.success === false, 'Counter rollback/repeat assertion strictly rejected');
  assert(counterRollbackAttempt.message?.includes('counter anomaly') || counterRollbackAttempt.message?.includes('replay'), 'Counter rollback detected as replay attack');

  // 2d. Unknown / Wrong Credential ID Rejection
  const ch3 = biometricService.createChallenge(makerUser.email, 'FINGERPRINT', 'AUTHENTICATION');
  const wrongCredAttempt = biometricService.verifyWebAuthnAssertion(makerUser.email, ch3.id, {
    credentialId: 'cred_fp_unregistered_attacker_device',
    counter: 99,
  });
  assert(wrongCredAttempt.success === false, 'Unregistered credential ID strictly rejected');

  // 2e. Suspended Credential Rejection
  biometricService.suspendCredential(makerUser.email, 'cred_fp_maker_01', 'Temporary compliance hold');
  const ch4 = biometricService.createChallenge(makerUser.email, 'FINGERPRINT', 'AUTHENTICATION');
  const suspendedAttempt = biometricService.verifyWebAuthnAssertion(makerUser.email, ch4.id, {
    credentialId: 'cred_fp_maker_01',
    counter: 20,
  });
  assert(suspendedAttempt.success === false, 'Suspended credential cannot authenticate');
  assert(suspendedAttempt.message?.includes('suspended'), 'Error explicitly mentions suspended credential');

  // Revoke credential
  biometricService.revokeCredential(makerUser.email, 'cred_fp_maker_01', 'Device decommissioned');
  const ch5 = biometricService.createChallenge(makerUser.email, 'FINGERPRINT', 'AUTHENTICATION');
  const revokedAttempt = biometricService.verifyWebAuthnAssertion(makerUser.email, ch5.id, {
    credentialId: 'cred_fp_maker_01',
    counter: 21,
  });
  assert(revokedAttempt.success === false, 'Revoked credential cannot authenticate');

  // Clean state for next tests
  biometricService.unlockWithStepUp(makerUser.email, 'password');

  // =========================================================================
  // TEST SUITE 3: Server-Authoritative Face ID Authentication Engine
  // =========================================================================
  console.log('\n--- 3. Face ID Optical Quality, Liveness & Protected Template Matching ---');

  // Enroll Checker Face ID
  const checkerFaceCh = biometricService.createChallenge(checkerUser.email, 'FACE', 'REGISTRATION');
  biometricService.enrollFaceBiometric(
    checkerUser.email,
    checkerFaceCh.id,
    'face_vec_checker_canonical_template',
    { luminance: 120, sharpness: 0.85, faceCount: 1, faceBoxRatio: 0.45 },
    { motionScore: 0.70, spoofProbability: 0.04, method: 'TEMPORAL_VARIANCE' },
    'Front HD Camera'
  );

  // 3a. Valid Face Verification
  const faceAuthCh1 = biometricService.createChallenge(checkerUser.email, 'FACE', 'AUTHENTICATION');
  const faceSuccess = biometricService.verifyFaceBiometric({
    email: checkerUser.email,
    challengeId: faceAuthCh1.id,
    featureVector: 'face_vec_checker_canonical_template',
    qualityMetrics: { luminance: 120, sharpness: 0.85, faceCount: 1, faceBoxRatio: 0.45 },
    livenessEvidence: { motionScore: 0.70, spoofProbability: 0.04, method: 'TEMPORAL_VARIANCE' },
  });
  assert(faceSuccess.success === true, 'Face ID verified authoritatively by server');
  assert(faceSuccess.authMethod === 'FACE', 'Session records authMethod === "FACE"');
  assert(Boolean(faceSuccess.sessionToken), 'Session token issued for Face ID login');
  assert(faceSuccess.redirectTab === 'CHECKER_INBOX', 'Checker redirected to CHECKER_INBOX');

  // 3b. Quality Rejection: Low Luminance (< 35)
  const faceAuthCh2 = biometricService.createChallenge(checkerUser.email, 'FACE', 'AUTHENTICATION');
  const darkAttempt = biometricService.verifyFaceBiometric({
    email: checkerUser.email,
    challengeId: faceAuthCh2.id,
    featureVector: 'face_vec_checker_canonical_template',
    qualityMetrics: { luminance: 15, sharpness: 0.85, faceCount: 1, faceBoxRatio: 0.45 },
    livenessEvidence: { motionScore: 0.70, spoofProbability: 0.04, method: 'TEMPORAL_VARIANCE' },
  });
  assert(darkAttempt.success === false, 'Dark environment (luminance 15) strictly rejected');
  assert(darkAttempt.message?.includes('dark'), 'Failure message advises user regarding dark lighting');

  // 3c. Quality Rejection: Blur / Low Sharpness (< 0.35)
  const faceAuthCh3 = biometricService.createChallenge(checkerUser.email, 'FACE', 'AUTHENTICATION');
  const blurryAttempt = biometricService.verifyFaceBiometric({
    email: checkerUser.email,
    challengeId: faceAuthCh3.id,
    featureVector: 'face_vec_checker_canonical_template',
    qualityMetrics: { luminance: 120, sharpness: 0.20, faceCount: 1, faceBoxRatio: 0.45 },
    livenessEvidence: { motionScore: 0.70, spoofProbability: 0.04, method: 'TEMPORAL_VARIANCE' },
  });
  assert(blurryAttempt.success === false, 'Blurry optical frame (sharpness 0.20) strictly rejected');
  assert(blurryAttempt.message?.includes('blurry'), 'Failure message advises user to hold device steady');

  // 3d. Quality Rejection: Zero Faces Detected (faceCount === 0)
  const faceAuthCh4 = biometricService.createChallenge(checkerUser.email, 'FACE', 'AUTHENTICATION');
  const noFaceAttempt = biometricService.verifyFaceBiometric({
    email: checkerUser.email,
    challengeId: faceAuthCh4.id,
    featureVector: 'face_vec_checker_canonical_template',
    qualityMetrics: { luminance: 120, sharpness: 0.85, faceCount: 0, faceBoxRatio: 0.45 },
    livenessEvidence: { motionScore: 0.70, spoofProbability: 0.04, method: 'TEMPORAL_VARIANCE' },
  });
  assert(noFaceAttempt.success === false, 'Frame without face (faceCount === 0) strictly rejected');

  // 3e. Liveness / Anti-Spoofing Rejection: High Spoof Probability (> 0.15)
  const faceAuthCh5 = biometricService.createChallenge(checkerUser.email, 'FACE', 'AUTHENTICATION');
  const spoofAttempt = biometricService.verifyFaceBiometric({
    email: checkerUser.email,
    challengeId: faceAuthCh5.id,
    featureVector: 'face_vec_checker_canonical_template',
    qualityMetrics: { luminance: 120, sharpness: 0.85, faceCount: 1, faceBoxRatio: 0.45 },
    livenessEvidence: { motionScore: 0.05, spoofProbability: 0.78, method: 'TEMPORAL_VARIANCE' },
  });
  assert(spoofAttempt.success === false, 'Spoof photo attempt (spoofProbability 0.78) strictly rejected');
  assert(spoofAttempt.message?.includes('Liveness check failed'), 'Error explicitly reports liveness failure');

  // 3f. Template Mismatch Rejection
  const faceAuthCh6 = biometricService.createChallenge(checkerUser.email, 'FACE', 'AUTHENTICATION');
  const mismatchAttempt = biometricService.verifyFaceBiometric({
    email: checkerUser.email,
    challengeId: faceAuthCh6.id,
    featureVector: 'face_vec_wrong_unauthorized_person_template',
    qualityMetrics: { luminance: 120, sharpness: 0.85, faceCount: 1, faceBoxRatio: 0.45 },
    livenessEvidence: { motionScore: 0.70, spoofProbability: 0.04, method: 'TEMPORAL_VARIANCE' },
  });
  assert(mismatchAttempt.success === false, 'Mismatched facial signature strictly rejected by server');
  assert(mismatchAttempt.message?.includes('does not match'), 'Error informs officer of signature mismatch');

  // =========================================================================
  // TEST SUITE 4: Rate Limiting, Lockout & Step-Up Password Recovery
  // =========================================================================
  console.log('\n--- 4. Anti-Brute Force Rate Limiting & Step-Up Password Recovery ---');

  // Auditor account for rate limiting test
  const auditorFaceCh = biometricService.createChallenge(auditorUser.email, 'FACE', 'REGISTRATION');
  biometricService.enrollFaceBiometric(
    auditorUser.email,
    auditorFaceCh.id,
    'face_vec_auditor_canonical_signature',
    { luminance: 120, sharpness: 0.85, faceCount: 1, faceBoxRatio: 0.45 },
    { motionScore: 0.70, spoofProbability: 0.04, method: 'TEMPORAL_VARIANCE' },
    'Auditor Laptop Webcam'
  );

  // Trigger 5 consecutive failed attempts to reach lockout
  let lastFailureResult: any = null;
  for (let i = 1; i <= 5; i++) {
    const ch = biometricService.createChallenge(auditorUser.email, 'FACE', 'AUTHENTICATION');
    lastFailureResult = biometricService.verifyFaceBiometric({
      email: auditorUser.email,
      challengeId: ch.id,
      featureVector: `face_vec_wrong_attempt_${i}`,
      qualityMetrics: { luminance: 120, sharpness: 0.85, faceCount: 1, faceBoxRatio: 0.45 },
      livenessEvidence: { motionScore: 0.70, spoofProbability: 0.04, method: 'TEMPORAL_VARIANCE' },
    });
  }

  assert(lastFailureResult.lockedOut === true, '5th failed attempt triggers lockedOut === true');
  const rateLimitState = biometricService.checkRateLimit(auditorUser.email);
  assert(rateLimitState.isLocked === true, 'Rate limit engine marks account locked');
  assert(rateLimitState.remainingLockoutSec > 0, 'Remaining lockout seconds tracked');

  // 6th attempt is instantly blocked before processing
  const chLocked = biometricService.createChallenge(auditorUser.email, 'FACE', 'AUTHENTICATION');
  const blockedAttempt = biometricService.verifyFaceBiometric({
    email: auditorUser.email,
    challengeId: chLocked.id,
    featureVector: 'face_vec_auditor_canonical_signature', // Even correct face is blocked during lockout
    qualityMetrics: { luminance: 120, sharpness: 0.85, faceCount: 1, faceBoxRatio: 0.45 },
    livenessEvidence: { motionScore: 0.70, spoofProbability: 0.04, method: 'TEMPORAL_VARIANCE' },
  });
  assert(blockedAttempt.success === false, 'Locked account is blocked even with valid biometric data');
  assert(blockedAttempt.lockedOut === true, 'Blocked response returns lockedOut === true');
  assert(blockedAttempt.message?.includes('temporarily locked'), 'Message directs user to wait or use password');

  // Step-Up Password Unlock: wrong password rejected
  const badUnlock = biometricService.unlockWithStepUp(auditorUser.email, 'wrong_password');
  assert(badUnlock.success === false, 'Invalid step-up password rejected');
  assert(biometricService.checkRateLimit(auditorUser.email).isLocked === true, 'Account remains locked after bad password');

  // Step-Up Password Unlock: valid password restores access immediately
  const goodUnlock = biometricService.unlockWithStepUp(auditorUser.email, 'password');
  assert(goodUnlock.success === true, 'Valid password clears biometric lockout');
  assert(biometricService.checkRateLimit(auditorUser.email).isLocked === false, 'Account rate limit state reset to clean');

  // Verification immediately succeeds after step-up unlock
  const chPostUnlock = biometricService.createChallenge(auditorUser.email, 'FACE', 'AUTHENTICATION');
  const postUnlockAuth = biometricService.verifyFaceBiometric({
    email: auditorUser.email,
    challengeId: chPostUnlock.id,
    featureVector: 'face_vec_auditor_canonical_signature',
    qualityMetrics: { luminance: 120, sharpness: 0.85, faceCount: 1, faceBoxRatio: 0.45 },
    livenessEvidence: { motionScore: 0.70, spoofProbability: 0.04, method: 'TEMPORAL_VARIANCE' },
  });
  assert(postUnlockAuth.success === true, 'Face ID succeeds immediately following step-up password unlock');
  assert(postUnlockAuth.redirectTab === 'AUDITOR_DASHBOARD', 'Auditor redirected to AUDITOR_DASHBOARD');

  // =========================================================================
  // TEST SUITE 5: Direct API Bypass Defenses & Account Integrity
  // =========================================================================
  console.log('\n--- 5. Direct API Bypass Defenses & Account Integrity Checks ---');

  // 5a. Expired Challenge Rejection (TTL enforcement)
  const expiredCh = biometricService.createChallenge(makerUser.email, 'FACE', 'AUTHENTICATION');
  (expiredCh as any).expiresAt = Date.now() - 5000; // Force challenge expiration
  const expiredAttempt = biometricService.verifyFaceBiometric({
    email: makerUser.email,
    challengeId: expiredCh.id,
    featureVector: 'face_vec_maker_signature_canonical_vector',
    qualityMetrics: { luminance: 125, sharpness: 0.88, faceCount: 1, faceBoxRatio: 0.46 },
    livenessEvidence: { motionScore: 0.75, spoofProbability: 0.03, method: 'TEMPORAL_VARIANCE' },
  });
  assert(expiredAttempt.success === false, 'Expired challenge rejected');
  assert(expiredAttempt.message?.includes('expired') || expiredAttempt.message?.includes('not found'), 'Error specifies challenge expiration');

  // 5b. Account Not Found / Unknown Email Rejection (prevents account enumeration)
  try {
    biometricService.generateWebAuthnAuthenticationOptions('nonexistent.officer@oromiabank.com');
    assert(false, 'Should have thrown error for unknown account');
  } catch (err: any) {
    assert(
      !err.message.includes('password') && !err.message.includes('sql'),
      'Unknown email error does not leak internal database details'
    );
  }

  // 5c. Disabled User Biometric Rejection
  const createRes = userService.createUser({
    name: 'Suspended Staff',
    email: 'suspended.staff@oromiabank.com',
    role: 'MAKER',
    department: 'Trade Services & International Banking',
    password: 'password',
    status: 'DISABLED',
  });
  assert(createRes.success === true, 'Created disabled test user');
  const disabledUser = createRes.user!;

  const disabledCh = biometricService.createChallenge(disabledUser.email, 'FACE', 'AUTHENTICATION');
  const disabledAttempt = biometricService.verifyFaceBiometric({
    email: disabledUser.email,
    challengeId: disabledCh.id,
    featureVector: 'any_signature',
    qualityMetrics: { luminance: 125, sharpness: 0.88, faceCount: 1, faceBoxRatio: 0.46 },
    livenessEvidence: { motionScore: 0.75, spoofProbability: 0.03, method: 'TEMPORAL_VARIANCE' },
  });
  assert(disabledAttempt.success === false, 'Disabled user account blocked from biometric authentication');
  assert(disabledAttempt.message?.includes('disabled'), 'Explicit disabled message returned');

  // =========================================================================
  // TEST SUITE 6: Password Login Regression & Role Redirection
  // =========================================================================
  console.log('\n--- 6. Password Login Regression & Role Redirect Convergence ---');

  // Test password authentication for all four standard banking roles
  const roles = [
    { email: 'admin@oromiabank.com', expectedTab: 'ADMIN_DASHBOARD', role: 'ADMIN' },
    { email: 'abebe.kebede@oromiabank.com', expectedTab: 'MAKER_WORKSPACE', role: 'MAKER' },
    { email: 'chala.desta@oromiabank.com', expectedTab: 'CHECKER_INBOX', role: 'CHECKER' },
    { email: 'auditor@oromiabank.com', expectedTab: 'AUDITOR_DASHBOARD', role: 'AUDITOR' },
  ];

  for (const { email, expectedTab, role } of roles) {
    const res = userService.login(email, 'password');
    assert(res.success === true, `Password login succeeds for ${role} (${email})`);
    assert(res.redirectTab === expectedTab, `${role} redirects to ${expectedTab}`);
    assert(res.authMethod === 'PASSWORD', `${role} session tagged with authMethod === 'PASSWORD'`);
    assert(Boolean(res.sessionToken), `${role} sessionToken issued`);
    assert(res.user?.role === role, `${role} user role correctly populated in session`);
  }

  // Bad password rejected
  const badPwd = userService.login('admin@oromiabank.com', 'wrongpassword');
  assert(badPwd.success === false, 'Incorrect password rejected');

  console.log('\n========================================================================');
  console.log('✅ ALL PHASE 12 BIOMETRIC SIGN-IN & AUTHENTICATION TESTS PASSED CLEANLY');
  console.log('========================================================================\n');
}

// Auto-run if executed directly
if (process.argv[1] && process.argv[1].includes('phase12-biometric-signin-authentication.test.ts')) {
  runPhase12BiometricSignInAuthenticationTests().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
