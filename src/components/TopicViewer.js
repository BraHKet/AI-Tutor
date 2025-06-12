import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';
import NavBar from './NavBar';
import SimpleLoading from './SimpleLoading';
import styles from './styles/TopicViewer.module.css';
import { ArrowLeft, FileText, Plus, BrainCircuit, Bot, FileImage, Link as LinkIcon, File } from 'lucide-react';

// Componente per un singolo "satellite" (invariato)
const SatelliteNode = ({ resource, onAdd }) => {
    if (!resource) {
        return (
            <div className={styles.satelliteNodePlaceholder} onClick={onAdd}>
                <Plus size={24} />
                <span>Aggiungi</span>
            </div>
        );
    }
    const getIcon = (type) => {
        switch (type) {
            case 'image': return <FileImage size={24} />;
            case 'link': return <LinkIcon size={24} />;
            case 'doc': return <File size={24} />;
            default: return <FileText size={24} />;
        }
    };
    return (
        <div className={styles.satelliteNode}>
            {getIcon(resource.type)}
        </div>
    );
};


const TopicViewer = () => {
    const { projectId, topicId } = useParams();
    const navigate = useNavigate();
    const [topic, setTopic] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    const [satelliteResources, setSatelliteResources] = useState([
        { id: 4, type: 'doc', title: 'Appunti.docx' },
        null,
        null,
        { id: 1, type: 'image', title: 'Mappa concettuale.png' },
        { id: 2, type: 'link', title: 'Video YouTube' },
        null,
    ]);

    useEffect(() => {
        const fetchTopic = async () => {
            if (!projectId || !topicId) {
                setError("ID del progetto o dell'argomento mancante."); setLoading(false); return;
            }
            try {
                const topicRef = doc(db, 'projects', projectId, 'topics', topicId);
                const topicSnap = await getDoc(topicRef);
                if (topicSnap.exists()) { setTopic({ id: topicSnap.id, ...topicSnap.data() }); } 
                else { setError("Argomento non trovato."); }
            } catch (e) {
                setError("Errore nel caricamento dell'argomento."); console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchTopic();
    }, [projectId, topicId]);
    
    const handleStartExam = () => {
        // Naviga alla pagina dell'agente passando gli ID correnti
        navigate(`/projects/${projectId}/topic/${topicId}/exam`);
    };

    const handleMainPdfClick = () => {
        navigate(`/projects/${projectId}/study/${topicId}`);
    };

    const handleAddResource = (index) => {
        console.log(`Aggiungi risorsa alla posizione ${index}`);
    };

    if (loading) return <SimpleLoading message="Caricamento argomento..." fullScreen={true}/>;
    if (error) return <div className={styles.errorContainer}>{error}</div>;

    return (
        <div className={styles.topicContainer}>
            <NavBar />
            {/* NUOVO WRAPPER per risolvere il problema del centraggio */}
            <div className={styles.pageContent}>
                <header className={styles.topicHeader}>
                    <button onClick={() => navigate(`/projects/${projectId}/plan`)} className={styles.backButton}>
                        <ArrowLeft size={18} />
                        Torna al Piano
                    </button>
                    <h1>{topic?.title}</h1>
                    <p className={styles.topicDescription}>
                        Questo è il tuo centro di comando. Clicca sul PDF principale per studiare o esplora le risorse collegate.
                    </p>
                </header>

                <div className={styles.orbitalCanvas}>
                    <div className={styles.connectionsContainer}>
                        {satelliteResources.map((resource, index) => (
                            <div 
                                key={`line-${index}`}
                                className={styles.connectionLine}
                                style={{ transform: `rotate(${index * 60}deg)` }} 
                            />
                        ))}
                    </div>

                    <div className={styles.mainNodeWrapper} onClick={handleMainPdfClick}>
                        <div className={styles.mainNode}>
                            <FileText size={36} />
                        </div>
                        <span className={styles.mainNodeTitle}>PDF Principale</span>
                    </div>

                    {satelliteResources.map((resource, index) => (
                        <div key={index} className={`${styles.satelliteWrapper} ${styles[`satellite${index + 1}`]}`}>
                            <SatelliteNode 
                                resource={resource} 
                                onAdd={() => handleAddResource(index)} 
                            />
                        </div>
                    ))}
                </div>

                <section className={styles.aiSection}>
                    <div className={styles.aiIcon}>
                        <BrainCircuit size={28} />
                    </div>
                    <div className={styles.aiContent}>
                        <h2>Mettiti alla prova</h2>
                        <p>Quando ti senti pronto, avvia una sessione di interrogazione con l'IA.</p>
                    </div>
                    <button className={styles.aiButton} onClick={handleStartExam}>
                        <Bot size={18}/>
                        Interrogami
                    </button>
                </section>
            </div>
        </div>
    );
};

export default TopicViewer;