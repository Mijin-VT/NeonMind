import os
import hashlib
import random
import numpy as np
import requests
import traceback
from pydub import AudioSegment

try:
    from kokoro_onnx import Kokoro
    KOKORO_AVAILABLE = True
except ImportError:
    KOKORO_AVAILABLE = False


class TTSEngine:
    """Motor de texto a voz con personalización de voz usando Kokoro y fallback a gTTS"""
    
    def __init__(self, audio_dir: str = "static/audio", reference_audio_dir: str = "audio_samples"):
        self.audio_dir = audio_dir
        self.reference_audio_dir = reference_audio_dir
        os.makedirs(audio_dir, exist_ok=True)
        
        # Rutas de modelos Kokoro
        self.model_path = os.path.join("models", "kokoro-v1.0.onnx")
        self.voices_path = os.path.join("models", "voices-v1.0.bin")
        self.kokoro = None
        
        # Parámetros de voz basados en análisis de muestras
        self.voice_params = {
            "speed": 1.1,  # Ligeramente más rápido
            "pitch_shift": 2,  # Tono más alto (voz femenina)
            "emotion_modifiers": {
                "feliz": {"speed": 1.15, "pitch": 3},
                "triste": {"speed": 0.9, "pitch": -1},
                "enojada": {"speed": 1.2, "pitch": 1},
                "emocionada": {"speed": 1.25, "pitch": 4},
                "neutral": {"speed": 1.1, "pitch": 2},
                "cariñosa": {"speed": 1.0, "pitch": 3},
                "juguetona": {"speed": 1.2, "pitch": 3},
                "preocupada": {"speed": 0.95, "pitch": 1},
                "sorprendida": {"speed": 1.15, "pitch": 4}
            }
        }
        
        # Inicializar Kokoro en segundo plano para evitar congelamientos en el primer arranque
        if KOKORO_AVAILABLE:
            import threading
            threading.Thread(target=self.init_kokoro, daemon=True).start()
        else:
            print("Librería kokoro-onnx no disponible. No se podrán generar respuestas de voz.")
            
    def download_models(self):
        """Descarga los modelos necesarios de Kokoro desde GitHub de forma segura"""
        model_url = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx"
        voices_url = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin"
        
        os.makedirs("models", exist_ok=True)
        
        def download_file(url, dest):
            if os.path.exists(dest):
                return
            print(f"Descargando archivo necesario de Kokoro: {os.path.basename(dest)}...")
            try:
                r = requests.get(url, stream=True)
                r.raise_for_status()
                with open(dest, 'wb') as f:
                    for chunk in r.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)
                print(f"Archivo {os.path.basename(dest)} descargado con éxito.")
            except Exception as e:
                print(f"Error al descargar {url}: {e}")
                if os.path.exists(dest):
                    os.remove(dest)
                raise e

        try:
            download_file(model_url, self.model_path)
            download_file(voices_url, self.voices_path)
        except Exception as e:
            print(f"Fallo al descargar los archivos del modelo Kokoro: {e}")
            raise e

    def init_kokoro(self):
        """Inicializa el motor de Kokoro TTS, descargando los modelos si es necesario"""
        try:
            if not os.path.exists(self.model_path) or not os.path.exists(self.voices_path):
                self.download_models()
            
            print("Cargando modelo Kokoro TTS en ONNX...")
            self.kokoro = Kokoro(self.model_path, self.voices_path)
            print("Motor Kokoro TTS cargado exitosamente.")
        except Exception as e:
            print(f"No se pudo inicializar Kokoro TTS. Error: {e}")
            self.kokoro = None
    
    def generate_audio_filename(self, text: str) -> str:
        """Genera un nombre de archivo único basado en el texto y timestamp"""
        import time
        timestamp = str(int(time.time() * 1000))
        text_hash = hashlib.md5((text + timestamp).encode()).hexdigest()[:8]
        return f"lily_{timestamp}_{text_hash}.mp3"
    
    def text_to_speech(self, text: str, emotion: str = "neutral", save: bool = True) -> str:
        """
        Convierte texto a voz con características emocionales usando Kokoro y fallback a gTTS
        
        Args:
            text: Texto a convertir
            emotion: Emoción para modular la voz
            save: Si guardar el archivo o no
            
        Returns:
            Ruta del archivo de audio generado
        """
        try:
            # Generar nombre de archivo
            filename = self.generate_audio_filename(f"{text}_{emotion}")
            output_path = os.path.join(self.audio_dir, filename)
            
            # Si ya existe, retornar
            if os.path.exists(output_path):
                return f"/static/audio/{filename}"
            
            # Obtener parámetros de emoción
            emotion_params = self.voice_params["emotion_modifiers"].get(
                emotion, 
                self.voice_params["emotion_modifiers"]["neutral"]
            )
            
            # INTENTO CON KOKORO ONNX (LOCAL)
            if not self.kokoro:
                raise Exception("El motor Kokoro ONNX no está inicializado.")
            
            # Generar audio con Kokoro
            samples, sample_rate = self.kokoro.create(
                text,
                voice="ef_dora",
                speed=emotion_params["speed"],
                lang="es"
            )
            
            # Convertir array float32 de numpy a 16-bit PCM bytes
            audio_bytes = (samples * 32767).astype(np.int16).tobytes()
            
            # Cargar a pydub
            audio = AudioSegment(
                data=audio_bytes,
                sample_width=2,
                frame_rate=sample_rate,
                channels=1
            )
            
            # Ajustar volumen según emoción
            volume_adjustments = {
                "feliz": 2,
                "enojada": 3,
                "emocionada": 4,
                "triste": -2,
                "preocupada": -1
            }
            
            volume_change = volume_adjustments.get(emotion, 0)
            if volume_change != 0:
                audio = audio + volume_change
                
            # Exportar archivo procesado como MP3
            audio.export(output_path, format="mp3", bitrate="128k")
            return f"/static/audio/{filename}"
            
        except Exception as e:
            print(f"Error generando audio con Kokoro: {e}")
            traceback.print_exc()
            return None
    
    def generate_speech_async(self, text: str, emotion: str = "neutral"):
        """
        Versión asíncrona para generar voz en background
        """
        return self.text_to_speech(text, emotion)
    
    def delete_audio_file(self, audio_url: str) -> bool:
        """Elimina un archivo de audio específico"""
        try:
            if audio_url:
                # Convertir URL a ruta de archivo
                audio_path = audio_url.replace("/static/audio/", "")
                full_path = os.path.join(self.audio_dir, audio_path)
                
                if os.path.exists(full_path):
                    os.remove(full_path)
                    print(f"Audio eliminado: {audio_path}")
                    return True
            return False
        except Exception as e:
            print(f"Error eliminando archivo de audio: {e}")
            return False
    
    def clean_old_audio_files(self, max_age_seconds: int = 300):
        """Limpia archivos de audio más antiguos que max_age_seconds (default: 5 minutos)"""
        try:
            import time
            current_time = time.time()
            audio_files = [
                f for f in os.listdir(self.audio_dir) 
                if f.startswith("lily_") and f.endswith(".mp3")
            ]
            
            deleted_count = 0
            for file in audio_files:
                file_path = os.path.join(self.audio_dir, file)
                file_age = current_time - os.path.getmtime(file_path)
                
                if file_age > max_age_seconds:
                    os.remove(file_path)
                    deleted_count += 1
            
            if deleted_count > 0:
                print(f"Limpiados {deleted_count} archivos de audio antiguos")
                
        except Exception as e:
            print(f"Error limpiando archivos de audio: {e}")
    
    def analyze_reference_audio(self):
        """
        Analiza los archivos de audio de referencia para extraer características
        """
        try:
            lily_audio = os.path.join(self.reference_audio_dir, "LILY.wav")
            lily2_audio = os.path.join(self.reference_audio_dir, "LILY2.wav")
            
            if os.path.exists(lily_audio):
                audio = AudioSegment.from_wav(lily_audio)
                duration = len(audio) / 1000.0  # en segundos
                
                print(f"Análisis de LILY.wav:")
                print(f"  - Duración: {duration:.2f}s")
                print(f"  - Canales: {audio.channels}")
                print(f"  - Frame rate: {audio.frame_rate}Hz")
                print(f"  - Sample width: {audio.sample_width} bytes")
                
            if os.path.exists(lily2_audio):
                audio = AudioSegment.from_wav(lily2_audio)
                duration = len(audio) / 1000.0
                
                print(f"Análisis de LILY2.wav:")
                print(f"  - Duración: {duration:.2f}s")
                print(f"  - Canales: {audio.channels}")
                print(f"  - Frame rate: {audio.frame_rate}Hz")
                print(f"  - Sample width: {audio.sample_width} bytes")
                
        except Exception as e:
            print(f"Error analizando audio de referencia: {e}")


# Instancia global
tts_engine = TTSEngine()
