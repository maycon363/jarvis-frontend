// src/pages/Chat.tsx
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { IronManModel } from '../components/IronManModel';
import { v4 as uuidv4 } from 'uuid';
import { Canvas } from '@react-three/fiber';
import { ParticleSphere } from '../components/ParticleSphere';
import { FaMicrophone, FaStop, FaPaperPlane } from "react-icons/fa";
import { FaArrowAltCircleUp } from "react-icons/fa";

// 🔹 Backend dinâmico: localhost para dev, Render para produção
const BACKEND_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:3001"
    : "https://jarvis-backend-6xuu.onrender.com";

const openLink = (url: string) => {
  if (!url) return;
  const isMobile = /android|iphone|ipad/i.test(navigator.userAgent);
  try {
    isMobile
      ? (window.location.href = url)
      : window.open(url, "_blank", "noopener,noreferrer");
  } catch (e) {
    console.error("Erro ao abrir link:", e);
  }
};

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
  reply: string;
  sessionId: string;
  audioBase64: string | null;
}

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
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [armorError, setArmorError] = useState(false);

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const [sphereStatus, setSphereStatus] =
    useState<"idle" | "speaking" | "error" | "success">("idle");

  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);

  const [sessionId] = useState(() => {
    const stored = sessionStorage.getItem("jarvis_session_id");
    if (stored) return stored;
    const newId = uuidv4();
    sessionStorage.setItem("jarvis_session_id", newId);
    return newId;
  });

  const clearMessages = () => setMessages([]);
  useEffect(() => {
    clearChatRef.current = clearMessages;
  }, []);

  const speak = (text: string, forceErrorState = false) => {
    if (!forceErrorState) setSphereStatus("speaking");
    fallbackSpeak(text, (state) => {
      setSpeaking(state);
      if (!state && !forceErrorState) setSphereStatus("idle");
    });
  };

  const respostasOffline = (msg: string) => {
    const t = msg.toLowerCase();
    return null;
  };

  const sendAndProcessMessage = async (userMessage: string) => {
    if (!userMessage.trim()) return;

    setMessages((p) => [...p, { sender: "user", text: userMessage }]);
    setSphereStatus("speaking");

    if (isOffline) {
      const resposta =
        respostasOffline(userMessage) ||
        "Estou offline no momento, tente novamente mais tarde.";

      setMessages((p) => [...p, { sender: "jarvis", text: resposta }]);
      speak(resposta);
      return;
    }

    try {
      const response = await axios.post<ChatResponse>(
        `${BACKEND_URL}/api/chat`,
        { message: userMessage, sessionId }
      );

      const botMessage = response.data.reply;
      setMessages((p) => [...p, { sender: "jarvis", text: botMessage }]);

      const urlMatch = botMessage.match(/https?:\/\/[^\s]+/);
      if (urlMatch) openLink(urlMatch[0]);

      setSphereStatus("success");
      speak(botMessage);
    } catch (err) {
      console.error("Erro ao enviar:", err);
      setSphereStatus("error");
      setArmorError(true);

      const msg = "Sistema em manutenção, tente novamente mais tarde!";
      setMessages((p) => [...p, { sender: "jarvis", text: msg }]);

      speak(msg, true);

      setTimeout(() => {
          setSphereStatus("idle");
          setArmorError(false);
      }, 3500);
    }
  };

  const sendMessage = () => {
    if (!input.trim()) return;
    const msg = input.trim();
    setInput("");
    sendAndProcessMessage(msg);
  };

  const sendVoiceMessage = async (text: string) => {
    if (!text.trim()) return;
    await sendAndProcessMessage(text);
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
          if (sttData.text) sendVoiceMessage(sttData.text);
        } catch (err) {
          console.error("Erro voz:", err);
        }

        audioChunksRef.current = [];
        setRecognizing(false);
        setSphereStatus("idle");
      };

      recorder.start();
      setRecognizing(true);
      setSphereStatus("success");
    } catch (err) {
      console.error("Erro ao iniciar microfone:", err);
      alert("Erro ao acessar o microfone.");
    }
  };

  const stopRecording = () => {
    if (!recorderRef.current) return;
    try { recorderRef.current.stop(); recorderRef.current.stream.getTracks().forEach(track => track.stop()); } catch {}
    setRecognizing(false);
    setSphereStatus("idle");
  };

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return (
    <div className="jarvis-container">
      <button onClick={toggleMenu} className="hamburger-button">
        {isMenuOpen ? "✕" : "☰"}
      </button>

      <div className="layout-wrapper">
        <div className="model-side">
          {show3DModel ? (
            <IronManModel speaking={speaking} environmentPreset={environmentPreset} error={armorError} />
          ) : (
            <div className="lite-placeholder">
              <Canvas>
                <ParticleSphere status={sphereStatus} particleCount={particleCount} size={particleSize} />
              </Canvas>
            </div>
          )}
        </div>

        <div className="chat-side">
          {isOffline && (
            <div className="offline-warning">
              ⚠️ Modo Offline ativado.
            </div>
          )}



          <div className="chat-window">
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
                aria-label="Enviar mensagem"
              >
                <FaArrowAltCircleUp size={29} />
              </button>
            </div>

            <button
              onClick={startRecording}
              className={`mic-button ${recognizing ? "active" : ""}`}
              disabled={speaking}
              aria-label="Microfone"
            >
              {recognizing ? <FaStop size={18} /> : <FaMicrophone size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
