// src/components/PlanReviewModal.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import PageSelector from './PageSelector'; // Assicurati che questo possa gestire File object
import { Loader, AlertCircle, Edit3, XCircle, Calendar, BookOpen, ChevronDown, ChevronRight, Maximize2, X, ArrowLeft, ArrowRight } from 'lucide-react';

// Stili per il modale (come forniti)
const modalStyles = {
  overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' },
  content: { backgroundColor: 'white', padding: '25px 30px', borderRadius: '8px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', width: '95%', maxWidth: '950px', position: 'relative', boxShadow: '0 5px 15px rgba(0,0,0,0.2)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '15px'},
  closeButton: { position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 0, color: '#aaa', '&:hover': {color: '#333'} },
  body: { overflowY: 'auto', flexGrow: 1, paddingRight: '10px', marginRight: '-10px'}, // Per barra di scorrimento interna
  daySection: { marginBottom: '20px', border: '1px solid #eee', padding: '10px 15px', borderRadius: '5px', backgroundColor: '#fdfdfd' },
  dayHeader: { marginTop: 0, borderBottom: '1px solid #eee', paddingBottom: '8px', display: 'flex', alignItems: 'center', fontSize: '1.1em', fontWeight: '600', color: '#333' },
  topicItem: { marginBottom: '15px', paddingLeft: '10px', borderLeft: '3px solid #ffc107', paddingTop: '8px', paddingBottom: '8px' },
  topicTitle: { marginBottom: '8px', display: 'flex', alignItems: 'center', fontWeight: 'bold', fontSize: '1.05em', color: '#212529', cursor: 'pointer' },
  pageSelectorContainer: { marginTop: '10px', border: '1px solid #e0e0e0', borderRadius: '4px', padding: '10px' },
  pageSelectorHeader: { display:'flex', alignItems:'center', marginBottom:'8px', fontSize: '0.9em', fontWeight: '500' },
  suggestedPages: { fontSize: '0.8em', color: '#666', fontStyle: 'italic', marginBottom: '10px', marginTop:'5px' },
  actions: { marginTop: '20px', textAlign: 'right', borderTop: '1px solid #eee', paddingTop: '15px' },
  confirmButton: { padding: '8px 18px', fontSize: '1em', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginLeft: '10px' },
  cancelButton: { padding: '8px 18px', fontSize: '1em', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' },
  error: { color: '#dc3545', fontSize: '0.85em', marginTop: '5px', fontWeight: '500'},
  loadingBox: {marginBottom: '15px', padding: '10px', backgroundColor: '#e9ecef', borderRadius: '5px', display: 'flex', alignItems: 'center'},
  errorBox: {marginBottom: '15px', padding: '10px', backgroundColor: '#f8d7da', color: '#721c24', borderRadius: '5px', display: 'flex', alignItems: 'center'},
  openEditorButton: { display: 'inline-flex', alignItems: 'center', padding: '5px 12px', fontSize: '0.9em', backgroundColor: '#f8f9fa', color: '#0d6efd', border: '1px solid #dee2e6', borderRadius: '4px', cursor: 'pointer', marginTop: '8px', marginBottom: '8px', transition: 'all 0.2s' },
  fullscreenButton: { display: 'inline-flex', alignItems: 'center', padding: '5px 10px', fontSize: '0.85em', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginLeft: 'auto', marginRight: '5px' },
  fullscreenOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.9)', zIndex: 2000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  fullscreenHeader: { position: 'absolute', top: 0, left: 0, right: 0, padding: '15px 20px', backgroundColor: 'rgba(0, 0, 0, 0.7)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  fullscreenContent: { width: '90%', height: '80%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  fullscreenImage: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', boxShadow: '0 5px 15px rgba(0, 0, 0, 0.5)' },
  fullscreenNavigation: { position: 'absolute', bottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px', backgroundColor: 'rgba(0, 0, 0, 0.7)', borderRadius: '5px' },
  fullscreenNavButton: { background: 'none', border: 'none', color: 'white', cursor: 'pointer', margin: '0 15px', padding: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  fullscreenPageInfo: { color: 'white', margin: '0 15px', fontSize: '1.1em' },
  fullscreenCloseButton: { background: 'none', border: 'none', color: 'white', cursor: 'pointer' },
  pageSelectionControls: { display: 'flex', alignItems: 'center', gap: '10px' },
  fullscreenSelectButton: { padding: '6px 12px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '10px' },
  fullscreenUnselectButton: { padding: '6px 12px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }
};

const PlanReviewModal = ({
    isOpen,
    provisionalPlanData,
    originalFiles,
    onConfirm,
    onCancel,
    isFinalizing,
    finalizationMessage,
    finalizationError
}) => {
    console.log("PlanReviewModal: Props received -> isOpen:", isOpen, "provisionalPlanData exists:", !!provisionalPlanData, "originalFiles count:", originalFiles?.length, "OriginalFiles:", originalFiles);

    const [currentUserSelections, setCurrentUserSelections] = useState({});
    const [validationErrors, setValidationErrors] = useState({});
    const [expandedTopicId, setExpandedTopicId] = useState(null);
    const [fullscreenMode, setFullscreenMode] = useState(false);
    const [currentFullscreenData, setCurrentFullscreenData] = useState({
      topicTitle: '', fileIndex: -1, currentPage: 1, totalPagesInFile: 1, pageImages: [], selectedPagesInCurrentFile: []
    });

    // Memoized data from props
    const topics = useMemo(() => {
        const pTopics = provisionalPlanData?.index || [];
        console.log("PlanReviewModal: Memoized topics:", pTopics);
        return pTopics;
    }, [provisionalPlanData]);

    const distribution = useMemo(() => {
        const pDistribution = provisionalPlanData?.distribution || [];
        console.log("PlanReviewModal: Memoized distribution:", pDistribution);
        return pDistribution;
    }, [provisionalPlanData]);

    // Questo pageMapping è quello ricevuto da CreateProject.jsx
    // Potrebbe essere limitato o diverso da quello che ci si aspettava in passato.
    // Nel nuovo flusso di CreateProject, è un mapping pageCounter -> {fileIndex, fileName, pageNum (originale), text}
    // Non lo useremo più per derivare i range suggeriti qui, ma lo logghiamo per debug.
    const pageMappingFromProps = useMemo(() => {
        const pMapping = provisionalPlanData?.pageMapping || {};
        console.log("PlanReviewModal: Memoized pageMappingFromProps:", pMapping);
        return pMapping;
    }, [provisionalPlanData]);


    // Initialize/Reset selections when modal opens or data changes
    useEffect(() => {
        if (isOpen && topics.length > 0 && originalFiles && originalFiles.length > 0) {
            console.log("PlanReviewModal [useEffect isOpen]: Initializing user selections. Topics count:", topics.length, "Original files count:", originalFiles.length);
            const initialSelections = {};
            topics.forEach(topic => {
                if (!topic.title) {
                    console.warn("PlanReviewModal [useEffect isOpen]: Topic without title found:", topic);
                    return;
                }
                console.log(`PlanReviewModal [useEffect isOpen]: Processing topic "${topic.title}" for initial selections. Topic pages_info:`, topic.pages_info);

                if (topic.pages_info && Array.isArray(topic.pages_info)) {
                    initialSelections[topic.title] = topic.pages_info
                        .filter(pInfo => {
                            const isValidPInfo = typeof pInfo.pdf_index === 'number' &&
                                              pInfo.pdf_index >= 0 && // Aggiunto controllo >= 0
                                              pInfo.pdf_index < originalFiles.length &&
                                              typeof pInfo.start_page === 'number' && // Verificato che siano numeri
                                              typeof pInfo.end_page === 'number' &&
                                              pInfo.start_page > 0 && // Pagine sono 1-based
                                              pInfo.end_page >= pInfo.start_page;
                            if (!isValidPInfo) {
                                console.warn(`PlanReviewModal [useEffect isOpen]: Invalid or incomplete pInfo for topic "${topic.title}":`, pInfo, `originalFiles.length: ${originalFiles.length}`);
                            }
                            return isValidPInfo;
                        })
                        .map(pInfo => {
                            const pages = [];
                            for (let i = pInfo.start_page; i <= pInfo.end_page; i++) {
                                pages.push(i);
                            }
                            const fileName = originalFiles[pInfo.pdf_index]?.name || pInfo.original_filename || 'Nome file sconosciuto';
                            console.log(`PlanReviewModal [useEffect isOpen]: Topic "${topic.title}", file "${fileName}" (index ${pInfo.pdf_index}), initial pages derived from pages_info:`, pages);
                            return {
                                fileIndex: pInfo.pdf_index,
                                fileName: fileName,
                                pages: pages.sort((a, b) => a - b) // Assicura ordine
                            };
                        });
                } else {
                    console.log(`PlanReviewModal [useEffect isOpen]: No pages_info for topic "${topic.title}", initializing empty selection array.`);
                    initialSelections[topic.title] = [];
                }
            });
            setCurrentUserSelections(initialSelections);
            setValidationErrors({});
            // Espandi il primo topic che ha suggerimenti o il primo topic in assoluto
            const firstTopicWithSuggestions = topics.find(t => initialSelections[t.title]?.length > 0);
            const firstTopicTitle = firstTopicWithSuggestions?.title || topics[0]?.title;
            setExpandedTopicId(firstTopicTitle || null);
            console.log("PlanReviewModal [useEffect isOpen]: Initial currentUserSelections set:", JSON.parse(JSON.stringify(initialSelections)), "Expanded topic ID:", firstTopicTitle);
        } else if (!isOpen) {
            console.log("PlanReviewModal [useEffect isOpen]: Modal closed, resetting states.");
            setCurrentUserSelections({});
            setValidationErrors({});
            setExpandedTopicId(null);
            setFullscreenMode(false);
        }
    }, [isOpen, topics, originalFiles]); // Aggiunto originalFiles


    const handlePageSelectionChangeForTopicAndFile = useCallback((topicTitle, fileIndexToUpdate, newSelectedPagesArray) => {
        console.log(`PlanReviewModal: Selection change for topic "${topicTitle}", fileIndex ${fileIndexToUpdate}. New pages:`, newSelectedPagesArray);
        
        setCurrentUserSelections(prevSelections => {
            const selectionsForTopic = prevSelections[topicTitle] ? [...prevSelections[topicTitle]] : [];
            const existingFileEntryIndex = selectionsForTopic.findIndex(entry => entry.fileIndex === fileIndexToUpdate);
    
            if (newSelectedPagesArray && newSelectedPagesArray.length > 0) {
                // Ordina le pagine e assicura che siano tutte numeri validi
                const sortedValidPages = [...newSelectedPagesArray]
                    .filter(pageNum => typeof pageNum === 'number' && !isNaN(pageNum) && pageNum > 0)
                    .sort((a, b) => a - b);
                    
                if (existingFileEntryIndex !== -1) {
                    // Aggiorna entry esistente
                    selectionsForTopic[existingFileEntryIndex] = {
                        ...selectionsForTopic[existingFileEntryIndex],
                        pages: sortedValidPages
                    };
                } else {
                    // Aggiungi nuova entry
                    selectionsForTopic.push({
                        fileIndex: fileIndexToUpdate,
                        fileName: originalFiles[fileIndexToUpdate]?.name || `File Indice ${fileIndexToUpdate}`,
                        pages: sortedValidPages
                    });
                }
            } else if (existingFileEntryIndex !== -1) {
                // Rimuovi l'entry se non ci sono più pagine selezionate
                selectionsForTopic.splice(existingFileEntryIndex, 1);
            }
            
            console.log(`PlanReviewModal: Updated selections for topic "${topicTitle}":`, selectionsForTopic);
            return { ...prevSelections, [topicTitle]: selectionsForTopic };
        });
    
        setValidationErrors(prev => { 
            const newErrors = { ...prev }; 
            delete newErrors[topicTitle]; 
            return newErrors; 
        });
    
        if (fullscreenMode && currentFullscreenData.topicTitle === topicTitle && currentFullscreenData.fileIndex === fileIndexToUpdate) {
            console.log("PlanReviewModal: Updating fullscreen selected pages due to change.");
            setCurrentFullscreenData(prev => ({ 
                ...prev, 
                selectedPagesInCurrentFile: newSelectedPagesArray || [] 
            }));
        }
    }, [fullscreenMode, currentFullscreenData.topicTitle, currentFullscreenData.fileIndex, originalFiles]);


    const toggleTopicExpansion = (topicId) => {
        console.log(`PlanReviewModal: Toggling expansion for topicId "${topicId}". Current expanded: "${expandedTopicId}"`);
        setExpandedTopicId(prev => (prev === topicId ? null : topicId));
    };

    const enterFullscreenModeInternal = (topicTitle, fileIndex, pageImagesData, initialPage = 1, totalPagesInFile) => {
        console.log(`PlanReviewModal: Entering fullscreen for topic "${topicTitle}", fileIndex ${fileIndex}, initialPage ${initialPage}, totalPages ${totalPagesInFile}. Images count: ${pageImagesData?.length}`);
        const selectionsForTopic = currentUserSelections[topicTitle] || [];
        const fileSelectionEntry = selectionsForTopic.find(s => s.fileIndex === fileIndex);
        const selectedPgs = fileSelectionEntry ? fileSelectionEntry.pages : [];
        console.log(`PlanReviewModal: Selected pages for fullscreen (topic "${topicTitle}", fileIndex ${fileIndex}):`, selectedPgs);

        setCurrentFullscreenData({
            topicTitle,
            fileIndex,
            currentPage: initialPage,
            totalPagesInFile: totalPagesInFile || 1, // Assicura che non sia 0 o undefined
            pageImages: pageImagesData || [],
            selectedPagesInCurrentFile: selectedPgs
        });
        setFullscreenMode(true);
    };

    const exitFullscreenMode = useCallback(() => {
        console.log("PlanReviewModal: Exiting fullscreen mode.");
        setFullscreenMode(false);
    }, []);

    const goToNextPageFullscreen = useCallback(() => {
        setCurrentFullscreenData(prev => {
            const nextPage = Math.min(prev.currentPage + 1, prev.totalPagesInFile);
            console.log(`PlanReviewModal [Fullscreen]: Next page. From ${prev.currentPage} to ${nextPage}. Total: ${prev.totalPagesInFile}`);
            return {...prev, currentPage: nextPage };
        });
    }, []);

    const goToPrevPageFullscreen = useCallback(() => {
        setCurrentFullscreenData(prev => {
            const prevPage = Math.max(prev.currentPage - 1, 1);
            console.log(`PlanReviewModal [Fullscreen]: Prev page. From ${prev.currentPage} to ${prevPage}.`);
            return {...prev, currentPage: prevPage };
        });
    }, []);

    const togglePageSelectionFullscreen = useCallback(() => {
        const { topicTitle, fileIndex, currentPage, selectedPagesInCurrentFile } = currentFullscreenData;
        console.log(`PlanReviewModal [Fullscreen]: Toggling selection for page ${currentPage} of topic "${topicTitle}", fileIndex ${fileIndex}. Currently selected:`, selectedPagesInCurrentFile);
        const isSelected = selectedPagesInCurrentFile.includes(currentPage);
        let newSelectedPages;
        if (isSelected) {
            newSelectedPages = selectedPagesInCurrentFile.filter(p => p !== currentPage);
        } else {
            newSelectedPages = [...selectedPagesInCurrentFile, currentPage].sort((a, b) => a - b);
        }
        handlePageSelectionChangeForTopicAndFile(topicTitle, fileIndex, newSelectedPages);
    }, [currentFullscreenData, handlePageSelectionChangeForTopicAndFile]);

    const validateSelections = () => {
        console.log("PlanReviewModal: Validating selections. CurrentUserSelections:", currentUserSelections);
        const errors = {}; 
        let isValid = true;
        
        distribution.forEach(day => {
            (day.assignedTopics || []).forEach(assignedTopic => {
                const title = assignedTopic.title?.trim();
                if (title && !title.toLowerCase().includes("ripasso")) {
                    const selectionsForTopic = currentUserSelections[title];
                    // Verifica che ci sia almeno una selezione con pagine per questo topic
                    const hasSelections = selectionsForTopic && 
                        selectionsForTopic.some(fileEntry => fileEntry.pages && fileEntry.pages.length > 0);
                    
                    if (!hasSelections) {
                        console.log(`PlanReviewModal [Validation]: No pages selected for topic "${title}".`);
                        errors[title] = "Selezionare almeno una pagina per questo argomento.";
                        isValid = false;
                    }
                }
            });
        });
        
        setValidationErrors(errors);
        console.log("PlanReviewModal [Validation]: Validation result:", isValid, "Errors:", errors);
        return isValid;
    };

    const handleInternalConfirm = () => {
        if (validateSelections()) {
            console.log("PlanReviewModal [handleInternalConfirm]: Validation PASSED. Calling onConfirm with currentUserSelections:", JSON.parse(JSON.stringify(currentUserSelections)));
            
            // Assicura che la struttura dei dati sia esattamente quella attesa da CreateProject.js
            const formattedSelections = {};
            
            Object.entries(currentUserSelections).forEach(([topicTitle, fileEntries]) => {
                // Filtra solo le entries che hanno effettivamente delle pagine selezionate
                const validFileEntries = fileEntries.filter(entry => 
                    entry && entry.pages && Array.isArray(entry.pages) && entry.pages.length > 0
                );
                
                if (validFileEntries.length > 0) {
                    formattedSelections[topicTitle] = validFileEntries.map(entry => ({
                        fileIndex: entry.fileIndex,
                        fileName: entry.fileName,
                        pages: [...entry.pages].sort((a, b) => a - b) // Assicura l'ordine crescente
                    }));
                }
            });
            
            onConfirm(formattedSelections);
        } else {
            const firstErrorKey = Object.keys(validationErrors)[0];
            if (firstErrorKey) {
                console.warn("PlanReviewModal [handleInternalConfirm]: Validation FAILED. First error on topic:", firstErrorKey);
                setExpandedTopicId(firstErrorKey);
                const errorElement = document.getElementById(`topic-item-${firstErrorKey.replace(/\s+/g, '-')}`);
                errorElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!fullscreenMode) return;
            switch (e.key) {
                case 'Escape': exitFullscreenMode(); break;
                case 'ArrowRight': goToNextPageFullscreen(); break;
                case 'ArrowLeft': goToPrevPageFullscreen(); break;
                case ' ': e.preventDefault(); togglePageSelectionFullscreen(); break;
                default: break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [fullscreenMode, exitFullscreenMode, goToNextPageFullscreen, goToPrevPageFullscreen, togglePageSelectionFullscreen]);

    if (!isOpen) return null;
    if (!provisionalPlanData || !originalFiles) {
        console.warn("PlanReviewModal: Rendering null or loading message because provisionalPlanData or originalFiles is missing.");
        return ( <div style={modalStyles.overlay}><div style={modalStyles.content}>Caricamento dati modale o dati preliminari mancanti...</div></div> );
    }
    if (topics.length === 0 && distribution.length > 0) { // Se ci sono giorni ma non argomenti (improbabile se logica CreateProject è ok)
        console.warn("PlanReviewModal: No topics to display, but distribution exists. Might be an issue with AI content generation.");
    }
    if (originalFiles.length === 0 && topics.some(t => t.pages_info && t.pages_info.length > 0)) {
        console.error("PlanReviewModal: Topics have page_info referencing pdf_index, but originalFiles array is empty!");
    }

    return (
        <>
            <div style={modalStyles.overlay}>
                <div style={modalStyles.content}>
                    <div style={modalStyles.header}>
                        <h2>Revisione Piano e Pagine</h2>
                        <button onClick={onCancel} style={modalStyles.closeButton} disabled={isFinalizing} title="Annulla revisione"><XCircle size={22} color="#888" /></button>
                    </div>

                    {isFinalizing && ( <div style={modalStyles.loadingBox}><Loader size={20} className="spin-icon" style={{marginRight: '10px'}}/><span>{finalizationMessage || 'Finalizzazione...'}</span></div>)}
                    {finalizationError && !isFinalizing && ( <div style={modalStyles.errorBox}><AlertCircle size={20} style={{marginRight: '10px'}}/><span>{finalizationError}</span></div> )}

                    <div style={modalStyles.body}>
                        {console.log("PlanReviewModal: Rendering modal body. Distribution length:", distribution.length, "Topics length:", topics.length)}
                        {distribution.length === 0 && topics.length > 0 && <p>Nessun piano giornaliero generato, ma ci sono argomenti. Controlla la fase di distribuzione.</p>}
                        {distribution.map((dayPlan, dayIdx) => {
                            const dayKey = `day-${dayPlan.day || dayIdx}`;
                            const isReviewDay = dayPlan.assignedTopics?.length === 1 && dayPlan.assignedTopics[0].title?.toLowerCase().includes("ripasso");
                            const isEmptyNonReviewDay = (!dayPlan.assignedTopics || dayPlan.assignedTopics.length === 0) && !isReviewDay;

                            if (isEmptyNonReviewDay) {
                                console.log(`PlanReviewModal: Day ${dayPlan.day} is empty and not a review day, skipping render.`);
                                return null;
                            }

                            if (isReviewDay) {
                                console.log(`PlanReviewModal: Rendering Review Day ${dayPlan.day}.`);
                                return (
                                    <div key={dayKey} style={modalStyles.daySection}>
                                        <h3 style={modalStyles.dayHeader}><Calendar size={16} style={{marginRight:'6px'}}/> Giorno {dayPlan.day} - {dayPlan.assignedTopics[0].title}</h3>
                                        <p style={{marginLeft: '10px', fontStyle:'italic'}}>{dayPlan.assignedTopics[0].description || "Ripasso generale degli argomenti precedenti."}</p>
                                    </div>
                                );
                            }

                            console.log(`PlanReviewModal: Rendering Study Day ${dayPlan.day}. Assigned topics count: ${dayPlan.assignedTopics?.length}`);
                            return (
                                <div key={dayKey} style={modalStyles.daySection}>
                                    <h3 style={modalStyles.dayHeader}><Calendar size={16} style={{marginRight:'6px'}}/> Giorno {dayPlan.day}</h3>
                                    {(dayPlan.assignedTopics || []).map((assignedTopic) => {
                                        const title = assignedTopic.title?.trim();
                                        if (!title) return null;

                                        const topicDetails = topics.find(t => t.title === title);
                                        if (!topicDetails) {
                                            console.warn(`PlanReviewModal: Details not found in 'topics' for assigned topic title: "${title}". Assigned topic:`, assignedTopic);
                                            // Potresti voler mostrare comunque il titolo assegnato se i dettagli mancano
                                            // return <div key={`missing-details-${title}`} style={modalStyles.topicItem}>Topic (dettagli mancanti): {title}</div>;
                                        }
                                        const selectionsForThisTopic = currentUserSelections[title] || [];
                                        const errorMsg = validationErrors[title];
                                        const isExpanded = expandedTopicId === title;
                                        const totalSelectedPagesForTopic = selectionsForThisTopic.reduce((sum, s) => sum + s.pages.length, 0);

                                        console.log(`PlanReviewModal: Topic "${title}". Expanded: ${isExpanded}. Details:`, topicDetails, "Selections:", selectionsForThisTopic);

                                        return (
                                            <div key={title} id={`topic-item-${title.replace(/\s+/g, '-')}`} style={modalStyles.topicItem}>
                                                <div onClick={() => toggleTopicExpansion(title)} style={modalStyles.topicTitle} title="Espandi/Chiudi Dettagli">
                                                    {isExpanded ? <ChevronDown size={16} style={{color: '#555'}} /> : <ChevronRight size={16} style={{color: '#555'}} />}
                                                    <BookOpen size={14} style={{ margin: '0 6px' }}/> {title}
                                                    {totalSelectedPagesForTopic > 0 && <span className="page-count-badge" style={{marginLeft:'8px', fontSize:'0.8em', backgroundColor:'#e0e0e0', padding:'2px 6px', borderRadius:'4px'}}>{totalSelectedPagesForTopic} pag.</span>}
                                                    {errorMsg && <span style={{ color: '#dc3545', marginLeft: '8px', fontSize: '0.85em' }}>⚠️</span>}
                                                </div>

                                                {topicDetails?.description && <p style={{ fontSize: '0.9em', color: '#555', margin: '5px 0 8px 26px' }}>{topicDetails.description}</p>}

                                                {!isExpanded && (
                                                     <button onClick={(e) => { e.stopPropagation(); toggleTopicExpansion(title); }} style={modalStyles.openEditorButton}>
                                                        <Edit3 size={14} style={{marginRight: '5px'}} />
                                                        {totalSelectedPagesForTopic > 0 ? 'Modifica Pagine Selezionate' : 'Seleziona Pagine dall\'Originale'}
                                                    </button>
                                                )}

                                                {isExpanded && (
                                                    <div style={modalStyles.pageSelectorContainer}>
                                                        {console.log(`PlanReviewModal: Rendering PageSelectors for expanded topic "${title}". Topic details pages_info:`, topicDetails?.pages_info)}
                                                        {(!topicDetails?.pages_info || topicDetails.pages_info.length === 0) && (
                                                            <p style={modalStyles.suggestedPages}>L'AI non ha suggerito pagine specifiche per questo argomento. Puoi selezionarle manualmente dai file PDF disponibili qui sotto, se presenti.</p>
                                                        )}

                                                        {/* Sezione per pages_info suggerite dall'AI */}
                                                        {(topicDetails?.pages_info || []).map((pInfo, pInfoIdx) => {
                                                            console.log(`PlanReviewModal: Processing pInfo[${pInfoIdx}] for topic "${title}":`, pInfo);
                                                            if (typeof pInfo.pdf_index !== 'number' || pInfo.pdf_index < 0 || pInfo.pdf_index >= originalFiles.length) {
                                                                console.error(`PlanReviewModal: Invalid pdf_index in pInfo for topic "${title}". pdf_index: ${pInfo.pdf_index}, originalFiles length: ${originalFiles.length}`);
                                                                return <p key={`pinfo-err-${title}-${pInfoIdx}`} style={modalStyles.error}>Dati file sorgente non validi per questo suggerimento AI.</p>;
                                                            }
                                                            const relevantFile = originalFiles[pInfo.pdf_index];
                                                            if (!relevantFile) { // Doppio controllo
                                                                console.error(`PlanReviewModal: Could not find originalFile at index ${pInfo.pdf_index} for topic "${title}".`);
                                                                return <p key={`file-obj-err-${title}-${pInfoIdx}`} style={modalStyles.error}>Oggetto file originale non trovato per l'indice {pInfo.pdf_index}.</p>;
                                                            }
                                                            const currentFileSelections = selectionsForThisTopic.find(s => s.fileIndex === pInfo.pdf_index)?.pages || [];
                                                            console.log(`PlanReviewModal: For topic "${title}", pInfo file "${relevantFile.name}" (index ${pInfo.pdf_index}), PageSelector selectedPages prop:`, currentFileSelections);

                                                            return (
                                                                <div key={`selector-ai-${title}-${pInfo.pdf_index}`} className="page-selector-instance" style={{marginBottom: '15px'}}>
                                                                    <div style={modalStyles.pageSelectorHeader}>
                                                                        <Edit3 size={14} style={{ marginRight: '5px'}} />
                                                                        <strong>File (Suggerimento AI): {relevantFile.name}</strong>
                                                                        <button
                                                                            onClick={() => {
                                                                                const psId = `page-selector-${title.replace(/\s+/g, '-')}-ai-${pInfo.pdf_index}`;
                                                                                const pageSelectorInstance = document.getElementById(psId);
                                                                                if (pageSelectorInstance && pageSelectorInstance.__pageImages && typeof pageSelectorInstance.__totalPagesInFile === 'number') {
                                                                                    console.log(`PlanReviewModal: Entering fullscreen from AI suggestion for ${title}, file ${relevantFile.name}. Images: ${pageSelectorInstance.__pageImages.length}, Total Pages: ${pageSelectorInstance.__totalPagesInFile}`);
                                                                                    enterFullscreenModeInternal(title, pInfo.pdf_index, pageSelectorInstance.__pageImages, pInfo.start_page || 1, pageSelectorInstance.__totalPagesInFile);
                                                                                } else {
                                                                                     console.warn(`PlanReviewModal: Cannot enter fullscreen for ${psId}. pageImages or totalPagesInFile missing from instance.`, pageSelectorInstance?.__pageImages, pageSelectorInstance?.__totalPagesInFile);
                                                                                }
                                                                            }}
                                                                            style={modalStyles.fullscreenButton} title="Visualizza a schermo intero">
                                                                            <Maximize2 size={16} style={{marginRight: '5px'}} /> Schermo Intero
                                                                        </button>
                                                                    </div>
                                                                    <div style={modalStyles.suggestedPages}>
                                                                        (AI suggerisce Pagine Originali: {pInfo.start_page} - {pInfo.end_page})
                                                                    </div>
                                                                    <PageSelector
                                                                        id={`page-selector-${title.replace(/\s+/g, '-')}-ai-${pInfo.pdf_index}`}
                                                                        key={`key-ai-${title}-${relevantFile.name}-${pInfo.start_page}-${pInfo.end_page}`}
                                                                        pdfFile={relevantFile}
                                                                        suggestedStartPage={pInfo.start_page || 1}
                                                                        suggestedEndPage={pInfo.end_page || (pInfo.start_page || 0) + 9 } // Limita default se end_page manca
                                                                        selectedPages={currentFileSelections}
                                                                        onSelectionChange={(newSelection) => handlePageSelectionChangeForTopicAndFile(title, pInfo.pdf_index, newSelection)}
                                                                        isFinalizing={isFinalizing}
                                                                        onImagesReady={(pageImages, totalPages) => {
                                                                            console.log(`PlanReviewModal: PageSelector (AI) for "${title}" file "${relevantFile.name}" reported onImagesReady. Images count: ${pageImages?.length}, Total pages: ${totalPages}`);
                                                                            const psId = `page-selector-${title.replace(/\s+/g, '-')}-ai-${pInfo.pdf_index}`;
                                                                            const pageSelectorInstance = document.getElementById(psId);
                                                                            if (pageSelectorInstance) {
                                                                                pageSelectorInstance.__pageImages = pageImages;
                                                                                pageSelectorInstance.__totalPagesInFile = totalPages;
                                                                            }
                                                                        }}
                                                                    />
                                                                </div>
                                                            );
                                                        })}

                                                        {/* Sezione per selezione manuale da TUTTI i file disponibili, se non ci sono pages_info */}
                                                        {(!topicDetails?.pages_info || topicDetails.pages_info.length === 0) && originalFiles.map((file, manualFileIndex) => {
                                                            console.log(`PlanReviewModal: Rendering MANUAL PageSelector for topic "${title}", file "${file.name}" (index ${manualFileIndex}) because no AI pages_info.`);
                                                            const currentManualFileSelections = selectionsForThisTopic.find(s => s.fileIndex === manualFileIndex)?.pages || [];
                                                            return (
                                                                <div key={`selector-manual-${title}-${manualFileIndex}`} className="page-selector-instance" style={{ marginTop: '10px', borderTop: '1px dashed #ccc', paddingTop: '10px'}}>
                                                                    <div style={modalStyles.pageSelectorHeader}>
                                                                        <Edit3 size={14} style={{ marginRight: '5px'}} />
                                                                        <strong>Seleziona da File: {file.name}</strong>
                                                                         <button
                                                                            onClick={() => {
                                                                                const psId = `page-selector-${title.replace(/\s+/g, '-')}-manual-${manualFileIndex}`;
                                                                                const pageSelectorInstance = document.getElementById(psId);
                                                                                if (pageSelectorInstance && pageSelectorInstance.__pageImages && typeof pageSelectorInstance.__totalPagesInFile === 'number') {
                                                                                    console.log(`PlanReviewModal: Entering fullscreen from MANUAL selection for ${title}, file ${file.name}. Images: ${pageSelectorInstance.__pageImages.length}, Total Pages: ${pageSelectorInstance.__totalPagesInFile}`);
                                                                                    enterFullscreenModeInternal(title, manualFileIndex, pageSelectorInstance.__pageImages, 1, pageSelectorInstance.__totalPagesInFile);
                                                                                } else {
                                                                                     console.warn(`PlanReviewModal: Cannot enter fullscreen for ${psId}. pageImages or totalPagesInFile missing from instance.`, pageSelectorInstance?.__pageImages, pageSelectorInstance?.__totalPagesInFile);
                                                                                }
                                                                            }}
                                                                            style={modalStyles.fullscreenButton} title="Visualizza a schermo intero">
                                                                            <Maximize2 size={16} style={{marginRight: '5px'}} /> Schermo Intero
                                                                        </button>
                                                                    </div>
                                                                    <PageSelector
                                                                        id={`page-selector-${title.replace(/\s+/g, '-')}-manual-${manualFileIndex}`}
                                                                        key={`key-manual-${title}-${file.name}`}
                                                                        pdfFile={file}
                                                                        suggestedStartPage={1} // Per selezione manuale, suggerisci dall'inizio
                                                                        suggestedEndPage={10} // e un range di default
                                                                        selectedPages={currentManualFileSelections}
                                                                        onSelectionChange={(newSelection) => handlePageSelectionChangeForTopicAndFile(title, manualFileIndex, newSelection)}
                                                                        isFinalizing={isFinalizing}
                                                                        onImagesReady={(pageImages, totalPages) => {
                                                                            console.log(`PlanReviewModal: PageSelector (Manual) for "${title}" file "${file.name}" reported onImagesReady. Images: ${pageImages?.length}, Total pages: ${totalPages}`);
                                                                            const psId = `page-selector-${title.replace(/\s+/g, '-')}-manual-${manualFileIndex}`;
                                                                            const pageSelectorInstance = document.getElementById(psId);
                                                                            if (pageSelectorInstance) {
                                                                                pageSelectorInstance.__pageImages = pageImages;
                                                                                pageSelectorInstance.__totalPagesInFile = totalPages;
                                                                            }
                                                                        }}
                                                                    />
                                                                </div>
                                                            );
                                                        })}
                                                        {validationErrors[title] && <p style={modalStyles.error}>{validationErrors[title]}</p>}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                        {distribution.length === 0 && <p>Il piano giornaliero non è stato ancora generato o è vuoto.</p>}
                    </div>

                    <div style={modalStyles.actions}>
                        <button onClick={onCancel} style={modalStyles.cancelButton} disabled={isFinalizing}>Annulla</button>
                        <button onClick={handleInternalConfirm} style={{...modalStyles.confirmButton, opacity: isFinalizing ? 0.6 : 1}} disabled={isFinalizing}>
                            {isFinalizing ? <><Loader size={16} className="spin-icon" style={{marginRight:'8px'}} /> Attendere...</> : 'Conferma e Genera'}
                        </button>
                    </div>
                </div>
            </div>

            {fullscreenMode && currentFullscreenData.pageImages && currentFullscreenData.pageImages.length > 0 && (
                <div style={modalStyles.fullscreenOverlay} onClick={(e) => { if(e.target === e.currentTarget) { console.log("Fullscreen: Overlay clicked, exiting."); exitFullscreenMode(); } }}>
                    <div style={modalStyles.fullscreenHeader}>
                        <h3 style={{margin: 0, fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                            {currentFullscreenData.topicTitle} (File: {originalFiles[currentFullscreenData.fileIndex]?.name || 'Sconosciuto'})
                        </h3>
                        <button onClick={() => { console.log("Fullscreen: Close button clicked."); exitFullscreenMode(); }} style={modalStyles.fullscreenCloseButton} title="Chiudi (Esc)"> <X size={24} /> </button>
                    </div>
                    <div style={modalStyles.fullscreenContent}>
                        {console.log("Fullscreen: Rendering page image for current page:", currentFullscreenData.currentPage, "Image URL/data (first 50 chars):", currentFullscreenData.pageImages[currentFullscreenData.currentPage - 1]?.substring(0,50) + "..." )}
                        <img
                            src={currentFullscreenData.pageImages[currentFullscreenData.currentPage - 1]}
                            alt={`Pagina ${currentFullscreenData.currentPage} di ${originalFiles[currentFullscreenData.fileIndex]?.name}`}
                            style={modalStyles.fullscreenImage}
                            onError={(e) => console.error("Fullscreen: Error loading image for page", currentFullscreenData.currentPage, "from file", originalFiles[currentFullscreenData.fileIndex]?.name, e)}
                        />
                        <div style={modalStyles.fullscreenNavigation}>
                            <button onClick={() => { console.log("Fullscreen: Prev page clicked."); goToPrevPageFullscreen(); }} style={{...modalStyles.fullscreenNavButton, opacity: currentFullscreenData.currentPage <= 1 ? 0.5 : 1}} disabled={currentFullscreenData.currentPage <= 1} title="Pagina Precedente (←)"> <ArrowLeft size={24} /> </button>
                            <div style={modalStyles.pageSelectionControls}>
                                {(currentFullscreenData.selectedPagesInCurrentFile || []).includes(currentFullscreenData.currentPage) ? (
                                    <button onClick={() => { console.log("Fullscreen: Unselect page clicked for page", currentFullscreenData.currentPage); togglePageSelectionFullscreen(); }} style={modalStyles.fullscreenUnselectButton} title="Rimuovi Selezione (Spazio)"> Deseleziona Pagina {currentFullscreenData.currentPage} </button>
                                ) : (
                                    <button onClick={() => { console.log("Fullscreen: Select page clicked for page", currentFullscreenData.currentPage); togglePageSelectionFullscreen(); }} style={modalStyles.fullscreenSelectButton} title="Seleziona Pagina (Spazio)"> Seleziona Pagina {currentFullscreenData.currentPage} </button>
                                )}
                            </div>
                            <div style={modalStyles.fullscreenPageInfo}> {currentFullscreenData.currentPage} / {currentFullscreenData.totalPagesInFile || '?'} </div>
                            <button onClick={() => { console.log("Fullscreen: Next page clicked."); goToNextPageFullscreen(); }} style={{...modalStyles.fullscreenNavButton, opacity: currentFullscreenData.currentPage >= (currentFullscreenData.totalPagesInFile || 1) ? 0.5 : 1}} disabled={currentFullscreenData.currentPage >= (currentFullscreenData.totalPagesInFile || 1)} title="Pagina Successiva (→)"> <ArrowRight size={24} /> </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default PlanReviewModal;