# ==============================================================================
# YSBK PostgreSQL Restore Script (PowerShell for Windows)
# Mục đích: Khôi phục CSDL từ tệp sao lưu (.sql) vào môi trường sạch
# RTO mục tiêu: <= 4 giờ.
# Bảo mật: Không hardcode credentials. Sử dụng DATABASE_URL.
# ==============================================================================

param (
    [Parameter(Mandatory=$true)]
    [string]$BackupFile,
    [string]$DbUrl = $env:RESTORE_TARGET_DATABASE_URL,
    [switch]$DisposableOnly = $true
)

$ErrorActionPreference = "Stop"

# Nếu không truyền $DbUrl hoặc RESTORE_TARGET_DATABASE_URL, kiểm tra TARGET_DATABASE_URL hoặc TEST_DATABASE_URL
if (-not $DbUrl) {
    $DbUrl = $env:TARGET_DATABASE_URL
}
if (-not $DbUrl) {
    $DbUrl = $env:TEST_DATABASE_URL
}
# Chặn tự động dùng DATABASE_URL sản xuất khi chưa được phê duyệt rõ ràng
if (-not $DbUrl) {
    if ($env:ALLOW_PRODUCTION_RESTORE -eq "true") {
        $DbUrl = $env:DATABASE_URL
    } else {
        Write-Error "[RESTORE_ERROR] Không tìm thấy target DB dùng một lần (RESTORE_TARGET_DATABASE_URL / TARGET_DATABASE_URL / TEST_DATABASE_URL). Tự động dùng DATABASE_URL bị chặn để bảo vệ dữ liệu sản xuất. Đặt ALLOW_PRODUCTION_RESTORE=true nếu thực sự muốn ghi đè."
        exit 1
    }
}

if (-not $DbUrl) {
    Write-Error "[RESTORE_ERROR] Biến môi trường target database chưa được thiết lập."
    exit 1
}

# Cổng bảo vệ DB dùng một lần (Disposable Database Guard)
if ($DisposableOnly -and ($env:ALLOW_PRODUCTION_RESTORE -ne "true")) {
    $targetUri = $null
    $isDisposable = [Uri]::TryCreate($DbUrl, [UriKind]::Absolute, [ref]$targetUri) -and
        $targetUri.Scheme -in @('postgres', 'postgresql') -and
        ($targetUri.Host -replace '^\[|\]$', '') -in @('localhost', '127.0.0.1', '::1', 'test-postgres') -and
        $targetUri.AbsolutePath -match '^/ysbk_test_[A-Za-z0-9_]+$' -and
        -not $targetUri.Query -and -not $targetUri.Fragment
    if (-not $isDisposable) {
        Write-Error "[RESTORE_ERROR] Cổng bảo vệ DB dùng một lần kích hoạt: Target DB không phải localhost/test/temp/disposable. Thao tác khôi phục bị từ chối."
        exit 1
    }
}

if (-not (Test-Path $BackupFile)) {
    Write-Error "[RESTORE_ERROR] Không tìm thấy tệp sao lưu tại đường dẫn: '$BackupFile'."
    exit 1
}

$BackupItem = Get-Item $BackupFile
if ($BackupItem.Length -eq 0) {
    Write-Error "[RESTORE_ERROR] Tệp sao lưu bị rỗng (0 bytes). Khôi phục bị hủy."
    exit 1
}

# Kiểm tra psql có sẵn trên PATH không - BẮT BUỘC, KHÔNG GIẢ ĐỊNH (P22-11)
$PsqlPath = Get-Command "psql" -ErrorAction SilentlyContinue
if (-not $PsqlPath) {
    Write-Error "[RESTORE_ERROR] Lệnh psql chưa được cài đặt trên PATH. Thao tác khôi phục bị hủy."
    exit 1
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " BẮT ĐẦU QUY TRÌNH PHỤC HỒI CSDL YSBK (RESTORE)" -ForegroundColor Cyan
Write-Host " Thời điểm: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host " Nguồn: $BackupFile"
Write-Host " RTO Mục Tiêu: <= 4 giờ"
Write-Host "==========================================================" -ForegroundColor Cyan

Write-Host "[1/2] Đang nạp tệp sao lưu vào database qua psql (ON_ERROR_STOP=1)..." -ForegroundColor Yellow
$ExistingTables = & psql -X -v ON_ERROR_STOP=1 --dbname=$DbUrl -t -A -c "SELECT COUNT(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname NOT IN ('pg_catalog', 'information_schema') AND n.nspname NOT LIKE 'pg_toast%' AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f');"
$existingCount = 0
if ($LASTEXITCODE -ne 0 -or -not [int]::TryParse(($ExistingTables -join '').Trim(), [ref]$existingCount) -or $existingCount -ne 0) {
    Write-Error "[RESTORE_ERROR] Target phải sạch, không có bảng hoặc dữ liệu sẵn có. Dừng trước khi nạp SQL."
    exit 1
}
# Bắt buộc ON_ERROR_STOP=1 để dừng ngay lập tức khi gặp bất kỳ câu lệnh SQL lỗi nào (P22-11)
& psql -v ON_ERROR_STOP=1 --dbname=$DbUrl -f $BackupFile
if ($LASTEXITCODE -ne 0) {
    Write-Error "[RESTORE_ERROR] psql khôi phục thất bại với mã lỗi $LASTEXITCODE."
    exit $LASTEXITCODE
}

Write-Host "[2/3] Đối soát cấu trúc bảng sau khôi phục..." -ForegroundColor Yellow
$CheckSql = "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"
$tableCountOutput = & psql -v ON_ERROR_STOP=1 --dbname=$DbUrl -t -A -c $CheckSql
if ($LASTEXITCODE -ne 0) {
    Write-Error "[RESTORE_ERROR] Đối soát số lượng bảng thất bại với mã lỗi $LASTEXITCODE."
    exit $LASTEXITCODE
}

$tableCount = 0
if (-not [int]::TryParse($tableCountOutput.Trim(), [ref]$tableCount)) {
    Write-Error "[RESTORE_ERROR] Không thể parse số lượng bảng sau khôi phục: '$tableCountOutput'. Khôi phục coi như thất bại."
    exit 1
}

if ($tableCount -lt 5) {
    Write-Error "[RESTORE_ERROR] Số lượng bảng sau khôi phục quá ít ($tableCount bảng < 5). Khôi phục không toàn vẹn."
    exit 1
}
Write-Host "Số lượng bảng sau phục hồi: $tableCount bảng." -ForegroundColor Green

Write-Host "[3/3] Đối soát nghiệp vụ và số dư tài chính (Semantic & Balance Check)..." -ForegroundColor Yellow
$CoreTablesSql = "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('book_titles', 'book_editions', 'book_copies', 'borrowers', 'loan_receipts', 'journal_entries', 'members', 'cash_sessions');"
$coreCountOutput = & psql -v ON_ERROR_STOP=1 --dbname=$DbUrl -t -A -c $CoreTablesSql
if ($LASTEXITCODE -ne 0) {
    Write-Error "[RESTORE_ERROR] Đối soát bảng nghiệp vụ cốt lõi thất bại."
    exit 1
}
$coreCount = 0
if (-not [int]::TryParse($coreCountOutput.Trim(), [ref]$coreCount) -or $coreCount -ne 8) {
    Write-Error "[RESTORE_ERROR] Thiếu bảng nghiệp vụ cốt lõi sau khôi phục (chỉ có $coreCount/8 bảng cốt lõi)."
    exit 1
}

# Each journal row stores one amount shared by its debit and credit accounts.
$LedgerSql = "SELECT COUNT(*) FROM journal_entries WHERE amount IS NULL OR amount <= 0 OR debit_account IS NULL OR credit_account IS NULL OR debit_account = credit_account;"
$ledgerBalanceOutput = & psql -v ON_ERROR_STOP=1 --dbname=$DbUrl -t -A -c $LedgerSql
if ($LASTEXITCODE -eq 0 -and $ledgerBalanceOutput) {
    $balanceDiff = 0
    if ([long]::TryParse($ledgerBalanceOutput.Trim(), [ref]$balanceDiff)) {
        if ($balanceDiff -ne 0) {
            Write-Error "[RESTORE_ERROR] Sổ cái mất cân đối Nợ - Có sau khôi phục (Chênh lệch: $balanceDiff VND). Dữ liệu bị sai lệch."
            exit 1
        }
        Write-Host "Các bút toán có số tiền và hai tài khoản Nợ/Có hợp lệ." -ForegroundColor Green
    } else {
        Write-Error "[RESTORE_ERROR] Không thể parse kết quả kiểm tra journal_entries."
        exit 1
    }
} else {
    Write-Error "[RESTORE_ERROR] Không thể kiểm tra journal_entries sau restore."
    exit 1
}

Write-Host "==========================================================" -ForegroundColor Green
Write-Host " KHÔI PHỤC CSDL HOÀN TẤT VÀ ĐÃ ĐỐI SOÁT KIỂM TRA THÀNH CÔNG" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
exit 0
