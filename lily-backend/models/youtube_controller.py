import webbrowser
import urllib.parse
from typing import Optional


class YouTubeController:
    """Controlador para reproducir música en YouTube"""
    
    def __init__(self):
        self.browser_type = "msedge"  # Microsoft Edge por defecto
        self.current_query = None
        
    def search_and_play(self, query: str, autoplay: bool = True) -> dict:
        """
        Busca y reproduce música en YouTube
        
        Args:
            query: Término de búsqueda (artista, canción, etc.)
            autoplay: Si debe reproducir automáticamente
            
        Returns:
            Dict con status y mensaje
        """
        try:
            # Limpiar y codificar la búsqueda
            clean_query = query.strip()
            search_query = urllib.parse.quote(clean_query)
            
            # Construir URL
            # Usar /results para búsqueda, luego el usuario puede hacer clic
            # O usar watch?v= con un video específico para autoplay
            url = f"https://www.youtube.com/results?search_query={search_query}"
            
            # Abrir en navegador
            webbrowser.open(url)
            
            # Guardar la búsqueda actual
            self.current_query = clean_query
            
            return {
                "status": "success",
                "message": f"Buscando en YouTube: {clean_query}",
                "query": clean_query,
                "url": url
            }
            
        except Exception as e:
            return {
                "status": "error",
                "message": f"Error abriendo YouTube: {str(e)}",
                "query": query
            }
    
    def play_direct_video(self, video_id: str) -> dict:
        """
        Reproduce un video específico de YouTube
        
        Args:
            video_id: ID del video de YouTube
            
        Returns:
            Dict con status y mensaje
        """
        try:
            url = f"https://www.youtube.com/watch?v={video_id}&autoplay=1"
            webbrowser.open(url)
            
            return {
                "status": "success",
                "message": "Reproduciendo video",
                "video_id": video_id,
                "url": url
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Error reproduciendo video: {str(e)}",
                "video_id": video_id
            }
    
    def search_music(self, artist: Optional[str] = None, song: Optional[str] = None) -> dict:
        """
        Busca música específica por artista y/o canción
        
        Args:
            artist: Nombre del artista
            song: Nombre de la canción
            
        Returns:
            Dict con resultado de la búsqueda
        """
        # Construir query
        query_parts = []
        if artist:
            query_parts.append(artist)
        if song:
            query_parts.append(song)
        
        query = " ".join(query_parts)
        
        if not query:
            return {
                "status": "error",
                "message": "Necesito el nombre del artista o la canción"
            }
        
        return self.search_and_play(query)
    
    def get_current_query(self) -> Optional[str]:
        """Retorna la última búsqueda realizada"""
        return self.current_query
