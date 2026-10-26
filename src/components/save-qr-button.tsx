import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { useAuth } from '@/contexts/auth-context';

/**
 * Simpan gambar QR QRIS ke galeri HP supaya bisa dibayar dari aplikasi bank/e-wallet di HP
 * yang sama. Tombol unduh bawaan halaman Midtrans menghasilkan URL `blob:` yang tidak bisa
 * disimpan dari WebView, jadi gambarnya diambil dari backend (`qrPath`) — Midtrans juga
 * melarang menyuntikkan JavaScript ke halaman pembayarannya.
 */
export function SaveQrButton({ qrPath, fileLabel }: { qrPath: string; fileLabel: string }) {
  const { apiFetchBytes } = useAuth();
  const [saving, setSaving] = useState(false);

  const save = async () => {
    // Hanya izin TULIS (menambah foto), tanpa izin membaca galeri — aplikasi tidak perlu
    // melihat foto pengguna untuk menyimpan satu gambar QR.
    const permission = await MediaLibrary.requestPermissionsAsync(true, ['photo']);
    if (!permission.granted) {
      Alert.alert(
        'Izin Galeri Dibutuhkan',
        'Izinkan NetBill menyimpan foto agar QR QRIS bisa disimpan ke galeri.',
        permission.canAskAgain
          ? [{ text: 'OK' }]
          : [
              { text: 'Nanti', style: 'cancel' },
              { text: 'Buka Pengaturan', onPress: () => Linking.openSettings() },
            ],
      );
      return;
    }

    setSaving(true);
    const file = new File(Paths.cache, `QRIS-${fileLabel}-${Date.now()}.png`);
    try {
      const bytes = await apiFetchBytes(qrPath);
      file.write(bytes);
      await MediaLibrary.Asset.create(file.uri);
      Alert.alert(
        'QR Tersimpan',
        'Gambar QR QRIS sudah tersimpan di galeri. Buka aplikasi bank atau e-wallet, pilih bayar/scan QRIS, lalu ambil gambar dari galeri.',
      );
    } catch (e: any) {
      Alert.alert('Gagal Menyimpan QR', e?.message || 'Terjadi kesalahan saat menyimpan gambar.');
    } finally {
      // Salinan sementara di cache tidak dibutuhkan lagi — gambarnya sudah ada di galeri.
      if (file.exists) file.delete();
      setSaving(false);
    }
  };

  return (
    <TouchableOpacity style={[styles.btn, saving && { opacity: 0.6 }]} disabled={saving} onPress={save} accessibilityLabel="Simpan QR ke galeri">
      {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.text}>Simpan QR</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    minWidth: 84,
    alignItems: 'center',
  },
  text: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
});
