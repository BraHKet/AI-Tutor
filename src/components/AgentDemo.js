// ==========================================
// FILE: src/components/AgentDemo.js
// ==========================================

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { googleDriveService } from '../utils/googleDriveService';
import { PhysicsAgent } from '../agents/PhysicsAgent';
import { Bot } from 'lucide-react';

export default function AgentDemo() {
  const { projectId, topicId } = useParams();
  const navigate = useNavigate();

  const [agent, setAgent] = useState(null);
  const [status, setStatus] = useState('Initializing...');
  const [session, setSession] = useState(null);
  const [conversation, setConversation] = useState([]);
  const [currentInput, setCurrentInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [agentStats, setAgentStats] = useState(null); // Aggiunto per coerenza con il codice originale

  // 1. INIZIALIZZA L'AGENTE E IL SERVIZIO GOOGLE DRIVE
  useEffect(() => {
    const initialize = async () => {
      try {
        setStatus('🔧 Setting up environment...');
        await googleDriveService.initialize();

        if (!process.env.REACT_APP_SUPABASE_URL || !process.env.REACT_APP_GEMINI_API_KEY) {
          throw new Error('Missing Supabase/Gemini environment variables. Check your .env file for REACT_APP_ variables.');
        }

        setStatus('🤖 Initializing Physics Agent...');
        const physicsAgent = new PhysicsAgent(
          process.env.REACT_APP_SUPABASE_URL,
          process.env.REACT_APP_SUPABASE_ANON_KEY
        );
        const initResult = await physicsAgent.initialize();

        if (initResult.success) {
          setAgent(physicsAgent);
          setStatus('✅ Agent ready. Click "Analyze Material" to begin.');
        }
      } catch (error) {
        setStatus(`❌ Initialization failed: ${error.message}`);
        console.error(error);
      }
    };
    initialize();
  }, []);

  // 2. FUNZIONE PER ANALIZZARE IL PDF DA GOOGLE DRIVE
  const handleAnalyzeMaterial = async () => {
    if (!agent || !projectId || !topicId) {
      setStatus('❌ Missing agent or project/topic ID.');
      return;
    }

    try {
      setIsProcessing(true);
      setStatus('📄 Fetching PDF info from Firestore...');

      const topicRef = doc(db, 'projects', projectId, 'topics', topicId);
      const topicSnap = await getDoc(topicRef);
      if (!topicSnap.exists()) throw new Error("Topic not found in Firestore.");
      const topicData = topicSnap.data();
      const driveFileId = topicData.driveFileId || topicData.sources?.find(s => s.chunkDriveId)?.chunkDriveId;
      const pdfName = topicData.title || 'material.pdf';
      if (!driveFileId) throw new Error("Google Drive File ID not found for this topic.");
      
      setStatus('🔗 Downloading PDF content from Google Drive...');
      const accessToken = await googleDriveService.ensureAuthenticated();
      const pdfBlob = await googleDriveService.downloadPdfChunk(driveFileId, accessToken);
      const publicUrlForPdfJs = URL.createObjectURL(pdfBlob);

      setStatus('🧠 Agent is analyzing the PDF... (this may take a moment)');
      const result = await agent.analyzeMaterial(
        { url: publicUrlForPdfJs, name: pdfName },
        (progress) => setStatus(`🧠 ${progress.message}`)
      );
      
      URL.revokeObjectURL(publicUrlForPdfJs);

      if (result.success) {
        setStatus(`✅ Analysis complete! Found ${result.totalTopics} topics. Ready to start examination.`);
        setAnalysisResult(result);
      }
    } catch (error) {
      setStatus(`❌ Analysis failed: ${error.message}`);
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };
  
  // 3. FUNZIONE PER INIZIARE L'ESAME
  const startExamination = async () => {
    if (!agent || !analysisResult) {
      alert('Please analyze the material first.');
      return;
    }
    try {
      setIsProcessing(true);
      setStatus('🎓 Starting examination...');
      const examSession = await agent.startExamination(
        analysisResult.materialId,
        'test-student-id', // Sostituire con l'ID utente reale se disponibile
        { personalityPreference: 'adaptive' }
      );

      if (examSession.success) {
        setSession(examSession);
        setConversation([{ speaker: 'professor', message: examSession.message, timestamp: new Date(), personality: examSession.personality }]);
        setStatus(`🎭 Examination started (Professor: ${examSession.personality})`);
      }
    } catch (error) {
      setStatus(`❌ Failed to start examination: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // 4. FUNZIONE PER INVIARE LA RISPOSTA DELLO STUDENTE
  const sendStudentResponse = async () => {
    if (!agent || !session || !currentInput.trim()) return;

    try {
      setIsProcessing(true);
      
      const studentMessage = { speaker: 'student', message: currentInput, timestamp: new Date() };
      setConversation(prev => [...prev, studentMessage]);
      setCurrentInput('');
      
      setStatus('🤖 Professor is analyzing your response...');

      const result = await agent.processStudentResponse(currentInput, {
        duration: 60,
        confidence: 'medium'
      });

      if (result.success) {
        const professorMessage = {
          speaker: 'professor',
          message: result.professorResponse,
          timestamp: new Date(),
          responseType: result.responseType,
          analysis: result.analysis
        };
        setConversation(prev => [...prev, professorMessage]);
        setStatus(`📊 Response analyzed (Understanding: ${result.analysis.understanding})`);
      }
    } catch (error) {
      setStatus(`❌ Failed to process response: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // 5. FUNZIONE PER COMPLETARE L'ESAME
  const completeExamination = async () => {
    if (!agent || !session) return;

    try {
      setStatus('📝 Generating final evaluation...');
      setIsProcessing(true);

      const evaluation = await agent.completeExamination();

      if (evaluation.success) {
        setConversation(prev => [...prev, {
          speaker: 'system',
          message: 'Examination completed!',
          timestamp: new Date(),
          evaluation: evaluation.evaluation
        }]);
        
        setSession(null);
        setStatus(`✅ Evaluation complete! Score: ${evaluation.evaluation.overallScore}%`);
        
        const newStats = await agent.getPerformanceStats();
        setAgentStats(newStats);
      }
    } catch (error) {
      setStatus(`❌ Failed to complete examination: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // 6. FUNZIONE PER AVVIARE IL CICLO DI APPRENDIMENTO (opzionale)
  const triggerLearning = async () => {
    if (!agent) return;

    try {
      setStatus('🧠 Agent is learning from recent experiences...');
      setIsProcessing(true);

      const learningResult = await agent.performLearningCycle();

      if (learningResult.success) {
        setStatus(`📈 Learning complete! ${learningResult.improvementsMade || 0} improvements made.`);
        const newStats = await agent.getPerformanceStats();
        setAgentStats(newStats);
      } else {
        setStatus('📊 Learning cycle completed (insufficient data).');
      }
    } catch (error) {
      setStatus(`❌ Learning failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };
  
  // 7. RENDERIZZAZIONE DEL COMPONENTE
  return (
    <div style={{ 
      padding: '20px', 
      fontFamily: 'monospace', 
      maxWidth: '1200px', 
      margin: '0 auto',
      backgroundColor: '#f5f5f5',
      minHeight: '100vh'
    }}>
      <div style={{ 
        backgroundColor: 'white', 
        padding: '20px', 
        borderRadius: '10px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <button onClick={() => navigate(-1)} style={{ marginBottom: '20px', background: 'transparent', border: '1px solid #ccc', padding: '8px 12px', borderRadius: '5px', cursor: 'pointer' }}>
          ← Torna Indietro
        </button>

        <h1 style={{ 
          color: '#2563eb', 
          borderBottom: '2px solid #e5e7eb', 
          paddingBottom: '10px',
          margin: '0 0 20px 0',
          display: 'flex',
          alignItems: 'center'
        }}>
          <Bot size={28} style={{ marginRight: '10px' }} />
          AI Examination Session
        </h1>
        
        <div style={{ 
          background: status.startsWith('❌') ? '#fee2e2' : status.startsWith('✅') ? '#dcfce7' : '#dbeafe', 
          padding: '15px', 
          borderRadius: '8px',
          marginBottom: '20px',
          border: '1px solid #e5e7eb'
        }}>
          <strong>Status:</strong> {status}
        </div>

        {analysisResult && (
           <div style={{ marginBottom: '20px', background: '#f9fafb', padding: '10px', borderRadius: '5px' }}>
             <h3>🔬 Analysis Result</h3>
             <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap' }}>{JSON.stringify({ topics: analysisResult.totalTopics, areas: analysisResult.physicsAreas, difficulty: analysisResult.difficulty }, null, 2)}</pre>
           </div>
        )}

        {agent && (
          <div style={{ marginBottom: '20px' }}>
            <h3>🎮 Controls</h3>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '15px' }}>
              
              <button onClick={handleAnalyzeMaterial} disabled={isProcessing || analysisResult} style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '5px', cursor: 'pointer', opacity: (isProcessing || analysisResult) ? 0.5 : 1 }}>
                {analysisResult ? '✔️ Material Analyzed' : '🔬 Analyze Material'}
              </button>

              <button onClick={startExamination} disabled={isProcessing || !analysisResult || session} style={{ background: '#10b981', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '5px', cursor: 'pointer', opacity: (isProcessing || !analysisResult || session) ? 0.5 : 1 }}>
                🎓 Start Examination
              </button>

              {session && (
                <button onClick={completeExamination} disabled={isProcessing} style={{ background: '#f59e0b', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '5px', cursor: 'pointer' }}>
                  📝 Complete Exam
                </button>
              )}

              <button onClick={triggerLearning} disabled={isProcessing} style={{ background: '#8b5cf6', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '5px', cursor: 'pointer' }}>
                🧠 Trigger Learning Cycle
              </button>
            </div>
          </div>
        )}

        {session && (
          <div style={{ marginBottom: '20px' }}>
            <h3>💬 Conversation</h3>
            <div style={{ 
              background: '#f9fafb', 
              border: '1px solid #e5e7eb', 
              borderRadius: '8px', 
              padding: '15px', 
              maxHeight: '400px', 
              overflowY: 'auto',
              marginBottom: '15px'
            }}>
              {conversation.map((turn, index) => (
                <div key={index} style={{ 
                  marginBottom: '15px',
                  padding: '10px',
                  borderRadius: '5px',
                  background: turn.speaker === 'professor' ? '#dbeafe' : 
                             turn.speaker === 'student' ? '#dcfce7' : '#fef3c7'
                }}>
                  <div style={{ 
                    fontWeight: 'bold', 
                    color: turn.speaker === 'professor' ? '#1d4ed8' : 
                           turn.speaker === 'student' ? '#059669' : '#d97706',
                    marginBottom: '5px'
                  }}>
                    {turn.speaker === 'professor' && '🎓 Professor'}
                    {turn.speaker === 'student' && '👨‍🎓 Student'}
                    {turn.speaker === 'system' && '🤖 System'}
                    {turn.personality && ` (${turn.personality})`}
                    {turn.responseType && ` - ${turn.responseType}`}
                  </div>
                  <div style={{ marginBottom: '5px', whiteSpace: 'pre-wrap' }}>
                    {turn.message}
                  </div>
                  {turn.analysis && (
                    <div style={{ fontSize: '11px', color: '#6b7280', borderTop: '1px dashed #ccc', marginTop: '8px', paddingTop: '8px' }}>
                      📊 Analysis: Understanding: {turn.analysis.understanding}, 
                      Completeness: {turn.analysis.completeness}%, 
                      Accuracy: {turn.analysis.accuracy}%
                    </div>
                  )}
                  {turn.evaluation && (
                    <div style={{ fontSize: '12px', marginTop: '10px', padding: '10px', background: 'white', borderRadius: '5px', border: '1px solid #e5e7eb' }}>
                      <strong>📋 Final Evaluation:</strong><br/>
                      Grade: {turn.evaluation.gradeRecommendation}<br/>
                      Score: {turn.evaluation.overallScore}%<br/>
                      Strengths: {turn.evaluation.strengths?.join(', ')}<br/>
                      To improve: {turn.evaluation.weaknesses?.join(', ')}
                    </div>
                  )}
                  <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '5px', textAlign: 'right' }}>
                    {new Date(turn.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <textarea
                value={currentInput}
                onChange={(e) => setCurrentInput(e.target.value)}
                placeholder="Write your response as a student..."
                disabled={isProcessing}
                style={{ 
                  flex: 1, 
                  padding: '10px', 
                  borderRadius: '5px', 
                  border: '1px solid #d1d5db',
                  minHeight: '80px',
                  resize: 'vertical',
                  fontFamily: 'inherit'
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    sendStudentResponse();
                  }
                }}
              />
              <button 
                onClick={sendStudentResponse}
                disabled={isProcessing || !currentInput.trim()}
                style={{ 
                  background: '#10b981', 
                  color: 'white', 
                  border: 'none', 
                  padding: '10px 20px', 
                  borderRadius: '5px', 
                  cursor: currentInput.trim() ? 'pointer' : 'not-allowed',
                  height: 'fit-content'
                }}
              >
                Send<br/>
                <span style={{ fontSize: '10px' }}>(Ctrl+Enter)</span>
              </button>
            </div>
          </div>
        )}

        <details style={{ marginTop: '20px' }}>
          <summary style={{ cursor: 'pointer', padding: '10px', background: '#f3f4f6', borderRadius: '5px' }}>
            🔧 Debug Information
          </summary>
          <div style={{ 
            background: '#f9fafb', 
            padding: '15px', 
            marginTop: '10px',
            borderRadius: '5px',
            fontSize: '12px'
          }}>
            <div><strong>Agent ID:</strong> {agent?.agentId || 'N/A'}</div>
            <div><strong>Session Active:</strong> {session ? `Yes (ID: ${session.sessionId})` : 'No'}</div>
            <div><strong>Conversation Turns:</strong> {conversation.length}</div>
            <div><strong>Processing:</strong> {isProcessing ? 'Yes' : 'No'}</div>
            <div><strong>Environment:</strong> {process.env.NODE_ENV}</div>
          </div>
        </details>
      </div>
    </div>
  );
}