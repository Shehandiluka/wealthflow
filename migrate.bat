@echo off
setlocal enabledelayedexpansion
title WealthFlow - Database Migration
cd /d "%~dp0"

echo ================================================
echo   WealthFlow - Apply Database Migrations
echo ================================================
echo.
echo This checks which migrations are already applied to your
echo database, shows you only the NEW ones, and lets you pick
echo exactly which to apply - never re-runs old ones.
echo.

set FINAL_CONN=postgresql://postgres.ontlcjvmztiprmzbtcmh:%%40Swi0346chb@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres

echo.
echo Checking which migrations are already applied...
pg-bin\psql.exe "%FINAL_CONN%" -t -A -c "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;" > applied_versions.txt 2>migrate_error.txt

if errorlevel 1 (
    echo.
    echo [ERROR] Could not connect or read migration history. Details:
    type migrate_error.txt
    del applied_versions.txt migrate_error.txt >nul 2>nul
    pause
    exit /b 1
)
del migrate_error.txt >nul 2>nul

echo.
echo Comparing against local migration files...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\list-pending-migrations.ps1"

if not exist pending_migrations.txt (
    echo.
    echo No pending migrations, or something went wrong listing them.
    del applied_versions.txt >nul 2>nul
    pause
    exit /b 0
)

set /a COUNT=0
for /f "usebackq delims=" %%f in ("pending_migrations.txt") do (
    set /a COUNT+=1
    set "FILE!COUNT!=%%f"
    echo   !COUNT!. %%f
)

if !COUNT! equ 0 (
    echo.
    echo Everything is already applied. Nothing to do.
    del applied_versions.txt pending_migrations.txt >nul 2>nul
    pause
    exit /b 0
)

echo.
echo Enter the number(s) to apply - e.g. "1" or "1,3" - or type "all":
set /p CHOICE=Your choice: 

if /i "%CHOICE%"=="all" (
    for /l %%n in (1,1,!COUNT!) do call :apply !FILE%%n!
) else (
    for %%c in (%CHOICE:,= %) do call :apply !FILE%%c!
)

del applied_versions.txt pending_migrations.txt >nul 2>nul
echo.
echo ================================================
echo   Done!
echo ================================================
pause
exit /b 0

:apply
set "MIGFILE=%~1"
if "%MIGFILE%"=="" exit /b 0
echo.
echo Applying %MIGFILE% ...
pg-bin\psql.exe "%FINAL_CONN%" -v ON_ERROR_STOP=1 -f "supabase\migrations\%MIGFILE%"
if errorlevel 1 (
    echo [ERROR] %MIGFILE% failed - stopping here. Nothing after this was applied.
    pause
    exit /b 1
)
REM Record it as applied so it won't show as pending next time
for /f "tokens=1 delims=_" %%v in ("%MIGFILE%") do set "VERSION=%%v"
pg-bin\psql.exe "%FINAL_CONN%" -c "INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('!VERSION!', '%MIGFILE%') ON CONFLICT (version) DO NOTHING;" >nul
echo Done: %MIGFILE%
exit /b 0
