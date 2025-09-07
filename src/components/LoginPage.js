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
  const { pdfFile } = usePdf();

  useEffect(() => {
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
            Interrogazioni istantanee <span className={styles.highlightText}>dal tuo PDF</span> con un singolo upload.
          </h1>
          <p className={styles.subheadline}>
            Carica un documento, scegli gli argomenti e ottieni una simulazione d'esame in pochi minuti. Niente studio passivo, niente perdite di tempo.
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
          pdfFile(e.target.files[0]);
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

            <h2 className={styles.sectionTitle}>Carica una volta. Preparati con un'intera sessione d'esame.</h2>
            <p className={styles.sectionDescription}>
              Da un singolo PDF, Mentora genera domande mirate, quiz a risposta multipla e simulazioni orali per testare la tua preparazione in pochi minuti.
            </p>
            <ul className={styles.featureList}>
              <li><CheckIcon /> Domande generate su capitoli specifici.</li>
              <li><CheckIcon /> Adattamento dello stile e della difficoltà.</li>
              <li><CheckIcon /><span>Memorizzazione dei tuoi progressi e aree di debolezza.</span></li>
            </ul>
          </div>
          <div className={styles.featureImageContainer}>
            {/* Sostituisci con un'immagine o animazione rappresentativa */}
            <img src="https://i.imgur.com/uGIVgq1.png" alt="Generazione di un'interrogazione da un PDF" className={styles.featureImage} />
          </div>
        </section>

        {/* ===== COMPARISON SECTION ===== */}
        <section className={styles.comparisonSection}>
            <h2 className={styles.sectionTitleCentered}>Mentora AI vs. Studio Tradizionale</h2>
            <p className={styles.sectionDescriptionCentered}>Risparmia tempo, massimizza i risultati e mantieni alta la concentrazione.</p>
            <div className={styles.comparisonGrid}>
                <div className={styles.comparisonCard}>
                    <h3 className={styles.cardTitle}>Mentora AI</h3>
                    <ul>
                        <li><CheckIcon /> Genera centinaia di domande da un singolo PDF.</li>
                        <li><CheckIcon /><span>Dall'idea all'interrogazione in <strong>minuti</strong>, non ore.</span></li>
                        <li><CheckIcon /> Focus preciso sugli argomenti chiave e le tue lacune.</li>
                        <li><CheckIcon /> Test di apprendimento attivo su qualsiasi modello di studio.</li>
                    </ul>
                </div>
                <div className={`${styles.comparisonCard} ${styles.traditionalCard}`}>
    <h3 className={styles.cardTitle}>Studio Tradizionale</h3>
    <ul>
        <li><XIcon /><span>Lettura passiva, logistica, evidenziatori: ore e a volte giorni.</span></li>
        <li><XIcon /><span>Costi per-ripetizioni: lezioni + ripasso + esercitazioni.</span></li>
        <li><XIcon /><span>Piccoli dubbi richiedono nuove ricerche e portano a distrazioni.</span></li>
        <li><XIcon /><span>Volume di test limitato, poche simulazioni reali.</span></li>
    </ul>
</div>
            </div>
        </section>

        {/* ===== FAQ SECTION ===== */}
        <section id="faq" className={styles.faqSection}>
          <h2 className={styles.sectionTitleCentered}>Domande Frequenti</h2>
          <div className={styles.faqContainer}>
            <details className={styles.faqItem}>
              <summary>Cosa posso creare con Mentora AI?</summary>
              <p>Con un singolo PDF, puoi generare interrogazioni professionali, quiz, test a risposta multipla e simulazioni di esami orali. La nostra AI gestisce l'analisi del testo, la creazione di domande pertinenti e l'adattamento della difficoltà, preservando gli elementi chiave del tuo materiale di studio.</p>
            </details>
            <details className={styles.faqItem}>
              <summary>Mentora AI preserverà i dettagli e i concetti chiave del mio PDF?</summary>
              <p>Assolutamente. L'algoritmo è progettato per identificare e dare priorità ai concetti fondamentali, alle definizioni e ai dati cruciali presenti nel tuo documento, garantendo che le domande siano sempre pertinenti e focalizzate sugli aspetti più importanti del tuo studio.</p>
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