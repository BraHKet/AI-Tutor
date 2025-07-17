// src/components/StudySession.js
import React, { useState, useEffect, useRef } from 'react';
// MODIFICA 1: Importa useLocation per leggere lo stato della rotta
import { useParams, useNavigate, useLocation } from 'react-router-dom'; 
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';
import * as pdfjsLib from 'pdfjs-dist';
import {
  ArrowLeft, ZoomIn, ZoomOut, RotateCw, Download, Printer,
  StickyNote, Highlighter, ChevronLeft, ChevronRight,
  Maximize, Minimize, CheckCircle, X, Save, MessageSquare
} from 'lucide-react';
import './styles/StudySession.css';
import SimpleLoading from './SimpleLoading';
import { googleDriveService } from '../utils/googleDriveService';

// Configurazione PDF.js worker (invariata)
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
  // MODIFICA 2: Usa il hook useLocation per accedere allo stato passato da TopicViewer
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
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTool, setActiveTool] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [currentNote, setCurrentNote] = useState({ x: 0, y: 0, text: '' });
  const [highlights, setHighlights] = useState([]);
  const [notes, setNotes] = useState([]);
  const [renderingPage, setRenderingPage] = useState(false);
  
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const containerRef = useRef(null);

  // Questo useEffect ora dipende anche da 'selectedResource' per ricaricare se necessario
  useEffect(() => {
    const fetchData = async () => {
      try {
        await googleDriveService.initialize();
        await fetchTopicData();
      } catch (error) {
        setError(error);
        setLoading(false);
      }
    };
    fetchData();
  }, [projectId, topicId, selectedResource]); // Aggiunta dipendenza

  useEffect(() => {
    if (topic && topic.annotations) {
      setHighlights(topic.annotations.highlights || []);
      setNotes(topic.annotations.notes || []);
    }
  }, [topic]);

  useEffect(() => {
    if (pdfDocument && currentPage) {
      renderPage();
    }
  }, [pdfDocument, currentPage, scale, rotation]);

  const downloadPdfChunk = async (driveFileId) => {
    try {
      const accessToken = await googleDriveService.ensureAuthenticated();
      const pdfBlob = await googleDriveService.downloadPdfChunk(driveFileId, accessToken);
      const arrayBuffer = await pdfBlob.arrayBuffer();
      await loadPdfDocument(arrayBuffer);
    } catch (error) {
      console.error("Error downloading PDF:", error);
      setError(error);
    }
  };

  const loadPdfDocument = async (pdfArrayBuffer) => {
    try {
      setRenderingPage(true);
      const loadingTask = pdfjsLib.getDocument({ data: pdfArrayBuffer });
      const pdf = await loadingTask.promise;
      setPdfDocument(pdf);
      setNumPages(pdf.numPages);
      // Resetta sempre alla prima pagina quando si carica un nuovo documento
      setCurrentPage(1);
    } catch (error) {
      console.error('Errore nel caricamento del PDF:', error);
      setError('Errore nel caricamento del PDF');
    } finally {
      setRenderingPage(false);
    }
  };

  const renderPage = async () => {
    if (!pdfDocument || !canvasRef.current || renderingPage) return;
    try {
      setRenderingPage(true);
      const page = await pdfDocument.getPage(currentPage);
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      const devicePixelRatio = window.devicePixelRatio || 1;
      const backingStoreRatio = context.webkitBackingStorePixelRatio || 1;
      const pixelRatio = Math.max(devicePixelRatio / backingStoreRatio, 2);
      let viewport = page.getViewport({ scale: scale * pixelRatio, rotation });
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      canvas.style.width = `${viewport.width / pixelRatio}px`;
      canvas.style.height = `${viewport.height / pixelRatio}px`;
      context.scale(pixelRatio, pixelRatio);
      context.clearRect(0, 0, canvas.width / pixelRatio, canvas.height / pixelRatio);
      const renderContext = {
        canvasContext: context,
        viewport: page.getViewport({ scale, rotation })
      };
      await page.render(renderContext).promise;
    } catch (error) {
      console.error('Errore nel rendering della pagina:', error);
      setError('Errore nel rendering della pagina');
    } finally {
      setRenderingPage(false);
    }
  };

  const fetchTopicData = async () => {
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

      // --- MODIFICA 3: Logica di caricamento PDF aggiornata ---
      if (selectedResource && selectedResource.driveId) {
        // CASO 1: È stato cliccato un satellite. Carica il suo PDF.
        console.log(`Caricamento risorsa specifica: ${selectedResource.name} (ID: ${selectedResource.driveId})`);
        await downloadPdfChunk(selectedResource.driveId);
      } else if (topicData.sources && topicData.sources.length > 0) {
        // CASO 2: Nessuna risorsa specifica. Carica il PDF principale (comportamento di default).
        console.log("Nessuna risorsa specifica, cerco il PDF principale...");
        const pdfChunk = topicData.sources.find(source =>
          source.type === 'pdf_chunk' && source.chunkDriveId
        );
        if (pdfChunk && pdfChunk.chunkDriveId) {
          await downloadPdfChunk(pdfChunk.chunkDriveId);
        } else {
          throw new Error("PDF principale non trovato per questo argomento.");
        }
      } else {
        // CASO 3: Nessuna fonte disponibile.
        throw new Error("Nessun file PDF trovato per questo argomento.");
      }
    } catch (err) {
      console.error("StudySession: Errore nel recupero dati:", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  // --- Le funzioni rimanenti (goToPrevPage, zoomIn, etc.) sono invariate ---
  const goToPrevPage = () => { if (currentPage > 1) setCurrentPage(currentPage - 1); };
  const goToNextPage = () => { if (currentPage < numPages) setCurrentPage(currentPage + 1); };
  const zoomIn = () => setScale(Math.min(scale + 0.25, 4));
  const zoomOut = () => setScale(Math.max(scale - 0.25, 0.5));
  const rotate = () => setRotation(prev => (prev + 90) % 360);
  const toggleFullscreen = () => { if (!isFullscreen) document.documentElement.requestFullscreen(); else document.exitFullscreen(); setIsFullscreen(!isFullscreen); };
  const startHighlighting = (e) => { if (activeTool !== 'highlighter') return; setIsDrawing(true); const rect = canvasRef.current.getBoundingClientRect(); const x = e.clientX - rect.left; const y = e.clientY - rect.top; setHighlights(prev => [...prev, { id: Date.now(), page: currentPage, startX: x, startY: y, endX: x, endY: y, color: '#ffeb3b' }]); };
  const continueHighlighting = (e) => { if (!isDrawing || activeTool !== 'highlighter') return; const rect = canvasRef.current.getBoundingClientRect(); const x = e.clientX - rect.left; const y = e.clientY - rect.top; setHighlights(prev => { const newHighlights = [...prev]; const lastHighlight = newHighlights[newHighlights.length - 1]; if (lastHighlight) { lastHighlight.endX = x; lastHighlight.endY = y; } return newHighlights; }); };
  const stopHighlighting = () => setIsDrawing(false);
  const addNote = (e) => { if (activeTool !== 'note') return; const rect = canvasRef.current.getBoundingClientRect(); const x = e.clientX - rect.left; const y = e.clientY - rect.top; setCurrentNote({ x, y, text: '', page: currentPage }); setShowNoteModal(true); };
  const saveNote = () => { if (currentNote.text.trim()) { setNotes(prev => [...prev, { ...currentNote, id: Date.now() }]); } setShowNoteModal(false); setCurrentNote({ x: 0, y: 0, text: '', page: currentPage }); };
  const deleteNote = (noteId) => setNotes(prev => prev.filter(note => note.id !== noteId));
  const deleteHighlight = (highlightId) => setHighlights(prev => prev.filter(highlight => highlight.id !== highlightId));
  const saveAnnotations = async () => { if (!topic || !projectId || !topicId) return; try { const topicRef = doc(db, 'projects', projectId, 'topics', topicId); await updateDoc(topicRef, { 'annotations.highlights': highlights, 'annotations.notes': notes, lastUpdated: new Date().toISOString() }); alert('Annotazioni salvate con successo!'); } catch (error) { console.error('Error saving annotations:', error); alert('Errore nel salvataggio delle annotazioni'); } };
  const downloadPDF = async () => { if (!pdfDocument) return; try { const driveIdToDownload = selectedResource?.driveId || topic.sources?.find(s => s.type === 'pdf_chunk')?.chunkDriveId; if (!driveIdToDownload) throw new Error("ID del file non trovato"); const accessToken = await googleDriveService.ensureAuthenticated(); const pdfBlob = await googleDriveService.downloadPdfChunk(driveIdToDownload, accessToken); const url = URL.createObjectURL(pdfBlob); const a = document.createElement('a'); a.href = url; a.download = `${selectedResource?.name || topic?.title || 'documento'}.pdf`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); } catch (error) { console.error('Errore nel download:', error); alert('Errore nel download del PDF'); } };
  const printPDF = () => window.print();

  // --- Il rendering JSX è invariato ---
  if (loading) return <SimpleLoading message="Caricamento sessione di studio..." fullScreen={true} />;
  if (error) return ( <div className="error-container"> <X size={48} /> <h2>Errore nel caricamento</h2> <p>{typeof error === 'string' ? error : error.message}</p> <button onClick={() => navigate(-1)} className="btn btn-primary"> Torna indietro </button> </div> );
  return (
    <div className={`study-session-container ${isFullscreen ? 'fullscreen' : ''}`}>
      {showNoteModal && ( <div className="note-modal-overlay"> <div className="note-modal"> <h3>Aggiungi nota</h3> <textarea value={currentNote.text} onChange={(e) => setCurrentNote(prev => ({ ...prev, text: e.target.value }))} placeholder="Scrivi la tua nota qui..." rows={4} autoFocus /> <div className="note-modal-buttons"> <button onClick={() => setShowNoteModal(false)}> <X size={16} /> Annulla </button> <button onClick={saveNote} disabled={!currentNote.text.trim()}> <CheckCircle size={16} /> Salva </button> </div> </div> </div> )}
      <div className="study-header">
        <div className="header-left">
          <button onClick={() => navigate(-1)} className="back-button"> <ArrowLeft size={20} /> </button>
          <div className="topic-info">
            {/* Mostra il nome del file specifico se presente, altrimenti il titolo del topic */}
            <h1>{selectedResource?.name || topic?.title}</h1>
            <p>{project?.title}</p>
          </div>
        </div>
        <div className="header-right"> <span className="study-progress"> Pagina {currentPage} di {numPages || 0} </span> </div>
      </div>
      <div className="study-toolbar">
        <div className="toolbar-section"> <button onClick={goToPrevPage} disabled={currentPage <= 1} title="Pagina precedente"> <ChevronLeft size={18} /> </button> <span className="page-info"> {currentPage} / {numPages || 0} </span> <button onClick={goToNextPage} disabled={currentPage >= numPages} title="Pagina successiva"> <ChevronRight size={18} /> </button> </div>
        <div className="toolbar-section"> <button onClick={zoomOut} title="Riduci zoom"> <ZoomOut size={18} /> </button> <span className="zoom-info"> {Math.round(scale * 100)}% </span> <button onClick={zoomIn} title="Aumenta zoom"> <ZoomIn size={18} /> </button> <button onClick={rotate} title="Ruota"> <RotateCw size={18} /> </button> </div>
        <div className="toolbar-section"> <button className={activeTool === 'highlighter' ? 'active' : ''} onClick={() => setActiveTool(activeTool === 'highlighter' ? null : 'highlighter')} title="Evidenziatore"> <Highlighter size={18} /> </button> <button className={activeTool === 'note' ? 'active' : ''} onClick={() => setActiveTool(activeTool === 'note' ? null : 'note')} title="Aggiungi nota"> <StickyNote size={18} /> </button> <button onClick={saveAnnotations} title="Salva annotazioni"> <Save size={18} /> </button> </div>
        <div className="toolbar-section"> <button onClick={downloadPDF} title="Scarica PDF"> <Download size={18} /> </button> <button onClick={printPDF} title="Stampa"> <Printer size={18} /> </button> <button onClick={toggleFullscreen} title="Schermo intero"> {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />} </button> </div>
      </div>
      <div className="pdf-viewer">
        <div className="pdf-container" ref={containerRef}>
          {pdfDocument ? (
            <div className="pdf-page-container" data-tool={activeTool}>
              {renderingPage && ( <div className="pdf-loading-overlay"> <SimpleLoading message="Rendering pagina..." /> </div> )}
              <canvas ref={canvasRef} onMouseDown={activeTool === 'highlighter' ? startHighlighting : undefined} onMouseMove={continueHighlighting} onMouseUp={stopHighlighting} onClick={activeTool === 'note' ? addNote : undefined} style={{ display: 'block', margin: '0 auto', cursor: activeTool === 'highlighter' ? 'crosshair' : activeTool === 'note' ? 'copy' : 'default', imageRendering: 'crisp-edges' }} />
              <div className="annotations-overlay" ref={overlayRef}>
                {highlights .filter(highlight => highlight.page === currentPage) .map(highlight => ( <div key={highlight.id} className="highlight" style={{ position: 'absolute', left: Math.min(highlight.startX, highlight.endX), top: Math.min(highlight.startY, highlight.endY), width: Math.abs(highlight.endX - highlight.startX), height: Math.abs(highlight.endY - highlight.startY), backgroundColor: highlight.color, opacity: 0.3, pointerEvents: 'auto' }} onClick={() => deleteHighlight(highlight.id)} title="Clicca per eliminare evidenziazione" /> ))}
                {notes .filter(note => note.page === currentPage) .map(note => ( <div key={note.id} className="note-marker" style={{ position: 'absolute', left: note.x - 12, top: note.y - 12 }} onClick={() => deleteNote(note.id)} title="Clicca per eliminare nota"> <MessageSquare size={14} /> <div className="note-tooltip"> {note.text} </div> </div> ))}
              </div>
            </div>
          ) : ( <SimpleLoading message="Caricamento PDF..." /> )}
        </div>
      </div>
    </div>
  );
};

export default StudySession;