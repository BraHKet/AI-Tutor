import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../utils/firebase';
import NavBar from './NavBar';
import { 
  BookOpen, Calendar, AlertTriangle, ArrowLeft, CheckCircle, Lock, ChevronRight
} from 'lucide-react';
// Importa gli stili come un oggetto 'styles' usando CSS Modules
import styles from './styles/StudyPlanViewer.module.css';
import SimpleLoading from './SimpleLoading';

const StudyPlanViewer = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [daysData, setDaysData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
        const projectRef = doc(db, 'projects', projectId);
        const projectSnap = await getDoc(projectRef);

        if (!projectSnap.exists()) {
          throw new Error("Progetto non trovato.");
        }
        
        const projectData = projectSnap.data();
        setProject(projectData);
        
        const topicsRef = collection(db, 'projects', projectId, 'topics');
        const q = query(topicsRef, orderBy("assignedDay"), orderBy("orderInDay"));
        const topicsSnap = await getDocs(q);

        const topicsData = topicsSnap.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        }));
        
        processDaysData(topicsData, projectData.totalDays);

      } catch (err) {
        console.error("StudyPlanViewer: Error fetching study plan:", err);
        setError("Impossibile caricare i dati del piano di studio: " + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPlanData();
  }, [projectId]);

  const processDaysData = (topicsData, totalProjectDays) => {
    const topicsByDay = topicsData.reduce((acc, topic) => {
      const day = topic.assignedDay;
      if (!acc[day]) {
        acc[day] = [];
      }
      acc[day].push(topic);
      return acc;
    }, {});
    
    // Crea un array per tutti i giorni del progetto, anche quelli vuoti
    const daysArray = Array.from({ length: totalProjectDays }, (_, i) => {
        const dayNum = i + 1;
        const dayTopics = topicsByDay[dayNum] || [];
        const completedTopics = dayTopics.filter(t => t.isCompleted);
        
        return {
            day: dayNum,
            topics: dayTopics,
            topicsCount: dayTopics.length,
            completedCount: completedTopics.length,
            isFullyCompleted: dayTopics.length > 0 && completedTopics.length === dayTopics.length,
        };
    });

    let previousDayCompleted = true;
    const daysWithLockStatus = daysArray.map(day => {
        // Un giorno è bloccato se un giorno precedente con argomenti non è stato completato
        const isLocked = !previousDayCompleted;
        // Aggiorna lo stato per il giorno successivo. Se il giorno corrente non è completo e ha argomenti, i successivi saranno bloccati.
        if (!day.isFullyCompleted && day.topics.length > 0) {
            previousDayCompleted = false;
        }
        return { ...day, isLocked };
    });
    
    setDaysData(daysWithLockStatus);
  };

  // Funzione per navigare alla pagina del singolo argomento
  const handleTopicClick = (topicId, isDayLocked) => {
    if (isDayLocked) return;
    navigate(`/projects/${projectId}/topic/${topicId}`);
  };

  if (loading) {
    return <SimpleLoading message="Caricamento piano di studio..." />;
  }
  
  if (error) {
    return (
      <div className={styles.studyPlanContainer}>
        <NavBar />
        <div className={styles.contentWrapper}>
            <div className={styles.errorContainer}>
              <AlertTriangle size={48} />
              <h2>Errore nel Caricamento</h2>
              <p>{error}</p>
              <button onClick={() => navigate('/projects')} className={styles.backButton}>
                <ArrowLeft size={16} />
                Torna ai progetti
              </button>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.studyPlanContainer}>
      <NavBar />
      <div className={styles.contentWrapper}>
        <header className={styles.studyPlanHeader}>
            <h1>{project.title}</h1>
            <p className={styles.planSubtitle}>Il tuo percorso personalizzato verso il successo.</p>
        </header>
        
        <div className={styles.daysGrid}>
          {daysData.map(day => (
            <div 
              key={`day-${day.day}`} 
              className={`${styles.dayCard} ${day.isLocked ? styles.locked : ''}`}
            >
              {day.isLocked && (
                <div className={styles.lockOverlay}>
                  <Lock size={20} />
                  <span>Completa i giorni precedenti per sbloccare</span>
                </div>
              )}
              
              <div className={styles.dayCardHeader}>
                <h3>Giorno {day.day}</h3>
                {day.isFullyCompleted && (
                  <div className={styles.completedBadge}>
                    <CheckCircle size={14} />
                    <span>Completato</span>
                  </div>
                )}
              </div>
              
              <div className={styles.dayCardContent}>
                {day.topics.length === 0 ? (
                  <div className={styles.emptyDayMessage}>
                    <p>Nessun argomento per oggi. Riposo!</p>
                  </div>
                ) : (
                  <ul className={styles.topicsList}>
                    {day.topics.map(topic => (
                      <li 
                        key={topic.id} 
                        className={`${styles.topicItem} ${topic.isCompleted ? styles.completed : ''}`}
                        onClick={() => handleTopicClick(topic.id, day.isLocked)}
                      >
                        <span className={styles.topicTitle}>{topic.title}</span>
                        <ChevronRight size={18} className={styles.topicArrow} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              
              {day.topics.length > 0 && (
                <div className={styles.dayCardFooter}>
                   <div className={styles.progressBar}>
                      <div 
                          className={styles.progressFill}
                          style={{ width: `${(day.completedCount / day.topicsCount) * 100}%` }}
                      ></div>
                   </div>
                   <span className={styles.progressText}>
                      {day.completedCount} di {day.topicsCount} completati
                   </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StudyPlanViewer;