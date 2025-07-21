import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';
import * as pdfjsLib from 'pdfjs-dist';
import { ArrowLeft, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, X } from 'lucide-react';
import './styles/StudySession.css';
import SimpleLoading from './SimpleLoading';
import { googleDriveService } from '../utils/googleDriveService';

// --- Configurazione PDF.js Worker ---
// Assicura che il worker venga configurato solo una volta e solo in ambiente browser.
if (typeof window !== 'undefined') {
  if (typeof window.global === 'undefined') {
    window.global = window;
  }
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;
  pdfjsLib.GlobalWorkerOptions.workerPort = null;
}

// --- Costanti ---
const MIN_SCALE = 0.5;
const MAX_SCALE = 4;
const RENDER_AHEAD_PAGES = 2; // Numero di pagine da pre-renderizzare in ogni direzione

const StudySession = () => {
  // --- Hooks di Routing e Stato ---
  const { projectId, topicId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const selectedResource = location.state?.selectedResource;

  const [topic, setTopic] = useState(null);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Stato del PDF
  const [pdfDocument, setPdfDocument] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.5);

  // Stato per il rendering virtualizzato
  const [renderedPages, setRenderedPages] = useState(new Set());
  
  // --- Refs ---
  const containerRef = useRef(null);
  const allPagesContainerRef = useRef(null);
  const pageRefs = useRef(new Map()); // Usa una Map per una gestione più robusta dei ref
  const isScrollingProgrammatically = useRef(false);
  const intersectionObserver = useRef(null);

  // Ref per la gestione del pinch-to-zoom
  const pinchState = useRef({
    isPinching: false,
    initialDistance: 0,
    initialScale: 1,
    lastScale: 1,
    lastMidpoint: null,
    initialScroll: { left: 0, top: 0 },
  });

  // --- Funzioni di Caricamento Dati e PDF ---

  const fetchTopicData = useCallback(async () => {
    if (!projectId || !topicId) {
      setError(new Error("Parametri mancanti nell'URL."));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const projectRef = doc(db, 'projects', projectId);
      const projectSnap = await getDoc(projectRef);
      if (!projectSnap.exists()) throw new Error("Progetto non trovato.");
      setProject(projectSnap.data());

      const topicRef = doc(db, 'projects', projectId, 'topics', topicId);
      const topicSnap = await getDoc(topicRef);
      if (!topicSnap.exists()) throw new Error("Argomento non trovato.");
      
      const topicData = topicSnap.data();
      setTopic(topicData);

      let resourceToLoad = selectedResource;
      if (!resourceToLoad) {
        const pdfChunk = topicData.sources?.find(s => s.type === 'pdf_chunk' && s.chunkDriveId);
        if (pdfChunk) {
            resourceToLoad = { driveId: pdfChunk.chunkDriveId };
        }
      }
      
      if (resourceToLoad?.driveId) {
        await downloadAndLoadPdf(resourceToLoad.driveId);
      } else {
        throw new Error("Nessuna risorsa PDF valida trovata per questo argomento.");
      }
    } catch (err) {
      console.error("StudySession: Errore nel recupero dati:", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [projectId, topicId, selectedResource]);

  const downloadAndLoadPdf = async (driveFileId) => {
    try {
      const accessToken = await googleDriveService.ensureAuthenticated();
      const pdfBlob = await googleDriveService.downloadPdfChunk(driveFileId, accessToken);
      const arrayBuffer = await pdfBlob.arrayBuffer();
      
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
      setPdfDocument(pdf);
      setNumPages(pdf.numPages);
    } catch (error) {
      console.error('Errore nel caricamento del PDF:', error);
      setError(new Error('Errore durante il download o il caricamento del PDF.'));
    }
  };
  
  // Effetto per il fetch iniziale dei dati
  useEffect(() => {
    googleDriveService.initialize().then(fetchTopicData).catch(err => {
        setError(err);
        setLoading(false);
    });
  }, [fetchTopicData]);

  // --- Logica di Rendering Virtualizzato delle Pagine ---

  // 5. Funzione di rendering della pagina memoizzata
  const renderPage = useCallback(async (pageNumber) => {
    if (!pdfDocument) return;

    try {
      const page = await pdfDocument.getPage(pageNumber);
      const canvas = document.getElementById(`page-canvas-${pageNumber}`);
      if (!canvas) return; // Se il canvas non è più nel DOM, interrompi

      const devicePixelRatio = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale });
      const hiDpiViewport = page.getViewport({ scale: scale * devicePixelRatio });
      
      const context = canvas.getContext('2d');
      canvas.width = hiDpiViewport.width;
      canvas.height = hiDpiViewport.height;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      const renderContext = { canvasContext: context, viewport: hiDpiViewport };
      await page.render(renderContext).promise;

    } catch (err) {
      console.error(`Errore nel rendering della pagina ${pageNumber}:`, err);
    }
  }, [pdfDocument, scale]);
  
  // Effetto che renderizza le pagine visibili quando `renderedPages` o `scale` cambiano
  useEffect(() => {
    renderedPages.forEach(pageNumber => {
      renderPage(pageNumber);
    });
  }, [renderedPages, scale, renderPage]);

  // Funzione per aggiornare le pagine da renderizzare
  const updateRenderedPages = useCallback((current) => {
    const newRendered = new Set();
    const start = Math.max(1, current - RENDER_AHEAD_PAGES);
    const end = Math.min(numPages, current + RENDER_AHEAD_PAGES);
    
    for (let i = start; i <= end; i++) {
        newRendered.add(i);
    }

    // Per evitare re-render inutili, confronta con lo stato precedente
    if (newRendered.size !== renderedPages.size || ![...newRendered].every(p => renderedPages.has(p))) {
        setRenderedPages(newRendered);
    }
  }, [numPages, renderedPages]);

  // Effetto per l'impostazione dell'IntersectionObserver
  useEffect(() => {
    if (!numPages || !containerRef.current) return;
    
    const observerCallback = (entries) => {
      if (isScrollingProgrammatically.current || pinchState.current.isPinching) return;
      
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const pageNum = parseInt(entry.target.dataset.pageNumber, 10);
          if (!isNaN(pageNum)) {
            setCurrentPage(pageNum);
            updateRenderedPages(pageNum); // Aggiorna le pagine da renderizzare
          }
        }
      });
    };

    intersectionObserver.current = new IntersectionObserver(observerCallback, {
      root: containerRef.current,
      rootMargin: '100px 0px 100px 0px', // Un po' di margine per iniziare a caricare prima
      threshold: 0.1,
    });
    
    pageRefs.current.forEach(pageEl => {
        if (pageEl) intersectionObserver.current.observe(pageEl);
    });

    // Inizializza il rendering per la prima pagina
    updateRenderedPages(1);
    
    return () => {
      intersectionObserver.current?.disconnect();
      pageRefs.current.clear();
    };
  }, [numPages, updateRenderedPages]);


  // --- Navigazione e Zoom ---

  const handleNavigation = (pageNumber) => {
    const pageElement = pageRefs.current.get(pageNumber);
    if (pageElement) {
      isScrollingProgrammatically.current = true;
      setCurrentPage(pageNumber);
      updateRenderedPages(pageNumber);
      
      pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      
      setTimeout(() => {
        isScrollingProgrammatically.current = false;
      }, 1000); // Aumenta il timeout per gestire scroll più lunghi
    }
  };

  const goToPrevPage = () => { if (currentPage > 1) handleNavigation(currentPage - 1); };
  const goToNextPage = () => { if (currentPage < numPages) handleNavigation(currentPage + 1); };

  const applyZoom = useCallback((newScale, zoomOrigin) => {
    const container = containerRef.current;
    if (!container) return;

    const oldScale = scale;
    newScale = Math.max(MIN_SCALE, Math.min(newScale, MAX_SCALE));
    if (newScale === oldScale) return;

    const rect = container.getBoundingClientRect();
    const scroll = { left: container.scrollLeft, top: container.scrollTop };
    const origin = {
      x: zoomOrigin.x - rect.left,
      y: zoomOrigin.y - rect.top,
    };

    const contentPoint = {
      x: (origin.x + scroll.left) / oldScale,
      y: (origin.y + scroll.top) / oldScale,
    };

    const newScroll = {
      left: contentPoint.x * newScale - origin.x,
      top: contentPoint.y * newScale - origin.y,
    };
    
    setScale(newScale);
    
    // Applica lo scroll dopo che lo stato `scale` ha causato il re-render
    requestAnimationFrame(() => {
      container.scrollLeft = newScroll.left;
      container.scrollTop = newScroll.top;
    });
  }, [scale]);

  const zoomIn = () => {
    const container = containerRef.current;
    if (container) {
      const origin = { x: container.clientWidth / 2, y: container.clientHeight / 2 };
      applyZoom(scale + 0.25, origin);
    }
  };

  const zoomOut = () => {
    const container = containerRef.current;
    if (container) {
      const origin = { x: container.clientWidth / 2, y: container.clientHeight / 2 };
      applyZoom(scale - 0.25, origin);
    }
  };

  // --- Gestione Eventi Touch (Pinch-to-Zoom) ---

  const getDistance = (touches) => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
  
  const handleTouchStart = useCallback((event) => {
    if (event.touches.length === 2) {
      event.preventDefault();
      const container = containerRef.current;
      const content = allPagesContainerRef.current;
      if (!container || !content) return;

      content.style.transition = 'none';

      pinchState.current = {
        isPinching: true,
        initialDistance: getDistance(event.touches),
        initialScale: scale,
        lastScale: scale,
        lastMidpoint: null,
        initialScroll: { left: container.scrollLeft, top: container.scrollTop },
      };
    }
  }, [scale]);
  
  const handleTouchMove = useCallback((event) => {
    if (pinchState.current.isPinching && event.touches.length === 2) {
      event.preventDefault();
      const { initialDistance, initialScale, initialScroll } = pinchState.current;
      const content = allPagesContainerRef.current;
      if (!content || !containerRef.current) return;
      
      const currentDistance = getDistance(event.touches);
      const newScale = Math.max(MIN_SCALE, Math.min(initialScale * (currentDistance / initialDistance), MAX_SCALE));
      pinchState.current.lastScale = newScale;
      
      const midpoint = {
          x: (event.touches[0].clientX + event.touches[1].clientX) / 2,
          y: (event.touches[0].clientY + event.touches[1].clientY) / 2,
      };
      pinchState.current.lastMidpoint = midpoint;
      
      const containerRect = containerRef.current.getBoundingClientRect();
      const relativeMidpoint = {
        x: midpoint.x - containerRect.left,
        y: midpoint.y - containerRect.top,
      };

      // Calcola l'origine del contenuto basata sulla scala iniziale
      const contentPoint = {
        x: (relativeMidpoint.x + initialScroll.left) / initialScale,
        y: (relativeMidpoint.y + initialScroll.top) / initialScale,
      };

      // Calcola la nuova posizione di scroll basata sulla nuova scala
      const newScrollLeft = contentPoint.x * newScale - relativeMidpoint.x;
      const newScrollTop = contentPoint.y * newScale - relativeMidpoint.y;
      
      // Applica la trasformazione per uno zoom visuale fluido
      const translateX = initialScroll.left - newScrollLeft;
      const translateY = initialScroll.top - newScrollTop;

      content.style.transform = `translate(${translateX}px, ${translateY}px) scale(${newScale / initialScale})`;
    }
  }, []);
  
  const handleTouchEnd = useCallback(() => {
    if (pinchState.current.isPinching) {
      const { lastScale, lastMidpoint } = pinchState.current;
      const content = allPagesContainerRef.current;
      if (!content) return;
      
      content.style.transform = 'none';
      content.style.transition = '';

      if (lastMidpoint) {
        applyZoom(lastScale, lastMidpoint);
      }
      
      pinchState.current.isPinching = false;
    }
  }, [applyZoom]);
  
  // Effetto per aggiungere/rimuovere gli event listener del touch
  useEffect(() => {
    const viewer = containerRef.current;
    if (viewer) {
      viewer.addEventListener('touchstart', handleTouchStart, { passive: false });
      viewer.addEventListener('touchmove', handleTouchMove, { passive: false });
      viewer.addEventListener('touchend', handleTouchEnd);
      viewer.addEventListener('touchcancel', handleTouchEnd);
    }
    return () => {
      if (viewer) {
        viewer.removeEventListener('touchstart', handleTouchStart);
        viewer.removeEventListener('touchmove', handleTouchMove);
        viewer.removeEventListener('touchend', handleTouchEnd);
        viewer.removeEventListener('touchcancel', handleTouchEnd);
      }
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  // --- Rendering del Componente ---

  if (loading) return <SimpleLoading message="Caricamento sessione di studio..." fullScreen={true} />;
  
  if (error) return (
    <div className="error-container">
      <X size={48} />
      <h2>Errore nel caricamento</h2>
      <p>{typeof error === 'string' ? error : error.message}</p>
      <button onClick={() => navigate(-1)} className="btn btn-primary">Torna indietro</button>
    </div>
  );
  
  return (
    <div className="study-session-container">
      <div className="study-toolbar">
        <div className="toolbar-section">
          <button onClick={() => navigate(-1)} className="back-button"><ArrowLeft size={20} /></button>
        </div>
        <div className="toolbar-section">
          <button onClick={goToPrevPage} disabled={currentPage <= 1} title="Pagina precedente"><ChevronLeft size={18} /></button>
          <span className="page-info">{currentPage} / {numPages || '...'}</span>
          <button onClick={goToNextPage} disabled={!numPages || currentPage >= numPages} title="Pagina successiva"><ChevronRight size={18} /></button>
        </div>
        <div className="toolbar-section">
          <button onClick={zoomOut} title="Riduci zoom"><ZoomOut size={18} /></button>
          <span className="zoom-info">{Math.round(scale * 100)}%</span>
          <button onClick={zoomIn} title="Aumenta zoom"><ZoomIn size={18} /></button>
        </div>
      </div>
      
      <div className="pdf-viewer" ref={containerRef}>
        {!pdfDocument && <SimpleLoading message="Caricamento PDF..." />}
        {pdfDocument && (
          <div className="all-pages-container-wrapper">
            <div
              className="all-pages-container"
              ref={allPagesContainerRef}
              style={{ transformOrigin: '0 0' }}
            >
              {/* 1. & 3. Viene renderizzata la struttura di tutte le pagine, ma il canvas solo per quelle visibili */}
              {Array.from({ length: numPages }, (_, i) => {
                const pageNumber = i + 1;
                const shouldRenderCanvas = renderedPages.has(pageNumber);
                
                // Pre-calcola le dimensioni del placeholder per evitare "salti" di layout
                const placeholderStyle = pdfDocument ? {
                    width: `${pdfDocument.getPage(1).then(p => p.getViewport({ scale }).width)}px`,
                    height: `${pdfDocument.getPage(1).then(p => p.getViewport({ scale }).height)}px`
                    // In un'implementazione reale, potresti voler pre-calcolare e memorizzare
                    // le dimensioni di tutte le pagine per una maggiore precisione.
                    // Qui usiamo la prima pagina come stima per semplicità.
                } : {};

                return (
                  <div
                    key={`page-container-${pageNumber}`}
                    // 3. Assegnazione del ref a una Map, un pattern più stabile
                    ref={(el) => {
                        if (el) pageRefs.current.set(pageNumber, el);
                        else pageRefs.current.delete(pageNumber);
                    }}
                    className="pdf-page-container"
                    data-page-number={pageNumber}
                    style={placeholderStyle}
                  >
                    {shouldRenderCanvas && <canvas id={`page-canvas-${pageNumber}`} />}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudySession;