// src/components/HomePage.js - Versione Minimal e Moderna
import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../utils/firebase';
import useGoogleAuth from '../hooks/useGoogleAuth';
import NavBar from './NavBar';
import { 
  BookOpen, 
  Calendar, 
  CheckCircle, 
  Smile, 
  Meh, 
  Frown, 
  ThumbsUp,
  Send,
  MessageSquare,
  Star,
  FileText,
  Target,
  Zap,
  Brain,
  Users,
  ArrowRight,
  Lightbulb,
  Play,
  Download
} from 'lucide-react';
import './styles/HomePage.css';

const HomePage = () => {
  const { user } = useGoogleAuth();
  
  // Stato per feedback
  const [feedbackRating, setFeedbackRating] = useState(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackSending, setFeedbackSending] = useState(false);

  // Statistiche base semplici
  const [basicStats, setBasicStats] = useState({
    totalProjects: 0,
    completedTopics: 0,
    totalTopics: 0
  });

  useEffect(() => {
    if (!user) return;

    const fetchBasicStats = async () => {
      try {
        const projectsRef = collection(db, "projects");
        const q = query(projectsRef, where("userId", "==", user.uid));
        const querySnapshot = await getDocs(q);
        
        const projects = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        let totalTopics = 0;
        let completedTopics = 0;
        
        for (const project of projects) {
          const topicsRef = collection(db, "projects", project.id, "topics");
          const topicsSnapshot = await getDocs(topicsRef);
          
          const topics = topicsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          totalTopics += topics.length;
          completedTopics += topics.filter(topic => topic.isCompleted).length;
        }

        setBasicStats({
          totalProjects: projects.length,
          completedTopics,
          totalTopics
        });
        
      } catch (error) {
        console.error("Error fetching stats:", error);
      }
    };

    fetchBasicStats();
  }, [user]);

  const handleFeedbackRating = (rating) => {
    setFeedbackRating(rating);
  };

  const submitFeedback = async () => {
    if (feedbackRating === null) return;
    
    try {
      setFeedbackSending(true);
      
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
      
      setTimeout(() => {
        setFeedbackSent(false);
        setFeedbackRating(null);
      }, 5000);
      
    } catch (error) {
      console.error("Error submitting feedback:", error);
      setFeedbackSending(false);
    }
  };

  return (
    <div className="home-page-container">
      <NavBar />
      
      <div className="home-content">
        {/* Hero Section */}
        <section className="hero-section">
          <div className="hero-content">
            <h1>Ciao {user?.displayName?.split(' ')[0] || 'Studente'}!</h1>
            <p className="hero-subtitle">Trasforma i tuoi PDF in piani di studio intelligenti</p>
            
            {basicStats.totalProjects > 0 && (
              <div className="quick-stats">
                <div className="stat-item">
                  <BookOpen size={16} />
                  <span>{basicStats.totalProjects} Piani</span>
                </div>
                <div className="stat-item">
                  <CheckCircle size={16} />
                  <span>{basicStats.completedTopics}/{basicStats.totalTopics} Completati</span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Feedback Section */}
        <section className="feedback-section">
          <div className="feedback-header">
            <MessageSquare size={20} />
            <h2>Il tuo Feedback</h2>
          </div>
          
          {feedbackSent ? (
            <div className="feedback-success">
              <div className="success-icon">
                <CheckCircle size={32} />
              </div>
              <div className="success-content">
                <h3>Grazie per il feedback!</h3>
                <p>Il tuo contributo ci aiuta a migliorare l'esperienza di studio.</p>
              </div>
            </div>
          ) : (
            <div className="feedback-form">
              <p className="feedback-intro">
                Come valuti la tua esperienza con AI Tutor?
              </p>
              
              <div className="feedback-rating">
                <div className="rating-buttons">
                  <button 
                    className={`rating-btn ${feedbackRating === 1 ? 'active negative' : ''}`}
                    onClick={() => handleFeedbackRating(1)}
                  >
                    <Frown size={24} />
                    <span>Insoddisfacente</span>
                  </button>
                  
                  <button 
                    className={`rating-btn ${feedbackRating === 2 ? 'active neutral' : ''}`}
                    onClick={() => handleFeedbackRating(2)}
                  >
                    <Meh size={24} />
                    <span>Nella media</span>
                  </button>
                  
                  <button 
                    className={`rating-btn ${feedbackRating === 3 ? 'active good' : ''}`}
                    onClick={() => handleFeedbackRating(3)}
                  >
                    <ThumbsUp size={24} />
                    <span>Buono</span>
                  </button>
                  
                  <button 
                    className={`rating-btn ${feedbackRating === 4 ? 'active positive' : ''}`}
                    onClick={() => handleFeedbackRating(4)}
                  >
                    <Smile size={24} />
                    <span>Ottimo</span>
                  </button>

                  <button 
                    className={`rating-btn ${feedbackRating === 5 ? 'active excellent' : ''}`}
                    onClick={() => handleFeedbackRating(5)}
                  >
                    <Star size={24} />
                    <span>Eccellente</span>
                  </button>
                </div>
              </div>
              
              {feedbackRating && (
                <div className="feedback-comment">
                  <textarea 
                    placeholder="Condividi i tuoi suggerimenti (opzionale)..."
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    rows="3"
                  ></textarea>
                  
                  <button 
                    className="submit-feedback-btn" 
                    onClick={submitFeedback}
                    disabled={feedbackSending}
                  >
                    {feedbackSending ? (
                      <span className="sending-indicator">Invio...</span>
                    ) : (
                      <>
                        <Send size={16} />
                        <span>Invia Feedback</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
        
        {/* Come Funziona Section */}
        <section className="how-it-works-section">
          <div className="section-header">
            <Brain size={24} />
            <h2>Come Funziona AI Tutor</h2>
            <p>Un sistema intelligente per ottimizzare il tuo studio</p>
          </div>

          <div className="workflow-steps">
            <div className="step-card">
              <div className="step-number">1</div>
              <div className="step-icon">
                <FileText size={24} />
              </div>
              <h3>Carica PDF</h3>
              <p>Inizia con <strong>un solo PDF</strong> del tuo materiale di studio. L'AI analizzerà il contenuto per identificare automaticamente gli argomenti.</p>
            </div>

            <div className="step-arrow">
              <ArrowRight size={20} />
            </div>

            <div className="step-card">
              <div className="step-number">2</div>
              <div className="step-icon">
                <Brain size={24} />
              </div>
              <h3>Analisi AI</h3>
              <p>L'intelligenza artificiale divide automaticamente il materiale in argomenti e li distribuisce nei giorni di studio disponibili.</p>
            </div>

            <div className="step-arrow">
              <ArrowRight size={20} />
            </div>

            <div className="step-card">
              <div className="step-number">3</div>
              <div className="step-icon">
                <Target size={24} />
              </div>
              <h3>Personalizza</h3>
              <p><strong>Verifica e seleziona</strong> le parti specifiche del PDF per ogni argomento. Riorganizza gli argomenti nei giorni come preferisci.</p>
            </div>

            <div className="step-arrow">
              <ArrowRight size={20} />
            </div>

            <div className="step-card">
              <div className="step-number">4</div>
              <div className="step-icon">
                <Play size={24} />
              </div>
              <h3>Studia</h3>
              <p>Accedi alle sezioni PDF per ogni giorno, sottolinea, stampa, aggiungi approfondimenti e interagisci con l'AI per chiarimenti.</p>
            </div>
          </div>
        </section>

        {/* Funzionalità Section */}
        <section className="features-section">
          <h2>Cosa Puoi Fare</h2>
          
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon study">
                <BookOpen size={24} />
              </div>
              <h3>Studio Mirato</h3>
              <p>Accedi solo alle pagine specifiche per ogni argomento, senza distrazioni dal resto del materiale.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon organize">
                <Calendar size={24} />
              </div>
              <h3>Organizzazione Flessibile</h3>
              <p>Sposta gli argomenti tra i giorni e riorganizza il piano secondo le tue esigenze e scadenze.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon interact">
                <MessageSquare size={24} />
              </div>
              <h3>AI Interattiva</h3>
              <p>Chiedi chiarimenti all'AI, fatti interrogare sugli argomenti e ricevi feedback personalizzato.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon tools">
                <Zap size={24} />
              </div>
              <h3>Strumenti Avanzati</h3>
              <p>Sottolinea, stampa, aggiungi note e approfondimenti direttamente sui materiali di studio.</p>
            </div>
          </div>
        </section>

        {/* Suggerimenti Section */}
        <section className="tips-section">
          <div className="tips-header">
            <Lightbulb size={20} />
            <h2>Suggerimenti per il Successo</h2>
          </div>
          
          <div className="tips-grid">
            <div className="tip-card primary">
              <div className="tip-icon">
                <FileText size={20} />
              </div>
              <h4>Inizia con un PDF</h4>
              <p>Per risultati ottimali, carica <strong>un singolo PDF ben strutturato</strong> anziché multipli file frammentati.</p>
            </div>

            <div className="tip-card secondary">
              <div className="tip-icon">
                <CheckCircle size={20} />
              </div>
              <h4>Verifica le Selezioni</h4>
              <p><strong>Controlla sempre</strong> le pagine selezionate per ogni argomento prima di confermare il piano di studio.</p>
            </div>

            <div className="tip-card accent">
              <div className="tip-icon">
                <Target size={20} />
              </div>
              <h4>Personalizza i Giorni</h4>
              <p>Adatta la distribuzione degli argomenti ai tuoi impegni e alla difficoltà del materiale.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default HomePage;