// src/components/CreateProject.jsx - VERSIONE MINIMALISTA
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useGoogleAuth from '../hooks/useGoogleAuth';
import { generateCompleteStudyPlanLocal } from '../utils/gemini';
import { FilePlus, Upload, X, Calendar, BookOpen, Info, AlertCircle, Loader, BrainCircuit, Clock } from 'lucide-react';
import NavBar from './NavBar';
import LoadingOverlay from './LoadingOverlay';
import './styles/CreateProject.css';

const CreateProject = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useGoogleAuth();
  
  const [formData, setFormData] = useState({ title: '', examName: '', totalDays: 7 });
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [loadingPhase, setLoadingPhase] = useState('processing');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const isMounted = useRef(true);

  const resetAllState = useCallback(() => {
    if (!isMounted.current) return;
    
    console.log('CreateProject: Resetting all state to initial values');
    setFormData({ title: '', examName: '', totalDays: 7 });
    setFiles([]);
    setLoading(false);
    setLoadingMessage('');
    setLoadingPhase('processing');
    setError('');
    setSuccess('');
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
    const MAX_FILE_SIZE_MB = 100;

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
      setLoadingPhase('analyzing');
    } else if (update.type === 'extracting') {
      setLoadingMessage('Estrazione testo dai PDF...');
      setLoadingPhase('processing');
    } else if (update.type === 'ai_analysis') {
      setLoadingMessage('Analisi AI in corso...');
      setLoadingPhase('analyzing');
    } else if (update.type === 'error') {
      console.error("Progress Callback Error:", update.message);
    } else if (update.type === 'warning') {
      console.warn("Progress Callback Warning:", update.message);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('CreateProject: Form submitted for LOCAL ANALYSIS');

    setError(''); 
    setSuccess(''); 
    setLoading(true); 
    setLoadingMessage('Verifica dati...');
    setLoadingPhase('processing');

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
      setLoadingMessage('Analisi AI dei PDF in corso...');
      setLoadingPhase('analyzing');
      
      const planData = await generateCompleteStudyPlanLocal(
        formData.examName,
        formData.totalDays,
        files,
        '',
        progressCallback,
        'text'
      );

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
            description: ''
          },
          analysisMode: 'text'
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
      
      <LoadingOverlay 
        isVisible={loading}
        message={loadingMessage || 'Analisi in corso...'}
        phase={loadingPhase}
        details="L'AI sta analizzando i contenuti dei tuoi PDF per creare un piano di studio personalizzato."
      />
      
      <div className="create-project-wrapper">
        <div className="create-project-container">
          <div className="create-project-header">
            <h1 className="page-title">Crea un nuovo piano di studio</h1>
          </div>

          {error && (
            <div className="message error-message">
              <AlertCircle size={20} /> <span>{error}</span>
            </div>
          )}
          {success && !loading && (
            <div className="message success-message">
              <Info size={20} /> <span>{success}</span>
            </div>
          )}

          <form className="create-project-form" onSubmit={handleSubmit}>
            <fieldset disabled={loading} style={{ border: 'none', padding: 0, margin: 0 }}>
              <div className="form-grid">
                <div className="form-section">
                  <h2 className="section-title">Informazioni Base</h2>
                  <div className="form-group">
                    <label htmlFor="title">
                      <span className="label-text">Titolo Progetto</span>
                      <span className="required-mark">*</span>
                    </label>
                    <div className="input-wrapper">
                      <BookOpen size={20} className="input-icon" />
                      <input 
                        type="text" 
                        id="title" 
                        name="title" 
                        value={formData.title} 
                        onChange={handleChange} 
                        placeholder="Es. Prep. Metodi Matematici" 
                        required 
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label htmlFor="examName">
                      <span className="label-text">Nome Esame</span>
                      <span className="required-mark">*</span>
                    </label>
                    <div className="input-wrapper">
                      <BookOpen size={20} className="input-icon" />
                      <input 
                        type="text" 
                        id="examName" 
                        name="examName" 
                        value={formData.examName} 
                        onChange={handleChange} 
                        placeholder="Es. Metodi Matematici per l'Ingegneria" 
                        required 
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label htmlFor="totalDays">
                      <span className="label-text">Giorni Totali</span>
                      <span className="required-mark">*</span>
                    </label>
                    <div className="input-wrapper">
                      <Calendar size={20} className="input-icon" />
                      <input 
                        type="number" 
                        id="totalDays" 
                        name="totalDays" 
                        value={formData.totalDays} 
                        onChange={handleChange} 
                        min="1" 
                        max="30" 
                        required 
                      />
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <h2 className="section-title">Caricamento File</h2>
                  <div className="file-upload-area">
                    <input 
                      type="file" 
                      id="fileInput" 
                      multiple 
                      accept=".pdf" 
                      onChange={handleFileChange} 
                      className="hidden-file-input" 
                      disabled={loading} 
                    />
                    <div className="file-upload-container">
                      <label htmlFor="fileInput" className={`file-upload-btn ${loading ? 'disabled' : ''}`}>
                        <Upload size={20} />
                        <span>Seleziona PDF</span>
                      </label>
                    </div>
                    <div className="file-upload-info">
                      <p>Carica i PDF dei tuoi materiali di studio</p>
                    </div>
                  </div>
                  
                  {files.length > 0 && (
                    <div className="file-list">
                      <h3>File Selezionati ({files.length}):</h3>
                      <ul>
                        {files.map((file, index) => (
                          <li key={`${file.name}-${index}`} className="file-item">
                            <div className="file-info">
                              <FilePlus size={16} className="file-icon" />
                              <span className="file-name" title={file.name}>
                                {file.name.length > 35 ? file.name.substring(0, 32) + '...' : file.name}
                              </span>
                              <span className="file-size">
                                {(file.size / (1024 * 1024)).toFixed(2)} MB
                              </span>
                            </div>
                            <button 
                              type="button" 
                              className="remove-file-btn" 
                              onClick={() => removeFile(index)} 
                              disabled={loading}
                            >
                              <X size={16} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {files.length === 0 && (
                    <div className="no-files-message">
                      Nessun file PDF selezionato.
                    </div>
                  )}
                </div>
              </div>

              <div className="form-actions">
                <button 
                  type="button" 
                  className="cancel-btn" 
                  onClick={handleCancel} 
                  disabled={loading}
                >
                  Annulla
                </button>
                <button 
                  type="submit" 
                  className="submit-btn" 
                  disabled={files.length === 0 || loading}
                >
                  {loading ? (
                    <>
                      <Loader size={16} className="spin-icon" />
                      Analisi in corso...
                    </>
                  ) : (
                    <>
                      <BrainCircuit size={16} />
                      Crea Piano
                    </>
                  )}
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