/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { biometricService, computeProtectedFaceSignature } from '../services/biometricService.ts';
import { userService } from '../services/userService.ts';
import { auditService, sanitizeAuditPayload } from '../services/auditService.ts';

function assert(condition: any, msg: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

export async function runPhase14BiometricHardeningPrivacyComplianceTests() {
  console.log('\n========================================================================');
  console.log('--- PHASE 14: BIOMETRIC SERVICE HARDENING, PRIVACY & COMPLIANCE TESTS ---');
  console.log('========================================================================');

  // Reset seed data for isolated, repeatable testing
  userService.resetDevelopmentSeedData();
  biometricService.resetDevelopmentSeedData();

  const makerUser = userService.getByEmail('abebe.kebede@oromiabank.com')!;
  const checkerUser = userService.getByEmail('chala.desta@oromiabank.com')!;
  const auditorUser = userService.getByEmail('auditor@oromiabank.com')!;
  const adminUser = userService.getByEmail('admin@oromiabank.com')!;

  assert(Boolean(makerUser), 'Maker user loaded');
  assert(Boolean(checkerUser), 'Checker user loaded');
  assert(Boolean(auditorUser), 'Auditor user loaded');
  assert(Boolean(adminUser), 'Admin user loaded');

  // =========================================================================
  // TEST SUITE 1: Malformed Inputs & Boundary Validation
  // =========================================================================
  console.log('\n--- 1. Malformed Inputs & Boundary Validation ---');

  // 1a. Negative WebAuthn counter in registration is strictly rejected
  const regCh1 = biometricService.createChallenge(makerUser.email, 'FINGERPRINT', 'REGISTRATION');
  const negRegResult = biometricService.verifyWebAuthnRegistration(makerUser.email, regCh1.id, {
    credentialId: 'cred_fp_test_neg',
    counter: -5,
  });
  assert(negRegResult.success === false, 'Negative counter in WebAuthn registration is rejected');
  assert(negRegResult.message?.includes('Malformed input'), 'Explicit malformed input error returned');

  // 1b. Missing credentialId in WebAuthn registration
  const regCh2 = biometricService.createChallenge(makerUser.email, 'FINGERPRINT', 'REGISTRATION');
  const missingCredResult = biometricService.verifyWebAuthnRegistration(makerUser.email, regCh2.id, {
    credentialId: '',
  });
  assert(missingCredResult.success === false, 'Missing credentialId in registration is rejected');

  // 1c. Empty / whitespace feature vector in Face ID enrollment
  const faceCh1 = biometricService.createChallenge(makerUser.email, 'FACE', 'REGISTRATION');
  const emptyFaceResult = biometricService.enrollFaceBiometric(makerUser.email, faceCh1.id, '   ');
  assert(emptyFaceResult.success === false, 'Whitespace feature vector in face enrollment is rejected');
  assert(emptyFaceResult.message?.includes('Malformed input'), 'Malformed input message returned for empty vector');

  // 1d. Negative counter in WebAuthn assertion
  const authCh1 = biometricService.createChallenge(makerUser.email, 'FINGERPRINT', 'AUTHENTICATION');
  const negAuthResult = biometricService.verifyWebAuthnAssertion(makerUser.email, authCh1.id, {
    credentialId: 'cred_fp_any',
    counter: -1,
  });
  assert(negAuthResult.success === false, 'Negative counter in WebAuthn assertion is rejected');
  assert(negAuthResult.message?.includes('Malformed input'), 'Malformed input error for negative assertion counter');

  // 1e. Empty feature vector in Face ID verification
  const faceAuthCh1 = biometricService.createChallenge(makerUser.email, 'FACE', 'AUTHENTICATION');
  const emptyVerifyResult = biometricService.verifyFaceBiometric({
    email: makerUser.email,
    challengeId: faceAuthCh1.id,
    featureVector: '',
  });
  assert(emptyVerifyResult.success === false, 'Empty feature vector in face verification is rejected');
  assert(emptyVerifyResult.message?.includes('Malformed input'), 'Malformed input error returned');

  // =========================================================================
  // TEST SUITE 2: Replay-Like Requests & Cryptographic Freshness
  // =========================================================================
  console.log('\n--- 2. Replay-Like Requests & Cryptographic Freshness ---');

  // Enroll valid Fingerprint passkey for Maker
  const validFpCh = biometricService.createChallenge(makerUser.email, 'FINGERPRINT', 'REGISTRATION');
  const validFpReg = biometricService.verifyWebAuthnRegistration(makerUser.email, validFpCh.id, {
    credentialId: 'cred_fp_maker_safe',
    counter: 100,
    deviceLabel: 'Oromia Bank Workstation TPM',
  });
  assert(validFpReg.success === true, 'Enrolled valid Fingerprint passkey for Maker');

  // 2a. Replay defense 1: Consumed challenge reuse
  const authOpts = biometricService.generateWebAuthnAuthenticationOptions(makerUser.email);
  const firstAssertion = biometricService.verifyWebAuthnAssertion(makerUser.email, authOpts.challengeId, {
    credentialId: 'cred_fp_maker_safe',
    counter: 101,
  });
  assert(firstAssertion.success === true, 'First presentation of challenge succeeds');

  const replayAssertion = biometricService.verifyWebAuthnAssertion(makerUser.email, authOpts.challengeId, {
    credentialId: 'cred_fp_maker_safe',
    counter: 102,
  });
  assert(replayAssertion.success === false, 'Replay of consumed challenge is strictly rejected');
  assert(replayAssertion.message?.includes('consumed') || replayAssertion.message?.includes('replay'), 'Challenge replay detected');

  // 2b. Replay defense 2: Counter rollback / duplicate assertion counter
  const freshCh = biometricService.createChallenge(makerUser.email, 'FINGERPRINT', 'AUTHENTICATION');
  const rollbackAssertion = biometricService.verifyWebAuthnAssertion(makerUser.email, freshCh.id, {
    credentialId: 'cred_fp_maker_safe',
    counter: 101, // Counter must be strictly > 101
  });
  assert(rollbackAssertion.success === false, 'Counter rollback/repeat is rejected');
  assert(rollbackAssertion.message?.includes('counter anomaly') || rollbackAssertion.message?.includes('replay'), 'Counter anomaly detected');

  // 2c. Replay defense 3: Consumed reset token reuse
  const resetReq = biometricService.requestReset(makerUser.email, 'FINGERPRINT', 'password', 'Test reset', makerUser.email);
  assert(resetReq.success === true && Boolean(resetReq.resetToken), 'Reset request token issued');

  const firstResetExec = biometricService.executeReset(makerUser.email, resetReq.resetToken!, makerUser.email);
  assert(firstResetExec.success === true, 'First execution of reset token succeeds');

  const replayResetExec = biometricService.executeReset(makerUser.email, resetReq.resetToken!, makerUser.email);
  assert(replayResetExec.success === false, 'Replaying consumed reset token is strictly blocked');
  assert(replayResetExec.message?.includes('invalid or has expired'), 'Reset token single-use enforced');

  // =========================================================================
  // TEST SUITE 3: Unauthorized Service Calls, IDOR & Anti-Enumeration
  // =========================================================================
  console.log('\n--- 3. Unauthorized Service Calls, IDOR & Anti-Enumeration ---');

  // 3a. Unauthorized Cross-User Reset (IDOR): Maker attempts to reset Checker's biometrics
  // First enroll biometric for Checker
  const checkerFpCh = biometricService.createChallenge(checkerUser.email, 'FINGERPRINT', 'REGISTRATION');
  biometricService.verifyWebAuthnRegistration(checkerUser.email, checkerFpCh.id, {
    credentialId: 'cred_fp_checker_device',
    counter: 10,
  });

  const unauthorizedReset = biometricService.requestReset(
    checkerUser.email,
    'FINGERPRINT',
    'password',
    'Attacker malicious reset',
    makerUser.email // Actor is Maker, not Checker and not ADMIN
  );
  assert(unauthorizedReset.success === false, 'Unauthorized cross-user reset rejected (IDOR protection)');
  assert(unauthorizedReset.message?.includes('Cross-user biometric reset unauthorized'), 'Explicit cross-user unauthorized message');

  // 3b. Non-admin attempting administrative reset
  const nonAdminReset = biometricService.adminResetBiometrics(
    makerUser.email,
    checkerUser.email,
    'FINGERPRINT',
    'Illegal admin reset attempt',
    'password'
  );
  assert(nonAdminReset.success === false, 'Non-admin cannot invoke administrative reset');
  assert(nonAdminReset.message?.includes('Supervisory administration role required'), 'Admin role enforcement validated');

  // 3c. Non-admin attempting administrative unlock
  const nonAdminUnlock = biometricService.adminUnlockAccount(makerUser.email, checkerUser.email);
  assert(nonAdminUnlock.success === false, 'Non-admin cannot invoke administrative unlock');

  // 3d. Anti-Enumeration: Unknown account vs un-enrolled account
  let nonExistentMsg = '';
  try {
    biometricService.generateWebAuthnAuthenticationOptions('nonexistent.officer@oromiabank.com');
  } catch (err: any) {
    nonExistentMsg = err.message;
  }

  // Maker is currently not enrolled (reset in Suite 2)
  let unEnrolledMsg = '';
  try {
    biometricService.generateWebAuthnAuthenticationOptions(makerUser.email);
  } catch (err: any) {
    unEnrolledMsg = err.message;
  }

  assert(nonExistentMsg.length > 0, 'Throws error for non-existent user');
  assert(unEnrolledMsg.length > 0, 'Throws error for un-enrolled user');
  assert(
    nonExistentMsg === unEnrolledMsg,
    `Error messages are identical to prevent account enumeration: "${nonExistentMsg}"`
  );

  // =========================================================================
  // TEST SUITE 4: Anti-Abuse, Progressive Delay & Lockout
  // =========================================================================
  console.log('\n--- 4. Anti-Abuse, Progressive Delay & Lockout ---');

  // Re-enroll Face for Auditor
  const audFaceCh = biometricService.createChallenge(auditorUser.email, 'FACE', 'REGISTRATION');
  biometricService.enrollFaceBiometric(
    auditorUser.email,
    audFaceCh.id,
    'canonical_auditor_face_vector_123',
    { luminance: 120, sharpness: 0.85, faceCount: 1, faceBoxRatio: 0.45 },
    { motionScore: 0.70, spoofProbability: 0.03, method: 'TEMPORAL_VARIANCE' }
  );

  // Reset rate limits for clean test
  biometricService.unlockWithStepUp(auditorUser.email, 'password');

  // 1st failure: delay = 0
  const f1 = biometricService.recordFailure(auditorUser.email, 'FACE', 'Test fail 1');
  assert(f1.failedAttempts === 1, '1st failure recorded');

  // 2nd failure: delayRequiredMs = 1000
  const f2 = biometricService.recordFailure(auditorUser.email, 'FACE', 'Test fail 2');
  assert(f2.failedAttempts === 2, '2nd failure recorded');
  assert(f2.delayRequiredMs === 1000, 'Progressive delay of 1000ms assigned at 2nd failure');

  // Check rate limit with delay enforcement
  const delayCheck = biometricService.checkRateLimit(auditorUser.email, true);
  assert(delayCheck.isDelayActive === true, 'Progressive delay is active immediately after 2nd failure');
  assert(delayCheck.remainingDelaySec! >= 1, 'Remaining delay is at least 1s');

  // 3rd failure: delayRequiredMs = 2000
  const f3 = biometricService.recordFailure(auditorUser.email, 'FACE', 'Test fail 3');
  assert(f3.failedAttempts === 3 && f3.delayRequiredMs === 2000, 'Progressive delay of 2000ms assigned at 3rd failure');

  // 4th failure: delayRequiredMs = 4000
  const f4 = biometricService.recordFailure(auditorUser.email, 'FACE', 'Test fail 4');
  assert(f4.failedAttempts === 4 && f4.delayRequiredMs === 4000, 'Progressive delay of 4000ms assigned at 4th failure');

  // 5th failure: triggers 15-minute lockout
  const f5 = biometricService.recordFailure(auditorUser.email, 'FACE', 'Test fail 5');
  assert(f5.failedAttempts === 5, '5th failure recorded');
  assert(f5.isLocked === true, '5th failure triggers isLocked === true');
  assert(f5.remainingLockoutSec > 850, 'Lockout duration is approximately 15 minutes (900s)');

  // Subsequent verification attempt is blocked due to lockout
  const lockedCh = biometricService.createChallenge(auditorUser.email, 'FACE', 'AUTHENTICATION');
  const lockedVerify = biometricService.verifyFaceBiometric({
    email: auditorUser.email,
    challengeId: lockedCh.id,
    featureVector: 'canonical_auditor_face_vector_123',
  });
  assert(lockedVerify.success === false && lockedVerify.lockedOut === true, 'Authentication strictly blocked while locked out');

  // Unlock with step-up password
  const stepUpUnlock = biometricService.unlockWithStepUp(auditorUser.email, 'password');
  assert(stepUpUnlock.success === true, 'Authenticated step-up password unlocks account');
  assert(biometricService.checkRateLimit(auditorUser.email).isLocked === false, 'Account unlocked in rate limit state');

  // =========================================================================
  // TEST SUITE 5: Strict Template Matching (No Wildcard Prefix Vulnerability)
  // =========================================================================
  console.log('\n--- 5. Strict Template Matching (Elimination of Insecure Wildcards) ---');

  // Enroll Face profile for Checker with a known canonical vector
  const checkerFaceCh = biometricService.createChallenge(checkerUser.email, 'FACE', 'REGISTRATION');
  const checkerEnroll = biometricService.enrollFaceBiometric(
    checkerUser.email,
    checkerFaceCh.id,
    'checker_true_authorized_facial_features_vector',
    { luminance: 125, sharpness: 0.88, faceCount: 1, faceBoxRatio: 0.45 },
    { motionScore: 0.70, spoofProbability: 0.02, method: 'TEMPORAL_VARIANCE' }
  );
  assert(checkerEnroll.success === true, 'Checker Face ID enrolled with strict template');

  // Case A: Attacker generates a random face signature starting with "face_sig_"
  // In vulnerable code, any string starting with "face_sig_" matched! Now it must be rejected!
  const attackerSignature = `face_sig_attacker_fake_signature_unauthorized_token_${Date.now()}`;
  const chAttack = biometricService.createChallenge(checkerUser.email, 'FACE', 'AUTHENTICATION');
  const attackResult = biometricService.verifyFaceBiometric({
    email: checkerUser.email,
    challengeId: chAttack.id,
    featureVector: attackerSignature,
    qualityMetrics: { luminance: 125, sharpness: 0.88, faceCount: 1, faceBoxRatio: 0.45 },
    livenessEvidence: { motionScore: 0.70, spoofProbability: 0.02, method: 'TEMPORAL_VARIANCE' },
  });
  assert(attackResult.success === false, 'Attacker arbitrary face_sig_ template is strictly rejected');
  assert(
    attackResult.message?.includes('does not match'),
    'Server explicitly reports facial signature template mismatch'
  );

  // Case B: Legitimate officer presents exact enrolled feature vector
  const chLegit = biometricService.createChallenge(checkerUser.email, 'FACE', 'AUTHENTICATION');
  const legitResult = biometricService.verifyFaceBiometric({
    email: checkerUser.email,
    challengeId: chLegit.id,
    featureVector: 'checker_true_authorized_facial_features_vector',
    qualityMetrics: { luminance: 125, sharpness: 0.88, faceCount: 1, faceBoxRatio: 0.45 },
    livenessEvidence: { motionScore: 0.70, spoofProbability: 0.02, method: 'TEMPORAL_VARIANCE' },
  });
  assert(legitResult.success === true, 'Legitimate authorized officer template strictly matches');
  assert(legitResult.authMethod === 'FACE', 'Session records authMethod === "FACE"');

  // =========================================================================
  // TEST SUITE 6: Data Protection & Secret Leakage Prevention in Logging
  // =========================================================================
  console.log('\n--- 6. Data Protection & Secret Leakage Prevention in Logging ---');

  // Test sanitizer unit logic
  const payloadWithSecrets = {
    user: 'maker@oromiabank.com',
    password: 'super_secret_plain_password_123',
    adminPassword: 'admin_master_secret',
    privateKey: '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7...',
    imageBase64: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
    featureVector: [0.12, -0.45, 0.88, 0.92, -0.11, 0.05, 0.33, -0.76, 0.91, 0.02, 0.15, -0.32, 0.55, 0.67, -0.89, 0.12, 0.34, 0.56, 0.78, 0.90, -0.12, -0.34, -0.56, -0.78, 0.11, 0.22, 0.33, 0.44, 0.55, 0.66, 0.77, 0.88, 0.99, -0.99],
  };

  const sanitized = sanitizeAuditPayload(payloadWithSecrets) as any;
  assert(sanitized.password === '[REDACTED_SECRET]', 'Password field scrubbed to [REDACTED_SECRET]');
  assert(sanitized.adminPassword === '[REDACTED_SECRET]', 'Admin password field scrubbed');
  assert(sanitized.privateKey === '[REDACTED_SECRET]', 'Private key field scrubbed');
  assert(sanitized.imageBase64 === '[REDACTED_RAW_FRAME]', 'Raw image buffer scrubbed');
  assert(typeof sanitized.featureVector === 'string' && sanitized.featureVector.includes('PROTECTED'), 'High-dimensional numeric vector scrubbed');

  // Test auditService logging does not persist secrets
  auditService.log({
    actorId: 'test_sec_actor',
    actorName: 'Audit Test Officer',
    actorRole: 'AUDITOR',
    action: 'BIOMETRIC_AUTH_SUCCESS',
    entityType: 'BIOMETRIC_SECURITY',
    entityId: 'OB_TEST_ENTITY',
    correlationId: 'corr_test_sec_123',
    details: 'User authenticated with password=super_secret_unauthorized_leak and data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    newState: { password: 'leak_secret', secret: 'key123' },
  });

  const recentLogs = auditService.getLogs(5);
  const leakedLog = recentLogs.find((l) => l.actorId === 'test_sec_actor');
  assert(Boolean(leakedLog), 'Audit log entry created');
  assert(!leakedLog!.details.includes('super_secret_unauthorized_leak'), 'Details string had plain password scrubbed');
  assert(!leakedLog!.details.includes('iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB'), 'Details string had base64 image redacted');
  assert(leakedLog!.newState.password === '[REDACTED_SECRET]', 'Log newState password redacted');

  // =========================================================================
  // TEST SUITE 7: Privacy Disclosure, Retention Purge & Compliance Archive
  // =========================================================================
  console.log('\n--- 7. Privacy Disclosure, Retention Purge & Compliance Archive ---');

  // 7a. Privacy disclosure integrity
  const disclosure = biometricService.getPrivacyDisclosure();
  assert(Boolean(disclosure.version), 'Privacy disclosure has version');
  assert(disclosure.statutoryStandard.includes('NBE Directive BSD/03/2020'), 'Disclosure cites NBE BSD/03/2020 standard');
  assert(disclosure.dataCollection.collectedArtifacts.length >= 3, 'Discloses collected artifacts');
  assert(disclosure.dataCollection.prohibitedArtifacts.length >= 3, 'Discloses prohibited artifacts');
  assert(Boolean(disclosure.technicalLimitations.lightingThresholds), 'Discloses ambient lighting limitations');
  assert(Boolean(disclosure.technicalLimitations.livenessAssurance), 'Discloses liveness boundaries');

  // 7b. Service health boundary metrics
  const health = biometricService.getServiceHealth();
  assert(health.status === 'HEALTHY', 'Service health is HEALTHY');
  assert(health.serviceName === 'OromiaBank-Biometric-Auth-Service', 'Service name matches specification');
  assert(health.cryptographicEngine.hashingAlgorithm === 'SALTED-SHA256-HMAC', 'Cryptographic engine uses SALTED-SHA256-HMAC');
  assert(health.serviceBoundary.antiReplayMonotonicCounters === true, 'Anti-replay monotonic counters active');
  assert(health.serviceBoundary.dataSanitizationActive === true, 'Data sanitization active');

  // 7c. Retention rules enforcement & challenge purge
  const purgeResult = biometricService.enforceRetentionRules();
  assert(typeof purgeResult.purgedChallenges === 'number', 'Purged expired challenges');
  assert(typeof purgeResult.purgedResetTokens === 'number', 'Purged expired reset tokens');

  // 7d. Compliance archive export
  const archive = biometricService.exportComplianceArchive(auditorUser.email, checkerUser.email);
  assert(Boolean(archive.exportId), 'Export archive ID generated');
  assert(archive.requestedBy === auditorUser.email, 'Archive records requester email');
  assert(archive.targetAccount === checkerUser.email, 'Archive targets checker email');
  assert(Boolean(archive.checksum), 'Archive includes cryptographic verification checksum');

  // Non-auditor / Non-admin cannot export compliance archive of another officer
  try {
    biometricService.exportComplianceArchive(makerUser.email, checkerUser.email);
    assert(false, 'Maker should not be able to export Checker compliance archive');
  } catch (err: any) {
    assert(err.message.includes('Auditor or Admin role required'), 'Role restriction enforced on compliance export');
  }

  // =========================================================================
  // TEST SUITE 8: Lifecycle Consistency
  // =========================================================================
  console.log('\n--- 8. Lifecycle Consistency Transitions ---');

  // Re-enroll Maker passkey
  const fpChLife = biometricService.createChallenge(makerUser.email, 'FINGERPRINT', 'REGISTRATION');
  biometricService.verifyWebAuthnRegistration(makerUser.email, fpChLife.id, {
    credentialId: 'cred_fp_life_01',
    counter: 50,
    deviceLabel: 'Office Desktop Touch ID',
  });

  const state1 = biometricService.getBiometricUserState(makerUser.email);
  assert(state1.fingerprintState === 'ENROLLED', 'Initial state is ENROLLED');

  // Suspend
  biometricService.suspendCredential(makerUser.email, 'cred_fp_life_01', 'Temporary leave of absence');
  const state2 = biometricService.getBiometricUserState(makerUser.email);
  assert(state2.fingerprintState === 'SUSPENDED', 'State transitions to SUSPENDED');

  // Suspended cannot authenticate
  const chSusp = biometricService.createChallenge(makerUser.email, 'FINGERPRINT', 'AUTHENTICATION');
  const suspAuth = biometricService.verifyWebAuthnAssertion(makerUser.email, chSusp.id, {
    credentialId: 'cred_fp_life_01',
    counter: 51,
  });
  assert(suspAuth.success === false, 'Suspended credential cannot authenticate');
  assert(suspAuth.message?.includes('suspended'), 'Error explicitly notes suspended credential');

  // Resume
  biometricService.resumeCredential(makerUser.email, 'cred_fp_life_01', 'Returned from leave');
  const state3 = biometricService.getBiometricUserState(makerUser.email);
  assert(state3.fingerprintState === 'ENROLLED', 'State transitions back to ENROLLED');

  // Revoke
  biometricService.revokeCredential(makerUser.email, 'cred_fp_life_01', 'Hardware decommissioned');
  const state4 = biometricService.getBiometricUserState(makerUser.email);
  assert(state4.fingerprintState === 'NOT_ENROLLED' || state4.fingerprintState === 'REVOKED', 'State transitions to REVOKED');

  // Revoked cannot authenticate
  const chRev = biometricService.createChallenge(makerUser.email, 'FINGERPRINT', 'AUTHENTICATION');
  const revAuth = biometricService.verifyWebAuthnAssertion(makerUser.email, chRev.id, {
    credentialId: 'cred_fp_life_01',
    counter: 52,
  });
  assert(revAuth.success === false, 'Revoked credential cannot authenticate');

  // Clear rate limits
  biometricService.unlockWithStepUp(makerUser.email, 'password');

  // =========================================================================
  // TEST SUITE 9: Standard Password Authentication Regression Test
  // =========================================================================
  console.log('\n--- 9. Standard Password Authentication Regression Test ---');

  const standardRoles = [
    { email: 'admin@oromiabank.com', expectedTab: 'ADMIN_DASHBOARD', role: 'ADMIN' },
    { email: 'abebe.kebede@oromiabank.com', expectedTab: 'MAKER_WORKSPACE', role: 'MAKER' },
    { email: 'chala.desta@oromiabank.com', expectedTab: 'CHECKER_INBOX', role: 'CHECKER' },
    { email: 'auditor@oromiabank.com', expectedTab: 'AUDITOR_DASHBOARD', role: 'AUDITOR' },
  ];

  for (const { email, expectedTab, role } of standardRoles) {
    const loginRes = userService.login(email, 'password');
    assert(loginRes.success === true, `Password login succeeds for ${role} (${email})`);
    assert(loginRes.redirectTab === expectedTab, `${role} redirects to ${expectedTab}`);
    assert(loginRes.authMethod === 'PASSWORD', `${role} tagged with authMethod === 'PASSWORD'`);
    assert(Boolean(loginRes.sessionToken), `${role} sessionToken issued`);
    assert(loginRes.user?.role === role, `${role} role matches in session`);
  }

  // Bad password rejected
  const badLogin = userService.login('admin@oromiabank.com', 'wrong_pass');
  assert(badLogin.success === false, 'Bad password rejected in regression test');

  console.log('\n========================================================================');
  console.log('✅ ALL PHASE 14 BIOMETRIC SERVICE HARDENING & COMPLIANCE TESTS PASSED');
  console.log('========================================================================\n');
}

// Auto-run if executed directly
if (process.argv[1] && process.argv[1].includes('phase14-biometric-hardening-privacy-compliance.test.ts')) {
  runPhase14BiometricHardeningPrivacyComplianceTests().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
