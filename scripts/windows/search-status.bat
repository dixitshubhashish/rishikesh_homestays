@echo off
rem Shows the booking-link search: supervisor and worker ids, browser ports, found / unfound / review counts, last log lines.
cd /d "%~dp0..\.."
call node scripts\search-ctl.mjs status
echo.
pause
