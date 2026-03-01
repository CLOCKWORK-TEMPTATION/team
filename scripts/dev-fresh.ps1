# dodo.ps1
# يغلق العمليات المفتوحة، ينظف الكاش، ثم يشغل التطبيق

$ErrorActionPreference = "Stop"

Write-Host "=== إغلاق العمليات المفتوحة ===" -ForegroundColor Cyan

# إغلاق Vite (المنفذ 5173)
$vite = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
if ($vite) {
    foreach ($procId in $vite) {
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        Write-Host "  إغلاق Vite (PID: $procId)" -ForegroundColor Yellow
    }
} else {
    Write-Host "  لا يوجد Vite يعمل على المنفذ 5173" -ForegroundColor Gray
}

# إغلاق Electron
Get-Process -Name "electron" -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process -Name "Electron" -ErrorAction SilentlyContinue | Stop-Process -Force
Write-Host "  إغلاق Electron (إن وجد)" -ForegroundColor Yellow

Start-Sleep -Seconds 1

Write-Host "`n=== تنظيف الكاش ===" -ForegroundColor Cyan

# تنظيف كاش pnpm
Write-Host "  تنظيف pnpm store..." -ForegroundColor Yellow
pnpm store prune 2>$null

# تنظيف مجلدات الكاش في المشروع
$cachePaths = @(
    "node_modules/.cache",
    "apps/desktop/node_modules/.cache",
    "apps/desktop/src/renderer/node_modules/.cache",
    ".vite",
    "apps/desktop/.vite"
)

foreach ($path in $cachePaths) {
    $fullPath = Join-Path $PSScriptRoot ".." $path
    if (Test-Path $fullPath) {
        Remove-Item -Recurse -Force $fullPath
        Write-Host "  حذف: $path" -ForegroundColor Yellow
    }
}

Write-Host "`n=== تشغيل التطبيق ===" -ForegroundColor Green
Set-Location (Join-Path $PSScriptRoot "..")
pnpm dev
