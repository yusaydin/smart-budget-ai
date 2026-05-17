/**
 * DashboardScreen - Ana Ekran
 * Toplam bakiye, gelir/gider kartları, AI insight paneli, kategori çubuk grafikleri.
 */
import React, { useCallback } from 'react';
import { View, ScrollView, Text, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppHeader from '../components/AppHeader';
import BalanceCard from '../components/BalanceCard';
import StatCard from '../components/StatCard';
import InsightPanel from '../components/InsightPanel';
import CategoryBar from '../components/CategoryBar';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing, BorderRadius, Elevation } from '../theme/spacing';
import { balanceData, aiInsight, categories } from '../data/mockData';

const DashboardScreen = () => {
  const handleInsightPress = useCallback(() => {
    Alert.alert(
      'AI Detayları',
      'Yemek harcamalarınızın detaylı analizi burada gösterilecektir.',
      [{ text: 'Tamam' }]
    );
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <AppHeader />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Bakiye Bölümü */}
        <View style={styles.balanceSection}>
          <BalanceCard bakiye={balanceData.toplamBakiye} />
          <View style={styles.statRow}>
            <StatCard
              label="Aylık Gelir"
              tutar={balanceData.aylikGelir}
              tip="gelir"
            />
            <StatCard
              label="Aylık Gider"
              tutar={balanceData.aylikGider}
              tip="gider"
            />
          </View>
        </View>

        {/* AI Insight Paneli */}
        <InsightPanel
          baslik={aiInsight.baslik}
          mesaj={aiInsight.mesaj}
          butonMetni={aiInsight.butonMetni}
          onPress={handleInsightPress}
        />

        {/* Harcama Kategorileri */}
        <View style={styles.categoriesCard}>
          <View style={styles.categoriesHeader}>
            <Text style={styles.categoriesTitle}>Harcama Kategorileri</Text>
            <Text style={styles.moreIcon}>•••</Text>
          </View>
          <View style={styles.categoriesList}>
            {categories.map((cat) => (
              <CategoryBar
                key={cat.id}
                isim={cat.isim}
                tutar={cat.tutar}
                yuzde={cat.yuzde}
                renk={cat.renk}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  scrollView: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  contentContainer: {
    padding: Spacing.containerMargin,
    paddingBottom: Spacing.xl + 20,
    gap: Spacing.xl,
  },
  balanceSection: {
    gap: Spacing.sm,
  },
  statRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  categoriesCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Elevation.level1,
  },
  categoriesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoriesTitle: {
    ...Typography.headlineSm,
    color: Colors.onBackground,
  },
  moreIcon: {
    fontSize: 18,
    color: Colors.onSurfaceVariant,
    letterSpacing: 2,
  },
  categoriesList: {
    gap: Spacing.sm,
  },
});

export default DashboardScreen;
