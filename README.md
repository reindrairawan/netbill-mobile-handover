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

Repositori ini telah dibersihkan dari ID proyek dan kredensial developer sebelumnya. Sebelum melakukan build cloud dengan Expo Application Services (EAS), lakukan inisialisasi project milik akun Anda:

### 1. Inisialisasi Project EAS Baru
Pastikan Anda sudah login ke akun Expo Anda (`eas login`), kemudian jalankan:
```bash
eas init
```
Perintah ini akan mendaftarkan project baru di akun Expo Anda dan memperbarui ID project di `app.json`.

### 2. Konfigurasi Expo Updates (OTA Updates)
Untuk mengaktifkan update Over-The-Air (OTA) melalui channel EAS Update:
```bash
eas update:configure
```

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
