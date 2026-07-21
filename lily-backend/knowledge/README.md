# 📚 Base de Conocimiento de LILY

Este directorio contiene documentos que LILY puede usar como fuente de conocimiento.

## ¿Cómo funciona?

LILY utiliza el sistema **RAG (Retrieval-Augmented Generation)** para:
1. **Indexar** documentos en esta carpeta
2. **Buscar** información relevante cuando respondes preguntas
3. **Generar** respuestas basadas en el conocimiento indexado

## Formatos soportados

- ✅ **`.txt`** - Archivos de texto plano
- ✅ **`.md`** - Archivos Markdown
- ✅ **`.pdf`** - Documentos PDF (requiere `PyPDF2` o `pdfplumber`)
- ✅ **`.docx`** - Documentos Word (requiere `python-docx`)

## Cómo usar

### Opción 1: Colocar archivos manualmente
1. Copia tus archivos `.txt`, `.md`, `.pdf` o `.docx` aquí
2. Ejecuta: `INICIAR_LILY.bat`
3. LILY indexará automáticamente los archivos al iniciar

### Opción 2: Usar la interfaz web
1. Abre http://localhost:8000
2. Ve a la sección "Base de Conocimiento"
3. Sube archivos directamente

### Opción 3: Usar la API
```bash
# Ingestar todos los archivos en knowledge/
curl -X POST http://localhost:8000/api/rag/ingest-knowledge

# Subir un archivo específico
curl -X POST http://localhost:8000/api/rag/upload-document \
  -F "file=@mi_documento.pdf"

# Ver estadísticas
curl http://localhost:8000/api/rag/stats

# Consultar conocimiento
curl -X POST http://localhost:8000/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{"query": "¿Qué es la inteligencia artificial?", "n_results": 3}'
```

## Dependencias opcionales

Para leer todos los formatos, instala:

```bash
pip install PyPDF2 python-docx
# o
pip install pdfplumber python-docx
```

## Estructura recomendada

```
knowledge/
├── README.md              # Este archivo
├── manuales/              # Manuales y guías
│   ├── python_basico.md
│   └── guia_rapida.txt
├── apuntes/               # Notas y apuntes
│   ├── clase_ml.pdf
│   └── resumen_ia.md
└── uploads/               # Archivos subidos desde la web (auto-generado)
```

## Configuración avanzada

Puedes ajustar el RAG desde la API:

```bash
# Configurar umbral de similitud (0.0 - 1.0)
curl -X POST http://localhost:8000/api/rag/configure \
  -H "Content-Type: application/json" \
  -d '{"similarity_threshold": 0.5}'

# Configurar tamaño de chunks
curl -X POST http://localhost:8000/api/rag/configure \
  -H "Content-Type: application/json" \
  -d '{"chunk_size": 500, "chunk_overlap": 50}'
```

## Gestión de documentos

```bash
# Ver lista de documentos indexados
curl http://localhost:8000/api/rag/documents?limit=20

# Eliminar un documento
curl -X DELETE http://localhost:8000/api/rag/document/{doc_id}
```

## Consejos

- ✅ Usa archivos bien estructurados con títulos claros
- ✅ Divide documentos largos en secciones temáticas
- ✅ Actualiza el conocimiento regularmente
- ✅ Elimina documentos obsoletos para mejorar la calidad
