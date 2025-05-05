// src/components/PageSelector.jsx
import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react'; // Aggiunto memo
import * as pdfjsLib from 'pdfjs-dist/build/pdf';

// Assicurati che il worker sia configurato UNA SOLA VOLTA a livello globale,
// ad esempio nel tuo file index.js o App.js, o nel pdfProcessor.js se usato solo lì.
// Non ripeterlo qui se già fatto altrove.
// Esempio (se necessario qui):
// import * as pdfjsWorker from 'pdfjs-dist/build/pdf.worker.entry';
// try {
//     if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
//          console.log("PageSelector: Setting pdfjs worker source");
//          pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
//     }
// } catch (e) { console.error("PageSelector: Error setting pdfjs worker source:", e); }


// Stili inline per semplicità
const styles = {
    container: { border: '1px solid #eee', padding: '10px', marginTop: '10px', maxHeight: '300px', overflowY: 'auto', backgroundColor: '#f8f9fa' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '10px' }, // Leggermente più largo per numeri pagina
    pageItem: { border: '2px solid #ccc', borderRadius: '4px', padding: '5px', textAlign: 'center', cursor: 'pointer', position: 'relative', backgroundColor: 'white', transition: 'border-color 0.2s ease, background-color 0.2s ease' },
    pageItemSelected: { borderColor: '#007bff', backgroundColor: '#e7f3ff' },
    pageItemDisabled: { cursor: 'not-allowed', opacity: 0.6 },
    canvasContainer: { position: 'relative', width: '100%', paddingBottom: '141.4%', height: 0, overflow: 'hidden', marginBottom: '3px' }, // Aspect ratio A4
    canvas: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'block', border: '1px solid #eee' },
    pageNum: { fontSize: '0.8em', fontWeight: 'bold', color: '#333', marginTop:'3px' },
    loading: { textAlign: 'center', padding: '20px', color: '#666', fontSize: '0.9em' },
    error: { textAlign: 'center', padding: '20px', color: 'red', fontSize: '0.9em' },
    placeholder: { height: '100px', background:'#f0f0f0', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', fontSize:'0.8em', color:'#aaa' }
};

const PageSelector = memo(({ // Usa React.memo per ottimizzare re-render non necessari
    pdfFile,
    suggestedStartPage = 1, // Default a 1
    suggestedEndPage = 10,  // Default alle prime 10
    selectedPages = [],     // Default array vuoto
    onSelectionChange,
    isFinalizing = false  // Riceve stato per disabilitare click
}) => {
    const [pdfDocProxy, setPdfDocProxy] = useState(null); // Usiamo il proxy restituito da getDocument
    const [totalPages, setTotalPages] = useState(0);
    const [renderedPagesStatus, setRenderedPagesStatus] = useState({}); // { pageNum: 'pending' | 'rendered' | 'error' }
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const canvasRefs = useRef({}); // { pageNum: canvasElement }

    // Carica documento PDF
    useEffect(() => {
        let isMounted = true;
        // Reset stato quando il file cambia o il componente viene mostrato
        setPdfDocProxy(null);
        setTotalPages(0);
        setRenderedPagesStatus({});
        setError('');
        canvasRefs.current = {}; // Pulisci refs

        if (!pdfFile) {
             console.log("PageSelector: No PDF file provided.");
             return;
        };

        setIsLoading(true);
        console.log(`PageSelector: Loading PDF: ${pdfFile.name}`);
        const reader = new FileReader();

        reader.onload = async (event) => {
            if (!isMounted) return;
            try {
                const loadingTask = pdfjsLib.getDocument({ data: event.target.result });
                const loadedPdfDocProxy = await loadingTask.promise;
                if (!isMounted) return; // Check dopo await

                console.log(`PageSelector: PDF "${pdfFile.name}" loaded proxy. Pages: ${loadedPdfDocProxy.numPages}`);
                setPdfDocProxy(loadedPdfDocProxy);
                setTotalPages(loadedPdfDocProxy.numPages);
                // Inizializza stato rendering per le pagine rilevanti
                const initialStatus = {};
                const start = Math.max(1, suggestedStartPage - 5); // Buffer più ampio?
                const end = Math.min(loadedPdfDocProxy.numPages, suggestedEndPage + 5);
                for (let i = start; i <= end; i++) { initialStatus[i] = 'pending'; }
                setRenderedPagesStatus(initialStatus);

            } catch (loadError) {
                if (!isMounted) return;
                console.error(`PageSelector: Error loading PDF "${pdfFile.name}":`, loadError);
                setError(`Errore caricamento anteprima: ${loadError.message}`);
                setPdfDocProxy(null); setTotalPages(0);
            } finally {
                 if (isMounted) setIsLoading(false);
            }
        };
        reader.onerror = () => {
            if (!isMounted) return;
            console.error(`PageSelector: Error reading file "${pdfFile.name}"`);
            setError('Errore lettura file PDF.');
            setIsLoading(false);
            setPdfDocProxy(null); setTotalPages(0);
        };
        reader.readAsArrayBuffer(pdfFile);

        // Cleanup
        return () => {
            isMounted = false;
            // pdf.js gestisce internamente la distruzione del proxy quando non più referenziato
            // Non serve chiamare destroy() sul proxy direttamente qui.
            console.log(`PageSelector: Cleanup for ${pdfFile?.name}`);
        }

    }, [pdfFile, suggestedStartPage, suggestedEndPage]); // Ricarica se il file o i suggerimenti cambiano


    // Determina quali pagine mostrare nella UI (range + buffer)
    const pagesToDisplay = useMemo(() => {
        if (!totalPages) return [];
        // Mostra un range attorno al suggerimento, ma assicurati che siano pagine valide
        const buffer = 4; // Mostra N pagine prima/dopo
        const start = Math.max(1, suggestedStartPage - buffer);
        const end = Math.min(totalPages, suggestedEndPage + buffer);
        const pages = [];
        for (let i = start; i <= end; i++) {
            pages.push(i);
        }
        console.log(`PageSelector: Determined pages to display for "${pdfFile?.name}": ${start}-${end} (Total in doc: ${totalPages})`);
        return pages;
    }, [totalPages, suggestedStartPage, suggestedEndPage, pdfFile]);


    // Funzione per renderizzare una singola pagina (memoizzata)
    const renderPage = useCallback(async (pageNum) => {
        if (!pdfDocProxy || !canvasRefs.current[pageNum] || renderedPagesStatus[pageNum] === 'rendered' || renderedPagesStatus[pageNum] === 'rendering') {
             // console.log(`Skipping render for page ${pageNum}, status: ${renderedPagesStatus[pageNum]}`);
             return;
        }

        console.log(`PageSelector: Rendering page ${pageNum} for "${pdfFile?.name}"...`);
        setRenderedPagesStatus(prev => ({ ...prev, [pageNum]: 'rendering' })); // Segna come in rendering

        try {
            const page = await pdfDocProxy.getPage(pageNum);
            const canvas = canvasRefs.current[pageNum];
            const context = canvas.getContext('2d');

            // Calcola scala per adattare alla larghezza del contenitore (es. 80px) mantenendo aspect ratio
            const desiredWidth = 80;
            const viewportBase = page.getViewport({ scale: 1.0 });
            const scale = desiredWidth / viewportBase.width;
            const viewport = page.getViewport({ scale: scale });

            canvas.height = viewport.height;
            canvas.width = viewport.width;

            const renderContext = { canvasContext: context, viewport: viewport };
            await page.render(renderContext).promise;
            console.log(`PageSelector: Page ${pageNum} rendered successfully.`);
            setRenderedPagesStatus(prev => ({ ...prev, [pageNum]: 'rendered' }));

            // Cleanup pagina (importante per liberare memoria)
             if (page && typeof page.cleanup === 'function') {
                 page.cleanup();
             }

        } catch (renderError) {
            console.error(`PageSelector: Error rendering page ${pageNum} of "${pdfFile?.name}":`, renderError);
            setRenderedPagesStatus(prev => ({ ...prev, [pageNum]: 'error' }));
        }
    }, [pdfDocProxy, pdfFile, renderedPagesStatus]); // Dipende dal doc e dallo stato


    // Effetto per triggerare il rendering quando necessario
    useEffect(() => {
        if (pdfDocProxy) {
            pagesToDisplay.forEach(pageNum => {
                // Se il canvas ref esiste e lo stato è 'pending', avvia il render
                if (canvasRefs.current[pageNum] && renderedPagesStatus[pageNum] === 'pending') {
                    renderPage(pageNum);
                }
            });
        }
    }, [pdfDocProxy, pagesToDisplay, renderedPagesStatus, renderPage]); // Dipende da questi


    // Gestore click sulla miniatura
    const handlePageClick = (pageNum) => {
        if (isFinalizing) return; // Non modificabile durante finalizzazione
        const currentIndex = selectedPages.indexOf(pageNum);
        let newSelection = [...selectedPages];
        if (currentIndex > -1) { newSelection.splice(currentIndex, 1); } // Deseleziona
        else { newSelection.push(pageNum); } // Seleziona
        newSelection.sort((a, b) => a - b); // Ordina
        onSelectionChange(newSelection); // Notifica il genitore
    };


    // --- Render del Componente ---
    if (isLoading) return <div style={styles.loading}>Caricamento anteprima PDF...</div>;
    if (error) return <div style={styles.error}>{error}</div>;
    if (!pdfDocProxy || pagesToDisplay.length === 0) return <div style={styles.loading}>Nessuna pagina da visualizzare.</div>;

    return (
        <div style={styles.container}>
            <div style={styles.grid}>
                {pagesToDisplay.map(pageNum => {
                    const isSelected = selectedPages.includes(pageNum);
                    const status = renderedPagesStatus[pageNum];
                    const isDisabled = isFinalizing; // Disabilita click durante finalizzazione

                    return (
                        <div
                            key={`${pdfFile.name}-page-${pageNum}`} // Chiave più robusta
                            style={
                                isSelected
                                ? {...styles.pageItem, ...styles.pageItemSelected, ...(isDisabled ? styles.pageItemDisabled : {})}
                                : {...styles.pageItem, ...(isDisabled ? styles.pageItemDisabled : {})}
                            }
                            onClick={() => isDisabled ? null : handlePageClick(pageNum)}
                            title={`Pagina ${pageNum}${isSelected ? ' (Selezionata)' : ''}${isDisabled ? ' (Bloccato)' : ''}`}
                        >
                            <div style={styles.canvasContainer}>
                                <canvas
                                    ref={el => { if (el) canvasRefs.current[pageNum] = el; }} // Assegna ref solo se elemento esiste
                                    style={styles.canvas}
                                    // Larghezza e altezza sono impostate dinamicamente nel rendering
                                />
                                {/* Placeholder o Stato Rendering */}
                                {(status === 'pending' || status === 'rendering') && <div style={{...styles.placeholder, position:'absolute', top:0, left:0, width:'100%', height:'100%'}}></div>}
                                {status === 'error' && <div style={{...styles.placeholder, position:'absolute', top:0, left:0, width:'100%', height:'100%', color:'red'}}>Errore</div>}
                            </div>
                            <span style={styles.pageNum}>{pageNum}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}); // Fine React.memo

export default PageSelector;