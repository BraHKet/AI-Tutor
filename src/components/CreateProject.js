// src/components/CreateProject.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useGoogleAuth from '../hooks/useGoogleAuth';
import { googleDriveService } from '../utils/googleDriveService';
import { createPdfChunk } from '../utils/pdfProcessor';
import { generateCompleteStudyPlan } from '../utils/gemini'; // NUOVA IMPORTAZIONE
import { saveProjectWithPlan } from '../utils/firebase';
import { v4 as uuidv4 } from 'uuid';

import PlanReviewModal from './PlanReviewModal';

import { FilePlus, Upload, X, Calendar, BookOpen, Info, AlertCircle, Loader, BrainCircuit, CopyCheck, FileText, CheckCircle } from 'lucide-react';
import NavBar from './NavBar';
import './styles/CreateProject.css';

const CreateProject = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useGoogleAuth();
  const [serviceStatus, setServiceStatus] = useState({ ready: false, initializing: false, error: null });
  const [formData, setFormData] = useState({ title: '', examName: '', totalDays: 7, description: '' });
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadProgress, setUploadProgress] = useState({});

  const [showReviewModal, setShowReviewModal] = useState(false);
  const [provisionalPlanData, setProvisionalPlanData] = useState(null);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [finalizationError, setFinalizationError] = useState('');
  
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
    setUploadProgress({});
    setShowReviewModal(false);
    setProvisionalPlanData(null);
    setIsFinalizing(false);
    setFinalizationError('');
  }, []);

  // Singolo useEffect che gestisce mount/unmount e inizializzazione del servizio
  useEffect(() => {
    console.log('CreateProject: Component mounted, initializing...');
    isMounted.current = true;
    
    resetAllState();
    
    const initService = async () => {
      console.log('CreateProject: Initializing Google Drive service');
      setServiceStatus({ ready: false, initializing: true, error: null });
      setLoadingMessage('Inizializzazione servizio Google Drive...');
      
      try {
        await googleDriveService.initialize();
        if (isMounted.current) {
          console.log('CreateProject: Service initialized successfully');
          setServiceStatus({ ready: true, initializing: false, error: null });
          setLoadingMessage('');
        }
      } catch (err) {
        if (isMounted.current) {
          console.error('CreateProject: Error initializing Google Drive service', err);
          setServiceStatus({ ready: false, initializing: false, error: err.message });
          setError('Errore inizializzazione Google Drive: ' + err.message);
          setLoadingMessage('');
        }
      }
    };

    initService();
    
    return () => {
      console.log('CreateProject: Component unmounted');
      isMounted.current = false;
    };
  }, []); // Dipendenze vuote per eseguire solo al mount

  const initServiceRetry = async () => {
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
    const MAX_FILE_SIZE_MB = googleDriveService.MAX_FILE_SIZE_MB || 50;

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
    if (update.type === 'upload') {
      setUploadProgress(prev => ({ ...prev, [update.fileName]: { phase: update.phase, percent: update.percent } }));
    } else if (update.type === 'processing') {
      if(isFinalizing || loading){
         setLoadingMessage(update.message);
      }
    } else if (update.type === 'error') {
      console.error("Progress Callback Error:", update.message);
    } else if (update.type === 'warning') {
        console.warn("Progress Callback Warning:", update.message);
    }
  }, [isFinalizing, loading]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('CreateProject: Form submitted for PROVISIONAL plan generation');

    setError(''); 
    setSuccess(''); 
    setLoading(true); 
    setLoadingMessage('Verifica dati...');
    setUploadProgress({}); 
    setProvisionalPlanData(null); 
    setShowReviewModal(false); 
    setFinalizationError('');

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
    if (!serviceStatus.ready) { 
      setError('Servizio Google Drive non pronto.'); 
      setLoading(false); 
      return; 
    }

    try {
      // FASE 1 - Upload file originali
      setLoadingMessage('Caricamento file originali...');
      
      const uploadPromises = files.map((file, index) =>
        googleDriveService.uploadFile(file, (percent) => progressCallback({ 
          type: 'upload', 
          phase: 'original', 
          fileName: file.name, 
          percent: percent 
        }))
        .then(result => {
          progressCallback({ type: 'processing', message: `File originale ${file.name} caricato.` });
          return {
            name: file.name,
            driveFileId: result.driveFileId || result.id,
            size: file.size,
            type: file.type,
            webViewLink: result.webViewLink,
            originalFileIndex: index
          };
        }).catch(err => { 
          throw new Error(`Errore upload ${file.name}: ${err.message}`); 
        })
      );

      const originalUploadedFilesData = await Promise.all(uploadPromises);
      progressCallback({ type: 'processing', message: 'File originali caricati.' });

      // FASE 2 - Analisi AI completa (SEMPLIFICATA!)
      const planData = await generateCompleteStudyPlan(
        formData.examName,
        formData.totalDays,
        files,
        originalUploadedFilesData,
        formData.description,
        progressCallback
      );

      // FASE 3 - Successo: naviga alla pagina di revisione
      console.log('CreateProject: Provisional plan generated successfully. Opening review modal.');
      
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
          }
        }
      });

    } catch (error) {
      console.error('CreateProject: Error during provisional plan generation:', error);
      setError(`Errore durante la generazione: ${error.message}`);
      setSuccess('');
      setLoading(false); 
      setLoadingMessage(''); 
      setShowReviewModal(false);
    }
  };

  const handleConfirmReview = async (finalUserSelections) => {
    console.log('CreateProject: Starting Phase 2 - Finalization with user selections:', finalUserSelections);
    setShowReviewModal(false);
    setIsFinalizing(true);
    setLoadingMessage('Avvio finalizzazione e creazione materiale...');
    setFinalizationError('');
    setUploadProgress({});

    const { index: aiGeneratedIndex, distribution, pageMapping, originalFilesInfo } = provisionalPlanData || {};
    const originalFileObjects = files;

    if (!aiGeneratedIndex || !distribution || !originalFilesInfo || !originalFileObjects || originalFileObjects.length === 0) {
        console.error("CreateProject/handleConfirmReview: Missing provisional data or original files in state.");
        setFinalizationError("Errore interno: dati necessari non trovati per finalizzare.");
        setIsFinalizing(false); 
        setLoadingMessage(''); 
        return;
    }

    const finalDailyPlanMap = {};
    const topicsDataForFirestore = [];
    const aiTopicDetailsMap = aiGeneratedIndex.reduce((map, topic) => {
        if (topic.title?.trim()) map[topic.title.trim()] = topic;
        return map;
    }, {});

    try {
        let totalChunksToCreate = 0;
        Object.entries(finalUserSelections).forEach(([topicTitle, fileSelections]) => {
            if (Array.isArray(fileSelections)) {
                fileSelections.forEach(fileEntry => {
                    if (fileEntry && fileEntry.pages && fileEntry.pages.length > 0) {
                        totalChunksToCreate++;
                    }
                });
            }
        });
        
        console.log(`CreateProject/handleConfirmReview: Estimated chunks to create: ${totalChunksToCreate}`);
        let chunksProcessedCount = 0;
        
        for (const dayPlan of distribution) {
            const dayNumber = dayPlan.day;
            if (!dayNumber) continue;
            finalDailyPlanMap[dayNumber] = [];

            if (!dayPlan.assignedTopics || dayPlan.assignedTopics.length === 0 || dayPlan.assignedTopics.some(t => t.title?.toLowerCase().includes("ripasso"))) {
                if(dayPlan.assignedTopics && dayPlan.assignedTopics.length > 0){
                    const reviewTopic = dayPlan.assignedTopics.find(t => t.title?.toLowerCase().includes("ripasso"));
                    if (reviewTopic) {
                         const topicId = uuidv4();
                         finalDailyPlanMap[dayNumber].push(topicId);
                         topicsDataForFirestore.push({
                             id: topicId, 
                             title: reviewTopic.title, 
                             description: "Ripasso generale argomenti precedenti.",
                             assignedDay: dayNumber, 
                             orderInDay: 0, 
                             isCompleted: false, 
                             sources: []
                         });
                    }
                }
                continue;
            }

            for (const [topicIndexInDay, assignedTopic] of dayPlan.assignedTopics.entries()) {
                const topicTitle = assignedTopic.title?.trim();
                if (!topicTitle) continue;

                const topicId = uuidv4();
                finalDailyPlanMap[dayNumber].push(topicId);
                let topicSources = [];
                const topicDetailsFromAI = aiTopicDetailsMap[topicTitle];
                const userSelectionsForTopic = finalUserSelections[topicTitle] || [];
                
                console.log(`\n--- Finalizing Topic: "${topicTitle}" (Day ${dayNumber}) ---`);

                const isReview = topicTitle.toLowerCase().includes("ripasso");
                const isExamSimulation = topicTitle.toLowerCase().includes("simulazione") || 
                                       topicTitle.toLowerCase().includes("esame") ||
                                       assignedTopic.description?.toLowerCase().includes("esercizi") ||
                                       assignedTopic.description?.toLowerCase().includes("simulazione");

                if (isExamSimulation) {
                    console.log(`[DEBUG] Finalize: Detected exam simulation topic "${topicTitle}" - skipping PDF chunk creation`);
                    topicSources = [{
                        type: 'note',
                        noteType: 'exam_simulation',
                        description: 'Simulazione d\'esame - Prova a risolvere esercizi senza consultare il materiale.'
                    }];
                } else if (isReview) {
                    console.log(`[DEBUG] Finalize: Detected review topic "${topicTitle}" - no PDF chunks needed`);
                    topicSources = [{
                        type: 'note',
                        noteType: 'review',
                        description: 'Ripasso generale argomenti precedenti.'
                    }];
                } else {
                    if (userSelectionsForTopic.length > 0) {
                        for (const fileSelection of userSelectionsForTopic) {
                            const { fileIndex, fileName, pages } = fileSelection;
                            
                            if (!pages || pages.length === 0) continue;
                            
                            const originalFile = originalFileObjects[fileIndex];
                            const originalFileInfoFromDrive = originalFilesInfo.find(f => f.originalFileIndex === fileIndex);
                            
                            if (!originalFile || !originalFileInfoFromDrive) {
                                console.warn(`Finalize: Missing file data for fileIndex ${fileIndex}`);
                                continue;
                            }

                            const sortedPages = [...pages].sort((a, b) => a - b);
                            const firstPage = sortedPages[0];
                            const lastPage = sortedPages[sortedPages.length - 1];
                            
                            const safeTitlePart = topicTitle.substring(0, 15).replace(/[^a-zA-Z0-9]/g, '_');
                            const chunkFileName = `${originalFile.name.replace(/\.pdf$/i, '')}_${safeTitlePart}_p${firstPage}-${lastPage}.pdf`;
                            
                            chunksProcessedCount++;
                            try {
                                const progressMsgChunk = `Creazione/Upload chunk ${chunksProcessedCount}/${totalChunksToCreate || '?'}: ${chunkFileName.substring(0,30)}...`;
                                progressCallback({ type: 'processing', message: progressMsgChunk });

                                const chunkFile = await createPdfChunk(originalFile, sortedPages, chunkFileName, (msg) => progressCallback({type:'processing', message:msg}));
                                if (chunkFile) {
                                    progressCallback({ type: 'processing', message: `Caricamento chunk ${chunkFileName}...` });
                                    const uploadedChunk = await googleDriveService.uploadFile(chunkFile, (percent) => progressCallback({ type: 'upload', phase: 'chunk', fileName: chunkFileName, percent: percent }));
                                    topicSources.push({
                                        type: 'pdf_chunk',
                                        chunkDriveId: uploadedChunk.driveFileId || uploadedChunk.id,
                                        chunkName: chunkFileName,
                                        webViewLink: uploadedChunk.webViewLink,
                                        originalFileId: originalFileInfoFromDrive.driveFileId,
                                        originalFileName: originalFileInfoFromDrive.name,
                                        pageStart: firstPage,
                                        pageEnd: lastPage
                                    });
                                    progressCallback({ type: 'processing', message: `Chunk ${chunkFileName} caricato.` });
                                } else {
                                    topicSources.push({ 
                                        type: 'error_chunk', 
                                        name: chunkFileName, 
                                        error: 'Creazione fallita (pdfProcessor)', 
                                        originalFileId: originalFileInfoFromDrive.driveFileId, 
                                        originalFileName: originalFileInfoFromDrive.name 
                                    });
                                }
                            } catch (chunkError) {
                                console.error(`Finalize: ERROR during chunk handling for ${chunkFileName}`, chunkError);
                                progressCallback({ type: 'error', message: `Errore chunk ${chunkFileName}: ${chunkError.message}` });
                                topicSources.push({ 
                                    type: 'error_chunk', 
                                    name: chunkFileName, 
                                    error: chunkError.message, 
                                    originalFileId: originalFileInfoFromDrive.driveFileId, 
                                    originalFileName: originalFileInfoFromDrive.name 
                                });
                            }
                        }
                    } else if (topicDetailsFromAI?.pages_info && topicDetailsFromAI.pages_info.length > 0) {
                        console.log(`Finalize: No user selections for topic "${topicTitle}", using AI suggestions.`);
                        
                        for (const pInfo of topicDetailsFromAI.pages_info) {
                            const originalFile = originalFileObjects[pInfo.pdf_index];
                            const originalFileInfoFromDrive = originalFilesInfo.find(f => f.originalFileIndex === pInfo.pdf_index);
                            
                            if (!originalFile || !originalFileInfoFromDrive) continue;
                            
                            const pageNumbers = [];
                            for (let i = pInfo.start_page; i <= pInfo.end_page; i++) {
                                pageNumbers.push(i);
                            }
                            
                            if (pageNumbers.length === 0) continue;
                            
                            const firstPage = Math.min(...pageNumbers);
                            const lastPage = Math.max(...pageNumbers);
                            const safeTitlePart = topicTitle.substring(0, 15).replace(/[^a-zA-Z0-9]/g, '_');
                            const chunkFileName = `${originalFile.name.replace(/\.pdf$/i, '')}_${safeTitlePart}_p${firstPage}-${lastPage}.pdf`;
                            
                            chunksProcessedCount++;
                            try {
                                const progressMsgChunk = `Creazione/Upload chunk ${chunksProcessedCount}/${totalChunksToCreate || '?'}: ${chunkFileName.substring(0,30)}...`;
                                progressCallback({ type: 'processing', message: progressMsgChunk });

                                const chunkFile = await createPdfChunk(originalFile, pageNumbers, chunkFileName, (msg) => progressCallback({type:'processing', message:msg}));
                                
                                if (chunkFile) {
                                    progressCallback({ type: 'processing', message: `Caricamento chunk ${chunkFileName}...` });
                                    const uploadedChunk = await googleDriveService.uploadFile(chunkFile, (percent) => progressCallback({ type: 'upload', phase: 'chunk', fileName: chunkFileName, percent: percent }));
                                    topicSources.push({
                                        type: 'pdf_chunk',
                                        chunkDriveId: uploadedChunk.driveFileId || uploadedChunk.id,
                                        chunkName: chunkFileName,
                                        webViewLink: uploadedChunk.webViewLink,
                                        originalFileId: originalFileInfoFromDrive.driveFileId,
                                        originalFileName: originalFileInfoFromDrive.name,
                                        pageStart: firstPage,
                                        pageEnd: lastPage
                                    });
                                    progressCallback({ type: 'processing', message: `Chunk ${chunkFileName} caricato.` });
                                } else {
                                    topicSources.push({ 
                                        type: 'error_chunk', 
                                        name: chunkFileName, 
                                        error: 'Creazione fallita (pdfProcessor)', 
                                        originalFileId: originalFileInfoFromDrive.driveFileId, 
                                        originalFileName: originalFileInfoFromDrive.name 
                                    });
                                }
                            } catch (chunkError) {
                                console.error(`Finalize: ERROR during chunk handling for ${chunkFileName}`, chunkError);
                                progressCallback({ type: 'error', message: `Errore chunk ${chunkFileName}: ${chunkError.message}` });
                                topicSources.push({ 
                                    type: 'error_chunk', 
                                    name: chunkFileName, 
                                    error: chunkError.message, 
                                    originalFileId: originalFileInfoFromDrive.driveFileId, 
                                    originalFileName: originalFileInfoFromDrive.name 
                                });
                            }
                        }
                    } else {
                        console.warn(`Finalize: No user selections or AI suggestions for topic "${topicTitle}" (Day ${dayNumber}). Applying fallback to original files.`);
                        topicSources.push(...originalFilesInfo.map(f => ({ 
                            type: 'pdf_original', 
                            driveFileId: f.driveFileId, 
                            name: f.name, 
                            webViewLink: f.webViewLink 
                        })));
                    }
                }
                
                topicsDataForFirestore.push({
                    id: topicId,
                    title: topicTitle,
                    description: topicDetailsFromAI?.description || assignedTopic.description || '',
                    assignedDay: dayNumber,
                    orderInDay: topicIndexInDay,
                    isCompleted: false,
                    sources: topicSources
                });
                console.log(`--- Finished Finalizing Topic: "${topicTitle}" ---`);
            }
        }

        const projectCoreData = {
           title: formData.title, 
           examName: formData.examName, 
           totalDays: formData.totalDays,
           description: formData.description, 
           userId: user.uid,
           originalFiles: originalFilesInfo.map(({originalFileIndex, ...rest}) => rest),
           aiModelUsed: 'gemini-1.5-flash-latest (orchestrated)', 
           dailyPlan: finalDailyPlanMap,
        };

        setLoadingMessage('Salvataggio finale del piano...');
        console.log("CreateProject/handleConfirmReview: Saving final plan to Firestore...");
        const finalProjectId = await saveProjectWithPlan(projectCoreData, topicsDataForFirestore);
        console.log("CreateProject/handleConfirmReview: Final plan saved! Project ID:", finalProjectId);

        setLoadingMessage('');
        setIsFinalizing(false);
        setSuccess('Piano finalizzato e materiale generato con successo! Reindirizzamento...');
        
        // Prima di reindirizzare, resetta lo stato
        setTimeout(() => {
            resetAllState();
            navigate(`/projects/${finalProjectId}/plan`);
        }, 1500);

    } catch(error) {
        console.error("CreateProject/handleConfirmReview: Error during finalization phase:", error);
        setFinalizationError(`Errore Fase 2: ${error.message}` || 'Errore imprevisto durante la finalizzazione.');
        setIsFinalizing(false); 
        setLoadingMessage('');
    }
  };

  const handleCancelReview = () => {
      console.log("CreateProject: Review cancelled by user.");
      setShowReviewModal(false);
      setProvisionalPlanData(null);
  };
  
  const handleCancel = () => {
    console.log("CreateProject: User cancelled project creation, resetting all state.");
    resetAllState();
    navigate('/create-project');
  };

  return (
    <>
    {/* Mostra o il form di creazione progetto o il modale di revisione */}
    {showReviewModal ? (
      <PlanReviewModal
        provisionalPlanData={provisionalPlanData}
        originalFiles={files}
        onConfirm={handleConfirmReview}
        onCancel={handleCancelReview}
        isFinalizing={isFinalizing}
        finalizationMessage={loadingMessage}
        finalizationError={finalizationError}
        totalDays={formData.totalDays}
      />
    ) : (
    <>
      <NavBar />
      <div className="create-project-wrapper">
        <div className="create-project-container">
          <div className="create-project-header">
            <h1 className="page-title">Genera Piano di Studio (AI + Revisione)</h1>
            <p className="page-subtitle">Carica i PDF, l'AI analizzerà direttamente i file e proporrà una struttura, tu confermerai.</p>
          </div>

           {error && !isFinalizing && (
                <div className="message error-message">
                    <AlertCircle size={20} /> <span>{error}</span>
                    {error.includes('Google Drive') && !serviceStatus.initializing && (
                       <button onClick={initServiceRetry} className="retry-button" disabled={serviceStatus.initializing}> Riprova Init Drive </button>
                    )}
                </div>
            )}
           {success && !loading && !isFinalizing && ( <div className="message success-message"> <Info size={20} /> <span>{success}</span> </div> )}
           {(serviceStatus.initializing || loading || isFinalizing) && (
               <div className="message info-message">
                   <Loader size={20} className="spin-icon" />
                   <span>{loadingMessage || (isFinalizing ? 'Finalizzazione...' : (serviceStatus.initializing ? 'Inizializzazione Drive...' : 'Attendere...'))}</span>
               </div>
           )}

          <form className="create-project-form" onSubmit={handleSubmit}>
              <fieldset disabled={serviceStatus.initializing || loading || isFinalizing} style={{ border: 'none', padding: 0, margin: 0 }}>
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
                          <div className="form-group">
                              <label><span className="label-text">File PDF</span><span className="required-mark">*</span></label>
                              <div className="file-upload-area">
                                  <div className="file-upload-container">
                                      <label className="file-upload-btn" htmlFor="fileInput"><Upload size={20} /><span>Carica PDF</span></label>
                                      <input type="file" id="fileInput" onChange={handleFileChange} multiple accept=".pdf" className="hidden-file-input" />
                                  </div>
                                  <p className="file-upload-info">Carica libri, dispense, appunti.<br /><small>Max {googleDriveService.MAX_FILE_SIZE_MB || 50}MB/file.</small></p>
                              </div>
                              {files.length > 0 && (
                                  <div className="file-list">
                                      <h3>File Selezionati ({files.length}):</h3>
                                      <ul>
                                          {files.map((file, index) => {
                                              const progressInfo = uploadProgress[file.name];
                                              const isOriginalUploaded = progressInfo?.phase === 'original' && progressInfo?.percent === 100;
                                              return (
                                                  <li key={`${file.name}-${index}`} className={`file-item ${isOriginalUploaded ? 'file-item-original-uploaded' : ''}`}>
                                                      {isOriginalUploaded ? <CopyCheck size={16} className="file-icon" color="green"/> : <FilePlus size={16} className="file-icon" />}
                                                      <span className="file-name" title={file.name}>{file.name.length > 35 ? file.name.substring(0,32)+'...' : file.name}</span>
                                                      <span className="file-size">{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                                                      {progressInfo?.phase === 'original' && !isOriginalUploaded && (
                                                           <div className="upload-progress-bar-container" title="Caricamento originale">
                                                               <div className="upload-progress-bar" style={{ width: `${Math.round(progressInfo.percent)}%` }}></div>
                                                               <span className="upload-progress-text">{Math.round(progressInfo.percent)}%</span>
                                                           </div>
                                                      )}
                                                      {isOriginalUploaded && <span className="upload-status-indicator">Caricato</span>}
                                                      <button type="button" className="remove-file-btn" onClick={() => removeFile(index)} disabled={loading || isFinalizing}> <X size={16} /> </button>
                                                  </li>
                                              );
                                          })}
                                      </ul>
                                       {Object.values(uploadProgress).some(p => p.phase === 'chunk') && (
                                           <div className="chunk-progress-list" style={{marginTop: '15px'}}>
                                               <h4>Progresso upload sezioni PDF:</h4>
                                               <ul>
                                                   {Object.entries(uploadProgress)
                                                       .filter(([name, info]) => info.phase === 'chunk')
                                                       .map(([name, info]) => (
                                                           <li key={name} className="file-item file-item-chunk">
                                                               <FileText size={16} className="file-icon" color="#ff9800"/>
                                                               <span className="file-name" title={name}>{name.length > 40 ? name.substring(0,37)+'...' : name}</span>
                                                               <div className="upload-progress-bar-container" title="Caricamento sezione">
                                                                    <div className="upload-progress-bar" style={{ width: `${Math.round(info.percent)}%`, backgroundColor: '#ff9800' }}></div>
                                                                    <span className="upload-progress-text">{Math.round(info.percent)}%</span>
                                                               </div>
                                                           </li>
                                                       ))
                                                   }
                                               </ul>
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
                     <button type="submit" className="submit-btn" disabled={!serviceStatus.ready || files.length === 0 || loading || isFinalizing || serviceStatus.initializing}>
                       {loading && !isFinalizing ?
                          (<> <Loader size={16} className="spin-icon" /> Analisi AI... </> ) :
                          (<> <BrainCircuit size={16} style={{marginRight:'5px'}}/> Genera Bozza Piano </>)
                       }
                     </button>
                   </div>
              </fieldset>
          </form>
        </div>
      </div>
    </>
  )}
  </>
);
};

export default CreateProject;