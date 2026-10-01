/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { biometricService, computeProtectedFaceSignature } from '../services/biometricService.ts';
import { userService } from '../services/userService.ts';
import { auditService } from '../services/auditService.ts';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

export async function runPhase10BiometricArchitectureSecurityTests() {
  console.log('\n========================================================================');
  console.log('--- PHASE 10: BIOMETRIC ARCHITECTURE & SECURITY FOUNDATION TESTS ---');
  console.log('========================================================================');

  // Reset seed data for test repeatability
  userService.resetDevelopmentSeedData();

  const testOfficerA = userService.getByEmail('abebe.kebede@oromiabank.com')!;
  const testOfficerB = userService.getByEmail('chala.desta@oromiabank.com')!;
  assert(Boolean(testOfficerA), 'Officer A (Maker) loaded from user registry');
  assert(Boolean(testOfficerB), 'Officer B (Checker) loaded from user registry');

  // =========================================================================
  // TEST SUITE 1: Authoritative Lifecycle States & Device Distinction
  // =========================================================================
  console.log('\n--- 1. Authoritative Lifecycle States & Device Boundary ---');

  const stateInitial = biometricService.getBiometricUserState(testOfficerA.email);
  assert(stateInitial.fingerprintState === 'NOT_ENROLLED', 'Initial fingerprint state is NOT_ENROLLED');
  assert(stateInitial.faceState === 'NOT_ENROLLED', 'Initial face state is NOT_ENROLLED');
  assert(stateInitial.credentials.length === 0, 'No active biometric credentials before enrollment');
  assert(stateInitial.rateLimit.isLocked === false, 'Rate limit initial status is not locked');

  // =========================================================================
  // TEST SUITE 2: Cryptographic Challenge Lifecycle & Replay Defense
  // =========================================================================
  console.log('\n--- 2. Cryptographic Challenge Lifecycle & Replay Defense ---');

  // 2a. Challenge generation
  const ch1 = biometricService.createChallenge(testOfficerA.email, 'FINGERPRINT', 'REGISTRATION');
  assert(Boolean(ch1.id), 'Challenge record generated with unique challenge ID');
  assert(typeof ch1.challenge === 'string' && ch1.challenge.length >= 32, 'Cryptographic nonce has >= 32 characters base64url');
  assert(ch1.consumed === false, 'New challenge starts as unconsumed');
  assert(ch1.expiresAt > Date.now(), 'Challenge expiry set in future (60s TTL)');

  // 2b. Single-use consumption
  const consume1 = biometricService.consumeChallenge(ch1.id, testOfficerA.email, 'REGISTRATION', 'FINGERPRINT');
  assert(consume1.valid === true, 'First challenge consumption succeeds');
  assert(consume1.challenge?.consumed === true, 'Challenge marked consumed');

  // 2c. Replay attack rejection
  const consumeReplay = biometricService.consumeChallenge(ch1.id, testOfficerA.email, 'REGISTRATION', 'FINGERPRINT');
  assert(consumeReplay.valid === false, 'Second challenge consumption rejected (replay attack prevention)');
  assert(consumeReplay.error?.includes('already consumed') === true, 'Error message explicitly reports replay detection');

  // 2d. Purpose mismatch rejection
  const chPurpose = biometricService.createChallenge(testOfficerA.email, 'FINGERPRINT', 'REGISTRATION');
  const consumeWrongPurpose = biometricService.consumeChallenge(chPurpose.id, testOfficerA.email, 'AUTHENTICATION', 'FINGERPRINT');
  assert(consumeWrongPurpose.valid === false, 'Challenge rejected when purpose does not match (REGISTRATION vs AUTHENTICATION)');

  // 2e. Biometric type mismatch rejection
  const chType = biometricService.createChallenge(testOfficerA.email, 'FINGERPRINT', 'AUTHENTICATION');
  const consumeWrongType = biometricService.consumeChallenge(chType.id, testOfficerA.email, 'AUTHENTICATION', 'FACE');
  assert(consumeWrongType.valid === false, 'Challenge rejected when biometric type does not match (FINGERPRINT vs FACE)');

  // 2f. Cross-account binding rejection
  const chIdentity = biometricService.createChallenge(testOfficerA.email, 'FINGERPRINT', 'AUTHENTICATION');
  const consumeWrongUser = biometricService.consumeChallenge(chIdentity.id, testOfficerB.email, 'AUTHENTICATION', 'FINGERPRINT');
  assert(consumeWrongUser.valid === false, 'Challenge rejected when consumed by different user (cross-account theft defense)');

  // =========================================================================
  // TEST SUITE 3: WebAuthn / Passkey Platform Registration & Assertion
  // =========================================================================
  console.log('\n--- 3. WebAuthn Passkey Registration & Assertion Verification ---');

  // 3a. Generate WebAuthn registration options
  const regOpts = biometricService.generateWebAuthnRegistrationOptions(testOfficerA.email);
  assert(Boolean(regOpts.options.challenge), 'Registration options contain cryptographic challenge');
  assert(regOpts.options.rp.id === 'localhost', 'Registration options specify RP ID');
  assert(regOpts.options.user.name === testOfficerA.email, 'Registration options bound to user email');
  assert(regOpts.options.pubKeyCredParams.some((p) => p.alg === -7), 'Includes ES256 (-7) algorithm');
  assert(regOpts.options.pubKeyCredParams.some((p) => p.alg === -257), 'Includes RS256 (-257) algorithm');

  // 3b. Verify registration
  const mockCredId = 'webauthn_passkey_cred_9901_abebe';
  const regVerify = biometricService.verifyWebAuthnRegistration(testOfficerA.email, regOpts.challengeId, {
    credentialId: mockCredId,
    publicKeyPem: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----',
    counter: 0,
    deviceLabel: 'MacBook Touch ID Platform Sensor',
  });
  assert(regVerify.success === true, 'WebAuthn passkey registration verified successfully');
  assert(regVerify.credential?.status === 'ENROLLED', 'Credential status transitioned to ENROLLED');
  assert(regVerify.credential?.counter === 0, 'Credential counter initialized to 0');

  // 3c. Verify lifecycle state updated
  const statePostEnroll = biometricService.getBiometricUserState(testOfficerA.email);
  assert(statePostEnroll.fingerprintState === 'ENROLLED', 'Authoritative fingerprint state transitioned to ENROLLED');

  // 3d. Generate WebAuthn authentication options
  const authOpts = biometricService.generateWebAuthnAuthenticationOptions(testOfficerA.email);
  assert(authOpts.options.allowCredentials.length === 1, 'Authentication options allowCredentials has exactly 1 registered passkey');
  assert(authOpts.options.allowCredentials[0].id === mockCredId, 'allowCredentials contains enrolled passkey ID');

  // 3e. Verify assertion with monotonic counter increment
  const authAssertion1 = biometricService.verifyWebAuthnAssertion(testOfficerA.email, authOpts.challengeId, {
    credentialId: mockCredId,
    counter: 1,
  });
  assert(authAssertion1.success === true, 'WebAuthn assertion verified successfully');
  assert(authAssertion1.user?.email === testOfficerA.email, 'Returns authenticated user session');
  assert(authAssertion1.redirectTab === 'MAKER_WORKSPACE', 'Redirects Maker to MAKER_WORKSPACE');

  // 3f. Monotonic counter replay defense
  const authOpts2 = biometricService.generateWebAuthnAuthenticationOptions(testOfficerA.email);
  const authReplayCounter = biometricService.verifyWebAuthnAssertion(testOfficerA.email, authOpts2.challengeId, {
    credentialId: mockCredId,
    counter: 0, // Lower counter than previous counter (1)
  });
  assert(authReplayCounter.success === false, 'Assertion rejected on counter rollback (replay anomaly detected)');

  // =========================================================================
  // TEST SUITE 4: Server-Authoritative Face Engine (Quality, Liveness & Matching)
  // =========================================================================
  console.log('\n--- 4. Server-Authoritative Protected Face Engine ---');

  // 4a. Quality check: Darkness rejection
  const qDark = biometricService.evaluateFaceQuality({ luminance: 20 });
  assert(qDark.isQualityAcceptable === false, 'Rejects dark lighting (< 35)');
  assert(qDark.reasons.some((r) => r.includes('dark')), 'Reason explains lighting is too dark');

  // 4b. Quality check: Blurry image rejection
  const qBlur = biometricService.evaluateFaceQuality({ sharpness: 0.20 });
  assert(qBlur.isQualityAcceptable === false, 'Rejects blurry image (sharpness < 0.35)');

  // 4c. Quality check: Zero face & multiple faces rejection
  const qZero = biometricService.evaluateFaceQuality({ faceCount: 0 });
  assert(qZero.isQualityAcceptable === false, 'Rejects when zero faces detected in viewport');

  const qMulti = biometricService.evaluateFaceQuality({ faceCount: 2 });
  assert(qMulti.isQualityAcceptable === false, 'Rejects when multiple faces (2) detected');

  // 4d. Quality check: Acceptable face framing
  const qGood = biometricService.evaluateFaceQuality({
    luminance: 125,
    sharpness: 0.90,
    faceCount: 1,
    faceBoxRatio: 0.50,
  });
  assert(qGood.isQualityAcceptable === true, 'Accepts compliant face capture');
  assert(qGood.qualityScore > 0.85, 'Calculates composite quality score > 0.85');

  // 4e. Liveness check: Anti-spoofing rejection
  const livenessSpoof = biometricService.evaluateFaceLiveness({ spoofProbability: 0.70 });
  assert(livenessSpoof.livenessVerified === false, 'Rejects presentation spoof with high spoof probability (0.70)');

  const livenessGood = biometricService.evaluateFaceLiveness({ spoofProbability: 0.05, motionScore: 0.60 });
  assert(livenessGood.livenessVerified === true, 'Verifies genuine liveness with high motion and low spoof probability');

  // 4f. Face Enrollment
  const faceCh = biometricService.createChallenge(testOfficerA.email, 'FACE', 'REGISTRATION');
  const testFaceVector = [0.12, -0.45, 0.88, 0.33, -0.19, 0.55];
  const faceReg = biometricService.enrollFaceBiometric(
    testOfficerA.email,
    faceCh.id,
    testFaceVector,
    { luminance: 130, sharpness: 0.88, faceCount: 1, faceBoxRatio: 0.45 },
    { spoofProbability: 0.02, motionScore: 0.70 }
  );
  assert(faceReg.success === true, 'Face recognition profile enrolled with server-side quality & liveness');
  assert(Boolean(faceReg.credential?.faceTemplate?.vectorHash), 'Face template stored as non-invertible salted hash');
  assert(!JSON.stringify(faceReg).includes('data:image'), 'Zero raw camera frames or pixel buffers persisted');

  // 4g. Face Verification: Matching template succeeds
  const faceAuthCh1 = biometricService.createChallenge(testOfficerA.email, 'FACE', 'AUTHENTICATION');
  const faceVerifyGood = biometricService.verifyFaceBiometric({
    email: testOfficerA.email,
    challengeId: faceAuthCh1.id,
    featureVector: testFaceVector,
    qualityMetrics: { luminance: 135, sharpness: 0.85, faceCount: 1 },
    livenessEvidence: { spoofProbability: 0.03, motionScore: 0.65 },
  });
  assert(faceVerifyGood.success === true, 'Server-authoritative Face ID verification succeeds with matching template');
  assert(faceVerifyGood.user?.email === testOfficerA.email, 'Returns authenticated officer session');

  // 4h. Face Verification: Mismatch rejected
  const faceAuthCh2 = biometricService.createChallenge(testOfficerA.email, 'FACE', 'AUTHENTICATION');
  const faceVerifyMismatch = biometricService.verifyFaceBiometric({
    email: testOfficerA.email,
    challengeId: faceAuthCh2.id,
    featureVector: 'wrong_face_vector_mismatch',
    qualityMetrics: { luminance: 135, sharpness: 0.85, faceCount: 1 },
    livenessEvidence: { spoofProbability: 0.03, motionScore: 0.65 },
  });
  assert(faceVerifyMismatch.success === false, 'Server-authoritative Face ID rejects mismatched template');

  // =========================================================================
  // TEST SUITE 5: Credential Ownership & Cross-Account Isolation
  // =========================================================================
  console.log('\n--- 5. Credential Ownership & Cross-Account Isolation ---');

  // Attempt to use Officer A's credential to authenticate Officer B
  const chCross = biometricService.createChallenge(testOfficerB.email, 'FINGERPRINT', 'AUTHENTICATION');
  const crossAttempt = biometricService.verifyWebAuthnAssertion(testOfficerB.email, chCross.id, {
    credentialId: mockCredId, // Belongs to Officer A
  });
  assert(crossAttempt.success === false, 'Cross-account credential theft rejected: Credential not registered to User B');

  // =========================================================================
  // TEST SUITE 6: Rate Limiting & Progressive Lockout (Anti-Brute Force)
  // =========================================================================
  console.log('\n--- 6. Rate Limiting & Progressive Lockout ---');

  const bruteEmail = testOfficerB.email;
  // Trigger 5 consecutive failed attempts
  for (let i = 1; i <= 5; i++) {
    const chFail = biometricService.createChallenge(bruteEmail, 'FINGERPRINT', 'AUTHENTICATION');
    biometricService.verifyWebAuthnAssertion(bruteEmail, chFail.id, {
      credentialId: 'non_existent_fake_cred',
    });
  }

  const rateStatus = biometricService.checkRateLimit(bruteEmail);
  assert(rateStatus.isLocked === true, 'Account locked out after 5 consecutive failures');
  assert(rateStatus.remainingLockoutSec > 800, 'Lockout duration initialized to ~15 minutes (900s)');

  // Attempting authentication while locked out rejects immediately
  const chLocked = biometricService.createChallenge(bruteEmail, 'FINGERPRINT', 'AUTHENTICATION');
  const lockedAttempt = biometricService.verifyWebAuthnAssertion(bruteEmail, chLocked.id, {
    credentialId: 'some_cred',
  });
  assert(lockedAttempt.success === false, 'Authentication blocked while account is locked out');
  assert(lockedAttempt.message?.includes('temporarily locked') === true, 'Error message informs user of lockout');

  // Step-up unlock with invalid password fails
  const wrongUnlock = biometricService.unlockWithStepUp(bruteEmail, 'incorrect_pwd');
  assert(wrongUnlock.success === false, 'Step-up unlock rejected with incorrect password');

  // Step-up unlock with valid password succeeds
  const rightUnlock = biometricService.unlockWithStepUp(bruteEmail, 'password');
  assert(rightUnlock.success === true, 'Step-up unlock succeeds with valid password');
  assert(biometricService.checkRateLimit(bruteEmail).isLocked === false, 'Rate limit lockout cleared after authenticated step-up');

  // =========================================================================
  // TEST SUITE 7: Suspension & Revocation
  // =========================================================================
  console.log('\n--- 7. Credential Suspension & Revocation ---');

  // Suspend credential
  const suspendRes = biometricService.suspendCredential(testOfficerA.email, mockCredId, 'Temporary security hold');
  assert(suspendRes.success === true, 'Credential successfully suspended');

  const stateSuspended = biometricService.getBiometricUserState(testOfficerA.email);
  assert(stateSuspended.fingerprintState === 'SUSPENDED', 'Authoritative state reflects SUSPENDED');

  // Suspended credential fails authentication
  const chSusp = biometricService.createChallenge(testOfficerA.email, 'FINGERPRINT', 'AUTHENTICATION');
  const suspAuth = biometricService.verifyWebAuthnAssertion(testOfficerA.email, chSusp.id, {
    credentialId: mockCredId,
    counter: 5,
  });
  assert(suspAuth.success === false, 'Suspended credential cannot authenticate');
  assert(suspAuth.message?.includes('suspended') === true, 'Error message indicates credential is suspended');

  // Revoke credential
  const revokeRes = biometricService.revokeCredential(testOfficerA.email, mockCredId, 'Officer replaced device');
  assert(revokeRes.success === true, 'Credential successfully revoked');

  const chRev = biometricService.createChallenge(testOfficerA.email, 'FINGERPRINT', 'AUTHENTICATION');
  const revAuth = biometricService.verifyWebAuthnAssertion(testOfficerA.email, chRev.id, {
    credentialId: mockCredId,
    counter: 6,
  });
  assert(revAuth.success === false, 'Revoked credential cannot authenticate');

  // =========================================================================
  // TEST SUITE 8: Step-Up Authenticated Reset & Recovery
  // =========================================================================
  console.log('\n--- 8. Step-Up Authenticated Reset & Recovery ---');

  // Request reset with invalid password fails
  const badReset = biometricService.requestReset(testOfficerA.email, 'ALL', 'wrong_pass', 'Lost phone');
  assert(badReset.success === false, 'Reset request rejected with invalid password');

  // Request reset with valid password succeeds
  const goodReset = biometricService.requestReset(testOfficerA.email, 'ALL', 'password', 'Device reset');
  assert(goodReset.success === true, 'Reset request authorized with step-up password verification');
  assert(Boolean(goodReset.resetToken), 'Issued single-use authorized resetToken');

  // Execute reset with token
  const execReset = biometricService.executeReset(testOfficerA.email, goodReset.resetToken!);
  assert(execReset.success === true, 'Biometric credentials purged and reset');

  // Re-use of consumed reset token fails
  const reuseReset = biometricService.executeReset(testOfficerA.email, goodReset.resetToken!);
  assert(reuseReset.success === false, 'Consumed reset token cannot be reused (replay defense)');

  // Verify state is back to NOT_ENROLLED
  const stateReset = biometricService.getBiometricUserState(testOfficerA.email);
  assert(stateReset.fingerprintState === 'NOT_ENROLLED', 'Fingerprint state returned to NOT_ENROLLED');
  assert(stateReset.faceState === 'NOT_ENROLLED', 'Face state returned to NOT_ENROLLED');
  assert(stateReset.credentials.length === 0, 'Zero credentials remain after reset');

  // =========================================================================
  // TEST SUITE 9: Comprehensive Audit Trail Verification
  // =========================================================================
  console.log('\n--- 9. Security Audit Trail Verification ---');

  const auditLogs = auditService.getLogs(50);
  const bioLogs = auditLogs.filter((l) => l.entityType === 'BIOMETRIC_SECURITY');
  assert(bioLogs.length >= 8, 'Generated comprehensive audit records for all biometric operations');

  const actionsLogged = new Set(bioLogs.map((l) => l.action));
  assert(actionsLogged.has('BIOMETRIC_CHALLENGE_ISSUED'), 'Logged BIOMETRIC_CHALLENGE_ISSUED');
  assert(actionsLogged.has('BIOMETRIC_ENROLLED'), 'Logged BIOMETRIC_ENROLLED');
  assert(actionsLogged.has('BIOMETRIC_AUTH_SUCCESS'), 'Logged BIOMETRIC_AUTH_SUCCESS');
  assert(actionsLogged.has('BIOMETRIC_AUTH_FAILURE'), 'Logged BIOMETRIC_AUTH_FAILURE');
  assert(actionsLogged.has('BIOMETRIC_SUSPENDED'), 'Logged BIOMETRIC_SUSPENDED');
  assert(actionsLogged.has('BIOMETRIC_REVOKED'), 'Logged BIOMETRIC_REVOKED');
  assert(actionsLogged.has('BIOMETRIC_RESET_REQUESTED'), 'Logged BIOMETRIC_RESET_REQUESTED');
  assert(actionsLogged.has('BIOMETRIC_RESET_COMPLETED'), 'Logged BIOMETRIC_RESET_COMPLETED');
  assert(actionsLogged.has('BIOMETRIC_LOCKOUT'), 'Logged BIOMETRIC_LOCKOUT');

  // Verify privacy: No raw camera frames or passwords in audit logs
  for (const log of bioLogs) {
    assert(!log.details.includes('data:image'), 'Audit log contains NO raw camera frames');
    assert(!log.details.includes('password='), 'Audit log contains NO passwords');
  }

  // =========================================================================
  // TEST SUITE 10: Legacy Data Migration Engine
  // =========================================================================
  console.log('\n--- 10. Legacy Data Migration Engine ---');

  // Inject a legacy credential into user account
  const legacyUser = userService.getByEmail('auditor@oromiabank.com')!;
  userService.registerBiometric(legacyUser.email, {
    type: 'FINGERPRINT',
    credentialId: 'legacy_passkey_auditor_001',
    deviceLabel: 'Legacy Auditor Passkey',
    enrolledAt: new Date().toISOString(),
  });

  const migrationResult = biometricService.migrateLegacyCredentials();
  assert(migrationResult.migratedCount >= 1, 'Successfully migrated legacy credentials');

  const auditorState = biometricService.getBiometricUserState(legacyUser.email);
  assert(auditorState.fingerprintState === 'ENROLLED', 'Migrated credential recognized in normalized state machine');
  assert(auditorState.credentials.some((c) => c.credentialId === 'legacy_passkey_auditor_001'), 'Normalized credential retained original credential ID');

  console.log('\n========================================================================');
  console.log('✅ PHASE 10: ALL BIOMETRIC ARCHITECTURE & SECURITY TESTS PASSED CLEANLY');
  console.log('========================================================================\n');
}
