import pyautogui
import platform
from typing import Literal


class MediaController:
    """Controlador para medios de reproducción y volumen del sistema"""
    
    def __init__(self):
        self.system = platform.system()
        # Configurar pyautogui
        pyautogui.FAILSAFE = True  # Mover mouse a esquina para detener
        pyautogui.PAUSE = 0.1  # Pequeña pausa entre acciones
    
    def pause_play(self) -> dict:
        """
        Pausa/Reproduce el contenido actual
        Presiona la tecla Espacio
        
        Returns:
            Dict con status del comando
        """
        try:
            pyautogui.press('space')
            return {
                "status": "success",
                "message": "Pausa/Reproducción activada",
                "action": "pause_play"
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Error en pausa/play: {str(e)}",
                "action": "pause_play"
            }
    
    def next_video(self) -> dict:
        """
        Va al siguiente video (YouTube)
        Presiona Shift+N
        
        Returns:
            Dict con status del comando
        """
        try:
            # En YouTube, Shift+N va al siguiente video
            pyautogui.hotkey('shift', 'n')
            return {
                "status": "success",
                "message": "Siguiente video",
                "action": "next"
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Error al saltar video: {str(e)}",
                "action": "next"
            }
    
    def previous_video(self) -> dict:
        """
        Va al video anterior (YouTube)
        Presiona Shift+P
        
        Returns:
            Dict con status del comando
        """
        try:
            # En YouTube, Shift+P va al video anterior
            pyautogui.hotkey('shift', 'p')
            return {
                "status": "success",
                "message": "Video anterior",
                "action": "previous"
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Error al retroceder video: {str(e)}",
                "action": "previous"
            }
    
    def volume_up(self, steps: int = 2) -> dict:
        """
        Sube el volumen del sistema
        
        Args:
            steps: Cuántos pasos subir (cada paso = presionar tecla una vez)
            
        Returns:
            Dict con status del comando
        """
        try:
            if self.system == "Windows":
                # Presionar tecla de volumen arriba
                for _ in range(steps):
                    pyautogui.press('volumeup')
            else:
                # En otros sistemas, usar atajos de teclado
                for _ in range(steps):
                    pyautogui.press('volumeup')
            
            return {
                "status": "success",
                "message": f"Volumen aumentado {steps} {'paso' if steps == 1 else 'pasos'}",
                "action": "volume_up",
                "steps": steps
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Error subiendo volumen: {str(e)}",
                "action": "volume_up"
            }
    
    def volume_down(self, steps: int = 2) -> dict:
        """
        Baja el volumen del sistema
        
        Args:
            steps: Cuántos pasos bajar (cada paso = presionar tecla una vez)
            
        Returns:
            Dict con status del comando
        """
        try:
            if self.system == "Windows":
                # Presionar tecla de volumen abajo
                for _ in range(steps):
                    pyautogui.press('volumedown')
            else:
                # En otros sistemas
                for _ in range(steps):
                    pyautogui.press('volumedown')
            
            return {
                "status": "success",
                "message": f"Volumen reducido {steps} {'paso' if steps == 1 else 'pasos'}",
                "action": "volume_down",
                "steps": steps
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Error bajando volumen: {str(e)}",
                "action": "volume_down"
            }
    
    def mute_unmute(self) -> dict:
        """
        Silencia/Desilencia el sistema
        
        Returns:
            Dict con status del comando
        """
        try:
            pyautogui.press('volumemute')
            return {
                "status": "success",
                "message": "Silencio activado/desactivado",
                "action": "mute"
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Error en silencio: {str(e)}",
                "action": "mute"
            }
    
    def fullscreen(self) -> dict:
        """
        Activa/Desactiva pantalla completa
        Presiona F en YouTube
        
        Returns:
            Dict con status del comando
        """
        try:
            pyautogui.press('f')
            return {
                "status": "success",
                "message": "Pantalla completa activada/desactivada",
                "action": "fullscreen"
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Error en pantalla completa: {str(e)}",
                "action": "fullscreen"
            }
