import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PaymentWebView } from '@/components/payment-webview';
import { useAuth } from '@/contexts/auth-context';
import { AppHeader } from '@/components/app-header';
import { BackendUrlModal } from '@/components/backend-url-modal';
import { sharedStyles } from '@/constants/mobile-styles';
import { SaveQrButton } from '@/components/save-qr-button';

// Tipe diambil dari @netbill/shared, bukan disalin ulang di sini. Salinan lokal
// sebelumnya tidak memberi tahu bahwa `id` berisi publicId, dan dari situlah tombol
// "Bayar" sempat mengirim invoiceNo ke endpoint yang mewajibkan UUID.
import type { InvoiceDTO } from '@/types/api';

const formatIDR = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

const formatDate = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

/** Tab "Tagihan" — khusus role customer: daftar invoice + bayar via Midtrans (WebView in-app). */
export default function TagihanScreen() {
  const { apiFetch } = useAuth();
  const [invoices, setInvoices] = useState<InvoiceDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState('');
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDTO | null>(null);

  const loadInvoices = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch('/auth/me/invoices');
      const data: InvoiceDTO[] = Array.isArray(res) ? res : res?.data || [];
      setInvoices(data);
    } catch (e: any) {
      Alert.alert('Gagal Memuat Tagihan', e.message || 'Koneksi ke backend bermasalah.');
    } finally {
      setIsLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const handlePayInvoice = async (invoice: InvoiceDTO) => {
    try {
      // WAJIB publicId (UUID), bukan invoiceNo — endpoint portal memvalidasi z.string().uuid().
      // `id` dari /auth/me/invoices memang sudah berisi publicId.
      const res = await apiFetch(`/portal/invoices/${invoice.id}/gateway`, {
        method: 'POST',
        body: JSON.stringify({ forceNew: true }),
      });
      if (res?.redirectUrl) {
        setPayingInvoiceId(invoice.id);
        setPaymentUrl(res.redirectUrl);
        setShowPaymentModal(true);
      } else {
        Alert.alert('Error', 'Gagal mendapatkan tautan pembayaran.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Gagal memicu gerbang pembayaran.');
    }
  };

  const statusLabel: Record<InvoiceDTO['status'], string> = {
    unpaid: 'Belum Bayar',
    overdue: 'Lewat Jatuh Tempo',
    paid: 'Lunas',
    void: 'Dibatalkan',
  };

  return (
    <SafeAreaView style={sharedStyles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#faf9ff" />
      <AppHeader subtitle="TAGIHAN & PEMBAYARAN" onOpenSettings={() => setShowSettingsModal(true)} />

      {isLoading ? (
        <View style={sharedStyles.loadingContainer}>
          <ActivityIndicator size="large" color="#0052cc" />
          <Text style={sharedStyles.loadingText}>Memuat tagihan...</Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={sharedStyles.scrollContent}
          data={invoices}
          keyExtractor={(item) => item.id}
          onRefresh={loadInvoices}
          refreshing={isLoading}
          ListEmptyComponent={<Text style={sharedStyles.emptyText}>Belum ada tagihan tercatat.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.invoiceCard} activeOpacity={0.9} onPress={() => setSelectedInvoice(item)}>
              <View style={styles.invoiceHeader}>
                <View>
                  <Text style={styles.invoiceNoText}>{item.invoiceNo || 'INV-PELANGGAN'}</Text>
                  <Text style={styles.invoicePeriod}>{item.periodMonth}</Text>
                </View>
                <View
                  style={[
                    styles.statusChip,
                    item.status === 'paid' && styles.statusChipPaid,
                    item.status === 'unpaid' && styles.statusChipUnpaid,
                    item.status === 'overdue' && styles.statusChipOverdue,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusChipText,
                      item.status === 'paid' && { color: '#0d653d' },
                      item.status === 'unpaid' && { color: '#003d9b' },
                      item.status === 'overdue' && { color: '#ba1a1a' },
                    ]}
                  >
                    {statusLabel[item.status]}
                  </Text>
                </View>
              </View>

              <Text style={styles.invoiceAmount}>{formatIDR(item.amount)}</Text>
              <Text style={styles.invoiceDue}>Jatuh tempo: {formatDate(item.dueDate)}</Text>

              <View style={styles.cardFooterRow}>
                <Text style={styles.detailLinkText}>Lihat Rincian Tagihan ›</Text>
                {(item.status === 'unpaid' || item.status === 'overdue') && (
                  <TouchableOpacity style={styles.payButtonInline} onPress={() => handlePayInvoice(item)}>
                    <Text style={styles.payButtonText}>Bayar Online →</Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      <BackendUrlModal visible={showSettingsModal} onClose={() => setShowSettingsModal(false)} />

      {/* Invoice Detail Modal */}
      <Modal visible={!!selectedInvoice} transparent animationType="fade" onRequestClose={() => setSelectedInvoice(null)}>
        <View style={sharedStyles.modalBg}>
          <View style={sharedStyles.settingsModalCard}>
            <Text style={sharedStyles.modalTitle}>📄 Rincian Tagihan</Text>
            {selectedInvoice && (
              <View style={sharedStyles.detailList}>
                <View style={sharedStyles.detailRow}>
                  <Text style={sharedStyles.detailLabel}>No. Invoice</Text>
                  <Text style={sharedStyles.detailVal}>{selectedInvoice.invoiceNo}</Text>
                </View>
                <View style={sharedStyles.detailRow}>
                  <Text style={sharedStyles.detailLabel}>Periode Tagihan</Text>
                  <Text style={sharedStyles.detailVal}>{selectedInvoice.periodMonth}</Text>
                </View>
                <View style={sharedStyles.detailRow}>
                  <Text style={sharedStyles.detailLabel}>Total Tagihan</Text>
                  <Text style={[sharedStyles.detailVal, { color: '#0052cc', fontWeight: '800' }]}>{formatIDR(selectedInvoice.amount)}</Text>
                </View>
                <View style={sharedStyles.detailRow}>
                  <Text style={sharedStyles.detailLabel}>Status Pembayaran</Text>
                  <Text style={[sharedStyles.detailVal, { fontWeight: '700', color: selectedInvoice.status === 'paid' ? '#0d653d' : selectedInvoice.status === 'overdue' ? '#ba1a1a' : '#003d9b' }]}>
                    {statusLabel[selectedInvoice.status]}
                  </Text>
                </View>
                <View style={sharedStyles.detailRow}>
                  <Text style={sharedStyles.detailLabel}>Batas Jatuh Tempo</Text>
                  <Text style={sharedStyles.detailVal}>{formatDate(selectedInvoice.dueDate)}</Text>
                </View>
                <View style={sharedStyles.detailRow}>
                  <Text style={sharedStyles.detailLabel}>Metode Pembayaran</Text>
                  <Text style={sharedStyles.detailVal}>Pembayaran via QRIS</Text>
                </View>
              </View>
            )}

            {(selectedInvoice?.status === 'unpaid' || selectedInvoice?.status === 'overdue') && (
              <TouchableOpacity
                style={[sharedStyles.modalBtn, sharedStyles.modalBtnSave, { width: '100%', marginTop: 16, backgroundColor: '#0052cc' }]}
                onPress={() => {
                  const inv = selectedInvoice;
                  setSelectedInvoice(null);
                  if (inv) handlePayInvoice(inv);
                }}
              >
                <Text style={sharedStyles.modalBtnSaveText}>⚡ Bayar Sekarang via QRIS</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[sharedStyles.modalBtnFullCancel, { marginTop: 10 }]}
              onPress={() => setSelectedInvoice(null)}
            >
              <Text style={sharedStyles.modalBtnCancelText}>Batal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Payment Gateway Modal */}
      <Modal
        visible={showPaymentModal}
        animationType="slide"
        onRequestClose={() => {
          setShowPaymentModal(false);
          setPaymentUrl('');
        }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={styles.paymentHeader}>
            <Text style={styles.paymentHeaderText} numberOfLines={1}>
              ⚡ Pembayaran via QRIS
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {payingInvoiceId ? <SaveQrButton qrPath={`/portal/invoices/${payingInvoiceId}/qris`} fileLabel="tagihan" /> : null}
              <TouchableOpacity
                style={styles.paymentDoneBtn}
                onPress={() => {
                  setShowPaymentModal(false);
                  setPaymentUrl('');
                  loadInvoices();
                }}
              >
                <Text style={styles.paymentDoneBtnText}>Selesai</Text>
              </TouchableOpacity>
            </View>
          </View>
          {paymentUrl ? (
            <PaymentWebView
              url={paymentUrl}
              onFinished={() => {
                setShowPaymentModal(false);
                setPaymentUrl('');
                loadInvoices();
              }}
            />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#666' }}>Tautan pembayaran tidak valid.</Text>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  invoiceCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e9edff',
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  invoiceNoText: {
    fontSize: 11,
    color: '#737685',
    fontWeight: '700',
  },
  invoicePeriod: {
    fontSize: 14,
    fontWeight: '700',
    color: '#051a3e',
    marginTop: 2,
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  statusChipPaid: {
    backgroundColor: '#e6f4ea',
  },
  statusChipUnpaid: {
    backgroundColor: '#e8f0fe',
  },
  statusChipOverdue: {
    backgroundColor: '#fce8e6',
  },
  statusChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#334155',
  },
  invoiceAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: '#051a3e',
    marginVertical: 8,
  },
  invoiceDue: {
    fontSize: 11,
    color: '#737685',
    marginBottom: 12,
  },
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f3ff',
  },
  detailLinkText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0052cc',
  },
  payButtonInline: {
    backgroundColor: '#0052cc',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  payButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  paymentHeader: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#0052cc',
  },
  paymentHeaderText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    flexShrink: 1,
    marginRight: 8,
  },
  paymentDoneBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  paymentDoneBtnText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
