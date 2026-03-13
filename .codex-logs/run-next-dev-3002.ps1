$ErrorActionPreference = 'Stop'
Set-Location "$PSScriptRoot\.."
$log = Join-Path $PSScriptRoot 'next-dev-3002.log'
"[$(Get-Date -Format s)] starting next dev on 3002" | Out-File -FilePath $log -Encoding utf8 -Append
& pnpm dev -- --port 3002 *>> $log
