import styles from './styles/SetPdf.module.css';
import { usePdf } from "../context/PdfContext";
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

export default function SetPdf() {
  const navigate = useNavigate();
  const { pdfLocal, setPdfLocal } = useState();
  const { pdfFile, setPdfFile } = usePdf();
  
  useEffect(() => {
    setPdfFile(null);
    pdfLocal(null);
  }, []);

  

  return (
    <div className={styles.container}>
      {/* Stelle animate <div className={styles.starryBackground}></div>*/}
      

      {/* Header con logo */}
      <header className={styles.header}>
        <img src="/logo192.png" alt="Logo" className={styles.logo} />
      </header>

      {/* Box centrale */}
      <div className={styles.contentBox}>
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
                setPdfLocal(e.target.files[0]);
              }
            }} 
          />
          <label htmlFor="pdfUpload" className={styles.uploadButton}>
            <span>Scegli PDF</span>
          </label>
          <button onClick={() => {if(!pdfFile && pdfLocal) {setPdfFile(pdfLocal); navigate("/exam");}}} />
        </div>
        <p className={styles.helperText}>
          Formati supportati: <b>.pdf</b> – Dimensione max: <b>--</b>
        </p>
      </div>
    </div>
  );
}
