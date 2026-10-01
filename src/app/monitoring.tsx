import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/auth-context';
import { AppHeader } from '@/components/app-header';
import { BackendUrlModal } from '@/components/backend-url-modal';
import { sharedStyles } from '@/constants/mobile-styles';

interface SessionDTO {
  username: string;
  customerId: string | null;
  customerName: string | null;
  subscriptionId?: string | null;
  subscriptionStatus?: string | null;
  nasIp: string;
  framedIp: string | null;
  startTime: string;
  bytesIn: number;
  bytesOut: number;
}

const formatBytes = (bytes: number) => {
  if (bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb.toFixed(1)} MB`;
};

const formatDuration = (startTime: string) => {
  const start = new Date(startTime).getTime();
  const diffMinutes = Math.max(0, Math.floor((Date.now() - start) / 60000));
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  return hours > 0 ? `${hours}j ${minutes}m` : `${minutes}m`;
};

/** Tab "Monitoring" — khusus role staff: sesi PPPoE aktif dari RADIUS (radacct), dengan tombol isolir/unisolir instan. */
export default function MonitoringScreen() {
  const { apiFetch, can } = useAuth();
  const canLifecycle = can('subscriptions.lifecycle');

  const [sessions, setSessions] = useState<SessionDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mutatingUsername, setMutatingUsername] = useState<string | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const loadSessions = useCallback(async (mode: 'awal' | 'segarkan' = 'awal') => {
    // Dipisah dari isLoading: kalau disatukan, menarik daftar ke bawah membuat seluruh
    // daftar lenyap diganti spinner layar penuh, lalu kembali dari posisi paling atas.
    if (mode === 'segarkan') setIsRefreshing(true);
    else setIsLoading(true);
    try {
      const res = await apiFetch('/monitoring/sessions');
      setSessions(Array.isArray(res) ? res : []);
    } catch (e: any) {
      Alert.alert('Gagal Memuat Sesi', e.message || 'Koneksi ke backend bermasalah.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleToggleIsolir = async (item: SessionDTO) => {
    if (!item.subscriptionId) {
      Alert.alert('Info', 'Pelanggan ini tidak terdaftar di database NetBill.');
      return;
    }

    const isIsolir = item.subscriptionStatus === 'isolir';
    const actionText = isIsolir ? 'membuka isolir' : 'mengisolir';
    const endpoint = isIsolir ? 'unisolir' : 'isolir';

    Alert.alert(
      `Konfirmasi ${isIsolir ? 'Buka Isolir' : 'Isolir'}`,
      `Apakah Anda yakin ingin ${actionText} koneksi pelanggan "${item.customerName || item.username}"?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: `Ya, ${isIsolir ? 'Buka Isolir' : 'Isolir'}`,
          style: isIsolir ? 'default' : 'destructive',
          onPress: async () => {
            setMutatingUsername(item.username);
            try {
              await apiFetch(`/subscriptions/${item.subscriptionId}/${endpoint}`, { method: 'POST' });
              Alert.alert('Sukses', `Berhasil ${actionText} koneksi ${item.username}.`);
              loadSessions();
            } catch (e: any) {
              Alert.alert('Gagal', e.message || `Gagal ${actionText} koneksi.`);
            } finally {
              setMutatingUsername(null);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={sharedStyles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#faf9ff" />
      <AppHeader subtitle="MONITORING KONEKSI" onOpenSettings={() => setShowSettingsModal(true)} />

      {isLoading ? (
        <View style={sharedStyles.loadingContainer}>
          <ActivityIndicator size="large" color="#0052cc" />
          <Text style={sharedStyles.loadingText}>Memuat sesi aktif...</Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={sharedStyles.scrollContent}
          data={sessions}
          // radacct rutin menyimpan >1 baris terbuka untuk username yang sama saat paket
          // Stop dari NAS hilang — kasus yang justru sering terjadi di NAS bermasalah,
          // dan justru itu yang dicek teknisi. Dengan username saja sebagai key, baris
          // kembar bertukar isi saat digulir.
          keyExtractor={(item) => `${item.username}|${item.startTime}|${item.nasIp}`}
          onRefresh={() => loadSessions('segarkan')}
          refreshing={isRefreshing}
          ListHeaderComponent={<Text style={styles.countLabel}>{sessions.length} sesi PPPoE aktif</Text>}
          ListEmptyComponent={<Text style={sharedStyles.emptyText}>Tidak ada sesi aktif saat ini.</Text>}
          renderItem={({ item }) => {
            const isMutatingThis = mutatingUsername === item.username;
            const isIsolir = item.subscriptionStatus === 'isolir';

            return (
              <View style={styles.row}>
                <View style={styles.rowHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName}>{item.customerName || item.username}</Text>
                    <Text style={styles.rowSub}>{item.username} · {formatDuration(item.startTime)}</Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={[styles.liveChip, isIsolir && { backgroundColor: '#fce8e6' }]}>
                      <View style={[styles.liveDot, isIsolir && { backgroundColor: '#c5221f' }]} />
                      <Text style={[styles.liveText, isIsolir && { color: '#c5221f' }]}>
                        {isIsolir ? 'ISOLIR' : 'LIVE'}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.metaRow}>
                  <Text style={styles.metaItem}>IP: {item.framedIp || '-'}</Text>
                  {/* ↓ download = acctoutputoctets (NAS→pelanggan), ↑ upload = acctinputoctets */}
                  <Text style={styles.metaItem}>↓ {formatBytes(item.bytesOut)}</Text>
                  <Text style={styles.metaItem}>↑ {formatBytes(item.bytesIn)}</Text>
                </View>

                {canLifecycle && item.subscriptionId && (
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[styles.isolirBtn, isIsolir ? styles.unisolirBtnBg : styles.isolirBtnBg]}
                      onPress={() => handleToggleIsolir(item)}
                      disabled={isMutatingThis}
                    >
                      {isMutatingThis ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.isolirBtnText}>
                          {isIsolir ? '🔓 Buka Isolir' : '🛑 Isolir Koneksi'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}

      <BackendUrlModal visible={showSettingsModal} onClose={() => setShowSettingsModal(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  countLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 12,
  },
  row: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e9edff',
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  liveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e6f4ea',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#137333',
    marginRight: 4,
  },
  liveText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#137333',
  },
  rowSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f3ff',
  },
  metaItem: {
    fontSize: 11,
    color: '#434654',
    fontWeight: '600',
  },
  actionRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f3ff',
    alignItems: 'flex-end',
  },
  isolirBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  isolirBtnBg: {
    backgroundColor: '#dc3545',
  },
  unisolirBtnBg: {
    backgroundColor: '#10b981',
  },
  isolirBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
});
