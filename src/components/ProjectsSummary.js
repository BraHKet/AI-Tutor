// src/components/ProjectsSummary.js - Con eliminazione e UI migliorata
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db, deleteProject } from '../utils/firebase';
import { 
  Calendar, BookOpen, Loader, AlertCircle, 
  Clock, ChevronRight, Search, PlusCircle, X
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
  const [deletingProjectId, setDeletingProjectId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(null);

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

        const projectsRef = collection(db, "projects");
        const q = query(
          projectsRef,
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc")
        );

        const querySnapshot = await getDocs(q);
        
        const projectsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || new Date()
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

  const filteredProjects = projects.filter(project => {
    return (
      project.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.examName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const handleDeleteProject = async (projectId) => {
    if (!projectId || deletingProjectId) return;
    
    setDeletingProjectId(projectId);
    setShowDeleteModal(null);
    
    try {
      await deleteProject(projectId);
      
      // Rimuovi il progetto dalla lista locale
      setProjects(prevProjects => 
        prevProjects.filter(project => project.id !== projectId)
      );
      
      console.log(`Project ${projectId} deleted successfully`);
    } catch (error) {
      console.error("Error deleting project:", error);
      setError("Errore nell'eliminazione del progetto: " + error.message);
    } finally {
      setDeletingProjectId(null);
    }
  };

  const openDeleteModal = (projectId, projectTitle) => {
    setShowDeleteModal({ id: projectId, title: projectTitle });
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(null);
  };

  const goToStudyPlan = (projectId) => {
    navigate(`/projects/${projectId}/plan`);
  };

  const goToCreateProject = () => {
    navigate('/create-project');
  };

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
          <h1>I tuoi piani</h1>
          
          <div className="projects-actions">
            <div className="search-container">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Cerca..."
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

        {error && (
          <div className="error-banner">
            <AlertCircle size={16} />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="dismiss-error">×</button>
          </div>
        )}

        {loading ? (
          <div className="loading-container">
            <Loader size={32} className="spin-icon" />
            <span>Caricamento...</span>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="empty-projects">
            <BookOpen size={48} strokeWidth={1} />
            <h3>Nessun piano trovato</h3>
            {searchTerm ? (
              <p>Nessun risultato per "{searchTerm}".</p>
            ) : (
              <p>Inizia creando il tuo primo piano di studio!</p>
            )}
            <button className="start-button" onClick={goToCreateProject}>
              <PlusCircle size={16} />
              <span>Crea Piano</span>
            </button>
          </div>
        ) : (
          <div className="projects-grid">
            {filteredProjects.map(project => (
              <div 
                key={project.id} 
                className="project-card"
              >
                <button 
                  className="delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    openDeleteModal(project.id, project.title);
                  }}
                  disabled={deletingProjectId === project.id}
                  title="Elimina progetto"
                >
                  {deletingProjectId === project.id ? (
                    <Loader size={16} className="spin-icon" />
                  ) : (
                    <X size={16} />
                  )}
                </button>

                <div 
                  className="project-clickable"
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
                      <span className="detail-label">Creato:</span>
                      <span className="detail-value">{formatDate(project.createdAt)}</span>
                    </div>
                  </div>
                  
                  <div className="project-footer">
                    <span>Apri Piano</span>
                    <ChevronRight size={16} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal di conferma eliminazione */}
      {showDeleteModal && (
        <div className="delete-modal-overlay" onClick={closeDeleteModal}>
          <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Elimina Piano</h3>
            <p>Sei sicuro di voler eliminare "<strong>{showDeleteModal.title}</strong>"?</p>
            <p className="warning-text">Questa azione non può essere annullata.</p>
            <div className="modal-actions">
              <button 
                className="cancel-btn"
                onClick={closeDeleteModal}
              >
                Annulla
              </button>
              <button 
                className="delete-btn-modal"
                onClick={() => handleDeleteProject(showDeleteModal.id)}
                disabled={deletingProjectId === showDeleteModal.id}
              >
                {deletingProjectId === showDeleteModal.id ? (
                  <>
                    <Loader size={16} className="spin-icon" />
                    Eliminazione...
                  </>
                ) : (
                  'Elimina'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectsSummary;