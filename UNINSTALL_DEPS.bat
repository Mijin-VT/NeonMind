@echo off
setlocal enabledelayedexpansion
title Desinstalador de Dependencias de NeonMind

REM Verificar permisos de administrador
net session >nul 2>&1
if !errorlevel! neq 0 (
    echo.
    echo ======================================================================
    echo   ⚠️  SE REQUIEREN PERMISOS DE ADMINISTRADOR  ⚠️
    echo ======================================================================
    echo.
    echo Este desinstalador necesita ejecutarse con permisos de Administrador.
    echo.
    pause
    exit /b 1
)

echo ======================================================================
echo    🌸 DESINSTALADOR DE DEPENDENCIAS - NEONMIND 🌸
echo ======================================================================
echo.

REM Inicializar flags
set "UNINSTALL_NODE=0"
set "UNINSTALL_PYTHON=0"
set "UNINSTALL_OLLAMA=0"
set "UNINSTALL_RUST=0"
set "UNINSTALL_VS=0"

REM Procesar argumentos
:parse_args
if "%~1"=="" goto run_uninstall
if /I "%~1"=="--node" (
    set "UNINSTALL_NODE=1"
)
if /I "%~1"=="--python" (
    set "UNINSTALL_PYTHON=1"
)
if /I "%~1"=="--ollama" (
    set "UNINSTALL_OLLAMA=1"
)
if /I "%~1"=="--rust" (
    set "UNINSTALL_RUST=1"
)
if /I "%~1"=="--vs" (
    set "UNINSTALL_VS=1"
)
shift
goto parse_args

:run_uninstall

if "!UNINSTALL_NODE!"=="1" (
    echo ======================================================================
    echo Desinstalando Node.js...
    echo ======================================================================
    where winget >nul 2>&1
    if !errorlevel! equ 0 (
        winget uninstall --id OpenJS.NodeJS.LTS --silent --accept-source-agreements
        if !errorlevel! equ 0 (
            echo [OK] Node.js desinstalado correctamente.
        ) else (
            echo [ADVERTENCIA] Error al desinstalar Node.js via winget.
        )
    ) else (
        echo [ADVERTENCIA] No se detecto winget para desinstalar Node.js.
    )
    echo.
)

if "!UNINSTALL_PYTHON!"=="1" (
    echo ======================================================================
    echo Desinstalando Python 3.11...
    echo ======================================================================
    where winget >nul 2>&1
    if !errorlevel! equ 0 (
        winget uninstall --id Python.Python.3.11 --silent --accept-source-agreements
        if !errorlevel! equ 0 (
            echo [OK] Python 3.11 desinstalado correctamente.
        ) else (
            echo [ADVERTENCIA] Error al desinstalar Python via winget.
        )
    ) else (
        echo [ADVERTENCIA] No se detecto winget para desinstalar Python.
    )
    echo.
)

if "!UNINSTALL_OLLAMA!"=="1" (
    echo ======================================================================
    echo Desinstalando Ollama...
    echo ======================================================================
    where winget >nul 2>&1
    if !errorlevel! equ 0 (
        winget uninstall --id Ollama.Ollama --silent --accept-source-agreements
        if !errorlevel! equ 0 (
            echo [OK] Ollama desinstalado correctamente.
        ) else (
            echo [ADVERTENCIA] Error al desinstalar Ollama via winget.
        )
    ) else (
        echo [ADVERTENCIA] No se detecto winget para desinstalar Ollama.
    )
    echo.
)

if "!UNINSTALL_RUST!"=="1" (
    echo ======================================================================
    echo Desinstalando Rust y Cargo...
    echo ======================================================================
    if exist "%USERPROFILE%\.cargo\bin\rustup.exe" (
        echo Ejecutando rustup self uninstall...
        "%USERPROFILE%\.cargo\bin\rustup.exe" self uninstall -y
    ) else (
        rustup self uninstall -y >nul 2>&1
        if !errorlevel! equ 0 (
            echo [OK] Rust desinstalado usando comando rustup global.
        )
    )
    where winget >nul 2>&1
    if !errorlevel! equ 0 (
        winget uninstall --id Rustlang.Rustup --silent --accept-source-agreements >nul 2>&1
    )
    echo [OK] Rust y Cargo desinstalados correctamente.
    echo.
)

if "!UNINSTALL_VS!"=="1" (
    echo ======================================================================
    echo Desinstalando Visual Studio Build Tools...
    echo ======================================================================
    where winget >nul 2>&1
    if !errorlevel! equ 0 (
        echo Ejecutando winget uninstall para Visual Studio Build Tools...
        winget uninstall --id Microsoft.VisualStudio.2022.BuildTools --silent --accept-source-agreements
        if !errorlevel! equ 0 (
            echo [OK] Visual Studio Build Tools desinstalado correctamente.
        ) else (
            echo [ADVERTENCIA] Error al desinstalar Visual Studio Build Tools via winget.
        )
    ) else (
        echo [ADVERTENCIA] No se detecto winget para desinstalar Visual Studio Build Tools.
    )
    echo.
)

echo.
echo ======================================================================
echo   🌸 PROCESO DE DESINSTALACIÓN DE DEPENDENCIAS FINALIZADO 🌸
echo ======================================================================
echo.
timeout /t 5
exit /b 0
