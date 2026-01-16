# ATÜ Ders Yönetim Sistemi

Adana Alparslan Türkeş Bilim ve Teknoloji Üniversitesi için geliştirilmiş, tam kapsamlı ders ve materyal yönetim sistemi. Eğitim görevlilerinin ders materyalleri yüklemesine, öğrencilerin erişmesine ve yöneticilerin sistemi yönetmesine olanak tanır.Bu Proje CLAUDECODE ile yapılmıştır.Javascript ve Html bilgimle bu kadar detaylı bir proje geliştirmem mümkün değildi fakat ClaudeCode ile yaparak teknik kısımlarda hataları anlayabilirdim.Bu yüzden claude code ile kodladım ve projemi oluşturdum.

## 📋 Özellikler

### Kullanıcı Rolleri

- **Admin**: Sistemi yönetir, kullanıcılar/öğretim görevlileri/öğrenciler ekler, ders atar
- **Eğitim Görevlisi (Instructor)**: Ders materyalleri yükler, yönetir, öğrenci notlarını girer
- **Öğrenci (Student)**: Ders materyallerine erişir, notlarını görüntüler, dersleri değerlendirir

### Temel Özellikler

- ✅ Kullanıcı Yönetimi (Admin paneli)
- ✅ Fakülte ve Bölüm Yönetimi
- ✅ Ders Atama Sistemi
- ✅ Materyal Yükleme (PDF, DOCX, PPTX, XLSX, ZIP - maksimum 100MB)
- ✅ Sürüm Kontrolü (Aynı dosya için yeni sürüm oluşturma)
- ✅ Not Yönetimi
- ✅ Ders Değerlendirme Sistemi
- ✅ Ders Notları Yönetimi
- ✅ Dosya Yükleme İlerleme Çubuğu
- ✅ Sürükle-Bırak Yükleme Arayüzü
- ✅ SQLite Veritabanı (otomatik oluşturulur)
- ✅ Geçici Depolama ile Güvenli Yükleme

## 🛠️ Teknoloji Yığını

- **Backend**: Node.js + Express + TypeScript
- **Frontend**: HTML + CSS + Vanilla JavaScript (framework yok)
- **Veritabanı**: SQLite (sql.js)
- **Dosya Depolama**: Local disk (`./storage`)

## 📁 Proje Yapısı

```
Project2/
├── server/
│   ├── src/
│   │   ├── db/
│   │   │   └── schema.ts           # Veritabanı şeması ve seed verileri
│   │   ├── routes/
│   │   │   ├── auth.ts             # Kimlik doğrulama endpoint'leri
│   │   │   ├── users.ts            # Kullanıcı yönetimi
│   │   │   ├── faculties.ts        # Fakülte yönetimi
│   │   │   ├── departments.ts      # Bölüm yönetimi
│   │   │   ├── courses.ts          # Ders yönetimi
│   │   │   ├── materials.ts        # Materyal yükleme
│   │   │   ├── grades.ts           # Not yönetimi
│   │   │   ├── ratings.ts          # Ders değerlendirme
│   │   │   ├── lectureNotes.ts     # Ders notları
│   │   │   └── enrollments.ts      # Ders kayıtları
│   │   ├── services/
│   │   │   ├── auth.ts             # JWT/session işlemleri
│   │   │   └── fileUpload.ts       # Dosya yükleme validasyonu
│   │   ├── middleware/
│   │   │   └── auth.ts             # Kimlik doğrulama middleware
│   │   ├── config/
│   │   │   └── index.ts            # Yapılandırma
│   │   └── index.ts                # Ana server giriş noktası
│   └── db.sqlite                   # SQLite veritabanı (otomatik)
├── client/
│   ├── login.html                  # Giriş sayfası
│   ├── index.html                  # Ana panel (öğrenci/eğitmen)
│   ├── admin.html                  # Admin paneli
│   ├── styles.css                  # Tüm stiller
│   ├── auth.js                     # Kimlik doğrulama
│   ├── index.js                    # Ana sayfa mantığı
│   ├── admin.js                    # Admin paneli mantığı
│   └── course.js                   # Ders sayfası mantığı
├── storage/
│   ├── tmp/                        # Geçici yükleme dosyaları
│   └── course_*/                   # Ders dosyaları
├── package.json
├── tsconfig.json
├── .env
└── README.md
```

## 🚀 Kurulum ve Başlatma

### Gereksinimler

- Node.js 18+ (native fetch desteği için)

### Hızlı Başlatma

**GitHub'dan indirdikten sonra:**

1. Bağımlılıkları yükleyin:
   ```bash
   npm install
   ```

2. `baslat.bat` dosyasına çift tıklayın

3. Tarayıcıda otomatik açılacak veya manuel olarak açın:
   ```
   http://localhost:3000/login.html
   ```

### Alternatif Başlatma (Komut Satırı)

```bash
npm run dev
```

## 📜 Kullanılabilir Komutlar

| Komut           | Açıklama                                       |
| --------------- | ---------------------------------------------- |
| `npm run dev`   | tsx ile geliştirme sunucusunu başlatır         |
| `npm run check` | Health kontrolü yapar (localhost:3000)         |
| `npm run clean` | Geçici yükleme dosyalarını temizler            |
| `npm run build` | TypeScript'i JavaScript'e derler               |
| `npm start`     | Derlenmiş sunucuyu dist/ dizininden çalıştırır |

## 👥 Test Hesapları

Sistem ilk çalıştırıldığında otomatik olarak aşağıdaki test hesapları oluşturulur:

### 🔐 Admin Hesabı

| E-posta            | Şifre      | ID  |
| ------------------ | ---------- | --- |
| `admin@atu.edu.tr` | `admin123` | 1   |

### 👨‍🏫 Eğitim Görevlileri (Instructors)

| E-posta                   | Şifre           | Ad Soyad     |
| ------------------------- | --------------- | ------------ |
| `instructor@atu.edu.tr`   | `instructor123` | -            |
| `ahmet.yilmaz@atu.edu.tr` | `instructor123` | Ahmet Yılmaz |
| `ayse.demir@atu.edu.tr`   | `instructor123` | Ayşe Demir   |

### 🎓 Öğrenciler (Students)

| E-posta                      | Şifre        | Ad Soyad    |
| ---------------------------- | ------------ | ----------- |
| `student@ogr.atu.edu.tr`     | `student123` | -           |
| `mehmet.kaya@ogr.atu.edu.tr` | `student123` | Mehmet Kaya |
| `fatma.celik@ogr.atu.edu.tr` | `student123` | Fatma Çelik |
| `ali.yildiz@ogr.atu.edu.tr`  | `student123` | Ali Yıldız  |

### 📚 Seed Verileri

**Fakülteler (5 adet)**:

- Mühendislik Fakültesi
- Fen Edebiyat Fakültesi
- İktisadi ve İdari Bilimler Fakültesi
- Sağlık Bilimleri Fakültesi
- Güzel Sanatlar Fakültesi

**Bölümler (32 adet)** - Her fakültede çeşitli bölümler

**Mevcut Dersler**:

1. Yazılım Mühendisliği (ID: 1)
2. Veri Yapıları (ID: 2)
3. İşletme Yönetimi (ID: 3)

## 🎯 Kullanım Kılavuzu

### Admin İşlemleri

1. **Giriş Yap**: `admin@atu.edu.tr` / `admin123`
2. **Kullanıcı Ekle**: "Kullanıcılar" sekmesinden yeni kullanıcı ekleyin
3. **Fakülte/Bölüm Yönetimi**: ilgili sekmelerden ekleyin/düzenleyin
4. **Ders Atama**:
   - "Kullanıcılar" sekmesine gidin
   - Bir eğitmen bulun
   - "Ders Ata" butonuna tıklayın
   - Ders adını, fakülte ve bölümü seçin
   - "Dersi Ata" butonuna tıklayın

### Eğitim Görevlisi İşlemleri

1. **Giriş Yap**: Herhangi bir eğitmen hesabı ile giriş yapın
2. **Dersleri Görüntüle**: Atanan dersleri ana sayfada görün
3. **Materyal Yükle**:
   - Bir derse tıklayın
   - "Materyal Yükle" butonuna tıklayın
   - Dosya seçin (PDF, DOCX, PPTX, XLSX, ZIP)
   - Açıklama ekleyin
   - "Yükle" butonuna tıklayın
4. **Not Girişi**: "Notlar" sekmesinden öğrenci notlarını girin
5. **Ders Notları**: Ders notlarınızı paylaşın

### Öğrenci İşlemleri

1. **Giriş Yap**: Herhangi bir öğrenci hesabı ile giriş yapın
2. **Derslerime Katıl**: Kayıtlı derslerinizi görün
3. **Materyal İndir**: Ders materyallerini indirin
4. **Notlarımı Gör**: Notlarınızı görüntüleyin
5. **Ders Değerlendir**: Katıldığınız dersleri değerlendirin

## 🔧 Yapılandırma

`.env` dosyasını düzenleyerek özelleştirin:

```env
PORT=3000
MAX_FILE_MB=100
NOTIFICATIONS_ENABLED=true
STORAGE_PATH=./storage
SESSION_SECRET=your-secret-key-here
```

## 📡 API Endpoint'leri

### Kimlik Doğrulama

```
POST /api/auth/login       - Giriş yap
POST /api/auth/logout      - Çıkış yap
GET  /api/auth/me          - Mevcut kullanıcı bilgisi
```

### Kullanıcılar

```
GET    /api/users          - Tüm kullanıcıları listele
POST   /api/users          - Yeni kullanıcı ekle
PUT    /api/users/:id      - Kullanıcı güncelle
DELETE /api/users/:id      - Kullanıcı sil
```

### Fakülteler ve Bölümler

```
GET    /api/faculties              - Tüm fakülteleri listele
POST   /api/faculties              - Fakülte ekle
PUT    /api/faculties/:id          - Fakülte güncelle
DELETE /api/faculties/:id          - Fakülte sil
GET    /api/departments            - Tüm bölümleri listele
POST   /api/departments            - Bölüm ekle
PUT    /api/departments/:id        - Bölüm güncelle
DELETE /api/departments/:id        - Bölüm sil
```

### Dersler

```
GET    /api/courses                - Tüm dersleri listele
POST   /api/courses                - Yeni ders oluştur/ata
DELETE /api/courses/:id            - Ders sil
GET    /api/courses/:id            - Ders detayları
GET    /api/courses?instructorId=X - Eğitmene ait dersler
GET    /api/courses?studentId=X    - Öğrencinin dersleri
```

### Materyaller

```
GET    /api/courses/:id/materials              - Ders materyallerini listele
POST   /api/courses/:id/materials/upload       - Materyal yükle
DELETE /api/materials/:id                      - Materyal sil
```

### Kayıt İşlemleri

```
POST   /api/enrollments        - Ders kaydı oluştur
DELETE /api/enrollments/:id    - Ders kaydı sil
```

## 🔒 Güvenlik Notları

- Dosya yükleme doğrulama (uzantı + MIME tipi)
- Dosya boyutu sınırlaması (100MB)
- Geçici depolama ile otomatik temizleme
- SQL injection koruması (prepared statements)
- Path traversal koruması
- Session tabanlı kimlik doğrulama
- Rol tabanlı erişim kontrolü (RBAC)

## 🐛 Hata Yönetimi

| Hata Kodu | Açıklama                  |
| --------- | ------------------------- |
| E1        | Desteklenmeyen dosya türü |
| E2        | Dosya boyutu çok büyük    |
| E3        | Yinelenen dosya adı       |
| E4        | Depolama hatası           |
| E5        | Yetkisiz erişim           |
| E6        | Bulunamadı (404)          |

## 📄 Lisans

MIT

## 👨‍💻 Geliştiriciler

Bu proje Adana Alparslan Türkeş Bilim ve Teknoloji Üniversitesi için geliştirilmiştir.

---

**Not**: Bu sistem eğitim amaçlıdır. Tüm kullanıcı bilgileri ve şifreler test verisidir. Canlı ortamda kullanmadan önce güvenlik önlemlerini alın ve şifreleri güncelleyin.
