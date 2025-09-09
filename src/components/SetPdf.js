import styles from './styles/SetPdf.module.css';
import { usePdf } from "../context/PdfContext";
import { useNavigate } from 'react-router-dom';

export default function SetPdf() {
  const navigate = useNavigate();
  const { setPdfFile } = usePdf();

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setPdfFile(e.target.files[0]);
      navigate("/exam");
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.mainTitle}>Benvenuto nell'Area Esami Intelligenti!</h1>
        <p className={styles.description}>
          Prepara la tua mente per un'esperienza di apprendimento rivoluzionaria.
          Carica il tuo documento PDF e lascia che la nostra intelligenza artificiale ti guidi
          attraverso un percorso di studio interattivo e personalizzato.
        </p>
        <p className={styles.subDescription}>
          Dimentica le lunghe ore passate a memorizzare: la nostra AI genererà
          domande mirate basate sul contenuto del tuo PDF, aiutandoti a fissare
          i concetti chiave in modo efficace e divertente.
        </p>

        <div className={styles.pdfUploadBox}>
          <h2 className={styles.uploadTitle}>
            <span className={styles.icon}>📄</span>
            Carica il PDF da cui farti interrogare!
          </h2>
          <label htmlFor="pdf-upload" className={styles.customFileUpload}>
            Scegli il tuo file PDF
          </label>
          <input 
            id="pdf-upload"
            type="file" 
            accept="application/pdf" 
            onChange={handleFileChange} 
            className={styles.fileInput}
          />
        </div>

        <p className={styles.footerText}>
          Pronto a trasformare il tuo modo di studiare? Inizia ora!
        </p>
      </div>
      <div className={styles.animatedBackground}></div> {/* Elemento per lo sfondo animato */}
    </div>
  );
}