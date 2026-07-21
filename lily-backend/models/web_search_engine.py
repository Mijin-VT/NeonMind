import requests
import os
import urllib.parse

class WebSearchEngine:
    """Motor de búsqueda en internet que soporta Searxng y fallbacks públicos"""
    
    def __init__(self):
        # URL de Searxng configurable por variable de entorno, con fallback
        self.searxng_url = os.environ.get("SEARXNG_URL", "http://127.0.0.1:8080")
        self.fallback_instances = [
            "https://search.privacydev.net",
            "https://searx.be",
            "https://searx.mx",
            "https://searx.work"
        ]

    def search(self, query: str, limit: int = 3) -> list:
        """
        Busca en internet y devuelve una lista de resultados con título, contenido y URL.
        
        Args:
            query: Término de búsqueda
            limit: Número máximo de resultados
            
        Returns:
            List[Dict] con las claves: 'title', 'snippet', 'url'
        """
        # 1. Intentar con la instancia de Searxng configurada (local o preferida)
        results = self._query_searxng(self.searxng_url, query, limit)
        if results:
            print(f"Búsqueda exitosa usando Searxng principal: {self.searxng_url}")
            return results
            
        # 2. Intentar con las instancias públicas de fallback
        for instance in self.fallback_instances:
            results = self._query_searxng(instance, query, limit)
            if results:
                print(f"Búsqueda exitosa usando Searxng fallback: {instance}")
                return results
                
        # 3. Fallback final: Búsqueda simulada si no hay conexión a internet o fallan los Searxng
        print("Advertencia: No se pudo conectar a ningún motor de búsqueda Searxng.")
        return []

    def _query_searxng(self, base_url: str, query: str, limit: int) -> list:
        try:
            url = f"{base_url}/search"
            params = {
                "q": query,
                "format": "json",
                "pageno": 1,
                "language": "es-ES"
            }
            # Timeout corto para no bloquear la respuesta si una instancia está caída
            response = requests.get(url, params=params, timeout=4)
            if response.status_code == 200:
                data = response.json()
                raw_results = data.get("results", [])
                formatted = []
                
                for r in raw_results[:limit]:
                    title = r.get("title", "")
                    content = r.get("content", r.get("snippet", ""))
                    link = r.get("url", "")
                    
                    if title and (content or link):
                        formatted.append({
                            "title": title,
                            "snippet": content,
                            "url": link
                        })
                return formatted
        except Exception as e:
            # Silenciar errores individuales de conexión a instancias caídas
            pass
        return []
