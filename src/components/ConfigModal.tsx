import React from 'react';
import '../style/configmodel.css';
import Swal from 'sweetalert2';
import { FaRegTrashAlt } from 'react-icons/fa';

interface ConfigModalProps {
  onClose:            () => void;
  visualMode:         'model' | 'hologram' | 'orb';
  setVisualMode:      (mode: 'model' | 'hologram' | 'orb') => void;
  currentEnvironment: string;
  setEnvironment:     (preset: string) => void;
  particleColor:      string;
  setParticleColor:   (color: string) => void;
  particleCount:      number;
  setParticleCount:   (count: number) => void;
  particleSize:       number;
  setParticleSize:    (size: number) => void;
  bloomIntensity:     number;
  setBloomIntensity:  (v: number) => void;
  clearChat:          () => void;
}

const ENV_PRESETS = [
  { value: 'night',       label: 'Noite (escuro, performático)' },
  { value: 'city',        label: 'Cidade (padrão equilibrado)' },
  { value: 'studio',      label: 'Estúdio (neutro, brilhante)' },
  { value: 'forest',      label: 'Floresta (luz quente)' },
  { value: 'performance', label: 'Performance (mínimo)' },
];

const ConfigModal: React.FC<ConfigModalProps> = ({
  onClose,
  visualMode,
  setVisualMode,
  currentEnvironment,
  setEnvironment,
  bloomIntensity,
  setBloomIntensity,
  clearChat,
}) => {

  const handleClearChat = () => {
    Swal.fire({
      title: 'Tem certeza?',
      text: 'O histórico será apagado permanentemente.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sim, apagar!',
      cancelButtonText: 'Cancelar',
    }).then(result => {
      if (result.isConfirmed) {
        clearChat();
        Swal.fire({ title: 'Pronto!', text: 'Chat limpo com sucesso.', icon: 'success' });
      }
    });
  };

  return (
    <div className="config-overlay" onClick={onClose}>
      <div className="config-container" onClick={e => e.stopPropagation()}>

        <div className="config-header">
          <h2 className="config-title">Configurações do Sistema</h2>
          <button className="config-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="config-body">

          <h3>Visual — Iron Man</h3>

          <div className="config-block">
            <p>Modo de exibição</p>
            <div className="config-visual-mode-group">
              <button
                onClick={() => setVisualMode('model')}
                className={`config-action-btn ${visualMode === 'model' ? 'btn-on' : 'btn-off'}`}
              >
                Modelo 3D
              </button>
              <button
                onClick={() => setVisualMode('hologram')}
                className={`config-action-btn ${visualMode === 'hologram' ? 'btn-on' : 'btn-off'}`}
              >
                Holograma (partículas)
              </button>
              <button
                onClick={() => setVisualMode('orb')}
                className={`config-action-btn ${visualMode === 'orb' ? 'btn-on' : 'btn-off'}`}
              >
                Esfera leve
              </button>
            </div>
            <small style={{ color: '#888', fontSize: '11px' }}>
              Holograma é o modo mais pesado visualmente; Esfera leve é o mais performático.
            </small>
          </div>

          {visualMode === 'model' && (
            <div className="config-block">
              <p>Ambiente de Iluminação (HDRI)</p>
              <select
                className="config-select-env"
                value={currentEnvironment}
                onChange={e => setEnvironment(e.target.value)}
              >
                {ENV_PRESETS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          )}

          {(visualMode === 'model' || visualMode === 'hologram' || visualMode === 'orb') && (
            <div className="config-block">
              <p>
                Intensidade do Bloom:{' '}
                <span style={{ color: '#00f2ff' }}>
                  {bloomIntensity === 0 ? 'Desativado' : bloomIntensity.toFixed(1)}
                </span>
              </p>
              <input
                type="range"
                min={0}
                max={2}
                step={0.1}
                value={bloomIntensity}
                onChange={e => setBloomIntensity(Number(e.target.value))}
              />
              <small style={{ color: '#888', fontSize: '11px' }}>
                0 = desativado · 0.5–0.8 recomendado · acima de 1.2 pesado em mobile
              </small>
            </div>
          )}

          <div className="config-separator" />

          <h3>Sistema</h3>

          <div className="chat-block-clear">
            <p>Limpar todo o histórico do chat:</p>
            <button onClick={handleClearChat} className="chat-clear-btn">
              <FaRegTrashAlt size={16} /> Limpar Conversa
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ConfigModal;