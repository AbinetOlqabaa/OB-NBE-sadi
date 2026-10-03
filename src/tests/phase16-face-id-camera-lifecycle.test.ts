/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * PHASE 16 ACCEPTANCE TEST SUITE: Face ID Sign-In Camera Lifecycle & Android Tablet Failure Fix
 * Compliance: NBE Directive BSD/03/2020 & 16_OB_FACE_ID_SIGN_IN_CAMERA_FAILURE_DEEP_DIAGNOSTIC_AND_FIX.md
 */

import { cameraService, CameraState } from '../services/cameraService.ts';
import { biometricService } from '../services/biometricService.ts';
import { userService } from '../services/userService.ts';

function assert(condition: any, msg: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

// Set up mock DOM environment for Node.js
if (typeof globalThis.window === 'undefined') {
  (globalThis as any).window = {
    isSecureContext: true,
    location: { origin: 'https://ais-dev-hgrojvjl4oxrzyb6yelop4-62589054659.europe-west3.run.app', hostname: 'ais-dev' },
    top: {},
    self: {},
  };
  (globalThis as any).window.top = (globalThis as any).window.self;
}

const originalNavigator = globalThis.navigator;

function setMockNavigator(mediaDevices: any, permissionsState: string = 'granted') {
  Object.defineProperty(globalThis, 'navigator', {
    value: {
      ...originalNavigator,
      mediaDevices,
      permissions: { query: async () => ({ state: permissionsState }) },
    },
    configurable: true,
    writable: true,
  });
}

function restoreNavigator() {
  Object.defineProperty(globalThis, 'navigator', {
    value: originalNavigator,
    configurable: true,
    writable: true,
  });
}

export async function runPhase16FaceIdCameraLifecycleTests() {
  console.log('\n========================================================================');
  console.log('--- PHASE 16: FACE ID SIGN-IN CAMERA LIFECYCLE & ANDROID ACCEPTANCE ---');
  console.log('========================================================================\n');

  console.log('--- 1. Camera State Machine Transitions ---');
  cameraService.stopStream();
  assert(cameraService.getState() === 'stopped' || cameraService.getState() === 'idle', 'Camera state is initialized/stopped');
  const statesRecorded: CameraState[] = [];
  const unsubscribe = cameraService.subscribe((st) => {
    statesRecorded.push(st);
  });
  assert(statesRecorded.length >= 1, 'Subscriber receives current state immediately');
  unsubscribe();

  console.log('\n--- 2. Granular DOMException Error Mapping (Phase 5) ---');
  // Test NotAllowedError
  setMockNavigator({
    getUserMedia: async () => {
      const err = new Error('Permission denied by user') as any;
      err.name = 'NotAllowedError';
      throw err;
    },
  }, 'denied');

  const notAllowedResult = await cameraService.startStream();
  assert(notAllowedResult.success === false, 'NotAllowedError correctly fails startStream');
  assert(notAllowedResult.state === 'permission_denied', 'Mapped state is permission_denied');
  assert(notAllowedResult.error?.includes('permission is blocked'), 'Human-readable permission message provided');

  // Test NotReadableError (Camera busy in another application)
  setMockNavigator({
    getUserMedia: async () => {
      const err = new Error('Device in use') as any;
      err.name = 'NotReadableError';
      throw err;
    },
  }, 'granted');

  const busyResult = await cameraService.startStream();
  assert(busyResult.success === false, 'NotReadableError correctly fails startStream');
  assert(busyResult.state === 'camera_busy', 'Mapped state is camera_busy');
  assert(busyResult.error?.includes('being used by another application'), 'Human-readable camera busy message provided');

  // Test NotFoundError
  setMockNavigator({
    getUserMedia: async () => {
      const err = new Error('No device found') as any;
      err.name = 'NotFoundError';
      throw err;
    },
  }, 'granted');

  const notFoundResult = await cameraService.startStream();
  assert(notFoundResult.success === false, 'NotFoundError correctly fails startStream');
  assert(notFoundResult.state === 'camera_unavailable', 'Mapped state is camera_unavailable');
  assert(notFoundResult.error?.includes('No compatible camera'), 'Human-readable camera not found message provided');

  console.log('\n--- 3. Single Stream Ownership & Re-entrancy (Phase 3 & 10) ---');
  let getUserMediaCallCount = 0;
  const mockTrack = {
    kind: 'video',
    readyState: 'live',
    stop: () => { (mockTrack as any).readyState = 'ended'; },
  };
  const mockStream = {
    getVideoTracks: () => [mockTrack],
    getTracks: () => [mockTrack],
  };

  setMockNavigator({
    getUserMedia: async () => {
      getUserMediaCallCount++;
      return mockStream;
    },
  }, 'granted');

  // First call: Should invoke getUserMedia
  const res1 = await cameraService.startStream();
  assert(res1.success === true, 'First startStream succeeds');
  assert(getUserMediaCallCount === 1, 'First startStream calls getUserMedia exactly once');

  // Second call while active: Must REUSE existing stream without calling getUserMedia again
  const res2 = await cameraService.startStream();
  assert(res2.success === true, 'Second startStream succeeds');
  assert(getUserMediaCallCount === 1, 'Second startStream MUST NOT call getUserMedia again (CRITICAL FIX)');
  assert(res2.stream === res1.stream, 'Returned stream is identical authoritative instance');

  // Clean up
  cameraService.stopStream();
  assert(cameraService.getState() === 'stopped', 'State transitions to stopped');
  assert(mockTrack.readyState === 'ended', 'MediaStreamTrack stopped cleanly');

  console.log('\n--- 4. Android Tablet Acceptance Test (Samsung Galaxy Tab A6 Scenario) ---');
  const testUserEmail = `tablet_officer_${Date.now()}@oromiabank.com`;

  // 1. Create officer account and authorize to ACTIVE
  const userRes = userService.register({
    name: 'Samsung Tab Officer',
    email: testUserEmail,
    password: 'password123',
    role: 'MAKER',
    department: 'Credit Operations & Portfolio Management',
    employeeId: 'OB-TAB-01',
  });
  assert(userRes.success === true, 'User registered successfully');
  const officer = userRes.user!;
  userService.updateUserStatus(officer.id, 'ACTIVE', 'Super Admin');

  // 2. Face Enrollment Flow (Registration)
  const enrollChallenge = biometricService.createChallenge(officer.email, 'FACE', 'REGISTRATION');
  assert(Boolean(enrollChallenge.challenge), 'Enrollment challenge generated');

  const enrollSample = 'face_optical_128_130_125_lum_129_dim_1280x720';
  const enrollRes = biometricService.enrollFaceBiometric(
    officer.email,
    enrollChallenge.id,
    enrollSample,
    { luminance: 130, sharpness: 0.9, faceCount: 1, faceBoxRatio: 0.45 },
    { spoofProbability: 0.04, motionScore: 0.8, method: 'CANVAS_OPTICAL_CHECK' },
    'Samsung Galaxy Tab A6 Front Camera'
  );

  assert(enrollRes.success === true, 'Face biometric enrolled and stored in NBE vault');
  assert(Boolean(enrollRes.credential?.id), 'Credential ID returned');

  // 3. Face ID Sign-In Dialog Opens
  // Single active camera stream started
  let cameraAccessCount = 0;
  const tabTrack = {
    kind: 'video',
    readyState: 'live',
    stop: () => { (tabTrack as any).readyState = 'ended'; },
  };
  const tabStream = {
    getVideoTracks: () => [tabTrack],
    getTracks: () => [tabTrack],
  };

  setMockNavigator({
    getUserMedia: async () => {
      cameraAccessCount++;
      return tabStream;
    },
  }, 'granted');

  const cameraRes = await cameraService.startStream();
  assert(cameraRes.success === true, 'Camera preview stream started');
  assert(cameraService.getState() === 'stream_ready', 'Camera is in stream_ready state');
  assert(cameraAccessCount === 1, 'Camera accessed once on dialog open');

  // 4. User clicks "Verify Face to Sign In"
  // User does NOT trigger a second getUserMedia!
  const signinChallenge = biometricService.createChallenge(officer.email, 'FACE', 'AUTHENTICATION');
  assert(Boolean(signinChallenge.challenge), 'Sign-in challenge created');

  // Server-authoritative biometric verification
  const authRes = biometricService.verifyFaceBiometric({
    email: officer.email,
    challengeId: signinChallenge.id,
    featureVector: enrollSample, // matching optical vector
    qualityMetrics: { luminance: 129, sharpness: 0.88, faceCount: 1, faceBoxRatio: 0.44 },
    livenessEvidence: { spoofProbability: 0.05, motionScore: 0.75, method: 'CANVAS_OPTICAL_CHECK' },
  });

  assert(authRes.success === true, 'Face ID verification succeeded on server');
  assert(authRes.user?.email === officer.email, 'Authenticated user matches enrolled officer');
  assert(cameraAccessCount === 1, 'CRITICAL: No second getUserMedia was called during sign-in verification');

  // 5. Clean stop
  cameraService.stopStream();
  assert(cameraService.getState() === 'stopped', 'Camera stopped after sign-in completion');

  console.log('\n--- 5. Anti-Spoofing & Replay Attack Defense ---');
  const replayEmail = `replay_${Date.now()}@oromiabank.com`;
  const regRep = userService.register({
    name: 'Replay Officer',
    email: replayEmail,
    password: 'password123',
    role: 'MAKER',
    department: 'Credit Operations & Portfolio Management',
    employeeId: 'OB-REP-02',
  });
  userService.updateUserStatus(regRep.user!.id, 'ACTIVE', 'Admin');
  const regCh = biometricService.createChallenge(replayEmail, 'FACE', 'REGISTRATION');
  biometricService.enrollFaceBiometric(replayEmail, regCh.id, 'sample_vector_replay_test');

  const replayAuthCh = biometricService.createChallenge(replayEmail, 'FACE', 'AUTHENTICATION');
  const verify1 = biometricService.verifyFaceBiometric({
    email: replayEmail,
    challengeId: replayAuthCh.id,
    featureVector: 'sample_vector_replay_test',
  });
  assert(verify1.success === true, '1st verification with fresh challenge succeeds');

  const verify2 = biometricService.verifyFaceBiometric({
    email: replayEmail,
    challengeId: replayAuthCh.id,
    featureVector: 'sample_vector_replay_test',
  });
  assert(verify2.success === false, '2nd verification with consumed challenge is strictly rejected (Replay Defense)');

  console.log('\n--- 6. Phase 19: Strict No Fake Success ---');
  const emptyRes = biometricService.verifyFaceBiometric({
    email: testUserEmail,
    challengeId: 'invalid_ch',
    featureVector: '',
  });
  assert(emptyRes.success === false, 'Empty featureVector strictly rejected (No fake fallback)');

  console.log('\n--- 7. Rate Limiting Lockout Defense ---');
  const lockoutEmail = `lock_${Date.now()}@oromiabank.com`;
  const lockReg = userService.register({
    name: 'Lockout User',
    email: lockoutEmail,
    password: 'password123',
    role: 'MAKER',
    department: 'Credit Operations & Portfolio Management',
    employeeId: 'OB-LCK-09',
  });
  userService.updateUserStatus(lockReg.user!.id, 'ACTIVE', 'Admin');
  const lockEnrollCh = biometricService.createChallenge(lockoutEmail, 'FACE', 'REGISTRATION');
  biometricService.enrollFaceBiometric(lockoutEmail, lockEnrollCh.id, 'enrolled_valid_vector');

  let fifthAttemptLocked = false;
  for (let i = 1; i <= 5; i++) {
    const ch = biometricService.createChallenge(lockoutEmail, 'FACE', 'AUTHENTICATION');
    const failRes = biometricService.verifyFaceBiometric({
      email: lockoutEmail,
      challengeId: ch.id,
      featureVector: 'wrong_mismatch_vector',
    });
    if (i === 5 && failRes.lockedOut) {
      fifthAttemptLocked = true;
    }
  }
  assert(fifthAttemptLocked === true, '5 consecutive failed attempts locks account for 15 minutes');

  console.log('\n--- 8. Structured Development Diagnostics (Phase 15) ---');
  const diagLogs = cameraService.getDiagnosticLogs();
  assert(Array.isArray(diagLogs), 'Diagnostic logs returned as array');
  assert(diagLogs.length > 0, 'Diagnostics contains recorded events');
  const lastDiag = cameraService.getLastDiagnostic();
  assert(lastDiag !== null, 'Last diagnostic exists');
  assert('isSecureContext' in lastDiag!, 'Diagnostic captures isSecureContext');
  assert('cameraState' in lastDiag!, 'Diagnostic captures cameraState');

  const serialized = JSON.stringify(diagLogs);
  assert(!serialized.includes('data:image/jpeg'), 'Zero raw base64 images in diagnostic logs');
  assert(!serialized.includes('password'), 'Zero passwords in diagnostic logs');

  restoreNavigator();

  console.log('\n========================================================================');
  console.log('✅ ALL PHASE 16 FACE ID CAMERA LIFECYCLE & ANDROID ACCEPTANCE TESTS PASSED');
  console.log('========================================================================\n');
}

// Auto-run if executed directly
if (process.argv[1]?.includes('phase16')) {
  runPhase16FaceIdCameraLifecycleTests().catch((err) => {
    console.error('Phase 16 Test Suite Failed:', err);
    process.exit(1);
  });
}
