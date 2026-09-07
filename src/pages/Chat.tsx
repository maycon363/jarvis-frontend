import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { IronManModel } from '../components/IronManModel';
import { IronManHologram } from '../components/IronManHologram';
import { v4 as uuidv4 } from 'uuid';
import { FaMicrophone, FaStop, FaArrowAltCircleUp } from 'react-icons/fa';
import { JarvisHUD } from '../components/JarvisHUD';
import { MetalOrb } from '../components/MetalOrb';

const BACKEND_URL =
  window.location.hostname === 'localhost'
    ? 'http://localhost:3001'
    : 'https://jarvis-backend-2-4kkb.onrender.com';

const STORAGE_MESSAGES     = 'jarvis_messages';
const STORAGE_COMPROMISSOS = 'jarvis_compromissos';
const HISTORICO_MAX        = 20; 

let sharedAudioContext: AudioContext | null = null;
function getAudioContext(): AudioContext {
  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    sharedAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (sharedAudioContext.state === 'suspended') sharedAudioContext.resume();
  return sharedAudioContext;
}

function criarGain(ctx: AudioContext, volume: number, duracao: number): GainNode {
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duracao);
  return gain;
}

function criarOsc(
  ctx: AudioContext,
  destino: AudioNode,
  tipo: OscillatorType,
  freqInicio: number,
  freqFim: number,
  inicio: number,
  duracao: number
) {
  const osc = ctx.createOscillator();
  osc.connect(destino);
  osc.type = tipo;
  osc.frequency.setValueAtTime(freqInicio, ctx.currentTime + inicio);
  if (freqFim !== freqInicio) {
    osc.frequency.exponentialRampToValueAtTime(freqFim, ctx.currentTime + inicio + duracao * 0.8);
  }
  osc.start(ctx.currentTime + inicio);
  osc.stop(ctx.currentTime + inicio + duracao);
}

function playUISend() {
  try {
    const ctx = getAudioContext();
    [0, 0.09].forEach((delay, i) => {
      const gain = criarGain(ctx, 0.07 - i * 0.02, 0.18);
      criarOsc(ctx, gain, 'sine', 700 + i * 100, 1400 + i * 100, delay, 0.15);
    });
  } catch {}
}

function playUIReceive() {
  try {
    const ctx   = getAudioContext();
    const notas = [880, 660, 440];
    notas.forEach((freq, i) => {
      const delay = i * 0.1;
      const gain  = criarGain(ctx, 0.06, 0.18);
      criarOsc(ctx, gain, 'sine', freq, freq * 0.92, delay, 0.15);
    });
  } catch {}
}

function playMicOn() {
  try {
    const ctx = getAudioContext();
    const g1 = criarGain(ctx, 0.08, 0.12);
    criarOsc(ctx, g1, 'square', 500, 900, 0, 0.1);
    const g2 = criarGain(ctx, 0.06, 0.12);
    criarOsc(ctx, g2, 'square', 900, 1400, 0.12, 0.1);
    const gBg = ctx.createGain();
    gBg.connect(ctx.destination);
    gBg.gain.setValueAtTime(0.02, ctx.currentTime + 0.22);
    gBg.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    criarOsc(ctx, gBg, 'sine', 1200, 1200, 0.22, 0.38);
  } catch {}
}

function playMicOff() {
  try {
    const ctx  = getAudioContext();
    const gain = criarGain(ctx, 0.07, 0.3);
    criarOsc(ctx, gain, 'square', 1200, 300, 0, 0.28);
    const gClick = criarGain(ctx, 0.05, 0.06);
    criarOsc(ctx, gClick, 'sine', 200, 80, 0.28, 0.05);
  } catch {}
}

function playError() {
  try {
    const ctx = getAudioContext();
    const g1 = criarGain(ctx, 0.1, 0.25);
    criarOsc(ctx, g1, 'sawtooth', 180, 160, 0, 0.22);
    const g2 = criarGain(ctx, 0.08, 0.25);
    criarOsc(ctx, g2, 'sawtooth', 160, 140, 0.28, 0.22);
  } catch {}
}

function playStartup() {
  try {
    const ctx   = getAudioContext();
    const notas = [261, 329, 440, 523, 659];
    notas.forEach((freq, i) => {
      const delay = i * 0.09;
      const gain  = criarGain(ctx, 0.06, 0.2);
      criarOsc(ctx, gain, 'sine', freq, freq, delay, 0.18);
    });
    [523, 659, 784].forEach((freq) => {
      const delay = notas.length * 0.09 + 0.05;
      const gain  = ctx.createGain();
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0, ctx.currentTime + delay);
      gain.gain.linearRampToValueAtTime(0.04, ctx.currentTime + delay + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.6);
      criarOsc(ctx, gain, 'sine', freq, freq, delay, 0.55);
    });
  } catch {}
}

function playClear() {
  try {
    const ctx  = getAudioContext();
    const gain = criarGain(ctx, 0.06, 0.5);
    criarOsc(ctx, gain, 'sine', 600, 80, 0, 0.48);
    const gClick = criarGain(ctx, 0.04, 0.08);
    criarOsc(ctx, gClick, 'sawtooth', 120, 40, 0.46, 0.06);
  } catch {}
}

function base64ToObjectUrl(base64: string, mimeType = 'audio/mpeg'): string {
  const binary = atob(base64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
}

interface Message {
  sender:    'user' | 'jarvis';
  text:      string;
  timestamp: Date;
}

interface Compromisso {
  id:          string;
  titulo:      string;
  detalhes:    string;
  data_evento: string | null;
  categoria:   string;
  criado_em:   string;
  concluido?:  boolean;
}

interface ChatProps {
  toggleMenu:        () => void;
  isMenuOpen:        boolean;
  visualMode:        'model' | 'hologram' | 'orb';
  environmentPreset: string;
  particleColor?:    string;
  particleCount:     number;
  particleSize:      number;
  bloomIntensity:    number;
  clearChatRef:      React.MutableRefObject<(() => void) | null>;
}

interface ChatResponse {
  type:             'message' | 'action';
  reply:            string;
  payload:          any;
  sessionId:        string;
  audioBase64?:     string;
  humor?:           'angry' | 'calm' | 'neutral';
  novoCompromisso?: Compromisso | null;
}

function loadMessages(): Message[] {
  try {
    const raw = localStorage.getItem(STORAGE_MESSAGES);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<{ sender: 'user' | 'jarvis'; text: string; timestamp: string }>;
    return parsed.map(m => ({ ...m, timestamp: new Date(m.timestamp) }));
  } catch {
    return [];
  }
}

function loadCompromissos(): Compromisso[] {
  try {
    const raw = localStorage.getItem(STORAGE_COMPROMISSOS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export default function Chat({
  toggleMenu,
  isMenuOpen,
  visualMode,
  environmentPreset,
  bloomIntensity,
  clearChatRef,
}: ChatProps) {
  const [messages,     setMessages]     = useState<Message[]>(loadMessages);
  const [compromissos, setCompromissos] = useState<Compromisso[]>(loadCompromissos);
  const [input,        setInput]        = useState('');
  const [recognizing,  setRecognizing]  = useState(false);
  const [speaking,     setSpeaking]     = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [armorError,   setArmorError]   = useState(false);
  const [sphereStatus, setSphereStatus] = useState<'idle' | 'speaking' | 'error'>('idle');
  const [humor,        setHumor]        = useState<'angry' | 'calm' | 'neutral'>('neutral');
  const [started,      setStarted]      = useState(false);

  const chatEndRef       = useRef<HTMLDivElement | null>(null);
  const recorderRef      = useRef<MediaRecorder | null>(null);
  const audioChunksRef   = useRef<BlobPart[]>([]);
  const audioAnalyzerRef = useRef<{ analyzer: AnalyserNode; dataArray: Uint8Array } | null>(null);
  const currentAudioRef  = useRef<HTMLAudioElement | null>(null);
  const currentBlobUrlRef = useRef<string | null>(null);

  const [sessionId] = useState(() => {
    const stored = sessionStorage.getItem('jarvis_session_id');
    if (stored) return stored;
    const newId = uuidv4();
    sessionStorage.setItem('jarvis_session_id', newId);
    return newId;
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_MESSAGES, JSON.stringify(messages)); } catch {}
  }, [messages]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_COMPROMISSOS, JSON.stringify(compromissos)); } catch {}
  }, [compromissos]);

  useEffect(() => {
    const handler = () => {
      if (!started) { playStartup(); setStarted(true); }
    };
    window.addEventListener('click', handler, { once: true });
    return () => window.removeEventListener('click', handler);
  }, [started]);

  const stopCurrentAudio = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.src = '';
      currentAudioRef.current = null;
    }
    if (currentBlobUrlRef.current) {
      URL.revokeObjectURL(currentBlobUrlRef.current);
      currentBlobUrlRef.current = null;
    }
    setSpeaking(false);
    setSphereStatus('idle');
    audioAnalyzerRef.current = null;
  }, []);

  const playAudio = useCallback((audioBase64: string) => {
    stopCurrentAudio();

    let blobUrl: string;
    try {
      blobUrl = base64ToObjectUrl(audioBase64, 'audio/wav');
    } catch (e) {
      console.error('Falha ao converter base64 para Blob URL:', e);
      return;
    }

    currentBlobUrlRef.current = blobUrl;

    const audio = new Audio();
    audio.preload = 'auto';
    audio.src    = blobUrl;
    currentAudioRef.current = audio;

    let analyzerConnected = false;
    const connectAnalyzer = () => {
      if (analyzerConnected) return;
      analyzerConnected = true;
      try {
        const ctx      = getAudioContext();
        const source   = ctx.createMediaElementSource(audio);
        const analyzer = ctx.createAnalyser();
        analyzer.fftSize = 256;
        source.connect(analyzer);
        analyzer.connect(ctx.destination);
        audioAnalyzerRef.current = {
          analyzer,
          dataArray: new Uint8Array(analyzer.frequencyBinCount),
        };
      } catch (e) {
        console.warn('Analyzer não conectado:', e);
      }
    };

    audio.addEventListener('canplaythrough', connectAnalyzer, { once: true });

    audio.onplay = () => {
      setSpeaking(true);
      setSphereStatus('speaking');
    };

    audio.onended = () => {
      setSpeaking(false);
      setSphereStatus('idle');
      audioAnalyzerRef.current = null;
      currentAudioRef.current  = null;
      URL.revokeObjectURL(blobUrl);
      currentBlobUrlRef.current = null;
    };

    audio.onerror = (e) => {
      console.error('Erro no elemento de áudio:', e);
      playError();
      setSpeaking(false);
      setSphereStatus('error');
      currentAudioRef.current = null;
      URL.revokeObjectURL(blobUrl);
      currentBlobUrlRef.current = null;
    };

    audio.addEventListener('canplaythrough', () => {
      audio.play().catch((err) => {
        console.error('Play bloqueado:', err);
        setSpeaking(false);
        setSphereStatus('idle');
      });
    }, { once: true });

    audio.load();
  }, [stopCurrentAudio]);

  const sendAndProcessMessage = useCallback(async (userMessage: string) => {
    const trimmed = userMessage.trim();
    if (!trimmed) return;

    playUISend();

    const historicoParaEnviar = messages
      .slice(-HISTORICO_MAX)
      .map(m => ({
        role:    m.sender === 'jarvis' ? 'assistant' : 'user',
        content: m.text,
      }));

    setMessages(p => [...p, { sender: 'user', text: trimmed, timestamp: new Date() }]);
    setSphereStatus('idle');
    setArmorError(false);
    setLoading(true);

    try {
      const response = await axios.post<ChatResponse>(
        `${BACKEND_URL}/api/chat`,
        {
          message:      trimmed,
          sessionId,
          historico:    historicoParaEnviar,
          compromissos,
        },
        { timeout: 380_000 }
      );

      const { type, payload, audioBase64, humor: incomingHumor, novoCompromisso } = response.data;
      const isAngry = incomingHumor === 'angry';

      setHumor(incomingHumor ?? 'neutral');
      setArmorError(isAngry);

      let textoFinal: string = payload;
      if (type === 'action') {
        try {
          const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
          textoFinal   = parsed.message ?? 'Protocolo executado.';
        } catch { textoFinal = payload; }
      }

      playUIReceive();
      setMessages(p => [...p, { sender: 'jarvis', text: textoFinal, timestamp: new Date() }]);

      if (novoCompromisso) {
        setCompromissos(prev => [...prev, novoCompromisso]);
      }

      if (audioBase64) playAudio(audioBase64);

    } catch (err: any) {
      const isTimeout = err?.code === 'ECONNABORTED';
      playError();
      setSphereStatus('error');
      setArmorError(true);
      setMessages(p => [...p, {
        sender: 'jarvis',
        text: isTimeout
          ? 'Senhor, os servidores Stark demoraram demais para responder. Tente novamente.'
          : 'Senhor, detectei uma falha crítica na conexão com os servidores Stark. Sistemas em alerta.',
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  }, [sessionId, playAudio, messages, compromissos]);

  const sendMessage = useCallback(() => {
    if (!input.trim() || speaking || loading) return;
    const msg = input.trim();
    setInput('');
    sendAndProcessMessage(msg);
  }, [input, speaking, loading, sendAndProcessMessage]);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current?.stream.getTracks().forEach(t => t.stop());
    recorderRef.current = null;
    setRecognizing(false);
    playMicOff();
  }, []);

  const startRecording = useCallback(async () => {
    if (speaking || loading) return;
    if (recognizing) { stopRecording(); return; }

    try {
      const stream   = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
      const recorder = new MediaRecorder(stream, { mimeType });

      recorderRef.current    = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };

      recorder.onstop = async () => {
        const blob     = new Blob(audioChunksRef.current, { type: mimeType });
        const formData = new FormData();
        formData.append('audio', blob, 'audio.webm');
        try {
          const res  = await fetch(`${BACKEND_URL}/api/stt`, { method: 'POST', body: formData });
          const data = await res.json();
          if (data.text) sendAndProcessMessage(data.text);
        } catch { setSphereStatus('error'); }
        setRecognizing(false);
        setSphereStatus('idle');
      };

      playMicOn();
      recorder.start();
      setRecognizing(true);

    } catch {
      alert('Erro ao acessar o microfone. Verifique as permissões.');
    }
  }, [speaking, loading, recognizing, stopRecording, sendAndProcessMessage]);

  const clearChat = useCallback(() => {
    stopCurrentAudio();
    playClear();
    setMessages([]);
    setArmorError(false);
    setHumor('neutral');
    try { localStorage.removeItem(STORAGE_MESSAGES); } catch {}
  }, [stopCurrentAudio]);

  useEffect(() => { clearChatRef.current = clearChat; }, [clearChatRef, clearChat]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const formatTime = (d: Date) =>
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const isBusy = speaking || loading;

  return (
    <div className="jarvis-container">
      <button onClick={toggleMenu} className="hamburger-button" aria-label="Menu">
        {isMenuOpen ? '✕' : '☰'}
      </button>

      <div className="layout-wrapper">
        <div className="model-side">
          {visualMode === 'model' ? (
            <IronManModel
              speaking={speaking}
              environmentPreset={environmentPreset}
              error={armorError}
              humor={humor}
              recognizing={recognizing}
              bloomIntensity={bloomIntensity}
            />
          ) : visualMode === 'hologram' ? (
            <IronManHologram
              speaking={speaking}
              recognizing={recognizing}
              error={armorError}
              bloomIntensity={bloomIntensity}
            />
          ) : (
            <div className="lite-placeholder">
              <MetalOrb
                speaking={speaking}
                recognizing={recognizing}
                error={armorError}
                bloomIntensity={bloomIntensity}
              />
            </div>
          )}
        </div>

        <div className="chat-side">
          <div className="chat-window">
            {messages.length === 0 && <JarvisHUD />}

            {messages.map((msg, idx) => (
              <div key={idx} className={`message ${msg.sender}`}>
                <div className="message-header">
                  <strong className="message-sender">
                    {msg.sender === 'jarvis' ? 'JARVIS' : 'VOCÊ'}
                  </strong>
                </div>
                <p className="message-text">{msg.text}</p>
                <span className="message-time">{formatTime(msg.timestamp)}</span>
              </div>
            ))}

            {loading && (
              <div className="message jarvis">
                <div className="message-header">
                  <strong className="message-sender">JARVIS</strong>
                </div>
                <p className="message-text typing-indicator">
                  <span /><span /><span />
                </p>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          <div className="input-area">
            <div className="input-wrapper">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder={isBusy ? 'Aguarde...' : 'Fale com o JARVIS...'}
                disabled={isBusy}
                maxLength={500}
                aria-label="Mensagem"
              />
              <button
                className="send-inside"
                onClick={sendMessage}
                disabled={!input.trim() || isBusy}
                aria-label="Enviar"
              >
                <FaArrowAltCircleUp size={24} />
              </button>
            </div>

            <button
              onClick={startRecording}
              className={`mic-button ${recognizing ? 'active' : ''}`}
              disabled={isBusy}
              aria-label={recognizing ? 'Parar gravação' : 'Gravar voz'}
            >
              {recognizing ? <FaStop size={16} /> : <FaMicrophone size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}