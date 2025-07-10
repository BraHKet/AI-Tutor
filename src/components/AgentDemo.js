// ==========================================
// FILE: src/components/AgentDemo.js (SEQUENTIAL RESPONSE SYSTEM)
// ==========================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { googleDriveService } from '../utils/googleDriveService';
import { PhysicsAgent } from '../agents/PhysicsAgent';
import VoiceManager, { voiceUtils } from './VoiceManager';
import { 
  Bot, FileText, MessageSquare, Send, Trash2, 
  History, Mic, X, Volume2, Edit3, Plus, Type
} from 'lucide-react';
import styles from './styles/AgentDemo.module.css';

export default function AgentDemo() {
  const { projectId, topicId } = useParams();
  const navigate = useNavigate();

  // Core states
  const [agent, setAgent] = useState(null);
  const [status, setStatus] = useState('Initializing...');
  const [isProcessing, setIsProcessing] = useState(false);
  const FIXED_CANVAS_HEIGHT = 600; // Altezza fissa del foglio di disegno
  
  // Exam states
  const [materialReady, setMaterialReady] = useState(false);
  const [examStarted, setExamStarted] = useState(false);
  const [mainTopic, setMainTopic] = useState('');
  const [conversation, setConversation] = useState([]);
  const [isComplete, setIsComplete] = useState(false);
  const [progress, setProgress] = useState({ covered: 0, total: 0, percentage: 0 });
  
  // Sequential Response states - NUOVO SISTEMA
  const [sequentialElements, setSequentialElements] = useState([]);
  const [activeElementId, setActiveElementId] = useState(null);
  const [currentTool, setCurrentTool] = useState('pointer'); // Solo per i canvas di disegno
  
  // Drawing states per ogni canvas - OTTIMIZZATO
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [strokeColor, setStrokeColor] = useState('#000000');
  const lastPointRef = useRef(null); // <-- MODIFICATO: Usa useRef per le coordinate
  const [activeCanvasId, setActiveCanvasId] = useState(null);
  const drawingAnimationFrame = useRef(null);

  // Voice states
  const [voiceActiveForElement, setVoiceActiveForElement] = useState(null);
  const [currentTranscript, setCurrentTranscript] = useState('');

  // AI Response states
  const [showAIResponse, setShowAIResponse] = useState(false);
  const [currentAIResponse, setCurrentAIResponse] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [autoSpeak, setAutoSpeak] = useState(true);

  // Initialize
  useEffect(() => {
    const init = async () => {
      try {
        setStatus('🔧 Initializing...');
        await googleDriveService.initialize();

        const physicsAgent = new PhysicsAgent(
          process.env.REACT_APP_SUPABASE_URL,
          process.env.REACT_APP_SUPABASE_ANON_KEY
        );
        
        await physicsAgent.initialize();
        setAgent(physicsAgent);
        setStatus('✅ Ready. Analyze material to begin.');
      } catch (error) {
        setStatus(`❌ Error: ${error.message}`);
      }
    };
    init();
  }, []);

  // Voice transcript handler - OTTIMIZZATO ANTI-BLOCCO
  const handleTranscriptUpdate = useCallback((transcript, isFinal) => {
    console.log('🎤 Voice update:', { transcript, isFinal, activeElement: voiceActiveForElement });
    
    // Aggiorna sempre il transcript corrente (per feedback visivo)
    setCurrentTranscript(transcript);
    
    // Solo quando è final E c'è contenuto E c'è un elemento attivo
    if (isFinal && transcript.trim() && voiceActiveForElement) {
      const cleanTranscript = transcript.trim();
      console.log('✅ Adding to element:', voiceActiveForElement, 'text:', cleanTranscript);
      
      setSequentialElements(prev => prev.map(element => {
        if (element.id === voiceActiveForElement) {
          const newContent = element.content + (element.content ? ' ' : '') + cleanTranscript;
          console.log('📝 Updated element content:', newContent);
          return { ...element, content: newContent };
        }
        return element;
      }));
      
      // Pulisci il transcript dopo l'aggiunta
      setTimeout(() => {
        setCurrentTranscript('');
      }, 100);
    }
  }, [voiceActiveForElement]);

  // Auto-speak AI responses
  useEffect(() => {
    if (autoSpeak && showAIResponse && currentAIResponse) {
      setTimeout(() => {
        voiceUtils.speak(currentAIResponse);
      }, 500);
    }
  }, [showAIResponse, currentAIResponse, autoSpeak]);

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (drawingAnimationFrame.current) {
        cancelAnimationFrame(drawingAnimationFrame.current);
      }
    };
  }, []);

  // ===============================================
  // SEQUENTIAL ELEMENTS FUNCTIONS - NUOVO SISTEMA
  // ===============================================

  const addTextElement = useCallback(() => {
    const newElement = {
      id: Date.now(),
      type: 'text',
      content: '',
      timestamp: new Date()
    };
    
    setSequentialElements(prev => [...prev, newElement]);
    setActiveElementId(newElement.id);
    
    // Auto-focus dopo un momento
    setTimeout(() => {
      const textarea = document.getElementById(`element-${newElement.id}`);
      if (textarea) textarea.focus();
    }, 50);
  }, []);

  const addDrawingElement = useCallback(() => {
    const newElement = {
      id: Date.now(),
      type: 'drawing',
      content: '', // Conterrà i dati canvas
      canvasData: null,
      timestamp: new Date()
    };
    
    setSequentialElements(prev => [...prev, newElement]);
    setActiveElementId(newElement.id);
    setActiveCanvasId(newElement.id);
    
    // Inizializza il canvas dopo un momento
    setTimeout(() => {
      initializeElementCanvas(newElement.id);
    }, 100);
  }, []);

  const updateElementContent = useCallback((id, content) => {
    setSequentialElements(prev => prev.map(element => 
      element.id === id ? { ...element, content } : element
    ));
  }, []);

  const deleteElement = useCallback((id) => {
    setSequentialElements(prev => prev.filter(element => element.id !== id));
    if (activeElementId === id) {
      setActiveElementId(null);
    }
    if (activeCanvasId === id) {
      setActiveCanvasId(null);
    }
  }, [activeElementId, activeCanvasId]);

  // ===============================================
  // CANVAS FUNCTIONS per elementi di disegno
  // ===============================================


  
  const initializeElementCanvas = useCallback((elementId) => {
    const canvas = document.getElementById(`canvas-${elementId}`);
    if (canvas) {
        const container = canvas.parentElement;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        if (rect.width <= 0) return;

        const width = rect.width;
        const height = FIXED_CANVAS_HEIGHT; // Usa la costante
        
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}, []);

const reinitializeAllCanvases = useCallback(() => {
    sequentialElements.forEach(element => {
        if (element.type === 'drawing') {
            initializeElementCanvas(element.id);
        }
    });
}, [sequentialElements, initializeElementCanvas]);


  const getEventCoords = useCallback((e, canvasId) => {
    // Se l'evento non è valido, esci subito.
    if (!e) return null;

    const canvas = document.getElementById(`canvas-${canvasId}`);
    if (!canvas) return null;
    
    const rect = canvas.getBoundingClientRect();
    
    // Un PointerEvent avrà sempre clientX e clientY.
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
}, []);

  const startDrawing = useCallback((e, canvasId) => {
    if (currentTool !== 'pen' && currentTool !== 'eraser') return;
    
    e.preventDefault(); // <-- Usa 'e' direttamente
    setIsDrawing(true);
    setActiveCanvasId(canvasId);
    
    const canvas = document.getElementById(`canvas-${canvasId}`);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    ctx.globalCompositeOperation = currentTool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.lineWidth = currentTool === 'eraser' ? strokeWidth * 5 : strokeWidth;
    ctx.strokeStyle = strokeColor;

    // Usa 'e' direttamente. React fornisce già il metodo corretto.
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    const firstEvent = events[0];
    const coords = getEventCoords(firstEvent, canvasId);
    if (!coords) return;
    
    lastPointRef.current = coords;
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();

}, [currentTool, getEventCoords, strokeColor, strokeWidth]);

  const draw = useCallback((e, canvasId) => {
    if (!isDrawing || !lastPointRef.current || activeCanvasId !== canvasId) return;
    
    e.preventDefault(); // <-- Usa 'e' direttamente

    if (drawingAnimationFrame.current) cancelAnimationFrame(drawingAnimationFrame.current);
    
    drawingAnimationFrame.current = requestAnimationFrame(() => {
        const canvas = document.getElementById(`canvas-${canvasId}`);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        // Usa 'e' direttamente.
        const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      
        for (const event of events) {
            const coords = getEventCoords(event, canvasId);
            if (!coords) continue;
            ctx.lineTo(coords.x, coords.y);
        }
        ctx.stroke();
      
        const lastCoords = getEventCoords(events[events.length - 1], canvasId);
        if(lastCoords) {
            lastPointRef.current = lastCoords;
        }
    });
}, [isDrawing, activeCanvasId, getEventCoords]);

  const stopDrawing = useCallback((canvasId) => {
    if (isDrawing && activeCanvasId === canvasId) {
      setIsDrawing(false);
      lastPointRef.current = null; // MODIFICATO: Resetta il ref
      
      if (drawingAnimationFrame.current) {
        cancelAnimationFrame(drawingAnimationFrame.current);
        drawingAnimationFrame.current = null;
      }
      
      setTimeout(() => {
        const canvas = document.getElementById(`canvas-${canvasId}`);
        if (canvas) {
          const dataURL = canvas.toDataURL('image/png');
          setSequentialElements(prev => prev.map(element => 
            element.id === canvasId 
              ? { ...element, canvasData: dataURL }
              : element
          ));
        }
      }, 100);
    }
}, [isDrawing, activeCanvasId]);

  const clearElementCanvas = useCallback((canvasId) => {
    const canvas = document.getElementById(`canvas-${canvasId}`);
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Aggiorna l'elemento
      setSequentialElements(prev => prev.map(element => 
        element.id === canvasId 
          ? { ...element, canvasData: null }
          : element
      ));
    }
  }, []);

  // ===============================================
  // CONTENT FUNCTIONS
  // ===============================================

  const hasContent = useCallback(() => {
    return sequentialElements.some(element => {
      if (element.type === 'text') {
        return element.content.trim();
      } else if (element.type === 'drawing') {
        return element.canvasData;
      }
      return false;
    });
  }, [sequentialElements]);

  const compileSequentialContent = useCallback(() => {
    let combinedText = '';
    const sequentialData = [];
    
    // Processa gli elementi nell'ordine esatto di aggiunta
    sequentialElements.forEach((element, index) => {
      if (element.type === 'text' && element.content.trim()) {
        const textContent = element.content.trim();
        combinedText += `${textContent}\n\n`;
        sequentialData.push({
          type: 'text',
          content: textContent,
          index: index
        });
      } else if (element.type === 'drawing' && element.canvasData) {
        combinedText += `[Disegno/Formula ${index + 1}]\n\n`;
        sequentialData.push({
          type: 'drawing',
          content: element.canvasData,
          index: index
        });
      }
    });
    
    // Per compatibilità con il sistema esistente, usa il primo disegno come primary
    const firstDrawing = sequentialData.find(item => item.type === 'drawing');
    
    return { 
      textContent: combinedText.trim(), 
      sequentialData: sequentialData,
      // Per compatibilità con il sistema esistente
      drawingImage: firstDrawing ? firstDrawing.content : null,
      drawingImages: sequentialData.filter(item => item.type === 'drawing').map(item => item.content)
    };
  }, [sequentialElements]);

  const clearAllElements = useCallback(() => {
    setSequentialElements([]);
    setActiveElementId(null);
    setActiveCanvasId(null);
    setVoiceActiveForElement(null);
    setCurrentTranscript('');
  }, []);

  // ===============================================
  // EXAM FUNCTIONS (rimangono uguali)
  // ===============================================

  const analyzeMaterial = async () => {
    if (!agent) return;

    try {
      setIsProcessing(true);
      setStatus('📄 Analyzing material...');

      const topicRef = doc(db, 'projects', projectId, 'topics', topicId);
      const topicSnap = await getDoc(topicRef);
      if (!topicSnap.exists()) throw new Error("Topic not found");
      
      const topicData = topicSnap.data();
      const driveFileId = topicData.driveFileId || topicData.sources?.find(s => s.chunkDriveId)?.chunkDriveId;
      const pdfName = topicData.title || 'material.pdf';
      
      if (!driveFileId) throw new Error("PDF not found");
      
      const accessToken = await googleDriveService.ensureAuthenticated();
      const pdfBlob = await googleDriveService.downloadPdfChunk(driveFileId, accessToken);

      await agent.analyzeMaterial(
        { blob: pdfBlob, name: pdfName },
        (progress) => setStatus(`📄 ${progress.message}`)
      );

      setMaterialReady(true);
      setStatus('✅ Material ready! Start examination.');
    } catch (error) {
      setStatus(`❌ Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const startExam = async () => {
    if (!agent || !materialReady) return;

    try {
      setIsProcessing(true);
      setStatus('🎓 Starting examination...');

      const result = await agent.startExamination();

      if (result.success) {
        setExamStarted(true);
        setMainTopic(result.mainTopic);
        setProgress({ covered: 0, total: result.totalItems, percentage: 0 });
        
        const initialMessage = {
          speaker: 'professor',
          content: result.initialQuestion,
          timestamp: new Date()
        };
        
        setConversation([initialMessage]);
        setCurrentAIResponse(result.initialQuestion);
        setShowAIResponse(true);
        setStatus(`💬 Exam started (0/${result.totalItems} items)`);
      }
    } catch (error) {
      setStatus(`❌ Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const sendSequentialContent = async () => {
    if (!agent || isProcessing || !hasContent()) return;

    try {
      setIsProcessing(true);
      voiceUtils.stopSpeaking();
      
      const { textContent, drawingImage, sequentialData } = compileSequentialContent();
      
      // Debug: stampa la sequenza elaborata
      console.log('📝 Sequential content:', {
        textContent,
        sequentialData,
        originalOrder: sequentialElements.map(el => ({ id: el.id, type: el.type }))
      });
      
      let finalText = textContent;
      if (drawingImage && textContent) {
        finalText += ' [Con elementi grafici allegati]';
      } else if (drawingImage && !textContent) {
        finalText = '[Solo elementi grafici]';
      }
      
      const studentMessage = {
        speaker: 'student',
        content: finalText,
        image: drawingImage,
        textContent: textContent,
        sequentialData: sequentialData, // Aggiungi dati sequenziali
        timestamp: new Date()
      };
      
      setConversation(prev => [...prev, studentMessage]);

      const result = await agent.processResponse({
        text: textContent,
        image: drawingImage,
        sequential: sequentialData // Passa anche i dati sequenziali
      });

      const aiMessage = {
        speaker: 'professor',
        content: result.response,
        timestamp: new Date()
      };
      
      setConversation(prev => [...prev, aiMessage]);
      setCurrentAIResponse(result.response);
      setShowAIResponse(true);
      clearAllElements();

      if (result.progress) {
        setProgress(result.progress);
        setStatus(`💬 Progress: ${result.progress.covered}/${result.progress.total} (${result.progress.percentage}%)`);
      }

      if (result.isComplete) {
        setIsComplete(true);
        setStatus('🎉 Examination completed!');
      }
      
    } catch (error) {
      console.error('❌ Send failed:', error);
      setStatus(`❌ Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const closeAIResponse = () => {
    setShowAIResponse(false);
    setCurrentAIResponse('');
  };

  // Helper functions
  const getStatusClass = () => {
    if (status.startsWith('❌')) return styles.statusError;
    if (status.startsWith('✅')) return styles.statusSuccess;
    if (status.startsWith('🎉')) return styles.statusComplete;
    return styles.statusDefault;
  };

  return (
    <div className={styles.container}>
      
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <button onClick={() => navigate(-1)} className={styles.backButton}>
            ← Back
          </button>
          
          <h1 className={styles.title}>
            <Bot size={20} />
            AI Physics Exam
          </h1>
        </div>

        <div className={styles.headerRight}>
          {examStarted && (
            <div className={styles.progressBadge}>
              {progress.covered}/{progress.total} ({progress.percentage}%)
            </div>
          )}

          <button
            onClick={() => setShowHistory(!showHistory)}
            className={showHistory ? styles.historyButtonActive : styles.historyButtonInactive}
          >
            <History size={16} />
            History
          </button>

          <button
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className={voiceEnabled ? styles.voiceButtonEnabled : styles.voiceButtonDisabled}
          >
            <Volume2 size={16} />
            {voiceEnabled ? 'Voice On' : 'Voice Off'}
          </button>
        </div>
      </div>

      {/* Status Bar */}
      <div className={getStatusClass()}>
        <strong>Status:</strong> {status}
      </div>

      {/* Main Content Area */}
      <div className={styles.mainContent}>
        
        {/* History Sidebar */}
        {showHistory && (
          <div className={styles.historySidebar}>
            <div className={styles.sidebarHeader}>
              <h3 className={styles.sidebarTitle}>Conversation History</h3>
              <button
                onClick={() => setShowHistory(false)}
                className={styles.closeButton}
              >
                <X size={18} />
              </button>
            </div>
            
            <div className={styles.conversationContainer}>
              {conversation.map((turn, index) => (
                <div key={index} className={turn.speaker === 'professor' ? styles.professorTurn : styles.studentTurn}>
                  <div className={turn.speaker === 'professor' ? styles.professorSpeaker : styles.studentSpeaker}>
                    {turn.speaker === 'professor' ? '🎓 Professor' : '👨‍🎓 Student'}
                    {turn.image && ' 🎨'}
                  </div>
                  
                  <div className={styles.turnContent}>
                    {turn.content}
                  </div>
                  
                  {turn.image && (
                    <img 
                      src={turn.image} 
                      alt="Drawing" 
                      className={styles.turnImage}
                    /> 
                  )}
                  
                  <div className={styles.turnTimestamp}>
                    {new Date(turn.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main Workspace */}
        <div className={styles.mainWorkspace}>
          
          {/* Controls */}
          {(!examStarted || !materialReady) && (
            <div className={styles.controls}>
              <button 
                onClick={analyzeMaterial} 
                disabled={isProcessing || materialReady}
                className={materialReady ? styles.analyzeButtonReady : styles.analyzeButtonActive}
              >
                <FileText size={16} />
                {materialReady ? '✔️ Material Ready' : '📄 Analyze PDF'}
              </button>

              <button 
                onClick={startExam} 
                disabled={isProcessing || !materialReady || examStarted}
                className={examStarted ? styles.startButtonReady : (!materialReady ? styles.startButtonDisabled : styles.startButtonActive)}
              >
                <MessageSquare size={16} />
                {examStarted ? '✔️ Exam Started' : '🎓 Start Exam'}
              </button>
            </div>
          )}

          {/* Sequential Response System */}
          {examStarted && !isComplete && (
            <div className={styles.sequentialWorkspace}>
              
              {/* Add Elements Toolbar */}
              <div className={styles.addElementsToolbar}>
                <button
                  onClick={addTextElement}
                  className={styles.addElementButton}
                >
                  <Type size={16} />
                  Add Text
                </button>
                
                <button
                  onClick={addDrawingElement}
                  className={styles.addElementButton}
                >
                  <Edit3 size={16} />
                  Add Drawing
                </button>

                {/* Drawing Tools (showed only when there's an active canvas) */}
                {activeCanvasId && (
                  <div className={styles.drawingToolsCompact}>
                    <button
                      onClick={() => setCurrentTool('pen')}
                      className={currentTool === 'pen' ? styles.toolButtonActive : styles.toolButtonInactive}
                    >
                      ✏️
                    </button>
                    
                    <button
                      onClick={() => setCurrentTool('eraser')}
                      className={currentTool === 'eraser' ? styles.toolButtonActive : styles.toolButtonInactive}
                    >
                      🗑️
                    </button>

                    <input
                      type="color"
                      value={strokeColor}
                      onChange={(e) => setStrokeColor(e.target.value)}
                      className={styles.colorPickerCompact}
                    />
                    
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={strokeWidth}
                      onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
                      className={styles.strokeSliderCompact}
                    />
                  </div>
                )}

                <div className={styles.actionButtonsRight}>
                  <button
                    onClick={clearAllElements}
                    className={styles.clearButton}
                  >
                    <Trash2 size={14} />
                    Clear All
                  </button>
                  
                  <button
                    onClick={sendSequentialContent}
                    disabled={isProcessing || !hasContent()}
                    className={hasContent() ? styles.sendButtonActive : styles.sendButtonDisabled}
                  >
                    <Send size={14} />
                    Send Response
                  </button>
                </div>
              </div>

              {/* Sequential Elements List */}
              <div className={styles.sequentialElementsList}>
                {sequentialElements.length === 0 && (
                  <div className={styles.emptyState}>
                    <p>Click "Add Text" or "Add Drawing" to start building your response</p>
                  </div>
                )}

                {sequentialElements.map((element, index) => (
                  <div 
                    key={element.id} 
                    className={`${styles.sequentialElement} ${activeElementId === element.id ? styles.activeElement : ''}`}
                  >
                    <div className={styles.elementHeader}>
                      <span className={styles.elementNumber}>
                        {index + 1}. {element.type === 'text' ? '📝 Text' : '🎨 Drawing'}
                      </span>
                      
                      <div className={styles.elementControls}>
                        {element.type === 'text' && voiceEnabled && (
                          <button
                            onClick={() => setVoiceActiveForElement(
                              voiceActiveForElement === element.id ? null : element.id
                            )}
                            className={voiceActiveForElement === element.id ? styles.voiceControlActive : styles.voiceControlInactive}
                          >
                            <Mic size={12} />
                          </button>
                        )}
                        
                        {element.type === 'drawing' && (
                          <button
                            onClick={() => clearElementCanvas(element.id)}
                            className={styles.clearCanvasButton}
                          >
                            Clear
                          </button>
                        )}
                        
                        <button
                          onClick={() => deleteElement(element.id)}
                          className={styles.deleteElementButton}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>

                    <div className={styles.elementContent}>
                      {element.type === 'text' ? (
                        <textarea
                          id={`element-${element.id}`}
                          value={element.content}
                          onChange={(e) => updateElementContent(element.id, e.target.value)}
                          placeholder="Type your response here..."
                          className={styles.textElementInput}
                          onFocus={() => setActiveElementId(element.id)}
                          rows={3}
                        />
                      ) : (
                        <div className={styles.drawingElementContainer}>
                          
                          
                          <canvas 
                            id={`canvas-${element.id}`} 
                            className={styles.elementCanvas}
                            onPointerDown={(e) => startDrawing(e, element.id)}
                            onPointerMove={(e) => draw(e, element.id)}
                            onPointerUp={() => stopDrawing(element.id)}
                            onPointerLeave={() => stopDrawing(element.id)}
                            onClick={() => setActiveElementId(element.id)}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Voice Manager - POSIZIONATO MEGLIO */}
              {voiceActiveForElement && (
                <div className={styles.voiceManagerFixed}>
                  <div className={styles.voiceManagerContent}>
                    <div className={styles.voiceManagerHeader}>
                      🎤 Voice Recording Active
                      <button
                        onClick={() => {
                          setVoiceActiveForElement(null);
                          setCurrentTranscript('');
                        }}
                        className={styles.stopVoiceButton}
                      >
                        Stop
                      </button>
                    </div>
                    
                    <VoiceManager 
                      onTranscriptUpdate={handleTranscriptUpdate}
                      disabled={isProcessing}
                    />
                    
                    {currentTranscript && (
                      <div className={styles.transcriptDisplay}>
                        <strong>Transcript:</strong> "{currentTranscript}"
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Completion Screen */}
          {isComplete && (
            <div className={styles.completionScreen}>
              <div className={styles.completionCard}>
                <div className={styles.completionIcon}>🎉</div>
                <h2 className={styles.completionTitle}>Examination Completed!</h2>
                <p className={styles.completionText}>
                  Great job! You've successfully completed the AI physics examination.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AI Response Overlay */}
      {showAIResponse && (
        <div className={showHistory ? styles.aiResponseOverlayWithHistory : styles.aiResponseOverlayWithoutHistory}>
          <div className={styles.aiResponseHeader}>
            <div className={styles.aiResponseTitle}>
              🎓 Professor Response
              {voiceEnabled && autoSpeak && (
                <button
                  onClick={() => voiceUtils.speak(currentAIResponse)}
                  className={styles.repeatButton}
                >
                  🔊 Repeat
                </button>
              )}
            </div>
            <button
              onClick={closeAIResponse}
              className={styles.aiResponseCloseButton}
            >
              <X size={18} />
            </button>
          </div>
          
          <div className={styles.aiResponseContent}>
            {currentAIResponse}
          </div>
        </div>
      )}
    </div>
  );
}