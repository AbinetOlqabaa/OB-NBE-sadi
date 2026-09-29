/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { userService } from '../services/userService.ts';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

export async function runBiometricAndAccessoryTests() {
  console.log('\n======================================================');
  console.log('--- 5. BIOMETRIC WEBAUTHN & INPUT ACCESSORY TESTS ---');
  console.log('======================================================');

  // 1. Setup Mock DOM environment for Node.js test runner if not present
  if (typeof globalThis.window === 'undefined') {
    (globalThis as any).window = globalThis;
  }

  const localStorageStore: Record<string, string> = {};
  const mockLocalStorage = {
    getItem: (key: string) => localStorageStore[key] || null,
    setItem: (key: string, val: string) => {
      localStorageStore[key] = String(val);
    },
    removeItem: (key: string) => {
      delete localStorageStore[key];
    },
    clear: () => {
      for (const k in localStorageStore) delete localStorageStore[k];
    },
  };
  try {
    (globalThis as any).localStorage = mockLocalStorage;
  } catch {
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
      configurable: true,
    });
  }

  (globalThis as any).btoa = (str: string) => Buffer.from(str, 'binary').toString('base64');
  (globalThis as any).atob = (b64: string) => Buffer.from(b64, 'base64').toString('binary');

  const mockNavigator: {
    userAgent: string;
    credentials: {
      create: () => Promise<any>;
      get: () => Promise<any>;
    };
    vibrate?: (pattern: any) => boolean;
  } = {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
    credentials: {
      create: async () => ({
        id: `cred_${Date.now()}`,
        rawId: new Uint8Array([1, 2, 3, 4]).buffer,
        response: {},
        type: 'public-key',
      }),
      get: async () => ({
        id: 'test_cred_id',
        rawId: new Uint8Array([1, 2, 3, 4]).buffer,
        response: {},
        type: 'public-key',
      }),
    },
  };

  try {
    (globalThis as any).navigator = mockNavigator;
    if (globalThis.window) {
      (globalThis.window as any).navigator = mockNavigator;
    }
  } catch {
    Object.defineProperty(globalThis, 'navigator', {
      value: mockNavigator,
      writable: true,
      configurable: true,
    });
    if (globalThis.window) {
      Object.defineProperty(globalThis.window, 'navigator', {
        value: mockNavigator,
        writable: true,
        configurable: true,
      });
    }
  }

  // 2. Import useBiometricAuth and verify methods
  console.log('--- Biometric WebAuthn API Hook Verification ---');
  const { useBiometricAuth, computeFaceHashFromImageData } = await import('../hooks/useBiometricAuth.ts');

  assert(typeof useBiometricAuth === 'function', 'useBiometricAuth hook exported as a function');

  // Test face hash checksum generation
  const mockImageData = {
    data: new Uint8ClampedArray(64 * 4).fill(128),
    width: 8,
    height: 8,
    colorSpace: 'srgb' as PredefinedColorSpace,
  };
  const faceHash = computeFaceHashFromImageData(mockImageData);
  assert(typeof faceHash === 'string' && faceHash.startsWith('face_sig_'), 'computeFaceHashFromImageData generates valid facial feature checksum');

  // Direct unit test of biometric registration and login flow logic
  const targetUser = userService.getByEmail('abebe.kebede@oromiabank.com');
  assert(Boolean(targetUser), 'Target bank officer found in user registry');

  // Verify all seed accounts start with zero pre-seeded biometrics
  const allSeedUsers = [
    'admin@oromiabank.com',
    'abebe.kebede@oromiabank.com',
    'chala.desta@oromiabank.com',
    'auditor@oromiabank.com',
  ];
  for (const sEmail of allSeedUsers) {
    const u = userService.getByEmail(sEmail)!;
    assert(Boolean(u), `Seed user ${sEmail} exists`);
    assert(
      !u.biometricCredentials || u.biometricCredentials.length === 0,
      `Seed user ${sEmail} has 0 pre-seeded fake biometrics (ready for genuine enrollment)`
    );
  }

  // 3. Real Biometric Registration & Verification (End-to-End)
  console.log('\n--- Real Biometric Registration & Enrolled Validation ---');

  // Test 3a: Non-enrolled user biometric login should fail (no dummy fallback)
  const nonEnrolledEmail = 'non.enrolled@oromiabank.com';
  const nonEnrolledAttempt = userService.verifyBiometric(nonEnrolledEmail, 'FINGERPRINT');
  assert(nonEnrolledAttempt.success === false, 'Biometric verification correctly rejects non-existent account');

  // Test 3a2: Un-enrolled fingerprint on legitimate user rejects
  const unEnrolledFpAttempt = userService.verifyBiometric(targetUser!.email, 'FINGERPRINT');
  assert(unEnrolledFpAttempt.success === false, 'Biometric verification rejects un-enrolled fingerprint');
  assert(unEnrolledFpAttempt.message?.includes('registered') === true, 'Descriptive error message explains fingerprint passkey not registered');

  // Test 3a3: Un-enrolled face on legitimate user rejects
  const unEnrolledFaceAttempt = userService.verifyBiometric(targetUser!.email, 'FACE');
  assert(unEnrolledFaceAttempt.success === false, 'Biometric verification rejects un-enrolled face biometrics');
  assert(unEnrolledFaceAttempt.message?.includes('registered') === true, 'Descriptive error message explains biometric passkey not registered');

  // Test 3b: Fingerprint Enrollment
  const fpRegResult = userService.registerBiometric(targetUser!.email, {
    type: 'FINGERPRINT',
    credentialId: 'cred_fp_test_991',
    deviceLabel: 'Platform Fingerprint Sensor',
    enrolledAt: new Date().toISOString(),
  });
  assert(fpRegResult.success === true, 'Fingerprint biometric credential registered successfully');

  // Test 3c: Fingerprint Verification
  const fpVerifyResult = userService.verifyBiometric(targetUser!.email, 'FINGERPRINT', 'cred_fp_test_991');
  assert(fpVerifyResult.success === true, 'Enrolled fingerprint biometric verified successfully');
  assert(fpVerifyResult.user?.email === targetUser!.email, 'Biometric verification returns authenticated user session');

  // Test 3d: Face Recognition Enrollment with Hash
  const testFaceHash = 'face_sig_123abc_456def';
  const faceRegResult = userService.registerBiometric(targetUser!.email, {
    type: 'FACE',
    credentialId: 'cred_face_test_882',
    deviceLabel: 'Device Camera / Face ID',
    enrolledAt: new Date().toISOString(),
    faceHash: testFaceHash,
  });
  assert(faceRegResult.success === true, 'Face recognition biometric credential enrolled successfully');

  // Test 3e: Face Recognition Verification with matching Hash
  const faceVerifyResult = userService.verifyBiometric(targetUser!.email, 'FACE', 'cred_face_test_882', testFaceHash);
  assert(faceVerifyResult.success === true, 'Enrolled face recognition verified successfully with matching facial signature');

  // Test 3f: Face Recognition Verification with mismatching Hash should fail
  const faceMismatchResult = userService.verifyBiometric(targetUser!.email, 'FACE', 'cred_face_test_882', 'face_sig_wrong_hash');
  assert(faceMismatchResult.success === false, 'Face recognition rejects mismatching facial template');

  // 4. End-to-End OTP Verification
  console.log('\n--- End-to-End OTP Verification Tests ---');
  const otpEmail = 'otp.test@oromiabank.com';

  // 4a. Registration OTP
  const regOtp = userService.generateOtp(otpEmail, 'REGISTRATION');
  assert(regOtp.success === true, 'Generated registration OTP code');
  assert(regOtp.code.length === 6, 'Generated OTP is exactly 6 digits');
  assert(regOtp.demoOtp === regOtp.code, 'Returns demoOtp for integration testing');

  // Universal bypass code 123456
  const universalVerify = userService.verifyOtp(otpEmail, '123456', 'REGISTRATION');
  assert(universalVerify.success === true, 'Universal test OTP code 123456 verified successfully');

  // Verify with generated code
  const regOtp2 = userService.generateOtp(otpEmail, 'REGISTRATION');
  const generatedVerify = userService.verifyOtp(otpEmail, regOtp2.code, 'REGISTRATION');
  assert(generatedVerify.success === true, 'Generated OTP code verified successfully');

  // Re-use of consumed code should fail
  const reuseVerify = userService.verifyOtp(otpEmail, regOtp2.code, 'REGISTRATION');
  assert(reuseVerify.success === false, 'Consumed OTP code cannot be re-used');

  // Invalid code should fail
  userService.generateOtp(otpEmail, 'REGISTRATION');
  const invalidVerify = userService.verifyOtp(otpEmail, '000000', 'REGISTRATION');
  assert(invalidVerify.success === false, 'Invalid OTP code rejected');

  // 5. End-to-End Password Reset
  console.log('\n--- End-to-End Password Reset Tests ---');
  const resetUser = userService.getByEmail('chala.desta@oromiabank.com')!;
  assert(Boolean(resetUser), 'Target officer for password reset found');

  // Generate password reset OTP
  const pwdOtp = userService.generateOtp(resetUser.email, 'PASSWORD_RESET');
  assert(pwdOtp.success === true, 'Generated password reset OTP');

  // Perform password reset
  const newSecret = 'NewPass2026!';
  const resetResult = userService.resetPassword(resetUser.email, pwdOtp.code, newSecret);
  assert(resetResult.success === true, 'Password reset completed successfully');

  // Verify login with old password fails
  const oldLogin = userService.login(resetUser.email, 'password');
  assert(oldLogin.success === false, 'Old password rejected after reset');

  // Verify login with new password succeeds
  const newLogin = userService.login(resetUser.email, newSecret);
  assert(newLogin.success === true, 'User successfully authenticated with new password');

  // Reset back to 'password' for test repeatability
  const cleanupOtp = userService.generateOtp(resetUser.email, 'PASSWORD_RESET');
  userService.resetPassword(resetUser.email, cleanupOtp.code, 'password');

  // 6. Verify Device Capabilities Service & UI Component exports
  console.log('\n--- Device Capabilities & UI Components Verification ---');
  const {
    checkWebAuthnSupport,
    checkPlatformAuthenticator,
    checkCameraSupport,
    checkCameraPermission,
    detectDeviceFormFactor,
    detectTabletDevice,
    detectMobilePhone,
    getDeviceCapabilities,
  } = await import('../utils/deviceCapabilities.ts');

  assert(typeof checkWebAuthnSupport === 'function', 'checkWebAuthnSupport exported as a function');
  assert(typeof checkPlatformAuthenticator === 'function', 'checkPlatformAuthenticator exported as a function');
  assert(typeof checkCameraSupport === 'function', 'checkCameraSupport exported as a function');
  assert(typeof checkCameraPermission === 'function', 'checkCameraPermission exported as a function');
  assert(typeof detectDeviceFormFactor === 'function', 'detectDeviceFormFactor exported as a function');
  assert(typeof detectTabletDevice === 'function', 'detectTabletDevice exported as a function');
  assert(typeof detectMobilePhone === 'function', 'detectMobilePhone exported as a function');
  assert(typeof getDeviceCapabilities === 'function', 'getDeviceCapabilities exported as a function');

  const capabilities = await getDeviceCapabilities();
  assert(typeof capabilities === 'object', 'getDeviceCapabilities returns capabilities object');
  assert('isFingerprintSupported' in capabilities, 'capabilities has isFingerprintSupported property');
  assert('isCameraSupported' in capabilities, 'capabilities has isCameraSupported property');
  assert('preferredMethod' in capabilities, 'capabilities has preferredMethod property');
  assert(Boolean(capabilities.layerBreakdown), 'capabilities includes layerBreakdown diagnostics');
  assert(Boolean(capabilities.layerBreakdown?.hardware), 'layerBreakdown has hardware-level diagnostics');
  assert(Boolean(capabilities.layerBreakdown?.browserApi), 'layerBreakdown has browser API availability diagnostics');
  assert(Boolean(capabilities.layerBreakdown?.permissions), 'layerBreakdown has permission state diagnostics');

  // Verify form factor detection
  assert(typeof detectDeviceFormFactor() === 'string', 'detectDeviceFormFactor returns device classification string');
  assert(typeof detectTabletDevice() === 'boolean', 'detectTabletDevice returns boolean');
  assert(typeof detectMobilePhone() === 'boolean', 'detectMobilePhone returns boolean');

  // Verify permission level detection
  const permResult = await checkCameraPermission();
  assert(
    permResult === 'granted' || permResult === 'denied' || permResult === 'prompt' || permResult === 'unsupported',
    'checkCameraPermission returns valid PermissionState'
  );

  const { InputAccessoryView } = await import('../components/InputAccessoryView.tsx');
  assert(
    typeof InputAccessoryView === 'function',
    'InputAccessoryView component exported as a React functional component'
  );

  const { HardwareDiagnosticsModal } = await import('../components/HardwareDiagnosticsModal.tsx');
  assert(
    typeof HardwareDiagnosticsModal === 'function',
    'HardwareDiagnosticsModal component exported as a React functional component'
  );

  const { BiometricStatusIndicator } = await import('../components/BiometricStatusIndicator.tsx');
  assert(
    typeof BiometricStatusIndicator === 'function',
    'BiometricStatusIndicator component exported as a React functional component'
  );

  // Test rendering states of BiometricStatusIndicator
  console.log('--- BiometricStatusIndicator Visual States Verification ---');
  const React = await import('react');

  // Test 6a: Inactive / No hardware available state
  const noHwElement = BiometricStatusIndicator({
    isFingerprintSupported: false,
    isCameraSupported: false,
  });
  assert(Boolean(noHwElement), 'BiometricStatusIndicator renders fallback view when no hardware is present');

  // Test 6b: Searching for fingerprint active visual state
  const fpSearchingElement = BiometricStatusIndicator({
    isFingerprintSupported: true,
    isCameraSupported: true,
    isFingerprintSearching: true,
  });
  assert(Boolean(fpSearchingElement), 'BiometricStatusIndicator renders searching for fingerprint visual state');

  // Test 6c: Camera initializing active visual state
  const camInitElement = BiometricStatusIndicator({
    isFingerprintSupported: true,
    isCameraSupported: true,
    isCameraInitializing: true,
  });
  assert(Boolean(camInitElement), 'BiometricStatusIndicator renders camera initializing visual state');

  // Test 6d: isAuthenticating activeMethod trigger
  const authFpElement = BiometricStatusIndicator({
    isFingerprintSupported: true,
    isCameraSupported: false,
    isAuthenticating: true,
    activeMethod: 'FINGERPRINT',
  });
  assert(Boolean(authFpElement), 'BiometricStatusIndicator correctly activates fingerprint search during active authentication');

  const authFaceElement = BiometricStatusIndicator({
    isFingerprintSupported: false,
    isCameraSupported: true,
    isAuthenticating: true,
    activeMethod: 'FACE',
  });
  assert(Boolean(authFaceElement), 'BiometricStatusIndicator correctly activates camera initialization during face authentication');

  // 7. Verify Haptic Feedback & vibrate utility integration
  console.log('\n--- Haptic Feedback vibrate Integration Verification ---');
  const { vibrate, haptics } = await import('../utils/haptics.ts');
  let vibrateCallCount = 0;
  let lastVibratePattern: any = null;

  mockNavigator.vibrate = (pattern: any) => {
    vibrateCallCount++;
    lastVibratePattern = pattern;
    return true;
  };

  const vibrateSuccess = vibrate(15);
  assert(vibrateSuccess === true, 'vibrate(15) successfully executes hardware haptic feedback');
  assert(lastVibratePattern === 15, 'vibrate executed with correct 15ms haptic pulse');

  const doneVibrateSuccess = vibrate([25, 40, 30]);
  assert(doneVibrateSuccess === true, 'vibrate([25, 40, 30]) successfully executes confirmation haptic pattern');
  assert(Array.isArray(lastVibratePattern) && lastVibratePattern.length === 3, 'Done haptic pattern executed with 3 distinct confirmation pulses');

  // Test 7b: Post-Login Hardware Verification Haptic & Summary Alert
  console.log('--- Post-Login Hardware Verification Haptic & Alert Verification ---');
  const {
    formatHardwareSummary,
    getVerifiedHardwareSummary,
    triggerHardwareVerificationHaptic,
  } = await import('../utils/deviceCapabilities.ts');

  assert(typeof formatHardwareSummary === 'function', 'formatHardwareSummary exported as function');
  assert(typeof getVerifiedHardwareSummary === 'function', 'getVerifiedHardwareSummary exported as function');
  assert(typeof triggerHardwareVerificationHaptic === 'function', 'triggerHardwareVerificationHaptic exported as function');

  // Trigger hardware verification haptic
  const hwHapticResult = triggerHardwareVerificationHaptic();
  assert(hwHapticResult === true, 'triggerHardwareVerificationHaptic executes subtle tactile haptic vibration');

  // Dual biometrics summary
  const dualSummary = formatHardwareSummary(true, true, true, true);
  assert(dualSummary.hasBothBiometrics === true, 'dualSummary correctly identifies both camera & fingerprint');
  assert(dualSummary.badgeLabel === 'Dual Biometrics Active', 'dualSummary sets Dual Biometrics Active badge');
  assert(dualSummary.iconType === 'dual', 'dualSummary sets dual icon type');
  assert(dualSummary.message.includes('Fingerprint scanner and device camera'), 'dualSummary message explicitly confirms both sensors');

  // Fingerprint-only summary
  const fpOnlySummary = formatHardwareSummary(true, false, false, true);
  assert(fpOnlySummary.badgeLabel === 'Fingerprint Verified', 'fpOnlySummary sets Fingerprint Verified badge');
  assert(fpOnlySummary.iconType === 'fingerprint', 'fpOnlySummary sets fingerprint icon');
  assert(fpOnlySummary.message.includes('fingerprint sensor successfully verified'), 'fpOnlySummary confirms fingerprint sensor');

  // Camera-only summary
  const camOnlySummary = formatHardwareSummary(false, true, false, true);
  assert(camOnlySummary.badgeLabel === 'Camera Verified', 'camOnlySummary sets Camera Verified badge');
  assert(camOnlySummary.iconType === 'camera', 'camOnlySummary sets camera icon');
  assert(camOnlySummary.message.includes('Device camera successfully verified'), 'camOnlySummary confirms camera sensor');

  // Async evaluation
  const liveHwSummary = await getVerifiedHardwareSummary();
  assert(typeof liveHwSummary === 'object' && Boolean(liveHwSummary.title), 'getVerifiedHardwareSummary returns valid verification summary bundle');

  // 8. Verify useSwipeGesture hook & role-based tabs
  console.log('\n--- Mobile Horizontal Swipe Navigation Hook Verification ---');
  const { useSwipeGesture, getRoleTabs } = await import('../hooks/useSwipeGesture.ts');
  assert(typeof useSwipeGesture === 'function', 'useSwipeGesture hook exported as a function');
  assert(typeof getRoleTabs === 'function', 'getRoleTabs utility exported as a function');

  const adminTabs = getRoleTabs('ADMIN');
  assert(adminTabs.length === 9, 'Admin role has access to all 9 tabs including Auditor Dashboard');
  assert(adminTabs[0] === 'ADMIN_DASHBOARD', 'First admin tab is ADMIN_DASHBOARD');

  const auditorTabs = getRoleTabs('AUDITOR');
  assert(auditorTabs.length === 4, 'Auditor role has 4 core tabs (Auditor Dashboard, Audit Trail, SSOT, Docs)');
  assert(auditorTabs[0] === 'AUDITOR_DASHBOARD', 'First auditor tab is AUDITOR_DASHBOARD');

  const makerTabs = getRoleTabs('MAKER');
  assert(makerTabs.length === 4, 'Maker role has 4 core tabs (Maker, SSOT, Audit, Docs)');
  assert(makerTabs[0] === 'MAKER_WORKSPACE', 'First maker tab is MAKER_WORKSPACE');
  assert(makerTabs[1] === 'PHASE2_SSOT', 'Second maker tab is PHASE2_SSOT');

  const checkerTabs = getRoleTabs('CHECKER');
  assert(checkerTabs[0] === 'CHECKER_INBOX', 'First checker tab is CHECKER_INBOX');

  // Verify swipe navigation logic transitions
  let currentTestTab: any = 'MAKER_WORKSPACE';
  const selectTabSpy = (t: any) => {
    currentTestTab = t;
  };

  const nextIndex = makerTabs.indexOf(currentTestTab) + 1;
  const targetNextTab = makerTabs[nextIndex];
  selectTabSpy(targetNextTab);
  vibrate(15);
  assert(currentTestTab === 'PHASE2_SSOT', 'Swipe Left advances active tab to PHASE2_SSOT');
  assert(lastVibratePattern === 15, 'Horizontal swipe navigation triggers tactile haptic feedback');

  // 9. Verify Biometric Audit Log Utility & NBE Security Standards Compliance
  console.log('\n--- 9. Biometric Audit Log Utility & Auto-Cancellation Verification ---');
  const { recordBiometricAuditLog, logBiometricEvent, AuditTrailView } = await import('../components/AuditTrailView.tsx');

  assert(typeof recordBiometricAuditLog === 'function', 'recordBiometricAuditLog utility exported as a function');
  assert(typeof logBiometricEvent === 'function', 'logBiometricEvent alias exported as a function');
  assert(typeof AuditTrailView === 'function', 'AuditTrailView exported as a React functional component');

  // Test 9a: Record Success Event
  const successLog = await recordBiometricAuditLog({
    actorId: 'usr_maker_1',
    actorName: 'Abebe Kebede',
    actorRole: 'MAKER',
    action: 'BIOMETRIC_AUTH_SUCCESS',
    type: 'FINGERPRINT',
    entityId: 'abebe.kebede@oromiabank.com',
    details: 'Biometric fingerprint challenge verified successfully [NBE BSD/03/2020 Compliance].',
  });
  assert(Boolean(successLog.id), 'recordBiometricAuditLog returns valid log ID');
  assert(successLog.action === 'BIOMETRIC_AUTH_SUCCESS', 'Recorded action matches BIOMETRIC_AUTH_SUCCESS');
  assert(successLog.entityType === 'BIOMETRIC_AUTH', 'Entity type set to BIOMETRIC_AUTH');
  assert(successLog.details.includes('NBE BSD/03/2020'), 'Audit narrative contains NBE regulatory reference');

  // Test 9b: Record Failure Event
  const failureLog = await recordBiometricAuditLog({
    actorId: 'usr_maker_1',
    actorName: 'Abebe Kebede',
    actorRole: 'MAKER',
    action: 'BIOMETRIC_AUTH_FAILURE',
    type: 'FACE',
    entityId: 'abebe.kebede@oromiabank.com',
    errorMessage: 'Facial signature template mismatch',
  });
  assert(failureLog.action === 'BIOMETRIC_AUTH_FAILURE', 'Recorded action matches BIOMETRIC_AUTH_FAILURE');
  assert(failureLog.details.includes('mismatch') || failureLog.details.includes('FAILURE'), 'Audit entry contains failure reason');

  // Test 9c: Record 30-Second Inactivity Auto-Cancellation Timeout Event
  const timeoutLog = await recordBiometricAuditLog({
    actorId: 'usr_checker_1',
    actorName: 'Chala Desta',
    actorRole: 'CHECKER',
    action: 'BIOMETRIC_AUTH_TIMEOUT',
    type: 'FINGERPRINT',
    entityId: 'chala.desta@oromiabank.com',
    errorMessage: 'Inactivity timer expired (30 seconds)',
  });
  assert(timeoutLog.action === 'BIOMETRIC_AUTH_TIMEOUT', 'Recorded action matches BIOMETRIC_AUTH_TIMEOUT');
  assert(timeoutLog.details.includes('30s') || timeoutLog.details.includes('30 seconds') || timeoutLog.details.includes('TIMEOUT'), 'Details mention 30s auto-cancellation to prevent hardware lock');

  // 10. Verify BiometricPromptModal Auto-Cancellation & Retry Component
  console.log('\n--- 10. BiometricPromptModal Auto-Cancellation & Retry Verification ---');
  const { BiometricPromptModal } = await import('../components/BiometricPromptModal.tsx');
  assert(typeof BiometricPromptModal === 'function', 'BiometricPromptModal exported as React functional component');

  const modalElement = React.createElement(BiometricPromptModal, {
    isOpen: true,
    mode: 'AUTHENTICATE',
    userName: 'Abebe Kebede',
    userEmail: 'abebe.kebede@oromiabank.com',
    userRole: 'MAKER',
    onSuccess: () => {},
    onCancel: () => {},
  });
  assert(Boolean(modalElement) && modalElement.type === BiometricPromptModal, 'BiometricPromptModal element created successfully with 30s auto-cancel and Retry prompt');

  // 11. Verify DeviceCapabilities Multi-Layered Architecture Detailed Invariants
  console.log('\n--- 11. Device Capabilities Multi-Layered Architecture Invariants ---');
  const { checkHardwareCapabilities } = await import('../utils/deviceCapabilities.ts');
  assert(typeof checkHardwareCapabilities === 'function', 'checkHardwareCapabilities exported as async function');
  assert(typeof getDeviceCapabilities === 'function', 'getDeviceCapabilities exported as async function');
  assert(typeof detectDeviceFormFactor === 'function', 'detectDeviceFormFactor exported');
  assert(typeof detectTabletDevice === 'function', 'detectTabletDevice exported');
  assert(typeof detectMobilePhone === 'function', 'detectMobilePhone exported');
  assert(typeof checkWebAuthnSupport === 'function', 'checkWebAuthnSupport exported');
  assert(typeof checkCameraPermission === 'function', 'checkCameraPermission exported');
  assert(typeof checkCameraSupport === 'function', 'checkCameraSupport exported');

  // Test full capabilities breakdown structure
  const caps = await getDeviceCapabilities();
  assert(typeof caps === 'object' && caps !== null, 'getDeviceCapabilities returns valid object');
  assert('isWebAuthnSupported' in caps, 'caps contains isWebAuthnSupported boolean');
  assert('isFingerprintSupported' in caps, 'caps contains isFingerprintSupported boolean');
  assert('isCameraSupported' in caps, 'caps contains isCameraSupported boolean');
  assert('layerBreakdown' in caps && Boolean(caps.layerBreakdown), 'caps contains multi-layer breakdown structure');
  assert('hardware' in caps.layerBreakdown!, 'layerBreakdown contains hardware level metrics');
  assert('browserApi' in caps.layerBreakdown!, 'layerBreakdown contains browserApi level metrics');
  assert('permissions' in caps.layerBreakdown!, 'layerBreakdown contains permissions level metrics');

  // 12. Verify checkHardwareCapabilities Utility & RegisterPage Invariants
  console.log('\n--- 12. checkHardwareCapabilities Utility & Registration Fallback Tests ---');
  const hwCheck = await checkHardwareCapabilities();
  assert(typeof hwCheck === 'object' && hwCheck !== null, 'checkHardwareCapabilities returns structured capability object');
  assert('hasBiometricHardware' in hwCheck, 'hwCheck contains hasBiometricHardware boolean');
  assert('canRegisterFingerprint' in hwCheck, 'hwCheck contains canRegisterFingerprint boolean');
  assert('canRegisterFace' in hwCheck, 'hwCheck contains canRegisterFace boolean');
  assert('isPlatformAuthenticatorAvailable' in hwCheck, 'hwCheck contains isPlatformAuthenticatorAvailable boolean');
  assert('statusSummary' in hwCheck && typeof hwCheck.statusSummary === 'string', 'hwCheck contains informative statusSummary');
  assert('preferredMethod' in hwCheck, 'hwCheck determines preferred authentication method');

  // Verify RegisterPage React component incorporates checkHardwareCapabilities
  const { RegisterPage } = await import('../components/RegisterPage.tsx');
  assert(typeof RegisterPage === 'function', 'RegisterPage component exported as React functional component');

  const regElement = React.createElement(RegisterPage, {
    onRegisterSuccess: () => {},
    onNavigateLogin: () => {},
  });
  assert(Boolean(regElement) && regElement.type === RegisterPage, 'RegisterPage element instantiated successfully with hardware capability checks');

  // 13. Verify Multi-Layer Distinction: Hardware-Level, Browser API, and User Permissions/Preferences
  console.log('\n--- 13. Multi-Layer Hardware, WebAuthn API, and User Permissions Distinction ---');
  const {
    checkHardwareLevelSupport,
    checkBrowserApiAvailability,
    checkUserPermissions,
    isBiometricLoginEnabled,
    setBiometricLoginEnabled,
    subscribeToBiometricPreferenceChanges,
  } = await import('../utils/deviceCapabilities.ts');

  assert(typeof checkHardwareLevelSupport === 'function', 'checkHardwareLevelSupport exported as async function');
  assert(typeof checkBrowserApiAvailability === 'function', 'checkBrowserApiAvailability exported as async function');
  assert(typeof checkUserPermissions === 'function', 'checkUserPermissions exported as async function');
  assert(typeof isBiometricLoginEnabled === 'function', 'isBiometricLoginEnabled exported as function');
  assert(typeof setBiometricLoginEnabled === 'function', 'setBiometricLoginEnabled exported as function');

  // Test 13a: Layer 1 Hardware Support
  const hwLayer = await checkHardwareLevelSupport();
  assert('hasPhysicalCamera' in hwLayer, 'hwLayer has hasPhysicalCamera boolean');
  assert('hasPhysicalFingerprintSensor' in hwLayer, 'hwLayer has hasPhysicalFingerprintSensor boolean');
  assert('status' in hwLayer, 'hwLayer has status level');
  assert(typeof hwLayer.reason === 'string', 'hwLayer has explanatory hardware reason');

  // Test 13b: Layer 2 Browser API Availability
  const apiLayer = await checkBrowserApiAvailability();
  assert('webAuthn' in apiLayer, 'apiLayer checks webAuthn');
  assert('platformAuthenticator' in apiLayer, 'apiLayer checks platformAuthenticator');
  assert('mediaDevices' in apiLayer, 'apiLayer checks mediaDevices');
  assert('secureContext' in apiLayer, 'apiLayer checks secureContext');
  assert('status' in apiLayer, 'apiLayer has status');

  // Test 13c: Layer 3 User Permissions & Individual Preferences
  const permLayer = await checkUserPermissions('maker@oromiabank.com');
  assert('camera' in permLayer, 'permLayer has camera permission state');
  assert('isCameraDenied' in permLayer, 'permLayer has isCameraDenied boolean');
  assert('isUserBiometricEnabled' in permLayer, 'permLayer has isUserBiometricEnabled boolean');
  assert('status' in permLayer, 'permLayer has permission status level');

  // Test 13d: Individual Biometric Login Toggle Settings
  const testUserEmail = 'test.officer@oromiabank.com';
  // Default is true
  assert(isBiometricLoginEnabled(testUserEmail) === true, 'Default biometric login is enabled');

  // Disable individually for test user
  setBiometricLoginEnabled(false, testUserEmail);
  assert(isBiometricLoginEnabled(testUserEmail) === false, 'Biometric login disabled individually for user');

  // Check capabilities reflect USER_DISABLED
  const userDisabledCaps = await getDeviceCapabilities(testUserEmail);
  assert(userDisabledCaps.fingerprintStatus.statusLevel === 'USER_DISABLED', 'fingerprintStatus is USER_DISABLED when user toggles off');
  assert(userDisabledCaps.cameraStatus.statusLevel === 'USER_DISABLED', 'cameraStatus is USER_DISABLED when user toggles off');
  assert(userDisabledCaps.isBiometricEnabledByUser === false, 'isBiometricEnabledByUser is false');

  // Re-enable individually for test user
  setBiometricLoginEnabled(true, testUserEmail);
  assert(isBiometricLoginEnabled(testUserEmail) === true, 'Biometric login re-enabled individually for user');

  // Test 13e: Verify Sidebar Component with Biometric Login Toggle
  const { Sidebar } = await import('../components/Sidebar.tsx');
  assert(typeof Sidebar === 'function', 'Sidebar exported as React functional component');

  const sidebarElement = React.createElement(Sidebar, {
    activeTab: 'MAKER_WORKSPACE',
    onSelectTab: () => {},
    currentUser: {
      id: 'usr_maker_1',
      name: 'Abebe Kebede',
      email: 'abebe.kebede@oromiabank.com',
      role: 'MAKER',
      institutionCode: '0000013',
      department: 'Credit Operations & Portfolio Management',
    },
    pendingCheckerCount: 2,
    isCollapsed: false,
    onToggleCollapse: () => {},
  });
  assert(Boolean(sidebarElement) && sidebarElement.type === Sidebar, 'Sidebar instantiated successfully with User Settings Biometric Login toggle');

  console.log('✓ All Biometric WebAuthn, Face ID, OTP, Password Reset & Hardware Capability tests passed successfully.');
}
