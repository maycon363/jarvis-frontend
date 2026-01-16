// src/pages/Chat.tsx
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { IronManModel } from '../components/IronManModel';
import { v4 as uuidv4 } from 'uuid';
import { Canvas } from '@react-three/fiber';
import { ParticleBrain } from '../components/ParticleBrain';
import { FaMicrophone, FaStop, FaArrowAltCircleUp } from "react-icons/fa";

// Configuração de URL - Verifique se o seu Backend roda na 3001
const BACKEND_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:3001"
    : "https://jarvis-backend-6xuu.onrender.com";

interface Message {
  sender: 'user' | 'jarvis';
  text: string;
}

interface ChatProps {
  toggleMenu: () => void;
  isMenuOpen: boolean;
  show3DModel: boolean;
  environmentPreset: string;
  particleColor?: string;
  particleCount: number;
  particleSize: number;
  clearChatRef: React.MutableRefObject<(() => void) | null>;
}

interface ChatResponse {
  type: "message" | "action";
  reply: string;
  payload: any;
  sessionId: string;
  audioBase64?: string; // Campo opcional vindo do backend
  humor?: 'angry' | 'calm' | 'neutral'; // Campo opcional vindo do backend
}

// Fallback para voz do sistema caso o servidor de voz caia
const fallbackSpeak = (text: string, onStateChange: (s: boolean) => void) => {
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.onstart = () => onStateChange(true);
  utterance.onend = () => onStateChange(false);
  utterance.pitch = 1;
  utterance.rate = 1;
  synth.speak(utterance);
};

export default function Chat({
  toggleMenu,
  isMenuOpen,
  show3DModel,
  environmentPreset,
  particleCount,
  particleSize,
  clearChatRef
}: ChatProps) {
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [recognizing, setRecognizing] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [armorError, setArmorError] = useState(false);
  const [sphereStatus, setSphereStatus] = useState<"idle" | "speaking" | "error" | "success">("idle");

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [humor, setHumor] = useState<'angry' | 'calm' | 'neutral'>('neutral');

  // ID de Sessão único
  const [sessionId] = useState(() => {
    const stored = sessionStorage.getItem("jarvis_session_id");
    if (stored) return stored;
    const newId = uuidv4();
    sessionStorage.setItem("jarvis_session_id", newId);
    return newId;
  });

  const forceStopListening = () => {
    if (recorderRef.current) {
      try {
        recorderRef.current.stop();
        recorderRef.current.stream.getTracks().forEach(t => t.stop());
      } catch {}
      recorderRef.current = null;
    }
    setRecognizing(false);
    setSphereStatus("idle");
  };

  const speak = async (text: string, isError = false) => {
    forceStopListening();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }

    setArmorError(isError);
    setSphereStatus(isError ? "error" : "speaking");

    try {
      const response = await axios.post(`${BACKEND_URL}/api/speak`, { text });
      
      if (response.data.audioBase64) {
        const audio = new Audio(`data:audio/mp3;base64,${response.data.audioBase64}`);
        audioRef.current = audio;

        audio.onplay = () => setSpeaking(true);
        audio.onended = () => {
          setSpeaking(false);
          setSphereStatus("idle");
        };

        await audio.play();
      }
    } catch (err) {
      console.error("Erro na voz:", err);
      fallbackSpeak(text, (s) => setSpeaking(s));
    }
  };

  const sendAndProcessMessage = async (userMessage: string) => {
  
    const raivaTermos = ["burro", "estúpido", "merda", "lixo", "foda-se", "porra", "ódio",
      "idiota", "imbecil", "canalha", "desgraçado", "maldito",  "cretino", "babaca", "vagabundo",
      "corno", "palhaço", "vergonha", "nojento", "escroto", "arrombado", "otário", "pilantra",
      "safado", "desprezível", "patético", "verme", "inútil", "fracassado",
      "desgraça", "malfeitor", "canalha", "criminoso", "traidor", "covarde", "farsante",
      "hipócrita", "manipulador", "tóxico", "abusivo", "perverso", "sádico", "vilão",
      "desumano", "monstro", "demônio", "diabo",  "inferno", "purgatório", "apodrecer",
      "aniquilar", "destruir", "devorar", "esmagar", "queimar", "explodir"
    ];
    if (raivaTermos.some(t => userMessage.toLowerCase().includes(t))) {
      setHumor('angry');
      setArmorError(true);
    }

    setMessages((p) => [...p, { sender: "user", text: userMessage }]);
    setSphereStatus("speaking");

    try {
      const response = await axios.post<ChatResponse>(`${BACKEND_URL}/api/chat`, { 
        message: userMessage, 
        sessionId 
      });

      const { type, payload, audioBase64, humor: humorVindoDoBackend } = response.data;

      if (humorVindoDoBackend === 'neutral' || humorVindoDoBackend === 'calm') {
        setArmorError(false); 
      } else {
        setHumor('neutral');
      }
      if (humorVindoDoBackend) {
        setHumor(humorVindoDoBackend);
      } else {
        setHumor('neutral');
      }
      
      let textoFinal = payload;
      if (type === "action") {
        try {
          const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
          textoFinal = parsed.message || "Protocolo executado.";
        } catch { textoFinal = payload; }
      }

      if (audioBase64) {
        const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
        audioRef.current = audio;
        audio.onplay = () => {
          setSpeaking(true);
          setMessages((p) => [...p, { sender: "jarvis", text: textoFinal }]);
        };
        audio.onended = () => {
          setSpeaking(false);
          setSphereStatus("idle");
        };
        await audio.play().catch(() => {
          setMessages((p) => [...p, { sender: "jarvis", text: textoFinal }]);
          setSphereStatus("idle");
        });
      } else {
        setMessages((p) => [...p, { sender: "jarvis", text: textoFinal }]);
        speak(textoFinal); 
      }

    } catch (err) {
      console.error("ERRO NA COMUNICAÇÃO COM JARVIS:", err);
      setSphereStatus("error");
      setArmorError(true);  
      setHumor('angry');    
    }
  };

  const sendMessage = () => {
    console.log("Tentando enviar mensagem:", input); // RASTREADOR 1
    if (!input.trim()) {
      console.warn("Input vazio, não enviado.");
      return;
    }
    if (speaking) {
      console.warn("Jarvis está falando, aguarde.");
      return;
    }
    
    const msg = input.trim();
    setInput("");
    sendAndProcessMessage(msg);
  };

  const startRecording = async () => {
    if (speaking) return;
    if (recognizing) { stopRecording(); return; }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      recorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const formData = new FormData();
        formData.append("audio", audioBlob, "audio.webm");

        try {
          const sttRes = await fetch(`${BACKEND_URL}/api/stt`, { method: "POST", body: formData });
          const sttData = await sttRes.json();
          if (sttData.text) sendAndProcessMessage(sttData.text);
        } catch (err) {
          console.error("Erro voz:", err);
        }
        setRecognizing(false);
        setSphereStatus("idle");
      };

      recorder.start();
      setRecognizing(true);
      setSphereStatus("success");
    } catch (err) {
      console.error("Erro mic:", err);
      alert("Erro ao acessar o microfone.");
    }
  };

  const stopRecording = () => {
    if (!recorderRef.current) return;
    try { 
      recorderRef.current.stop(); 
      recorderRef.current.stream.getTracks().forEach(t => t.stop()); 
    } catch {}
    setRecognizing(false);
  };

  // Efeitos de ciclo de vida
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { clearChatRef.current = () => setMessages([]); }, [clearChatRef]);
  
  useEffect(() => {
    const handleVisibility = () => { if (document.hidden) forceStopListening(); };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  return (
    <div className="jarvis-container">
      <button onClick={toggleMenu} className="hamburger-button" aria-label="Menu">
        {isMenuOpen ? "✕" : "☰"}
      </button>

      <div className="layout-wrapper">
        <div className="model-side">
          {show3DModel ? (
            <IronManModel speaking={speaking} environmentPreset={environmentPreset} error={armorError} humor={humor} />
          ) : (
            <div className="lite-placeholder">
              <Canvas>
                <ParticleBrain status={sphereStatus} particleCount={particleCount} size={particleSize} />
              </Canvas>
            </div>
          )}
        </div>

        <div className="chat-side">
          <div className="chat-window">
            {messages.length === 0 && (
              <div className="empty-chat">Aguardando comandos, senhor Maycon...</div>
            )}
            {messages.map((msg, idx) => (
              <div key={idx} className={`message ${msg.sender}`}>
                <strong>{msg.sender === "jarvis" ? "JARVIS" : "VOCÊ"}:</strong>{" "}
                {msg.text}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <div className="input-area">
            <div className="input-wrapper">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Fale com o JARVIS..."
                disabled={speaking}
              />
              <button
                className="send-inside"
                onClick={sendMessage}
                disabled={!input.trim() || speaking}
              >
                <FaArrowAltCircleUp size={29} />
              </button>
            </div>

            <button
              onClick={startRecording}
              className={`mic-button ${recognizing ? "active" : ""}`}
              disabled={speaking}
            >
              {recognizing ? <FaStop size={18} /> : <FaMicrophone size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}