import React from 'react';
import { FcAssistant, FcMenu } from "react-icons/fc";
import { FcHighPriority } from "react-icons/fc";
import { FcServices } from "react-icons/fc";
import { FcReading, FcAlarmClock } from "react-icons/fc";
import { IoIosCloseCircleOutline } from "react-icons/io";
import { FcDatabase } from "react-icons/fc";

interface HelpModalProps {
  onClose: () => void;
}

const HelpModal: React.FC<HelpModalProps> = ({ onClose }) => {
  return (
    <div className="jv-overlay" onClick={onClose}>
      <div className="jv-panel" onClick={(e) => e.stopPropagation()}>
        <div className="jv-scanline" />

        <header className="jv-header">
          <div>
            <span className="jv-status"><span className="jv-blink-dot" />ONLINE</span>
            <h1 className="jv-title">CENTRAL DE AJUDA</h1>
          </div>
          <button className="jv-close-btn" onClick={onClose} aria-label="Fechar Modal">
            <IoIosCloseCircleOutline size={26} />
          </button>
        </header>

        <div className="jv-scroll">
          <p className="jv-intro">
            Eu sou <strong>J.A.R.V.I.S.</strong>, seu assistente pessoal de IA. Processando
            comandos e gerenciando tarefas em tempo real.
          </p>

          <section className="jv-section">
            <h3 className="jv-section-title"><FcReading size={18} />Comandos Principais</h3>
            <div className="jv-card">
              <ul>
                <li><strong>Voz:</strong> clique no microfone para ativar a entrada de voz. Processamento rápido e preciso.</li>
                <li><strong>Texto:</strong> digite na caixa e pressione "Enter" ou "Enviar".</li>
                <li><strong>Acesso:</strong> use o menu <FcMenu /> para Sobre, Configurações ou Suporte.</li>
              </ul>
            </div>
          </section>

          <section className="jv-section">
            <h3 className="jv-section-title"><FcAlarmClock size={18} />Tempo de Resposta</h3>
            <div className="jv-card">
              <p>Primeira interação pode levar até <strong>50s</strong>. Depois, respostas voltam ao normal.</p>
            </div>
          </section>

          <div className="jv-separator" />

          <section className="jv-section">
            <h3 className="jv-section-title"><FcServices size={18} />Configurações Gráficas</h3>
            <div className="jv-card">
              <ul>
                <li>Ativar/desativar o Modelo 3D (Iron Man) para ganhar desempenho.</li>
                <li>Presets de iluminação: night / city / studio / forest / performance.</li>
                <li>O comportamento das partículas/cubos indica o status do assistente.</li>
              </ul>
            </div>
          </section>

          <section className="jv-section">
            <h3 className="jv-section-title"><FcDatabase size={18} />Gerenciamento de Dados</h3>
            <div className="jv-card">
              <p>O botão "Limpar Conversa" (em Configurações) apaga a interface e reseta o contexto.</p>
            </div>
          </section>

          <section className="jv-section">
            <h3 className="jv-section-title"><FcAssistant size={18} />Suporte Técnico</h3>
            <div className="jv-card">
              <p>Reinicie a aplicação em caso de erro crítico. Verifique o console para bugs visuais.</p>
            </div>
          </section>

          <div className="jv-alert">
            <FcHighPriority size={18} />
            <span><strong>Atenção:</strong> o J.A.R.V.I.S. ainda está em desenvolvimento e é experimental. Pequenos bugs podem ocorrer.</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;