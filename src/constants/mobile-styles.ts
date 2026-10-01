import { StyleSheet } from 'react-native';

/** Warna & style yang dipakai berulang lintas layar mobile (modal, status chip, loading, dsb). */
export const sharedStyles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#faf9ff',
  },
  loadingText: {
    marginTop: 10,
    color: '#0052cc',
    fontSize: 14,
    fontWeight: '600',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#faf9ff',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 10,
  },
  emptyText: {
    textAlign: 'center',
    color: '#64748b',
    marginVertical: 20,
    fontSize: 13,
  },
  // ---- Modal ----
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  settingsModalCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 10,
  },
  searchModalCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 10,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 10,
  },
  modalDesc: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 18,
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#0f172a',
    marginBottom: 20,
    width: '100%',
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    width: '100%',
  },
  modalBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBtnRow: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBtnCancel: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBtnCancelText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  modalBtnSave: {
    flex: 1,
    backgroundColor: '#0052cc',
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBtnSaveText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  modalBtnFullCancel: {
    width: '100%',
    backgroundColor: '#e2e8f0',
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBtnFullSave: {
    width: '100%',
    backgroundColor: '#0052cc',
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // ---- Detail rows (dipakai modal detail pelanggan / profil) ----
  detailList: {
    marginTop: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  detailLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  detailVal: {
    fontSize: 12,
    color: '#0f172a',
    fontWeight: '700',
    textAlign: 'right',
    flex: 1,
    paddingLeft: 20,
  },
  // ---- Status chip (koneksi/pelanggan) ----
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusChipActive: {
    backgroundColor: '#e6f4ea',
  },
  statusChipIsolir: {
    backgroundColor: '#fce8e6',
  },
  statusChipPending: {
    backgroundColor: '#fef7e0',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusDotActive: {
    backgroundColor: '#137333',
  },
  statusDotIsolir: {
    backgroundColor: '#c5221f',
  },
  statusDotPending: {
    backgroundColor: '#b06000',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusTextActive: {
    color: '#137333',
  },
  statusTextIsolir: {
    color: '#c5221f',
  },
  statusTextPending: {
    color: '#b06000',
  },
  // ---- Header (dipakai tiap layar setelah login) ----
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9edff',
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#0052cc',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  logoIcon: {
    fontSize: 18,
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#003d9b',
  },
  brandSubtitle: {
    fontSize: 9,
    fontWeight: '700',
    color: '#737685',
    letterSpacing: 1,
  },
  headerActions: {
    flexDirection: 'row',
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f3ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: {
    fontSize: 16,
  },
});
