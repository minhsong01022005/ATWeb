@echo off
rem Sao luu RMAN Level 0 hang tuan. Chay bang tai khoan thuoc nhom ORA_DBA.
set ORACLE_SID=FREE
set "DIR=%~dp0"
if not exist "%DIR%logs" mkdir "%DIR%logs"
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmm"') do set TS=%%i
rman target / @"%DIR%weekly.rman" log="%DIR%logs\weekly_%TS%.log"
exit /b %ERRORLEVEL%
