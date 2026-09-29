/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Oromia Bank (OB) Authoritative Visual Design System & Color Tokens
 * Governed by Oromia Bank Brand Guidelines & NBE Directive BSD/03/2020
 */

export const OB_BRAND_COLORS = {
  /**
   * Authoritative OB Primary Green per Abinet Alemu directive: #8CC51F
   * Replaces previous/inconsistent green variations across the application.
   */
  primaryGreen: '#8CC51F',

  /**
   * Authoritative OB Primary Blue documented across official logo assets
   * (public/brand/oromia-logo-full.png, oromia-logo-mark.png, oromia-logo-mark-transparent.png),
   * CSS variables, and PDF generation baseline: #5962AB (RGB: 89, 98, 171).
   * 
   * Note on requested #5863AC:
   * The project owner supplied #5863AC (RGB: 88, 99, 172), which differs from the
   * existing documented logo color #5962AB by only 1 unit per RGB channel (ΔE ≈ 0.6).
   * Per design specification instructions, the documented six-digit logo value #5962AB
   * is preserved as the authoritative primary blue while recording this alignment.
   */
  primaryBlue: '#5962AB',
  primaryBlueOwnerRequested: '#5863AC',

  /**
   * Complete calibrated tonal scale for OB Primary Green (#8CC51F)
   */
  green: {
    50: '#F6FAF0',
    100: '#EDF7D9',
    200: '#DDF0B8',
    300: '#C6E68E',
    400: '#AADB56',
    500: '#8CC51F', // Brand primary green
    600: '#74A617',
    700: '#5A8212',
    800: '#415E0D',
    900: '#2B3E09',
    950: '#172304',
  },

  /**
   * Complete calibrated tonal scale for OB Primary Blue (#5962AB)
   */
  blue: {
    50: '#F4F5FB',
    100: '#E7E9F7',
    200: '#D2D6EF',
    300: '#B4BCE4',
    400: '#8B96D5',
    500: '#5962AB', // Brand primary blue
    600: '#47509A',
    700: '#383F7D',
    800: '#2C3161', // High-contrast active container
    900: '#22264C',
    950: '#161933',
  },

  /**
   * Dashboard Sidebar Design Tokens
   * Authoritative OB Blue replaces the previous dark/black (#121428) background
   */
  sidebar: {
    background: '#5962AB',
    backgroundMobile: '#5962AB',
    border: '#47509A',
    textPrimary: '#FFFFFF',
    textSecondary: 'rgba(255, 255, 255, 0.85)',
    textMuted: 'rgba(255, 255, 255, 0.65)',
    itemHover: 'rgba(255, 255, 255, 0.12)',
    itemActiveBg: '#2C3161',
    itemActiveText: '#FFFFFF',
    itemActiveRing: 'rgba(255, 255, 255, 0.25)',
    itemBadgeBg: '#8CC51F',
    itemBadgeText: '#0B0F19',
    helperCardBg: 'rgba(44, 49, 97, 0.65)',
    helperCardBorder: 'rgba(255, 255, 255, 0.15)',
    logoutBg: 'rgba(225, 29, 72, 0.20)',
    logoutHoverBg: 'rgba(225, 29, 72, 0.40)',
    logoutText: '#FFE4E6',
  },

  /**
   * Semantic Status & Feedback Colors
   * Preserves critical non-brand regulatory distinction (success, warning, error, info)
   */
  semantic: {
    success: {
      light: '#10B981', // Emerald 500
      dark: '#34D399',  // Emerald 400
      bgLight: '#ECFDF5',
      bgDark: 'rgba(6, 78, 59, 0.3)',
      borderLight: '#A7F3D0',
      borderDark: 'rgba(16, 185, 129, 0.3)',
    },
    warning: {
      light: '#F59E0B', // Amber 500
      dark: '#FBBF24',  // Amber 400
      bgLight: '#FFFBEB',
      bgDark: 'rgba(120, 53, 15, 0.3)',
      borderLight: '#FDE68A',
      borderDark: 'rgba(245, 158, 11, 0.3)',
    },
    error: {
      light: '#EF4444', // Red 500
      dark: '#F87171',  // Red 400
      bgLight: '#FEF2F2',
      bgDark: 'rgba(127, 29, 29, 0.3)',
      borderLight: '#FECACA',
      borderDark: 'rgba(239, 68, 68, 0.3)',
    },
    info: {
      light: '#5962AB', // OB Blue
      dark: '#8B96D5',  // OB Blue 400
      bgLight: '#F4F5FB',
      bgDark: 'rgba(34, 38, 76, 0.4)',
      borderLight: '#D2D6EF',
      borderDark: 'rgba(89, 98, 171, 0.4)',
    },
  },

  /**
   * Surface & Background Tokens
   */
  surfaces: {
    light: {
      bodyBg: '#F8FAFC',
      cardBg: '#FFFFFF',
      cardBorder: '#E2E8F0',
      headerBg: '#FFFFFF',
      headerBorder: '#E2E8F0',
      textPrimary: '#0F172A',
      textSecondary: '#64748B',
      textMuted: '#94A3B8',
    },
    dark: {
      bodyBg: '#0B0F19',
      cardBg: '#121428',
      cardBorder: '#22284D',
      headerBg: '#121428',
      headerBorder: '#22284D',
      textPrimary: '#F1F5F9',
      textSecondary: '#94A3B8',
      textMuted: '#64748B',
    },
  },
} as const;

export type ObBrandColorKey = keyof typeof OB_BRAND_COLORS;
