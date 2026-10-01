import Constants from 'expo-constants';

/**
 * URL backend bawaan. Bisa ditimpa per-profil build lewat `extra.apiUrl` di app.json,
 * supaya build produksi tidak bergantung pada pengguna yang mengetik URL manual.
 */
export const DEFAULT_BACKEND_URL: string =
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ??
  'https://netbill.fiberaccess.co.id';

/**
 * Pengalih backend (ikon gear) adalah alat pengembangan: ia membiarkan siapa pun
 * mengarahkan aplikasi ke server lain, termasuk server palsu yang memanen kredensial.
 * Karena itu hanya muncul di build pengembangan (`__DEV__`), tidak di rilis.
 *
 * Konsekuensinya DEFAULT_BACKEND_URL harus benar saat build rilis — di rilis tidak
 * ada lagi jalan keluar bagi pengguna kalau URL-nya salah.
 */
export const SHOW_BACKEND_SWITCHER = __DEV__;
