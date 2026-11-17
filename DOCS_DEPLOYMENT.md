# Dokumentasi Instalasi & Deployment — KaryaLoka (Portofolio Digital Modern)

## 1. Struktur Folder Lengkap
```text
├── public/
│   ├── icon.svg
│   ├── pwa-192x192.png
│   ├── pwa-512x512.png
│   ├── pwa-maskable-512x512.png
│   └── apple-touch-icon.png
├── src/
│   ├── assets/images/          # Aset visual resolusi tinggi
│   ├── components/
│   │   ├── sections/           # Modul Dashboard, Profil, Dokumen, Sertifikat, Prestasi, Kegiatan, Galeri, CV, Log, Pengaturan, Admin
│   │   ├── AuthView.tsx        # Halaman Login (Email/Password, Google, Reset Password, Remember Me)
│   │   ├── DashboardShell.tsx  # Sidebar Navigation + Top Header + Theme Switch
│   │   ├── OfflineIndicator.tsx
│   │   ├── PublicPortfolioView.tsx # Halaman /portfolio/:username + QR Code + Share
│   │   ├── PWAInstallButton.tsx
│   │   └── Toast.tsx
│   ├── hooks/
│   │   ├── useOnlineStatus.ts
│   │   └── usePWAInstall.ts
│   ├── lib/
│   │   ├── exportUtils.ts      # Generator CV PDF (Modern & ATS), Export Excel (.xlsx), Backup JSON
│   │   ├── firebase.ts         # Inisialisasi Firebase Auth, Firestore Offline Persistence, Storage
│   │   ├── firestoreError.ts   # Penanganan error terstruktur Firestore
│   │   ├── portfolioService.ts # Layanan CRUD seluruh koleksi Firestore + Audit Log + Public Sync
│   │   └── storageUpload.ts    # Layanan unggah & hapus berkas ke 6 folder Firebase Storage
│   ├── types/portfolio.ts      # Definisi tipe TypeScript
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── firebase-applet-config.json # Konfigurasi proyek Firebase
├── firebase-blueprint.json     # Skema entitas & koleksi Firestore
├── firebase.json               # Konfigurasi Firestore, Storage, dan Firebase Hosting
├── firestore.indexes.json      # Indeks komposit Firestore
├── firestore.rules             # Security Rules Firestore (ABAC + RBAC + Validasi Ketat)
├── storage.rules               # Security Rules Firebase Storage
└── security_spec.md            # Spesifikasi keamanan & daftar uji penetrasi
```

## 2. Instalasi Lokal
1. Instal dependensi:
   ```bash
   npm install
   ```
2. Jalankan server pengembangan:
   ```bash
   npm run dev
   ```
3. Build produksi:
   ```bash
   npm run build
   ```

## 3. Konfigurasi Firebase Authentication & Storage
1. Buka **Firebase Console** -> **Authentication** -> **Sign-in method**:
   - **Google**: Aktif secara otomatis saat provisioning.
   - **Email/Password**: Aktifkan provider **Email/Password** bila ingin mengizinkan registrasi dan login dengan email/kata sandi.
2. **Authorized domains** (penting jika deploy ke Vercel/Netlify/domain kustom):
   - Buka **Firebase Console** -> **Authentication** -> **Settings** -> **Authorized domains**.
   - Klik **Add domain** lalu masukkan domain deployment Anda (contoh: `portofolio-sigma-jet-99.vercel.app`) agar tombol **Login dengan Google** berfungsi di domain tersebut.
3. Buka **Firebase Console** -> **Storage** -> pastikan bucket Storage aktif, lalu deploy aturan `storage.rules`.

## 4. Panduan Deployment ke Firebase Hosting
1. Instal Firebase CLI:
   ```bash
   npm install -g firebase-tools
   firebase login
   ```
2. Hubungkan proyek lokal dengan ID proyek di `firebase-applet-config.json`:
   ```bash
   firebase use gen-lang-client-0131469651
   ```
3. Build aplikasi dan deploy Hosting, Firestore Rules, Indexes, dan Storage Rules:
   ```bash
   npm run build
   firebase deploy
   ```
   Atau deploy terpisah:
   ```bash
   firebase deploy --only hosting
   firebase deploy --only firestore:rules,firestore:indexes
   firebase deploy --only storage
   ```
