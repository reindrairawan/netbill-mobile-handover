import { useState, useEffect } from 'react';
import { Alert, Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Constants from 'expo-constants';
import { sharedStyles } from '@/constants/mobile-styles';
import { useAuth } from '@/contexts/auth-context';

import appConfig from '../../app.json';

const appVersion = appConfig?.expo?.version || Constants.expoConfig?.version || '1.0.0';

interface BackendUrlModalProps {
  visible: boolean;
  onClose: () => void;
}

/** Modal pengaturan URL endpoint backend — dipakai di layar Login (sebelum masuk) & tab Akun (setelah login). */
export function BackendUrlModal({ visible, onClose }: BackendUrlModalProps) {
  const { backendUrl, saveBackendUrl } = useAuth();
  const [value, setValue] = useState(backendUrl);

  useEffect(() => {
    if (visible) setValue(backendUrl);
  }, [visible, backendUrl]);

  const handleSave = async () => {
    if (!value.trim()) {
      Alert.alert('Error', 'URL backend tidak boleh kosong.');
      return;
    }
    await saveBackendUrl(value);
    onClose();
    Alert.alert('Sukses', `URL Backend disimpan:\n${value.trim()}`);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={sharedStyles.modalBg}>
        <View style={sharedStyles.settingsModalCard}>
          <Text style={sharedStyles.modalTitle}>⚙️ Pengaturan Endpoint API</Text>
          <Text style={sharedStyles.modalDesc}>Atur URL endpoint backend target NetBill yang digunakan oleh aplikasi ini.</Text>

          <TextInput
            style={sharedStyles.modalInput}
            placeholder="https://example.com"
            value={value}
            onChangeText={setValue}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <View style={sharedStyles.modalButtonsRow}>
            <TouchableOpacity style={[sharedStyles.modalBtn, sharedStyles.modalBtnCancel]} onPress={onClose}>
              <Text style={sharedStyles.modalBtnCancelText}>Batal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[sharedStyles.modalBtn, sharedStyles.modalBtnSave]} onPress={handleSave}>
              <Text style={sharedStyles.modalBtnSaveText}>Simpan</Text>
            </TouchableOpacity>
          </View>

          <View style={{ marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f3ff', alignItems: 'center' }}>
            <Text style={{ fontSize: 11, color: '#737685', fontWeight: '600' }}>
              📱 Versi Aplikasi: v{appVersion} (FiberAccess)
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}
