import React from 'react';
import type { ModalType } from '../types/types';
import { FcCustomerSupport } from "react-icons/fc";
import { FcServices } from "react-icons/fc";
import { FcDecision } from "react-icons/fc";
import { FcCommandLine } from "react-icons/fc";

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
        <h2>J.A.R.V.I.S. I.A.</h2>
      </div>
      <ul className="menu-list">
        <li onClick={() => handleOptionClick('Ajuda')}>
          <FcDecision size={22} />Ajuda
        </li>
        <li onClick={() => handleOptionClick('Configurações')}>
          <FcServices size={22} />Configurações
        </li>
        <li onClick={() => handleOptionClick('Suporte')}>
          <FcCustomerSupport size={22} />Suporte
        </li>
        <li onClick={() => handleOptionClick('Desenvolvedor')}>
          <FcCommandLine size={22} />Desenvolvedor
        </li>
      </ul>
      <div className="menu-footer">
        <p>V 1.1.8 - Acesso Autorizado!!</p>
      </div>
    </div>
  );
};

export default Menu;