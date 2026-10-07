@echo off
rem Stops the booking-link search (supervisor first, then the workers) and closes the search browsers.
cd /d "%~dp0..\.."
call node scripts\search-ctl.mjs stop --close-browsers
echo.
pause
