#!/usr/bin/env bash
# ==============================================================================
# YSBK PostgreSQL Backup Script (POSIX Bash for Linux / Docker / CI)
# RPO Target: <= 24 hours
# Security: Does NOT store credentials in script. Uses DATABASE_URL env var.
# ==============================================================================

set -euo pipefail

OUTPUT_DIR="${1:-./backups}"
DB_URL="${DATABASE_URL:-}"

if [ -z "$DB_URL" ]; then
    echo "[BACKUP_ERROR] DATABASE_URL environment variable is required." >&2
    exit 1
fi

# pg_dump is mandatory; fail-closed if missing (P22-11)
if ! command -v pg_dump >/dev/null 2>&1; then
    echo "[BACKUP_ERROR] pg_dump utility not installed on PATH. Backup aborted." >&2
    exit 1
fi

mkdir -p "$OUTPUT_DIR"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
OUTPUT_FILE="$OUTPUT_DIR/ysbk_backup_$TIMESTAMP.sql"

echo "=========================================================="
echo " STARTING YSBK DATABASE BACKUP"
echo " Timestamp: $(date)"
echo " Output: $OUTPUT_FILE"
echo "=========================================================="

echo "[1/2] Executing pg_dump..."
pg_dump --dbname="$DB_URL" --format=plain --no-owner --no-acl --file="$OUTPUT_FILE"

echo "[2/2] Validating backup integrity and security..."
if [ ! -s "$OUTPUT_FILE" ]; then
    echo "[BACKUP_ERROR] Backup file is empty or was not created: $OUTPUT_FILE" >&2
    rm -f "$OUTPUT_FILE"
    exit 1
fi

if grep -qE "JWT_SECRET=|SUPABASE_SERVICE_ROLE_KEY=|RECRUITMENT_WEBHOOK_SECRET=" "$OUTPUT_FILE" 2>/dev/null; then
    echo "[SECURITY_ALERT] Sensitive environment variables found in backup file!" >&2
    rm -f "$OUTPUT_FILE"
    exit 1
fi

echo "=========================================================="
echo " BACKUP SUCCESSFUL: $OUTPUT_FILE"
echo "=========================================================="
exit 0
