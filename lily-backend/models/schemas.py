from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime
from enum import Enum


class EmotionType(str, Enum):
    """Tipos de emociones que Lily puede experimentar"""
    FELIZ = "feliz"
    TRISTE = "triste"
    ENOJADA = "enojada"
    EMOCIONADA = "emocionada"
    NEUTRAL = "neutral"
    CARIÑOSA = "cariñosa"
    JUGUETONA = "juguetona"
    PREOCUPADA = "preocupada"
    SORPRENDIDA = "sorprendida"


class EmotionalState(BaseModel):
    """Estado emocional actual de Lily"""
    emotion: EmotionType = EmotionType.NEUTRAL
    intensity: float = Field(default=0.5, ge=0.0, le=1.0)
    timestamp: datetime = Field(default_factory=datetime.now)
    reason: Optional[str] = None


class UserMessage(BaseModel):
    """Mensaje del usuario"""
    text: str
    timestamp: datetime = Field(default_factory=datetime.now)
    detected_emotion: Optional[str] = None
    sentiment_score: Optional[float] = None


class AssistantResponse(BaseModel):
    """Respuesta de Lily"""
    text: str
    emotion: EmotionType
    audio_url: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.now)


class ConversationMemory(BaseModel):
    """Memoria de conversación"""
    user_id: str = "default_user"
    messages: List[Dict] = Field(default_factory=list)
    user_preferences: Dict = Field(default_factory=dict)
    emotional_history: List[EmotionalState] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.now)
    last_interaction: datetime = Field(default_factory=datetime.now)


class ChatRequest(BaseModel):
    """Solicitud de chat"""
    message: str
    user_id: Optional[str] = "default_user"
    lang: Optional[str] = "es"


class ChatResponse(BaseModel):
    """Respuesta de chat"""
    response: str
    emotion: str
    audio_url: Optional[str] = None
    timestamp: str

