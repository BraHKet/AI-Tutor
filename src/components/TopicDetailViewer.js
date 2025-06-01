// src/components/TopicDetailViewer.js - Updated Version
import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { X, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import './styles/TopicDetailViewer.css';

// Configurazione PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const pdfLoadingOptions = {
  cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
  cMapPacked: true,
  standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`
};

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
  const [pageImages, setPageImages] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pdfDocuments, setPdfDocuments] = useState({});
  
  const canvasRef = useRef(null);

  // Determina quali file sono rilevanti per questo argomento
  const getRelevantFiles = () => {
    const relevantFiles = [];
    
    if (topicDetails?.pages_info && topicDetails.pages_info.length > 0) {
      // Se ci sono suggerimenti AI, usa quelli
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
      // Se non ci sono suggerimenti, usa tutti i file
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

  // Carica i PDF
  useEffect(() => {
    let isActive = true;

    const loadPdfs = async () => {
      setLoading(true);
      setError(null);

      try {
        const newPdfDocuments = {};
        const newPageImages = {};

        for (const relevantFile of relevantFiles) {
          const { fileIndex, file } = relevantFile;
          
          if (!isActive) break;

          const fileArrayBuffer = await file.arrayBuffer();
          const loadingTask = pdfjsLib.getDocument({
            data: fileArrayBuffer,
            ...pdfLoadingOptions
          });
          
          const pdf = await loadingTask.promise;
          newPdfDocuments[fileIndex] = pdf;
          newPageImages[fileIndex] = [];

          // Renderizza tutte le pagine
          for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            if (!isActive) break;

            try {
              const page = await pdf.getPage(pageNum);
              const viewport = page.getViewport({ scale: 1.5 });
              
              const canvas = document.createElement('canvas');
              const context = canvas.getContext('2d');
              canvas.height = viewport.height;
              canvas.width = viewport.width;
              
              await page.render({
                canvasContext: context,
                viewport: viewport
              }).promise;
              
              newPageImages[fileIndex][pageNum - 1] = canvas.toDataURL('image/png');
            } catch (pageError) {
              console.error(`Error rendering page ${pageNum} of file ${file.name}:`, pageError);
              newPageImages[fileIndex][pageNum - 1] = null;
            }
          }
        }

        if (isActive) {
          setPdfDocuments(newPdfDocuments);
          setPageImages(newPageImages);
          setLoading(false);
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
    };
  }, [topicTitle]);

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
    }
  };

  const goToPrevFile = () => {
    if (currentFileIndex > 0) {
      setCurrentFileIndex(currentFileIndex - 1);
      setCurrentPageIndex(0);
    }
  };

  // Naviga tra le pagine
  const goToNextPage = () => {
    const currentFile = relevantFiles[currentFileIndex];
    if (!currentFile) return;
    
    const totalPages = pageImages[currentFile.fileIndex]?.length || 0;
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
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentFileIndex, currentPageIndex]);

  if (loading) {
    return (
      <div className="topic-detail-overlay">
        <div className="topic-detail-container">
          <button className="close-btn" onClick={onClose}>
            <X size={24} />
          </button>
          <div className="loading-content">
            <div className="spinner"></div>
            <p>Caricamento pagine PDF...</p>
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
  const currentFileImages = currentFile ? pageImages[currentFile.fileIndex] : [];
  const currentPageImage = currentFileImages?.[currentPageIndex];
  const currentSelections = getCurrentFileSelections();
  const isCurrentPageSelected = currentSelections.includes(currentPageIndex + 1);

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
              {currentPageImage ? (
                <div className="large-page-wrapper">
                  <img
                    src={currentPageImage}
                    alt={`Pagina ${currentPageIndex + 1}`}
                    className="large-page-image"
                    onClick={() => handlePageToggle(currentPageIndex + 1)}
                  />
                  <div className="page-overlay">
                    <div className="page-number">
                      Pagina {currentPageIndex + 1} di {currentFileImages.length}
                    </div>
                    <div className={`selection-indicator ${isCurrentPageSelected ? 'selected' : ''}`}>
                      {isCurrentPageSelected ? '✓ Selezionata' : 'Click per selezionare'}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="no-page">Pagina non disponibile</div>
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
                  disabled={currentPageIndex >= currentFileImages.length - 1}
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
                {currentFileImages.map((pageImage, index) => {
                  const pageNumber = index + 1;
                  const isSelected = currentSelections.includes(pageNumber);
                  const isCurrent = index === currentPageIndex;
                  
                  return (
                    <div
                      key={index}
                      className={`thumbnail ${isSelected ? 'selected' : ''} ${isCurrent ? 'current' : ''}`}
                      onClick={() => setCurrentPageIndex(index)}
                    >
                      {pageImage ? (
                        <img
                          src={pageImage}
                          alt={`Pagina ${pageNumber}`}
                          className="thumbnail-image"
                        />
                      ) : (
                        <div className="thumbnail-error">Errore</div>
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