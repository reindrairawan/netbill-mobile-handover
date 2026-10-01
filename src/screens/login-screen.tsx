import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/auth-context';
import { BackendUrlModal } from '@/components/backend-url-modal';
import { PasswordInput } from '@/components/password-input';
import { SHOW_BACKEND_SWITCHER } from '@/constants/app-config';

export function LoginScreen() {
  const { backendUrl, isLoggingIn, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Validasi', 'Email dan password harus diisi.');
      return;
    }
    try {
      await login(email, password);
    } catch (e: any) {
      Alert.alert('Login Gagal', e.message || 'Koneksi ke server gagal.');
    }
  };

  return (
    <SafeAreaView style={styles.loginContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#003d9b" />

      {SHOW_BACKEND_SWITCHER && (
        <TouchableOpacity style={styles.settingsLoginBtn} onPress={() => setShowSettingsModal(true)}>
          <Text style={styles.gearIcon}>⚙️</Text>
        </TouchableOpacity>
      )}

      <ScrollView contentContainerStyle={styles.loginScroll} keyboardShouldPersistTaps="handled">
        <View style={styles.logoCircle}>
          <Image
            source={require('../../assets/images/icon.png')}
            style={{ width: 72, height: 72, borderRadius: 18 }}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.loginTitle}>FiberAccess</Text>
        <Text style={styles.loginSubtitle}>PORTAL PELANGGAN &amp; STAFF ISP</Text>

        <View style={styles.loginCard}>
          <Text style={styles.inputLabel}>Alamat Email</Text>
          <TextInput
            style={styles.inputField}
            placeholder="nama@email.com"
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.inputLabel}>Kata Sandi</Text>
          <PasswordInput
            style={styles.inputField}
            placeholder="Masukkan kata sandi"
            placeholderTextColor="#999"
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity
            style={[styles.loginBtn, isLoggingIn && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={isLoggingIn}
          >
            {isLoggingIn ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginBtnText}>Masuk Ke Akun</Text>}
          </TouchableOpacity>
        </View>

        {/* Alamat server tidak perlu dipampang ke pelanggan di build rilis. */}
        {SHOW_BACKEND_SWITCHER && (
          <Text style={styles.loginFooter}>
            Koneksi ke: <Text style={{ fontWeight: 'bold' }}>{backendUrl.replace('https://', '')}</Text>
          </Text>
        )}
      </ScrollView>

      <BackendUrlModal visible={showSettingsModal} onClose={() => setShowSettingsModal(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loginContainer: {
    flex: 1,
    backgroundColor: '#003d9b',
  },
  loginScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    paddingTop: 60,
  },
  settingsLoginBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  gearIcon: {
    fontSize: 20,
    color: '#fff',
  },
  logoCircle: {
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
  logoBigIcon: {
    fontSize: 48,
  },
  loginTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
  },
  loginSubtitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#c4d2ff',
    letterSpacing: 2,
    marginBottom: 35,
    textAlign: 'center',
  },
  loginCard: {
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
  loginBtn: {
    backgroundColor: '#0052cc',
    borderRadius: 14,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  loginBtnDisabled: {
    backgroundColor: '#94a3b8',
  },
  loginBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  loginFooter: {
    fontSize: 11,
    color: '#a5b4fc',
    marginTop: 30,
    textAlign: 'center',
  },
});
