# NumPy 2.x compatibility monkeypatch for ChromaDB
import numpy as np
if not hasattr(np, "float_"):
    np.float_ = np.float64

from fastapi import FastAPI, HTTPException, Request, UploadFile, File
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
import logging
import traceback
from datetime import datetime

# Sistema de Logs
logging.basicConfig(
    filename='lily_errors.log', 
    level=logging.ERROR,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

from models.ai_engine import AIEngine
from models.schemas import ChatRequest, ChatResponse, EmotionType
from models.tts_engine import TTSEngine
from models.stt_engine import STTEngine
from models.rag_engine import RAGEngine
from models.lily_link_connector import sync_links_and_notes
import shutil

# Crear aplicación FastAPI
app = FastAPI(
    title="Lily virtual companion AI",
    description="Compañera virtual con inteligencia emocional",
    version="2.0.0"
)

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Crear directorio de audio si no existe
os.makedirs(os.path.join("static", "audio"), exist_ok=True)

# Montar directorio estático
app.mount("/static", StaticFiles(directory="static"), name="static")

# Inicializar motor de IA con detección de palabra clave
ai_engine = AIEngine(enable_wake_word=True)

# Iniciar sistema de detección de palabra clave si está disponible
try:
    ai_engine.enable_wake_word_detection()
except Exception as e:
    print(f"Error iniciando detección de palabra clave: {e}")

# Inicializar motor RAG
rag_engine = RAGEngine(knowledge_dir="knowledge")

# Sincronizar enlaces y notas de la Bóveda de Links en el RAG de Lily
try:
    sync_links_and_notes(rag_engine)
except Exception as e:
    print(f"Error al sincronizar base de datos de la Bóveda de Links: {e}")

# Inicializar motor de TTS
tts_engine = TTSEngine()

# Inicializar motor de STT (Faster Whisper)
stt_engine = STTEngine(model_size="base", device="cuda", compute_type="float16")

# Variable global para almacenar el último audio generado
last_audio_path = None



@app.get("/", response_class=HTMLResponse)
async def read_root():
    """Servir la página principal"""
    return HTMLResponse(content="<h1>Lily AI API is running</h1>")


@app.get("/health")
async def health_check():
    """Verificar el estado del sistema"""
    ollama_status = ai_engine.check_ollama_connection()
    
    return {
        "status": "healthy" if ollama_status else "degraded",
        "ollama_connected": ollama_status,
        "timestamp": datetime.now().isoformat()
    }


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Endpoint principal de chat"""
    try:
        # Generar respuesta
        response_text, emotion = ai_engine.generate_response(
            request.message, 
            request.user_id,
            request.lang
        )
        
        # Generar audio con TTS
        audio_url = None
        try:
            audio_url = tts_engine.text_to_speech(response_text, emotion.value)
        except Exception as e:
            print(f"Error generando audio: {e}")
        
        # Preparar respuesta
        return ChatResponse(
            response=response_text,
            emotion=emotion.value,
            audio_url=audio_url,
            timestamp=datetime.now().isoformat()
        )
        
    except Exception as e:
        logging.error(f"Error en /api/chat: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error generando respuesta: {str(e)}")


@app.get("/api/emotion")
async def get_current_emotion():
    """Obtener la emoción actual de Lily"""
    emotional_state = ai_engine.get_emotional_state()
    
    return {
        "emotion": emotional_state.emotion.value,
        "intensity": emotional_state.intensity,
        "reason": emotional_state.reason,
        "timestamp": emotional_state.timestamp.isoformat()
    }


@app.get("/api/memory/{user_id}")
async def get_user_memory(user_id: str):
    """Obtener memoria de conversación del usuario"""
    try:
        context = ai_engine.memory_system.get_conversation_context(user_id, max_messages=10)
        summary = ai_engine.memory_system.get_conversation_summary(user_id)
        emotional_summary = ai_engine.memory_system.get_emotional_summary(user_id)
        
        return {
            "user_id": user_id,
            "conversation_summary": summary,
            "emotional_summary": emotional_summary,
            "recent_messages": context
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error obteniendo memoria: {str(e)}")


@app.delete("/api/memory/{user_id}")
async def clear_user_memory(user_id: str):
    """Borrar la memoria conversacional y emocional del usuario"""
    try:
        # Borrar el historial de SQLite y ChromaDB
        ai_engine.memory_system.clear_memory(user_id)
        
        # Restablecer el estado emocional a neutral
        from models.advanced_emotional_intelligence import EmotionalState, EmotionType
        ai_engine.emotional_intelligence.current_state = EmotionalState(
            emotion=EmotionType.NEUTRAL,
            intensity=0.5,
            reason="Reinicio de memoria",
            timestamp=datetime.now(),
            confidence=1.0
        )
        return {"status": "success", "message": "Memoria conversacional y emocional borrada con éxito."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error borrando memoria: {str(e)}")
@app.get("/api/preferences/{user_id}")
async def get_preferences(user_id: str):
    """Obtener preferencias del usuario (ej: Gmail, Nombre)"""
    try:
        gmail_user = ai_engine.memory_system.get_preference(user_id, "gmail_user", "")
        gmail_password = ai_engine.memory_system.get_preference(user_id, "gmail_password", "")
        has_password = len(gmail_password) > 0
        user_name = ai_engine.memory_system.get_preference(user_id, "user_name", "Mijin")
        lily_lang_mode = ai_engine.memory_system.get_preference(user_id, "lily_lang_mode", "auto")
        
        return {
            "gmail_user": gmail_user,
            "has_password": has_password,
            "user_name": user_name,
            "lily_lang_mode": lily_lang_mode
        }


    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/preferences/{user_id}")
async def save_preference(user_id: str, request: Request):
    """Guardar o actualizar preferencias del usuario"""
    try:
        data = await request.json()
        for key, val in data.items():
            ai_engine.memory_system.update_preference(user_id, key, val)
        return {"status": "success", "message": "Preferencias actualizadas"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@app.post("/api/tts")
async def text_to_speech(request: Request):
    """Endpoint para texto a voz con personalización emocional"""
    data = await request.json()
    text = data.get("text", "")
    emotion = data.get("emotion", "neutral")
    
    try:
        audio_url = tts_engine.text_to_speech(text, emotion)
        return {
            "status": "success",
            "audio_url": audio_url,
            "text": text,
            "emotion": emotion
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando audio: {str(e)}")


@app.post("/api/transcribe")
async def transcribe_audio(lang: str = None, file: UploadFile = File(...)):
    """Endpoint para transcribir audio (Speech-to-Text) usando Faster Whisper"""
    temp_filename = f"temp_audio_{datetime.now().timestamp()}.wav"
    try:
        # Guardar archivo temporalmente
        with open(temp_filename, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Transcribir
        text = stt_engine.transcribe(temp_filename, language=lang)
        
        return {"text": text, "engine": "whisper"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error transcribiendo audio: {str(e)}")
    finally:
        if os.path.exists(temp_filename):
            try:
                os.remove(temp_filename)
            except Exception as e:
                print(f"Error removiendo archivo temporal: {e}")




@app.get("/api/audio/{filename}")
async def get_audio(filename: str):
    """Servir archivos de audio generados"""
    audio_path = os.path.join("static", "audio", filename)
    
    if os.path.exists(audio_path):
        media_type = "audio/mpeg" if filename.endswith(".mp3") else "audio/wav"
        return FileResponse(audio_path, media_type=media_type)
    else:
        raise HTTPException(status_code=404, detail="Audio no encontrado")


@app.delete("/api/audio/{filename}")
async def delete_audio(filename: str):
    """Eliminar archivo de audio después de reproducción"""
    try:
        audio_url = f"/static/audio/{filename}"
        deleted = tts_engine.delete_audio_file(audio_url)

        if deleted:
            return {"status": "success", "message": "Audio eliminado correctamente"}
        else:
            return {"status": "error", "message": "Audio no encontrado"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error eliminando audio: {str(e)}")


@app.post("/api/wake_word/enable")
async def enable_wake_word():
    """Habilitar detección de palabra clave"""
    try:
        ai_engine.enable_wake_word_detection()
        return {"status": "success", "message": "Detección de palabra clave habilitada"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error habilitando detección de palabra clave: {str(e)}")


@app.post("/api/wake_word/disable")
async def disable_wake_word():
    """Deshabilitar detección de palabra clave"""
    try:
        ai_engine.disable_wake_word_detection()
        return {"status": "success", "message": "Detección de palabra clave deshabilitada"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deshabilitando detección de palabra clave: {str(e)}")


@app.get("/api/wake_word/status")
async def get_wake_word_status():
    """Obtener estado de la detección de palabra clave"""
    try:
        return {
            "enabled": ai_engine.wake_word_enabled,
            "is_listening": ai_engine.wake_word_engine.is_listening if ai_engine.wake_word_engine else False
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error obteniendo estado: {str(e)}")


# ====================================
# ENDPOINTS DE PERSONALIDAD E HISTORIAL
# ====================================

@app.get("/api/logs")
async def get_logs():
    """Obtener los últimos logs de error"""
    try:
        if os.path.exists("lily_errors.log"):
            with open("lily_errors.log", "r", encoding="utf-8") as f:
                return {"status": "success", "logs": f.readlines()[-50:]}
        return {"status": "success", "logs": []}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.get("/api/personalities")
async def get_personalities():
    """Obtener lista de personalidades disponibles"""
    return {"status": "success", "personalities": ai_engine.personalidades}


@app.post("/api/emotional-personalities/set")
async def set_emotional_personality(request: Request):
    """Cambiar la personalidad emocional actual"""
    data = await request.json()
    personality_id = data.get("personality_id")
    if ai_engine.set_emotional_personality(personality_id):
        return {"status": "success", "message": f"Personalidad emocional cambiada a {personality_id}"}
    else:
        raise HTTPException(status_code=400, detail="Personalidad emocional no encontrada")


@app.get("/api/emotional-personalities/current")
async def get_current_emotional_personality():
    """Obtener la personalidad emocional actual"""
    return {"status": "success", "personality": ai_engine.get_current_emotional_personality()}


@app.post("/api/language-personalities/set")
async def set_language_personality(request: Request):
    """Cambiar la personalidad del modelo de lenguaje"""
    data = await request.json()
    personality_id = data.get("personality_id")
    if ai_engine.switch_language_model_personality(personality_id):
        return {"status": "success", "message": f"Personalidad del modelo de lenguaje cambiada a {personality_id}"}
    else:
        raise HTTPException(status_code=400, detail="Personalidad del modelo de lenguaje no encontrada")


@app.get("/api/emotional-summary/{user_id}")
async def get_emotional_summary(user_id: str):
    """Obtener resumen emocional del usuario"""
    try:
        summary = ai_engine.get_emotional_summary(user_id)
        return {
            "status": "success",
            "summary": summary,
            "user_id": user_id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error obteniendo resumen emocional: {str(e)}")


@app.post("/api/personalities/set")
async def set_personality(request: Request):
    """Cambiar la personalidad actual"""
    data = await request.json()
    personality_id = data.get("personality_id")
    if ai_engine.set_personality(personality_id):
        return {"status": "success", "message": f"Personalidad cambiada a {personality_id}"}
    else:
        raise HTTPException(status_code=400, detail="Personalidad no encontrada")


# ============================================================
# ENDPOINTS RAG (Recuperación de Conocimiento)
# ============================================================

@app.post("/api/rag/upload-document")
async def upload_document(file: UploadFile = File(...)):
    """Sube un documento y lo agrega a la base de conocimiento RAG"""
    try:
        os.makedirs("knowledge/uploads", exist_ok=True)
        file_path = f"knowledge/uploads/{file.filename}"
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        doc_ids = rag_engine.ingest_file(file_path, metadata={"uploaded_by": "web_interface"})
        
        if doc_ids:
            return {
                "success": True,
                "filename": file.filename,
                "doc_ids": doc_ids,
                "message": f"Documento '{file.filename}' agregado al conocimiento"
            }
        else:
            raise HTTPException(status_code=400, detail="No se pudo procesar el documento")
    except Exception as e:
        print(f"Error subiendo documento: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/rag/ingest-knowledge")
def ingest_knowledge_directory():
    """Ingesta todos los archivos en el directorio knowledge/"""
    try:
        files_count = rag_engine.ingest_directory()
        return {"success": True, "files_ingested": files_count, "message": f"{files_count} archivos procesados"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/rag/stats")
def get_knowledge_stats():
    """Obtiene estadísticas del conocimiento"""
    try:
        return rag_engine.get_knowledge_stats()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/rag/documents")
def list_documents(limit: int = 20):
    """Lista documentos indexados en RAG"""
    try:
        return {"documents": rag_engine.list_documents(limit=limit)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/rag/document/{doc_id}")
def delete_document(doc_id: str):
    """Elimina un documento de la base de conocimiento"""
    try:
        success = rag_engine.delete_document(doc_id)
        if success:
            return {"success": True, "message": "Documento eliminado"}
        else:
            raise HTTPException(status_code=404, detail="Documento no encontrado")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/rag/query")
def query_knowledge(request: dict):
    """Consulta la base de conocimiento RAG"""
    try:
        query_text = request.get("query", "")
        n_results = request.get("n_results", 3)
        
        if not query_text:
            raise HTTPException(status_code=400, detail="Query es requerido")
        
        documents, metadatas = rag_engine.query(query_text, n_results=n_results)
        
        return {
            "success": True,
            "results": [{"text": doc, "metadata": meta} for doc, meta in zip(documents, metadatas)],
            "count": len(documents)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/rag/configure")
def configure_rag(config: dict):
    """Configura parámetros del RAG (umbral, chunk size)"""
    try:
        if "similarity_threshold" in config:
            rag_engine.set_similarity_threshold(config["similarity_threshold"])
        if "chunk_size" in config:
            overlap = config.get("chunk_overlap", 50)
            rag_engine.set_chunk_size(config["chunk_size"], overlap=overlap)
        
        return {
            "success": True,
            "message": "RAG configurado correctamente",
            "current_config": {
                "similarity_threshold": rag_engine.similarity_threshold,
                "chunk_size": rag_engine.chunk_size,
                "chunk_overlap": rag_engine.chunk_overlap
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    print("=" * 60)
    print("Lily virtual companion AI")
    print("=" * 60)
    print(f"Servidor iniciando en: http://127.0.0.1:8000")
    print(f"Documentación API: http://127.0.0.1:8000/docs")
    print("=" * 60)
    
    # Limpiar archivos de audio antiguos al iniciar
    print("Limpiando archivos de audio antiguos...")
    tts_engine.clean_old_audio_files(max_age_seconds=300)
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )
