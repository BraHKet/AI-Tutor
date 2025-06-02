// src/components/StudyPlanViewer.jsx - Con Gestione Solo Chunks
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../utils/firebase';
import NavBar from './NavBar';
import { 
  Loader, BookOpen, Calendar, AlertTriangle, ArrowLeft, Clock, Lock, CheckCircle, 
  Info, FileText, Download, ExternalLink
} from 'lucide-react';
import './styles/StudyPlanViewer.css';

const StudyPlanViewer = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Stato per la visualizzazione a griglia
  const [daysData, setDaysData] = useState([]);

  useEffect(() => {
    const fetchPlanData = async () => {
      if (!projectId) {
        setError("ID Progetto non specificato nella URL.");
        setLoading(false);
        return;
      }
      
      setLoading(true);
      setError('');
      
      try {
        // Fetch project details
        const projectRef = doc(db, 'projects', projectId);
        const projectSnap = await getDoc(projectRef);

        if (!projectSnap.exists()) {
          console.error(`StudyPlanViewer: Project with ID ${projectId} not found.`);
          throw new Error("Progetto non trovato.");
        }
        
        const projectData = projectSnap.data();
        setProject(projectData);
        
        // Fetch topics from subcollection, ordered
        const topicsRef = collection(db, 'projects', projectId, 'topics');
        const q = query(topicsRef, orderBy("assignedDay"), orderBy("orderInDay"));
        const topicsSnap = await getDocs(q);

        const topicsData = topicsSnap.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        }));
        
        setTopics(topicsData);
        
        // Process data for day cards
        processDaysData(topicsData);
      } catch (err) {
        console.error("StudyPlanViewer: Error fetching study plan:", err);
        setError("Impossibile caricare i dati del piano di studio: " + err.message);
        setProject(null);
        setTopics([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPlanData();
  }, [projectId]);

  // Elabora i dati per la visualizzazione a griglia dei giorni
  const processDaysData = (topicsData) => {
    // Raggruppa i topic per giorno
    const topicsByDay = topicsData.reduce((acc, topic) => {
      const day = topic.assignedDay;
      if (!acc[day]) {
        acc[day] = [];
      }
      acc[day].push(topic);
      return acc;
    }, {});
    
    // Crea l'array dei giorni con statistiche
    const days = Object.keys(topicsByDay).map(dayNum => {
      const dayTopics = topicsByDay[dayNum];
      const completedTopics = dayTopics.filter(t => t.isCompleted);
      
      return {
        day: parseInt(dayNum),
        topics: dayTopics,
        topicsCount: dayTopics.length,
        completedCount: completedTopics.length,
        completionPercentage: dayTopics.length > 0 
          ? Math.round((completedTopics.length / dayTopics.length) * 100) 
          : 0,
        isFullyCompleted: dayTopics.length > 0 && completedTopics.length === dayTopics.length
      };
    }).sort((a, b) => a.day - b.day);
    
    // Calcola lo stato di blocco per ogni giorno
    const daysWithLockStatus = days.map((day, index) => {
      let isLocked = false;
      
      // Controlla se uno dei giorni precedenti non è completato al 100%
      for (let i = 0; i < index; i++) {
        if (!days[i].isFullyCompleted) {
          isLocked = true;
          break;
        }
      }
      
      return {
        ...day,
        isLocked
      };
    });
    
    setDaysData(daysWithLockStatus);
  };

  // Formatta la data in modo più leggibile
  const formatDate = (timestamp) => {
    if (!timestamp) return 'Data sconosciuta';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    
    return date.toLocaleDateString('it-IT', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // 🔗 Gestisce l'apertura dei link ai materiali
  const handleMaterialClick = (source) => {
    if (source.webViewLink) {
      window.open(source.webViewLink, '_blank', 'noopener,noreferrer');
    } else {
      console.warn('StudyPlanViewer: No webViewLink available for source:', source);
    }
  };

  // 🔄 Determina il tipo di storage del progetto
  const getStorageMode = () => {
    return project?.storageMode || (project?.originalFiles?.[0]?.driveFileId ? 'full' : 'chunks_only');
  };

  // 📊 Renderizza le fonti di un argomento in base al tipo di storage
  const renderTopicSources = (topic) => {
    const storageMode = getStorageMode();
    const sources = topic.sources || [];
    
    if (sources.length === 0) {
      return (
        <div className="no-sources">
          <Info size={14} />
          <span>Nessun materiale associato</span>
        </div>
      );
    }

    return (
      <div className="topic-sources">
        <h4>Materiali di Studio:</h4>
        <ul className="sources-list">
          {sources.map((source, index) => {
            switch (source.type) {
              case 'pdf_chunk':
                return (
                  <li key={index} className="source-item">
                    <FileText size={16} className="source-icon" />
                    <div className="source-info">
                      <button 
                        className="source-link"
                        onClick={() => handleMaterialClick(source)}
                        title="Apri chunk PDF"
                      >
                        {source.chunkName || 'Chunk PDF'}
                      </button>
                      <div className="source-details">
                        <span className="source-origin">
                          📄 {source.originalFileName} 
                          {source.pageStart && source.pageEnd && 
                            ` (pagine ${source.pageStart}-${source.pageEnd})`
                          }
                        </span>
                        {storageMode === 'chunks_only' && (
                          <span className="storage-info"> • Solo chunks</span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              
              case 'pdf_original':
                return (
                  <li key={index} className="source-item">
                    <BookOpen size={16} className="source-icon" />
                    <div className="source-info">
                      <button 
                        className="source-link"
                        onClick={() => handleMaterialClick(source)}
                        title="Apri file completo"
                      >
                        {source.name} (Completo)
                      </button>
                      <span className="source-origin">📚 File originale completo</span>
                    </div>
                  </li>
                );
              
              case 'pdf_metadata':
                return (
                  <li key={index} className="source-item">
                    <Info size={16} className="source-icon" />
                    <div className="source-info">
                      <span className="source-metadata">
                        📋 {source.originalFileName}
                      </span>
                      <div className="source-details">
                        <span className="source-note">
                          Metadati • {source.originalFileSize ? 
                            `${Math.round(source.originalFileSize / 1024 / 1024)} MB` : 
                            'Dimensione non disponibile'
                          }
                        </span>
                        <span className="storage-info"> • File non caricato</span>
                      </div>
                    </div>
                  </li>
                );
              
              case 'note':
                return (
                  <li key={index} className="source-item">
                    <Info size={16} className="source-icon" />
                    <div className="source-info">
                      <span className={`source-note ${source.noteType || ''}`}>
                        {source.noteType === 'exam_simulation' && '🎯 '}
                        {source.noteType === 'review' && '📚 '}
                        {source.description}
                      </span>
                    </div>
                  </li>
                );
              
              case 'error_chunk':
                return (
                  <li key={index} className="source-item">
                    <AlertTriangle size={16} className="source-icon error" />
                    <div className="source-info">
                      <span className="source-error">
                        ❌ Errore: {source.name}
                      </span>
                      <span className="source-note">{source.error}</span>
                    </div>
                  </li>
                );
              
              default:
                return (
                  <li key={index} className="source-item">
                    <FileText size={16} className="source-icon" />
                    <div className="source-info">
                      <span className="source-unknown">
                        📎 Materiale: {source.name || 'Sconosciuto'}
                      </span>
                    </div>
                  </li>
                );
            }
          })}
        </ul>
      </div>
    );
  };

  // --- RENDER CONDITIONALS ---

  if (loading) {
    return (
      <div className="study-plan-loading">
        <Loader size={48} className="spin-icon" />
        <span>Caricamento piano di studio...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="study-plan-container">
        <NavBar />
        <div className="error-container">
          <AlertTriangle size={36} />
          <h2>Errore nel Caricamento</h2>
          <p>{error}</p>
          <button onClick={() => navigate('/projects')} className="back-button">
            <ArrowLeft size={16} />
            Torna alla lista dei progetti
          </button>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="study-plan-container">
        <NavBar />
        <div className="error-container">
          <AlertTriangle size={36} />
          <h2>Progetto non trovato</h2>
          <p>Non è stato possibile trovare i dettagli per il progetto con ID: <strong>{projectId}</strong>.</p>
          <button onClick={() => navigate('/projects')} className="back-button">
            <ArrowLeft size={16} />
            Torna alla lista dei progetti
          </button>
        </div>
      </div>
    );
  }

  const storageMode = getStorageMode();

  return (
    <div className="study-plan-container">
      <NavBar />
      
      <div className="study-plan-content">
        <div className="study-plan-header">
          <div className="plan-info">
            <h1>{project.title}</h1>
            <div className="plan-details">
              <div className="plan-detail">
                <BookOpen size={16} />
                <span>Esame: {project.examName}</span>
              </div>
              
              <div className="plan-detail">
                <Calendar size={16} />
                <span>Giorni: {project.totalDays}</span>
              </div>
              
              <div className="plan-detail">
                <Clock size={16} />
                <span>Creato il: {formatDate(project.createdAt)}</span>
              </div>

              {/* 🔍 Indicatore modalità storage */}
              <div className="plan-detail">
                <FileText size={16} />
                <span>
                  Storage: {storageMode === 'chunks_only' ? 
                    '📦 Solo Chunks (Ottimizzato)' : 
                    '📚 File Completi'
                  }
                </span>
              </div>
            </div>
            
            {project.description && (
              <div className="plan-description">
                <p>{project.description}</p>
              </div>
            )}

            {/* 💡 Info sulla modalità chunks */}
            {storageMode === 'chunks_only' && (
              <div className="storage-mode-info">
                <Info size={16} />
                <span>
                  Questo progetto utilizza la modalità ottimizzata: sono stati caricati solo i chunks 
                  delle pagine selezionate per massimizzare l'efficienza.
                </span>
              </div>
            )}
          </div>
        </div>
        
        {/* Vista a griglia dei giorni */}
        <div className="days-grid">
          {daysData.length === 0 ? (
            <div className="error-container">
              <AlertTriangle size={24} />
              <h2>Nessuna pianificazione trovata</h2>
              <p>Non è stato possibile trovare argomenti pianificati per questo progetto.</p>
            </div>
          ) : (
            daysData.map(day => (
              <div 
                key={`day-${day.day}`} 
                className={`day-card ${day.isLocked ? 'locked' : ''}`}
              >
                {day.isLocked && (
                  <div className="day-card-lock-overlay">
                    <Lock size={32} />
                    <div className="day-card-lock-message">
                      Completa i giorni precedenti per sbloccare questo giorno
                    </div>
                  </div>
                )}
                
                <div className="day-card-header">
                  <Calendar size={20} />
                  <h3 className="day-card-title">Giorno {day.day}</h3>
                  <div className="day-stats">
                    <span className="completion-badge">
                      {day.completedCount}/{day.topicsCount}
                    </span>
                  </div>
                </div>
                
                <div className="day-card-content">
                  {day.topics.length === 0 ? (
                    <div className="empty-day">
                      <Info size={24} />
                      <p>Nessun argomento pianificato</p>
                    </div>
                  ) : (
                    <div className="topics-list">
                      {day.topics.map(topic => (
                        <div 
                          key={topic.id} 
                          className={`topic-item ${topic.isCompleted ? 'completed' : ''}`}
                        >
                          <div className="topic-header">
                            <div 
                              className="topic-checkbox"
                              onClick={() => {
                                // Toggle completion - implementa se necessario
                                console.log('Toggle completion for:', topic.title);
                              }}
                            >
                              {topic.isCompleted ? (
                                <CheckCircle size={20} className="checkbox-icon completed" />
                              ) : (
                                <Circle size={20} className="checkbox-icon" />
                              )}
                            </div>
                            
                            <h4 className="topic-title">{topic.title}</h4>
                            
                            {topic.isCompleted && (
                              <span className="completed-badge">✓ Completato</span>
                            )}
                          </div>
                          
                          {topic.description && (
                            <div className="topic-description">
                              {topic.description}
                            </div>
                          )}
                          
                          {renderTopicSources(topic)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        
        <div className="plan-footer">
          <button className="back-button" onClick={() => navigate('/projects')}>
            <ArrowLeft size={16} />
            Torna alla lista dei progetti
          </button>
        </div>
      </div>
    </div>
  );
};

// Helper component for the Circle icon
const Circle = ({ size, color = 'currentColor' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10"></circle>
  </svg>
);

export default StudyPlanViewer;