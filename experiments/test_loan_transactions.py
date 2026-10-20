"""
YSBK Technical PoC Test Suite: Core Loan Transactions, Deposits, Fines, and Sổ Kép
Kiểm chứng kỹ thuật độc lập các quy tắc nghiệp vụ tài chính và bất biến giao dịch.
"""

import math
import sqlite3
import unittest
from datetime import date, timedelta

def calculate_deposit(cover_price):
    if cover_price is None or cover_price <= 0:
        return 50000  # Mặc định sách không giá cọc 50k
    return max(50000, math.floor((cover_price + 25000) / 50000) * 50000)

def calculate_fine(days_overdue):
    # Phạt 1.000 VND / ngày trên cả phiếu
    return max(0, days_overdue * 1000)

class TestYSBKCoreTransactions(unittest.TestCase):
    def setUp(self):
        # Thiết lập in-memory SQLite mô phỏng cơ sở dữ liệu quan hệ
        self.conn = sqlite3.connect(":memory:")
        self.cur = self.conn.cursor()
        
        # Tạo bảng mô phỏng
        self.cur.executescript("""
            CREATE TABLE book_copies (
                barcode TEXT PRIMARY KEY,
                status TEXT CHECK(status IN ('AVAILABLE', 'BORROWED', 'LOST')),
                cover_price INTEGER
            );
            
            CREATE TABLE loan_receipts (
                id TEXT PRIMARY KEY,
                borrower_name TEXT,
                borrow_date TEXT,
                due_date TEXT,
                renew_count INTEGER CHECK(renew_count BETWEEN 0 AND 3),
                status TEXT,
                preceding_receipt_id TEXT
            );
            
            CREATE TABLE loan_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                receipt_id TEXT,
                copy_barcode TEXT,
                deposit_snapshot INTEGER,
                returned_at TEXT,
                FOREIGN KEY (receipt_id) REFERENCES loan_receipts(id),
                FOREIGN KEY (copy_barcode) REFERENCES book_copies(barcode)
            );
            
            CREATE TABLE journal_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                fund_id TEXT,
                debit_account TEXT,
                credit_account TEXT,
                amount INTEGER
            );
        """)
        
        # Seed sách mẫu
        self.cur.executemany("""
            INSERT INTO book_copies (barcode, status, cover_price) VALUES (?, 'AVAILABLE', ?)
        """, [
            ('BK-00101', 74000),   # Giá 74k -> cọc 50k
            ('BK-00201', 75000),   # Giá 75k -> cọc 100k
            ('BK-00301', 230000),  # Giá 230k -> cọc 250k
            ('BK-00401', None),    # Không có giá -> cọc 50k
            ('BK-00501', 20000),   # Giá 20k -> cọc 50k
            ('BK-00601', 151000),  # Giá 151k -> cọc 150k
        ])
        self.conn.commit()

    def tearDown(self):
        self.conn.close()

    def test_01_deposit_calculation_formula(self):
        """Kiểm chứng công thức tính tiền cọc tự động qua mọi mốc giá đã phỏng vấn."""
        test_cases = [
            (20000, 50000),
            (51000, 50000),
            (74000, 50000),
            (75000, 100000),
            (100000, 100000),
            (151000, 150000),
            (230000, 250000),
            (None, 50000),  # Chưa có giá
            (0, 50000),
        ]
        for price, expected_deposit in test_cases:
            with self.subTest(price=price):
                actual = calculate_deposit(price)
                self.assertEqual(actual, expected_deposit, f"Sai tiền cọc cho giá {price}: mong đợi {expected_deposit}, nhận {actual}")

    def test_02_issue_loan_and_journal_entries(self):
        """Kiểm chứng lập phiếu mượn 2 cuốn: khóa sách, snapshot cọc và ghi bút toán Nợ/Có cân bằng."""
        borrow_date = date(2026, 10, 1)
        due_date = borrow_date + timedelta(days=14) # Đúng 14 ngày lịch -> 2026-10-15
        
        c1_price = 74000
        c2_price = 75000
        dep1 = calculate_deposit(c1_price) # 50k
        dep2 = calculate_deposit(c2_price) # 100k
        total_deposit = dep1 + dep2 # 150k
        
        # 1. Ghi phiếu mượn
        receipt_id = "YSBK-PM-001"
        self.cur.execute("""
            INSERT INTO loan_receipts (id, borrower_name, borrow_date, due_date, renew_count, status)
            VALUES (?, 'Trần Minh Quân', ?, ?, 0, 'ACTIVE')
        """, (receipt_id, str(borrow_date), str(due_date)))
        
        # 2. Ghi 2 dòng mượn
        self.cur.execute("""
            INSERT INTO loan_items (receipt_id, copy_barcode, deposit_snapshot) VALUES (?, 'BK-00101', ?)
        """, (receipt_id, dep1))
        self.cur.execute("""
            INSERT INTO loan_items (receipt_id, copy_barcode, deposit_snapshot) VALUES (?, 'BK-00201', ?)
        """, (receipt_id, dep2))
        
        # 3. Chuyển trạng thái sách
        self.cur.execute("UPDATE book_copies SET status = 'BORROWED' WHERE barcode IN ('BK-00101', 'BK-00201')")
        
        # 4. Ghi bút toán sổ kép vào Quỹ 1
        self.cur.execute("""
            INSERT INTO journal_entries (fund_id, debit_account, credit_account, amount)
            VALUES ('FUND_LOAN', 'TIEN_MAT_HOP', 'COC_PHAI_HOAN', ?)
        """, (total_deposit,))
        self.conn.commit()
        
        # Kiểm tra tính toàn vẹn
        self.assertEqual(due_date, date(2026, 10, 15))
        self.cur.execute("SELECT status FROM book_copies WHERE barcode = 'BK-00101'")
        self.assertEqual(self.cur.fetchone()[0], 'BORROWED')
        
        self.cur.execute("SELECT debit_account, credit_account, amount FROM journal_entries WHERE fund_id = 'FUND_LOAN'")
        row = self.cur.fetchone()
        self.assertEqual(row, ('TIEN_MAT_HOP', 'COC_PHAI_HOAN', 150000))

    def test_03_full_return_with_fine_settlement(self):
        """Kiểm chứng trả toàn bộ sách: phiếu 2 cuốn cọc 150k, quá hạn 3 ngày phạt 3k -> hoàn 150k và thu 3k riêng."""
        # Setup phiếu cũ
        self.test_02_issue_loan_and_journal_entries()
        
        days_overdue = 3
        fine = calculate_fine(days_overdue) # 3.000 ₫
        self.assertEqual(fine, 3000)
        
        # Thực hiện tất toán: hoàn cọc 150k riêng, thu phạt 3k riêng
        self.cur.execute("""
            INSERT INTO journal_entries (fund_id, debit_account, credit_account, amount)
            VALUES ('FUND_LOAN', 'COC_PHAI_HOAN', 'TIEN_MAT_HOP', 150000)
        """)
        self.cur.execute("""
            INSERT INTO journal_entries (fund_id, debit_account, credit_account, amount)
            VALUES ('FUND_LOAN', 'TIEN_MAT_HOP', 'THU_PHAT', 3000)
        """)
        
        self.cur.execute("UPDATE loan_receipts SET status = 'RETURNED' WHERE id = 'YSBK-PM-001'")
        self.cur.execute("UPDATE book_copies SET status = 'AVAILABLE' WHERE barcode IN ('BK-00101', 'BK-00201')")
        self.conn.commit()
        
        # Kiểm tra số dư sổ kép
        self.cur.execute("SELECT SUM(amount) FROM journal_entries WHERE debit_account = 'COC_PHAI_HOAN'")
        refunded = self.cur.fetchone()[0]
        self.assertEqual(refunded, 150000)
        
        self.cur.execute("SELECT SUM(amount) FROM journal_entries WHERE credit_account = 'THU_PHAT'")
        fine_collected = self.cur.fetchone()[0]
        self.assertEqual(fine_collected, 3000)

    def test_04_partial_return_carry_forward_loan(self):
        """Kiểm chứng trả 1 cuốn cọc 50k, giữ 1 cuốn cọc 100k: lập phiếu mới, reset 14 ngày, chuyển tiếp cọc 100k không tạo dòng tiền ảo."""
        self.test_02_issue_loan_and_journal_entries()
        
        # Trả cuốn 1 (BK-00101, cọc 50k)
        self.cur.execute("UPDATE loan_items SET returned_at = '2026-10-18 14:00' WHERE copy_barcode = 'BK-00101'")
        self.cur.execute("UPDATE book_copies SET status = 'AVAILABLE' WHERE barcode = 'BK-00101'")
        
        # Hoàn cọc 50k thực tế cho cuốn đã trả
        self.cur.execute("""
            INSERT INTO journal_entries (fund_id, debit_account, credit_account, amount)
            VALUES ('FUND_LOAN', 'COC_PHAI_HOAN', 'TIEN_MAT_HOP', 50000)
        """)
        
        # Đóng phiếu cũ
        self.cur.execute("UPDATE loan_receipts SET status = 'PARTIAL_SETTLED' WHERE id = 'YSBK-PM-001'")
        
        # Sinh phiếu chuyển tiếp mới cho cuốn 2 (BK-00201, cọc 100k)
        new_receipt_id = "YSBK-PM-002"
        new_borrow_date = date(2026, 10, 18)
        new_due_date = new_borrow_date + timedelta(days=14) # Reset lại 14 ngày
        
        self.cur.execute("""
            INSERT INTO loan_receipts (id, borrower_name, borrow_date, due_date, renew_count, status, preceding_receipt_id)
            VALUES (?, 'Trần Minh Quân', ?, ?, 0, 'ACTIVE', 'YSBK-PM-001')
        """, (new_receipt_id, str(new_borrow_date), str(new_due_date)))
        
        # Gán cuốn 2 sang phiếu mới với cọc snapshot 100k giữ nguyên
        self.cur.execute("""
            INSERT INTO loan_items (receipt_id, copy_barcode, deposit_snapshot) VALUES (?, 'BK-00201', 100000)
        """, (new_receipt_id,))
        self.conn.commit()
        
        # KIỂM CHỨNG BẤT BIẾN:
        # Không có bất kỳ bút toán Nợ/Có nào phát sinh thêm 100k vì tiền cọc 100k được chuyển liên kết!
        self.cur.execute("SELECT COUNT(*) FROM journal_entries WHERE amount = 100000")
        count_100k_entries = self.cur.fetchone()[0]
        self.assertEqual(count_100k_entries, 0, "Không được tạo bút toán thu/hoàn tiền giả 100k khi chuyển tiếp cọc!")
        
        # Kiểm tra phiếu mới đã reset số lần gia hạn về 0
        self.cur.execute("SELECT renew_count, status, preceding_receipt_id FROM loan_receipts WHERE id = 'YSBK-PM-002'")
        r_new = self.cur.fetchone()
        self.assertEqual(r_new, (0, 'ACTIVE', 'YSBK-PM-001'))

    def test_05_extreme_partial_return_where_fine_consumed_all_deposit(self):
        """
        Ngoại lệ đã xác nhận trong phỏng vấn:
        Tổng cọc 150k, phạt chạm trần 150k. Khách trả cuốn cọc 50k, giữ cuốn cọc 100k.
        -> Giữ toàn bộ 150k cũ cấn trừ phạt, thu mới 100k cọc cho phiếu mới.
        -> Tiền mặt quầy tăng đúng 100k (không tăng 250k).
        """
        self.test_02_issue_loan_and_journal_entries()
        
        # Giữ 150k cọc cũ để xử lý phạt
        self.cur.execute("""
            INSERT INTO journal_entries (fund_id, debit_account, credit_account, amount)
            VALUES ('FUND_LOAN', 'COC_PHAI_HOAN', 'THU_PHAT', 150000)
        """)
        
        # Thu mới 100k cọc cho phiếu chuyển tiếp vì cọc cũ đã dùng hết
        self.cur.execute("""
            INSERT INTO journal_entries (fund_id, debit_account, credit_account, amount)
            VALUES ('FUND_LOAN', 'TIEN_MAT_HOP', 'COC_PHAI_HOAN', 100000)
        """)
        self.conn.commit()
        
        # Kiểm tra biến động tiền mặt ròng:
        # Nhận ban đầu 150k, không hoàn gì, thu mới 100k -> Tổng tiền mặt nhận = 250k
        self.cur.execute("SELECT SUM(amount) FROM journal_entries WHERE debit_account = 'TIEN_MAT_HOP'")
        cash_in = self.cur.fetchone()[0]
        self.assertEqual(cash_in, 250000)
        
        # Nghĩa vụ cọc hiện tại còn lại đúng 100k
        self.cur.execute("""
            SELECT 
                (SELECT SUM(amount) FROM journal_entries WHERE credit_account = 'COC_PHAI_HOAN') -
                (SELECT SUM(amount) FROM journal_entries WHERE debit_account = 'COC_PHAI_HOAN')
        """)
        deposit_liability = self.cur.fetchone()[0]
        self.assertEqual(deposit_liability, 100000, "Nghĩa vụ cọc hiện tại phải bằng đúng 100k cọc mới!")

if __name__ == "__main__":
    unittest.main()
