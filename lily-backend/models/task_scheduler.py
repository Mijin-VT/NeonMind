import sqlite3
import os
import time
import threading
import subprocess
from datetime import datetime, timedelta

class TaskScheduler:
    """Programador de tareas que ejecuta recordatorios por voz y comandos del sistema en segundo plano"""
    
    def __init__(self, db_path: str = "data/lily_memory.db"):
        self.db_path = db_path
        self._init_db()
        self.is_running = False
        self.thread = None
        self.start()

    def _init_db(self):
        """Inicializa la tabla de tareas si no existe"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS scheduled_tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT,
                task_type TEXT,
                description TEXT,
                command TEXT,
                run_at TEXT,
                interval_seconds INTEGER DEFAULT 0,
                last_run TEXT,
                is_active INTEGER DEFAULT 1
            )
        ''')
        conn.commit()
        conn.close()

    def start(self):
        """Inicia el bucle del planificador en un hilo separado"""
        if self.is_running:
            return
        self.is_running = True
        self.thread = threading.Thread(target=self._scheduler_loop, daemon=True)
        self.thread.start()
        print("Planificador de tareas iniciado en segundo plano.")

    def stop(self):
        """Detiene el planificador"""
        self.is_running = False
        if self.thread:
            self.thread.join(timeout=2)

    def add_reminder(self, user_id: str, description: str, run_at: datetime, interval_seconds: int = 0) -> int:
        """Agrega un recordatorio a la base de datos"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO scheduled_tasks (user_id, task_type, description, run_at, interval_seconds) VALUES (?, 'reminder', ?, ?, ?)",
            (user_id, description, run_at.isoformat(), interval_seconds)
        )
        task_id = cursor.lastrowid
        conn.commit()
        conn.close()
        print(f"Recordatorio programado: '{description}' para el {run_at.isoformat()}")
        return task_id

    def add_command_task(self, user_id: str, command: str, run_at: datetime, interval_seconds: int = 0) -> int:
        """Agrega una tarea de ejecución de comandos"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO scheduled_tasks (user_id, task_type, description, command, run_at, interval_seconds) VALUES (?, 'command', ?, ?, ?, ?)",
            (user_id, f"Ejecutar: {command}", command, run_at.isoformat(), interval_seconds)
        )
        task_id = cursor.lastrowid
        conn.commit()
        conn.close()
        print(f"Comando programado: '{command}' para el {run_at.isoformat()}")
        return task_id

    def get_active_tasks(self, user_id: str) -> list:
        """Obtiene una lista de tareas programadas activas"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, task_type, description, run_at, interval_seconds FROM scheduled_tasks WHERE user_id = ? AND is_active = 1",
            (user_id,)
        )
        rows = cursor.fetchall()
        conn.close()
        
        tasks = []
        for r in rows:
            tasks.append({
                "id": r[0],
                "type": r[1],
                "description": r[2],
                "run_at": r[3],
                "interval_seconds": r[4]
            })
        return tasks

    def cancel_task(self, task_id: int) -> bool:
        """Desactiva o cancela una tarea programada"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("UPDATE scheduled_tasks SET is_active = 0 WHERE id = ?", (task_id,))
        success = cursor.rowcount > 0
        conn.commit()
        conn.close()
        return success

    def _scheduler_loop(self):
        """Bucle principal de ejecución del planificador"""
        while self.is_running:
            try:
                self._check_and_execute_tasks()
            except Exception as e:
                print(f"Error en el bucle del planificador: {e}")
            time.sleep(10)

    def _check_and_execute_tasks(self):
        """Comprueba y ejecuta tareas pendientes"""
        now = datetime.now()
        now_str = now.isoformat()
        
        conn = sqlite3.connect(self.db_path)
        # Buscar tareas activas cuya fecha programada ya pasó
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, user_id, task_type, description, command, run_at, interval_seconds FROM scheduled_tasks WHERE is_active = 1 AND run_at <= ?",
            (now_str,)
        )
        tasks = cursor.fetchall()
        
        for task in tasks:
            task_id, user_id, task_type, description, command, run_at_str, interval_seconds = task
            
            # Ejecutar tarea en segundo plano
            print(f"Ejecutando tarea programada {task_id}: {description}")
            self._execute_single_task(task_type, description, command, user_id)
            
            # Actualizar estado de la tarea en la base de datos
            if interval_seconds > 0:
                # Si es recurrente, programar la siguiente ejecución
                try:
                    next_run = datetime.fromisoformat(run_at_str) + timedelta(seconds=interval_seconds)
                    # Si la siguiente fecha ya pasó, avanzar hasta el futuro
                    while next_run <= datetime.now():
                        next_run += timedelta(seconds=interval_seconds)
                except:
                    next_run = datetime.now() + timedelta(seconds=interval_seconds)
                
                cursor.execute(
                    "UPDATE scheduled_tasks SET last_run = ?, run_at = ? WHERE id = ?",
                    (now_str, next_run.isoformat(), task_id)
                )
            else:
                # Si no es recurrente, marcar como inactiva
                cursor.execute(
                    "UPDATE scheduled_tasks SET last_run = ?, is_active = 0 WHERE id = ?",
                    (now_str, task_id)
                )
                
        if tasks:
            conn.commit()
        conn.close()

    def _execute_single_task(self, task_type: str, description: str, command: str, user_id: str = "default_user"):
        """Lógica interna de ejecución de una sola tarea"""
        if task_type == "reminder":
            user_name = "Mijin"
            try:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                cursor.execute("SELECT value FROM preferences WHERE user_id = ? AND key = 'user_name'", (user_id,))
                row = cursor.fetchone()
                if row:
                    user_name = row[0]
                conn.close()
            except Exception as e:
                print(f"Error recuperando user_name para recordatorio: {e}")

            # Ejecutar síntesis de voz en Windows usando PowerShell SAPI (incorporado y rápido en segundo plano)
            clean_desc = description.replace("'", "").replace('"', "")
            ps_command = f"Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).Speak('Atención {user_name}. Recordatorio importante: {clean_desc}')"
            try:
                subprocess.Popen(["powershell", "-Command", ps_command], shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            except Exception as e:
                print(f"No se pudo reproducir recordatorio por voz: {e}")
                
        elif task_type == "command" and command:
            try:
                # Ejecutar comando del sistema de forma asíncrona
                subprocess.Popen(command, shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                print(f"Comando ejecutado con éxito: {command}")
            except Exception as e:
                print(f"Error ejecutando comando programado: {e}")
