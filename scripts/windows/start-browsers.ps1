# Opens the four browsers the search drives, each with a remote-debugging port and its own profile folder
# (docs/booking-links/RULES.md section 5). A thin wrapper: the work is done by scripts/search-ctl.mjs, the same command
# as on the Mac:   npm run search:browsers
#   Chrome 9222   Opera 9223   Brave 9224   Edge 9225      (the ports search_supervisor.mjs expects)
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..\..')
node scripts/search-ctl.mjs browsers
exit $LASTEXITCODE
