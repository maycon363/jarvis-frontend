import React from 'react';
import Swal from 'sweetalert2';
import { FaRegTrashAlt } from 'react-icons/fa';
import { IoIosCloseCircleOutline } from 'react-icons/io';
import { FcServices } from 'react-icons/fc';

interface ConfigModalProps {
  onClose:            () => void;
  visualMode:         'model' | 'hologram' | 'orb' | 'humanoid';
  setVisualMode:      (mode: 'model' | 'hologram' | 'orb' | 'humanoid') => void;
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
      confirmButtonColor: '#00d4ff',
      cancelButtonColor: '#ff3b3b',
      confirmButtonText: 'Sim, apagar!',
      cancelButtonText: 'Cancelar',
      background: '#020a16',
      color: '#fff',
    }).then(result => {
      if (result.isConfirmed) {
        clearChat();
        Swal.fire({
          title: 'Pronto!',
          text: 'Chat limpo com sucesso.',
          icon: 'success',
          background: '#020a16',
          color: '#fff',
        });
      }
    });
  };

  return (
    <div className="jv-overlay" onClick={onClose}>
      <div className="jv-panel" onClick={e => e.stopPropagation()}>
        <div className="jv-scanline" />

        <header className="jv-header">
          <div>
            <span className="jv-status"><span className="jv-blink-dot" />ONLINE</span>
            <h1 className="jv-title"><FcServices size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />CONFIGURAÇÕES</h1>
          </div>
          <button className="jv-close-btn" onClick={onClose} aria-label="Fechar Modal">
            <IoIosCloseCircleOutline size={26} />
          </button>
        </header>

        <div className="jv-scroll">
          <section className="jv-section">
            <h3 className="jv-section-title">Modelos Visuais</h3>

            <div className="jv-block">
              <p>Modo de exibição</p>
              <div className="jv-toggle-group">
                <button
                  onClick={() => setVisualMode('model')}
                  className={`jv-toggle ${visualMode === 'model' ? 'jv-toggle-on' : ''}`}
                >
                  Modelo 3D
                </button>
                <button
                  onClick={() => setVisualMode('hologram')}
                  className={`jv-toggle ${visualMode === 'hologram' ? 'jv-toggle-on' : ''}`}
                >
                  Universo de Cubos
                </button>
                <button
                  onClick={() => setVisualMode('orb')}
                  className={`jv-toggle ${visualMode === 'orb' ? 'jv-toggle-on' : ''}`}
                >
                  Esfera leve
                </button>
                <button
                  onClick={() => setVisualMode('humanoid')}
                  className={`jv-toggle ${visualMode === 'humanoid' ? 'jv-toggle-on' : ''}`}
                >
                  Humanoide
                </button>
              </div>
              <span className="jv-hint">
                Holograma é o modo mais pesado visualmente; Esfera leve é o mais performático.
              </span>
            </div>

            {visualMode === 'model' && (
              <div className="jv-block">
                <p>Ambiente de Iluminação (HDRI)</p>
                <select
                  className="jv-select"
                  value={currentEnvironment}
                  onChange={e => setEnvironment(e.target.value)}
                >
                  {ENV_PRESETS.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="jv-block">
              <p>
                Intensidade do Bloom:{' '}
                <span style={{ color: '#00d4ff' }}>
                  {bloomIntensity === 0 ? 'Desativado' : bloomIntensity.toFixed(1)}
                </span>
              </p>
              <input
                type="range"
                className="jv-range"
                min={0}
                max={2}
                step={0.1}
                value={bloomIntensity}
                onChange={e => setBloomIntensity(Number(e.target.value))}
              />
              <span className="jv-hint">
                0 = desativado · 0.5–0.8 recomendado · acima de 1.2 pesado em mobile
              </span>
            </div>
          </section>

          <div className="jv-separator" />

          <section className="jv-section">
            <h3 className="jv-section-title">Sistema</h3>
            <div className="jv-block">
              <p>Limpar todo o histórico do chat:</p>
              <button onClick={handleClearChat} className="jv-btn jv-btn-danger">
                <FaRegTrashAlt size={14} /> LIMPAR CONVERSA
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default ConfigModal;