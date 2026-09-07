import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from 'react';

export default function NotFound() {
  const navigate = useNavigate();
  const [glitchIntensity, setGlitchIntensity] = useState(0);
  const [time, setTime] = useState(new Date().toLocaleTimeString());
  const [isBooting, setIsBooting] = useState(false);
  const [bootProgress, setBootProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const glitchInterval = setInterval(() => {
      setGlitchIntensity(Math.random() > 0.8 ? Math.random() * 0.5 : 0);
    }, 150);
    const timeInterval = setInterval(() => {
      setTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => {
      clearInterval(glitchInterval);
      clearInterval(timeInterval);
    };
  }, []);

  const handleReboot = () => {
    if (audioRef.current) {
      audioRef.current.volume = 0.5;
      audioRef.current.play().catch(e => console.log("Áudio bloqueado:", e));
    }
    setIsBooting(true);
    const interval = setInterval(() => {
      setBootProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => navigate("/jarvis-frontend/"), 800);
          return 100;
        }
        return prev + Math.floor(Math.random() * 10) + 2;
      });
    }, 80);
  };

  if (isBooting) {
    return (
      <div className="boot-sequence-overlay">
        <div className="scanline-overlay"></div>
        <div className="boot-loader">
          <div className="glitch-text" data-text="REESTABELECENDO NÚCLEO">REESTABELECENDO NÚCLEO</div>
          <div className="boot-bar-container">
            <div className="boot-bar-fill" style={{ width: `${bootProgress}%` }}></div>
            <div className="boot-glow" style={{ left: `${bootProgress}%` }}></div>
          </div>
          <div className="boot-stats">
            <span className="boot-percentage">{bootProgress}%</span>
            <span className="boot-status">{bootProgress < 100 ? "SYNCING..." : "COMPLETE"}</span>
          </div>
          <div className="boot-logs">
            <p> J.A.R.V.I.S. V2.0.0 BOOT SEQUENCE</p>
            <p> BYPASSING SECTOR_404... DONE</p>
            {bootProgress > 50 && <p> RE-ROUTING TO MAIN FRAME... OK</p>}
            {bootProgress >= 100 && <p className="success"> SISTEMA ESTABILIZADO. BEM-VINDO, SENHOR.</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="stark-diagnostic-wrap" style={{ '--glitch-x': `${glitchIntensity * 20}px`, '--glitch-y': `${glitchIntensity * 15}px` } as React.CSSProperties}>
      <div className="noise-overlay"></div>
      <div className="scanline-overlay"></div>
      <div className="static-overlay" style={{ opacity: glitchIntensity * 0.8 }}></div>
      <div className="animated-grid"></div>

      <div className="hud-container-grid">
        <div className="hud-panel left">
          <div className="panel-header">DIAGNÓSTICO DE SISTEMA</div>
          <div className="data-line critical"><span>ERROR_CODE:</span> <span>STARK_404</span></div>
          <div className="data-line"><span>STATUS:</span> <span className="error-status">CORRUPTED</span></div>
          <div className="data-line"><span>LAST_PING:</span> <span>{time}</span></div>
        </div>

        <div className="main-display-unit">
          <div className="target-reticle">
            <h1 className="error-critical-display" data-text="404">404</h1>
          </div>
        </div>

        <div className="hud-panel right">
          <div className="panel-header">CONTROLE DE ABORTO</div>
          <div className="data-line"><span>THREAT_LEVEL:</span> <span className="warning-text">HIGH</span></div>
          <button className="initiate-reboot" onClick={handleReboot}>
            <span>REINICIAR</span>
          </button>
        </div>
      </div>
    </div>
  );
}