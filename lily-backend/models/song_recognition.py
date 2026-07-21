"""
Motor de reconocimiento de canciones para Lily
Usa shazamio (servicio de Shazam) - gratis, sin API key.
"""
import os


class SongRecognitionEngine:
    def __init__(self):
        self.available = False
        try:
            from shazamio import Shazam
            self.shazam = Shazam()
            self.available = True
            print("Motor de reconocimiento de canciones (Shazam) listo.")
        except ImportError:
            self.shazam = None
            print("Advertencia: shazamio no instalado. Ejecuta: pip install shazamio")

    async def recognize(self, audio_path: str) -> dict:
        """
        Reconoce una cancion desde un archivo de audio.
        Devuelve: {found, title, artist, album, cover_url, message}
        """
        if not self.available:
            return {
                "found": False,
                "message": "El reconocimiento de canciones no esta disponible. Instala shazamio."
            }

        if not os.path.exists(audio_path):
            return {"found": False, "message": "No se recibio el audio."}

        try:
            result = await self.shazam.recognize(audio_path)
        except AttributeError:
            # Versiones antiguas de shazamio usan recognize_song
            result = await self.shazam.recognize_song(audio_path)
        except Exception as e:
            return {
                "found": False,
                "message": f"Error al reconocer la cancion: {e}"
            }

        track = result.get("track")
        if not track:
            return {
                "found": False,
                "message": "No pude reconocer la cancion. Acerca mas el microfono a la musica e intenta de nuevo."
            }

        title = track.get("title", "Desconocido")
        artist = track.get("subtitle", "Artista desconocido")

        # Album y portada (si vienen en los metadatos)
        album = None
        for section in track.get("sections", []):
            for meta in section.get("metadata", []):
                if meta.get("title") == "Album":
                    album = meta.get("text")
                    break

        cover_url = track.get("images", {}).get("coverart")

        return {
            "found": True,
            "title": title,
            "artist": artist,
            "album": album,
            "cover_url": cover_url,
            "message": f"La cancion es \"{title}\" de {artist}."
        }
