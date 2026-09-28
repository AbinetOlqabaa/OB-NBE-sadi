/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type HapticType = 'light' | 'medium' | 'success' | 'warning' | 'error' | 'selection';

/**
 * Direct vibrate utility function for mobile devices.
 * Triggers short haptic vibration pulses when users submit reports or perform sensitive actions.
 * Safe for all platforms (graceful no-op if unsupported or in non-touch/desktop environments).
 */
export function vibrate(pattern: number | number[] = 25): boolean {
  if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
    try {
      return navigator.vibrate(pattern);
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Trigger hardware haptic feedback presets on supported mobile devices
 */
export function triggerHaptic(type: HapticType = 'medium'): boolean {
  if (typeof window === 'undefined' || !('navigator' in window) || !navigator.vibrate) {
    return false;
  }

  try {
    switch (type) {
      case 'selection':
      case 'light':
        return vibrate(15);
      case 'medium':
        return vibrate(30);
      case 'success':
        // Two crisp celebratory pulses
        return vibrate([25, 40, 35]);
      case 'warning':
        // Alert pulse
        return vibrate([40, 50, 40]);
      case 'error':
        // Distinct error buzz
        return vibrate([60, 70, 60, 70]);
      default:
        return vibrate(25);
    }
  } catch {
    return false;
  }
}

export const haptics = {
  light: () => triggerHaptic('light'),
  medium: () => triggerHaptic('medium'),
  success: () => triggerHaptic('success'),
  warning: () => triggerHaptic('warning'),
  error: () => triggerHaptic('error'),
  selection: () => triggerHaptic('selection'),
  vibrate: (pattern: number | number[] = 25) => vibrate(pattern),
};
