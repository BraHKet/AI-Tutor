import styles from './styles/SetPdf.module.css';
import { usePdf } from "../context/PdfContext";
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import useGoogleAuth from '../hooks/useGoogleAuth';

export default function SetPdf() {
  const navigate = useNavigate();
  const [pdfLocal, setPdfLocal] = useState();
  const { pdfFile, setPdfFile } = usePdf();
  
  useEffect(() => {
    setPdfFile(null);
    setPdfFile(null);
  }, []);

  const { user, logout } = useGoogleAuth();
  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };


  return (
  <div className={styles.container}>
    {/* Stelle animate */}
    <div className={styles.starryBackground}></div>

    {/* Header con logo e logout */}
    <header className={styles.header}>
      <img src="/logo192.png" alt="Logo" className={styles.logo} />
      <button onClick={handleLogout} className={styles.backButton}>
        Logout
      </button>
    </header>

    {/* Testo centrale */}
    <h2 className={styles.title}>Inserisci PDF</h2>
    <p className={styles.subtitle}>
      Carica un file PDF per iniziare la sessione di interrogazione.<br />
    </p>

    <div className={styles.uploadWrapper}>
      <input 
        type="file" 
        accept="application/pdf" 
        className={styles.fileInput}
        id="pdfUpload"
        onChange={(e) => {
          
          if (e.target.files && e.target.files[0]) {
            if (e.target.files[0].size < 5 * 1024 * 1024) {
            setPdfLocal(e.target.files[0]);
            }
            else {alert("Il file supera i 5MB, scegli un PDF più leggero.");}
          }
        }} 
      />
      <label htmlFor="pdfUpload" className={styles.uploadButton}>
        <span>Scegli PDF</span>
      </label>

      {pdfLocal && (
        <p className={styles.fileName}>
          <b>{pdfLocal.name}</b>
        </p>
      )}

      <button 
        className={styles.startButton}
        onClick={() => {
          if (!pdfFile && pdfLocal) {
            setPdfFile(pdfLocal);
            navigate("/exam");
          }
        }} 
        disabled={!pdfLocal}
      >
        Inizia l'esame
      </button>
    </div>

    <p className={styles.helperText}>
      Inserisci un pdf di poche pagine. Max 5 Mb.
    </p>
  </div>
);
}