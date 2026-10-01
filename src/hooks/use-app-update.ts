import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useAuth } from '@/contexts/auth-context';

export interface NativeUpdateInfo {
  version: string;
  releaseNotes: string;
  downloadUrl: string;
  fileSizeBytes: number;
}

function isNewerVersion(latest: string, current: string): boolean {
  const a = latest.split('.').map(Number);
  const b = current.split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}

/**
 * Cek 2 lapis update aplikasi mobile di luar Play Store:
 * 1. Update native (APK baru) via GitHub Releases (lewat proxy backend) — perlu
 *    user unduh & install manual, ditampilkan lewat dialog (lihat UpdateModal).
 *    KHUSUS ANDROID — rilis yang di-generate cuma file `.apk`, dan iOS tidak punya
 *    jalur sideload setara (instalasi binary di luar App Store cuma lewat
 *    TestFlight/Enterprise cert, mekanisme yang sama sekali berbeda dan belum
 *    disiapkan). Jangan tampilkan prompt ini di iOS — hasilnya cuma file .apk
 *    yang mustahil di-install di sana.
 * 2. Update JS/OTA via EAS Update — otomatis diunduh & dipasang di background,
 *    tidak butuh interaksi user, cross-platform. No-op kalau EAS Update belum
 *    dikonfigurasi (mis. `eas update:configure` belum pernah dijalankan).
 *
 * Cek native (poin 1) sengaja ikut `backendUrl` yang sama dipakai app (bisa diganti
 * lewat gear icon di Settings) — BUKAN hardcode ke satu domain produksi tertentu.
 * Ini supaya tetap bisa dites/dipakai kalau domain produksi sedang bermasalah
 * (mis. DNS down) tanpa perlu rebuild app, cukup ganti backend URL di Settings.
 */
export function useAppUpdate() {
  const { backendUrl } = useAuth();
  const [nativeUpdate, setNativeUpdate] = useState<NativeUpdateInfo | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (Platform.OS !== 'android') return;
      try {
        const res = await fetch(`${backendUrl}/api/v1/mobile/latest-version`);
        if (!res.ok) return;
        const data = (await res.json()) as NativeUpdateInfo;
        const currentVersion = Constants.expoConfig?.version ?? '0.0.0';
        if (!cancelled && isNewerVersion(data.version, currentVersion)) {
          setNativeUpdate({ ...data, downloadUrl: `${backendUrl}${data.downloadUrl}` });
        }
      } catch {
        // Cek update tidak boleh mengganggu penggunaan app kalau backend/koneksi bermasalah.
      }
    })();

    (async () => {
      try {
        if (!Updates.isEnabled) return; // belum dikonfigurasi (dev, atau eas update:configure belum jalan)
        const result = await Updates.checkForUpdateAsync();
        if (result.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch {
        // Sama — jangan sampai gagal cek OTA meng-crash app produksi.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [backendUrl]);

  return { nativeUpdate, dismiss: () => setNativeUpdate(null) };
}
