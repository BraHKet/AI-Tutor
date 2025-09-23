// ==========================================
// FILE: src/components/AgentDemo.js (SEQUENTIAL RESPONSE SYSTEM)
// ==========================================
import useGoogleAuth from '../hooks/useGoogleAuth';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { PhysicsAgent } from '../agents/PhysicsAgent';
import VoiceManager, { voiceUtils } from './VoiceManager';
import { 
  Bot, FileText, MessageSquare, Send, Trash2, 
  History, Mic, X, Volume2, Edit3, Plus, Type, MicOff, Settings, VolumeX, MousePointer2, Pen, Eraser, LogOut
} from 'lucide-react';
import { usePdf } from "../context/PdfContext";
import SimpleLoading from './SimpleLoading';
import InitLast from "./InitLast";

// Importa tutti i moduli CSS
import layoutStyles from './styles/layout.module.css';
import headerStyles from './styles/header.module.css';
import statusBarStyles from './styles/statusBar.module.css';
import historySidebarStyles from './styles/historySidebar.module.css';
import controlsStyles from './styles/controls.module.css';
import sequentialWorkspaceStyles from './styles/sequentialWorkspace.module.css';
import canvasStyles from './styles/canvas.module.css';
import overlaysStyles from './styles/overlays.module.css';
import legacyStyles from './styles/legacy.module.css';
import responsiveStyles from './styles/responsive.module.css';
import CustomCursor from './CustomCursor';

// Combina tutti gli stili in un unico oggetto per mantenere la compatibilità
const styles = {
  ...layoutStyles,
  ...headerStyles,
  ...statusBarStyles,
  ...historySidebarStyles,
  ...controlsStyles,
  ...sequentialWorkspaceStyles,
  ...canvasStyles,
  ...overlaysStyles,
  ...legacyStyles,
  ...responsiveStyles
};

export default function AgentDemo() {
  const { projectId, topicId } = useParams();
  const navigate = useNavigate();
  
  const { user, logout } = useGoogleAuth();

  const [isAutoSetupInProgress, setIsAutoSetupInProgress] = useState(true);
  // Recupera file da LoginPage
  const { pdfFile, setPdfFile } = usePdf();

  // Core states
  const [agent, setAgent] = useState(null);
  const [status, setStatus] = useState('Initializing...');
  const [isProcessing, setIsProcessing] = useState(false);
  const FIXED_CANVAS_HEIGHT = 600; // Altezza fissa del foglio di disegno
  
  // Exam states
  const [materialReady, setMaterialReady] = useState(false);
  const [examStarted, setExamStarted] = useState(false);
  const [mainTopic, setMainTopic] = useState('');
  const [conversation, setConversation] = useState([]);
  const [isComplete, setIsComplete] = useState(false);
  const [progress, setProgress] = useState({ covered: 0, total: 0, percentage: 0 });
  
  // Sequential Response states - NUOVO SISTEMA
  const [sequentialElements, setSequentialElements] = useState([]);
  const [activeElementId, setActiveElementId] = useState(null);
  const [currentTool, setCurrentTool] = useState('pointer'); // Solo per i canvas di disegno
  
  // Drawing states per ogni canvas - OTTIMIZZATO
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [strokeColor, setStrokeColor] = useState('#000000');
  const lastPointRef = useRef(null); // <-- MODIFICATO: Usa useRef per le coordinate
  const [activeCanvasId, setActiveCanvasId] = useState(null);
  const drawingAnimationFrame = useRef(null);

  // Voice states
  const [voiceActiveForElement, setVoiceActiveForElement] = useState(null);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [voiceState, setVoiceState] = useState({ isListening: false, isSpeaking: false });

  const [speakingMessageId, setSpeakingMessageId] = useState(null);

  // Stati per il menu impostazioni e la selezione vocale
  const [showSettings, setShowSettings] = useState(false);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const settingsMenuRef = useRef(null); // Per chiudere il menu cliccando fuori

  // Nuovi stati per il menu avanzato
  const [showVoiceSubmenu, setShowVoiceSubmenu] = useState(false);
  const voicePreviewTimeout = useRef(null);
  const [speechSettings, setSpeechSettings] = useState({
    rate: 0.85, // Valore di default
    pitch: 1.0  // Valore di default
  });

  const baseTranscriptRef = useRef('');

  const [showVoiceProperties, setShowVoiceProperties] = useState(false);

  const [cursorState, setCursorState] = useState({
  visible: false,
  position: { x: 0, y: 0 },
  animationKey: 0
  });

  // AI Response states
  const [showAIResponse, setShowAIResponse] = useState(false);
  const [currentAIResponse, setCurrentAIResponse] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [autoSpeak, setAutoSpeak] = useState(true);

    // 1. Aggiungi un useRef per tracciare se la sequenza automatica è stata eseguita.
  const autoStartSequenceRan = useRef(false);

  const mainWorkspaceRef = useRef(null);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [IsMobileTablet, setIsMobileTablet] = useState(window.innerWidth < 1400);

  const [windowWidth, setWindowWidth] = useState(window.innerWidth);


  const LARGE_SCREEN_BREAKPOINT = 825;
  const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth > LARGE_SCREEN_BREAKPOINT);



  // Gestisce l'avvio e lo stop della riproduzione per un messaggio specifico.
  const handleRepeatOrStop = (message) => {
    const messageId = message.timestamp;

    // Caso 1: Clicco sul pulsante del messaggio GIÀ in riproduzione -> FERMA
    if (speakingMessageId === messageId) {
      voiceUtils.stopSpeaking();
      // Non aspettiamo più l'useEffect.
      setSpeakingMessageId(null); 
    } 
    // Caso 2: Clicco su un pulsante diverso (o nessuno sta parlando) -> AVVIA
    else {
      // Ferma qualsiasi altra voce che potrebbe essere in riproduzione prima di avviarne una nuova
      voiceUtils.stopSpeaking(); 
      setSpeakingMessageId(messageId);
      voiceUtils.speak(message.content);
    }
  };

  

  // --- LOGICA DI PERSISTENZA DELLE IMPOSTAZIONI ---

  // Funzione per salvare le impostazioni correnti nel localStorage
  const saveVoiceSettings = (settings) => {
    if (user && user.uid) {
      try {
        localStorage.setItem(`voiceSettings_${user.uid}`, JSON.stringify(settings));
      } catch (error) {
        console.error("Failed to save voice settings:", error);
      }
    }
  };

  // ===============================================
  // SEQUENTIAL ELEMENTS FUNCTIONS - NUOVO SISTEMA
  // ===============================================

  const addTextElement = useCallback(() => {
    const newElement = {
      id: Date.now(),
      type: 'text',
      content: '',
      timestamp: new Date()
    };
    
    setSequentialElements(prev => [...prev, newElement]);
    setActiveElementId(newElement.id);
    
    // Auto-focus dopo un momento
    setTimeout(() => {
      const textarea = document.getElementById(`element-${newElement.id}`);
      if (textarea) textarea.focus();
    }, 50);
  }, []);

  const addDrawingElement = useCallback(() => {
    const newElement = {
      id: Date.now(),
      type: 'drawing',
      content: '', // Conterrà i dati canvas
      canvasData: null,
      timestamp: new Date()
    };
    
    setSequentialElements(prev => [...prev, newElement]);
    setActiveElementId(newElement.id);
    setActiveCanvasId(newElement.id);
    
    // Inizializza il canvas dopo un momento
    setTimeout(() => {
      initializeElementCanvas(newElement.id);
    }, 100);
  }, []);

  const updateElementContent = useCallback((id, content) => {
    setSequentialElements(prev => prev.map(element => 
      element.id === id ? { ...element, content } : element
    ));
  }, []);

  const deleteElement = useCallback((id) => {
    setSequentialElements(prev => prev.filter(element => element.id !== id));
    if (activeElementId === id) {
      setActiveElementId(null);
    }
    if (activeCanvasId === id) {
      setActiveCanvasId(null);
    }
  }, [activeElementId, activeCanvasId]);

  // ===============================================
  // CANVAS FUNCTIONS per elementi di disegno
  // ===============================================


  
  // NUOVA VERSIONE FINALE E CORRETTA
const initializeElementCanvas = useCallback((elementId) => {
    const canvas = document.getElementById(`canvas-${elementId}`);
    if (!canvas) return;

    // ====================================================================
    // MODIFICA CHIAVE: Rilascia lo stile inline esistente.
    // Questa riga permette al canvas di espandersi e occupare lo spazio
    // che il suo contenitore (governato dal CSS) gli concede.
    canvas.style.width = '';
    // ====================================================================

    // ORA, e solo ora, misuriamo la sua larghezza effettiva.
    const logicalWidth = canvas.clientWidth;
    const logicalHeight = FIXED_CANVAS_HEIGHT; 

    if (logicalWidth <= 0) {
        return;
    }

    const dpr = window.devicePixelRatio || 1;
    const physicalWidth = logicalWidth * dpr;
    const physicalHeight = logicalHeight * dpr;

    if (canvas.width === physicalWidth && canvas.height === physicalHeight) {
        // Le dimensioni sono già corrette, ma riapplichiamo lo stile per sicurezza.
        canvas.style.width = `${logicalWidth}px`;
        canvas.style.height = `${logicalHeight}px`;
        return;
    }
    
    const currentDataURL = canvas.toDataURL('image/png');

    // 1. Imposta le dimensioni del buffer
    canvas.width = physicalWidth;
    canvas.height = physicalHeight;

    // 2. Imposta le dimensioni CSS (ora che conosciamo la larghezza corretta)
    canvas.style.width = `${logicalWidth}px`;
    canvas.style.height = `${logicalHeight}px`;

    // 3. Ottieni il context
    const ctx = canvas.getContext('2d');

    // 4. Mettiamo sfondo bianco
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 4. Applica trasformazioni e stili
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // 5. Ripristina il disegno
    if (currentDataURL && currentDataURL !== 'data:,') {
        const img = new Image();
        img.onload = () => {
            ctx.drawImage(img, 0, 0, logicalWidth, logicalHeight);
        };
        img.src = currentDataURL;
    }
}, []);

const reinitializeAllCanvases = useCallback(() => {
    sequentialElements.forEach(element => {
        if (element.type === 'drawing') {
            initializeElementCanvas(element.id);
        }
    });
}, [initializeElementCanvas, windowWidth, showHistory]);


  // ====================================================================
  // INIZIO MODIFICA: Nuova funzione per gestire il click sul microfono
  // ====================================================================
  const handleMicClick = (elementId) => {
  try {
    const isCurrentlyListeningForThis = voiceState.isListening && voiceActiveForElement === elementId;

    if (isCurrentlyListeningForThis) {
      // Caso 1: L'utente ferma manualmente la registrazione.
      console.log(`[Mic] Stopping listener for element ID: ${elementId}`);
      voiceUtils.stopListening();
    
    } else {
      // Caso 2: L'utente avvia una nuova registrazione.
      console.log(`[Mic] Starting listener for element ID: ${elementId}`);
      if (voiceState.isListening) {
        voiceUtils.stopListening(); // Ferma qualsiasi altra registrazione attiva.
      }
      
      // Salva il testo attuale come base per la nuova dettatura.
      const currentElement = sequentialElements.find(el => el.id === elementId);
      const existingText = currentElement ? currentElement.content : '';
      baseTranscriptRef.current = existingText;
      console.log(`[Mic] Saved base text: "${existingText}"`);

      // Avvia la nuova registrazione.
      setVoiceActiveForElement(elementId);
      setTimeout(() => voiceUtils.startListening(), 100);
    }
  } catch (error) {
    console.error("[Mic] Error in handleMicClick:", error);
  }
};


  // Gestisce il ritardo per l'anteprima vocale
  const handleVoicePreviewEnter = (voice) => {
    setCursorState(prev => ({ 
  ...prev, 
  visible: true, 
  animationKey: prev.animationKey + 1 // <-- QUESTA È LA MODIFICA CHIAVE
}));
    
    if (voicePreviewTimeout.current) {
      clearTimeout(voicePreviewTimeout.current);
    }
    voicePreviewTimeout.current = setTimeout(() => {
      voiceUtils.speak(`Ciao, questa è una prova della mia voce.`, { voice: voice });
      setCursorState(prev => ({ ...prev, visible: false })); // <-- NASCONDI DOPO 1 SEC
    }, 1000);
  };

  // Annulla l'anteprima se il mouse esce prima dei 2 secondi
    const handleVoicePreviewLeave = () => {
    setCursorState(prev => ({ ...prev, visible: false })); // <-- NASCONDI SUBITO
    
    if (voicePreviewTimeout.current) {
      clearTimeout(voicePreviewTimeout.current);
    }
  };

  // Seleziona una nuova voce
    const handleVoiceSelection = (voiceName) => {
    const voice = availableVoices.find(v => v.name === voiceName);
    if (voice) {
      setSelectedVoice(voice);
      if (window.voiceManager) {
        window.voiceManager.changeSelectedVoice(voiceName);
      }
      setCursorState(prev => ({ ...prev, visible: false }));
      // Salva la nuova voce insieme alle impostazioni correnti
      saveVoiceSettings({ ...speechSettings, voiceName: voice.name });
      setShowSettings(false);
      setShowVoiceSubmenu(false);
    }
  };

  // Aggiorna le impostazioni di velocità e tono
  const handleSettingsChange = (e) => {
    const { name, value } = e.target;
    const newSettings = { ...speechSettings, [name]: parseFloat(value) };
    setSpeechSettings(newSettings);
    if (window.voiceManager) {
      window.voiceManager.updateSpeechSettings(newSettings);
    }
    // Salva le nuove impostazioni insieme alla voce corrente
    saveVoiceSettings({ ...newSettings, voiceName: selectedVoice?.name });
  };


  const getEventCoords = useCallback((e, canvasId) => {
    // Se l'evento non è valido, esci subito.
    if (!e) return null;

    const canvas = document.getElementById(`canvas-${canvasId}`);
    if (!canvas) return null;
    
    const rect = canvas.getBoundingClientRect();
    
    // Un PointerEvent avrà sempre clientX e clientY.
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
}, []);

  const startDrawing = useCallback((e, canvasId) => {
    if (currentTool !== 'pen' && currentTool !== 'eraser') return;
  
    e.preventDefault(); // <-- Usa 'e' direttamente
    e.target.setPointerCapture(e.pointerId);

    setIsDrawing(true);
    setActiveCanvasId(canvasId);
    
    const canvas = document.getElementById(`canvas-${canvasId}`);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    ctx.globalCompositeOperation = currentTool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.lineWidth = currentTool === 'eraser' ? strokeWidth * 5 : strokeWidth;
    ctx.strokeStyle = strokeColor;

    // Usa 'e' direttamente. React fornisce già il metodo corretto.
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    const firstEvent = events[0];
    const coords = getEventCoords(firstEvent, canvasId);
    if (!coords) return;
    
    lastPointRef.current = coords;
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();

}, [currentTool, getEventCoords, strokeColor, strokeWidth]);

  const draw = useCallback((e, canvasId) => {
    if (!isDrawing || !lastPointRef.current || activeCanvasId !== canvasId) return;
    
    e.preventDefault(); // <-- Usa 'e' direttamente

    if (drawingAnimationFrame.current) cancelAnimationFrame(drawingAnimationFrame.current);
    
    drawingAnimationFrame.current = requestAnimationFrame(() => {
        const canvas = document.getElementById(`canvas-${canvasId}`);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        // Usa 'e' direttamente.
        const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      
        for (const event of events) {
            const coords = getEventCoords(event, canvasId);
            if (!coords) continue;
            ctx.lineTo(coords.x, coords.y);
        }
        ctx.stroke();
       
        const lastCoords = getEventCoords(events[events.length - 1], canvasId);
        if(lastCoords) {
            lastPointRef.current = lastCoords;
        }
    });
}, [isDrawing, activeCanvasId, getEventCoords]);

  const stopDrawing = useCallback((e, canvasId) => {

    if (e && e.target && e.pointerId) {
      e.target.releasePointerCapture(e.pointerId);
    }
    
    if (isDrawing && activeCanvasId === canvasId) {
      setIsDrawing(false);
      lastPointRef.current = null; // MODIFICATO: Resetta il ref
      
      if (drawingAnimationFrame.current) {
        cancelAnimationFrame(drawingAnimationFrame.current);
        drawingAnimationFrame.current = null;
      }
      
      setTimeout(() => {
        const canvas = document.getElementById(`canvas-${canvasId}`);
        if (canvas) {
          const dataURL = canvas.toDataURL('image/png');
          setSequentialElements(prev => prev.map(element => 
            element.id === canvasId 
              ? { ...element, canvasData: dataURL }
              : element
          ));
        }
      }, 100);
    }
}, [isDrawing, activeCanvasId]);

  const clearElementCanvas = useCallback((canvasId) => {
    const canvas = document.getElementById(`canvas-${canvasId}`);
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Aggiorna l'elemento
      setSequentialElements(prev => prev.map(element => 
        element.id === canvasId 
          ? { ...element, canvasData: null }
          : element
      ));
    }
  }, []);

  // ===============================================
  // CONTENT FUNCTIONS
  // ===============================================

  const hasContent = useCallback(() => {
    return sequentialElements.some(element => {
      if (element.type === 'text') {
        return element.content.trim();
      } else if (element.type === 'drawing') {
        return element.canvasData;
      }
      return false;
    });
  }, [sequentialElements]);

  const compileSequentialContent = useCallback(() => {
    let combinedText = '';
    const sequentialData = [];
    
    // Processa gli elementi nell'ordine esatto di aggiunta
    sequentialElements.forEach((element, index) => {
      if (element.type === 'text' && element.content.trim()) {
        const textContent = element.content.trim();
        combinedText += `${textContent}\n\n`;
        sequentialData.push({
          type: 'text',
          content: textContent,
          index: index
        });
      } else if (element.type === 'drawing' && element.canvasData) {
        combinedText += `[Disegno/Formula ${index + 1}]\n\n`;
        sequentialData.push({
          type: 'drawing',
          content: element.canvasData, // Usa il canvasData che è una stringa base64
          index: index
        });
      }
    });
    
    // MODIFICA CRUCIALE: Assicuriamoci di creare un vero array
    const allDrawingImages = sequentialData
      .filter(item => item.type === 'drawing')
      .map(item => item.content); // item.content qui è la stringa base64
    
    return { 
      textContent: combinedText.trim(), 
      sequentialData: sequentialData,
      // Questa proprietà ora è un VERO ARRAY di stringhe base64
      drawingImages: allDrawingImages 
    };
  }, [sequentialElements]);

  const clearAllElements = useCallback(() => {
    setSequentialElements([]);
    setActiveElementId(null);
    setActiveCanvasId(null);
    setVoiceActiveForElement(null);
    setCurrentTranscript('');
  }, []);


  // ===============================================
  // EXAM FUNCTIONS (rimangono uguali)
  // ===============================================

  const analyzeMaterial = async () => {
  if (!agent || !pdfFile) return;

  try {
    setIsProcessing(true);
    setStatus('📄 Analizzando il PDF...');

    await agent.analyzeMaterial(
      { blob: pdfFile, name: pdfFile.name },
      (progress) => setStatus(`📄 ${progress.message}`)
    );

    setMaterialReady(true);
    setStatus('✅ Material ready! Start examination.');
  } catch (error) {
    setStatus(`❌ Error: ${error.message}`);
  } finally {
    setIsProcessing(false);
  }
};

  const startExam = async () => {
    if (!agent || !materialReady) return;

    try {
      setIsProcessing(true);
      setStatus('🎓 Starting examination...');

      const result = await agent.startExamination();

      if (result.success) {
        setExamStarted(true);
        setMainTopic(result.mainTopic);
        setProgress({ covered: 0, total: result.totalItems, percentage: 0 });
        
        const initialMessage = {
          speaker: 'professor',
          content: result.initialQuestion,
          timestamp: new Date()
        };
        
        setConversation([initialMessage]);
        setCurrentAIResponse(result.initialQuestion);
        setShowAIResponse(true);
        setStatus(`💬 Exam started (0/${result.totalItems} items)`);
      }
    } catch (error) {
      setStatus(`❌ Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const sendSequentialContent = async () => {
    if (!agent || isProcessing || !hasContent()) return;

    try {
      setIsProcessing(true);
      voiceUtils.stopSpeaking();
      
      // MODIFICA 1: Estrai `drawingImages` (plurale) invece di `drawingImage` (singolare).
      const { textContent, drawingImages, sequentialData } = compileSequentialContent();
      

      console.log("-------------------------------------------");
      console.log("🔎 [DEBUG-1 | AgentDemo] Sto per inviare i dati.");
      console.log(`Numero di disegni trovati: ${drawingImages ? drawingImages.length : 0}`);
      console.log("Contenuto dell'array 'drawingImages':", drawingImages);
      console.log("-------------------------------------------");

      // Debug: stampa la sequenza elaborata per conferma
      console.log('📝 Sequential content:', {
        textContent,
        drawingImages, // Controlla che qui ci siano tutti i tuoi disegni
        sequentialData,
        originalOrder: sequentialElements.map(el => ({ id: el.id, type: el.type }))
      });
      
      // Logica migliorata per descrivere il contenuto
      let finalText = textContent;
      if (drawingImages && drawingImages.length > 0) {
        const imageCountText = `[Con ${drawingImages.length} elementi grafici allegati]`;
        finalText = textContent ? `${textContent} ${imageCountText}` : imageCountText;
      }
      
      // MODIFICA 2: Aggiorna l'oggetto del messaggio per la cronologia.
      // Usiamo il primo disegno per l'anteprima (`image`), ma conserviamo l'array completo (`images`).
      const studentMessage = {
        speaker: 'student',
        content: finalText,
        image: drawingImages && drawingImages.length > 0 ? drawingImages[0] : null,
        images: drawingImages, // Salva l'array completo per usi futuri
        textContent: textContent,
        sequentialData: sequentialData, 
        timestamp: new Date()
      };
      
      setConversation(prev => [...prev, studentMessage]);

      // MODIFICA 3 (LA PIÙ IMPORTANTE): Passa l'array completo di disegni all'agente.
      // Si assume che l'agente si aspetti una proprietà `images` (o simile) per ricevere un array.
      const result = await agent.processResponse({
        text: textContent,
        images: drawingImages, // Passa l'array di tutti i disegni
        sequential: sequentialData 
      });

      const aiMessage = {
        speaker: 'professor',
        content: result.response,
        timestamp: new Date()
      };
      
      setConversation(prev => [...prev, aiMessage]);
      setCurrentAIResponse(result.response);
      setShowAIResponse(true);
      clearAllElements();

      if (result.progress) {
        setProgress(result.progress);
        setStatus(`💬 Progress: ${result.progress.covered}/${result.progress.total} (${result.progress.percentage}%)`);
      }

      if (result.isComplete) {
        setIsComplete(true);
        setStatus('🎉 Examination completed!');
      }
      
    } catch (error) {
      console.error('❌ Send failed:', error);
      setStatus(`❌ Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const closeAIResponse = () => {
    setShowAIResponse(false);
    setCurrentAIResponse('');
    voiceUtils.stopSpeaking();
  };

  // Helper functions
  const getStatusClass = () => {
    if (status.startsWith('❌')) return styles.statusError;
    if (status.startsWith('✅')) return styles.statusSuccess;
    if (status.startsWith('🎉')) return styles.statusComplete;
    return styles.statusDefault;
  };


 
  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };
  
  //------------------------------------------------------------------------------------------------------------

  // Initialize
  useEffect(() => {
    const init = async () => {
      try {
        setStatus('🔧 Initializing...');

        const physicsAgent = new PhysicsAgent(
          process.env.REACT_APP_SUPABASE_URL,
          process.env.REACT_APP_SUPABASE_ANON_KEY
        );
        
        await physicsAgent.initialize();
        setAgent(physicsAgent);
        setStatus('✅ Ready. Analyze material to begin.');
      } catch (error) {
        setStatus(`❌ Error: ${error.message}`);
      }
    };
    init();
  }, []);


  // Resetta l'ID del messaggio quando la sintesi vocale si ferma per qualsiasi motivo.
  useEffect(() => {
    if (!voiceState.isSpeaking && speakingMessageId !== null) {
      setSpeakingMessageId(null);
    }
  }, [voiceState.isSpeaking]);

    // useEffect per tracciare la posizione del mouse
  useEffect(() => {
    const handleMouseMove = (e) => {
      setCursorState(prev => ({
        ...prev,
        position: { x: e.clientX, y: e.clientY }
      }));
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // useEffect per nascondere il cursore di default quando il nostro è attivo
  useEffect(() => {
    if (cursorState.visible) {
      document.body.style.cursor = 'none';
    } else {
      document.body.style.cursor = 'auto';
    }

    // Funzione di pulizia per ripristinare il cursore se il componente viene smontato
    return () => {
      document.body.style.cursor = 'auto';
    };
  }, [cursorState.visible]);


  useEffect(() => {
    // Quando lo stato 'examStarted' diventa true, significa che la sequenza
    // automatica è terminata e possiamo nascondere la schermata di caricamento.
    if (examStarted) {
      console.log("🏁 Sequenza di setup completata. Nascondo la schermata di caricamento.");
      setIsAutoSetupInProgress(false);
    }
  }, [examStarted]);


  // ==========================================================
  // LOGGING E LOGICA DI AVVIO AUTOMATICO (CORRETTI)
  // ==========================================================


  // useEffect per AVVIARE L'ANALISI (reagisce al cambiamento di 'agent' e 'pdfFile')
  useEffect(() => {
    
    const conditionsMet = agent && pdfFile && !examStarted && !autoStartSequenceRan.current;

    if (conditionsMet) {
      
      autoStartSequenceRan.current = true; // Imposta il flag per non ripeterlo
      analyzeMaterial();
    } else {
      console.log(`[EFFECT ANALYZE] ⏸️ Condizioni NON soddisfatte per l'analisi.`);
    }
  }, [agent, pdfFile, examStarted]); // Si attiva quando 'agent' o 'pdfFile' cambiano

  // useEffect per AVVIARE L'ESAME (reagisce al cambiamento di 'materialReady')
  useEffect(() => {

    const conditionsMet = materialReady && autoStartSequenceRan.current && !examStarted;

    if (conditionsMet) {
      
      startExam();
    } else {
      console.log(`[EFFECT EXAM] ⏸️ Condizioni NON soddisfatte per l'esame.`);
    }
  }, [materialReady, examStarted]); // Si attiva quando 'materialReady' cambia

  

   useEffect(() => {
    if (!pdfFile) {
      navigate("/setpdf"); // Reindirizza al percorso del componente PdfFile
    }
  }, [pdfFile, navigate]);

  // Voice transcript handler - OTTIMIZZATO ANTI-BLOCCO
  const handleTranscriptUpdate = useCallback((transcript, isFinal) => {
  if (!voiceActiveForElement) {
    // Esce subito se non c'è un elemento attivo per la dettatura.
    return;
  }

  // Log per ogni frammento ricevuto dal sistema di riconoscimento vocale.
  console.log(`[Transcript] Received: "${transcript}" | Is Final: ${isFinal}`);

  // Azione principale: avviene solo se la trascrizione è considerata finale.
  if (isFinal) {
    try {
      console.log('[Transcript] Final transcript received. Processing update...');
      
      const oldText = baseTranscriptRef.current;
      console.log(`[Transcript] Old text was: "${oldText}"`);

      // Combina il vecchio testo con la nuova trascrizione finale.
      const newCompleteText = oldText ? oldText + ' ' + transcript : transcript;
      console.log(`[Transcript] New complete text: "${newCompleteText}"`);

      // 1. ESEGUI L'AGGIORNAMENTO (RENDER)
      // Questo è l'unico punto in cui l'interfaccia utente viene aggiornata.
      updateElementContent(voiceActiveForElement, newCompleteText);

      // 2. SALVA IL NUOVO STATO
      // Il testo appena completato diventa la base per la prossima frase.
      baseTranscriptRef.current = newCompleteText;
      console.log('[Transcript] UI updated and base text saved for next phrase.');

    } catch (error) {
      console.error("[Transcript] Error processing final transcript:", error);
    }
  } else {
    // Se la trascrizione non è finale, viene ignorata ai fini del rendering.
    console.log('[Transcript] Interim result ignored.');
  }
}, [voiceActiveForElement, updateElementContent]);

// Auto-speak AI responses - VERSIONE INTEGRATA
useEffect(() => {
  // Se l'opzione è attiva e l'overlay appare con una nuova risposta...
  if (autoSpeak && showAIResponse && currentAIResponse) {
    // ...attendi un istante e poi avvia la riproduzione TRAMITE il nostro sistema di controllo.
    setTimeout(() => {
      handleRepeatOrStop({ content: currentAIResponse, timestamp: 'overlay_response' });
    }, 500);
  }
}, [showAIResponse, currentAIResponse, autoSpeak]); // Le dipendenze rimangono le stesse

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (drawingAnimationFrame.current) {
        cancelAnimationFrame(drawingAnimationFrame.current);
      }
    };
  }, []);




  // useEffect per caricare le impostazioni quando il componente si monta
  useEffect(() => {
    if (user && user.uid && availableVoices.length > 0) {
      try {
        const savedSettingsJSON = localStorage.getItem(`voiceSettings_${user.uid}`);
        if (savedSettingsJSON) {
          const savedSettings = JSON.parse(savedSettingsJSON);
          
          // 1. Applica le impostazioni di velocità e tono
          const newSpeechSettings = {
            rate: savedSettings.rate || 0.85,
            pitch: savedSettings.pitch || 1.0
          };
          setSpeechSettings(newSpeechSettings);
          if (window.voiceManager) {
            window.voiceManager.updateSpeechSettings(newSpeechSettings);
          }

          // 2. Applica la voce salvata
          const savedVoice = availableVoices.find(v => v.name === savedSettings.voiceName);
          if (savedVoice) {
            setSelectedVoice(savedVoice);
            if (window.voiceManager) {
              window.voiceManager.changeSelectedVoice(savedVoice.name);
            }
          }
        }
      } catch (error) {
        console.error("Failed to load voice settings:", error);
      }
    }
  }, [user, availableVoices]); // Si attiva quando l'utente o le voci sono pronti




  // Hook per chiudere il menu se si clicca all'esterno
  useEffect(() => {
    function handleClickOutside(event) {
      // Assicurati che il click non sia sul pulsante dell'ingranaggio
      if (event.target.closest(`.${styles.iconButton}`)) return;
      
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target)) {
        setShowSettings(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [settingsMenuRef]);


    // Modifica l'ultimo useEffect per usare ResizeObserver e window.resize
  useEffect(() => {
    // Questa funzione ora chiama direttamente la reinizializzazione, senza debounce.
    const handleResizeOrLayoutChange = () => {
      console.log("Layout or window resized, reinitializing canvases...");
      reinitializeAllCanvases();
    };

    // Gestione del ridimensionamento della finestra
    window.addEventListener('resize', handleResizeOrLayoutChange);

    // Gestione dei cambiamenti di dimensione dell'elemento workspace con ResizeObserver
    let observer;
    if (mainWorkspaceRef.current) {
      observer = new ResizeObserver(() => {
        // La callback ora è più semplice e chiama direttamente la funzione.
        handleResizeOrLayoutChange();
      });
      observer.observe(mainWorkspaceRef.current);
    }

    // Cleanup function: rimuovi gli event listener
    return () => {
      window.removeEventListener('resize', handleResizeOrLayoutChange);
      if (observer) {
        observer.disconnect(); // Disconnetti l'osservatore
      }
    };
  }, [reinitializeAllCanvases]); // La dipendenza rimane la stessa


  useEffect(() => {
  const handleResize = () => {
    setIsMobile(window.innerWidth < 768);
    setIsMobileTablet(window.innerWidth < 1400);
  };

  window.addEventListener("resize", handleResize);
  return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isDrawingToolsCompact = isMobile && sequentialElements.some(el => el.type === 'drawing');

  useEffect(() => {
  const handleResize = () => setWindowWidth(window.innerWidth);
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
  }, []);


  // Effetto per ricalibrare i canvas quando la sidebar della cronologia viene aperta/chiusa.
  useEffect(() => {
    // Non fare nulla se non c'è almeno un canvas da ridimensionare.
    if (sequentialElements.some(el => el.type === 'drawing')) {
      
      // La sidebar probabilmente ha una transizione CSS (es. 300ms).
      // Aspettiamo un breve istante in più per assicurarci che l'animazione
      // del layout sia completamente terminata prima di misurare le nuove dimensioni.
      const resizeTimer = setTimeout(() => {
        console.log('[Layout Effect] La visibilità della cronologia è cambiata. Ricalibro i canvas...');
        reinitializeAllCanvases();
      }, 350); // Un valore leggermente superiore alla durata tipica di una transizione CSS.

      // È fondamentale pulire il timer se il componente viene smontato
      // o se lo stato `showHistory` cambia di nuovo rapidamente.
      return () => clearTimeout(resizeTimer);
    }
  }, [showHistory, reinitializeAllCanvases]); // Le dipendenze: si attiva quando showHistory cambia.


  // Effetto per gestire la visibilità della sidebar in base alla dimensione dello schermo
useEffect(() => {
  const handleResize = () => {
    const isCurrentlyLarge = window.innerWidth > LARGE_SCREEN_BREAKPOINT;
    setIsLargeScreen(isCurrentlyLarge);
    if (isCurrentlyLarge) {
      setShowHistory(true);
    }
  };
  handleResize();
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
  
}, []); 



  if (isProcessing && !isAutoSetupInProgress) {
    return (
      <SimpleLoading 
        message="Il professore sta rispondendo..."
        size="medium"
        fullScreen={true}  
      />
    );
  }

  if (isAutoSetupInProgress) {
    return (
      <SimpleLoading 
        message={status} 
        size="medium"
        fullScreen={true}  
      />
    );
  }

  return (
    <>
      {/* Renderizza il cursore personalizzato se è visibile */}
      {cursorState.visible && (
      <CustomCursor 
        key={cursorState.animationKey}
        position={cursorState.position} 
      />
    )}
    <div className={styles.container}>
      <VoiceManager
        onTranscriptUpdate={handleTranscriptUpdate}
        onStateChange={setVoiceState}
        onVoicesLoaded={setAvailableVoices}
        onVoiceChange={setSelectedVoice}
        showUI={false}
        disabled={isProcessing}
      />

      {/* ================================================================== */}
      {/* ========= INIZIO DELLA NUOVA STRUTTURA ORGANIZZATIVA ============= */}
      {/* ================================================================== */}

      <div className={styles.stickyHeaderWrapper} style={{ marginBottom: isDrawingToolsCompact ? "55.33px" : "0" }}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <button onClick={handleLogout} className={styles.backButton}>
              <LogOut size={18} />
            </button>
            <button onClick={() => navigate("/setpdf")}  className={styles.backButton}>
              New
            </button>
          </div>
          
          <div className={styles.headerCenter} style={{ padding: isDrawingToolsCompact ? "8px 16px" : "0" }}>
            {activeCanvasId && (
              <div className={styles.drawingToolsCompact}>
                <button
                  onClick={() => setCurrentTool('pointer')}
                  className={currentTool === 'pointer' ? styles.toolButtonActive : styles.toolButtonInactive}
                >
                  <MousePointer2 size={18} />
                </button>
                <button
                  onClick={() => setCurrentTool('pen')}
                  className={currentTool === 'pen' ? styles.toolButtonActive : styles.toolButtonInactive}
                >
                  <Pen size={18} />
                </button>
                <button
                  onClick={() => setCurrentTool('eraser')}
                  className={currentTool === 'eraser' ? styles.toolButtonActive : styles.toolButtonInactive}
                >
                  <Eraser size={18} />
                </button>
                <input
                  type="color"
                  value={strokeColor}
                  onChange={(e) => setStrokeColor(e.target.value)}
                  className={styles.colorPickerCompact}
                />
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={strokeWidth}
                  onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
                  className={styles.strokeSliderCompact}
                />
              </div>
            )}
          </div>

          <div className={styles.headerRight}>
            {examStarted && (
              <div className={styles.progressBadge}>
                {progress.covered}/{progress.total} ({progress.percentage}%)
              </div>
            )}
            {!isLargeScreen && (
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={showHistory ? styles.historyButtonActive : styles.historyButtonInactive}
                disabled={isLargeScreen}
              >
                <History size={16} />
              </button>
            )}
            <button
              onClick={sendSequentialContent}
              disabled={isProcessing || !hasContent()}
              className={hasContent() ? styles.sendButtonActive : styles.sendButtonDisabled}
            >
              <Send size={14} />
              
            </button>
            <div className={styles.settingsContainer}>
              <button
                onClick={() => setShowSettings(prev => !prev)}
                className={styles.iconButton}
              >
                <Settings size={20} />
              </button>
            </div>
          </div>
        </div>

        <div className={getStatusClass()}>
          <strong>Status:</strong> {status}
        </div>
      </div>
      
      {/* ================================================================== */}
      {/* ========= FINE DELLA NUOVA STRUTTURA ORGANIZZATIVA =============== */}
      {/* ================================================================== */}


      {/* Main Content Area */}
      <div className={styles.mainContent}>
        
        {/* History Sidebar */}
        {showHistory && (
          <div className={styles.historySidebar}>
            <div className={styles.sidebarHeader}>
              <h3 className={styles.sidebarTitle}>Conversation History</h3>

              {!isLargeScreen && (
              <button
                onClick={() => setShowHistory(false)}
                className={styles.closeButton}
              >
                <X size={18} />
              </button>
              )}
            </div> 
            
            
            <div className={styles.conversationContainer}>
              {conversation.map((turn, index) => (
                <div key={index} className={turn.speaker === 'professor' ? styles.professorTurn : styles.studentTurn}>
                  <div className={turn.speaker === 'professor' ? styles.professorSpeaker : styles.studentSpeaker}>
                    {turn.speaker === 'professor' ? '🎓 Professor' : '👨‍🎓 Student'}
                    {turn.image && ' 🎨'}
                  </div>

                  {turn.speaker === 'professor' && (
                      <button 
                        className={styles.repeatButton}
                        onClick={() => handleRepeatOrStop(turn)}
                      >
                        {speakingMessageId === 'overlay_response' ? <X size={12} /> : 'R'}
                      </button>
                    )}
                  
                  <div className={styles.turnContent}>
                    {turn.content}
                  </div>
                  
                  {turn.sequentialData && turn.sequentialData.filter(item => item.type === 'drawing').map((drawingItem, imgIndex) => (
                    <img 
                      key={imgIndex}
                      src={drawingItem.content} 
                      alt={`Drawing ${imgIndex + 1}`} 
                      className={styles.turnImage}
                    /> 
                  ))}
                  
                  <div className={styles.turnTimestamp}>
                    {new Date(turn.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main Workspace */}
        <div className={styles.mainWorkspace} ref={mainWorkspaceRef}>
          
          {/* Sequential Response System */}
          {examStarted && !isComplete && (
            <div className={styles.sequentialWorkspace}>

              {/* Sequential Elements List */}
              <div className={styles.sequentialElementsList}>
                {sequentialElements.length === 0 && (
                  <div className={styles.emptyState}>
                    <p>Click "Add Text" or "Add Drawing" to start building your response</p>
                  </div>
                )}

                {sequentialElements.map((element, index) => (
                  <div 
                    key={element.id} 
                    className={`${styles.sequentialElement} ${activeElementId === element.id ? styles.activeElement : ''}`}
                  >
                    <div className={styles.elementHeader}>
                      <span className={styles.elementNumber}>
                        {index + 1}. {element.type === 'text' ? '📝 Text' : '🎨 Drawing'}
                      </span>
                      
                      
                        <div className={styles.elementControls}>
                          {element.type === 'text' && voiceEnabled && (
                            <> {/* Aggiunto un Fragment per contenere sia l'indicatore che il pulsante */}
                              
                              {/* NUOVO: Questo è il punto rosso lampeggiante */}
                              {voiceState.isListening && voiceActiveForElement === element.id && (
                                <div className={styles.recordingIndicator} title="Registrazione attiva..."></div>
                              )}

                              {/* Il pulsante del microfono rimane quasi identico */}
                              <button
                                onClick={() => handleMicClick(element.id)}
                                className={
                                  (voiceState.isListening && voiceActiveForElement === element.id) 
                                    ? styles.voiceControlActive 
                                    : styles.voiceControlInactive
                                }
                              >
                                {(voiceState.isListening && voiceActiveForElement === element.id) 
                                  ? <MicOff size={12} /> 
                                  : <Mic size={12} />
                                }
                              </button>
                            </>
                          )}
                          
                          {element.type === 'drawing' && (
                            <button
                              onClick={() => clearElementCanvas(element.id)}
                              className={styles.clearCanvasButton}
                            >
                              Clear
                            </button>
                          )}
                          
                          <button
                            onClick={() => deleteElement(element.id)}
                            className={styles.deleteElementButton}
                          >
                            <X size={12} />
                          </button>
                        </div>

                    </div>

                    <div className={styles.elementContent}>
                      {element.type === 'text' ? (
                        <textarea
                          id={`element-${element.id}`}
                          value={element.content}
                          onChange={(e) => updateElementContent(element.id, e.target.value)}
                          placeholder="Type your response here..."
                          className={styles.textElementInput}
                          onFocus={() => setActiveElementId(element.id)}
                          rows={3}
                        />
                      ) : (
                        <div className={styles.drawingElementContainer} style={
                            (IsMobileTablet && currentTool === 'pointer') 
                              ? { touchAction: 'auto' } 
                              : { touchAction: 'none' }
                          }>
                          
                          
                          <canvas 
                            id={`canvas-${element.id}`} 
                            className={styles.elementCanvas}
                            onPointerDown={(e) => startDrawing(e, element.id)}
                            onPointerMove={(e) => draw(e, element.id)}
                            onPointerUp={(e) => stopDrawing(e, element.id)}
                            onPointerLeave={(e) => stopDrawing(e, element.id)}
                            onClick={() => setActiveElementId(element.id)}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>


              {/* MODIFICA QUI: Pulsanti per aggiungere nuovi elementi in fondo alla lista */}
              <div className={styles.addElementsFooter}> {/* Nuova classe per lo stile */}
                <button
                  onClick={addTextElement}
                  className={styles.addElementButton}
                >
                  <Type size={16} />
                </button>

                <button
                  onClick={addDrawingElement}
                  className={styles.addElementButton}
                >
                  <Edit3 size={16} />
                </button>
              </div>

            </div>
          )}

          {/* Completion Screen */}
          {isComplete && (
            <div className={styles.completionScreen}>
              <div className={styles.completionCard}>
                <div className={styles.completionIcon}>🎉</div>
                <h2 className={styles.completionTitle}>Examination Completed!</h2>
                <p className={styles.completionText}>
                  Great job! You've successfully completed the AI physics examination.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AI Response Overlay */}
      {showAIResponse && (
        <div className={showHistory ? styles.aiResponseOverlayWithHistory : styles.aiResponseOverlayWithoutHistory}>
          <div className={styles.aiResponseHeader}>
            <div className={styles.aiResponseTitle}>
              🎓 Professor Response
              {voiceEnabled && (
                <button
                  className={styles.repeatButton}
                  onClick={() => handleRepeatOrStop({ content: currentAIResponse, timestamp: 'overlay_response' })}
                >
                  {speakingMessageId === 'overlay_response' ? <X size={12} /> : 'R'}
                </button>
              )}
            </div>
            
        <button
          onClick={closeAIResponse}
          className={styles.aiResponseCloseButton}
        >
          <X size={18} />
        </button>
      
          </div>
          
          <div className={styles.aiResponseContent}>
            {currentAIResponse}
          </div>
        </div>
      )}
      {showSettings && (
        <div 
          className={styles.settingsOverlay} 
          ref={settingsMenuRef}
          onMouseLeave={() => setShowVoiceSubmenu(false)}
        >
          <div className={styles.settingsHeader}>
            <h3 className={styles.settingsTitle}>Impostazioni</h3>
            <button onClick={() => setShowSettings(false)} className={styles.closeSettingsButton}>
              <X size={18} />
            </button>
          </div>

          <div className={styles.settingsContent}>
            {/* --- Opzione per Scegliere la Voce (con sottomenu) --- */}
            <div 
              className={styles.settingsMenuItem}
              onMouseEnter={() => setShowVoiceSubmenu(true)}
            >
              <span>🎙️ Scegli Voce</span>
              <span className={styles.menuItemChevron}>&rsaquo;</span>
              
              {showVoiceSubmenu && (
                <div className={styles.submenuContainer}>
                  <div className={styles.voiceList}>
                    {availableVoices
                      .filter(v => v.lang.startsWith('it') || v.lang.startsWith('en'))
                      .map(voice => (
                        <div
                          key={voice.name}
                          className={`${styles.voiceItem} ${selectedVoice?.name === voice.name ? styles.voiceItemSelected : ''}`}
                          onClick={() => handleVoiceSelection(voice.name)}
                          onMouseEnter={() => handleVoicePreviewEnter(voice)}
                          onMouseLeave={handleVoicePreviewLeave}
                        >
                          <span className={styles.voiceName}>{voice.name}</span>
                          <span className={styles.voiceLang}>{voice.lang}</span>
                        </div>
                      ))
                    }
                  </div>
                </div>
              )}
            </div>
            
            {/* --- NUOVA SEZIONE A TENDINA: Proprietà Voce --- */}
            <div className={styles.accordionItem}>
              <div 
                className={styles.settingsMenuItem}
                onClick={() => setShowVoiceProperties(prev => !prev)}
              >
                <span>⚙️ Proprietà Voce</span>
                <span className={`${styles.menuItemChevron} ${showVoiceProperties ? styles.chevronOpen : ''}`}>&rsaquo;</span>
              </div>
              
              {showVoiceProperties && (
                <div className={styles.accordionContent}>
                  <div className={styles.sliderContainer}>
                    <label className={styles.sliderLabel}>Velocità: {speechSettings.rate.toFixed(2)}</label>
                    <input
                      type="range" name="rate" min="0.5" max="2.0" step="0.1"
                      value={speechSettings.rate} onChange={handleSettingsChange}
                      className={styles.sliderInput}
                    />
                  </div>
                  <div className={styles.sliderContainer}>
                    <label className={styles.sliderLabel}>Tono: {speechSettings.pitch.toFixed(2)}</label>
                    <input
                      type="range" name="pitch" min="0.5" max="2.0" step="0.1"
                      value={speechSettings.pitch} onChange={handleSettingsChange}
                      className={styles.sliderInput}
                    />
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
    <InitLast
          onInit={() => {
            // USO DEL functional updater: evita problemi di closure/staleness
            setSequentialElements(prev => {
              console.log("[onInit] prev sequentialElements:", prev);
              if (prev && prev.length > 0) {
                // già inizializzato -> non facciamo nulla
                return prev;
              }

              const initialTextId = Date.now();
              const initialDrawingId = initialTextId + 1;

              const initialElements = [
                {
                  id: initialTextId,
                  type: "text",
                  content: "",
                  timestamp: new Date(initialTextId)
                },
                {
                  id: initialDrawingId,
                  type: "drawing",
                  content: "",
                  canvasData: null,
                  timestamp: new Date(initialDrawingId)
                }
              ];

              // imposto gli active ID subito: gli ID li conosciamo
              setActiveCanvasId(initialDrawingId);
              setActiveElementId(initialDrawingId);

              // inizializzazione canvas al prossimo paint
              requestAnimationFrame(() => {
                initializeElementCanvas(initialDrawingId);
              });

              return initialElements;
            });
          }}
        />
    </>
  );
}
