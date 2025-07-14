// src/components/NavBar.js - VERSIONE RIVISITATA E MIGLIORATA

import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, PlusSquare, List, LogOut } from 'lucide-react';
import styles from './styles/NavBar.module.css';
import useGoogleAuth from '../hooks/useGoogleAuth';

const NavBar = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const navigate = useNavigate();
  const { user, logout } = useGoogleAuth();

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    handleResize(); // Esegui subito per impostare lo stato iniziale
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);


  const navItems = [
    { path: '/homepage', icon: <Home size={22} />, label: 'Home' },
    { path: '/create-project', icon: <PlusSquare size={22} />, label: 'Crea Piano' },
    { path: '/projects', icon: <List size={22} />, label: 'I Miei Piani' },
  ];

  return (
    <div className={styles.wrapper}>
    <nav className={`${styles.navbar} ${isMobile ? styles.mobile : styles.desktop}`}>
      <div className={styles.navbarContainer}>
        
        {/* Logo visibile solo su desktop */}
        {!isMobile && (
          <div className={styles.navbarLogo}>
            AI Tutor
          </div>
        )}
        
        {/* Link di navigazione */}
        <div className={styles.navbarLinks}>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => 
                `${styles.navItem} ${isActive ? styles.active : ''}`
              }
              title={item.label} // Aggiunge un tooltip nativo
            >
              <div className={styles.navIcon}>{item.icon}</div>
              <span className={styles.navLabel}>{item.label}</span>
            </NavLink>
          ))}
        </div>

      </div>
    </nav>
    </div>
  );
};

export default NavBar;