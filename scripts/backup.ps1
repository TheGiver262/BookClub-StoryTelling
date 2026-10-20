# ==============================================================================
# YSBK PostgreSQL Backup Script (PowerShell for Windows)
# Mục đích: Sao lưu logic toàn bộ CSDL PostgreSQL (Schema, Dữ liệu, Triggers, Indexes)
# RPO mục tiêu: <= 24 giờ.
# Bảo mật: Tuyệt đối KHÔNG hardcode mật khẩu hay credentials vào script.
# Sử dụng biến môi trường DATABASE_URL hoặc tham số -DbUrl.
# ==============================================================================

param (
    [string]$OutputDir = "./backups",
    [string]$DbUrl = $env:DATABASE_URL
)

$ErrorActionPreference = "Stop"

if (-not $DbUrl) {
    Write-Error "[BACKUP_ERROR] Biến môi trường DATABASE_URL chưa được thiết lập. Vui lòng cung cấp URL kết nối hoặc đặt biến DATABASE_URL."
    exit 1
}

# Kiểm tra pg_dump có sẵn trên PATH không - BẮT BUỘC, KHÔNG GIẢ ĐỊNH (P22-11)
$PgDumpPath = Get-Command "pg_dump" -ErrorAction SilentlyContinue
if (-not $PgDumpPath) {
    Write-Error "[BACKUP_ERROR] Lệnh pg_dump chưa được cài đặt trên PATH. Thao tác sao lưu bị hủy."
    exit 1
}

# Tạo thư mục lưu trữ backup nếu chưa có
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$Timestamp = (Get-Date).ToString("yyyyMMdd_HHmmss")
$OutputFile = Join-Path $OutputDir "ysbk_backup_$Timestamp.sql"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " BẮT ĐẦU QUY TRÌNH SAO LƯU CSDL YSBK (POSTGRESQL)" -ForegroundColor Cyan
Write-Host " Thời điểm: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host " Tệp đích: $OutputFile"
Write-Host "==========================================================" -ForegroundColor Cyan

Write-Host "[1/2] Đang thực thi lệnh pg_dump..." -ForegroundColor Yellow
# Trích xuất dạng plain text SQL có format utf-8, bao gồm clean drop & recreate
& pg_dump --dbname=$DbUrl --format=plain --no-owner --no-acl --file=$OutputFile
if ($LASTEXITCODE -ne 0) {
    Write-Error "[BACKUP_ERROR] pg_dump thất bại với mã lỗi $LASTEXITCODE."
    exit $LASTEXITCODE
}

Write-Host "[2/2] Kiểm tra an toàn và tính toàn vẹn tệp sao lưu..." -ForegroundColor Yellow
if (-not (Test-Path $OutputFile)) {
    Write-Error "[BACKUP_ERROR] Tệp sao lưu không được tạo: $OutputFile"
    exit 1
}

$FileItem = Get-Item $OutputFile
if ($FileItem.Length -eq 0) {
    Write-Error "[BACKUP_ERROR] Tệp sao lưu bị rỗng (0 bytes). Sao lưu thất bại."
    Remove-Item -Path $OutputFile -Force
    exit 1
}

$SizeKb = [math]::Round($FileItem.Length / 1KB, 2)
Write-Host "Kích thước tệp: $SizeKb KB" -ForegroundColor Green

# Quét kiểm tra tệp backup không chứa secret môi trường rò rỉ
$SensitivePatterns = @("JWT_SECRET=", "SUPABASE_SERVICE_ROLE_KEY=", "RECRUITMENT_WEBHOOK_SECRET=")
$FileContent = Get-Content -Path $OutputFile -Raw
foreach ($pat in $SensitivePatterns) {
    if ($FileContent.Contains($pat)) {
        Write-Error "[SECURITY_ALERT] Tệp sao lưu chứa biến môi trường nhạy cảm '$pat'! Hủy tệp và dừng lại."
        Remove-Item -Path $OutputFile -Force
        exit 1
    }
}

Write-Host "==========================================================" -ForegroundColor Green
Write-Host " SAO LƯU THÀNH CÔNG VÀ ĐÃ KIỂM TRA BẢO MẬT: $OutputFile" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
exit 0
