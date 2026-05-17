/**
 * SourceBadge - Kaynak rozeti bileşeni
 * OCR, Gmail veya Manuel etiketleri.
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';

const SourceBadge = React.memo(({ kaynak }) => {
  const badgeStyle = useMemo(() => {
    switch (kaynak) {
      case 'OCR':
        return {
          backgroundColor: Colors.ocrBadgeBg,
          borderColor: Colors.ocrBadgeBorder,
          textColor: Colors.primary,
          borderWidth: 1,
        };
      case 'Gmail':
        return {
          backgroundColor: Colors.gmailBadgeBg,
          borderColor: 'transparent',
          textColor: Colors.onSurfaceVariant,
          borderWidth: 0,
        };
      case 'Manuel':
        return {
          backgroundColor: Colors.manualBadgeBg,
          borderColor: 'transparent',
          textColor: Colors.onSurfaceVariant,
          borderWidth: 0,
        };
      default:
        return {
          backgroundColor: Colors.surfaceContainerHigh,
          borderColor: 'transparent',
          textColor: Colors.onSurfaceVariant,
          borderWidth: 0,
        };
    }
  }, [kaynak]);

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: badgeStyle.backgroundColor,
          borderColor: badgeStyle.borderColor,
          borderWidth: badgeStyle.borderWidth,
        },
      ]}
    >
      <Text style={[styles.text, { color: badgeStyle.textColor }]}>{kaynak}</Text>
    </View>
  );
});

SourceBadge.displayName = 'SourceBadge';

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  text: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});

export default SourceBadge;
