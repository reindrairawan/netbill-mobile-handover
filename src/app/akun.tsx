import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import appConfig from '../../app.json';
import { useAuth } from '@/contexts/auth-context';

const appVersion = appConfig?.expo?.version || Constants.expoConfig?.version || '1.0.0';
import { AppHeader } from '@/components/app-header';
import { BackendUrlModal } from '@/components/backend-url-modal';
import { PasswordInput } from '@/components/password-input';
import { sharedStyles } from '@/constants/mobile-styles';

interface CustomerProfileDTO {
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  customerNo: string;
  categoryName: string | null;
  createdAt: string;
}

const formatDate = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

/** Tab "Akun" — dipakai kedua role (customer & staff). Isi disesuaikan: customer dapat detail profil pelanggan, staff dapat info akun staf. */
export default function AkunScreen() {
  const { user, apiFetch, logout } = useAuth();
  const isStaff = user?.role !== 'customer';

  const [customerProfile, setCustomerProfile] = useState<CustomerProfileDTO | null>(null);
  const [isLoading, setIsLoading] = useState(!isStaff);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showProfileDetailModal, setShowProfileDetailModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (isStaff) return;
    (async () => {
      try {
        const profile = await apiFetch('/auth/me/customer');
        setCustomerProfile(profile);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [isStaff, apiFetch]);

  const handleChangePassword = async () => {
    setPasswordError(null);
    if (!currentPassword) {
      setPasswordError('Sandi saat ini wajib diisi.');
      return;
    }
    if (!newPassword) {
      setPasswordError('Sandi baru wajib diisi.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('Sandi baru minimal harus 6 karakter.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError('Konfirmasi sandi baru tidak cocok.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await apiFetch('/auth/me', { method: 'PATCH', body: JSON.stringify({ currentPassword, newPassword }) });
      Alert.alert('Sukses', 'Kata sandi berhasil diperbarui.');
      setShowChangePasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setPasswordError(null);
    } catch (e: any) {
      const msg = e.message || 'Gagal mengubah sandi. Pastikan sandi saat ini benar.';
      setPasswordError(msg);
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleWhatsAppSupport = async () => {
    const phoneNumber = '6285159774741';
    const text = `Halo FiberAccess Support, saya ${user?.name || 'Pelanggan'} (ID: ${customerProfile?.customerNo || '-'}) butuh bantuan mengenai layanan internet saya.`;
    const appUrl = `whatsapp://send?phone=${phoneNumber}&text=${encodeURIComponent(text)}`;
    const webUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(text)}`;
    try {
      // Di iOS, canOpenURL bisa reject (bukan cuma resolve false) kalau scheme
      // "whatsapp" belum didaftarkan di LSApplicationQueriesSchemes — anggap saja
      // app-nya tidak tersedia dan coba link web wa.me, jangan langsung error out.
      const supported = await Linking.canOpenURL(appUrl).catch(() => false);
      await Linking.openURL(supported ? appUrl : webUrl);
    } catch {
      Alert.alert('Error', 'Gagal membuka WhatsApp. Silakan hubungi CS manual di +62 851-5977-4741.');
    }
  };

  const handleLogout = () => {
    Alert.alert('Konfirmasi Keluar', 'Apakah Anda yakin ingin keluar dari aplikasi?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Keluar', style: 'destructive', onPress: logout },
    ]);
  };

  const displayName = isStaff ? user?.name : customerProfile?.name || user?.name;
  const displaySub = isStaff ? user?.email : customerProfile?.email || '-';

  return (
    <SafeAreaView style={sharedStyles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#faf9ff" />
      <AppHeader subtitle="AKUN SAYA" onOpenSettings={() => setShowSettingsModal(true)} />

      {isLoading ? (
        <View style={sharedStyles.loadingContainer}>
          <ActivityIndicator size="large" color="#0052cc" />
          <Text style={sharedStyles.loadingText}>Memuat profil...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={sharedStyles.scrollContent}>
          <View style={styles.profileCard}>
            <View style={styles.avatarBorder}>
              <View style={styles.avatarInner}>
                <Text style={styles.avatarText}>👤</Text>
              </View>
            </View>
            <Text style={styles.profileName}>{displayName}</Text>
            <Text style={styles.profileSub}>{displaySub}</Text>
            <View style={styles.idChip}>
              <Text style={styles.idLabel}>{isStaff ? 'ROLE: ' : 'ID PELANGGAN: '}</Text>
              <Text style={styles.idValue}>{isStaff ? user?.role.toUpperCase() : customerProfile?.customerNo || 'N/A'}</Text>
            </View>
          </View>

          <View style={styles.menuGroup}>
            {!isStaff && (
              <TouchableOpacity style={styles.menuItem} onPress={() => setShowProfileDetailModal(true)}>
                <Text style={styles.menuIcon}>👤</Text>
                <View style={styles.menuTextContainer}>
                  <Text style={styles.menuTitle}>Detail Profil Pelanggan</Text>
                  <Text style={styles.menuSubtitle}>Informasi kontak, nomor HP, email, alamat</Text>
                </View>
                <Text style={styles.menuChevron}>›</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.menuItem} onPress={() => { setPasswordError(null); setShowChangePasswordModal(true); }}>
              <Text style={styles.menuIcon}>🔒</Text>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>Ganti Kata Sandi</Text>
                <Text style={styles.menuSubtitle}>Perbarui kredensial kata sandi akun login Anda</Text>
              </View>
              <Text style={styles.menuChevron}>›</Text>
            </TouchableOpacity>

            {!isStaff && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => setShowPaymentMethodModal(true)}
              >
                <Text style={styles.menuIcon}>💳</Text>
                <View style={styles.menuTextContainer}>
                  <Text style={styles.menuTitle}>Metode Pembayaran</Text>
                  <Text style={styles.menuSubtitle}>Pembayaran via QRIS & Gateway Midtrans</Text>
                </View>
                <Text style={styles.menuChevron}>›</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.menuItem} onPress={handleWhatsAppSupport}>
              <Text style={styles.menuIcon}>🎧</Text>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>Bantuan & Live Chat</Text>
                <Text style={styles.menuSubtitle}>WhatsApp FiberAccess (+62 851-5977-4741)</Text>
              </View>
              <Text style={styles.menuChevron}>›</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>🚪 Keluar dari Aplikasi</Text>
          </TouchableOpacity>

          <View style={{ alignItems: 'center', marginBottom: 24, marginTop: 4 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#003d9b' }}>
              FiberAccess v{appVersion}
            </Text>
            <Text style={{ fontSize: 10, color: '#737685', marginTop: 2 }}>
              FiberAccess Indonesia • All rights reserved
            </Text>
          </View>
        </ScrollView>
      )}

      <BackendUrlModal visible={showSettingsModal} onClose={() => setShowSettingsModal(false)} />

      {/* Profile Detail Modal (customer only) */}
      <Modal visible={showProfileDetailModal} transparent animationType="fade" onRequestClose={() => setShowProfileDetailModal(false)}>
        <View style={sharedStyles.modalBg}>
          <View style={sharedStyles.settingsModalCard}>
            <Text style={sharedStyles.modalTitle}>👤 Rincian Profil</Text>
            {customerProfile && (
              <View style={sharedStyles.detailList}>
                <View style={sharedStyles.detailRow}>
                  <Text style={sharedStyles.detailLabel}>Nama Lengkap</Text>
                  <Text style={sharedStyles.detailVal}>{customerProfile.name}</Text>
                </View>
                <View style={sharedStyles.detailRow}>
                  <Text style={sharedStyles.detailLabel}>ID Pelanggan</Text>
                  <Text style={sharedStyles.detailVal}>{customerProfile.customerNo}</Text>
                </View>
                <View style={sharedStyles.detailRow}>
                  <Text style={sharedStyles.detailLabel}>Nomor Telepon/WA</Text>
                  <Text style={sharedStyles.detailVal}>{customerProfile.phone || '-'}</Text>
                </View>
                <View style={sharedStyles.detailRow}>
                  <Text style={sharedStyles.detailLabel}>Alamat Email</Text>
                  <Text style={sharedStyles.detailVal}>{customerProfile.email || '-'}</Text>
                </View>
                <View style={sharedStyles.detailRow}>
                  <Text style={sharedStyles.detailLabel}>Alamat Rumah</Text>
                  <Text style={sharedStyles.detailVal}>{customerProfile.address || '-'}</Text>
                </View>
                <View style={sharedStyles.detailRow}>
                  <Text style={sharedStyles.detailLabel}>Kategori / Mitra</Text>
                  <Text style={sharedStyles.detailVal}>{customerProfile.categoryName || '-'}</Text>
                </View>
                <View style={sharedStyles.detailRow}>
                  <Text style={sharedStyles.detailLabel}>Terdaftar Sejak</Text>
                  <Text style={sharedStyles.detailVal}>{formatDate(customerProfile.createdAt)}</Text>
                </View>
              </View>
            )}
            <TouchableOpacity
              style={[sharedStyles.modalBtnFullCancel, { marginTop: 20 }]}
              onPress={() => setShowProfileDetailModal(false)}
            >
              <Text style={sharedStyles.modalBtnCancelText}>Batal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Payment Method Modal */}
      <Modal visible={showPaymentMethodModal} transparent animationType="fade" onRequestClose={() => setShowPaymentMethodModal(false)}>
        <View style={sharedStyles.modalBg}>
          <View style={sharedStyles.settingsModalCard}>
            <Text style={sharedStyles.modalTitle}>💳 Metode Pembayaran</Text>
            <View style={{ backgroundColor: '#eef4ff', padding: 12, borderRadius: 12, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: '#0052cc' }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#003d9b' }}>Metode Pembayaran : Pembayaran via QRIS</Text>
              <Text style={{ fontSize: 11, color: '#434654', marginTop: 4 }}>
                FiberAccess mendukung pembayaran tagihan otomatis menggunakan gerbang pembayaran Midtrans.
              </Text>
            </View>

            <Text style={{ fontSize: 12, fontWeight: '700', color: '#051a3e', marginBottom: 8 }}>Pilihan Pembayaran & Gateway:</Text>
            <View style={{ gap: 8, marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#faf9ff', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#e9edff' }}>
                <Text style={{ fontSize: 16, marginRight: 10 }}>📱</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#051a3e' }}>QRIS (e-wallet & mobile banking)</Text>
                  <Text style={{ fontSize: 10, color: '#737685' }}>Scan sekali, verifikasi otomatis 24/7 tanpa konfirmasi manual</Text>
                </View>
              </View>
              {/* Sebelumnya di sini hanya tercantum Virtual Account bank dan QRIS sengaja
                  disembunyikan atas permintaan klien. Klien mengonfirmasi pembalikannya
                  (Sep 2026): QRIS kini jadi metode yang ditampilkan. Metode mana yang
                  benar-benar aktif tetap ditentukan di dashboard Midtrans, bukan di kode ini. */}
            </View>

            <TouchableOpacity
              style={sharedStyles.modalBtnFullCancel}
              onPress={() => setShowPaymentMethodModal(false)}
            >
              <Text style={sharedStyles.modalBtnCancelText}>Batal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Change Password Modal */}
      <Modal visible={showChangePasswordModal} transparent animationType="fade" onRequestClose={() => setShowChangePasswordModal(false)}>
        <View style={sharedStyles.modalBg}>
          <View style={sharedStyles.settingsModalCard}>
            <Text style={sharedStyles.modalTitle}>🔒 Ganti Kata Sandi</Text>
            <Text style={sharedStyles.modalDesc}>Perbarui kata sandi akun login Anda untuk keamanan.</Text>

            {passwordError && (
              <View style={{ backgroundColor: '#fce8e6', padding: 10, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: '#f8b4b4' }}>
                <Text style={{ fontSize: 12, color: '#ba1a1a', fontWeight: '600' }}>⚠️ {passwordError}</Text>
              </View>
            )}

            <Text style={styles.inputLabel}>Sandi Saat Ini *</Text>
            <PasswordInput
              style={sharedStyles.modalInput}
              placeholder="Masukkan sandi saat ini"
              value={currentPassword}
              onChangeText={(text) => { setPasswordError(null); setCurrentPassword(text); }}
            />

            <Text style={styles.inputLabel}>Sandi Baru *</Text>
            <PasswordInput
              style={sharedStyles.modalInput}
              placeholder="Minimal 6 karakter"
              value={newPassword}
              onChangeText={(text) => { setPasswordError(null); setNewPassword(text); }}
            />

            <Text style={styles.inputLabel}>Konfirmasi Sandi Baru *</Text>
            <PasswordInput
              style={sharedStyles.modalInput}
              placeholder="Ulangi sandi baru"
              value={confirmNewPassword}
              onChangeText={(text) => { setPasswordError(null); setConfirmNewPassword(text); }}
            />

            <View style={sharedStyles.modalButtonsRow}>
              <TouchableOpacity
                style={[sharedStyles.modalBtn, sharedStyles.modalBtnCancel]}
                onPress={() => {
                  setShowChangePasswordModal(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmNewPassword('');
                  setPasswordError(null);
                }}
                disabled={isUpdatingPassword}
              >
                <Text style={sharedStyles.modalBtnCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[sharedStyles.modalBtn, sharedStyles.modalBtnSave]} onPress={handleChangePassword} disabled={isUpdatingPassword}>
                {isUpdatingPassword ? <ActivityIndicator color="#fff" /> : <Text style={sharedStyles.modalBtnSaveText}>Perbarui</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e9edff',
  },
  avatarBorder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#0052cc',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#f1f3ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 32,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#051a3e',
  },
  profileSub: {
    fontSize: 12,
    color: '#737685',
    marginTop: 2,
  },
  idChip: {
    flexDirection: 'row',
    backgroundColor: '#f1f3ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    marginTop: 14,
  },
  idLabel: {
    fontSize: 11,
    color: '#737685',
    fontWeight: '700',
  },
  idValue: {
    fontSize: 11,
    color: '#003d9b',
    fontWeight: '700',
  },
  menuGroup: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e9edff',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3ff',
  },
  menuIcon: {
    fontSize: 20,
    marginRight: 14,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#051a3e',
  },
  menuSubtitle: {
    fontSize: 11,
    color: '#737685',
    marginTop: 2,
  },
  menuChevron: {
    fontSize: 20,
    color: '#737685',
    fontWeight: '700',
  },
  logoutButton: {
    backgroundColor: '#ffdad6',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  logoutText: {
    color: '#ba1a1a',
    fontSize: 14,
    fontWeight: '700',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
});
