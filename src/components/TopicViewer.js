import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { googleDriveService } from '../utils/googleDriveService';
import useGoogleAuth from '../hooks/useGoogleAuth'; // Assumo che questo hook esista
import NavBar from './NavBar';
import SimpleLoading from './SimpleLoading';
import styles from './styles/TopicViewer.module.css';
import { ArrowLeft, FileText, Plus, BrainCircuit, Bot, FileImage, Link as LinkIcon, File, X, Loader } from 'lucide-react';

// --- Componente SatelliteNode ---
// Questo componente rimane puramente visuale, la logica di click viene gestita dal genitore.
const SatelliteNode = ({ resource, onAdd, onDelete, isLoading }) => {
    if (isLoading) {
        return (
            <div className={`${styles.satelliteNode} ${styles.loadingNode}`}>
                <Loader size={24} className={styles.spinIcon} />
            </div>
        );
    }
    
    if (!resource) {
        return (
            <div className={styles.satelliteNodePlaceholder} onClick={onAdd}>
                <Plus size={24} />
                <span>Aggiungi</span>
            </div>
        );
    }
    
    const getIcon = (type) => {
        const fileType = type || '';
        if (fileType.startsWith('image')) return <FileImage size={24} />;
        if (fileType === 'link') return <LinkIcon size={24} />;
        return <File size={24} />;
    };
    
    return (
        <div className={styles.satelliteNode} title={resource.name}>
            {getIcon(resource.type)}
            <button 
                className={styles.deleteButton} 
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation(); // Previene il trigger del click sul genitore
                    onDelete(resource);
                }}
                aria-label={`Elimina ${resource.name}`}
            >
                <X size={16} />
            </button>
        </div>
    );
};


const TopicViewer = () => {
    const { projectId, topicId } = useParams();
    const navigate = useNavigate();
    const { user } = useGoogleAuth();

    const [topic, setTopic] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    const [satelliteResources, setSatelliteResources] = useState(new Array(6).fill(null));
    const [uploadingIndex, setUploadingIndex] = useState(null);

    const fileInputRef = useRef(null);
    const activeIndexRef = useRef(null);

    useEffect(() => {
        const fetchTopic = async () => {
            if (!projectId || !topicId) {
                setError("ID del progetto o dell'argomento mancante.");
                setLoading(false); return;
            }
            try {
                const topicRef = doc(db, 'projects', projectId, 'topics', topicId);
                const topicSnap = await getDoc(topicRef);
                if (topicSnap.exists()) {
                    const topicData = { id: topicSnap.id, ...topicSnap.data() };
                    setTopic(topicData);
                    
                    const sources = topicData.sources || [];
                    const additionalResources = sources.filter(s => s.type !== 'pdf_chunk' && s.type !== 'note');
                    
                    const newSatellites = new Array(6).fill(null);
                    additionalResources.slice(0, 6).forEach((res, i) => {
                        newSatellites[i] = res;
                    });
                    setSatelliteResources(newSatellites);
                } else {
                    setError("Argomento non trovato.");
                }
            } catch (e) {
                setError("Errore nel caricamento dell'argomento."); console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchTopic();
    }, [projectId, topicId]);
    
    const handleAddResourceClick = (index) => {
        if (!user) { alert("Devi essere autenticato per aggiungere file."); return; }
        activeIndexRef.current = index;
        fileInputRef.current.click();
    };

    const handleFileSelected = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const index = activeIndexRef.current;
        if (index === null) return;
        
        setUploadingIndex(index);
        setError('');

        try {
            await googleDriveService.ensureAuthenticated();
            const uploadedFile = await googleDriveService.uploadFile(file);
            
            const newResource = {
                type: file.type,
                driveId: uploadedFile.driveFileId,
                name: uploadedFile.name,
                webViewLink: uploadedFile.webViewLink,
                id: uploadedFile.driveFileId,
            };
            
            const updatedSatellites = [...satelliteResources];
            updatedSatellites[index] = newResource;
            
            const mainSources = topic.sources.filter(s => s.type === 'pdf_chunk' || s.type === 'note');
            const allSources = [...mainSources, ...updatedSatellites.filter(r => r !== null)];

            const topicRef = doc(db, 'projects', projectId, 'topics', topicId);
            await updateDoc(topicRef, { sources: allSources });
            
            setTopic(prev => ({ ...prev, sources: allSources }));
            setSatelliteResources(updatedSatellites);

        } catch (e) {
            console.error("Errore durante l'upload:", e);
            setError(`Fallimento upload: ${e.message}`);
        } finally {
            setUploadingIndex(null);
            event.target.value = null;
        }
    };
    
    const handleDeleteResource = async (resourceToDelete) => {
        if (!window.confirm(`Sei sicuro di voler eliminare "${resourceToDelete.name}"? L'azione è irreversibile.`)) {
            return;
        }
        
        setError('');
        const indexToDelete = satelliteResources.findIndex(r => r && r.driveId === resourceToDelete.driveId);
        if (indexToDelete === -1) return;

        const originalSatellites = [...satelliteResources];
        const updatedSatellites = [...satelliteResources];
        updatedSatellites[indexToDelete] = null;
        setSatelliteResources(updatedSatellites);
        
        try {
            const token = await googleDriveService.ensureAuthenticated();
            await fetch(`https://www.googleapis.com/drive/v3/files/${resourceToDelete.driveId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
            });

            const mainSources = topic.sources.filter(s => s.type === 'pdf_chunk' || s.type === 'note');
            const allSources = [...mainSources, ...updatedSatellites.filter(r => r !== null)];
            
            const topicRef = doc(db, 'projects', projectId, 'topics', topicId);
            await updateDoc(topicRef, { sources: allSources });

            setTopic(prev => ({...prev, sources: allSources}));
            
        } catch (e) {
            console.error("Errore durante l'eliminazione:", e);
            setError(`Fallimento eliminazione: ${e.message}`);
            setSatelliteResources(originalSatellites);
        }
    };

    // --- NUOVA FUNZIONALITÀ ---
    // Gestisce il click su un satellite per aprirlo in StudySession
    const handleSatelliteClick = (resource) => {
        if (!resource || !resource.driveId) return;

        // Controlla se il file è un PDF, l'unico formato supportato da StudySession
        const isPdf = resource.type === 'application/pdf' || resource.name?.toLowerCase().endsWith('.pdf');

        if (isPdf) {
            // Naviga a StudySession passando i dati della risorsa selezionata nello stato
            navigate(`/projects/${projectId}/study/${topicId}`, {
                state: {
                    selectedResource: {
                        driveId: resource.driveId,
                        name: resource.name,
                    }
                }
            });
        } else {
            // Per altri tipi di file, apri il link di Google Drive in una nuova scheda
            if (resource.webViewLink) {
                window.open(resource.webViewLink, '_blank', 'noopener,noreferrer');
            } else {
                alert("Questo tipo di file non può essere visualizzato direttamente. Prova a scaricarlo da Google Drive.");
            }
        }
    };
    
    // Gestisce il click sul NODO PRINCIPALE
    const handleMainPdfClick = () => {
        if (topic?.sources?.some(s => s.type === 'pdf_chunk')) {
            // Naviga a StudySession senza stato, così caricherà il PDF principale di default
            navigate(`/projects/${projectId}/study/${topicId}`);
        } else {
            alert("Nessun PDF principale associato a questo argomento.");
        }
    };

    const handleStartExam = () => navigate(`/projects/${projectId}/topic/${topicId}/exam`);


    if (loading) return <SimpleLoading message="Caricamento argomento..." fullScreen={true}/>;
    if (error && !topic) return <div className={styles.errorContainer}>{error}</div>;

    return (
        <div className={styles.topicContainer}>
            <NavBar />
            
            <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileSelected} />

            <div className={styles.pageContent}>
                <header className={styles.topicHeader}>
                    <button onClick={() => navigate(`/projects/${projectId}/plan`)} className={styles.backButton}>
                        <ArrowLeft size={18} /> Torna al Piano
                    </button>
                    <h1>{topic?.title}</h1>
                    <p className={styles.topicDescription}>
                        Questo è il tuo centro di comando. Clicca sul PDF principale per studiare o esplora le risorse collegate.
                    </p>
                    {error && <p className={styles.inlineError}>{error}</p>}
                </header>

                <div className={styles.orbitalCanvas}>
                    <div className={styles.connectionsContainer}>
                        {satelliteResources.map((_, index) => (
                            <div key={`line-${index}`} className={styles.connectionLine} style={{ transform: `rotate(${index * 60}deg)` }} />
                        ))}
                    </div>

                    <div className={styles.mainNodeWrapper} onClick={handleMainPdfClick}>
                        <div className={styles.mainNode}><FileText size={36} /></div>
                        <span className={styles.mainNodeTitle}>PDF Principale</span>
                    </div>

                    {satelliteResources.map((resource, index) => (
                        <div 
                            key={resource?.id || index} 
                            className={`${styles.satelliteWrapper} ${styles[`satellite${index + 1}`]}`}
                            // Aggiunto il gestore di click qui
                            onClick={() => handleSatelliteClick(resource)}
                        >
                            <SatelliteNode 
                                resource={resource}
                                isLoading={uploadingIndex === index}
                                onAdd={() => handleAddResourceClick(index)}
                                onDelete={handleDeleteResource}
                            />
                        </div>
                    ))}
                </div>

                <section className={styles.aiSection}>
                    <div className={styles.aiIcon}><BrainCircuit size={28} /></div>
                    <div className={styles.aiContent}>
                        <h2>Mettiti alla prova</h2>
                        <p>Quando ti senti pronto, avvia una sessione di interrogazione con l'IA.</p>
                    </div>
                    <button className={styles.aiButton} onClick={handleStartExam}>
                        <Bot size={18}/> Interrogami
                    </button>
                </section>
            </div>
            {/* 
                NOTA PER LO SVILUPPATORE:
                Per far funzionare questa logica, il componente 'StudySession.jsx'
                deve essere aggiornato per leggere lo stato della rotta.

                Esempio di come modificare 'StudySession.jsx':

                import { useLocation } from 'react-router-dom';

                const StudySession = () => {
                    const location = useLocation();
                    const selectedResource = location.state?.selectedResource;

                    useEffect(() => {
                        const loadPdf = async () => {
                            if (selectedResource?.driveId) {
                                // Carica il PDF del satellite usando selectedResource.driveId
                                // Esempio: const blob = await googleDriveService.downloadPdfChunk(selectedResource.driveId, token);
                            } else {
                                // Logica esistente: carica il PDF principale del topic
                            }
                        };
                        loadPdf();
                    }, [topicId, selectedResource]); // Aggiungi selectedResource alle dipendenze
                    
                    // ... resto del componente
                }
            */}
        </div>
    );
};

export default TopicViewer;