import { useRef } from 'react';
import { WebView } from 'react-native-webview';

const MIDTRANS_HOST = /^https?:\/\/([^/?#]+\.)?midtrans\.com(?::\d+)?(?:[/?#]|$)/i;

/**
 * Pengalihan "selesai" Snap ke Finish Redirect URL merchant (diatur di dashboard Midtrans),
 * dikenali dari parameter yang selalu ditambahkan Snap: `order_id` & `transaction_status`.
 * Regex, bukan `URL.searchParams` — implementasi URL di React Native belum lengkap.
 */
export function isPaymentFinishRedirect(url: string): boolean {
  if (MIDTRANS_HOST.test(url)) return false;
  return /[?&]order_id=/.test(url) && /[?&]transaction_status=/.test(url);
}

/** Navigasi yang diblokir OS karena bukan HTTPS: iOS ATS (-1022) / Android cleartext. */
function isCleartextBlocked(event: { code?: number; description?: string }): boolean {
  return event.code === -1022 || /ERR_CLEARTEXT_NOT_PERMITTED/i.test(event.description ?? '');
}

/**
 * WebView halaman pembayaran Midtrans Snap. Setelah bayar, Snap mengalihkan ke halaman
 * merchant — di aplikasi itu tidak berguna, dan kalau URL-nya masih `http://` iOS/Android
 * memblokirnya lalu menampilkan "error loading page". Pengalihan itu dicegat: WebView
 * ditutup dan pemanggil mengecek status pembayaran sebenarnya ke backend.
 */
export function PaymentWebView({ url, onFinished }: { url: string; onFinished: () => void }) {
  // onShouldStartLoadWithRequest & onError bisa terpicu lebih dari sekali untuk satu redirect.
  const finishedRef = useRef(false);
  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onFinished();
  };

  return (
    <WebView
      source={{ uri: url }}
      style={{ flex: 1 }}
      javaScriptEnabled
      domStorageEnabled
      startInLoadingState
      onShouldStartLoadWithRequest={(request) => {
        if (request.isTopFrame !== false && isPaymentFinishRedirect(request.url)) {
          finish();
          return false;
        }
        return true;
      }}
      onError={({ nativeEvent }) => {
        if (isCleartextBlocked(nativeEvent)) finish();
      }}
    />
  );
}
