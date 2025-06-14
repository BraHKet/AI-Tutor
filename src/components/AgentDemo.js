// ==========================================
// FILE: src/components/AgentDemo.js (MINIMAL CON TAVOLETTA GRAFICA + VOICE)
// ==========================================

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { googleDriveService } from '../utils/googleDriveService';
import { PhysicsAgent } from '../agents/PhysicsAgent';
import VoiceManager, { voiceUtils } from './VoiceManager';
import { Bot, FileText, MessageSquare } from 'lucide-react';

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
  const [userInput, setUserInput] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [progress, setProgress] = useState({ covered: 0, total: 0, percentage: 0 });
  
  // Drawing states
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showCanvas, setShowCanvas] = useState(false);

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
      // Auto-insert transcript into text input when final
      setUserInput(prev => prev + (prev ? ' ' : '') + transcript.trim());
      setCurrentTranscript('');
    }
  };

  // Auto-speak professor responses
  useEffect(() => {
    if (autoSpeak && conversation.length > 0) {
      const lastMessage = conversation[conversation.length - 1];
      if (lastMessage.speaker === 'professor' && lastMessage.content) {
        // Small delay to ensure message is displayed first
        setTimeout(() => {
          voiceUtils.speak(lastMessage.content);
        }, 500);
      }
    }
  }, [conversation, autoSpeak]);

  // Drawing functions
  const startDrawing = (e) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => setIsDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const getCanvasImage = () => {
    return canvasRef.current?.toDataURL('image/png');
  };

  const hasDrawing = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return false;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return imageData.data.some(pixel => pixel !== 0);
  };

  // Analyze material
  const analyzeMaterial = async () => {
    if (!agent) return;

    try {
      setIsProcessing(true);
      setStatus('📄 Analyzing material...');

      // Get PDF from Firestore
      const topicRef = doc(db, 'projects', projectId, 'topics', topicId);
      const topicSnap = await getDoc(topicRef);
      if (!topicSnap.exists()) throw new Error("Topic not found");
      
      const topicData = topicSnap.data();
      const driveFileId = topicData.driveFileId || topicData.sources?.find(s => s.chunkDriveId)?.chunkDriveId;
      const pdfName = topicData.title || 'material.pdf';
      
      if (!driveFileId) throw new Error("PDF not found");
      
      // Download and analyze
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

  // Start exam
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

  // Send response
  const sendResponse = async () => {
    if (!agent || !userInput.trim() || isProcessing) return;

    try {
      setIsProcessing(true);
      
      // Stop any ongoing speech before processing
      voiceUtils.stopSpeaking();
      
      // Add user message
      const drawing = hasDrawing() ? getCanvasImage() : null;
      setConversation(prev => [...prev, { 
        speaker: 'student', 
        content: userInput, 
        drawing: drawing,
        timestamp: new Date()
      }]);

      // Process response
      const result = await agent.processResponse({
        text: userInput,
        image: drawing
      });

      // Clear inputs
      setUserInput('');
      setCurrentTranscript('');
      if (drawing) clearCanvas();

      // Add professor response
      setConversation(prev => [...prev, {
        speaker: 'professor',
        content: result.response,
        timestamp: new Date()
      }]);

      // Update progress
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

  // Insert transcript into input
  const useTranscript = () => {
    if (currentTranscript.trim()) {
      setUserInput(prev => prev + (prev ? ' ' : '') + currentTranscript.trim());
      setCurrentTranscript('');
    }
  };

  // Setup canvas
  useEffect(() => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
    }
  }, [showCanvas]);

  return (
    <div style={{ 
      padding: '20px', 
      fontFamily: 'system-ui', 
      maxWidth: '1000px', 
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
          AI Physics Exam (Continuous Session + Voice)
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
                      {turn.drawing && ' 🎨'}
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
                  <div style={{ whiteSpace: 'pre-wrap', marginBottom: '8px' }}>
                    {turn.content}
                  </div>
                  {turn.drawing && (
                    <img 
                      src={turn.drawing} 
                      alt="Drawing" 
                      style={{ 
                        maxWidth: '100%', 
                        border: '1px solid #d1d5db', 
                        borderRadius: '4px',
                        background: 'white'
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

            {/* Input */}
            {!isComplete && (
              <div>
                {/* Drawing Toggle */}
                <div style={{ marginBottom: '10px' }}>
                  <button
                    onClick={() => setShowCanvas(!showCanvas)}
                    style={{
                      background: showCanvas ? '#10b981' : '#6b7280',
                      color: 'white',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    🎨 {showCanvas ? 'Hide' : 'Show'} Drawing
                  </button>
                  
                  {showCanvas && (
                    <button
                      onClick={clearCanvas}
                      style={{
                        background: '#ef4444',
                        color: 'white',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        marginLeft: '10px'
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Canvas */}
                {showCanvas && (
                  <div style={{ 
                    marginBottom: '15px',
                    border: '2px dashed #d1d5db',
                    borderRadius: '8px',
                    padding: '10px',
                    background: 'white'
                  }}>
                    <canvas
                      ref={canvasRef}
                      width={400}
                      height={150}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      style={{
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        cursor: 'crosshair',
                        background: 'white',
                        width: '100%'
                      }}
                    />
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
                    <span><strong>Speaking:</strong> {currentTranscript}</span>
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
                      Use
                    </button>
                  </div>
                )}

                {/* Text Input */}
                <div style={{ display: 'flex', gap: '12px' }}>
                  <textarea
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder="Type your response or use voice..."
                    disabled={isProcessing}
                    style={{ 
                      flex: 1, 
                      padding: '12px', 
                      borderRadius: '6px', 
                      border: '1px solid #d1d5db',
                      minHeight: '80px',
                      resize: 'vertical'
                    }}
                  />
                  <button 
                    onClick={sendResponse}
                    disabled={isProcessing || !userInput.trim()}
                    style={{ 
                      background: '#10b981', 
                      color: 'white', 
                      border: 'none', 
                      padding: '12px 20px', 
                      borderRadius: '6px', 
                      cursor: userInput.trim() ? 'pointer' : 'not-allowed',
                      opacity: userInput.trim() ? 1 : 0.5
                    }}
                  >
                    Send
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