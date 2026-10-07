# One-time setup of the booking-link search on a Windows laptop (docs/booking-links/RULES.md, section 5).
# Run in PowerShell, from the repo folder:   powershell -ExecutionPolicy Bypass -File scripts\windows\setup.ps1
# Installs only what is missing with winget (Windows 10/11 has it): Node.js LTS, Python 3, Git. Then it hands over to
# `node scripts/setup.mjs` (the same command as `npm run setup` on the Mac), which checks and installs the browsers the
# search drives (Opera, Brave, Edge), the repo's npm packages and Playwright's own Chromium: whatever is present is left alone.
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

# new PATH entries (a fresh install) only exist in a new shell: pick them up here
$env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path', 'User')
if (-not (Have node))   { throw 'Node.js is installed but not on PATH yet: close this window, open a new PowerShell and run setup again.' }
if (-not (HavePython))  { throw 'Python is installed but not on PATH yet: close this window, open a new PowerShell and run setup again.' }

node scripts/setup.mjs @args
exit $LASTEXITCODE
