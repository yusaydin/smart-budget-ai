/**
 * ProfileCard - Profil özet kartı
 * Avatar (inisyal tabanlı) + isim + e-posta + üyelik rozeti.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing, BorderRadius, Elevation } from '../theme/spacing';

const ProfileCard = React.memo(({ isim, eposta, uyelik, avatar }) => {
  return (
    <View style={styles.container}>
      {/* Avatar */}
      <View style={styles.avatarContainer}>
        <Text style={styles.avatarText}>{avatar}</Text>
      </View>

      {/* Bilgiler */}
      <View style={styles.infoContainer}>
        <Text style={styles.name}>{isim}</Text>
        <Text style={styles.email}>{eposta}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeStar}>⭐</Text>
          <Text style={styles.badgeText}>{uyelik}</Text>
        </View>
      </View>
    </View>
  );
});

ProfileCard.displayName = 'ProfileCard';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.lg,
    padding: Spacing.gutter,
    gap: Spacing.md,
    ...Elevation.level1,
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.onPrimary,
  },
  infoContainer: {
    flex: 1,
  },
  name: {
    ...Typography.headlineMd,
    color: Colors.onSurface,
  },
  email: {
    ...Typography.bodySm,
    color: Colors.secondary,
    marginTop: 2,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(32, 122, 179, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
    marginTop: Spacing.base,
    gap: 4,
  },
  badgeStar: {
    fontSize: 12,
  },
  badgeText: {
    ...Typography.labelMd,
    color: Colors.primaryContainer,
  },
});

export default ProfileCard;
