// src/components/ProjectsSummary.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { 
  Calendar, BookOpen, Loader, AlertCircle, 
  Clock, ChevronRight, Search, PlusCircle 
} from 'lucide-react';
import useGoogleAuth from '../hooks/useGoogleAuth';
import NavBar from './NavBar';
import './styles/ProjectsSummary.css';

const ProjectsSummary = () => {
  const navigate = useNavigate();
  const { user } = useGoogleAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        if (!user || !user.uid) {
          setError("Utente non autenticato");
          setLoading(false);
          return;
        }

        setLoading(true);
        setError(null);

        // Crea una query per ottenere i progetti dell'utente corrente
        const projectsRef = collection(db, "projects");
        const q = query(
          projectsRef,
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc") // Mostra i più recenti prima
        );

        const querySnapshot = await getDocs(q);
        
        // Trasforma i documenti in un array di oggetti
        const projectsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || new Date() // Gestisce i timestamp
        }));

        console.log("Projects fetched:", projectsData.length);
        setProjects(projectsData);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching projects:", err);
        setError("Errore nel caricamento dei progetti: " + err.message);
        setLoading(false);
      }
    };

    if (user) {
      fetchProjects();
    }
  }, [user]);

  // Filtra i progetti in base al termine di ricerca
  const filteredProjects = projects.filter(project => {
    return (
      project.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.examName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  // Naviga al visualizzatore del piano di studio
  const goToStudyPlan = (projectId) => {
    navigate(`/projects/${projectId}/plan`);
  };

  // Naviga alla creazione di un nuovo progetto
  const goToCreateProject = () => {
    navigate('/create-project');
  };

  // Formatta la data in modo più leggibile
  const formatDate = (date) => {
    if (!date) return 'Data sconosciuta';
    
    return date.toLocaleDateString('it-IT', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="projects-summary-container">
      <NavBar />
      
      <div className="projects-section">
        <div className="projects-header">
          <h1>Riepilogo Progetti</h1>
          
          <div className="projects-actions">
            <div className="search-container">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Cerca nei tuoi progetti..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
            
            <button className="create-project-button" onClick={goToCreateProject}>
              <PlusCircle size={16} />
              <span>Nuovo Piano</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loading-container">
            <Loader size={32} className="spin-icon" />
            <span>Caricamento progetti...</span>
          </div>
        ) : error ? (
          <div className="error-container">
            <AlertCircle size={24} />
            <span>{error}</span>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="empty-projects">
            <BookOpen size={48} strokeWidth={1} />
            <h3>Nessun progetto trovato</h3>
            {searchTerm ? (
              <p>Nessun risultato per "{searchTerm}". Prova con un altro termine.</p>
            ) : (
              <p>Inizia creando il tuo primo piano di studio!</p>
            )}
            <button className="start-button" onClick={goToCreateProject}>
              <PlusCircle size={16} />
              <span>Crea Piano di Studio</span>
            </button>
          </div>
        ) : (
          <div className="projects-grid">
            {filteredProjects.map(project => (
              <div 
                key={project.id} 
                className="project-card"
                onClick={() => goToStudyPlan(project.id)}
              >
                <div className="project-header">
                  <BookOpen size={18} />
                  <h3 className="project-title">{project.title}</h3>
                </div>
                
                <div className="project-content">
                  <div className="project-detail">
                    <span className="detail-label">Esame:</span>
                    <span className="detail-value">{project.examName}</span>
                  </div>
                  
                  <div className="project-detail">
                    <Calendar size={14} />
                    <span className="detail-label">Giorni:</span>
                    <span className="detail-value">{project.totalDays}</span>
                  </div>
                  
                  <div className="project-detail">
                    <Clock size={14} />
                    <span className="detail-label">Creato il:</span>
                    <span className="detail-value">{formatDate(project.createdAt)}</span>
                  </div>
                  
                  {project.description && (
                    <div className="project-description">
                      <p>{project.description.length > 100 
                          ? project.description.substring(0, 100) + '...' 
                          : project.description}
                      </p>
                    </div>
                  )}
                </div>
                
                <div className="project-footer">
                  <span>Apri Piano</span>
                  <ChevronRight size={16} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectsSummary;