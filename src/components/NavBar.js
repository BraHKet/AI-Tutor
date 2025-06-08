import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, BookOpen, List } from 'lucide-react';
// 1. Importa gli stili come un oggetto 'styles'
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
    handleResize();
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const navItems = [
    { path: '/homepage', icon: <Home size={24} />, label: 'Home' },
    { path: '/create-project', icon: <BookOpen size={24} />, label: 'Crea Progetto' },
    { path: '/projects', icon: <List size={24} />, label: 'Riepilogo Progetti' },
  ];

  // 2. Applica le classi usando l'oggetto 'styles'
  return (
    <nav className={`${styles.navbar} ${isMobile ? styles.mobile : styles.desktop}`}>
      <div className={styles.navbarContainer}>
        {!isMobile && (
          <div className={styles.navbarLogo}>
            <h2>AI Tutor</h2>
          </div>
        )}
        
        <div className={styles.navbarLinks}>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => 
                `${styles.navItem} ${isActive ? styles.active : ''}`
              }
            >
              <div className={styles.navIcon}>{item.icon}</div>
              {!isMobile && <span className={styles.navLabel}>{item.label}</span>}
            </NavLink>
          ))}
        </div>
        
        {!isMobile && user && (
          <div className={styles.navbarFooter}>
            <div className={styles.userInfo}>
              <img 
                src={user.photoURL || 'https://via.placeholder.com/40'} 
                alt="User profile" 
                className={styles.userAvatar}
              />
              <div className={styles.userDetails}>
                <p className={styles.userName}>{user.displayName || 'User'}</p>
                <p className={styles.userEmail}>{user.email}</p>
              </div>
            </div>
            <button className={styles.logoutBtn} onClick={handleLogout}>
              Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};

export default NavBar;