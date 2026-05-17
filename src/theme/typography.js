/**
 * BudgetAI Tipografi Token'ları
 * Manrope font ailesi - sistem fontu fallback olarak kullanılır.
 */
import { Platform } from 'react-native';

const fontFamily = Platform.select({
  ios: 'System',
  android: 'Roboto',
  default: 'System',
});

export const Typography = {
  numericDisplay: {
    fontFamily,
    fontSize: 36,
    fontWeight: '700',
    lineHeight: 44,
    letterSpacing: -0.03 * 36,
  },
  headlineLg: {
    fontFamily,
    fontSize: 30,
    fontWeight: '700',
    lineHeight: 38,
    letterSpacing: -0.02 * 30,
  },
  headlineMd: {
    fontFamily,
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 32,
    letterSpacing: -0.01 * 24,
  },
  headlineSm: {
    fontFamily,
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 28,
  },
  bodyLg: {
    fontFamily,
    fontSize: 18,
    fontWeight: '400',
    lineHeight: 26,
  },
  bodyMd: {
    fontFamily,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
  },
  bodySm: {
    fontFamily,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },
  labelMd: {
    fontFamily,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    letterSpacing: 0.02 * 12,
  },
};
