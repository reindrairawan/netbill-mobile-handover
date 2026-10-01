import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_BACKEND_URL } from '@/constants/app-config';

// Dulu tipe ini disalin manual di sini, dan salinannya sempat tertinggal saat
// backend menambah field (mustSetPassword). Sekarang mengikuti kontrak bersama.
export type { AuthUser } from '@/types/api';
import type { AuthUser, LoginResponse } from '@/types/api';

interface AuthContextValue {
  backendUrl: string;
  saveBackendUrl: (url: string) => Promise<void>;
  token: string | null;
  user: AuthUser | null;
  /** Masih memuat token/backendUrl dari AsyncStorage saat startup — jangan render apa pun sampai ini selesai. */
  isBootstrapping: boolean;
  isLoggingIn: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  /** Simpan token+user baru ke sesi berjalan tanpa login ulang (mis. setelah set/ganti sandi). */
  applySession: (res: LoginResponse) => Promise<void>;
  /** Helper fetch ke backend NetBill — otomatis pasang Authorization header & base URL, auto-refresh token & redirect login jika sesi kedaluwarsa. */
  apiFetch: (path: string, options?: RequestInit, isRetry?: boolean) => Promise<any>;
  /**
   * Permission efektif user (dari matrix RBAC "Hak Akses" di web-admin, `GET /permissions/me`) —
   * dipakai buat gating tombol/aksi di mobile.
   */
  permissions: Record<string, boolean> | null;
  can: (key: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

let refreshPromise: Promise<boolean> | null = null;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [backendUrl, setBackendUrl] = useState(DEFAULT_BACKEND_URL);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [permissions, setPermissions] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const storedUrl = await AsyncStorage.getItem('NETBILL_BACKEND_URL');
        if (storedUrl) setBackendUrl(storedUrl);

        const storedToken = await AsyncStorage.getItem('NETBILL_TOKEN');
        const storedUserJson = await AsyncStorage.getItem('NETBILL_USER');
        if (storedToken && storedUserJson) {
          setToken(storedToken);
          setUser(JSON.parse(storedUserJson));
        }
      } catch (e) {
        console.error('Failed to load storage values', e);
      } finally {
        setIsBootstrapping(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!token) {
      setPermissions(null);
      return;
    }
    (async () => {
      try {
        const data = await apiFetch('/permissions/me');
        setPermissions(data);
      } catch (e) {
        console.error('Gagal memuat permission', e);
        setPermissions({});
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const can = (key: string): boolean => {
    if (user?.role === 'superadmin') return true;
    return permissions?.[key] ?? false;
  };

  const saveBackendUrl = async (url: string) => {
    let cleanUrl = url.trim();
    if (cleanUrl.endsWith('/')) cleanUrl = cleanUrl.slice(0, -1);
    await AsyncStorage.setItem('NETBILL_BACKEND_URL', cleanUrl);
    setBackendUrl(cleanUrl);
  };

  const logout = () => {
    AsyncStorage.removeItem('NETBILL_TOKEN');
    AsyncStorage.removeItem('NETBILL_REFRESH_TOKEN');
    AsyncStorage.removeItem('NETBILL_USER');
    setToken(null);
    setUser(null);
    setPermissions(null);
  };

  const refreshAccessToken = async (): Promise<boolean> => {
    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
      try {
        const storedRefreshToken = await AsyncStorage.getItem('NETBILL_REFRESH_TOKEN');
        if (!storedRefreshToken) return false;

        const res = await fetch(`${backendUrl}/api/v1/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: storedRefreshToken }),
        });

        if (!res.ok) return false;

        const resJson = await res.json();
        const newToken = resJson.accessToken;
        const newRefreshToken = resJson.refreshToken;
        const newProfile = resJson.user as AuthUser;

        await AsyncStorage.setItem('NETBILL_TOKEN', newToken);
        await AsyncStorage.setItem('NETBILL_REFRESH_TOKEN', newRefreshToken);
        await AsyncStorage.setItem('NETBILL_USER', JSON.stringify(newProfile));

        setToken(newToken);
        setUser(newProfile);
        return true;
      } catch {
        return false;
      } finally {
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  };

  const apiFetch = async (path: string, options: RequestInit = {}, isRetry = false): Promise<any> => {
    const url = `${backendUrl}/api/v1${path}`;
    const currentToken = token || (await AsyncStorage.getItem('NETBILL_TOKEN'));

    const headers = {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
      ...options.headers,
    };

    const response = await fetch(url, { ...options, headers });

    // Handle 401 Sesi Kedaluwarsa: coba refresh token dulu, kalau gagal → logout & redirect login
    if (response.status === 401 && !isRetry && path !== '/auth/login' && path !== '/auth/refresh') {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return apiFetch(path, options, true);
      }
      logout();
      throw new Error('UNAUTHORIZED');
    }

    if (!response.ok) {
      const errText = await response.text();
      let errMsg = 'Terjadi kesalahan pada server';
      let errCode = '';
      try {
        const errJson = JSON.parse(errText);
        errMsg = errJson.error?.message || errJson.message || errMsg;
        errCode = errJson.error?.code || '';
      } catch {
        // biarkan errMsg default
      }
      // Tangkap juga jika body berisi kode UNAUTHORIZED (edge case mis. 403 dengan kode UNAUTHORIZED)
      if (errCode === 'UNAUTHORIZED' || errMsg === 'Token tidak valid atau kedaluwarsa.') {
        if (!isRetry) {
          const refreshed = await refreshAccessToken();
          if (refreshed) {
            return apiFetch(path, options, true);
          }
        }
        logout();
        throw new Error('UNAUTHORIZED');
      }
      throw new Error(errMsg);
    }

    if (response.status === 204) return null;
    return response.json();
  };

  const applySession = async (res: LoginResponse) => {
    await AsyncStorage.setItem('NETBILL_TOKEN', res.accessToken);
    await AsyncStorage.setItem('NETBILL_REFRESH_TOKEN', res.refreshToken);
    await AsyncStorage.setItem('NETBILL_USER', JSON.stringify(res.user));
    setToken(res.accessToken);
    setUser(res.user);
  };

  const login = async (email: string, password: string) => {
    setIsLoggingIn(true);
    try {
      const response = await fetch(`${backendUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Email atau password salah.';
        try {
          const errJson = JSON.parse(errorText);
          errorMessage = errJson.error?.message || errJson.message || errorMessage;
        } catch {
          // biarkan errorMessage default
        }
        throw new Error(errorMessage);
      }

      const resJson = await response.json();
      const userToken = resJson.accessToken;
      const refreshToken = resJson.refreshToken;
      const userProfile = resJson.user as AuthUser;

      await AsyncStorage.setItem('NETBILL_TOKEN', userToken);
      if (refreshToken) {
        await AsyncStorage.setItem('NETBILL_REFRESH_TOKEN', refreshToken);
      }
      await AsyncStorage.setItem('NETBILL_USER', JSON.stringify(userProfile));

      setToken(userToken);
      setUser(userProfile);
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        backendUrl,
        saveBackendUrl,
        token,
        user,
        isBootstrapping,
        isLoggingIn,
        login,
        logout,
        applySession,
        apiFetch,
        permissions,
        can,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam <AuthProvider>.');
  return ctx;
}
