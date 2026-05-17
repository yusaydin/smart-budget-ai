/**
 * SettingsRow - Ayar satırı bileşeni
 * İkon + metin + opsiyonel alt metin + sağ ok.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing } from '../theme/spacing';

const SettingsRow = React.memo(({ ikon, baslik, altBaslik, onPress, ikonRenk, tehlike }) => {
  return (
    <TouchableOpacity
      style={styles.container}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <View style={styles.leftSection}>
        <Text style={[styles.icon, { color: tehlike ? Colors.error : (ikonRenk || Colors.secondary) }]}>
          {ikon}
        </Text>
        <View>
          <Text style={[styles.title, tehlike && styles.titleDanger]}>{baslik}</Text>
          {altBaslik ? <Text style={styles.subtitle}>{altBaslik}</Text> : null}
        </View>
      </View>
      {!tehlike && <Text style={styles.chevron}>›</Text>}
    </TouchableOpacity>
  );
});

SettingsRow.displayName = 'SettingsRow';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.surfaceVariant,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  icon: {
    fontSize: 22,
  },
  title: {
    ...Typography.bodyMd,
    color: Colors.onSurface,
  },
  titleDanger: {
    color: Colors.error,
  },
  subtitle: {
    ...Typography.labelMd,
    color: Colors.secondary,
  },
  chevron: {
    fontSize: 24,
    color: Colors.outline,
    fontWeight: '300',
  },
});

export default SettingsRow;
