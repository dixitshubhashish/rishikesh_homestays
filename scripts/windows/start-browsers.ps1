# Opens the four browsers the search drives, each with a remote-debugging port and its own profile folder
# (docs/booking-links/RULES.md section 5). One worker per browser; never close these windows while the search runs.
#   Chrome 9222   Opera 9223   Brave 9224   Edge 9225      (the ports search_supervisor.mjs expects)
# Chrome 136 and later ignore a debugging port on your everyday profile, so every browser here gets its own profile under
# %LOCALAPPDATA%\rh-search\<name>: sign in to Google in it once and use it like a normal browser for a day (a profile with
# history is challenged far less than a brand-new one). Captchas: solve them yourself when they show; the search waits.
param([switch]$Only)   # -Only: leave the browsers that are already listening alone (the default does too)
$ErrorActionPreference = 'Stop'
$browsers = @(
  @{ name = 'chrome'; port = 9222; exe = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe") },
  @{ name = 'opera';  port = 9223; exe = @("$env:LOCALAPPDATA\Programs\Opera\opera.exe", "$env:ProgramFiles\Opera\opera.exe") },
  @{ name = 'brave';  port = 9224; exe = @("$env:ProgramFiles\BraveSoftware\Brave-Browser\Application\brave.exe", "$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\Application\brave.exe") },
  @{ name = 'edge';   port = 9225; exe = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") }
)
function Listening($port) {
  try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 "http://localhost:$port/json/version" | Out-Null; return $true } catch { return $false }
}
foreach ($b in $browsers) {
  if (Listening $b.port) { Write-Host "$($b.name): already listening on $($b.port)"; continue }
  $exe = $b.exe | Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $exe) { Write-Host "$($b.name): NOT INSTALLED (run scripts\windows\setup.ps1)"; continue }
  $profile = Join-Path $env:LOCALAPPDATA "rh-search\$($b.name)"
  New-Item -ItemType Directory -Force $profile | Out-Null
  Start-Process -FilePath $exe -ArgumentList "--remote-debugging-port=$($b.port)", "--user-data-dir=`"$profile`"", '--no-first-run', '--no-default-browser-check', 'about:blank'
  Write-Host "$($b.name): started on port $($b.port) (profile $profile)"
}
Start-Sleep -Seconds 5
foreach ($b in $browsers) { Write-Host ("{0,-7} port {1}: {2}" -f $b.name, $b.port, $(if (Listening $b.port) { 'ready' } else { 'NOT answering' })) }
Write-Host ''
Write-Host 'First time: in each browser open google.com once and accept cookies; sign in if you like. Then run scripts\windows\start-search.ps1'
