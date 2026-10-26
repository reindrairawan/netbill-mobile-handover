/**
 * DIHASILKAN OTOMATIS dari packages/shared/src/index.ts (monorepo NetBill) oleh
 * `apps/mobile/scripts/sync-handover.mjs` — jangan diedit manual, perubahan akan tertimpa.
 * Berisi hanya tipe/konstanta yang dipakai aplikasi mobile.
 */

export const UserRole = {
  SUPERADMIN: 'superadmin',
  OPERATOR: 'operator',
  RESELLER: 'reseller',
  RESELLER_TECH: 'reseller_tech',
  CUSTOMER: 'customer',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export function isResellerScopedRole(role: string | null | undefined): boolean {
  return role === UserRole.RESELLER || role === UserRole.RESELLER_TECH;
}

export const CustomerStatus = {
  PENDING: 'pending',
  ACTIVE: 'active',
  ISOLIR: 'isolir',
  TERMINATED: 'terminated',
} as const;

export type CustomerStatus = (typeof CustomerStatus)[keyof typeof CustomerStatus];

export const SubscriptionStatus = CustomerStatus;

export type SubscriptionStatus = CustomerStatus;

export const InvoiceStatus = {
  UNPAID: 'unpaid',
  PAID: 'paid',
  OVERDUE: 'overdue',
  VOID: 'void',
} as const;

export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];

export const ResellerDepositStatus = {
  PENDING: 'pending',
  PAID: 'paid',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
} as const;

export type ResellerDepositStatus = (typeof ResellerDepositStatus)[keyof typeof ResellerDepositStatus];

export type ResellerDepositItemStatus = 'pending' | 'settled' | 'excluded';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  /** Hanya terisi kalau role = reseller — kategori pelanggan yang jadi scope akses reseller ini. */
  resellerCategoryId: number | null;
  /** Hanya relevan untuk role = customer — true kalau passwordHash masih null (belum pernah set sandi sendiri), wajib set sandi baru sebelum lanjut pakai app. */
  mustSetPassword?: boolean;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export const CLIENT_PLATFORM_HEADER = 'x-client-platform';

export interface SubscriptionDTO {
  /** ID publik (UUID) — bukan id sekuensial internal. */
  id: string;
  customerId?: string;
  customerName: string;
  pppoeUsername: string;
  packageName: string;
  packageId: number;
  routerId: number | null;
  status: SubscriptionStatus;
  billingDay: number;
  installationFee: number | null;
  activatedAt: string | null;
  createdAt: string;
}

export interface InvoiceDTO {
  /**
   * ID publik (UUID) — INI yang dipakai semua endpoint invoice, termasuk
   * `POST /portal/invoices/:publicId/gateway` yang memvalidasinya sebagai UUID.
   * Jangan pernah mengirim `invoiceNo` ke endpoint tersebut: formatnya
   * `INV-2026-08-0001`, bukan UUID, sehingga selalu ditolak validasi.
   */
  id: string;
  invoiceNo: string;
  /** ID publik (UUID) pelanggan — bukan id sekuensial internal. */
  customerId: string;
  customerName: string;
  customerPhone?: string | null;
  /** Kategori pelanggan pemilik invoice; null bila pelanggan tanpa kategori. Hanya diisi di `GET /invoices`. */
  categoryId?: number | null;
  categoryName?: string | null;
  pppoeUsername: string;
  periodMonth: string;
  amount: number;
  status: InvoiceStatus;
  issuedAt: string;
  dueDate: string;
  paidAt: string | null;
  reminderSentAt: string | null;
  reminderSentCount: number;
  /** Terisi selama tagihan ada di setoran reseller yang masih pending — bayar/void/hapus ditolak. */
  lockedByDeposit?: { id: string; depositNo: string } | null;
}

export interface ResellerDepositItemDTO {
  /** publicId invoice — null bila invoicenya sudah dihapus permanen. */
  invoiceId: string | null;
  invoiceNo: string;
  customerName: string | null;
  amount: number;
  status: ResellerDepositItemStatus;
  excludedReason: string | null;
}

export interface ResellerDepositDTO {
  /** ID publik (UUID). */
  id: string;
  depositNo: string;
  categoryId: number;
  categoryName: string;
  createdByName: string;
  status: ResellerDepositStatus;
  totalAmount: number;
  invoiceCount: number;
  /** Dibayar tapi invoicenya keburu lunas/void/dihapus — perlu refund/kompensasi manual. */
  overpaidAmount: number;
  paymentType: string | null;
  expiresAt: string;
  paidAt: string | null;
  note: string | null;
  createdAt: string;
  /** Hanya diisi di endpoint detail. */
  items?: ResellerDepositItemDTO[];
}
