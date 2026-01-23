import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { IronManModel } from '../components/IronManModel';
import { v4 as uuidv4 } from 'uuid';
import { Canvas } from '@react-three/fiber';
import { ParticleBrain } from '../components/ParticleBrain';
import { FaMicrophone, FaStop, FaArrowAltCircleUp } from "react-icons/fa";

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
  audioBase64?: string;
  humor?: 'angry' | 'calm' | 'neutral';
}

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
  const [humor, setHumor] = useState<'angry' | 'calm' | 'neutral'>('neutral');

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);

  const [sessionId] = useState(() => {
    const stored = sessionStorage.getItem("jarvis_session_id");
    if (stored) return stored;
    const newId = uuidv4();
    sessionStorage.setItem("jarvis_session_id", newId);
    return newId;
  });

  // --- NOVA FUNÇÃO PARA TOCAR O ÁUDIO DO KOKORO ---
  const tocarAudioKokoro = async (base64: string) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });
    }

    const ctx = audioContextRef.current;

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const float32 = new Float32Array(bytes.buffer);

    const buffer = ctx.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    setSpeaking(true);
    setSphereStatus("speaking");

    source.onended = () => {
      setSpeaking(false);
      setSphereStatus("idle");
    };

    source.start();
  };
  const speak = async (text: string, isError = false) => {
    setArmorError(isError);
    setSphereStatus(isError ? "error" : "speaking");

    try {
      const response = await axios.post(`${BACKEND_URL}/api/speak`, { text });
      if (response.data.audioBase64) {
        await tocarAudioKokoro(response.data.audioBase64);
      }
    } catch (err) {
      console.error("Erro na voz:", err);
      setSphereStatus("idle");
    }
  };

  const sendAndProcessMessage = async (userMessage: string) => {
    setMessages((p) => [...p, { sender: "user", text: userMessage }]);
    setSphereStatus("speaking");

    try {
      const response = await axios.post<ChatResponse>(`${BACKEND_URL}/api/chat`, { 
        message: userMessage, 
        sessionId 
      });

      const { type, payload, audioBase64, humor: humorVindo } = response.data;
      setHumor(humorVindo || 'neutral');
      setArmorError(humorVindo === 'angry');

      let textoFinal = payload;
      if (type === "action") {
        try {
          const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
          textoFinal = parsed.message || "Protocolo executado.";
        } catch { textoFinal = payload; }
      }

      // Exibe a mensagem do Jarvis
      setMessages((p) => [...p, { sender: "jarvis", text: textoFinal }]);

      // Se veio áudio, toca usando a nova função
      if (audioBase64) {
        // Usamos audio/wav aqui
        const audio = new Audio(`data:audio/wav;base64,${audioBase64}`);
        
        audio.onplay = () => setSpeaking(true);
        audio.onended = () => {
            setSpeaking(false);
            setSphereStatus("idle");
        };

        await audio.play().catch(e => console.error("Erro no player:", e));
      }
    } catch (err) {
      console.error("Erro:", err);
      setSphereStatus("error");
    }
  };

  // --- RESTANTE DAS FUNÇÕES (sendMessage, startRecording, etc) ---
  const sendMessage = () => {
    if (!input.trim() || speaking) return;
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
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const formData = new FormData();
        formData.append("audio", audioBlob, "audio.webm");
        try {
          const sttRes = await fetch(`${BACKEND_URL}/api/stt`, { method: "POST", body: formData });
          const sttData = await sttRes.json();
          if (sttData.text) sendAndProcessMessage(sttData.text);
        } catch {}
        setRecognizing(false);
        setSphereStatus("idle");
      };
      recorder.start();
      setRecognizing(true);
      setSphereStatus("success");
    } catch { alert("Erro ao acessar mic"); }
  };

  const stopRecording = () => {
    if (recorderRef.current) {
      recorderRef.current.stop();
      recorderRef.current.stream.getTracks().forEach(t => t.stop());
    }
    setRecognizing(false);
  };

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { clearChatRef.current = () => setMessages([]); }, [clearChatRef]);

  return (
    <div className="jarvis-container">
      <button onClick={toggleMenu} className="hamburger-button">{isMenuOpen ? "✕" : "☰"}</button>
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
            {messages.length === 0 && <div className="empty-chat">Aguardando comandos, senhor Maycon...</div>}
            {messages.map((msg, idx) => (
              <div key={idx} className={`message ${msg.sender}`}>
                <strong>{msg.sender === "jarvis" ? "JARVIS" : "VOCÊ"}:</strong> {msg.text}
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
              <button className="send-inside" onClick={sendMessage} disabled={!input.trim() || speaking}>
                <FaArrowAltCircleUp size={29} />
              </button>
            </div>
            <button onClick={startRecording} className={`mic-button ${recognizing ? "active" : ""}`} disabled={speaking}>
              {recognizing ? <FaStop size={18} /> : <FaMicrophone size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}