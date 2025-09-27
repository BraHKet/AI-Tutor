// src/pages/LoginPage.jsx

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useGoogleAuth from '../hooks/useGoogleAuth';
import styles from './styles/LoginPage.module.css';
import { usePdf } from "../context/PdfContext";

// Icone semplici in formato SVG come componenti React per pulizia del codice
const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="#25bd1dff"/>
  </svg>
);

const XIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z" fill="#ff0000ff"/>
  </svg>
);

const LoginPage = () => {
  const { user, login } = useGoogleAuth();
  const navigate = useNavigate();

  const [pdfUploaded, setPdfUploaded] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const { pdfFile, setPdfFile } = usePdf();

  useEffect(() => {
    setPdfFile(null);
    if (user) {
      navigate('/exam');
    }
  }, [user, navigate]);
  
  const handleLogin = async () => {
    try {
      await login();
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const handleStart = () => {
  if (!pdfFile) {
    setShowPopup(true);
    return;
  }
  setPdfUploaded(true);
  handleLogin();
};


  return (
    <div className={styles.pageWrapper}>
      {/* ===== HEADER ===== */}
      <header className={styles.header}>
        <div className={styles.logoContainer}>
          {/* Assicurati che il percorso del logo sia corretto in 'public' folder */}
          <img src="/logo192.png" alt="Mentora Logo" className={styles.logo} />
          <span className={styles.logoName}>Mentora</span>
        </div>
        <nav className={styles.navLinks}>
          <a href="#features">Come Funziona</a>
          <a href="#faq">FAQ</a>
        </nav>
        <div className={styles.headerActions}>
          <button className={styles.signInButton} onClick={handleStart}>
            Interrogami
          </button>
        </div>
      </header>

      <main className={styles.mainContent}>
        {/* ===== HERO SECTION ===== */}
        <section className={styles.heroSection}>
          <h1 className={styles.headline}>
            Allenati per l'esame con <span className={styles.highlightText}>interrogazioni simulate</span>. Carica il PDF della lezione ed eleva il tuo studio.
          </h1>
          <p className={styles.subheadline}>
            Carica un documento e ottieni una simulazione d'esame in pochi minuti. Dire la lezione ai familiari è superato.
          </p>
          <div className={styles.ctaContainer}>
            <button 
  className={styles.primaryButton} 
  onClick={handleStart}
>
  Inizia l'interrogazione →
</button>
<div className={styles.fileUploadWrapper}>
  <label className={styles.fileUpload}>
    <input
      type="file"
      accept="application/pdf"
      onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            if (e.target.files[0].size < 5 * 1024 * 1024) {
            setPdfFile(e.target.files[0]);
            }
            else {alert("Il file supera i 5MB, scegli un PDF più leggero.");}
          }
      }}
    />
    Inserisci un PDF
  </label>

  {pdfFile && (
    <span className={styles.fileName}>
      {pdfFile.name
        .split(" ")
        .slice(0, 4)
        .join(" ")}
    </span>
  )}
</div>

          </div>
        </section>

        {/* ===== FEATURE SECTION 1 ===== */}
        <section id="features" className={styles.featureSection}>
          <div className={styles.featureContent}>

            <h2 className={styles.sectionTitle}>Carica la lezione. Ottieni un vantaggio competitivo sugli altri.</h2>
            <p className={styles.sectionDescription}>
              Da un singolo PDF, Mentora genera simulazioni orali per testare la tua preparazione in pochi minuti. Non sai se sei abbastanza preparato? Te lo dice Mentora.
            </p>
            <ul className={styles.featureList}>
              <li><CheckIcon /> Professore AI severo</li>
              <li><CheckIcon /> Possibilità di inserire immagini e formule</li>
              <li><CheckIcon /><span>Feedback istantaneo sulla preparazione</span></li>
            </ul>
          </div>
          <div className={styles.featureImageContainer}>
            {/* Sostituisci con un'immagine o animazione rappresentativa */}
            <img src="/logImage.png" alt="Generazione di un'interrogazione da un PDF" className={styles.featureImage} />
          </div>
        </section>  

        {/* ===== COMPARISON SECTION ===== */}
        <section className={styles.comparisonSection}>
            <h2 className={styles.sectionTitleCentered}>Mentora AI vs. Familiari e amici</h2>
            <p className={styles.sectionDescriptionCentered}>Risparmia tempo, massimizza i risultati e mantieni alta la concentrazione.</p>
            <div className={styles.comparisonGrid}>
                <div className={styles.comparisonCard}>
                    <h3 className={styles.cardTitle}>Mentora AI</h3>
                    <ul>
                        <li><CheckIcon /> Ti interroga come farebbe un professore sulla tua lezione.</li>
                        <li><CheckIcon /><span>E' <strong>onniscente</strong> e sà dove sbagli.</span></li>
                        <li><CheckIcon /> Ti dà un feedback immediato sulla tua esposizione.</li>
                        <li><CheckIcon /> Ti fa rimanere concentrato per tutto il corso dell'interrogazione.</li>
                    </ul>
                </div>
                <div className={`${styles.comparisonCard} ${styles.traditionalCard}`}>
    <h3 className={styles.cardTitle}>Familiari e amici</h3>
    <ul>
        <li><XIcon /><span>Spesso non sono severi come il tuo professore.</span></li>
        <li><XIcon /><span>Non conoscono l'argomento che stai esponendo e non sanno farti domande mirate.</span></li>
        <li><XIcon /><span>Non riescono a darti un feedback vero sulla tua esposizione.</span></li>
        <li><XIcon /><span>A causa di tutto ciò perdi interesse e voglia di esporre la lezione.</span></li>
    </ul>
</div>
            </div>
        </section>

        {/* ===== FAQ SECTION ===== */}
        <section id="faq" className={styles.faqSection}>
          <h2 className={styles.sectionTitleCentered}>Domande Frequenti</h2>
          <div className={styles.faqContainer}>
            <details className={styles.faqItem}>
              <summary>Posso inserire qualsiasi tipo di PDF?</summary>
              <p>E' consigliabile NON inserire PDF con un numero di pagine troppo elevato per far si che i tempi di analisi da parte dell'AI engine rimangano relativamente contenuti.</p>
            </details>
            <details className={styles.faqItem}>
              <summary>Posso essere interrogato su dimostrazioni?</summary>
              <p>Assolutamente. Il servizio è stato pensato soprattutto per questo, basterà disegnare le formule nell'apposito riquadro di disegno e il professore le confronterà con quelle nel tuo PDF.</p>
            </details>
          </div>
        </section>
      </main>

      {/* ===== FOOTER ===== */}
      <footer className={styles.footer}>
        <div className={styles.footerContainer}>
            <div className={styles.footerBrand}>
                <div className={styles.logoContainer}>
                  <img src="/logo192.png" alt="Mentora Logo" className={styles.logo} />
                </div>
                <p>Mentora AI trasforma qualsiasi documento di studio in un'esperienza di apprendimento interattiva che ti fa distinguere. Niente studio passivo, solo grandi risultati.</p>
            </div>
            <div className={styles.footerLinks}>
                <div className={styles.linkColumn}>
                    <h4>Servizi</h4>
                    <a href="#" target="_blank" rel="noopener noreferrer">Galleria</a>
                    <a href="#" target="_blank" rel="noopener noreferrer">Prezzi</a>
                </div>
                <div className={styles.linkColumn}>
                    <h4>Casi d'uso</h4>
                    <a href="#" target="_blank" rel="noopener noreferrer">Studenti Universitari</a>
                    <a href="#" target="_blank" rel="noopener noreferrer">Scuole Superiori</a>
                    <a href="#" target="_blank" rel="noopener noreferrer">Concorsi Pubblici</a>
                </div>
                 <div className={styles.linkColumn}>
                    <h4>Contatti</h4>
                    <p>lore.mail.gl@gmail.com</p>
                    <p>Italia</p>
                </div>
            </div>
        </div>
        <div className={styles.footerBottom}>
            <p>© 2025 Mentora. Tutti i diritti riservati.</p>
            <div>
                <a href="https://mentora-lp.vercel.app/policy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
                <a href="https://mentora-lp.vercel.app/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a>
            </div>
        </div>
      </footer>

      {showPopup && (
  <div className={styles.popupOverlay}>
    <div className={styles.popup}>
      <h3>Nessun PDF selezionato</h3>
      <p>Per iniziare l'interrogazione devi prima caricare un file PDF.</p>
      <button 
        className={styles.popupButton} 
        onClick={() => setShowPopup(false)}
      >
        Ok, ho capito
      </button>
    </div>
  </div>
)}
    </div>
  );
};

export default LoginPage;