import styles from './styles/SetPdf.module.css';
import { usePdf } from "../context/PdfContext";
import { useNavigate } from 'react-router-dom';
import logo from "../assets/logo.png"; // importa il logo che hai caricato

export default function SetPdf() {
  const navigate = useNavigate();
  const { setPdfFile } = usePdf();

  return (
    <div className={styles.container}>
      {/* Animazione stelle */}
      <div className={styles.stars}></div>
      <div className={styles.stars2}></div>
      <div className={styles.stars3}></div>

      {/* Header con logo */}
      <header className={styles.header}>
        <img src="/logo192.png" alt="Logo" className={styles.logo} />
      </header>

      {/* Box centrale */}
      <div className={styles.contentBox}>
        <h2 className={styles.title}>Inserisci PDF</h2>
        <div className={styles.uploadWrapper}>
          <input 
            type="file" 
            accept="application/pdf" 
            className={styles.fileInput}
            id="pdfUpload"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                setPdfFile(e.target.files[0]);
                navigate("/exam");
              }
            }} 
          />
          <label htmlFor="pdfUpload" className={styles.uploadButton}>
            <span>Scegli PDF</span>
          </label>
        </div>
      </div>
    </div>
  );
}
