// src/components/TopicDetailViewer.js - Updated Version with Optimized Lazy Loading
import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { X, FileText, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import './styles/TopicDetailViewer.css';

// Configurazione PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const pdfLoadingOptions = {
  cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
  cMapPacked: true,
  standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`
};

// Costanti per il lazy loading
const PRELOAD_RANGE = 3; // Numero di pagine da precaricare intorno alla pagina corrente
const THUMBNAIL_SCALE = 0.8; // Scala per le thumbnail (più piccole)
const MAIN_PAGE_SCALE = 2.5; // Scala per la pagina principale (alta qualità)
const BATCH_SIZE = 5; // Numero di pagine da processare per batch

const TopicDetailViewer = ({
  topicTitle,
  topicDetails,
  originalFiles,
  currentUserSelections,
  onPageSelectionChange,
  onClose,
  isFinalizing
}) => {
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [thumbnailImages, setThumbnailImages] = useState({}); // Immagini piccole per thumbnail
  const [highResImages, setHighResImages] = useState({}); // Immagini ad alta risoluzione per vista principale
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState(null);
  const [pdfDocuments, setPdfDocuments] = useState({});
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [renderingQueue, setRenderingQueue] = useState(new Set());
  
  const canvasRef = useRef(null);
  const imageWrapperRef = useRef(null);
  const thumbnailObserverRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Determina quali file sono rilevanti per questo argomento
  const getRelevantFiles = () => {
    const relevantFiles = [];
    
    if (topicDetails?.pages_info && topicDetails.pages_info.length > 0) {
      topicDetails.pages_info.forEach(pInfo => {
        if (pInfo.pdf_index >= 0 && pInfo.pdf_index < originalFiles.length) {
          const existingFile = relevantFiles.find(f => f.fileIndex === pInfo.pdf_index);
          if (!existingFile) {
            relevantFiles.push({
              fileIndex: pInfo.pdf_index,
              file: originalFiles[pInfo.pdf_index],
              suggestedStartPage: pInfo.start_page,
              suggestedEndPage: pInfo.end_page
            });
          }
        }
      });
    } else {
      originalFiles.forEach((file, index) => {
        relevantFiles.push({
          fileIndex: index,
          file: file,
          suggestedStartPage: 1,
          suggestedEndPage: 10
        });
      });
    }
    
    return relevantFiles;
  };

  const relevantFiles = getRelevantFiles();

  // Funzione per renderizzare una singola pagina
  const renderPage = useCallback(async (fileIndex, pageNum, scale = THUMBNAIL_SCALE, priority = 'normal') => {
    if (!pdfDocuments[fileIndex]) return null;

    const cacheKey = `${fileIndex}-${pageNum}-${scale}`;
    
    // Controlla se è già in rendering
    if (renderingQueue.has(cacheKey)) {
      return null;
    }

    try {
      setRenderingQueue(prev => new Set([...prev, cacheKey]));
      
      const pdf = pdfDocuments[fileIndex];
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;
      
      const imgData = canvas.toDataURL('image/png', 0.85); // Compressione JPEG per ridurre dimensioni
      
      // Salva nell'cache appropriato
      if (scale === THUMBNAIL_SCALE) {
        setThumbnailImages(prev => ({
          ...prev,
          [fileIndex]: {
            ...prev[fileIndex],
            [pageNum - 1]: imgData
          }
        }));
      } else {
        setHighResImages(prev => ({
          ...prev,
          [fileIndex]: {
            ...prev[fileIndex],
            [pageNum - 1]: imgData
          }
        }));
      }

      return imgData;
    } catch (error) {
      console.error(`Error rendering page ${pageNum} of file ${fileIndex}:`, error);
      return null;
    } finally {
      setRenderingQueue(prev => {
        const newSet = new Set(prev);
        newSet.delete(cacheKey);
        return newSet;
      });
    }
  }, [pdfDocuments, renderingQueue]);

  // Carica i PDF documents (senza renderizzare le pagine immediatamente)
  useEffect(() => {
    let isActive = true;
    abortControllerRef.current = new AbortController();

    const loadPdfs = async () => {
      setLoading(true);
      setError(null);
      setLoadingProgress({ current: 0, total: relevantFiles.length });

      try {
        const newPdfDocuments = {};

        for (let i = 0; i < relevantFiles.length; i++) {
          if (!isActive) break;

          const { fileIndex, file } = relevantFiles[i];
          setLoadingProgress({ current: i + 1, total: relevantFiles.length });

          const fileArrayBuffer = await file.arrayBuffer();
          const loadingTask = pdfjsLib.getDocument({
            data: fileArrayBuffer,
            ...pdfLoadingOptions
          });
          
          const pdf = await loadingTask.promise;
          newPdfDocuments[fileIndex] = pdf;

          // Inizializza le cache per questo file
          setThumbnailImages(prev => ({
            ...prev,
            [fileIndex]: {}
          }));
          setHighResImages(prev => ({
            ...prev,
            [fileIndex]: {}
          }));
        }

        if (isActive) {
          setPdfDocuments(newPdfDocuments);
          setLoading(false);
          
          // Dopo il caricamento, posizionati sulla prima pagina selezionata
          const currentSelections = getCurrentFileSelections();
          if (currentSelections.length > 0) {
            const firstSelectedPage = Math.min(...currentSelections);
            setCurrentPageIndex(firstSelectedPage - 1);
          }
        }
      } catch (err) {
        console.error("Error loading PDFs:", err);
        if (isActive) {
          setError(`Errore nel caricamento dei PDF: ${err.message}`);
          setLoading(false);
        }
      }
    };

    loadPdfs();

    return () => {
      isActive = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [topicTitle]);

  // Precarica le pagine visibili e nelle vicinanze
  const preloadPages = useCallback(async (fileIndex, centerPageIndex) => {
    if (!pdfDocuments[fileIndex]) return;

    const totalPages = pdfDocuments[fileIndex].numPages;
    const startPage = Math.max(1, centerPageIndex + 1 - PRELOAD_RANGE);
    const endPage = Math.min(totalPages, centerPageIndex + 1 + PRELOAD_RANGE);

    // Lista delle pagine da caricare in ordine di priorità
    const pagesToLoad = [];
    
    // Prima la pagina corrente (alta priorità)
    pagesToLoad.push({ pageNum: centerPageIndex + 1, priority: 'high' });
    
    // Poi le pagine adiacenti
    for (let distance = 1; distance <= PRELOAD_RANGE; distance++) {
      const prevPage = centerPageIndex + 1 - distance;
      const nextPage = centerPageIndex + 1 + distance;
      
      if (prevPage >= startPage) {
        pagesToLoad.push({ pageNum: prevPage, priority: distance <= 2 ? 'medium' : 'low' });
      }
      if (nextPage <= endPage) {
        pagesToLoad.push({ pageNum: nextPage, priority: distance <= 2 ? 'medium' : 'low' });
      }
    }

    // Renderizza le thumbnail per tutte le pagine
    const thumbnailPromises = pagesToLoad.map(({ pageNum }) => 
      renderPage(fileIndex, pageNum, THUMBNAIL_SCALE, 'low')
    );

    // Renderizza la pagina corrente ad alta risoluzione
    const highResPromise = renderPage(fileIndex, centerPageIndex + 1, MAIN_PAGE_SCALE, 'high');

    // Esegui il rendering
    await Promise.allSettled([...thumbnailPromises, highResPromise]);
  }, [pdfDocuments, renderPage]);

  // Effetto per precaricare quando cambia la pagina corrente
  useEffect(() => {
    if (relevantFiles[currentFileIndex] && pdfDocuments[relevantFiles[currentFileIndex].fileIndex]) {
      const fileIndex = relevantFiles[currentFileIndex].fileIndex;
      preloadPages(fileIndex, currentPageIndex);
    }
  }, [currentFileIndex, currentPageIndex, preloadPages, relevantFiles, pdfDocuments]);

  // Intersection Observer per le thumbnail
  useEffect(() => {
    const currentFile = relevantFiles[currentFileIndex];
    if (!currentFile || !pdfDocuments[currentFile.fileIndex]) return;

    const fileIndex = currentFile.fileIndex;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const pageIndex = parseInt(entry.target.dataset.pageIndex);
          const pageNum = pageIndex + 1;
          
          // Renderizza la thumbnail se non è già presente
          if (!thumbnailImages[fileIndex]?.[pageIndex]) {
            renderPage(fileIndex, pageNum, THUMBNAIL_SCALE, 'low');
          }
        }
      });
    }, {
      rootMargin: '200px', // Inizia a caricare quando la thumbnail è vicina alla vista
      threshold: 0.1
    });

    thumbnailObserverRef.current = observer;

    // Osserva tutte le thumbnail
    const thumbnailElements = document.querySelectorAll('.thumbnail[data-page-index]');
    thumbnailElements.forEach(el => observer.observe(el));

    return () => {
      if (thumbnailObserverRef.current) {
        thumbnailObserverRef.current.disconnect();
      }
    };
  }, [currentFileIndex, relevantFiles, pdfDocuments, thumbnailImages, renderPage]);

  // Gestione zoom
  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.25, 3.0));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleResetZoom = () => {
    setZoomLevel(1.0);
  };

  // Gestione zoom con rotella del mouse
  useEffect(() => {
    const handleWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
          handleZoomIn();
        } else {
          handleZoomOut();
        }
      }
    };

    const wrapper = imageWrapperRef.current;
    if (wrapper) {
      wrapper.addEventListener('wheel', handleWheel, { passive: false });
      return () => wrapper.removeEventListener('wheel', handleWheel);
    }
  }, []);

  // Ottieni le selezioni correnti per il file attivo
  const getCurrentFileSelections = () => {
    if (!relevantFiles[currentFileIndex]) return [];
    
    const fileIndex = relevantFiles[currentFileIndex].fileIndex;
    const selectionsForTopic = currentUserSelections[topicTitle] || [];
    const fileSelection = selectionsForTopic.find(s => s.fileIndex === fileIndex);
    
    return fileSelection ? fileSelection.pages : [];
  };

  // Gestisce la selezione/deselezione di una pagina
  const handlePageToggle = (pageNumber) => {
    if (isFinalizing || !relevantFiles[currentFileIndex]) return;

    const fileIndex = relevantFiles[currentFileIndex].fileIndex;
    const currentSelections = getCurrentFileSelections();
    
    let newSelections;
    if (currentSelections.includes(pageNumber)) {
      newSelections = currentSelections.filter(p => p !== pageNumber);
    } else {
      newSelections = [...currentSelections, pageNumber].sort((a, b) => a - b);
    }

    onPageSelectionChange(topicTitle, fileIndex, newSelections);
  };

  // Naviga tra i file
  const goToNextFile = () => {
    if (currentFileIndex < relevantFiles.length - 1) {
      setCurrentFileIndex(currentFileIndex + 1);
      setCurrentPageIndex(0);
      setZoomLevel(1.0);
    }
  };

  const goToPrevFile = () => {
    if (currentFileIndex > 0) {
      setCurrentFileIndex(currentFileIndex - 1);
      setCurrentPageIndex(0);
      setZoomLevel(1.0);
    }
  };

  // Naviga tra le pagine
  const goToNextPage = () => {
    const currentFile = relevantFiles[currentFileIndex];
    if (!currentFile || !pdfDocuments[currentFile.fileIndex]) return;
    
    const totalPages = pdfDocuments[currentFile.fileIndex].numPages;
    if (currentPageIndex < totalPages - 1) {
      setCurrentPageIndex(currentPageIndex + 1);
    }
  };

  const goToPrevPage = () => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex(currentPageIndex - 1);
    }
  };

  // Gestione tasti
  useEffect(() => {
    const handleKeyDown = (e) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowRight':
          goToNextPage();
          break;
        case 'ArrowLeft':
          goToPrevPage();
          break;
        case ' ':
          e.preventDefault();
          const currentFile = relevantFiles[currentFileIndex];
          if (currentFile) {
            handlePageToggle(currentPageIndex + 1);
          }
          break;
        case '+':
        case '=':
          e.preventDefault();
          handleZoomIn();
          break;
        case '-':
          e.preventDefault();
          handleZoomOut();
          break;
        case '0':
          e.preventDefault();
          handleResetZoom();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentFileIndex, currentPageIndex]);

  // Effetto per scrollare alla thumbnail corrente quando cambia pagina
  useEffect(() => {
    const thumbnailsContainer = document.querySelector('.thumbnails-container');
    const currentThumbnail = document.querySelector(`.thumbnail:nth-child(${currentPageIndex + 1})`);
    
    if (thumbnailsContainer && currentThumbnail) {
      currentThumbnail.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [currentPageIndex]);

  if (loading) {
    return (
      <div className="topic-detail-overlay">
        <div className="topic-detail-container">
          <button className="close-btn" onClick={onClose}>
            <X size={24} />
          </button>
          <div className="loading-content">
            <div className="spinner"></div>
            <p>Caricamento PDF {loadingProgress.current} di {loadingProgress.total}...</p>
            {loadingProgress.total > 0 && (
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${(loadingProgress.current / loadingProgress.total) * 100}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="topic-detail-overlay">
        <div className="topic-detail-container">
          <button className="close-btn" onClick={onClose}>
            <X size={24} />
          </button>
          <div className="error-content">
            <p>{error}</p>
            <button onClick={onClose} className="error-close-btn">Chiudi</button>
          </div>
        </div>
      </div>
    );
  }

  const currentFile = relevantFiles[currentFileIndex];
  const currentSelections = getCurrentFileSelections();
  const isCurrentPageSelected = currentSelections.includes(currentPageIndex + 1);
  
  // Ottieni l'immagine ad alta risoluzione per la pagina corrente
  const currentPageHighRes = currentFile ? highResImages[currentFile.fileIndex]?.[currentPageIndex] : null;
  // Fallback alla thumbnail se l'alta risoluzione non è ancora caricata
  const currentPageImage = currentPageHighRes || (currentFile ? thumbnailImages[currentFile.fileIndex]?.[currentPageIndex] : null);
  
  const totalPages = currentFile ? pdfDocuments[currentFile.fileIndex]?.numPages || 0 : 0;

  return (
    <div className="topic-detail-overlay">
      <div className="topic-detail-container">
        <div className="topic-title-overlay">{topicTitle}</div>
        <button className="close-btn" onClick={onClose}>
          <X size={24} />
        </button>

        <div className="topic-detail-content">
          {/* File Navigation */}
          {relevantFiles.length > 1 && (
            <div className="file-navigation">
              <button 
                onClick={goToPrevFile} 
                disabled={currentFileIndex === 0}
                className="nav-btn"
              >
                <ChevronLeft size={20} />
              </button>
              <span className="file-info">
                File {currentFileIndex + 1} di {relevantFiles.length}: {currentFile?.file.name}
              </span>
              <button 
                onClick={goToNextFile} 
                disabled={currentFileIndex === relevantFiles.length - 1}
                className="nav-btn"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}

          {/* Main Content Area */}
          <div className="main-content">
            {/* Large Page Display */}
            <div className="large-page-container">
              {/* Zoom Controls */}
              <div className="zoom-controls">
                <button onClick={handleZoomOut} className="zoom-btn" disabled={zoomLevel <= 0.5}>
                  <ZoomOut size={18} />
                </button>
                <span className="zoom-level">{Math.round(zoomLevel * 100)}%</span>
                <button onClick={handleZoomIn} className="zoom-btn" disabled={zoomLevel >= 3.0}>
                  <ZoomIn size={18} />
                </button>
                <button onClick={handleResetZoom} className="zoom-btn reset-zoom" title="Reset zoom (100%)">
                  <RotateCcw size={18} />
                </button>
              </div>

              {currentPageImage ? (
                <div 
                  className="large-page-wrapper"
                  ref={imageWrapperRef}
                >
                  <img
                    src={currentPageImage}
                    alt={`Pagina ${currentPageIndex + 1}`}
                    className={`large-page-image ${currentPageHighRes ? 'high-res' : 'thumbnail-res'}`}
                    style={{ 
                      transform: `scale(${zoomLevel})`,
                      cursor: zoomLevel > 1 ? 'grab' : 'pointer',
                      opacity: currentPageHighRes ? 1 : 0.8 // Indica visivamente se è alta risoluzione
                    }}
                    onClick={() => handlePageToggle(currentPageIndex + 1)}
                  />
                  <div className="page-overlay">
                    <div className="page-number">
                      Pagina {currentPageIndex + 1} di {totalPages}
                      {!currentPageHighRes && <span className="loading-indicator"> (caricamento...)</span>}
                    </div>
                    <div className={`selection-indicator ${isCurrentPageSelected ? 'selected' : ''}`}>
                      {isCurrentPageSelected ? '✓ Selezionata' : 'Clicca per selezionare'}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="no-page">
                  <div className="spinner"></div>
                  <span>Caricamento pagina...</span>
                </div>
              )}

              {/* Page Navigation */}
              <div className="page-navigation">
                <button 
                  onClick={goToPrevPage} 
                  disabled={currentPageIndex === 0}
                  className="nav-btn"
                >
                  <ChevronLeft size={20} />
                  Precedente
                </button>
                <button 
                  onClick={() => handlePageToggle(currentPageIndex + 1)}
                  className={`select-btn ${isCurrentPageSelected ? 'selected' : ''}`}
                  disabled={isFinalizing}
                >
                  {isCurrentPageSelected ? 'Deseleziona' : 'Seleziona'}
                </button>
                <button 
                  onClick={goToNextPage} 
                  disabled={currentPageIndex >= totalPages - 1}
                  className="nav-btn"
                >
                  Successiva
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>

            {/* Thumbnail Strip */}
            <div className="thumbnail-strip">
              <h4>Tutte le pagine:</h4>
              <div className="thumbnails-container">
                {Array.from({ length: totalPages }, (_, index) => {
                  const pageNumber = index + 1;
                  const isSelected = currentSelections.includes(pageNumber);
                  const isCurrent = index === currentPageIndex;
                  const thumbnailImage = currentFile ? thumbnailImages[currentFile.fileIndex]?.[index] : null;
                  
                  return (
                    <div
                      key={index}
                      className={`thumbnail ${isSelected ? 'selected' : ''} ${isCurrent ? 'current' : ''}`}
                      data-page-index={index}
                      onClick={() => setCurrentPageIndex(index)}
                    >
                      {thumbnailImage ? (
                        <img
                          src={thumbnailImage}
                          alt={`Pagina ${pageNumber}`}
                          className="thumbnail-image"
                        />
                      ) : (
                        <div className="thumbnail-placeholder">
                          <div className="mini-spinner"></div>
                        </div>
                      )}
                      <div className="thumbnail-number">{pageNumber}</div>
                      {isSelected && <div className="thumbnail-check">✓</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Selection Summary */}
          <div className="selection-summary">
            <div className="summary-info">
              <FileText size={16} />
              <span>Pagine selezionate: {currentSelections.length}</span>
              {currentSelections.length > 0 && (
                <span className="selected-pages">
                  ({currentSelections.join(', ')})
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TopicDetailViewer;