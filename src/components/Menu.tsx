// src/components/Menu.tsx

import React from 'react';

type ModalType = 'Ajuda' | 'Configurações' | 'Perfil';

interface MenuProps {
  isOpen: boolean;
  toggleMenu: () => void;
  onSelectOption: (option: ModalType) => void;
  toggle3DModel: () => void; // Função para alternar o modelo 3D
}

const Menu: React.FC<MenuProps> = ({ isOpen, toggleMenu, onSelectOption, toggle3DModel }) => {

  const handleOptionClick = (option: ModalType) => {
    onSelectOption(option);
    if (option) {
      toggleMenu(); // Fecha o menu ao selecionar uma opção de modal
    }
  };

  return (
    <div className={`menu ${isOpen ? 'open' : ''}`}>
      <div className="menu-header">
        <h2>J.A.R.V.I.S. A.I.</h2>
        {/* O botão 'X' para fechar não é necessário aqui, pois o clique na opção fecha o menu */}
      </div>
      <ul className="menu-list">
        {/* Usando uma função anônima para garantir que a opção 'Ajuda' seja selecionada */}
        <li onClick={() => handleOptionClick('Ajuda')}>
          Ajuda
        </li>
        <li onClick={() => handleOptionClick('Configurações')}>
          Configurações
        </li>
        <li onClick={() => handleOptionClick('Perfil')}>
          Perfil
        </li>
      </ul>
      <div className="menu-footer">
        <p>V 1.0.0 - Acesso Autorizado!!</p>
      </div>
    </div>
  );
};

export default Menu;