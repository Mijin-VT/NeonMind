import speech_recognition as sr
import threading
import time
from typing import Callable, Optional


class WakeWordEngine:
    """Motor para la detección de palabras clave (Wake Word) como 'LILY'"""

    def __init__(self, wake_word_callback: Optional[Callable] = None, wake_word: str = "LILY"):
        self.wake_word_callback = wake_word_callback
        self.wake_word = wake_word.upper()  # Convertir a mayúsculas para comparación
        self.is_listening = False
        self.listening_thread = None

        # Configurar el reconocedor de voz
        self.recognizer = sr.Recognizer()
        self.microphone = sr.Microphone()

        # Ajustar el umbral de energía para el micrófono
        with self.microphone as source:
            self.recognizer.adjust_for_ambient_noise(source)

        # Configuración de sensibilidad
        self.recognizer.energy_threshold = 3000  # Ajustar según ambiente
        self.recognizer.dynamic_energy_threshold = True
        self.recognizer.pause_threshold = 0.8   # Tiempo de pausa antes de considerar finalización

    def start_listening(self):
        """Comienza a escuchar la palabra clave"""
        if self.is_listening:
            print("La escucha ya está activa")
            return

        self.is_listening = True
        self.listening_thread = threading.Thread(target=self._listen_loop)
        self.listening_thread.daemon = True
        self.listening_thread.start()
        print(f"Escuchando palabra clave '{self.wake_word}'...")

    def stop_listening(self):
        """Detiene la escucha de la palabra clave"""
        self.is_listening = False
        if self.listening_thread:
            self.listening_thread.join()
        print("Escucha detenida")

    def _listen_loop(self):
        """Bucle principal de escucha"""
        try:
            with self.microphone as source:
                while self.is_listening:
                    try:
                        # Escuchar audio del micrófono
                        audio = self.recognizer.listen(source, timeout=2, phrase_time_limit=3)

                        try:
                            # Intentar reconocer el audio usando Google
                            text = self.recognizer.recognize_google(audio, language="es-ES")
                            print(f"Texto reconocido: {text}")

                            # Verificar si la palabra clave está en el texto
                            if self.wake_word.lower() in text.lower():
                                print(f"¡Palabra clave '{self.wake_word}' detectada!")
                                if self.wake_word_callback:
                                    self.wake_word_callback()
                                time.sleep(2)  # Pequeño delay para evitar múltiples detecciones rápidas

                        except sr.UnknownValueError:
                            # No se pudo reconocer el audio, continuar escuchando
                            pass
                        except sr.RequestError:
                            # Error en la solicitud a Google, continuar escuchando
                            print("Error en la solicitud de reconocimiento de voz")
                            time.sleep(1)

                    except sr.WaitTimeoutError:
                        # No se detectó audio en el timeout, continuar escuchando
                        continue
                    except Exception as e:
                        print(f"Error en la escucha (interno): {e}")
                        time.sleep(1)
        except Exception as e:
            print(f"Error abriendo el micrófono: {e}")

    def set_callback(self, callback: Callable):
        """Establece la función de callback a ejecutar al detectar la palabra clave"""
        self.wake_word_callback = callback


    def __del__(self):
        """Limpieza de recursos"""
        pass