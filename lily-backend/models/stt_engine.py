import os
import time
from faster_whisper import WhisperModel

class STTEngine:
    """Motor de reconocimiento de voz (Speech-to-Text) usando Faster Whisper"""
    
    def __init__(self, model_size: str = "base", device: str = "cpu", compute_type: str = "int8"):
        self.model_size = model_size
        self.device = device
        self.compute_type = compute_type
        self.model = None
        self.loading = False
        self.error_msg = None
        
        import threading
        threading.Thread(target=self._load_model_async, daemon=True).start()

    def _load_model_async(self):
        self.loading = True
        print(f"Cargando modelo Whisper ({self.model_size}) en {self.device} (segundo plano)...")
        try:
            # 1. Intentar cargar localmente en el dispositivo solicitado sin conexión a internet
            self.model = WhisperModel(self.model_size, device=self.device, compute_type=self.compute_type, local_files_only=True)
            print(f"Modelo Whisper cargado correctamente (modo local) en {self.device}.")
        except Exception as e:
            print(f"No se pudo cargar localmente en {self.device} ({e}). Intentando con conexión a red...")
            try:
                # 2. Intentar descargar/verificar en red
                self.model = WhisperModel(self.model_size, device=self.device, compute_type=self.compute_type, local_files_only=False)
                print(f"Modelo Whisper cargado/descargado correctamente en {self.device}.")
            except Exception as e_net:
                if self.device != "cpu":
                    print(f"Fallo en {self.device} con red ({e_net}). Probando en CPU local...")
                    try:
                        # 3. Intentar CPU local sin red
                        self.model = WhisperModel(self.model_size, device="cpu", compute_type="int8", local_files_only=True)
                        print("Modelo Whisper cargado correctamente (modo local) en CPU.")
                        self.loading = False
                        return
                    except Exception as e_cpu_local:
                        print(f"Fallo CPU local ({e_cpu_local}). Probando CPU con red...")
                        try:
                            # 4. Intentar CPU con red
                            self.model = WhisperModel(self.model_size, device="cpu", compute_type="int8", local_files_only=False)
                            print("Modelo Whisper cargado/descargado en CPU.")
                            self.loading = False
                            return
                        except Exception as e_cpu_net:
                            e = e_cpu_net
                print(f"Error cargando Whisper: {e}")
                self.error_msg = str(e)
                self.model = None
        self.loading = False

    def transcribe(self, audio_file_path: str, language: str = None) -> str:
        """Transcribe un archivo de audio a texto"""
        # Esperar a que cargue si está en proceso
        timeout = 30
        start_time = time.time()
        while self.loading and not self.model and (time.time() - start_time) < timeout:
            time.sleep(0.5)

        if not self.model:
            if self.loading:
                return "Error: El modelo Whisper aún se está cargando en segundo plano."
            return f"Error: Modelo Whisper no cargado. {self.error_msg or ''}"
            
        if not os.path.exists(audio_file_path):
            return "Error: Archivo de audio no encontrado."
            
        try:
            segments, info = self.model.transcribe(audio_file_path, beam_size=5, language=language)
            
            # Recopilar todos los segmentos
            text = " ".join([segment.text for segment in segments])
            return text.strip()
        except Exception as e:
            print(f"Error en transcripción: {e}")
            return f"Error transcribiendo: {str(e)}"
