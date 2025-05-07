// src/components/PageSelector.jsx
import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Loader, AlertCircle, Check } from 'lucide-react';

// Configurazione PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// Opzioni di caricamento PDF per risolvere i problemi di font
const pdfLoadingOptions = {
  cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
  cMapPacked: true,
  standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`
};

// Stili componente
const styles = {
  container: { position: 'relative' },
  loadingContainer: { display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px 0', flexDirection: 'column' },
  errorContainer: { padding: '15px', color: '#721c24', backgroundColor: '#f8d7da', borderRadius: '4px', marginBottom: '15px' },
  pagesContainer: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '10px', marginTop: '15px' },
  pageThumb: { position: 'relative', border: '1px solid #ddd', borderRadius: '4px', overflow: 'hidden', aspectRatio: '0.7/1', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', transition: 'all 0.2s', backgroundColor: '#f8f9fa' },
  selectedPageThumb: { border: '2px solid #007bff', boxShadow: '0 0 5px rgba(0, 123, 255, 0.5)' },
  pageImage: { width: '100%', height: '100%', objectFit: 'contain' },
  pageNumber: { position: 'absolute', bottom: '5px', right: '5px', backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', padding: '2px 5px', borderRadius: '3px', fontSize: '0.75em' },
  checkIcon: { position: 'absolute', top: '5px', right: '5px', backgroundColor: '#28a745', borderRadius: '50%', padding: '2px', color: 'white' },
  instructions: { fontSize: '0.85em', color: '#6c757d', marginBottom: '10px' }
};

const PageSelector = ({
  id, // ID per riferimento DOM
  pdfFile,
  suggestedStartPage = 1,
  suggestedEndPage = null,
  selectedPages = [],
  onSelectionChange,
  isFinalizing = false,
  onImagesReady = null, // Callback per le immagini delle pagine
  onToggleFullscreen = null // Callback per attivare la modalità a schermo intero
}) => {
  // Stato
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pdfDocument, setPdfDocument] = useState(null);
  const [pageCount, setPageCount] = useState(0);
  const [renderedPages, setRenderedPages] = useState([]);
  const [pageImages, setPageImages] = useState([]); // Array per memorizzare i data URL delle immagini
  
  const containerRef = useRef(null);

  // Carica il PDF quando il file cambia
  useEffect(() => {
    let isActive = true;
    setLoading(true);
    setError(null);
    setRenderedPages([]);
    setPageImages([]); // Reset immagini

    if (!pdfFile) {
      setError("Nessun file PDF fornito.");
      setLoading(false);
      return;
    }

    // Carica il documento PDF
    const loadPdf = async () => {
      try {
        const fileArrayBuffer = await pdfFile.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({
          data: fileArrayBuffer,
          ...pdfLoadingOptions  // Usa le opzioni di caricamento con parametri font
        });
        
        const pdf = await loadingTask.promise;
        
        if (isActive) {
          setPdfDocument(pdf);
          setPageCount(pdf.numPages);
          console.log(`PageSelector: PDF loaded successfully with ${pdf.numPages} pages.`);
        }
      } catch (err) {
        console.error("PageSelector: Error loading PDF:", err);
        if (isActive) {
          setError(`Errore nel caricamento del PDF: ${err.message}`);
          setLoading(false);
        }
      }
    };

    loadPdf();

    return () => {
      isActive = false;
    };
  }, [pdfFile]);

  // Effetto per renderizzare le pagine quando il documento PDF è caricato
  useEffect(() => {
    if (!pdfDocument) return;

    let isActive = true;
    const newRenderedPages = [];
    const newPageImages = [];
    let completedPages = 0;

    const renderPage = async (pageNum) => {
      try {
        const page = await pdfDocument.getPage(pageNum);
        const viewport = page.getViewport({ scale: 0.5 }); // Scala ridotta per thumbnail
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({
          canvasContext: context,
          viewport: viewport
        }).promise;
        
        // Converti canvas in data URL per l'immagine
        const imgData = canvas.toDataURL('image/png');
        
        if (isActive) {
          newRenderedPages[pageNum - 1] = imgData;
          newPageImages[pageNum - 1] = imgData; // Memorizza l'immagine per uso esterno
          completedPages++;
          
          // Aggiorna lo stato periodicamente invece di per ogni pagina
          if (completedPages % 5 === 0 || completedPages === pdfDocument.numPages) {
            setRenderedPages([...newRenderedPages]);
            setPageImages([...newPageImages]);
          }
          
          // Quando tutte le pagine sono state renderizzate
          if (completedPages === pdfDocument.numPages) {
            setLoading(false);
            // Esponi le immagini attraverso il callback se fornito
            if (onImagesReady && typeof onImagesReady === 'function') {
              onImagesReady(newPageImages);
            }
          }
        }
      } catch (err) {
        console.error(`PageSelector: Error rendering page ${pageNum}:`, err);
        if (isActive) {
          newRenderedPages[pageNum - 1] = null; // Segnaposto per pagina fallita
          completedPages++;
          
          if (completedPages === pdfDocument.numPages) {
            setLoading(false);
          }
        }
      }
    };

    // Inizia il rendering di tutte le pagine
    const renderAllPages = async () => {
      // Primo, renderizza le pagine suggerite
      const startPage = Math.max(1, suggestedStartPage);
      const endPage = suggestedEndPage ? Math.min(suggestedEndPage, pdfDocument.numPages) : pdfDocument.numPages;
      
      // Renderizza prima le pagine suggerite per velocizzare l'esperienza utente
      for (let i = startPage; i <= endPage; i++) {
        if (!isActive) break;
        await renderPage(i);
      }
      
      // Poi renderizza le rimanenti pagine
      for (let i = 1; i < startPage; i++) {
        if (!isActive) break;
        await renderPage(i);
      }
      
      for (let i = endPage + 1; i <= pdfDocument.numPages; i++) {
        if (!isActive) break;
        await renderPage(i);
      }
    };

    renderAllPages();

    return () => {
      isActive = false;
    };
  }, [pdfDocument, suggestedStartPage, suggestedEndPage, onImagesReady]);

  // Funzione per gestire la selezione di una pagina
  const handlePageClick = (pageNum) => {
    if (isFinalizing) return; // Disabilita durante il finalizing
    
    const isSelected = selectedPages.includes(pageNum);
    let newSelectedPages;
    
    if (isSelected) {
      // Se già selezionata, rimuovi
      newSelectedPages = selectedPages.filter(p => p !== pageNum);
    } else {
      // Altrimenti aggiungi e mantieni l'ordine
      newSelectedPages = [...selectedPages, pageNum].sort((a, b) => a - b);
    }
    
    // Notifica il cambio
    if (onSelectionChange) {
      onSelectionChange(newSelectedPages);
    }
  };

  // Esponi le immagini delle pagine al componente parent tramite una proprietà personalizzata
  useEffect(() => {
    if (containerRef.current && pageImages.length > 0) {
      containerRef.current.__pageImages = pageImages;
      
      // Se c'è una funzione per la modalità a schermo intero, abilita il double click
      if (onToggleFullscreen && typeof onToggleFullscreen === 'function') {
        const thumbElements = containerRef.current.querySelectorAll('.page-thumb');
        thumbElements.forEach((el, idx) => {
          el.addEventListener('dblclick', (e) => {
            e.preventDefault();
            onToggleFullscreen(pageImages, idx + 1);
          });
        });
      }
    }
  }, [pageImages, onToggleFullscreen]);

  // --- RENDER ---
  if (error) {
    return (
      <div style={styles.errorContainer}>
        <AlertCircle size={16} style={{ marginRight: '5px' }} />
        {error}
      </div>
    );
  }

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <Loader size={24} className="spin-icon" />
        <div style={{ marginTop: '10px' }}>Caricamento anteprima pagine...</div>
      </div>
    );
  }

  return (
    <div id={id} ref={containerRef} style={styles.container}>
      <div style={styles.instructions}>
        Clicca sulle pagine per selezionarle/deselezionarle. Le pagine selezionate saranno utilizzate come materiale di studio per questo argomento.
        {onToggleFullscreen && <span style={{fontStyle: 'italic', display: 'block', marginTop: '5px'}}>Suggerimento: doppio click su una pagina per visualizzarla a schermo intero.</span>}
      </div>
      
      <div style={styles.pagesContainer}>
        {renderedPages.map((pageImg, idx) => {
          const pageNum = idx + 1;
          const isSelected = selectedPages.includes(pageNum);
          
          return (
            <div
              key={`page-${pageNum}`}
              className="page-thumb" // Aggiungiamo una classe per selezionare facilmente le miniature
              style={{
                ...styles.pageThumb,
                ...(isSelected ? styles.selectedPageThumb : {})
              }}
              onClick={() => handlePageClick(pageNum)}
              title={`Pagina ${pageNum}${isSelected ? ' (selezionata)' : ''} - Doppio click per ingrandire`}
            >
              {pageImg ? (
                <img src={pageImg} alt={`Pagina ${pageNum}`} style={styles.pageImage} />
              ) : (
                <div>Errore</div>
              )}
              <div style={styles.pageNumber}>{pageNum}</div>
              {isSelected && <div style={styles.checkIcon}><Check size={12} /></div>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PageSelector;