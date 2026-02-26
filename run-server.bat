@echo off
chcp 65001 >nul

:: ============================================================
::  SELF-RELAUNCH: keeps window open when double-clicked
:: ============================================================
if not defined KSTUDENT_LAUNCHED (
    set "KSTUDENT_LAUNCHED=1"
    cmd /k "%~f0"
    exit /b
)

setlocal enabledelayedexpansion
set "PS=powershell -NoProfile -Command"

call :banner
echo.

:: ============================================================
::  PRE-CHECK: Verify Node.js is installed
:: ============================================================
call :section "PRE-CHECK" "Verifying Node.js Installation"

where node >nul 2>&1
if !errorlevel! equ 0 (
    for /f "delims=" %%v in ('node --version 2^>nul') do set NODE_VER=%%v
    call :ok "Node.js found  (!NODE_VER!)"
    goto :check_npm
)

call :warn "Node.js not found. Attempting automatic installation..."
echo.

:: -- Try winget (Windows 10/11 built-in) --
where winget >nul 2>&1
if !errorlevel! equ 0 (
    call :info "Trying: winget install OpenJS.NodeJS.LTS"
    winget install --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements --silent
    if !errorlevel! equ 0 goto :node_installed_restart
    call :warn "winget install failed. Trying next method..."
)

:: -- Try Chocolatey --
where choco >nul 2>&1
if !errorlevel! equ 0 (
    call :info "Trying: choco install nodejs-lts"
    choco install nodejs-lts -y
    if !errorlevel! equ 0 goto :node_installed_restart
    call :warn "choco install failed. Trying next method..."
)

:: -- Last resort: download Node.js MSI via PowerShell --
call :info "Downloading Node.js LTS installer directly..."
%PS% "
$ErrorActionPreference = 'Stop'
try {
    $resp = Invoke-RestMethod 'https://nodejs.org/dist/index.json'
    $lts  = $resp | Where-Object { $_.lts } | Select-Object -First 1
    $ver  = $lts.version
    $url  = "https://nodejs.org/dist/$ver/node-$ver-x64.msi"
    $out  = [System.IO.Path]::Combine($env:TEMP, 'nodejs-lts-installer.msi')
    Write-Host "  [..] Downloading $url" -ForegroundColor Cyan
    Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing
    Write-Host "  [..] Running installer (silent)..." -ForegroundColor Cyan
    Start-Process msiexec -ArgumentList "/i `"$out`" /qn /norestart ADDLOCAL=ALL" -Wait
    "SUCCESS"
} catch {
    Write-Host "  [XX] Download/install failed: $_" -ForegroundColor Red
    "FAILED"
}"
if !errorlevel! neq 0 goto :node_install_failed

:: Verify node is now available after PowerShell install
where node >nul 2>&1
if !errorlevel! neq 0 goto :node_install_failed

:node_installed_restart
call :ok "Node.js installed successfully!"
call :info "Refreshing environment and restarting launcher..."
:: Refresh PATH from registry then relaunch
for /f "skip=2 tokens=3*" %%A in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "SYS_PATH=%%A %%B"
for /f "skip=2 tokens=3*" %%A in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "USR_PATH=%%A %%B"
set "PATH=!SYS_PATH!;!USR_PATH!"
echo.
cmd /k "%~f0"
exit /b

:node_install_failed
call :error "Could not install Node.js automatically."
call :error "Please install manually from: https://nodejs.org"
goto :done_error

:check_npm
:: ============================================================
::  STEP 1: Check & Install Node Package Manager
:: ============================================================
call :section "STEP 1" "Checking Package Manager"

where npm >nul 2>&1
if !errorlevel! equ 0 (
    for /f "delims=" %%v in ('npm --version 2^>nul') do set NPM_VER=%%v
    call :ok "npm found  (v!NPM_VER!)"
    goto :npm_install
)

call :warn "npm not found. Trying alternative package managers..."

where yarn >nul 2>&1
if !errorlevel! equ 0 (
    for /f "delims=" %%v in ('yarn --version 2^>nul') do set YARN_VER=%%v
    call :ok "yarn found  (v!YARN_VER!)"
    goto :yarn_install
)

where pnpm >nul 2>&1
if !errorlevel! equ 0 (
    for /f "delims=" %%v in ('pnpm --version 2^>nul') do set PNPM_VER=%%v
    call :ok "pnpm found  (v!PNPM_VER!)"
    goto :pnpm_install
)

where bun >nul 2>&1
if !errorlevel! equ 0 (
    for /f "delims=" %%v in ('bun --version 2^>nul') do set BUN_VER=%%v
    call :ok "bun found  (v!BUN_VER!)"
    goto :bun_install
)

call :error "No package manager found (npm / yarn / pnpm / bun)."
call :error "Node.js may not have been installed correctly. Please reinstall from: https://nodejs.org"
goto :done_error

:: ================================================================
::  NOTE: ใช้ CALL นำหน้าทุกคำสั่ง .cmd (npm/yarn/pnpm/bun/nodemon)
::  เพราะบน Windows ถ้าไม่ใส่ call bat จะหยุดทำงานหลัง .cmd จบ
:: ================================================================
:npm_install
call :info "Running: npm install"
call npm install
set ERR=!errorlevel!
if !ERR! neq 0 ( call :error "npm install failed. (exit code: !ERR!)" & goto :done_error )
call :ok "Dependencies installed via npm."
goto :step2

:yarn_install
call :info "Running: yarn install"
call yarn install
set ERR=!errorlevel!
if !ERR! neq 0 ( call :error "yarn install failed. (exit code: !ERR!)" & goto :done_error )
call :ok "Dependencies installed via yarn."
goto :step2

:pnpm_install
call :info "Running: pnpm install"
call pnpm install
set ERR=!errorlevel!
if !ERR! neq 0 ( call :error "pnpm install failed. (exit code: !ERR!)" & goto :done_error )
call :ok "Dependencies installed via pnpm."
goto :step2

:bun_install
call :info "Running: bun install"
call bun install
set ERR=!errorlevel!
if !ERR! neq 0 ( call :error "bun install failed. (exit code: !ERR!)" & goto :done_error )
call :ok "Dependencies installed via bun."
goto :step2

:: ============================================================
::  STEP 2: Database Check & Optional Re-Seed
:: ============================================================
:step2
echo.
call :section "STEP 2" "Database Verification"

set "DB_FILE=%~dp0kstudent.sqlite"
set "DO_SEED=N"

if exist "!DB_FILE!" (
    for %%F in ("!DB_FILE!") do set DB_SIZE=%%~zF
    call :info "Database found: kstudent.sqlite  (!DB_SIZE! bytes)"

    if !DB_SIZE! gtr 8192 (
        call :warn "Database already contains data."
        echo.
        %PS% "Write-Host '  [?] Re-seed with fresh data? Default=Yes in 5s' -ForegroundColor Cyan"
        echo.
        choice /c YN /t 5 /d Y /n /m "      Press Y to re-seed, N to skip: "
        if !errorlevel! equ 2 (
            call :info "Skipping re-seed. Keeping existing database."
            set "DO_SEED=N"
        ) else (
            call :info "Proceeding with re-seed..."
            set "DO_SEED=Y"
        )
    ) else (
        call :warn "Database file is empty. Seeding automatically..."
        set "DO_SEED=Y"
    )
) else (
    call :warn "No database file found. Seeding automatically..."
    set "DO_SEED=Y"
)

if /i "!DO_SEED!"=="Y" (
    echo.
    call :info "Seeding database... This may take a moment."
    node "%~dp0seed.js"
    set ERR=!errorlevel!
    if !ERR! neq 0 (
        call :error "Seed script failed! (exit code: !ERR!)"
        goto :done_error
    )
    call :ok "Database seeded successfully."
)

:: ============================================================
::  STEP 3: Kill Port 3000 & Start Server
:: ============================================================
echo.
call :section "STEP 3" "Starting Server on Port 3000"

call :info "Checking if port 3000 is already in use..."
set "OLD_PID="
for /f "tokens=5" %%P in ('netstat -ano 2^>nul ^| findstr ":3000 " ^| findstr "LISTENING"') do (
    set "OLD_PID=%%P"
)

if defined OLD_PID (
    call :warn "Port 3000 occupied by PID: !OLD_PID! -- Terminating..."
    taskkill /PID !OLD_PID! /F >nul 2>&1
    if !errorlevel! equ 0 (
        call :ok "Process !OLD_PID! terminated."
    ) else (
        call :warn "Could not kill PID !OLD_PID! -- try running as Administrator."
    )
    timeout /t 2 /nobreak >nul
) else (
    call :ok "Port 3000 is free."
)

:: -- Detect nodemon (must use CALL for .cmd files) --
set "USE_NODEMON=0"
where nodemon >nul 2>&1
if !errorlevel! equ 0 (
    set "USE_NODEMON=1"
    set "NODEMON_CMD=nodemon"
    call :ok "Using global nodemon."
) else if exist "%~dp0node_modules\.bin\nodemon.cmd" (
    set "USE_NODEMON=1"
    set "NODEMON_CMD=%~dp0node_modules\.bin\nodemon"
    call :ok "Using local nodemon."
) else (
    call :warn "nodemon not found -- falling back to: node"
)

echo.
call :divider
if !USE_NODEMON! equ 1 (
    %PS% "Write-Host '  >>  Launching: nodemon server.js' -ForegroundColor Cyan"
) else (
    %PS% "Write-Host '  >>  Launching: node server.js' -ForegroundColor Cyan"
)
%PS% "Write-Host '  >>  URL: http://localhost:3000' -ForegroundColor Green"
call :divider
echo.

:: -- Launch server --
if !USE_NODEMON! equ 1 (
    call "!NODEMON_CMD!" "%~dp0server.js"
) else (
    node "%~dp0server.js"
)

echo.
call :warn "Server process has exited."
goto :done_ok

:: ============================================================
::  DONE
:: ============================================================
:done_error
echo.
%PS% "Write-Host '  =====================================================  ' -ForegroundColor Red"
%PS% "Write-Host '  FATAL: See errors above.                               ' -ForegroundColor Red"
%PS% "Write-Host '  =====================================================  ' -ForegroundColor Red"
echo.
goto :eof

:done_ok
echo.
%PS% "Write-Host '  Session ended. You may close this window.' -ForegroundColor DarkGray"
echo.
goto :eof

:: ============================================================
::  SUB-ROUTINES
:: ============================================================
:banner
%PS% "Write-Host ''"
%PS% "Write-Host '  +======================================================+' -ForegroundColor DarkCyan"
%PS% "Write-Host '  |                                                      |' -ForegroundColor DarkCyan"
%PS% "Write-Host '  |     KSTUDENT  SCHOOL  MANAGEMENT  SYSTEM             |' -ForegroundColor Cyan"
%PS% "Write-Host '  |     Server Startup Launcher  v1.0                    |' -ForegroundColor DarkCyan"
%PS% "Write-Host '  |                                                      |' -ForegroundColor DarkCyan"
%PS% "Write-Host '  +======================================================+' -ForegroundColor DarkCyan"
%PS% "Write-Host ''"
goto :eof

:section
%PS% "Write-Host ''"
%PS% "Write-Host '  +-----------------------------------------------------+' -ForegroundColor DarkYellow"
%PS% "Write-Host '  |  %~1  >>  %~2' -ForegroundColor Yellow"
%PS% "Write-Host '  +-----------------------------------------------------+' -ForegroundColor DarkYellow"
goto :eof

:divider
%PS% "Write-Host '  -----------------------------------------------------' -ForegroundColor DarkGray"
goto :eof

:ok
%PS% "Write-Host '  [OK] %~1' -ForegroundColor Green"
goto :eof

:info
%PS% "Write-Host '  [..] %~1' -ForegroundColor Cyan"
goto :eof

:warn
%PS% "Write-Host '  [!!] %~1' -ForegroundColor Yellow"
goto :eof

:error
%PS% "Write-Host '  [XX] %~1' -ForegroundColor Red"
goto :eof
