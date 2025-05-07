// src/components/StudyPlanViewer.jsx (o .js)
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../utils/firebase'; // Assicurati che il percorso sia corretto
import NavBar from './NavBar'; // Importa NavBar se la usi qui
import { Loader, BookOpen, Calendar, CheckSquare, Square, Link as LinkIcon, FileText, AlertTriangle } from 'lucide-react';
// import './styles/StudyPlanViewer.css'; // Decommenta se crei un file CSS dedicato

const StudyPlanViewer = () => {
  const { projectId } = useParams(); // Ottiene projectId dall'URL
  const [project, setProject] = useState(null); // Inizia come null
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchPlanData = async () => {
      if (!projectId) {
        setError("ID Progetto non specificato nella URL.");
        setLoading(false);
        return;
      }
      console.log(`StudyPlanViewer: Fetching data for project ID: ${projectId}`);
      setLoading(true);
      setError('');
      setProject(null); // Resetta project prima di un nuovo fetch
      setTopics([]);    // Resetta topics

      try {
        // Fetch project details
        const projectRef = doc(db, 'projects', projectId);
        const projectSnap = await getDoc(projectRef);

        if (!projectSnap.exists()) {
          console.error(`StudyPlanViewer: Project with ID ${projectId} not found.`);
          throw new Error("Progetto non trovato.");
        }
        const projectData = projectSnap.data();
        console.log("StudyPlanViewer: Project data fetched:", projectData);
        setProject(projectData); // Imposta lo stato project QUI

        // Fetch topics from subcollection, ordered
        const topicsRef = collection(db, 'projects', projectId, 'topics');
        const q = query(topicsRef, orderBy("assignedDay"), orderBy("orderInDay")); // Ordina per giorno e poi per ordine interno
        const topicsSnap = await getDocs(q);

        const topicsData = topicsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("StudyPlanViewer: Topics data fetched:", topicsData);
        setTopics(topicsData); // Imposta lo stato topics QUI

      } catch (err) {
        console.error("StudyPlanViewer: Error fetching study plan:", err);
        setError("Impossibile caricare i dati del piano di studio: " + err.message);
        setProject(null); // Assicura che project sia null in caso di errore
        setTopics([]);
      } finally {
        setLoading(false); // Fine caricamento (sia successo che errore)
      }
    };

    fetchPlanData();
  }, [projectId]); // Esegui effetto quando projectId cambia

  // Funzione helper per raggruppare i topic per giorno
  const groupTopicsByDay = () => {
    if (!topics || topics.length === 0) return {};
    return topics.reduce((acc, topic) => {
      const day = topic.assignedDay;
      if (!acc[day]) {
        acc[day] = [];
      }
      acc[day].push(topic);
      // Assicurati che siano ordinati per orderInDay (anche se la query dovrebbe già farlo)
      // Potrebbe non essere necessario se la query è affidabile
      // acc[day].sort((a, b) => a.orderInDay - b.orderInDay);
      return acc;
    }, {});
  };

  const groupedTopics = groupTopicsByDay(); // Calcola i gruppi

  // --- RENDER CONDITIONALS ---

  // 1. Stato di Caricamento
  if (loading) {
    return (
      <>
        <NavBar />
        <div className="loading-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh', flexDirection: 'column' }}>
          <Loader size={48} className="spin-icon" />
          <span style={{ marginTop: '15px', fontSize: '1.2em' }}>Caricamento piano di studio...</span>
        </div>
      </>
    );
  }

  // 2. Stato di Errore (durante il fetch)
  if (error) {
    return (
      <>
        <NavBar />
        <div className="error-container" style={{ padding: '20px', color: '#dc3545', textAlign: 'center', border: '1px solid #f5c6cb', backgroundColor: '#f8d7da', borderRadius: '5px', maxWidth: '600px', margin: '20px auto' }}>
           <h2 style={{color: '#721c24'}}>Errore nel Caricamento</h2>
           <p>{error}</p>
           <Link to="/projects" style={{color: '#0056b3', textDecoration: 'underline'}}>Torna alla lista dei progetti</Link>
        </div>
      </>
    );
  }

  // 3. Stato Progetto Non Trovato (se fetch ok ma progetto non esiste o è null)
  // Questo è il controllo cruciale aggiunto
  if (!project) {
     return (
       <>
         <NavBar />
         <div className="error-container" style={{ padding: '20px', textAlign: 'center', color: '#856404', border: '1px solid #ffeeba', backgroundColor: '#fff3cd', borderRadius: '5px', maxWidth: '600px', margin: '20px auto' }}>
            <h2>Progetto non trovato</h2>
            <p>Non è stato possibile trovare i dettagli per il progetto con ID: <strong>{projectId}</strong>.</p>
            <p>Potrebbe essere stato eliminato o l'ID potrebbe essere errato.</p>
            <Link to="/projects" style={{color: '#0056b3', textDecoration: 'underline'}}>Torna alla lista dei progetti</Link>
         </div>
       </>
     );
  }

  // --- RENDER PRINCIPALE (Se tutto ok: no loading, no error, project esiste) ---
  return (
    <>
      <NavBar />
      <div className="study-plan-viewer-container" style={{ padding: '20px', maxWidth: '1000px', margin: 'auto' }}>

        {/* Intestazione Progetto - Ora sicuro accedere a project.* */}
        <h1 style={{ borderBottom: '2px solid #eee', paddingBottom: '10px', marginBottom: '15px' }}>{project.title}</h1>
        <div style={{ marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px dashed #ccc' }}>
            <p style={{ margin: '5px 0' }}><strong>Esame:</strong> {project.examName}</p>
            <p style={{ margin: '5px 0' }}><strong>Giorni totali previsti:</strong> {project.totalDays}</p>
            {project.description && <p style={{ margin: '5px 0' }}><strong>Note/Descrizione:</strong> {project.description}</p>}
            {/* Potresti voler mostrare i file PDF originali qui */}
            {project.originalFiles && project.originalFiles.length > 0 && (
              <div style={{marginTop: '10px'}}>
                <strong>File Originali:</strong>
                <ul style={{ listStyle: 'none', paddingLeft: '15px', margin: '5px 0 0 0', fontSize: '0.9em' }}>
                  {project.originalFiles.map((f, idx) => (
                  <li key={idx}>
                    <FileText size={12} style={{ marginRight: '4px' }}/>
                    {f.name} {/* Non includiamo il link perché non abbiamo caricato i file originali */}
                  </li>
                  ))}
                </ul>
              </div>
            )}
        </div>


        <h2 style={{ marginTop: '30px' }}>Piano Giornaliero Dettagliato</h2>

        {/* Mappa dei Giorni e Topic */}
        {Object.keys(groupedTopics).length > 0 ? (
          Object.keys(groupedTopics).sort((a, b) => parseInt(a) - parseInt(b)).map(day => (
            <div key={day} className="day-section" style={{ marginBottom: '30px', border: '1px solid #ddd', padding: '15px', borderRadius: '8px', backgroundColor: '#fdfdfd' }}>
              <h3 style={{ marginTop: 0, borderBottom: '1px solid #eee', paddingBottom: '8px', display: 'flex', alignItems: 'center' }}>
                  <Calendar size={18} style={{ marginRight: '8px', verticalAlign: 'bottom', color: '#555' }}/> Giorno {day}
              </h3>
              {groupedTopics[day].map((topic, topicIdx) => (
                <div key={topic.id || topicIdx} className="topic-item" style={{ marginLeft: '10px', marginBottom: '15px', paddingLeft: '10px', borderLeft: '3px solid #007bff' }}>
                  <h4 style={{ marginBottom: '5px', display: 'flex', alignItems: 'center' }}>
                     {/* TODO: Aggiungere funzionalità onClick per cambiare stato isCompleted */}
                     {topic.isCompleted ?
                         <CheckSquare size={16} style={{ marginRight: '7px', color: 'green', cursor: 'pointer' }} title="Segna come non completato"/>
                         :
                         <Square size={16} style={{ marginRight: '7px', color: '#aaa', cursor: 'pointer' }} title="Segna come completato"/>
                     }
                     <BookOpen size={16} style={{ marginRight: '5px', verticalAlign: 'bottom', color: '#007bff' }}/>
                     {topic.title}
                  </h4>
                   {topic.description && <p style={{ fontSize: '0.9em', color: '#555', margin: '0 0 8px 28px' }}>{topic.description}</p>}

                   {/* Sezione Fonti per il Topic */}
                   {topic.sources && topic.sources.length > 0 && (
                      <div className="topic-sources" style={{ marginLeft: '28px', fontSize:'0.85em' }}>
                         <strong>Materiale di Studio:</strong>
                         <ul style={{ listStyle: 'none', paddingLeft: '10px', margin: '5px 0 0 0' }}>
                            {topic.sources.map((source, idx) => (
                              <li key={idx} style={{ margin: '3px 0', display: 'flex', alignItems: 'center' }}>
                                {source.type === 'pdf_chunk' && source.webViewLink && (
                                  <>
                                    <FileText size={12} style={{ marginRight: '4px', color: '#0056b3', flexShrink: 0 }}/>
                                    <a href={source.webViewLink} target="_blank" rel="noopener noreferrer" title={`Apri sezione: ${source.chunkName || 'Sezione PDF'}`}>
                                      {source.chunkName || `Sezione PDF (p${source.pageStart}-${source.pageEnd})`}
                                    </a>
                                    {source.originalFileName && <span style={{ fontSize: '0.9em', color: '#666', marginLeft: '5px' }}> (da: {source.originalFileName})</span>}
                                  </>
                                )}
                                {source.type === 'pdf_original' && source.webViewLink && ( // Fallback
                                  <>
                                    <FileText size={12} style={{ marginRight: '4px', color: '#666', flexShrink: 0 }}/>
                                    <a href={source.webViewLink} target="_blank" rel="noopener noreferrer" title={`Apri file completo: ${source.name}`}>
                                      {source.name} <em style={{color:'#555'}}>(File Intero)</em>
                                    </a>
                                  </>
                                )}
                                 {source.type === 'web_link' && source.url && ( // Per future aggiunte manuali
                                    <>
                                      <LinkIcon size={12} style={{ marginRight: '4px', flexShrink: 0 }}/>
                                      <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title || source.url}</a>
                                    </>
                                 )}
                                 {source.type === 'error_chunk' && ( // Mostra errore se chunk fallito
                                     <>
                                        <AlertTriangle size={12} style={{ marginRight: '4px', color: 'orange', flexShrink: 0 }}/>
                                        <span style={{ color: 'orange', fontStyle: 'italic' }} title={source.error}>
                                            Errore creazione sezione: {source.name || 'N/D'} {source.originalFileName ? `(da ${source.originalFileName})` : ''}
                                        </span>
                                     </>
                                 )}
                                 {/* Caso per tipo fonte non riconosciuto o link mancante */}
                                 {(!source.webViewLink && !source.url && source.type !== 'error_chunk') && (
                                     <>
                                        <AlertTriangle size={12} style={{ marginRight: '4px', color: 'red', flexShrink: 0 }}/>
                                        <span style={{ color: 'red', fontStyle: 'italic' }}>Link fonte mancante</span>
                                     </>
                                 )}
                              </li>
                            ))}
                         </ul>
                      </div>
                   )}
                   {/* Se non ci sono fonti per un topic */}
                   {(!topic.sources || topic.sources.length === 0) && (
                       <p style={{ marginLeft: '28px', fontSize:'0.85em', color: '#888', fontStyle: 'italic' }}>Nessun materiale specifico collegato.</p>
                   )}

                </div> // Fine topic-item
              ))}
            </div> // Fine day-section
          ))
        ) : (
          <p style={{ fontStyle: 'italic', color: '#666', marginTop: '20px' }}>Nessun argomento trovato nel piano di studio. L'AI potrebbe non aver generato un piano valido.</p>
        )}

        {/* Link per tornare indietro */}
         <Link to="/projects" style={{marginTop: '30px', display:'inline-block', padding: '8px 15px', backgroundColor: '#6c757d', color: 'white', textDecoration: 'none', borderRadius: '4px'}}>
             « Torna alla Lista Progetti
         </Link>

      </div> {/* Fine study-plan-viewer-container */}
    </>
  );
};

export default StudyPlanViewer;