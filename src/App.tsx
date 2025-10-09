import './App.css';
import Chat from './components/Chat';
import { useEffect, useState } from 'react';
import bgVideo from './assets/jarvis-bg.mp4';


function App() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simula carregamento de 2.5 segundos
    const timeout = setTimeout(() => {
      setLoading(false);

      // Fala ao iniciar
      const utterance = new SpeechSynthesisUtterance("Bem-vindo ao JARVIS");
      utterance.lang = 'pt-BR';
      utterance.rate = 0.9;
      speechSynthesis.speak(utterance);
    }, 2500);

    return () => clearTimeout(timeout);
  }, []);

  return (
    <>
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
          <div className="overlay">
            <div className="loader"></div>
            <div className="loading-text">J.A.R.V.I.S. carregando...</div>
          </div>
        </div>
      ) : (
        <div>
          <Chat />
        </div>
      )}
    </>
  );
}

export default App;
