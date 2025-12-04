// src/components/Menu.tsx

import React from 'react';
import type { ModalType } from '../types/types';


interface MenuProps {
  isOpen: boolean;
  toggleMenu: () => void;
  onSelectOption: (option: ModalType) => void;
  toggle3DModel: () => void; 
  onClearChat: () => void;
}

const Menu: React.FC<MenuProps> = ({ isOpen,  onSelectOption }) => {

  const handleOptionClick = (option: ModalType) => {
    onSelectOption(option);
  };

  return (
    <div className={`menu ${isOpen ? 'open' : ''}`}>
      <div className="menu-header">
        <h2>J.A.R.V.I.S. A.I.</h2>
      </div>
      <ul className="menu-list">
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
        <p>V 1.1.1 - Acesso Autorizado!!</p>
      </div>
    </div>
  );
};

export default Menu;