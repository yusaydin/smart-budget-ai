/**
 * ModeToggle - Bireysel / Kurumsal mod geçiş toggle'ı
 * Animated kayma efektli toggle bileşeni.
 */
import React, { useRef, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';

const ModeToggle = React.memo(({ isCorporate, onToggle }) => {
  const slideAnim = useRef(new Animated.Value(isCorporate ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: isCorporate ? 1 : 0,
      useNativeDriver: false,
      tension: 60,
      friction: 10,
    }).start();
  }, [isCorporate, slideAnim]);

  const handleToggle = useCallback(() => {
    onToggle(!isCorporate);
  }, [isCorporate, onToggle]);

  const indicatorLeft = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['2%', '50%'],
  });

  return (
    <View style={styles.wrapper}>
      <Text style={styles.title}>Çalışma Modu</Text>
      <Text style={styles.subtitle}>
        Kurumsal moda geçiş vergi ve uyumluluk araçlarını açar.
      </Text>

      <TouchableOpacity
        style={styles.toggleContainer}
        activeOpacity={0.9}
        onPress={handleToggle}
      >
        <Animated.View style={[styles.indicator, { left: indicatorLeft }]} />
        <View style={styles.optionContainer}>
          <Text
            style={[
              styles.optionText,
              !isCorporate && styles.optionTextActive,
            ]}
          >
            Bireysel
          </Text>
        </View>
        <View style={styles.optionContainer}>
          <Text
            style={[
              styles.optionText,
              isCorporate && styles.optionTextActive,
            ]}
          >
            Kurumsal
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
});

ModeToggle.displayName = 'ModeToggle';

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 20,
    elevation: 2,
  },
  title: {
    ...Typography.headlineSm,
    color: Colors.onSurface,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.bodySm,
    color: Colors.secondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  toggleContainer: {
    width: '100%',
    maxWidth: 280,
    height: 56,
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: BorderRadius.full,
    flexDirection: 'row',
    padding: Spacing.base,
    position: 'relative',
  },
  indicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    width: '48%',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    zIndex: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  optionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  optionText: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
  },
  optionTextActive: {
    color: Colors.onPrimary,
    fontWeight: '700',
  },
});

export default ModeToggle;
