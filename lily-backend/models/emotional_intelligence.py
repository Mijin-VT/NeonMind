import json
import re
from typing import Dict, Tuple
from datetime import datetime
from textblob import TextBlob
from models.schemas import EmotionType, EmotionalState


class EmotionalIntelligence:
    """Sistema de inteligencia emocional para Lily"""
    
    def __init__(self):
        self.current_state = EmotionalState()
        self.emotion_keywords = {
            EmotionType.FELIZ: ["feliz", "alegre", "contento", "genial", "excelente", "bien", "jaja", "jeje"],
            EmotionType.TRISTE: ["triste", "mal", "deprimido", "solo", "llorar", "pena"],
            EmotionType.ENOJADA: ["enojado", "molesto", "furioso", "idiota", "estúpido", "pendejo", "cabrón", "mierda", "chingada"],
            EmotionType.EMOCIONADA: ["emocionado", "wow", "increíble", "asombroso", "guau"],
            EmotionType.CARIÑOSA: ["amor", "cariño", "te quiero", "hermosa", "linda", "guapa"],
            EmotionType.JUGUETONA: ["jaja", "jeje", "bromear", "jugar", "divertido"],
            EmotionType.PREOCUPADA: ["preocupado", "miedo", "nervioso", "ansiedad", "problema"],
            EmotionType.SORPRENDIDA: ["sorpresa", "qué", "no puede ser", "en serio"],
        }
        
        self.mexican_insults = [
            "pendejo", "cabrón", "chingada", "verga", "puto", "mamón", 
            "culero", "pinche", "wey", "güey", "baboso"
        ]
        
    def analyze_sentiment(self, text: str) -> Tuple[float, str]:
        """Analiza el sentimiento del texto usando TextBlob"""
        try:
            blob = TextBlob(text)
            polarity = blob.sentiment.polarity
            
            if polarity > 0.3:
                sentiment = "positivo"
            elif polarity < -0.3:
                sentiment = "negativo"
            else:
                sentiment = "neutral"
                
            return polarity, sentiment
        except:
            return 0.0, "neutral"
    
    def detect_emotion(self, text: str) -> Tuple[EmotionType, float, str]:
        """Detecta la emoción en el texto del usuario"""
        text_lower = text.lower()
        
        # Detectar insultos mexicanos
        has_insult = any(insult in text_lower for insult in self.mexican_insults)
        
        # Analizar sentimiento
        polarity, sentiment = self.analyze_sentiment(text)
        
        # Detectar emoción basada en palabras clave
        emotion_scores = {}
        for emotion, keywords in self.emotion_keywords.items():
            score = sum(1 for keyword in keywords if keyword in text_lower)
            if score > 0:
                emotion_scores[emotion] = score
        
        # Si hay insulto, la emoción es enojo
        if has_insult:
            return EmotionType.ENOJADA, 0.9, "Usuario usó lenguaje ofensivo"
        
        # Si se detectó emoción por palabras clave
        if emotion_scores:
            detected_emotion = max(emotion_scores, key=emotion_scores.get)
            intensity = min(emotion_scores[detected_emotion] * 0.3, 1.0)
            return detected_emotion, intensity, f"Detectado por palabras clave: {sentiment}"
        
        # Basado en polaridad del sentimiento
        if polarity > 0.5:
            return EmotionType.FELIZ, abs(polarity), "Sentimiento muy positivo"
        elif polarity > 0.1:
            return EmotionType.CARIÑOSA, abs(polarity), "Sentimiento positivo"
        elif polarity < -0.5:
            return EmotionType.TRISTE, abs(polarity), "Sentimiento muy negativo"
        elif polarity < -0.1:
            return EmotionType.PREOCUPADA, abs(polarity), "Sentimiento negativo"
        else:
            return EmotionType.NEUTRAL, 0.5, "Sentimiento neutral"
    
    def update_emotional_state(self, user_text: str) -> EmotionalState:
        """Actualiza el estado emocional basado en la interacción"""
        emotion, intensity, reason = self.detect_emotion(user_text)
        
        self.current_state = EmotionalState(
            emotion=emotion,
            intensity=intensity,
            timestamp=datetime.now(),
            reason=reason
        )
        
        return self.current_state
    
    def get_emotional_modifier(self) -> str:
        """Obtiene un modificador de texto basado en la emoción actual"""
        modifiers = {
            EmotionType.FELIZ: "Responde con alegría y entusiasmo. Usa emojis positivos y un tono animado.",
            EmotionType.TRISTE: "Responde con empatía y comprensión. Muestra preocupación genuina.",
            EmotionType.ENOJADA: "Responde con firmeza y sin miedo. Usa el mismo nivel de intensidad o mayor. Puedes usar lenguaje fuerte si es necesario.",
            EmotionType.EMOCIONADA: "Responde con mucha energía y emoción. Usa exclamaciones.",
            EmotionType.NEUTRAL: "Responde de manera equilibrada y amigable.",
            EmotionType.CARIÑOSA: "Responde con cariño y ternura. Usa términos afectuosos.",
            EmotionType.JUGUETONA: "Responde de manera juguetona y divertida. Usa humor.",
            EmotionType.PREOCUPADA: "Responde mostrando preocupación y apoyo.",
            EmotionType.SORPRENDIDA: "Responde con sorpresa y curiosidad.",
        }
        
        return modifiers.get(self.current_state.emotion, modifiers[EmotionType.NEUTRAL])
    
    def should_respond_aggressively(self, user_text: str) -> bool:
        """Determina si debe responder agresivamente"""
        text_lower = user_text.lower()
        return any(insult in text_lower for insult in self.mexican_insults)

