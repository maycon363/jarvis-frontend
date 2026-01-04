// src/components/ConfigModal.tsx

import React from "react";
import "../style/configmodel.css";
import Swal from "sweetalert2";
import { FaRegTrashAlt } from "react-icons/fa";

interface ConfigModalProps {
  onClose: () => void;
  show3DModel: boolean;
  toggle3DModel: () => void;
  currentEnvironment: string;
  setEnvironment: (preset: string) => void;
  particleColor: string;
  setParticleColor: (color: string) => void;
  particleCount: number;
  setParticleCount: (count: number) => void;
  particleSize: number;
  setParticleSize: (size: number) => void;
  clearChat: () => void;
}

const ConfigModal: React.FC<ConfigModalProps> = ({
  onClose,
  show3DModel,
  toggle3DModel,
  currentEnvironment,
  setEnvironment,
  particleCount,
  setParticleCount,
  particleSize,
  setParticleSize,
  clearChat,
}) => {

  const presets = [
    { value: "night", label: "Noite (Performance/Escuro)" },
    { value: "city", label: "Cidade (Padrão/Equilibrado)" },
    { value: "studio", label: "Estúdio (Brilho Neutro)" },
    { value: "forest", label: "Floresta (Luz Quente)" },
    { value: "performance", label: "Performance (Somente Luzes Simples)" },
  ];

  return (
    <div className="config-overlay" onClick={onClose}>
      <div className="config-container" onClick={(e) => e.stopPropagation()}>

        <div className="config-header">
          <div className="config-title-text">
            <h2 className="config-title">Configurações do Sistema</h2>
          </div>
          <button 
            className="config-close-btn"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className="config-body">

          <h3>Interface Gráfica do modelo 3D do Homem de ferro</h3>

          <div className="config-block">
            <p>Ativar/Desativar Modelo 3D (Iron Man)</p>
            <button 
              onClick={() => {
                toggle3DModel();         
            }}
              className={`config-action-btn ${show3DModel ? "btn-on" : "btn-off"}`}
            >
              {show3DModel ? "Desativar Modelo 3D" : "Ativar Modelo 3D"}
            </button>
          </div>

          <div className="config-block">
            <p>Seleção do Ambiente (Reflexos e Luz)</p>
            <select
              className="config-select-env"
              value={currentEnvironment}
              onChange={(e) => setEnvironment(e.target.value)}
            >
              {presets.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
            </select>
          </div>

          <div className="config-separator"></div>

          <h3>Configurações da Particulas 3D</h3>

          <div className="config-block">
            <p>Quantidade de Partículas:</p>
            <input
              type="number"
              min={100}
              max={80000}
              value={particleCount}
              onChange={(e) => setParticleCount(Number(e.target.value))}
            />
          </div>

          <div className="config-block">
            <p>Tamanho da Esfera:</p>
            <input
              type="range"
              min={1.8}
              max={2.6}
              step={0.1}
              value={particleSize}
              onChange={(e) => setParticleSize(Number(e.target.value))}
            />
          </div>

          <div className="config-separator"></div>

          <h3>Sistema</h3>

          <div className="chat-block-clear">
            <p>Limpar todo o histórico do chat:</p>
            <button 
              onClick={() => {
                Swal.fire({
                  title: "Tem certeza?",
                  text: "Você não poderá reverter essa alteração!",
                  icon: "warning",
                  showCancelButton: true,
                  confirmButtonColor: "#3085d6",
                  cancelButtonColor: "#d33",
                  confirmButtonText: "Sim, deletar!"
                }).then((result) => {
                  if (result.isConfirmed) {
                    clearChat();
                    Swal.fire({
                      title: "Deletado!",
                      text: "Chat foi limpo com sucesso!",
                      icon: "success"
                    });
                  }
                }); {
                }
              }}
              className="chat-clear-btn"
            >
              <FaRegTrashAlt size={20}/> Limpar Conversa
            </button>
          </div>

          <div className="config-block">
            <p>Em breve outras opções serão adicionadas!</p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ConfigModal;
