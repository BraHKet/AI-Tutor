// src/components/CreateProject.jsx - VERSIONE CON SWITCH MODALITÀ ANALISI
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useGoogleAuth from '../hooks/useGoogleAuth';
import { generateCompleteStudyPlanLocal } from '../utils/gemini';
import { FilePlus, Upload, X, Calendar, BookOpen, Info, AlertCircle, Loader, BrainCircuit, FileText, Zap, Clock } from 'lucide-react';
import NavBar from './NavBar';
import './styles/CreateProject.css';

const CreateProject = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useGoogleAuth();
  
  const [formData, setFormData] = useState({ title: '', examName: '', totalDays: 7, description: '' });
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // NUOVO: Modalità di analisi
  const [analysisMode, setAnalysisMode] = useState('pdf'); // 'pdf' o 'text'
  
  const isMounted = useRef(true);

  const resetAllState = useCallback(() => {
    if (!isMounted.current) return;
    
    console.log('CreateProject: Resetting all state to initial values');
    setFormData({ title: '', examName: '', totalDays: 7, description: '' });
    setFiles([]);
    setLoading(false);
    setLoadingMessage('');
    setError('');
    setSuccess('');
    setAnalysisMode('pdf');
  }, []);

  useEffect(() => {
    console.log('CreateProject: Component mounted');
    isMounted.current = true;
    resetAllState();
    
    return () => {
      console.log('CreateProject: Component unmounted');
      isMounted.current = false;
    };
  }, [resetAllState]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: name === 'totalDays' ? parseInt(value, 10) || 1 : value
    });
  };

  const handleFileChange = (e) => {
    const newFiles = Array.from(e.target.files);
    if (newFiles.length === 0) return;

    const validFiles = [];
    const errors = [];
    const MAX_FILE_SIZE_MB = analysisMode === 'pdf' ? 50 : 100; // Più permissivo per modalità testo

    newFiles.forEach(file => {
      if (file.type !== 'application/pdf') {
        errors.push(`${file.name} non è un PDF.`);
      } else if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        errors.push(`${file.name} supera ${MAX_FILE_SIZE_MB}MB.`);
      } else {
        if (!files.some(existingFile => existingFile.name === file.name) && !validFiles.some(newValidFile => newValidFile.name === file.name)) {
          validFiles.push(file);
        } else {
          errors.push(`File "${file.name}" già presente o selezionato.`);
        }
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

  const progressCallback = useCallback((update) => {
    console.log("Progress Update:", update);
    if (update.type === 'processing') {
      setLoadingMessage(update.message);
    } else if (update.type === 'error') {
      console.error("Progress Callback Error:", update.message);
    } else if (update.type === 'warning') {
      console.warn("Progress Callback Warning:", update.message);
    }
  }, []);

  // NUOVO: Calcolo stime tempi
  const getTimeEstimate = () => {
    if (files.length === 0) return { min: 0, max: 0 };
    
    const totalSizeMB = files.reduce((sum, file) => sum + (file.size / (1024 * 1024)), 0);
    const fileCount = files.length;
    
    if (analysisMode === 'text') {
      // Modalità testo: più veloce, dipende dalle pagine
      const estimatedPages = Math.ceil(totalSizeMB * 20); // ~20 pagine per MB
      const timePerPage = 0.5; // 0.5 secondi per pagina per estrazione testo
      const baseTime = 15; // 15 secondi base per analisi AI
      const total = Math.ceil((estimatedPages * timePerPage + baseTime) / fileCount);
      return {
        min: Math.max(20, total * 0.8),
        max: Math.max(45, total * 1.5)
      };
    } else {
      // Modalità PDF: più lenta, dipende dalla dimensione
      const timePerMB = 8; // 8 secondi per MB per conversione base64
      const baseTime = 30; // 30 secondi base per analisi AI
      const total = Math.ceil(totalSizeMB * timePerMB + baseTime);
      return {
        min: Math.max(45, total * 0.9),
        max: Math.max(120, total * 1.3)
      };
    }
  };

  const timeEstimate = getTimeEstimate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log(`CreateProject: Form submitted for LOCAL ANALYSIS (${analysisMode.toUpperCase()} mode)`);

    setError(''); 
    setSuccess(''); 
    setLoading(true); 
    setLoadingMessage('Verifica dati...');

    if (!user) { 
      setError('Utente non autenticato.'); 
      setLoading(false); 
      return; 
    }
    if (!formData.title || !formData.examName || !formData.totalDays || formData.totalDays < 1) { 
      setError('Completa Titolo, Esame, Giorni (> 0).'); 
      setLoading(false); 
      return; 
    }
    if (files.length === 0) { 
      setError('Carica almeno un PDF.'); 
      setLoading(false); 
      return; 
    }

    try {
      // ANALISI AI LOCALE con modalità selezionata
      setLoadingMessage(`Analisi AI dei PDF (modalità ${analysisMode === 'pdf' ? 'completa' : 'testo'})...`);
      
      const planData = await generateCompleteStudyPlanLocal(
        formData.examName,
        formData.totalDays,
        files, // File objects diretti
        formData.description,
        progressCallback,
        analysisMode // NUOVO PARAMETRO
      );

      // SUCCESSO: naviga alla pagina di revisione
      console.log('CreateProject: Local analysis completed. Opening review modal.');
      
      setLoading(false);
      setLoadingMessage('');

      navigate('/plan-review', { 
        state: { 
          provisionalPlanData: planData,
          originalFiles: files,
          totalDays: formData.totalDays,
          projectData: {
            title: formData.title,
            examName: formData.examName,
            totalDays: formData.totalDays,
            description: formData.description
          },
          analysisMode: analysisMode // Passa la modalità usata
        }
      });

    } catch (error) {
      console.error('CreateProject: Error during local analysis:', error);
      setError(`Errore durante l'analisi: ${error.message}`);
      setSuccess('');
      setLoading(false); 
      setLoadingMessage(''); 
    }
  };
  
  const handleCancel = () => {
    console.log("CreateProject: User cancelled project creation, resetting all state.");
    resetAllState();
    navigate('/create-project');
  };

  return (
    <>
      <NavBar />
      <div className="create-project-wrapper">
        <div className="create-project-container">
          <div className="create-project-header">
            <h1 className="page-title">Genera Piano di Studio (Analisi Locale)</h1>
            <p className="page-subtitle">Carica i PDF e scegli la modalità di analisi. L'AI analizzerà i contenuti senza caricamenti online.</p>
          </div>

           {error && (
                <div className="message error-message">
                    <AlertCircle size={20} /> <span>{error}</span>
                </div>
            )}
           {success && !loading && ( <div className="message success-message"> <Info size={20} /> <span>{success}</span> </div> )}
           {loading && (
               <div className="message info-message">
                   <Loader size={20} className="spin-icon" />
                   <span>{loadingMessage || 'Attendere...'}</span>
               </div>
           )}

          <form className="create-project-form" onSubmit={handleSubmit}>
              <fieldset disabled={loading} style={{ border: 'none', padding: 0, margin: 0 }}>
                  <div className="form-grid">
                      <div className="form-section">
                          <h2 className="section-title">Informazioni Base</h2>
                          <div className="form-group">
                              <label htmlFor="title"><span className="label-text">Titolo Progetto</span><span className="required-mark">*</span></label>
                              <div className="input-wrapper">
                                  <BookOpen size={20} className="input-icon" />
                                  <input type="text" id="title" name="title" value={formData.title} onChange={handleChange} placeholder="Es. Prep. Metodi Matematici" required />
                              </div>
                          </div>
                          <div className="form-group">
                              <label htmlFor="examName"><span className="label-text">Nome Esame</span><span className="required-mark">*</span></label>
                              <div className="input-wrapper">
                                  <BookOpen size={20} className="input-icon" />
                                  <input type="text" id="examName" name="examName" value={formData.examName} onChange={handleChange} placeholder="Es. Metodi Matematici della Fisica" required />
                              </div>
                          </div>
                          <div className="form-group">
                              <label htmlFor="totalDays"><span className="label-text">Giorni Preparazione</span><span className="required-mark">*</span></label>
                              <div className="input-wrapper">
                                  <Calendar size={20} className="input-icon" />
                                  <input type="number" id="totalDays" name="totalDays" value={formData.totalDays} onChange={handleChange} min="1" max="90" required />
                              </div>
                              <p className="field-hint">Giorni totali (studio + ripasso).</p>
                          </div>
                          <div className="form-group">
                              <label htmlFor="description"><span className="label-text">Note per AI</span><span className="optional-mark">(Opz.)</span></label>
                              <div className="textarea-wrapper">
                                  <textarea id="description" name="description" value={formData.description} onChange={handleChange} placeholder="Es. Dare priorità a X, Y è meno importante..." rows="3" />
                              </div>
                          </div>
                      </div>

                      <div className="form-section">
                          <h2 className="section-title">Materiale Studio</h2>
                          
                          {/* NUOVO: Switch modalità analisi */}
                          <div className="form-group">
                              <label><span className="label-text">Modalità Analisi</span><span className="required-mark">*</span></label>
                              <div className="analysis-mode-selector">
                                  <div 
                                      className={`mode-option ${analysisMode === 'pdf' ? 'active' : ''}`}
                                      onClick={() => setAnalysisMode('pdf')}
                                  >
                                      <div className="mode-header">
                                          <FileText size={20} />
                                          <span className="mode-title">PDF Completo</span>
                                          <span className="mode-badge premium">Avanzata</span>
                                      </div>
                                      <div className="mode-description">
                                          <p>Analisi completa con immagini, grafici e formattazione. Qualità massima.</p>
                                          <div className="mode-stats">
                                              <div className="stat-item">
                                                  <Clock size={14} />
                                                  <span>~{timeEstimate.min}-{timeEstimate.max}s</span>
                                              </div>
                                              <div className="stat-item quality">
                                                  <span>🎯 Precisione: 95%</span>
                                              </div>
                                          </div>
                                      </div>
                                  </div>
                                  
                                  <div 
                                      className={`mode-option ${analysisMode === 'text' ? 'active' : ''}`}
                                      onClick={() => setAnalysisMode('text')}
                                  >
                                      <div className="mode-header">
                                          <Zap size={20} />
                                          <span className="mode-title">Solo Testo</span>
                                          <span className="mode-badge fast">Veloce</span>
                                      </div>
                                      <div className="mode-description">
                                          <p>Estrazione rapida del testo. Ideale per documenti principalmente testuali.</p>
                                          <div className="mode-stats">
                                              <div className="stat-item">
                                                  <Clock size={14} />
                                                  <span>~{Math.ceil(timeEstimate.min * 0.4)}-{Math.ceil(timeEstimate.max * 0.4)}s</span>
                                              </div>
                                              <div className="stat-item quality">
                                                  <span>📝 Precisione: 85%</span>
                                              </div>
                                          </div>
                                      </div>
                                  </div>
                              </div>
                              <p className="field-hint">
                                  {analysisMode === 'pdf' 
                                      ? 'Modalità raccomandata per documenti con grafici, formule e immagini importanti.'
                                      : 'Modalità veloce ideale per libri di testo principalmente testuali.'
                                  }
                              </p>
                          </div>

                          <div className="form-group">
                              <label><span className="label-text">File PDF</span><span className="required-mark">*</span></label>
                              <div className="file-upload-area">
                                  <div className="file-upload-container">
                                      <label className="file-upload-btn" htmlFor="fileInput"><Upload size={20} /><span>Carica PDF</span></label>
                                      <input type="file" id="fileInput" onChange={handleFileChange} multiple accept=".pdf" className="hidden-file-input" />
                                  </div>
                                  <p className="file-upload-info">
                                      Carica libri, dispense, appunti.<br />
                                      <small>
                                          Max {analysisMode === 'pdf' ? '50' : '100'}MB/file. 
                                          {analysisMode === 'text' && ' (Limite maggiore per modalità testo)'}
                                      </small>
                                  </p>
                              </div>
                              {files.length > 0 && (
                                  <div className="file-list">
                                      <h3>File Selezionati ({files.length}):</h3>
                                      <ul>
                                          {files.map((file, index) => (
                                              <li key={`${file.name}-${index}`} className="file-item">
                                                  <FilePlus size={16} className="file-icon" />
                                                  <span className="file-name" title={file.name}>{file.name.length > 35 ? file.name.substring(0,32)+'...' : file.name}</span>
                                                  <span className="file-size">{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                                                  <button type="button" className="remove-file-btn" onClick={() => removeFile(index)} disabled={loading}> <X size={16} /> </button>
                                              </li>
                                          ))}
                                      </ul>
                                      
                                      {/* Stima tempo totale */}
                                      {files.length > 0 && (
                                          <div className="time-estimate">
                                              <Clock size={16} />
                                              <span>Tempo stimato: {timeEstimate.min}-{timeEstimate.max} secondi</span>
                                              <span className="estimate-mode">({analysisMode === 'pdf' ? 'PDF completo' : 'Solo testo'})</span>
                                          </div>
                                      )}
                                  </div>
                              )}
                              {files.length === 0 && (<div className="no-files-message">Nessun file PDF selezionato.</div>)}
                          </div>
                      </div>
                  </div>

                   <div className="form-actions">
                     <button type="button" className="cancel-btn" onClick={handleCancel} > Annulla </button>
                     <button type="submit" className="submit-btn" disabled={files.length === 0 || loading}>
                       {loading ?
                          (<> <Loader size={16} className="spin-icon" /> Analisi {analysisMode === 'pdf' ? 'PDF' : 'Testo'}... </> ) :
                          (<> <BrainCircuit size={16} style={{marginRight:'5px'}}/> Analisi {analysisMode === 'pdf' ? 'Completa' : 'Veloce'} </>)
                       }
                     </button>
                   </div>
              </fieldset>
          </form>
        </div>
      </div>
    </>
  );
};

export default CreateProject;