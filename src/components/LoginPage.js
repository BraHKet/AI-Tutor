// src/pages/LoginPage.jsx (Versione Finale con Layout Mobile)

import React, { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useGoogleAuth from '../hooks/useGoogleAuth';
import { useVideoTutorial } from './context/VideoTutorialContext';
import styles from './styles/LoginPage.module.css';
import Spline from '@splinetool/react-spline';
import { createGlobalStyle } from "styled-components";

// Definisci i CSS globali che si attivano solo quando il componente è montato
const MyGlobalStyle = createGlobalStyle`
  
`;


const avatars = [
  'https://randomuser.me/api/portraits/women/68.jpg',
  'https://randomuser.me/api/portraits/men/32.jpg',
  'https://randomuser.me/api/portraits/women/44.jpg',
  'https://randomuser.me/api/portraits/men/86.jpg',
  'https://randomuser.me/api/portraits/women/26.jpg',
];

const LoginPage = () => {
  const { user, login } = useGoogleAuth();
  const { showVideo } = useVideoTutorial();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/homepage');
    }
  }, [user, navigate]);
  
  const handleLogin = async () => {
    try {
      await login();
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  return (
    <>
    <MyGlobalStyle />
    <div className={styles.pageWrapper}>
      <Spline 
        className={styles.splineBackground} 
        scene="https://prod.spline.design/Hj1yrtSb5VpzPWZe/scene.splinecode" 
      />
      
      <header className={styles.header}>
        <div className={styles.logoContainer}>
          <img src="/logo192.png" alt="Mentora Logo" className={styles.logo} />
          <span className={styles.logoName}>Mentora</span>
        </div>
        {/* Questi link saranno visibili solo su desktop */}
        <nav className={styles.navLinks}>
          <Link to="https://mentora-lp.vercel.app/terms" target="_blank" rel="noopener noreferrer">Termini di Servizio</Link>
          <Link to="https://mentora-lp.vercel.app/policy" target="_blank" rel="noopener noreferrer">Privacy</Link>
        </nav>
      </header>

      <main className={styles.mainContent}>
        <h1 className={styles.headline}>
          Mentora<br />il tuo professore AI personale.
        </h1>
        
        <p className={styles.subheadline}>
          Benvenuto! Inizia il tuo percorso di apprendimento personalizzato.
        </p>
        
        <div className={styles.ctaSection}>
          <button className={styles.primaryButton} onClick={handleLogin}>
            Continua con Google
          </button>
          
          <div className={styles.socialProof}>
            <div className={styles.avatarGroup}>
              {avatars.map((src, index) => (
                <img key={index} src={src} alt={`User ${index + 1}`} className={styles.avatar} />
              ))}
            </div>
            <span className={styles.joinText}><strong>0</strong> Joined already</span>
          </div>
        </div>

        <button className={styles.secondaryButton} onClick={showVideo}>
          Guarda il Tutorial
        </button>
      </main>

      
    </div>
    </>
  );
};

export default LoginPage;