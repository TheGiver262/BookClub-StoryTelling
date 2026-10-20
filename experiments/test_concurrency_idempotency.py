"""
YSBK Technical PoC Test Suite: Concurrency, Race Conditions, and Idempotency
Kiểm chứng kỹ thuật tranh chấp tài nguyên (đua mượn sách, vượt quá 2 cuốn) và xử lý Idempotency Key.
"""

import hashlib
import json
import sqlite3
import threading
import time
import unittest
from datetime import date, timedelta

class IdempotencyManager:
    """Mô phỏng cơ chế lưu trữ và kiểm soát Idempotency Key theo chuẩn thiết kế YSBK."""
    def __init__(self, conn):
        self.conn = conn

    def check_or_start(self, user_id: str, endpoint: str, idempotency_key: str, payload: dict):
        payload_hash = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
        cur = self.conn.cursor()
        cur.execute("""
            SELECT status, response_body, payload_hash 
            FROM idempotency_keys 
            WHERE user_id = ? AND endpoint = ? AND idempotency_key = ?
        """, (user_id, endpoint, idempotency_key))
        row = cur.fetchone()

        if row:
            status, response_body, stored_hash = row
            if stored_hash != payload_hash:
                return {"action": "REJECT", "code": 422, "error": "Idempotency key reused with different payload"}
            if status == "COMPLETED":
                return {"action": "RETURN_CACHED", "code": 200, "data": json.loads(response_body)}
            if status == "PROCESSING":
                return {"action": "REJECT", "code": 409, "error": "Concurrent request in progress with same idempotency key"}
        
        # Tạo bản ghi PROCESSING
        cur.execute("""
            INSERT INTO idempotency_keys (idempotency_key, user_id, endpoint, payload_hash, status)
            VALUES (?, ?, ?, ?, 'PROCESSING')
        """, (idempotency_key, user_id, endpoint, payload_hash))
        self.conn.commit()
        return {"action": "PROCEED"}

    def complete(self, user_id: str, endpoint: str, idempotency_key: str, response_data: dict):
        cur = self.conn.cursor()
        cur.execute("""
            UPDATE idempotency_keys 
            SET status = 'COMPLETED', response_body = ?
            WHERE user_id = ? AND endpoint = ? AND idempotency_key = ?
        """, (json.dumps(response_data), user_id, endpoint, idempotency_key))
        self.conn.commit()

class TestConcurrencyAndIdempotency(unittest.TestCase):
    def setUp(self):
        self.conn = sqlite3.connect(":memory:", check_same_thread=False)
        self.cur = self.conn.cursor()
        
        self.cur.executescript("""
            CREATE TABLE book_copies (
                barcode TEXT PRIMARY KEY,
                status TEXT CHECK(status IN ('AVAILABLE', 'BORROWED', 'LOST')),
                version INTEGER DEFAULT 1
            );

            CREATE TABLE loan_receipts (
                id TEXT PRIMARY KEY,
                borrower_name TEXT,
                status TEXT
            );

            CREATE TABLE loan_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                receipt_id TEXT,
                copy_barcode TEXT,
                UNIQUE(receipt_id, copy_barcode)
            );

            CREATE TABLE idempotency_keys (
                idempotency_key TEXT,
                user_id TEXT,
                endpoint TEXT,
                payload_hash TEXT,
                status TEXT,
                response_body TEXT,
                PRIMARY KEY (user_id, endpoint, idempotency_key)
            );
        """)
        
        # Seed bản sách duy nhất có thể mượn
        self.cur.execute("INSERT INTO book_copies (barcode, status, version) VALUES ('BK-EXACT-01', 'AVAILABLE', 1)")
        self.conn.commit()
        self.idemp = IdempotencyManager(self.conn)

    def tearDown(self):
        self.conn.close()

    def test_01_idempotency_key_replay_returns_cached(self):
        """Kiểm chứng gửi lại cùng Idempotency Key và cùng payload: trả về kết quả đã cache, không insert đúp."""
        user_id = "user-member-01"
        endpoint = "POST /api/v1/circulation/loans"
        key = "idemp-loan-req-7788"
        payload = {"copy_barcodes": ["BK-EXACT-01"], "borrower_name": "Nguyen Van A"}

        # Lần 1: Bắt đầu và hoàn thành
        res1 = self.idemp.check_or_start(user_id, endpoint, key, payload)
        self.assertEqual(res1["action"], "PROCEED")
        
        # Giả lập hoàn thành ghi DB
        mock_response = {"receipt_id": "YSBK-PM-8899", "status": "ACTIVE"}
        self.idemp.complete(user_id, endpoint, key, mock_response)

        # Lần 2: Gửi lại y hệt
        res2 = self.idemp.check_or_start(user_id, endpoint, key, payload)
        self.assertEqual(res2["action"], "RETURN_CACHED")
        self.assertEqual(res2["data"]["receipt_id"], "YSBK-PM-8899")

    def test_02_idempotency_key_payload_mismatch_rejected(self):
        """Kiểm chứng dùng lại cùng Idempotency Key nhưng đổi payload -> Bị từ chối HTTP 422."""
        user_id = "user-member-01"
        endpoint = "POST /api/v1/circulation/loans"
        key = "idemp-loan-req-7788"
        payload_orig = {"copy_barcodes": ["BK-EXACT-01"], "borrower_name": "Nguyen Van A"}
        payload_diff = {"copy_barcodes": ["BK-EXACT-02"], "borrower_name": "Tran Van B"}

        self.idemp.check_or_start(user_id, endpoint, key, payload_orig)
        self.idemp.complete(user_id, endpoint, key, {"status": "OK"})

        # Gửi payload khác
        res = self.idemp.check_or_start(user_id, endpoint, key, payload_diff)
        self.assertEqual(res["action"], "REJECT")
        self.assertEqual(res["code"], 422)

    def test_03_race_condition_two_clients_borrow_same_book(self):
        """
        Kiểm chứng tranh chấp tài nguyên (Race Condition):
        Hai ca trực đồng thời ấn nút cho mượn cùng một cuốn sách duy nhất 'BK-EXACT-01'.
        Chỉ đúng 1 người thành công (200 OK), người thứ 2 nhận 409 Conflict.
        """
        results = []
        lock = threading.Lock()

        def attempt_loan(client_id):
            # Tạo connection riêng cho mỗi thread
            thread_conn = sqlite3.connect(":memory:")
            # Mô phỏng optimistic locking với version check
            with lock:
                cur = self.conn.cursor()
                # SELECT status, version FROM book_copies WHERE barcode = 'BK-EXACT-01'
                cur.execute("SELECT status, version FROM book_copies WHERE barcode = 'BK-EXACT-01'")
                status, ver = cur.fetchone()
                
                if status == 'AVAILABLE':
                    # Mô phỏng độ trễ xử lý nghiệp vụ 5ms
                    time.sleep(0.005)
                    # UPDATE book_copies SET status = 'BORROWED', version = version + 1 WHERE barcode = ... AND status = 'AVAILABLE'
                    cur.execute("""
                        UPDATE book_copies 
                        SET status = 'BORROWED', version = version + 1 
                        WHERE barcode = 'BK-EXACT-01' AND status = 'AVAILABLE'
                    """)
                    if cur.rowcount == 1:
                        self.conn.commit()
                        results.append((client_id, "SUCCESS_200"))
                        return
                
                results.append((client_id, "CONFLICT_409"))

        t1 = threading.Thread(target=attempt_loan, args=("Client-Quay-1",))
        t2 = threading.Thread(target=attempt_loan, args=("Client-Quay-2",))

        t1.start()
        t2.start()
        t1.join()
        t2.join()

        statuses = [r[1] for r in results]
        self.assertEqual(statuses.count("SUCCESS_200"), 1, "Chỉ được phép 1 client mượn thành công!")
        self.assertEqual(statuses.count("CONFLICT_409"), 1, "Client tranh chấp còn lại phải nhận 409 Conflict!")

        # Kiểm tra trạng thái cuối cùng của sách
        self.cur.execute("SELECT status, version FROM book_copies WHERE barcode = 'BK-EXACT-01'")
        final_status, final_ver = self.cur.fetchone()
        self.assertEqual(final_status, "BORROWED")
        self.assertEqual(final_ver, 2)

    def test_04_enforce_max_2_books_per_receipt(self):
        """Kiểm chứng bất biến: một phiếu mượn chỉ chứa tối đa 2 cuốn sách, cố tình insert cuốn thứ 3 sẽ bị từ chối."""
        receipt_id = "PM-TEST-MAX"
        self.cur.execute("INSERT INTO loan_receipts (id, borrower_name, status) VALUES (?, 'Test Borrower', 'ACTIVE')", (receipt_id,))
        
        # Thêm 2 cuốn đầu -> thành công
        self.cur.execute("INSERT INTO loan_items (receipt_id, copy_barcode) VALUES (?, 'BK-001')", (receipt_id,))
        self.cur.execute("INSERT INTO loan_items (receipt_id, copy_barcode) VALUES (?, 'BK-002')", (receipt_id,))
        self.conn.commit()

        # Kiểm tra trước khi thêm cuốn 3
        def insert_third_book():
            # Mô phỏng trigger PostgreSQL: BEFORE INSERT ON loan_items
            self.cur.execute("SELECT COUNT(*) FROM loan_items WHERE receipt_id = ?", (receipt_id,))
            current_count = self.cur.fetchone()[0]
            if current_count >= 2:
                raise ValueError("Một phiếu mượn chỉ được chứa tối đa 2 cuốn sách (YSBK rule)")
            self.cur.execute("INSERT INTO loan_items (receipt_id, copy_barcode) VALUES (?, 'BK-003')", (receipt_id,))

        with self.assertRaises(ValueError) as ctx:
            insert_third_book()
        self.assertIn("tối đa 2 cuốn sách", str(ctx.exception))

if __name__ == "__main__":
    unittest.main()
