/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * PHASE 17 ACCEPTANCE TEST SUITE: Live Image Quality & Adaptive Biometric Matching
 * Compliance: NBE Directive BSD/03/2020 & 17_IMAGE_QUALITY_INDICATOR_AND_ADAPTIVE_BIOMETRIC_MATCHING.md
 */

import { biometricService } from '../services/biometricService.ts';
import { userService } from '../services/userService.ts';
import { analyzeFaceQuality } from '../hooks/useBiometricAuth.ts';

function assert(condition: any, msg: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

export async function runPhase17ImageQualityAdaptiveMatchingTests() {
  console.log('\n========================================================================');
  console.log('--- PHASE 17: LIVE IMAGE QUALITY & ADAPTIVE BIOMETRIC MATCHING SUITE ---');
  console.log('========================================================================\n');

  console.log('--- 1. Optical Image Quality Tier Evaluation (Poor / Good / Excellent) ---');

  // Test Helper: Create mock ImageData
  function createMockImageData(width: number, height: number, avgR: number, avgG: number, avgB: number, edgeVariance: number = 30): ImageData {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const noise = ((x + y) % 4) * edgeVariance;
        data[idx] = Math.min(255, Math.max(0, avgR + noise));
        data[idx + 1] = Math.min(255, Math.max(0, avgG + noise));
        data[idx + 2] = Math.min(255, Math.max(0, avgB + noise));
        data[idx + 3] = 255;
      }
    }
    return { data, width, height, colorSpace: 'srgb' as any };
  }

  // 1A. Dark frame (Poor)
  const darkFrame = createMockImageData(160, 120, 15, 15, 15, 2);
  const darkQuality = analyzeFaceQuality(darkFrame);
  assert(!darkQuality.isQualityAcceptable, 'Dark frame (<35 luminance) is flagged as unacceptable quality');
  assert(darkQuality.reasons.some((r) => r.toLowerCase().includes('dark') || r.toLowerCase().includes('lighting')), 'Dark frame provides explicit low-lighting diagnostic guidance');

  // 1B. Overexposed / High glare frame (Poor)
  const glareFrame = createMockImageData(160, 120, 245, 245, 245, 5);
  const glareQuality = analyzeFaceQuality(glareFrame);
  assert(!glareQuality.isQualityAcceptable, 'Overexposed frame (>235 luminance) is flagged as unacceptable quality');
  assert(glareQuality.reasons.some((r) => r.toLowerCase().includes('overexposed') || r.toLowerCase().includes('glare')), 'Overexposed frame provides glare guidance');

  // 1C. Optimal well-lit frame (Good / Excellent)
  const optimalFrame = createMockImageData(160, 120, 135, 130, 125, 35);
  const optimalQuality = analyzeFaceQuality(optimalFrame);
  assert(optimalQuality.isQualityAcceptable, 'Well-illuminated frame is marked acceptable quality');
  assert(optimalQuality.qualityScore >= 0.50, 'Quality score is in Good/Excellent range (>= 50%)');

  console.log('\n--- 2. Face Enrollment & Template Checksum Preservation ---');
  const testEmail = `officer_quality_${Date.now()}@oromiabank.com`;
  const regUser = userService.register({
    email: testEmail,
    name: 'Tsegaye Gebremedhin',
    role: 'MAKER',
    department: 'Credit Operations & Portfolio Management',
    employeeId: `EMP_QUAL_${Date.now()}`,
  });
  if (regUser.user) {
    userService.updateUserStatus(regUser.user.id, 'ACTIVE', 'Compliance Admin');
  }

  const enrollCh = biometricService.createChallenge(testEmail, 'FACE', 'REGISTRATION');
  const enrollOpticalVector = 'face_optical_140_135_128_lum_134_dim_1280x720';

  const enrollRes = biometricService.enrollFaceBiometric(
    testEmail,
    enrollCh.id,
    enrollOpticalVector,
    { luminance: 134, sharpness: 0.88, faceCount: 1, faceBoxRatio: 0.45 },
    { spoofProbability: 0.04, motionScore: 0.72, method: 'CANVAS_OPTICAL_CHECK' },
    'Samsung Galaxy Tab A6 Front Camera'
  );

  assert(enrollRes.success, 'Enrollment succeeds with optical feature vector');
  assert(Boolean(enrollRes.credential?.faceTemplate?.rawVectorChecksum), 'CRITICAL: rawVectorChecksum is preserved in faceTemplate');
  assert(enrollRes.credential?.faceTemplate?.rawVectorChecksum === enrollOpticalVector, 'Stored rawVectorChecksum exactly matches input optical signature');

  console.log('\n--- 3. Adaptive Optical Tolerance Matching (Tolerates Ambient Variance) ---');
  // Scenario: Officer signs in under slightly different lighting (e.g. tablet reflection or afternoon light)
  // Enrollment: R=140, G=135, B=128, Lum=134
  // Login:      R=152, G=142, B=131, Lum=144
  // Diff: dr=12, dg=7, db=3, dlum=10 -> Euclidean distance = sqrt(144 + 49 + 9 + 100) = sqrt(302) = 17.38 units
  const loginOpticalVarianceVector = 'face_optical_152_142_131_lum_144_dim_1280x720';

  const loginCh1 = biometricService.createChallenge(testEmail, 'FACE', 'AUTHENTICATION');
  const verifyRes = biometricService.verifyFaceBiometric({
    email: testEmail,
    challengeId: loginCh1.id,
    featureVector: loginOpticalVarianceVector,
    qualityMetrics: { luminance: 144, sharpness: 0.82, faceCount: 1, faceBoxRatio: 0.45 },
    livenessEvidence: { spoofProbability: 0.05, motionScore: 0.68, method: 'CANVAS_OPTICAL_CHECK' },
  });

  assert(verifyRes.success, 'Face ID verification succeeds under natural ambient lighting variance');
  assert(verifyRes.user?.email === testEmail, 'Authenticated user matches enrolled officer');

  console.log('\n--- 4. Strict Impostor & Vast Mismatch Rejection ---');
  // Impostor with vastly different optical characteristics: R=60, G=70, B=90, Lum=72
  // Distance will exceed 120 units
  const impostorVector = 'face_optical_60_70_90_lum_72_dim_1280x720';
  const loginCh2 = biometricService.createChallenge(testEmail, 'FACE', 'AUTHENTICATION');
  const impostorRes = biometricService.verifyFaceBiometric({
    email: testEmail,
    challengeId: loginCh2.id,
    featureVector: impostorVector,
  });

  assert(!impostorRes.success, 'Impostor with high optical distance is strictly rejected');
  assert(impostorRes.message?.includes('does not match'), 'Descriptive signature mismatch guidance returned');

  console.log('\n--- 5. Administrator Biometric Threshold Governance ---');
  const adminOfficer = userService.getByEmail('admin@oromiabank.com')!;
  const currentSettings = biometricService.getBiometricSettings();
  assert(typeof currentSettings.matchingThreshold === 'number', 'Current matching threshold is a valid number');
  assert(Boolean(currentSettings.preset), 'Matching preset is active');

  // Admin changes policy to TOLERANT
  const updateTolerant = biometricService.updateBiometricSettings({ preset: 'TOLERANT' }, adminOfficer.email);
  assert(updateTolerant.success, 'Admin can update biometric threshold policy to TOLERANT');
  assert(updateTolerant.settings.matchingThreshold === 85, 'Tolerant policy sets distance limit to 85');

  // Admin changes policy back to BALANCED (Default)
  const updateBalanced = biometricService.updateBiometricSettings({ preset: 'BALANCED' }, adminOfficer.email);
  assert(updateBalanced.success, 'Admin can restore biometric policy to BALANCED default');
  assert(updateBalanced.settings.matchingThreshold === 65, 'Balanced default sets distance limit to 65');

  // Non-admin attempt rejected
  const makerOfficer = userService.getByEmail('abebe.kebede@oromiabank.com')!;
  const nonAdminUpdate = biometricService.updateBiometricSettings({ preset: 'STRICT' }, makerOfficer.email);
  assert(!nonAdminUpdate.success, 'Non-admin officer is strictly blocked from modifying threshold governance');

  console.log('\n========================================================================');
  console.log('✅ ALL PHASE 17 IMAGE QUALITY & ADAPTIVE MATCHING TESTS PASSED');
  console.log('========================================================================\n');
}
