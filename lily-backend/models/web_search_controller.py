import webbrowser
import urllib.parse

class WebSearchController:
    """Controlador para realizar búsquedas en internet abriendo el navegador"""
    
    def __init__(self):
        pass
        
    def search(self, query: str) -> dict:
        """
        Realiza una búsqueda en Google
        
        Args:
            query: Término de búsqueda
            
        Returns:
            Dict con status y mensaje
        """
        try:
            clean_query = query.strip()
            search_query = urllib.parse.quote(clean_query)
            url = f"https://www.google.com/search?q={search_query}"
            
            # Abrir en el navegador predeterminado
            webbrowser.open(url)
            
            return {
                "status": "success",
                "message": f"Buscando en internet: {clean_query}",
                "query": clean_query,
                "url": url
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Error realizando búsqueda: {str(e)}",
                "query": query
            }
