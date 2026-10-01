/**
 * Tipe dan kontrak API untuk aplikasi mobile FiberAccess.
 * Dipisahkan dari monorepo (@netbill/shared) untuk kemandirian repository.
 */

// ---- Enum domain ----
export const UserRole = {
  SUPERADMIN: 'superadmin',
  OPERATOR: 'operator',
  RESELLER: 'reseller',
  CUSTOMER: 'customer',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

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

// ---- DTO Auth ----
export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  /** Hanya terisi kalau role = reseller — kategori pelanggan yang jadi scope akses reseller ini. */
  resellerCategoryId: number | null;
  /** Hanya relevan untuk role = customer — true kalau passwordHash masih null (belum pernah set sandi baru), wajib set sandi baru sebelum lanjut pakai app. */
  mustSetPassword?: boolean;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

// ---- DTO Subscriptions & Invoices ----
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
  pppoeUsername: string;
  periodMonth: string;
  amount: number;
  status: InvoiceStatus;
  issuedAt: string;
  dueDate: string;
  paidAt: string | null;
  reminderSentAt: string | null;
  reminderSentCount: number;
}
