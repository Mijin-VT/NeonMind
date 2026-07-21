@echo off
setlocal enabledelayedexpansion
title Instalador NeonMind

set "PRODUCTION_MODE=0"
if "%~1"=="/production" (
    set "PRODUCTION_MODE=1"
)

echo.
echo ======================================================================
echo    🌸 INSTALADOR UNIFICADO - NEONMIND [Bóveda y AI] 🌸
echo ======================================================================
echo.
echo Este script instalara todas las dependencias necesarias de Node.js,
echo Python, el entorno virtual (venv), y configurara el modelo de Ollama.
echo.
if "!PRODUCTION_MODE!"=="0" pause

REM Cambiar al directorio del script
cd /d "%~dp0"
echo Directorio de trabajo: %CD%
echo.

REM ----------------------------------------------------------------------
REM 1. VERIFICAR E INSTALAR NODE.JS (NPM) Y DEPENDENCIAS FRONTEND
REM ----------------------------------------------------------------------
if "!PRODUCTION_MODE!"=="1" (
    echo [INFO] Modo produccion detectado. Saltando verificacion de Node.js y NPM.
) else (
    echo ======================================================================
    echo [1/5] Verificando instalacion de Node.js y dependencias...
    echo ======================================================================
    set "NODE_OK=0"
    where node >nul 2>&1
    if !errorlevel! equ 0 (
        set "NODE_OK=1"
        echo [OK] Node.js detectado:
        node --version
    ) else (
        echo [INFO] Node.js no esta en el PATH. Intentando instalar via winget...
        where winget >nul 2>&1
        if !errorlevel! equ 0 (
            echo Instalando Node.js LTS...
            winget install --id OpenJS.NodeJS.LTS --silent --accept-source-agreements --accept-package-agreements
            if !errorlevel! equ 0 (
                echo [OK] Node.js instalado correctamente. Reinicia esta consola si da error despues.
                set "NODE_OK=1"
            )
        )
    )

    if "!NODE_OK!"=="0" (
        echo [ERROR] Node.js es requerido para ejecutar la interfaz de React.
        echo Descargalo e instalalo desde: https://nodejs.org/
        echo Asegurate de reiniciar este instalador despues.
        pause
        exit /b 1
    )

    echo.
    echo Instalando dependencias de Node.js [React, Tauri, Tailwind, etc.]...
    call npm install
    if !errorlevel! equ 0 (
        echo [OK] Dependencias de Node.js instaladas correctamente.
    ) else (
        echo [ADVERTENCIA] Hubo un error al correr 'npm install'.
    )
)
echo.

REM ----------------------------------------------------------------------
REM 2. VERIFICAR O INSTALAR PYTHON
REM ----------------------------------------------------------------------
echo ======================================================================
echo [2/5] Verificando instalacion de Python...
echo ======================================================================
set "PYTHON_CMD="

where python >nul 2>&1
if !errorlevel! equ 0 (
    set "PYTHON_CMD=python"
) else (
    where py >nul 2>&1
    if !errorlevel! equ 0 (
        set "PYTHON_CMD=py"
    )
)

if "!PYTHON_CMD!"=="" (
    for /d %%D in ("%LocalAppData%\Programs\Python\Python3*") do (
        if exist "%%D\python.exe" (
            set "PYTHON_CMD=%%D\python.exe"
        )
    )
)

if "!PYTHON_CMD!"=="" (
    echo [INFO] Python no detectado. Intentando instalar via winget...
    where winget >nul 2>&1
    if !errorlevel! equ 0 (
        echo Instalando Python 3.11...
        winget install --id Python.Python.3.11 --exact --silent --accept-source-agreements --accept-package-agreements
        if !errorlevel! equ 0 (
            echo [OK] Python 3.11 instalado.
            for /d %%D in ("%LocalAppData%\Programs\Python\Python3*") do (
                if exist "%%D\python.exe" (
                    set "PYTHON_CMD=%%D\python.exe"
                )
            )
        )
    )
)

if "!PYTHON_CMD!"=="" (
    echo [ERROR] Python 3.10 o 3.11 es requerido para correr la IA de Lily.
    echo Instala Python manualmente desde: https://www.python.org/ [Marca "Add Python to PATH"]
    if "!PRODUCTION_MODE!"=="0" pause
    exit /b 1
)

echo [OK] Python detectado:
"!PYTHON_CMD!" --version
echo.

REM ----------------------------------------------------------------------
REM 3. CONFIGURAR ENTORNO VIRTUAL E INSTALAR LIBRERIAS DE LILY
REM ----------------------------------------------------------------------
echo ======================================================================
echo [3/5] Creando entorno virtual e instalando dependencias de Python...
echo ======================================================================

if not exist "lily-backend\venv\Scripts\python.exe" (
    echo Creando entorno virtual en lily-backend\venv...
    "!PYTHON_CMD!" -m venv lily-backend\venv
    if !errorlevel! neq 0 (
        echo [ERROR] No se pudo crear el entorno virtual de Python.
        if "!PRODUCTION_MODE!"=="0" pause
        exit /b 1
      )
)
echo [OK] Entorno virtual 'venv' verificado.

echo Actualizando pip e instalando requerimientos (FastAPI, Whisper, ChromaDB, etc.)...
echo (Esto puede tardar unos minutos debido a las librerias de IA)
lily-backend\venv\Scripts\python.exe -m pip install --upgrade pip
lily-backend\venv\Scripts\python.exe -m pip install -r lily-backend\requirements.txt

if !errorlevel! equ 0 (
    echo [OK] Dependencias de Python instaladas con exito.
) else (
    echo [ERROR] Fallo la instalacion de dependencias de Python.
    if "!PRODUCTION_MODE!"=="0" pause
    exit /b 1
)
echo.

REM ----------------------------------------------------------------------
REM 4. VERIFICAR E INSTALAR OLLAMA Y DESCARGAR EL MODELO
REM ----------------------------------------------------------------------
echo ======================================================================
echo [4/5] Configurando Ollama y modelo Qwen...
echo ======================================================================
set "OLLAMA_CMD="

where ollama >nul 2>&1
if !errorlevel! equ 0 (
    set "OLLAMA_CMD=ollama"
) else (
    if exist "%LocalAppData%\Programs\Ollama\ollama.exe" (
        set "OLLAMA_CMD=%LocalAppData%\Programs\Ollama\ollama.exe"
    ) else if exist "%ProgramFiles%\Ollama\ollama.exe" (
        set "OLLAMA_CMD=%ProgramFiles%\Ollama\ollama.exe"
    )
)

if "!OLLAMA_CMD!"=="" (
    echo [INFO] Ollama no detectado. Intentando instalar via winget...
    where winget >nul 2>&1
    if !errorlevel! equ 0 (
        echo Instalando Ollama...
        winget install --id Ollama.Ollama --silent --accept-source-agreements --accept-package-agreements
        if !errorlevel! equ 0 (
            echo [OK] Ollama instalado correctamente.
            if exist "%LocalAppData%\Programs\Ollama\ollama.exe" (
                set "OLLAMA_CMD=%LocalAppData%\Programs\Ollama\ollama.exe"
            ) else (
                set "OLLAMA_CMD=ollama"
            )
        )
    )
)

if "!OLLAMA_CMD!"=="" (
    echo [ERROR] Ollama es requerido para la IA conversacional local.
    echo Instala Ollama manualmente desde: https://ollama.ai/
    if "!PRODUCTION_MODE!"=="0" pause
    exit /b 1
)

echo [OK] Ollama detectado.
REM Comprobar si el servicio esta activo en el puerto 11434
curl -s http://127.0.0.1:11434/api/tags >nul 2>&1
if !errorlevel! neq 0 (
    echo [INFO] El servicio de Ollama no esta ejecutandose. Iniciandolo...
    if exist "%LocalAppData%\Programs\Ollama\ollama.exe" (
        start "" "%LocalAppData%\Programs\Ollama\ollama.exe" serve
    ) else (
        start "" ollama serve
    )
    echo Esperando a que el servicio responda [10 segundos]...
    timeout /t 10 >nul
)

REM Comprobar el modelo
curl -s http://127.0.0.1:11434/api/tags >nul 2>&1
if !errorlevel! equ 0 (
    echo Verificando si el modelo 'huihui_ai/qwen3-abliterated:0.6b' esta descargado...
    if exist "%LocalAppData%\Programs\Ollama\ollama.exe" (
        "%LocalAppData%\Programs\Ollama\ollama.exe" show huihui_ai/qwen3-abliterated:0.6b >nul 2>&1
    ) else (
        ollama show huihui_ai/qwen3-abliterated:0.6b >nul 2>&1
    )
    
    if !errorlevel! neq 0 (
        echo Descargando modelo 'huihui_ai/qwen3-abliterated:0.6b' [aprox 400MB]...
        if exist "%LocalAppData%\Programs\Ollama\ollama.exe" (
            "%LocalAppData%\Programs\Ollama\ollama.exe" pull huihui_ai/qwen3-abliterated:0.6b
        ) else (
            ollama pull huihui_ai/qwen3-abliterated:0.6b
        )
    ) else (
        echo [OK] Modelo 'huihui_ai/qwen3-abliterated:0.6b' ya instalado en Ollama.
    )
) else (
    echo [ADVERTENCIA] No se pudo verificar el servicio de Ollama. 
    echo Recuerda iniciar Ollama y correr 'ollama pull huihui_ai/qwen3-abliterated:0.6b' manualmente.
)
echo.

REM ----------------------------------------------------------------------
REM 5. VERIFICAR COMPILADOR DE RUST (OPCIONAL PARA DESARROLLADORES)
REM ----------------------------------------------------------------------
if "!PRODUCTION_MODE!"=="1" (
    echo [INFO] Modo produccion: Saltando verificacion de Rust.
) else (
    echo ======================================================================
    echo [5/5] Verificando compilador de Rust [Tauri]...
    echo ======================================================================
    where cargo >nul 2>&1
    if !errorlevel! equ 0 (
        echo [OK] Rust y Cargo detectados en el sistema:
        cargo --version
    ) else (
        echo [INFO] No se detecto Rust [Cargo].
        echo Nota: Si solo quieres probar el desarrollo local con Tauri, 
        echo necesitaras instalar Rust para compilar. 
        echo Puedes instalarlo desde: https://rustup.rs/
    )
)
echo.

echo ======================================================================
echo   🌸 ¡INSTALACION UNIFICADA COMPLETADA CON EXITO! 🌸
echo ======================================================================
echo.
if "!PRODUCTION_MODE!"=="1" (
    echo [INFO] Entorno de produccion configurado correctamente.
) else (
    echo Todo esta configurado. Para lanzar el proyecto de forma local corre:
    echo.
    echo       --^> npm run tauri dev
    echo.
    echo Esto arrancara la interfaz React en la ventana de Tauri y levantara
    echo automaticamente el backend de Python con el modelo de IA en segundo plano.
)
echo.
if "!PRODUCTION_MODE!"=="0" pause
exit /b 0
