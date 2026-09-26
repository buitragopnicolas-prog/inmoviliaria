export type Role = 'ADMIN' | 'USER';
export type PropertyStatus = 'AVAILABLE' | 'RENTED' | 'ARCHIVED';
export type InvoiceStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'VOID';
export type ChargeCatalogType = 'SERVICE' | 'PRODUCT';
export type StoredFilePurpose = 'PROPERTY_IMAGE' | 'GENERIC' | 'LEASE_CONTRACT' | 'PAYMENT_RECEIPT';
export type ManualPaymentMethodCode = 'QR' | 'BREB' | 'BANK_TRANSFER' | 'BANK_DEPOSIT';

export interface ChargeCatalogItem {
  id: string;
  type: ChargeCatalogType;
  code: string;
  name: string;
  unitPrice: number;
  active: boolean;
}

export interface User {
  sub: string;
  email: string;
  name: string;
  role: Role;
}

export interface TenantOption {
  id: string;
  sourceKey?: string | null;
  name: string;
  email?: string | null;
  phone?: string | null;
  documentNumber?: string | null;
  userId?: string | null;
  leases: Array<{
    id: string;
    property: { id: string; title: string; address: string };
  }>;
}

export interface PropertyLeaseAssignment {
  id: string;
  startDate?: string | null;
  endDate?: string | null;
  expectedMonthlyPayment?: number | null;
  tenant?: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    documentNumber?: string | null;
  } | null;
  user?: { id: string; name: string; email: string } | null;
}

export interface PropertyImage { id: string; url: string; alt: string; sortOrder: number }
export interface Property {
  id: string;
  title: string;
  slug: string;
  description: string;
  monthlyRent: number;
  administrationFee: number;
  deposit: number;
  city: string;
  neighborhood: string;
  address: string;
  bedrooms: number;
  bathrooms: number;
  areaM2: number;
  parking: number;
  features: string[];
  tour360Url?: string | null;
  videoUrl?: string | null;
  published: boolean;
  status: PropertyStatus;
  images: PropertyImage[];
  leases?: PropertyLeaseAssignment[];
  _count?: { leases: number };
}

export interface NewsPost {
  id: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  sourceLabel?: string | null;
  externalUrl?: string | null;
  published: boolean;
  createdAt: string;
  createdBy?: { id: string; name: string };
}

export interface Invoice {
  id: string;
  code: string;
  period: string;
  dueDate: string;
  amount: number;
  balance: number;
  approvedAmount?: number;
  status: InvoiceStatus;
  paidAt?: string | null;
  user?: { name: string; email: string } | null;
  tenant?: { id?: string; name: string; email?: string | null } | null;
  lease: { id?: string; property: { title: string; address?: string }; user?: { name: string } };
  lineItems?: Array<{
    id: string;
    quantity: number;
    unitPrice: number;
    total: number;
    catalogItem: { code: string; name: string; type: ChargeCatalogType };
  }>;
  payments?: Array<{ id?: string; reference: string; amount: number; status: string; provider: string; manualMethod?: ManualPaymentMethodCode | null; bankReference?: string | null; createdAt?: string }>;
  adminNotes?: string | null;
  deletedReason?: string | null;
}

export interface Lease {
  id: string;
  contractFile?: ContractFile | null;
  user?: { id: string; name: string; email: string } | null;
  tenant?: { id: string; name: string; email?: string | null } | null;
  property: { title: string; monthlyRent: number };
}

export interface ContractFile {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface UserLease {
  id: string;
  startDate?: string | null;
  endDate?: string | null;
  active: boolean;
  status: string;
  contractUploadedAt?: string | null;
  contractFile?: ContractFile | null;
  property: {
    id: string;
    title: string;
    address: string;
    neighborhood: string;
    city: string;
    status: PropertyStatus;
  };
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  status: string;
  createdAt: string;
}

export interface StoredFile {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  purpose: StoredFilePurpose;
  publicPath: string;
  downloadPath?: string;
  createdAt: string;
  createdBy?: { id: string; name: string; email: string } | null;
}


export interface BankPaymentNotification {
  id: string;
  outlookMessageId: string;
  sender: string;
  subject: string;
  payerName?: string | null;
  amount?: number | null;
  accountLast4?: string | null;
  bankReference?: string | null;
  receivedAt: string;
  status: 'RECEIVED' | 'MATCHED' | 'REVIEW_REQUIRED' | 'REJECTED' | 'DUPLICATE' | 'ERROR';
  reviewReason?: string | null;
  payment?: { id: string; reference: string; status: string } | null;
  matchedInvoice?: { id: string; code: string; amount: number } | null;
  matchedLease?: { tenant?: { name: string; email?: string | null } | null; property: { address: string } } | null;
}

export interface ReceivingBankAccount {
  id: string;
  bank: string;
  label: string;
  accountLast4: string;
  active: boolean;
  _count: { leaseLinks: number; notifications: number };
}

export interface ImportBatch {
  id: string;
  sourceFile: string;
  status: 'PROCESSING' | 'COMPLETED' | 'COMPLETED_WITH_REVIEW' | 'FAILED';
  totalRows: number;
  importedRows: number;
  reviewRows: number;
  startedAt: string;
  finishedAt?: string | null;
  _count: { records: number };
}

export interface ManualPaymentConfig {
  mode: 'manual' | 'gateway' | 'mock';
  enabled: boolean;
  notice: string;
  methods: Array<{
    code: ManualPaymentMethodCode;
    title: string;
    description: string;
    enabled: boolean;
    details: Array<{ label: string; value: string }>;
    qrImageUrl?: string;
    instructions?: string;
  }>;
}

export interface ManualPaymentReport {
  id: string;
  reference: string;
  amount: number;
  status: 'AWAITING_VERIFICATION' | 'UNDER_REVIEW';
  manualMethod: ManualPaymentMethodCode;
  bankReference: string;
  paidAt: string;
  reportedAt: string;
  reviewNote?: string | null;
  receiptFile?: { id: string; originalName: string; mimeType: string; size: number } | null;
  user?: { id: string; name: string; email: string } | null;
  tenant?: { id: string; name: string } | null;
  invoice: { id: string; code: string; amount: number; lease: { property: { id: string; title: string; address: string } } };
  auditEvents: Array<{ id: string; fromStatus?: string | null; toStatus: string; note?: string | null; createdAt: string; actor?: { name: string } | null }>;
}

export type UserFinancialState = 'NO_CHARGES' | 'PENDING' | 'OVERDUE' | 'PAID';

export interface UserFinancialSummary {
  state: UserFinancialState;
  outstandingAmount: number;
  pendingAmount: number;
  overdueAmount: number;
  paidAmount: number;
  approvedPayments: number;
  invoiceCount: number;
}

export interface AdminUserSummary {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  documentNumber?: string | null;
  webAccount?: {
    id: string;
    email: string;
    role: Role;
    createdAt: string;
  } | null;
  activeLease?: {
    id: string;
    property: { id: string; title: string; address: string; status: PropertyStatus };
  } | null;
  counts: { leases: number; invoices: number; payments: number };
  financial: UserFinancialSummary;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserPayment {
  id: string;
  reference: string;
  amount: number;
  currency: string;
  provider: string;
  status: string;
  bankReference?: string | null;
  payerName?: string | null;
  createdAt: string;
  invoice?: {
    id: string;
    code: string;
    lease: { property: { id: string; title: string } };
  };
}

export interface AdminUserInvoice {
  id: string;
  code: string;
  period: string;
  dueDate: string;
  amount: number;
  balance?: number;
  status: InvoiceStatus;
  paidAt?: string | null;
  lease: { property: { id: string; title: string; address: string } };
  payments: AdminUserPayment[];
  lineItems: Array<{
    id: string;
    quantity: number;
    unitPrice: number;
    total: number;
    catalogItem: { name: string; code: string; type: ChargeCatalogType };
  }>;
}

export interface AdminUserDetail {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  documentNumber?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    role: Role;
    createdAt: string;
    updatedAt: string;
  } | null;
  aliases: Array<{ id: string; alias: string }>;
  leases: Array<{
    id: string;
    startDate?: string | null;
    endDate?: string | null;
    active: boolean;
    status: string;
    expectedMonthlyPayment?: number | null;
    legacyCode?: string | null;
    novelty?: string | null;
    observations?: string | null;
    contractUploadedAt?: string | null;
    contractFile?: ContractFile | null;
    createdAt: string;
    property: {
      id: string;
      title: string;
      address: string;
      neighborhood: string;
      city: string;
      monthlyRent: number;
      status: PropertyStatus;
      images: PropertyImage[];
    };
    invoices: AdminUserInvoice[];
  }>;
  invoices: AdminUserInvoice[];
  payments: AdminUserPayment[];
  financial: UserFinancialSummary;
}
