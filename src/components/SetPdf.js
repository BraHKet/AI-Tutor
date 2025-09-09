import styles from './styles/SetPdf.module.css';
import { usePdf } from "../context/PdfContext";
import { useNavigate } from 'react-router-dom';

export default function SetPdf() {

  const navigate = useNavigate();
  const { setPdfFile } = usePdf();


    return (
    <div className={styles.pdfUploadContainer}>
      <h2>📄 Carica il PDF da cui farti interrogare!</h2>
      <input 
        type="file" 
        accept="application/pdf" 
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            setPdfFile(e.target.files[0]);
            navigate("/exam");
          }
        }} 
      />
    </div>
  );
}
  