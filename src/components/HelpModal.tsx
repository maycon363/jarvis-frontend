// src/components/HelpModal.tsx

import React from 'react';

type ModalType = 'Configurações' | 'Perfil' | 'Ajuda' | null;

interface MenuProps {
  isOpen: boolean;
  toggleMenu: () => void;
  onSelectOption: (option: ModalType) => void;
}

interface HelpModalProps {
  onClose: () => void;
}

const HelpModal: React.FC<HelpModalProps> = ({ onClose }) => {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Assistência de Ajuda (J.A.R.V.I.S.)</h2>
          <button className="close-button" onClick={onClose} aria-label="Fechar Modal">
            ✕
          </button>
        </div>
        <div className="modal-body">
          <p className="help-text">
            Eu sou J.A.R.V.I.S., seu assistente pessoal de inteligência artificial. Fui projetado para processar comandos, fornecer informações e gerenciar tarefas em tempo real.
          </p>
          <div className="help-section">
            <h3>Comandos Principais:</h3>
            <ul>
              <li><h1>Voz:</h1> Clique no ícone de microfone (🎤) para ativar a entrada de voz e me dar comandos.</li>
              <li><h1>Texto:</h1> Digite sua pergunta ou comando na caixa de entrada e pressione 'Enviar' ou 'Enter'.</li>
              <li><h1>Acesso:</h1> Use o menu (☰) para acessar Configurações, Perfil ou esta seção de Ajuda.</li>
            </ul>
          </div>
          <div className="help-section">
            <h3>Status e Informações:</h3>
            <p>
              Qualquer resposta que eu gerar será exibida na janela de chat, marcada com minha identificação. Minha interface atual simula o ambiente de controle do Iron Man.
            </p>
          </div>
          <div className="contact-info help-section">
            <h3>Suporte Técnico:</h3>
            <p>Em caso de falha crítica ou erro de sistema, por favor, reinicie a aplicação. Para bugs visuais, verifique o console do navegador.</p>
          </div>
          <div className="alert">
            <h2>Atenção!</h2>
            <p>O J.A.R.V.I.S. ainda está em desenvolvimento, portanto é possível que você encontre alguns bugs, erros ou pequenos atrasos.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;