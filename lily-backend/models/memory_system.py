import sqlite3
import os
import uuid
from datetime import datetime
from typing import List, Dict, Optional
import chromadb
from chromadb.utils import embedding_functions
from models.schemas import EmotionalState

class MemorySystem:
    """Sistema de memoria de largo plazo que integra SQLite y ChromaDB para almacenamiento semántico"""
    
    def __init__(self, data_dir: str = "data"):
        self.data_dir = data_dir
        self.db_path = os.path.join(data_dir, "lily_memory.db")
        
        # Crear directorio si no existe
        os.makedirs(data_dir, exist_ok=True)
        
        # Inicializar base de datos SQLite
        self._init_sqlite()
        
        # Inicializar cliente de ChromaDB
        self.chroma_path = os.path.join(data_dir, "chroma_db")
        self.chroma_client = chromadb.PersistentClient(path=self.chroma_path)
        
        # Usar la misma función de embeddings ligera multilingüe
        self.embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name="paraphrase-multilingual-MiniLM-L12-v2"
        )
        
        # Obtener o crear la colección para memorias a largo plazo
        self.chroma_collection = self.chroma_client.get_or_create_collection(
            name="lily_memories",
            embedding_function=self.embedding_fn
        )
        
        print(f"MemorySystem SQLite inicializado en {self.db_path}")
        print(f"MemorySystem ChromaDB inicializado en {self.chroma_path} con {self.chroma_collection.count()} memorias semánticas.")

    def _init_sqlite(self):
        """Crea las tablas de SQLite si no existen"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Tabla para mensajes (historial)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT,
                role TEXT,
                content TEXT,
                emotion TEXT,
                timestamp TEXT
            )
        ''')
        
        # Tabla para preferencias del usuario
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS preferences (
                user_id TEXT,
                key TEXT,
                value TEXT,
                PRIMARY KEY (user_id, key)
            )
        ''')
        
        # Tabla para historial emocional
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS emotional_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT,
                emotion TEXT,
                intensity REAL,
                reason TEXT,
                timestamp TEXT
            )
        ''')
        
        conn.commit()
        conn.close()

    def add_message(self, user_id: str, role: str, content: str, emotion: Optional[str] = None, ai_engine=None):
        """Agrega un mensaje a la memoria en SQLite y lo indexa semánticamente en ChromaDB si es del usuario"""
        timestamp = datetime.now().isoformat()
        
        # 1. Guardar en SQLite
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO messages (user_id, role, content, emotion, timestamp) VALUES (?, ?, ?, ?, ?)",
            (user_id, role, content, emotion, timestamp)
        )
        conn.commit()
        
        # Contar total de mensajes para disparar el resumen automático
        cursor.execute("SELECT COUNT(*) FROM messages WHERE user_id = ?", (user_id,))
        message_count = cursor.fetchone()[0]
        conn.close()
        
        # 2. Guardar en ChromaDB para búsqueda semántica si es mensaje del usuario
        if role == "user" and len(content.strip()) > 5:
            try:
                doc_id = f"mem_{user_id}_{str(uuid.uuid4())[:8]}_{int(datetime.now().timestamp())}"
                self.chroma_collection.add(
                    documents=[content],
                    metadatas=[{
                        "user_id": user_id,
                        "timestamp": timestamp,
                        "role": role
                    }],
                    ids=[doc_id]
                )
            except Exception as e:
                print(f"Error indexando mensaje semánticamente en Chroma: {e}")
        
        # 3. Resumen automático cada 10 mensajes
        if message_count > 0 and message_count % 10 == 0 and ai_engine:
            self._generate_automatic_summary(user_id, ai_engine)

    def _generate_automatic_summary(self, user_id: str, ai_engine):
        """Genera un resumen de los últimos mensajes usando el LLM y lo guarda en preferencias"""
        try:
            print(f"Generando resumen automático para {user_id}...")
            recent_messages = self.get_conversation_context(user_id, max_messages=10)
            context_text = "\n".join([f"{m['role']}: {m['content']}" for m in recent_messages])
            
            prompt = f"Resume los puntos clave de esta conversación con {user_id} en 3 frases cortas:\n{context_text}"
            
            import requests
            response = requests.post(
                f"{ai_engine.ollama_url}/api/generate",
                json={"model": ai_engine.model, "prompt": prompt, "stream": False},
                timeout=15
            )
            
            if response.status_code == 200:
                summary = response.json().get("response", "")
                self.update_preference(user_id, "conversation_summary", summary)
                print(f"Resumen generado y guardado: {summary}")
        except Exception as e:
            print(f"Error generando resumen: {e}")

    def add_emotional_state(self, user_id: str, emotional_state: EmotionalState):
        """Agrega un estado emocional al historial en SQLite"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO emotional_history (user_id, emotion, intensity, reason, timestamp) VALUES (?, ?, ?, ?, ?)",
            (user_id, emotional_state.emotion.value, emotional_state.intensity, emotional_state.reason, emotional_state.timestamp.isoformat())
        )
        conn.commit()
        conn.close()

    def get_conversation_context(self, user_id: str, max_messages: int = 10) -> List[Dict]:
        """Obtiene los últimos mensajes de conversación en orden cronológico"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        # Obtener los últimos en orden descendente y luego invertirlos
        cursor.execute(
            "SELECT role, content, timestamp, emotion FROM messages WHERE user_id = ? ORDER BY id DESC LIMIT ?",
            (user_id, max_messages)
        )
        rows = cursor.fetchall()
        conn.close()
        
        formatted_messages = []
        for row in reversed(rows):
            formatted_messages.append({
                "role": row[0],
                "content": row[1],
                "timestamp": row[2],
                "emotion": row[3]
            })
        return formatted_messages

    def update_preference(self, user_id: str, key: str, value: any):
        """Guarda o actualiza una preferencia en SQLite"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT OR REPLACE INTO preferences (user_id, key, value) VALUES (?, ?, ?)",
            (user_id, key, str(value))
        )
        conn.commit()
        conn.close()

    def get_preference(self, user_id: str, key: str, default=None) -> Optional[str]:
        """Obtiene una preferencia de SQLite"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM preferences WHERE user_id = ? AND key = ?", (user_id, key))
        row = cursor.fetchone()
        conn.close()
        return row[0] if row else default

    def get_emotional_summary(self, user_id: str) -> str:
        """Calcula el estado emocional dominante del usuario"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT emotion FROM emotional_history WHERE user_id = ? ORDER BY id DESC LIMIT 5",
            (user_id,)
        )
        rows = cursor.fetchall()
        conn.close()
        
        if not rows:
            return "No hay historial emocional previo."
        
        emotions = [row[0] for row in rows]
        emotion_counts = {}
        for emotion in emotions:
            emotion_counts[emotion] = emotion_counts.get(emotion, 0) + 1
            
        dominant_emotion = max(emotion_counts, key=emotion_counts.get)
        return f"Emoción dominante reciente: {dominant_emotion}"

    def get_conversation_summary(self, user_id: str) -> str:
        """Devuelve estadísticas y resumen del historial"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM messages WHERE user_id = ?", (user_id,))
        total_messages = cursor.fetchone()[0]
        
        cursor.execute("SELECT timestamp FROM messages WHERE user_id = ? ORDER BY id DESC LIMIT 1", (user_id,))
        last_row = cursor.fetchone()
        conn.close()
        
        if total_messages == 0:
            return "Primera conversación con el usuario."
            
        last_interaction = last_row[0] if last_row else ""
        try:
            dt = datetime.fromisoformat(last_interaction)
            formatted_date = dt.strftime('%Y-%m-%d %H:%M')
        except:
            formatted_date = last_interaction
            
        return f"Total de mensajes: {total_messages}. Última interacción: {formatted_date}"

    def get_semantic_memories(self, user_id: str, query: str, limit: int = 3) -> List[str]:
        """Realiza una búsqueda semántica de recuerdos relevantes en ChromaDB"""
        try:
            if self.chroma_collection.count() == 0:
                return []
                
            results = self.chroma_collection.query(
                query_texts=[query],
                n_results=limit,
                where={"user_id": user_id}
            )
            
            documents = results.get("documents", [])
            return documents[0] if documents else []
        except Exception as e:
            print(f"Error realizando consulta de memoria semántica: {e}")
            return []

    def clear_memory(self, user_id: str):
        """Borra el historial de mensajes, el historial emocional y las memorias semánticas en ChromaDB para el usuario"""
        # 1. Borrar de SQLite
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM messages WHERE user_id = ?", (user_id,))
        cursor.execute("DELETE FROM emotional_history WHERE user_id = ?", (user_id,))
        conn.commit()
        conn.close()
        
        # 2. Borrar de ChromaDB
        try:
            self.chroma_collection.delete(where={"user_id": user_id})
        except Exception as e:
            print(f"Error borrando memorias semánticas de ChromaDB: {e}")
