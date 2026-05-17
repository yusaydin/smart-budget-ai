/**
 * TransactionsScreen - İşlemler Ekranı
 * Filtre chip'leri + özet kartı + tarih gruplı işlem listesi (SectionList).
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  SectionList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppHeader from '../components/AppHeader';
import TransactionCard from '../components/TransactionCard';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing, BorderRadius, Elevation } from '../theme/spacing';
import { transactions, buAyToplam, filterChips } from '../data/mockData';

const TransactionsScreen = () => {
  const [activeFilter, setActiveFilter] = useState('all');

  const handleFilterPress = useCallback((filterId) => {
    setActiveFilter(filterId);
  }, []);

  const formattedTotal = useMemo(() => {
    const prefix = buAyToplam < 0 ? '-' : '';
    return `${prefix}₺${Math.abs(buAyToplam).toLocaleString('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }, []);

  const filteredSections = useMemo(() => {
    if (activeFilter === 'all') return transactions;

    const filterMap = {
      ocr: 'OCR',
      gmail: 'Gmail',
      manual: 'Manuel',
    };

    const kaynakFiltre = filterMap[activeFilter];
    return transactions
      .map((section) => ({
        ...section,
        veri: section.veri.filter((t) => t.kaynak === kaynakFiltre),
      }))
      .filter((section) => section.veri.length > 0);
  }, [activeFilter]);

  const renderSectionHeader = useCallback(({ section }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.baslik}</Text>
    </View>
  ), []);

  const renderItem = useCallback(({ item }) => (
    <TransactionCard
      isim={item.isim}
      aciklama={item.aciklama}
      tutar={item.tutar}
      ikon={item.ikon}
      ikonArkaPlan={item.ikonArkaPlan}
      kaynak={item.kaynak}
    />
  ), []);

  const keyExtractor = useCallback((item) => item.id, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <AppHeader />
      <View style={styles.container}>
        {/* Başlık */}
        <Text style={styles.screenTitle}>İşlemler</Text>

        {/* Filtre Chip'leri */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContainer}
        >
          {filterChips.map((chip) => (
            <TouchableOpacity
              key={chip.id}
              style={[
                styles.filterChip,
                activeFilter === chip.id && styles.filterChipActive,
              ]}
              activeOpacity={0.7}
              onPress={() => handleFilterPress(chip.id)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  activeFilter === chip.id && styles.filterChipTextActive,
                ]}
              >
                {chip.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Aylık Toplam Kartı */}
        <View style={styles.summaryCard}>
          <View>
            <Text style={styles.summaryLabel}>BU AY TOPLAM</Text>
            <Text style={styles.summaryAmount}>{formattedTotal}</Text>
          </View>
          <View style={styles.summaryIcon}>
            <Text style={styles.summaryIconText}>📊</Text>
          </View>
        </View>

        {/* İşlem Listesi */}
        <SectionList
          sections={filteredSections.map((s) => ({
            ...s,
            data: s.veri,
          }))}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
          SectionSeparatorComponent={() => <View style={styles.sectionSeparator} />}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  screenTitle: {
    ...Typography.headlineMd,
    color: Colors.onSurface,
    paddingHorizontal: Spacing.containerMargin,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  filterScroll: {
    flexGrow: 0,
    marginBottom: Spacing.md,
  },
  filterContainer: {
    paddingHorizontal: Spacing.containerMargin,
    gap: Spacing.xs,
  },
  filterChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    ...Typography.labelMd,
    color: Colors.onSurfaceVariant,
  },
  filterChipTextActive: {
    color: Colors.onPrimary,
  },
  summaryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: Spacing.containerMargin,
    marginBottom: Spacing.lg,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    ...Elevation.level1,
  },
  summaryLabel: {
    ...Typography.labelMd,
    color: Colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  summaryAmount: {
    ...Typography.headlineLg,
    color: Colors.onSurface,
  },
  summaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(32, 122, 179, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryIconText: {
    fontSize: 22,
  },
  sectionHeader: {
    paddingBottom: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.labelMd,
    color: Colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  listContainer: {
    paddingHorizontal: Spacing.containerMargin,
    paddingBottom: Spacing.xl + 20,
  },
  itemSeparator: {
    height: Spacing.sm,
  },
  sectionSeparator: {
    height: Spacing.lg,
  },
});

export default TransactionsScreen;
