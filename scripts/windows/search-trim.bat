@echo off
rem Memory rule: closes every browser that is not a search browser (your own windows too). The search keeps running.
rem Add --all to also close the search browsers; --dry only lists what would close.
cd /d "%~dp0..\.."
call node scripts\search-ctl.mjs trim %*
echo.
pause
