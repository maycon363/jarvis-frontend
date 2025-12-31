import { FaReact, FaNodeJs, FaGitAlt } from "react-icons/fa";
import { SiTypescript, SiThreedotjs, SiVite } from "react-icons/si";
import { useState } from "react";

interface DeveloperModalProps {
  onClose: () => void;
}

const DeveloperModal: React.FC<DeveloperModalProps> = ({ onClose }) => {
    const [cards, setCards] = useState([
        { id: 1, name: "React", icon: <FaReact />, color: "#61DBFB" },        
        { id: 2, name: "TypeScript", icon: <SiTypescript />, color: "#3178C6" }, 
        { id: 3, name: "Three.js", icon: <SiThreedotjs />, color: "#F0DB4F" },  
        { id: 4, name: "Node.js", icon: <FaNodeJs />, color: "#68A063" },      
        { id: 5, name: "Vite", icon: <SiVite />, color: "#646CFF" },           
        { id: 6, name: "Git", icon: <FaGitAlt />, color: "#F1502F" },          
    ]);

  const rotateCards = () => {
    setCards((prev) => {
      const [first, ...rest] = prev;
      return [...rest, first];
    });
  };

  return (
    <div className="modal-overlay hologram">
      <div className="modal-content developer-modal">

        <div className="dev-header glitch" data-text="DESENVOLVEDOR">
          DESENVOLVEDOR
        </div>

        <span className="badge">SYSTEM OWNER</span>

        <div className="dev-identity">
          <h3 className="typewriter">Maycon Borges Pereira</h3>
          <p className="dev-status">✔ Acesso Total Autorizado</p>
        </div>

        <div className="dev-panels">
          <section>
            <h4>Descrição</h4>
            <p>Projeto independente inspirado em IA e interfaces futuristas. O objetivo desta IA é servir como assistente pessoal, ajudando em tarefas, organização e aprendizado.</p>
          </section>

          <section>
            <h4 className="dev-section-title">Stack</h4>
            <div className="stack-cards">
              {cards.map((card, index) => (
                <div
                  key={card.id}
                  className={`stack-card position-${index % 3}`} 
                  onClick={rotateCards}
                >
                  <div className="stack-icon" style={{ color: card.color }}>{card.icon}</div>
                  <span>{card.name}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="dev-links">
            <h4>Portfolio</h4>
            <a
              href="https://maycon363.github.io/Novo-Portfolio/"
              target="_blank"
              rel="noreferrer"
            >
              Ver Portfolio
            </a>
          </section>
        </div>

        <button className="modal-close" onClick={onClose}>
          Encerrar Sessão
        </button>
      </div>
    </div>
  );
};

export default DeveloperModal;
