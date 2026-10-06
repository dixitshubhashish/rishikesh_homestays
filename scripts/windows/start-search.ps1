# Starts, checks or stops the booking-link search on this laptop (docs/booking-links/RULES.md section 5).
#   scripts\windows\start-search.ps1           start the supervisor (it starts and watches one worker per browser)
#   scripts\windows\start-search.ps1 -Status   counts, which workers run, the last supervisor lines
#   scripts\windows\start-search.ps1 -Stop     stop the supervisor FIRST, then every worker, then verify nothing is left
# Only ONE machine may run the search at a time: stop it on the Mac first, copy the lists over (RULES.md section 5),
# and never edit docs\booking-links\*.tsv by hand while it runs.
param([switch]$Status, [switch]$Stop)
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..\..')
$log = 'scripts\stays\.cache\booking-search-2026-10-04\supervisor-windows.log'
New-Item -ItemType Directory -Force (Split-Path $log) | Out-Null

function Procs($pattern) {
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match $pattern }
}
function Show-Status {
  Write-Host 'supervisor:' ((Procs 'search_supervisor').ProcessId -join ', ')
  foreach ($p in Procs 'google_ota_search') { Write-Host '  worker' $p.ProcessId ($p.CommandLine -replace '^.*?(--shard \S+ --attach \S+).*?(--deep.*)?$', '$1 $2') }
  foreach ($f in 'found', 'unfound', 'review') {
    $n = (Get-Content "docs\booking-links\$f.tsv" | Measure-Object -Line).Lines - 1
    Write-Host ("  {0,-8}{1} rows" -f $f, $n)
  }
  if (Test-Path $log) { Get-Content $log -Tail 6 }
}

if ($Status) { Show-Status; return }

if ($Stop) {
  Procs 'search_supervisor' | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
  Start-Sleep -Seconds 1
  Procs 'google_ota_search' | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
  Start-Sleep -Seconds 3
  $left = @(Procs 'search_supervisor|google_ota_search')
  if ($left.Count) { Write-Host "STILL RUNNING: $($left.ProcessId -join ', ')"; exit 1 } else { Write-Host 'stopped: no supervisor and no worker left' }
  return
}

if (Procs 'search_supervisor') { Write-Host 'the supervisor is already running'; Show-Status; return }
foreach ($port in 9222, 9223, 9224, 9225) {
  try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 "http://localhost:$port/json/version" | Out-Null }
  catch { throw "no browser answers on port $port: run scripts\windows\start-browsers.ps1 first" }
}
# keep the laptop awake while it runs (plugged in): no sleep, screen may switch off
powercfg /change standby-timeout-ac 0 | Out-Null
Start-Process -FilePath node -ArgumentList 'scripts/stays/search_supervisor.mjs' -WindowStyle Hidden -RedirectStandardOutput $log -RedirectStandardError "$log.err"
Start-Sleep -Seconds 8
Show-Status
