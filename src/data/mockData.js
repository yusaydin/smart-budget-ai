/**
 * BudgetAI Mock (Sahte) Veriler
 * Tüm metinler Türkçe'dir.
 */

export const balanceData = {
  toplamBakiye: 87450.0,
  aylikGelir: 32500.0,
  aylikGider: 18240.0,
};

export const aiInsight = {
  baslik: 'AI Finansal Check-up',
  mesaj:
    'Geçen aya göre dışarıda yemek harcaman %15 arttı. Bu hafta sonu evde yemek yaparak bütçende kalabilirsin.',
  butonMetni: 'Detayları Gör',
};

export const categories = [
  {
    id: '1',
    isim: 'Yemek',
    tutar: 4200.0,
    yuzde: 75,
    renk: '#2980b9',
  },
  {
    id: '2',
    isim: 'Market',
    tutar: 3100.0,
    yuzde: 55,
    renk: '#7f5300',
  },
  {
    id: '3',
    isim: 'Ulaşım',
    tutar: 1850.0,
    yuzde: 30,
    renk: '#546067',
  },
  {
    id: '4',
    isim: 'Abonelikler',
    tutar: 650.0,
    yuzde: 15,
    renk: '#707880',
  },
];

export const transactions = [
  {
    id: '1',
    baslik: 'Bugün',
    veri: [
      {
        id: 't1',
        isim: 'Starbucks',
        aciklama: 'Kahve & Pasta',
        tutar: -85.5,
        ikon: '☕',
        ikonRenk: '#a06900',
        ikonArkaPlan: 'rgba(160, 105, 0, 0.1)',
        kaynak: 'OCR',
        tarih: '10 May 2026',
      },
      {
        id: 't2',
        isim: 'Amazon',
        aciklama: 'Ofis Malzemeleri',
        tutar: -642.99,
        ikon: '🛍️',
        ikonRenk: '#2980b9',
        ikonArkaPlan: 'rgba(41, 128, 185, 0.1)',
        kaynak: 'Gmail',
        tarih: '10 May 2026',
      },
      {
        id: 't3',
        isim: 'Migros',
        aciklama: 'Haftalık Market',
        tutar: -435.2,
        ikon: '🛒',
        ikonRenk: '#2e7d32',
        ikonArkaPlan: 'rgba(46, 125, 50, 0.1)',
        kaynak: 'OCR',
        tarih: '10 May 2026',
      },
    ],
  },
  {
    id: '2',
    baslik: 'Dün',
    veri: [
      {
        id: 't4',
        isim: 'Uber',
        aciklama: 'Havalimanı Transferi',
        tutar: -215.2,
        ikon: '🚗',
        ikonRenk: '#546067',
        ikonArkaPlan: 'rgba(84, 96, 103, 0.1)',
        kaynak: 'Manuel',
        tarih: '9 May 2026',
      },
      {
        id: 't5',
        isim: 'CarrefourSA',
        aciklama: 'Market Alışverişi',
        tutar: -1820.5,
        ikon: '🛒',
        ikonRenk: '#7f5300',
        ikonArkaPlan: 'rgba(127, 83, 0, 0.1)',
        kaynak: 'OCR',
        tarih: '9 May 2026',
      },
    ],
  },
  {
    id: '3',
    baslik: 'Bu Hafta',
    veri: [
      {
        id: 't6',
        isim: 'Netflix',
        aciklama: 'Aylık Abonelik',
        tutar: -99.99,
        ikon: '🎬',
        ikonRenk: '#ba1a1a',
        ikonArkaPlan: 'rgba(186, 26, 26, 0.1)',
        kaynak: 'Gmail',
        tarih: '7 May 2026',
      },
      {
        id: 't7',
        isim: 'Shell',
        aciklama: 'Yakıt',
        tutar: -750.0,
        ikon: '⛽',
        ikonRenk: '#546067',
        ikonArkaPlan: 'rgba(84, 96, 103, 0.1)',
        kaynak: 'Manuel',
        tarih: '6 May 2026',
      },
    ],
  },
];

export const buAyToplam = -4049.38;

export const profileData = {
  isim: 'Ayşe Yılmaz',
  eposta: 'ayse.yilmaz@ornek.com',
  uyelik: 'Pro Üye',
  avatar: 'AY', // İnisyaller
};

export const taxData = {
  sirketAdi: 'Yılmaz Teknoloji A.Ş.',
  vergiNo: '**-***4921',
};

export const filterChips = [
  { id: 'all', label: 'Tümü' },
  { id: 'ocr', label: 'OCR Taramaları' },
  { id: 'gmail', label: 'Gmail' },
  { id: 'manual', label: 'Manuel' },
];
