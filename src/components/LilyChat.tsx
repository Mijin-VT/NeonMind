import { useState, useEffect, useRef } from "react";
import {
  Send,
  Mic,
  MicOff,
  Settings,
  Brain,
  Trash2,
  HelpCircle,
  RefreshCw,
  User,
  Mail,
  FileText,
  Database,
  Volume2,
  Volume1,
  VolumeX,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Language, translations } from "../translations";
import { invoke } from "@tauri-apps/api/core";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  emotion?: string;
  timestamp: string;
}

interface RagDoc {
  id: string;
  name: string;
  source?: string;
}

const API_BASE = "http://localhost:8000";

const EMOTION_CONFIG: Record<string, { color: string; emoji: string; text: string; bg: string }> = {
  feliz: { color: "from-yellow-400 to-amber-500", emoji: "😊", text: "Feliz", bg: "bg-yellow-500/10 text-yellow-300 border-yellow-500/20" },
  triste: { color: "from-blue-500 to-indigo-600", emoji: "😢", text: "Triste", bg: "bg-blue-500/10 text-blue-300 border-blue-500/20" },
  enojada: { color: "from-red-500 to-rose-700", emoji: "😠", text: "Enojada", bg: "bg-red-500/10 text-red-300 border-red-500/20" },
  emocionada: { color: "from-pink-500 to-rose-500", emoji: "🤩", text: "Emocionada", bg: "bg-pink-500/10 text-pink-300 border-pink-500/20" },
  neutral: { color: "from-slate-500 to-slate-700", emoji: "😐", text: "Neutral", bg: "bg-slate-500/10 text-slate-300 border-slate-500/20" },
  cariñosa: { color: "from-rose-400 to-pink-600", emoji: "🥰", text: "Cariñosa", bg: "bg-rose-500/15 text-rose-300 border-rose-500/25" },
  juguetona: { color: "from-purple-500 to-fuchsia-600", emoji: "😜", text: "Juguetona", bg: "bg-purple-500/10 text-purple-300 border-purple-500/20" },
  preocupada: { color: "from-amber-500 to-orange-600", emoji: "😟", text: "Preocupada", bg: "bg-amber-500/10 text-amber-300 border-amber-500/20" },
  sorprendida: { color: "from-teal-400 to-emerald-600", emoji: "😲", text: "Sorprendida", bg: "bg-teal-500/10 text-teal-300 border-teal-500/20" },
};

export default function LilyChat({ lang, setLang }: { lang: Language; setLang: (l: Language) => void }) {
  const t = (key: keyof typeof translations["es"]) => translations[lang][key];
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isOllamaConnected, setIsOllamaConnected] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [currentEmotion, setCurrentEmotion] = useState("neutral");
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isVoiceModeActive, setIsVoiceModeActive] = useState(false);
  
  // Modals / Panels
  const [activePanel, setActivePanel] = useState<"none" | "settings" | "memory" | "commands">("none");
  
  // Settings values
  const [userName, setUserName] = useState("Mijin");
  const [gmailUser, setGmailUser] = useState("");
  const [gmailPassword, setGmailPassword] = useState("");
  const [ragDocs, setRagDocs] = useState<RagDoc[]>([]);
  const [ragStats, setRagStats] = useState<{ total_docs: number; total_chunks: number } | null>(null);
  
  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  
  // Memory states
  const [memorySummary, setMemorySummary] = useState("");
  const [emotionalSummary, setEmotionalSummary] = useState("");
  
  // Volume state
  const [volume, setVolume] = useState<number>(() => {
    return parseFloat(localStorage.getItem("lily_volume") ?? "1.0");
  });
  
  // Autostart state
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const [lilyLangMode, setLilyLangMode] = useState<"auto" | "es" | "en">("auto");

  // Check autostart status on mount
  useEffect(() => {
    const checkAutostart = async () => {
      try {
        const enabled = await invoke<boolean>("is_autostart_enabled");
        setAutostartEnabled(enabled);
      } catch (err) {
        console.error("Failed to check autostart status:", err);
      }
    };
    checkAutostart();
  }, []);

  const toggleAutostart = async () => {
    try {
      if (autostartEnabled) {
        await invoke("disable_autostart");
        setAutostartEnabled(false);
      } else {
        await invoke("enable_autostart");
        setAutostartEnabled(true);
      }
    } catch (err) {
      console.error("Error toggling autostart:", err);
      alert(lang === "es" ? "Error al configurar el inicio automático: " + err : "Error setting startup configuration: " + err);
    }
  };
  
  // Audio state
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  
  // MediaRecorder variables
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const animationFrameIdRef = useRef<number | null>(null);

  // 1. Initial health and preferences check
  useEffect(() => {
    loadPreferences();
    
    // Ping frequently (every 2 seconds) at startup until connected, up to 120 seconds (60 attempts)
    let attempts = 0;
    const initialCheck = async () => {
      const connected = await checkHealth();
      attempts++;
      if (connected || attempts >= 60) {
        setIsInitialLoading(false);
        clearInterval(startupInterval);
        // Start the regular 15-second check interval
        const regularInterval = setInterval(checkHealth, 15000);
        (window as any)._lilyRegularInterval = regularInterval;
      }
    };
    
    initialCheck();
    const startupInterval = setInterval(initialCheck, 2000);
    
    return () => {
      clearInterval(startupInterval);
      if ((window as any)._lilyRegularInterval) {
        clearInterval((window as any)._lilyRegularInterval);
      }
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
      }
      cleanupAudioAnalyser();
    };
  }, []);

  // 2. Auto-scroll to bottom of chat when new message is added or typing starts
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const checkHealth = async () => {
    try {
      const res = await fetch(`${API_BASE}/health`);
      if (res.ok) {
        const data = await res.json();
        setIsConnected(true);
        setIsOllamaConnected(data.ollama_connected);
        return true;
      } else {
        setIsConnected(false);
        setIsOllamaConnected(false);
        return false;
      }
    } catch (e) {
      setIsConnected(false);
      setIsOllamaConnected(false);
      return false;
    }
  };

  const loadPreferences = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/preferences/default_user`);
      if (res.ok) {
        const data = await res.json();
        if (data.user_name) setUserName(data.user_name);
        if (data.gmail_user) setGmailUser(data.gmail_user);
        if (data.lily_lang_mode) setLilyLangMode(data.lily_lang_mode as any);
      }
    } catch (e) {
      console.error("Error loading user preferences:", e);
    }
  };

  const saveUserNamePreference = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/preferences/default_user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_name: userName }),
      });
      if (res.ok) {
        alert(t("settings_user_success").replace("{name}", userName));
      }
    } catch (e) {
      alert(lang === "es" ? "Error al guardar el nombre." : "Error saving name.");
    }
  };

  const saveLilyLangPreference = async (mode: "auto" | "es" | "en") => {
    try {
      const res = await fetch(`${API_BASE}/api/preferences/default_user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lily_lang_mode: mode }),
      });
      if (res.ok) {
        setLilyLangMode(mode);
      } else {
        alert(lang === "es" ? "Error al guardar el idioma de Lily." : "Error saving Lily's language preference.");
      }
    } catch (e) {
      alert(lang === "es" ? "Error de conexión." : "Connection error.");
    }
  };

  const saveGmailCredentials = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/preferences/default_user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gmail_user: gmailUser,
          gmail_password: gmailPassword,
        }),
      });
      if (res.ok) {
        alert(t("settings_gmail_success"));
        setGmailPassword(""); // Limpiar campo por seguridad
      }
    } catch (e) {
      alert(lang === "es" ? "Error al guardar credenciales de Gmail." : "Error saving Gmail credentials.");
    }
  };

  const loadRagStatsAndDocs = async () => {
    try {
      const resStats = await fetch(`${API_BASE}/api/rag/stats`);
      if (resStats.ok) {
        const data = await resStats.json();
        setRagStats({
          total_docs: data.total_documents || 0,
          total_chunks: data.total_chunks || 0,
        });
      }

      const resDocs = await fetch(`${API_BASE}/api/rag/documents`);
      if (resDocs.ok) {
        const data = await resDocs.json();
        const docs = (data.documents || []).map((doc: any) => ({
          id: doc.id || doc,
          name: doc.name || (doc.metadata && doc.metadata.filename) || doc.id || doc,
          source: (doc.metadata && doc.metadata.source) || "Subido",
        }));
        setRagDocs(docs);
      }
    } catch (e) {
      console.error("Error al cargar RAG data:", e);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setUploadStatus("Subiendo e indexando documento...");
    
    const formData = new FormData();
    formData.append("file", selectedFile);
    
    try {
      const res = await fetch(`${API_BASE}/api/rag/upload-document`, {
        method: "POST",
        body: formData,
      });
      
      if (res.ok) {
        setUploadStatus(lang === "es" ? "¡Documento indexado con éxito en el cerebro de Lily! 🧠" : "Document indexed successfully in Lily's brain! 🧠");
        setSelectedFile(null);
        loadRagStatsAndDocs();
      } else {
        const err = await res.json();
        setUploadStatus("Error: " + (err.detail || "No se pudo procesar"));
      }
    } catch (e) {
      setUploadStatus(lang === "es" ? "Error al conectar con el servidor." : "Error connecting to server.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleReindex = async () => {
    setUploadStatus("Sincronizando directorio knowledge/...");
    try {
      const res = await fetch(`${API_BASE}/api/rag/ingest-knowledge`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        alert(lang === "es" ? `Directorio indexado. ${data.files_ingested} archivos procesados.` : `Directory indexed. ${data.files_ingested} files processed.`);
        loadRagStatsAndDocs();
      } else {
        alert(lang === "es" ? "Error al reindexar." : "Error reindexing.");
      }
    } catch (e) {
      alert(lang === "es" ? "Error de conexión." : "Connection error.");
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    if (!confirm(lang === "es" ? "¿Seguro que deseas eliminar este documento de la base de conocimientos?" : "Are you sure you want to delete this document from the knowledge base?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/rag/document/${encodeURIComponent(docId)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        loadRagStatsAndDocs();
      } else {
        alert(lang === "es" ? "Error al eliminar documento." : "Error deleting document.");
      }
    } catch (e) {
      alert(lang === "es" ? "Error de conexión." : "Connection error.");
    }
  };

  const loadMemory = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/memory/default_user`);
      if (res.ok) {
        const data = await res.json();
        setMemorySummary(data.conversation_summary || (lang === "es" ? "No hay memoria conversacional acumulada." : "No conversational memory accumulated."));
        setEmotionalSummary(data.emotional_summary || (lang === "es" ? "No hay registros emocionales aún." : "No emotional records yet."));
      }
    } catch (e) {
      console.error("Error al cargar memoria:", e);
    }
  };

  const handleClearMemory = async () => {
    if (
      confirm(t("memory_clear_confirm"))
    ) {
      try {
        const res = await fetch(`${API_BASE}/api/memory/default_user`, {
          method: "DELETE",
        });
        if (res.ok) {
          alert(t("memory_clear_success"));
          setMessages([]);
          setCurrentEmotion("neutral");
          loadMemory();
        } else {
          alert(lang === "es" ? "Error al intentar borrar la memoria." : "Error trying to clear memory.");
        }
      } catch (e) {
        alert(lang === "es" ? "Error de conexión al intentar restablecer la memoria." : "Connection error trying to reset memory.");
      }
    }
  };

  // 3. Audio Playback logic (Web Audio API with Gain Node for Amplification up to 200%)
  const playAudio = (audioUrl: string) => {
    try {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }

      // El audioUrl viene relativo del backend (ej: /api/audio/temp_...)
      const absoluteUrl = audioUrl.startsWith("http") ? audioUrl : `${API_BASE}${audioUrl}`;
      
      // Crear elemento de audio con CORS habilitado
      const audio = new Audio();
      audio.crossOrigin = "anonymous";
      audio.src = absoluteUrl;
      currentAudioRef.current = audio;

      // Inicializar AudioContext si no existe
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      // Conectar elemento de audio a través de un nodo de Ganancia (GainNode) para amplificar la señal
      const source = ctx.createMediaElementSource(audio);
      const gainNode = ctx.createGain();
      gainNode.gain.value = volume; // Puede ser > 1.0 para amplificar el sonido
      gainNodeRef.current = gainNode;

      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      audio.addEventListener("ended", () => {
        currentAudioRef.current = null;
        deleteAudioFile(audioUrl);
        
        // Desconectar nodos para liberar memoria y evitar fugas
        try {
          source.disconnect();
          gainNode.disconnect();
        } catch (e) {
          console.error("Error al desconectar nodos:", e);
        }
        
        // Si el modo de voz continuo está activo, reactivamos la escucha
        if (isVoiceModeActive) {
          startVoiceCapture();
        }
      });
      
      audio.addEventListener("error", () => {
        console.error("Error de reproducción de audio");
        currentAudioRef.current = null;
        deleteAudioFile(audioUrl);
        
        try {
          source.disconnect();
          gainNode.disconnect();
        } catch (e) {}
        
        if (isVoiceModeActive) {
          startVoiceCapture();
        }
      });
      
      audio.play().catch((e) => {
        console.error("Error al reproducir audio:", e);
        currentAudioRef.current = null;
        deleteAudioFile(audioUrl);
        
        try {
          source.disconnect();
          gainNode.disconnect();
        } catch (e) {}
        
        if (isVoiceModeActive) {
          startVoiceCapture();
        }
      });
    } catch (err) {
      console.error("Excepción en reproducción de audio:", err);
    }
  };

  const deleteAudioFile = async (audioUrl: string) => {
    try {
      const filename = audioUrl.split("/").pop();
      await fetch(`${API_BASE}/api/audio/${filename}`, { method: "DELETE" });
    } catch (e) {
      console.error("Error al borrar archivo de audio temporal del servidor:", e);
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    localStorage.setItem("lily_volume", newVolume.toString());
    
    // Ajustar ganancia en tiempo real en la Web Audio API
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = newVolume;
    }
    
    // Ajustar volumen del tag de audio de manera segura (capping a 1.0)
    if (currentAudioRef.current) {
      currentAudioRef.current.volume = Math.min(newVolume, 1.0);
    }
  };

  // 4. Send Message logic
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend !== undefined ? textToSend : inputMessage).trim();
    if (!text || isTyping) return;

    if (!isConnected) {
      if (isInitialLoading) {
        alert(lang === "es" ? "Lily se está iniciando en segundo plano. Por favor, espera un momento..." : "Lily is starting up in the background. Please wait a moment...");
      } else {
        alert(lang === "es" ? "Lily no está conectada. Asegúrate de tener levantado el backend en el puerto 8000." : "Lily is not connected. Make sure the backend is running on port 8000.");
      }
      return;
    }

    if (textToSend === undefined) {
      setInputMessage("");
    }

    // Add user message
    const userMsg: Message = {
      id: Math.random().toString(),
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString(lang === "es" ? "es-ES" : "en-US", { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          user_id: "default_user",
          lang: lang,
        }),
      });

      if (!res.ok) throw new Error("Error del servidor");

      const data = await res.json();
      
      const assistantMsg: Message = {
        id: Math.random().toString(),
        role: "assistant",
        content: data.response,
        emotion: data.emotion,
        timestamp: new Date().toLocaleTimeString(lang === "es" ? "es-ES" : "en-US", { hour: "2-digit", minute: "2-digit" }),
      };
      
      setMessages((prev) => [...prev, assistantMsg]);
      setCurrentEmotion(data.emotion || "neutral");

      if (data.audio_url) {
        playAudio(data.audio_url);
      } else if (isVoiceModeActive) {
        // Si no hay respuesta de audio pero estamos en modo continuo de voz, reiniciamos escucha
        startVoiceCapture();
      }

    } catch (error) {
      console.error(error);
      const errorMsg: Message = {
        id: Math.random().toString(),
        role: "assistant",
        content: lang === "es" ? "Lo siento, Mijin, ocurrió un error en mi cerebro al procesar eso. ¿Podrías intentar de nuevo?" : "Sorry, Mijin, an error occurred in my brain while processing that. Could you try again?",
        emotion: "preocupada",
        timestamp: new Date().toLocaleTimeString(lang === "es" ? "es-ES" : "en-US", { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
      setCurrentEmotion("preocupada");
      if (isVoiceModeActive) {
        setTimeout(startVoiceCapture, 2000);
      }
    } finally {
      setIsTyping(false);
    }
  };

  const handleClearChat = () => {
    if (confirm(lang === "es" ? "¿Estás seguro de que quieres limpiar la conversación de la pantalla? (La memoria semántica de Lily seguirá guardada en el backend)" : "Are you sure you want to clear the conversation from the screen? (Lily's semantic memory will still be saved in the backend)")) {
      setMessages([]);
    }
  };

  // 5. Audio recording & Silence detection logic
  const toggleVoiceMode = () => {
    if (isVoiceModeActive) {
      setIsVoiceModeActive(false);
      stopVoiceMode();
    } else {
      setIsVoiceModeActive(true);
      startVoiceMode();
    }
  };

  const startVoiceMode = () => {
    setIsRecording(true);
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    startVoiceCapture();
  };

  const stopVoiceMode = () => {
    setIsRecording(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    cleanupAudioAnalyser();
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
  };

  const startVoiceCapture = () => {
    if (!isRecording && !isVoiceModeActive) return;

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.addEventListener("dataavailable", (event) => {
          audioChunksRef.current.push(event.data);
        });

        mediaRecorder.addEventListener("stop", () => {
          if (audioChunksRef.current.length > 0) {
            const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
            sendAudioToTranscribe(audioBlob);
          }
          cleanupAudioAnalyser();
        });

        mediaRecorder.start();
        setIsRecording(true);
        startSilenceDetection(stream);
      })
      .catch((err) => {
        console.error("Error accediendo al micrófono:", err);
        alert(lang === "es" ? "No se pudo acceder al micrófono para interactuar con Lily." : "Could not access the microphone to interact with Lily.");
        setIsVoiceModeActive(false);
        setIsRecording(false);
      });
  };

  const startSilenceDetection = (stream: MediaStream) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;
      
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      
      analyser.fftSize = 512;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      microphone.connect(analyser);
      
      const threshold = 12; // Umbral de detección
      const silenceDuration = 1800; // 1.8 segundos de silencio para cortar
      let lastSoundTime = Date.now();
      let speakingStarted = false;

      const checkAudio = () => {
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") return;
        
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;

        if (average > threshold) {
          lastSoundTime = Date.now();
          if (!speakingStarted) {
            speakingStarted = true;
            console.log("Voz detectada...");
          }
        } else {
          if (speakingStarted && Date.now() - lastSoundTime > silenceDuration) {
            console.log("Silencio detectado, deteniendo grabación.");
            setIsRecording(false);
            if (mediaRecorderRef.current) {
              mediaRecorderRef.current.stop();
            }
            return;
          }
        }
        animationFrameIdRef.current = requestAnimationFrame(checkAudio);
      };

      animationFrameIdRef.current = requestAnimationFrame(checkAudio);
    } catch (e) {
      console.error("Error inicializando detector de silencio:", e);
    }
  };

  const cleanupAudioAnalyser = () => {
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  };

  const sendAudioToTranscribe = async (audioBlob: Blob) => {
    const formData = new FormData();
    formData.append("file", audioBlob, "recording.wav");

    try {
      const res = await fetch(`${API_BASE}/api/transcribe?lang=${lang}`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Error en transcripción");

      const data = await res.json();
      const transcript = data.text;

      if (transcript && transcript.trim()) {
        handleSendMessage(transcript);
      } else if (isVoiceModeActive) {
        // Transcripción vacía, volver a grabar en modo continuo
        startVoiceCapture();
      }
    } catch (e) {
      console.error("Error transcribiendo audio:", e);
      if (isVoiceModeActive) {
        setTimeout(startVoiceCapture, 2000);
      }
    }
  };

  // Render variables
  const emotionDetails = EMOTION_CONFIG[currentEmotion] || EMOTION_CONFIG.neutral;

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#0B0F19] relative">
      {/* HEADER BAR */}
      <header className="h-18 border-b border-slate-900/60 px-6 sm:px-8 flex items-center justify-between gap-4 flex-shrink-0 bg-[#090C15]/40 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <div className="relative">
            {/* Glowing Orb depending on Emotion */}
            <div className={`w-9 h-9 rounded-full bg-gradient-to-tr ${emotionDetails.color} flex items-center justify-center shadow-lg shadow-violet-500/10 animate-pulse overflow-hidden`}>
              <img src="/cat.png" alt="Lily" className="w-8 h-8 rounded-full object-cover" />
            </div>
            <span className="absolute bottom-0 right-0 text-xs bg-slate-900 rounded-full">{emotionDetails.emoji}</span>
          </div>
          <div>
            <h2 className="font-extrabold text-slate-100 text-sm tracking-wide leading-none uppercase flex items-center gap-1.5">
              Lily AI Companion
              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${emotionDetails.bg}`}>
                {lang === "es" ? emotionDetails.text : (emotionDetails.text === "Feliz" ? "Happy" : emotionDetails.text === "Triste" ? "Sad" : emotionDetails.text === "Enojada" ? "Angry" : emotionDetails.text === "Emocionada" ? "Excited" : emotionDetails.text === "Neutral" ? "Neutral" : emotionDetails.text === "Cariñosa" ? "Affectionate" : emotionDetails.text === "Juguetona" ? "Playful" : emotionDetails.text === "Preocupada" ? "Worried" : "Surprised")}
              </span>
            </h2>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`w-1.5 h-1.5 rounded-full ${
                isConnected 
                  ? (isOllamaConnected ? "bg-emerald-500" : "bg-amber-500") 
                  : isInitialLoading 
                  ? "bg-sky-500 animate-pulse" 
                  : "bg-red-500"
              }`} />
              <span className="text-[10px] text-slate-550 font-medium">
                {isConnected
                  ? (isOllamaConnected ? t("lily_status_online") : t("lily_status_no_ollama"))
                  : isInitialLoading
                  ? (lang === "es" ? "Iniciando Lily AI..." : "Starting Lily AI...")
                  : t("lily_status_offline")}
              </span>
            </div>
          </div>
        </div>

        {/* Buttons / Controls */}
        <div className="flex items-center gap-2">
          {/* Volume Slider */}
          <div className="flex items-center gap-2 bg-slate-950/60 border border-slate-850 px-2.5 py-1.5 rounded-xl text-slate-400 mr-1">
            {volume === 0 ? (
              <VolumeX className="h-4 w-4 text-slate-500 cursor-pointer" onClick={() => handleVolumeChange(0.5)} />
            ) : volume < 0.5 ? (
              <Volume1 className="h-4 w-4 text-violet-400 cursor-pointer" onClick={() => handleVolumeChange(0)} />
            ) : (
              <Volume2 className="h-4 w-4 text-violet-400 cursor-pointer" onClick={() => handleVolumeChange(0)} />
            )}
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="w-14 sm:w-18 h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-violet-500"
              style={{
                background: `linear-gradient(to right, rgb(139, 92, 246) ${(volume / 2) * 100}%, rgb(15, 23, 42) ${(volume / 2) * 100}%)`
              }}
              title={lang === "es" ? "Volumen de Voz de Lily (con Amplificación hasta 200%)" : "Lily's Voice Volume (with Amplification up to 200%)"}
            />
            <span className="text-3xs font-mono w-6 text-right select-none">{Math.round(volume * 100)}%</span>
          </div>

          <button
            onClick={handleClearChat}
            className="p-2 rounded-xl border transition-all cursor-pointer bg-slate-950/60 border-slate-855 text-slate-400 hover:text-red-400 hover:border-red-500/30"
            title={t("lily_clear_chat")}
          >
            <Trash2 className="h-4 w-4" />
          </button>

          <button
            onClick={() => {
              setActivePanel(activePanel === "memory" ? "none" : "memory");
              loadMemory();
            }}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${activePanel === "memory" ? "bg-violet-600/20 border-violet-500/30 text-violet-300" : "bg-slate-950/60 border-slate-850 text-slate-400 hover:text-slate-200 hover:border-slate-800"}`}
            title={t("lily_view_memory")}
          >
            <Brain className="h-4 w-4" />
          </button>
          
          <button
            onClick={() => {
              setActivePanel(activePanel === "settings" ? "none" : "settings");
              loadRagStatsAndDocs();
            }}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${activePanel === "settings" ? "bg-violet-600/20 border-violet-500/30 text-violet-300" : "bg-slate-950/60 border-slate-850 text-slate-400 hover:text-slate-200 hover:border-slate-800"}`}
            title={t("lily_view_settings")}
          >
            <Settings className="h-4 w-4" />
          </button>

          <button
            onClick={() => setActivePanel(activePanel === "commands" ? "none" : "commands")}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${activePanel === "commands" ? "bg-violet-600/20 border-violet-500/30 text-violet-300" : "bg-slate-950/60 border-slate-855 text-slate-400 hover:text-slate-200 hover:border-slate-800"}`}
            title={t("lily_view_commands")}
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* CHAT MESSAGES PANE */}
      <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 custom-scrollbar flex flex-col">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 max-w-lg mx-auto">
            <div className={`w-16 h-16 rounded-3xl bg-gradient-to-tr ${emotionDetails.color} flex items-center justify-center shadow-xl shadow-violet-500/10 mb-6 animate-bounce overflow-hidden`}>
              <img src="/cat.png" alt="Lily" className="w-14 h-14 rounded-2xl object-cover" />
            </div>
            <h3 className="text-lg font-bold text-slate-200">{t("lily_welcome_title")}</h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
              {t("lily_welcome_subtitle")}
            </p>
            <div className="flex flex-wrap gap-2.5 mt-6 justify-center">
              <button 
                onClick={() => setInputMessage(lang === "es" ? "¿Qué enlaces tengo guardados sobre tecnología?" : "What links do I have saved about technology?")}
                className="px-3.5 py-1.5 bg-slate-950 border border-slate-850 hover:border-slate-800 text-3xs sm:text-2xs rounded-xl font-medium text-slate-400 hover:text-slate-200 transition-colors"
              >
                {lang === "es" ? "🔍 Consultar mis Links" : "🔍 Check my Links"}
              </button>
              <button 
                onClick={() => setInputMessage(lang === "es" ? "¿Cómo te sientes hoy Lily?" : "How do you feel today Lily?")}
                className="px-3.5 py-1.5 bg-slate-950 border border-slate-850 hover:border-slate-800 text-3xs sm:text-2xs rounded-xl font-medium text-slate-400 hover:text-slate-200 transition-colors"
              >
                {lang === "es" ? "😊 ¿Cómo te sientes?" : "😊 How do you feel?"}
              </button>
              <button 
                onClick={() => setInputMessage(lang === "es" ? "Recuérdame revisar mis correos en 5 minutos" : "Remind me to check my emails in 5 minutes")}
                className="px-3.5 py-1.5 bg-slate-950 border border-slate-850 hover:border-slate-800 text-3xs sm:text-2xs rounded-xl font-medium text-slate-400 hover:text-slate-200 transition-colors"
              >
                {lang === "es" ? "⏰ Agendar Recordatorio" : "⏰ Schedule Reminder"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 max-w-4xl mx-auto w-full flex-1">
            <AnimatePresence initial={false}>
              {messages.map((msg) => {
                const isUser = msg.role === "user";
                const emotionStyle = msg.emotion ? EMOTION_CONFIG[msg.emotion] : null;

                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={`flex items-start gap-3.5 ${isUser ? "flex-row-reverse" : ""}`}
                  >
                    {/* Avatar Bubble */}
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden ${isUser ? "bg-violet-600 text-white" : `bg-gradient-to-tr ${emotionStyle ? emotionStyle.color : "from-slate-600 to-slate-700"}`}`}>
                      {isUser ? <span className="text-sm font-semibold">👤</span> : <img src="/cat.png" alt="Lily" className="w-7 h-7 rounded-lg object-cover" />}
                    </div>

                    {/* Chat Box */}
                    <div className={`max-w-[80%] rounded-2xl p-4 border text-sm shadow-md ${isUser ? "bg-violet-950/20 border-violet-850 text-slate-100" : "bg-slate-950/40 border-slate-900 text-slate-100"}`}>
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      <div className="flex items-center justify-between gap-4 mt-2">
                        {msg.emotion && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${emotionStyle?.bg}`}>
                            {emotionStyle?.emoji} {emotionStyle?.text}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-600 font-mono ml-auto">{msg.timestamp}</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {isTyping && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-start gap-3.5"
              >
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-slate-600 to-slate-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  <img src="/cat.png" alt="Lily" className="w-7 h-7 rounded-lg object-cover" />
                </div>
                <div className="bg-slate-950/40 border border-slate-900 rounded-2xl px-4 py-3.5 flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </motion.div>
            )}
            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      {/* INPUT AREA */}
      <footer className="p-4 sm:p-6 border-t border-slate-900/60 bg-[#090C15]/40 backdrop-blur-md">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-2">
            {/* Input Bar */}
            <div className="relative flex-1 flex items-center bg-slate-950/80 border border-slate-850 hover:border-slate-800 focus-within:border-violet-600 focus-within:ring-1 focus-within:ring-violet-600 rounded-xl transition-all">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={isRecording ? (lang === "es" ? "Escuchando y transcribiendo..." : "Listening and transcribing...") : (lang === "es" ? `Pregúntale algo a Lily, ${userName}...` : `Ask Lily anything, ${userName}...`)}
                rows={1}
                className="w-full pl-4 pr-12 py-3 bg-transparent text-slate-100 placeholder-slate-550 rounded-xl text-sm focus:outline-none resize-none overflow-y-auto max-h-24 custom-scrollbar"
                disabled={isRecording}
              />
              <span className="absolute right-3 text-3xs text-slate-650 font-mono hidden sm:inline">
                {inputMessage.length}/2000
              </span>
            </div>

            {/* Mic Toggle Button */}
            <button
              onClick={toggleVoiceMode}
              className={`p-3 rounded-xl border transition-all cursor-pointer flex-shrink-0 flex items-center justify-center ${isVoiceModeActive ? "bg-red-500/10 border-red-500/25 text-red-400 hover:bg-red-500/15" : "bg-slate-950/60 border-slate-855 text-slate-400 hover:text-slate-200 hover:border-slate-800"}`}
              title={isVoiceModeActive ? (lang === "es" ? "Desactivar modo voz continuo" : "Disable continuous voice mode") : (lang === "es" ? "Activar modo de voz manos libres" : "Enable hands-free voice mode")}
            >
              {isVoiceModeActive ? <MicOff className="h-5 w-5 animate-pulse" /> : <Mic className="h-5 w-5" />}
            </button>

            {/* Send Button */}
            <button
              onClick={() => handleSendMessage()}
              disabled={isTyping || !inputMessage.trim()}
              className="p-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl shadow-md transition-all active:scale-98 cursor-pointer flex-shrink-0 flex items-center justify-center"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
          
          <div className="flex items-center justify-between text-3xs text-slate-600 mt-2 px-1">
            <span>Lily analiza tus mensajes locales usando Ollama</span>
            {isVoiceModeActive && <span className="text-red-400 animate-pulse flex items-center gap-1">● Modo Voz Activo (Detección de silencio activada)</span>}
          </div>
        </div>
      </footer>

      {/* OVERLAY MODAL PANELS (Settings / Memory / Commands) */}
      <AnimatePresence>
        {activePanel !== "none" && (
          <div className="absolute inset-0 bg-[#060810]/70 backdrop-blur-sm z-20 flex justify-end">
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="w-full max-w-lg bg-[#080B14] border-l border-slate-900 h-full flex flex-col shadow-2xl p-6 overflow-y-auto custom-scrollbar"
            >
              <div className="flex items-center justify-between border-b border-slate-900 pb-4 mb-6">
                <h3 className="font-extrabold text-slate-100 text-md tracking-wide leading-none uppercase flex items-center gap-2">
                  {activePanel === "settings" && <><Settings className="h-5 w-5 text-violet-400" /> {t("settings_title")}</>}
                  {activePanel === "memory" && <><Brain className="h-5 w-5 text-violet-400" /> {t("memory_title")}</>}
                  {activePanel === "commands" && <><HelpCircle className="h-5 w-5 text-violet-400" /> {t("commands_title")}</>}
                </h3>
                <button
                  onClick={() => setActivePanel("none")}
                  className="text-xs text-slate-500 hover:text-slate-300 font-semibold cursor-pointer border border-slate-850 hover:border-slate-800 bg-slate-950 px-3 py-1.5 rounded-lg"
                >
                  {lang === "es" ? "Cerrar" : "Close"}
                </button>
              </div>

              {/* PANEL CONTENT - SETTINGS */}
              {activePanel === "settings" && (
                <div className="space-y-6">
                  {/* Language Selector */}
                  <div className="bg-slate-950/40 border border-slate-900/60 rounded-2xl p-4 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-violet-400" /> {t("settings_lang_label")}
                    </h4>
                    <p className="text-3xs text-slate-500">
                      {lang === "es" ? "Selecciona el idioma de visualización de la aplicación." : "Select the application's display language."}
                    </p>
                    <button
                      onClick={() => {
                        const nextLang = lang === "es" ? "en" : "es";
                        setLang(nextLang);
                        localStorage.setItem("app_lang", nextLang);
                      }}
                      className="w-full bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold py-2.5 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
                    >
                      🌐 {t("settings_lang_toggle")}
                    </button>
                  </div>

                  {/* Auto Start Checkbox */}
                  <div className="bg-slate-950/40 border border-slate-900/60 rounded-2xl p-4 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                      🔌 {lang === "es" ? "Inicio con Windows" : "Start with Windows"}
                    </h4>
                    <p className="text-3xs text-slate-500">
                      {lang === "es" 
                        ? "Permite que la aplicación se inicie automáticamente cuando se enciende la PC." 
                        : "Allow the application to launch automatically when the PC starts up."}
                    </p>
                    <label className="flex items-center gap-3 cursor-pointer select-none py-1.5 px-3 bg-slate-950/80 border border-slate-850 hover:border-slate-800 rounded-xl transition-all">
                      <input
                        type="checkbox"
                        checked={autostartEnabled}
                        onChange={toggleAutostart}
                        className="w-4 h-4 rounded text-violet-600 bg-slate-950 border-slate-800 focus:ring-violet-600 cursor-pointer"
                      />
                      <span className="text-xs font-semibold text-slate-200">
                        {lang === "es" ? "Ejecutar al encender la PC" : "Run at Windows startup"}
                      </span>
                    </label>
                  </div>

                  {/* Idioma de Lily Selector */}
                  <div className="bg-slate-950/40 border border-slate-900/60 rounded-2xl p-4 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                      🗣️ {lang === "es" ? "Idioma de Lily" : "Lily's Language"}
                    </h4>
                    <p className="text-3xs text-slate-500">
                      {lang === "es" 
                        ? "Elige si quieres que Lily te responda siempre en español, en inglés o de forma automática." 
                        : "Choose whether you want Lily to always respond in Spanish, English, or automatically."}
                    </p>
                    <div className="flex gap-2">
                      {(["auto", "es", "en"] as const).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => saveLilyLangPreference(mode)}
                          className={`flex-1 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                            lilyLangMode === mode
                              ? "bg-violet-600/25 border-violet-500 text-violet-300"
                              : "bg-slate-950/80 border-slate-850 text-slate-400 hover:border-slate-800"
                          }`}
                        >
                          {mode === "auto" 
                            ? (lang === "es" ? "Automático" : "Auto") 
                            : mode === "es" 
                            ? (lang === "es" ? "Español" : "Spanish") 
                            : (lang === "es" ? "Inglés" : "English")}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Nombre de Usuario */}
                  <div className="bg-slate-950/40 border border-slate-900/60 rounded-2xl p-4 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                      <User className="h-4 w-4 text-violet-400" /> {t("settings_user_title")}
                    </h4>
                    <p className="text-3xs text-slate-500">{lang === "es" ? "¿Cómo quieres que Lily se dirija a ti en las conversaciones?" : "How do you want Lily to address you in conversations?"}</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        placeholder={lang === "es" ? "Mijin, Amor, Juan..." : "Name..."}
                        className="flex-1 px-3 py-2 bg-slate-950 border border-slate-850 hover:border-slate-800 text-slate-100 text-xs rounded-xl focus:outline-none focus:border-violet-600"
                      />
                      <button
                        onClick={saveUserNamePreference}
                        className="bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors cursor-pointer"
                      >
                        {t("modal_save")}
                      </button>
                    </div>
                  </div>

                  {/* Gmail Integration */}
                  <div className="bg-slate-950/40 border border-slate-900/60 rounded-2xl p-4 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                      <Mail className="h-4 w-4 text-violet-400" /> {lang === "es" ? "Integración con Gmail" : "Gmail Integration"}
                    </h4>
                    <p className="text-3xs text-slate-500">{lang === "es" ? "Permite a Lily redactar y leer correos electrónicos desatendidos usando contraseñas de aplicación de Google." : "Allows Lily to compose and read emails unattended using Google app passwords."}</p>
                    <div className="space-y-2">
                      <input
                        type="email"
                        value={gmailUser}
                        onChange={(e) => setGmailUser(e.target.value)}
                        placeholder="tu_correo@gmail.com"
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-855 hover:border-slate-800 text-slate-100 text-xs rounded-xl focus:outline-none focus:border-violet-600"
                      />
                      <input
                        type="password"
                        value={gmailPassword}
                        onChange={(e) => setGmailPassword(e.target.value)}
                        placeholder={lang === "es" ? "Contraseña de aplicación de 16 caracteres" : "16-character app password"}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-855 hover:border-slate-800 text-slate-100 text-xs rounded-xl focus:outline-none focus:border-violet-600"
                      />
                      <button
                        onClick={saveGmailCredentials}
                        className="w-full bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold py-2 rounded-xl transition-colors cursor-pointer"
                      >
                        {t("settings_gmail_save")}
                      </button>
                    </div>
                  </div>

                  {/* RAG - Subir Documento */}
                  <div className="bg-slate-950/40 border border-slate-900/60 rounded-2xl p-4 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                      <Database className="h-4 w-4 text-violet-400" /> {t("settings_rag_stats")}
                    </h4>
                    <p className="text-3xs text-slate-500">{lang === "es" ? "Añade documentos de texto (.txt, .md, .pdf) al conocimiento general de Lily. Ella los recordará para responder tus preguntas." : "Add text documents (.txt, .md, .pdf) to Lily's general knowledge. She will remember them to answer your questions."}</p>
                    <div className="border border-dashed border-slate-800/80 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
                      <FileText className="h-8 w-8 text-slate-600 mb-2" />
                      <input
                        type="file"
                        id="ragFile"
                        accept=".txt,.md,.pdf"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setSelectedFile(e.target.files[0]);
                            setUploadStatus("");
                          }
                        }}
                        className="hidden"
                      />
                      <label
                        htmlFor="ragFile"
                        className="text-xs bg-slate-950 border border-slate-850 hover:border-slate-800 px-4 py-2 rounded-xl font-medium text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
                      >
                        {selectedFile ? selectedFile.name : t("settings_ingest_btn")}
                      </label>
                      
                      {selectedFile && (
                        <button
                          onClick={handleFileUpload}
                          disabled={isUploading}
                          className="mt-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-semibold px-4 py-1.5 rounded-xl transition-colors cursor-pointer"
                        >
                          {isUploading ? (lang === "es" ? "Indexando..." : "Indexing...") : (lang === "es" ? "Subir e Indexar" : "Upload & Index")}
                        </button>
                      )}
                      
                      {uploadStatus && (
                        <p className="text-3xs text-slate-400 mt-2.5 max-w-xs">{uploadStatus}</p>
                      )}
                    </div>

                    {/* Stats */}
                    {ragStats && (
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div className="bg-slate-950 border border-slate-900 rounded-xl p-2.5 text-center">
                          <div className="text-sm font-bold text-slate-200">{ragStats.total_docs}</div>
                          <div className="text-[10px] text-slate-550 font-medium">{t("settings_rag_docs")}</div>
                        </div>
                        <div className="bg-slate-950 border border-slate-900 rounded-xl p-2.5 text-center">
                          <div className="text-sm font-bold text-slate-200">{ragStats.total_chunks}</div>
                          <div className="text-[10px] text-slate-550 font-medium">{t("settings_rag_chunks")}</div>
                        </div>
                      </div>
                    )}

                    {/* Docs List */}
                    <div className="space-y-1.5 mt-4">
                      <div className="flex justify-between items-center px-1">
                        <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t("settings_rag_docs")}</h5>
                        <button
                          onClick={handleReindex}
                          className="text-[9px] text-violet-400 hover:text-violet-300 font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <RefreshCw className="h-3 w-3" /> {lang === "es" ? "Sincronizar carpeta" : "Sync folder"}
                        </button>
                      </div>
                      
                      <div className="max-h-[160px] overflow-y-auto pr-1 space-y-1 custom-scrollbar">
                        {ragDocs.filter(doc => doc.source !== "vault_db").length === 0 ? (
                          <p className="text-3xs italic text-slate-655 px-1 py-1">{lang === "es" ? "No hay documentos cargados en el RAG." : "No documents loaded in the RAG."}</p>
                        ) : (
                          ragDocs.filter(doc => doc.source !== "vault_db").map((doc) => (
                            <div
                              key={doc.id}
                              className="flex items-center justify-between px-3 py-1.5 bg-slate-950 border border-slate-900/60 rounded-xl text-3xs text-slate-400"
                            >
                              <span className="truncate max-w-[200px]" title={doc.name}>
                                📄 {doc.name}
                              </span>
                              <button
                                onClick={() => handleDeleteDoc(doc.id)}
                                className="text-red-400 hover:text-red-300 cursor-pointer p-1 rounded hover:bg-red-500/10"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* PANEL CONTENT - MEMORY */}
              {activePanel === "memory" && (
                <div className="space-y-5">
                  <div className="bg-slate-950/40 border border-slate-900/60 rounded-2xl p-4 space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                      💭 {lang === "es" ? "Resumen de Relación y Conversación" : "Relationship & Conversation Summary"}
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 border border-slate-900 p-3.5 rounded-xl whitespace-pre-wrap">
                      {memorySummary}
                    </p>
                  </div>

                  <div className="bg-slate-950/40 border border-slate-900/60 rounded-2xl p-4 space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                      ❤️ {lang === "es" ? "Resumen del Estado Emocional del Usuario" : "User's Emotional State Summary"}
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 border border-slate-900 p-3.5 rounded-xl whitespace-pre-wrap">
                      {emotionalSummary}
                    </p>
                  </div>
                  
                  <div className="flex justify-center gap-3 p-2">
                    <button
                      onClick={loadMemory}
                      className="text-xs bg-slate-950 border border-slate-850 hover:border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-slate-200 px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> {t("memory_reload")}
                    </button>
                    <button
                      onClick={handleClearMemory}
                      className="text-xs bg-red-950/20 border border-red-900/30 hover:border-red-500/40 hover:bg-red-500/10 text-red-400 hover:text-red-300 px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> {t("memory_clear")}
                    </button>
                  </div>
                </div>
              )}

              {/* PANEL CONTENT - COMMANDS */}
              {activePanel === "commands" && (
                <div className="space-y-4 text-xs pr-1">
                  <p className="text-slate-400 leading-relaxed mb-2">
                    {lang === "es" ? "Lily cuenta con un conjunto de comandos integrados. Puedes invocarlos directamente escribiendo en el chat o hablándolos en voz alta:" : "Lily has a set of built-in commands. You can invoke them directly by typing in the chat or speaking them out loud:"}
                  </p>
                  
                  <div className="space-y-3.5">
                    {/* Reproducción */}
                    <div className="bg-slate-950/50 border border-slate-900 rounded-xl p-3.5 space-y-1.5">
                      <div className="font-bold text-slate-200 text-2xs uppercase tracking-wide text-violet-400">{lang === "es" ? "🎵 YouTube y Multimedia" : "🎵 YouTube & Multimedia"}</div>
                      <p className="text-slate-400 leading-normal">
                        {lang === "es" ? "Dile: " : "Tell her: "}<code className="bg-slate-950 border border-slate-900 text-indigo-400 px-1 py-0.5 rounded text-[10px]">reproduce lofi girl</code> {lang === "es" ? "o" : "or"} <code className="bg-slate-950 border border-slate-900 text-indigo-400 px-1 py-0.5 rounded text-[10px]">pon música de queen</code>.
                        {lang === "es" ? "Abre YouTube y reproduce el contenido en el navegador. También puedes controlar la reproducción con " : "Opens YouTube and plays the content in the browser. You can also control playback with "}<code className="text-indigo-400 font-mono">pausa</code> {lang === "es" ? "o" : "or"} <code className="text-indigo-400 font-mono">siguiente</code>.
                      </p>
                    </div>

                    {/* Volumen */}
                    <div className="bg-slate-950/50 border border-slate-900 rounded-xl p-3.5 space-y-1.5">
                      <div className="font-bold text-slate-200 text-2xs uppercase tracking-wide text-violet-400">{lang === "es" ? "🔊 Volumen del Sistema" : "🔊 System Volume"}</div>
                      <p className="text-slate-400 leading-normal">
                        {lang === "es" ? "Pídele: " : "Ask her: "}<code className="bg-slate-950 border border-slate-900 text-indigo-400 px-1 py-0.5 rounded text-[10px]">sube volumen</code>, <code className="bg-slate-950 border border-slate-900 text-indigo-400 px-1 py-0.5 rounded text-[10px]">baja volumen</code> {lang === "es" ? "o" : "or"} <code className="bg-slate-950 border border-slate-900 text-indigo-400 px-1 py-0.5 rounded text-[10px]">silencio</code> {lang === "es" ? "para ajustar el nivel de audio del sistema operativo." : "to adjust the operating system's audio level."}
                      </p>
                    </div>

                    {/* RAG e Internet */}
                    <div className="bg-slate-950/50 border border-slate-900 rounded-xl p-3.5 space-y-1.5">
                      <div className="font-bold text-slate-200 text-2xs uppercase tracking-wide text-violet-400">{lang === "es" ? "🌐 Búsqueda Web Real-Time (Searxng)" : "🌐 Real-Time Web Search (Searxng)"}</div>
                      <p className="text-slate-400 leading-normal">
                        {lang === "es" ? "Dile: " : "Tell her: "}<code className="bg-slate-950 border border-slate-900 text-indigo-400 px-1 py-0.5 rounded text-[10px]">busca en internet sobre X</code>. {lang === "es" ? "Lily hará una consulta en la red, inyectará la información de internet y te dará una respuesta fresca e informada." : "Lily will make a query to the web, inject internet information, and give you a fresh, informed response."}
                      </p>
                    </div>

                    {/* Gmail */}
                    <div className="bg-slate-950/50 border border-slate-900 rounded-xl p-3.5 space-y-1.5">
                      <div className="font-bold text-slate-200 text-2xs uppercase tracking-wide text-violet-400">{lang === "es" ? "✉️ Correos Electrónicos" : "✉️ Emails"}</div>
                      <p className="text-slate-400 leading-normal">
                        {lang === "es" ? "Pídele: " : "Ask her: "}<code className="bg-slate-950 border border-slate-900 text-indigo-400 px-1 py-0.5 rounded text-[10px]">revisa mis correos</code> {lang === "es" ? "o" : "or"} <code className="bg-slate-950 border border-slate-900 text-indigo-400 px-1 py-0.5 rounded text-[10px]">envía un correo a juan@gmail.com asunto reunión mensaje llego tarde</code>. {lang === "es" ? "Revisa o envía correos electrónicos." : "Check or send emails."}
                      </p>
                    </div>

                    {/* Recordatorios */}
                    <div className="bg-slate-950/50 border border-slate-900 rounded-xl p-3.5 space-y-1.5">
                      <div className="font-bold text-slate-200 text-2xs uppercase tracking-wide text-violet-400">{lang === "es" ? "⏰ Recordatorios y Tareas" : "⏰ Reminders & Tasks"}</div>
                      <p className="text-slate-400 leading-normal">
                        {lang === "es" ? "Usa: " : "Use: "}<code className="bg-slate-950 border border-slate-900 text-indigo-400 px-1 py-0.5 rounded text-[10px]">recuérdame tomar agua en 30 minutos</code> {lang === "es" ? "o" : "or"} <code className="bg-slate-950 border border-slate-900 text-indigo-400 px-1 py-0.5 rounded text-[10px]">qué tareas tengo</code>. {lang === "es" ? "Lily programará recordatorios de voz nativos." : "Lily will schedule native voice reminders."}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
