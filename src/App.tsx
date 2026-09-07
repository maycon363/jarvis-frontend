import './App.css';
import Chat from './pages/Chat';
import NotFound from './pages/NotFound';
import { useEffect, useRef, useState } from 'react';
import type { ModalType } from './types/types';
import Menu from './components/Menu';
import HelpModal from './components/HelpModal';
import ConfigModal from './components/ConfigModal';
import SupportModal from './components/SupportModal';
import { Routes, Route } from 'react-router-dom';
import DeveloperModal from './components/DeveloperModal';

function App() {
  const [loading, setLoading]               = useState(true);
  const [isMenuOpen, setIsMenuOpen]         = useState(false);
  const [openModal, setOpenModal]           = useState<ModalType | null>(null);
  const [visualMode, setVisualMode]         = useState<'model' | 'hologram' | 'orb'>('model');
  const [environmentPreset, setEnvironmentPreset] = useState('night');
  const [particleColor, setParticleColor]   = useState('#2030B3');
  const [particleCount, setParticleCount]   = useState(6000);
  const [particleSize, setParticleSize]     = useState(2.4);
  const [bloomIntensity, setBloomIntensity] = useState(0.6); // ← estado que faltava

  const clearChatRef = useRef<(() => void) | null>(null);

  const toggleMenu = () => setIsMenuOpen(prev => !prev);

  const handleSelectOption = (option: ModalType) => {
    setIsMenuOpen(false);
    setOpenModal(option);
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(false);
      const utterance = new SpeechSynthesisUtterance('Bem-vindo ao JARVIS');
      utterance.lang = 'pt-BR';
      utterance.rate = 0.9;
      speechSynthesis.speak(utterance);
    }, 2500);
    return () => clearTimeout(timeout);
  }, []);

  let ActiveModal = null;

  if (openModal === 'Ajuda') {
    ActiveModal = <HelpModal onClose={() => setOpenModal(null)} />;
  }

  if (openModal === 'Configurações') {
    ActiveModal = (
      <ConfigModal
        onClose={() => setOpenModal(null)}
        visualMode={visualMode}
        setVisualMode={setVisualMode}
        currentEnvironment={environmentPreset}
        setEnvironment={setEnvironmentPreset}
        particleColor={particleColor}
        setParticleColor={setParticleColor}
        particleCount={particleCount}
        setParticleCount={setParticleCount}
        particleSize={particleSize}
        setParticleSize={setParticleSize}
        bloomIntensity={bloomIntensity}        // ← passando
        setBloomIntensity={setBloomIntensity}  // ← passando
        clearChat={() => clearChatRef.current?.()}
      />
    );
  }

  if (openModal === 'Suporte') {
    ActiveModal = <SupportModal onClose={() => setOpenModal(null)} />;
  }

  if (openModal === 'Desenvolvedor') {
    ActiveModal = <DeveloperModal onClose={() => setOpenModal(null)} />;
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="arc-reactor-container">
          <div className="energy-vortex"></div>
          <div className="reactor-ring-1"></div>
          <div className="reactor-ring-2"></div>
          <div className="reactor-ring-3"></div>
          <div className="coils-container">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="coil" style={{ '--i': i } as React.CSSProperties} />
            ))}
          </div>
          <div className="reactor-core-outer"></div>
          <div className="reactor-core-inner">
            <div className="core-flare"></div>
          </div>
        </div>

        <div className="loading-hud">
          <h1 className="jarvis-glitch" data-text="JARVIS">J-A-R-V-I-S</h1>
          <div className="loading-bar-wrapper">
            <div className="loading-bar-progress"></div>
          </div>
          <div className="hud-data">
            <span className="status-message">ESTABLISHING SECURE CONNECTION...</span>
            <span className="percent-counter">CALIBRATING</span>
          </div>
        </div>

        <div className="particles-layer"></div>
        <div className="scan-line"></div>
        <div className="grid-overlay"></div>
      </div>
    );
  }

  return (
    <div className="main-app-container">
      <Menu
        isOpen={isMenuOpen}
        toggleMenu={toggleMenu}
        onSelectOption={handleSelectOption}
        toggle3DModel={() => setVisualMode(prev =>
          prev === 'model' ? 'hologram' : prev === 'hologram' ? 'orb' : 'model'
        )}
        onClearChat={() => clearChatRef.current?.()}
      />

      {ActiveModal}

      <Routes>
        <Route
          path="/jarvis-frontend/"
          element={
            <Chat
              toggleMenu={toggleMenu}
              isMenuOpen={isMenuOpen}
              visualMode={visualMode}
              environmentPreset={environmentPreset}
              particleColor={particleColor}
              particleCount={particleCount}
              particleSize={particleSize}
              bloomIntensity={bloomIntensity}  // ← passando para o Chat
              clearChatRef={clearChatRef}
            />
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}

export default App;