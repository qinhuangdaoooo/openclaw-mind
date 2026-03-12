$ErrorActionPreference = 'Stop'
Set-Location "$PSScriptRoot\.."
$log = Join-Path $PSScriptRoot 'tauri-dev-3001.log'
"[$(Get-Date -Format s)] starting tauri dev on 3002" | Out-File -FilePath $log -Encoding utf8 -Append
& pnpm tauri dev --config (Join-Path $PSScriptRoot 'tauri.dev.3001.json') *>> $log
