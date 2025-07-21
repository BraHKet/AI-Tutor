import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';
import * as pdfjsLib from 'pdfjs-dist';
import { ArrowLeft, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, X } from 'lucide-react';
import './styles/StudySession.css';
import SimpleLoading from './SimpleLoading';
import { googleDriveService } from '../utils/googleDriveService';

// Configurazione PDF.js worker
if (typeof window !== 'undefined') {
  if (typeof global === 'undefined') {
    window.global = window;
  }
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;
  pdfjsLib.GlobalWorkerOptions.workerPort = null;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 4;
const PAGE_RENDER_BUFFER = 2; // Renderizza 2 pagine extra prima e dopo quelle visibili

const StudySession = () => {
  const { projectId, topicId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const selectedResource = location.state?.selectedResource;

  const [topic, setTopic] = useState(null);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pdfDocument, setPdfDocument] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.5);

  // NUOVO: Stato per tenere traccia delle pagine da renderizzare (quelle visibili + buffer)
  const [visiblePages, setVisiblePages] = useState(new Set());

  const containerRef = useRef(null);
  const pageRefs = useRef([]);
  const allPagesContainerRef = useRef(null);
  const isScrollingProgrammatically = useRef(false);
  const observer = useRef(null);

  const pinchState = useRef({
    isPinching: false,
    initialDistance: 0,
    initialScale: 1,
    lastScale: 1,
    lastMidpoint: null,
    initialScroll: { left: 0, top: 0 },
  });

  // Funzione di rendering per una singola pagina
  const renderPage = useCallback(async (pageNumber, currentPdf, currentScale) => {
    try {
      if (!currentPdf) return;
      const page = await currentPdf.getPage(pageNumber);
      const canvas = document.getElementById(`page-canvas-${pageNumber}`);
      if (!canvas) return; // Se il canvas non è nel DOM (perché non più visibile), esci

      const devicePixelRatio = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale: currentScale });
      const hiDpiViewport = page.getViewport({ scale: currentScale * devicePixelRatio });
      const context = canvas.getContext('2d');

      if (canvas.width === hiDpiViewport.width && canvas.height === hiDpiViewport.height) {
        return; // Dimensione già corretta, non serve ri-renderizzare
      }

      canvas.width = hiDpiViewport.width;
      canvas.height = hiDpiViewport.height;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      const renderContext = { canvasContext: context, viewport: hiDpiViewport };
      await page.render(renderContext).promise;

    } catch (err) {
      console.error(`Errore nel rendering della pagina ${pageNumber}:`, err);
    }
  }, []);

  // NUOVO: useEffect per renderizzare SOLO le pagine visibili quando cambiano o cambia lo scale
  useEffect(() => {
    if (!pdfDocument || !scale || visiblePages.size === 0) return;

    visiblePages.forEach(pageNumber => {
      renderPage(pageNumber, pdfDocument, scale);
    });
  }, [pdfDocument, scale, visiblePages, renderPage]);

  // NUOVO: useEffect per impostare l'IntersectionObserver che popola `visiblePages`
  useEffect(() => {
    const container = containerRef.current;
    if (!container || numPages === 0) return;

    if (observer.current) observer.current.disconnect();

    const options = {
      root: container,
      rootMargin: '100px', // Inizia a caricare le pagine un po' prima che entrino nel viewport
      threshold: 0,
    };

    observer.current = new IntersectionObserver((entries) => {
      const newVisiblePages = new Set(visiblePages);
      let centralVisiblePage = -1;
      let maxIntersectionRatio = -1;

      entries.forEach(entry => {
        const pageNumber = parseInt(entry.target.dataset.pageNumber, 10);
        
        // Aggiungi o rimuovi pagine dal set di rendering
        if (entry.isIntersecting) {
            newVisiblePages.add(pageNumber);
            // Aggiungi buffer
            for(let i=1; i <= PAGE_RENDER_BUFFER; i++) {
                if(pageNumber - i > 0) newVisiblePages.add(pageNumber - i);
                if(pageNumber + i <= numPages) newVisiblePages.add(pageNumber + i);
            }
        } else {
            // Non rimuoviamo subito per evitare sfarfallii durante lo scroll veloce
        }

        // Trova la pagina più "centrale" per aggiornare il contatore
        if (entry.intersectionRatio > maxIntersectionRatio) {
            maxIntersectionRatio = entry.intersectionRatio;
            centralVisiblePage = pageNumber;
        }
      });
      
      if(!isScrollingProgrammatically.current && centralVisiblePage !== -1) {
          setCurrentPage(centralVisiblePage);
      }

      setVisiblePages(newVisiblePages);
    }, options);

    pageRefs.current.forEach(pageEl => {
      if (pageEl) observer.current.observe(pageEl);
    });

    return () => {
      if (observer.current) observer.current.disconnect();
    };
  }, [numPages]); // Si riattiva solo se il numero di pagine cambia


  // --- Logica di caricamento e gestione dati (invariata) ---

  const downloadPdfChunk = async (driveFileId) => {
    try {
      const accessToken = await googleDriveService.ensureAuthenticated();
      const pdfBlob = await googleDriveService.downloadPdfChunk(driveFileId, accessToken);
      const arrayBuffer = await pdfBlob.arrayBuffer();
      await loadPdfDocument(arrayBuffer);
    } catch (error) { console.error("Error downloading PDF:", error); setError(error); }
  };

  const loadPdfDocument = async (pdfArrayBuffer) => {
    try {
      const loadingTask = pdfjsLib.getDocument({ data: pdfArrayBuffer });
      const pdf = await loadingTask.promise;
      setPdfDocument(pdf);
      setNumPages(pdf.numPages);
      pageRefs.current = Array(pdf.numPages).fill(null).map(() => React.createRef());
    } catch (error) { console.error('Errore nel caricamento del PDF:', error); setError('Errore nel caricamento del PDF'); }
  };
  
  const fetchTopicData = async () => {
    if (!projectId || !topicId) {
      setError(new Error("Parametri mancanti nell'URL.")); setLoading(false); return;
    }
    setLoading(true); setError(null);
    try {
      await googleDriveService.initialize();
      const projectRef = doc(db, 'projects', projectId);
      const projectSnap = await getDoc(projectRef);
      if (!projectSnap.exists()) throw new Error("Progetto non trovato.");
      setProject(projectSnap.data());
      const topicRef = doc(db, 'projects', projectId, 'topics', topicId);
      const topicSnap = await getDoc(topicRef);
      if (!topicSnap.exists()) throw new Error("Argomento non trovato.");
      const topicData = topicSnap.data();
      setTopic(topicData);
      if (selectedResource && selectedResource.driveId) {
        await downloadPdfChunk(selectedResource.driveId);
      } else if (topicData.sources && topicData.sources.length > 0) {
        const pdfChunk = topicData.sources.find(s => s.type === 'pdf_chunk' && s.chunkDriveId);
        if (pdfChunk && pdfChunk.chunkDriveId) {
          await downloadPdfChunk(pdfChunk.chunkDriveId);
        } else { throw new Error("PDF principale non trovato per questo argomento."); }
      } else { throw new Error("Nessun file PDF trovato per questo argomento."); }
    } catch (err) { console.error("StudySession: Errore nel recupero dati:", err); setError(err); } finally { setLoading(false); }
  };
  
  useEffect(() => {
    fetchTopicData();
  }, [projectId, topicId, selectedResource]);


  // --- Logica di navigazione e zoom (invariata o con piccole modifiche) ---

  const handleNavigation = (pageNumber) => {
    const pageElement = pageRefs.current[pageNumber - 1];
    if (pageElement) {
      setCurrentPage(pageNumber);
      isScrollingProgrammatically.current = true;
      pageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => { isScrollingProgrammatically.current = false; }, 1000);
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
    
    // Questo è l'unico punto che causa il re-rendering.
    // Ora, grazie alla virtualizzazione, sarà un'operazione leggera.
    setScale(newScale); 
    
    requestAnimationFrame(() => {
      container.scrollLeft = newScroll.left;
      container.scrollTop = newScroll.top;
    });
  }, [scale]);

  const zoomIn = () => {
    const container = containerRef.current;
    const origin = { x: container.clientWidth / 2, y: container.clientHeight / 2 };
    applyZoom(scale + 0.25, origin);
  };

  const zoomOut = () => {
    const container = containerRef.current;
    const origin = { x: container.clientWidth / 2, y: container.clientHeight / 2 };
    applyZoom(scale - 0.25, origin);
  };

  // --- Logica di gestione del tocco (invariata) ---
  // Questa parte è già ottimale perché manipola solo la trasformazione del contenitore.
  
  const getDistance = (touches) => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);

  const handleTouchStart = useCallback((event) => {
    if (event.touches.length === 2) {
      event.preventDefault();
      const container = containerRef.current;
      allPagesContainerRef.current.style.transition = 'none';

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
      const { initialDistance, initialScale } = pinchState.current;
      const content = allPagesContainerRef.current;

      const currentDistance = getDistance(event.touches);
      let newScale = initialScale * (currentDistance / initialDistance);
      
      pinchState.current.lastScale = newScale;

      const midpoint = {
        x: (event.touches[0].clientX + event.touches[1].clientX) / 2,
        y: (event.touches[0].clientY + event.touches[1].clientY) / 2,
      };
      pinchState.current.lastMidpoint = midpoint;
      
      // Applica la trasformazione visiva via GPU, senza chiamare setState
      content.style.transform = `scale(${newScale})`;
    }
  }, []);
  
  const handleTouchEnd = useCallback(() => {
    if (pinchState.current.isPinching) {
      const { lastScale, lastMidpoint } = pinchState.current;
      const content = allPagesContainerRef.current;
      
      content.style.transform = 'none'; // Rimuovi la trasformazione temporanea
      content.style.transition = '';

      if (lastMidpoint) {
        // Consolida lo zoom: chiama applyZoom che usa setState.
        // ORA questo sarà veloce perché ri-renderizza solo le pagine visibili.
        applyZoom(lastScale, lastMidpoint);
      }
      
      pinchState.current.isPinching = false;
    }
  }, [applyZoom]);

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

  if (loading) return <SimpleLoading message="Caricamento sessione di studio..." fullScreen={true} />;
  if (error) return ( <div className="error-container"> <X size={48} /> <h2>Errore nel caricamento</h2> <p>{typeof error === 'string' ? error : error.message}</p> <button onClick={() => navigate(-1)} className="btn btn-primary"> Torna indietro </button> </div> );
  
  // MODIFICATO: JSX per la virtualizzazione
  return (
    <div className="study-session-container">
      <div className="study-toolbar">
        <div className="toolbar-section"> <button onClick={() => navigate(-1)} className="back-button"> <ArrowLeft size={20} /> </button> </div>
        <div className="toolbar-section"> <button onClick={goToPrevPage} disabled={currentPage <= 1} title="Pagina precedente"> <ChevronLeft size={18} /> </button> <span className="page-info"> {currentPage} / {numPages || '...'} </span> <button onClick={goToNextPage} disabled={!numPages || currentPage >= numPages} title="Pagina successiva"> <ChevronRight size={18} /> </button> </div>
        <div className="toolbar-section"> <button onClick={zoomOut} title="Riduci zoom"> <ZoomOut size={18} /> </button> <span className="zoom-info"> {Math.round(scale * 100)}% </span> <button onClick={zoomIn} title="Aumenta zoom"> <ZoomIn size={18} /> </button> </div>
      </div>
      <div className="pdf-viewer" ref={containerRef}>
        {!pdfDocument && <SimpleLoading message="Caricamento PDF..." />}
        {pdfDocument && (
          <div className="all-pages-container-wrapper">
            <div
              className="all-pages-container"
              ref={allPagesContainerRef}
              style={{
                // Applica lo scale direttamente qui, che sarà controllato da React
                transform: `scale(${scale})`,
                transformOrigin: 'top left'
              }}
            >
              {Array.from({ length: numPages }, (_, i) => {
                const pageNumber = i + 1;
                // Renderizza il contenitore vuoto per tutte le pagine
                return (
                  <div
                    key={`page-container-${pageNumber}`}
                    ref={(el) => (pageRefs.current[i] = el)}
                    className="pdf-page-container"
                    data-page-number={pageNumber}
                    style={{
                        // Calcoliamo un'altezza stimata per il placeholder
                        // per evitare che lo scroll "salti" mentre le pagine caricano.
                        // Questo può essere migliorato salvando le dimensioni della pagina.
                        height: pdfDocument ? (pdfDocument.getPage(1).then(p => p.getViewport({scale: 1}).height) * 1.33) + 'px' : '1000px',
                    }}
                  >
                    {/* Renderizza il canvas solo se la pagina è visibile */}
                    {visiblePages.has(pageNumber) && (
                      <canvas id={`page-canvas-${pageNumber}`} />
                    )}
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