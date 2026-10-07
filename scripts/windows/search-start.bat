@echo off
rem Booking-link search, one double-click (docs/booking-links/RULES.md section 5).
rem Frees memory first (closes every browser that is not a search browser), opens the search browsers
rem (Opera and Brave private, Edge with extensions off), then starts the supervisor.
cd /d "%~dp0..\.."
where node >nul 2>nul || (echo Node.js is not installed: run scripts\windows\setup.ps1 first & pause & exit /b 1)
call node scripts\search-ctl.mjs trim
call node scripts\search-ctl.mjs browsers
call node scripts\search-ctl.mjs start
echo.
echo Running. Progress: scripts\windows\search-status.bat   Stop: scripts\windows\search-stop.bat
pause
