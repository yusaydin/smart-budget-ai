<div align="center">

# 💰 Smart Budget AI

### Yapay Zeka Destekli Akıllı Bütçe Yönetim Asistanı

[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-12-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Gemini AI](https://img.shields.io/badge/Gemini_AI-2.5_Flash-8E75B2?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

<br/>

**Smart Budget AI**, kişisel ve kurumsal harcamalarınızı yapay zeka ile otomatik olarak yöneten, fişleri tarayan, Gmail'deki faturalarınızı senkronize eden ve size akıllı finansal öneriler sunan modern bir web uygulamasıdır.

[🚀 Canlı Demo](https://ai.studio/apps/e32c048b-8139-4e01-8287-99a7a26816f2) · [🐛 Hata Bildir](https://github.com/yusaydin/smart-budget-ai/issues) · [💡 Özellik Öner](https://github.com/yusaydin/smart-budget-ai/issues)

</div>

---

## 📋 İçindekiler

- [✨ Özellikler](#-özellikler)
- [🏗️ Mimari](#️-mimari)
- [🛠️ Teknoloji Yığını](#️-teknoloji-yığını)
- [📦 Kurulum](#-kurulum)
- [⚙️ Yapılandırma](#️-yapılandırma)
- [🚀 Çalıştırma](#-çalıştırma)
- [📁 Proje Yapısı](#-proje-yapısı)
- [🤖 Yapay Zeka Özellikleri](#-yapay-zeka-özellikleri)
- [🔐 Güvenlik](#-güvenlik)
- [📄 Lisans](#-lisans)

---

## ✨ Özellikler

### 🧠 Yapay Zeka Entegrasyonu
- **Fiş / Fatura Tarama** — Kamera ile fotoğrafını çekin, Gemini Vision AI anında tutarı, mağazayı, kategoriyi ve tarihi çıkarsın
- **E-posta Fatura Senkronizasyonu** — Gmail'deki fatura ve makbuzlarınızı otomatik tespit edip harcama olarak kaydedin
- **PDF Fatura Analizi** — E-postalara ekli PDF faturaları yapay zeka ile okuyup verileri otomatik çıkarır
- **Aylık Harcama Raporu** — Yapay zeka, harcama alışkanlıklarınızı analiz ederek Türkçe özet rapor üretir
- **Kurumsal Vergi Analizi** — Kurumsal kullanıcılar için vergi indirimi potansiyeli değerlendirmesi

### 📊 Bütçe Yönetimi
- **Görsel Dashboard** — Pasta grafikleri ile kategorik harcama analizi
- **Aylık Bütçe Takibi** — Gelir-gider dengesi, ilerleme çubukları ve uyarı sistemi
- **Kategori Bazlı Limitler** — Her kategoriye özel bütçe limiti belirleme
- **Çoklu Para Birimi** — TRY, USD, EUR, GBP dahil 7+ para birimi desteği
- **Otomatik Döviz Çevirisi** — Farklı para birimlerindeki harcamaları ana para birimine otomatik dönüştürme
- **Düzenli İşlem Yönetimi** — Haftalık, aylık ve yıllık tekrarlayan harcamaları otomatik kayıt

### 🎨 Kullanıcı Deneyimi
- **Modern UI** — Material Design 3 tabanlı şık ve duyarlı arayüz
- **Karanlık/Aydınlık Tema** — Sistem tercihine otomatik uyum veya manuel seçim
- **Akıcı Animasyonlar** — Framer Motion ile profesyonel geçiş efektleri
- **Mobil Öncelikli Tasarım** — Alt navigasyon çubuğu ile mobil dostu deneyim
- **Masaüstü Uyumlu** — Yüzen navigasyon çubuğu ile geniş ekran desteği

### 🔄 Senkronizasyon
- **Gmail Entegrasyonu** — OAuth 2.0 ile güvenli bağlantı
- **Akıllı Filtreleme** — "Purchases" kategorisi, fatura ve makbuz anahtar kelimeleri ile otomatik tespit
- **Etiket/Klasör Filtresi** — Belirli Gmail etiketlerindeki faturaları tarama
- **Frekans Ayarı** — Günlük, haftalık, aylık, 3 ay veya 6 ay aralığında senkronizasyon
- **Duplikasyon Koruması** — Aynı faturanın tekrar eklenmesini engelleme

---

## 🏗️ Mimari

```
┌─────────────────────────────────────────────────────────┐
│                      Frontend (React)                    │
│  ┌──────────┐ ┌──────────┐ ┌─────────┐ ┌────────────┐  │
│  │Dashboard │ │Expense   │ │Sync     │ │ Settings   │  │
│  │  + Chart │ │  List    │ │  View   │ │   View     │  │
│  └────┬─────┘ └────┬─────┘ └───┬─────┘ └─────┬──────┘  │
│       │             │           │              │         │
│       └─────────────┼───────────┼──────────────┘         │
│                     │           │                        │
├─────────────────────┼───────────┼────────────────────────┤
│              AI Layer           │  Backend Layer          │
│  ┌──────────────────┐  ┌───────┴──────────┐             │
│  │  Gemini 2.5 Flash│  │  Gmail API       │             │
│  │  ─ Vision OCR    │  │  ─ OAuth 2.0     │             │
│  │  ─ Email Parse   │  │  ─ Email Fetch   │             │
│  │  ─ Report Gen    │  │  ─ PDF Extract   │             │
│  └────────┬─────────┘  └───────┬──────────┘             │
│           │                    │                        │
├───────────┼────────────────────┼────────────────────────┤
│           │     Firebase       │                        │
│  ┌────────┴────────────────────┴──────────┐             │
│  │  Authentication (Google + Email/Pass)  │             │
│  │  Firestore (users, expenses, reports)  │             │
│  │  Security Rules (row-level security)   │             │
│  └────────────────────────────────────────┘             │
└─────────────────────────────────────────────────────────┘
```

---

## 🛠️ Teknoloji Yığını

| Katman | Teknoloji | Açıklama |
|--------|-----------|----------|
| **Frontend** | React 19, TypeScript 5.8 | Modern komponent mimarisi |
| **Stil** | Tailwind CSS 4 | Utility-first CSS framework |
| **Bundler** | Vite 6 | Hızlı geliştirme ve derleme |
| **Animasyon** | Framer Motion 12 | Akıcı UI geçişleri |
| **Grafik** | Chart.js + react-chartjs-2 | İnteraktif pasta grafikleri |
| **İkonlar** | Lucide React + Material Symbols | Modern ikon setleri |
| **Yapay Zeka** | Google Gemini 2.5 Flash | Vision OCR, NLP, rapor üretimi |
| **Kimlik Doğrulama** | Firebase Auth | Google ve e-posta/şifre |
| **Veritabanı** | Cloud Firestore | Gerçek zamanlı NoSQL |
| **E-posta** | Gmail API | Fatura e-postalarını okuma |
| **Para Birimi** | Fawaz Ahmed Currency API | Gerçek zamanlı döviz kurları |
| **Markdown** | react-markdown | AI raporlarını render etme |
| **Tarih** | date-fns | Türkçe tarih biçimlendirme |

---

## 📦 Kurulum

### Ön Koşullar

- **Node.js** (v18 veya üzeri)
- **npm** veya **yarn**
- **Google Cloud** hesabı (Firebase ve Gemini API için)

### 1. Repoyu Klonlayın

```bash
git clone https://github.com/yusaydin/smart-budget-ai.git
cd smart-budget-ai
```

### 2. Bağımlılıkları Yükleyin

```bash
npm install
```

### 3. Ortam Değişkenlerini Ayarlayın

Proje kök dizininde `.env.local` dosyası oluşturun:

```env
# Gemini AI API Anahtarı (Zorunlu)
# https://aistudio.google.com/app/apikey adresinden alabilirsiniz
GEMINI_API_KEY="your_gemini_api_key_here"

# Uygulama URL'si (Opsiyonel - deployment için)
APP_URL="http://localhost:3000"
```

---

## ⚙️ Yapılandırma

### Firebase Kurulumu

1. [Firebase Console](https://console.firebase.google.com/)'dan yeni bir proje oluşturun
2. **Authentication** bölümünden Google ve Email/Password oturum açma yöntemlerini etkinleştirin
3. **Cloud Firestore** veritabanı oluşturun
4. Firebase yapılandırma bilgilerinizi `firebase-applet-config.json` dosyasına ekleyin

### Gmail API Kurulumu

1. [Google Cloud Console](https://console.cloud.google.com/)'dan Gmail API'yi etkinleştirin
2. OAuth 2.0 istemci kimlik bilgilerini oluşturun
3. Yetkilendirilmiş yönlendirme URI'lerini ekleyin
4. Firebase Authentication'da Google sağlayıcısına `gmail.readonly` kapsamını ekleyin

### Gemini API

1. [Google AI Studio](https://aistudio.google.com/app/apikey) üzerinden API anahtarı oluşturun
2. Anahtarı `.env.local` dosyasındaki `GEMINI_API_KEY` değişkenine atayın

---

## 🚀 Çalıştırma

### Geliştirme Modu

```bash
npm run dev
```

Uygulama `http://localhost:3000` adresinde çalışacaktır.

### Üretim Derlemesi

```bash
npm run build
npm run preview
```

### Diğer Komutlar

| Komut | Açıklama |
|-------|----------|
| `npm run dev` | Geliştirme sunucusunu başlatır (port 3000) |
| `npm run build` | Üretim derlemesi oluşturur |
| `npm run preview` | Üretim derlemesini önizler |
| `npm run lint` | TypeScript tip kontrolü yapar |
| `npm run clean` | `dist` klasörünü temizler |

---

## 📁 Proje Yapısı

```
smart-budget-ai/
├── src/
│   ├── ai/
│   │   └── gemini.ts              # Gemini AI entegrasyonu (OCR, NLP, rapor)
│   ├── backend/
│   │   └── gmail.ts               # Gmail API entegrasyonu
│   └── frontend/
│       ├── App.tsx                 # Ana uygulama bileşeni & state yönetimi
│       ├── main.tsx                # React giriş noktası
│       ├── index.css               # Global stiller & tema tanımları
│       ├── components/
│       │   ├── AddExpenseModal.tsx  # Fiş tarama & manuel harcama ekleme
│       │   ├── AuthScreen.tsx      # Giriş/Kayıt ekranı
│       │   ├── Dashboard.tsx       # Ana panel, grafikler, bütçe özeti
│       │   ├── ExpenseItem.tsx     # Tekil harcama kartı
│       │   ├── ExpenseListView.tsx # Harcama listesi görünümü
│       │   ├── LoadingScreen.tsx   # Yükleme animasyonu
│       │   ├── NavButton.tsx       # Navigasyon butonları
│       │   ├── SettingsView.tsx    # Ayarlar paneli
│       │   └── SyncView.tsx        # Gmail senkronizasyon paneli
│       ├── constants/
│       │   └── index.ts            # Varsayılan kategoriler, para birimleri
│       ├── lib/
│       │   ├── firebase.ts         # Firebase başlatma & yardımcı fonksiyonlar
│       │   └── utils.ts            # Döviz çevirme & biçimlendirme
│       └── types/
│           └── index.ts            # TypeScript tip tanımlamaları
├── firebase-applet-config.json     # Firebase proje yapılandırması
├── firebase-blueprint.json         # Firestore veri şeması
├── firestore.rules                 # Firestore güvenlik kuralları
├── index.html                      # HTML giriş noktası
├── vite.config.ts                  # Vite yapılandırması
├── tsconfig.json                   # TypeScript yapılandırması
├── package.json                    # Proje bağımlılıkları & scriptler
└── .env.example                    # Ortam değişkenleri şablonu
```

---

## 🤖 Yapay Zeka Özellikleri

### Fiş/Fatura OCR Tarama

Kamera ile çekilen fiş fotoğraflarından yapay zeka otomatik olarak şu bilgileri çıkarır:

| Alan | Açıklama |
|------|----------|
| **Tutar** | Toplam ödeme miktarı |
| **Para Birimi** | TRY, USD, EUR vb. |
| **Kategori** | Otomatik harcama kategorisi |
| **Mağaza** | İşletme / satıcı adı |
| **Tarih** | İşlem tarihi (ISO 8601) |
| **Açıklama** | Ürünlerin kısa özeti |
| **Kurumsal** | İş gideri olma potansiyeli |

### Gmail Fatura Analizi

E-postalardaki fatura ve makbuzları tespit etmek için kullanılan akıllı filtreler:

- Gmail `category:purchases` otomatik kategorisi
- Anahtar kelimeler: `receipt`, `invoice`, `fatura`, `order`, `sipariş`, `payment`, `ödeme`, `makbuz`
- PDF ekleri otomatik olarak işlenir (2MB sınırı)
- Duplikasyon koruması ile tekrar ekleme önlenir

### Aylık Rapor Üretimi

Yapay zeka tarafından üretilen Türkçe rapor şunları içerir:

1. 📈 Harcama alışkanlıklarının özeti
2. 💡 Tasarruf yapılabilecek en iyi 3 kategori
3. 🏢 Kurumsal kullanıcılar için vergi indirimi tavsiyeleri
4. 💪 Motivasyonel kapanış mesajı

---

## 🔐 Güvenlik

### Firestore Güvenlik Kuralları

Uygulama, satır düzeyinde (row-level) güvenlik kuralları uygular:

- ✅ Kullanıcılar yalnızca **kendi verilerini** okuyabilir ve yazabilir
- ✅ Her yazma işlemi veri doğrulamasından geçer
- ✅ Kullanıcı silme işlemi devre dışıdır
- ✅ Rapor düzenleme/silme işlemi devre dışıdır
- ✅ Varsayılan kural: erişim reddedilir (deny-all)

### Kimlik Doğrulama

- **Google OAuth 2.0** — Tek tıkla güvenli giriş
- **E-posta/Şifre** — Klasik kimlik doğrulama
- Gmail token'ları yerel depolama ile 55 dakika önbelleğe alınır

---

## 🗺️ Yol Haritası

- [ ] Bütçe aşım bildirimleri (push notification)
- [ ] Harcama dışa aktarma (CSV/PDF)
- [ ] Çoklu hesap desteği (aile bütçesi)
- [ ] Gelir kaydı ve gelir-gider detaylı analizi
- [ ] PWA desteği (çevrimdışı erişim)
- [ ] Aylık bütçe karşılaştırma grafikleri

---

## 🤝 Katkıda Bulunma

Katkılarınızı memnuniyetle karşılıyoruz! Lütfen aşağıdaki adımları izleyin:

1. Projeyi **fork**'layın
2. Yeni bir **branch** oluşturun (`git checkout -b feature/yeni-ozellik`)
3. Değişikliklerinizi **commit**'leyin (`git commit -m 'feat: yeni özellik eklendi'`)
4. Branch'inizi **push**'layın (`git push origin feature/yeni-ozellik`)
5. Bir **Pull Request** açın

---

## 📄 Lisans

Bu proje açık kaynak olarak geliştirilmektedir. Detaylar için [LICENSE](LICENSE) dosyasına bakınız.

---

<div align="center">

**⭐ Bu projeyi beğendiyseniz yıldız vermeyi unutmayın!**

Geliştirici: [Yusuf Aydın](https://github.com/yusaydin)

</div>
