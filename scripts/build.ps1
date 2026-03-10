# openClaw-mind 构建脚本 (Windows PowerShell)

Write-Host "🚀 openClaw-mind 构建脚本" -ForegroundColor Cyan
Write-Host ""

# 检查环境
Write-Host "📋 检查环境..." -ForegroundColor Yellow

# 检查 Node.js
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ 未找到 Node.js，请先安装" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Node.js: $(node --version)" -ForegroundColor Green

# 检查 pnpm
if (!(Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Host "❌ 未找到 pnpm，请先安装: npm install -g pnpm" -ForegroundColor Red
    exit 1
}
Write-Host "✅ pnpm: $(pnpm --version)" -ForegroundColor Green

# 检查 Rust
if (!(Get-Command cargo -ErrorAction SilentlyContinue)) {
    Write-Host "❌ 未找到 Rust，请先安装: https://rustup.rs/" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Rust: $(rustc --version)" -ForegroundColor Green

Write-Host ""

# 安装依赖
Write-Host "📦 安装依赖..." -ForegroundColor Yellow
pnpm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 依赖安装失败" -ForegroundColor Red
    exit 1
}
Write-Host "✅ 依赖安装完成" -ForegroundColor Green

Write-Host ""

# 构建
Write-Host "🔨 开始构建..." -ForegroundColor Yellow
pnpm tauri:build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 构建失败" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ 构建完成！" -ForegroundColor Green
Write-Host ""

# 显示构建产物
Write-Host "📦 构建产物:" -ForegroundColor Cyan
$bundlePath = "src-tauri\target\release\bundle"
if (Test-Path $bundlePath) {
    Get-ChildItem $bundlePath -Recurse -File | Where-Object { 
        $_.Extension -in @('.msi', '.exe', '.zip') 
    } | ForEach-Object {
        $size = [math]::Round($_.Length / 1MB, 2)
        Write-Host "  📄 $($_.Name) ($size MB)" -ForegroundColor White
    }
} else {
    Write-Host "  ⚠️  未找到构建产物目录" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎉 完成！安装包位于: $bundlePath" -ForegroundColor Green
