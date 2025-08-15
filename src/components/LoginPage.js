// src/pages/LoginPage.jsx (Versione "Centrato" Style)

import React, { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useGoogleAuth from '../hooks/useGoogleAuth';
import { useVideoTutorial } from './context/VideoTutorialContext'; 
import styles from './styles/LoginPage.module.css';

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
    <div className={styles.loginContainer}>
      {/* Contenuto principale centrato */}
      <main className={styles.mainContent}>
        
        {/* Usa il tuo logo dalla cartella /public */}
        <img src="/logo192.png" alt="AI Tutor Logo" className={styles.logo} />

        <h1 className={styles.headline}>
          Mentora <br /> il tuo professore AI personale.
        </h1>
        
        <p className={styles.subheadline}>
          Benvenuto! Inizia il tuo percorso di apprendimento personalizzato.
        </p>
        
        {/* Sezione con i pulsanti di azione */}
        <div className={styles.actionButtons}>
          <button className={styles.googleLoginBtn} onClick={handleLogin}>
            Continua con Google
          </button>
          
          <button className={styles.tutorialLinkBtn} onClick={showVideo}>
            Guarda il Tutorial
          </button>
        </div>

      </main>

      {/* Footer con i link legali */}
      <footer className={styles.loginFooter}>
        <Link to="https://mentora-lp.vercel.app/terms" target="_blank" rel="noopener noreferrer">
          Termini di Servizio
        </Link>
        <span>&nbsp;•&nbsp;</span>
        <Link to="https://mentora-lp.vercel.app/policy" target="_blank" rel="noopener noreferrer">
          Informativa sulla Privacy
        </Link>
      </footer>
    </div>
  );
};

export default LoginPage;