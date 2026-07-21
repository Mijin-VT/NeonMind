import chromadb
from chromadb.utils import embedding_functions
import os
import uuid
import re
from datetime import datetime
from typing import List, Dict, Optional, Tuple
from pathlib import Path


class RAGEngine:
    """Motor RAG (Retrieval-Augmented Generation) completo con ingestion de documentos"""

    def __init__(self, persist_dir: str = "data/chroma_db", knowledge_dir: str = "knowledge"):
        self.persist_dir = persist_dir
        self.knowledge_dir = knowledge_dir

        # Crear directorios si no existen
        os.makedirs(persist_dir, exist_ok=True)
        os.makedirs(knowledge_dir, exist_ok=True)

        # Inicializar cliente de Chroma
        self.client = chromadb.PersistentClient(path=persist_dir)

        # Funcion de embedding (Sentence Transformers)
        # Usamos un modelo multilingüe ligero
        self.embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name="paraphrase-multilingual-MiniLM-L12-v2"
        )

        # Obtener o crear colección
        self.collection = self.client.get_or_create_collection(
            name="lily_knowledge",
            embedding_function=self.embedding_fn
        )
        
        # Umbral de similitud mínimo para resultados relevantes
        self.similarity_threshold = 0.085
        
        # Tamaño de chunks y solapamiento
        self.chunk_size = 500
        self.chunk_overlap = 50
        
        print(f"RAG Engine inicializado. Colección 'lily_knowledge' con {self.collection.count()} documentos.")

    def _split_text_into_chunks(self, text: str, chunk_size: int = None, overlap: int = None) -> List[str]:
        """Divide texto en chunks con solapamiento para mejor contexto"""
        if chunk_size is None:
            chunk_size = self.chunk_size
        if overlap is None:
            overlap = self.chunk_overlap

        # Dividir por párrafos primero
        paragraphs = text.split('\n\n')
        chunks = []
        current_chunk = ""
        
        for para in paragraphs:
            para = para.strip()
            if not para:
                continue
                
            # Si el párrafo cabe en el chunk actual
            if len(current_chunk) + len(para) <= chunk_size:
                current_chunk += "\n\n" + para if current_chunk else para
            else:
                # Guardar chunk actual si existe
                if current_chunk:
                    chunks.append(current_chunk.strip())
                
                # Si el párrafo es más grande que chunk_size, dividirlo
                if len(para) > chunk_size:
                    # Dividir por oraciones
                    sentences = re.split(r'(?<=[.!?]) +', para)
                    current_chunk = ""
                    
                    for sentence in sentences:
                        if len(current_chunk) + len(sentence) <= chunk_size:
                            current_chunk += " " + sentence if current_chunk else sentence
                        else:
                            if current_chunk:
                                chunks.append(current_chunk.strip())
                            # Solapamiento: tomar últimas palabras del chunk anterior
                            if overlap > 0 and current_chunk:
                                words = current_chunk.split()
                                overlap_words = words[-(overlap // 10):] if len(words) > overlap // 10 else words
                                current_chunk = " ".join(overlap_words) + " " + sentence
                            else:
                                current_chunk = sentence
                else:
                    current_chunk = para
        
        # Agregar último chunk
        if current_chunk:
            chunks.append(current_chunk.strip())
        
        # Si no hay chunks, crear uno con todo el texto
        if not chunks and text.strip():
            chunks.append(text.strip())
        
        return chunks

    def add_document(self, text: str, metadata: Dict = None, doc_id: str = None, 
                     chunk: bool = True, source: str = "manual") -> List[str]:
        """Agrega un documento a la base de datos vectorial con chunking opcional"""
        if doc_id is None:
            doc_id = str(uuid.uuid4())

        if metadata is None:
            metadata = {}

        # Agregar metadatos automáticos si no existen
        if "timestamp" not in metadata:
            metadata["timestamp"] = datetime.now().isoformat()
        if "source" not in metadata:
            metadata["source"] = source
        if "type" not in metadata:
            metadata["type"] = "document"

        # Dividir en chunks si se solicita
        if chunk and len(text) > self.chunk_size:
            chunks = self._split_text_into_chunks(text)
            doc_ids = []
            
            for i, chunk_text in enumerate(chunks):
                chunk_id = f"{doc_id}_chunk_{i}"
                chunk_metadata = metadata.copy()
                chunk_metadata["chunk_index"] = i
                chunk_metadata["total_chunks"] = len(chunks)
                chunk_metadata["doc_id"] = doc_id
                
                self.collection.add(
                    documents=[chunk_text],
                    metadatas=[chunk_metadata],
                    ids=[chunk_id]
                )
                doc_ids.append(chunk_id)
            
            print(f"Documento '{doc_id}' agregado: {len(chunks)} chunks creados")
            return doc_ids
        else:
            # Documento pequeño, agregar como un solo chunk
            self.collection.add(
                documents=[text],
                metadatas=[metadata],
                ids=[doc_id]
            )
            print(f"Documento '{doc_id}' agregado")
            return [doc_id]

    def add_conversation_turn(self, user_text: str, assistant_text: str):
        """Agrega un turno de conversación (Q&A) al contexto"""
        text = f"User: {user_text}\nLily: {assistant_text}"
        self.add_document(
            text, 
            metadata={
                "type": "conversation", 
                "timestamp": datetime.now().isoformat(),
                "user": user_text[:100]  # Primeros 100 chars como referencia
            },
            source="conversation",
            chunk=False  # Conversaciones suelen ser cortas
        )

    def query(self, query_text: str, n_results: int = 3, min_similarity: float = None) -> Tuple[List[str], List[Dict]]:
        """
        Busca documentos relevantes para la consulta
        Retorna: (documentos, metadatos)
        """
        if min_similarity is None:
            min_similarity = self.similarity_threshold
            
        try:
            results = self.collection.query(
                query_texts=[query_text],
                n_results=n_results * 2,  # Pedir más para filtrar por relevancia
                include=['documents', 'metadatas', 'distances']
            )

            if results and results['documents']:
                documents = []
                metadatas = []
                
                # Filtrar por umbral de similitud
                for i, (doc, meta, distance) in enumerate(zip(
                    results['documents'][0], 
                    results['metadatas'][0],
                    results['distances'][0]
                )):
                    # ChromaDB devuelve distancia (menor = más similar)
                    # Convertir a similitud aproximada
                    similarity = 1.0 / (1.0 + distance)
                    
                    # Para distancia L2 y embeddings no normalizados, la distancia es grande.
                    # Filtramos usando el umbral calibrado (0.085) para permitir fallback a internet en consultas irrelevantes
                    if similarity >= min_similarity:
                        documents.append(doc)
                        meta_with_similarity = meta.copy() if meta else {}
                        meta_with_similarity["similarity"] = round(similarity, 3)
                        meta_with_similarity["relevance_rank"] = i + 1
                        metadatas.append(meta_with_similarity)
                        
                        if len(documents) >= n_results:
                            break
                
                print(f"RAG: {len(documents)} documentos relevantes encontrados (de {len(results['documents'][0])} candidatos)")
                return documents, metadatas
            
            return [], []
        except Exception as e:
            print(f"Error en consulta RAG: {e}")
            import traceback
            traceback.print_exc()
            return [], []

    def ingest_file(self, file_path: str, doc_id: str = None, metadata: Dict = None) -> List[str]:
        """Ingesta un archivo (PDF, TXT, MD) completo"""
        if not os.path.exists(file_path):
            print(f"ERROR: Archivo no encontrado: {file_path}")
            return []

        # Detectar tipo de archivo
        ext = os.path.splitext(file_path)[1].lower()
        filename = os.path.basename(file_path)
        
        if doc_id is None:
            doc_id = f"{os.path.splitext(filename)[0]}_{uuid.uuid4().hex[:8]}"

        if metadata is None:
            metadata = {}
        
        # Agregar metadatos del archivo
        metadata["filename"] = filename
        metadata["file_path"] = file_path
        metadata["file_size"] = os.path.getsize(file_path)
        metadata["source"] = "file_ingestion"
        metadata["file_type"] = ext
        metadata["ingested_at"] = datetime.now().isoformat()

        try:
            text = ""
            
            if ext == '.txt' or ext == '.md':
                with open(file_path, 'r', encoding='utf-8') as f:
                    text = f.read()
                    
            elif ext == '.pdf':
                # Intentar con PyPDF2 primero, luego con pdfplumber
                try:
                    import PyPDF2
                    with open(file_path, 'rb') as f:
                        reader = PyPDF2.PdfReader(f)
                        text = "\n".join([page.extract_text() for page in reader.pages if page.extract_text()])
                except ImportError:
                    try:
                        import pdfplumber
                        with pdfplumber.open(file_path) as pdf:
                            text = "\n".join([page.extract_text() for page in pdf.pages if page.extract_text()])
                    except ImportError:
                        print("ADVERTENCIA: Para leer PDF necesitas instalar PyPDF2 o pdfplumber:")
                        print("  pip install PyPDF2")
                        return []
            
            elif ext == '.docx':
                try:
                    from docx import Document
                    doc = Document(file_path)
                    text = "\n".join([para.text for para in doc.paragraphs])
                except ImportError:
                    print("ADVERTENCIA: Para leer DOCX necesitas instalar python-docx:")
                    print("  pip install python-docx")
                    return []
            else:
                print(f"ADVERTENCIA: Tipo de archivo no soportado: {ext}")
                return []

            if not text.strip():
                print(f"ADVERTENCIA: Archivo vacío: {filename}")
                return []

            print(f"Ingestando archivo: {filename} ({len(text)} caracteres)")
            return self.add_document(text, metadata=metadata, doc_id=doc_id, source="file_ingestion")

        except Exception as e:
            print(f"ERROR ingentiendo archivo {filename}: {e}")
            import traceback
            traceback.print_exc()
            return []

    def ingest_directory(self, dir_path: str = None, recursive: bool = True) -> int:
        """Ingesta todos los archivos soportados en un directorio"""
        if dir_path is None:
            dir_path = self.knowledge_dir
        
        if not os.path.exists(dir_path):
            print(f"Creando directorio de conocimiento: {dir_path}")
            os.makedirs(dir_path, exist_ok=True)
            return 0

        supported_extensions = {'.txt', '.md', '.pdf', '.docx'}
        files_ingested = 0
        total_docs_before = self.collection.count()

        print(f"\nEscaneando directorio: {dir_path}")
        
        # Recorrer directorio
        if recursive:
            for root, dirs, files in os.walk(dir_path):
                for file in files:
                    file_path = os.path.join(root, file)
                    ext = os.path.splitext(file)[1].lower()
                    
                    if ext in supported_extensions:
                        self.ingest_file(file_path)
                        files_ingested += 1
        else:
            for file in os.listdir(dir_path):
                file_path = os.path.join(dir_path, file)
                if os.path.isfile(file_path):
                    ext = os.path.splitext(file)[1].lower()
                    if ext in supported_extensions:
                        self.ingest_file(file_path)
                        files_ingested += 1

        total_docs_after = self.collection.count()
        print(f"\nIngestión completada: {files_ingested} archivos procesados")
        print(f"Documentos en base de conocimiento: {total_docs_before} -> {total_docs_after}")
        
        return files_ingested

    def delete_document(self, doc_id: str) -> bool:
        """Elimina un documento y todos sus chunks"""
        try:
            # Buscar todos los chunks de este documento
            results = self.collection.get(
                where={"doc_id": doc_id},
                include=['metadatas']
            )
            
            if results and results['ids']:
                # Eliminar todos los chunks
                self.collection.delete(ids=results['ids'])
                print(f"Documento '{doc_id}' eliminado ({len(results['ids'])} chunks)")
                return True
            else:
                # Intentar eliminar como documento único
                self.collection.delete(ids=[doc_id])
                print(f"Documento '{doc_id}' eliminado")
                return True
        except Exception as e:
            print(f"Error eliminando documento '{doc_id}': {e}")
            return False
    def get_knowledge_stats(self) -> Dict:
        """Obtiene estadísticas del conocimiento indexado"""
        try:
            # Obtener todos los metadatos
            count = self.collection.count()
            
            # Obtener muestra de metadatos para análisis
            sample = self.collection.get(limit=min(count, 5000), include=['metadatas'])
            
            non_conversation_chunks = 0
            unique_docs = set()
            
            stats = {
                "total_documents": 0,
                "total_chunks": 0,
                "by_type": {},
                "by_source": {},
                "by_file_type": {},
                "last_update": None
            }
            
            if sample and sample.get('metadatas'):
                for doc_id, meta in zip(sample['ids'], sample['metadatas']):
                    if not meta:
                        continue
                    
                    # Excluir conversaciones de las estadísticas del RAG
                    doc_type = meta.get('type', 'unknown')
                    source = meta.get('source', 'unknown')
                    if doc_type == 'conversation' or source == 'conversation':
                        continue
                        
                    non_conversation_chunks += 1
                    
                    # Identificar documento único
                    unique_doc_id = meta.get('doc_id') or source or doc_id.split('_chunk_')[0]
                    unique_docs.add(unique_doc_id)
                    
                    # Contar por tipo
                    stats["by_type"][doc_type] = stats["by_type"].get(doc_type, 0) + 1
                    
                    # Contar por fuente
                    stats["by_source"][source] = stats["by_source"].get(source, 0) + 1
                    
                    # Contar por tipo de archivo
                    file_type = meta.get('file_type', 'N/A')
                    stats["by_file_type"][file_type] = stats["by_file_type"].get(file_type, 0) + 1
                    
                    # Última actualización
                    timestamp = meta.get('timestamp') or meta.get('ingested_at')
                    if timestamp and (stats["last_update"] is None or timestamp > stats["last_update"]):
                        stats["last_update"] = timestamp
            
            stats["total_documents"] = len(unique_docs)
            stats["total_chunks"] = non_conversation_chunks
            return stats
            
        except Exception as e:
            print(f"Error obteniendo estadísticas: {e}")
            return {"total_documents": 0, "total_chunks": 0, "error": str(e)}

    def list_documents(self, limit: int = 20) -> List[Dict]:
        """Lista documentos indexados con sus metadatos"""
        try:
            # Pedimos más elementos para asegurarnos de encontrar los documentos reales tras filtrar
            results = self.collection.get(
                limit=1000,
                include=['metadatas']
            )
            
            documents = []
            seen_doc_ids = set()
            
            if results and results.get('metadatas'):
                for i, (doc_id, meta) in enumerate(zip(results['ids'], results['metadatas'])):
                    meta_dict = meta or {}
                    
                    # Filtrar memorias de conversación
                    if meta_dict.get("type") == "conversation" or meta_dict.get("source") == "conversation":
                        continue
                        
                    doc_base_id = meta_dict.get("doc_id") or doc_id.split('_chunk_')[0]
                    filename = meta_dict.get("filename") or meta_dict.get("source") or doc_base_id
                    
                    if doc_base_id in seen_doc_ids:
                        continue
                        
                    seen_doc_ids.add(doc_base_id)
                    
                    # Copiar metadatos y asegurar el conteo de chunks
                    meta_copy = meta_dict.copy()
                    meta_copy["chunks"] = meta_copy.get("total_chunks", 1)
                    meta_copy["source"] = filename
                    
                    doc_info = {
                        "id": doc_base_id,
                        "metadata": meta_copy
                    }
                    documents.append(doc_info)
                    
                    if len(documents) >= limit:
                        break
                        
            return documents
        except Exception as e:
            print(f"Error listando documentos: {e}")
            return []

    def set_similarity_threshold(self, threshold: float):
        """Configura el umbral de similitud mínimo"""
        self.similarity_threshold = max(0.0, min(1.0, threshold))
        print(f"Umbral de similitud configurado: {self.similarity_threshold}")

    def set_chunk_size(self, chunk_size: int, overlap: int = None):
        """Configura tamaño de chunks y solapamiento"""
        self.chunk_size = max(100, chunk_size)
        if overlap is not None:
            self.chunk_overlap = max(0, min(overlap, chunk_size // 2))
        print(f"Chunk size: {self.chunk_size}, Overlap: {self.chunk_overlap}")
