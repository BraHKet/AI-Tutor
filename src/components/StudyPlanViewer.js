import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../utils/firebase';
import NavBar from './NavBar';
// Importa le icone necessarie, inclusa la nuova 'Check'
import { 
  BookOpen, Calendar, AlertTriangle, ArrowLeft, CheckCircle, Lock, ChevronRight, Check, Coffee
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
            isLocked: false // MODIFICA: Tutti i giorni sono sempre sbloccati
        };
    });
    
    setDaysData(daysArray);
  };

  const handleTopicClick = (topicId, isDayLocked, isCompleted) => {
    // MODIFICA: Permetti sempre il click su tutti gli argomenti (anche completati per rivedere)
    navigate(`/projects/${projectId}/topic/${topicId}`);
  };

  if (loading) {
    return <SimpleLoading message="Sto preparando il tuo piano di studio..." />;
  }
  
  if (error) {
    return (
      <div className={styles.studyPlanContainer}>
        <NavBar />
        <div className={styles.contentWrapper}>
            <div className={styles.errorContainer}>
              <AlertTriangle size={48} className="mx-auto" />
              <h2>Oops! Qualcosa è andato storto.</h2>
              <p>{error}</p>
              <button onClick={() => navigate('/projects')} className={styles.backButton}>
                <ArrowLeft size={18} />
                Torna ai Miei Progetti
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
            <h1>{project?.title || 'Piano di Studio'}</h1>
            <p className={styles.planSubtitle}>Il tuo percorso personalizzato verso il successo. Un passo alla volta.</p>
        </header>
        
        <div className={styles.daysGrid}>
          {daysData.map(day => (
            <div 
              key={`day-${day.day}`} 
              className={`${styles.dayCard}`}
            >
              {/* MODIFICA: Rimosso completamente il lockOverlay */}
              
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
                    <Coffee size={24} />
                    <p>Giorno di riposo. Ricarica le energie!</p>
                  </div>
                ) : (
                  <ul className={styles.topicsList}>
                    {day.topics.map(topic => (
                      <li 
                        key={topic.id} 
                        className={`${styles.topicItem} ${topic.isCompleted ? styles.completed : ''}`}
                        onClick={() => handleTopicClick(topic.id, day.isLocked, topic.isCompleted)}
                        title={topic.isCompleted ? "Completato - clicca per rivedere" : "Clicca per studiare"}
                      >
                        <span className={styles.topicTitle}>{topic.title}</span>
                        {/* MODIFICA: Mostra un'icona diversa se l'argomento è completato */}
                        {topic.isCompleted ? (
                           <Check size={20} className={styles.topicIcon} />
                        ) : (
                           <ChevronRight size={20} className={styles.topicIcon} />
                        )}
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
                      Progresso: {day.completedCount} di {day.topicsCount} argomenti
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