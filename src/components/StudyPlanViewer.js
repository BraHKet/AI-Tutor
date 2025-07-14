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

  const handleTopicClick = (topicId) => {
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
    <div className={styles.wrapper}> 
      <div className={styles.studyPlanContainer}>
        <NavBar />
        <div className={styles.contentWrapper}>
          <header className={styles.studyPlanHeader}>
              <h1>{project?.title || 'Piano di Studio'}</h1>
              <p className={styles.planSubtitle}>Il tuo percorso personalizzato verso il successo. Un passo alla volta.</p>
          </header>
          
          <div className={styles.daysGrid}>
            {daysData.map((day, index) => (
              <div 
                key={`day-${day.day}`}
                // L'onClick è stato rimosso da questa card principale
                className={`${styles.dayCard} ${styles[`gradient${(index % 4) + 1}`]}`}
              >
                <div className={styles.cardPattern}></div>
                <div className={styles.cardGlow}></div>
                <div className={styles.cardContent}>
                  
                  <div className={styles.dayIdentity}>
                    <span className={styles.dayLabel}>GIORNO</span>
                    <span className={styles.dayNumber}>{day.day}</span>
                  </div>

                  <div className={styles.topicsContainer}>
                    {day.topics.length > 0 ? (
                      day.topics.map(topic => (
                        // L'onClick è stato aggiunto a questo elemento, che rappresenta il singolo argomento
                        <div 
                          key={topic.id} 
                          className={styles.topicEntry}
                          onClick={() => handleTopicClick(topic.id)}
                        >
                          <div className={styles.topicIndicator}></div>
                          {/* Aggiunto l'attributo 'title' per vedere il testo completo in hover */}
                          <p className={styles.topicTitle} title={topic.title}>{topic.title}</p>
                        </div>
                      ))
                    ) : (
                      <div className={styles.emptyDayMessage}>
                        <Coffee size={28} />
                        <span>Giorno di Riposo</span>
                      </div>
                    )}
                  </div>

                  {/* Questa è la parte finale della card, che include la barra di progresso */}
                  <div className={styles.cardBottom}>
                    <span className={styles.progressText}>
                      {day.completedCount} di {day.topicsCount} argomenti
                    </span>
                    <div className={styles.progressBar}>
                      <div 
                        className={styles.progressFill}
                        style={{ width: day.topicsCount > 0 ? `${(day.completedCount / day.topicsCount) * 100}%` : '0%' }}
                      ></div>
                    </div>
                  </div>

                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudyPlanViewer;