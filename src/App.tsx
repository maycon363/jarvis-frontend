// src/App.tsx
import './App.css';
import Chat from './pages/Chat';
import NotFound from './pages/NotFound';
import { useEffect, useRef, useState } from 'react';
import bgVideo from './assets/jarvis-bg.mp4';
import type { ModalType } from './types/types';
import Menu from './components/Menu';
import HelpModal from './components/HelpModal';
import ConfigModal from './components/ConfigModal';
import SupportModal from './components/SupportModal';
import { Routes, Route } from 'react-router-dom';
import DeveloperModal from './components/DeveloperModal';

function App() {
  const [loading, setLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const [particleColor, setParticleColor] = useState("#2030B3");
  const [particleCount, setParticleCount] = useState(6000);
  const [particleSize, setParticleSize] = useState(2.4);

  const clearChatRef = useRef<(() => void) | null>(null);

  const [openModal, setOpenModal] = useState<ModalType | null>(null);
  const [show3DModel, setShow3DModel] = useState(true);
  const [environmentPreset, setEnvironmentPreset] = useState('night');

  const toggleMenu = () => setIsMenuOpen(prev => !prev);

  const handleSelectOption = (option: ModalType) => {
    setIsMenuOpen(false);
    setOpenModal(option);
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(false);
      const utterance = new SpeechSynthesisUtterance("Bem-vindo ao JARVIS");
      utterance.lang = 'pt-BR';
      utterance.rate = 0.9;
      speechSynthesis.speak(utterance);
    }, 2500);
    return () => clearTimeout(timeout);
  }, []);

  let ActiveModal = null;
  if (openModal === "Ajuda") ActiveModal = <HelpModal onClose={() => setOpenModal(null)} />;
  if (openModal === "Configurações") ActiveModal = (
    <ConfigModal
      onClose={() => setOpenModal(null)}
      show3DModel={show3DModel}
      toggle3DModel={() => setShow3DModel(prev => !prev)}
      currentEnvironment={environmentPreset}
      setEnvironment={setEnvironmentPreset}
      particleColor={particleColor}
      setParticleColor={setParticleColor}
      particleCount={particleCount}
      setParticleCount={setParticleCount}
      particleSize={particleSize}
      setParticleSize={setParticleSize}
      clearChat={() => clearChatRef.current?.()}
    />
  );
  if (openModal === "Suporte") ActiveModal = <SupportModal onClose={() => setOpenModal(null)} />;

  if (openModal === "Desenvolvedor") ActiveModal = <DeveloperModal onClose={() => setOpenModal(null)} />;

  if (loading) {
    return (
      <div className="loading-screen">
        <video
          className="background-video"
          src={bgVideo}
          autoPlay
          loop
          muted
          playsInline
        />
      </div>
    );
  }

  return (
    <div className="main-app-container">
      <Menu
        isOpen={isMenuOpen}
        toggleMenu={toggleMenu}
        onSelectOption={handleSelectOption}
        toggle3DModel={() => setShow3DModel(prev => !prev)}
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
              show3DModel={show3DModel}
              environmentPreset={environmentPreset}
              particleColor={particleColor}
              particleCount={particleCount}
              particleSize={particleSize}
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
