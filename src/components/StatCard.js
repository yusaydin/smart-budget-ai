/**
 * StatCard - Gelir/Gider mini kartı
 * Yuvarlak ikon + etiket + tutar gösterimi.
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing, BorderRadius, Elevation } from '../theme/spacing';

const StatCard = React.memo(({ label, tutar, tip }) => {
  const isGelir = tip === 'gelir';

  const formattedTutar = useMemo(() => {
    return `₺${Math.abs(tutar).toLocaleString('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }, [tutar]);

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: isGelir ? Colors.successLight : Colors.errorContainer },
        ]}
      >
        <Text style={[styles.icon, { color: isGelir ? Colors.success : Colors.error }]}>
          {isGelir ? '↓' : '↑'}
        </Text>
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.amount}>{formattedTutar}</Text>
      </View>
    </View>
  );
});

StatCard.displayName = 'StatCard';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
    ...Elevation.level1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 20,
    fontWeight: '700',
  },
  textContainer: {
    flexDirection: 'column',
    flex: 1,
  },
  label: {
    ...Typography.labelMd,
    color: Colors.onSurfaceVariant,
  },
  amount: {
    ...Typography.headlineSm,
    fontWeight: '700',
    color: Colors.onBackground,
  },
});

export default StatCard;
