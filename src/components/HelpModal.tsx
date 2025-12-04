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
            Eu sou J.A.R.V.I.S., seu assistente pessoal de inteligência artificial. Fui projetado para processar comandos, fornecer informações e gerenciar tarefas em tempo real. Meu núcleo de conversação é o LLama 3.3 (via Groq).
          </p>
          <div className="help-separator"></div>
          <div className="help-section-config">
            <h2>🎙️ Comandos Principais:</h2>
              <h1>Voz (Whisper V3):</h1> Clique no ícone de microfone ("🎙️") para ativar a entrada de voz. O áudio é processado pelo "Whisper V3" da Groq para garantir a "transcrição mais rápida e precisa" para o Português.
              <h1>Texto:</h1> Digite sua pergunta ou comando na caixa de entrada e pressione 'Enviar' ou 'Enter'.
              <h1>Acesso:</h1> Use o menu ("☰") para acessar "Configurações" ou esta seção de Ajuda.
          </div>
          <div className="help-separator"></div>
          <div className="help-section-config">
            <h2>🛠️ Configurações Gráficas e Desempenho</h2>
            <ul>
              <h3>Ativar/Desativar Modelo 3D (Iron Man)</h3>
              <p>Se o seu dispositivo tiver problemas de desempenho, desativar o Modelo 3D (trocando-o pela esfera de partículas) irá "melhorar significativamente" a velocidade de renderização.</p>
            </ul>
            <div className="help-separator"></div>
            <ul>
              <h3>Opções de Renderização 3D</h3>
              <h4>Presets de Ambiente (Iluminação e Reflexos):</h4>
              <p>Os modos "night / city / studio / forest" usam texturas de alta qualidade (HDRi) para reflexos realistas. O modo "performance" é a opção "Ultra Leve", desativando texturas complexas para o máximo de velocidade.</p>
              <h3>Configurações de Partículas:</h3>
              <p>É possível ajustar a "Quantidade de Partículas" e o "Tamanho da Esfera" que serve como a representação visual do JARVIS quando o modelo 3D do Iron Man está desativado. Ajuste a "Quantidade" para otimizar o desempenho.</p>
              <h3>Comportamento das Partículas (Indicador de Status):</h3>
              <p>
                "Verde Água": "Ocioso (Idle)". Aguardando comandos.<br/>
                "Azul Escuro": "Gravação/Sucesso". O microfone está ativo ou uma ação foi concluída.<br/>
                "Verde Brilhante": "Falando/Processando". O JARVIS está gerando ou lendo uma resposta.<br/>
                "Vermelho": "Erro Crítico". Ocorreu uma falha no sistema ou na comunicação.
              </p>
            </ul>
          </div>
          <div className="help-separator"></div>
          <div className="help-section">
            <h3>Gerenciamento de Dados:</h3>
            <ul>
              <li>
                <h1>Apagar Conversa:</h1> O botão "Apagar Conversa" nas Configurações não apenas limpa a interface, mas também envia um comando ao backend para "Limpar/apagar o chat" do JARVIS, resetando o contexto.
              </li>
            </ul>
          </div>
          <div className="help-separator"></div>
          <div className="contact-info help-section">
            <h3>Suporte Técnico:</h3>
            <p>Em caso de falha crítica ou erro de sistema, por favor, reinicie a aplicação. Para bugs visuais, verifique o console do navegador.</p>
          </div>
          <div className="help-separator"></div>
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