/**
 * BalanceCard - Toplam Bakiye kartı
 * Ana ekrandaki büyük bakiye gösterimi.
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing, BorderRadius, Elevation } from '../theme/spacing';

const BalanceCard = React.memo(({ bakiye }) => {
  const formattedBakiye = useMemo(() => {
    return `₺${bakiye.toLocaleString('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }, [bakiye]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Toplam Bakiye</Text>
      <Text style={styles.amount}>{formattedBakiye}</Text>
    </View>
  );
});

BalanceCard.displayName = 'BalanceCard';

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.xs,
    ...Elevation.level1,
  },
  label: {
    ...Typography.labelMd,
    color: Colors.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  amount: {
    ...Typography.numericDisplay,
    color: Colors.onBackground,
  },
});

export default BalanceCard;
