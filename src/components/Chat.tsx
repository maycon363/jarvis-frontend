import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { IronManModel } from './IronManModel';
import { v4 as uuidv4 } from 'uuid';

interface Message {
  sender: 'user' | 'jarvis';
  text: string;
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [recognizing, setRecognizing] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const executedRef = useRef(false);
  const shouldContinueListeningRef = useRef(false);

  const [sessionId, setSessionId] = useState<string>(() => {
    const stored = sessionStorage.getItem('jarvis_session_id');
    if (stored) return stored;
    const newId = uuidv4();
    sessionStorage.setItem('jarvis_session_id', newId);
    return newId;
  });

  // Detecta online/offline
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

  // Carrega histórico do localStorage
  useEffect(() => {
    const cached = localStorage.getItem('jarvis_offline_history');
    if (cached) setMessages(JSON.parse(cached));
  }, []);

  useEffect(() => {
    localStorage.setItem('jarvis_offline_history', JSON.stringify(messages));
  }, [messages]);

  // Carrega vozes
  useEffect(() => {
    const loadVoices = () => {
      const vs = window.speechSynthesis.getVoices();
      setVoices(vs);
    };

    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = loadVoices;
    }

    loadVoices();
  }, []);

  // Fala
  const speak = (text: string) => {
    if (!voices.length) return;

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

    const voice =
      voices.find(v => v.lang.toLowerCase() === 'pt-br' && /daniel|joão|paulo|male|homem/.test(v.name.toLowerCase())) ||
      voices.find(v => v.lang.toLowerCase() === 'pt-br') ||
      voices.find(v => v.lang.toLowerCase().startsWith('pt')) ||
      voices[0];

    utterance.voice = voice!;
    utterance.pitch = 0.9;
    utterance.rate = 0.95;

    synth.speak(utterance);
  };

  // Comandos Offline
  const respostasOffline = (mensagem: string): string | null => {
    const texto = mensagem.toLowerCase();

    if (texto.includes('clima') || texto.includes('tempo')) {
      return 'Estou offline no momento, senhor Maycon. Não consigo consultar o clima.';
    }

    const atalhos: Record<string, string> = {
      google: 'https://www.google.com',
      youtube: 'https://www.youtube.com',
      spotify: 'spotify://',
      whatsapp: 'https://web.whatsapp.com/',
      instagram: 'https://www.instagram.com/',
      facebook: 'https://www.facebook.com/',
      gmail: 'https://mail.google.com/',
      github: 'https://github.com/',
      notion: 'https://www.notion.so/',
      figma: 'https://www.figma.com/',
      linkedin: 'https://www.linkedin.com/',
      netflix: 'https://www.netflix.com/',
      twitch: 'https://www.twitch.tv/',
      maps: 'https://www.google.com/maps',
      calendario: 'https://calendar.google.com/',
      tradutor: 'https://translate.google.com/',
      drive: 'https://drive.google.com/',
      vscode: 'vscode://',
      terminal: 'terminal://', // se tiver integração com apps
      calculadora: 'calc://',
    };

    for (const chave in atalhos) {
      if (
        texto.includes(chave) ||
        texto.includes(`abrir ${chave}`) ||
        texto.includes(`acessar ${chave}`)
      ) {
        return `Abrindo ${chave}: ${atalhos[chave]}`;
      }
    }

    return null;
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setMessages(prev => [...prev, { sender: 'user', text: userMessage }]);
    setInput('');

    // Modo offline
    if (isOffline) {
      const resposta = respostasOffline(userMessage) || 'Estou offline no momento, senhor Maycon.';
      setMessages(prev => [...prev, { sender: 'jarvis', text: resposta }]);
      speak(resposta);
      return;
    }

    try {
      const response = await axios.post('https://jarvis-backend-6xuu.onrender.com/api/chat', {
        message: userMessage,
        sessionId,
      });

      const botMessage = response.data.reply;
      setMessages(prev => [...prev, { sender: 'jarvis', text: botMessage }]);

      const urlMatch = botMessage.match(/(https?:\/\/[^\s]+|[a-z]+:\/\/[^\s]+)/i);
      const textoParaFalar = urlMatch ? botMessage.replace(urlMatch[0], '').trim() : botMessage;
      speak(textoParaFalar);

      if (urlMatch) {
        const url = urlMatch[0];
        const isMobile = /android|iphone|ipad/i.test(navigator.userAgent);
        isMobile ? window.location.href = url : window.open(url, '_blank');
      }

    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
      const errorMessage = 'Erro ao se conectar ao sistema, senhor Maycon.';
      setMessages(prev => [...prev, { sender: 'jarvis', text: errorMessage }]);
      speak(errorMessage);
    }
  };

  const sendVoiceMessage = async (spokenText: string) => {
    setMessages(prev => [...prev, { sender: 'user', text: spokenText }]);

    if (isOffline) {
      const resposta = respostasOffline(spokenText) || 'Estou offline no momento, senhor Maycon.';
      setMessages(prev => [...prev, { sender: 'jarvis', text: resposta }]);
      speak(resposta);
      return;
    }

    try {
      const response = await axios.post('https://jarvis-backend-6xuu.onrender.com/api/chat', {
        message: spokenText,
        sessionId,
      });

      const botMessage = response.data.reply;
      setMessages(prev => [...prev, { sender: 'jarvis', text: botMessage }]);

      const urlMatch = botMessage.match(/(https?:\/\/[^\s]+|[a-z]+:\/\/[^\s]+)/i);
      const textoParaFalar = urlMatch ? botMessage.replace(urlMatch[0], '').trim() : botMessage;
      speak(textoParaFalar);

      if (urlMatch) {
        const url = urlMatch[0];
        const isMobile = /android|iphone|ipad/i.test(navigator.userAgent);
        isMobile ? window.location.href = url : window.open(url, '_blank');
      }

    } catch (err) {
      console.error('Erro ao enviar mensagem via voz:', err);
      const errorMessage = 'Erro ao se conectar ao sistema, senhor Maycon.';
      setMessages(prev => [...prev, { sender: 'jarvis', text: errorMessage }]);
      speak(errorMessage);
    }
  };

  const startRecognition = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Reconhecimento de voz não é suportado no seu navegador.');
      return;
    }

    // Se já está reconhecendo, pare a instância atual antes de reiniciar
    if (recognizing && recognitionRef.current) {
      recognitionRef.current.stop();
      setRecognizing(false);
      return; // Evita múltiplos reconhecimentos ao clicar várias vezes
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false; // importante manter false pra não criar conflito

    recognitionRef.current = recognition;
    shouldContinueListeningRef.current = true;
    executedRef.current = false;

    recognition.onstart = () => {
      console.log('🎤 Iniciando reconhecimento...');
      setRecognizing(true);
    };

    recognition.onerror = (event: any) => {
      console.error('❌ Erro no reconhecimento:', event.error);
      setRecognizing(false);
    };

    recognition.onend = () => {
      console.log('🛑 Reconhecimento encerrado');
      setRecognizing(false);
      if (shouldContinueListeningRef.current && !executedRef.current) {
        // Reinicia se necessário
        setTimeout(() => {
          if (!executedRef.current && recognitionRef.current) {
            recognitionRef.current.start();
          }
        }, 500);
      }
    };

    recognition.onresult = (event: any) => {
      if (executedRef.current) return;
      executedRef.current = true;

      const result = event.results[0][0];
      const transcript = result.transcript.trim();
      const confidence = result.confidence;

      console.log(`🗣️ Reconhecido: "${transcript}" (Confiança: ${confidence})`);

      if (confidence < 0.8) return;

      sendVoiceMessage(transcript);
      shouldContinueListeningRef.current = false;
      recognition.stop();
    };

    recognition.start();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') sendMessage();
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="jarvis-container">
      <div className="layout-wrapper">
        <div className="model-side">
          <IronManModel speaking={speaking} />
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
            />
            <button onClick={sendMessage} disabled={!input.trim()}>
              Enviar
            </button>
            <button
              onClick={startRecognition}
              className={`mic-button ${recognizing ? 'active' : ''}`}
              aria-pressed={recognizing}
            >
              🎙️
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
