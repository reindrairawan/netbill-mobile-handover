import type { ReactNode } from 'react';
import { Modal, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Modal berbentuk sheet yang menempel di dasar layar. Pakai ini untuk semua sheet yang punya
 * tombol aksi di bagian bawah: Android modern menggambar aplikasi sampai ke belakang bar
 * navigasi (back/home/recent), dan iPhone punya home indicator, jadi tanpa jarak dari inset
 * sistem tombol paling bawah tertutup dan tidak bisa ditekan.
 *
 * - `SafeAreaProvider` sendiri: Modal adalah jendela native terpisah, inset dari provider
 *   induk tidak selalu cocok untuk jendelanya.
 * - `statusBarTranslucent` + `navigationBarTranslucent` (Android): jendela modal selalu
 *   digambar sampai tepi layar, jadi inset yang terbaca konsisten di semua versi Android
 *   dan mode navigasi (tombol maupun gestur).
 * - Latar sheet tetap memanjang sampai dasar layar; hanya isinya yang didorong naik.
 */
export function BottomSheetModal({
  visible,
  onRequestClose,
  sheetStyle,
  contentPaddingBottom = 16,
  children,
}: {
  visible: boolean;
  onRequestClose: () => void;
  /** Padding atas/samping & gaya lain sheet. Padding bawah diatur `contentPaddingBottom`. */
  sheetStyle?: StyleProp<ViewStyle>;
  /** Jarak di atas inset sistem, mis. 0 bila elemen paling bawah sudah punya padding sendiri. */
  contentPaddingBottom?: number;
  children: ReactNode;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onRequestClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <SafeAreaProvider>
        <SheetFrame sheetStyle={sheetStyle} contentPaddingBottom={contentPaddingBottom}>
          {children}
        </SheetFrame>
      </SafeAreaProvider>
    </Modal>
  );
}

// Dipisah dari BottomSheetModal karena useSafeAreaInsets harus dipanggil DI DALAM provider modal.
function SheetFrame({
  sheetStyle,
  contentPaddingBottom,
  children,
}: {
  sheetStyle?: StyleProp<ViewStyle>;
  contentPaddingBottom: number;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.backdrop, { paddingTop: insets.top }]}>
      <View style={[styles.sheet, sheetStyle, { paddingBottom: insets.bottom + contentPaddingBottom }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
    flexShrink: 1,
  },
});
