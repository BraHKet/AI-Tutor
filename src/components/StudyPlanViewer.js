// src/components/StudyPlanViewer.jsx
import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, getDocs, query, orderBy, updateDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';
import NavBar from './NavBar';
import { 
  Loader, BookOpen, Calendar, CheckSquare, Square, Link as LinkIcon, 
  FileText, AlertTriangle, ArrowLeft, Clock, Book
} from 'lucide-react';
import './styles/StudyPlanViewer.css';

const StudyPlanViewer = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentDay, setCurrentDay] = useState(1); // Per navigare tra i giorni

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
        
        // Imposta il giorno corrente alla giornata attuale (se c'è)
        if (topicsData.length > 0) {
          const uniqueDays = [...new Set(topicsData.map(topic => topic.assignedDay))];
          if (uniqueDays.length > 0) {
            setCurrentDay(uniqueDays[0]);
          }
        }

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

  // Ottieni gli argomenti per il giorno selezionato
  const topicsForCurrentDay = topics.filter(topic => topic.assignedDay === currentDay);
  
  // Giorni disponibili nel piano
  const availableDays = [...new Set(topics.map(topic => topic.assignedDay))].sort((a, b) => a - b);
  
  // Naviga al giorno precedente se disponibile
  const goToPreviousDay = () => {
    const currentIndex = availableDays.indexOf(currentDay);
    if (currentIndex > 0) {
      setCurrentDay(availableDays[currentIndex - 1]);
    }
  };
  
  // Naviga al giorno successivo se disponibile
  const goToNextDay = () => {
    const currentIndex = availableDays.indexOf(currentDay);
    if (currentIndex < availableDays.length - 1) {
      setCurrentDay(availableDays[currentIndex + 1]);
    }
  };
  
  // Gestisce il cambio di stato "completato" di un argomento
  const toggleTopicCompleted = async (topicId, currentStatus) => {
    try {
      const topicRef = doc(db, 'projects', projectId, 'topics', topicId);
      await updateDoc(topicRef, {
        isCompleted: !currentStatus
      });
      
      // Aggiorna lo stato locale
      setTopics(topics.map(topic => 
        topic.id === topicId 
          ? { ...topic, isCompleted: !currentStatus } 
          : topic
      ));
    } catch (err) {
      console.error("Error updating topic status:", err);
      // Mostra un messaggio all'utente se necessario
    }
  };
  
  // Formatta la data in modo più leggibile
  const formatDate = (timestamp) => {
    if (!timestamp) return 'Data sconosciuta';
    
    // Converte in data se è un timestamp Firebase
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    
    return date.toLocaleDateString('it-IT', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // --- RENDER CONDITIONALS ---

  // 1. Stato di Caricamento
  if (loading) {
    return (
      <div className="study-plan-loading">
        <Loader size={48} className="spin-icon" />
        <span>Caricamento piano di studio...</span>
      </div>
    );
  }

  // 2. Stato di Errore (durante il fetch)
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

  // 3. Stato Progetto Non Trovato
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

  // --- RENDER PRINCIPALE ---
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
            </div>
            
            {project.description && (
              <div className="plan-description">
                <p>{project.description}</p>
              </div>
            )}
          </div>
          
          <div className="navigation-controls">
            <button 
              onClick={goToPreviousDay} 
              className="nav-button"
              disabled={availableDays.indexOf(currentDay) === 0}
            >
              Giorno Precedente
            </button>
            
            <div className="day-selector">
              <span>Giorno</span>
              <select 
                value={currentDay} 
                onChange={(e) => setCurrentDay(parseInt(e.target.value))}
              >
                {availableDays.map(day => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
              <span>di {availableDays.length}</span>
            </div>
            
            <button 
              onClick={goToNextDay} 
              className="nav-button"
              disabled={availableDays.indexOf(currentDay) === availableDays.length - 1}
            >
              Giorno Successivo
            </button>
          </div>
        </div>
        
        <div className="day-content">
          <h2 className="day-title">
            <Calendar size={20} />
            Giorno {currentDay}
          </h2>
          
          {topicsForCurrentDay.length === 0 ? (
            <div className="empty-day">
              <Book size={36} strokeWidth={1} />
              <p>Nessun argomento pianificato per questo giorno.</p>
            </div>
          ) : (
            <div className="topics-list">
              {topicsForCurrentDay.map(topic => (
                <div 
                  key={topic.id} 
                  className={`topic-item ${topic.isCompleted ? 'completed' : ''}`}
                >
                  <div className="topic-header">
                    <div 
                      className="topic-checkbox" 
                      onClick={() => toggleTopicCompleted(topic.id, topic.isCompleted)}
                    >
                      {topic.isCompleted ? (
                        <CheckSquare size={20} className="checkbox-icon" />
                      ) : (
                        <Square size={20} className="checkbox-icon" />
                      )}
                    </div>
                    
                    <h3 className="topic-title">{topic.title}</h3>
                    
                    {topic.isCompleted ? (
                      <span className="completed-badge">Completato</span>
                    ) : null}
                  </div>
                  
                  {topic.description && (
                    <p className="topic-description">{topic.description}</p>
                  )}
                  
                  {topic.sources && topic.sources.length > 0 ? (
                    <div className="topic-sources">
                      <h4>Materiale di Studio:</h4>
                      <ul className="sources-list">
                        {topic.sources.map((source, idx) => (
                          <li key={idx} className={`source-item source-type-${source.type}`}>
                            {source.type === 'pdf_chunk' && source.webViewLink && (
                              <>
                                <FileText size={16} className="source-icon" />
                                <a 
                                  href={source.webViewLink} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="source-link"
                                >
                                  {source.chunkName || `Sezione PDF (p${source.pageStart}-${source.pageEnd})`}
                                </a>
                                {source.originalFileName && (
                                  <span className="source-origin">
                                    da: {source.originalFileName}
                                  </span>
                                )}
                              </>
                            )}
                            
                            {source.type === 'pdf_original' && source.webViewLink && (
                              <>
                                <FileText size={16} className="source-icon" />
                                <a 
                                  href={source.webViewLink} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="source-link"
                                >
                                  {source.name} <span className="source-note">(File Intero)</span>
                                </a>
                              </>
                            )}
                            
                            {source.type === 'web_link' && source.url && (
                              <>
                                <LinkIcon size={16} className="source-icon" />
                                <a 
                                  href={source.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="source-link"
                                >
                                  {source.title || source.url}
                                </a>
                              </>
                            )}
                            
                            {source.type === 'error_chunk' && (
                              <>
                                <AlertTriangle size={16} className="source-icon" />
                                <span className="source-error" title={source.error}>
                                  Errore creazione sezione: {source.name || 'N/D'} 
                                  {source.originalFileName && ` (da ${source.originalFileName})`}
                                </span>
                              </>
                            )}
                            
                            {source.type === 'note' && source.noteType === 'exam_simulation' && (
                              <>
                                <FileText size={16} className="source-icon" />
                                <span className="source-note exam-note">
                                  {source.description || 'Simulazione d\'esame - Nessun materiale specifico collegato.'}
                                </span>
                              </>
                            )}
                            
                            {source.type === 'note' && source.noteType === 'review' && (
                              <>
                                <BookOpen size={16} className="source-icon" />
                                <span className="source-note review-note">
                                  {source.description || 'Ripasso generale argomenti precedenti.'}
                                </span>
                              </>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="no-sources">Nessun materiale di studio specificato.</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="plan-footer">
          <button className="back-button" onClick={() => navigate('/projects')}>
            <ArrowLeft size={16} />
            Torna alla lista dei progetti
          </button>
          
          {/* Aggiungi qui altri pulsanti o azioni se necessario */}
        </div>
      </div>
    </div>
  );
};

export default StudyPlanViewer;