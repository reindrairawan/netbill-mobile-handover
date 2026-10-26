import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PaymentWebView } from '@/components/payment-webview';
import { MaterialIcons } from '@expo/vector-icons';
import type { ResellerDepositDTO, ResellerDepositStatus } from '@/types/api';
import { sharedStyles } from '@/constants/mobile-styles';
import { SaveQrButton } from '@/components/save-qr-button';

type ApiFetch = (path: string, options?: RequestInit) => Promise<any>;

export const MAX_DEPOSIT_INVOICES = 200;

const STATUS_LABEL: Record<ResellerDepositStatus, string> = {
  pending: 'Menunggu Pembayaran',
  paid: 'Lunas',
  expired: 'Kedaluwarsa',
  cancelled: 'Dibatalkan',
};
const STATUS_COLOR: Record<ResellerDepositStatus, { bg: string; fg: string }> = {
  pending: { bg: '#dae2ff', fg: '#003d9b' },
  paid: { bg: '#d6f5e3', fg: '#0d653d' },
  expired: { bg: '#ffdad6', fg: '#93000a' },
  cancelled: { bg: '#eceef5', fg: '#434654' },
};

export function formatIDR(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/**
 * Modal di iOS tidak bisa dibuka tepat saat modal lain sedang menutup (yang kedua diam-diam
 * tidak tampil). Jeda singkat ini dipakai setiap kali berpindah dari satu modal ke modal lain.
 */
export const afterModalCloses = (fn: () => void) => setTimeout(fn, 450);

/** Halaman pembayaran Midtrans (Snap) untuk setoran, di dalam aplikasi. */
export function DepositPaymentModal({
  url,
  depositId,
  onDone,
}: {
  url: string | null;
  depositId: string | null;
  onDone: () => void;
}) {
  return (
    <Modal visible={!!url} animationType="slide" onRequestClose={onDone}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={styles.paymentHeader}>
          <Text style={styles.paymentHeaderText} numberOfLines={1}>
            Bayar Setoran
          </Text>
          <View style={styles.paymentActions}>
            {depositId ? <SaveQrButton qrPath={`/reseller-deposits/${depositId}/qris`} fileLabel="setoran" /> : null}
            <TouchableOpacity style={styles.paymentDoneBtn} onPress={onDone}>
              <Text style={styles.paymentDoneBtnText}>Selesai</Text>
            </TouchableOpacity>
          </View>
        </View>
        {url ? <PaymentWebView url={url} onFinished={onDone} /> : null}
      </SafeAreaView>
    </Modal>
  );
}

function resultMessage(dep: ResellerDepositDTO) {
  const items = dep.items ?? [];
  const settled = items.filter((i) => i.status === 'settled');
  const excluded = items.filter((i) => i.status === 'excluded');
  const processing = items.filter((i) => i.status === 'pending');

  let msg = `${settled.length} tagihan lunas (${formatIDR(settled.reduce((s, i) => s + i.amount, 0))}). Status isolir pelanggan dibuka otomatis.`;
  if (processing.length > 0) msg += `\n\n${processing.length} tagihan masih diproses dan akan lunas otomatis dalam beberapa menit.`;
  if (excluded.length > 0) {
    msg += `\n\n${excluded.length} tagihan dikecualikan:\n• ${excluded
      .slice(0, 5)
      .map((i) => `${i.invoiceNo}: ${i.excludedReason ?? '-'}`)
      .join('\n• ')}`;
  }
  // Uang untuk tagihan yang dikecualikan sudah terlanjur masuk — reseller harus tahu
  // bahwa nominal ini akan ditindaklanjuti ISP, bukan hilang.
  if (dep.overpaidAmount > 0) {
    msg += `\n\nKelebihan setoran ${formatIDR(dep.overpaidAmount)} akan dikembalikan atau diperhitungkan oleh ISP.`;
  }
  return msg;
}

/**
 * Tanyakan status asli setoran ke Midtrans (lewat backend) lalu beri tahu reseller
 * hasilnya. Dipanggil setiap kali halaman pembayaran ditutup — webhook bisa terlambat,
 * jadi reseller tidak boleh hanya melihat status lokal.
 */
export async function reportDepositStatus(
  apiFetch: ApiFetch,
  depositId: string,
  handlers: { onPayAgain: (url: string) => void; onChanged: () => void },
) {
  let dep: ResellerDepositDTO;
  try {
    dep = await apiFetch(`/reseller-deposits/${depositId}/check-status`, { method: 'POST' });
  } catch (e: any) {
    Alert.alert('Gagal Mengecek Status', `${e.message || 'Terjadi kesalahan server.'}\n\nStatus setoran bisa dicek lagi dari Riwayat Setoran.`);
    return;
  }
  handlers.onChanged();

  if (dep.status === 'paid') {
    Alert.alert('Setoran Berhasil', resultMessage(dep));
    return;
  }
  if (dep.status !== 'pending') {
    Alert.alert(`Setoran ${STATUS_LABEL[dep.status]}`, `Setoran ${dep.depositNo} tidak bisa dibayar lagi. Tagihannya kembali terbuka dan bisa disetor ulang.`);
    return;
  }

  Alert.alert(
    'Menunggu Pembayaran',
    `Setoran ${dep.depositNo} (${formatIDR(dep.totalAmount)}) belum terbayar. Selama menunggu, ${dep.invoiceCount} tagihan ini terkunci dan tidak bisa dibayar pelanggan sampai ${formatDateTime(dep.expiresAt)}.\n\nKalau Anda baru saja membayar, cek lagi beberapa saat lagi dari Riwayat Setoran.`,
    [
      { text: 'Nanti', style: 'cancel' },
      { text: 'Batalkan Setoran', style: 'destructive', onPress: () => confirmCancel(apiFetch, dep, handlers.onChanged) },
      { text: 'Bayar Lagi', onPress: () => payAgain(apiFetch, dep.id, handlers.onPayAgain) },
    ],
  );
}

async function payAgain(apiFetch: ApiFetch, depositId: string, onPayAgain: (url: string) => void) {
  try {
    const res = await apiFetch(`/reseller-deposits/${depositId}/pay`, { method: 'POST' });
    onPayAgain(res.redirectUrl);
  } catch (e: any) {
    Alert.alert('Tidak Bisa Membayar', e.message || 'Gagal membuka halaman pembayaran.');
  }
}

function confirmCancel(apiFetch: ApiFetch, dep: ResellerDepositDTO, onChanged: () => void) {
  Alert.alert(
    'Batalkan Setoran?',
    `Transaksi Midtrans setoran ${dep.depositNo} akan dimatikan dan ${dep.invoiceCount} tagihan kembali bisa dibayar. Jangan batalkan kalau Anda sudah mentransfer.`,
    [
      { text: 'Kembali', style: 'cancel' },
      {
        text: 'Ya, Batalkan',
        style: 'destructive',
        onPress: async () => {
          try {
            const res: ResellerDepositDTO = await apiFetch(`/reseller-deposits/${dep.id}/cancel`, { method: 'POST' });
            onChanged();
            Alert.alert(
              res.status === 'paid' ? 'Setoran Sudah Dibayar' : 'Setoran Dibatalkan',
              res.status === 'paid' ? `Pembayaran ternyata sudah masuk, jadi setoran tidak dibatalkan.\n\n${resultMessage(res)}` : 'Tagihan pelanggan kembali terbuka.',
            );
          } catch (e: any) {
            Alert.alert('Gagal Membatalkan', e.message || 'Terjadi kesalahan server.');
          }
        },
      },
    ],
  );
}

/** Riwayat setoran milik kategori reseller, dengan detail per tagihan. */
export function DepositHistoryModal({
  visible,
  apiFetch,
  onClose,
  onPay,
  onChanged,
}: {
  visible: boolean;
  apiFetch: ApiFetch;
  onClose: () => void;
  /** Dipanggil dengan link Snap; pemanggil yang membuka halaman pembayarannya. */
  onPay: (url: string, depositId: string) => void;
  onChanged: () => void;
}) {
  const [list, setList] = useState<ResellerDepositDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<ResellerDepositDTO | null>(null);
  const [busy, setBusy] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/reseller-deposits?page=1&pageSize=50');
      setList(res?.data ?? []);
    } catch (e: any) {
      Alert.alert('Gagal Memuat Riwayat', e.message || 'Terjadi kesalahan server.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    if (visible) {
      setDetail(null);
      loadList();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const openDetail = async (id: string) => {
    setBusy(true);
    try {
      setDetail(await apiFetch(`/reseller-deposits/${id}`));
    } catch (e: any) {
      Alert.alert('Gagal Memuat Detail', e.message || 'Terjadi kesalahan server.');
    } finally {
      setBusy(false);
    }
  };

  const checkStatus = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      const updated: ResellerDepositDTO = await apiFetch(`/reseller-deposits/${detail.id}/check-status`, { method: 'POST' });
      setDetail(updated);
      onChanged();
      loadList();
      if (updated.status === 'paid' && detail.status !== 'paid') Alert.alert('Setoran Berhasil', resultMessage(updated));
    } catch (e: any) {
      Alert.alert('Gagal Mengecek Status', e.message || 'Terjadi kesalahan server.');
    } finally {
      setBusy(false);
    }
  };

  const pay = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      const res = await apiFetch(`/reseller-deposits/${detail.id}/pay`, { method: 'POST' });
      onPay(res.redirectUrl, detail.id);
    } catch (e: any) {
      Alert.alert('Tidak Bisa Membayar', e.message || 'Gagal membuka halaman pembayaran.');
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    if (!detail) return;
    confirmCancel(apiFetch, detail, () => {
      onChanged();
      loadList();
      openDetail(detail.id);
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={detail ? () => setDetail(null) : onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            {detail ? (
              <TouchableOpacity onPress={() => setDetail(null)} style={{ marginRight: 8 }} accessibilityLabel="Kembali ke daftar">
                <MaterialIcons name="arrow-back" size={24} color="#434654" />
              </TouchableOpacity>
            ) : null}
            <View style={{ flex: 1 }}>
              <Text style={sharedStyles.modalTitle}>{detail ? detail.depositNo : 'Riwayat Setoran'}</Text>
              {!detail && <Text style={styles.subtitle}>Setoran tagihan pelanggan yang dibayar lewat Midtrans.</Text>}
            </View>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Tutup">
              <MaterialIcons name="close" size={24} color="#434654" />
            </TouchableOpacity>
          </View>

          {loading || (busy && !detail) ? (
            <ActivityIndicator size="large" color="#003d9b" style={{ marginVertical: 40 }} />
          ) : detail ? (
            <DepositDetail deposit={detail} busy={busy} onCheck={checkStatus} onPay={pay} onCancel={cancel} />
          ) : list.length === 0 ? (
            <View style={styles.empty}>
              <MaterialIcons name="account-balance-wallet" size={36} color="#b0b8d1" />
              <Text style={styles.emptyText}>Belum ada setoran.</Text>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ paddingBottom: 16 }}>
              {list.map((d) => (
                <TouchableOpacity key={d.id} style={styles.card} onPress={() => openDetail(d.id)}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.depositNo}>{d.depositNo}</Text>
                    <StatusBadge status={d.status} />
                  </View>
                  <View style={[styles.rowBetween, { marginTop: 6 }]}>
                    <Text style={styles.meta}>
                      {d.invoiceCount} tagihan · {d.paidAt ? `Dibayar ${formatDateTime(d.paidAt)}` : d.status === 'pending' ? `Batas ${formatDateTime(d.expiresAt)}` : formatDateTime(d.createdAt)}
                    </Text>
                    <Text style={styles.amount}>{formatIDR(d.totalAmount)}</Text>
                  </View>
                  {d.overpaidAmount > 0 && <Text style={styles.overpaid}>Kelebihan {formatIDR(d.overpaidAmount)} — ditindaklanjuti ISP</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function StatusBadge({ status }: { status: ResellerDepositStatus }) {
  const c = STATUS_COLOR[status];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.fg }]}>{STATUS_LABEL[status]}</Text>
    </View>
  );
}

const ITEM_LABEL = { pending: 'DIPROSES', settled: 'LUNAS', excluded: 'DIKECUALIKAN' } as const;
const ITEM_COLOR = { pending: '#003d9b', settled: '#0d653d', excluded: '#93000a' } as const;

function DepositDetail({
  deposit,
  busy,
  onCheck,
  onPay,
  onCancel,
}: {
  deposit: ResellerDepositDTO;
  busy: boolean;
  onCheck: () => void;
  onPay: () => void;
  onCancel: () => void;
}) {
  const items = deposit.items ?? [];
  const processing = items.some((i) => i.status === 'pending') && deposit.status === 'paid';
  return (
    <>
      <ScrollView style={{ maxHeight: 440 }} contentContainerStyle={{ paddingBottom: 12 }}>
        <View style={[styles.rowBetween, { marginBottom: 10 }]}>
          <StatusBadge status={deposit.status} />
          <Text style={styles.amountLarge}>{formatIDR(deposit.totalAmount)}</Text>
        </View>
        <Text style={styles.meta}>
          {deposit.paidAt
            ? `Dibayar ${formatDateTime(deposit.paidAt)}`
            : deposit.status === 'pending'
              ? `Bayar sebelum ${formatDateTime(deposit.expiresAt)}`
              : `Dibuat ${formatDateTime(deposit.createdAt)}`}
        </Text>
        {deposit.status === 'pending' && (
          <Text style={styles.notice}>Selama menunggu pembayaran, tagihan di bawah terkunci dan tidak bisa dibayar pelanggan.</Text>
        )}
        {processing && <Text style={styles.notice}>Pembayaran diterima. Sebagian tagihan masih diproses dan akan lunas otomatis.</Text>}
        {deposit.overpaidAmount > 0 && (
          <Text style={[styles.notice, styles.noticeDanger]}>
            Kelebihan setoran {formatIDR(deposit.overpaidAmount)}: tagihan yang dikecualikan keburu lunas lewat jalur lain. Nominal ini akan
            dikembalikan atau diperhitungkan oleh ISP.
          </Text>
        )}

        {items.map((item) => (
          <View key={item.invoiceNo} style={styles.itemRow}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.itemName}>{item.customerName ?? '—'}</Text>
              <Text style={styles.meta}>{item.invoiceNo}</Text>
              {item.excludedReason ? <Text style={styles.itemReason}>{item.excludedReason}</Text> : null}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.amount}>{formatIDR(item.amount)}</Text>
              <Text style={[styles.itemStatus, { color: ITEM_COLOR[item.status] }]}>{ITEM_LABEL[item.status]}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {(deposit.status === 'pending' || processing) && (
        <View style={styles.actions}>
          {deposit.status === 'pending' && (
            <TouchableOpacity style={[styles.btn, styles.btnPrimary, busy && styles.btnBusy]} disabled={busy} onPress={onPay}>
              <Text style={styles.btnPrimaryText}>Bayar Lagi</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.btn, styles.btnOutline, busy && styles.btnBusy]} disabled={busy} onPress={onCheck}>
            {busy ? <ActivityIndicator size="small" color="#003d9b" /> : <Text style={styles.btnOutlineText}>Cek Status</Text>}
          </TouchableOpacity>
          {deposit.status === 'pending' && (
            <TouchableOpacity style={[styles.btn, styles.btnDanger, busy && styles.btnBusy]} disabled={busy} onPress={onCancel}>
              <Text style={styles.btnDangerText}>Batalkan Setoran</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  paymentHeader: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#0052cc',
  },
  paymentHeaderText: { fontSize: 14, fontWeight: 'bold', color: '#fff', flexShrink: 1, marginRight: 8 },
  paymentActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  paymentDoneBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 4, backgroundColor: 'rgba(255, 255, 255, 0.2)' },
  paymentDoneBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 24,
    maxHeight: '92%',
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  subtitle: { fontSize: 11, color: '#434654', marginTop: 2 },
  empty: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyText: { fontSize: 13, color: '#737685' },
  card: { borderWidth: 1, borderColor: '#e9edff', borderRadius: 16, padding: 14, marginBottom: 10 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  depositNo: { fontSize: 13, fontWeight: '800', color: '#003d9b', fontFamily: 'monospace', flexShrink: 1 },
  meta: { fontSize: 11, color: '#434654' },
  amount: { fontSize: 13, fontWeight: '800', color: '#141b2b' },
  amountLarge: { fontSize: 18, fontWeight: '800', color: '#141b2b' },
  overpaid: { marginTop: 6, fontSize: 11, fontWeight: '700', color: '#93000a' },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  badgeText: { fontSize: 10, fontWeight: '800' },
  notice: { marginTop: 10, padding: 10, borderRadius: 12, backgroundColor: '#f1f3ff', fontSize: 12, color: '#141b2b' },
  noticeDanger: { backgroundColor: '#ffdad6', color: '#93000a' },
  itemRow: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f3ff', marginTop: 4 },
  itemName: { fontSize: 13, fontWeight: '700', color: '#141b2b' },
  itemReason: { fontSize: 11, color: '#93000a', marginTop: 2 },
  itemStatus: { fontSize: 10, fontWeight: '800', marginTop: 2 },
  actions: { gap: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f3ff' },
  btn: { borderRadius: 14, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  btnBusy: { opacity: 0.6 },
  btnPrimary: { backgroundColor: '#003d9b' },
  btnPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  btnOutline: { borderWidth: 1, borderColor: '#c3c6d6' },
  btnOutlineText: { color: '#003d9b', fontWeight: '800', fontSize: 14 },
  btnDanger: { backgroundColor: '#ffdad6' },
  btnDangerText: { color: '#93000a', fontWeight: '800', fontSize: 14 },
});
