# Starts, checks or stops the booking-link search on this laptop (docs/booking-links/RULES.md section 5).
# A thin wrapper: the work is done by scripts/search-ctl.mjs, the same commands as on the Mac:
#   npm run search:start     (here: start-search.ps1)           start the supervisor (it starts and watches one worker per browser)
#   npm run search:status    (here: start-search.ps1 -Status)   counts, which workers run, the last supervisor lines
#   npm run search:stop      (here: start-search.ps1 -Stop)     stop the supervisor FIRST, then every worker, then verify nothing is left
# Only ONE machine may run the search at a time: stop it on the other machine first, copy the lists over (RULES.md section 5),
# and never edit docs\booking-links\*.tsv by hand while it runs.
param([switch]$Status, [switch]$Stop)
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..\..')
$cmd = if ($Status) { 'status' } elseif ($Stop) { 'stop' } else { 'start' }
node scripts/search-ctl.mjs $cmd
exit $LASTEXITCODE
