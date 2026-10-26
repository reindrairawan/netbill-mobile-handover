import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/auth-context';
import { AppHeader } from '@/components/app-header';
import { BackendUrlModal } from '@/components/backend-url-modal';
import { sharedStyles } from '@/constants/mobile-styles';
import {
  afterModalCloses,
  DepositHistoryModal,
  DepositPaymentModal,
  MAX_DEPOSIT_INVOICES,
  reportDepositStatus,
} from '@/components/reseller-deposit';
import { useRouter } from 'expo-router';

// Dipakai dari @netbill/shared, bukan disalin ulang. Salinan lokal tidak pernah
// menyebutkan bahwa `id` adalah publicId, dan dari situlah tagihan karangan sempat
// dikirim ke /payments/batch memakai id pelanggan.
import type { InvoiceDTO, SubscriptionDTO } from '@/types/api';
import { isResellerScopedRole } from '@/types/api';

interface StaffDashboardSummary {
  categoryName?: string;
  revenueThisMonth: number;
  customerCounts: { total: number; active: number; isolir: number; pending: number };
  billingSummary: { overdueCount: number; overdueAmount: number };
}

interface InfraItem {
  id: string;
  name: string;
  type: string;
  status: 'online' | 'offline';
}

interface StaffActivity {
  id: string;
  initials: string;
  staffName: string;
  actionText: string;
  targetRef: string;
  timeAgo: string;
  badgeBg: string;
}

interface ResellerCustomer {
  id: string;
  customerNo: string;
  name: string;
  status: 'pending' | 'active' | 'isolir' | 'terminated';
  categoryName?: string | null;
}

interface PackageItem {
  id: number;
  name: string;
  price: number;
  isActive: boolean;
}

const formatIDR = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

export default function BerandaScreen() {
  const { user, apiFetch, can, permissions, isBootstrapping } = useAuth();
  const router = useRouter();
  const isStaff = user?.role !== 'customer';
  // Termasuk teknisi reseller: tampilan & data dibatasi ke kategori reseller.
  const isReseller = isResellerScopedRole(user?.role);

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Customer State
  const [subscription, setSubscription] = useState<SubscriptionDTO | null>(null);
  const [unpaidInvoice, setUnpaidInvoice] = useState<InvoiceDTO | null>(null);

  // Staff & Reseller Summary State
  const [summary, setSummary] = useState<StaffDashboardSummary | null>(null);

  // Dynamic Data Lists (100% dari Database Backend)
  const [infraList, setInfraList] = useState<InfraItem[]>([]);
  const [activities, setActivities] = useState<StaffActivity[]>([]);
  const [resellerCustomers, setResellerCustomers] = useState<ResellerCustomer[]>([]);
  const [availablePackages, setAvailablePackages] = useState<PackageItem[]>([]);
  const [showPackagesModal, setShowPackagesModal] = useState(false);
  const [pkgQuery, setPkgQuery] = useState('');

  const [selectedCustDetail, setSelectedCustDetail] = useState<ResellerCustomer | null>(null);
  const [selectedCustSub, setSelectedCustSub] = useState<SubscriptionDTO | null>(null);
  const [isLoadingCustDetail, setIsLoadingCustDetail] = useState(false);

  const openCustomerDetail = async (cust: ResellerCustomer) => {
    setSelectedCustDetail(cust);
    setSelectedCustSub(null);
    setIsLoadingCustDetail(true);
    try {
      const res = await apiFetch(`/subscriptions?customerId=${cust.id}`);
      const subs: SubscriptionDTO[] = Array.isArray(res) ? res : res?.data || [];
      setSelectedCustSub(subs[0] || null);
    } catch (e: any) {
      console.error('Gagal memuat langganan pelanggan:', e);
    } finally {
      setIsLoadingCustDetail(false);
    }
  };

  // Batch Collection State
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [unpaidInvoicesList, setUnpaidInvoicesList] = useState<any[]>([]);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [batchSearchQuery, setBatchSearchQuery] = useState('');
  const [isLoadingBatchInvoices, setIsLoadingBatchInvoices] = useState(false);

  // Setoran reseller via Midtrans
  const canDeposit = can('billing.reseller_deposit');
  const [depositPayUrl, setDepositPayUrl] = useState<string | null>(null);
  const [activeDepositId, setActiveDepositId] = useState<string | null>(null);
  const [showDepositHistory, setShowDepositHistory] = useState(false);
  const [isSubmittingDeposit, setIsSubmittingDeposit] = useState(false);
  // Tagihan yang sedang ada di setoran pending tidak bisa dipilih lagi (backend menolaknya).
  const isLocked = (inv: any) => !!inv.lockedByDeposit;

  const openBatchModal = async () => {
    setShowBatchModal(true);
    setSelectedInvoiceIds([]);
    setBatchSearchQuery('');
    setIsLoadingBatchInvoices(true);
    let unpaidInvoices: any[] = [];

    // Ambil HANYA tagihan yang benar-benar ada di database. `status` di /invoices cuma
    // menerima satu nilai, jadi unpaid & overdue diminta terpisah lalu digabung.
    // pageSize eksplisit — default endpoint cuma 20, jauh dari cukup untuk penagihan massal.
    try {
      const [unpaidRes, overdueRes] = await Promise.all([
        apiFetch('/invoices?status=unpaid&page=1&pageSize=1000'),
        apiFetch('/invoices?status=overdue&page=1&pageSize=1000'),
      ]);
      const pick = (res: any): any[] => (Array.isArray(res) ? res : res?.data || []);
      unpaidInvoices = [...pick(unpaidRes), ...pick(overdueRes)];
    } catch (e: any) {
      // Jangan pernah mengarang tagihan pengganti di sini. Angka yang ditampilkan ke
      // reseller harus selalu berasal dari invoice nyata, karena daftar ini langsung
      // dikirim ke /reseller-deposits untuk disetor.
      Alert.alert('Gagal Memuat Tagihan', e.message || 'Tidak bisa mengambil daftar tagihan dari server.');
    }

    setUnpaidInvoicesList(unpaidInvoices);
    setIsLoadingBatchInvoices(false);
  };

  const toggleSelectInvoice = (id: string) => {
    setSelectedInvoiceIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAllInvoices = () => {
    const filtered = unpaidInvoicesList.filter(
      (i) => !isLocked(i) && i.customerName?.toLowerCase().includes(batchSearchQuery.toLowerCase())
    );
    if (selectedInvoiceIds.length === filtered.length) {
      setSelectedInvoiceIds([]);
    } else {
      setSelectedInvoiceIds(filtered.map((i) => i.id));
    }
  };

  const openDepositPayment = (url: string, depositId: string) => {
    setActiveDepositId(depositId);
    afterModalCloses(() => setDepositPayUrl(url));
  };

  const onDepositPaymentDone = () => {
    setDepositPayUrl(null);
    const id = activeDepositId;
    if (!id) return;
    afterModalCloses(() =>
      reportDepositStatus(apiFetch, id, {
        onPayAgain: (url) => openDepositPayment(url, id),
        onChanged: () => loadData(),
      }),
    );
  };

  const submitDeposit = () => {
    const selected = unpaidInvoicesList.filter((i) => selectedInvoiceIds.includes(i.id));
    if (selected.length === 0) {
      Alert.alert('Pilih Tagihan', 'Silakan pilih minimal 1 tagihan pelanggan untuk disetor.');
      return;
    }
    if (selected.length > MAX_DEPOSIT_INVOICES) {
      Alert.alert('Terlalu Banyak Tagihan', `Maksimal ${MAX_DEPOSIT_INVOICES} tagihan per setoran. Bagi menjadi beberapa setoran.`);
      return;
    }
    const total = selected.reduce((sum, i) => sum + (i.amount || 0), 0);

    Alert.alert(
      'Bayar Setoran via Midtrans',
      `Anda akan menyetor ${selected.length} tagihan senilai ${formatIDR(total)} dalam satu pembayaran.\n\n` +
        'Tagihan baru lunas setelah pembayaran Anda diterima Midtrans. Selama menunggu (maks. 6 jam), tagihan ini terkunci dan tidak bisa dibayar pelanggan.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Lanjut Bayar',
          onPress: async () => {
            setIsSubmittingDeposit(true);
            try {
              const res = await apiFetch('/reseller-deposits', {
                method: 'POST',
                body: JSON.stringify({ invoiceIds: selected.map((i) => i.id) }),
              });
              setShowBatchModal(false);
              const open = () => openDepositPayment(res.redirectUrl, res.deposit.id);
              if (res.excluded?.length) {
                // Total yang dibayar sudah dihitung ulang tanpa tagihan ini — reseller perlu
                // tahu sebelum membayar, supaya angka di Midtrans tidak membingungkan.
                afterModalCloses(() =>
                  Alert.alert(
                    'Sebagian Tagihan Dilewati',
                    `${res.excluded.length} tagihan tidak ikut disetor:\n• ${res.excluded
                      .slice(0, 5)
                      .map((e: any) => `${e.invoiceNo ?? 'Tagihan'}: ${e.reason}`)
                      .join('\n• ')}\n\nTotal yang dibayar: ${formatIDR(res.deposit.totalAmount)}.`,
                    [{ text: 'Lanjut Bayar', onPress: () => openDepositPayment(res.redirectUrl, res.deposit.id) }],
                  ),
                );
              } else {
                open();
              }
              loadData();
            } catch (e: any) {
              Alert.alert('Gagal Membuat Setoran', e.message || 'Terjadi kesalahan server.');
            } finally {
              setIsSubmittingDeposit(false);
            }
          },
        },
      ],
    );
  };

  const loadData = async () => {
    try {
      if (!isStaff) {
        // Portal Pelanggan
        const subsRes = await apiFetch('/auth/me/subscriptions');
        const subs: SubscriptionDTO[] = Array.isArray(subsRes) ? subsRes : subsRes?.data || [];
        setSubscription(subs[0] || null);

        const invoicesRes = await apiFetch('/auth/me/invoices');
        const invoices: InvoiceDTO[] = Array.isArray(invoicesRes) ? invoicesRes : invoicesRes?.data || [];
        setUnpaidInvoice(invoices.find((i) => i.status === 'unpaid' || i.status === 'overdue') || null);
      } else {
        // Staff & Reseller Dashboard Summary
        // Teknisi reseller tidak punya izin ringkasan (berisi pendapatan). Jangan dipanggil:
        // error 403 di sini akan membatalkan pemuatan data lain di bawahnya.
        if (can(isReseller ? 'reseller_dashboard.view' : 'dashboard.view')) {
          const path = isReseller ? '/reports/reseller-dashboard-summary' : '/reports/dashboard-summary';
          const data = await apiFetch(path);
          setSummary(data);
        }

        // Fetch Live Routers (Infrastruktur) jika diizinkan RBAC
        if (can('routers.view')) {
          try {
            const routersRes = await apiFetch('/routers');
            const routerList = Array.isArray(routersRes) ? routersRes : routersRes?.data || [];
            setInfraList(
              routerList.map((r: any) => ({
                id: String(r.id),
                name: r.name,
                type: `MikroTik NAS (${r.nasIp || 'Local'})`,
                status: r.isActive ? 'online' : 'offline',
              }))
            );
          } catch (e) {
            // Diamkan jika tidak memiliki akses
          }
        }

        // Fetch Live Activity Payments jika diizinkan RBAC
        if (can('billing.view')) {
          try {
            const paymentsRes = await apiFetch('/payments');
            const paymentsList = Array.isArray(paymentsRes) ? paymentsRes : paymentsRes?.data || [];
            setActivities(
              paymentsList.map((p: any) => {
                const name = p.customerName || p.receivedBy || 'Staff NetBill';
                const initials = name
                  .split(' ')
                  .map((n: string) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase();
                return {
                  id: String(p.id),
                  initials: initials || 'NB',
                  staffName: name,
                  actionText: 'menerima pembayaran sebesar',
                  targetRef: formatIDR(p.amount || 0),
                  timeAgo: p.createdAt ? new Date(p.createdAt).toLocaleDateString('id-ID') : 'Baru saja',
                  badgeBg: '#d5e3ff',
                };
              })
            );
          } catch (e) {
            // Diamkan jika tidak memiliki akses
          }
        }

        // Jika Reseller: Fetch Pelanggan Saya & Paket Tersedia jika diizinkan RBAC
        if (isReseller) {
          if (can('customers.view')) {
            try {
              const custRes = await apiFetch('/customers?page=1&pageSize=5');
              setResellerCustomers(Array.isArray(custRes) ? custRes : custRes?.data || []);
            } catch (e) {
              // Diamkan jika tidak memiliki akses
            }
          }

          if (can('packages.view')) {
            try {
              const pkgRes = await apiFetch('/packages');
              const pkgList: PackageItem[] = Array.isArray(pkgRes) ? pkgRes : pkgRes?.data || [];
              setAvailablePackages(pkgList.filter((p) => p.isActive));
            } catch (e) {
              // Diamkan jika tidak memiliki akses
            }
          }
        }
      }
    } catch (e) {
      console.error('Error loading dashboard data:', e);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    // Tunggu sampai auth bootstrap selesai (token & user dimuat dari storage)
    // DAN permissions sudah dimuat dari /permissions/me
    // sebelum mulai fetch data dashboard, agar can() mengembalikan nilai yang benar.
    if (isBootstrapping) return;
    if (user && permissions === null) return; // permissions masih loading
    setIsLoading(true);
    loadData();
  }, [isBootstrapping, user, permissions]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  return (
    <SafeAreaView style={sharedStyles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#faf9ff" />
      <AppHeader
        subtitle={isReseller ? 'Reseller Partner' : isStaff ? 'FiberAccess Staff' : 'Portal Pelanggan'}
        onOpenSettings={() => setShowSettingsModal(true)}
      />

      {isLoading ? (
        <View style={sharedStyles.loadingContainer}>
          <ActivityIndicator size="large" color="#003d9b" />
          <Text style={sharedStyles.loadingText}>Memuat dasbor...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.container}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#003d9b']} />}
          showsVerticalScrollIndicator={false}
        >
          {/* ======================================================== */}
          {/* VIEW 1: SUPER ADMIN / OPERATOR / STAFF BENTO DASHBOARD */}
          {/* ======================================================== */}
          {isStaff && !isReseller && (
            <>
              {/* Bento Grid Stats */}
              <View style={styles.bentoGrid}>
                {/* Total Pemasukan Card (Hero Bento) */}
                <View style={styles.heroCard}>
                  <View style={styles.heroCardHeader}>
                    <Text style={styles.heroCardLabel}>TOTAL PEMASUKAN BULAN INI</Text>
                    <View style={styles.heroIconBadge}>
                      <MaterialIcons name="account-balance-wallet" size={20} color="#003d9b" />
                    </View>
                  </View>
                  <Text style={styles.heroCardValue}>{formatIDR(summary?.revenueThisMonth ?? 0)}</Text>
                  <View style={styles.trendRow}>
                    <MaterialIcons name="trending-up" size={16} color="#005eb2" />
                    <Text style={styles.trendText}>Data Realtime dari Database</Text>
                  </View>
                </View>

                {/* 2-Column Row */}
                <View style={styles.statsRow}>
                  {/* Total Pelanggan Card */}
                  <View style={[styles.statBox, { marginRight: 6 }]}>
                    <View style={styles.statBoxHeader}>
                      <Text style={styles.statBoxLabel}>Total Pelanggan</Text>
                      <MaterialIcons name="groups" size={20} color="#003d9b" />
                    </View>
                    <Text style={styles.statBoxValue}>{summary?.customerCounts.total ?? 0}</Text>
                  </View>

                  {/* Angka ini adalah jumlah pelanggan berstatus `active` di DB NetBill,
                      BUKAN sesi PPPoE hidup dari RADIUS. Dulu dilabeli "Online Saat Ini"
                      dengan ikon WiFi, sehingga selalu lebih tinggi dari kenyataan dan
                      bertentangan dengan tab Monitoring di aplikasi yang sama. */}
                  <View style={[styles.statBox, { marginLeft: 6 }]}>
                    <View style={styles.statBoxHeader}>
                      <Text style={styles.statBoxLabel}>Pelanggan Aktif</Text>
                      <MaterialIcons name="verified-user" size={20} color="#10b981" />
                    </View>
                    <Text style={styles.statBoxValue}>{summary?.customerCounts.active ?? 0}</Text>
                    {(summary?.customerCounts.total ?? 0) > 0 && (
                      <View style={styles.progressBarBg}>
                        <View
                          style={[
                            styles.progressBarFill,
                            {
                              width: `${Math.round(
                                ((summary?.customerCounts.active ?? 0) / (summary?.customerCounts.total ?? 1)) * 100
                              )}%`,
                            },
                          ]}
                        />
                      </View>
                    )}
                  </View>
                </View>

                {/* Ticket Open / Overdue Alert Bento Card */}
                <View style={styles.alertCard}>
                  <View style={styles.alertLeft}>
                    <View style={styles.alertIconBadge}>
                      <MaterialIcons name="confirmation-number" size={22} color="#f59e0b" />
                    </View>
                    <View>
                      <Text style={styles.alertLabel}>Tunggakan / Overdue Invoices</Text>
                      <Text style={styles.alertValue}>
                        {(summary?.billingSummary.overdueCount ?? 0) > 0
                          ? `${summary?.billingSummary.overdueCount} Tagihan (${formatIDR(summary?.billingSummary.overdueAmount ?? 0)})`
                          : 'Tidak ada tunggakan'}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.alertActionBtn} onPress={() => router.push('/pelanggan')}>
                    <Text style={styles.alertActionText}>Kelola</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Status Infrastruktur Section */}
              <View style={styles.sectionContainer}>
                {/* "Terdaftar/Nonaktif", bukan "Aktif/Nonaktif": nilainya berasal dari
                    flag konfigurasi router.isActive di DB NetBill, bukan pengecekan
                    liveness. Router yang mati total pun tetap tampil hijau selama
                    flag-nya menyala, dan judul lama menjanjikan status infrastruktur. */}
                <Text style={styles.sectionTitle}>Router Terdaftar</Text>
                {infraList.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyCardText}>Belum ada router terdaftar di database.</Text>
                  </View>
                ) : (
                  <View style={styles.cardContainer}>
                    {infraList.map((item, idx) => (
                      <View
                        key={item.id}
                        style={[styles.listItem, idx < infraList.length - 1 && styles.listItemBorder]}
                      >
                        <View style={styles.listItemLeft}>
                          <View style={styles.listItemIconBg}>
                            <MaterialIcons name="router" size={20} color="#434654" />
                          </View>
                          <View>
                            <Text style={styles.listItemTitle}>{item.name}</Text>
                            <Text style={styles.listItemSub}>{item.type}</Text>
                          </View>
                        </View>

                        {item.status === 'online' ? (
                          <View style={styles.onlineBadge}>
                            <View style={styles.onlineDot} />
                            <Text style={styles.onlineText}>Terdaftar</Text>
                          </View>
                        ) : (
                          <View style={styles.offlineBadge}>
                            <View style={styles.offlineDot} />
                            <Text style={styles.offlineText}>Nonaktif</Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* Aktivitas Pembayaran Terkini Section */}
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>Aktivitas Transaksi Terkini</Text>
                {activities.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyCardText}>Belum ada transaksi tercatat di database.</Text>
                  </View>
                ) : (
                  <View style={styles.activityList}>
                    {activities.map((act) => (
                      <View key={act.id} style={styles.activityCard}>
                        <View style={[styles.staffAvatar, { backgroundColor: act.badgeBg }]}>
                          <Text style={styles.staffAvatarText}>{act.initials}</Text>
                        </View>
                        <View style={styles.activityContent}>
                          <Text style={styles.activityText}>
                            <Text style={styles.staffNameText}>{act.staffName} </Text>
                            {act.actionText}{' '}
                            <Text style={styles.refText}>{act.targetRef}</Text>
                          </Text>
                          <Text style={styles.timeAgoText}>{act.timeAgo}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </>
          )}

          {/* ======================================================== */}
          {/* VIEW 2: RESELLER PARTNER DASHBOARD                       */}
          {/* ======================================================== */}
          {isStaff && isReseller && (
            <>
              {summary?.categoryName && (
                <View style={styles.resellerCategoryBanner}>
                  <MaterialIcons name="handshake" size={20} color="#003d9b" />
                  <Text style={styles.resellerCategoryText}>Kategori: {summary.categoryName}</Text>
                </View>
              )}

              {/* Stats Row */}
              {can('reseller_dashboard.view') && (
              <View style={styles.statsRow}>
                <View style={[styles.statBox, { marginRight: 6 }]}>
                  <View style={styles.statBoxHeader}>
                    <Text style={styles.statBoxLabel}>Pelanggan Saya</Text>
                    <View style={styles.circleIconBg}>
                      <MaterialIcons name="groups" size={20} color="#003d9b" />
                    </View>
                  </View>
                  <Text style={styles.statBoxValue}>{summary?.customerCounts.total ?? 0}</Text>
                </View>

                <View style={[styles.statBox, { marginLeft: 6 }]}>
                  <View style={styles.statBoxHeader}>
                    <Text style={styles.statBoxLabel}>Pendapatan Reseller</Text>
                    <View style={styles.circleIconBg}>
                      <MaterialIcons name="payments" size={20} color="#003d9b" />
                    </View>
                  </View>
                  <Text style={styles.statBoxValue}>{formatIDR(summary?.revenueThisMonth ?? 0)}</Text>
                </View>
              </View>
              )}

              {/* Tombol Aksi Cepat Pelunasan Massal */}
              {canDeposit && (
              <TouchableOpacity style={styles.batchBannerBtn} onPress={openBatchModal}>
                <View style={styles.batchBannerLeft}>
                  <View style={styles.batchBannerIconBg}>
                    <MaterialIcons name="fact-check" size={24} color="#003d9b" />
                  </View>
                  <View>
                    <Text style={styles.batchBannerTitle}>Pelunasan Massal</Text>
                    <Text style={styles.batchBannerSub}>
                      Setor banyak tagihan sekaligus
                    </Text>
                  </View>
                </View>
                <MaterialIcons name="chevron-right" size={24} color="#003d9b" />
              </TouchableOpacity>
              )}

              {canDeposit && (
                <TouchableOpacity style={styles.batchBannerBtn} onPress={() => setShowDepositHistory(true)}>
                  <View style={styles.batchBannerLeft}>
                    <View style={styles.batchBannerIconBg}>
                      <MaterialIcons name="account-balance-wallet" size={24} color="#003d9b" />
                    </View>
                    <View>
                      <Text style={styles.batchBannerTitle}>Riwayat Setoran</Text>
                      <Text style={styles.batchBannerSub}>Status setoran via Midtrans</Text>
                    </View>
                  </View>
                  <MaterialIcons name="chevron-right" size={24} color="#003d9b" />
                </TouchableOpacity>
              )}

              {/* Daftar Pelanggan Reseller */}
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>Daftar Pelanggan Saya</Text>
                  <TouchableOpacity onPress={() => router.push('/pelanggan')}>
                    <Text style={styles.seeAllText}>Lihat Semua</Text>
                  </TouchableOpacity>
                </View>

                {resellerCustomers.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyCardText}>Belum ada pelanggan terdaftar.</Text>
                  </View>
                ) : (
                  <View style={styles.cardContainer}>
                    {resellerCustomers.map((cust, idx) => {
                      const initials = cust.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase();
                      const isAktif = cust.status === 'active';
                      return (
                        <TouchableOpacity
                          key={cust.id}
                          style={[styles.listItem, idx < resellerCustomers.length - 1 && styles.listItemBorder]}
                          onPress={() => openCustomerDetail(cust)}
                        >
                          <View style={styles.listItemLeft}>
                            <View style={[styles.avatarSmall, { backgroundColor: isAktif ? '#d8e2ff' : '#ffdad6' }]}>
                              <Text style={[styles.avatarSmallText, { color: isAktif ? '#003d9b' : '#93000a' }]}>
                                {initials}
                              </Text>
                            </View>
                            <View>
                              <Text style={styles.customerName}>{cust.name}</Text>
                              <Text style={styles.customerDetail}>No: {cust.customerNo}</Text>
                            </View>
                          </View>
                          <View style={styles.customerRight}>
                            <View style={isAktif ? styles.badgeAktif : styles.badgeIsolir}>
                              <Text style={isAktif ? styles.badgeAktifText : styles.badgeIsolirText}>
                                {cust.status.toUpperCase()}
                              </Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* Paket Tersedia */}
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>Paket Layanan Tersedia</Text>
                  {availablePackages.length > 3 && (
                    <TouchableOpacity onPress={() => setShowPackagesModal(true)}>
                      <Text style={styles.seeAllText}>Lihat Semua ({availablePackages.length})</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {availablePackages.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyCardText}>Belum ada paket aktif di database.</Text>
                  </View>
                ) : (
                  <>
                    {availablePackages.slice(0, 3).map((pkg) => (
                      <View key={pkg.id} style={styles.packageCard}>
                        <View style={styles.packageHeader}>
                          <Text style={styles.packageName}>{pkg.name}</Text>
                          <MaterialIcons name="wifi" size={20} color="#003d9b" />
                        </View>
                        <Text style={styles.packagePrice}>
                          Harga Resmi Paket: <Text style={{ fontWeight: '700', color: '#003d9b' }}>{formatIDR(pkg.price)}</Text>
                        </Text>
                        <TouchableOpacity
                          style={styles.packageBtn}
                          onPress={() =>
                            router.push({
                              pathname: '/pelanggan',
                              params: { packageId: pkg.id, action: 'create' },
                            })
                          }
                        >
                          <Text style={styles.packageBtnText}>Daftarkan Pelanggan</Text>
                        </TouchableOpacity>
                      </View>
                    ))}

                    {availablePackages.length > 3 && (
                      <TouchableOpacity
                        style={styles.seeAllPackagesBtn}
                        onPress={() => setShowPackagesModal(true)}
                      >
                        <Text style={styles.seeAllPackagesBtnText}>
                          Lihat Seluruh {availablePackages.length} Paket Layanan →
                        </Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
            </>
          )}

          {/* ======================================================== */}
          {/* VIEW 3: CUSTOMER PORTAL DASHBOARD                        */}
          {/* ======================================================== */}
          {!isStaff && (
            <>
              <Text style={styles.greetingTitle}>Halo, {user?.name}</Text>
              <Text style={styles.greetingSub}>
                {subscription?.status === 'active'
                  ? 'Koneksi internet Anda berjalan optimal hari ini.'
                  : 'Koneksi internet Anda saat ini terisolir / pending.'}
              </Text>

              {/* Hero Customer Billing Card */}
              <View style={[styles.heroCard, unpaidInvoice ? styles.heroCardUnpaid : styles.heroCardPaid]}>
                {unpaidInvoice ? (
                  <>
                    <View style={styles.heroCardHeader}>
                      <Text style={styles.heroCardLabelLight}>TAGIHAN BELUM LUNAS ({unpaidInvoice.periodMonth})</Text>
                      <MaterialIcons name="receipt-long" size={22} color="#ffffff" />
                    </View>
                    <Text style={styles.heroCardValueLight}>{formatIDR(unpaidInvoice.amount)}</Text>
                    <Text style={styles.heroCardHintLight}>Batas jatuh tempo: {unpaidInvoice.dueDate.slice(0, 10)}</Text>
                    <TouchableOpacity style={styles.heroActionBtn} onPress={() => router.push('/tagihan')}>
                      <Text style={styles.heroActionBtnText}>Bayar Tagihan Sekarang</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <View style={styles.heroCardHeader}>
                      <Text style={styles.heroCardLabelLight}>STATUS TAGIHAN</Text>
                      <MaterialIcons name="check-circle" size={24} color="#ffffff" />
                    </View>
                    <Text style={styles.heroCardValueLight}>Semua Lunas</Text>
                    <Text style={styles.heroCardHintLight}>Tidak ada tagihan yang belum dibayar. Terima kasih!</Text>
                  </>
                )}
              </View>

              {/* Paket Aktif & Status Koneksi Card */}
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>Status Koneksi Broadband</Text>
                <View style={styles.cardContainer}>
                  <View style={styles.listItem}>
                    <View style={styles.listItemLeft}>
                      <View style={styles.listItemIconBg}>
                        <MaterialIcons name="wifi" size={22} color="#003d9b" />
                      </View>
                      <View>
                        <Text style={styles.customerName}>{subscription ? subscription.packageName : 'Tanpa Paket'}</Text>
                        <Text style={styles.customerDetail}>Layanan Internet Unlimited</Text>
                      </View>
                    </View>

                    {subscription?.status === 'active' ? (
                      <View style={styles.onlineBadge}>
                        <View style={styles.onlineDot} />
                        <Text style={styles.onlineText}>Aktif</Text>
                      </View>
                    ) : (
                      <View style={styles.offlineBadge}>
                        <View style={styles.offlineDot} />
                        <Text style={styles.offlineText}>{subscription?.status || 'Pending'}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            </>
          )}
        </ScrollView>
      )}

      <BackendUrlModal visible={showSettingsModal} onClose={() => setShowSettingsModal(false)} />

      {/* Modal Lihat Seluruh Paket Layanan */}
      <Modal visible={showPackagesModal} transparent animationType="slide" onRequestClose={() => setShowPackagesModal(false)}>
        <View style={sharedStyles.modalBg}>
          <View style={[sharedStyles.settingsModalCard, { maxHeight: '85%' }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={sharedStyles.modalTitle}>📶 Seluruh Paket Layanan</Text>
              <TouchableOpacity onPress={() => setShowPackagesModal(false)}>
                <MaterialIcons name="close" size={24} color="#434654" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={sharedStyles.modalInput}
              placeholder="Cari nama paket..."
              value={pkgQuery}
              onChangeText={setPkgQuery}
            />

            <ScrollView showsVerticalScrollIndicator={false}>
              {availablePackages
                .filter((p) => p.name.toLowerCase().includes(pkgQuery.toLowerCase()))
                .map((pkg) => (
                  <View key={pkg.id} style={styles.packageCardModal}>
                    <View style={styles.packageHeader}>
                      <Text style={styles.packageName}>{pkg.name}</Text>
                      <MaterialIcons name="wifi" size={20} color="#003d9b" />
                    </View>
                    <Text style={styles.packagePrice}>
                      Harga Resmi Paket: <Text style={{ fontWeight: '700', color: '#003d9b' }}>{formatIDR(pkg.price)}</Text>
                    </Text>
                    <TouchableOpacity
                      style={styles.packageBtn}
                      onPress={() => {
                        setShowPackagesModal(false);
                        router.push({
                          pathname: '/pelanggan',
                          params: { packageId: pkg.id, action: 'create' },
                        });
                      }}
                    >
                      <Text style={styles.packageBtnText}>Daftarkan Pelanggan</Text>
                    </TouchableOpacity>
                  </View>
                ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal Detail Pelanggan Reseller */}
      <Modal visible={!!selectedCustDetail} transparent animationType="slide" onRequestClose={() => setSelectedCustDetail(null)}>
        <View style={sharedStyles.modalBg}>
          <View style={[sharedStyles.settingsModalCard, { maxHeight: '85%' }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={sharedStyles.modalTitle}>👤 Detail Pelanggan</Text>
              <TouchableOpacity onPress={() => setSelectedCustDetail(null)}>
                <MaterialIcons name="close" size={24} color="#434654" />
              </TouchableOpacity>
            </View>

            {selectedCustDetail && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.detailCard}>
                  <View style={styles.detailHeaderRow}>
                    <View style={styles.avatarLarge}>
                      <Text style={styles.avatarLargeText}>
                        {selectedCustDetail.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailName}>{selectedCustDetail.name}</Text>
                      <Text style={styles.detailSub}>No. Pelanggan: {selectedCustDetail.customerNo}</Text>
                      <View style={{ marginTop: 4, flexDirection: 'row' }}>
                        <View style={selectedCustDetail.status === 'active' ? styles.badgeAktif : styles.badgeIsolir}>
                          <Text style={selectedCustDetail.status === 'active' ? styles.badgeAktifText : styles.badgeIsolirText}>
                            {selectedCustDetail.status.toUpperCase()}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  <View style={styles.divider} />

                  <Text style={styles.detailSectionTitle}>Informasi Layanan Broadband</Text>
                  {isLoadingCustDetail ? (
                    <ActivityIndicator size="small" color="#003d9b" style={{ marginVertical: 10 }} />
                  ) : selectedCustSub ? (
                    <View style={styles.infoBox}>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Paket Layanan:</Text>
                        <Text style={styles.infoValue}>{selectedCustSub.packageName || '-'}</Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Status Langganan:</Text>
                        <Text style={styles.infoValue}>{selectedCustSub.status.toUpperCase()}</Text>
                      </View>
                    </View>
                  ) : (
                    <Text style={styles.noSubText}>Belum ada data paket langganan aktif.</Text>
                  )}

                  <TouchableOpacity
                    style={styles.detailActionBtn}
                    onPress={() => {
                      setSelectedCustDetail(null);
                      router.push('/pelanggan');
                    }}
                  >
                    <MaterialIcons name="edit" size={16} color="#003d9b" />
                    <Text style={styles.detailActionBtnText}>Buka Halaman Kelola Pelanggan</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal Pelunasan Massal (Batch Cash Collection) */}
      <Modal visible={showBatchModal} transparent animationType="slide" onRequestClose={() => setShowBatchModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{
            backgroundColor: '#fff',
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingTop: 20,
            paddingHorizontal: 20,
            maxHeight: '92%',
            flex: 0,
            flexShrink: 1,
          }}>
            {/* Header */}
            <View style={styles.modalHeaderRow}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={sharedStyles.modalTitle}>⚡ Pelunasan Massal</Text>
                <Text style={{ fontSize: 11, color: '#434654', marginTop: 2 }}>
                  Centang tagihan yang ingin Anda setor, lalu bayar sekaligus via Midtrans.
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowBatchModal(false)}>
                <MaterialIcons name="close" size={24} color="#434654" />
              </TouchableOpacity>
            </View>

            {/* Search + Pilih Semua */}
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginVertical: 10 }}>
              <TextInput
                style={[sharedStyles.modalInput, { flex: 1, marginBottom: 0 }]}
                placeholder="Cari pelanggan..."
                value={batchSearchQuery}
                onChangeText={setBatchSearchQuery}
              />
              <TouchableOpacity style={styles.selectAllBtn} onPress={toggleSelectAllInvoices}>
                <Text style={styles.selectAllBtnText}>
                  {selectedInvoiceIds.length > 0 && selectedInvoiceIds.length === unpaidInvoicesList.filter((i) => !isLocked(i)).length
                    ? 'Batal Pilih'
                    : 'Pilih Semua'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Daftar Tagihan */}
            {isLoadingBatchInvoices ? (
              <ActivityIndicator size="large" color="#003d9b" style={{ marginVertical: 40 }} />
            ) : unpaidInvoicesList.filter((i) =>
                i.customerName?.toLowerCase().includes(batchSearchQuery.toLowerCase())
              ).length === 0 ? (
              <View style={[styles.emptyCard, { marginVertical: 20 }]}>
                <MaterialIcons name="inbox" size={36} color="#b0b8d1" />
                <Text style={styles.emptyCardText}>Tidak ada tagihan belum dilunasi.</Text>
              </View>
            ) : (
              <ScrollView
                showsVerticalScrollIndicator={true}
                style={{ maxHeight: 420 }}
                contentContainerStyle={{ paddingBottom: 8 }}
              >
                {unpaidInvoicesList
                  .filter((i) => i.customerName?.toLowerCase().includes(batchSearchQuery.toLowerCase()))
                  .map((item) => {
                    const isSelected = selectedInvoiceIds.includes(item.id);
                    const locked = isLocked(item);
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[styles.batchItemCard, isSelected && styles.batchItemCardSelected, locked && { opacity: 0.55 }]}
                        disabled={locked}
                        onPress={() => toggleSelectInvoice(item.id)}
                      >
                        <MaterialIcons
                          name={locked ? 'lock' : isSelected ? 'check-box' : 'check-box-outline-blank'}
                          size={24}
                          color={isSelected ? '#003d9b' : '#737685'}
                          style={{ marginTop: 2 }}
                        />
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={styles.batchCustomerName}>
                            {item.customerName} {item.customerPhone ? `(${item.customerPhone})` : ''}
                          </Text>
                          <Text style={styles.batchInvoiceSub}>
                            {item.invoiceNo} • Periode: {item.periodMonth}
                          </Text>
                          <View style={{ flexDirection: 'row', gap: 10, marginTop: 3 }}>
                            <Text style={styles.batchDateText}>
                              📅 Terbit: {item.issuedAt ? item.issuedAt.slice(0, 10) : '-'}
                            </Text>
                            <Text style={[styles.batchDateText, { color: item.status === 'overdue' ? '#ba1a1a' : '#434654' }]}>
                              ⏰ Tempo: {item.dueDate ? item.dueDate.slice(0, 10) : '-'}
                            </Text>
                          </View>
                        </View>
                        <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                          <Text style={styles.batchAmountText}>{formatIDR(item.amount)}</Text>
                          <View style={locked ? styles.badgePending : item.status === 'overdue' ? styles.badgeIsolir : styles.badgePending}>
                            <Text style={locked ? styles.badgePendingText : item.status === 'overdue' ? styles.badgeIsolirText : styles.badgePendingText}>
                              {locked ? 'DALAM SETORAN' : item.status === 'overdue' ? 'TUNGGAKAN' : 'BELUM BAYAR'}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
              </ScrollView>
            )}

            {/* Sticky Bottom Bar */}
            <View style={[styles.batchFooterBar, { flexDirection: 'column', alignItems: 'stretch', gap: 10 }]}>
              <View>
                <Text style={styles.batchFooterCount}>{selectedInvoiceIds.length} Tagihan Terpilih</Text>
                <Text style={styles.batchFooterTotal}>
                  Total: {formatIDR(
                    unpaidInvoicesList
                      .filter((i) => selectedInvoiceIds.includes(i.id))
                      .reduce((sum, i) => sum + (i.amount || 0), 0)
                  )}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.batchSubmitBtn, { alignItems: 'center' }, isSubmittingDeposit && { opacity: 0.6 }]}
                disabled={isSubmittingDeposit}
                onPress={submitDeposit}
              >
                {isSubmittingDeposit ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.batchSubmitBtnText}>Bayar via Midtrans</Text>
                )}
              </TouchableOpacity>
              {isSubmittingDeposit && (
                <Text style={{ fontSize: 11, color: '#434654', textAlign: 'center' }}>
                  Menyiapkan setoran… untuk banyak tagihan bisa memakan waktu hingga 1–2 menit.
                </Text>
              )}
            </View>
          </View>
        </View>
      </Modal>

      <DepositHistoryModal
        visible={showDepositHistory}
        apiFetch={apiFetch}
        onClose={() => setShowDepositHistory(false)}
        onPay={(url, depositId) => {
          setShowDepositHistory(false);
          openDepositPayment(url, depositId);
        }}
        onChanged={() => loadData()}
      />
      <DepositPaymentModal url={depositPayUrl} depositId={activeDepositId} onDone={onDepositPaymentDone} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },

  greetingTitle: {
    fontFamily: 'Hanken Grotesk',
    fontSize: 22,
    fontWeight: '700',
    color: '#051a3e',
  },
  greetingSub: {
    fontSize: 13,
    color: '#434654',
    marginTop: 2,
    marginBottom: 16,
  },

  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9edff',
  },
  emptyCardText: {
    fontSize: 12,
    color: '#737685',
  },

  // Bento Grid Layout
  bentoGrid: {
    marginBottom: 24,
  },
  heroCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#091e42',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e9edff',
  },
  heroCardUnpaid: {
    backgroundColor: '#003d9b',
    borderColor: '#003d9b',
  },
  heroCardPaid: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  heroCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  heroCardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#434654',
    letterSpacing: 0.5,
  },
  heroCardLabelLight: {
    fontSize: 11,
    fontWeight: '700',
    color: '#c4d2ff',
    letterSpacing: 0.5,
  },
  heroIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#e9edff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCardValue: {
    fontFamily: 'Hanken Grotesk',
    fontSize: 34,
    fontWeight: '700',
    color: '#051a3e',
    lineHeight: 40,
  },
  heroCardValueLight: {
    fontFamily: 'Hanken Grotesk',
    fontSize: 32,
    fontWeight: '700',
    color: '#ffffff',
    marginVertical: 4,
  },
  heroCardHintLight: {
    fontSize: 12,
    color: '#d5e3ff',
    marginTop: 2,
  },
  heroActionBtn: {
    marginTop: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  heroActionBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#005eb2',
    marginLeft: 4,
  },

  // 2-Column Stats Row
  statsRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#091e42',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e9edff',
  },
  statBoxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statBoxLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#434654',
  },
  statBoxValue: {
    fontFamily: 'Hanken Grotesk',
    fontSize: 22,
    fontWeight: '700',
    color: '#051a3e',
  },
  progressBarBg: {
    height: 4,
    backgroundColor: '#e9edff',
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 2,
  },
  circleIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#d5e3ff',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Alert Bento Card
  alertCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
    shadowColor: '#091e42',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e9edff',
  },
  alertLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  alertIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  alertLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#434654',
  },
  alertValue: {
    fontFamily: 'Hanken Grotesk',
    fontSize: 15,
    fontWeight: '700',
    color: '#051a3e',
    marginTop: 1,
  },
  alertActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#f1f3ff',
  },
  alertActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#003d9b',
  },

  // Sections
  sectionContainer: {
    marginBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: 'Hanken Grotesk',
    fontSize: 18,
    fontWeight: '700',
    color: '#051a3e',
    marginBottom: 12,
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#003d9b',
  },

  // Card Container & List Items
  cardContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    shadowColor: '#091e42',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e9edff',
    overflow: 'hidden',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  listItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#e9edff',
  },
  listItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  listItemIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f1f3ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  listItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#051a3e',
  },
  listItemSub: {
    fontSize: 11,
    color: '#434654',
    marginTop: 2,
  },

  // Badges
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
    marginRight: 6,
  },
  onlineText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10b981',
  },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(186, 26, 26, 0.12)',
  },
  offlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ba1a1a',
    marginRight: 6,
  },
  offlineText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ba1a1a',
  },

  // Staff Activity Cards
  activityList: {
    gap: 10,
  },
  activityCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#091e42',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#e9edff',
  },
  staffAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  staffAvatarText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#004788',
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    fontSize: 13,
    color: '#051a3e',
    lineHeight: 18,
  },
  staffNameText: {
    fontWeight: '700',
    color: '#003d9b',
  },
  refText: {
    fontWeight: '700',
    color: '#0052cc',
  },
  timeAgoText: {
    fontSize: 10,
    color: '#737685',
    marginTop: 4,
  },

  // Reseller Styles
  resellerCategoryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d5e3ff',
    padding: 12,
    borderRadius: 16,
    marginBottom: 16,
    gap: 8,
  },
  resellerCategoryText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#003d9b',
  },
  avatarSmall: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarSmallText: {
    fontSize: 12,
    fontWeight: '700',
  },
  customerName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#051a3e',
  },
  customerDetail: {
    fontSize: 11,
    color: '#434654',
    marginTop: 1,
  },
  customerRight: {
    alignItems: 'flex-end',
  },
  badgeAktif: {
    backgroundColor: '#d1fae5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeAktifText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#065f46',
  },
  badgeIsolir: {
    backgroundColor: '#ffdad6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeIsolirText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#93000a',
  },

  // Package Cards
  packageCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#003d9b',
    shadowColor: '#091e42',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e9edff',
  },
  packageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  packageName: {
    fontFamily: 'Hanken Grotesk',
    fontSize: 16,
    fontWeight: '700',
    color: '#051a3e',
  },
  packagePrice: {
    fontSize: 12,
    color: '#434654',
    lineHeight: 18,
    marginBottom: 14,
  },
  packageBtn: {
    backgroundColor: '#f1f3ff',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  packageBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#003d9b',
  },
  seeAllPackagesBtn: {
    backgroundColor: '#f1f3ff',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#d8e2ff',
  },
  seeAllPackagesBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#003d9b',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  packageCardModal: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#003d9b',
    borderWidth: 1,
    borderColor: '#e9edff',
  },
  detailCard: {
    paddingVertical: 4,
  },
  detailHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarLarge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#003d9b',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarLargeText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  detailName: {
    fontFamily: 'Hanken Grotesk',
    fontSize: 17,
    fontWeight: '700',
    color: '#051a3e',
  },
  detailSub: {
    fontSize: 12,
    color: '#434654',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#e9edff',
    marginVertical: 14,
  },
  detailSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#051a3e',
    marginBottom: 8,
  },
  infoBox: {
    backgroundColor: '#f8fafe',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e9edff',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  infoLabel: {
    fontSize: 12,
    color: '#434654',
  },
  infoValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#003d9b',
  },
  noSubText: {
    fontSize: 12,
    color: '#737685',
    fontStyle: 'italic',
    marginVertical: 6,
  },
  detailActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f3ff',
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 16,
    gap: 6,
  },
  detailActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#003d9b',
  },
  batchBannerBtn: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#d5e3ff',
    shadowColor: '#091e42',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  batchBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  batchBannerIconBg: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#d5e3ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  batchBannerTitle: {
    fontFamily: 'Hanken Grotesk',
    fontSize: 15,
    fontWeight: '700',
    color: '#003d9b',
  },
  batchBannerSub: {
    fontSize: 11,
    color: '#434654',
    marginTop: 2,
  },
  selectAllBtn: {
    backgroundColor: '#f1f3ff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  selectAllBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#003d9b',
  },
  batchItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e9edff',
  },
  batchItemCardSelected: {
    backgroundColor: '#f0f5ff',
    borderColor: '#003d9b',
  },
  batchCustomerName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#051a3e',
  },
  batchInvoiceSub: {
    fontSize: 10,
    color: '#737685',
    marginTop: 2,
  },
  batchDateText: {
    fontSize: 10,
    color: '#434654',
  },
  batchAmountText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#003d9b',
  },
  badgePending: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
  },
  badgePendingText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#92400e',
  },
  batchFooterBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#e9edff',
    backgroundColor: '#faf9ff',
  },
  batchFooterCount: {
    fontSize: 11,
    color: '#434654',
  },
  batchFooterTotal: {
    fontFamily: 'Hanken Grotesk',
    fontSize: 16,
    fontWeight: '700',
    color: '#003d9b',
  },
  batchSubmitBtn: {
    backgroundColor: '#003d9b',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  batchSubmitBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
});
