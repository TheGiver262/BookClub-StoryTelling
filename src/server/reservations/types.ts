/**
 * YSBK Public Reservation System - Core Contracts & Types
 * Quyết định kiến trúc & nghiệp vụ theo docs/technical/public-reservation-design.md
 */

export type ReservationStatus = 'HELD' | 'BORROWED' | 'RETURNED' | 'CANCELLED' | 'EXPIRED';

export interface CreateReservationInput {
  titleId: string;
  scheduleId: string;
  fullName: string;
  phone: string;
  studentId?: string;
  university?: string;
  email?: string;
}

export interface ReservationRequestContext {
  clientIp: string;
  idempotencyKey?: string;
  captchaToken: string;
  now?: Date;
  secret?: string;
}

export interface PublicReservationDto {
  id: string;
  code: string;
  status: ReservationStatus;
  titleId: string;
  bookTitle: string;
  authorName?: string;
  copyBarcode?: string; // Trả cho quầy trực / nội bộ, ẩn hoặc tùy chọn phía công khai
  scheduleId: string;
  shiftDate: string;
  shiftTime: string;
  pickupLocation: string;
  expiresAt: string;
  estimatedDeposit: number;
  createdAt: string;
}

export interface CreateReservationResult {
  reservation: PublicReservationDto;
  lookupToken: string;
  isReplay?: boolean;
}

export interface StaffReservationDto extends PublicReservationDto {
  fullName: string;
  phone: string;
  fulfillmentIssue: 'COPY_UNAVAILABLE' | null;
}

export interface FulfillReservationInput {
  borrowerId?: string;
  paymentMethod: 'CASH' | 'BANK_TRANSFER';
  depositPaymentConfirmed: boolean;
  notes?: string;
}

export interface FulfillReservationResult {
  reservation: PublicReservationDto;
  loanReceipt: any;
}

export interface CancelReservationInput {
  reason?: string;
}

export interface ExpireReservationsResult {
  expiredCount: number;
  expiredIds: string[];
}

export interface PublicReservationBookDto {
  coverPrice?: number | null;
  titleId: string;
  title: string;
  author: string;
  category: string;
  coverImageUrl?: string;
  standardDeposit: number;
  availableCopiesCount: number;
}

export interface PublicPickupScheduleDto {
  id: string;
  date: string;
  timeRange: string;
  endTime: string; // ISO string thời điểm kết thúc ca trực
  location: string;
  isAvailableForReservation: boolean;
}

export interface ReservationFilter {
  scheduleId?: string;
  status?: ReservationStatus;
  search?: string;
  page?: number;
  limit?: number;
}
