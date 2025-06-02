// src/components/PlanReviewModal.jsx - VERSIONE SOLO CHUNKS
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import TopicDetailViewer from './TopicDetailViewer';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Loader, AlertCircle, Edit3, XCircle, Calendar, BookOpen, Info, Save, FileText } from 'lucide-react';
import NavBar from './NavBar';
import './styles/PlanReviewModal.css';
import { createPdfChunk } from '../utils/pdfProcessor';
import { saveProjectWithPlan } from '../utils/firebase';
import { googleDriveService } from '../utils/googleDriveService';
import useGoogleAuth from '../hooks/useGoogleAuth';
import { v4 as uuidv4 } from 'uuid';

const PlanReviewModal = ({
    provisionalPlanData,
    originalFiles,
    onConfirm,
    onCancel,
    isFinalizing,
    finalizationMessage,
    finalizationError,
    projectData,
    totalDays
}) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useGoogleAuth();

    // Usa i dati dalla location se forniti
    const locationState = location.state || {};
    const provPlanData = provisionalPlanData || locationState.provisionalPlanData;
    const origFiles = originalFiles || locationState.originalFiles;
    const projData = projectData || locationState.projectData;
    const days = totalDays || (locationState.totalDays || (projData?.totalDays || 7));
    const isStandalone = !onConfirm || !onCancel;

    // State locale per modalità standalone
    const [localIsFinalizing, setLocalIsFinalizing] = useState(false);
    const [localFinalizationMessage, setLocalFinalizationMessage] = useState('');
    const [localFinalizationError, setLocalFinalizationError] = useState('');
    const [uploadProgress, setUploadProgress] = useState({});
    
    const effectiveIsFinalizing = isFinalizing || localIsFinalizing;
    const effectiveFinalizationMessage = finalizationMessage || localFinalizationMessage;
    const effectiveFinalizationError = finalizationError || localFinalizationError;

    // State per la selezione delle pagine e la validazione
    const [currentUserSelections, setCurrentUserSelections] = useState({});
    const [validationErrors, setValidationErrors] = useState({});
    
    // State per il visualizzatore dettagli
    const [selectedTopicForDetail, setSelectedTopicForDetail] = useState(null);
    
    // State per la distribuzione degli argomenti nei giorni
    const [dayAssignments, setDayAssignments] = useState({});
    const [unassignedTopics, setUnassignedTopics] = useState([]);

    // Memoized data from props/state
    const topics = useMemo(() => {
        return provPlanData?.index || [];
    }, [provPlanData]);

    const distribution = useMemo(() => {
        return provPlanData?.distribution || [];
    }, [provPlanData]);

    const progressCallback = useCallback((update) => {
        console.log("Progress Update:", update);
        if (update.type === 'upload') {
            setUploadProgress(prev => ({ ...prev, [update.fileName]: { phase: update.phase, percent: update.percent } }));
        } else if (update.type === 'processing') {
            if(localIsFinalizing){
                 setLocalFinalizationMessage(update.message);
            }
        }
    }, [localIsFinalizing]);

    // Initialize/Reset selections when data changes
    useEffect(() => {
        if (topics.length > 0 && origFiles && origFiles.length > 0) {
            console.log("PlanReviewModal: Initializing user selections. Topics count:", topics.length, "Original files count:", origFiles.length);
            
            const initialSelections = {};
            topics.forEach(topic => {
                if (!topic.title) return;
                
                if (topic.pages_info && Array.isArray(topic.pages_info)) {
                    initialSelections[topic.title] = topic.pages_info
                        .filter(pInfo => {
                            const isValidPInfo = typeof pInfo.pdf_index === 'number' &&
                                              pInfo.pdf_index >= 0 &&
                                              pInfo.pdf_index < origFiles.length &&
                                              typeof pInfo.start_page === 'number' &&
                                              typeof pInfo.end_page === 'number' &&
                                              pInfo.start_page > 0 &&
                                              pInfo.end_page >= pInfo.start_page;
                            return isValidPInfo;
                        })
                        .map(pInfo => {
                            const pages = [];
                            for (let i = pInfo.start_page; i <= pInfo.end_page; i++) {
                                pages.push(i);
                            }
                            const fileName = origFiles[pInfo.pdf_index]?.name || pInfo.original_filename || 'Nome file sconosciuto';
                            return {
                                fileIndex: pInfo.pdf_index,
                                fileName: fileName,
                                pages: pages.sort((a, b) => a - b)
                            };
                        });
                } else {
                    initialSelections[topic.title] = [];
                }
            });
            setCurrentUserSelections(initialSelections);
            setValidationErrors({});
            
            initializeDayAssignments();
        }
    }, [topics, origFiles]);

    // Calcola il numero totale di pagine selezionate per un argomento
    const getTotalSelectedPages = useCallback((topicTitle) => {
        const selections = currentUserSelections[topicTitle] || [];
        return selections.reduce((total, fileEntry) => {
            return total + (fileEntry.pages?.length || 0);
        }, 0);
    }, [currentUserSelections]);

    // Inizializza la distribuzione degli argomenti nei giorni
    const initializeDayAssignments = useCallback(() => {
        const initialDays = {};
        for (let i = 1; i <= days; i++) {
            initialDays[i] = [];
        }
        
        const initialUnassigned = [];
        const assignedTopics = new Set();
        
        if (distribution && distribution.length > 0) {
            distribution.forEach(dayPlan => {
                const day = dayPlan.day;
                if (day && day <= days) {
                    const validTopics = (dayPlan.assignedTopics || [])
                        .filter(topic => {
                            const title = topic.title?.trim();
                            return title && !title.toLowerCase().includes("ripasso");
                        })
                        .map(topic => topic.title.trim());
                    
                    initialDays[day] = validTopics;
                    validTopics.forEach(title => assignedTopics.add(title));
                }
            });
        }
        
        topics.forEach(topic => {
            if (topic.title && !assignedTopics.has(topic.title)) {
                initialUnassigned.push(topic.title);
            }
        });
        
        setDayAssignments(initialDays);
        setUnassignedTopics(initialUnassigned);
    }, [distribution, topics, days]);

    // Gestisce il cambio di selezione delle pagine per un argomento
    const handlePageSelectionChangeForTopicAndFile = useCallback((topicTitle, fileIndexToUpdate, newSelectedPagesArray) => {
        console.log(`PlanReviewModal: Selection change for topic "${topicTitle}", fileIndex ${fileIndexToUpdate}. New pages:`, newSelectedPagesArray);
        
        setCurrentUserSelections(prevSelections => {
            const selectionsForTopic = prevSelections[topicTitle] ? [...prevSelections[topicTitle]] : [];
            const existingFileEntryIndex = selectionsForTopic.findIndex(entry => entry.fileIndex === fileIndexToUpdate);
    
            if (newSelectedPagesArray && newSelectedPagesArray.length > 0) {
                const sortedValidPages = [...newSelectedPagesArray]
                    .filter(pageNum => typeof pageNum === 'number' && !isNaN(pageNum) && pageNum > 0)
                    .sort((a, b) => a - b);
                    
                if (existingFileEntryIndex !== -1) {
                    selectionsForTopic[existingFileEntryIndex] = {
                        ...selectionsForTopic[existingFileEntryIndex],
                        pages: sortedValidPages
                    };
                } else {
                    selectionsForTopic.push({
                        fileIndex: fileIndexToUpdate,
                        fileName: origFiles[fileIndexToUpdate]?.name || `File Indice ${fileIndexToUpdate}`,
                        pages: sortedValidPages
                    });
                }
            } else if (existingFileEntryIndex !== -1) {
                selectionsForTopic.splice(existingFileEntryIndex, 1);
            }
            
            return { ...prevSelections, [topicTitle]: selectionsForTopic };
        });
    
        setValidationErrors(prev => { 
            const newErrors = { ...prev }; 
            delete newErrors[topicTitle]; 
            return newErrors; 
        });
    }, [origFiles]);

    // Gestione drag and drop
    const handleDragEnd = (result) => {
        const { source, destination } = result;
        
        if (!destination) return;
        
        const getItemFromSource = () => {
            if (source.droppableId === 'unassigned') {
                return unassignedTopics[source.index];
            } else {
                return dayAssignments[source.droppableId]?.[source.index];
            }
        };
         
        const draggedItem = getItemFromSource();
        if (!draggedItem) return;
        
        const newUnassigned = [...unassignedTopics];
        const newDayAssignments = Object.entries(dayAssignments).reduce((acc, [day, topics]) => {
            acc[day] = [...topics];
            return acc;
        }, {});
        
        if (source.droppableId === 'unassigned') {
            newUnassigned.splice(source.index, 1);
        } else {
            if (newDayAssignments[source.droppableId]) {
                newDayAssignments[source.droppableId].splice(source.index, 1);
            }
        }
        
        if (destination.droppableId === 'unassigned') {
            newUnassigned.splice(destination.index, 0, draggedItem);
        } else {
            if (!newDayAssignments[destination.droppableId]) {
                newDayAssignments[destination.droppableId] = [];
            }
            newDayAssignments[destination.droppableId].splice(destination.index, 0, draggedItem);
        }
        
        setUnassignedTopics(newUnassigned);
        setDayAssignments(newDayAssignments);
    };

    // Gestisce l'apertura del visualizzatore dettagli
    const handleOpenTopicDetail = (topicTitle) => {
        setSelectedTopicForDetail(topicTitle);
    };

    // Gestisce la chiusura del visualizzatore dettagli
    const handleCloseTopicDetail = () => {
        setSelectedTopicForDetail(null);
    };

    // Validazione delle selezioni e preparazione dati per il salvataggio
    const validateAndPrepare = () => {
        console.log("PlanReviewModal: Validating selections. CurrentUserSelections:", currentUserSelections);
        const errors = {}; 
        let isValid = true;
        
        Object.keys(dayAssignments).forEach(day => {
            dayAssignments[day].forEach(topicTitle => {
                const selectionsForTopic = currentUserSelections[topicTitle];
                const hasSelections = selectionsForTopic && 
                    selectionsForTopic.some(fileEntry => fileEntry.pages && fileEntry.pages.length > 0);
                
                if (!hasSelections) {
                    console.log(`PlanReviewModal [Validation]: No pages selected for topic "${topicTitle}".`);
                    errors[topicTitle] = "Selezionare almeno una pagina per questo argomento.";
                    isValid = false;
                }
            });
        });
        
        unassignedTopics.forEach(topicTitle => {
            const selectionsForTopic = currentUserSelections[topicTitle];
            const hasSelections = selectionsForTopic && 
                selectionsForTopic.some(fileEntry => fileEntry.pages && fileEntry.pages.length > 0);
            
            if (!hasSelections) {
                console.log(`PlanReviewModal [Validation]: No pages selected for unassigned topic "${topicTitle}".`);
                errors[topicTitle] = "Selezionare almeno una pagina per questo argomento.";
                isValid = false;
            }
        });
        
        setValidationErrors(errors);
        
        if (isValid) {
            const formattedSelections = {};
            const finalDistribution = [];
            
            Object.entries(currentUserSelections).forEach(([topicTitle, fileEntries]) => {
                const validFileEntries = fileEntries.filter(entry => 
                    entry && entry.pages && Array.isArray(entry.pages) && entry.pages.length > 0
                );
                
                if (validFileEntries.length > 0) {
                    formattedSelections[topicTitle] = validFileEntries.map(entry => ({
                        fileIndex: entry.fileIndex,
                        fileName: entry.fileName,
                        pages: [...entry.pages].sort((a, b) => a - b)
                    }));
                }
            });
            
            Object.entries(dayAssignments).forEach(([day, assignedTopicTitles]) => {
                if (assignedTopicTitles.length > 0) {
                    finalDistribution.push({
                        day: parseInt(day),
                        assignedTopics: assignedTopicTitles.map(title => ({
                            title: title,
                            description: topics.find(t => t.title === title)?.description || ""
                        }))
                    });
                } else {
                    finalDistribution.push({
                        day: parseInt(day),
                        assignedTopics: []
                    });
                }
            });
            
            return {
                valid: true,
                selections: formattedSelections,
                distribution: finalDistribution
            };
        }
        
        const firstErrorKey = Object.keys(errors)[0];
        if (firstErrorKey) {
            console.warn("PlanReviewModal [validateAndPrepare]: Validation FAILED. First error on topic:", firstErrorKey);
            setSelectedTopicForDetail(firstErrorKey);
        }
        
        return { valid: false };
    };

    // 🚀 VERSIONE SOLO CHUNKS - Ultra Ottimizzata
    const handleChunksOnlySave = async (finalUserSelections, finalDistribution) => {
        console.log("PlanReviewModal: Starting CHUNKS-ONLY save process");
        setLocalIsFinalizing(true);
        setLocalFinalizationMessage('Inizializzazione servizio Google Drive...');
        setLocalFinalizationError('');
        setUploadProgress({});
        
        if (!user) {
            setLocalFinalizationError("Utente non autenticato. Impossibile salvare il progetto.");
            setLocalIsFinalizing(false);
            return;
        }
        
        if (!provPlanData || !origFiles || origFiles.length === 0 || !projData) {
            console.error("PlanReviewModal/handleChunksOnlySave: Missing necessary data for save");
            setLocalFinalizationError("Dati necessari mancanti per il salvataggio.");
            setLocalIsFinalizing(false);
            return;
        }
        
        const { index: aiGeneratedIndex } = provPlanData || {};
        const originalFileObjects = origFiles;
        
        // INIZIALIZZA DRIVE SERVICE
        try {
            setLocalFinalizationMessage('Inizializzazione Google Drive...');
            await googleDriveService.initialize();
        } catch (error) {
            console.error("PlanReviewModal/handleChunksOnlySave: Failed to initialize Google Drive service", error);
            setLocalFinalizationError(`Errore inizializzazione Google Drive: ${error.message}`);
            setLocalIsFinalizing(false);
            return;
        }
        
        const finalDailyPlanMap = {};
        const topicsDataForFirestore = [];
        
        const aiTopicDetailsMap = aiGeneratedIndex.reduce((map, topic) => {
            if (topic.title?.trim()) map[topic.title.trim()] = topic;
            return map;
        }, {});
        
        try {
            // 📊 CREA METADATI FILE ORIGINALI (senza caricamento)
            const originalFilesMetadata = originalFileObjects.map((file, index) => ({
                name: file.name,
                size: file.size,
                type: file.type,
                originalFileIndex: index,
                // ❌ NON CARICHIAMO I FILE ORIGINALI
                driveFileId: null,
                webViewLink: null,
                // ✅ SALVIAMO SOLO I METADATI
                storedAs: 'chunks_only'
            }));
            
            setLocalFinalizationMessage('File originali: salvati solo metadati (nessun caricamento)');
            
            // Calcola chunks da creare
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
            
            console.log(`PlanReviewModal/handleChunksOnlySave: Chunks to create: ${totalChunksToCreate}`);
            let chunksProcessedCount = 0;
            
            setLocalFinalizationMessage(`Creazione e caricamento di ${totalChunksToCreate} chunks...`);
            
            // 🎯 CREA E CARICA SOLO I CHUNKS NECESSARI
            for (const dayPlan of finalDistribution) {
                const dayNumber = dayPlan.day;
                if (!dayNumber) continue;
                finalDailyPlanMap[dayNumber] = [];
                
                // Gestione giorni ripasso
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
                
                for (const [topicIndexInDay, assignedTopic] of dayPlan.assignedTopics.entries()) {
                    const topicTitle = assignedTopic.title?.trim();
                    if (!topicTitle) continue;
                    
                    const topicId = uuidv4();
                    finalDailyPlanMap[dayNumber].push(topicId);
                    let topicSources = [];
                    const topicDetailsFromAI = aiTopicDetailsMap[topicTitle];
                    
                    const userSelectionsForTopic = finalUserSelections[topicTitle] || [];
                    
                    console.log(`\n--- Finalizing Topic (Chunks Only): "${topicTitle}" (Day ${dayNumber}) ---`);
                    
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
                    } 
                    else if (isReview) {
                        console.log(`[DEBUG] Finalize: Detected review topic "${topicTitle}" - no PDF chunks needed`);
                        topicSources = [{
                            type: 'note',
                            noteType: 'review',
                            description: 'Ripasso generale argomenti precedenti.'
                        }];
                    }
                    else {
                        if (userSelectionsForTopic.length > 0) {
                            // 🎯 CREA E CARICA SOLO I CHUNKS SELEZIONATI
                            for (const fileSelection of userSelectionsForTopic) {
                                const { fileIndex, fileName, pages } = fileSelection;
                                
                                if (!pages || pages.length === 0) continue;
                                
                                const originalFile = originalFileObjects[fileIndex];
                                const originalFileMetadata = originalFilesMetadata.find(f => f.originalFileIndex === fileIndex);
                                
                                if (!originalFile || !originalFileMetadata) {
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
                                    const progressMsg = `Chunk ${chunksProcessedCount}/${totalChunksToCreate}: ${chunkFileName.substring(0,35)}...`;
                                    setLocalFinalizationMessage(progressMsg);
                                    progressCallback({ type: 'processing', message: progressMsg });

                                    // Crea chunk PDF
                                    const chunkFile = await createPdfChunk(originalFile, sortedPages, chunkFileName, (msg) => progressCallback({type:'processing', message:msg}));
                                    
                                    if (chunkFile) {
                                        // Carica SOLO il chunk (non il file originale)
                                        const uploadedChunk = await googleDriveService.uploadFile(chunkFile, (percent) => progressCallback({ 
                                            type: 'upload', 
                                            phase: 'chunk', 
                                            fileName: chunkFileName, 
                                            percent: percent 
                                        }));
                                        
                                        topicSources.push({
                                            type: 'pdf_chunk',
                                            chunkDriveId: uploadedChunk.driveFileId || uploadedChunk.id,
                                            chunkName: chunkFileName,
                                            webViewLink: uploadedChunk.webViewLink,
                                            // ✅ RIFERIMENTO AI METADATI (non al file caricato)
                                            originalFileId: null, // Non caricato
                                            originalFileName: originalFileMetadata.name,
                                            originalFileSize: originalFileMetadata.size,
                                            pageStart: firstPage,
                                            pageEnd: lastPage
                                        });
                                        
                                        progressCallback({ type: 'processing', message: `✅ Chunk ${chunkFileName.substring(0,30)} caricato` });
                                    } else {
                                        topicSources.push({ 
                                            type: 'error_chunk', 
                                            name: chunkFileName, 
                                            error: 'Creazione fallita (pdfProcessor)', 
                                            originalFileName: originalFileMetadata.name 
                                        });
                                    }
                                } catch (chunkError) {
                                    console.error(`Finalize: ERROR during chunk handling for ${chunkFileName}`, chunkError);
                                    progressCallback({ type: 'error', message: `❌ Errore chunk ${chunkFileName}: ${chunkError.message}` });
                                    
                                    topicSources.push({ 
                                        type: 'error_chunk', 
                                        name: chunkFileName, 
                                        error: chunkError.message, 
                                        originalFileName: originalFileMetadata.name 
                                    });
                                }
                            }
                        } else {
                            console.warn(`Finalize: No user selections for topic "${topicTitle}" (Day ${dayNumber}). Adding metadata reference.`);
                            // Aggiungi riferimento ai metadati invece del file completo
                            topicSources.push(...originalFilesMetadata.map(f => ({ 
                                type: 'pdf_metadata', 
                                originalFileName: f.name,
                                originalFileSize: f.size,
                                note: 'File originale non caricato - solo metadati disponibili'
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
                    console.log(`--- Finished Finalizing Topic (Chunks Only): "${topicTitle}" ---`);
                }
            }

            // Prepara i dati del progetto
            const projectCoreData = {
               title: projData.title, 
               examName: projData.examName, 
               totalDays: days,
               description: projData.description, 
               userId: user.uid,
               // ✅ SALVA SOLO METADATI FILE ORIGINALI
               originalFiles: originalFilesMetadata,
               aiModelUsed: 'gemini-1.5-flash-latest (chunks-only optimized)', 
               dailyPlan: finalDailyPlanMap,
               storageMode: 'chunks_only' // Flag per indicare che abbiamo solo chunks
            };

            // Salvataggio su Firestore
            setLocalFinalizationMessage('Salvataggio finale del piano su Firebase...');
            console.log("PlanReviewModal/handleChunksOnlySave: Saving chunks-only plan to Firestore...");
            const finalProjectId = await saveProjectWithPlan(projectCoreData, topicsDataForFirestore);
            console.log("PlanReviewModal/handleChunksOnlySave: Chunks-only plan saved! Project ID:", finalProjectId);

            setLocalFinalizationMessage('✅ Piano salvato con successo (solo chunks)!');
            setLocalIsFinalizing(false);
            
            // Reindirizzamento
            setTimeout(() => {
                navigate(`/projects/${finalProjectId}/plan`);
            }, 1500);

        } catch(error) {
            console.error("PlanReviewModal/handleChunksOnlySave: Error during chunks-only finalization:", error);
            setLocalFinalizationError(`Errore durante il salvataggio: ${error.message}` || 'Errore imprevisto durante la finalizzazione.');
            setLocalIsFinalizing(false);
        }
    };

    // Gestisce la conferma finale
    const handleConfirm = () => {
        const result = validateAndPrepare();
        if (result.valid) {
            if (onConfirm) {
                // Se usato come modale, usa la funzione prop
                onConfirm(result.selections, result.distribution);
            } else {
                // Se usato come pagina autonoma - VERSIONE CHUNKS-ONLY
                console.log("PlanReviewModal: Executing CHUNKS-ONLY save process");
                handleChunksOnlySave(result.selections, result.distribution);
            }
        }
    };

    // Gestisce l'annullamento
    const handleCancel = () => {
        if (onCancel) {
            onCancel();
        } else {
            navigate('/create-project');
        }
    };

    // Se i dati non sono pronti, mostra un messaggio di caricamento
    if (!provPlanData || !origFiles) {
        return (
            <div className="plan-review-loading">
                <Loader size={32} className="spin-icon" />
                <span>Caricamento dati in corso...</span>
            </div>
        );
    }

    return (
        <>
            <div className="plan-review-screen">
                <div className="plan-review-header">
                    <h1>Revisione Piano di Studio</h1>
                    <p className="subtitle">Trascina gli argomenti per organizzare il tuo piano. Clicca su un argomento per selezionare le pagine da studiare.</p>
                </div>

                {effectiveIsFinalizing && (
                    <div className="status-message loading">
                        <Loader size={20} className="spin-icon" />
                        <span>{effectiveFinalizationMessage || 'Finalizzazione...'}</span>
                    </div>
                )}
                
                {effectiveFinalizationError && !effectiveIsFinalizing && (
                    <div className="status-message error">
                        <AlertCircle size={20} />
                        <span>{effectiveFinalizationError}</span>
                    </div>
                )}

                <div className="plan-review-content">
                    <DragDropContext onDragEnd={handleDragEnd}>
                        <div className="plan-days-container">
                            {Object.keys(dayAssignments)
                                .sort((a, b) => parseInt(a) - parseInt(b))
                                .map(day => (
                                    <Droppable droppableId={day} key={`day-${day}`}>
                                        {(provided, snapshot) => (
                                            <div 
                                                ref={provided.innerRef}
                                                {...provided.droppableProps}
                                                className={`plan-day ${snapshot.isDraggingOver ? 'dragging-over' : ''}`}
                                            >
                                                <h3 className="day-header">
                                                    <Calendar size={18} />
                                                    <span>Giorno {day}</span>
                                                    <span className="topic-count">{dayAssignments[day].length} argomenti</span>
                                                </h3>
                                                <div className="day-topics">
                                                    {dayAssignments[day].length === 0 ? (
                                                        <div className="empty-day-message">
                                                            <Info size={16} />
                                                            <span>Trascina qui gli argomenti</span>
                                                        </div>
                                                    ) : (
                                                        dayAssignments[day].map((topicTitle, index) => (
                                                            <Draggable 
                                                                key={`topic-${topicTitle}-${day}-${index}`} 
                                                                draggableId={`topic-${topicTitle}-${day}-${index}`} 
                                                                index={index}
                                                                isDragDisabled={effectiveIsFinalizing}
                                                            >
                                                                {(provided, snapshot) => (
                                                                    <div
                                                                        ref={provided.innerRef}
                                                                        {...provided.draggableProps}
                                                                        {...provided.dragHandleProps}
                                                                        className={`topic-card ${snapshot.isDragging ? 'dragging' : ''} ${validationErrors[topicTitle] ? 'has-error' : ''}`}
                                                                        id={`topic-item-${topicTitle.replace(/\s+/g, '-')}`}
                                                                    >
                                                                        <div 
                                                                            className="topic-header"
                                                                            onClick={() => handleOpenTopicDetail(topicTitle)}
                                                                        >
                                                                            <Edit3 size={16} />
                                                                            <BookOpen size={14} />
                                                                            <h4>{topicTitle}</h4>
                                                                            
                                                                            <div className="topic-pages-count">
                                                                                <FileText size={12} />
                                                                                <span>{getTotalSelectedPages(topicTitle)} </span>
                                                                            </div>
                                                                            
                                                                            {validationErrors[topicTitle] && <AlertCircle size={16} className="error-icon" />}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </Draggable>
                                                        ))
                                                    )}
                                                    {provided.placeholder}
                                                </div>
                                            </div>
                                        )}
                                    </Droppable>
                                ))}
                        </div>

                        <div className="unassigned-container">
                            <h3 className="unassigned-header">Argomenti Non Assegnati</h3>
                            <Droppable droppableId="unassigned">
                                {(provided, snapshot) => (
                                    <div 
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                        className={`unassigned-topics ${snapshot.isDraggingOver ? 'dragging-over' : ''}`}
                                    >
                                        {unassignedTopics.length === 0 ? (
                                            <div className="empty-unassigned-message">
                                                <Info size={16} />
                                                <span>Tutti gli argomenti sono stati assegnati</span>
                                            </div>
                                        ) : (
                                            unassignedTopics.map((topicTitle, index) => (
                                                <Draggable 
                                                    key={`unassigned-${topicTitle}-${index}`} 
                                                    draggableId={`unassigned-${topicTitle}-${index}`} 
                                                    index={index}
                                                    isDragDisabled={effectiveIsFinalizing}
                                                >
                                                    {(provided, snapshot) => (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            {...provided.dragHandleProps}
                                                            className={`topic-card unassigned ${snapshot.isDragging ? 'dragging' : ''} ${validationErrors[topicTitle] ? 'has-error' : ''}`}
                                                            id={`topic-item-${topicTitle.replace(/\s+/g, '-')}`}
                                                        >
                                                            <div 
                                                                className="topic-header"
                                                                onClick={() => handleOpenTopicDetail(topicTitle)}
                                                            >
                                                                <Edit3 size={16} />
                                                                <BookOpen size={14} />
                                                                <h4>{topicTitle}</h4>
                                                                
                                                                <div className="topic-pages-count">
                                                                    <FileText size={12} />
                                                                    <span>{getTotalSelectedPages(topicTitle)} </span>
                                                                </div>
                                                                
                                                                {validationErrors[topicTitle] && <AlertCircle size={16} className="error-icon" />}
                                                            </div>
                                                        </div>
                                                    )}
                                                </Draggable>
                                            ))
                                        )}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </div>
                    </DragDropContext>
                </div>

                <div className="plan-review-actions">
                    <button 
                        className="cancel-button" 
                        onClick={handleCancel} 
                        disabled={effectiveIsFinalizing}
                    >
                        <XCircle size={18} />
                        Annulla
                    </button>
                    <button 
                        className="confirm-button" 
                        onClick={handleConfirm} 
                        disabled={effectiveIsFinalizing}
                    >
                        {effectiveIsFinalizing ? (
                            <>
                                <Loader size={18} className="spin-icon" />
                                Attendere...
                            </>
                        ) : (
                            <>
                                <Save size={18} />
                                Solo Chunks
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Visualizzatore dettagli separato */}
            {selectedTopicForDetail && (
                <TopicDetailViewer
                    topicTitle={selectedTopicForDetail}
                    topicDetails={topics.find(t => t.title === selectedTopicForDetail)}
                    originalFiles={origFiles}
                    currentUserSelections={currentUserSelections}
                    onPageSelectionChange={handlePageSelectionChangeForTopicAndFile}
                    onClose={handleCloseTopicDetail}
                    isFinalizing={effectiveIsFinalizing}
                />
            )}
        </>
    );
};

export default PlanReviewModal;