import sqlite3
import os
from models.rag_engine import RAGEngine

def sync_links_and_notes(rag_engine: RAGEngine, db_path: str = "../links.db"):
    """
    Sincroniza la base de datos de enlaces y notas de la Bóveda de Links
    con la base de datos vectorial ChromaDB de Lily para RAG local.
    """
    # Intentar resolver la ruta relativa
    # Si se ejecuta desde lily-backend/, la base de datos está en ../links.db
    # Si se ejecuta desde el directorio raíz, está en links.db
    resolved_db_path = db_path
    if not os.path.exists(resolved_db_path):
        resolved_db_path = "links.db"
        
    if not os.path.exists(resolved_db_path):
        print(f"[Link Connector] Base de datos no encontrada en '{db_path}' ni en 'links.db'. Saltando sincronización.")
        return
        
    print(f"[Link Connector] Conectando a la base de datos de la Bóveda en: {resolved_db_path}")
    
    try:
        conn = sqlite3.connect(resolved_db_path)
        cursor = conn.cursor()
        
        # Limpiar todas las entradas previas sincronizadas de la Bóveda de Links en ChromaDB
        # para evitar duplicaciones o enlaces eliminados persistentes.
        try:
            rag_engine.collection.delete(where={"source": "vault_db"})
            print("[Link Connector] Índice de ChromaDB previo para 'vault_db' limpiado.")
        except Exception as e:
            print(f"[Link Connector] Advertencia al limpiar registros anteriores: {e}")
        
        # 1. Sincronizar Enlaces (Links)
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='links'")
        if cursor.fetchone():
            cursor.execute("SELECT id, title, url, description, category, favorite, created_at FROM links")
            links = cursor.fetchall()
            print(f"[Link Connector] Sincronizando {len(links)} enlaces...")
            for link in links:
                lid, title, url, desc, cat, fav, created = link
                text_content = f"Enlace guardado:\nTítulo: {title}\nURL: {url}\nCategoría: {cat or 'General'}\nDescripción: {desc or 'Sin descripción'}\nCreado: {created}"
                doc_id = f"link_{lid}"
                
                metadata = {
                    "type": "vault_link",
                    "link_id": lid,
                    "title": title,
                    "url": url,
                    "category": cat or "General",
                    "favorite": bool(fav),
                    "source": "vault_db"
                }
                
                rag_engine.add_document(
                    text=text_content,
                    metadata=metadata,
                    doc_id=doc_id,
                    chunk=True,
                    source="vault_db"
                )
                
        # 2. Sincronizar Notas (Notes)
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='notes'")
        if cursor.fetchone():
            cursor.execute("SELECT id, title, content, color, created_at FROM notes")
            notes = cursor.fetchall()
            print(f"[Link Connector] Sincronizando {len(notes)} notas...")
            for note in notes:
                nid, title, content, color, created = note
                text_content = f"Nota guardada:\nTítulo: {title}\nContenido:\n{content}\nColor de etiqueta: {color or 'Sin color'}\nCreado: {created}"
                doc_id = f"note_{nid}"
                
                metadata = {
                    "type": "vault_note",
                    "note_id": nid,
                    "title": title,
                    "color": color or "default",
                    "source": "vault_db"
                }
                
                rag_engine.add_document(
                    text=text_content,
                    metadata=metadata,
                    doc_id=doc_id,
                    chunk=True,
                    source="vault_db"
                )
                
        conn.close()
        print("[Link Connector] Sincronización con Bóveda de Links completada.")
    except Exception as e:
        print(f"[Link Connector] Error durante la sincronización: {e}")
