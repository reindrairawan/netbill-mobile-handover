# FiberAccess Mobile

Aplikasi mobile (Android & iOS) untuk klien billing dan monitoring ISP FiberAccess, dibangun menggunakan React Native dan Expo (Expo Router).

Aplikasi ini melayani pelanggan untuk melihat informasi paket/langganan internet, riwayat dan tagihan aktif, pembayaran via payment gateway in-app (Midtrans), serta memantau status koneksi dan akun.

> **Catatan Layanan Backend**:
> Backend API adalah sistem terpisah yang **tidak** termasuk dalam repositori ini. Repositori ini murni berisi kode aplikasi mobile (klien). Default endpoint API mengarah ke `https://netbill.fiberaccess.co.id`.

---

## Prasyarat Lingkungan

- **Node.js**: versi LTS (Node.js 20+ atau 22+)
- **npm**: bawaan Node.js
- **Expo CLI & EAS CLI**:
  ```bash
  npm install -g eas-cli
  ```

---

## Menjalankan Proyek Secara Lokal

1. **Instalasi dependensi**:
   ```bash
   npm install
   ```

2. **Pemeriksaan Tipe (Typecheck)**:
   ```bash
   npm run typecheck
   ```

3. **Menjalankan Dev Server Expo**:
   ```bash
   npx expo start
   ```
   Gunakan tombol keyboard interaktif di terminal:
   - Tekan `a` untuk membuka di emulator Android
   - Tekan `i` untuk membuka di simulator iOS
   - Scan QR code menggunakan aplikasi **Expo Go** atau development build pada perangkat fisik

---

## Konfigurasi EAS & Build untuk Google Play Store

`app.json` sudah memuat konfigurasi **Expo Updates (OTA)** yang menunjuk ke project EAS milik pengembang (`owner`, `extra.eas.projectId`, `updates.url`, channel `production`). Cukup membuild dengan `app.json` ini, baik lewat Xcode/Gradle lokal maupun EAS Build; **tidak perlu `eas init` atau `eas update:configure`**. Perubahan non-native dikirim pengembang lewat `eas update` dan sampai ke aplikasi dengan versi yang sama tanpa rilis ulang ke store. Lihat `CHANGELOG.md` untuk syarat dan langkah rilis.

### 1. Memakai akun EAS sendiri (opsional)
Hanya jika tim ingin mengelola OTA dan build cloud sendiri. Login (`eas login`), jalankan `eas init` untuk project baru, lalu ganti `owner`, `extra.eas.projectId`, dan `updates.url` di `app.json` dengan milik project baru. Setelah itu update OTA harus dipublikasikan dari akun tersebut, bukan oleh pengembang.

### 2. Aturan OTA yang perlu diingat
- OTA hanya sampai ke aplikasi yang dibuild dari konfigurasi ini dan memiliki `version` yang sama persis.
- Perubahan native (dependency/plugin baru, izin baru) tetap butuh build baru dan versi baru.

### 3. Build Android App Bundle (AAB) untuk Google Play Store
Untuk memicu build AAB production yang siap diunggah ke Google Play Console:
```bash
eas build -p android --profile store
```

> **PENTING — Keystore & Kredensial Rilis**:
> - Pada build pertama, EAS akan menanyakan apakah Anda ingin mengizinkan EAS membuat dan mengelola keystore Android baru (Play App Signing) atau mengunggah keystore Anda sendiri.
> - Kredensial upload/submit Google Play Store (Service Account JSON) dan Apple Developer ASC API Key harus dibuat dan dikonfigurasi sendiri melalui akun developer masing-masing via EAS CLI atau dashboard Expo.
> - Pengaturan profil rilis dapat dilihat pada file `eas.json`.

---

## Struktur Folder Singkat

- `src/app/`: Halaman dan routing navigasi aplikasi berbasis Expo Router
- `src/components/`: Komponen UI reusable (Header, Modals, Inputs, dll.)
- `src/contexts/`: Context state aplikasi (autentikasi, manajemen token, dan API fetcher)
- `src/types/api.ts`: Definisi tipe data API dan DTO
- `src/constants/`: Konfigurasi default backend URL, styling, dan tema
- `assets/`: Aset visual resmi (ikon aplikasi, adaptive icon, splash screen)
