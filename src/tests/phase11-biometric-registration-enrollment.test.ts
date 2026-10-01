/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { biometricService, computeProtectedFaceSignature } from '../services/biometricService.ts';
import { userService } from '../services/userService.ts';
import { auditService } from '../services/auditService.ts';
import {
  checkWebAuthnSupport,
  checkCameraSupport,
  getDeviceCapabilities,
} from '../utils/deviceCapabilities.ts';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

export async function runPhase11BiometricRegistrationEnrollmentTests() {
  console.log('\n========================================================================');
  console.log('--- PHASE 11: BIOMETRIC REGISTRATION & ENROLLMENT (GENUINE E2E) TESTS ---');
  console.log('========================================================================');

  // Reset seed data for isolated, repeatable testing
  userService.resetDevelopmentSeedData();

  const officerA = userService.getByEmail('abebe.kebede@oromiabank.com')!;
  const officerB = userService.getByEmail('chala.desta@oromiabank.com')!;
  assert(Boolean(officerA), 'Officer A (abebe.kebede@oromiabank.com) loaded');
  assert(Boolean(officerB), 'Officer B (chala.desta@oromiabank.com) loaded');

  // =========================================================================
  // TEST SUITE 1: Method Independence (Fingerprint vs Face ID)
  // =========================================================================
  console.log('\n--- 1. Biometric Method Independence & Segregation ---');

  // 1a. User starts with 0 enrolled biometrics
  const initialStateA = biometricService.getBiometricUserState(officerA.email);
  assert(initialStateA.fingerprintState === 'NOT_ENROLLED', 'Officer A fingerprint state begins NOT_ENROLLED');
  assert(initialStateA.faceState === 'NOT_ENROLLED', 'Officer A face state begins NOT_ENROLLED');
  assert(initialStateA.credentials.length === 0, 'No credentials before enrollment');

  // 1b. Enroll Fingerprint only
  const fpChallenge = biometricService.createChallenge(officerA.email, 'FINGERPRINT', 'REGISTRATION');
  const fpRegResult = biometricService.verifyWebAuthnRegistration(officerA.email, fpChallenge.id, {
    credentialId: 'cred_fp_test_independence_01',
    publicKeyPem: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----',
    counter: 0,
    deviceLabel: 'Platform Fingerprint Authenticator',
  });
  assert(fpRegResult.success === true, 'Officer A Fingerprint enrolled successfully');

  // Verify independence: Fingerprint is ENROLLED, but Face ID is STILL NOT_ENROLLED
  const stateAfterFp = biometricService.getBiometricUserState(officerA.email);
  assert(stateAfterFp.fingerprintState === 'ENROLLED', 'Officer A fingerprintState is ENROLLED');
  assert(stateAfterFp.faceState === 'NOT_ENROLLED', 'Officer A faceState remains NOT_ENROLLED (Method independence preserved)');
  assert(stateAfterFp.credentials.length === 1, 'Only one credential stored (FINGERPRINT)');

  // 1c. Enroll Face ID independently
  const faceChallenge = biometricService.createChallenge(officerA.email, 'FACE', 'REGISTRATION');
  const faceRegResult = biometricService.enrollFaceBiometric(
    officerA.email,
    faceChallenge.id,
    'face_vector_sample_independent_abebe_42',
    {
      luminance: 125,
      sharpness: 0.88,
      faceCount: 1,
      faceBoxRatio: 0.46,
    },
    {
      motionScore: 0.72,
      spoofProbability: 0.04,
      method: 'TEMPORAL_VARIANCE',
    },
    'Device Optical Face Camera'
  );
  assert(faceRegResult.success === true, 'Officer A Face ID enrolled successfully');

  // Verify coexistence of both independent methods
  const stateAfterBoth = biometricService.getBiometricUserState(officerA.email);
  assert(stateAfterBoth.fingerprintState === 'ENROLLED', 'Fingerprint remains ENROLLED');
  assert(stateAfterBoth.faceState === 'ENROLLED', 'Face ID is now ENROLLED');
  assert(stateAfterBoth.credentials.length === 2, 'Both credentials coexist independently under Officer A');

  // 1d. Independent Revocation / Suspension: Suspending Face ID does NOT affect Fingerprint
  const faceCredId = stateAfterBoth.credentials.find((c) => c.type === 'FACE')!.credentialId;
  const fpCredId = stateAfterBoth.credentials.find((c) => c.type === 'FINGERPRINT')!.credentialId;

  biometricService.suspendCredential(officerA.email, faceCredId, 'Temporary optical camera lens damage');
  const stateAfterSuspend = biometricService.getBiometricUserState(officerA.email);
  assert(stateAfterSuspend.faceState === 'SUSPENDED', 'Face ID state transitioned to SUSPENDED');
  assert(stateAfterSuspend.fingerprintState === 'ENROLLED', 'Fingerprint state remains fully ACTIVE/ENROLLED');

  // =========================================================================
  // TEST SUITE 2: Device Capability Detection & Truthful Hardware Reporting
  // =========================================================================
  console.log('\n--- 2. Device Capability Detection & Hardware Truthfulness ---');

  const capabilities = await getDeviceCapabilities(officerA.email);
  assert(typeof capabilities.isWebAuthnSupported === 'boolean', 'WebAuthn support evaluated as boolean');
  assert(typeof capabilities.isCameraSupported === 'boolean', 'Camera support evaluated as boolean');
  assert(Boolean(capabilities.preferredMethod), 'Device preferred biometric method determined');

  // Verify that device labels do not claim fake specific hardware models
  assert(
    !capabilities.cameraStatus.label.includes('Logitech Brio 4K'),
    'Camera label does not falsely invent unverified third-party hardware models'
  );
  assert(
    !capabilities.fingerprintStatus.label.includes('SecuGen Hamster Pro 20'),
    'Fingerprint label does not falsely invent unverified peripheral hardware models'
  );

  // =========================================================================
  // TEST SUITE 3: Face ID Enrollment Quality & Liveness Safeguards
  // =========================================================================
  console.log('\n--- 3. Face ID Enrollment Quality Checks & Anti-Spoofing ---');

  // 3a. Rejection: No face detected in frame
  const chQuality1 = biometricService.createChallenge(officerB.email, 'FACE', 'REGISTRATION');
  const noFaceResult = biometricService.enrollFaceBiometric(
    officerB.email,
    chQuality1.id,
    'dummy_vector_empty',
    { faceCount: 0, luminance: 120, sharpness: 0.8 },
    { spoofProbability: 0.05, motionScore: 0.6 }
  );
  assert(noFaceResult.success === false, 'Enrollment rejected when no face detected (faceCount === 0)');
  assert(
    noFaceResult.message?.includes('No face detected') === true,
    'Error message gives actionable guidance: look into camera viewport'
  );

  // 3b. Rejection: Multiple faces detected (anti-impersonation / anti-bystander)
  const chQuality2 = biometricService.createChallenge(officerB.email, 'FACE', 'REGISTRATION');
  const multiFaceResult = biometricService.enrollFaceBiometric(
    officerB.email,
    chQuality2.id,
    'dummy_vector_multi',
    { faceCount: 3, luminance: 120, sharpness: 0.8 },
    { spoofProbability: 0.05, motionScore: 0.6 }
  );
  assert(multiFaceResult.success === false, 'Enrollment rejected when multiple faces detected (faceCount > 1)');
  assert(
    multiFaceResult.message?.includes('Multiple faces') === true,
    'Security error explicitly reports multiple faces'
  );

  // 3c. Rejection: Severe underexposure / too dark
  const chQuality3 = biometricService.createChallenge(officerB.email, 'FACE', 'REGISTRATION');
  const darkResult = biometricService.enrollFaceBiometric(
    officerB.email,
    chQuality3.id,
    'dummy_vector_dark',
    { faceCount: 1, luminance: 20, sharpness: 0.8 },
    { spoofProbability: 0.05, motionScore: 0.6 }
  );
  assert(darkResult.success === false, 'Enrollment rejected when lighting is too dark (luminance < 35)');
  assert(darkResult.message?.includes('too dark') === true, 'Error message warns about dark illumination');

  // 3d. Rejection: Severe blurriness / out of focus
  const chQuality4 = biometricService.createChallenge(officerB.email, 'FACE', 'REGISTRATION');
  const blurryResult = biometricService.enrollFaceBiometric(
    officerB.email,
    chQuality4.id,
    'dummy_vector_blurry',
    { faceCount: 1, luminance: 120, sharpness: 0.20 },
    { spoofProbability: 0.05, motionScore: 0.6 }
  );
  assert(blurryResult.success === false, 'Enrollment rejected when image is blurry (sharpness < 0.35)');
  assert(blurryResult.message?.includes('blurry') === true, 'Error message instructs to hold steady and wipe lens');

  // 3e. Rejection: Anti-spoofing liveness presentation attack
  const chQuality5 = biometricService.createChallenge(officerB.email, 'FACE', 'REGISTRATION');
  const spoofResult = biometricService.enrollFaceBiometric(
    officerB.email,
    chQuality5.id,
    'dummy_vector_spoof',
    { faceCount: 1, luminance: 120, sharpness: 0.85 },
    { spoofProbability: 0.75, motionScore: 0.05 }
  );
  assert(spoofResult.success === false, 'Enrollment rejected on presentation attack (spoofProbability > 0.40)');
  assert(
    spoofResult.message?.includes('Liveness') === true,
    'Error message clearly reports liveness anti-spoofing failure'
  );

  // 3f. Acceptance: Genuine high-quality live face enrollment
  const chQuality6 = biometricService.createChallenge(officerB.email, 'FACE', 'REGISTRATION');
  const validFaceResult = biometricService.enrollFaceBiometric(
    officerB.email,
    chQuality6.id,
    'face_vector_sample_chala_highres_77',
    { faceCount: 1, luminance: 130, sharpness: 0.85, faceBoxRatio: 0.45 },
    { spoofProbability: 0.05, motionScore: 0.70, method: 'TEMPORAL_VARIANCE' }
  );
  assert(validFaceResult.success === true, 'Genuine high-quality live face enrollment accepted');
  assert(Boolean(validFaceResult.credential?.faceTemplate?.vectorHash), 'Protected non-invertible vector hash stored');
  assert(
    !validFaceResult.credential?.faceTemplate?.vectorHash.includes('chala_highres'),
    'Raw face vector is salted and hashed (never stored in plaintext)'
  );

  // =========================================================================
  // TEST SUITE 4: WebAuthn Platform Authenticator Flow & Safeguards
  // =========================================================================
  console.log('\n--- 4. WebAuthn Fingerprint Registration & Server Verification ---');

  // 4a. Authenticated context binding: non-existent account cannot generate registration options
  let unauthorizedError = false;
  try {
    biometricService.generateWebAuthnRegistrationOptions('unknown.hacker@evil.com');
  } catch (err: any) {
    unauthorizedError = true;
    assert(err.message.includes('Account not found'), 'Registration options rejected for unknown account');
  }
  assert(unauthorizedError, 'Non-existent account blocked from receiving WebAuthn options');

  // 4b. WebAuthn options structure
  const chOptionsB = biometricService.generateWebAuthnRegistrationOptions(officerB.email);
  assert(Boolean(chOptionsB.options.challenge), 'Challenge string provided in registration options');
  assert(chOptionsB.options.user.name === officerB.email, 'User bound correctly in WebAuthn options');
  assert(chOptionsB.options.authenticatorSelection.authenticatorAttachment === 'platform', 'Requires platform authenticator');
  assert(chOptionsB.options.authenticatorSelection.userVerification === 'required', 'Requires user verification (biometric touch)');

  // 4c. Successful WebAuthn registration
  const validWebAuthnCredId = 'webauthn_passkey_chala_real_001';
  const webAuthnReg = biometricService.verifyWebAuthnRegistration(officerB.email, chOptionsB.challengeId, {
    credentialId: validWebAuthnCredId,
    publicKeyPem: '-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE...\n-----END PUBLIC KEY-----',
    counter: 0,
    deviceLabel: 'Windows Hello Biometric Fingerprint Sensor',
  });
  assert(webAuthnReg.success === true, 'Officer B WebAuthn registration succeeds');
  assert(webAuthnReg.credential?.counter === 0, 'Monotonic signature counter initialized to 0');

  // =========================================================================
  // TEST SUITE 5: Cross-Account Isolation & Duplicate Credential Prevention
  // =========================================================================
  console.log('\n--- 5. Cross-Account Isolation & Duplicate Credential Rejection ---');

  // 5a. Cross-account challenge hijacking: Officer A cannot consume Officer B's challenge
  const officerBChallenge = biometricService.createChallenge(officerB.email, 'FINGERPRINT', 'REGISTRATION');
  const hijackAttempt = biometricService.consumeChallenge(
    officerBChallenge.id,
    officerA.email,
    'REGISTRATION',
    'FINGERPRINT'
  );
  assert(hijackAttempt.valid === false, 'Officer A cannot consume Officer B enrollment challenge');
  assert(
    hijackAttempt.error?.includes('does not match') === true,
    'Explicit security violation error on cross-account challenge mismatch'
  );

  // 5b. Duplicate WebAuthn credential ID rejection: Officer A tries to register Officer B's passkey ID
  const chDupFp = biometricService.createChallenge(officerA.email, 'FINGERPRINT', 'REGISTRATION');
  const duplicateFpResult = biometricService.verifyWebAuthnRegistration(officerA.email, chDupFp.id, {
    credentialId: validWebAuthnCredId, // Already owned by Officer B!
    publicKeyPem: '-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE...\n-----END PUBLIC KEY-----',
    counter: 0,
    deviceLabel: 'Attacker Impersonation Key',
  });
  assert(duplicateFpResult.success === false, 'Duplicate WebAuthn credential registration rejected');
  assert(
    duplicateFpResult.message?.includes('already registered to another') === true,
    'Error message reports duplicate credential collision across institutional accounts'
  );

  // 5c. Duplicate Face template signature rejection: Officer A tries to enroll Officer B's exact facial biometric
  const chDupFace = biometricService.createChallenge(officerA.email, 'FACE', 'REGISTRATION');
  const duplicateFaceResult = biometricService.enrollFaceBiometric(
    officerA.email,
    chDupFace.id,
    'face_vector_sample_chala_highres_77', // Same feature vector as Officer B!
    { faceCount: 1, luminance: 130, sharpness: 0.85, faceBoxRatio: 0.45 },
    { spoofProbability: 0.05, motionScore: 0.70 }
  );
  assert(duplicateFaceResult.success === false, 'Duplicate Face biometric enrollment rejected across accounts');
  assert(
    duplicateFaceResult.message?.includes('already enrolled under a different') === true,
    'Error message reports duplicate facial identity violation per NBE standard'
  );

  // =========================================================================
  // TEST SUITE 6: Persistence, Authoritative Audit Trail & Refresh Resilience
  // =========================================================================
  console.log('\n--- 6. Persistence & Audit Trail Verification ---');

  // 6a. Server state persists
  const reloadedStateB = biometricService.getBiometricUserState(officerB.email);
  assert(reloadedStateB.fingerprintState === 'ENROLLED', 'Officer B Fingerprint remains ENROLLED after operations');
  assert(reloadedStateB.faceState === 'ENROLLED', 'Officer B Face ID remains ENROLLED after operations');
  assert(reloadedStateB.credentials.length === 2, 'Both credentials persist in authoritative registry');

  // 6b. Verify audit logging
  const recentAudit = auditService.getAll();
  const enrollAudits = recentAudit.filter(
    (a) => a.action === 'BIOMETRIC_ENROLLED' || a.action === 'BIOMETRIC_ENROLL_REJECTED'
  );
  assert(enrollAudits.length >= 3, 'Audit trail captured all biometric enrollments and security rejections');
  assert(
    enrollAudits.some((a) => a.details.includes('Enrolled WebAuthn Fingerprint passkey')),
    'Audit trail contains WebAuthn Fingerprint enrollment record'
  );
  assert(
    enrollAudits.some((a) => a.details.includes('Enrolled protected Face biometric profile')),
    'Audit trail contains Face ID enrollment record'
  );
  assert(
    enrollAudits.some((a) => a.details.includes('Cross-account')),
    'Audit trail contains cross-account duplicate rejection records'
  );

  console.log('\n========================================================================');
  console.log('✓ ALL PHASE 11 BIOMETRIC REGISTRATION & ENROLLMENT TESTS PASSED');
  console.log('========================================================================\n');
  return { success: true };
}
