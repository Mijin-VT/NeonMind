# NeonMind: Bóveda de Links & Compañera AI Lily

**NeonMind** es un ecosistema de escritorio unificado, moderno e independiente diseñado para llevar tu productividad y gestión de información al siguiente nivel. Construido sobre la robusta arquitectura de **Tauri 2, React 19 y TypeScript**, integra un avanzado gestor de enlaces persistentes (Bóveda de Links), un bloc de notas mentales dinámico y a **Lily**, una compañera virtual inteligente y local dotada de inteligencia emocional y capacidades de automatización.

Lily funciona de manera **100% local y offline**, sin enviar tus datos a servidores externos, garantizando tu absoluta privacidad a través del procesamiento local de modelos de Inteligencia Artificial (LLM, RAG, TTS y STT).

---

## 🚀 Características Principales

### 📁 Bóveda de Links & Notas Mentales
* **Gestión Jerárquica de Enlaces:** Agrega, edita y organiza tus enlaces favoritos en categorías personalizadas.
* **Carpetas y Sub-enlaces:** Estructura en árbol que permite agrupar enlaces dentro de otros enlaces (sub-enlaces infinitos) para mantener un espacio de trabajo limpio.
* **Marcación de Favoritos:** Acceso rápido a tus enlaces preferidos desde la barra lateral.
* **Notas Mentales:** Un bloc de notas visual interactivo con soporte de colores personalizados y organización cronológica.
* **Persistencia Robusta:** Todo se almacena localmente mediante una base de datos **SQLite** embebida en Tauri 2 con migraciones automáticas integradas en Rust.
* **Copias de Seguridad (Backups):** Exportación e importación de tu base de datos (`links.db`) con un solo clic a través de diálogos nativos del sistema.
* **Arranque con Windows (Autostart):** Opción configurable desde la interfaz para registrar la aplicación en el inicio de Windows a través del registro nativo de Windows (HKCU Run).

### 🧠 Lily: Tu Compañera Virtual de IA
* **IA Conversacional Local:** Procesamiento del lenguaje mediante **Ollama**, configurado por defecto con el modelo ligero y optimizado `huihui_ai/qwen3-abliterated:0.6b` (ampliable a cualquier modelo local).
* **Base de Conocimiento Vectorial (RAG):** Lily lee, indexa y recuerda automáticamente los enlaces de tu bóveda, tus notas mentales y cualquier documento de texto (`.txt`, `.md`, `.pdf`) que subas. Utiliza **ChromaDB** para realizar búsquedas semánticas y responder preguntas basándose en tu información personal.
* **Speech-to-Text (STT) Nativo:** Transcripción de voz instantánea alimentada por **Faster Whisper** (modelo `base` optimizado para ejecución en CPU o aceleración por GPU con CUDA).
* **Text-to-Speech (TTS) Expresivo:** Síntesis de voz ultra-realista de calidad humana utilizando el motor **Kokoro v1.0 (ONNX)** con perfiles de voz nativos.
* **Escucha Activa en Segundo Plano (Wake Word):** Lily cuenta con detección constante de la palabra clave **"LILY"** (Wake Word Engine) para que puedas interactuar por voz sin necesidad de tocar la pantalla o el teclado.

### 🎭 Inteligencia Emocional y Personalización
* **Estados Emocionales Dinámicos:** Lily experimenta y cambia su estado de ánimo en base a tus conversaciones. Los estados incluyen: *Feliz 😊, Triste 😢, Enojada 😠, Emocionada 🤩, Neutral 😐, Cariñosa 🥰, Juguetona 😜, Preocupada 😟 y Sorprendida 😲*.
* **Interfaz Reactiva Emocional:** El chat de usuario se adapta visualmente mediante gradientes animados (Framer Motion) y emojis que reflejan el estado de ánimo actual de Lily.
* **TTS Sensible a Emociones:** El tono, velocidad y expresividad de la voz generada por el motor de síntesis de Kokoro se modula dinámicamente según la emoción actual de Lily.
* **Personalidades Intercambiables:** Puedes cambiar tanto el perfil de personalidad del LLM como su estilo de interacción a través del menú de configuraciones rápidas.
* **Memoria a Largo Plazo y Resúmenes:** Sistema inteligente de almacenamiento y generación de resúmenes de conversación e historiales emocionales.

---

## 🛠️ Arquitectura del Sistema

La aplicación está diseñada bajo una estructura híbrida desacoplada de tres capas para maximizar el rendimiento y la seguridad local:

```mermaid
graph TD
    subgraph Frontend [Capa de Interfaz (Desktop App)]
        A[React 19 + TypeScript + Tailwind]
    end

    subgraph Core [Núcleo de Escritorio - Tauri 2]
        B[Tauri Rust Core]
        D[(SQLite: links.db)]
    end

    subgraph Backend [Servidor Local de IA - lily-backend]
        C[FastAPI Server Python]
        E[Ollama Service]
        F[(Vector DB: ChromaDB)]
        G[Faster Whisper STT]
        H[Kokoro ONNX TTS]
    end

    A <-->|IPC Invokes / Tauri Commands| B
    A <-->|API Rest & WebSockets| C
    B <-->|Migrations & SQL Queries| D
    B -->|Manejo de Ciclo de Vida / Spawns| C
    B -->|Auto-inicio de servicio| E
    C <-->|Local API calls| E
    C <-->|Vector Ingestion / Query| F
    C -->|Transcripción de Audio| G
    C -->|Síntesis Emocional de Voz| H
```

1. **Frontend (React 19 + Vite + Tailwind CSS v4 + Framer Motion):** Una UI animada, responsiva y moderna. Administra las pestañas de la Bóveda de Enlaces, las Notas Mentales, el Chat Conversacional de Lily y el panel de configuraciones.
2. **Core (Tauri 2 + Rust):** Gestiona las ventanas del sistema operativo, controla la persistencia de SQLite (crea las tablas iniciales y actualiza el esquema para sub-enlaces jerárquicos), expone comandos de exportación/importación, lee/escribe el registro de autostart en Windows y administra el ciclo de vida del backend en Python (iniciándolo sin ventana de terminal y cerrándolo limpiamente mediante `taskkill` al cerrar la app).
3. **Backend de IA (FastAPI + Python 3.11):** Ejecuta de manera local los pipelines de inteligencia artificial. Administra los modelos de voz, la extracción de textos de PDFs/TXTs para RAG en ChromaDB, y los controladores de automatización del sistema.

---

## 📋 Requisitos de Sistema

* **Sistema Operativo:** Windows 10 u 11 (64 bits).
* **Node.js:** Versión LTS recomendada (v18 o superior).
* **Python:** Versión 3.10 o 3.11 (requerido para las librerías de IA y bindings de PyAudio/ONNX).
* **Ollama:** Instalado y corriendo en tu máquina.
* **Rust & Visual Studio Build Tools:** Compiladores C++ requeridos para la compilación de Tauri 2 y dependencias nativas de Cargo.

---

## 🔧 Instalación Automática (Recomendada)

El repositorio incluye un instalador unificado por lotes que prepara todo el entorno con un solo clic:

1. Localiza el archivo [INSTALL.bat](file:///d:/Desktop/AGENTES/BOBEDA%20DE%20LINKS/INSTALL.bat) en la raíz del proyecto.
2. Haz clic derecho y selecciona **"Ejecutar como administrador"**.
3. El instalador se encargará de realizar de forma secuencial y desatendida lo siguiente:
   * Verificar e instalar Node.js, Python 3.11 y Ollama vía `winget` en caso de que no existan.
   * Crear el entorno virtual de Python (`venv`) en `lily-backend/venv`.
   * Actualizar `pip` e instalar todas las dependencias críticas de IA (Whisper, ChromaDB, FastAPI, Kokoro-ONNX, PyAudio, PyAutoGUI, etc.).
   * Iniciar el servicio de Ollama y descargar automáticamente el modelo conversacional `huihui_ai/qwen3-abliterated:0.6b` (aprox. 400 MB).
   * Instalar los paquetes npm necesarios para el Frontend.

---

## ⚡ Ejecución

### Modo Desarrollo (Recompilación y depuración en tiempo real):
Haz doble clic sobre el archivo [INICIAR.bat](file:///d:/Desktop/AGENTES/BOBEDA%20DE%20LINKS/INICIAR.bat) de la raíz.
Este script levantará la interfaz de React, la ventana de Tauri, y levantará en segundo plano el servidor web de FastAPI (`lily-backend`).

### Modo Producción / Compilación final:
Para generar un instalador ligero e independiente de la aplicación (instalador `.msi` o `.exe` a través de WiX/NSIS), ejecuta:
```bash
npm run tauri build
```
El instalador resultante empaquetará la interfaz web compilada y el núcleo de Rust en un binario optimizado de producción.

---

## 💬 Automatización e Integración de Comandos
Lily no solo habla y escucha, sino que puede interactuar directamente con tu sistema operativo y servicios en la nube a través de comandos de voz o mensajes escritos:

| Área de Control | Comandos de Ejemplo (Español) | Descripción |
| :--- | :--- | :--- |
| **YouTube & Música** | *"reproduce lofi girl"*, *"pon música de queen"*, *"pausa la música"*, *"siguiente"* | Busca directamente en YouTube y reproduce o pausa streams multimedia. |
| **Volumen del Sistema** | *"sube volumen"*, *"baja volumen"*, *"silencio / quita el silencio"* | Modifica el nivel de volumen master del sistema operativo. |
| **Automatización Gmail** | *"revisa mis correos"*, *"envía un correo a destino@correo.com asunto reunión mensaje llego tarde"* | Se conecta a tu cuenta de correo Gmail (usando tus credenciales de aplicación SMTP configuradas) para leer el buzón o enviar emails. |
| **Recordatorios & Tareas** | *"recuérdame tomar agua en 15 minutos"*, *"qué tareas tengo pendientes"* | Agenda alarmas en segundo plano y lleva un checklist de actividades diarias. |
| **Búsqueda Web Real-Time** | *"busca en internet sobre [cualquier tema]"* | Realiza consultas en la red a través de motores de búsqueda locales o integrados para dar respuestas actualizadas. |


---

## 🛠️ Solución de Problemas Comunes

### 🖥️ La aplicación inicia con una "Pantalla Blanca"
1. **Espera de inicialización:** Al abrir la aplicación por primera vez con `INICIAR.bat`, Tauri puede cargarse antes de que el servidor local de desarrollo de Vite esté listo. Espera unos segundos y pulsa **`F5`** o **`Ctrl + R`** dentro de la ventana para recargar.
2. **Backend de Python apagado:** Si al pulsar **`F12`** (Consola de desarrollador) observas errores de tipo `net::ERR_CONNECTION_REFUSED` hacia el puerto `8000`, significa que el backend FastAPI no está corriendo. Revisa el archivo `lily-backend/backend.log` y asegúrate de haber ejecutado `INSTALL.bat` previamente para instalar las dependencias en el entorno virtual.

### 🎙️ No detecta el micrófono o da error de PyAudio
1. Asegúrate de tener un micrófono predeterminado configurado y activo en el Panel de Control de Sonido de Windows.
2. En Windows, la librería nativa `PyAudio` requiere compiladores de C++ para construirse. Si falla durante la instalación, el script `INSTALL.bat` intenta solucionarlo automáticamente. Si persiste, instala [Visual Studio Community](https://visualstudio.microsoft.com/es/vs/) marcando la casilla **"Desarrollo para el escritorio con C++"** y vuelve a ejecutar `INSTALL.bat`.

### 🧠 Ollama no se conecta o Lily no responde
1. Asegúrate de tener Ollama activo (busca el icono de la llama en la bandeja del sistema de Windows).
2. Si cerraste accidentalmente el servicio, puedes iniciarlo escribiendo `ollama serve` en la consola de comandos de Windows, o simplemente reiniciando la aplicación para que Tauri lo intente arrancar automáticamente.
3. Verifica que el modelo esté descargado ejecutando `ollama list` en una terminal. Deberías ver `huihui_ai/qwen3-abliterated:0.6b` en la lista.

