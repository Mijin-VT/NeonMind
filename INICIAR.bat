@echo off
setlocal enabledelayedexpansion
title Iniciar NeonMind

REM Cambiar al directorio del script
cd /d "%~dp0"

echo.
echo ======================================================================
echo    🌸 INICIANDO NEONMIND (Bóveda ^& AI) 🌸
echo ======================================================================
echo.

REM Verificar si la carpeta node_modules existe (indica si se ejecutó el instalador)
if not exist "node_modules\" (
    echo [ADVERTENCIA] No se detecta la carpeta 'node_modules'.
    echo ¿Has ejecutado primero el archivo INSTALL.bat?
    echo.
    echo Presiona cualquier tecla para intentar iniciar de todos modos...
    pause >nul
)

echo Iniciando interfaz y servicios...
echo (Esto compilara la ventana y levantara el backend automaticamente)
echo.

call npm run tauri dev

if !errorlevel! neq 0 (
    echo.
    echo ======================================================================
    echo   ⚠️  ERROR AL INICIAR LA APLICACIÓN  ⚠️
    echo ======================================================================
    echo.
    echo El comando 'npm run tauri dev' finalizo con errores.
    echo.
    echo Posibles causas:
    echo 1. Rust o las herramientas de compilacion C++ no estan instaladas en tu equipo.
    echo 2. El servicio de Ollama no esta corriendo o falta descargar el modelo.
    echo 3. Faltan dependencias de Node.js o Python (ejecuta INSTALL.bat como administrador).
    echo.
    pause
)
