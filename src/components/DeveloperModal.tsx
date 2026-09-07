import { FaReact, FaNodeJs, FaGitAlt } from "react-icons/fa";
import { SiTypescript, SiThreedotjs, SiVite } from "react-icons/si";
import { useState } from "react";

interface DeveloperModalProps {
  onClose: () => void;
}

const DeveloperModal: React.FC<DeveloperModalProps> = ({ onClose }) => {
  const [cards] = useState([
    { id: 1, name: "React", icon: <FaReact />, color: "#61DBFB" },
    { id: 2, name: "TypeScript", icon: <SiTypescript />, color: "#3178C6" },
    { id: 3, name: "Three.js", icon: <SiThreedotjs />, color: "#FFFFFF" },
    { id: 4, name: "Node.js", icon: <FaNodeJs />, color: "#68A063" },
    { id: 5, name: "Vite", icon: <SiVite />, color: "#646CFF" },
    { id: 6, name: "Git", icon: <FaGitAlt />, color: "#F1502F" },
  ]);

  return (
    <div className="stark-modal-overlay">
      <div className="stark-modal-container">
        <div className="stark-scanner-line"></div>
        
        <header className="stark-modal-header">
          <div className="status-indicator"><span className="blink-dot"></span>ONLINE</div>
          <h1 className="glitch-title" data-text="DEV_ID">DEV_ID</h1>
        </header>

        {/* ÁREA COM SCROLL */}
        <div className="stark-scroll-area">
          <section className="stark-identity">
            <div className="id-badge">OWNER</div>
            <h2 className="user-name">MAYCON BORGES PEREIRA</h2>
            <p className="access-level">NÍVEL: <span>CLASSE A</span></p>
          </section>

          <div className="stark-grid-panels">
            <div className="panel description-box">
              <h3>PROJETO J-A-R-V-I-S</h3>
              <p>IA de núcleo neural independente. Protocolos Stark configurados.</p>
            </div>

            <div className="panel stack-box">
              <h3>TECNOLOGIAS</h3>
              <div className="stark-stack-grid">
                {cards.map((card) => (
                  <div key={card.id} className="stark-skill-card">
                    <div className="skill-icon" style={{ color: card.color }}>{card.icon}</div>
                    <span className="skill-name">{card.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <section className="dev-links-area">
             <a href="https://maycon363.github.io/Novo-Portfolio/" target="_blank" rel="noreferrer" className="database-link">
              DATABASE PORTFOLIO
            </a>
          </section>
        </div>

        <footer className="stark-modal-footer">
          <button className="stark-close-btn" onClick={onClose}>
            ENCERRAR SESSÃO
          </button>
        </footer>
      </div>
    </div>
  );
};

export default DeveloperModal;