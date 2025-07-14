// src/components/HomePage.js - VERSIONE FINALE CON WRAPPER E USER CARD

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../utils/firebase';
import useGoogleAuth from '../hooks/useGoogleAuth';
import NavBar from './NavBar';
import SimpleLoading from './SimpleLoading';
import { 
  Plus, BookOpen, CheckCircle, MessageSquare, ThumbsUp, Send, Frown, Meh, Smile, Star, Brain, LogIn, LogOut
} from 'lucide-react';
import styles from './styles/HomePage.module.css';

const HomePage = () => {
  const { user, logout } = useGoogleAuth();
  const navigate = useNavigate();

  const [feedbackRating, setFeedbackRating] = useState(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalProjects: 0,
    completedTopics: 0,
    totalTopics: 0
  });

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    const fetchStats = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const projectsRef = collection(db, "projects");
        const q = query(projectsRef, where("userId", "==", user.uid));
        const querySnapshot = await getDocs(q);
        const projects = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        let totalTopics = 0;
        let completedTopics = 0;
        for (const project of projects) {
          const topicsRef = collection(db, "projects", project.id, "topics");
          const topicsSnapshot = await getDocs(topicsRef);
          totalTopics += topicsSnapshot.size;
          completedTopics += topicsSnapshot.docs.filter(doc => doc.data().isCompleted).length;
        }
        setStats({ totalProjects: projects.length, completedTopics, totalTopics });
      } catch (err) {
        console.error("Error fetching stats:", err);
        setError("Impossibile caricare le tue statistiche.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, [user]);

  const submitFeedback = async () => {
    if (feedbackRating === null || feedbackSending) return;
    setFeedbackSending(true);
    try {
      await addDoc(collection(db, "feedback"), {
        userId: user?.uid,
        userEmail: user?.email,
        rating: feedbackRating,
        comment: feedbackText,
        createdAt: serverTimestamp()
      });
      setFeedbackSent(true);
      setTimeout(() => {
        setFeedbackSent(false);
        setFeedbackRating(null);
        setFeedbackText('');
      }, 5000);
    } catch (err) {
      console.error("Error submitting feedback:", err);
    } finally {
      setFeedbackSending(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const renderDashboardContent = () => {
    if (isLoading) {
      return <SimpleLoading message="Caricamento dashboard..." fullScreen={false} />;
    }
    if (error) {
      return <div className={styles.errorMessageFull}>{error}</div>;
    }
    return (
      <div className={styles.dashboardGrid}>
        <div className={`${styles.mainCard} ${styles.ctaCard}`} onClick={() => navigate('/create-project')}>
          <div className={styles.ctaIcon}><Plus size={32} /></div>
          <h2>Crea un nuovo piano</h2>
          <p>Trasforma un PDF nel tuo prossimo percorso di studio.</p>
          <div className={styles.ctaArrow}>→</div>
        </div>
        <div className={`${styles.mainCard} ${styles.statsCard}`}>
          <h3>Il Tuo Progresso</h3>
          <div className={styles.statsContainer}>
            <div className={styles.statItem}>
              <span className={styles.statValue}>{stats.totalProjects}</span>
              <span className={styles.statLabel}><BookOpen size={14}/> Piani Creati</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statValue}>{stats.completedTopics}</span>
              <span className={styles.statLabel}><CheckCircle size={14}/> Argomenti Completati</span>
            </div>
          </div>
          <button className={styles.secondaryButton} onClick={() => navigate('/projects')}>
            Vedi tutti i piani
          </button>
        </div>
        <div className={`${styles.mainCard} ${styles.feedbackCard}`}>
          {feedbackSent ? (
            <div className={styles.feedbackSuccess}>
              <div className={styles.successIcon}><ThumbsUp size={32}/></div>
              <h3>Grazie!</h3>
              <p>Il tuo contributo ci aiuta a migliorare.</p>
            </div>
          ) : (
            <>
              <h3>Lascia un Feedback <MessageSquare size={18}/></h3>
              <p>Come valuti la tua esperienza con AI Tutor?</p>
              <div className={styles.ratingButtons}>
                <button className={`${styles.ratingBtn} ${feedbackRating === 1 ? styles.active : ''}`} onClick={() => setFeedbackRating(1)} title="Insoddisfacente"><Frown size={20}/></button>
                <button className={`${styles.ratingBtn} ${feedbackRating === 2 ? styles.active : ''}`} onClick={() => setFeedbackRating(2)} title="Nella media"><Meh size={20}/></button>
                <button className={`${styles.ratingBtn} ${feedbackRating === 3 ? styles.active : ''}`} onClick={() => setFeedbackRating(3)} title="Buono"><Smile size={20}/></button>
                <button className={`${styles.ratingBtn} ${feedbackRating === 4 ? styles.active : ''}`} onClick={() => setFeedbackRating(4)} title="Ottimo"><ThumbsUp size={20}/></button>
                <button className={`${styles.ratingBtn} ${feedbackRating === 5 ? styles.active : ''}`} onClick={() => setFeedbackRating(5)} title="Eccellente"><Star size={20}/></button>
              </div>
              {feedbackRating && (
                <div className={styles.feedbackComment}>
                  <textarea 
                    placeholder="Dicci di più (opzionale)..."
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                  />
                  <button className={styles.submitFeedbackBtn} onClick={submitFeedback} disabled={feedbackSending}>
                    {feedbackSending ? <div className={styles.loader}></div> : <Send size={16}/>}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  if (!user && !isLoading) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.unauthenticatedContainer}>
          <NavBar />
          <div className={styles.unauthenticatedView}>
            <div className={styles.unauthenticatedContent}>
              <div className={styles.unauthenticatedIcon}><Brain size={48} /></div>
              <h1>Benvenuto in AI Tutor</h1>
              <p>Il tuo assistente personale per trasformare documenti in percorsi di studio efficaci. Accedi per iniziare.</p>
              <button className={styles.loginCtaBtn} onClick={() => navigate('/')}>
                <LogIn size={20} />
                <span>Accedi con Google</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.homePageContainer}>
        <NavBar />
        <main className={styles.mainContent}>
          <header className={styles.homeHeader}>
            <div className={styles.headerWelcome}>
              <h1>Bentornato, {user?.displayName?.split(' ')[0] || 'Studente'}!</h1>
              <p>Pronto a conquistare il tuo prossimo esame?</p>
            </div>
            <div className={styles.userCard}>
              <img src={user?.photoURL} alt="User Avatar" className={styles.userAvatar} />
              <div className={styles.userInfo}>
                <span className={styles.userName}>{user?.displayName}</span>
                <span className={styles.userEmail}>{user?.email}</span>
              </div>
              <button className={styles.logoutButton} onClick={handleLogout} title="Logout">
                <LogOut size={16} />
              </button>
            </div>
          </header>
          {renderDashboardContent()}
        </main>
      </div>
    </div>
  );
};

export default HomePage;