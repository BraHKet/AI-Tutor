// src/components/StudyPlanViewer.jsx - Versione Minimalista
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../utils/firebase';
import NavBar from './NavBar';
import { 
  Loader, BookOpen, Calendar, AlertTriangle, ArrowLeft, CheckCircle
} from 'lucide-react';
import './styles/StudyPlanViewer.css';
import SimpleLoading from './SimpleLoading';

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

  // --- RENDER CONDITIONALS ---

  if (loading) {
    return <SimpleLoading message="Caricamento piano di studio..." />;
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
            Torna ai progetti
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
            Torna ai progetti
          </button>
        </div>
      </div>
    );
  }

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
                <span>{project.examName}</span>
              </div>
              
              <div className="plan-detail">
                <Calendar size={16} />
                <span>{project.totalDays} giorni</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Vista a griglia dei giorni */}
        <div className="days-grid">
          {daysData.length === 0 ? (
            <div className="error-container">
              <AlertTriangle size={24} />
              <h2>Nessun piano trovato</h2>
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
                    <AlertTriangle size={24} />
                    <div className="day-card-lock-message">
                      Completa i giorni precedenti
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
                      <Calendar size={24} />
                      <p>Nessun argomento</p>
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
                              <span className="completed-badge">✓</span>
                            )}
                          </div>
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
            Torna ai progetti
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