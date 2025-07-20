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
  const [renderingPage, setRenderingPage] = useState(false);
  
  const containerRef = useRef(null);
  const pageRefs = useRef([]);
  const isScrollingProgrammatically = useRef(false);
  // Refs per il pinch-to-zoom performante
  const initialDistance = useRef(0);
  const lastScale = useRef(1);
  const allPagesContainerRef = useRef(null);
  const currentGestureScale = useRef(1);

  useEffect(() => {
    const fetchData = async () => {
      try {
        await googleDriveService.initialize();
        await fetchTopicData();
      } catch (error) { setError(error); setLoading(false); }
    };
    fetchData();
  }, [projectId, topicId, selectedResource]);

  useEffect(() => {
    if (!pdfDocument || !scale || !numPages) return;
    const renderAllPages = async () => {
      setRenderingPage(true);
      const promises = Array.from({ length: numPages }, (_, i) => renderPage(i + 1));
      await Promise.all(promises);
      setRenderingPage(false);
    };
    const renderPage = async (pageNumber) => {
      try {
        const page = await pdfDocument.getPage(pageNumber);
        const canvas = document.getElementById(`page-canvas-${pageNumber}`);
        if (!canvas) return;
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
      } catch (err) { console.error(`Errore nel rendering della pagina ${pageNumber}:`, err); }
    };
    renderAllPages();
  }, [pdfDocument, scale, numPages]);

  useEffect(() => {
    if (pageRefs.current.length === 0 || !containerRef.current) return;
    const observerCallback = (entries) => {
      if (isScrollingProgrammatically.current) return;
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const pageIndex = pageRefs.current.indexOf(entry.target);
          if (pageIndex !== -1) setCurrentPage(pageIndex + 1);
        }
      });
    };
    const observer = new IntersectionObserver(observerCallback, {
      root: containerRef.current,
      rootMargin: '-50% 0px -50% 0px',
      threshold: 0,
    });
    pageRefs.current.forEach(pageEl => { if (pageEl) observer.observe(pageEl); });
    return () => {
      pageRefs.current.forEach(pageEl => { if (pageEl) observer.unobserve(pageEl); });
      observer.disconnect();
    };
  }, [numPages]);

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
      pageRefs.current = Array.from({ length: pdf.numPages });
    } catch (error) { console.error('Errore nel caricamento del PDF:', error); setError('Errore nel caricamento del PDF'); }
  };

  const fetchTopicData = async () => {
    if (!projectId || !topicId) {
      setError(new Error("Parametri mancanti nell'URL.")); setLoading(false); return;
    }
    setLoading(true); setError(null);
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
  
  const handleNavigation = (pageNumber) => {
    const pageElement = pageRefs.current[pageNumber - 1];
    if (pageElement) {
      setCurrentPage(pageNumber);
      isScrollingProgrammatically.current = true;
      pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => { isScrollingProgrammatically.current = false; }, 1000);
    }
  };

  const goToPrevPage = () => { if (currentPage > 1) handleNavigation(currentPage - 1); };
  const goToNextPage = () => { if (currentPage < numPages) handleNavigation(currentPage + 1); };
  const zoomIn = () => setScale(s => Math.min(s + 0.25, 4));
  const zoomOut = () => setScale(s => Math.max(s - 0.25, 0.5));

  // Logica per il pinch-to-zoom ad alte prestazioni
  const getDistance = (touches) => {
    return Math.sqrt(Math.pow(touches[1].clientX - touches[0].clientX, 2) + Math.pow(touches[1].clientY - touches[0].clientY, 2));
  };

  const handleTouchStart = useCallback((event) => {
    if (event.touches.length === 2 && allPagesContainerRef.current) {
      event.preventDefault();
      document.body.style.overflow = 'hidden';
      initialDistance.current = getDistance(event.touches);
      lastScale.current = scale;
    }
  }, [scale]);

  const handleTouchMove = useCallback((event) => {
    if (event.touches.length === 2 && initialDistance.current > 0 && allPagesContainerRef.current) {
      event.preventDefault();
      const currentDistance = getDistance(event.touches);
      const zoomFactor = currentDistance / initialDistance.current;
      const newScale = Math.max(0.5, Math.min(lastScale.current * zoomFactor, 4));
      
      allPagesContainerRef.current.style.transform = `scale(${newScale})`;
      currentGestureScale.current = newScale;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (initialDistance.current > 0 && allPagesContainerRef.current) {
      document.body.style.overflow = '';
      allPagesContainerRef.current.style.transform = '';
      setScale(currentGestureScale.current);
      initialDistance.current = 0;
    }
  }, [setScale]);

  // Effetto per collegare gli event listener
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
  
  return (
    <div className="study-session-container">
      <div className="study-toolbar">
        <div className="toolbar-section"> <button onClick={() => navigate(-1)} className="back-button"> <ArrowLeft size={20} /> </button> </div>
        <div className="toolbar-section"> <button onClick={goToPrevPage} disabled={currentPage <= 1} title="Pagina precedente"> <ChevronLeft size={18} /> </button> <span className="page-info"> {currentPage} / {numPages || '...'} </span> <button onClick={goToNextPage} disabled={currentPage >= numPages} title="Pagina successiva"> <ChevronRight size={18} /> </button> </div>
        <div className="toolbar-section"> <button onClick={zoomOut} title="Riduci zoom"> <ZoomOut size={18} /> </button> <span className="zoom-info"> {Math.round(scale * 100)}% </span> <button onClick={zoomIn} title="Aumenta zoom"> <ZoomIn size={18} /> </button> </div>
      </div>
      <div className="pdf-viewer" ref={containerRef}>
        {renderingPage && !pdfDocument && <SimpleLoading message="Caricamento PDF..." />}
        {pdfDocument && (
          <div
            className="all-pages-container"
            ref={allPagesContainerRef}
          >
            {Array.from({ length: numPages }, (_, i) => (
              <div
                key={`page-container-${i + 1}`}
                ref={(el) => (pageRefs.current[i] = el)}
                className="pdf-page-container"
              >
                <canvas id={`page-canvas-${i + 1}`} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudySession;