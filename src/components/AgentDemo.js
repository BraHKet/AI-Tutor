// ==========================================
// FILE: src/components/AgentDemo.js (CON INSERIMENTO DISEGNI IN TEMPO REALE)
// ==========================================

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { googleDriveService } from '../utils/googleDriveService';
import { PhysicsAgent } from '../agents/PhysicsAgent';
import VoiceManager, { voiceUtils } from './VoiceManager';
import { Bot, FileText, MessageSquare, Palette, RotateCcw, Send, Trash2, Plus } from 'lucide-react';

export default function AgentDemo() {
  const { projectId, topicId } = useParams();
  const navigate = useNavigate();

  // Core states
  const [agent, setAgent] = useState(null);
  const [status, setStatus] = useState('Initializing...');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Exam states
  const [materialReady, setMaterialReady] = useState(false);
  const [examStarted, setExamStarted] = useState(false);
  const [mainTopic, setMainTopic] = useState('');
  const [conversation, setConversation] = useState([]);
  const [isComplete, setIsComplete] = useState(false);
  const [progress, setProgress] = useState({ covered: 0, total: 0, percentage: 0 });
  
  // Enhanced Response Building states
  const [responseParts, setResponseParts] = useState([]); // Array di {type: 'text'|'image', content: string|dataURL}
  const [currentTextPart, setCurrentTextPart] = useState('');
  
  // Enhanced Drawing states
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showCanvas, setShowCanvas] = useState(false);
  const [currentTool, setCurrentTool] = useState('pen');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [canvasHistory, setCanvasHistory] = useState([]);
  const [historyStep, setHistoryStep] = useState(-1);

  // Voice states
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [currentTranscript, setCurrentTranscript] = useState('');

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

  // Voice transcript handler
  const handleTranscriptUpdate = (transcript, isFinal) => {
    setCurrentTranscript(transcript);
    
    if (isFinal && transcript.trim()) {
      // Aggiungi automaticamente il testo trascritto alla parte corrente
      setCurrentTextPart(prev => prev + (prev ? ' ' : '') + transcript.trim());
      setCurrentTranscript('');
    }
  };

  // Auto-speak professor responses
  useEffect(() => {
    if (autoSpeak && conversation.length > 0) {
      const lastMessage = conversation[conversation.length - 1];
      if (lastMessage.speaker === 'professor' && lastMessage.content) {
        setTimeout(() => {
          voiceUtils.speak(lastMessage.content);
        }, 500);
      }
    }
  }, [conversation, autoSpeak]);

  // ===============================================
  // ENHANCED DRAWING FUNCTIONS
  // ===============================================

  const initializeCanvas = () => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      // High DPI support
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      
      ctx.scale(dpr, dpr);
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      
      // Set drawing properties
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.imageSmoothingEnabled = true;
      
      // Clear to white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Save initial state
      saveCanvasState();
    }
  };

  const saveCanvasState = () => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const dataUrl = canvas.toDataURL();
      const newHistory = canvasHistory.slice(0, historyStep + 1);
      newHistory.push(dataUrl);
      setCanvasHistory(newHistory);
      setHistoryStep(newHistory.length - 1);
    }
  };

  const getCanvasCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Non moltiplicare per DPR qui perché il canvas è già scalato
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const coords = getCanvasCoordinates(e);
    
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    
    // Set tool properties
    if (currentTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = strokeWidth * 3; // Eraser is wider
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
    }
  };

  const draw = (e) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const coords = getCanvasCoordinates(e);
    
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      saveCanvasState();
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveCanvasState();
  };

  const undoCanvas = () => {
    if (historyStep > 0) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      };
      
      setHistoryStep(historyStep - 1);
      img.src = canvasHistory[historyStep - 1];
    }
  };

  const redoCanvas = () => {
    if (historyStep < canvasHistory.length - 1) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      };
      
      setHistoryStep(historyStep + 1);
      img.src = canvasHistory[historyStep + 1];
    }
  };

  const getCanvasImage = () => {
    return canvasRef.current?.toDataURL('image/png');
  };

  const hasDrawing = () => {
    const canvas = canvasRef.current;
    if (!canvas) return false;
    
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Check if canvas has content other than white background
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] !== 255 || data[i + 1] !== 255 || data[i + 2] !== 255) {
        return true;
      }
    }
    return false;
  };

  // Initialize canvas when shown
  useEffect(() => {
    if (showCanvas && canvasRef.current) {
      initializeCanvas();
    }
  }, [showCanvas]);

  // ===============================================
  // ENHANCED RESPONSE BUILDING FUNCTIONS
  // ===============================================

  const insertDrawingHere = () => {
    if (!hasDrawing()) return;
    
    const drawingData = getCanvasImage();
    
    // Aggiungi la parte di testo corrente se non è vuota
    if (currentTextPart.trim()) {
      setResponseParts(prev => [...prev, { type: 'text', content: currentTextPart.trim() }]);
      setCurrentTextPart('');
    }
    
    // Aggiungi il disegno
    setResponseParts(prev => [...prev, { type: 'image', content: drawingData }]);
    
    // Pulisci il canvas
    clearCanvas();
    
    // Mostra notifica
    alert('📌 Disegno inserito! Continua a parlare...');
  };

  const buildFinalResponse = () => {
    const allParts = [...responseParts];
    
    // Aggiungi la parte di testo finale se non è vuota
    if (currentTextPart.trim()) {
      allParts.push({ type: 'text', content: currentTextPart.trim() });
    }
    
    return allParts;
  };

  const assembleFinalText = (parts) => {
    // Combina tutte le parti di testo per Gemini
    const textParts = parts.filter(part => part.type === 'text').map(part => part.content);
    const imageParts = parts.filter(part => part.type === 'image');
    
    let finalText = textParts.join(' ');
    if (imageParts.length > 0) {
      finalText += ` [${imageParts.length} disegno/i allegato/i]`;
    }
    
    return finalText;
  };

  const getFirstImage = (parts) => {
    const imagePart = parts.find(part => part.type === 'image');
    return imagePart ? imagePart.content : null;
  };

  const clearResponse = () => {
    setResponseParts([]);
    setCurrentTextPart('');
    setCurrentTranscript('');
    clearCanvas();
  };

  // ===============================================
  // EXAM FUNCTIONS
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
        setConversation([{
          speaker: 'professor',
          content: result.initialQuestion,
          timestamp: new Date()
        }]);
        setStatus(`💬 Exam started (0/${result.totalItems} items)`);
      }
    } catch (error) {
      setStatus(`❌ Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const sendCompleteResponse = async () => {
    if (!agent || isProcessing) return;

    const finalParts = buildFinalResponse();
    if (finalParts.length === 0 && !currentTextPart.trim()) return;

    try {
      setIsProcessing(true);
      voiceUtils.stopSpeaking();
      
      const finalText = assembleFinalText(finalParts);
      const firstImage = getFirstImage(finalParts);
      
      // Crea il messaggio per la conversazione
      const conversationMessage = {
        speaker: 'student',
        content: finalText,
        parts: finalParts, // Salva le parti per la visualizzazione
        timestamp: new Date()
      };
      
      setConversation(prev => [...prev, conversationMessage]);

      // Invia a Gemini
      const result = await agent.processResponse({
        text: finalText,
        image: firstImage
      });

      // Pulisci tutto
      clearResponse();

      setConversation(prev => [...prev, {
        speaker: 'professor',
        content: result.response,
        timestamp: new Date()
      }]);

      if (result.progress) {
        setProgress(result.progress);
        setStatus(`💬 Progress: ${result.progress.covered}/${result.progress.total} (${result.progress.percentage}%)`);
      }

      if (result.isComplete) {
        setIsComplete(true);
        setStatus('🎉 Examination completed!');
      }
      
    } catch (error) {
      setStatus(`❌ Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const useTranscript = () => {
    if (currentTranscript.trim()) {
      setCurrentTextPart(prev => prev + (prev ? ' ' : '') + currentTranscript.trim());
      setCurrentTranscript('');
    }
  };

  return (
    <div style={{ 
      padding: '20px', 
      fontFamily: 'system-ui', 
      maxWidth: '1200px', 
      margin: '0 auto',
      backgroundColor: '#f8fafc',
      minHeight: '100vh'
    }}>
      <div style={{ 
        backgroundColor: 'white', 
        padding: '30px', 
        borderRadius: '12px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
      }}>
        
        {/* Header */}
        <button onClick={() => navigate(-1)} style={{ 
          marginBottom: '20px', 
          background: 'transparent', 
          border: '1px solid #d1d5db', 
          padding: '8px 16px', 
          borderRadius: '6px', 
          cursor: 'pointer'
        }}>
          ← Back
        </button>

        <h1 style={{ 
          color: '#1e40af', 
          borderBottom: '3px solid #e5e7eb', 
          paddingBottom: '15px',
          margin: '0 0 30px 0',
          display: 'flex',
          alignItems: 'center'
        }}>
          <Bot size={32} style={{ marginRight: '12px' }} />
          AI Physics Exam (Real-time Drawing Insertion)
        </h1>
        
        {/* Status */}
        <div style={{ 
          background: status.startsWith('❌') ? '#fee2e2' : 
                     status.startsWith('✅') ? '#dcfce7' : 
                     status.startsWith('🎉') ? '#ecfdf5' : '#dbeafe', 
          padding: '16px', 
          borderRadius: '8px',
          marginBottom: '25px'
        }}>
          <strong>Status:</strong> {status}
        </div>

        {/* Voice Manager */}
        {voiceEnabled && (
          <div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '10px'
            }}>
              <h3 style={{ margin: '0', fontSize: '16px' }}>🎤 Voice Controls</h3>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <label style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <input
                    type="checkbox"
                    checked={autoSpeak}
                    onChange={(e) => setAutoSpeak(e.target.checked)}
                  />
                  Auto-speak responses
                </label>
                <button
                  onClick={() => setVoiceEnabled(false)}
                  style={{
                    background: '#6b7280',
                    color: 'white',
                    border: 'none',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  Disable Voice
                </button>
              </div>
            </div>
            
            <VoiceManager 
              onTranscriptUpdate={handleTranscriptUpdate}
              disabled={isProcessing || isComplete}
            />
          </div>
        )}

        {!voiceEnabled && (
          <div style={{ marginBottom: '15px' }}>
            <button
              onClick={() => setVoiceEnabled(true)}
              style={{
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              🎤 Enable Voice Features
            </button>
          </div>
        )}

        {/* Progress */}
        {examStarted && (
          <div style={{ 
            background: '#f0f9ff', 
            padding: '15px', 
            borderRadius: '8px',
            marginBottom: '25px',
            border: '1px solid #0ea5e9'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <strong>Progress: {mainTopic}</strong>
              <span>{progress.covered}/{progress.total} ({progress.percentage}%)</span>
            </div>
            <div style={{ 
              width: '100%', 
              backgroundColor: '#e5e7eb', 
              borderRadius: '6px', 
              height: '8px'
            }}>
              <div style={{ 
                width: `${progress.percentage}%`, 
                backgroundColor: '#3b82f6', 
                height: '100%',
                borderRadius: '6px',
                transition: 'width 0.3s'
              }}></div>
            </div>
          </div>
        )}

        {/* Controls */}
        <div style={{ marginBottom: '25px', display: 'flex', gap: '12px' }}>
          <button 
            onClick={analyzeMaterial} 
            disabled={isProcessing || materialReady}
            style={{ 
              background: materialReady ? '#10b981' : '#3b82f6', 
              color: 'white', 
              border: 'none', 
              padding: '12px 18px', 
              borderRadius: '6px', 
              cursor: materialReady ? 'not-allowed' : 'pointer',
              opacity: materialReady ? 0.7 : 1
            }}
          >
            <FileText size={16} style={{ marginRight: '6px', display: 'inline' }} />
            {materialReady ? '✔️ Ready' : '📄 Analyze PDF'}
          </button>

          <button 
            onClick={startExam} 
            disabled={isProcessing || !materialReady || examStarted}
            style={{ 
              background: examStarted ? '#10b981' : '#8b5cf6', 
              color: 'white', 
              border: 'none', 
              padding: '12px 18px', 
              borderRadius: '6px', 
              cursor: (!materialReady || examStarted) ? 'not-allowed' : 'pointer',
              opacity: (!materialReady || examStarted) ? 0.7 : 1
            }}
          >
            <MessageSquare size={16} style={{ marginRight: '6px', display: 'inline' }} />
            {examStarted ? '✔️ Started' : '🎓 Start Exam'}
          </button>
        </div>

        {/* Conversation */}
        {examStarted && (
          <div style={{ marginBottom: '25px' }}>
            <h3 style={{ marginBottom: '15px' }}>💬 Conversation</h3>
            
            <div style={{ 
              background: '#f9fafb', 
              border: '1px solid #e5e7eb', 
              borderRadius: '8px', 
              padding: '20px', 
              maxHeight: '400px', 
              overflowY: 'auto',
              marginBottom: '20px'
            }}>
              {conversation.map((turn, index) => (
                <div key={index} style={{ 
                  marginBottom: '15px',
                  padding: '12px',
                  borderRadius: '8px',
                  background: turn.speaker === 'professor' ? '#dbeafe' : '#dcfce7'
                }}>
                  <div style={{ 
                    fontWeight: 'bold', 
                    color: turn.speaker === 'professor' ? '#1d4ed8' : '#059669',
                    marginBottom: '5px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span>
                      {turn.speaker === 'professor' ? '🎓 Professor' : '👨‍🎓 Student'}
                      {turn.parts && turn.parts.some(p => p.type === 'image') && ' 🎨'}
                    </span>
                    {turn.speaker === 'professor' && voiceEnabled && (
                      <button
                        onClick={() => voiceUtils.speak(turn.content)}
                        style={{
                          background: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        🔊 Repeat
                      </button>
                    )}
                  </div>
                  
                  {/* Mostra le parti strutturate per lo studente */}
                  {turn.parts ? (
                    <div>
                      {turn.parts.map((part, partIndex) => (
                        <div key={partIndex} style={{ marginBottom: '8px' }}>
                          {part.type === 'text' ? (
                            <div style={{ whiteSpace: 'pre-wrap' }}>{part.content}</div>
                          ) : (
                            <img 
                              src={part.content} 
                              alt="Formula/Drawing" 
                              style={{ 
                                maxWidth: '100%', 
                                border: '2px solid #d1d5db', 
                                borderRadius: '8px',
                                background: 'white',
                                padding: '4px',
                                display: 'block',
                                margin: '8px 0'
                              }} 
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ whiteSpace: 'pre-wrap', marginBottom: '8px' }}>
                      {turn.content}
                    </div>
                  )}
                  
                  {/* Backward compatibility per vecchi disegni */}
                  {turn.drawing && !turn.parts && (
                    <img 
                      src={turn.drawing} 
                      alt="Drawing" 
                      style={{ 
                        maxWidth: '100%', 
                        border: '2px solid #d1d5db', 
                        borderRadius: '8px',
                        background: 'white',
                        padding: '4px'
                      }} 
                    />
                  )}
                  
                  <div style={{ 
                    fontSize: '11px', 
                    color: '#9ca3af', 
                    textAlign: 'right' 
                  }}>
                    {new Date(turn.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>

            {/* Response Building Interface */}
            {!isComplete && (
              <div>
                {/* Current Response Preview */}
                <div style={{ 
                  background: '#fffbeb', 
                  border: '2px solid #f59e0b', 
                  borderRadius: '8px', 
                  padding: '15px',
                  marginBottom: '20px'
                }}>
                  <h4 style={{ margin: '0 0 10px 0', color: '#92400e' }}>📝 Your Response Building:</h4>
                  
                  {/* Mostra le parti già inserite */}
                  {responseParts.map((part, index) => (
                    <div key={index} style={{ 
                      marginBottom: '8px',
                      padding: '8px',
                      background: part.type === 'text' ? '#fef3c7' : '#ddd6fe',
                      borderRadius: '4px',
                      border: '1px solid #d97706'
                    }}>
                      {part.type === 'text' ? (
                        <span>📄 "{part.content}"</span>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>🎨 Disegno/Formula inserito</span>
                          <img 
                            src={part.content} 
                            alt="Inserted drawing" 
                            style={{ 
                              height: '40px', 
                              border: '1px solid #ccc',
                              borderRadius: '4px'
                            }} 
                          />
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {/* Parte di testo corrente */}
                  {currentTextPart && (
                    <div style={{ 
                      padding: '8px',
                      background: '#fef3c7',
                      borderRadius: '4px',
                      border: '2px dashed #d97706'
                    }}>
                      📄 "{currentTextPart}"
                    </div>
                  )}
                  
                  {responseParts.length === 0 && !currentTextPart && (
                    <div style={{ color: '#92400e', fontStyle: 'italic' }}>
                      Inizia a parlare per costruire la tua risposta...
                    </div>
                  )}
                </div>

                {/* Professional Drawing Tablet */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '15px' 
                }}>
                  <h4 style={{ margin: '0', display: 'flex', alignItems: 'center' }}>
                    <Palette size={20} style={{ marginRight: '8px' }} />
                    Drawing Tablet (Insert Formulas While Speaking)
                  </h4>
                  <button
                    onClick={() => setShowCanvas(!showCanvas)}
                    style={{
                      background: showCanvas ? '#ef4444' : '#10b981',
                      color: 'white',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    {showCanvas ? 'Hide Tablet' : 'Show Tablet'}
                  </button>
                </div>

                {showCanvas && (
                  <div style={{
                    background: '#ffffff',
                    border: '2px solid #e5e7eb',
                    borderRadius: '12px',
                    padding: '15px',
                    marginBottom: '20px'
                  }}>
                    {/* Drawing Tools */}
                    <div style={{
                      display: 'flex',
                      gap: '15px',
                      alignItems: 'center',
                      marginBottom: '15px',
                      flexWrap: 'wrap',
                      padding: '10px',
                      background: '#f8fafc',
                      borderRadius: '8px'
                    }}>
                      {/* Tool Selection */}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => setCurrentTool('pen')}
                          style={{
                            background: currentTool === 'pen' ? '#3b82f6' : '#e5e7eb',
                            color: currentTool === 'pen' ? 'white' : '#374151',
                            border: 'none',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '14px'
                          }}
                        >
                          ✏️ Pen
                        </button>
                        <button
                          onClick={() => setCurrentTool('eraser')}
                          style={{
                            background: currentTool === 'eraser' ? '#3b82f6' : '#e5e7eb',
                            color: currentTool === 'eraser' ? 'white' : '#374151',
                            border: 'none',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '14px'
                          }}
                        >
                          🗑️ Eraser
                        </button>
                      </div>

                      {/* Color Selection */}
                      {currentTool !== 'eraser' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '14px', fontWeight: '500' }}>Color:</span>
                          <input
                            type="color"
                            value={strokeColor}
                            onChange={(e) => setStrokeColor(e.target.value)}
                            style={{
                              width: '40px',
                              height: '32px',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer'
                            }}
                          />
                          <div style={{ display: 'flex', gap: '4px' }}>
                            {['#000000', '#FF0000', '#0000FF', '#00AA00', '#FF8800', '#8A2BE2'].map(color => (
                              <button
                                key={color}
                                onClick={() => setStrokeColor(color)}
                                style={{
                                  width: '24px',
                                  height: '24px',
                                  background: color,
                                  border: strokeColor === color ? '2px solid #333' : '1px solid #ccc',
                                  borderRadius: '4px',
                                  cursor: 'pointer'
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Stroke Width */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '14px', fontWeight: '500' }}>Size:</span>
                        <input
                          type="range"
                          min="1"
                          max="20"
                          value={strokeWidth}
                          onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
                          style={{ width: '80px' }}
                        />
                        <span style={{ fontSize: '12px', minWidth: '24px' }}>{strokeWidth}px</span>
                      </div>

                      {/* Action Buttons */}
                      <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
                        <button
                          onClick={undoCanvas}
                          disabled={historyStep <= 0}
                          style={{
                            background: historyStep > 0 ? '#6b7280' : '#d1d5db',
                            color: 'white',
                            border: 'none',
                            padding: '6px 10px',
                            borderRadius: '4px',
                            cursor: historyStep > 0 ? 'pointer' : 'not-allowed',
                            fontSize: '12px'
                          }}
                        >
                          ↶ Undo
                        </button>
                        <button
                          onClick={redoCanvas}
                          disabled={historyStep >= canvasHistory.length - 1}
                          style={{
                            background: historyStep < canvasHistory.length - 1 ? '#6b7280' : '#d1d5db',
                            color: 'white',
                            border: 'none',
                            padding: '6px 10px',
                            borderRadius: '4px',
                            cursor: historyStep < canvasHistory.length - 1 ? 'pointer' : 'not-allowed',
                            fontSize: '12px'
                          }}
                        >
                          ↷ Redo
                        </button>
                        <button
                          onClick={clearCanvas}
                          style={{
                            background: '#ef4444',
                            color: 'white',
                            border: 'none',
                            padding: '6px 10px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Trash2 size={12} />
                          Clear
                        </button>
                      </div>
                    </div>

                    {/* Canvas */}
                    <div style={{
                      border: '3px solid #d1d5db',
                      borderRadius: '8px',
                      background: '#ffffff',
                      position: 'relative'
                    }}>
                      <canvas
                        ref={canvasRef}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        style={{
                          width: '100%',
                          height: '300px',
                          cursor: currentTool === 'pen' ? 'crosshair' : currentTool === 'eraser' ? 'not-allowed' : 'default',
                          display: 'block',
                          borderRadius: '5px'
                        }}
                      />
                    </div>

                    {/* Insert Drawing Button */}
                    <div style={{
                      marginTop: '15px',
                      display: 'flex',
                      gap: '10px',
                      justifyContent: 'center'
                    }}>
                      <button
                        onClick={insertDrawingHere}
                        disabled={!hasDrawing() || isProcessing}
                        style={{
                          background: hasDrawing() ? '#f59e0b' : '#d1d5db',
                          color: 'white',
                          border: 'none',
                          padding: '12px 24px',
                          borderRadius: '8px',
                          cursor: hasDrawing() ? 'pointer' : 'not-allowed',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '16px',
                          fontWeight: '600'
                        }}
                      >
                        <Plus size={18} />
                        📌 Insert Formula HERE (Continue Speaking)
                      </button>
                    </div>
                  </div>
                )}

                {/* Current Transcript Preview */}
                {currentTranscript && (
                  <div style={{
                    background: '#fffbeb',
                    border: '1px solid #f59e0b',
                    borderRadius: '6px',
                    padding: '8px',
                    marginBottom: '10px',
                    fontSize: '14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span><strong>🎤 Speaking:</strong> {currentTranscript}</span>
                    <button
                      onClick={useTranscript}
                      style={{
                        background: '#f59e0b',
                        color: 'white',
                        border: 'none',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      Add to Text
                    </button>
                  </div>
                )}

                {/* Manual Text Input */}
                <div style={{ marginBottom: '10px' }}>
                  <textarea
                    value={currentTextPart}
                    onChange={(e) => setCurrentTextPart(e.target.value)}
                    placeholder="Type additional text or use voice..."
                    disabled={isProcessing}
                    style={{ 
                      width: '100%', 
                      padding: '12px', 
                      borderRadius: '6px', 
                      border: '1px solid #d1d5db',
                      minHeight: '80px',
                      resize: 'vertical',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>

                {/* Final Action Buttons */}
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                  <button 
                    onClick={sendCompleteResponse}
                    disabled={isProcessing || (responseParts.length === 0 && !currentTextPart.trim())}
                    style={{ 
                      background: '#10b981', 
                      color: 'white', 
                      border: 'none', 
                      padding: '14px 28px', 
                      borderRadius: '8px', 
                      cursor: (responseParts.length > 0 || currentTextPart.trim()) ? 'pointer' : 'not-allowed',
                      opacity: (responseParts.length > 0 || currentTextPart.trim()) ? 1 : 0.5,
                      fontSize: '16px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <Send size={18} />
                    🚀 Send Complete Response
                  </button>
                  
                  <button 
                    onClick={clearResponse}
                    disabled={isProcessing}
                    style={{ 
                      background: '#ef4444', 
                      color: 'white', 
                      border: 'none', 
                      padding: '14px 28px', 
                      borderRadius: '8px', 
                      cursor: 'pointer',
                      fontSize: '16px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <Trash2 size={18} />
                    🗑️ Clear All
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Completion */}
        {isComplete && (
          <div style={{ 
            background: '#ecfdf5', 
            border: '2px solid #22c55e', 
            borderRadius: '8px', 
            padding: '20px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '10px' }}>🎉</div>
            <h3 style={{ color: '#15803d', margin: '0' }}>Examination Completed!</h3>
            {autoSpeak && (
              <div style={{ marginTop: '10px', fontSize: '14px', color: '#059669' }}>
                🔊 Completion message will be spoken automatically
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}