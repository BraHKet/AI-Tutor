// src/components/CreateProject.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
// Rimuovi import createProject, useremo l'orchestratore
import useGoogleAuth from '../hooks/useGoogleAuth';
import { googleDriveService } from '../utils/googleDriveService';
// Importa l'orchestratore
import { createAndGeneratePlan } from '../utils/studyPlanOrchestrator';
import { FilePlus, Upload, X, Calendar, BookOpen, Info, AlertCircle, Loader, BrainCircuit } from 'lucide-react'; // Aggiunta icona AI
import NavBar from './NavBar';
import './styles/CreateProject.css'; // Assicurati che questo stile esista
import { genAI, model } from '../utils/gemini';

// Importa uuid se non l'hai già fatto in orchestrator (ma è meglio lì)
// import { v4 as uuidv4 } from 'uuid';

const CreateProject = () => {
  const navigate = useNavigate();
  const { user } = useGoogleAuth();
  const [serviceStatus, setServiceStatus] = useState({
    ready: false,
    initializing: false,
    error: null
  });

  const [formData, setFormData] = useState({
    title: '',
    examName: '',
    totalDays: 7,
    description: ''
  });

  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false); // Indica il caricamento generale del processo
  const [loadingMessage, setLoadingMessage] = useState(''); // Messaggio specifico della fase di caricamento
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(''); // Messaggio di successo finale
  const [uploadProgress, setUploadProgress] = useState({}); // { [fileName]: percentage }

  // --- Inizializzazione Google Drive Service (Invariato) ---
  useEffect(() => {
    console.log('CreateProject: MOUNTED');
    let isMounted = true; // Flag per evitare setState su componente smontato

    const initService = async () => {
      console.log('CreateProject: useEffect - initializing Google Drive service');
      setServiceStatus({ ready: false, initializing: true, error: null });
      setLoadingMessage('Inizializzazione servizio Google Drive...'); // Messaggio iniziale
      try {
        await googleDriveService.initialize();
        if (isMounted) {
          console.log('CreateProject: Service initialized successfully');
          setServiceStatus({ ready: true, initializing: false, error: null });
          setLoadingMessage(''); // Pulisci messaggio se l'init è veloce
        }
      } catch (err) {
        if (isMounted) {
          console.error('CreateProject: Error initializing Google Drive service', err);
          setServiceStatus({ ready: false, initializing: false, error: err.message });
          setError('Errore inizializzazione Google Drive: ' + err.message);
          setLoadingMessage('');
        }
      }
    };

    initService();

    return () => {
      console.log('CreateProject: UNMOUNTED');
      isMounted = false;
    };
  }, []);

  // --- Funzioni Retry e Init (Leggermente modificate per usare initServiceRetry) ---
   const initServiceRetry = async () => { // Rinomina per chiarezza rispetto a quella in useEffect
    setError('');
    setSuccess('');
    setServiceStatus({ ready: false, initializing: true, error: null });
    setLoadingMessage('Ritentativo inizializzazione Google Drive...');
    try {
      await googleDriveService.initialize();
      setServiceStatus({ ready: true, initializing: false, error: null });
      setLoadingMessage('');
      setSuccess('Servizio Google Drive inizializzato con successo!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('CreateProject: Error retrying Google Drive service init', err);
      setServiceStatus({ ready: false, initializing: false, error: err.message });
      setError('Errore inizializzazione Google Drive: ' + err.message);
       setLoadingMessage('');
    }
  };

  const retryInitialization = () => {
      initServiceRetry();
  };


  // --- Gestori Form e File (Invariati) ---
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: name === 'totalDays' ? parseInt(value, 10) : value // Aggiungi radix 10 a parseInt
    });
  };

  const handleFileChange = (e) => {
    const newFiles = Array.from(e.target.files);
    if (newFiles.length === 0) return;

    const validFiles = [];
    const errors = [];
    const MAX_FILE_SIZE_MB = googleDriveService.MAX_FILE_SIZE_MB || 50;

    newFiles.forEach(file => {
      if (file.type !== 'application/pdf') {
        errors.push(`${file.name} non è un PDF.`);
      } else if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        errors.push(`${file.name} supera ${MAX_FILE_SIZE_MB}MB.`);
      } else {
        validFiles.push(file);
      }
    });

    if (errors.length > 0) {
      setError(errors.join(' '));
    } else {
      setError('');
    }

    setFiles(prevFiles => [...prevFiles, ...validFiles]);
  };

  const removeFile = (indexToRemove) => {
    setFiles(files.filter((_, index) => index !== indexToRemove));
  };

  // --- handleSubmit Riscritto per usare l'Orchestratore ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('CreateProject: Form submitted');

    // Reset stati
    setError('');
    setSuccess('');
    setLoading(true);
    setLoadingMessage('Verifica dati...'); // Stato iniziale
    setUploadProgress({});

    // Validazioni base
    if (!user) {
      setError('Utente non autenticato.');
      setLoading(false);
      return;
    }
    if (!formData.title || !formData.examName || !formData.totalDays || formData.totalDays < 1) {
      setError('Per favore completa tutti i campi obbligatori (Titolo, Esame, Giorni > 0).');
      setLoading(false);
      return;
    }
    if (files.length === 0) {
      setError('Carica almeno un file PDF per continuare.');
      setLoading(false);
      return;
    }
    if (!serviceStatus.ready) {
      setError('Il servizio Google Drive non è pronto. Riprova l\'inizializzazione.');
      setLoading(false);
      return;
    }
     if (!genAI || !model) { // Controlla se Gemini è inizializzato
       setError('Il servizio AI Gemini non è inizializzato correttamente. Controlla la console per errori.');
       setLoading(false);
       return;
     }

    console.log('CreateProject: Starting orchestration...');

    try {
      // Definisci la callback per gli aggiornamenti di stato
      const progressCallback = (update) => {
        console.log("Orchestrator Update:", update); // Log per debug
        if (update.type === 'upload') {
          setUploadProgress(prev => ({ ...prev, [update.fileName]: update.percent }));
          // Non sovrascrivere il messaggio generale con ogni update di %
          // setLoadingMessage(`Caricamento ${update.fileName}: ${Math.round(update.percent)}%`);
        } else if (update.type === 'processing') {
          setLoadingMessage(update.message); // Mostra il messaggio della fase corrente
        } else if (update.type === 'error') {
          // L'errore verrà gestito nel blocco catch principale
          console.error("Progress Callback Error:", update.message);
        }
      };

      // Chiama l'orchestratore
      const projectId = await createAndGeneratePlan(
        formData,
        files,
        user.uid,
        progressCallback
      );

      // Successo
      console.log('CreateProject: Plan created successfully! Project ID:', projectId);
      setLoadingMessage(''); // Pulisci messaggio loading
      setSuccess('Piano di studio creato con successo! Reindirizzamento...');

      // Reindirizza alla nuova pagina del piano
      setTimeout(() => {
        if (projectId) {
          navigate(`/projects/${projectId}/plan`); // Usa l'ID restituito
        } else {
           console.error("CreateProject: Project ID not received after successful creation?");
           navigate('/projects'); // Fallback alla lista progetti
        }
      }, 1500);

    } catch (error) {
      console.error('CreateProject: Error during plan creation orchestration:', error);
      setError(error.message || 'Si è verificato un errore imprevisto durante la creazione del piano.');
      setSuccess('');
       setLoadingMessage(''); // Pulisci messaggio loading in caso di errore
    } finally {
      setLoading(false); // Disattiva lo stato di caricamento generale
      // uploadProgress viene resettato all'inizio del submit, non serve qui
    }
  };

  // --- JSX (con aggiunte per loading message e disabilitazione) ---
  return (
    <>
      <NavBar />
      <div className="create-project-wrapper">
        <div className="create-project-container">
          <div className="create-project-header">
            <h1 className="page-title">Crea Nuovo Piano di Studio (AI)</h1>
            <p className="page-subtitle">Inserisci i dettagli, carica i PDF e lascia che l'AI generi il piano!</p>
          </div>

          {/* --- Messaggi di Stato --- */}
          {error && (
            <div className="message error-message">
              <AlertCircle size={20} />
              <span>{error}</span>
              {error.includes('Google Drive') && !serviceStatus.initializing && ( // Mostra Riprova solo se non sta inizializzando
                <button
                  onClick={retryInitialization}
                  className="retry-button"
                  disabled={serviceStatus.initializing}
                >
                  Riprova Init Drive
                </button>
              )}
            </div>
          )}

          {success && !loading && ( // Mostra successo solo se non è in loading
            <div className="message success-message">
              <Info size={20} />
              <span>{success}</span>
            </div>
          )}

          {/* Mostra inizializzazione Drive O il loading del processo di creazione */}
          {(serviceStatus.initializing || loading) && (
            <div className="message info-message">
              <Loader size={20} className="spin-icon" />
              <span>{loadingMessage || 'Attendere...'}</span>
            </div>
          )}

          {/* --- Form --- */}
          {/* Disabilita l'intero form se il servizio sta inizializzando o il piano è in creazione */}
          <form className="create-project-form" onSubmit={handleSubmit}>
            <fieldset disabled={serviceStatus.initializing || loading} style={{ border: 'none', padding: 0, margin: 0 }}>
              <div className="form-grid">
                {/* Sezione Info Base (invariata nel JSX, ma ora dentro fieldset) */}
                 <div className="form-section">
                    <h2 className="section-title">Informazioni Base</h2>
                    <div className="form-group">
                        <label htmlFor="title"><span className="label-text">Titolo del Progetto</span><span className="required-mark">*</span></label>
                        <div className="input-wrapper"><BookOpen size={20} className="input-icon" /><input type="text" id="title" name="title" value={formData.title} onChange={handleChange} placeholder="Es. Preparazione Esame di Statistica" required /></div>
                    </div>
                    <div className="form-group">
                        <label htmlFor="examName"><span className="label-text">Nome dell'Esame</span><span className="required-mark">*</span></label>
                        <div className="input-wrapper"><BookOpen size={20} className="input-icon" /><input type="text" id="examName" name="examName" value={formData.examName} onChange={handleChange} placeholder="Es. Statistica Descrittiva" required /></div>
                    </div>
                     <div className="form-group">
                         <label htmlFor="totalDays"><span className="label-text">Giorni per la Preparazione</span><span className="required-mark">*</span></label>
                         <div className="input-wrapper"><Calendar size={20} className="input-icon" /><input type="number" id="totalDays" name="totalDays" value={formData.totalDays} onChange={handleChange} min="1" max="90" required /></div>
                         <p className="field-hint">Numero di giorni (1-90) per distribuire lo studio.</p>
                     </div>
                    <div className="form-group">
                        <label htmlFor="description"><span className="label-text">Descrizione</span><span className="optional-mark">(Opzionale)</span></label>
                        <div className="textarea-wrapper"><textarea id="description" name="description" value={formData.description} onChange={handleChange} placeholder="Note per l'AI: es. concentrati di più su X, Y è meno importante..." rows="3" /></div>
                         <p className="field-hint">Aggiungi note o priorità per l'AI (opzionale).</p>
                    </div>
                 </div>

                {/* Sezione Materiale Studio (con progress bar per file) */}
                <div className="form-section">
                  <h2 className="section-title">Materiale di Studio</h2>
                  <div className="form-group">
                    <label><span className="label-text">File PDF da studiare</span><span className="required-mark">*</span></label>
                    <div className="file-upload-area">
                      <div className="file-upload-container">
                        <label className="file-upload-btn" htmlFor="fileInput">
                          <Upload size={20} /><span>Carica PDF</span>
                        </label>
                        <input type="file" id="fileInput" onChange={handleFileChange} multiple accept=".pdf" className="hidden-file-input" />
                      </div>
                      <p className="file-upload-info">Carica libri, dispense, appunti in PDF.<br /><small className="file-size-limit">Max {googleDriveService.MAX_FILE_SIZE_MB || 50}MB per file.</small></p>
                    </div>

                    {files.length > 0 && (
                      <div className="file-list">
                        <h3>File selezionati ({files.length}):</h3>
                        <ul>
                          {files.map((file, index) => (
                            <li key={index} className="file-item">
                              <FilePlus size={16} className="file-icon" />
                              <span className="file-name">{file.name}</span>
                              <span className="file-size">{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                              {/* Mostra barra di progresso upload */}
                              {uploadProgress[file.name] !== undefined && (
                                <div className="upload-progress-bar-container">
                                   <div className="upload-progress-bar" style={{ width: `${Math.round(uploadProgress[file.name])}%` }}></div>
                                   <span className="upload-progress-text">{Math.round(uploadProgress[file.name])}%</span>
                                </div>
                              )}
                              <button type="button" className="remove-file-btn" onClick={() => removeFile(index)} >
                                <X size={16} />
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {files.length === 0 && (<div className="no-files-message">Nessun file PDF selezionato.</div>)}
                  </div>
                </div>
              </div>

              {/* --- Azioni Form --- */}
              <div className="form-actions">
                <button type="button" className="cancel-btn" onClick={() => navigate('/projects')} >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="submit-btn"
                  // Disabilita se servizio non pronto O mancano file O sta caricando
                  disabled={!serviceStatus.ready || files.length === 0 || loading || serviceStatus.initializing}
                >
                  {loading ? (
                     <> <Loader size={16} className="spin-icon" /> Elaborazione AI... </>
                  ) : (
                     <> <BrainCircuit size={16} style={{marginRight:'5px'}}/> Genera Piano con AI </>
                  )}
                </button>
              </div>
            </fieldset> {/* Fine fieldset disabilitato */}
          </form>
        </div>
      </div>
    </>
  );
};

export default CreateProject;