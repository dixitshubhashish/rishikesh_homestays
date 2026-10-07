# One-time setup of the booking-link search on a Windows laptop (docs/booking-links/RULES.md, section 5).
# Run in PowerShell, from the repo folder:   powershell -ExecutionPolicy Bypass -File scripts\windows\setup.ps1
# Installs what is missing with winget (Windows 10/11 has it): Node.js LTS, Python 3, Git, and the four browsers the
# search drives (Chrome, Edge, Brave, Opera); then the repo's npm packages and Playwright's own Chromium (verify_seen.mjs).
# It never touches secrets: the search needs no .env and no BigQuery key.
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..\..')

function Have($cmd) { return [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }
# A real Python 3: on Windows 'python' and 'python3' are often the Microsoft Store stub, which Get-Command finds but which runs nothing.
function HavePython {
  foreach ($c in @(@('python'), @('py', '-3'))) {
    if (-not (Have $c[0])) { continue }
    try {
      & $c[0] @($c[1..($c.Count - 1)] | Where-Object { $_ }) -c 'import sys; sys.exit(0 if sys.version_info[0] == 3 else 1)' 2>$null | Out-Null
      if ($LASTEXITCODE -eq 0) { return $true }
    } catch { }
  }
  return $false
}
function Winget($id, $name) {
  Write-Host "installing $name ($id) ..."
  winget install --id $id --exact --silent --accept-source-agreements --accept-package-agreements
}
if (-not (Have winget)) { throw 'winget is missing: install "App Installer" from the Microsoft Store, then run this again.' }

if (-not (Have node))   { Winget 'OpenJS.NodeJS.LTS' 'Node.js LTS' }
if (-not (HavePython))  { Winget 'Python.Python.3.12' 'Python 3' }
if (-not (Have git))    { Winget 'Git.Git' 'Git' }

# the browsers (Edge is part of Windows). Opera must stay in the set (owner's rule).
$apps = @{
  'Google Chrome' = @('Google.Chrome', "$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe");
  'Brave'         = @('Brave.Brave', "$env:ProgramFiles\BraveSoftware\Brave-Browser\Application\brave.exe", "$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\Application\brave.exe");
  'Opera'         = @('Opera.Opera', "$env:LOCALAPPDATA\Programs\Opera\opera.exe", "$env:ProgramFiles\Opera\opera.exe");
}
foreach ($name in $apps.Keys) {
  $id = $apps[$name][0]; $paths = $apps[$name][1..2]
  if (-not ($paths | Where-Object { Test-Path $_ })) { Winget $id $name } else { Write-Host "${name}: found" }
}
$edge = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
if (Test-Path $edge) { Write-Host 'Microsoft Edge: found' } else { Write-Host 'Microsoft Edge: not found at the usual place (it ships with Windows: update Windows or install it)' }

# new PATH entries (a fresh install) only exist in a new shell: pick them up here
$env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path', 'User')
if (-not (Have node))   { throw 'Node.js is installed but not on PATH yet: close this window, open a new PowerShell and run setup again.' }
if (-not (HavePython))  { throw 'Python is installed but not on PATH yet: close this window, open a new PowerShell and run setup again.' }

Write-Host 'npm install ...'; npm install
Write-Host 'Playwright Chromium (for the fast page checks) ...'; npx playwright install chromium

# line endings: the lists are LF files (.gitattributes keeps them so); make Git on this laptop respect that
git config core.autocrlf false

Write-Host ''
Write-Host "node $(node --version), $(node scripts/py.mjs --version), git $((git --version) -replace 'git version ','')"
Write-Host 'Next: npm run search:browsers   (opens the four browsers with their debugging ports)'
Write-Host '      npm run search:start      (starts the search; search:status, search:stop)'
Write-Host '      (scripts\windows\start-browsers.ps1 and start-search.ps1 [-Status|-Stop] run the same commands)'
