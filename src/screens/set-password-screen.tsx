import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/auth-context';
import { PasswordInput } from '@/components/password-input';

/**
 * Dipaksa tampil sebelum <AppTabs /> untuk pelanggan yang belum pernah set sandi
 * sendiri (login masih lewat fallback lemah customerNo/phone/"123456"). Tidak
 * minta currentPassword — backend (updateOwnAccount) juga tidak mewajibkannya
 * selama passwordHash pelanggan masih null.
 */
export function SetPasswordScreen() {
  const { applySession, apiFetch, logout } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Validasi', 'Sandi baru minimal 6 karakter.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Validasi', 'Konfirmasi sandi tidak cocok.');
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await apiFetch('/auth/me', { method: 'PATCH', body: JSON.stringify({ newPassword }) });
      await applySession(result);
      Alert.alert('Berhasil', 'Sandi baru berhasil disimpan.');
    } catch (e: any) {
      Alert.alert('Gagal', e.message || 'Gagal menyimpan sandi baru.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#003d9b" />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.iconCircle}>
          <Text style={styles.iconText}>🔒</Text>
        </View>
        <Text style={styles.title}>Amankan Akun Anda</Text>
        <Text style={styles.subtitle}>
          Demi keamanan, buat sandi baru untuk akun Anda sebelum melanjutkan.
        </Text>

        <View style={styles.card}>
          <Text style={styles.inputLabel}>Sandi Baru</Text>
          <PasswordInput
            style={styles.inputField}
            placeholder="Minimal 6 karakter"
            placeholderTextColor="#999"
            value={newPassword}
            onChangeText={setNewPassword}
          />

          <Text style={styles.inputLabel}>Konfirmasi Sandi Baru</Text>
          <PasswordInput
            style={styles.inputField}
            placeholder="Ulangi sandi baru"
            placeholderTextColor="#999"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />

          <TouchableOpacity
            style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Simpan Sandi Baru</Text>}
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={logout}>
          <Text style={styles.logoutLink}>Keluar</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#003d9b',
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    paddingTop: 60,
  },
  iconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  iconText: {
    fontSize: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#c4d2ff',
    marginTop: 10,
    marginBottom: 30,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 320,
  },
  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  inputField: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#0f172a',
    marginBottom: 18,
  },
  submitBtn: {
    backgroundColor: '#0052cc',
    borderRadius: 14,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  submitBtnDisabled: {
    backgroundColor: '#94a3b8',
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  logoutLink: {
    fontSize: 13,
    color: '#a5b4fc',
    marginTop: 24,
    fontWeight: '600',
  },
});
