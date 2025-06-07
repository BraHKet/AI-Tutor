// src/components/DayTopicsSelector.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../utils/firebase';
import NavBar from './NavBar';
import { 
  ArrowLeft, BookOpen, Calendar, Clock, Play, CheckCircle, AlertTriangle, Target, Zap
} from 'lucide-react';
import './styles/DayTopicsSelector.css';
import SimpleLoading from './SimpleLoading';

const DayTopicsSelector = () => {
  const { projectId, dayNum } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [dayTopics, setDayTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDayData = async () => {
      if (!projectId || !dayNum) {
        setError("Parametri mancanti nella URL.");
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
          throw new Error("Progetto non trovato.");
        }

        const projectData = projectSnap.data();
        setProject(projectData);

        // Fetch topics for this specific day
        const topicsRef = collection(db, 'projects', projectId, 'topics');
        const q = query(
          topicsRef, 
          where("assignedDay", "==", parseInt(dayNum)),
          orderBy("orderInDay")
        );
        const topicsSnap = await getDocs(q);

        const topicsData = topicsSnap.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        }));

        setDayTopics(topicsData);

      } catch (err) {
        console.error("DayTopicsSelector: Error fetching data:", err);
        setError("Impossibile caricare i dati: " + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDayData();
  }, [projectId, dayNum]);

  const handleTopicClick = (topic) => {
    // Naviga alla sessione di studio per questo argomento
    navigate(`/projects/${projectId}/study/${topic.id}`);
  };

  const handleBackClick = () => {
    navigate(`/projects/${projectId}/plan`);
  };

  // Calcola statistiche del giorno
  const calculateDayStats = () => {
    const totalTopics = dayTopics.length;
    const completedTopics = dayTopics.filter(t => t.isCompleted).length;
    const totalHours = dayTopics.reduce((sum, topic) => sum + (topic.estimatedHours || 0), 0);
    const completedHours = dayTopics
      .filter(t => t.isCompleted)
      .reduce((sum, topic) => sum + (topic.estimatedHours || 0), 0);

    return {
      totalTopics,
      completedTopics,
      totalHours,
      completedHours,
      completionPercentage: totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0
    };
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getPriorityLabel = (priority) => {
    switch (priority) {
      case 'high': return 'Alta';
      case 'medium': return 'Media';
      case 'low': return 'Bassa';
      default: return 'Standard';
    }
  };

  // --- RENDER CONDITIONALS ---

  if (loading) {
    return <SimpleLoading message="Caricamento argomenti del giorno..." />;
  }

  if (error) {
    return (
      <div className="day-topics-container">
        <NavBar />
        <div className="error-container">
          <AlertTriangle size={36} />
          <h2>Errore nel Caricamento</h2>
          <p>{error}</p>
          <button onClick={handleBackClick} className="back-button">
            <ArrowLeft size={16} />
            Torna al piano
          </button>
        </div>
      </div>
    );
  }

  const dayStats = calculateDayStats();

  return (
    <div className="day-topics-container">
      <NavBar />
      
      <div className="day-topics-content">
        {/* Header con informazioni del giorno */}
        <div className="day-topics-header">
          <button onClick={handleBackClick} className="back-button">
            <ArrowLeft size={20} />
            Torna al Piano
          </button>

          <div className="day-info">
            <div className="day-title-section">
              <Calendar size={24} />
              <h1>Giorno {dayNum}</h1>
              {project && (
                <span className="project-name">{project.title}</span>
              )}
            </div>

            <div className="day-stats-cards">
              <div className="stat-card">
                <Target size={20} />
                <div>
                  <span className="stat-number">{dayStats.completedTopics}/{dayStats.totalTopics}</span>
                  <span className="stat-label">Argomenti completati</span>
                </div>
              </div>

              <div className="stat-card">
                <Clock size={20} />
                <div>
                  <span className="stat-number">{dayStats.completedHours}/{dayStats.totalHours}h</span>
                  <span className="stat-label">Ore di studio</span>
                </div>
              </div>

              <div className="stat-card">
                <Zap size={20} />
                <div>
                  <span className="stat-number">{dayStats.completionPercentage}%</span>
                  <span className="stat-label">Progresso</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Lista degli argomenti */}
        <div className="topics-section">
          <div className="section-header">
            <h2>Scegli l'argomento da studiare</h2>
            <p>Clicca su un argomento per iniziare la sessione di studio</p>
          </div>

          {dayTopics.length === 0 ? (
            <div className="empty-state">
              <BookOpen size={48} />
              <h3>Nessun argomento pianificato</h3>
              <p>Non ci sono argomenti assegnati a questo giorno.</p>
            </div>
          ) : (
            <div className="topics-grid">
              {dayTopics.map((topic, index) => (
                <div 
                  key={topic.id} 
                  className={`topic-card ${topic.isCompleted ? 'completed' : ''}`}
                  onClick={() => handleTopicClick(topic)}
                >
                  <div className="topic-card-header">
                    <div className="topic-status">
                      {topic.isCompleted ? (
                        <CheckCircle size={24} className="status-icon completed" />
                      ) : (
                        <div className="status-icon pending">
                          <span>{index + 1}</span>
                        </div>
                      )}
                    </div>

                    <div className="topic-priority" style={{ backgroundColor: getPriorityColor(topic.priority) }}>
                      {getPriorityLabel(topic.priority)}
                    </div>
                  </div>

                  <div className="topic-card-content">
                    <h3 className="topic-title">{topic.title}</h3>
                    
                    {topic.description && (
                      <p className="topic-description">{topic.description}</p>
                    )}

                    <div className="topic-meta">
                      {topic.estimatedHours && (
                        <div className="meta-item">
                          <Clock size={16} />
                          <span>{topic.estimatedHours} ore</span>
                        </div>
                      )}

                      {topic.totalPages && (
                        <div className="meta-item">
                          <BookOpen size={16} />
                          <span>{topic.totalPages} pagine</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="topic-card-footer">
                    <button 
                      className="study-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTopicClick(topic);
                      }}
                    >
                      <Play size={16} />
                      {topic.isCompleted ? 'Rivedi' : 'Studia'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DayTopicsSelector;