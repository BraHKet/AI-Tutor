import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createProject } from '../utils/firebase';
import useGoogleAuth from '../hooks/useGoogleAuth';
import { googleDriveService } from '../utils/googleDriveService';
import { FilePlus, Upload, X, Calendar, BookOpen, Info, AlertCircle } from 'lucide-react';
import NavBar from './NavBar';
import './styles/CreateProject.css';

const CreateProject = () => {
  const navigate = useNavigate();
  const { user } = useGoogleAuth();
  const [serviceReady, setServiceReady] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    examName: '',
    totalDays: 7,
    description: ''
  });
  
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadProgress, setUploadProgress] = useState({});

  // Inizializza il servizio Google Drive
  useEffect(() => {
    console.log('CreateProject: useEffect - initializing Google Drive service');
    
    const initService = async () => {
      try {
        console.log('CreateProject: Starting service initialization...');
        await googleDriveService.initialize();
        console.log('CreateProject: Service initialized successfully');
        setServiceReady(true);
      } catch (error) {
        console.error('CreateProject: Error initializing Google Drive service', error);
        setError('Errore nell\'inizializzazione del servizio Google Drive: ' + error.message);
      }
    };

    initService();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    console.log('CreateProject: Form field changed:', name, value);
    setFormData({
      ...formData,
      [name]: name === 'totalDays' ? parseInt(value) : value
    });
  };

  const handleFileChange = (e) => {
    const newFiles = Array.from(e.target.files);
    console.log('CreateProject: Files selected:', newFiles.length);
    
    // Validate file types (PDF only)
    const invalidFiles = newFiles.filter(file => file.type !== 'application/pdf');
    if (invalidFiles.length > 0) {
      console.log('CreateProject: Invalid files detected:', invalidFiles);
      setError('Solo file PDF sono accettati');
      return;
    }
    
    setFiles([...files, ...newFiles]);
    console.log('CreateProject: Total files after addition:', files.length + newFiles.length);
    setError('');
  };

  const removeFile = (indexToRemove) => {
    console.log('CreateProject: Removing file at index:', indexToRemove);
    setFiles(files.filter((_, index) => index !== indexToRemove));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('CreateProject: Form submitted');
    console.log('CreateProject: User authenticated:', !!user, user?.uid);
    console.log('CreateProject: Service ready:', serviceReady);
    console.log('CreateProject: Form data:', formData);
    console.log('CreateProject: Files to upload:', files.length);
    
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (!user) {
        console.error('CreateProject: No user authenticated');
        throw new Error('Utente non autenticato');
      }

      // Validate form
      if (!formData.title || !formData.examName || !formData.totalDays) {
        console.error('CreateProject: Form validation failed');
        throw new Error('Per favore completa tutti i campi obbligatori');
      }

      if (files.length === 0) {
        console.error('CreateProject: No files selected');
        throw new Error('Carica almeno un file PDF per continuare');
      }

      if (!serviceReady) {
        console.error('CreateProject: Google Drive service not ready');
        throw new Error('Il servizio Google Drive non è ancora pronto. Riprova tra qualche secondo.');
      }

      setSuccess('Creazione in corso... Caricamento dei file su Google Drive...');

      // Upload files to Google Drive
      const uploadedFiles = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log(`CreateProject: Uploading file ${i + 1}/${files.length}: ${file.name}`);
        
        try {
          const uploadedFile = await googleDriveService.uploadFile(file, (progress) => {
            console.log(`CreateProject: Upload progress for ${file.name}: ${progress}%`);
            setUploadProgress(prev => ({
              ...prev,
              [file.name]: progress
            }));
          });
          
          console.log(`CreateProject: File uploaded successfully:`, uploadedFile);
          uploadedFiles.push(uploadedFile);
          setSuccess(`File ${file.name} caricato con successo!`);
        } catch (error) {
          console.error(`CreateProject: Error uploading ${file.name}:`, error);
          throw new Error(`Errore durante l'upload di ${file.name}: ${error.message}`);
        }
      }

      setSuccess('Tutti i file caricati! Salvataggio progetto...');

      // Create project in Firestore
      const projectData = {
        ...formData,
        files: uploadedFiles,
        createdAt: new Date(),
        completedDays: 0,
        userId: user.uid
      };

      console.log('CreateProject: Saving project to Firestore:', projectData);
      await createProject(projectData);
      console.log('CreateProject: Project saved successfully');

      setSuccess('Progetto creato con successo! Reindirizzamento...');
      
      // Redirect to projects list after 1.5 seconds
      setTimeout(() => {
        console.log('CreateProject: Navigating to projects page');
        navigate('/projects');
      }, 1500);
    } catch (error) {
      console.error('CreateProject: Error during project creation:', error);
      setError(error.message);
      setSuccess('');
    } finally {
      setLoading(false);
      setUploadProgress({});
      console.log('CreateProject: Form submission completed');
    }
  };

  return (
    <>
      <NavBar />
      <div className="create-project-wrapper">
        <div className="create-project-container">
          <div className="create-project-header">
            <h1 className="page-title">Crea un Nuovo Piano di Studio</h1>
            <p className="page-subtitle">Inserisci i dettagli dell'esame e carica i materiali per iniziare</p>
          </div>
          
          {error && (
            <div className="message error-message">
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}
          
          {success && (
            <div className="message success-message">
              <Info size={20} />
              <span>{success}</span>
            </div>
          )}
          
          <form className="create-project-form" onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-section">
                <h2 className="section-title">Informazioni Base</h2>
                
                <div className="form-group">
                  <label htmlFor="title">
                    <span className="label-text">Titolo del Progetto</span>
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
                      placeholder="Es. Preparazione Esame di Statistica"
                      required
                      disabled={loading}
                    />
                  </div>
                </div>
                
                <div className="form-group">
                  <label htmlFor="examName">
                    <span className="label-text">Nome dell'Esame</span>
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
                      placeholder="Es. Analisi Matematica I"
                      required
                      disabled={loading}
                    />
                  </div>
                </div>
                
                <div className="form-group">
                  <label htmlFor="totalDays">
                    <span className="label-text">Giorni per la Preparazione</span>
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
                      max="365"
                      required
                      disabled={loading}
                    />
                  </div>
                  <p className="field-hint">Numero di giorni disponibili per prepararti all'esame</p>
                </div>
                
                <div className="form-group">
                  <label htmlFor="description">
                    <span className="label-text">Descrizione</span>
                    <span className="optional-mark">(Opzionale)</span>
                  </label>
                  <div className="textarea-wrapper">
                    <textarea
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      placeholder="Aggiungi dettagli o note specifiche per il tuo piano di studio..."
                      rows="4"
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>
              
              <div className="form-section">
                <h2 className="section-title">Materiale di Studio</h2>
                
                <div className="form-group">
                  <label>
                    <span className="label-text">File PDF da studiare</span>
                    <span className="required-mark">*</span>
                  </label>
                  
                  <div className="file-upload-area">
                    <div className="file-upload-container">
                      <label className="file-upload-btn" htmlFor="fileInput">
                        <Upload size={20} />
                        <span>Carica PDF</span>
                      </label>
                      <input
                        type="file"
                        id="fileInput"
                        onChange={handleFileChange}
                        multiple
                        accept=".pdf"
                        className="hidden-file-input"
                        disabled={loading}
                      />
                    </div>
                    <p className="file-upload-info">
                      Carica libri, dispense o temi d'esame in formato PDF
                    </p>
                  </div>
                  
                  {files.length > 0 && (
                    <div className="file-list">
                      <h3>File caricati ({files.length}):</h3>
                      <ul>
                        {files.map((file, index) => (
                          <li key={index} className="file-item">
                            <FilePlus size={16} className="file-icon" />
                            <span className="file-name">{file.name}</span>
                            <span className="file-size">
                              {(file.size / (1024 * 1024)).toFixed(2)} MB
                            </span>
                            {uploadProgress[file.name] !== undefined && (
                              <span className="upload-progress">
                                {Math.round(uploadProgress[file.name])}%
                              </span>
                            )}
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
                      Nessun file caricato. Carica almeno un PDF per continuare.
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="form-actions">
              <button 
                type="button" 
                className="cancel-btn"
                onClick={() => navigate('/projects')}
                disabled={loading}
              >
                Annulla
              </button>
              <button 
                type="submit" 
                className="submit-btn"
                disabled={loading || files.length === 0 || !serviceReady}
              >
                {loading ? 'Creazione in corso...' : 'Crea Piano di Studio'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default CreateProject;