import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import json
import os
import pickle
from textblob import TextBlob
from collections import defaultdict, deque
import re

class EmotionType(Enum):
    FELIZ = "feliz"
    TRISTE = "triste"
    ENOJADA = "enojada"
    EMOCIONADA = "emocionada"
    NEUTRAL = "neutral"
    CARIÑOSA = "cariñosa"
    JUGUETONA = "juguetona"
    PREOCUPADA = "preocupada"
    SORPRENDIDA = "sorprendida"
    EXCITADA = "excitada"
    AMOROSA = "amorosa"

@dataclass
class EmotionalState:
    emotion: EmotionType
    intensity: float  # 0.0 to 1.0
    reason: str
    timestamp: datetime
    confidence: float = 1.0  # Confidence in the emotion detection
    context: Dict = None  # Additional context for the emotion

class AdvancedEmotionalIntelligence:
    """
    Sistema emocional avanzado que incluye:
    - Análisis emocional profundo
    - Aprendizaje emocional adaptativo
    - Reconocimiento de voz emocional (simulado)
    - Memoria emocional jerárquica
    - Personalidades emocionales avanzadas
    """
    
    def __init__(self):
        self.current_state = EmotionalState(
            emotion=EmotionType.NEUTRAL,
            intensity=0.5,
            reason="Inicialización del sistema",
            timestamp=datetime.now(),
            confidence=1.0
        )
        self.emotion_history = deque(maxlen=100)  # Historial de emociones
        self.user_emotional_patterns = defaultdict(list)  # Patrones emocionales por usuario
        self.emotional_context = {}  # Contexto emocional actual
        self.voice_tone_analysis = {}  # Análisis simulado de tono de voz
        self.emotional_memory = {}  # Memoria emocional jerárquica
        self.personalities = self._load_emotional_personalities()
        self.current_personality = "original"
        
        # Diccionarios emocionales
        self.emotion_keywords = self._initialize_emotion_keywords()
        self.emotion_transitions = self._initialize_emotion_transitions()
        self.emotional_triggers = self._initialize_emotional_triggers()
        
    def _initialize_emotion_keywords(self) -> Dict[str, List[str]]:
        """Inicializa diccionarios de palabras clave por emoción"""
        return {
            EmotionType.FELIZ.value: [
                'feliz', 'alegre', 'contento', 'bien', 'excelente', 'genial', 
                'maravilloso', 'fantástico', 'increíble', 'hermoso', 'bello',
                'divertido', 'risa', 'sonrisa', 'alegría', 'emoción', 'entusiasmo'
            ],
            EmotionType.TRISTE.value: [
                'triste', 'mal', 'deprimido', 'solo', 'abandonado', 'decepcionado',
                'tristeza', 'pena', 'melancolía', 'llorar', 'lágrimas', 'dolor',
                'vacío', 'desesperanza', 'desánimo', 'desconsuelo'
            ],
            EmotionType.ENOJADA.value: [
                'enojado', 'furioso', 'molesto', 'cabrón', 'chingar', 'puto',
                'mierda', 'joder', 'rabia', 'cólera', 'indignación', 'bronca',
                'fastidio', 'irritación', 'rencor', 'ira'
            ],
            EmotionType.CARIÑOSA.value: [
                'amor', 'cariño', 'beso', 'abrazo', 'corazón', 'ternura',
                'dulce', 'tierno', 'cariñoso', 'afecto', 'querido', 'adorable',
                'encantador', 'aprecio', 'cariñosa', 'mimos', 'amoroso'
            ],
            EmotionType.JUGUETONA.value: [
                'juego', 'jugar', 'divertido', 'gracioso', 'chiste', 'broma',
                'risa', 'reír', 'chistoso', 'divertida', 'entretenido', 'jovial',
                'alegre', 'animado', 'juguetón', 'juguetona', 'bromista'
            ],
            EmotionType.PREOCUPADA.value: [
                'preocupado', 'preocupada', 'ansiedad', 'nervioso', 'temor',
                'miedo', 'inquietud', 'angustia', 'inseguridad', 'duda',
                'temeroso', 'alarmado', 'alerta', 'intranquilo', 'inquieto'
            ],
            EmotionType.SORPRENDIDA.value: [
                'sorpresa', 'sorprendido', 'increíble', 'asombro', 'asombrado',
                'impresionante', 'increíble', 'asombroso', 'sorprendente',
                'extraordinario', 'inexplicable', 'asombroso', 'sorpresivo'
            ],
            EmotionType.EXCITADA.value: [
                'excitado', 'excitada', 'deseo', 'atractivo', 'interés',
                'fascinante', 'atraído', 'interesante', 'atractivo', 'seductor',
                'tentador', 'provocativo', 'sensual', 'apasionado', 'ardiente'
            ],
            EmotionType.AMOROSA.value: [
                'amor', 'pasión', 'amorosa', 'apasionado', 'devoción',
                'devoto', 'adoración', 'afecto profundo', 'cariño profundo',
                'amor verdadero', 'devoción', 'fervor', 'entusiasmo', 'ardor'
            ]
        }
    
    def _initialize_emotion_transitions(self) -> Dict[str, List[Tuple[str, float]]]:
        """Define probabilidades de transición entre emociones"""
        return {
            EmotionType.NEUTRAL.value: [
                (EmotionType.FELIZ.value, 0.3),
                (EmotionType.TRISTE.value, 0.2),
                (EmotionType.CARIÑOSA.value, 0.25),
                (EmotionType.JUGUETONA.value, 0.15),
                (EmotionType.PREOCUPADA.value, 0.1)
            ],
            EmotionType.FELIZ.value: [
                (EmotionType.CARIÑOSA.value, 0.4),
                (EmotionType.JUGUETONA.value, 0.3),
                (EmotionType.NEUTRAL.value, 0.2),
                (EmotionType.EMOCIONADA.value, 0.1)
            ],
            EmotionType.TRISTE.value: [
                (EmotionType.PREOCUPADA.value, 0.5),
                (EmotionType.NEUTRAL.value, 0.4),
                (EmotionType.ENOJADA.value, 0.1)
            ],
            EmotionType.ENOJADA.value: [
                (EmotionType.TRISTE.value, 0.6),
                (EmotionType.NEUTRAL.value, 0.4)
            ],
            EmotionType.CARIÑOSA.value: [
                (EmotionType.AMOROSA.value, 0.3),
                (EmotionType.FELIZ.value, 0.4),
                (EmotionType.NEUTRAL.value, 0.3)
            ],
            EmotionType.JUGUETONA.value: [
                (EmotionType.CARIÑOSA.value, 0.4),
                (EmotionType.EXCITADA.value, 0.3),
                (EmotionType.FELIZ.value, 0.3)
            ]
        }
    
    def _initialize_emotional_triggers(self) -> Dict[str, Dict]:
        """Inicializa desencadenantes emocionales"""
        return {
            "positive_trigger_words": [
                "gracias", "te amo", "me gustas", "eres hermosa", "te adoro",
                "me encantas", "perfecta", "increíble", "maravillosa", "bellísima"
            ],
            "negative_trigger_words": [
                "odia", "maldita", "detesto", "asco", "odio", "horrible",
                "fea", "tonta", "idiota", "estúpida", "molesta"
            ],
            "affection_triggers": [
                "beso", "abrazo", "cariño", "mimo", "amor", "corazón",
                "te extraño", "necesito", "quiero", "anhelo", "anhelar"
            ],
            "playful_triggers": [
                "juguemos", "broma", "chiste", "divertido", "risa", "reír",
                "jugar", "travesura", "picardía", "coquetería"
            ],
            "concern_triggers": [
                "preocupado", "preocupada", "ansiedad", "ayuda", "socorro",
                "problema", "dificultad", "triste", "mal", "malísimo"
            ]
        }
    
    def _load_emotional_personalities(self) -> Dict:
        """Carga personalidades emocionales avanzadas"""
        return {
            "original": {
                "name": "Original",
                "description": "Personalidad original de Lily",
                "emotion_weights": {
                    EmotionType.FELIZ.value: 1.0,
                    EmotionType.CARIÑOSA.value: 1.0,
                    EmotionType.JUGUETONA.value: 1.0,
                    EmotionType.EMOCIONADA.value: 1.0
                },
                "response_modifiers": {
                    "tone": "natural",
                    "formality": "informal",
                    "intimacy": "moderate"
                }
            },
            "caring": {
                "name": "Cariñosa",
                "description": "Más empática y afectuosa",
                "emotion_weights": {
                    EmotionType.CARIÑOSA.value: 1.5,
                    EmotionType.PREOCUPADA.value: 1.2,
                    EmotionType.AMOROSA.value: 1.3,
                    EmotionType.TRISTE.value: 0.8
                },
                "response_modifiers": {
                    "tone": "caring",
                    "formality": "warm",
                    "intimacy": "high"
                }
            },
            "playful": {
                "name": "Juguetona",
                "description": "Más divertida y traviesa",
                "emotion_weights": {
                    EmotionType.JUGUETONA.value: 1.5,
                    EmotionType.EXCITADA.value: 1.3,
                    EmotionType.EMOCIONADA.value: 1.4,
                    EmotionType.FELIZ.value: 1.2
                },
                "response_modifiers": {
                    "tone": "playful",
                    "formality": "fun",
                    "intimacy": "playful"
                }
            },
            "professional": {
                "name": "Profesional",
                "description": "Más formal y controlada",
                "emotion_weights": {
                    EmotionType.NEUTRAL.value: 1.5,
                    EmotionType.FELIZ.value: 0.8,
                    EmotionType.CARIÑOSA.value: 0.7,
                    EmotionType.JUGUETONA.value: 0.5
                },
                "response_modifiers": {
                    "tone": "professional",
                    "formality": "formal",
                    "intimacy": "low"
                }
            }
        }
    
    def analyze_voice_tone(self, text: str) -> Dict[str, float]:
        """
        Simula análisis de tono de voz (en una implementación real, usaría 
        características acústicas del audio)
        """
        # Análisis basado en patrones de texto que simulan tono de voz
        analysis = {
            "energy": 0.5,  # 0.0-1.0
            "pitch_variation": 0.5,  # 0.0-1.0
            "speaking_speed": 0.5,  # 0.0-1.0
            "confidence": 0.5,  # 0.0-1.0
            "warmth": 0.5  # 0.0-1.0
        }
        
        # Detectar patrones que indican tono emocional
        if any(word in text.lower() for word in ['!', '?', '¡']):
            analysis["energy"] = min(1.0, analysis["energy"] + 0.2)
        
        if any(word in text.lower() for word in ['...', '…']):
            analysis["energy"] = max(0.0, analysis["energy"] - 0.1)
            analysis["warmth"] = min(1.0, analysis["warmth"] + 0.1)
        
        if any(word in text.lower() for word in ['susurro', 'suavemente', 'bajo']):
            analysis["energy"] = max(0.0, analysis["energy"] - 0.3)
            analysis["warmth"] = min(1.0, analysis["warmth"] + 0.2)
        
        if any(word in text.lower() for word in ['rápido', 'deprisa', 'rápidamente']):
            analysis["speaking_speed"] = min(1.0, analysis["speaking_speed"] + 0.3)
        
        return analysis
    
    def detect_emotional_context(self, text: str, user_id: str = "default") -> Dict:
        """Detecta contexto emocional en el texto"""
        context = {
            "topic_intensity": 0.0,
            "emotional_depth": 0.0,
            "relationship_context": "neutral",
            "temporal_context": "present",
            "urgency_level": 0.0
        }
        
        # Analizar intensidad del tema
        strong_words = ['mucho', 'muy', 'extremadamente', 'increíblemente', 'totalmente', 'completamente']
        context["topic_intensity"] = min(1.0, len([word for word in strong_words if word in text.lower()]) * 0.2)
        
        # Analizar profundidad emocional
        deep_emotion_words = ['corazón', 'alma', 'sentimientos', 'emociones', 'verdadero', 'profundo', 'real']
        context["emotional_depth"] = min(1.0, len([word for word in deep_emotion_words if word in text.lower()]) * 0.2)
        
        # Analizar contexto relacional
        relationship_words = ['te amo', 'amor', 'corazón', 'tuyo', 'mío', 'nuestro', 'nuestra']
        if any(word in text.lower() for word in relationship_words):
            context["relationship_context"] = "intimate"
        
        # Analizar urgencia
        urgency_words = ['ahora', 'ya', 'inmediatamente', 'urgente', 'importante', 'crítico']
        context["urgency_level"] = min(1.0, len([word for word in urgency_words if word in text.lower()]) * 0.15)
        
        return context
    
    def analyze_sentiment_advanced(self, text: str) -> Tuple[float, float, List[str]]:
        """
        Análisis avanzado de sentimiento con TextBlob y análisis léxico
        """
        # Análisis con TextBlob
        blob = TextBlob(text)
        polarity = blob.sentiment.polarity  # -1 a 1
        subjectivity = blob.sentiment.subjectivity  # 0 a 1
        
        # Análisis léxico adicional
        detected_emotions = []
        
        for emotion, keywords in self.emotion_keywords.items():
            matches = [kw for kw in keywords if kw in text.lower()]
            if matches:
                detected_emotions.extend([(emotion, len(matches))])
        
        return polarity, subjectivity, detected_emotions
    
    def calculate_emotional_intensity(self, text: str, detected_emotions: List[Tuple[str, int]]) -> float:
        """Calcula la intensidad emocional considerando múltiples factores"""
        base_intensity = 0.0
        
        # Intensidad basada en análisis de sentimiento
        polarity, subjectivity, _ = self.analyze_sentiment_advanced(text)
        base_intensity += abs(polarity) * 0.3
        
        # Intensidad basada en cantidad de emociones detectadas
        if detected_emotions:
            total_matches = sum(count for _, count in detected_emotions)
            base_intensity += min(total_matches * 0.1, 0.3)
        
        # Intensidad basada en signos de puntuación emocionales
        exclamation_count = text.count('!')
        question_count = text.count('?')
        ellipsis_count = text.count('...')
        
        punctuation_intensity = (exclamation_count * 0.15 + question_count * 0.1 + ellipsis_count * 0.05)
        base_intensity += min(punctuation_intensity, 0.2)
        
        # Intensidad basada en palabras de énfasis
        emphasis_words = ['muy', 'super', 'increíblemente', 'extremadamente', 'totalmente', 'absolutamente']
        emphasis_count = sum(1 for word in emphasis_words if word in text.lower())
        base_intensity += min(emphasis_count * 0.1, 0.2)
        
        return min(base_intensity, 1.0)
    
    def determine_emotion_from_context(self, text: str, user_id: str = "default") -> Tuple[EmotionType, float, str]:
        """Determina la emoción principal considerando contexto emocional"""
        # Análisis de sentimiento
        polarity, subjectivity, detected_emotions = self.analyze_sentiment_advanced(text)
        
        # Análisis de palabras clave emocionales
        emotion_scores = {}
        for emotion, keywords in self.emotion_keywords.items():
            score = sum(1 for keyword in keywords if keyword in text.lower())
            emotion_scores[emotion] = score
        
        # Aplicar pesos de personalidad
        personality_weights = self.personalities[self.current_personality]["emotion_weights"]
        weighted_scores = {}
        for emotion, score in emotion_scores.items():
            weight = personality_weights.get(emotion, 1.0)
            weighted_scores[emotion] = score * weight
        
        # Detectar desencadenantes emocionales
        trigger_scores = {}
        for trigger_type, trigger_words in self.emotional_triggers.items():
            trigger_count = sum(1 for word in trigger_words if word in text.lower())
            trigger_scores[trigger_type] = trigger_count
        
        # Determinar emoción dominante
        dominant_emotion = EmotionType.NEUTRAL
        max_score = 0
        
        for emotion, score in weighted_scores.items():
            if score > max_score:
                max_score = score
                dominant_emotion = EmotionType(emotion)
        
        # Si no se detectaron emociones claras, usar polaridad
        if max_score == 0:
            if polarity > 0.1:
                dominant_emotion = EmotionType.FELIZ
            elif polarity < -0.1:
                dominant_emotion = EmotionType.TRISTE
            else:
                dominant_emotion = EmotionType.NEUTRAL
        
        # Calcular intensidad
        intensity = self.calculate_emotional_intensity(text, detected_emotions)
        
        # Generar razón
        reason_parts = []
        if max_score > 0:
            reason_parts.append(f"Detectada emoción {dominant_emotion.value}")
        if polarity != 0:
            reason_parts.append(f"Polaridad: {polarity:.2f}")
        if trigger_scores:
            active_triggers = [k for k, v in trigger_scores.items() if v > 0]
            if active_triggers:
                reason_parts.append(f"Desencadenantes: {', '.join(active_triggers)}")
        
        reason = "; ".join(reason_parts) if reason_parts else "Análisis emocional estándar"
        
        return dominant_emotion, min(intensity, 1.0), reason
    
    def update_emotional_state(self, user_input: str, user_id: str = "default") -> EmotionalState:
        """Actualiza el estado emocional basado en la entrada del usuario"""
        # Analizar tono de voz (simulado)
        voice_analysis = self.analyze_voice_tone(user_input)
        
        # Detectar contexto emocional
        emotional_context = self.detect_emotional_context(user_input, user_id)
        
        # Determinar emoción principal
        emotion, intensity, reason = self.determine_emotion_from_context(user_input, user_id)
        
        # Calcular confianza (basada en cantidad de señales detectadas)
        confidence = min(0.7 + (intensity * 0.3), 1.0)
        
        # Crear nuevo estado emocional
        new_state = EmotionalState(
            emotion=emotion,
            intensity=intensity,
            reason=reason,
            timestamp=datetime.now(),
            confidence=confidence,
            context=emotional_context
        )
        
        # Registrar en historial
        self.emotion_history.append(new_state)
        
        # Actualizar patrones emocionales del usuario
        self.user_emotional_patterns[user_id].append(new_state)
        
        # Actualizar estado actual
        self.current_state = new_state
        
        # Actualizar memoria emocional
        self._update_emotional_memory(user_input, user_id)
        
        return new_state
    
    def _update_emotional_memory(self, text: str, user_id: str):
        """Actualiza la memoria emocional jerárquica"""
        if user_id not in self.emotional_memory:
            self.emotional_memory[user_id] = {
                "short_term": [],  # Últimas 10 interacciones
                "medium_term": [],  # Resumen diario
                "long_term": []     # Resumen semanal
            }
        
        # Agregar a memoria a corto plazo
        memory_entry = {
            "text": text,
            "emotion": self.current_state.emotion.value,
            "intensity": self.current_state.intensity,
            "timestamp": self.current_state.timestamp,
            "context": self.current_state.context
        }
        
        self.emotional_memory[user_id]["short_term"].append(memory_entry)
        
        # Mantener solo las últimas 10 entradas
        if len(self.emotional_memory[user_id]["short_term"]) > 10:
            self.emotional_memory[user_id]["short_term"] = self.emotional_memory[user_id]["short_term"][-10:]
    
    def get_emotional_summary(self, user_id: str = "default") -> str:
        """Genera un resumen del estado emocional del usuario"""
        if user_id not in self.user_emotional_patterns or not self.user_emotional_patterns[user_id]:
            return "Sin historial emocional registrado."
        
        recent_states = self.user_emotional_patterns[user_id][-10:]  # Últimas 10 emociones
        
        # Contar emociones
        emotion_counts = defaultdict(int)
        total_intensity = 0
        
        for state in recent_states:
            emotion_counts[state.emotion.value] += 1
            total_intensity += state.intensity
        
        # Emoción más común
        most_common_emotion = max(emotion_counts, key=emotion_counts.get)
        avg_intensity = total_intensity / len(recent_states) if recent_states else 0.0
        
        # Detectar tendencia
        if len(recent_states) >= 2:
            recent_change = recent_states[-1].intensity - recent_states[0].intensity
            trend = "ascendente" if recent_change > 0.2 else "descendente" if recent_change < -0.2 else "estable"
        else:
            trend = "estable"
        
        return (f"Emoción predominante: {most_common_emotion}. "
                f"Intensidad promedio: {avg_intensity:.2f}. "
                f"Tendencia: {trend}.")
    
    def get_emotional_modifier(self) -> str:
        """Obtiene un modificador emocional para el prompt"""
        current = self.current_state
        emotion_name = current.emotion.value
        intensity = current.intensity
        
        modifiers = {
            EmotionType.FELIZ.value: f"Eres especialmente {'' if intensity < 0.7 else 'muy '}feliz y positiva.",
            EmotionType.TRISTE.value: f"Eres comprensiva y empática, con un tono {'' if intensity < 0.7 else 'muy '}triste.",
            EmotionType.ENOJADA.value: f"Mantén un tono {'' if intensity < 0.7 else 'muy '}firme y directo.",
            EmotionType.CARIÑOSA.value: f"Sé especialmente {'' if intensity < 0.7 else 'muy '}cariñosa y afectuosa.",
            EmotionType.JUGUETONA.value: f"Usa un tono {'' if intensity < 0.7 else 'muy '}juguetón y travieso.",
            EmotionType.PREOCUPADA.value: f"Muestra preocupación y ofrece apoyo emocional.",
            EmotionType.SORPRENDIDA.value: f"Muestra curiosidad y asombro {'' if intensity < 0.7 else 'intenso'}.",
            EmotionType.EXCITADA.value: f"Habla con {'' if intensity < 0.7 else 'mucha '}intensidad y atracción.",
            EmotionType.AMOROSA.value: f"Expresa amor y pasión {'' if intensity < 0.7 else 'intensa'}.",
            EmotionType.NEUTRAL.value: f"Mantén un tono equilibrado y neutral."
        }
        
        return modifiers.get(emotion_name, "Mantén un tono apropiado.")
    
    def set_personality(self, personality_id: str) -> bool:
        """Cambia la personalidad emocional"""
        if personality_id in self.personalities:
            self.current_personality = personality_id
            return True
        return False
    
    def get_current_personality_info(self) -> Dict:
        """Obtiene información sobre la personalidad actual"""
        return self.personalities.get(self.current_personality, {})
    
    def predict_next_emotion(self) -> Tuple[EmotionType, float]:
        """Predice la próxima emoción basada en transiciones históricas"""
        if len(self.emotion_history) < 2:
            return self.current_state.emotion, 0.5
        
        current_emotion = self.emotion_history[-1].emotion.value
        possible_transitions = self.emotion_transitions.get(current_emotion, [])
        
        if not possible_transitions:
            return self.current_state.emotion, 0.5
        
        # Seleccionar transición aleatoria ponderada
        emotions, weights = zip(*possible_transitions)
        chosen_emotion = np.random.choice(emotions, p=weights)
        
        return EmotionType(chosen_emotion), 0.7  # Alta confianza en predicción
    
    def save_state(self, filepath: str):
        """Guarda el estado emocional en un archivo"""
        state_data = {
            'current_state': self.current_state,
            'emotion_history': list(self.emotion_history),
            'user_emotional_patterns': dict(self.user_emotional_patterns),
            'emotional_memory': self.emotional_memory,
            'voice_tone_analysis': self.voice_tone_analysis,
            'current_personality': self.current_personality
        }
        
        with open(filepath, 'wb') as f:
            pickle.dump(state_data, f)
    
    def load_state(self, filepath: str):
        """Carga el estado emocional desde un archivo"""
        if not os.path.exists(filepath):
            return
        
        with open(filepath, 'rb') as f:
            state_data = pickle.load(f)
        
        self.current_state = state_data.get('current_state', self.current_state)
        self.emotion_history = deque(state_data.get('emotion_history', []), maxlen=100)
        self.user_emotional_patterns = defaultdict(list, state_data.get('user_emotional_patterns', {}))
        self.emotional_memory = state_data.get('emotional_memory', {})
        self.voice_tone_analysis = state_data.get('voice_tone_analysis', {})
        self.current_personality = state_data.get('current_personality', 'original')