# Changelog

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
