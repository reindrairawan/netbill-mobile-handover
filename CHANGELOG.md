# Changelog

## 1.1.1 (dari 1.1.0) — rilis ulang, perbaikan force close Simpan QR

### Kenapa harus dirilis ulang
Build 1.1.0 (build 13) yang tayang di App Store **force close saat tombol Simpan QR ditekan** di iPhone. Penyebabnya bukan kode: Info.plist di dalam build itu **tidak memuat** `NSPhotoLibraryAddUsageDescription`, sehingga iOS menutup aplikasi begitu izin foto diminta. `app.json` repo ini sudah benar (plugin `expo-media-library` menambahkan kuncinya), jadi build tersebut dibuat tanpa menerapkan plugin, kemungkinan dari folder `ios/` lama yang tidak dibuat ulang. Update OTA **tidak bisa** memperbaikinya karena Info.plist bagian dari binary.

### Perubahan kode
- Header layar pembayaran QRIS tidak lagi tertutup status bar (tombol Simpan QR dan Selesai sebelumnya tidak bisa ditekan di iOS).
- Tombol diberi label **Simpan QR ke Galeri**, ditambah petunjuk singkat di bawah header (tombol "Download QRIS" bawaan Midtrans tidak berfungsi di dalam aplikasi).
- Sheet **Pelunasan Massal** dan **Riwayat Setoran** tidak lagi tertutup tombol navigasi Android (back/home/recent) atau home indicator iPhone (komponen baru `BottomSheetModal`).

### Update OTA sudah dikonfigurasi
`app.json` sekarang memuat `owner`, `extra.eas.projectId`, `updates.url`, dan `updates.requestHeaders` (channel `production`). Tim VARX **tidak perlu memasang EAS** untuk ini: cukup membuild dengan `app.json` ini seperti biasa. Perubahan non-native berikutnya dikirim pengembang lewat `eas update`, tanpa rilis ulang ke store.
- OTA hanya sampai ke aplikasi yang **dibuild dari konfigurasi ini**. Build yang sudah tayang tidak punya alamat update, jadi tidak akan menerima OTA apa pun.
- OTA hanya sampai ke aplikasi dengan **versi yang sama persis** (`runtimeVersion` mengikuti `version`). Perubahan native (dependency/plugin baru) tetap butuh build baru dan versi baru.
- Bundle ID iOS di repo ini sekarang `com.netbill.fiberaccess-app`, sama dengan rilis yang tayang.

### Langkah rilis ulang (WAJIB berurutan)
1. **Naikkan nomor build.** `version` sudah 1.1.1 (App Store menolak versi yang sudah tayang; jangan diubah sendiri karena akan tertimpa saat sinkronisasi dari repo utama). `ios.buildNumber` harus **lebih besar dari 13** (nomor terakhir yang tayang) dan `android.versionCode` **lebih besar dari 5**; keduanya ditetapkan tim VARX karena build tidak lewat auto-increment EAS.
2. **Buat ulang proyek native dari nol.** Hapus folder `ios/` dan `android/` lama, atau jalankan `npx expo prebuild --clean`, lalu build. Jangan memakai folder `ios/` dari build sebelumnya.
3. **Periksa Info.plist sebelum mengunggah ke App Store.** Di hasil prebuild:
   ```bash
   plutil -p ios/FiberAccess/Info.plist | grep NSPhotoLibrary
   ```
   Harus muncul **dua** baris: `NSPhotoLibraryAddUsageDescription` dan `NSPhotoLibraryUsageDescription`. Jika tidak muncul, jangan diunggah.
4. Uji di perangkat: Tagihan, Bayar via QRIS, lalu Simpan QR ke Galeri. Dialog izin foto harus muncul dan aplikasi tidak boleh tertutup.

## 1.1.0 (dari 1.0.5)

### Fitur & perubahan
- **Simpan QR QRIS ke galeri**: tombol di layar pembayaran QRIS (modul native baru `expo-media-library`).
- **Daftar pelanggan lengkap** untuk staf/reseller: dimuat bertahap (pagination) dengan pencarian di server, bukan hanya halaman pertama.
- **Live chat ke WhatsApp reseller**: pelanggan kategori reseller diarahkan ke nomor WhatsApp reseller-nya; bila belum diisi, tetap ke nomor CS FiberAccess. Reseller bisa mengubah nomornya dari menu Akun.
- **Pelunasan massal / setoran reseller via Midtrans** (khusus akun reseller dengan izin `billing.reseller_deposit`): bayar banyak tagihan pelanggan dalam satu transaksi.
- **Sesi login mobile lebih lama**: aplikasi mengirim header `X-Client-Platform: mobile`, refresh token berumur panjang.
- **Pembayaran in-app**: penanganan redirect selesai-bayar di WebView.
- **Role baru "Teknisi Reseller"** dikenali (tampilan & pembatasan data ikut kategori reseller). Menu Tagihan untuk staf/teknisi belum ada di mobile.

### Yang WAJIB diperhatikan saat merilis
1. **Ini perubahan native, bukan update OTA.** Ada modul baru (`expo-media-library`) dan `runtimeVersion` memakai kebijakan `appVersion`, jadi 1.1.0 harus dirilis sebagai **build baru** lewat App Store/Play Store. Jangan dikirim lewat EAS Update ke pengguna 1.0.5.
2. **Identitas rilis tidak diubah di repo ini.** `bundleIdentifier` iOS, package Android, `owner`, `projectId`, `eas.json`, dan `store.config.json` sengaja dibiarkan. Pastikan nilainya sama dengan yang dipakai saat merilis 1.0.5 (iOS: `com.netbill.fiberaccess-app`).
3. **Nomor build**: lanjutkan dari build terakhir yang tayang (biarkan `autoIncrement` EAS yang menaikkan).
4. **Backend** sudah siap: production `https://netbill.fiberaccess.co.id` dirilis 23 Okt 2026 dengan semua endpoint yang dibutuhkan versi ini.
5. **Izin foto iOS/Android** ditambahkan otomatis oleh plugin `expo-media-library` di `app.json` (teks izin sudah diisi dalam Bahasa Indonesia). Tidak ada capability atau izin lain yang berubah.
6. **App Review Apple**: siapkan akun demo seperti rilis sebelumnya. Fitur QRIS dan simpan ke galeri bisa diuji dengan tagihan belum lunas pada akun demo.

### Langkah rilis
```bash
npm ci
npx tsc --noEmit
eas build --platform ios --profile store
eas submit --platform ios --profile store --latest
```

### Catatan teknis
- `src/types/api.ts` **dihasilkan otomatis** dari kode backend/shared (`@netbill/shared`) saat sinkronisasi dari repo utama. Jangan diedit manual karena akan tertimpa.
- Seluruh isi `src/` dicerminkan dari repo utama (`apps/mobile`). Perubahan langsung di repo ini akan hilang pada sinkronisasi berikutnya, jadi sampaikan permintaan perubahan ke pengembang repo utama.
