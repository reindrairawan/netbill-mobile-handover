import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { AppHeader } from '@/components/app-header';
import { BackendUrlModal } from '@/components/backend-url-modal';
import { PasswordInput } from '@/components/password-input';
import { sharedStyles } from '@/constants/mobile-styles';

interface CustomerDTO {
  id: string;
  customerNo: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  status: 'pending' | 'active' | 'isolir' | 'terminated';
  categoryName: string | null;
}

interface SubscriptionDTO {
  id: string;
  customerId: string;
  pppoeUsername: string;
  packageName: string;
  packageId: number;
  status: 'pending' | 'active' | 'isolir' | 'terminated';
  billingDay: number;
}

interface CategoryDTO {
  id: number;
  name: string;
}

interface PackageDTO {
  id: number;
  name: string;
  price: number;
  isActive: boolean;
}

interface RouterDTO {
  id: number;
  name: string;
  nasIp: string;
  isActive: boolean;
}

const statusColor: Record<CustomerDTO['status'], string> = {
  active: '#137333',
  isolir: '#c5221f',
  pending: '#b06000',
  terminated: '#64748b',
};

const emptyCustomerForm = { name: '', phone: '', email: '', address: '', categoryId: '' as number | '' };
const emptySubForm = { packageId: '' as number | '', pppoeUsername: '', pppoePassword: '', billingDay: '1', routerId: '' as number | '' };

/** Tab "Pelanggan" — khusus role staff: cari, lihat detail, tambah/edit pelanggan & langganan, ganti paket, ganti sandi PPPoE, isolir/terminasi & import. */
export default function PelangganScreen() {
  const { user, apiFetch, can } = useAuth();
  const isReseller = user?.role === 'reseller';
  const isSuperadmin = user?.role === 'superadmin';
  const canManageCustomers = can('customers.manage');
  const canDeleteCustomers = can('customers.delete');
  const canCreateSubscription = can('subscriptions.create');
  const canLifecycle = can('subscriptions.lifecycle');

  const params = useLocalSearchParams<{ packageId?: string; action?: string }>();
  const [preselectedPackageId, setPreselectedPackageId] = useState<number | ''>('');

  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState<CustomerDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const [selected, setSelected] = useState<CustomerDTO | null>(null);
  const [selectedSub, setSelectedSub] = useState<SubscriptionDTO | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isMutating, setIsMutating] = useState(false);

  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [packages, setPackages] = useState<PackageDTO[]>([]);
  const [routers, setRouters] = useState<RouterDTO[]>([]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCustomerForm);
  const [isSavingCreate, setIsSavingCreate] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState(emptyCustomerForm);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [showSubForm, setShowSubForm] = useState(false);
  const [subForm, setSubForm] = useState(emptySubForm);
  const [isSavingSub, setIsSavingSub] = useState(false);

  // ---- Ganti Paket & Password PPPoE ----
  const [showEditSubModal, setShowEditSubModal] = useState(false);
  const [editSubForm, setEditSubForm] = useState({ packageId: '' as number | '', pppoePassword: '', billingDay: '1' });
  const [isSavingEditSub, setIsSavingEditSub] = useState(false);

  // ---- Import Excel Info Modal ----
  const [showImportModal, setShowImportModal] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadCustomers = useCallback(
    async (q: string) => {
      setIsLoading(true);
      try {
        const res = await apiFetch(`/customers?page=1&pageSize=30&q=${encodeURIComponent(q)}`);
        setCustomers(res?.data || []);
      } catch (e: any) {
        Alert.alert('Gagal Memuat Pelanggan', e.message || 'Koneksi ke backend bermasalah.');
      } finally {
        setIsLoading(false);
      }
    },
    [apiFetch],
  );

  useEffect(() => {
    loadCustomers('');
  }, [loadCustomers]);

  useEffect(() => {
    if (params?.packageId) {
      const pkgId = Number(params.packageId);
      if (!isNaN(pkgId)) {
        setPreselectedPackageId(pkgId);
        if (params.action === 'create') {
          openCreateModal();
        }
      }
    }
  }, [params?.packageId, params?.action]);

  const handleSearchChange = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadCustomers(text), 400);
  };

  const openDetail = async (customer: CustomerDTO) => {
    setSelected(customer);
    setSelectedSub(null);
    setIsLoadingDetail(true);
    try {
      const res = await apiFetch(`/subscriptions?customerId=${customer.id}`);
      const subs: SubscriptionDTO[] = Array.isArray(res) ? res : res?.data || [];
      setSelectedSub(subs[0] || null);
    } catch (e: any) {
      Alert.alert('Gagal Memuat Langganan', e.message || 'Koneksi ke backend bermasalah.');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const closeDetail = () => {
    setSelected(null);
    setSelectedSub(null);
    setShowSubForm(false);
    setShowEditSubModal(false);
  };

  // ---- Tambah Pelanggan ----
  const openCreateModal = async () => {
    setCreateForm(emptyCustomerForm);
    setShowCreateModal(true);
    if (!isReseller && categories.length === 0) {
      try {
        const res = await apiFetch('/customer-categories');
        setCategories(Array.isArray(res) ? res : []);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleCreateCustomer = async () => {
    if (!createForm.name.trim()) {
      Alert.alert('Validasi', 'Nama pelanggan wajib diisi.');
      return;
    }
    if (!isReseller && !createForm.categoryId) {
      Alert.alert('Validasi', 'Kategori pelanggan wajib dipilih.');
      return;
    }
    setIsSavingCreate(true);
    try {
      const created: CustomerDTO = await apiFetch('/customers', {
        method: 'POST',
        body: JSON.stringify({
          name: createForm.name.trim(),
          phone: createForm.phone.trim() || undefined,
          email: createForm.email.trim() || undefined,
          address: createForm.address.trim() || undefined,
          ...(isReseller ? {} : { categoryId: createForm.categoryId }),
        }),
      });
      setShowCreateModal(false);
      loadCustomers(query);
      Alert.alert('Sukses', `Pelanggan "${created.name}" berhasil ditambahkan.`, [
        { text: 'Selesai' },
        {
          text: 'Tambah Langganan Sekarang',
          onPress: async () => {
            await openDetail(created);
            openSubForm(preselectedPackageId ? Number(preselectedPackageId) : undefined);
          },
        },
      ]);
    } catch (e: any) {
      Alert.alert('Gagal Menambah Pelanggan', e.message || 'Koneksi ke backend bermasalah.');
    } finally {
      setIsSavingCreate(false);
    }
  };

  // ---- Edit Pelanggan ----
  const openEditModal = () => {
    if (!selected) return;
    setEditForm({
      name: selected.name,
      phone: selected.phone || '',
      email: selected.email || '',
      address: selected.address || '',
      categoryId: '',
    });
    setShowEditModal(true);
  };

  const handleEditCustomer = async () => {
    if (!selected) return;
    if (!editForm.name.trim()) {
      Alert.alert('Validasi', 'Nama pelanggan wajib diisi.');
      return;
    }
    setIsSavingEdit(true);
    try {
      const updated: CustomerDTO = await apiFetch(`/customers/${selected.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editForm.name.trim(),
          phone: editForm.phone.trim() || null,
          email: editForm.email.trim() || null,
          address: editForm.address.trim() || null,
        }),
      });
      setSelected(updated);
      setShowEditModal(false);
      loadCustomers(query);
    } catch (e: any) {
      Alert.alert('Gagal Menyimpan Perubahan', e.message || 'Koneksi ke backend bermasalah.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // ---- Tambah Langganan ----
  const openSubForm = async (overridePackageId?: number) => {
    const defaultPkg = overridePackageId || preselectedPackageId || '';
    setSubForm({ ...emptySubForm, packageId: defaultPkg });
    setShowSubForm(true);
    if (packages.length === 0) {
      try {
        const res = await apiFetch('/packages');
        setPackages(Array.isArray(res) ? res.filter((p: PackageDTO) => p.isActive) : []);
      } catch (e) {
        console.error(e);
      }
    }
    if (routers.length === 0) {
      try {
        const res = await apiFetch('/routers');
        setRouters(Array.isArray(res) ? res.filter((r: RouterDTO) => r.isActive) : []);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleCreateSubscription = async () => {
    if (!selected) return;
    if (!subForm.packageId) {
      Alert.alert('Validasi', 'Pilih paket internet terlebih dahulu.');
      return;
    }
    if (subForm.pppoeUsername.trim().length < 3 || subForm.pppoePassword.length < 4) {
      Alert.alert('Validasi', 'Username PPPoE minimal 3 karakter, password minimal 4 karakter.');
      return;
    }
    setIsSavingSub(true);
    try {
      await apiFetch('/subscriptions', {
        method: 'POST',
        body: JSON.stringify({
          customerId: selected.id,
          packageId: subForm.packageId,
          pppoeUsername: subForm.pppoeUsername.trim(),
          pppoePassword: subForm.pppoePassword,
          billingDay: Number(subForm.billingDay) || 1,
          routerId: subForm.routerId || undefined,
        }),
      });
      setShowSubForm(false);
      await openDetail(selected);
      loadCustomers(query);
    } catch (e: any) {
      Alert.alert('Gagal Menambah Langganan', e.message || 'Koneksi ke backend bermasalah.');
    } finally {
      setIsSavingSub(false);
    }
  };

  // ---- Ganti Paket & Password PPPoE ----
  const openEditSubModal = async () => {
    if (!selectedSub) return;
    setEditSubForm({
      packageId: selectedSub.packageId,
      pppoePassword: '',
      billingDay: String(selectedSub.billingDay || 1),
    });
    setShowEditSubModal(true);
    if (packages.length === 0) {
      try {
        const res = await apiFetch('/packages');
        setPackages(Array.isArray(res) ? res.filter((p: PackageDTO) => p.isActive) : []);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleEditSubscription = async () => {
    if (!selectedSub) return;
    setIsSavingEditSub(true);
    try {
      await apiFetch(`/subscriptions/${selectedSub.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          // Kirim packageId HANYA kalau paketnya benar-benar berubah. Form ini selalu
          // ter-prefill dengan paket saat ini, jadi mengirimnya tanpa syarat membuat
          // backend menjalankan changePackage → pindah grup RADIUS + putus sesi, walau
          // teknisi cuma mengubah billingDay atau password PPPoE. Untuk password ini
          // berbahaya: changePassword sengaja TIDAK memutus sesi (CPE masih pakai sandi
          // lama), dan pemutusan itu membatalkan proteksinya.
          ...(editSubForm.packageId && Number(editSubForm.packageId) !== Number(selectedSub.packageId)
            ? { packageId: editSubSubFormPackageId(editSubForm.packageId) }
            : {}),
          ...(editSubForm.pppoePassword ? { pppoePassword: editSubForm.pppoePassword } : {}),
          billingDay: Number(editSubForm.billingDay) || 1,
        }),
      });
      setShowEditSubModal(false);
      Alert.alert('Sukses', 'Langganan (Paket / Password PPPoE) berhasil diperbarui.');
      if (selected) await openDetail(selected);
    } catch (e: any) {
      Alert.alert('Gagal Mengubah Langganan', e.message || 'Koneksi ke backend bermasalah.');
    } finally {
      setIsSavingEditSub(false);
    }
  };

  function editSubSubFormPackageId(pkgId: number | '') {
    return typeof pkgId === 'number' ? pkgId : undefined;
  }

  // ---- Isolir / Unisolir ----
  const handleIsolir = () => {
    if (!selectedSub) return;
    Alert.alert('Konfirmasi Isolir', 'Apakah Anda yakin ingin mengisolir koneksi pelanggan ini?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Ya, Isolir',
        style: 'destructive',
        onPress: async () => {
          setIsMutating(true);
          try {
            await apiFetch(`/subscriptions/${selectedSub.id}/isolir`, { method: 'POST' });
            setSelectedSub({ ...selectedSub, status: 'isolir' });
            loadCustomers(query);
          } catch (e: any) {
            Alert.alert('Gagal Isolir', e.message || 'Gagal mengubah status koneksi.');
          } finally {
            setIsMutating(false);
          }
        },
      },
    ]);
  };

  const handleActivateOrUnisolir = () => {
    if (!selectedSub) return;
    const endpoint = selectedSub.status === 'pending' ? 'activate' : 'unisolir';
    Alert.alert('Konfirmasi Aktivasi', 'Apakah Anda yakin ingin mengaktifkan / membuka isolir koneksi pelanggan ini?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Ya, Aktifkan',
        onPress: async () => {
          setIsMutating(true);
          try {
            await apiFetch(`/subscriptions/${selectedSub.id}/${endpoint}`, { method: 'POST' });
            setSelectedSub({ ...selectedSub, status: 'active' });
            loadCustomers(query);
          } catch (e: any) {
            Alert.alert('Gagal Mengaktifkan', e.message || 'Gagal mengubah status koneksi.');
          } finally {
            setIsMutating(false);
          }
        },
      },
    ]);
  };

  // ---- Hapus Pelanggan ----
  const handleDeleteCustomer = () => {
    if (!selected) return;
    Alert.alert(
      'Hapus Pelanggan Permanen',
      `Apakah Anda yakin ingin MENGHAPUS PERMANEN data pelanggan "${selected.name}" (${selected.customerNo})?\n\nData yang dihapus tidak dapat dikembalikan.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus Permanen',
          style: 'destructive',
          onPress: async () => {
            setIsMutating(true);
            try {
              await apiFetch(`/customers/${selected.id}`, { method: 'DELETE' });
              Alert.alert('Sukses', `Pelanggan "${selected.name}" berhasil dihapus.`);
              closeDetail();
              loadCustomers(query);
            } catch (e: any) {
              Alert.alert('Gagal Menghapus Pelanggan', e.message || 'Hanya superadmin/operator berizin yang dapat menghapus pelanggan.');
            } finally {
              setIsMutating(false);
            }
          },
        },
      ]
    );
  };

  // ---- Terminasi Langganan ----
  const handleTerminateSubscription = () => {
    if (!selectedSub) return;
    Alert.alert(
      'Terminasi Langganan',
      `Apakah Anda yakin ingin MENERMINASI langganan username "${selectedSub.pppoeUsername}"?\n\nAkun PPPoE di FreeRADIUS akan dihapus dan koneksi dihentikan secara permanen.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Terminasi',
          style: 'destructive',
          onPress: async () => {
            setIsMutating(true);
            try {
              await apiFetch(`/subscriptions/${selectedSub.id}/terminate`, { method: 'POST' });
              Alert.alert('Sukses', 'Langganan berhasil diterminasi.');
              if (selected) await openDetail(selected);
              loadCustomers(query);
            } catch (e: any) {
              Alert.alert('Gagal Terminasi', e.message || 'Aksi terminasi hanya diperbolehkan untuk Superadmin.');
            } finally {
              setIsMutating(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={sharedStyles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#faf9ff" />
      <AppHeader subtitle="KELOLA PELANGGAN" onOpenSettings={() => setShowSettingsModal(true)} />

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Cari nama atau nomor pelanggan..."
          value={query}
          onChangeText={handleSearchChange}
          autoCorrect={false}
        />
        {canManageCustomers && (
          <TouchableOpacity style={styles.importButton} onPress={() => setShowImportModal(true)}>
            <Text style={styles.importButtonText}>📥 Import</Text>
          </TouchableOpacity>
        )}
        {canManageCustomers && (
          <TouchableOpacity style={styles.addButton} onPress={openCreateModal}>
            <Text style={styles.addButtonText}>+ Tambah</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <View style={sharedStyles.loadingContainer}>
          <ActivityIndicator size="large" color="#0052cc" />
          <Text style={sharedStyles.loadingText}>Memuat pelanggan...</Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={sharedStyles.scrollContent}
          data={customers}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Text style={sharedStyles.emptyText}>Pelanggan tidak ditemukan.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} onPress={() => openDetail(item)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName}>{item.name}</Text>
                <Text style={styles.rowSub}>
                  {item.customerNo} · {item.categoryName || 'Kategori Umum'}
                </Text>
              </View>
              <Text style={[styles.rowStatus, { color: statusColor[item.status] }]}>{item.status.toUpperCase()}</Text>
            </TouchableOpacity>
          )}
        />
      )}

      <BackendUrlModal visible={showSettingsModal} onClose={() => setShowSettingsModal(false)} />

      {/* Detail Pelanggan Modal */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={closeDetail}>
        <View style={sharedStyles.modalBg}>
          <View style={[sharedStyles.settingsModalCard, { maxHeight: '85%' }]}>
            <ScrollView>
              <View style={styles.detailHeaderRow}>
                <Text style={sharedStyles.modalTitle}>👤 Detail Pelanggan</Text>
                {canManageCustomers && selected && (
                  <TouchableOpacity onPress={openEditModal}>
                    <Text style={styles.editLink}>✏️ Edit</Text>
                  </TouchableOpacity>
                )}
              </View>

              {isLoadingDetail ? (
                <ActivityIndicator color="#0052cc" style={{ marginVertical: 20 }} />
              ) : (
                selected && (
                  <>
                    <View style={sharedStyles.detailList}>
                      <View style={sharedStyles.detailRow}>
                        <Text style={sharedStyles.detailLabel}>Nama</Text>
                        <Text style={sharedStyles.detailVal}>{selected.name}</Text>
                      </View>
                      <View style={sharedStyles.detailRow}>
                        <Text style={sharedStyles.detailLabel}>ID Pelanggan</Text>
                        <Text style={sharedStyles.detailVal}>{selected.customerNo}</Text>
                      </View>
                      <View style={sharedStyles.detailRow}>
                        <Text style={sharedStyles.detailLabel}>Telepon</Text>
                        <Text style={sharedStyles.detailVal}>{selected.phone || '-'}</Text>
                      </View>
                      <View style={sharedStyles.detailRow}>
                        <Text style={sharedStyles.detailLabel}>Alamat</Text>
                        <Text style={sharedStyles.detailVal}>{selected.address || '-'}</Text>
                      </View>
                      <View style={sharedStyles.detailRow}>
                        <Text style={sharedStyles.detailLabel}>Paket</Text>
                        <Text style={sharedStyles.detailVal}>{selectedSub?.packageName || 'Tidak ada langganan'}</Text>
                      </View>
                      <View style={sharedStyles.detailRow}>
                        <Text style={sharedStyles.detailLabel}>Username PPPoE</Text>
                        <Text style={sharedStyles.detailVal}>{selectedSub?.pppoeUsername || '-'}</Text>
                      </View>
                      <View style={sharedStyles.detailRow}>
                        <Text style={sharedStyles.detailLabel}>Status Koneksi</Text>
                        <Text style={[sharedStyles.detailVal, { color: selectedSub ? statusColor[selectedSub.status] : '#64748b' }]}>
                          {selectedSub ? selectedSub.status.toUpperCase() : 'N/A'}
                        </Text>
                      </View>
                    </View>

                    {/* Aksi Lifecycle Koneksi */}
                    {selectedSub && canLifecycle && selectedSub.status !== 'terminated' && (
                      <View style={styles.actionColumn}>
                        {selectedSub.status === 'active' ? (
                          <TouchableOpacity style={[styles.actionBtn, styles.isolirBtn]} onPress={handleIsolir} disabled={isMutating}>
                            {isMutating ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionBtnText}>🛑 Isolir Koneksi</Text>}
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity style={[styles.actionBtn, styles.activateBtn]} onPress={handleActivateOrUnisolir} disabled={isMutating}>
                            {isMutating ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionBtnText}>✅ Aktifkan / Buka Isolir</Text>}
                          </TouchableOpacity>
                        )}

                        <TouchableOpacity style={[styles.actionBtn, styles.editSubBtn]} onPress={openEditSubModal} disabled={isMutating}>
                          <Text style={styles.actionBtnText}>📦 Ganti Paket / Password PPPoE</Text>
                        </TouchableOpacity>

                        {isSuperadmin && (
                          <TouchableOpacity style={[styles.actionBtn, styles.terminateBtn]} onPress={handleTerminateSubscription} disabled={isMutating}>
                            <Text style={styles.actionBtnText}>⚠️ Terminasi Langganan</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}

                    {!selectedSub && canCreateSubscription && (
                      <View style={styles.actionColumn}>
                        <TouchableOpacity style={[styles.actionBtn, styles.addSubBtn]} onPress={() => openSubForm()}>
                          <Text style={styles.actionBtnText}>+ Tambah Langganan</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {canDeleteCustomers && (
                      <View style={{ marginTop: 12 }}>
                        <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={handleDeleteCustomer} disabled={isMutating}>
                          <Text style={styles.actionBtnText}>🗑️ Hapus Pelanggan</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </>
                )
              )}

              <TouchableOpacity
                style={[sharedStyles.modalBtnFullCancel, { marginTop: 16 }]}
                onPress={closeDetail}
              >
                <Text style={sharedStyles.modalBtnCancelText}>Batal</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Ganti Paket / Password PPPoE Modal */}
      <Modal visible={showEditSubModal} transparent animationType="fade" onRequestClose={() => setShowEditSubModal(false)}>
        <View style={sharedStyles.modalBg}>
          <View style={[sharedStyles.settingsModalCard, { maxHeight: '85%' }]}>
            <ScrollView>
              <Text style={sharedStyles.modalTitle}>📦 Ganti Paket & PPPoE</Text>
              <Text style={sharedStyles.modalDesc}>Username: {selectedSub?.pppoeUsername}</Text>

              <Text style={styles.fieldLabel}>Pilih Paket Baru</Text>
              <View style={styles.chipRow}>
                {packages.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.chip, editSubForm.packageId === p.id && styles.chipActive]}
                    onPress={() => setEditSubForm({ ...editSubForm, packageId: p.id })}
                  >
                    <Text style={[styles.chipText, editSubForm.packageId === p.id && styles.chipTextActive]}>{p.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Password PPPoE Baru (opsional)</Text>
              <TextInput
                style={sharedStyles.modalInput}
                placeholder="Kosongkan jika tidak diubah"
                value={editSubForm.pppoePassword}
                onChangeText={(v) => setEditSubForm({ ...editSubForm, pppoePassword: v })}
                secureTextEntry
              />

              <Text style={styles.fieldLabel}>Billing Day (1-28)</Text>
              <TextInput
                style={sharedStyles.modalInput}
                value={editSubForm.billingDay}
                onChangeText={(v) => setEditSubForm({ ...editSubForm, billingDay: v })}
                keyboardType="number-pad"
              />

              <View style={[sharedStyles.modalButtonsRow, { marginTop: 16 }]}>
                <TouchableOpacity style={[sharedStyles.modalBtnCancel]} onPress={() => setShowEditSubModal(false)} disabled={isSavingEditSub}>
                  <Text style={sharedStyles.modalBtnCancelText}>Batal</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[sharedStyles.modalBtnSave]} onPress={handleEditSubscription} disabled={isSavingEditSub}>
                  {isSavingEditSub ? <ActivityIndicator color="#fff" /> : <Text style={sharedStyles.modalBtnSaveText}>Simpan Perubahan</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Import Excel Info Modal */}
      <Modal visible={showImportModal} transparent animationType="fade" onRequestClose={() => setShowImportModal(false)}>
        <View style={sharedStyles.modalBg}>
          <View style={sharedStyles.settingsModalCard}>
            <Text style={sharedStyles.modalTitle}>📥 Import Data Pelanggan</Text>
            <View style={{ backgroundColor: '#eef4ff', padding: 12, borderRadius: 12, marginBottom: 14, borderLeftWidth: 4, borderLeftColor: '#0052cc' }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#003d9b' }}>Import Massal Excel / CSV (.xlsx, .csv)</Text>
              <Text style={{ fontSize: 11, color: '#434654', marginTop: 4 }}>
                NetBill mendukung impor data pelanggan dan akun PPPoE massal langsung dari file spreadsheet.
              </Text>
            </View>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#334155', marginBottom: 6 }}>Format Kolom File Spreadsheet:</Text>
            <Text style={{ fontSize: 11, color: '#64748b', lineHeight: 18, marginBottom: 14 }}>
              • Nama Pelanggan (Wajib){'\n'}
              • No. Telepon / WhatsApp (Opsional){'\n'}
              • Email & Alamat (Opsional){'\n'}
              • Username PPPoE & Password PPPoE{'\n'}
              • Kategori & Nama Paket Internet
            </Text>
            <Text style={{ fontSize: 11, color: '#0052cc', fontWeight: '700', marginBottom: 16 }}>
              💡 Untuk melakukan pengunggahan file .xlsx / .csv, silakan gunakan Dashboard Web-Admin (Pengaturan → Import Pelanggan) atau API `/customer-import`.
            </Text>
            <TouchableOpacity style={sharedStyles.modalBtnFullCancel} onPress={() => setShowImportModal(false)}>
              <Text style={sharedStyles.modalBtnCancelText}>Batal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Tambah Pelanggan Modal */}
      <Modal visible={showCreateModal} transparent animationType="fade" onRequestClose={() => setShowCreateModal(false)}>
        <View style={sharedStyles.modalBg}>
          <View style={[sharedStyles.settingsModalCard, { maxHeight: '85%' }]}>
            <ScrollView>
              <Text style={sharedStyles.modalTitle}>➕ Tambah Pelanggan</Text>

              <Text style={styles.fieldLabel}>Nama Lengkap *</Text>
              <TextInput style={sharedStyles.modalInput} value={createForm.name} onChangeText={(v) => setCreateForm({ ...createForm, name: v })} placeholder="cth. Budi Santoso" />

              <Text style={styles.fieldLabel}>No. HP / WhatsApp</Text>
              <TextInput style={sharedStyles.modalInput} value={createForm.phone} onChangeText={(v) => setCreateForm({ ...createForm, phone: v })} keyboardType="phone-pad" placeholder="cth. 08123456789" />

              <Text style={styles.fieldLabel}>Email (opsional)</Text>
              <TextInput style={sharedStyles.modalInput} value={createForm.email} onChangeText={(v) => setCreateForm({ ...createForm, email: v })} keyboardType="email-address" autoCapitalize="none" />

              <Text style={styles.fieldLabel}>Alamat</Text>
              <TextInput style={sharedStyles.modalInput} value={createForm.address} onChangeText={(v) => setCreateForm({ ...createForm, address: v })} multiline />

              {!isReseller && (
                <>
                  <Text style={styles.fieldLabel}>Kategori Pelanggan *</Text>
                  <View style={styles.chipRow}>
                    {categories.map((c) => (
                      <TouchableOpacity
                        key={c.id}
                        style={[styles.chip, createForm.categoryId === c.id && styles.chipActive]}
                        onPress={() => setCreateForm({ ...createForm, categoryId: c.id })}
                      >
                        <Text style={[styles.chipText, createForm.categoryId === c.id && styles.chipTextActive]}>{c.name}</Text>
                      </TouchableOpacity>
                    ))}
                    {categories.length === 0 && <Text style={styles.hintText}>Memuat kategori...</Text>}
                  </View>
                </>
              )}

              <View style={[sharedStyles.modalButtonsRow, { marginTop: 16 }]}>
                <TouchableOpacity style={[sharedStyles.modalBtn, sharedStyles.modalBtnCancel]} onPress={() => setShowCreateModal(false)} disabled={isSavingCreate}>
                  <Text style={sharedStyles.modalBtnCancelText}>Batal</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[sharedStyles.modalBtn, sharedStyles.modalBtnSave]} onPress={handleCreateCustomer} disabled={isSavingCreate}>
                  {isSavingCreate ? <ActivityIndicator color="#fff" /> : <Text style={sharedStyles.modalBtnSaveText}>Simpan</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Pelanggan Modal */}
      <Modal visible={showEditModal} transparent animationType="fade" onRequestClose={() => setShowEditModal(false)}>
        <View style={sharedStyles.modalBg}>
          <View style={sharedStyles.settingsModalCard}>
            <Text style={sharedStyles.modalTitle}>✏️ Edit Pelanggan</Text>

            <Text style={styles.fieldLabel}>Nama Lengkap *</Text>
            <TextInput style={sharedStyles.modalInput} value={editForm.name} onChangeText={(v) => setEditForm({ ...editForm, name: v })} />

            <Text style={styles.fieldLabel}>No. HP / WhatsApp</Text>
            <TextInput style={sharedStyles.modalInput} value={editForm.phone} onChangeText={(v) => setEditForm({ ...editForm, phone: v })} keyboardType="phone-pad" />

            <Text style={styles.fieldLabel}>Email (opsional)</Text>
            <TextInput style={sharedStyles.modalInput} value={editForm.email} onChangeText={(v) => setEditForm({ ...editForm, email: v })} keyboardType="email-address" autoCapitalize="none" />

            <Text style={styles.fieldLabel}>Alamat</Text>
            <TextInput style={sharedStyles.modalInput} value={editForm.address} onChangeText={(v) => setEditForm({ ...editForm, address: v })} multiline />

            <View style={sharedStyles.modalButtonsRow}>
              <TouchableOpacity style={[sharedStyles.modalBtn, sharedStyles.modalBtnCancel]} onPress={() => setShowEditModal(false)} disabled={isSavingEdit}>
                <Text style={sharedStyles.modalBtnCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[sharedStyles.modalBtn, sharedStyles.modalBtnSave]} onPress={handleEditCustomer} disabled={isSavingEdit}>
                {isSavingEdit ? <ActivityIndicator color="#fff" /> : <Text style={sharedStyles.modalBtnSaveText}>Simpan</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Tambah Langganan Modal */}
      <Modal visible={showSubForm} transparent animationType="fade" onRequestClose={() => setShowSubForm(false)}>
        <View style={sharedStyles.modalBg}>
          <View style={[sharedStyles.settingsModalCard, { maxHeight: '85%' }]}>
            <ScrollView>
              <Text style={sharedStyles.modalTitle}>📶 Tambah Langganan</Text>
              <Text style={sharedStyles.modalDesc}>Pelanggan: {selected?.name}</Text>

              <Text style={styles.fieldLabel}>Paket Internet *</Text>
              <View style={styles.chipRow}>
                {packages.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.chip, subForm.packageId === p.id && styles.chipActive]}
                    onPress={() => setSubForm({ ...subForm, packageId: p.id })}
                  >
                    <Text style={[styles.chipText, subForm.packageId === p.id && styles.chipTextActive]}>{p.name}</Text>
                  </TouchableOpacity>
                ))}
                {packages.length === 0 && <Text style={styles.hintText}>Memuat paket...</Text>}
              </View>

              <Text style={styles.fieldLabel}>Username PPPoE *</Text>
              <TextInput style={sharedStyles.modalInput} value={subForm.pppoeUsername} onChangeText={(v) => setSubForm({ ...subForm, pppoeUsername: v })} autoCapitalize="none" autoCorrect={false} />

              <Text style={styles.fieldLabel}>Password PPPoE *</Text>
              <PasswordInput style={sharedStyles.modalInput} value={subForm.pppoePassword} onChangeText={(v) => setSubForm({ ...subForm, pppoePassword: v })} />

              <Text style={styles.fieldLabel}>Billing Day (1-28)</Text>
              <TextInput style={sharedStyles.modalInput} value={subForm.billingDay} onChangeText={(v) => setSubForm({ ...subForm, billingDay: v })} keyboardType="number-pad" />

              <Text style={styles.fieldLabel}>Router / NAS (opsional)</Text>
              <View style={styles.chipRow}>
                <TouchableOpacity style={[styles.chip, subForm.routerId === '' && styles.chipActive]} onPress={() => setSubForm({ ...subForm, routerId: '' })}>
                  <Text style={[styles.chipText, subForm.routerId === '' && styles.chipTextActive]}>Tanpa Router</Text>
                </TouchableOpacity>
                {routers.map((r) => (
                  <TouchableOpacity
                    key={r.id}
                    style={[styles.chip, subForm.routerId === r.id && styles.chipActive]}
                    onPress={() => setSubForm({ ...subForm, routerId: r.id })}
                  >
                    <Text style={[styles.chipText, subForm.routerId === r.id && styles.chipTextActive]}>{r.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={[sharedStyles.modalButtonsRow, { marginTop: 16 }]}>
                <TouchableOpacity style={[sharedStyles.modalBtn, sharedStyles.modalBtnCancel]} onPress={() => setShowSubForm(false)} disabled={isSavingSub}>
                  <Text style={sharedStyles.modalBtnCancelText}>Batal</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[sharedStyles.modalBtn, sharedStyles.modalBtnSave]} onPress={handleCreateSubscription} disabled={isSavingSub}>
                  {isSavingSub ? <ActivityIndicator color="#fff" /> : <Text style={sharedStyles.modalBtnSaveText}>Simpan</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 13,
    color: '#0f172a',
  },
  importButton: {
    backgroundColor: '#64748b',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  importButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 11,
  },
  addButton: {
    backgroundColor: '#0052cc',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 11,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e9edff',
  },
  rowName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  rowSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  rowStatus: {
    fontSize: 11,
    fontWeight: '800',
  },
  detailHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editLink: {
    color: '#0052cc',
    fontWeight: '700',
    fontSize: 12,
  },
  actionColumn: {
    marginTop: 12,
    gap: 8,
  },
  actionBtn: {
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
  },
  isolirBtn: {
    backgroundColor: '#dc3545',
  },
  activateBtn: {
    backgroundColor: '#28a745',
  },
  editSubBtn: {
    backgroundColor: '#0052cc',
  },
  terminateBtn: {
    backgroundColor: '#7f1d1d',
  },
  deleteBtn: {
    backgroundColor: '#b91c1c',
  },
  addSubBtn: {
    backgroundColor: '#0052cc',
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chipActive: {
    backgroundColor: '#0052cc',
    borderColor: '#0052cc',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  chipTextActive: {
    color: '#fff',
  },
  hintText: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
});
