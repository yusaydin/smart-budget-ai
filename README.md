# 💰 Smart Budget AI — Akıllı Bütçe Yöneticisi

> AI destekli kişisel ve kurumsal finans asistanı. Harcamalarınızı otomatik kategorize eder, fiş/fatura tarar ve akıllı finansal öneriler sunar.

[![Gemini AI](https://img.shields.io/badge/Powered%20by-Gemini%20AI-4285F4?logo=google&logoColor=white)](https://ai.google.dev)
[![Firebase](https://img.shields.io/badge/Backend-Firebase-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com)
[![React](https://img.shields.io/badge/Frontend-React%2019-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Build-Vite%206-646CFF?logo=vite&logoColor=white)](https://vite.dev)

---

## 🌟 Özellikler

- 📸 **Fiş/Fatura Tarama** — Kamera ile fiş çekin, Gemini AI otomatik analiz etsin
- 📧 **Gmail Senkronizasyonu** — E-posta faturalarını otomatik çek ve kategorize et
- 🤖 **AI Analiz** — Harcama alışkanlıklarınızı analiz eden yapay zeka raporu
- 📊 **Dashboard** — Aylık gelir/gider takibi ve kategori bazlı grafikler
- 🏢 **Kurumsal Mod** — Vergi indirimi önerileri ve kurumsal gider yönetimi
- 💱 **Otomatik Döviz Çevirme** — Farklı para birimlerini otomatik dönüştür
- 🔐 **Google Auth + Firebase** — Güvenli kimlik doğrulama ve veri depolama
- 🌙 **Dark Mode** — Karanlık tema desteği

## 🏗️ Teknoloji Yığını

| Katman | Teknoloji |
|--------|-----------|
| **Frontend** | React 19, TypeScript, Tailwind CSS 4, Framer Motion |
| **AI** | Google Gemini 2.5 Flash (Fiş analizi, kategorizasyon, rapor) |
| **Backend** | Firebase Auth, Cloud Firestore |
| **E-posta** | Gmail API (OAuth2 ile otomatik fatura çekme) |
| **Build** | Vite 6, ESM |
| **Grafik** | Chart.js + react-chartjs-2 |

## 📁 Proje Yapısı

```
smart-budget-ai/
├── src/
│   ├── frontend/           # React web uygulaması
│   │   ├── App.tsx         # Ana uygulama bileşeni
│   │   ├── main.tsx        # Entry point
│   │   ├── index.css       # Tema ve stiller (Tailwind + Material Design 3)
│   │   ├── components/     # UI bileşenleri (Dashboard, Auth, Settings...)
│   │   ├── lib/            # Firebase, utility fonksiyonları
│   │   ├── types/          # TypeScript tipleri
│   │   └── constants/      # Sabit değerler (kategoriler, para birimleri)
│   ├── ai/
│   │   └── gemini.ts       # Gemini AI entegrasyonu (fiş analizi, rapor)
│   └── backend/
│       └── gmail.ts        # Gmail API entegrasyonu
├── arayuz/                 # UI tasarım referansları (HTML mockup'lar)
├── index.html              # Vite entry HTML
├── vite.config.ts          # Vite yapılandırması
├── tsconfig.json           # TypeScript yapılandırması
├── package.json            # Bağımlılıklar ve script'ler
├── firebase-applet-config.json
├── firebase-blueprint.json
├── firestore.rules         # Firestore güvenlik kuralları
├── metadata.json           # Uygulama metadata
└── .env.example            # Ortam değişkenleri şablonu
```

## 🚀 Kurulum & Çalıştırma

### Gereksinimler
- Node.js 18+
- Google Gemini API Key
- Firebase projesi (opsiyonel, Gmail sync için)

### Adımlar

```bash
# 1. Repoyu klonla
git clone https://github.com/yusaydin/smart-budget-ai.git
cd smart-budget-ai

# 2. Bağımlılıkları yükle
npm install

# 3. Ortam değişkenlerini ayarla
cp .env.example .env.local
# .env.local dosyasına GEMINI_API_KEY'inizi yazın

# 4. Uygulamayı başlat
npm run dev
```

Uygulama varsayılan olarak `http://localhost:5173` adresinde açılır.

## 📱 Ekran Görüntüleri

Arayüz tasarımları `arayuz/` klasöründe bulunmaktadır:
- **Panel** — Ana dashboard tasarımı
- **Fiş Tarama** — Fiş/fatura okuma arayüzü
- **Giriş Yap** — Login ekranı
- **Kayıt** — Kayıt ekranı

## 🤝 Katkıda Bulunanlar

Bu proje bir hackathon kapsamında geliştirilmiştir.

## 📄 Lisans

Bu proje MIT lisansı altındadır.
