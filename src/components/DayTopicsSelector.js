import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../utils/firebase';
import NavBar from './NavBar';
import { 
  ArrowLeft, BookOpen, Calendar, Clock, Play, CheckCircle, AlertTriangle, Target, Zap, TrendingUp
} from 'lucide-react';
// 1. MODIFICA IMPORT: Importiamo gli stili come un oggetto 'styles'
import styles from './styles/DayTopicsSelector.module.css'; 
import SimpleLoading from './SimpleLoading';

const DayTopicsSelector = () => {
  const { projectId, dayNum } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [dayTopics, setDayTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ... (tutta la logica Javascript rimane invariata) ...
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
        const projectRef = doc(db, 'projects', projectId);
        const projectSnap = await getDoc(projectRef);
        if (!projectSnap.exists()) {
          throw new Error("Progetto non trovato.");
        }
        const projectData = projectSnap.data();
        setProject(projectData);
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
    if (!topic.isCompleted) {
        navigate(`/projects/${projectId}/study/${topic.id}`);
    }
  };

  const handleBackClick = () => {
    navigate(`/projects/${projectId}/plan`);
  };

  const calculateDayStats = () => {
    const totalTopics = dayTopics.length;
    const completedTopics = dayTopics.filter(t => t.isCompleted).length;
    const totalHours = dayTopics.reduce((sum, topic) => sum + (topic.estimatedHours || 0), 0);
    return {
      totalTopics,
      completedTopics,
      totalHours,
      completionPercentage: totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0
    };
  };

  if (loading) {
    return <SimpleLoading message="Caricamento argomenti del giorno..." />;
  }

  if (error) {
    return (
      // 2. MODIFICA className: usiamo l'oggetto 'styles'
      <div className={styles.dayTopicsContainer}>
        <NavBar />
        <div className={styles.dayTopicsContent}>
            <div className={styles.errorContainer}>
              <AlertTriangle size={48} />
              <h2>Errore nel Caricamento</h2>
              <p>{error}</p>
              <button onClick={handleBackClick} className={styles.backButton}>
                <ArrowLeft size={16} />
                Torna al piano
              </button>
            </div>
        </div>
      </div>
    );
  }

  const dayStats = calculateDayStats();

  return (
    <div className={styles.dayTopicsContainer}>
      <NavBar />
      
      <div className={styles.dayTopicsContent}>
        <header className={styles.dayTopicsHeader}>
          <button onClick={handleBackClick} className={styles.backButton}>
            <ArrowLeft size={16} />
            Torna al Piano
          </button>

          <div className={styles.dayInfo}>
            <div className={styles.dayTitleSection}>
              <Calendar size={32} />
              <h1>Giorno {dayNum}</h1>
              {project && (
                <span className={styles.projectName}>{project.title}</span>
              )}
            </div>

            <div className={styles.dayStatsCards}>
              <div className={styles.statCard}>
                <Target size={20} />
                <div>
                  <span className={styles.statNumber}>{dayStats.completedTopics}/{dayStats.totalTopics}</span>
                  <span className={styles.statLabel}>Argomenti</span>
                </div>
              </div>

              <div className={styles.statCard}>
                <Clock size={20} />
                <div>
                  <span className={styles.statNumber}>{dayStats.totalHours}h</span>
                  <span className={styles.statLabel}>Ore stimate</span>
                </div>
              </div>

              <div className={styles.statCard}>
                <TrendingUp size={20} />
                <div>
                  <span className={styles.statNumber}>{dayStats.completionPercentage}%</span>
                  <span className={styles.statLabel}>Progresso</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className={styles.topicsSection}>
          <div className={styles.sectionHeader}>
            <h2>Argomenti di Oggi</h2>
            <p>Seleziona un argomento per iniziare la tua sessione di studio.</p>
          </div>

          {dayTopics.length === 0 ? (
            <div className={styles.emptyState}>
              <BookOpen size={48} />
              <h3>Nessun argomento per oggi!</h3>
              <p>Goditi il tuo giorno libero o aggiungi nuovi argomenti dal piano di studio.</p>
            </div>
          ) : (
            <div className={styles.topicsGrid}>
              {dayTopics.map((topic, index) => (
                <div 
                  key={topic.id} 
                  // 3. MODIFICA className con condizioni
                  className={`${styles.topicCard} ${topic.isCompleted ? styles.completed : ''}`}
                  onClick={() => handleTopicClick(topic)}
                >
                  <div className={styles.topicCardHeader}>
                    <span className={styles.topicNumber}>#{index + 1}</span>
                    {topic.isCompleted && (
                        <div className={styles.topicStatusCompleted}>
                            <CheckCircle size={16} />
                            <span>Completato</span>
                        </div>
                    )}
                  </div>
                  
                  <h3 className={styles.topicTitle}>{topic.title}</h3>
                  
                  {topic.description && (
                    <p className={styles.topicDescription}>{topic.description}</p>
                  )}

                  <div className={styles.topicCardFooter}>
                    <div className={styles.topicMeta}>
                      {topic.estimatedHours > 0 && (
                        <div className={styles.metaItem}>
                          <Clock size={14} />
                          <span>{topic.estimatedHours}h stimate</span>
                        </div>
                      )}
                      {topic.totalPages > 0 && (
                        <div className={styles.metaItem}>
                          <BookOpen size={14} />
                          <span>{topic.totalPages} pagine</span>
                        </div>
                      )}
                    </div>

                    <button 
                      className={styles.studyButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/projects/${projectId}/study/${topic.id}`);
                      }}
                    >
                      <Play size={16} />
                      {topic.isCompleted ? 'Rivedi Argomento' : 'Inizia a Studiare'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default DayTopicsSelector;