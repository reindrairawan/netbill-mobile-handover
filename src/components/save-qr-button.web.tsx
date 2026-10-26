// Versi web: expo-media-library tidak punya modul web (import-nya langsung crash), dan di
// browser QR bisa disimpan langsung dari halaman Midtrans — tombol ini tidak dibutuhkan.
export function SaveQrButton(_props: { qrPath: string; fileLabel: string }) {
  return null;
}
