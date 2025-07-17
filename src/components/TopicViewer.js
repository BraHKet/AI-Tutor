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

// --- Componente SatelliteNode: Gestisce la visualizzazione di ogni satellite ---
const SatelliteNode = ({ resource, onAdd, onDelete, isLoading }) => {
    // 1. Stato di Caricamento: Mostra un loader
    if (isLoading) {
        return (
            <div className={`${styles.satelliteNode} ${styles.loadingNode}`}>
                <Loader size={24} className={styles.spinIcon} />
            </div>
        );
    }
    
    // 2. Stato Vuoto (Placeholder): Mostra il pulsante per aggiungere
    if (!resource) {
        return (
            <div className={styles.satelliteNodePlaceholder} onClick={onAdd}>
                <Plus size={24} />
                <span>Aggiungi</span>
            </div>
        );
    }
    
    // Funzione per ottenere l'icona corretta in base al tipo di file
    const getIcon = (type) => {
        const fileType = type || '';
        if (fileType.startsWith('image')) return <FileImage size={24} />;
        if (fileType === 'link') return <LinkIcon size={24} />;
        return <File size={24} />;
    };
    
    // 3. Stato con Risorsa: Mostra l'icona del file e il pulsante per eliminare
    const NodeContent = () => (
        <div className={styles.satelliteNode}>
            {getIcon(resource.type)}
            <button 
                className={styles.deleteButton} 
                onClick={(e) => {
                    e.preventDefault(); // Impedisce al link di aprirsi se si clicca sulla X
                    e.stopPropagation(); // Ferma la propagazione dell'evento
                    onDelete(resource);
                }}
                aria-label={`Elimina ${resource.name}`}
            >
                <X size={16} />
            </button>
        </div>
    );
    
    // Rende l'intera icona un link cliccabile se ha un webViewLink
    return resource.webViewLink ? (
        <a href={resource.webViewLink} target="_blank" rel="noopener noreferrer" title={resource.name}>
            <NodeContent />
        </a>
    ) : (
        <NodeContent />
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
                type: file.type, // Salva il mimetype completo per un'icona più precisa
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

    const handleStartExam = () => navigate(`/projects/${projectId}/topic/${topicId}/exam`);
    const handleMainPdfClick = () => {
        if (topic?.sources?.some(s => s.type === 'pdf_chunk')) {
            navigate(`/projects/${projectId}/study/${topicId}`);
        } else {
            alert("Nessun PDF principale associato a questo argomento.");
        }
    };

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
                        Questo è il tuo centro di comando. Clicca sul PDF principale per studiare o aggiungi file di approfondimento.
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
                        <div key={resource?.id || index} className={`${styles.satelliteWrapper} ${styles[`satellite${index + 1}`]}`}>
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
        </div>
    );
};

export default TopicViewer;