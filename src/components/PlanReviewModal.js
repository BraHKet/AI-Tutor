// src/components/PlanReviewModal.jsx (o .js)
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import PageSelector from './PageSelector'; // Importa PageSelector
import { Loader, AlertCircle, Edit3, Save, XCircle, Calendar, BookOpen, Info } from 'lucide-react';

// Stili per il modale
const modalStyles = {
  overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' },
  content: { backgroundColor: 'white', padding: '25px 30px', borderRadius: '8px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', width: '95%', maxWidth: '950px', position: 'relative', boxShadow: '0 5px 15px rgba(0,0,0,0.2)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '15px'},
  closeButton: { position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 0, color: '#aaa', '&:hover': {color: '#333'} },
  body: { overflowY: 'auto', flexGrow: 1, paddingRight: '10px', marginRight: '-10px'},
  daySection: { marginBottom: '20px', border: '1px solid #eee', padding: '10px 15px', borderRadius: '5px', backgroundColor: '#fdfdfd' },
  dayHeader: { marginTop: 0, borderBottom: '1px solid #eee', paddingBottom: '8px', display: 'flex', alignItems: 'center', fontSize: '1.1em', fontWeight: '600', color: '#333' },
  topicItem: { marginBottom: '15px', paddingLeft: '10px', borderLeft: '3px solid #ffc107', paddingTop: '8px', paddingBottom: '8px' },
  topicTitle: { marginBottom: '8px', display: 'flex', alignItems: 'center', fontWeight: 'bold', fontSize: '1.05em', color: '#212529' },
  pageSelectorContainer: { marginTop: '10px', border: '1px solid #e0e0e0', borderRadius: '4px', padding: '10px' },
  pageSelectorHeader: { display:'flex', alignItems:'center', marginBottom:'8px', fontSize: '0.9em', fontWeight: '500' },
  suggestedPages: { fontSize: '0.8em', color: '#666', fontStyle: 'italic', marginBottom: '10px', marginTop:'5px' },
  actions: { marginTop: '20px', textAlign: 'right', borderTop: '1px solid #eee', paddingTop: '15px' },
  confirmButton: { padding: '8px 18px', fontSize: '1em', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginLeft: '10px' },
  cancelButton: { padding: '8px 18px', fontSize: '1em', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' },
  error: { color: '#dc3545', fontSize: '0.85em', marginTop: '5px', fontWeight: '500'},
  loadingBox: {marginBottom: '15px', padding: '10px', backgroundColor: '#e9ecef', borderRadius: '5px', display: 'flex', alignItems: 'center'},
  errorBox: {marginBottom: '15px', padding: '10px', backgroundColor: '#f8d7da', color: '#721c24', borderRadius: '5px', display: 'flex', alignItems: 'center'}
};


const PlanReviewModal = ({
    isOpen,
    provisionalPlanData,
    originalFiles, // Ricevi i File object originali
    onConfirm,
    onCancel,
    isFinalizing,
    finalizationMessage,
    finalizationError
}) => {
    const [currentUserSelections, setCurrentUserSelections] = useState({});
    const [validationErrors, setValidationErrors] = useState({});

    // Memoizza dati dalle props
    const contentIndex = useMemo(() => provisionalPlanData?.index || [], [provisionalPlanData]);
    const topicDistribution = useMemo(() => provisionalPlanData?.distribution || [], [provisionalPlanData]);
    const pageMapping = useMemo(() => provisionalPlanData?.pageMapping || {}, [provisionalPlanData]);

    // Memoizza mappa indice
    const indexTopicMap = useMemo(() => {
        return contentIndex.reduce((map, topic) => {
            const normalizedTitle = topic.title?.trim();
            if (normalizedTitle) map[normalizedTitle] = topic;
            return map;
        }, {});
    }, [contentIndex]);

     // Memoizza funzione per range suggerito (marcatori globali)
    const getSuggestedRange = useCallback((topicTitle) => {
        const map = indexTopicMap; const info = map[topicTitle];
        if (!info || !info.startPageMarker || info.startPageMarker <= 0) return { start: 0, end: 0 };
        const start = info.startPageMarker; let end = Object.keys(pageMapping).length || start;
        const toc = contentIndex; const currentIdx = toc.findIndex(t => t.title?.trim() === topicTitle);
        if (currentIdx !== -1 && currentIdx + 1 < toc.length) {
            const nextStart = toc[currentIdx + 1].startPageMarker;
            if (nextStart && nextStart > start) end = nextStart - 1;
        }
        end = Math.max(start, end); return { start, end };
    }, [indexTopicMap, contentIndex, pageMapping]);


    // Inizializza selezioni utente all'apertura basate sui suggerimenti
    useEffect(() => {
        if (isOpen && topicDistribution.length > 0 && contentIndex.length > 0 && Object.keys(pageMapping).length > 0) {
            console.log("PlanReviewModal: Initializing/Resetting user selections...");
            const initialSelections = {};
            topicDistribution.forEach(day => {
                (day.assignedTopics || []).forEach(topic => {
                    const title = topic.title?.trim();
                    if (title && !title.toLowerCase().includes("ripasso")) {
                        const suggested = getSuggestedRange(title);
                        const initialPages = [];
                        if (suggested.start > 0 && suggested.end >= suggested.start) {
                            for (let pMarker = suggested.start; pMarker <= suggested.end; pMarker++) {
                                if (pageMapping[pMarker]) {
                                    initialPages.push(pageMapping[pMarker].pageNum);
                                }
                            }
                        }
                        initialSelections[title] = [...new Set(initialPages)].sort((a,b)=>a-b);
                    }
                });
            });
            setCurrentUserSelections(initialSelections);
            setValidationErrors({});
            console.log("PlanReviewModal: Initial page selections (original page numbers):", initialSelections);
        }
    }, [isOpen, topicDistribution, contentIndex, getSuggestedRange, pageMapping]);


    // Gestore cambio selezione pagine
    const handleSelectionChange = useCallback((topicTitle, newSelectedPagesArray) => {
        console.log(`PlanReviewModal: Selection change for "${topicTitle}":`, newSelectedPagesArray);
        setCurrentUserSelections(prev => ({
            ...prev,
            [topicTitle]: newSelectedPagesArray
        }));
        setValidationErrors(prev => { const newErrors = {...prev}; delete newErrors[topicTitle]; return newErrors; });
    }, []);


    // Validazione
    const validateSelections = () => {
        const errors = {}; let isValid = true;
        topicDistribution.forEach(day => {
            (day.assignedTopics || []).forEach(topic => {
                const title = topic.title?.trim();
                 if (title && !title.toLowerCase().includes("ripasso")) {
                     const selection = currentUserSelections[title];
                     if (!selection || !Array.isArray(selection) || selection.length === 0) {
                         errors[title] = "Selezionare almeno una pagina."; isValid = false;
                     }
                 }
            });
        });
        setValidationErrors(errors);
        return isValid;
    };


    // Gestore Conferma Interna
    const handleInternalConfirm = () => {
        console.log("PlanReviewModal: Validate and Confirm clicked.");
        if (validateSelections()) {
             const finalSelections = {};
              Object.entries(currentUserSelections).forEach(([title, pages]) => {
                  if (pages && pages.length > 0) { finalSelections[title] = pages; }
              });
            console.log("PlanReviewModal: Validation successful. Calling onConfirm with final selections:", finalSelections);
            onConfirm(finalSelections);
        } else {
            console.log("PlanReviewModal: Validation failed.", validationErrors);
             const firstErrorKey = Object.keys(validationErrors)[0];
             if(firstErrorKey) {
                 const errorElement = document.getElementById(`topic-item-${firstErrorKey.replace(/\s+/g, '-')}`); // Usa ID su topic item
                 errorElement?.scrollIntoView({behavior: 'smooth', block: 'center'});
             }
        }
    };

     // Helper per trovare file originale
    const getOriginalFileForTopic = useCallback((topicTitle) => {
        const suggestedRange = getSuggestedRange(topicTitle);
        if (!suggestedRange.start || !originalFiles || originalFiles.length === 0 || !pageMapping) return null;
        const firstPageInfo = pageMapping[suggestedRange.start];
        if (!firstPageInfo || typeof firstPageInfo.fileIndex !== 'number' || firstPageInfo.fileIndex >= originalFiles.length) return null;
        return originalFiles[firstPageInfo.fileIndex];
    }, [getSuggestedRange, originalFiles, pageMapping]);


    if (!isOpen) return null;

    return (
        <div style={modalStyles.overlay}>
            <div style={modalStyles.content}>
                <div style={modalStyles.header}>
                    <h2>Revisione Piano e Pagine</h2>
                    <button onClick={onCancel} style={modalStyles.closeButton} disabled={isFinalizing} title="Annulla revisione">
                        <XCircle size={22} color="#888" />
                    </button>
                </div>

                 {isFinalizing && ( <div style={modalStyles.loadingBox}><Loader size={20} className="spin-icon" style={{marginRight: '10px'}}/><span>{finalizationMessage || 'Finalizzazione...'}</span></div>)}
                 {finalizationError && !isFinalizing && ( <div style={modalStyles.errorBox}><AlertCircle size={20} style={{marginRight: '10px'}}/><span>{finalizationError}</span></div> )}

                <div style={modalStyles.body}> {/* Body scrollabile */}
                    {topicDistribution.map((dayPlan) => {
                        // --- CORREZIONE CONDIZIONE IF ---
                        // Controlla se non ci sono assignedTopics O se l'UNICO topic è di ripasso
                        const isReviewDay = dayPlan.assignedTopics?.length === 1 && dayPlan.assignedTopics[0].title?.toLowerCase().includes("ripasso");
                        const isEmptyDay = !dayPlan.assignedTopics || dayPlan.assignedTopics.length === 0;

                        if (isEmptyDay && !isReviewDay) {
                            // Se è vuoto e non è un giorno di ripasso esplicitamente definito, non mostrare nulla
                            return null;
                        }

                        // Mostra giorni di ripasso se presenti
                         if (isReviewDay) {
                             return (
                                 <div key={`review-day-${dayPlan.day}`} style={modalStyles.daySection}>
                                     <h3 style={modalStyles.dayHeader}><Calendar size={16} style={{marginRight:'6px'}}/> Giorno {dayPlan.day} - Ripasso</h3>
                                     <p style={{marginLeft: '10px', fontStyle:'italic'}}>Ripasso generale degli argomenti precedenti.</p>
                                 </div>
                             );
                         }
                         // ----------------------------------

                        // Se è un giorno di studio normale, procedi
                        return (
                            <div key={`review-day-${dayPlan.day}`} style={modalStyles.daySection}>
                                <h3 style={modalStyles.dayHeader}><Calendar size={16} style={{marginRight:'6px'}}/> Giorno {dayPlan.day}</h3>
                                {dayPlan.assignedTopics.map((assignedTopic) => {
                                    const title = assignedTopic.title?.trim();
                                    if (!title) return null; // Salta se manca titolo

                                    const currentSelectedPages = currentUserSelections[title] || [];
                                    const errorMsg = validationErrors[title];
                                    const topicDescription = indexTopicMap[title]?.subTopics?.map(st => st.title).join(', ') || '';
                                    const relevantFile = getOriginalFileForTopic(title);
                                    const suggestedRange = getSuggestedRange(title); // Marcatori globali
                                     // Calcola pagine originali suggerite
                                     const suggestedOriginalPages = [];
                                     if(suggestedRange.start > 0) { for (let p=suggestedRange.start; p<=suggestedRange.end; p++) { if(pageMapping[p]) suggestedOriginalPages.push(pageMapping[p].pageNum); } }
                                     const suggestedStartOrig = suggestedOriginalPages.length > 0 ? Math.min(...suggestedOriginalPages) : 0;
                                     const suggestedEndOrig = suggestedOriginalPages.length > 0 ? Math.max(...suggestedOriginalPages) : 0;

                                    return (
                                        // Aggiungi ID univoco al topic item per scrollIntoView
                                        <div key={`review-topic-${title}`} id={`topic-item-${title.replace(/\s+/g, '-')}`} style={modalStyles.topicItem}>
                                            <h4 style={modalStyles.topicTitle}>
                                                <BookOpen size={14} style={{ marginRight: '6px' }}/> {title}
                                            </h4>
                                            {topicDescription && <p style={{ fontSize: '0.9em', color: '#555', margin: '0 0 8px 0' }}>{topicDescription}</p>}

                                            <div style={modalStyles.pageSelectorContainer}>
                                                <div style={modalStyles.pageSelectorHeader}>
                                                    <Edit3 size={14} style={{ marginRight: '5px'}} />
                                                    <strong>Seleziona Pagine Rilevanti:</strong>
                                                    <span style={{marginLeft:'auto', fontSize:'0.8em', color:'#555'}}>{relevantFile ? relevantFile.name : ''}</span>
                                                </div>
                                                {suggestedStartOrig > 0 && (
                                                     <div style={modalStyles.suggestedPages}>
                                                        (Suggerimento AI indica Pagine Orig. circa: {suggestedStartOrig} - {suggestedEndOrig})
                                                     </div>
                                                 )}
                                                 {!suggestedStartOrig && ( <div style={modalStyles.suggestedPages}> (Suggerimento AI non disponibile) </div> )}

                                                {relevantFile ? (
                                                    <PageSelector
                                                        key={`${title}-${relevantFile.name}-${suggestedStartOrig}`}
                                                        pdfFile={relevantFile}
                                                        suggestedStartPage={suggestedStartOrig > 0 ? suggestedStartOrig : 1}
                                                        suggestedEndPage={suggestedEndOrig > 0 ? suggestedEndOrig : (relevantFile ? 10 : 1)} // Limita default end
                                                        selectedPages={currentSelectedPages}
                                                        onSelectionChange={(newSelection) => handleSelectionChange(title, newSelection)}
                                                        isFinalizing={isFinalizing} // Passa lo stato per disabilitare click
                                                    />
                                                ) : (
                                                    <p style={modalStyles.error}><AlertCircle size={14} /> Anteprima non disponibile (file non trovato).</p>
                                                )}
                                                 {errorMsg && <p style={modalStyles.error}>{errorMsg}</p>}
                                            </div>
                                        </div> // fine topicItem
                                    );
                                })}
                            </div> // fine daySection
                        );
                    })}
                </div> {/* fine modalStyles.body */}

                {/* Azioni Modale */}
                <div style={modalStyles.actions}>
                     <button onClick={onCancel} style={modalStyles.cancelButton} disabled={isFinalizing}> Annulla </button>
                     <button onClick={handleInternalConfirm} style={{...modalStyles.confirmButton, opacity: isFinalizing ? 0.6 : 1}} disabled={isFinalizing}>
                         {isFinalizing ? 'Attendere...' : 'Conferma e Genera'}
                     </button>
                 </div>

            </div> {/* fine modalStyles.content */}
        </div> 
    );
};

export default PlanReviewModal;