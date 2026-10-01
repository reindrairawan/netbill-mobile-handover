import React from 'react';
import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/auth-context';

type IconName = keyof typeof MaterialIcons.glyphMap;

function CustomTabIcon({ name, label, focused }: { name: IconName; label: string; focused: boolean }) {
  return (
    <View style={styles.tabItemContainer}>
      <View style={[styles.iconPill, focused && styles.iconPillActive]}>
        <MaterialIcons
          name={name}
          size={22}
          color={focused ? '#003d9b' : '#535c67'}
        />
      </View>
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export default function AppTabs() {
  const { user, can } = useAuth();
  const insets = useSafeAreaInsets();
  const isStaff = user?.role !== 'customer';
  const canSeeMonitoring = can('monitoring.view');

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          height: 68 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom + 4,
          backgroundColor: '#faf9ff',
          borderTopWidth: 1,
          borderTopColor: '#d8e2ff',
          elevation: 16,
          shadowColor: '#051a3e',
          shadowOffset: { width: 0, height: -6 },
          shadowOpacity: 0.08,
          shadowRadius: 14,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Beranda',
          tabBarIcon: ({ focused }) => (
            <CustomTabIcon name="dashboard" label="Beranda" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="pelanggan"
        options={{
          title: 'Pelanggan',
          href: isStaff ? undefined : null,
          tabBarIcon: ({ focused }) => (
            <CustomTabIcon name="groups" label="Pelanggan" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="monitoring"
        options={{
          title: 'Monitoring',
          href: canSeeMonitoring ? undefined : null,
          tabBarIcon: ({ focused }) => (
            <CustomTabIcon name="router" label="Monitoring" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="tagihan"
        options={{
          title: 'Tagihan',
          href: !isStaff ? undefined : null,
          tabBarIcon: ({ focused }) => (
            <CustomTabIcon name="receipt-long" label="Tagihan" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="koneksi"
        options={{
          title: 'Koneksi',
          href: !isStaff ? undefined : null,
          tabBarIcon: ({ focused }) => (
            <CustomTabIcon name="wifi" label="Koneksi" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="akun"
        options={{
          title: 'Akun',
          tabBarIcon: ({ focused }) => (
            <CustomTabIcon name="person" label="Akun" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabItemContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 62,
  },
  iconPill: {
    width: 52,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  iconPillActive: {
    backgroundColor: '#d5e3ff',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#535c67',
    marginTop: 4,
    textAlign: 'center',
  },
  tabLabelActive: {
    color: '#003d9b',
    fontWeight: '700',
  },
});
