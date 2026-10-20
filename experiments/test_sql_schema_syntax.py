"""
YSBK Technical PoC Test Suite: PostgreSQL Schema Integrity & Static Analysis
Kiểm tra cấu trúc và tính nhất quán của 01_schema.sql và 02_seed.sql:
- Toàn vẹn khóa ngoại (Foreign Keys phải trỏ đến các bảng thực tế)
- Triggers kiểm tra ràng buộc nghiệp vụ (tối đa 2 cuốn / phiếu)
- Các chỉ mục Partial Unique Index (chỉ 1 lượt mượn active / bản sách)
- Khớp nối bảng giữa DDL và Seed Data
"""

import re
import unittest
from pathlib import Path

class TestSQLSchemaIntegrity(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        schema_path = Path("docs/technical/schema/01_schema.sql")
        seed_path = Path("docs/technical/schema/02_seed.sql")
        
        with open(schema_path, "r", encoding="utf-8") as f:
            cls.schema_sql = f.read()
        with open(seed_path, "r", encoding="utf-8") as f:
            cls.seed_sql = f.read()

        # Trích xuất danh sách bảng được định nghĩa trong schema
        cls.created_tables = set(re.findall(r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z_][a-zA-Z0-9_]*)", cls.schema_sql, re.IGNORECASE))
        # Trích xuất danh sách ENUM types
        cls.created_enums = set(re.findall(r"CREATE\s+TYPE\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+AS\s+ENUM", cls.schema_sql, re.IGNORECASE))

    def test_01_core_tables_exist(self):
        """Kiem chung day du cac bang du lieu cho 9 nhom chuc nang FR-01..FR-09."""
        expected_tables = {
            "book_titles", "authors", "categories", "book_editions", "book_copies",
            "members", "borrowers", "loan_receipts", "loan_items", "funds",
            "cash_sessions", "journal_entries", "duty_shifts", "duty_assignments",
            "recruitment_drives", "candidates", "candidate_scores", "score_audit_logs",
            "bookstore_lots", "activities", "activity_participants", "book_reviews",
            "system_audit_logs", "idempotency_records", "deposit_allocations",
            "refund_intents", "revoked_tokens"
        }
        missing = expected_tables - self.created_tables
        self.assertEqual(len(missing), 0, f"Thieu cac bang quan trong: {missing}")

    def test_02_foreign_key_references_valid_tables(self):
        """Kiem tra tat ca cac khoa ngoai REFERENCES deu tro den bang hop le."""
        fk_matches = re.findall(r"REFERENCES\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(", self.schema_sql, re.IGNORECASE)
        for target_table in fk_matches:
            self.assertIn(target_table, self.created_tables, f"Khoa ngoai tro den bang khong ton tai: '{target_table}'")

    def test_03_trigger_max_two_books_enforced(self):
        """Kiem chung trigger kiem tra toi da 2 cuon / phieu muon."""
        self.assertIn("trg_check_max_loan_items", self.schema_sql)
        self.assertIn("check_max_loan_items", self.schema_sql)
        self.assertIn("COUNT(*)", self.schema_sql)
        self.assertIn(">= 2", self.schema_sql)

    def test_04_partial_unique_index_single_active_loan(self):
        """Kiem chung partial unique index chi 1 luot muon active."""
        self.assertIn("idx_unique_active_copy_loan", self.schema_sql)
        self.assertIn("WHERE returned_at IS NULL AND is_lost = FALSE", self.schema_sql)

    def test_05_seed_data_targets_existing_tables(self):
        """Kiem chung toan bo cau lenh INSERT INTO trong 02_seed.sql deu nham vao bang hop le."""
        seed_tables = set(re.findall(r"INSERT\s+INTO\s+([a-zA-Z_][a-zA-Z0-9_]*)", self.seed_sql, re.IGNORECASE))
        missing_tables = seed_tables - self.created_tables
        self.assertEqual(len(missing_tables), 0, f"Seed data tro vao bang chua co trong schema: {missing_tables}")

    def test_06_double_entry_fund_integrity(self):
        """Kiem chung cau truc bang journal_entries co day du debit_account, credit_account va amount BIGINT."""
        self.assertIn("debit_account VARCHAR", self.schema_sql)
        self.assertIn("credit_account VARCHAR", self.schema_sql)
        self.assertIn("amount BIGINT NOT NULL CHECK (amount > 0)", self.schema_sql)

if __name__ == "__main__":
    unittest.main()
