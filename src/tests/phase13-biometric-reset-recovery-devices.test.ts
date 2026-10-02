/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { biometricService } from '../services/biometricService.ts';
import { userService } from '../services/userService.ts';
import { auditService } from '../services/auditService.ts';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

export async function runPhase13BiometricResetRecoveryDevicesTests() {
  console.log('\n========================================================================');
  console.log('--- PHASE 13: BIOMETRIC RESET, RECOVERY & DEVICE MANAGEMENT TESTS ---');
  console.log('========================================================================');

  // Reset seed state to pristine baseline
  userService.resetDevelopmentSeedData();

  const officerA = userService.getByEmail('abebe.kebede@oromiabank.com')!; // MAKER
  const officerB = userService.getByEmail('chala.desta@oromiabank.com')!; // CHECKER
  const adminOfficer = userService.getByEmail('admin@oromiabank.com')!; // ADMIN

  assert(Boolean(officerA), 'Officer A (Maker) loaded from registry');
  assert(Boolean(officerB), 'Officer B (Checker) loaded from registry');
  assert(Boolean(adminOfficer), 'Admin Officer loaded from registry');

  // =========================================================================
  // TEST SUITE 1: Face ID Reset with Step-Up Password Verification & Audit
  // =========================================================================
  console.log('\n--- 1. Face ID Reset & Re-Authentication Lifecycle ---');

  // 1a. Enroll Face ID for Officer A
  const faceCh1 = biometricService.createChallenge(officerA.email, 'FACE', 'REGISTRATION');
  const faceVectorA = [0.15, -0.32, 0.77, 0.44, -0.12, 0.68];
  const faceReg = biometricService.enrollFaceBiometric(
    officerA.email,
    faceCh1.id,
    faceVectorA,
    { luminance: 120, sharpness: 0.92, faceCount: 1, faceBoxRatio: 0.45 },
    { spoofProbability: 0.01, motionScore: 0.75 }
  );
  assert(faceReg.success === true, 'Officer A Face ID profile successfully enrolled');

  const stateBeforeReset = biometricService.getBiometricUserState(officerA.email);
  assert(stateBeforeReset.faceState === 'ENROLLED', 'Face state is ENROLLED prior to reset');

  // 1b. Step-up password verification: Incorrect password rejected
  const badPwReset = biometricService.requestReset(
    officerA.email,
    'FACE',
    'wrong_officer_password',
    'Face appearance changed',
    officerA.email
  );
  assert(badPwReset.success === false, 'Reset request strictly rejected on invalid step-up password');
  assert(
    badPwReset.message?.includes('Invalid password') === true,
    'Error message mandates valid step-up password'
  );

  // 1c. Step-up password verification: Valid password authorized
  const goodResetReq = biometricService.requestReset(
    officerA.email,
    'FACE',
    'password',
    'Appearance changed due to new prescription eyewear',
    officerA.email
  );
  assert(goodResetReq.success === true, 'Reset request authorized via step-up re-authentication');
  assert(Boolean(goodResetReq.resetToken), 'Issued single-use cryptographic reset token');
  assert(Boolean(goodResetReq.consequences), 'Returned regulatory explanation of permanent reset consequences');

  // 1d. Execute Authorized Reset
  const execResetResult = biometricService.executeReset(
    officerA.email,
    goodResetReq.resetToken!,
    officerA.email
  );
  assert(execResetResult.success === true, 'Reset execution purged and revoked existing face enrollment');
  assert(execResetResult.canReEnroll === true, 'Account flagged ready for fresh re-enrollment');

  const stateAfterReset = biometricService.getBiometricUserState(officerA.email);
  assert(stateAfterReset.faceState === 'NOT_ENROLLED', 'Face lifecycle state transitioned back to NOT_ENROLLED');

  // 1e. Fresh Re-Enrollment Flow
  const faceChReEnroll = biometricService.createChallenge(officerA.email, 'FACE', 'REGISTRATION');
  const newFaceVectorA = [0.18, -0.30, 0.79, 0.41, -0.10, 0.70];
  const reEnrollResult = biometricService.enrollFaceBiometric(
    officerA.email,
    faceChReEnroll.id,
    newFaceVectorA,
    { luminance: 125, sharpness: 0.90, faceCount: 1 },
    { spoofProbability: 0.02, motionScore: 0.72 }
  );
  assert(reEnrollResult.success === true, 'Fresh Face ID re-enrollment completed successfully after reset');
  const stateReEnrolled = biometricService.getBiometricUserState(officerA.email);
  assert(stateReEnrolled.faceState === 'ENROLLED', 'Face state restored to ENROLLED with new biometric model');

  // =========================================================================
  // TEST SUITE 2: Hostile Attack Vectors, Replay Defense & Stale Token
  // =========================================================================
  console.log('\n--- 2. Hostile Attack Vectors & Replay / Stale Defense ---');

  // 2a. Replay Attack: Re-use of consumed reset token is strictly blocked
  const replayReset = biometricService.executeReset(
    officerA.email,
    goodResetReq.resetToken!,
    officerA.email
  );
  assert(replayReset.success === false, 'Replay of consumed reset token strictly rejected');
  assert(
    replayReset.message?.includes('invalid or has expired') === true,
    'Replay error reports token invalid/expired'
  );

  // 2b. Bogus token attack
  const bogusReset = biometricService.executeReset(officerA.email, 'rst_fake_attacker_nonce_123');
  assert(bogusReset.success === false, 'Bogus reset token rejected');

  // 2c. Resetting unenrolled credential returns clear rejection
  const unenrolledReset = biometricService.requestReset(
    officerB.email,
    'FACE',
    'password',
    'Resetting non-existent face',
    officerB.email
  );
  assert(unenrolledReset.success === false, 'Cannot reset un-enrolled Face ID profile');
  assert(
    unenrolledReset.message?.includes('No enrolled Face ID') === true,
    'Error clarifies no active face profile enrolled to reset'
  );

  // 2d. Progressive Lockout Defense against Brute-Force Password Guessing on Reset
  for (let i = 0; i < 5; i++) {
    biometricService.requestReset(officerA.email, 'FACE', `wrong_pass_${i}`, 'Brute-force test');
  }
  const lockedResetAttempt = biometricService.requestReset(
    officerA.email,
    'FACE',
    'password',
    'Legitimate attempt during lockout'
  );
  assert(lockedResetAttempt.success === false, 'Reset blocked when account is locked from repeated failures');
  assert(
    lockedResetAttempt.message?.includes('locked') === true,
    'Error message reports temporary progressive lockout'
  );

  // Unlock account to continue testing
  const unlockRes = biometricService.unlockWithStepUp(officerA.email, 'password');
  assert(unlockRes.success === true, 'Lockout cleared with valid step-up password');

  // =========================================================================
  // TEST SUITE 3: Cross-User Deletion & IDOR Attack Rejection
  // =========================================================================
  console.log('\n--- 3. Cross-User Deletion & IDOR Rejection ---');

  // 3a. Officer A tries to request reset for Officer B's biometrics
  const idorResetReq = biometricService.requestReset(
    officerB.email,
    'ALL',
    'password',
    'Hostile cross-user purge',
    officerA.email // Non-admin attacker!
  );
  assert(idorResetReq.success === false, 'Cross-user reset request by non-admin actor strictly blocked');
  assert(
    idorResetReq.message?.includes('Cross-user biometric reset unauthorized') === true,
    'Error confirms IDOR security violation rejected'
  );

  // 3b. Token Identity Binding: Token generated for Officer A cannot be executed on Officer B
  const validReqA = biometricService.requestReset(
    officerA.email,
    'FACE',
    'password',
    'Valid reset A',
    officerA.email
  );
  assert(validReqA.success === true, 'Reset token generated for Officer A');

  const tokenHijackExec = biometricService.executeReset(
    officerB.email,
    validReqA.resetToken!,
    officerB.email
  );
  assert(tokenHijackExec.success === false, 'Cross-user execution of reset token strictly rejected');
  assert(
    tokenHijackExec.message?.includes('does not match account identity') === true,
    'Error reports identity mismatch between token and executing account'
  );

  // Clean up unused token
  biometricService.executeReset(officerA.email, validReqA.resetToken!, officerA.email);

  // =========================================================================
  // TEST SUITE 4: Multi-Device WebAuthn Passkey Management
  // =========================================================================
  console.log('\n--- 4. Multi-Device WebAuthn Passkey Management ---');

  // 4a. Enroll Device 1: Primary Workstation Touch ID
  const fpCh1 = biometricService.createChallenge(officerB.email, 'FINGERPRINT', 'REGISTRATION');
  const dev1Result = biometricService.verifyWebAuthnRegistration(officerB.email, fpCh1.id, {
    credentialId: 'passkey_officerB_laptop_touchid',
    publicKeyPem: '-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE...\n-----END PUBLIC KEY-----',
    counter: 0,
    deviceLabel: 'Corporate Workstation MacBook Pro',
    transports: ['internal'],
  });
  assert(dev1Result.success === true, 'Device 1 (MacBook Pro Touch ID) enrolled successfully');

  // 4b. Enroll Device 2: Hardware Security Key (Multi-authenticator support!)
  const fpCh2 = biometricService.createChallenge(officerB.email, 'FINGERPRINT', 'REGISTRATION');
  const dev2Result = biometricService.verifyWebAuthnRegistration(officerB.email, fpCh2.id, {
    credentialId: 'passkey_officerB_yubikey_token',
    publicKeyPem: '-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE...\n-----END PUBLIC KEY-----',
    counter: 0,
    deviceLabel: 'YubiKey 5C NFC Token',
    transports: ['usb', 'nfc'],
  });
  assert(dev2Result.success === true, 'Device 2 (YubiKey 5C Token) enrolled successfully as second authenticator');

  // Verify both devices exist
  const bState = biometricService.getBiometricUserState(officerB.email);
  const fpCreds = bState.credentials.filter((c) => c.type === 'FINGERPRINT');
  assert(fpCreds.length === 2, 'Officer B has exactly 2 registered WebAuthn authenticators');
  assert(fpCreds.every((c) => c.status === 'ENROLLED'), 'Both authenticators are in ENROLLED status');

  // 4c. Authenticate with Device 1
  const authOpts1 = biometricService.generateWebAuthnAuthenticationOptions(officerB.email);
  const authDev1 = biometricService.verifyWebAuthnAssertion(officerB.email, authOpts1.challengeId, {
    credentialId: 'passkey_officerB_laptop_touchid',
    counter: 1,
  });
  assert(authDev1.success === true, 'Authentication succeeds with Device 1 (Touch ID)');

  // 4d. Authenticate with Device 2
  const authOpts2 = biometricService.generateWebAuthnAuthenticationOptions(officerB.email);
  const authDev2 = biometricService.verifyWebAuthnAssertion(officerB.email, authOpts2.challengeId, {
    credentialId: 'passkey_officerB_yubikey_token',
    counter: 1,
  });
  assert(authDev2.success === true, 'Authentication succeeds with Device 2 (YubiKey)');

  // 4e. Rename Device Label
  const renameRes = biometricService.renameDeviceLabel(
    officerB.email,
    'passkey_officerB_yubikey_token',
    'Primary Corporate YubiKey NFC',
    officerB.email
  );
  assert(renameRes.success === true, 'Device 2 renamed successfully');
  assert(
    renameRes.credential?.deviceLabel === 'Primary Corporate YubiKey NFC',
    'Device label updated in credential record'
  );

  // =========================================================================
  // TEST SUITE 5: Individual Passkey Revocation & Selective Lifecycle
  // =========================================================================
  console.log('\n--- 5. Individual Passkey Revocation & Selective Lifecycle ---');

  // 5a. Revoke Device 2 only (User replaces YubiKey)
  const revokeDev2 = biometricService.revokeCredential(
    officerB.email,
    'passkey_officerB_yubikey_token',
    'Officer lost or replaced hardware key',
    officerB.email,
    'password'
  );
  assert(revokeDev2.success === true, 'Device 2 revoked with step-up verification');
  assert(revokeDev2.credential?.status === 'REVOKED', 'Device 2 status set to REVOKED');

  // 5b. Device 1 remains active and ENROLLED
  const bStateAfterDev2Revoke = biometricService.getBiometricUserState(officerB.email);
  assert(bStateAfterDev2Revoke.fingerprintState === 'ENROLLED', 'Account remains ENROLLED via remaining Device 1');
  const activeFp = bStateAfterDev2Revoke.credentials.filter(
    (c) => c.type === 'FINGERPRINT' && c.status === 'ENROLLED'
  );
  assert(activeFp.length === 1, 'Exactly 1 active passkey remains');
  assert(activeFp[0].credentialId === 'passkey_officerB_laptop_touchid', 'Remaining device is Device 1');

  // 5c. Authentication with revoked Device 2 fails
  const authChRev = biometricService.createChallenge(officerB.email, 'FINGERPRINT', 'AUTHENTICATION');
  const authRevokedDev = biometricService.verifyWebAuthnAssertion(officerB.email, authChRev.id, {
    credentialId: 'passkey_officerB_yubikey_token',
    counter: 5,
  });
  assert(authRevokedDev.success === false, 'Authentication with revoked Device 2 strictly rejected');

  // 5d. Authentication with active Device 1 continues to succeed
  const authChActive = biometricService.createChallenge(officerB.email, 'FINGERPRINT', 'AUTHENTICATION');
  const authActiveDev = biometricService.verifyWebAuthnAssertion(officerB.email, authChActive.id, {
    credentialId: 'passkey_officerB_laptop_touchid',
    counter: 2,
  });
  assert(authActiveDev.success === true, 'Authentication with active Device 1 continues to succeed');

  // 5e. Attempting to revoke already-revoked device returns clear error
  const duplicateRevoke = biometricService.revokeCredential(
    officerB.email,
    'passkey_officerB_yubikey_token',
    'Revoking again'
  );
  assert(duplicateRevoke.success === false, 'Duplicate revocation of already revoked device rejected');

  // =========================================================================
  // TEST SUITE 6: Passkey Suspension & Resumption Lifecycle
  // =========================================================================
  console.log('\n--- 6. Passkey Suspension & Resumption Lifecycle ---');

  // 6a. Suspend Device 1 (Temporary hold)
  const suspendRes = biometricService.suspendCredential(
    officerB.email,
    'passkey_officerB_laptop_touchid',
    'Device left in unlocked workstation area'
  );
  assert(suspendRes.success === true, 'Device 1 suspended successfully');

  // 6b. Authentication fails while suspended
  const authChSusp = biometricService.createChallenge(officerB.email, 'FINGERPRINT', 'AUTHENTICATION');
  const authSuspRes = biometricService.verifyWebAuthnAssertion(officerB.email, authChSusp.id, {
    credentialId: 'passkey_officerB_laptop_touchid',
    counter: 3,
  });
  assert(authSuspRes.success === false, 'Authentication rejected while passkey is suspended');

  // 6c. Resume Device 1 with step-up authentication
  const resumeRes = biometricService.resumeCredential(
    officerB.email,
    'passkey_officerB_laptop_touchid',
    'Officer verified possession of workstation',
    officerB.email,
    'password'
  );
  assert(resumeRes.success === true, 'Device 1 resumed and reactivated');

  // 6d. Authentication succeeds again
  const authChResumed = biometricService.createChallenge(officerB.email, 'FINGERPRINT', 'AUTHENTICATION');
  const authResumedRes = biometricService.verifyWebAuthnAssertion(officerB.email, authChResumed.id, {
    credentialId: 'passkey_officerB_laptop_touchid',
    counter: 4,
  });
  assert(authResumedRes.success === true, 'Authentication succeeds after credential resumption');

  // =========================================================================
  // TEST SUITE 7: Concurrency & Race Condition Defense
  // =========================================================================
  console.log('\n--- 7. Concurrency & Race Condition Defense ---');

  // Request a fresh reset token
  const raceReq = biometricService.requestReset(
    officerB.email,
    'ALL',
    'password',
    'Concurrency testing',
    officerB.email
  );
  assert(raceReq.success === true, 'Reset token issued for concurrency test');

  // Execute two simultaneous execution calls with the same token
  const [race1, race2] = await Promise.all([
    Promise.resolve(biometricService.executeReset(officerB.email, raceReq.resetToken!, officerB.email)),
    Promise.resolve(biometricService.executeReset(officerB.email, raceReq.resetToken!, officerB.email)),
  ]);

  const oneSucceeded = (race1.success && !race2.success) || (!race1.success && race2.success);
  assert(oneSucceeded, 'Exactly one concurrent reset execution succeeded; the other was atomically blocked');

  // =========================================================================
  // TEST SUITE 8: Administrative Direct Reset & Lockout Recovery (Supervisor Oversight)
  // =========================================================================
  console.log('\n--- 8. Administrative Direct Reset & Lockout Recovery ---');

  // Enroll hardware token on Officer A to simulate compromised/lost equipment
  const lostCh = biometricService.createChallenge(officerA.email, 'FINGERPRINT', 'REGISTRATION');
  biometricService.verifyWebAuthnRegistration(officerA.email, lostCh.id, {
    credentialId: 'lost_passkey_officerA_laptop',
    deviceLabel: 'Lost Corporate ThinkPad Sensor',
  });

  // Admin initiates emergency reset for an officer with lost hardware
  const adminResetRes = biometricService.adminResetBiometrics(
    adminOfficer.email,
    officerA.email,
    'ALL',
    'Officer lost corporate phone and security token',
    'password' // Admin password
  );
  assert(adminResetRes.success === true, 'Administrative emergency reset completed by Compliance Admin');

  const adminAudits = auditService
    .getLogs(20)
    .filter((l) => l.action === 'BIOMETRIC_RESET_REQUESTED' && l.actorRole === 'ADMIN');
  assert(adminAudits.length >= 1, 'Audit log recorded administrative intervention under supervisor oversight');
  assert(
    adminAudits[0].details.includes('ADMIN OVERRIDE'),
    'Audit record explicitly designates ADMIN OVERRIDE with segregation of duties'
  );

  // Administrative unlock of locked account
  const adminUnlockRes = biometricService.adminUnlockAccount(
    adminOfficer.email,
    officerA.email,
    'Supervisor confirmed employee identity in person'
  );
  assert(adminUnlockRes.success === true, 'Administrative lockout clear completed');

  // =========================================================================
  // TEST SUITE 9: Security Center Telemetry & Safe Metadata Inspection
  // =========================================================================
  console.log('\n--- 9. Security Center Telemetry & Safe Metadata Inspection ---');

  // Re-enroll 1 passkey and 1 face for Officer B to inspect security center payload
  const scChFp = biometricService.createChallenge(officerB.email, 'FINGERPRINT', 'REGISTRATION');
  biometricService.verifyWebAuthnRegistration(officerB.email, scChFp.id, {
    credentialId: 'passkey_security_center_telemetry_001',
    deviceLabel: 'YubiKey 5C NFC Security Key',
    counter: 12,
  });

  const scChFace = biometricService.createChallenge(officerB.email, 'FACE', 'REGISTRATION');
  biometricService.enrollFaceBiometric(
    officerB.email,
    scChFace.id,
    [0.1, 0.2, 0.3, 0.4],
    { luminance: 110, sharpness: 0.88, faceCount: 1 },
    { spoofProbability: 0.01, motionScore: 0.80 }
  );

  const securityCenterData = biometricService.getSecurityCenterDetails(officerB.email);
  assert(Boolean(securityCenterData), 'Generated Security Center details structure');
  assert(securityCenterData?.email === officerB.email, 'Binds to target officer identity');
  assert(securityCenterData?.faceStatus === 'ENROLLED', 'Reports Face ID enrolled');
  assert(securityCenterData?.passkeyStatus === 'ENROLLED', 'Reports Passkey enrolled');
  assert(Boolean(securityCenterData?.devices) && securityCenterData!.devices.length >= 1, 'Includes registered devices list');

  const scDevice = securityCenterData?.devices[0];
  assert(scDevice?.deviceLabel === 'YubiKey 5C NFC Security Key', 'Includes friendly device label');
  assert(scDevice?.counter === 12, 'Includes monotonic counter metadata');
  assert(Boolean(scDevice?.maskedId), 'Includes masked credential ID');
  assert(Boolean(securityCenterData?.recoveryGuidance), 'Includes official NBE recovery guidance');

  // Zero-Secret Leakage Guarantee: Verify zero raw vectors, private keys or passwords exposed
  const serializedSc = JSON.stringify(securityCenterData);
  assert((securityCenterData as any).password === undefined, 'Security Center payload contains zero password field');
  assert(!serializedSc.includes('"password":'), 'Security Center payload contains zero password attribute');
  assert(!serializedSc.includes('privateKey'), 'Security Center payload contains zero private keys');
  assert(!serializedSc.includes('data:image'), 'Security Center payload contains zero raw image data');

  const allBioAudits = auditService.getLogs(50).filter((l) => l.entityType === 'BIOMETRIC_SECURITY');
  for (const log of allBioAudits) {
    assert(!log.details.includes('password='), 'Audit log contains NO raw passwords');
    assert(!log.details.includes('data:image'), 'Audit log contains NO raw camera streams');
  }

  console.log('\n========================================================================');
  console.log('✅ ALL PHASE 13 BIOMETRIC RESET, RECOVERY & DEVICE MANAGEMENT TESTS PASSED');
  console.log('========================================================================\n');
}
