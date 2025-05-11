// src/components/HomePage.js
import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../utils/firebase';
import useGoogleAuth from '../hooks/useGoogleAuth';
import NavBar from './NavBar';
import { 
  BookOpen, 
  Calendar, 
  Clock, 
  Award, 
  CheckCircle, 
  BarChart2, 
  Smile, 
  Meh, 
  Frown, 
  ThumbsUp,
  Send,
  MessageSquare
} from 'lucide-react';
import './styles/HomePage.css';

const HomePage = () => {
  const { user } = useGoogleAuth();
  const [stats, setStats] = useState({
    totalProjects: 0,
    completedTopics: 0,
    totalTopics: 0,
    averageProgressPercent: 0,
    daysStudied: 0,
    oldestProjectDate: null,
    topicProgressByDay: {}
  });
  const [loading, setLoading] = useState(true);
  const [feedbackRating, setFeedbackRating] = useState(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackSending, setFeedbackSending] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchUserStats = async () => {
      try {
        setLoading(true);
        // Query per ottenere tutti i progetti dell'utente
        const projectsRef = collection(db, "projects");
        const q = query(projectsRef, where("userId", "==", user.uid));
        const querySnapshot = await getDocs(q);
        
        const projects = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || new Date()
        }));

        // Inizializza le statistiche
        let totalTopics = 0;
        let completedTopics = 0;
        let oldestDate = new Date();
        const topicProgressByDay = {};
        
        // Per ogni progetto, carica gli argomenti associati
        for (const project of projects) {
          if (project.createdAt < oldestDate) {
            oldestDate = project.createdAt;
          }

          // Carica gli argomenti del progetto
          const topicsRef = collection(db, "projects", project.id, "topics");
          const topicsSnapshot = await getDocs(topicsRef);
          
          const topics = topicsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          totalTopics += topics.length;
          
          // Conta gli argomenti completati
          const completed = topics.filter(topic => topic.isCompleted).length;
          completedTopics += completed;
          
          // Raggruppa gli argomenti per giorno
          topics.forEach(topic => {
            const day = topic.assignedDay;
            if (!topicProgressByDay[day]) {
              topicProgressByDay[day] = {
                total: 0,
                completed: 0
              };
            }
            
            topicProgressByDay[day].total += 1;
            if (topic.isCompleted) {
              topicProgressByDay[day].completed += 1;
            }
          });
        }

        // Calcola la percentuale media di completamento
        const averageProgressPercent = totalTopics > 0 
          ? Math.round((completedTopics / totalTopics) * 100) 
          : 0;
        
        // Calcola il numero di giorni studiati (giorni con almeno un argomento completato)
        const daysStudied = Object.values(topicProgressByDay)
          .filter(day => day.completed > 0)
          .length;

        setStats({
          totalProjects: projects.length,
          completedTopics,
          totalTopics,
          averageProgressPercent,
          daysStudied,
          oldestProjectDate: oldestDate !== new Date() ? oldestDate : null,
          topicProgressByDay
        });
        
        setLoading(false);
      } catch (error) {
        console.error("Error fetching user stats:", error);
        setLoading(false);
      }
    };

    fetchUserStats();
  }, [user]);

  const handleFeedbackRating = (rating) => {
    setFeedbackRating(rating);
  };

  const submitFeedback = async () => {
    if (feedbackRating === null) return;
    
    try {
      setFeedbackSending(true);
      
      // Aggiungi il feedback alla collezione "feedback" in Firestore
      await addDoc(collection(db, "feedback"), {
        userId: user?.uid || "anonymous",
        userEmail: user?.email || "anonymous",
        rating: feedbackRating,
        comment: feedbackText,
        createdAt: serverTimestamp()
      });
      
      setFeedbackSent(true);
      setFeedbackSending(false);
      setFeedbackText('');
      
      // Resetta il feedback dopo 5 secondi
      setTimeout(() => {
        setFeedbackSent(false);
        setFeedbackRating(null);
      }, 5000);
      
    } catch (error) {
      console.error("Error submitting feedback:", error);
      setFeedbackSending(false);
    }
  };

  const daysSinceFirstProject = () => {
    if (!stats.oldestProjectDate) return 0;
    
    const now = new Date();
    const diffTime = Math.abs(now - stats.oldestProjectDate);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="home-page-container">
      <NavBar />
      
      <div className="home-content">
        {/* Sezione di feedback in alto */}
        <section className="feedback-section">
          <h2 className="section-title">
            <MessageSquare size={22} />
            <span>Il tuo Feedback</span>
          </h2>
          
          {feedbackSent ? (
            <div className="feedback-success">
              <CheckCircle size={32} />
              <h3>Grazie per il tuo feedback!</h3>
              <p>Il tuo contributo è importante per migliorare la piattaforma.</p>
            </div>
          ) : (
            <div className="feedback-form">
              <div className="feedback-intro">
                <p>Ciao <strong>{user?.displayName || 'Studente'}</strong>! La tua opinione è preziosa! Aiutaci a migliorare AI Tutor con il tuo feedback.</p>
              </div>
              
              <div className="feedback-rating">
                <h3>Come valuti la tua esperienza?</h3>
                <div className="rating-buttons">
                  <button 
                    className={`rating-btn ${feedbackRating === 1 ? 'active negative' : ''}`}
                    onClick={() => handleFeedbackRating(1)}
                  >
                    <Frown size={28} />
                    <span>Non soddisfatto</span>
                  </button>
                  
                  <button 
                    className={`rating-btn ${feedbackRating === 2 ? 'active neutral' : ''}`}
                    onClick={() => handleFeedbackRating(2)}
                  >
                    <Meh size={28} />
                    <span>Nella media</span>
                  </button>
                  
                  <button 
                    className={`rating-btn ${feedbackRating === 3 ? 'active good' : ''}`}
                    onClick={() => handleFeedbackRating(3)}
                  >
                    <ThumbsUp size={28} />
                    <span>Abbastanza buono</span>
                  </button>
                  
                  <button 
                    className={`rating-btn ${feedbackRating === 4 ? 'active positive' : ''}`}
                    onClick={() => handleFeedbackRating(4)}
                  >
                    <Smile size={28} />
                    <span>Molto soddisfatto</span>
                  </button>
                </div>
              </div>
              
              <div className="feedback-comment">
                <h3>Dettagli (opzionale)</h3>
                <textarea 
                  placeholder="Condividi i tuoi suggerimenti o commenti per aiutarci a migliorare..."
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  rows="4"
                ></textarea>
                
                <button 
                  className="submit-feedback-btn" 
                  onClick={submitFeedback}
                  disabled={feedbackRating === null || feedbackSending}
                >
                  {feedbackSending ? (
                    <span className="sending-indicator">Invio in corso...</span>
                  ) : (
                    <>
                      <Send size={16} />
                      <span>Invia Feedback</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </section>
        
        {/* Statistiche sotto */}
        <section className="stats-section">
          <h2 className="section-title">
            <BarChart2 size={22} />
            <span>Le tue Statistiche</span>
          </h2>
          
          <div className="stats-cards">
            <div className="stat-card">
              <div className="stat-icon">
                <BookOpen size={24} />
              </div>
              <div className="stat-content">
                <h3>Progetti</h3>
                <p className="stat-value">{stats.totalProjects}</p>
                <p className="stat-desc">Progetti di studio creati</p>
              </div>
            </div>
            
            <div className="stat-card">
              <div className="stat-icon">
                <CheckCircle size={24} />
              </div>
              <div className="stat-content">
                <h3>Argomenti Completati</h3>
                <p className="stat-value">{stats.completedTopics} <span className="stat-total">/ {stats.totalTopics}</span></p>
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${stats.averageProgressPercent}%` }}
                  ></div>
                </div>
              </div>
            </div>
            
            <div className="stat-card">
              <div className="stat-icon">
                <Calendar size={24} />
              </div>
              <div className="stat-content">
                <h3>Giorni di Studio</h3>
                <p className="stat-value">{stats.daysStudied}</p>
                <p className="stat-desc">Giorni con argomenti completati</p>
              </div>
            </div>
            
            <div className="stat-card">
              <div className="stat-icon">
                <Clock size={24} />
              </div>
              <div className="stat-content">
                <h3>Tempo Totale</h3>
                <p className="stat-value">{daysSinceFirstProject()}</p>
                <p className="stat-desc">Giorni dal primo progetto</p>
              </div>
            </div>
          </div>
          
          {stats.totalProjects > 0 && (
            <div className="progress-visualization">
              <h3 className="progress-title">Progressi per Giorno</h3>
              <div className="day-progress-grid">
                {Object.entries(stats.topicProgressByDay)
                  .sort(([dayA], [dayB]) => parseInt(dayA) - parseInt(dayB))
                  .map(([day, progress]) => {
                    const progressPercent = progress.total > 0 
                      ? Math.round((progress.completed / progress.total) * 100) 
                      : 0;
                    
                    return (
                      <div key={`day-${day}`} className="day-progress-card">
                        <div className="day-header">
                          <span>Giorno {day}</span>
                          <span className="day-completion">{progress.completed}/{progress.total}</span>
                        </div>
                        <div className="day-progress-bar">
                          <div 
                            className="day-progress-fill" 
                            style={{ width: `${progressPercent}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default HomePage;