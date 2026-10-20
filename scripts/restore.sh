#!/usr/bin/env bash
# ==============================================================================
# YSBK PostgreSQL Restore Script (POSIX Bash for Linux / Docker / CI)
# RTO Target: <= 4 hours
# Security: Does NOT store credentials in script. Uses DATABASE_URL env var.
# ==============================================================================

set -euo pipefail

BACKUP_FILE="${1:-}"
DB_URL="${RESTORE_TARGET_DATABASE_URL:-${TARGET_DATABASE_URL:-${TEST_DATABASE_URL:-}}}"

if [ -z "$BACKUP_FILE" ]; then
    echo "[RESTORE_ERROR] Usage: $0 <path-to-backup.sql>" >&2
    exit 1
fi

if [ -z "$DB_URL" ]; then
    if [ "${ALLOW_PRODUCTION_RESTORE:-false}" = "true" ]; then
        DB_URL="${DATABASE_URL:-}"
    else
        echo "[RESTORE_ERROR] Target disposable DB URL not set (RESTORE_TARGET_DATABASE_URL / TARGET_DATABASE_URL / TEST_DATABASE_URL). Refusing to restore to DATABASE_URL without ALLOW_PRODUCTION_RESTORE=true." >&2
        exit 1
    fi
fi

if [ -z "$DB_URL" ]; then
    echo "[RESTORE_ERROR] Target database URL is required." >&2
    exit 1
fi

# Disposable target guard
if [ "${ALLOW_PRODUCTION_RESTORE:-false}" != "true" ]; then
    if ! [[ "$DB_URL" =~ ^postgres(ql)?://([^/?#@]*@)?(localhost|127\.0\.0\.1|\[::1\]|test-postgres)(:[0-9]+)?/ysbk_test_[A-Za-z0-9_]+$ ]]; then
            echo "[RESTORE_ERROR] Target DB is not recognized as disposable/test. Aborting restore to protect production data." >&2
            exit 1
    fi
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "[RESTORE_ERROR] Backup file not found: $BACKUP_FILE" >&2
    exit 1
fi

if [ ! -s "$BACKUP_FILE" ]; then
    echo "[RESTORE_ERROR] Backup file is empty: $BACKUP_FILE" >&2
    exit 1
fi

# psql is mandatory; fail-closed if missing (P22-11)
if ! command -v psql >/dev/null 2>&1; then
    echo "[RESTORE_ERROR] psql utility not found on PATH. Restore aborted." >&2
    exit 1
fi

echo "=========================================================="
echo " STARTING YSBK DATABASE RESTORE"
echo " Source: $BACKUP_FILE"
echo " Target RTO: <= 4 hours"
echo "=========================================================="

echo "[1/2] Restoring SQL dump into target database (ON_ERROR_STOP=1)..."
EXISTING_TABLES=$(psql -X -v ON_ERROR_STOP=1 "$DB_URL" -t -A -c "SELECT COUNT(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname NOT IN ('pg_catalog', 'information_schema') AND n.nspname NOT LIKE 'pg_toast%' AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f');")
if ! [[ "$EXISTING_TABLES" =~ ^[0-9]+$ ]] || [ "$EXISTING_TABLES" -ne 0 ]; then
    echo "[RESTORE_ERROR] Target must be empty before restore." >&2
    exit 1
fi
psql -v ON_ERROR_STOP=1 "$DB_URL" -f "$BACKUP_FILE"

echo "[2/3] Running post-restore table count verification..."
TABLE_COUNT=$(psql -v ON_ERROR_STOP=1 "$DB_URL" -t -A -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")

# Fail-closed if TABLE_COUNT is not a positive integer
if ! [[ "$TABLE_COUNT" =~ ^[0-9]+$ ]]; then
    echo "[RESTORE_ERROR] Failed to parse table count: '$TABLE_COUNT'. Restore failed." >&2
    exit 1
fi

if [ "$TABLE_COUNT" -lt 5 ]; then
    echo "[RESTORE_ERROR] Restored table count too low ($TABLE_COUNT tables < 5). Restore failed." >&2
    exit 1
fi
echo "Post-restore verified table count: $TABLE_COUNT"

echo "[3/3] Running semantic and balance checks..."
CORE_TABLE_COUNT=$(psql -v ON_ERROR_STOP=1 "$DB_URL" -t -A -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('book_titles', 'book_editions', 'book_copies', 'borrowers', 'loan_receipts', 'journal_entries', 'members', 'cash_sessions');")

if ! [[ "$CORE_TABLE_COUNT" =~ ^[0-9]+$ ]] || [ "$CORE_TABLE_COUNT" -ne 8 ]; then
    echo "[RESTORE_ERROR] Core business tables missing after restore ($CORE_TABLE_COUNT/8 found). Restore failed." >&2
    exit 1
fi

LEDGER_BALANCE=$(psql -v ON_ERROR_STOP=1 "$DB_URL" -t -A -c "SELECT COUNT(*) FROM journal_entries WHERE amount IS NULL OR amount <= 0 OR debit_account IS NULL OR credit_account IS NULL OR debit_account = credit_account;")
if ! [[ "$LEDGER_BALANCE" =~ ^[0-9]+$ ]] || [ "$LEDGER_BALANCE" -ne 0 ]; then
    echo "[RESTORE_ERROR] Ledger out of balance after restore (diff: $LEDGER_BALANCE VND). Data integrity compromised." >&2
    exit 1
fi
echo "=========================================================="
echo " RESTORE PROCEDURE COMPLETE AND VERIFIED"
echo "=========================================================="
exit 0
