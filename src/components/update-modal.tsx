import { useState } from 'react';
import { Alert, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { sharedStyles } from '@/constants/mobile-styles';
import type { NativeUpdateInfo } from '@/hooks/use-app-update';

interface UpdateModalProps {
  info: NativeUpdateInfo;
  onDismiss: () => void;
}

const APK_PATH = `${FileSystem.documentDirectory}netbill-update.apk`;

// FLAG_GRANT_READ_URI_PERMISSION — wajib supaya Package Installer (proses lain)
// boleh baca content:// URI yang kita keluarkan dari sandbox app sendiri.
const FLAG_GRANT_READ_URI_PERMISSION = 1;

/**
 * Dialog notifikasi update APK baru (native) tersedia. Download & install dilakukan
 * di DALAM aplikasi (bukan lempar ke browser lewat Linking.openURL) — supaya user
 * tidak perlu bolak-balik ke Play Store/Download Manager dan lupa lanjut install,
 * seperti pola app professional lain. File APK yang sudah diunduh dihapus lagi
 * setelah installer sistem berhasil dilempar (tidak menunggu hasil instalasinya,
 * karena app tidak punya cara andal mendeteksi user selesai/batal di dialog
 * installer bawaan Android tanpa native module tambahan).
 */
export function UpdateModal({ info, onDismiss }: UpdateModalProps) {
  const [status, setStatus] = useState<'idle' | 'downloading' | 'installing'>('idle');
  const [progress, setProgress] = useState(0);

  const handleDownloadAndInstall = async () => {
    setStatus('downloading');
    setProgress(0);
    try {
      // Bersihkan sisa file dari percobaan sebelumnya (mis. app ditutup di tengah download).
      await FileSystem.deleteAsync(APK_PATH, { idempotent: true });

      const downloadResumable = FileSystem.createDownloadResumable(
        info.downloadUrl,
        APK_PATH,
        {},
        (data) => {
          if (data.totalBytesExpectedToWrite > 0) {
            setProgress(data.totalBytesWritten / data.totalBytesExpectedToWrite);
          }
        },
      );
      const result = await downloadResumable.downloadAsync();
      if (!result) throw new Error('Download dibatalkan.');

      setStatus('installing');
      const contentUri = await FileSystem.getContentUriAsync(result.uri);
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        flags: FLAG_GRANT_READ_URI_PERMISSION,
        type: 'application/vnd.android.package-archive',
      });

      // Installer sistem sudah dilempar (tampil di atas app kita) — file sumbernya
      // sudah tidak dibutuhkan lagi, hapus supaya tidak menumpuk di storage.
      await FileSystem.deleteAsync(result.uri, { idempotent: true });
      onDismiss();
    } catch (err: any) {
      await FileSystem.deleteAsync(APK_PATH, { idempotent: true }).catch(() => {});
      setStatus('idle');
      Alert.alert('Gagal Update', err?.message || 'Gagal mengunduh atau memasang update.');
    }
  };

  const isBusy = status !== 'idle';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={isBusy ? undefined : onDismiss}>
      <View style={sharedStyles.modalBg}>
        <View style={sharedStyles.settingsModalCard}>
          <Text style={sharedStyles.modalTitle}>🚀 Update Tersedia — v{info.version}</Text>
          <ScrollView style={{ maxHeight: 160 }} showsVerticalScrollIndicator={false}>
            <Text style={sharedStyles.modalDesc}>
              {info.releaseNotes || 'Versi terbaru aplikasi sudah bisa diunduh.'}
            </Text>
          </ScrollView>

          {isBusy && (
            <View style={{ marginBottom: 16 }}>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: '#e2e8f0', overflow: 'hidden' }}>
                <View
                  style={{
                    height: '100%',
                    borderRadius: 4,
                    backgroundColor: '#0052cc',
                    width: `${Math.round(progress * 100)}%`,
                  }}
                />
              </View>
              <Text style={{ marginTop: 6, fontSize: 12, color: '#64748b', textAlign: 'center' }}>
                {status === 'downloading'
                  ? `Mengunduh… ${Math.round(progress * 100)}%`
                  : 'Membuka installer…'}
              </Text>
            </View>
          )}

          <View style={sharedStyles.modalButtonsRow}>
            <TouchableOpacity
              style={[sharedStyles.modalBtnCancel, isBusy && { opacity: 0.5 }]}
              onPress={onDismiss}
              disabled={isBusy}
            >
              <Text style={sharedStyles.modalBtnCancelText}>Nanti</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[sharedStyles.modalBtnSave, isBusy && { opacity: 0.5 }]}
              onPress={handleDownloadAndInstall}
              disabled={isBusy}
            >
              <Text style={sharedStyles.modalBtnSaveText}>
                {isBusy ? 'Memproses…' : 'Unduh & Pasang'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
