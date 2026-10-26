import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/auth-context';
import { SHOW_BACKEND_SWITCHER } from '@/constants/app-config';
import { isResellerScopedRole } from '@/types/api';

interface AppHeaderProps {
  subtitle?: string;
  /** Hanya dipakai di build pengembangan — lihat SHOW_BACKEND_SWITCHER. */
  onOpenSettings?: () => void;
}

export function AppHeader({ subtitle, onOpenSettings }: AppHeaderProps) {
  const { user } = useAuth();
  const isStaff = user?.role !== 'customer';
  const isReseller = isResellerScopedRole(user?.role);

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : 'FA';

  const displayTitle = user?.name || (isReseller ? 'Reseller Partner' : isStaff ? 'Super Admin' : 'Pelanggan');
  const displaySub = subtitle || (isReseller ? 'FiberAccess Partner' : isStaff ? 'FiberAccess Staff' : 'Portal Pelanggan');

  return (
    <View style={styles.header}>
      <View style={styles.profileContainer}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
            {displayTitle}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1} ellipsizeMode="tail">
            {displaySub}
          </Text>
        </View>
      </View>

      {/* Lonceng notifikasi sengaja DIHAPUS: tidak ada sumber datanya (belum ada tabel
          notifikasi di backend), tombolnya tanpa aksi, dan titik merahnya selalu
          menyala sehingga terus terbaca sebagai "ada pesan belum dibaca". Kembalikan
          hanya bersamaan dengan fitur notifikasi yang sungguhan. */}
      {SHOW_BACKEND_SWITCHER && onOpenSettings && (
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconButton} onPress={onOpenSettings}>
            <MaterialIcons name="settings" size={20} color="#434654" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#faf9ff',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(216, 226, 255, 0.4)',
  },
  profileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    marginRight: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#003d9b',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    shadowColor: '#091e42',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    flexShrink: 0,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  profileInfo: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'Hanken Grotesk',
    fontSize: 16,
    fontWeight: '700',
    color: '#003d9b',
    lineHeight: 20,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: '#434654',
    marginTop: 1,
    lineHeight: 14,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#e9edff',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#ba1a1a',
    borderWidth: 1,
    borderColor: '#faf9ff',
  },
});
