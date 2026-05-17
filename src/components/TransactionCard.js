/**
 * TransactionCard - İşlem kartı bileşeni
 * Kategori ikonu, işlem adı, açıklama, tutar ve kaynak rozeti.
 */
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing, BorderRadius, Elevation } from '../theme/spacing';
import SourceBadge from './SourceBadge';

const TransactionCard = React.memo(({ isim, aciklama, tutar, ikon, ikonArkaPlan, kaynak }) => {
  const formattedTutar = useMemo(() => {
    const prefix = tutar < 0 ? '-' : '+';
    return `${prefix}₺${Math.abs(tutar).toLocaleString('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }, [tutar]);

  return (
    <TouchableOpacity style={styles.container} activeOpacity={0.7}>
      <View style={[styles.iconContainer, { backgroundColor: ikonArkaPlan }]}>
        <Text style={styles.icon}>{ikon}</Text>
      </View>
      <View style={styles.contentContainer}>
        <View style={styles.topRow}>
          <Text style={styles.name} numberOfLines={1}>
            {isim}
          </Text>
          <Text style={[styles.amount, tutar < 0 && styles.amountExpense]}>
            {formattedTutar}
          </Text>
        </View>
        <View style={styles.bottomRow}>
          <Text style={styles.description} numberOfLines={1}>
            {aciklama}
          </Text>
          <SourceBadge kaynak={kaynak} />
        </View>
      </View>
    </TouchableOpacity>
  );
});

TransactionCard.displayName = 'TransactionCard';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.lg,
    padding: Spacing.sm,
    gap: Spacing.md,
    borderWidth: 0.5,
    borderColor: 'rgba(224, 226, 232, 0.5)',
    ...Elevation.level2,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  icon: {
    fontSize: 20,
  },
  contentContainer: {
    flex: 1,
    gap: 4,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  name: {
    ...Typography.bodyMd,
    fontWeight: '700',
    color: Colors.onSurface,
    flex: 1,
    marginRight: Spacing.xs,
  },
  amount: {
    ...Typography.bodyMd,
    fontWeight: '700',
    color: Colors.success,
  },
  amountExpense: {
    color: Colors.error,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  description: {
    ...Typography.bodySm,
    color: Colors.secondary,
    flex: 1,
    marginRight: Spacing.xs,
  },
});

export default TransactionCard;
