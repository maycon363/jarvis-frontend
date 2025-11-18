// src/components/ConfigModal.tsx

import React from "react";
import "../style/configmodel.css";

interface ConfigModalProps {
  onClose: () => void;
  show3DModel: boolean;
  toggle3DModel: () => void;
}

const ConfigModal: React.FC<ConfigModalProps> = ({
  onClose,
  show3DModel,
  toggle3DModel
}) => {

  return (
    <div className="config-overlay" onClick={onClose}>
      <div className="config-container" onClick={(e) => e.stopPropagation()}>

        <div className="config-header">
          <h2 className="config-title">Configurações do Sistema</h2>

          <button 
            className="config-close-btn"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="config-body">

          <h3>Interface Gráfica</h3>

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

          <div className="config-separator"></div>

          <h3>Sistema</h3>

          <div className="config-block">
            <p>Em breve outras opções serão adicionadas!</p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ConfigModal;
