import styles from './styles/SetPdf.module.css';
import { usePdf } from "../context/PdfContext";
import { useNavigate } from 'react-router-dom';
import Spline from '@splinetool/react-spline';

export default function SetPdf() {
  const navigate = useNavigate();
  const { setPdfFile } = usePdf();

  return (
    <div className={styles.pdfUploadContainer}>
      {/* Spline come background a schermo intero */}
      <div className={styles.splineBackground}>
        <Spline
          scene="https://prod.spline.design/1UrwWv5cFAz01IgO/scene.splinecode" 
        />
      </div>

      {/* Overlay per migliorare la leggibilità del testo */}
      <div className={styles.overlay}></div>

      {/* Contenuto centrato */}
      <div className={styles.content}>
        <h2 className={styles.title}>Upload Your PDF</h2>
        <p className={styles.subtitle}>Select a PDF file to start your interactive session</p>
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
            <span>Choose PDF</span>
          </label>
        </div>
      </div>
    </div>
  );
}