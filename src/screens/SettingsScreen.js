/**
 * SettingsScreen - Profil & Ayarlar Ekranı
 * Profil kartı, mod toggle, entegrasyon butonları, koşullu vergi bilgileri, ayarlar listesi.
 */
import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppHeader from '../components/AppHeader';
import ProfileCard from '../components/ProfileCard';
import ModeToggle from '../components/ModeToggle';
import SettingsRow from '../components/SettingsRow';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing, BorderRadius, Elevation } from '../theme/spacing';
import { profileData, taxData } from '../data/mockData';

const SettingsScreen = () => {
  const [isCorporate, setIsCorporate] = useState(true);

  const handleToggle = useCallback((val) => {
    setIsCorporate(val);
  }, []);

  const handleGmail = useCallback(() => {
    Alert.alert('Gmail Senkronizasyonu', 'Gmail hesabınız bağlanıyor...', [{ text: 'Tamam' }]);
  }, []);

  const handleAI = useCallback(() => {
    Alert.alert('AI İzinleri', 'Yapay zeka veri erişim izinlerinizi yönetin.', [{ text: 'Tamam' }]);
  }, []);

  const handleLogout = useCallback(() => {
    Alert.alert('Çıkış', 'Çıkış yapmak istediğinize emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Çıkış Yap', style: 'destructive' },
    ]);
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <AppHeader />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profil */}
        <ProfileCard isim={profileData.isim} eposta={profileData.eposta} uyelik={profileData.uyelik} avatar={profileData.avatar} />

        {/* Mod Toggle */}
        <ModeToggle isCorporate={isCorporate} onToggle={handleToggle} />

        {/* Entegrasyon Butonları */}
        <View style={styles.integrations}>
          <TouchableOpacity style={styles.integrationBtn} activeOpacity={0.7} onPress={handleGmail}>
            <View style={styles.intRow}>
              <View style={[styles.intIcon, { backgroundColor: 'rgba(186,26,26,0.1)' }]}>
                <Text style={{ fontSize: 20 }}>📧</Text>
              </View>
              <View>
                <Text style={styles.intTitle}>Gmail'i Senkronize Et</Text>
                <Text style={styles.intSub}>Fişleri otomatik çıkar</Text>
              </View>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.integrationBtn} activeOpacity={0.7} onPress={handleAI}>
            <View style={styles.intRow}>
              <View style={[styles.intIcon, { backgroundColor: Colors.primaryFixed }]}>
                <Text style={{ fontSize: 20 }}>🧠</Text>
              </View>
              <View>
                <Text style={styles.intTitle}>Yapay Zeka İzinlerini Yönet</Text>
                <Text style={styles.intSub}>Veri erişimini kontrol et</Text>
              </View>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Vergi Bilgileri - Yalnızca Kurumsal mod */}
        {isCorporate && (
          <View style={styles.taxSection}>
            <View style={styles.taxBanner}>
              <Text style={styles.taxBannerIcon}>ℹ️</Text>
              <Text style={styles.taxBannerText}>Kurumsal Modda Görünür</Text>
            </View>
            <View style={styles.taxContent}>
              <View style={styles.taxHeader}>
                <Text style={{ fontSize: 20 }}>🏛️</Text>
                <Text style={styles.taxTitle}>Vergi Bilgileri</Text>
              </View>
              <View style={styles.taxGrid}>
                <View style={styles.taxField}>
                  <Text style={styles.taxLabel}>Şirket Adı</Text>
                  <Text style={styles.taxValue}>{taxData.sirketAdi}</Text>
                </View>
                <View style={styles.taxField}>
                  <Text style={styles.taxLabel}>Vergi No</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={styles.taxValue}>{taxData.vergiNo}</Text>
                    <Text style={{ fontSize: 14 }}>👁️</Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity style={styles.downloadBtn} activeOpacity={0.7}>
                <Text style={styles.downloadBtnText}>Yıllık Rapor İndir</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Ayarlar Listesi */}
        <View style={styles.settingsList}>
          <SettingsRow ikon="🔒" baslik="Güvenlik & Gizlilik" onPress={() => {}} />
          <SettingsRow ikon="🔔" baslik="Bildirim Tercihleri" onPress={() => {}} />
          <SettingsRow ikon="🚪" baslik="Çıkış Yap" tehlike onPress={handleLogout} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surfaceContainerLowest },
  scroll: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.containerMargin, paddingBottom: Spacing.xl + 20, gap: Spacing.xl },
  integrations: { gap: Spacing.sm },
  integrationBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.md, backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.outlineVariant,
  },
  intRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  intIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  intTitle: { ...Typography.bodyMd, fontWeight: '600', color: Colors.onSurface },
  intSub: { ...Typography.labelMd, color: Colors.secondary },
  chevron: { fontSize: 24, color: Colors.outline, fontWeight: '300' },
  taxSection: {
    backgroundColor: Colors.surfaceContainerLowest, borderRadius: BorderRadius.lg,
    overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,185,83,0.3)',
    ...Elevation.level1,
  },
  taxBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    backgroundColor: 'rgba(255,185,83,0.1)', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,185,83,0.2)',
  },
  taxBannerIcon: { fontSize: 14 },
  taxBannerText: { ...Typography.labelMd, color: Colors.tertiary },
  taxContent: { padding: Spacing.md, gap: Spacing.md },
  taxHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  taxTitle: { ...Typography.headlineSm, color: Colors.onSurface },
  taxGrid: { flexDirection: 'row', gap: Spacing.md },
  taxField: { flex: 1 },
  taxLabel: { ...Typography.labelMd, color: Colors.secondary, marginBottom: Spacing.base },
  taxValue: { ...Typography.bodyMd, color: Colors.onSurface },
  downloadBtn: {
    marginTop: Spacing.sm, width: '100%', paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.default, borderWidth: 1, borderColor: Colors.primary, alignItems: 'center',
  },
  downloadBtnText: { ...Typography.bodySm, fontWeight: '600', color: Colors.primary },
  settingsList: {
    backgroundColor: Colors.surfaceContainerLowest, borderRadius: BorderRadius.lg,
    overflow: 'hidden', ...Elevation.level1,
  },
});

export default SettingsScreen;
