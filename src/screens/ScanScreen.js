/**
 * ScanScreen - Tarama (OCR) Ekranı
 */
import React, { useRef, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet, Dimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppHeader from '../components/AppHeader';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';

const { width: SW } = Dimensions.get('window');
const FW = SW - 80;
const FH = FW * (4 / 3);

const ScanScreen = () => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 2500, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 2500, useNativeDriver: true }),
      ])
    );
    a.start();
    return () => a.stop();
  }, [anim]);

  const tY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, FH - 4] });

  const onCapture = useCallback(() => {
    Alert.alert('Fiş Taranıyor', 'Fotoğraf çekildi. AI işleme başlıyor...\n\nAI Güven Skoru: %94', [{ text: 'Tamam' }]);
  }, []);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <AppHeader />
      <View style={s.cam}>
        <View style={s.overlay} />
        <View style={s.pill}>
          <Text style={s.pillIcon}>✅</Text>
          <Text style={s.pillText}>AI Güven Skoru: %94 Doğruluk</Text>
        </View>
        <View style={s.frame}>
          <View style={[s.c, s.cTL]} />
          <View style={[s.c, s.cTR]} />
          <View style={[s.c, s.cBL]} />
          <View style={[s.c, s.cBR]} />
          <View style={s.receipt}>
            <View style={s.rLine} />
            <View style={[s.rLine, { width: '80%' }]} />
            <View style={s.rDiv} />
            <View style={[s.rLine, { width: '60%' }]} />
            <View style={[s.rLine, { width: '90%' }]} />
            <View style={[s.rLine, { width: '50%' }]} />
            <View style={s.rDiv} />
            <View style={[s.rLine, { width: '70%' }]} />
          </View>
          <Animated.View style={[s.scanLine, { transform: [{ translateY: tY }] }]} />
        </View>
        <View style={s.bottom}>
          <View style={s.instrBg}>
            <Text style={s.instrText}>Fişi çerçeve içine yerleştirin</Text>
          </View>
          <TouchableOpacity style={s.capBtn} activeOpacity={0.8} onPress={onCapture}>
            <View style={s.capInner}>
              <Text style={{ fontSize: 30 }}>📷</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surfaceContainerLowest },
  cam: { flex: 1, backgroundColor: '#1a1c20', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.xl },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(24,28,32,0.4)' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, backgroundColor: 'rgba(247,249,254,0.85)', borderRadius: BorderRadius.full, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', zIndex: 10 },
  pillIcon: { fontSize: 14 },
  pillText: { ...Typography.labelMd, color: Colors.onSurface },
  frame: { width: FW, height: FH, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: BorderRadius.default, position: 'relative', overflow: 'hidden', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  c: { position: 'absolute', width: 36, height: 36, borderColor: '#fff' },
  cTL: { top: -1, left: -1, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 8 },
  cTR: { top: -1, right: -1, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 8 },
  cBL: { bottom: -1, left: -1, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 8 },
  cBR: { bottom: -1, right: -1, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 8 },
  receipt: { width: '60%', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4, padding: Spacing.md, gap: 8, transform: [{ rotate: '-3deg' }] },
  rLine: { height: 3, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, width: '100%' },
  rDiv: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', width: '100%', marginVertical: 4 },
  scanLine: { position: 'absolute', left: 8, right: 8, height: 2, backgroundColor: 'rgba(146,204,255,0.8)', borderRadius: 1, shadowColor: '#92ccff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 12 },
  bottom: { alignItems: 'center', gap: Spacing.lg, zIndex: 10 },
  instrBg: { backgroundColor: 'rgba(0,0,0,0.3)', paddingHorizontal: Spacing.sm, paddingVertical: Spacing.base, borderRadius: BorderRadius.md },
  instrText: { ...Typography.bodyMd, color: '#fff', textAlign: 'center' },
  capBtn: { width: 88, height: 88, borderRadius: 44, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.5)' },
  capInner: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', elevation: 3 },
});

export default ScanScreen;
