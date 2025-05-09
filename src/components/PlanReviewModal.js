// src/components/PlanReviewModal.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import PageSelector from './PageSelector';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Loader, AlertCircle, Edit3, XCircle, Calendar, BookOpen, ChevronDown, ChevronRight, Maximize2, X, ArrowLeft, ArrowRight, Info, Save, FileText } from 'lucide-react';
import NavBar from './NavBar';
import './styles/PlanReviewModal.css';

const PlanReviewModal = ({
    provisionalPlanData,
    originalFiles,
    onConfirm,
    onCancel,
    isFinalizing,
    finalizationMessage,
    finalizationError,
    projectData,
    totalDays // Numero di giorni specificato nel form
}) => {
    const navigate = useNavigate();
    const location = useLocation();

    // Usa i dati dalla location se forniti (quando viene aperto come pagina)
    const locationState = location.state || {};
    const provPlanData = provisionalPlanData || locationState.provisionalPlanData;
    const origFiles = originalFiles || locationState.originalFiles;
    const projData = projectData || locationState.projectData;
    const days = totalDays || (locationState.totalDays || (projData?.totalDays || 7));
    const isStandalone = !onConfirm || !onCancel; // True se usato come pagina standalone

    // State locale
    const [localIsFinalizing, setLocalIsFinalizing] = useState(false);
    const [localFinalizationMessage, setLocalFinalizationMessage] = useState('');
    const [localFinalizationError, setLocalFinalizationError] = useState('');
    
    // Usa il valore appropriato in base alla modalità
    const effectiveIsFinalizing = isFinalizing || localIsFinalizing;
    const effectiveFinalizationMessage = finalizationMessage || localFinalizationMessage;
    const effectiveFinalizationError = finalizationError || localFinalizationError;

    // State per la selezione delle pagine e la validazione
    const [currentUserSelections, setCurrentUserSelections] = useState({});
    const [validationErrors, setValidationErrors] = useState({});
    const [expandedTopicId, setExpandedTopicId] = useState(null);
    // State per la visualizzazione a schermo intero delle pagine
    const [fullscreenMode, setFullscreenMode] = useState(false);
    const [currentFullscreenData, setCurrentFullscreenData] = useState({
        topicTitle: '', fileIndex: -1, currentPage: 1, totalPagesInFile: 1, pageImages: [], selectedPagesInCurrentFile: []
    });
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

    // Initialize/Reset selections when data changes
    useEffect(() => {
        if (topics.length > 0 && origFiles && origFiles.length > 0) {
            console.log("PlanReviewModal: Initializing user selections. Topics count:", topics.length, "Original files count:", origFiles.length);
            
            // Inizializza le selezioni delle pagine per ogni argomento
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
            
            // Espandi il primo topic che ha suggerimenti o il primo topic in assoluto
            const firstTopicWithSuggestions = topics.find(t => initialSelections[t.title]?.length > 0);
            const firstTopicTitle = firstTopicWithSuggestions?.title || topics[0]?.title;
            setExpandedTopicId(firstTopicTitle || null);
            
            // Inizializza la distribuzione degli argomenti nei giorni
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
        // Crea un oggetto con il numero esatto di giorni specificato
        const initialDays = {};
        for (let i = 1; i <= days; i++) {
            initialDays[i] = [];
        }
        
        const initialUnassigned = [];
        const assignedTopics = new Set();
        
        // Assegna gli argomenti in base alla distribuzione iniziale dell'AI
        if (distribution && distribution.length > 0) {
            distribution.forEach(dayPlan => {
                const day = dayPlan.day;
                // Verifica che il giorno sia incluso nel nostro range
                if (day && day <= days) {
                    // Filtra argomenti di ripasso e aggiungi solo argomenti validi
                    const validTopics = (dayPlan.assignedTopics || [])
                        .filter(topic => {
                            // Escludiamo gli argomenti di ripasso
                            const title = topic.title?.trim();
                            return title && !title.toLowerCase().includes("ripasso");
                        })
                        .map(topic => topic.title.trim());
                    
                    // Aggiungi al giorno corrispondente
                    initialDays[day] = validTopics;
                    validTopics.forEach(title => assignedTopics.add(title));
                }
            });
        }
        
        // Aggiungi tutti gli argomenti che non sono stati assegnati all'elenco unassigned
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
                        fileName: origFiles[fileIndexToUpdate]?.name || `File Indice ${fileIndexToUpdate}`,
                        pages: sortedValidPages
                    });
                }
            } else if (existingFileEntryIndex !== -1) {
                // Rimuovi l'entry se non ci sono più pagine selezionate
                selectionsForTopic.splice(existingFileEntryIndex, 1);
            }
            
            return { ...prevSelections, [topicTitle]: selectionsForTopic };
        });
    
        setValidationErrors(prev => { 
            const newErrors = { ...prev }; 
            delete newErrors[topicTitle]; 
            return newErrors; 
        });
    
        if (fullscreenMode && currentFullscreenData.topicTitle === topicTitle && currentFullscreenData.fileIndex === fileIndexToUpdate) {
            setCurrentFullscreenData(prev => ({ 
                ...prev, 
                selectedPagesInCurrentFile: newSelectedPagesArray || [] 
            }));
        }
    }, [fullscreenMode, currentFullscreenData.topicTitle, currentFullscreenData.fileIndex, origFiles]);

    // Gestisce l'apertura/chiusura dei dettagli di un argomento
    const toggleTopicExpansion = (topicId) => {
        setExpandedTopicId(prev => (prev === topicId ? null : topicId));
    };

    // Implementazione ottimale della gestione drag and drop
    const handleDragEnd = (result) => {
        const { source, destination } = result;
        
        // Se non c'è destinazione, non fare nulla
        if (!destination) return;
        
        // Ottieni l'elemento da spostare in base alla sorgente
        const getItemFromSource = () => {
            if (source.droppableId === 'unassigned') {
                return unassignedTopics[source.index];
            } else {
                return dayAssignments[source.droppableId]?.[source.index];
            }
        };
        
        const draggedItem = getItemFromSource();
        if (!draggedItem) return; // Sicurezza extra
        
        // Copia profonda dello stato attuale
        const newUnassigned = [...unassignedTopics];
        const newDayAssignments = Object.entries(dayAssignments).reduce((acc, [day, topics]) => {
            acc[day] = [...topics]; // copia profonda di ogni array di giorno
            return acc;
        }, {});
        
        // 1. RIMUOVI dalla sorgente
        if (source.droppableId === 'unassigned') {
            newUnassigned.splice(source.index, 1);
        } else {
            if (newDayAssignments[source.droppableId]) {
                newDayAssignments[source.droppableId].splice(source.index, 1);
            }
        }
        
        // 2. AGGIUNGI alla destinazione
        if (destination.droppableId === 'unassigned') {
            newUnassigned.splice(destination.index, 0, draggedItem);
        } else {
            // Assicurati che esista l'array per quel giorno
            if (!newDayAssignments[destination.droppableId]) {
                newDayAssignments[destination.droppableId] = [];
            }
            newDayAssignments[destination.droppableId].splice(destination.index, 0, draggedItem);
        }
        
        // 3. AGGIORNA gli stati
        setUnassignedTopics(newUnassigned);
        setDayAssignments(newDayAssignments);
    };

    // Fullscreen mode functions
    const enterFullscreenModeInternal = (topicTitle, fileIndex, pageImagesData, initialPage = 1, totalPagesInFile) => {
        const selectionsForTopic = currentUserSelections[topicTitle] || [];
        const fileSelectionEntry = selectionsForTopic.find(s => s.fileIndex === fileIndex);
        const selectedPgs = fileSelectionEntry ? fileSelectionEntry.pages : [];

        setCurrentFullscreenData({
            topicTitle,
            fileIndex,
            currentPage: initialPage,
            totalPagesInFile: totalPagesInFile || 1,
            pageImages: pageImagesData || [],
            selectedPagesInCurrentFile: selectedPgs
        });
        setFullscreenMode(true);
    };

    const exitFullscreenMode = useCallback(() => {
        setFullscreenMode(false);
    }, []);

    const goToNextPageFullscreen = useCallback(() => {
        setCurrentFullscreenData(prev => {
            const nextPage = Math.min(prev.currentPage + 1, prev.totalPagesInFile);
            return {...prev, currentPage: nextPage };
        });
    }, []);

    const goToPrevPageFullscreen = useCallback(() => {
        setCurrentFullscreenData(prev => {
            const prevPage = Math.max(prev.currentPage - 1, 1);
            return {...prev, currentPage: prevPage };
        });
    }, []);

    const togglePageSelectionFullscreen = useCallback(() => {
        const { topicTitle, fileIndex, currentPage, selectedPagesInCurrentFile } = currentFullscreenData;
        const isSelected = selectedPagesInCurrentFile.includes(currentPage);
        let newSelectedPages;
        if (isSelected) {
            newSelectedPages = selectedPagesInCurrentFile.filter(p => p !== currentPage);
        } else {
            newSelectedPages = [...selectedPagesInCurrentFile, currentPage].sort((a, b) => a - b);
        }
        handlePageSelectionChangeForTopicAndFile(topicTitle, fileIndex, newSelectedPages);
    }, [currentFullscreenData, handlePageSelectionChangeForTopicAndFile]);

    // Keyboard event handlers for fullscreen mode
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

    // Validazione delle selezioni e preparazione dati per il salvataggio
    const validateAndPrepare = () => {
        console.log("PlanReviewModal: Validating selections. CurrentUserSelections:", currentUserSelections);
        const errors = {}; 
        let isValid = true;
        
        // Verifica che ogni argomento assegnato abbia delle pagine selezionate
        Object.keys(dayAssignments).forEach(day => {
            dayAssignments[day].forEach(topicTitle => {
                const selectionsForTopic = currentUserSelections[topicTitle];
                // Verifica che ci sia almeno una selezione con pagine per questo topic
                const hasSelections = selectionsForTopic && 
                    selectionsForTopic.some(fileEntry => fileEntry.pages && fileEntry.pages.length > 0);
                
                if (!hasSelections) {
                    console.log(`PlanReviewModal [Validation]: No pages selected for topic "${topicTitle}".`);
                    errors[topicTitle] = "Selezionare almeno una pagina per questo argomento.";
                    isValid = false;
                }
            });
        });
        
        // Verifica anche gli argomenti non assegnati, se presenti
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
            // Prepara i dati formattati per il salvataggio
            const formattedSelections = {};
            const finalDistribution = [];
            
            // Formatta le selezioni delle pagine
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
            
            // Crea la distribuzione finale in base alle assegnazioni attuali
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
                    // Includi anche i giorni vuoti
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
        
        // Se la validazione fallisce, scorri al primo errore
        const firstErrorKey = Object.keys(errors)[0];
        if (firstErrorKey) {
            console.warn("PlanReviewModal [validateAndPrepare]: Validation FAILED. First error on topic:", firstErrorKey);
            setExpandedTopicId(firstErrorKey);
            const errorElement = document.getElementById(`topic-item-${firstErrorKey.replace(/\s+/g, '-')}`);
            errorElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        
        return { valid: false };
    };

    // Gestisce la conferma finale
    const handleConfirm = () => {
        const result = validateAndPrepare();
        if (result.valid) {
            if (onConfirm) {
                // Se usato come modale, usa la funzione prop
                onConfirm(result.selections, result.distribution);
            } else {
                // Se usato come pagina autonoma
                console.log("PlanReviewModal: Gestione conferma come pagina autonoma");
                setLocalIsFinalizing(true);
                setLocalFinalizationMessage("Finalizzazione piano di studio...");
                
                // Per questo esempio, simulo un ritardo e poi navigo alla home
                setTimeout(() => {
                    setLocalIsFinalizing(false);
                    navigate('/projects');
                }, 2000);
            }
        }
    };

    // Gestisce l'annullamento
    const handleCancel = () => {
        if (onCancel) {
            onCancel();
        } else {
            // Se usato come pagina autonoma
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
                    <p className="subtitle">Trascina gli argomenti per organizzare il tuo piano. Espandi ogni argomento per selezionare le pagine da studiare.</p>
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
                                                                            onClick={() => toggleTopicExpansion(topicTitle)}
                                                                        >
                                                                            {expandedTopicId === topicTitle ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                                            <BookOpen size={14} />
                                                                            <h4>{topicTitle}</h4>
                                                                            
                                                                            {/* Mostra il numero di pagine selezionate */}
                                                                            <div className="topic-pages-count">
                                                                                <FileText size={12} />
                                                                                <span>{getTotalSelectedPages(topicTitle)} </span>
                                                                            </div>
                                                                            
                                                                            {validationErrors[topicTitle] && <AlertCircle size={16} className="error-icon" />}
                                                                        </div>

                                                                        {expandedTopicId === topicTitle && (
                                                                            <TopicDetailSection 
                                                                                topicTitle={topicTitle}
                                                                                topicDetails={topics.find(t => t.title === topicTitle)}
                                                                                originalFiles={origFiles}
                                                                                currentUserSelections={currentUserSelections}
                                                                                handlePageSelectionChangeForTopicAndFile={handlePageSelectionChangeForTopicAndFile}
                                                                                enterFullscreenModeInternal={enterFullscreenModeInternal}
                                                                                isFinalizing={effectiveIsFinalizing}
                                                                                validationError={validationErrors[topicTitle]}
                                                                            />
                                                                        )}
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
                                                                onClick={() => toggleTopicExpansion(topicTitle)}
                                                            >
                                                                {expandedTopicId === topicTitle ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                                <BookOpen size={14} />
                                                                <h4>{topicTitle}</h4>
                                                                
                                                                {/* Mostra il numero di pagine selezionate */}
                                                                <div className="topic-pages-count">
                                                                    <FileText size={12} />
                                                                    <span>{getTotalSelectedPages(topicTitle)} </span>
                                                                </div>
                                                                
                                                                {validationErrors[topicTitle] && <AlertCircle size={16} className="error-icon" />}
                                                            </div>

                                                            {expandedTopicId === topicTitle && (
                                                                <TopicDetailSection 
                                                                    topicTitle={topicTitle}
                                                                    topicDetails={topics.find(t => t.title === topicTitle)}
                                                                    originalFiles={origFiles}
                                                                    currentUserSelections={currentUserSelections}
                                                                    handlePageSelectionChangeForTopicAndFile={handlePageSelectionChangeForTopicAndFile}
                                                                    enterFullscreenModeInternal={enterFullscreenModeInternal}
                                                                    isFinalizing={effectiveIsFinalizing}
                                                                    validationError={validationErrors[topicTitle]}
                                                                />
                                                            )}
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
                                Conferma e Genera
                            </>
                        )}
                    </button>
                </div>
            </div>

            {fullscreenMode && currentFullscreenData.pageImages && currentFullscreenData.pageImages.length > 0 && (
                <div 
                    className="fullscreen-overlay" 
                    onClick={(e) => { if(e.target === e.currentTarget) exitFullscreenMode(); }}
                >
                    <div className="fullscreen-header">
                        <h3>
                            {currentFullscreenData.topicTitle} (File: {origFiles[currentFullscreenData.fileIndex]?.name || 'Sconosciuto'})
                        </h3>
                        <button 
                            onClick={exitFullscreenMode} 
                            className="fullscreen-close-button" 
                            title="Chiudi (Esc)"
                        >
                            <X size={24} />
                        </button>
                    </div>
                    <div className="fullscreen-content">
                        <img
                            src={currentFullscreenData.pageImages[currentFullscreenData.currentPage - 1]}
                            alt={`Pagina ${currentFullscreenData.currentPage} di ${origFiles[currentFullscreenData.fileIndex]?.name}`}
                            className="fullscreen-image"
                        />
                        <div className="fullscreen-navigation">
                            <button 
                                onClick={goToPrevPageFullscreen} 
                                className={`fullscreen-nav-button ${currentFullscreenData.currentPage <= 1 ? 'disabled' : ''}`}
                                disabled={currentFullscreenData.currentPage <= 1}
                                title="Pagina Precedente (←)"
                            >
                                <ArrowLeft size={24} />
                            </button>
                            <div className="page-selection-controls">
                                {(currentFullscreenData.selectedPagesInCurrentFile || []).includes(currentFullscreenData.currentPage) ? (
                                    <button 
                                        onClick={togglePageSelectionFullscreen} 
                                        className="fullscreen-unselect-button" 
                                        title="Rimuovi Selezione (Spazio)"
                                    >
                                        Deseleziona Pagina {currentFullscreenData.currentPage}
                                    </button>
                                ) : (
                                    <button 
                                        onClick={togglePageSelectionFullscreen} 
                                        className="fullscreen-select-button" 
                                        title="Seleziona Pagina (Spazio)"
                                    >
                                        Seleziona Pagina {currentFullscreenData.currentPage}
                                    </button>
                                )}
                            </div>
                            <div className="fullscreen-page-info">
                                {currentFullscreenData.currentPage} / {currentFullscreenData.totalPagesInFile || '?'}
                            </div>
                            <button 
                                onClick={goToNextPageFullscreen} 
                                className={`fullscreen-nav-button ${currentFullscreenData.currentPage >= (currentFullscreenData.totalPagesInFile || 1) ? 'disabled' : ''}`}
                                disabled={currentFullscreenData.currentPage >= (currentFullscreenData.totalPagesInFile || 1)}
                                title="Pagina Successiva (→)"
                            >
                                <ArrowRight size={24} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

// Componente per i dettagli di un argomento e la selezione delle pagine
const TopicDetailSection = ({
    topicTitle,
    topicDetails,
    originalFiles,
    currentUserSelections,
    handlePageSelectionChangeForTopicAndFile,
    enterFullscreenModeInternal,
    isFinalizing,
    validationError
}) => {
    if (!topicDetails) return <div className="topic-detail-error">Dettagli argomento non disponibili</div>;
    
    const selectionsForThisTopic = currentUserSelections[topicTitle] || [];
    
    return (
        <div className="topic-detail-section">
            {topicDetails?.description && (
                <p className="topic-description">{topicDetails.description}</p>
            )}
            
            <div className="page-selector-container">
                {(!topicDetails?.pages_info || topicDetails.pages_info.length === 0) && (
                    <p className="suggested-pages-note">L'AI non ha suggerito pagine specifiche per questo argomento. Puoi selezionarle manualmente dai file PDF disponibili qui sotto.</p>
                )}

                {/* Sezione per pages_info suggerite dall'AI */}
                {(topicDetails?.pages_info || []).map((pInfo, pInfoIdx) => {
                    if (typeof pInfo.pdf_index !== 'number' || pInfo.pdf_index < 0 || pInfo.pdf_index >= originalFiles.length) {
                        return <p key={`pinfo-err-${topicTitle}-${pInfoIdx}`} className="error-message">Dati file sorgente non validi per questo suggerimento AI.</p>;
                    }
                    
                    const relevantFile = originalFiles[pInfo.pdf_index];
                    if (!relevantFile) {
                        return <p key={`file-obj-err-${topicTitle}-${pInfoIdx}`} className="error-message">Oggetto file originale non trovato per l'indice {pInfo.pdf_index}.</p>;
                    }
                    
                    const currentFileSelections = selectionsForThisTopic.find(s => s.fileIndex === pInfo.pdf_index)?.pages || [];

                    return (
                        <div key={`selector-ai-${topicTitle}-${pInfo.pdf_index}`} className="page-selector-instance">
                            <div className="page-selector-header">
                                <Edit3 size={14} />
                                <strong>File (Suggerimento AI): {relevantFile.name}</strong>
                                <button
                                    onClick={() => {
                                        const psId = `page-selector-${topicTitle.replace(/\s+/g, '-')}-ai-${pInfo.pdf_index}`;
                                        const pageSelectorInstance = document.getElementById(psId);
                                        if (pageSelectorInstance && pageSelectorInstance.__pageImages && typeof pageSelectorInstance.__totalPagesInFile === 'number') {
                                            enterFullscreenModeInternal(topicTitle, pInfo.pdf_index, pageSelectorInstance.__pageImages, pInfo.start_page || 1, pageSelectorInstance.__totalPagesInFile);
                                        }
                                    }}
                                    className="fullscreen-button" 
                                    title="Visualizza a schermo intero"
                                >
                                    <Maximize2 size={16} /> Schermo Intero
                                </button>
                            </div>
                            <div className="suggested-pages">
                                (AI suggerisce Pagine Originali: {pInfo.start_page} - {pInfo.end_page})
                            </div>
                            <PageSelector
                                id={`page-selector-${topicTitle.replace(/\s+/g, '-')}-ai-${pInfo.pdf_index}`}
                                key={`key-ai-${topicTitle}-${relevantFile.name}-${pInfo.start_page}-${pInfo.end_page}`}
                                pdfFile={relevantFile}
                                suggestedStartPage={pInfo.start_page || 1}
                                suggestedEndPage={pInfo.end_page || (pInfo.start_page || 0) + 9}
                                selectedPages={currentFileSelections}
                                onSelectionChange={(newSelection) => handlePageSelectionChangeForTopicAndFile(topicTitle, pInfo.pdf_index, newSelection)}
                                isFinalizing={isFinalizing}
                                onImagesReady={(pageImages) => {
                                    const psId = `page-selector-${topicTitle.replace(/\s+/g, '-')}-ai-${pInfo.pdf_index}`;
                                    const pageSelectorInstance = document.getElementById(psId);
                                    if (pageSelectorInstance) {
                                        pageSelectorInstance.__pageImages = pageImages;
                                        pageSelectorInstance.__totalPagesInFile = pageImages.length;
                                    }
                                }}
                                onToggleFullscreen={(pageImages, initialPage) => 
                                    enterFullscreenModeInternal(topicTitle, pInfo.pdf_index, pageImages, initialPage, pageImages.length)
                                }
                            />
                        </div>
                    );
                })}

                {/* Sezione per selezione manuale da TUTTI i file disponibili, se non ci sono pages_info */}
                {(!topicDetails?.pages_info || topicDetails.pages_info.length === 0) && originalFiles.map((file, manualFileIndex) => {
                    const currentManualFileSelections = selectionsForThisTopic.find(s => s.fileIndex === manualFileIndex)?.pages || [];
                    return (
                        <div key={`selector-manual-${topicTitle}-${manualFileIndex}`} className="page-selector-instance manual">
                            <div className="page-selector-header">
                                <Edit3 size={14} />
                                <strong>Seleziona da File: {file.name}</strong>
                                <button
                                    onClick={() => {
                                        const psId = `page-selector-${topicTitle.replace(/\s+/g, '-')}-manual-${manualFileIndex}`;
                                        const pageSelectorInstance = document.getElementById(psId);
                                        if (pageSelectorInstance && pageSelectorInstance.__pageImages && typeof pageSelectorInstance.__totalPagesInFile === 'number') {
                                            enterFullscreenModeInternal(topicTitle, manualFileIndex, pageSelectorInstance.__pageImages, 1, pageSelectorInstance.__totalPagesInFile);
                                        }
                                    }}
                                    className="fullscreen-button" 
                                    title="Visualizza a schermo intero"
                                >
                                    <Maximize2 size={16} /> Schermo Intero
                                </button>
                            </div>
                            <PageSelector
                                id={`page-selector-${topicTitle.replace(/\s+/g, '-')}-manual-${manualFileIndex}`}
                                key={`key-manual-${topicTitle}-${file.name}`}
                                pdfFile={file}
                                suggestedStartPage={1}
                                suggestedEndPage={10}
                                selectedPages={currentManualFileSelections}
                                onSelectionChange={(newSelection) => handlePageSelectionChangeForTopicAndFile(topicTitle, manualFileIndex, newSelection)}
                                isFinalizing={isFinalizing}
                                onImagesReady={(pageImages) => {
                                    const psId = `page-selector-${topicTitle.replace(/\s+/g, '-')}-manual-${manualFileIndex}`;
                                    const pageSelectorInstance = document.getElementById(psId);
                                    if (pageSelectorInstance) {
                                        pageSelectorInstance.__pageImages = pageImages;
                                        pageSelectorInstance.__totalPagesInFile = pageImages.length;
                                    }
                                }}
                                onToggleFullscreen={(pageImages, initialPage) => 
                                    enterFullscreenModeInternal(topicTitle, manualFileIndex, pageImages, initialPage, pageImages.length)
                                }
                            />
                        </div>
                    );
                })}
                
                {validationError && <p className="error-message">{validationError}</p>}
            </div>
        </div>
    );
};

export default PlanReviewModal;