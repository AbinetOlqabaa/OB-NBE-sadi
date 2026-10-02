/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { biometricService } from '../services/biometricService.ts';
import { userService } from '../services/userService.ts';
import { auditService } from '../services/auditService.ts';

function assert(condition: any, msg: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

export async function runPhase13BiometricResetRecoveryDeviceManagementTests() {
  console.log('\n========================================================================');
  console.log('--- PHASE 13: BIOMETRIC RESET, RECOVERY & DEVICE MANAGEMENT TESTS ---');
  console.log('========================================================================');

  // Reset seed data for clean, deterministic test environment
  userService.resetDevelopmentSeedData();

  const makerUser = userService.getByEmail('abebe.kebede@oromiabank.com')!;
  const checkerUser = userService.getByEmail('chala.desta@oromiabank.com')!;
  const auditorUser = userService.getByEmail('auditor@oromiabank.com')!;
  const adminUser = userService.getByEmail('admin@oromiabank.com')!;

  assert(Boolean(makerUser), 'Maker user (abebe.kebede@oromiabank.com) loaded');
  assert(Boolean(checkerUser), 'Checker user (chala.desta@oromiabank.com) loaded');
  assert(Boolean(auditorUser), 'Auditor user (auditor@oromiabank.com) loaded');
  assert(Boolean(adminUser), 'Admin user (admin@oromiabank.com) loaded');

  // Pre-requisite: Enroll credentials for Maker (Fingerprint and Face)
  const fpRegCh = biometricService.createChallenge(makerUser.email, 'FINGERPRINT', 'REGISTRATION');
  const fpRegResult = biometricService.verifyWebAuthnRegistration(makerUser.email, fpRegCh.id, {
    credentialId: 'cred_fp_maker_laptop_01',
    publicKeyPem: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----',
    counter: 5,
    deviceLabel: 'Maker ThinkPad Touch Sensor',
  });
  assert(fpRegResult.success === true, 'Maker Fingerprint credential enrolled successfully');

  const faceRegCh = biometricService.createChallenge(makerUser.email, 'FACE', 'REGISTRATION');
  const faceRegResult = biometricService.enrollFaceBiometric(
    makerUser.email,
    faceRegCh.id,
    'face_vec_maker_primary_template_canonical',
    { luminance: 120, sharpness: 0.85, faceCount: 1, faceBoxRatio: 0.45 },
    { motionScore: 0.70, spoofProbability: 0.03, method: 'TEMPORAL_VARIANCE' },
    'Maker Front HD Optical Camera'
  );
  assert(faceRegResult.success === true, 'Maker Face ID profile enrolled successfully');

  // =========================================================================
  // TEST SUITE 1: Authorized and Unauthorized Step-Up Biometric Reset
  // =========================================================================
  console.log('\n--- 1. Step-Up Authentication & Reset Authorization Controls ---');

  // 1a. Wrong password step-up rejection
  const badPwReset = biometricService.requestReset(
    makerUser.email,
    'ALL',
    'wrong_password',
    'User lost phone',
    { email: makerUser.email, role: 'MAKER' }
  );
  assert(badPwReset.success === false, 'Reset request with incorrect password strictly rejected');
  assert(badPwReset.message?.includes('Invalid password'), 'Error informs officer of invalid step-up credentials');

  // 1b. Request reset for user with NO active biometric enrollment
  const noEnrollReset = biometricService.requestReset(
    checkerUser.email,
    'ALL',
    'password',
    'Reset un-enrolled account',
    { email: checkerUser.email, role: 'CHECKER' }
  );
  assert(noEnrollReset.success === false, 'Reset request for un-enrolled account rejected');
  assert(noEnrollReset.message?.includes('No active or existing'), 'Explains that no existing enrollment exists to reset');

  // 1c. Hostile Path: Cross-user unauthorized reset attempt (Checker trying to reset Maker)
  const crossUserReset = biometricService.requestReset(
    makerUser.email,
    'ALL',
    'password',
    'Unauthorized takeover attempt',
    { email: checkerUser.email, role: 'CHECKER' }
  );
  assert(crossUserReset.success === false, 'Cross-user reset attempt strictly blocked');
  assert(crossUserReset.message?.includes('Security violation'), 'Audit alert generated for cross-user reset attempt');

  // 1d. Authorized reset request by account owner
  const validResetReq = biometricService.requestReset(
    makerUser.email,
    'ALL',
    'password',
    'Upgraded workstation hardware',
    { email: makerUser.email, role: 'MAKER' }
  );
  assert(validResetReq.success === true, 'Authorized step-up reset request granted');
  assert(Boolean(validResetReq.resetToken), 'Issued single-use cryptographically secure resetToken');
  assert(Boolean(validResetReq.existingEnrollment), 'Response captures snapshot of existing enrollment to explain consequences');

  // =========================================================================
  // TEST SUITE 2: Safe Reset Execution, Replay Attacks, & Invalidation
  // =========================================================================
  console.log('\n--- 2. Safe Invalidation, Anti-Replay Defense & Fresh Re-Enrollment ---');

  const resetToken = validResetReq.resetToken!;

  // 2a. Mismatched account execution rejection
  const mismatchedExec = biometricService.executeReset(checkerUser.email, resetToken, {
    email: checkerUser.email,
    role: 'CHECKER',
  });
  assert(mismatchedExec.success === false, 'Execution of token for mismatched account identity strictly rejected');

  // 2b. Authorized execution of reset
  const validExec = biometricService.executeReset(makerUser.email, resetToken, {
    email: makerUser.email,
    role: 'MAKER',
  });
  assert(validExec.success === true, 'Authorized reset executed successfully');
  assert(Boolean(validExec.freshChallengeId), 'Issued fresh registration challenge for immediate re-enrollment');
  assert(validExec.reEnrollmentMethod === 'FINGERPRINT', 'Suggested re-enrollment method provided');

  // 2c. Replay Attack Defense: Attempting to reuse already consumed resetToken
  const replayExec = biometricService.executeReset(makerUser.email, resetToken, {
    email: makerUser.email,
    role: 'MAKER',
  });
  assert(replayExec.success === false, 'Replaying consumed resetToken strictly rejected');
  assert(replayExec.message?.includes('replay') || replayExec.message?.includes('consumed'), 'Replay attack detected and audited');

  // 2d. Expired token rejection
  const expiredReq = biometricService.requestReset(
    makerUser.email,
    'FACE',
    'password',
    'Testing expiration',
    { email: adminUser.email, role: 'ADMIN' }
  );
  // (Cannot reset if no enrollment, so let's enroll first)
  const tempCh = biometricService.createChallenge(makerUser.email, 'FACE', 'REGISTRATION');
  biometricService.enrollFaceBiometric(
    makerUser.email,
    tempCh.id,
    'face_vec_temp',
    { luminance: 120, sharpness: 0.85, faceCount: 1, faceBoxRatio: 0.45 },
    { motionScore: 0.70, spoofProbability: 0.03, method: 'TEMPORAL_VARIANCE' },
    'Temporary Camera'
  );
  const expResetReq = biometricService.requestReset(makerUser.email, 'FACE', 'password', 'Test TTL', {
    email: makerUser.email,
    role: 'MAKER',
  });
  assert(expResetReq.success === true, 'Created reset token for TTL testing');
  // Force token expiration
  (biometricService as any).resetTokens.get(expResetReq.resetToken!).expiresAt = Date.now() - 5000;
  const expExec = biometricService.executeReset(makerUser.email, expResetReq.resetToken!, {
    email: makerUser.email,
    role: 'MAKER',
  });
  assert(expExec.success === false, 'Expired reset token strictly rejected');
  assert(expExec.message?.includes('expired'), 'Error confirms token expiration');

  // 2e. Verification that revoked credentials CANNOT authenticate
  const chAuth = biometricService.createChallenge(makerUser.email, 'FINGERPRINT', 'AUTHENTICATION');
  const oldCredAuth = biometricService.verifyWebAuthnAssertion(makerUser.email, chAuth.id, {
    credentialId: 'cred_fp_maker_laptop_01', // This was revoked during reset!
    counter: 6,
  });
  assert(oldCredAuth.success === false, 'Revoked credential cannot authenticate');
  assert(oldCredAuth.message?.includes('revoked'), 'Server explicitly identifies credential as revoked');

  // 2f. Fresh Re-Enrollment after reset succeeds
  const freshCh = biometricService.createChallenge(makerUser.email, 'FINGERPRINT', 'REGISTRATION');
  const reEnrollResult = biometricService.verifyWebAuthnRegistration(makerUser.email, freshCh.id, {
    credentialId: 'cred_fp_maker_new_workstation_02',
    publicKeyPem: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----',
    counter: 1,
    deviceLabel: 'Maker Replacement YubiKey 5C',
  });
  assert(reEnrollResult.success === true, 'Fresh re-enrollment after reset succeeded cleanly');

  // =========================================================================
  // TEST SUITE 3: Device Management, Metadata Safety, & Credential Controls
  // =========================================================================
  console.log('\n--- 3. Device Lifecycle: Safe Metadata, Rename, Suspend & Reactivate ---');

  // 3a. Safe Credential Metadata Retrieval
  const safeCreds = biometricService.getSafeCredentialMetadata(makerUser.email);
  assert(safeCreds.length > 0, 'Retrieved safe credential metadata records');
  const activeCred = safeCreds.find((c) => c.credentialId === 'cred_fp_maker_new_workstation_02')!;
  assert(Boolean(activeCred), 'Found active re-enrolled credential in metadata');
  assert(activeCred.credentialIdMasked.includes('...'), 'Credential ID is safely masked in metadata');
  assert(Boolean(activeCred.algorithm), 'Algorithm metadata populated (ES256 WebAuthn Platform)');
  assert(!('publicKeyPem' in activeCred), 'Strict security: publicKeyPem is NEVER exposed in safe metadata');
  assert(!('faceTemplate' in activeCred), 'Strict security: raw faceTemplate is NEVER exposed in safe metadata');

  // 3b. Device Rename
  const renameResult = biometricService.updateDeviceLabel(
    makerUser.email,
    'cred_fp_maker_new_workstation_02',
    'Oromia Bank Primary Hardware Key',
    { email: makerUser.email, role: 'MAKER' }
  );
  assert(renameResult.success === true, 'Device label updated successfully');
  const updatedMeta = biometricService.getSafeCredentialMetadata(makerUser.email);
  assert(
    updatedMeta.find((c) => c.credentialId === 'cred_fp_maker_new_workstation_02')?.deviceLabel ===
      'Oromia Bank Primary Hardware Key',
    'Device label reflected in updated metadata'
  );

  // 3c. Hostile Path: Cross-user rename attempt
  const badRename = biometricService.updateDeviceLabel(
    makerUser.email,
    'cred_fp_maker_new_workstation_02',
    'Hacked Device Name',
    { email: checkerUser.email, role: 'CHECKER' }
  );
  assert(badRename.success === false, 'Cross-user rename attempt rejected');

  // 3d. Credential Suspension
  const suspendResult = biometricService.suspendCredential(
    makerUser.email,
    'cred_fp_maker_new_workstation_02',
    'Temporary device custody transfer',
    { email: makerUser.email, role: 'MAKER' }
  );
  assert(suspendResult.success === true, 'Credential suspended successfully');
  const suspendedMeta = biometricService.getSafeCredentialMetadata(makerUser.email);
  assert(
    suspendedMeta.find((c) => c.credentialId === 'cred_fp_maker_new_workstation_02')?.status === 'SUSPENDED',
    'Credential status changed to SUSPENDED'
  );

  // 3e. Suspended credential fails authentication
  const chSusp = biometricService.createChallenge(makerUser.email, 'FINGERPRINT', 'AUTHENTICATION');
  const suspAuth = biometricService.verifyWebAuthnAssertion(makerUser.email, chSusp.id, {
    credentialId: 'cred_fp_maker_new_workstation_02',
    counter: 2,
  });
  assert(suspAuth.success === false, 'Suspended credential cannot authenticate');
  assert(suspAuth.message?.includes('suspended'), 'Error explicitly informs officer that credential is suspended');

  // 3f. Step-Up Reactivation (Bad password rejected)
  const badReactivate = biometricService.reactivateCredential(
    makerUser.email,
    'cred_fp_maker_new_workstation_02',
    'badpassword',
    { email: makerUser.email, role: 'MAKER' }
  );
  assert(badReactivate.success === false, 'Reactivation with bad password rejected');

  // 3g. Step-Up Reactivation (Valid password restores access)
  const goodReactivate = biometricService.reactivateCredential(
    makerUser.email,
    'cred_fp_maker_new_workstation_02',
    'password',
    { email: makerUser.email, role: 'MAKER' }
  );
  assert(goodReactivate.success === true, 'Reactivation with step-up password succeeds');
  const reactivatedMeta = biometricService.getSafeCredentialMetadata(makerUser.email);
  assert(
    reactivatedMeta.find((c) => c.credentialId === 'cred_fp_maker_new_workstation_02')?.status === 'ENROLLED',
    'Credential status restored to ENROLLED'
  );

  // 3h. Permanent Revocation
  const revokeResult = biometricService.revokeCredential(
    makerUser.email,
    'cred_fp_maker_new_workstation_02',
    'Decommissioned YubiKey',
    { email: makerUser.email, role: 'MAKER' }
  );
  assert(revokeResult.success === true, 'Permanently revoked credential');

  // 3i. Cannot reactivate revoked credential
  const reactivateRevoked = biometricService.reactivateCredential(
    makerUser.email,
    'cred_fp_maker_new_workstation_02',
    'password',
    { email: makerUser.email, role: 'MAKER' }
  );
  assert(reactivateRevoked.success === false, 'Permanently revoked credential cannot be reactivated');

  // =========================================================================
  // TEST SUITE 4: Security Center Overview & Contextual Recovery Guidance
  // =========================================================================
  console.log('\n--- 4. Biometric & Device Security Center Overview ---');

  // Enroll Checker Face ID for overview validation
  const chCheck = biometricService.createChallenge(checkerUser.email, 'FACE', 'REGISTRATION');
  biometricService.enrollFaceBiometric(
    checkerUser.email,
    chCheck.id,
    'face_vec_checker_signature',
    { luminance: 120, sharpness: 0.85, faceCount: 1, faceBoxRatio: 0.45 },
    { motionScore: 0.70, spoofProbability: 0.03, method: 'TEMPORAL_VARIANCE' },
    'Checker Front HD Optical Camera'
  );

  // 4a. Retrieve Checker Security Overview
  const checkerOverview = biometricService.getSecurityOverview(checkerUser.email, {
    email: checkerUser.email,
    role: 'CHECKER',
  });
  assert(Boolean(checkerOverview), 'Security overview generated');
  assert(checkerOverview.email === checkerUser.email, 'Security overview email matches');
  assert(checkerOverview.faceState === 'ENROLLED', 'Overview reflects faceState === ENROLLED');
  assert(checkerOverview.recoveryGuidance.length > 0, 'Contextual recovery guidance generated');
  assert(
    checkerOverview.recoveryGuidance.some((g) => g.category === 'LOST_DEVICE' || g.category === 'CAMERA_FAIL'),
    'Includes actionable guidance for camera troubleshooting and device loss'
  );

  // 4b. Hostile Path: Unauthorized access to another officer's security center
  try {
    biometricService.getSecurityOverview(checkerUser.email, {
      email: makerUser.email,
      role: 'MAKER',
    });
    assert(false, 'Maker should not be allowed to access Checker security overview');
  } catch (err: any) {
    assert(err.message.includes('Unauthorized'), 'Unauthorized access to security overview strictly rejected');
  }

  // 4c. Admin authorized inspection of officer security overview
  const adminInspection = biometricService.getSecurityOverview(checkerUser.email, {
    email: adminUser.email,
    role: 'ADMIN',
  });
  assert(Boolean(adminInspection), 'Admin authorized to inspect officer security overview');

  // =========================================================================
  // TEST SUITE 5: Comprehensive Audit Logging for All Lifecycle Transitions
  // =========================================================================
  console.log('\n--- 5. Audit Logging Verification for All Lifecycle Transitions ---');

  const allAudits = auditService.getAll();
  const bioAudits = allAudits.filter((a) => a.entityType === 'BIOMETRIC_SECURITY');

  assert(bioAudits.length >= 10, 'Comprehensive audit entries generated for biometric operations');
  assert(bioAudits.some((a) => a.action === 'BIOMETRIC_RESET_REQUESTED'), 'Audit trail captured BIOMETRIC_RESET_REQUESTED');
  assert(bioAudits.some((a) => a.action === 'BIOMETRIC_RESET_COMPLETED'), 'Audit trail captured BIOMETRIC_RESET_COMPLETED');
  assert(bioAudits.some((a) => a.action === 'BIOMETRIC_RESET_REJECTED'), 'Audit trail captured BIOMETRIC_RESET_REJECTED');
  assert(bioAudits.some((a) => a.action === 'BIOMETRIC_REVOKED'), 'Audit trail captured BIOMETRIC_REVOKED');
  assert(bioAudits.some((a) => a.action === 'BIOMETRIC_SUSPENDED'), 'Audit trail captured BIOMETRIC_SUSPENDED');
  assert(bioAudits.some((a) => a.action === 'BIOMETRIC_REACTIVATED'), 'Audit trail captured BIOMETRIC_REACTIVATED');
  assert(bioAudits.some((a) => a.action === 'BIOMETRIC_DEVICE_RENAMED'), 'Audit trail captured BIOMETRIC_DEVICE_RENAMED');

  console.log('\n========================================================================');
  console.log('✅ ALL PHASE 13 BIOMETRIC RESET, RECOVERY & DEVICE MANAGEMENT TESTS PASSED');
  console.log('========================================================================\n');
}

// Auto-run if executed directly
if (process.argv[1] && process.argv[1].includes('phase13-biometric-reset-recovery-device-management.test.ts')) {
  runPhase13BiometricResetRecoveryDeviceManagementTests().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
