// ==========================================
// FILE: src/components/AgentDemo.js (VERSIONE OLISTICA)
// ==========================================

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { googleDriveService } from '../utils/googleDriveService';
import { PhysicsAgent } from '../agents/PhysicsAgent';
import { Bot, FileText, Users, Brain, AlertCircle, CheckCircle, Clock, BookOpen } from 'lucide-react';

export default function AgentDemo() {
  const { projectId, topicId } = useParams();
  const navigate = useNavigate();

  const [agent, setAgent] = useState(null);
  const [status, setStatus] = useState('Initializing...');
  const [session, setSession] = useState(null);
  const [conversation, setConversation] = useState([]);
  const [currentInput, setCurrentInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [materialAnalysis, setMaterialAnalysis] = useState(null);
  const [agentStats, setAgentStats] = useState(null);
  const [examinationPhase, setExaminationPhase] = useState('not_started'); // not_started, material_analysis, examination_active, evaluation_complete
  const [treatmentGuidelines, setTreatmentGuidelines] = useState(null);

  // 1. INIZIALIZZA L'AGENTE OLISTICO
  useEffect(() => {
    const initialize = async () => {
      try {
        setStatus('🔧 Setting up holistic examination environment...');
        await googleDriveService.initialize();

        if (!process.env.REACT_APP_SUPABASE_URL || !process.env.REACT_APP_GEMINI_API_KEY) {
          throw new Error('Missing environment variables. Check your .env file for REACT_APP_SUPABASE_URL and REACT_APP_GEMINI_API_KEY.');
        }

        setStatus('🤖 Initializing Holistic Physics Agent...');
        const physicsAgent = new PhysicsAgent(
          process.env.REACT_APP_SUPABASE_URL,
          process.env.REACT_APP_SUPABASE_ANON_KEY
        );
        
        const initResult = await physicsAgent.initialize();

        if (initResult.success) {
          setAgent(physicsAgent);
          setStatus('✅ Holistic Agent ready. Analyze the PDF material to begin.');
          setExaminationPhase('ready_for_material');
        }
      } catch (error) {
        setStatus(`❌ Initialization failed: ${error.message}`);
        console.error(error);
      }
    };
    initialize();
  }, []);

  // 2. ANALIZZA IL MATERIALE PDF CON APPROCCIO BASE64
  const handleAnalyzeMaterial = async () => {
    if (!agent || !projectId || !topicId) {
      setStatus('❌ Missing agent or project/topic ID.');
      return;
    }

    try {
      setIsProcessing(true);
      setExaminationPhase('material_analysis');
      setStatus('📄 Fetching PDF from Firestore...');

      const topicRef = doc(db, 'projects', projectId, 'topics', topicId);
      const topicSnap = await getDoc(topicRef);
      if (!topicSnap.exists()) throw new Error("Topic not found in Firestore.");
      
      const topicData = topicSnap.data();
      const driveFileId = topicData.driveFileId || topicData.sources?.find(s => s.chunkDriveId)?.chunkDriveId;
      const pdfName = topicData.title || 'material.pdf';
      
      if (!driveFileId) throw new Error("Google Drive File ID not found for this topic.");
      
      setStatus('🔗 Downloading PDF from Google Drive...');
      const accessToken = await googleDriveService.ensureAuthenticated();
      const pdfBlob = await googleDriveService.downloadPdfChunk(driveFileId, accessToken);

      setStatus('🧠 Agent is processing PDF with advanced analysis...');
      const result = await agent.analyzeMaterial(
        { blob: pdfBlob, name: pdfName },
        (progress) => setStatus(`🧠 ${progress.message}`)
      );

      if (result.success) {
        setMaterialAnalysis(result);
        setExaminationPhase('ready_for_examination');
        setStatus(`✅ Material analyzed! Found ${result.analysis.totalPages} pages, complexity: ${result.analysis.estimatedComplexity}. Ready to start holistic examination.`);
        
        // Genera le linee guida per la trattazione
        generateTreatmentGuidelines(result.analysis);
      }
    } catch (error) {
      setStatus(`❌ Analysis failed: ${error.message}`);
      console.error(error);
      setExaminationPhase('ready_for_material');
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. GENERA LINEE GUIDA PER LA TRATTAZIONE
  const generateTreatmentGuidelines = (analysis) => {
    const guidelines = {
      expectedDuration: "15-25 minuti",
      approach: "Trattazione completa dall'inizio alla fine",
      mustInclude: [],
      tips: []
    };

    if (analysis.hasFormulas) {
      guidelines.mustInclude.push("Tutte le formule presenti nel PDF");
      guidelines.mustInclude.push("Derivazioni matematiche step-by-step");
      guidelines.tips.push("Spiega ogni passaggio delle derivazioni");
    }

    if (analysis.hasImages) {
      guidelines.mustInclude.push("Spiegazione di tutti i grafici e diagrammi");
      guidelines.tips.push("Descrivi cosa mostrano le immagini e la loro rilevanza");
    }

    if (analysis.contentTypes.includes('physics')) {
      guidelines.mustInclude.push("Principi fisici fondamentali");
      guidelines.mustInclude.push("Applicazioni pratiche dei concetti");
      guidelines.tips.push("Collega i concetti teorici alle applicazioni reali");
    }

    if (analysis.estimatedComplexity === 'high' || analysis.estimatedComplexity === 'very_high') {
      guidelines.expectedDuration = "20-30 minuti";
      guidelines.tips.push("Prenditi il tempo necessario per essere completo");
      guidelines.tips.push("Organizza l'esposizione in sezioni logiche");
    }

    guidelines.mustInclude.push("Connessioni tra i diversi argomenti");
    guidelines.tips.push("Mantieni un flusso logico dall'inizio alla fine");
    guidelines.tips.push("Usa la terminologia tecnica appropriata");

    setTreatmentGuidelines(guidelines);
  };

  // 4. INIZIA L'ESAME OLISTICO
  const startHolisticExamination = async () => {
    if (!agent || !materialAnalysis) {
      alert('Please analyze the material first.');
      return;
    }

    try {
      setIsProcessing(true);
      setExaminationPhase('examination_active');
      setStatus('🎓 Starting holistic examination...');

      const examSession = await agent.startHolisticExamination(
        'demo-student-id', // ID studente demo
        { personalityPreference: 'adaptive' }
      );

      if (examSession.success) {
        setSession(examSession);
        setConversation([{
          speaker: 'professor',
          message: examSession.message,
          timestamp: new Date(),
          personality: examSession.personality,
          expectedDuration: examSession.expectedDuration,
          approach: examSession.approach,
          metadata: examSession.metadata
        }]);
        setStatus(`🎭 Holistic examination started (Professor: ${examSession.personality})`);
      }
    } catch (error) {
      setStatus(`❌ Failed to start examination: ${error.message}`);
      setExaminationPhase('ready_for_examination');
    } finally {
      setIsProcessing(false);
    }
  };

  // 5. INVIA LA TRATTAZIONE/RISPOSTA DELLO STUDENTE
  const sendStudentTreatment = async () => {
    if (!agent || !session || !currentInput.trim()) return;

    try {
      setIsProcessing(true);
      
      const studentMessage = { 
        speaker: 'student', 
        message: currentInput, 
        timestamp: new Date(),
        wordCount: currentInput.trim().split(' ').length
      };
      setConversation(prev => [...prev, studentMessage]);
      setCurrentInput('');
      
      setStatus('🤖 Professor is analyzing your treatment...');

      const result = await agent.processStudentTreatment(currentInput, {
        duration: Math.round((Date.now() - new Date(session.timestamp || Date.now())) / 1000 / 60),
        wordCount: studentMessage.wordCount
      });

      if (result.success) {
        // Controlla se l'esame è completato
        if (result.nextAction === 'final_evaluation') {
          setExaminationPhase('evaluation_complete');
          setStatus('📊 Examination completed! Final evaluation available.');
        } else {
          const professorMessage = {
            speaker: 'professor',
            message: result.professorResponse,
            timestamp: new Date(),
            responseType: result.responseType,
            analysis: result.analysis,
            phase: result.analysis.phase,
            nextAction: result.nextAction
          };
          setConversation(prev => [...prev, professorMessage]);
          setStatus(`📊 Phase: ${result.analysis.phase} | Completeness: ${result.analysis.completeness}%`);
        }
      }
    } catch (error) {
      setStatus(`❌ Failed to process treatment: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // 6. TRIGGER LEARNING CYCLE
  const triggerLearning = async () => {
    if (!agent) return;

    try {
      setStatus('🧠 Agent is learning from recent holistic sessions...');
      setIsProcessing(true);

      const learningResult = await agent.performLearningCycle();

      if (learningResult.success) {
        setStatus(`📈 Learning complete! ${learningResult.improvementsMade || 0} improvements made.`);
        const newStats = await agent.getPerformanceStats();
        setAgentStats(newStats);
      } else {
        setStatus('📊 Learning cycle completed (insufficient data for improvements).');
      }
    } catch (error) {
      setStatus(`❌ Learning failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // 7. GET PERFORMANCE STATS
  const refreshStats = async () => {
    if (!agent) return;
    try {
      const stats = await agent.getPerformanceStats();
      setAgentStats(stats);
    } catch (error) {
      console.error('Failed to refresh stats:', error);
    }
  };

  // 8. RENDERIZZAZIONE DEL COMPONENTE
  return (
    <div style={{ 
      padding: '20px', 
      fontFamily: 'system-ui, -apple-system, sans-serif', 
      maxWidth: '1400px', 
      margin: '0 auto',
      backgroundColor: '#f8fafc',
      minHeight: '100vh'
    }}>
      <div style={{ 
        backgroundColor: 'white', 
        padding: '30px', 
        borderRadius: '12px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      }}>
        <button 
          onClick={() => navigate(-1)} 
          style={{ 
            marginBottom: '20px', 
            background: 'transparent', 
            border: '1px solid #d1d5db', 
            padding: '8px 16px', 
            borderRadius: '6px', 
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          ← Torna Indietro
        </button>

        <h1 style={{ 
          color: '#1e40af', 
          borderBottom: '3px solid #e5e7eb', 
          paddingBottom: '15px',
          margin: '0 0 30px 0',
          display: 'flex',
          alignItems: 'center',
          fontSize: '28px'
        }}>
          <Bot size={32} style={{ marginRight: '12px' }} />
          Holistic AI Examination Session
          <span style={{ 
            marginLeft: '15px', 
            fontSize: '14px', 
            background: '#dbeafe', 
            color: '#1e40af', 
            padding: '4px 12px', 
            borderRadius: '20px',
            fontWeight: 'normal'
          }}>
            v3.0 Holistic
          </span>
        </h1>
        
        {/* STATUS BAR */}
        <div style={{ 
          background: status.startsWith('❌') ? '#fee2e2' : 
                     status.startsWith('✅') ? '#dcfce7' : 
                     status.startsWith('🧠') ? '#fef3c7' : '#dbeafe', 
          padding: '16px', 
          borderRadius: '8px',
          marginBottom: '25px',
          border: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center'
        }}>
          <strong style={{ marginRight: '10px' }}>Status:</strong> 
          <span>{status}</span>
          {isProcessing && (
            <div style={{ 
              marginLeft: 'auto', 
              display: 'flex', 
              alignItems: 'center',
              color: '#6b7280'
            }}>
              <Clock size={16} style={{ marginRight: '5px' }} />
              Processing...
            </div>
          )}
        </div>

        {/* PHASE INDICATOR */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          marginBottom: '25px',
          background: '#f9fafb',
          padding: '15px',
          borderRadius: '8px',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center',
              color: examinationPhase === 'material_analysis' || materialAnalysis ? '#10b981' : '#6b7280'
            }}>
              <FileText size={20} style={{ marginRight: '8px' }} />
              <span style={{ fontSize: '14px', fontWeight: '500' }}>Material Analysis</span>
              {materialAnalysis && <CheckCircle size={16} style={{ marginLeft: '5px', color: '#10b981' }} />}
            </div>
            
            <div style={{ 
              display: 'flex', 
              alignItems: 'center',
              color: examinationPhase === 'examination_active' ? '#3b82f6' : 
                     session ? '#10b981' : '#6b7280'
            }}>
              <Users size={20} style={{ marginRight: '8px' }} />
              <span style={{ fontSize: '14px', fontWeight: '500' }}>Holistic Examination</span>
              {session && <CheckCircle size={16} style={{ marginLeft: '5px', color: '#10b981' }} />}
            </div>
            
            <div style={{ 
              display: 'flex', 
              alignItems: 'center',
              color: examinationPhase === 'evaluation_complete' ? '#10b981' : '#6b7280'
            }}>
              <Brain size={20} style={{ marginRight: '8px' }} />
              <span style={{ fontSize: '14px', fontWeight: '500' }}>Final Evaluation</span>
              {examinationPhase === 'evaluation_complete' && 
                <CheckCircle size={16} style={{ marginLeft: '5px', color: '#10b981' }} />}
            </div>
          </div>
        </div>

        {/* MATERIAL ANALYSIS RESULT */}
        {materialAnalysis && (
          <div style={{ 
            marginBottom: '25px', 
            background: '#f0f9ff', 
            padding: '20px', 
            borderRadius: '8px',
            border: '1px solid #0ea5e9'
          }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#0c4a6e', display: 'flex', alignItems: 'center' }}>
              <FileText size={20} style={{ marginRight: '8px' }} />
              📊 Material Analysis Results
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
              <div>
                <strong>Pages:</strong> {materialAnalysis.analysis.totalPages}
              </div>
              <div>
                <strong>Complexity:</strong> 
                <span style={{ 
                  marginLeft: '8px',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  background: materialAnalysis.analysis.estimatedComplexity === 'high' ? '#fee2e2' : 
                             materialAnalysis.analysis.estimatedComplexity === 'medium' ? '#fef3c7' : '#dcfce7',
                  color: materialAnalysis.analysis.estimatedComplexity === 'high' ? '#dc2626' : 
                         materialAnalysis.analysis.estimatedComplexity === 'medium' ? '#d97706' : '#059669'
                }}>
                  {materialAnalysis.analysis.estimatedComplexity}
                </span>
              </div>
              <div>
                <strong>Has Formulas:</strong> {materialAnalysis.analysis.hasFormulas ? '✅ Yes' : '❌ No'}
              </div>
              <div>
                <strong>Has Images:</strong> {materialAnalysis.analysis.hasImages ? '✅ Yes' : '❌ No'}
              </div>
              <div>
                <strong>Content Types:</strong> {materialAnalysis.analysis.contentTypes.join(', ')}
              </div>
            </div>
            
            {/* RECOMMENDED APPROACH */}
            <div style={{ marginTop: '15px', padding: '12px', background: 'white', borderRadius: '6px' }}>
              <strong>Recommended Approach:</strong> {materialAnalysis.recommendedApproach.join(', ')}
            </div>
          </div>
        )}

        {/* TREATMENT GUIDELINES */}
        {treatmentGuidelines && !session && (
          <div style={{ 
            marginBottom: '25px', 
            background: '#fffbeb', 
            padding: '20px', 
            borderRadius: '8px',
            border: '1px solid #f59e0b'
          }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#92400e', display: 'flex', alignItems: 'center' }}>
              <BookOpen size={20} style={{ marginRight: '8px' }} />
              📋 Guidelines for Your Treatment
            </h3>
            
            <div style={{ marginBottom: '15px' }}>
              <strong>Expected Duration:</strong> {treatmentGuidelines.expectedDuration}
            </div>
            <div style={{ marginBottom: '15px' }}>
              <strong>Approach:</strong> {treatmentGuidelines.approach}
            </div>
            
            <div style={{ marginBottom: '15px' }}>
              <strong>Must Include:</strong>
              <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                {treatmentGuidelines.mustInclude.map((item, index) => (
                  <li key={index} style={{ marginBottom: '4px' }}>{item}</li>
                ))}
              </ul>
            </div>
            
            <div>
              <strong>Tips:</strong>
              <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                {treatmentGuidelines.tips.map((tip, index) => (
                  <li key={index} style={{ marginBottom: '4px', color: '#6b7280' }}>{tip}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* CONTROLS */}
        {agent && (
          <div style={{ marginBottom: '25px' }}>
            <h3 style={{ marginBottom: '15px', color: '#374151' }}>🎮 Controls</h3>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              
              <button 
                onClick={handleAnalyzeMaterial} 
                disabled={isProcessing || materialAnalysis}
                style={{ 
                  background: materialAnalysis ? '#10b981' : '#3b82f6', 
                  color: 'white', 
                  border: 'none', 
                  padding: '12px 18px', 
                  borderRadius: '6px', 
                  cursor: 'pointer', 
                  opacity: (isProcessing || materialAnalysis) ? 0.7 : 1,
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <FileText size={16} style={{ marginRight: '6px' }} />
                {materialAnalysis ? '✔️ Material Analyzed' : '🔬 Analyze PDF Material'}
              </button>

              <button 
                onClick={startHolisticExamination} 
                disabled={isProcessing || !materialAnalysis || session}
                style={{ 
                  background: session ? '#10b981' : '#8b5cf6', 
                  color: 'white', 
                  border: 'none', 
                  padding: '12px 18px', 
                  borderRadius: '6px', 
                  cursor: 'pointer', 
                  opacity: (isProcessing || !materialAnalysis || session) ? 0.7 : 1,
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <Users size={16} style={{ marginRight: '6px' }} />
                {session ? '✔️ Examination Active' : '🎓 Start Holistic Examination'}
              </button>

              <button 
                onClick={triggerLearning} 
                disabled={isProcessing}
                style={{ 
                  background: '#6366f1', 
                  color: 'white', 
                  border: 'none', 
                  padding: '12px 18px', 
                  borderRadius: '6px', 
                  cursor: 'pointer',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <Brain size={16} style={{ marginRight: '6px' }} />
                🧠 Trigger Learning Cycle
              </button>

              <button 
                onClick={refreshStats} 
                disabled={isProcessing}
                style={{ 
                  background: '#64748b', 
                  color: 'white', 
                  border: 'none', 
                  padding: '12px 18px', 
                  borderRadius: '6px', 
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                📊 Refresh Stats
              </button>
            </div>
          </div>
        )}

        {/* CONVERSATION AREA */}
        {session && (
          <div style={{ marginBottom: '25px' }}>
            <h3 style={{ marginBottom: '15px', color: '#374151' }}>💬 Holistic Examination Conversation</h3>
            
            <div style={{ 
              background: '#f9fafb', 
              border: '1px solid #e5e7eb', 
              borderRadius: '8px', 
              padding: '20px', 
              maxHeight: '500px', 
              overflowY: 'auto',
              marginBottom: '20px'
            }}>
              {conversation.map((turn, index) => (
                <div key={index} style={{ 
                  marginBottom: '20px',
                  padding: '15px',
                  borderRadius: '8px',
                  background: turn.speaker === 'professor' ? '#dbeafe' : 
                             turn.speaker === 'student' ? '#dcfce7' : '#fef3c7'
                }}>
                  <div style={{ 
                    fontWeight: 'bold', 
                    color: turn.speaker === 'professor' ? '#1d4ed8' : 
                           turn.speaker === 'student' ? '#059669' : '#d97706',
                    marginBottom: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <span>
                      {turn.speaker === 'professor' && '🎓 Professor'}
                      {turn.speaker === 'student' && '👨‍🎓 Student'}
                      {turn.speaker === 'system' && '🤖 System'}
                      {turn.personality && ` (${turn.personality})`}
                      {turn.responseType && ` - ${turn.responseType}`}
                    </span>
                    {turn.wordCount && (
                      <span style={{ 
                        fontSize: '12px', 
                        color: '#6b7280', 
                        fontWeight: 'normal' 
                      }}>
                        {turn.wordCount} words
                      </span>
                    )}
                  </div>
                  
                  <div style={{ marginBottom: '10px', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                    {turn.message}
                  </div>
                  
                  {/* METADATA DISPLAY */}
                  {turn.expectedDuration && (
                    <div style={{ 
                      fontSize: '12px', 
                      color: '#6b7280', 
                      marginTop: '8px',
                      padding: '8px',
                      background: 'rgba(255,255,255,0.5)',
                      borderRadius: '4px'
                    }}>
                      <strong>Expected Duration:</strong> {turn.expectedDuration} | 
                      <strong> Approach:</strong> {turn.approach}
                    </div>
                  )}
                  
                  {turn.analysis && (
                    <div style={{ 
                      fontSize: '12px', 
                      color: '#6b7280', 
                      borderTop: '1px dashed #d1d5db', 
                      marginTop: '10px', 
                      paddingTop: '10px' 
                    }}>
                      📊 Analysis: Completeness: {turn.analysis.completeness}%, 
                      Technical Accuracy: {turn.analysis.technicalAccuracy}%, 
                      Phase: {turn.analysis.phase}
                      {turn.nextAction && ` | Next: ${turn.nextAction}`}
                    </div>
                  )}
                  
                  {turn.evaluation && (
                    <div style={{ 
                      fontSize: '13px', 
                      marginTop: '12px', 
                      padding: '12px', 
                      background: 'white', 
                      borderRadius: '6px', 
                      border: '1px solid #e5e7eb' 
                    }}>
                      <strong>📋 Final Evaluation:</strong><br/>
                      Grade: {turn.evaluation.gradeRecommendation} ({turn.evaluation.gradeDescription})<br/>
                      Score: {turn.evaluation.overallScore}%<br/>
                      Strengths: {turn.evaluation.strengths?.join(', ')}<br/>
                      Areas to improve: {turn.evaluation.criticalWeaknesses?.join(', ')}<br/>
                      Study recommendations: {turn.evaluation.studyRecommendations?.join(', ')}
                    </div>
                  )}
                  
                  <div style={{ 
                    fontSize: '11px', 
                    color: '#9ca3af', 
                    marginTop: '8px', 
                    textAlign: 'right' 
                  }}>
                    {new Date(turn.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>

            {/* INPUT AREA */}
            {examinationPhase !== 'evaluation_complete' && (
              <div style={{ display: 'flex', gap: '12px' }}>
                <textarea
                  value={currentInput}
                  onChange={(e) => setCurrentInput(e.target.value)}
                  placeholder={conversation.length === 1 ? 
                    "Provide your complete treatment of the material. Include all formulas, explanations, and connections between concepts..." :
                    "Continue your explanation or provide the requested clarification..."
                  }
                  disabled={isProcessing}
                  style={{ 
                    flex: 1, 
                    padding: '12px', 
                    borderRadius: '6px', 
                    border: '1px solid #d1d5db',
                    minHeight: '120px',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    fontSize: '14px'
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      sendStudentTreatment();
                    }
                  }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button 
                    onClick={sendStudentTreatment}
                    disabled={isProcessing || !currentInput.trim()}
                    style={{ 
                      background: '#10b981', 
                      color: 'white', 
                      border: 'none', 
                      padding: '12px 20px', 
                      borderRadius: '6px', 
                      cursor: currentInput.trim() ? 'pointer' : 'not-allowed',
                      fontWeight: '500',
                      minWidth: '120px'
                    }}
                  >
                    Send Treatment
                    <br/>
                    <span style={{ fontSize: '11px', fontWeight: 'normal' }}>(Ctrl+Enter)</span>
                  </button>
                  
                  <div style={{ 
                    fontSize: '11px', 
                    color: '#6b7280', 
                    textAlign: 'center',
                    padding: '4px'
                  }}>
                    {currentInput.trim().split(' ').length} words
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PERFORMANCE STATS */}
        {agentStats && (
          <div style={{ 
            marginBottom: '25px', 
            background: '#f0fdf4', 
            padding: '20px', 
            borderRadius: '8px',
            border: '1px solid #22c55e'
          }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#15803d' }}>📈 Agent Performance Stats</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px' }}>
              <div>
                <strong>Total Sessions:</strong> {agentStats.totalSessions}
              </div>
              <div>
                <strong>Holistic Sessions:</strong> {agentStats.holisticSessions}
              </div>
              <div>
                <strong>Avg Performance:</strong> {agentStats.averagePerformance}%
              </div>
              <div>
                <strong>Student Satisfaction:</strong> {agentStats.studentSatisfaction}%
              </div>
              <div>
                <strong>Learning Status:</strong> {agentStats.isLearning ? '🧠 Active' : '💤 Idle'}
              </div>
              <div>
                <strong>Approach:</strong> {agentStats.approach}
              </div>
            </div>
          </div>
        )}

        {/* EXAMINATION COMPLETE MESSAGE */}
        {examinationPhase === 'evaluation_complete' && (
          <div style={{ 
            background: '#ecfdf5', 
            border: '2px solid #22c55e', 
            borderRadius: '8px', 
            padding: '20px',
            textAlign: 'center',
            marginBottom: '25px'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '10px' }}>🎉</div>
            <h3 style={{ color: '#15803d', margin: '0 0 10px 0' }}>Holistic Examination Completed!</h3>
            <p style={{ color: '#166534', margin: '0' }}>
              Your comprehensive treatment has been evaluated. Check the conversation above for detailed feedback.
            </p>
          </div>
        )}

        {/* DEBUG INFORMATION */}
        <details style={{ marginTop: '25px' }}>
          <summary style={{ 
            cursor: 'pointer', 
            padding: '12px', 
            background: '#f3f4f6', 
            borderRadius: '6px',
            fontWeight: '500'
          }}>
            🔧 Debug Information
          </summary>
          <div style={{ 
            background: '#f9fafb', 
            padding: '20px', 
            marginTop: '10px',
            borderRadius: '6px',
            fontSize: '13px',
            fontFamily: 'monospace'
          }}>
            <div><strong>Agent ID:</strong> {agent?.agentId || 'N/A'}</div>
            <div><strong>Session Active:</strong> {session ? `Yes (ID: ${session.sessionId})` : 'No'}</div>
            <div><strong>Examination Phase:</strong> {examinationPhase}</div>
            <div><strong>Conversation Turns:</strong> {conversation.length}</div>
            <div><strong>Processing:</strong> {isProcessing ? 'Yes' : 'No'}</div>
            <div><strong>Material Analyzed:</strong> {materialAnalysis ? 'Yes' : 'No'}</div>
            <div><strong>PDF Complexity:</strong> {materialAnalysis?.analysis?.estimatedComplexity || 'N/A'}</div>
            <div><strong>Environment:</strong> {process.env.NODE_ENV}</div>
            <div><strong>Agent Approach:</strong> Holistic v3.0</div>
          </div>
        </details>
      </div>
    </div>
  );
}