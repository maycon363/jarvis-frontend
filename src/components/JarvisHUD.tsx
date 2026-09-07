// src/components/JarvisHUD.tsx
import axios from 'axios';
import { useState, useEffect, useRef } from 'react';

const BACKEND_URL =
  window.location.hostname === 'localhost'
    ? 'http://localhost:3001'
    : 'https://jarvis-backend-2-4kkb.onrender.com';

interface Telemetry {
  temp: number | string;
  location: string;
  os_version: string;
  description?: string;
  humidity?: number;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export const JarvisHUD = () => {
  const [power, setPower]     = useState(98.4);
  const [time, setTime]       = useState('');
  const [date, setDate]       = useState('');
  const [uptime, setUptime]   = useState('00:00:00');
  const [cpu, setCpu]         = useState(7);
  const [mem, setMem]         = useState(2.4);
  const [latency, setLatency] = useState(0);
  const [telemetry, setTelemetry] = useState<Telemetry>({
    temp: '--',
    location: 'CARREGANDO...',
    os_version: 'V.2.0.0',
  });

  const startRef = useRef(Date.now());

  // ─── Telemetry fetch ──────────────────────────────────────────────
  useEffect(() => {
    const fetchTelemetry = async () => {
      try {
        const t0  = Date.now();
        const res = await axios.get(`${BACKEND_URL}/api/telemetry`);
        setLatency(Date.now() - t0);
        setTelemetry(res.data);
      } catch {
        setTelemetry(prev => ({ ...prev, location: 'OFFLINE' }));
      }
    };

    fetchTelemetry();
    const id = setInterval(fetchTelemetry, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // ─── Clock + live metrics ─────────────────────────────────────────
  useEffect(() => {
    const DAYS   = ['DOMINGO', 'SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO'];
    const MONTHS = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];

    const tick = () => {
      const now = new Date();
      setTime(`${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`);
      setDate(`${DAYS[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`);

      const elapsed = Math.floor((Date.now() - startRef.current) / 1000);
      const h = Math.floor(elapsed / 3600);
      const m = Math.floor((elapsed % 3600) / 60);
      const s = elapsed % 60;
      setUptime(`${pad(h)}:${pad(m)}:${pad(s)}`);

      setCpu(Math.floor(Math.random() * 15) + 4);
      setMem(+(2.2 + Math.random() * 0.4).toFixed(1));
      setPower(prev => +Math.min(99.9, Math.max(95, prev + (Math.random() * 0.2 - 0.1))).toFixed(1));
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const cpuColor  = cpu  > 70 ? 'warn' : 'ok';
  const tempVal   = typeof telemetry.temp === 'number' ? telemetry.temp : null;
  const tempColor = tempVal !== null && tempVal > 35 ? 'warn' : 'ok';

  return (
    <div className="jarvis-hud-container">
      <div className="hud-top">

        <div className="hud-panel">
          <div className="hud-row"><span>CPU</span><span className={cpuColor}>{cpu}%</span></div>
        </div>

        <div className="hud-center">
          <div className="hud-date">{date}</div>
          <div className="hud-time">{time}</div>
          <div className="power-bar-wrap">
            <div className="power-bar-fill" style={{ width: `${power}%` }} />
          </div>
          <div className="hud-badges">
            <span className="badge active"><span className="pulse-dot" />BIOMETRIA OK</span>
            <span className="badge active">REDE ATIVA</span>
            <span className="badge">SHIELD OFFLINE</span>
          </div>
        </div>

        <div className="hud-panel right">
          <div className="hud-row"><span>POWER</span><span className="ok">{power}%</span></div>
          <div className="hud-row">
            <span>TEMP EXT</span>
            <span className={tempColor}>
              {telemetry.temp !== '--' ? `${telemetry.temp}°C` : '--'}
            </span>
          </div>
          <div className="hud-row"><span>LOCAL</span><span>{telemetry.location}</span></div>
          {telemetry.description && (
            <div className="hud-row"><span>CÉU</span><span>{telemetry.description}</span></div>
          )}
          {telemetry.humidity !== undefined && (
            <div className="hud-row"><span>UMID</span><span>{telemetry.humidity}%</span></div>
          )}
        </div>
      </div>

      <div className="hud-scan-line" />

      <div className="hud-metrics">
        <MetricCard label="FIREWALL" value="ATIVO"  color="ok" />
        <MetricCard label="SATÉLITE" value="SYNC"   color="ok" />
        <MetricCard label="SESSÕES"  value="1" />
        <MetricCard label="LATÊNCIA" value={latency ? `${latency}ms` : '--'} color={latency > 300 ? 'warn' : 'ok'} />
      </div>

      <div className="hud-footer">
        <span>© STARK INDUSTRIES — CLASSIFIED</span>
        <span className="typing-text">AGUARDANDO COMANDOS...</span>
        <span>ENC: AES-256</span>
      </div>

    </div>
  );
};

function MetricCard({ label, value, color }: { label: string; value: string; color?: 'ok' | 'warn' }) {
  return (
    <div className="metric-card">
      <span className="m-label">{label}</span>
      <span className={`m-val${color ? ` ${color}` : ''}`}>{value}</span>
    </div>
  );
}