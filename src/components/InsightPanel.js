/**
 * InsightPanel - AI Financial Check-up kartı
 * Glassmorphic tasarımlı AI öneri paneli.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';

const InsightPanel = React.memo(({ baslik, mesaj, butonMetni, onPress }) => {
  return (
    <View style={styles.container}>
      {/* Dekoratif arka plan efekti */}
      <View style={styles.decorativeBlob} />

      <View style={styles.headerRow}>
        <Text style={styles.sparkleIcon}>✨</Text>
        <Text style={styles.title}>{baslik}</Text>
      </View>

      <Text style={styles.message}>{mesaj}</Text>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.button} activeOpacity={0.8} onPress={onPress}>
          <Text style={styles.buttonText}>{butonMetni}</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

InsightPanel.displayName = 'InsightPanel';

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.glassBackground,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    overflow: 'hidden',
    position: 'relative',
  },
  decorativeBlob: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: 'rgba(146, 204, 255, 0.3)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    zIndex: 1,
  },
  sparkleIcon: {
    fontSize: 22,
  },
  title: {
    ...Typography.headlineSm,
    color: Colors.onBackground,
  },
  message: {
    ...Typography.bodyLg,
    color: Colors.onSurfaceVariant,
    zIndex: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: Spacing.xs,
    zIndex: 1,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryContainer,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.default,
    gap: Spacing.xs,
  },
  buttonText: {
    ...Typography.labelMd,
    color: Colors.onPrimaryContainer,
  },
  chevron: {
    fontSize: 18,
    color: Colors.onPrimaryContainer,
    fontWeight: '700',
  },
});

export default InsightPanel;
