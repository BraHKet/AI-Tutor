// src/components/StudySession.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useGoogleAuth from '../hooks/useGoogleAuth';
import * as pdfjsLib from 'pdfjs-dist';
import { 
  ArrowLeft, 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw,
  MessageSquare,
  Book,
  FileText,
  X
} from 'lucide-react';
import SimpleLoading from './SimpleLoading';
import './styles/StudySession.css';

// CONFIGURAZIONE PDF.js FISSA per evitare conflitti di versione
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Opzioni di caricamento PDF
const pdfLoadingOptions = {
  cMapUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/cmaps/',
  cMapPacked: true,
  standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/standard_fonts/'
};

// Costanti per il rendering
const SCALE_STEP = 0.25;
const MIN_SCALE = 0.5;
const MAX_SCALE = 3.0;
const DEFAULT_SCALE = 1.2;

const StudySession = () => {
  const { projectId, topicId } = useParams();
  const navigate = useNavigate();
  const { user } = useGoogleAuth();
  
  // Stati principali
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [topicData, setTopicData] = useState(null);
  const [pdfDocument, setPdfDocument] = useState(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [scale, setScale] = useState(DEFAULT_SCALE);
  const [rotation, setRotation] = useState(0);
  const [renderedPages, setRenderedPages] = useState({});
  const [showChat, setShowChat] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  
  // Refs
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const renderTaskRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, []);

  // Carica i dati del topic da Firestore
  useEffect(() => {
    let mounted = true;
    
    const loadTopicData = async () => {
      if (!user || !projectId || !topicId) return;

      try {
        setLoading(true);
        setError(null);

        // Importa Firestore
        const { doc, getDoc } = await import('firebase/firestore');
        const { db } = await import('../utils/firebase');

        // Recupera i dati del progetto
        const projectRef = doc(db, 'projects', projectId);
        const projectSnap = await getDoc(projectRef);
        
        if (!mounted) return;
        
        if (!projectSnap.exists()) {
          setError('Progetto non trovato');
          setLoading(false);
          return;
        }

        // Recupera i dati del topic
        const topicRef = doc(db, 'projects', projectId, 'topics', topicId);
        const topicSnap = await getDoc(topicRef);
        
        if (!mounted) return;
        
        if (!topicSnap.exists()) {
          setError('Argomento non trovato');
          setLoading(false);
          return;
        }

        const topicDataResult = topicSnap.data();
        setTopicData(topicDataResult);
        
        // Carica il PDF se disponibile - usando chunk PDF da Google Drive
        if (topicDataResult.sources && topicDataResult.sources.length > 0) {
          const pdfChunk = topicDataResult.sources.find(source =>
            source.type === 'pdf_chunk' && source.chunkDriveId
          );
          if (pdfChunk && pdfChunk.chunkDriveId && mounted) {
            await loadPdfFromDrive(pdfChunk.chunkDriveId, topicDataResult);
          }
        } else if (topicDataResult.driveFileId && mounted) {
          await loadPdfFromDrive(topicDataResult.driveFileId, topicDataResult);
        }
        
      } catch (err) {
        console.error('Error loading topic data:', err);
        if (mounted) {
          setError('Errore nel caricamento dei dati: ' + err.message);
          setLoading(false);
        }
      }
    };

    loadTopicData();
    
    return () => {
      mounted = false;
    };
  }, [user?.uid, projectId, topicId]); // Usa user.uid invece di user object

  // Carica PDF da Google Drive
  const loadPdfFromDrive = async (driveFileId, topicDataParam) => {
    try {
      // Importa il servizio Google Drive
      const { googleDriveService } = await import('../utils/googleDriveService');
      
      // Inizializza il servizio se necessario
      await googleDriveService.initialize();
      
      console.log('StudySession: Attempting to get access token...');
      
      // Prima controlla se abbiamo già un token valido
      let accessToken = googleDriveService.accessToken;
      
      if (!accessToken) {
        // Se non abbiamo un token, tenta di ottenerlo
        // Questo potrebbe mostrare il popup di autenticazione Google
        try {
          accessToken = await googleDriveService.getAccessToken();
        } catch (authError) {
          console.error('StudySession: Authentication failed:', authError);
          
          // Gestisci diversi tipi di errori di autenticazione
          if (authError.message.includes('popup_blocked') || authError.message.includes('popup_failed_to_open')) {
            setError('Il popup di autenticazione Google non si apre. Verifica che i popup siano abilitati per questo sito e riprova.');
          } else if (authError.message.includes('popup_closed')) {
            setError('Autenticazione annullata. È necessario autorizzare l\'accesso a Google Drive per visualizzare il PDF.');
          } else if (authError.message.includes('access_denied')) {
            setError('Accesso negato. È necessario autorizzare l\'app per accedere a Google Drive.');
          } else {
            setError('Errore nell\'autenticazione Google Drive. Dettagli: ' + authError.message);
          }
          setLoading(false);
          return;
        }
      }
      
      if (!accessToken) {
        setError('Impossibile ottenere il token di accesso per Google Drive.');
        setLoading(false);
        return;
      }
      
      console.log('StudySession: Access token obtained, downloading PDF...');
      
      // Scarica il PDF chunk
      const pdfData = await googleDriveService.downloadPdfChunk(driveFileId, accessToken);
      
      // Crea un File object per il PDF
      const pdfFile = new File([pdfData], `${topicDataParam?.title || 'documento'}.pdf`, { 
        type: 'application/pdf' 
      });
      
      await loadPdfDocument(pdfFile);
      
    } catch (err) {
      console.error('Errore nel caricamento del PDF da Drive:', err);
      
      // Gestisci errori specifici
      if (err.message.includes('unauthorized') || err.message.includes('401')) {
        // Token scaduto o non valido
        setError('Accesso a Google Drive scaduto. Clicca "Autorizza Google Drive" per riautenticarti.');
      } else if (err.message.includes('not found') || err.message.includes('404')) {
        setError('File PDF non trovato su Google Drive.');
      } else if (err.message.includes('403')) {
        setError('Accesso negato al file PDF su Google Drive. Verifica i permessi del file.');
      } else if (err.message.includes('popup_blocked') || err.message.includes('popup_closed') || err.message.includes('popup_failed_to_open')) {
        setError('Problema con il popup di autenticazione Google. Verifica che i popup siano abilitati e riprova.');
      } else {
        setError('Errore nel caricamento del PDF: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // Carica il documento PDF
  const loadPdfDocument = async (pdfFile) => {
    try {
      const fileArrayBuffer = await pdfFile.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({
        data: fileArrayBuffer,
        ...pdfLoadingOptions
      });
      
      const pdf = await loadingTask.promise;
      setPdfDocument(pdf);
      console.log(`PDF caricato con successo: ${pdf.numPages} pagine`);
      
    } catch (err) {
      console.error('Errore nel caricamento del PDF:', err);
      setError('Errore nel caricamento del PDF: ' + err.message);
    }
  };

  // Renderizza una pagina specifica - ottimizzato per evitare sfarfallio
  const renderPage = useCallback(async (pageIndex) => {
    if (!pdfDocument || !canvasRef.current || isRendering) return;
    
    const cacheKey = `${pageIndex}-${scale}-${rotation}`;
    
    // Se la pagina è già renderizzata con gli stessi parametri, non ri-renderizzare
    if (renderedPages[cacheKey]) {
      return;
    }

    const pageNum = pageIndex + 1;
    if (pageNum < 1 || pageNum > pdfDocument.numPages) return;

    // Cancella il task di rendering precedente
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
    }

    try {
      setIsRendering(true);

      const page = await pdfDocument.getPage(pageNum);
      const viewport = page.getViewport({ 
        scale: scale,
        rotation: rotation 
      });

      const canvas = canvasRef.current;
      if (!canvas) return;

      const context = canvas.getContext('2d');
      
      // Imposta le dimensioni del canvas
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      canvas.style.width = viewport.width + 'px';
      canvas.style.height = viewport.height + 'px';

      // Avvia il rendering
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };

      renderTaskRef.current = page.render(renderContext);
      await renderTaskRef.current.promise;

      // Salva la pagina renderizzata nella cache
      setRenderedPages(prev => ({
        ...prev,
        [cacheKey]: true
      }));

    } catch (err) {
      if (err.name !== 'RenderingCancelledException') {
        console.error('Errore nel rendering della pagina:', err);
      }
    } finally {
      setIsRendering(false);
    }
  }, [pdfDocument, scale, rotation, renderedPages, isRendering]);

  // Effetto per renderizzare quando cambia la pagina o la scala
  useEffect(() => {
    if (pdfDocument) {
      renderPage(currentPageIndex);
    }
  }, [pdfDocument, currentPageIndex]);

  // Effetto separato per scala e rotazione per evitare re-render eccessivi
  useEffect(() => {
    if (pdfDocument) {
      // Debounce del rendering per evitare troppi re-render durante lo zoom
      const timeoutId = setTimeout(() => {
        renderPage(currentPageIndex);
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [scale, rotation]);

  // Navigazione pagine
  const goToNextPage = useCallback(() => {
    if (!pdfDocument || !topicData?.selectedPages) return;
    
    const nextIndex = currentPageIndex + 1;
    if (nextIndex < topicData.selectedPages.length) {
      setCurrentPageIndex(nextIndex);
    }
  }, [pdfDocument, topicData, currentPageIndex]);

  const goToPrevPage = useCallback(() => {
    if (!pdfDocument || !topicData?.selectedPages) return;
    
    const prevIndex = currentPageIndex - 1;
    if (prevIndex >= 0) {
      setCurrentPageIndex(prevIndex);
    }
  }, [pdfDocument, topicData, currentPageIndex]);

  // Controlli zoom
  const zoomIn = useCallback(() => {
    setScale(prev => Math.min(prev + SCALE_STEP, MAX_SCALE));
  }, []);

  const zoomOut = useCallback(() => {
    setScale(prev => Math.max(prev - SCALE_STEP, MIN_SCALE));
  }, []);

  const resetZoom = useCallback(() => {
    setScale(DEFAULT_SCALE);
    setRotation(0);
    setRenderedPages({}); // Pulisci la cache quando resetti
  }, []);

  // Funzione per riprovare l'autenticazione
  const retryAuthentication = async () => {
    setError(null);
    setLoading(true);
    
    try {
      const { googleDriveService } = await import('../utils/googleDriveService');
      
      // Reset completo del servizio di autenticazione
      googleDriveService.accessToken = null;
      googleDriveService.tokenClient = null;
      
      // Reset delle promise statiche per forzare una nuova inizializzazione
      if (googleDriveService.constructor.tokenPromise) {
        googleDriveService.constructor.tokenPromise = null;
      }
      
      console.log('StudySession: Retrying authentication...');
      
      // Reinizializza il servizio
      await googleDriveService.initialize();
      
      // Aspetta un momento per permettere al browser di preparare il popup
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Ricarica i dati del topic
      if (topicData) {
        if (topicData.sources && topicData.sources.length > 0) {
          const pdfChunk = topicData.sources.find(source =>
            source.type === 'pdf_chunk' && source.chunkDriveId
          );
          if (pdfChunk && pdfChunk.chunkDriveId) {
            await loadPdfFromDrive(pdfChunk.chunkDriveId, topicData);
          }
        } else if (topicData.driveFileId) {
          await loadPdfFromDrive(topicData.driveFileId, topicData);
        }
      }
    } catch (err) {
      console.error('Retry authentication error:', err);
      setError('Errore durante il nuovo tentativo di autenticazione: ' + err.message);
      setLoading(false);
    }
  };
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          goToPrevPage();
          break;
        case 'ArrowRight':
          e.preventDefault();
          goToNextPage();
          break;
        case '+':
        case '=':
          e.preventDefault();
          zoomIn();
          break;
        case '-':
          e.preventDefault();
          zoomOut();
          break;
        case '0':
          e.preventDefault();
          resetZoom();
          break;
        case 'Escape':
          if (showChat) {
            e.preventDefault();
            setShowChat(false);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [goToPrevPage, goToNextPage, zoomIn, zoomOut, resetZoom, showChat]);

  if (loading) {
    return (
      <SimpleLoading 
        message="Caricamento sessione di studio..."
        size="medium"
        fullScreen={true}
      />
    );
  }

  if (error) {
    return (
      <div className="study-session-error">
        <div className="error-container">
          <div className="error-content">
            <FileText size={48} className="error-icon" />
            <h2>Errore</h2>
            <p>{error}</p>
            
            {/* Mostra pulsante per riautenticare se necessario */}
            {(error.includes('Google Drive') || error.includes('unauthorized') || error.includes('autorizzare') || 
              error.includes('popup') || error.includes('autenticazione') || error.includes('scaduto') ||
              error.includes('accesso') || error.includes('token')) && (
              <div className="auth-actions">
                <button 
                  onClick={retryAuthentication}
                  className="auth-btn"
                  disabled={loading}
                >
                  {loading ? 'Autenticazione...' : 'Autorizza Google Drive'}
                </button>
                <p className="auth-help">
                  💡 <strong>Suggerimento:</strong> Se il popup non si apre, verifica che i popup siano abilitati per questo sito nelle impostazioni del browser.
                </p>
              </div>
            )}
            
            <button 
              onClick={() => navigate(`/projects/${projectId}/plan`)}
              className="back-btn"
            >
              <ArrowLeft size={16} />
              Torna al Piano
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!topicData) {
    return (
      <div className="study-session-error">
        <div className="error-container">
          <div className="error-content">
            <Book size={48} className="error-icon" />
            <h2>Argomento non trovato</h2>
            <p>L'argomento richiesto non è stato trovato.</p>
            <button 
              onClick={() => navigate(`/projects/${projectId}/plan`)}
              className="back-btn"
            >
              <ArrowLeft size={16} />
              Torna al Piano
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentPage = topicData.selectedPages?.[currentPageIndex];
  const totalPages = topicData.selectedPages?.length || 0;

  return (
    <div className="study-session">
      <div className="study-session-container" ref={containerRef}>
        {/* Header */}
        <div className="study-session-header">
          <div className="header-left">
            <button 
              onClick={() => navigate(`/projects/${projectId}/plan`)}
              className="back-button"
            >
              <ArrowLeft size={20} />
              Piano di Studio
            </button>
            <div className="topic-info">
              <h1>{topicData.title}</h1>
              <span className="page-counter">
                Pagina {currentPageIndex + 1} di {totalPages}
                {currentPage && ` (PDF: ${currentPage})`}
              </span>
            </div>
          </div>
          
          <div className="header-right">
            <button 
              onClick={() => setShowChat(prev => !prev)}
              className={`chat-button ${showChat ? 'active' : ''}`}
            >
              <MessageSquare size={20} />
              Chat AI
            </button>
          </div>
        </div>

        {/* Contenuto principale */}
        <div className="study-session-content">
          {/* PDF Viewer */}
          <div className="pdf-viewer-container">
            {/* Controlli */}
            <div className="pdf-controls">
              <div className="navigation-controls">
                <button 
                  onClick={goToPrevPage}
                  disabled={currentPageIndex <= 0 || isRendering}
                  className="nav-button"
                >
                  <ChevronLeft size={20} />
                </button>
                
                <span className="page-info">
                  {currentPageIndex + 1} / {totalPages}
                </span>
                
                <button 
                  onClick={goToNextPage}
                  disabled={currentPageIndex >= totalPages - 1 || isRendering}
                  className="nav-button"
                >
                  <ChevronRight size={20} />
                </button>
              </div>

              <div className="zoom-controls">
                <button 
                  onClick={zoomOut} 
                  className="zoom-button" 
                  disabled={scale <= MIN_SCALE || isRendering}
                >
                  <ZoomOut size={16} />
                </button>
                <span className="zoom-level">{Math.round(scale * 100)}%</span>
                <button 
                  onClick={zoomIn} 
                  className="zoom-button" 
                  disabled={scale >= MAX_SCALE || isRendering}
                >
                  <ZoomIn size={16} />
                </button>
                <button 
                  onClick={resetZoom} 
                  className="reset-button"
                  disabled={isRendering}
                >
                  <RotateCcw size={16} />
                </button>
              </div>
            </div>

            {/* Canvas per il PDF */}
            <div className="pdf-canvas-container">
              {isRendering && (
                <div className="pdf-loading-overlay">
                  <SimpleLoading message="Rendering pagina..." size="small" />
                </div>
              )}
              <canvas 
                ref={canvasRef}
                className="pdf-canvas"
              />
            </div>
          </div>

          {/* Chat AI (se attiva) */}
          {showChat && (
            <div className="chat-container">
              <div className="chat-header">
                <h3>Chat AI - {topicData.title}</h3>
                <button 
                  onClick={() => setShowChat(false)}
                  className="close-chat"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="chat-content">
                <div className="chat-messages">
                  <div className="ai-message">
                    <p>Ciao! Sono qui per aiutarti con lo studio di <strong>{topicData.title}</strong>. 
                    Puoi farmi domande sull'argomento, chiedere spiegazioni o farti interrogare!</p>
                  </div>
                </div>
                <div className="chat-input">
                  <input 
                    type="text" 
                    placeholder="Scrivi una domanda..."
                    className="message-input"
                  />
                  <button className="send-button">Invia</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudySession;