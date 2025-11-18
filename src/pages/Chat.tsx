// src/pages/Chat.tsx
import React, { useState, useEffect, useRef } from 'react';
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
    if (isMobile) {
      window.location.href = url;
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  } catch (e) {
    console.error("Erro ao abrir link:", e);
  }
};


const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

interface Message {
  sender: 'user' | 'jarvis';
  text: string;
}

interface ChatProps { // 🛑 NOVO: Defina as props
  toggleMenu: () => void;
  isMenuOpen: boolean;
  show3DModel: boolean
}

interface ChatResponse {
  reply: string;
  sessionId: string;
  audioBase64: string | null; // Agora será sempre null (fallback)
}

type ModalType = string | null;

const fallbackSpeak = (text: string, setSpeaking: (s: boolean) => void) => {
  console.warn("Usando fallback de voz nativa (filtro EXTREMO: Apenas vozes masculinas e neutras).");

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

  const ptVoices = synth.getVoices().filter(v => v.lang.toLowerCase().startsWith('pt'));
  
  // 🛑 IDENTIFICADORES PARA PRIORIDADE MASCULINA/NEUTRA
  const MALE_NEUTRAL_IDENTIFIERS = ['male', 'macho', 'masculino', 'man', 'boy', 'joao', 'pedro', 'daniel', 'joaquim', 'felipe', 'gustavo', 'google', 'bruno', 'homem', 'voice', 'voz', 'default'];

  let preferredVoice = null;
  
  // 1. FILTRAGEM DE EXCLUSÃO (Eliminando vozes com termos femininos)
  const strictlyMaleVoices = ptVoices.filter(v => {
      const name = v.name.toLowerCase();
      
      // Lista de exclusão HARDCODED (sem a constante)
      const isFemale = 
        name.includes('luciana') || name.includes('ivete') || name.includes('fátima') || 
        name.includes('ana') || name.includes('vitoria') || name.includes('rita') || 
        name.includes('sandra') || name.includes('joana') || name.includes('mulher') || 
        name.includes('female') || name.includes('feminino') || name.includes('woman') || 
        name.includes('rosa') || name.includes('elisa') || name.includes('raquel') || 
        name.includes('clara') || name.includes('beatriz') || name.includes('maria') || 
        name.includes('paula') || name.includes('carla') || name.includes('fofa') || 
        name.includes('menina') || name.includes('girl');
        
      return !isFemale;
  });

  // 2. PRIORIZAÇÃO MASCULINA: Tenta achar a voz com identificador masculino claro.
  preferredVoice = strictlyMaleVoices.find(v => 
    MALE_NEUTRAL_IDENTIFIERS.some(term => v.name.toLowerCase().includes(term))
  );
  
  // 3. ÚLTIMO RECURSO: Usa a primeira voz restante após a exclusão feminina.
  if (!preferredVoice) {
    preferredVoice = strictlyMaleVoices[0] || synth.getVoices()[0];
  }

  if (preferredVoice) {
    utterance.voice = preferredVoice;
    // Ajustes para soar menos robótico
    utterance.pitch = 0.9;
    utterance.rate = 0.95; 
    console.log(`🎤 VOZ SELECIONADA FINAL: ${preferredVoice.name}`);
  }

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

  const [sessionId, setSessionId] = useState<string>(() => {
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
    const texto = mensagem.toLowerCase();
    const climaRegex = /\b(clima|tempo)\b/;
    if (climaRegex.test(texto)) {
      return 'Estou offline no momento, senhor Maycon. Não consigo consultar o clima.';
    }
    
    return null;
  };

  const sendAndProcessMessage = async (userMessage: string) => {
    setMessages(prev => [...prev, { sender: 'user', text: userMessage }]);
    setInput('');

    if (isOffline) {
      const resposta = respostasOffline(userMessage) || 'Estou offline no momento, senhor Maycon.';
      setMessages(prev => [...prev, { sender: 'jarvis', text: resposta }]);
      speak(null, resposta);
      return;
    }

    try {
      const response = await axios.post<ChatResponse>('https://jarvis-backend-6xuu.onrender.com/api/chat', {
        message: userMessage,
        sessionId,
      });

      const botMessage = response.data.reply;
      const audioBase64 = response.data.audioBase64; // Será 'null'
      setMessages(prev => [...prev, { sender: 'jarvis', text: botMessage }]);

      // 🔥 NOVO — detectar deep link do backend
      try {
        const parsed = JSON.parse(botMessage);

        if (parsed.action === "openLink") {
          openLink(parsed.url);
          return; // impede de falar JSON
        }
      } catch (e) {}

      // continua normal (faz o JARVIS falar)
      speak(audioBase64, botMessage);


    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
      const errorMessage = 'Erro ao se conectar ao sistema, senhor Maycon. Tentando modo de emergência.';
      setMessages(prev => [...prev, { sender: 'jarvis', text: errorMessage }]);
      speak(null, errorMessage);
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMessage = input.trim();
    setInput('');
    await sendAndProcessMessage(userMessage);
  };

  const sendVoiceMessage = async (spokenText: string) => {
    await sendAndProcessMessage(spokenText);
  };
  
  const stopRecognition = () => {
    if (recognitionRef.current && recognizing) {
      recognitionRef.current.stop();
      setRecognizing(false);
    }
  };

  const startRecognition = () => {
    if (!SpeechRecognition) {
      alert('Seu navegador não suporta Reconhecimento de Voz.');
      return;
    }

    // 👇 Se já está gravando → parar e ENVIAR a fala
    if (recognizing) {
      recognitionRef.current.stop();
      setRecognizing(false);

      const finalMessage = voiceBuffer.trim();
      setVoiceBuffer("");

      if (finalMessage.length > 0) {
        sendVoiceMessage(finalMessage);
      }
      return;
    }

    // 👇 Se não está gravando → começar
    setVoiceBuffer("");
    recognitionRef.current.start();
    setRecognizing(true);
  };

  const stopRecognitionAfterDelay = (delay = 3000) => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
    }
    
    silenceTimeoutRef.current = window.setTimeout(() => {
      console.log(`⏱️ Silêncio detectado por ${delay/1000}s. Parando a gravação.`);
      stopRecognition();
    }, delay);
  };

  useEffect(() => {
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true; 
    recognition.interimResults = true; 
    recognition.lang = 'pt-BR'; 

    recognition.onstart = () => {
      setRecognizing(true);
      console.log('🎤 Reconhecimento de voz iniciado.');
      stopRecognitionAfterDelay(5000); 
    };

    recognition.onend = () => {
      setRecognizing(false);
      console.log('🎤 Reconhecimento de voz finalizado.');
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }
    };

    recognition.onerror = (event: any) => {
      setRecognizing(false);
      console.error('Erro de Reconhecimento de Voz:', event.error);
    };

    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }

      if (transcript.trim()) {
        setVoiceBuffer(prev => prev + " " + transcript.trim());
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const lockOrientation = async () => {
      if (window.screen && window.matchMedia("(max-width: 768px)").matches) {
        const orientation = (window.screen as any).orientation;
        if (orientation && typeof orientation.lock === 'function') {
          try {
            await orientation.lock('portrait');
            console.log("🔒 Orientação da tela bloqueada para o modo Retrato.");
          } catch (error) {
            console.warn("⚠️ Não foi possível bloquear a orientação da tela:", error);
          }
        } else {
          console.warn("⚠️ API de lock de orientação não disponível neste navegador/typings.");
        }
      }
    };

    lockOrientation();
    
    return () => {
      const orientation = (window.screen as any).orientation;
      if (orientation && typeof orientation.unlock === 'function') {
        try {
          orientation.unlock();
          console.log("🔓 Orientação da tela desbloqueada.");
        } catch (error) {
          console.warn("⚠️ Não foi possível desbloquear a orientação da tela:", error);
        }
      }
    };
  }, []); 

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);


  return (
    <div className="jarvis-container">

      <button 
        onClick={toggleMenu} 
        className="hamburger-button"
        aria-expanded={isMenuOpen}
        aria-controls="main-menu"
      >
        {isMenuOpen ? '✕' : '☰'}
      </button>
      
      <div className="layout-wrapper">
        <div className="model-side">
          {show3DModel ? (
            <IronManModel speaking={speaking} />
          ) : (
            <div className="lite-placeholder">
              <img src={liteGif} alt="Modo leve" className="lite-gif" />
              <p>Modo leve ativado!!</p>
            </div>
          )}
        </div>

        <div className="chat-side">
          {isOffline && (
            <div className="offline-warning">
              ⚠️ Modo Offline ativado. Algumas funções estão limitadas.
            </div>
          )}
          <div className="chat-window">
            {messages.map((msg, idx) => (
              <div key={idx} className={`message ${msg.sender}`}>
                <strong>{msg.sender === 'jarvis' ? 'JARVIS' : 'VOCÊ'}:</strong> {msg.text}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <div className="input-area">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Fale com o JARVIS ou digite sua mensagem..."
              disabled={speaking}
            />
            <button onClick={sendMessage} disabled={!input.trim() || speaking}>
              Enviar
            </button>
            <button
              onClick={startRecognition}
              className={`mic-button ${recognizing ? 'active' : ''}`}
              aria-pressed={recognizing}
              disabled={speaking}
            >
              {recognizing ? '🛑' : '🎙️'}
            </button>
          </div>
        </div>
      </div>
    </div>
    
  );
}