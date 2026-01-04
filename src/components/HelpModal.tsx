import React from 'react';
import { FcAssistant } from "react-icons/fc";
import { FcHighPriority } from "react-icons/fc";
import { FcServices } from "react-icons/fc";
import { FcReading, FcAnswers, FcAlarmClock  } from "react-icons/fc";

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
        <header className="modal-header">
          <h2 className="modal-title">Assistência de Ajuda (J.A.R.V.I.S.)</h2>
          <button className="config-close-btn" onClick={onClose} aria-label="Fechar Modal">✕</button>
        </header>

        <section className="modal-body">
          <article className="help-intro">
            <p>
              Eu sou <strong>J.A.R.V.I.S.</strong>, seu assistente pessoal de IA. Processando comandos e gerenciando tarefas em tempo real.
            </p>
          </article>

          <div className="help-separator"></div>

          <article className="help-card">
            <h3><FcReading size={28}/> Comandos Principais</h3>
            <ul>
              <li><strong>Voz (Whisper V3):</strong> Clique no microfone para ativar a entrada de voz. Processamento rápido e preciso.</li>
              <li><strong>Texto:</strong> Digite na caixa e pressione 'Enter' ou 'Enviar'.</li>
              <li><strong>Acesso:</strong> Use o menu ☰ para Configurações ou Ajuda.</li>
            </ul>
          </article>

          <article className="info-box">
            <h3><FcAlarmClock size={28}/> Tempo de Resposta</h3>
            <p>Primeira interação pode levar até <strong>50s</strong>. Depois, respostas voltam ao normal.</p>
          </article>

          <div className="help-separator"></div>

          <article className="help-card">
            <h3><FcServices size={28}/> Configurações Gráficas</h3>
            <ul>
              <li>Ativar/Desativar Modelo 3D (Iron Man) para desempenho.</li>
              <li>Presets de iluminação: night / city / studio / forest / performance.</li>
              <li>Comportamento de partículas: cores indicam status.</li>
            </ul>
          </article>

          <article className="help-card">
            <h3><FcAnswers size={28}/>Gerenciamento de Dados</h3>
            <p>O botão "Apagar Conversa" limpa a interface e reseta o contexto.</p>
          </article>

          <article className="help-card contact-info">
            <h3><FcAssistant size={28}/>Suporte Técnico</h3>
            <p>Reinicie a aplicação em caso de erro crítico. Verifique o console para bugs visuais.</p>
          </article>

          <article className="alert">
            <h3><FcHighPriority size={24} />Atenção!</h3>
            <p>O J.A.R.V.I.S. ainda está em desenvolvimento. Pequenos bugs podem ocorrer.</p>
          </article>
        </section>
      </div>
    </div>
  );
};
export default HelpModal;