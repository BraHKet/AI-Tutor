// src/components/CreateProject.jsx (o .js)
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useGoogleAuth from '../hooks/useGoogleAuth';
import { googleDriveService } from '../utils/googleDriveService';
import { createPdfChunk } from '../utils/pdfProcessor';
import { generateContentIndexFromPDFs, distributeTopicsToDays } from '../utils/gemini';
import { saveProjectWithPlan } from '../utils/firebase'; // Usa la funzione di salvataggio finale
import { genAI, model, prepareFilesOnce } from '../utils/gemini';
import { v4 as uuidv4 } from 'uuid';

import PlanReviewModal from './PlanReviewModal'; // Importa il modale

import { FilePlus, Upload, X, Calendar, BookOpen, Info, AlertCircle, Loader, BrainCircuit, CopyCheck, FileText, CheckCircle } from 'lucide-react';
import NavBar from './NavBar';
import './styles/CreateProject.css'; // Assicurati che questo esista e sia corretto



const CreateProject = () => {
  const navigate = useNavigate();
  const { user } = useGoogleAuth();
  // Stati esistenti
  const [serviceStatus, setServiceStatus] = useState({ ready: false, initializing: false, error: null });
  const [formData, setFormData] = useState({ title: '', examName: '', totalDays: 7, description: '' });
  const [files, setFiles] = useState([]); // Mantiene gli oggetti File originali
  const [loading, setLoading] = useState(false); // Loading generale (Fase 1)
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(''); // Solo per successo finale
  const [uploadProgress, setUploadProgress] = useState({}); // { [fileName]: { phase: 'original'|'chunk', percent: number } }

  // Stati NUOVI per la revisione
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [provisionalPlanData, setProvisionalPlanData] = useState(null); // { index: [], distribution: [], pageMapping: {}, originalFilesInfo: [] }
  const [isFinalizing, setIsFinalizing] = useState(false); // Loading specifico per Fase 2 (finalizzazione)
  const [finalizationError, setFinalizationError] = useState('');

  // --- Inizializzazione Google Drive Service ---
  useEffect(() => {
    console.log('CreateProject: MOUNTED');
    let isMounted = true; // Flag per evitare setState su componente smontato

    const initService = async () => {
      console.log('CreateProject: useEffect - initializing Google Drive service');
      if (!isMounted) return; // Check iniziale
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
  }, []); // Array dipendenze vuoto per eseguire solo al mount


  // --- Funzioni Retry e Init ---
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
  const retryInitialization = () => { initServiceRetry(); };


  // --- Gestori Form e File ---
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: name === 'totalDays' ? parseInt(value, 10) || 1 : value // Assicura almeno 1 giorno, default a 1 se non numero
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
      setError(''); // Pulisci errore solo se non ce ne sono di nuovi
    }

    // Aggiungi solo i nuovi file validi e non duplicati
    setFiles(prevFiles => [...prevFiles, ...validFiles]);
  };

  const removeFile = (indexToRemove) => {
    setFiles(files.filter((_, index) => index !== indexToRemove));
  };


  // --- Funzione Callback Progresso ---
   const progressCallback = useCallback((update) => {
        console.log("Progress Update:", update);
        if (update.type === 'upload') {
          setUploadProgress(prev => ({ ...prev, [update.fileName]: { phase: update.phase, percent: update.percent } }));
        } else if (update.type === 'processing') {
          // Aggiorna il messaggio solo se la finalizzazione è in corso o se il loading generale è attivo
          if(isFinalizing || loading){
             setLoadingMessage(update.message);
          }
        } else if (update.type === 'error') {
          console.error("Progress Callback Error:", update.message);
        } else if (update.type === 'warning') {
            console.warn("Progress Callback Warning:", update.message);
        }
    }, [isFinalizing, loading]); // Dipende da isFinalizing e loading


  // --- handleSubmit (Fase 1: Generazione Provvisoria) ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('CreateProject V4: Form submitted for PROVISIONAL plan generation');
  
    setError(''); setSuccess(''); setLoading(true); setLoadingMessage('Verifica dati...');
    setUploadProgress({}); setProvisionalPlanData(null); setShowReviewModal(false); setFinalizationError('');
  
    if (!user) { setError('Utente non autenticato.'); setLoading(false); return; }
    if (!formData.title || !formData.examName || !formData.totalDays || formData.totalDays < 1) { setError('Completa Titolo, Esame, Giorni (> 0).'); setLoading(false); return; }
    if (files.length === 0) { setError('Carica almeno un PDF.'); setLoading(false); return; }
    if (!serviceStatus.ready) { setError('Servizio Google Drive non pronto.'); setLoading(false); return; }
    if (!genAI || !model) { setError('Servizio AI Gemini non inizializzato.'); setLoading(false); return; }
  
    setLoadingMessage('Preparazione file PDF...');
    try {
     // Prepara tutti i file una volta all'inizio
      await prepareFilesOnce(files);
      console.log('CreateProject: File PDF preparati con successo');
    } catch (prepError) {
      console.error('CreateProject: Errore preparazione file:', prepError);
      setError(`Errore preparazione file: ${prepError.message}`);
      setLoading(false);
      return;
      }


    console.log('CreateProject: Starting provisional plan generation sequence...');
    let contentIndex = null;
    let topicDistribution = null;
    let pageMapping = {};
  
    try {
      // --- FASE 1 - AI Passo 1: Generazione Indice dai PDF ---
      setLoadingMessage('AI - Analisi diretta dei PDF...');
      progressCallback({ type: 'processing', message: 'Analisi dei PDF con Gemini in corso...' });
      
      contentIndex = await generateContentIndexFromPDFs(formData.examName, files);
      if (!contentIndex || !contentIndex.tableOfContents || contentIndex.tableOfContents.length === 0) {
        throw new Error("AI non ha generato indice argomenti.");
      }
      progressCallback({ type: 'processing', message: 'Struttura argomenti identificata.' });
  
      // --- Crea mappatura pagine dai dati dell'indice generato ---
      let pageCounter = 1;
      pageMapping = {};
      
      // Crea una mappa file-specifici per tracciare quante pagine ha ogni file
      const filePageCounts = {};
      files.forEach((file, fileIndex) => {
        filePageCounts[fileIndex] = { fileName: file.name, fileIndex: fileIndex, estimatedPageCount: 0 };
      });
      
      // Popola pageMapping usando l'informazione dall'indice generato
      contentIndex.tableOfContents.forEach(topic => {
        if (topic.sourceFile && topic.startPage) {
          // Trova l'indice del file basato sul nome
          const fileIndex = files.findIndex(file => file.name === topic.sourceFile);
          if (fileIndex !== -1) {
            // Aggiorna il conteggio stimato delle pagine per questo file
            filePageCounts[fileIndex].estimatedPageCount = Math.max(
              filePageCounts[fileIndex].estimatedPageCount,
              topic.startPage
            );
            
            // Aggiungi l'entry alla pageMapping
            pageMapping[pageCounter] = {
              fileIndex: fileIndex,
              fileName: topic.sourceFile,
              pageNum: topic.startPage,
              text: `Inizio argomento: ${topic.title}`
            };
            pageCounter++;
          }
        }
      });
      
      // Assicurati che ci sia almeno una mappatura per ogni file
      Object.values(filePageCounts).forEach(fileInfo => {
        if (fileInfo.estimatedPageCount === 0) {
          // Se non abbiamo informazioni, usa una pagina placeholder
          pageMapping[pageCounter] = {
            fileIndex: fileInfo.fileIndex,
            fileName: fileInfo.fileName,
            pageNum: 1,
            text: `File: ${fileInfo.fileName}`
          };
          pageCounter++;
        }
      });
  
      // --- FASE 1 - AI Passo 2: Distribuzione ---
      setLoadingMessage('AI - Distribuzione argomenti...');
      topicDistribution = await distributeTopicsToDays(formData.examName, formData.totalDays, contentIndex.tableOfContents, formData.description);
      if (!topicDistribution || !topicDistribution.dailyPlan || topicDistribution.dailyPlan.length === 0) {
        throw new Error("AI non ha generato distribuzione giornaliera.");
      }
      progressCallback({ type: 'processing', message: 'Distribuzione giornaliera completata.' });
  
      // --- FASE 1 - Successo: Prepara dati e Apri Modale ---
      console.log('CreateProject: Provisional plan generated successfully. Opening review modal.');
      
      // Prepariamo le informazioni sui file originali (senza link a Drive)
      const originalFilesInfo = files.map((file, index) => ({
        name: file.name,
        size: file.size,
        type: file.type,
        originalFileIndex: index
      }));
      
      setProvisionalPlanData({
          index: contentIndex.tableOfContents,
          distribution: topicDistribution.dailyPlan,
          pageMapping: pageMapping,
          originalFilesInfo: originalFilesInfo
      });
      
      setLoading(false); // Fine loading Fase 1
      setLoadingMessage('');
      setShowReviewModal(true); // APRI IL MODALE!
  
    } catch (error) {
      console.error('CreateProject: Error during provisional plan generation phase:', error);
      setError(`Errore Fase 1: ${error.message}` || 'Errore imprevisto durante la generazione della bozza.');
      setSuccess('');
      setLoading(false); setLoadingMessage(''); setShowReviewModal(false);
    }
  };


  // --- handleConfirmReview (FASE 2: Finalizzazione) ---
  // handleConfirmReview modificato per usare i file locali
const handleConfirmReview = async (finalUserSelections) => {
  console.log('CreateProject: Starting Phase 2 - Finalization with user selections:', finalUserSelections);
  setShowReviewModal(false);
  setIsFinalizing(true);
  setLoadingMessage('Avvio finalizzazione e creazione materiale...');
  setFinalizationError('');
  setUploadProgress({}); // Resetta progress per i chunk

  // Recupera dati necessari dallo stato provvisorio e file originali
  const { index, distribution, pageMapping } = provisionalPlanData || {};
  const originalFileObjects = files; // ACCESSO AI FILE OBJECT ORIGINALI

  if (!index || !distribution || !pageMapping || !originalFileObjects || originalFileObjects.length === 0) {
    console.error("CreateProject/handleConfirmReview: Missing provisional data or original files in state.");
    setFinalizationError("Errore interno: dati necessari non trovati per finalizzare.");
    setIsFinalizing(false); setLoadingMessage(''); return;
  }

  // Prima di iniziare il processo, controlla che gli originalFileObjects siano disponibili
  if (!originalFileObjects || originalFileObjects.length === 0) {
    console.error("CreateProject/handleConfirmReview: Missing original file objects in state.");
    setFinalizationError("Errore interno: file originali non trovati.");
    setIsFinalizing(false); setLoadingMessage(''); return;
  }

  // Prepara informazioni sui file originali (senza richiedere driveFileId)
  const originalFilesInfo = originalFileObjects.map((file, index) => ({
    name: file.name,
    size: file.size,
    type: file.type,
    originalFileIndex: index
  }));

  const finalDailyPlanMap = {}; // Mappa Giorno -> [TopicID]
  const topicsDataForFirestore = []; // Array di oggetti Topic finali
  const indexTopicMap = index.reduce((map, topic) => { if(topic.title?.trim()) map[topic.title.trim()] = topic; return map; }, {});

  try {
    let totalChunksToCreate = 0;
    distribution.forEach(day => {
      (day.assignedTopics || []).forEach(topic => {
        const title = topic.title?.trim();
        if (title && !title.toLowerCase().includes("ripasso") && finalUserSelections[title]?.length > 0) {
          const pagesSelected = finalUserSelections[title];
          const fileIndicesInvolved = new Set(pagesSelected.map(pageNum => {
            const marker = Object.entries(pageMapping).find(([m, info]) => info.pageNum === pageNum && info.fileIndex !== undefined)?.[0];
            return marker ? pageMapping[marker]?.fileIndex : undefined;
          }).filter(idx => idx !== undefined));
          totalChunksToCreate += fileIndicesInvolved.size;
        }
      });
    });
    console.log(`CreateProject/handleConfirmReview: Estimated chunks to create: ${totalChunksToCreate}`);
    let chunksProcessedCount = 0;

    // Itera sulla DISTRIBUZIONE AI
    for (const dayPlan of distribution) {
      const dayNumber = dayPlan.day;
      if (!dayNumber) continue;
      finalDailyPlanMap[dayNumber] = []; // Inizializza array per il giorno

      // Salta/Gestisci giorni ripasso
      if (!dayPlan.assignedTopics || dayPlan.assignedTopics.length === 0 || dayPlan.assignedTopics.some(t => t.title?.toLowerCase().includes("ripasso"))) {
        if(dayPlan.assignedTopics && dayPlan.assignedTopics.length > 0){
          const reviewTopic = dayPlan.assignedTopics.find(t => t.title?.toLowerCase().includes("ripasso"));
          if (reviewTopic) {
            const topicId = uuidv4();
            finalDailyPlanMap[dayNumber].push(topicId);
            topicsDataForFirestore.push({
              id: topicId, title: reviewTopic.title, description: "Ripasso generale argomenti precedenti.",
              assignedDay: dayNumber, orderInDay: 0, isCompleted: false, sources: []
            });
          }
        }
        continue;
      }

      // Itera sugli argomenti assegnati al giorno
      for (const [topicIndexInDay, assignedTopic] of dayPlan.assignedTopics.entries()) {
        const topicTitle = assignedTopic.title?.trim();
        if (!topicTitle) continue;

        const topicId = uuidv4();
        finalDailyPlanMap[dayNumber].push(topicId);
        let topicSources = []; // Fonti finali per QUESTO topic

        // *** USA LE SELEZIONI UTENTE RICEVUTE DAL MODALE ***
        const selectedPageNumbers = finalUserSelections[topicTitle] || []; // Array di numeri pagina (1-based)

        console.log(`\n--- Finalizing Topic: "${topicTitle}" (Day ${dayNumber}) ---`);
        console.log(`[DEBUG] Finalize: User selected pages:`, JSON.stringify(selectedPageNumbers));

        // Se l'utente ha selezionato delle pagine, procedi con chunking
        if (selectedPageNumbers.length > 0) {
          // Raggruppa le pagine selezionate per file originale
          const pagesByFile = selectedPageNumbers.reduce((acc, pageNum) => {
            let fileIndexFound = -1;
            const mappingEntry = Object.values(pageMapping).find(info => info.pageNum === pageNum);
            if (mappingEntry) { fileIndexFound = mappingEntry.fileIndex; }
            else { console.warn(`[DEBUG] Finalize: Page number ${pageNum} selected for "${topicTitle}" not found in pageMapping!`); }

            if (fileIndexFound !== -1) {
              const fileIndexKey = String(fileIndexFound);
              if (!acc[fileIndexKey]) { acc[fileIndexKey] = { fileIndex: fileIndexFound, pages: [] }; }
              if (typeof pageNum === 'number' && !isNaN(pageNum)) { acc[fileIndexKey].pages.push(pageNum); }
            }
            return acc;
          }, {});
          console.log(`[DEBUG] Finalize: Selected pages grouped by source file for "${topicTitle}":`, pagesByFile);

          // Crea e carica chunk per ogni file coinvolto
          for (const fileIndexStr in pagesByFile) {
            chunksProcessedCount++;
            const fileData = pagesByFile[fileIndexStr];
            const fileIndex = parseInt(fileIndexStr, 10);
            const originalFile = originalFileObjects[fileIndex]; // File originale in memoria locale
            let pageNumbersForChunk = [...new Set(fileData.pages)].sort((a, b) => a - b);

            console.log(`[DEBUG] Finalize: File "${originalFile?.name}" - Chunk pages (1-based):`, JSON.stringify(pageNumbersForChunk));

            if (pageNumbersForChunk.length > 0 && originalFile) {
              const firstPage = pageNumbersForChunk[0];
              const lastPage = pageNumbersForChunk[pageNumbersForChunk.length - 1];
              console.log(`[DEBUG] Finalize: File "${originalFile?.name}" - firstPage: ${firstPage}, lastPage: ${lastPage}`);

              if (typeof firstPage === 'number' && typeof lastPage === 'number') {
                const safeTitlePart = topicTitle.substring(0, 15).replace(/[^a-zA-Z0-9]/g, '_');
                const chunkFileName = `${originalFile.name.replace(/\.pdf$/i, '')}_${safeTitlePart}_p${firstPage}-${lastPage}.pdf`;
                console.log(`[DEBUG] Finalize: Attempting to create chunk: "${chunkFileName}"`);
                try {
                  const progressMsgChunk = `Creazione/Upload chunk ${chunksProcessedCount}/${totalChunksToCreate}: ${chunkFileName.substring(0,30)}...`;
                  progressCallback({ type: 'processing', message: progressMsgChunk });

                  const chunkFile = await createPdfChunk(originalFile, pageNumbersForChunk, chunkFileName, (msg)=>progressCallback({type:'processing', message:msg}));
                  if (chunkFile) {
                    console.log(`[DEBUG] Finalize: Chunk ${chunkFileName} CREATED (size: ${chunkFile.size}). Uploading...`);
                    progressCallback({ type: 'processing', message: `Caricamento chunk ${chunkFileName}...` });
                    const uploadedChunk = await googleDriveService.uploadFile(chunkFile, (percent) => progressCallback({ type: 'upload', phase: 'chunk', fileName: chunkFileName, percent: percent }));
                    console.log(`[DEBUG] Finalize: Chunk ${chunkFileName} UPLOADED. Info:`, uploadedChunk);
                    topicSources.push({
                      type: 'pdf_chunk',
                      chunkDriveId: uploadedChunk.driveFileId || uploadedChunk.id,
                      chunkName: chunkFileName,
                      webViewLink: uploadedChunk.webViewLink,
                      // Rimuoviamo il riferimento all'originalFileId che richiederebbe il caricamento dell'originale 
                      originalFileName: originalFile.name,
                      pageStart: firstPage,
                      pageEnd: lastPage
                    });
                    progressCallback({ type: 'processing', message: `Chunk ${chunkFileName} caricato.` });
                  } else {
                    console.error(`[DEBUG] Finalize: createPdfChunk returned null for "${chunkFileName}".`);
                    topicSources.push({ 
                      type: 'error_chunk', 
                      name: chunkFileName, 
                      error: 'Creazione fallita (pdfProcessor)', 
                      originalFileName: originalFile.name 
                    });
                  }
                } catch (chunkError) {
                  console.error(`Finalize: ERROR during chunk handling for ${chunkFileName}`, chunkError);
                  progressCallback({ type: 'error', message: `Errore chunk ${chunkFileName}: ${chunkError.message}` });
                  topicSources.push({ 
                    type: 'error_chunk', 
                    name: chunkFileName, 
                    error: chunkError.message, 
                    originalFileName: originalFile.name 
                  });
                }
              } else {
                console.error(`[DEBUG] Finalize: Invalid firstPage (${firstPage}) or lastPage (${lastPage}) for chunk.`);
                topicSources.push({ 
                  type: 'error_chunk', 
                  name: `Chunk_ErrPag_${topicTitle.substring(0,10)}`, 
                  error: 'Pagine inizio/fine non valide', 
                  originalFileName: originalFile?.name 
                });
              }
            } else {
              console.warn(`[DEBUG] Finalize: Skipping chunk creation for file index ${fileIndexStr}. Invalid data. Pgs: ${pageNumbersForChunk?.join(',')}, FileObj: ${!!originalFile}`);
            }
          } // fine loop files per topic
        } else { // Se l'utente non ha selezionato pagine
          console.warn(`Finalize: No pages selected by user for topic "${topicTitle}" (Day ${dayNumber}). Applying fallback.`);
          // Fallback semplificato: non referenziamo file originali su Drive
          topicSources.push(...originalFilesInfo.map(f => ({ 
            type: 'fallback_reference', 
            name: f.name, 
            description: `File completo (pagine non specificate)`
          })));
        }

        console.log(`[DEBUG] Finalize: Final sources collected for topic "${topicTitle}" (Day ${dayNumber}):`, JSON.stringify(topicSources));

        // Prepara topic finale per Firestore
        topicsDataForFirestore.push({
          id: topicId,
          title: topicTitle,
          description: indexTopicMap[topicTitle]?.subTopics?.map(st => st.title).join(', ') || assignedTopic.description || '',
          assignedDay: dayNumber,
          orderInDay: topicIndexInDay, // Usa indice da loop `entries`
          isCompleted: false,
          sources: topicSources // Salva le fonti (chunk, errori o fallback)
        });
        console.log(`--- Finished Finalizing Topic: "${topicTitle}" ---`);
      } // fine loop assignedTopics
    } // fine loop giorni

    // --- Prepara dati progetto finale ---
    const projectCoreData = {
      title: formData.title, 
      examName: formData.examName, 
      totalDays: formData.totalDays,
      description: formData.description, 
      userId: user.uid,
      originalFiles: originalFilesInfo.map(({originalFileIndex, ...rest}) => rest), // Rimuovi indice temp
      aiModelUsed: 'gemini-1.5-flash-latest (2-step, reviewed)',
      dailyPlan: finalDailyPlanMap, // Mappa Giorno -> [TopicID] finale
    };

    // --- Salvataggio Finale su Firestore ---
    setLoadingMessage('Salvataggio finale del piano...');
    console.log("CreateProject/handleConfirmReview: Saving final plan to Firestore...");
    console.log("[DEBUG] Finalize: Final Project Data to Save:", projectCoreData);
    console.log("[DEBUG] Finalize: Final Topics Data to Save:", topicsDataForFirestore);
    const finalProjectId = await saveProjectWithPlan(projectCoreData, topicsDataForFirestore);
    console.log("CreateProject/handleConfirmReview: Final plan saved! Project ID:", finalProjectId);

    // Successo Finale
    setLoadingMessage('');
    setIsFinalizing(false);
    setSuccess('Piano finalizzato e materiale generato con successo! Reindirizzamento...');
    setTimeout(() => { navigate(`/projects/${finalProjectId}/plan`); }, 1500);

  } catch(error) {
    console.error("CreateProject/handleConfirmReview: Error during finalization phase:", error);
    setFinalizationError(`Errore Fase 2: ${error.message}` || 'Errore imprevisto durante la finalizzazione.');
    setIsFinalizing(false); setLoadingMessage('');
  }
};

  // --- Gestore Annulla Modale ---
  const handleCancelReview = () => {
      console.log("CreateProject: Review cancelled by user.");
      setShowReviewModal(false);
      setProvisionalPlanData(null);
  };

  // --- JSX ---
  return (
    <>
      <NavBar />
      <div className="create-project-wrapper">
        <div className="create-project-container">
          <div className="create-project-header">
            <h1 className="page-title">Genera Piano di Studio (AI + Revisione)</h1>
            <p className="page-subtitle">Carica i PDF, l'AI proporrà una struttura, tu confermerai le pagine.</p>
          </div>

           {/* Messaggi di Stato */}
           {error && !isFinalizing && (
                <div className="message error-message">
                    <AlertCircle size={20} /> <span>{error}</span>
                    {error.includes('Google Drive') && !serviceStatus.initializing && (
                       <button onClick={retryInitialization} className="retry-button" disabled={serviceStatus.initializing}> Riprova Init Drive </button>
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

          {/* Form */}
          <form className="create-project-form" onSubmit={handleSubmit}>
              <fieldset disabled={serviceStatus.initializing || loading || isFinalizing} style={{ border: 'none', padding: 0, margin: 0 }}>
                  <div className="form-grid">
                      {/* Sezione Info Base */}
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

                      {/* Sezione Materiale Studio */}
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
                              {/* Lista File e Progress Upload */}
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
                                                      {/* Barra progresso originale */}
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
                                      {/* Lista progress chunk */}
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

                   {/* Pulsante Submit (Avvia Fase 1) */}
                   <div className="form-actions">
                     <button type="button" className="cancel-btn" onClick={() => navigate('/projects')} > Annulla </button>
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

       {/* --- MODALE DI REVISIONE --- */}
       <PlanReviewModal
           isOpen={showReviewModal}
           provisionalPlanData={provisionalPlanData}
           originalFiles={files} // <-- Passa l'array di File object originali
           onConfirm={handleConfirmReview}
           onCancel={handleCancelReview}
           isFinalizing={isFinalizing}
           finalizationMessage={loadingMessage}
           finalizationError={finalizationError}
       />
    </>
  );
};
export default CreateProject;