import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { AppHeader } from '@/components/app-header';
import { BackendUrlModal } from '@/components/backend-url-modal';
import { sharedStyles } from '@/constants/mobile-styles';

interface CustomerProfileDTO {
  customerNo: string;
  address: string | null;
}

interface SubscriptionDTO {
  id: string;
  pppoeUsername: string;
  packageName: string;
  billingDay: number;
  status: 'pending' | 'active' | 'isolir' | 'terminated';
}

interface ConnectionStatusDTO {
  isConnected: boolean;
  pppoeUsername: string | null;
  subscriptionStatus: string | null;
  activeSession: {
    username: string;
    startTime: string;
    bytesIn: number;
    bytesOut: number;
    totalBytes: number;
  } | null;
}

const formatBytes = (bytes: number) => {
  if (!bytes || bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb.toFixed(1)} MB`;
};

const formatDuration = (startTimeStr?: string | null) => {
  if (!startTimeStr) return 'Offline';
  const start = new Date(startTimeStr).getTime();
  const diffMinutes = Math.max(0, Math.floor((Date.now() - start) / 60000));
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  return hours > 0 ? `${hours}j ${minutes}m` : `${minutes}m`;
};

const statusMeta: Record<SubscriptionDTO['status'], { label: string; chip: object; dot: object; text: object }> = {
  active: { label: 'Aktif', chip: sharedStyles.statusChipActive, dot: sharedStyles.statusDotActive, text: sharedStyles.statusTextActive },
  isolir: { label: 'Isolir', chip: sharedStyles.statusChipIsolir, dot: sharedStyles.statusDotIsolir, text: sharedStyles.statusTextIsolir },
  pending: { label: 'Pending', chip: sharedStyles.statusChipPending, dot: sharedStyles.statusDotPending, text: sharedStyles.statusTextPending },
  terminated: { label: 'Berhenti', chip: sharedStyles.statusChipPending, dot: sharedStyles.statusDotPending, text: sharedStyles.statusTextPending },
};

/** Tab "Koneksi" — khusus role customer: status koneksi realtime, statistik pemakaian data & riwayat sesi PPPoE. */
export default function KoneksiScreen() {
  const { apiFetch } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionDTO | null>(null);
  const [customerNo, setCustomerNo] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [connStatus, setConnStatus] = useState<ConnectionStatusDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  // Dipakai hanya untuk memicu render ulang tiap menit supaya "DURASI SESI" berjalan.
  const [, setDetik] = useState(0);

  const load = useCallback(async (mode: 'awal' | 'segarkan' = 'awal') => {
    // Tarik-untuk-menyegarkan tidak boleh menukar seluruh layar dengan spinner —
    // pengguna kehilangan konteks dan posisi scroll-nya.
    if (mode === 'segarkan') setIsRefreshing(true);
    else setIsLoading(true);
    // allSettled, bukan Promise.all + .catch(() => null): satu panggilan gagal tidak
    // boleh mengosongkan seluruh layar, TAPI kegagalannya juga tidak boleh disamarkan
    // jadi angka nol. Menelan error di sini pernah membuat backend yang belum
    // ter-deploy (endpoint 404) tampak seperti "pelanggan tidak punya pemakaian".
    const [subsRes, profileRes, connRes] = await Promise.allSettled([
      apiFetch('/auth/me/subscriptions'),
      apiFetch('/auth/me/customer'),
      apiFetch('/auth/me/connection-status'),
    ]);

    const subsVal = subsRes.status === 'fulfilled' ? subsRes.value : null;
    const subs: SubscriptionDTO[] = Array.isArray(subsVal) ? subsVal : subsVal?.data || [];
    setSubscription(subs[0] || null);
    setAddress(profileRes.status === 'fulfilled' ? (profileRes.value?.address ?? null) : null);
    setCustomerNo(profileRes.status === 'fulfilled' ? (profileRes.value?.customerNo ?? null) : null);

    if (connRes.status === 'fulfilled') {
      setConnStatus(connRes.value || null);
      setStatusError(null);
    } else {
      setConnStatus(null);
      setStatusError(connRes.reason?.message || 'Status koneksi tidak bisa diambil dari server.');
    }

    setIsLoading(false);
    setIsRefreshing(false);
  }, [apiFetch]);

  // Layar ini berjudul "Realtime", jadi ia harus benar-benar menyegarkan diri:
  // setiap kali tab dibuka kembali (bukan sekali saat mount), supaya pelanggan yang
  // koneksinya baru pulih tidak terus melihat "TERPUTUS".
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Durasi sesi dihitung dari startTime saat render. Tanpa detak ini angkanya beku
  // di nilai saat layar dibuka, padahal sesinya terus berjalan.
  useEffect(() => {
    const timer = setInterval(() => setDetik((n) => n + 1), 60_000);
    return () => clearInterval(timer);
  }, []);

  const meta = subscription ? statusMeta[subscription.status] : null;
  // Sesi di radacct bisa tetap terbuka walau pelanggan sudah diisolir: pemutusan CoA
  // sifatnya best-effort (di produksi Nas-01-Bedog malah timeout), dan pelanggan tetap
  // bisa reconnect ke grup isolir. Tanpa memeriksa subscriptionStatus, pelanggan yang
  // diisolir karena menunggak akan melihat "TERHUBUNG (LIVE)" padahal internetnya mati.
  const isIsolir = connStatus?.subscriptionStatus === 'isolir' || subscription?.status === 'isolir';
  const isLiveConnected = connStatus?.isConnected && connStatus?.activeSession && !isIsolir;
  const activeSess = connStatus?.activeSession;

  return (
    <SafeAreaView style={sharedStyles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#faf9ff" />
      <AppHeader subtitle="STATUS KONEKSI" onOpenSettings={() => setShowSettingsModal(true)} />

      {isLoading ? (
        <View style={sharedStyles.loadingContainer}>
          <ActivityIndicator size="large" color="#0052cc" />
          <Text style={sharedStyles.loadingText}>Memuat status koneksi...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={sharedStyles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={() => load('segarkan')} tintColor="#0052cc" />
          }
        >
          <View style={styles.statusRow}>
            <Text style={styles.title}>Status Koneksi Realtime</Text>
            {meta && (
              <View style={[sharedStyles.statusChip, meta.chip]}>
                <View style={[sharedStyles.statusDot, meta.dot]} />
                <Text style={[sharedStyles.statusText, meta.text]}>{meta.label}</Text>
              </View>
            )}
          </View>

          {/* Kegagalan mengambil status HARUS terlihat — kalau tidak, angka 0 di bawah
              terbaca sebagai "tidak ada pemakaian", padahal datanya cuma gagal diambil. */}
          {statusError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerTitle}>⚠️ Status koneksi tidak tersedia</Text>
              <Text style={styles.errorBannerText}>
                {statusError} Angka pemakaian di bawah belum tentu mencerminkan kondisi sebenarnya.
              </Text>
            </View>
          )}

          {/* Live Session Hero Card */}
          <View style={[styles.heroCard, isLiveConnected ? styles.heroCardOnline : styles.heroCardOffline]}>
            <View style={styles.heroHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={[styles.liveDotBig, { backgroundColor: isLiveConnected ? '#10b981' : '#f43f5e' }]} />
                <Text style={styles.heroStatusText}>
                  {isLiveConnected ? 'TERHUBUNG (LIVE)' : subscription?.status === 'isolir' ? 'TERISOLIR' : 'TERPUTUS / OFFLINE'}
                </Text>
              </View>
              <Text style={styles.heroUsername}>{connStatus?.pppoeUsername || subscription?.pppoeUsername || 'PPPoE'}</Text>
            </View>

            <View style={styles.heroMetaRow}>
              <View style={styles.heroMetaItem}>
                <Text style={styles.heroMetaLabel}>TOTAL PEMAKAIAN</Text>
                <Text style={styles.heroMetaValue}>{formatBytes(activeSess?.totalBytes || 0)}</Text>
              </View>
              <View style={styles.heroMetaItem}>
                <Text style={styles.heroMetaLabel}>DURASI SESI</Text>
                <Text style={styles.heroMetaValue}>{formatDuration(activeSess?.startTime)}</Text>
              </View>
            </View>
          </View>

          {/* Data Usage Bento */}
          <View style={styles.bentoRow}>
            <View style={styles.bento}>
              <Text style={styles.bentoIcon}>⬇️</Text>
              {/* bytesOut = acctoutputoctets = trafik NAS→pelanggan = DOWNLOAD (RFC 2866) */}
              <Text style={styles.bentoValue}>{formatBytes(activeSess?.bytesOut || 0)}</Text>
              <Text style={styles.bentoLabel}>Download Sesi Ini</Text>
            </View>
            <View style={styles.bento}>
              <Text style={styles.bentoIcon}>⬆️</Text>
              <Text style={styles.bentoValue}>{formatBytes(activeSess?.bytesIn || 0)}</Text>
              <Text style={styles.bentoLabel}>Upload Sesi Ini</Text>
            </View>
          </View>

          {/* Active Package Card */}
          <View style={styles.card}>
            <Text style={styles.cardBadge}>RINCIAN LANGGANAN BROADBAND</Text>
            <Text style={styles.cardTitle}>{subscription ? subscription.packageName : 'Tidak ada paket aktif'}</Text>

            {subscription && (
              <View style={styles.rows}>
                <View style={styles.row}>
                  <Text style={styles.label}>Kode Pelanggan</Text>
                  <Text style={styles.value}>{customerNo || '-'}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.label}>Siklus Tagihan</Text>
                  <Text style={styles.value}>Setiap tanggal {subscription.billingDay}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.label}>Tipe Layanan</Text>
                  <Text style={styles.value}>Unlimited</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.label}>Lokasi Pemasangan</Text>
                  <Text style={styles.value} numberOfLines={2}>{address || '-'}</Text>
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      )}

      <BackendUrlModal visible={showSettingsModal} onClose={() => setShowSettingsModal(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  errorBanner: {
    backgroundColor: '#fce8e6',
    borderWidth: 1,
    borderColor: '#f8b4b4',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorBannerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ba1a1a',
  },
  errorBannerText: {
    fontSize: 11,
    color: '#7f1d1d',
    marginTop: 4,
    lineHeight: 15,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#051a3e',
  },
  heroCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
  },
  heroCardOnline: {
    backgroundColor: '#003d9b',
  },
  heroCardOffline: {
    backgroundColor: '#475569',
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  liveDotBig: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  heroStatusText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  heroUsername: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  heroMetaRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 14,
    padding: 12,
  },
  heroMetaItem: {
    alignItems: 'center',
  },
  heroMetaLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 2,
  },
  heroMetaValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
  bentoRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  bento: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9edff',
  },
  bentoIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  bentoValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#051a3e',
  },
  bentoLabel: {
    fontSize: 11,
    color: '#737685',
    marginTop: 2,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e9edff',
  },
  cardBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0052cc',
    letterSpacing: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#051a3e',
    marginTop: 2,
    marginBottom: 14,
  },
  rows: {
    borderTopWidth: 1,
    borderTopColor: '#f1f3ff',
    paddingTop: 12,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 12,
    color: '#434654',
  },
  value: {
    fontSize: 12,
    fontWeight: '700',
    color: '#003d9b',
    flex: 1,
    textAlign: 'right',
    marginLeft: 12,
  },
});
