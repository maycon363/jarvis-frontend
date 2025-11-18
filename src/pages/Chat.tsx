// src/pages/Chat.tsx
import  { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { IronManModel } from '../components/IronManModel';
import { v4 as uuidv4 } from 'uuid';
import liteGif from "../assets/javis.gif";

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

const openLink = (url: string) => {
  if (!url) return;
  const isMobile = /android|iphone|ipad/i.test(navigator.userAgent);
  try {
    isMobile ? (window.location.href = url) : window.open(url, "_blank", "noopener,noreferrer");
  } catch (e) {
    console.error("Erro ao abrir link:", e);
  }
};

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

interface Message {
  sender: 'user' | 'jarvis';
  text: string;
}

interface ChatProps {
  toggleMenu: () => void;
  isMenuOpen: boolean;
  show3DModel: boolean;
}

interface ChatResponse {
  reply: string;
  sessionId: string;
  audioBase64: string | null;
}

const fallbackSpeak = (text: string, setSpeaking: (s: boolean) => void) => {
  const synth = window.speechSynthesis;
  synth.cancel();

  const utterance = new SpeechSynthesisUtterance(text);

  utterance.onstart = () => {
    setSpeaking(true);
    const mask = document.querySelector('.ironman-mask img');
    if (mask) mask.classList.add('speaking');
  };

  utterance.onend = () => {
    setSpeaking(false);
    const mask = document.querySelector('.ironman-mask img');
    if (mask) mask.classList.remove('speaking');
  };

  const voices = synth.getVoices().filter(v => v.lang.toLowerCase().startsWith("pt"));
  utterance.voice = voices[0] || synth.getVoices()[0];

  utterance.pitch = 1;
  utterance.rate = 1;

  synth.speak(utterance);
};

export default function Chat({ toggleMenu, isMenuOpen, show3DModel }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [recognizing, setRecognizing] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [voiceBuffer, setVoiceBuffer] = useState("");

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const silenceTimeoutRef = useRef<number | null>(null);

  const [sessionId] = useState<string>(() => {
    const stored = sessionStorage.getItem('jarvis_session_id');
    if (stored) return stored;
    const newId = uuidv4();
    sessionStorage.setItem('jarvis_session_id', newId);
    return newId;
  });

  const speak = (base64Audio: string | null, fallbackText: string) => {
    fallbackSpeak(fallbackText, setSpeaking);
  };

  const respostasOffline = (mensagem: string): string | null => {
    const t = mensagem.toLowerCase();
    if (/\b(clima|tempo)\b/.test(t)) return "Estou offline no momento, senhor Maycon.";
    return null;
  };

  const sendAndProcessMessage = async (userMessage: string) => {
    if (!userMessage.trim()) return;

    // adiciona a mensagem do usuário
    setMessages(prev => [...prev, { sender: "user", text: userMessage }]);

    // offline
    if (isOffline) {
      const resposta = respostasOffline(userMessage) || "Estou offline no momento, senhor Maycon.";
      setMessages(prev => [...prev, { sender: "jarvis", text: resposta }]);
      speak(null, resposta);
      return;
    }

    try {
      // chamada única e correta do backend
      const response = await axios.post<ChatResponse>(
        "https://jarvis-backend-6xuu.onrender.com/api/chat",
        { message: userMessage, sessionId }
      );

      const botMessage = response.data.reply;

      // adiciona mensagem do j.a.r.v.i.s
      setMessages(prev => [...prev, { sender: "jarvis", text: botMessage }]);

      // Detecta link REAL escrito no texto
      const urlMatch = botMessage.match(/https?:\/\/[^\s]+/);
      if (urlMatch) {
        openLink(urlMatch[0]);
      }

      speak(null, botMessage);

    } catch (err) {
      console.error("Erro ao enviar mensagem:", err);
      const msg = "Erro ao se conectar ao sistema, senhor Maycon.";
      setMessages(prev => [...prev, { sender: "jarvis", text: msg }]);
      speak(null, msg);
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    const msg = input.trim();
    setInput("");
    await sendAndProcessMessage(msg);
  };

  const sendVoiceMessage = async (text: string) => {
    if (!text.trim()) return;
    await sendAndProcessMessage(text);
  };

  const stopRecognition = () => {
    if (!recognitionRef.current) return;
    recognitionRef.current.stop();
    setRecognizing(false);
  };

  const startRecognition = () => {
    if (!SpeechRecognition) {
      alert("Navegador não suporta reconhecimento de voz.");
      return;
    }

    if (recognizing) {
      stopRecognition();
      const finalText = voiceBuffer.trim();
      setVoiceBuffer("");
      if (finalText.length > 0) sendVoiceMessage(finalText);
      return;
    }

    setVoiceBuffer("");
    recognitionRef.current.start();
    setRecognizing(true);
  };

  const stopRecognitionAfterDelay = (delay = 3000) => {
    if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);

    silenceTimeoutRef.current = window.setTimeout(() => {
      stopRecognition();
    }, delay);
  };

  useEffect(() => {
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "pt-BR";

    recognition.onstart = () => {
      setRecognizing(true);
      stopRecognitionAfterDelay(5000);
    };

    recognition.onend = () => {
      setRecognizing(false);
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }
    };

    recognition.onerror = (e: any) => {
      setRecognizing(false);
      console.error("Speech error:", e.error);
    };

    recognition.onresult = (event: any) => {
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalText += event.results[i][0].transcript + " ";
        }
      }
      if (finalText.trim()) setVoiceBuffer(finalText.trim());
    };

    recognitionRef.current = recognition;
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
          {show3DModel ? <IronManModel speaking={speaking} /> : (
            <div className="lite-placeholder">
              <img src={liteGif} className="lite-gif" />
              <p>Modo leve ativado!</p>
            </div>
          )}
        </div>

        <div className="chat-side">
          {isOffline && <div className="offline-warning">⚠️ Modo Offline ativado.</div>}

          <div className="chat-window">
            {messages.map((msg, idx) => (
              <div key={idx} className={`message ${msg.sender}`}>
                <strong>{msg.sender === "jarvis" ? "JARVIS" : "VOCÊ"}:</strong> {msg.text}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <div className="input-area">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendMessage()}
              placeholder="Fale com o JARVIS..."
              disabled={speaking}
            />

            <button onClick={sendMessage} disabled={!input.trim() || speaking}>
              Enviar
            </button>

            <button
              onClick={startRecognition}
              className={`mic-button ${recognizing ? "active" : ""}`}
              disabled={speaking}
            >
              {recognizing ? "🛑" : "🎙️"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
