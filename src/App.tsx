// src/App.tsx

import './App.css';
import Chat from './pages/Chat';
import { useEffect, useState } from 'react';
import bgVideo from './assets/jarvis-bg.mp4';

import Menu from './components/Menu';
import HelpModal from './components/HelpModal';
import ConfigModal from './components/ConfigModal'; // 🟢 IMPORTADO AGORA

// Tipo de modal
type ModalType = 'Ajuda' | 'Configurações' | 'Perfil';

function App() {
  const [loading, setLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Qual modal está aberto
  const [openModal, setOpenModal] = useState<ModalType | null>(null);

  // 🟢 ESTADO DO MODELO 3D
  const [show3DModel, setShow3DModel] = useState(true);

  const toggleMenu = () => {
    setIsMenuOpen(prev => !prev);
  };

  const handleSelectOption = (option: ModalType) => {
    console.log("Menu option selected:", option);

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

  // 🟢 SISTEMA DE MODAIS
  let ActiveModal = null;

  if (openModal === "Ajuda") {
    ActiveModal = <HelpModal onClose={() => setOpenModal(null)} />;
  }

  if (openModal === "Configurações") {
    ActiveModal = (
      <ConfigModal
        onClose={() => setOpenModal(null)}
        show3DModel={show3DModel}
        toggle3DModel={() => setShow3DModel(prev => !prev)}
      />
    );
  }

  return (
    <div className="main-app-container">

      {loading ? (
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
      ) : (
        <>
          <Menu 
            isOpen={isMenuOpen} 
            toggleMenu={toggleMenu}
            onSelectOption={handleSelectOption}
            toggle3DModel={() => setShow3DModel(prev => !prev)}
          />

          {ActiveModal}
          <Chat 
            toggleMenu={toggleMenu}
            isMenuOpen={isMenuOpen}
            show3DModel={show3DModel}        // 🟢 PASSADO PARA O CHAT
          />
        </>
      )}
    </div>
  );
}

export default App;
