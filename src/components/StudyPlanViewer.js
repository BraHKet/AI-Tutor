// src/components/StudyPlanViewer.jsx - Corrected Version
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../utils/firebase';
import NavBar from './NavBar';
import { 
  Loader, BookOpen, Calendar, AlertTriangle, ArrowLeft, Clock, Lock, CheckCircle
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
    // Un giorno è bloccato se almeno uno dei giorni precedenti non è completamente completato
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
        </div>
        
        {/* Vista a griglia dei giorni (corretta per mostrare solo gli argomenti) */}
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
                </div>
                
                <div className="day-card-content">
                  {/* Elenco degli argomenti */}
                  <div className="topics-preview">
                    {day.topics.slice(0, 3).map(topic => (
                      <div 
                        key={`preview-${topic.id}`} 
                        className="topic-preview"
                      >
                        {topic.isCompleted ? (
                          <CheckCircle size={16} color="#4CAF50" />
                        ) : (
                          <Circle size={16} color="#6c4ad0" />
                        )}
                        <h4 className={`topic-preview-title ${topic.isCompleted ? 'topic-preview-completed' : ''}`}>
                          {topic.title}
                        </h4>
                      </div>
                    ))}
                    
                    {day.topics.length > 3 && (
                      <div className="more-topics">
                        + altri {day.topics.length - 3} argomenti
                      </div>
                    )}
                  </div>
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

// Helper component for the Circle icon, since it's not imported
const Circle = ({ size, color }) => (
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