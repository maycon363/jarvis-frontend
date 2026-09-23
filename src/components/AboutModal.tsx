import { FaMicrophone, FaBrain, FaVolumeUp, FaCube, FaBolt, FaShieldAlt } from 'react-icons/fa';
import { FcHighPriority, FcReddit, FcServices } from 'react-icons/fc';
import { IoIosCloseCircleOutline } from 'react-icons/io';

interface AboutModalProps {
  onClose: () => void;
}

const AboutModal: React.FC<AboutModalProps> = ({ onClose }) => {
  return (
    <div className="jv-overlay" onClick={onClose}>
      <div className="jv-panel" onClick={(e) => e.stopPropagation()}>
        <div className="jv-scanline" />

        <header className="jv-header">
          <div>
            <span className="jv-status"><span className="jv-blink-dot" />SYSTEM ONLINE</span>
            <h1 className="jv-title">SOBRE O J.A.R.V.I.S.</h1>
          </div>
          <button className="jv-close-btn" onClick={onClose} aria-label="Fechar Modal">
            <IoIosCloseCircleOutline size={26} />
          </button>
        </header>

        <div className="jv-scroll">
          <p className="jv-intro">
            <strong>J.A.R.V.I.S.</strong> é um assistente pessoal de IA com voz: ele ouve,
            entende, responde falando e se mantém visualmente presente através de um núcleo
            3D que reage a cada etapa da conversa.
          </p>

          <section className="jv-section">
            <h3 className="jv-section-title"><FaMicrophone size={14} /> Como ele ouve</h3>
            <div className="jv-card">
              <p>
                Sua fala é capturada e transcrita para texto pelo motor de reconhecimento de
                voz. Enquanto isso acontece, o núcleo entra em estado de escuta e reage
                visualmente à captura em tempo real.
              </p>
            </div>
          </section>

          <section className="jv-section">
            <h3 className="jv-section-title"><FaBrain size={14} /> Como ele pensa</h3>
            <div className="jv-card">
              <p>
                O texto (falado ou digitado) é enviado a um modelo de linguagem, que interpreta
                o pedido, pode consultar informações atualizadas na web quando necessário, e
                monta a resposta antes de devolvê-la.
              </p>
            </div>
          </section>

          <section className="jv-section">
            <h3 className="jv-section-title"><FaVolumeUp size={14} /> Como ele responde</h3>
            <div className="jv-card">
              <p>
                A resposta é sintetizada em voz por um motor de texto-para-fala e reproduzida
                junto com o texto na tela. Enquanto fala, o núcleo muda para o estado
                "speaking" e se move em sincronia com a voz.
              </p>
            </div>
          </section>

          <section className="jv-section">
            <h3 className="jv-section-title"><FaCube size={14} /> Como ele aparece</h3>
            <div className="jv-pill-grid">
              <div className="jv-pill">
                <span className="jv-pill-icon"><FcReddit /></span>
                <span className="jv-pill-label">Modelo 3D</span>
              </div>
              <div className="jv-pill">
                <span className="jv-pill-icon"><FcServices /></span>
                <span className="jv-pill-label">Holograma</span>
              </div>
              <div className="jv-pill">
                <span className="jv-pill-icon"><FcHighPriority /></span>
                <span className="jv-pill-label">Esfera leve</span>
              </div>
            </div>
            <span className="jv-hint">
              O modo de exibição pode ser trocado em Configurações — cada um tem um custo
              gráfico diferente, do mais pesado (Holograma) ao mais leve (Esfera).
            </span>
          </section>

          <div className="jv-separator" />

          <section className="jv-section">
            <h3 className="jv-section-title"><FaBolt size={14} /> Estados do núcleo</h3>
            <div className="jv-card">
              <ul>
                <li>Azul: em espera</li>
                <li>Ciano: ouvindo</li>
                <li>Laranja | vermelho: falando</li>
                <li>Vermelho: erro</li>
              </ul>
            </div>
          </section>

          <div className="jv-alert">
            <FaShieldAlt size={16} />
            <span>
              <strong>Em desenvolvimento:</strong> o J.A.R.V.I.S. é um protótipo. Pequenos bugs podem ocorrer, e alguns recursos ainda estão em fase de teste.
              pequenos bugs visuais ou de voz podem acontecer nesta fase.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutModal;