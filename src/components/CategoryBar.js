/**
 * CategoryBar - Kategori harcama çubuğu
 * İsim + tutar + ilerleme çubuğu gösterimi.
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';

const CategoryBar = React.memo(({ isim, tutar, yuzde, renk }) => {
  const formattedTutar = useMemo(() => {
    return `₺${tutar.toLocaleString('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }, [tutar]);

  const barWidth = useMemo(() => `${Math.min(yuzde, 100)}%`, [yuzde]);

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.name}>{isim}</Text>
        <Text style={styles.amount}>{formattedTutar}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.indicator, { width: barWidth, backgroundColor: renk }]} />
      </View>
    </View>
  );
});

CategoryBar.displayName = 'CategoryBar';

const styles = StyleSheet.create({
  container: {
    gap: Spacing.base,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  name: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
  },
  amount: {
    ...Typography.bodySm,
    fontWeight: '700',
    color: Colors.onBackground,
  },
  track: {
    width: '100%',
    height: 10,
    backgroundColor: Colors.secondaryContainer,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  indicator: {
    height: '100%',
    borderRadius: BorderRadius.full,
  },
});

export default CategoryBar;
