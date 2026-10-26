import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '@/contexts/auth-context';
import { sharedStyles } from '@/constants/mobile-styles';

/** Reseller mengatur nomor WhatsApp tujuan "Bantuan & Live Chat" pelanggannya sendiri. */
export function ResellerContactModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { apiFetch } = useAuth();
  const [value, setValue] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    apiFetch('/me/reseller-contact')
      .then((res: { categoryName: string; whatsappNumber: string | null }) => {
        setCategoryName(res.categoryName);
        setValue(res.whatsappNumber ?? '');
      })
      .catch((e: any) => Alert.alert('Gagal Memuat', e.message || 'Tidak bisa mengambil nomor WhatsApp.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await apiFetch('/me/reseller-contact', {
        method: 'PUT',
        body: JSON.stringify({ whatsappNumber: value.trim() || null }),
      });
      Alert.alert(
        'Tersimpan',
        res.whatsappNumber
          ? 'Pelanggan Anda sekarang diarahkan ke nomor WhatsApp ini.'
          : 'Nomor dihapus. Pelanggan Anda kembali diarahkan ke CS FiberAccess.',
      );
      onClose();
    } catch (e: any) {
      Alert.alert('Gagal Menyimpan', e.message || 'Terjadi kesalahan server.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={sharedStyles.modalBg}>
        <View style={sharedStyles.settingsModalCard}>
          <Text style={sharedStyles.modalTitle}>WhatsApp untuk Pelanggan</Text>
          <Text style={[sharedStyles.modalDesc, { marginBottom: 12 }]}>
            Tombol "Bantuan & Live Chat" di aplikasi pelanggan {categoryName || 'Anda'} akan membuka WhatsApp ke nomor
            ini. Kosongkan untuk memakai nomor CS FiberAccess.
          </Text>
          {loading ? (
            <ActivityIndicator color="#003d9b" style={{ marginVertical: 16 }} />
          ) : (
            <TextInput
              style={sharedStyles.modalInput}
              value={value}
              onChangeText={setValue}
              placeholder="cth. 0812xxxxxxx"
              keyboardType="phone-pad"
              maxLength={30}
            />
          )}
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginTop: 8 }}>
            <TouchableOpacity onPress={onClose} disabled={saving}>
              <Text style={{ color: '#434654', fontWeight: '700', padding: 8 }}>Batal</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={save} disabled={saving || loading}>
              {saving ? (
                <ActivityIndicator color="#003d9b" style={{ padding: 8 }} />
              ) : (
                <Text style={{ color: '#003d9b', fontWeight: '800', padding: 8 }}>Simpan</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
