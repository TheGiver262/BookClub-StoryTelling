-- =====================================================================
-- Migration 10: Stage 18 - Lô Sách Mới, Bán / Trả Dư và Quyết Toán Nhà Sách
-- Nghiệp vụ: FR-05, R04, R07 (sales), D44-D49, D56, T56, T58, T59, T60, T68, T69
-- =====================================================================

-- 1. BẢNG NHÀ CUNG CẤP / NHÀ SÁCH KÝ GỬI
CREATE TABLE IF NOT EXISTS book_suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    contact_person VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(100),
    address TEXT,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_book_suppliers_code ON book_suppliers(code);

-- 2. BẢNG LÔ SÁCH KÝ GỬI (CONSIGNMENT LOTS)
CREATE TABLE IF NOT EXISTS consignment_lots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_code VARCHAR(50) UNIQUE NOT NULL,
    supplier_id UUID NOT NULL REFERENCES book_suppliers(id) ON DELETE RESTRICT,
    campaign_name VARCHAR(150) NOT NULL,
    received_date DATE NOT NULL,
    target_settlement_date DATE,
    deposit_amount BIGINT NOT NULL DEFAULT 0 CHECK (deposit_amount >= 0),
    deposit_refunded BIGINT NOT NULL DEFAULT 0 CHECK (deposit_refunded >= 0),
    deposit_status VARCHAR(30) NOT NULL DEFAULT 'NONE' CHECK (deposit_status IN ('NONE', 'PAID', 'PENDING_REFUND', 'PARTIALLY_REFUNDED', 'FULLY_REFUNDED')),
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CLOSED', 'SETTLED')),
    created_by UUID NOT NULL REFERENCES members(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consignment_lots_supplier ON consignment_lots(supplier_id);
CREATE INDEX IF NOT EXISTS idx_consignment_lots_batch_code ON consignment_lots(batch_code);

-- 3. BẢNG DÒNG CHI TIẾT SÁCH TRONG LÔ (CONSIGNMENT LOT ITEMS)
-- Tách biệt hoàn toàn với book_copies (sách mượn). Không gán serial cho từng cuốn mới.
CREATE TABLE IF NOT EXISTS consignment_lot_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lot_id UUID NOT NULL REFERENCES consignment_lots(id) ON DELETE CASCADE,
    title_id UUID NULL REFERENCES book_titles(id) ON DELETE SET NULL,
    book_title VARCHAR(250) NOT NULL,
    isbn VARCHAR(30),
    cover_price BIGINT NOT NULL CHECK (cover_price >= 0),
    import_discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (import_discount_percent >= 0 AND import_discount_percent <= 100),
    import_price BIGINT NOT NULL CHECK (import_price >= 0),
    retail_price BIGINT NOT NULL CHECK (retail_price >= 0),
    initial_quantity INT NOT NULL CHECK (initial_quantity > 0),
    sold_quantity INT NOT NULL DEFAULT 0 CHECK (sold_quantity >= 0),
    returned_quantity INT NOT NULL DEFAULT 0 CHECK (returned_quantity >= 0),
    retained_quantity INT NOT NULL DEFAULT 0 CHECK (retained_quantity >= 0),
    available_quantity INT NOT NULL CHECK (available_quantity >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Invariant: initial_quantity = sold_quantity + returned_quantity + retained_quantity + available_quantity
    CONSTRAINT chk_lot_item_quantity_conservation CHECK (
        initial_quantity = sold_quantity + returned_quantity + retained_quantity + available_quantity
    )
);

CREATE INDEX IF NOT EXISTS idx_lot_items_lot ON consignment_lot_items(lot_id);
CREATE INDEX IF NOT EXISTS idx_lot_items_title ON consignment_lot_items(title_id);

-- 4. BẢNG GIAO DỊCH BÁN SÁCH TẠI QUẦY (BOOK SALES)
-- Khách trả đủ ngay, không cho nợ, không đặt trước, không đổi trả sau mua
CREATE TABLE IF NOT EXISTS book_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_code VARCHAR(50) UNIQUE NOT NULL,
    lot_item_id UUID NOT NULL REFERENCES consignment_lot_items(id) ON DELETE RESTRICT,
    cash_session_id VARCHAR(35) NULL REFERENCES cash_sessions(id) ON DELETE SET NULL,
    customer_name VARCHAR(150),
    customer_phone VARCHAR(20),
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price BIGINT NOT NULL CHECK (unit_price >= 0),
    sale_discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (sale_discount_percent >= 0 AND sale_discount_percent <= 100),
    total_amount BIGINT NOT NULL CHECK (total_amount >= 0),
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('CASH', 'BANK_TRANSFER')),
    payment_status VARCHAR(20) NOT NULL DEFAULT 'PAID' CHECK (payment_status = 'PAID'),
    created_by UUID NOT NULL REFERENCES members(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_book_sales_lot_item ON book_sales(lot_item_id);
CREATE INDEX IF NOT EXISTS idx_book_sales_cash_session ON book_sales(cash_session_id);

-- 5. BẢNG TRẢ SÁCH DƯ VẬT LÝ VỀ NHÀ SÁCH (CONSIGNMENT RETURNS)
-- Trả hàng vật lý ghi nhận chứng từ nhưng không tự động xác nhận hoàn tiền ngân hàng/tiền mặt
CREATE TABLE IF NOT EXISTS consignment_returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_code VARCHAR(50) UNIQUE NOT NULL,
    lot_id UUID NOT NULL REFERENCES consignment_lots(id) ON DELETE RESTRICT,
    lot_item_id UUID NOT NULL REFERENCES consignment_lot_items(id) ON DELETE RESTRICT,
    returned_quantity INT NOT NULL CHECK (returned_quantity > 0),
    return_date DATE NOT NULL,
    recipient_name VARCHAR(150),
    proof_notes TEXT,
    created_by UUID NOT NULL REFERENCES members(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consignment_returns_lot ON consignment_returns(lot_id);

-- 6. BẢNG QUYẾT TOÁN LÔ SÁCH (CONSIGNMENT SETTLEMENTS)
-- Lưu snapshot tổng kết: Doanh thu, Tiền nợ nhà sách, Chênh lệch gộp, Cọc kỳ vọng hoàn trả
CREATE TABLE IF NOT EXISTS consignment_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    settlement_code VARCHAR(50) UNIQUE NOT NULL,
    lot_id UUID NOT NULL REFERENCES consignment_lots(id) ON DELETE RESTRICT,
    settlement_date DATE NOT NULL,
    total_sold_books INT NOT NULL CHECK (total_sold_books >= 0),
    total_returned_books INT NOT NULL CHECK (total_returned_books >= 0),
    total_retained_books INT NOT NULL DEFAULT 0 CHECK (total_retained_books >= 0),
    total_revenue BIGINT NOT NULL CHECK (total_revenue >= 0),
    payable_to_supplier BIGINT NOT NULL CHECK (payable_to_supplier >= 0),
    gross_profit BIGINT NOT NULL,
    deposit_paid BIGINT NOT NULL DEFAULT 0 CHECK (deposit_paid >= 0),
    deposit_refund_expected BIGINT NOT NULL DEFAULT 0 CHECK (deposit_refund_expected >= 0),
    paid_to_supplier BIGINT NOT NULL DEFAULT 0 CHECK (paid_to_supplier >= 0),
    payment_status VARCHAR(30) NOT NULL DEFAULT 'UNPAID' CHECK (payment_status IN ('UNPAID', 'PARTIALLY_PAID', 'PAID')),
    deposit_refund_status VARCHAR(30) NOT NULL DEFAULT 'NONE' CHECK (deposit_refund_status IN ('NONE', 'PENDING', 'RECEIVED')),
    deposit_refund_received BIGINT NOT NULL DEFAULT 0 CHECK (deposit_refund_received >= 0),
    idempotency_key VARCHAR(128) UNIQUE NULL,
    settled_by UUID NOT NULL REFERENCES members(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consignment_settlements_lot ON consignment_settlements(lot_id);

-- Đảm bảo tính duy nhất của quyết toán cho mỗi lô sách (RF-03, P22-04)
DO $$
BEGIN
  IF EXISTS (
    SELECT lot_id FROM consignment_settlements GROUP BY lot_id HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'DUPLICATE_LOT_SETTLEMENTS_DETECTED: Phat hien lo sach co nhieu quyet toan, can doi soat thu cong.';
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS uq_consignment_settlements_lot ON consignment_settlements(lot_id);

-- 7. BẢNG GIAO DỊCH THANH TOÁN TIỀN NHÀ SÁCH & HOÀN CỌC (SUPPLIER PAYMENTS)
-- Hai loại giao dịch độc lập: trả tiền sách bán và nhận hoàn cọc riêng, không cấn trừ ròng
CREATE TABLE IF NOT EXISTS supplier_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_code VARCHAR(50) UNIQUE NOT NULL,
    settlement_id UUID NOT NULL REFERENCES consignment_settlements(id) ON DELETE RESTRICT,
    payment_type VARCHAR(30) NOT NULL CHECK (payment_type IN ('PAY_SUPPLIER_PAYABLE', 'RECEIVE_DEPOSIT_REFUND')),
    amount BIGINT NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('CASH', 'BANK_TRANSFER')),
    confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_by UUID NOT NULL REFERENCES members(id),
    reference_doc VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplier_payments_settlement ON supplier_payments(settlement_id);
