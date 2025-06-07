// src/components/StudySession.js
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import {
  ArrowLeft, ZoomIn, ZoomOut, RotateCw, Download, Printer,
  StickyNote, Highlighter, ChevronLeft, ChevronRight,
  Maximize, Minimize, CheckCircle, X, Save, MessageSquare, Trash2
} from 'lucide-react';
import './styles/StudySession.css';
import SimpleLoading from './SimpleLoading';
import { googleDriveService } from '../utils/googleDriveService';

// Configurazione PDF.js - alternativa per compatibilità
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;
}

const StudySession = () => {
  const { projectId, topicId } = useParams();
  const navigate = useNavigate();
  const [topic, setTopic] = useState(null);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); // Changed to store the actual error object
  const [pdfFile, setPdfFile] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTool, setActiveTool] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [currentNote, setCurrentNote] = useState({ x: 0, y: 0, text: '' });
  const [highlights, setHighlights] = useState([]);
  const [notes, setNotes] = useState([]);
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);


  useEffect(() => {
    const fetchData = async () => {
      try {
        await googleDriveService.initialize(); // Initialize Google Drive service
        await fetchTopicData();
      } catch (error) {
        setError(error); // Store the error object
        setLoading(false);
      }
    };
    fetchData();
  }, [projectId, topicId]);

  useEffect(() => {
    if (topic && topic.annotations) {
      setHighlights(topic.annotations.highlights || []);
      setNotes(topic.annotations.notes || []);
    }
  }, [topic]);

  const downloadPdfChunk = async (driveFileId) => {
    try {
      const accessToken = await googleDriveService.ensureAuthenticated();
      const pdfData = await googleDriveService.downloadPdfChunk(driveFileId, accessToken);
      setPdfFile(new File([pdfData], `${topic?.title || 'documento'}.pdf`, { type: 'application/pdf' }));
    } catch (error) {
      console.error("Error downloading PDF:", error);
      setError(error); // Store the error object
    }
  };

  const fetchTopicData = async () => {
    if (!projectId || !topicId) {
      setError(new Error("Missing parameters in URL."));
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null); // Clear any previous errors

    try {
      const projectRef = doc(db, 'projects', projectId);
      const projectSnap = await getDoc(projectRef);
      if (!projectSnap.exists()) {
        throw new Error("Project not found.");
      }
      setProject(projectSnap.data());

      const topicRef = doc(db, 'projects', projectId, 'topics', topicId);
      const topicSnap = await getDoc(topicRef);
      if (!topicSnap.exists()) {
        throw new Error("Topic not found.");
      }
      const topicData = topicSnap.data();
      setTopic(topicData);

      if (topicData.sources && topicData.sources.length > 0) {
        const pdfChunk = topicData.sources.find(source =>
          source.type === 'pdf_chunk' && source.chunkDriveId
        );
        if (pdfChunk && pdfChunk.chunkDriveId) {
          await downloadPdfChunk(pdfChunk.chunkDriveId);
        } else {
          throw new Error("PDF chunk not found for this topic.");
        }
      } else if (topicData.driveFileId) {
        await downloadPdfChunk(topicData.driveFileId);
      } else {
        throw new Error("PDF file not found for this topic.");
      }
    } catch (err) {
      console.error("StudySession: Error fetching data:", err);
      setError(err); // Store the error object
    } finally {
      setLoading(false);
    }
  };

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  const onDocumentLoadError = (error) => {
    console.error('PDF Load Error:', error);
    setError("Error loading PDF. Please verify file accessibility.");
  };

  const goToPrevPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, numPages));
  };

  const zoomIn = () => {
    setScale(prev => Math.min(prev + 0.2, 3));
  };

  const zoomOut = () => {
    setScale(prev => Math.max(prev - 0.2, 0.5));
  };

  const rotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
    setIsFullscreen(!isFullscreen);
  };

  const startHighlighting = (e) => {
    if (activeTool !== 'highlighter') return;

    setIsDrawing(true);
    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setHighlights(prev => [...prev, {
      id: Date.now(),
      page: currentPage,
      startX: x,
      startY: y,
      endX: x,
      endY: y,
      color: '#ffeb3b'
    }]);
  };

  const continueHighlighting = (e) => {
    if (!isDrawing || activeTool !== 'highlighter') return;

    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setHighlights(prev => {
      const newHighlights = [...prev];
      const lastHighlight = newHighlights[newHighlights.length - 1];
      if (lastHighlight) {
        lastHighlight.endX = x;
        lastHighlight.endY = y;
      }
      return newHighlights;
    });
  };

  const stopHighlighting = () => {
    setIsDrawing(false);
  };

  const addNote = (e) => {
    if (activeTool !== 'note') return;

    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setCurrentNote({ x, y, text: '', page: currentPage });
    setShowNoteModal(true);
  };

  const saveNote = () => {
    if (currentNote.text.trim()) {
      setNotes(prev => [...prev, {
        id: Date.now(),
        ...currentNote
      }]);
    }
    setShowNoteModal(false);
    setCurrentNote({ x: 0, y: 0, text: '', page: currentPage });
  };

  const deleteNote = (noteId) => {
    setNotes(prev => prev.filter(note => note.id !== noteId));
  };

  const deleteHighlight = (highlightId) => {
    setHighlights(prev => prev.filter(highlight => highlight.id !== highlightId));
  };

  const saveAnnotations = async () => {
    if (!topic) return;

    try {
      const topicRef = doc(db, 'projects', projectId, 'topics', topicId);
      await updateDoc(topicRef, {
        annotations: {
          highlights,
          notes
        },
        lastStudied: new Date()
      });

      console.log('Annotations saved successfully');
    } catch (error) {
      console.error('Error saving annotations:', error);
    }
  };

  const markAsCompleted = async () => {
    if (!topic) return;

    try {
      const topicRef = doc(db, 'projects', projectId, 'topics', topicId);
      await updateDoc(topicRef, {
        isCompleted: true,
        completedAt: new Date()
      });

      navigate(`/projects/${projectId}/day/${topic.assignedDay}/topics`);
    } catch (error) {
      console.error('Error updating topic:', error);
    }
  };

  const downloadPDF = () => {
    if (pdfFile) {
      const url = URL.createObjectURL(pdfFile);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${topic?.title || 'documento'}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  const printPDF = () => {
    window.print();
  };

  const handleBackClick = () => {
    if (topic) {
      navigate(`/projects/${projectId}/day/${topic.assignedDay}/topics`);
    } else {
      navigate(`/projects/${projectId}/plan`);
    }
  };

  if (loading) {
    return <SimpleLoading message="Loading study session..." />;
  }

  if (error) {
    return (
      <div className="study-session-container">
        <div className="error-container">
          <X size={36} />
          <h2>Error</h2>
          <p>{error?.message || 'An unexpected error occurred.'}</p> {/*Handle potential null error*/}
          <button onClick={handleBackClick} className="back-button">
            <ArrowLeft size={16} />
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`study-session-container ${isFullscreen ? 'fullscreen' : ''}`}>
      {!isFullscreen && (
        <div className="study-header">
          <div className="header-left">
            <button onClick={handleBackClick} className="back-button">
              <ArrowLeft size={20} />
              Back
            </button>

            <div className="topic-info">
              <h1>{topic?.title}</h1>
              <span className="project-name">{project?.title}</span>
            </div>
          </div>

          <div className="header-right">
            <button onClick={markAsCompleted} className="complete-button">
              <CheckCircle size={18} />
              Mark as Complete
            </button>
          </div>
        </div>
      )}

      <div className="study-toolbar">
        <div className="toolbar-section">
          <button onClick={goToPrevPage} disabled={currentPage <= 1}>
            <ChevronLeft size={18} />
          </button>

          <span className="page-info">
            {currentPage} of {numPages}
          </span>

          <button onClick={goToNextPage} disabled={currentPage >= numPages}>
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="toolbar-section">
          <button onClick={zoomOut} disabled={scale <= 0.5}>
            <ZoomOut size={18} />
          </button>

          <span className="zoom-info">
            {Math.round(scale * 100)}%
          </span>

          <button onClick={zoomIn} disabled={scale >= 3}>
            <ZoomIn size={18} />
          </button>

          <button onClick={rotate}>
            <RotateCw size={18} />
          </button>
        </div>

        <div className="toolbar-section">
          <button
            className={activeTool === 'highlighter' ? 'active' : ''}
            onClick={() => setActiveTool(activeTool === 'highlighter' ? null : 'highlighter')}
          >
            <Highlighter size={18} />
          </button>

          <button
            className={activeTool === 'note' ? 'active' : ''}
            onClick={() => setActiveTool(activeTool === 'note' ? null : 'note')}
          >
            <StickyNote size={18} />
          </button>

          <button onClick={saveAnnotations}>
            <Save size={18} />
          </button>
        </div>

        <div className="toolbar-section">
          <button onClick={downloadPDF}>
            <Download size={18} />
          </button>

          <button onClick={printPDF}>
            <Printer size={18} />
          </button>

          <button onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
        </div>
      </div>

      <div className="pdf-viewer">
        <div className="pdf-container">
          {pdfFile && (
            <Document
              file={pdfFile}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={<SimpleLoading message="Loading PDF..." />}
            >
              <div className="pdf-page-container">
                <Page
                  pageNumber={currentPage}
                  scale={scale}
                  rotate={rotation}
                  onMouseDown={activeTool === 'highlighter' ? startHighlighting : undefined}
                  onMouseMove={continueHighlighting}
                  onMouseUp={stopHighlighting}
                  onClick={activeTool === 'note' ? addNote : undefined}
                />

                <div className="annotations-overlay" ref={overlayRef}>
                  {highlights
                    .filter(highlight => highlight.page === currentPage)
                    .map(highlight => (
                      <div
                        key={highlight.id}
                        className="highlight"
                        style={{
                          position: 'absolute',
                          left: Math.min(highlight.startX, highlight.endX),
                          top: Math.min(highlight.startY, highlight.endY),
                          width: Math.abs(highlight.endX - highlight.startX),
                          height: Math.abs(highlight.endY - highlight.startY),
                          backgroundColor: highlight.color,
                          opacity: 0.3,
                          pointerEvents: 'none'
                        }}
                        onDoubleClick={() => deleteHighlight(highlight.id)}
                      />
                    ))}

                  {notes
                    .filter(note => note.page === currentPage)
                    .map(note => (
                      <div
                        key={note.id}
                        className="note-marker"
                        style={{
                          position: 'absolute',
                          left: note.x,
                          top: note.y,
                          transform: 'translate(-50%, -50%)'
                        }}
                        title={note.text}
                      >
                        <MessageSquare size={16} />
                        <div className="note-tooltip">
                          {note.text}
                          <button onClick={() => deleteNote(note.id)}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </Document>
          )}
          {!pdfFile && !error && <p>Loading PDF...</p>}
        </div>
      </div>

      {showNoteModal && (
        <div className="note-modal-overlay">
          <div className="note-modal">
            <h3>Add Note</h3>
            <textarea
              value={currentNote.text}
              onChange={(e) => setCurrentNote(prev => ({ ...prev, text: e.target.value }))}
              placeholder="Enter your note..."
              rows={4}
              autoFocus
            />
            <div className="note-modal-buttons">
              <button onClick={() => setShowNoteModal(false)}>Cancel</button>
              <button onClick={saveNote} disabled={!currentNote.text.trim()}>
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudySession;