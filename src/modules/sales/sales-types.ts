/**
-- =====================================================================
-- Sales & Bookstore Consignment Types (Stage 18)
-- Nghiệp vụ: FR-05, R04, R07 (sales), D44-D49, D56, T56, T58, T59, T60, T68, T69
-- =====================================================================
 */

export interface BookSupplier {
  id: string;
  code: string;
  name: string;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  isActive: boolean;
  createdAt: string;
}

export type ConsignmentLotStatus = 'ACTIVE' | 'CLOSED' | 'SETTLED';
export type ConsignmentDepositStatus = 'NONE' | 'PAID' | 'PENDING_REFUND' | 'PARTIALLY_REFUNDED' | 'FULLY_REFUNDED';

export interface ConsignmentLot {
  id: string;
  batchCode: string;
  supplierId: string;
  campaignName: string;
  receivedDate: string;
  targetSettlementDate?: string | null;
  depositAmount: number;
  depositRefunded: number;
  depositStatus: ConsignmentDepositStatus;
  status: ConsignmentLotStatus;
  createdBy: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  supplierName?: string;
  items?: ConsignmentLotItem[];
}

export interface ConsignmentLotItem {
  id: string;
  lotId: string;
  titleId?: string | null;
  bookTitle: string;
  isbn?: string | null;
  coverPrice: number;
  importDiscountPercent: number;
  importPrice: number; // Đơn giá sau chiết khấu nhập trả nhà sách
  retailPrice: number; // Đơn giá bán tại quầy CLB
  initialQuantity: number;
  soldQuantity: number;
  returnedQuantity: number;
  retainedQuantity: number;
  availableQuantity: number;
  createdAt: string;
  updatedAt: string;
}

export type SalePaymentMethod = 'CASH' | 'BANK_TRANSFER';

export interface BookSale {
  id: string;
  saleCode: string;
  lotItemId: string;
  cashSessionId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  quantity: number;
  unitPrice: number;
  saleDiscountPercent: number;
  totalAmount: number;
  paymentMethod: SalePaymentMethod;
  paymentStatus: 'PAID';
  createdBy: string;
  createdAt: string;
  bookTitle?: string;
}

export interface ConsignmentReturn {
  id: string;
  returnCode: string;
  lotId: string;
  lotItemId: string;
  returnedQuantity: number;
  returnDate: string;
  recipientName?: string | null;
  proofNotes?: string | null;
  createdBy: string;
  createdAt: string;
}

export type SettlementPaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
export type SettlementDepositRefundStatus = 'NONE' | 'PENDING' | 'RECEIVED';

export interface ConsignmentSettlement {
  id: string;
  settlementCode: string;
  lotId: string;
  settlementDate: string;
  totalSoldBooks: number;
  totalReturnedBooks: number;
  totalRetainedBooks: number;
  totalRevenue: number;
  payableToSupplier: number;
  grossProfit: number;
  depositPaid: number;
  depositRefundExpected: number;
  paidToSupplier: number;
  paymentStatus: SettlementPaymentStatus;
  depositRefundStatus: SettlementDepositRefundStatus;
  depositRefundReceived: number;
  idempotencyKey?: string | null;
  settledBy: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type SupplierPaymentType = 'PAY_SUPPLIER_PAYABLE' | 'RECEIVE_DEPOSIT_REFUND';

export interface SupplierPayment {
  id: string;
  paymentCode: string;
  settlementId: string;
  paymentType: SupplierPaymentType;
  amount: number;
  paymentMethod: SalePaymentMethod;
  confirmedAt: string;
  confirmedBy: string;
  referenceDoc?: string | null;
  notes?: string | null;
  createdAt: string;
}

// DTOs
export interface CreateSupplierDto {
  code: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
}

export interface CreateLotItemDto {
  titleId?: string;
  bookTitle: string;
  isbn?: string;
  coverPrice: number;
  importDiscountPercent: number;
  importPrice?: number; // Tự động tính nếu không truyền: coverPrice * (1 - importDiscountPercent / 100)
  retailPrice: number;
  initialQuantity: number;
}

export interface CreateLotDto {
  batchCode: string;
  supplierId: string;
  campaignName: string;
  receivedDate: string;
  targetSettlementDate?: string;
  depositAmount?: number;
  depositPaymentMethod?: SalePaymentMethod;
  depositPaymentConfirmed?: boolean;
  notes?: string;
  items: CreateLotItemDto[];
}

export interface RecordSaleDto {
  lotItemId: string;
  cashSessionId?: string;
  customerName?: string;
  customerPhone?: string;
  quantity: number;
  saleDiscountPercent?: number;
  unitPrice?: number; // Mặc định là retailPrice của item
  paymentMethod: SalePaymentMethod;
  paymentConfirmed: boolean; // Bắt buộc thực thu, không cho nợ (P22-04)
  idempotencyKey?: string;
}

export interface ReturnBooksDto {
  lotItemId: string;
  returnedQuantity: number;
  returnDate: string;
  recipientName?: string;
  proofNotes?: string;
}

export interface RetainBooksDto {
  lotItemId: string;
  retainedQuantity: number;
  notes?: string;
}

export interface CreateSettlementDto {
  lotId: string;
  settlementDate?: string;
  notes?: string;
  idempotencyKey?: string;
}

export interface RecordSupplierPaymentDto {
  paymentType: SupplierPaymentType;
  amount: number;
  paymentMethod: SalePaymentMethod;
  paymentConfirmed: boolean; // Bắt buộc thực chi/thực nhận, không tự động xác nhận (RF-02)
  referenceDoc?: string;
  notes?: string;
  idempotencyKey?: string;
}
