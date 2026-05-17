/**
 * AppHeader - Global üst başlık bileşeni
 * Her ekranda görünen BudgetAI logo başlığı + bildirim ikonu.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing } from '../theme/spacing';

const AppHeader = React.memo(() => {
  return (
    <View style={styles.container}>
      <View style={styles.leftSection}>
        <Text style={styles.logoIcon}>💼</Text>
        <Text style={styles.logoText}>BudgetAI</Text>
      </View>
      <TouchableOpacity style={styles.notificationBtn} activeOpacity={0.7}>
        <Text style={styles.notificationIcon}>🔔</Text>
      </TouchableOpacity>
    </View>
  );
});

AppHeader.displayName = 'AppHeader';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.containerMargin,
    height: 56,
    backgroundColor: Colors.surfaceContainerLowest,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.outlineVariant,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  logoIcon: {
    fontSize: 22,
  },
  logoText: {
    ...Typography.headlineSm,
    fontWeight: '700',
    color: Colors.primary,
  },
  notificationBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationIcon: {
    fontSize: 20,
  },
});

export default AppHeader;
