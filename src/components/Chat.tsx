import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { IronManModel } from './IronManModel';
import { v4 as uuidv4 } from 'uuid'; // Instale com npm i uuid

interface Message {
  sender: 'user' | 'jarvis';
  text: string;
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>('');
  const [recognizing, setRecognizing] = useState<boolean>(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const executedRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const shouldContinueListeningRef = useRef<boolean>(false);

  useEffect(() => {
    const loadVoices = () => {
      const vs = window.speechSynthesis.getVoices();
      setVoices(vs);
      console.table(
        vs.map(v => ({
          name: v.name,
          lang: v.lang,
          genderGuess: v.name.toLowerCase().includes('male') || v.name.toLowerCase().includes('homem') ? 'Masculina' : 'Feminina',
        }))
      );
    };

    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = loadVoices;
    }

    // Garante que carrega mesmo se não mudar
    loadVoices();
  }, []);

  // Função de fala
  const speak = (text: string) => {
    if (!voices.length) {
      console.warn('Nenhuma voz disponível para fala');
      return;
    }

    const synth = window.speechSynthesis;
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    // Animação do IronMan falando
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

    // 🎙️ Escolher uma voz masculina e realista
    const voice =
      voices.find(
        v =>
          v.lang.toLowerCase() === 'pt-br' &&
          ['daniel', 'joão', 'paulo', 'male', 'homem'].some(name =>
            v.name.toLowerCase().includes(name)
          )
      ) ||
      voices.find(v => v.lang.toLowerCase() === 'pt-br') ||
      voices.find(v => v.lang.toLowerCase().startsWith('pt')) ||
      voices[0];

    utterance.voice = voice!;
    utterance.pitch = 0.9;  // grave natural
    utterance.rate = 0.95;  // fala levemente mais devagar

    synth.speak(utterance);

    // Debug opcional
    console.log('🧠 Falando com a voz:', voice?.name, '| Idioma:', voice?.lang);
  };

  // Reconhecimento de voz
  const startRecognition = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Reconhecimento de voz não é suportado no seu navegador.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = true;

    recognitionRef.current = recognition;
    shouldContinueListeningRef.current = true;
    executedRef.current = false;

    recognition.onstart = () => {
      setRecognizing(true);
    };

    recognition.onerror = (event: any) => {
      console.error('Erro no reconhecimento:', event.error);
      setRecognizing(false);
    };

    recognition.onend = () => {
      setRecognizing(false);
      if (shouldContinueListeningRef.current) {
        // ⚠️ Espera um pequeno tempo antes de reiniciar (evita crash loop)
        setTimeout(() => {
          if (!executedRef.current) {
            recognition.start();
          }
        }, 800);
      }
    };

    recognition.onresult = (event: any) => {
      if (executedRef.current) return;
      executedRef.current = true;

      const result = event.results[0][0];
      const transcript = result.transcript.trim();
      const confidence = result.confidence;

      console.log(`🗣️ Texto detectado: ${transcript} | Confiança: ${confidence}`);

      if (confidence < 0.6) {
        console.warn("⚠️ Confiança baixa. Ignorando...");
        return;
      }

      sendVoiceMessage(transcript);

      // ✅ Parar o reconhecimento após capturar o comando
      shouldContinueListeningRef.current = false;
      recognition.stop();
    };

    recognition.start();
  };

  const sendVoiceMessage = async (spokenText: string) => {
    setMessages(prev => [...prev, { sender: 'user', text: spokenText }]);

    try {
      const response = await axios.post('https://jarvis-backend-6xuu.onrender.com/api/chat', {
        message: spokenText,
        sessionId, // envia o id da sessão
      });

      const botMessage = response.data.reply;

      setMessages(prev => [...prev, { sender: 'jarvis', text: botMessage }]);

      // 🔗 Fala apenas o texto, sem o link
      const urlMatch = botMessage.match(/https:\/\/[^\s]+/);
      const textoParaFalar = urlMatch
        ? botMessage.replace(urlMatch[0], '').trim()
        : botMessage;

      speak(textoParaFalar);

      // 🌐 Abre o link, mas NÃO repete a fala
      if (urlMatch) {
        window.open(urlMatch[0], '_blank');
      }

    } catch (err) {
      console.error('Erro ao enviar mensagem via voz:', err);
      const errorMessage = 'Erro ao se conectar ao sistema, senhor Maycon.';
      setMessages(prev => [...prev, { sender: 'jarvis', text: errorMessage }]);
      speak(errorMessage);
    }
  };


  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setMessages(prev => [...prev, { sender: 'user', text: userMessage }]);
    setInput('');

    try {
      const response = await axios.post('https://jarvis-backend-6xuu.onrender.com/api/chat', {
        message: userMessage,
        sessionId, // envia o id da sessão
      });

      const botMessage = response.data.reply;
      setMessages(prev => [...prev, { sender: 'jarvis', text: botMessage }]);

      // Fala só a parte útil, não repete
      const urlMatch = botMessage.match(/https:\/\/[^\s]+/);
      const textoParaFalar = urlMatch
        ? botMessage.replace(urlMatch[0], '').trim()
        : botMessage;

      speak(textoParaFalar);

      if (urlMatch) {
        window.open(urlMatch[0], '_blank');
      }

    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
      const errorMessage = 'Erro ao se conectar ao sistema, senhor Maycon.';
      setMessages(prev => [...prev, { sender: 'jarvis', text: errorMessage }]);
      speak(errorMessage);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Dentro do componente Chat:
  const [sessionId, setSessionId] = useState<string>(() => {
    // Gera um id único na primeira renderização, persistindo na sessão
    const stored = sessionStorage.getItem('jarvis_session_id');
    if (stored) return stored;
    const newId = uuidv4();
    sessionStorage.setItem('jarvis_session_id', newId);
    return newId;
  });

  return (
    <div className="jarvis-container">
      <div className="layout-wrapper">
        <div className="model-side">
          <IronManModel speaking={speaking} />
        </div>

        <div className="chat-side">
          <div className="chat-window">
            {messages.map((msg, idx) => (
              <div key={idx} className={`message ${msg.sender === 'jarvis' ? 'jarvis' : 'user'}`}>
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
