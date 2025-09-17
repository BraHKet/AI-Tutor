// ==========================================
// FILE: src/components/VoiceManager.js (MINIMAL VOICE COMPONENT - ENHANCED)
// ==========================================

import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Settings } from 'lucide-react';

export default function VoiceManager({ 
  onTranscriptUpdate = () => {}, 
  onSpeechComplete = () => {},
  onStateChange = () => {}, 
  onVoicesLoaded = () => {}, 
  onVoiceChange = () => {},  
  showUI = true, 
  disabled = false 
}) {
  // States
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(true);
  const [error, setError] = useState('');
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [speechSettings, setSpeechSettings] = useState({
    rate: 0.85,
    pitch: 1.0,
    volume: 0.9
  });

  // Refs
  const synthRef = useRef(null);
  const isIntentionalStopRef = useRef(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => {
    // Controlla se il browser supporta la sintesi vocale
    const speechSynthesisSupported = 'speechSynthesis' in window;
    if (!speechSynthesisSupported) {
      setIsSupported(false);
      setError('Speech Synthesis not supported');
      return;
    }

    // Inizializza la sintesi vocale
    synthRef.current = window.speechSynthesis;

    // Carica le voci quando sono disponibili
    const handleVoicesChanged = () => {
      if (!synthRef.current) return;
      const voices = synthRef.current.getVoices();
      setAvailableVoices(voices);
      onVoicesLoaded(voices);
      
      if (voices.length > 0 && !selectedVoice) {
        const bestVoice = findBestItalianVoice(voices);
        setSelectedVoice(bestVoice);
        onVoiceChange(bestVoice);
      }
    };

    // Alcuni browser caricano le voci subito, altri dopo un evento
    handleVoicesChanged();
    if (synthRef.current.onvoiceschanged !== undefined) {
      synthRef.current.onvoiceschanged = handleVoicesChanged;
    }

    // Funzione di pulizia
    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
        synthRef.current.onvoiceschanged = null;
      }
    };
  }, [onVoicesLoaded, onVoiceChange, selectedVoice]); // Aggiungi le dipendenze

  useEffect(() => {
    onStateChange({ isListening, isSpeaking });
  }, [isListening, isSpeaking, onStateChange]);

  useEffect(() => {
    onStateChange({ isListening, isSpeaking });
  }, [isListening, isSpeaking, onStateChange]);

  // Load and select best available voice
    const loadVoices = () => {
    if (!synthRef.current) return;
    
    const voices = synthRef.current.getVoices();
    setAvailableVoices(voices);
    onVoicesLoaded(voices); // <-- NOTIFICA L'ELENCO VOCI
    
    if (voices.length > 0 && !selectedVoice) {
      const bestVoice = findBestItalianVoice(voices);
      setSelectedVoice(bestVoice);
      onVoiceChange(bestVoice); // <-- NOTIFICA LA VOCE PREDEFINITA
      console.log('🎙️ Selected voice:', bestVoice?.name || 'Default');
    }
  };

  // Intelligent voice selection for Italian
  const findBestItalianVoice = (voices) => {
    // Priority order for voice selection
    const priorities = [
      // Neural/Premium voices (Google/Microsoft)
      (v) => v.name.includes('Neural') && v.lang.startsWith('it'),
      (v) => v.name.includes('Premium') && v.lang.startsWith('it'),
      (v) => v.name.includes('HD') && v.lang.startsWith('it'),
      
      // High-quality Italian voices
      (v) => v.name.includes('Elsa') && v.lang.startsWith('it'), // Google
      (v) => v.name.includes('Alice') && v.lang.startsWith('it'), // Apple
      (v) => v.name.includes('Luca') && v.lang.startsWith('it'), // Apple
      (v) => v.name.includes('Federica') && v.lang.startsWith('it'), // Apple
      (v) => v.name.includes('Paola') && v.lang.startsWith('it'), // Microsoft
      (v) => v.name.includes('Cosimo') && v.lang.startsWith('it'), // Microsoft
      
      // Any Italian voice
      (v) => v.lang.startsWith('it-IT'),
      (v) => v.lang.startsWith('it'),
      
      // Fallback to any decent voice
      (v) => v.name.includes('Google') && v.lang.startsWith('en'),
      (v) => v.name.includes('Microsoft') && v.lang.startsWith('en'),
      (v) => v.default
    ];

    for (const priority of priorities) {
      const voice = voices.find(priority);
      if (voice) return voice;
    }

    return voices[0] || null;
  };

  

  // Start listening
  const startListening = async () => {
    if (disabled || isListening) return;

    try {
      // 1. Richiedi l'accesso al microfono
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Ferma la sintesi vocale se stava parlando
      if (synthRef.current && synthRef.current.speaking) {
        synthRef.current.cancel();
        setIsSpeaking(false);
      }
      
      setError('');
      audioChunksRef.current = []; // Svuota i vecchi pezzi di audio
      setIsListening(true);
      
      // 2. Inizializza il MediaRecorder
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm; codecs=opus' });

      // 3. Salva i pezzi di audio man mano che vengono registrati
      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      // 4. Quando la registrazione si ferma, invia i dati al backend
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm; codecs=opus' });
        
        // Converti il file audio in una stringa base64
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = reader.result.split(',')[1]; 

          // 5. Invia all'API serverless
          try {
            const response = await fetch('/api/speechProxy', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audioBytes: base64Audio }),
            });

            if (!response.ok) {
              const errData = await response.json();
              throw new Error(errData.error || 'Errore nella trascrizione.');
            }

            const data = await response.json();
            
            // 6. Notifica al componente genitore la trascrizione finale
            onTranscriptUpdate(data.transcription, true);

          } catch (apiError) {
            setError(`Errore API: ${apiError.message}`);
          } finally {
            // Pulisci le tracce dello stream per spegnere l'icona del microfono nel browser
            stream.getTracks().forEach(track => track.stop());
          }
        };
      };

      // 7. Avvia la registrazione
      mediaRecorderRef.current.start();

    } catch (err) {
      setError(`Errore microfono: ${err.message}`);
      setIsListening(false);
    }
  };

  // Stop listening
  const stopListening = () => {
    if (!isListening || !mediaRecorderRef.current) return;
    
    // Ferma la registrazione. Questo attiverà l'evento 'onstop' definito sopra.
    mediaRecorderRef.current.stop();
    setIsListening(false);
  };

  // Enhanced speak function with better voice and settings
    const speakText = (text, options = {}) => {
    if (!isSupported || disabled || !text.trim()) return;

    try {
      synthRef.current.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      
      // NUOVA LOGICA: Usa una voce specifica se fornita nelle opzioni,
      // altrimenti usa quella selezionata nello stato.
      const voiceToUse = options.voice || selectedVoice;
      if (voiceToUse) {
        utterance.voice = voiceToUse;
      }
      
      // Applica le impostazioni
      utterance.lang = options.lang || voiceToUse?.lang || 'it-IT';
      utterance.rate = options.rate || speechSettings.rate;
      utterance.pitch = options.pitch || speechSettings.pitch;
      utterance.volume = options.volume || speechSettings.volume;

      // Event handlers
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        onSpeechComplete();
      };
      utterance.onerror = (event) => {
        setIsSpeaking(false);
        setError(`Speech synthesis error: ${event.error}`);
      };

      synthRef.current.speak(utterance);
    } catch (error) {
      setError(`Failed to speak: ${error.message}`);
    }
  };

  // Stop speaking
  const stopSpeaking = () => {
    if (!isSupported) return;

    try {
      synthRef.current.cancel();
      setIsSpeaking(false);
    } catch (error) {
      setError(`Failed to stop speaking: ${error.message}`);
    }
  };

  // Test voice with sample text
  const testVoice = () => {
    speakText("Ciao, questa è una prova della mia voce. Come ti sembra?");
  };

  // Clear current transcript
  const clearTranscript = () => {
    setCurrentTranscript('');
  };

  // Get current transcript
  const getTranscript = () => {
    return currentTranscript;
  };

  // Update speech settings
  const updateSpeechSettings = (newSettings) => {
    setSpeechSettings(prev => ({ ...prev, ...newSettings }));
  };



  const changeSelectedVoice = (voiceName) => {
    const voice = availableVoices.find(v => v.name === voiceName);
    if (voice) {
      setSelectedVoice(voice);
    }
  };


  // Expose methods for parent components
  useEffect(() => {
    // Attach methods to window for easy access (optional)
    window.voiceManager = {
      speak: speakText,
      stopSpeaking,
      startListening,
      stopListening,
      getTranscript,
      clearTranscript,
      testVoice,
      changeSelectedVoice, 
      updateSpeechSettings,
      isListening,
      isSpeaking,
      selectedVoice: selectedVoice?.name
    };

    return () => {
      delete window.voiceManager;
    };
  }, [isListening, isSpeaking, currentTranscript, selectedVoice, availableVoices]);


  if (!showUI) {
    return null; 
  }


  if (!isSupported) {
    return (
      <div style={{
        background: '#fee2e2',
        border: '1px solid #fca5a5',
        borderRadius: '6px',
        padding: '12px',
        marginBottom: '10px'
      }}>
        <div style={{ fontSize: '14px', color: '#dc2626' }}>
          ❌ Voice features not supported in this browser
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: '#f8fafc',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      padding: '12px',
      marginBottom: '15px'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: error ? '10px' : '0'
      }}>
        {/* Voice Controls */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Microphone Button */}
          <button
            onClick={isListening ? stopListening : startListening}
            disabled={disabled || isSpeaking}
            style={{
              background: isListening ? '#ef4444' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 12px',
              cursor: (disabled || isSpeaking) ? 'not-allowed' : 'pointer',
              opacity: (disabled || isSpeaking) ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {isListening ? <MicOff size={16} /> : <Mic size={16} />}
            {isListening ? 'Stop' : 'Listen'}
          </button>

          {/* Speaker Button */}
          <button
            onClick={stopSpeaking}
            disabled={disabled || !isSpeaking}
            style={{
              background: isSpeaking ? '#ef4444' : '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 12px',
              cursor: (disabled || !isSpeaking) ? 'not-allowed' : 'pointer',
              opacity: (disabled || !isSpeaking) ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {isSpeaking ? <VolumeX size={16} /> : <Volume2 size={16} />}
            {isSpeaking ? 'Stop' : 'Quiet'}
          </button>

          {/* Test Voice Button */}
          <button
            onClick={testVoice}
            disabled={disabled || isSpeaking || isListening}
            style={{
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 12px',
              cursor: (disabled || isSpeaking || isListening) ? 'not-allowed' : 'pointer',
              opacity: (disabled || isSpeaking || isListening) ? 0.5 : 1,
              fontSize: '12px'
            }}
          >
            🔊 Test
          </button>

          {/* Settings Button */}
          <button
            onClick={() => setShowVoiceSettings(!showVoiceSettings)}
            style={{
              background: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <Settings size={16} />
          </button>
        </div>

        {/* Status Indicators */}
        <div style={{ display: 'flex', gap: '10px', fontSize: '12px', alignItems: 'center' }}>
          {selectedVoice && (
            <span style={{ 
              background: '#ecfdf5', 
              color: '#059669', 
              padding: '4px 8px', 
              borderRadius: '4px' 
            }}>
              🎙️ {selectedVoice.name.split(' ')[0]}
            </span>
          )}
          {isListening && (
            <span style={{ 
              background: '#fee2e2', 
              color: '#dc2626', 
              padding: '4px 8px', 
              borderRadius: '4px' 
            }}>
              🎤 Listening...
            </span>
          )}
          {isSpeaking && (
            <span style={{ 
              background: '#dbeafe', 
              color: '#1d4ed8', 
              padding: '4px 8px', 
              borderRadius: '4px' 
            }}>
              🔊 Speaking...
            </span>
          )}
        </div>
      </div>

      {/* Voice Settings Panel */}
      {showVoiceSettings && (
        <div style={{
          background: '#f9fafb',
          border: '1px solid #d1d5db',
          borderRadius: '6px',
          padding: '12px',
          marginTop: '10px'
        }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>🎙️ Voice Settings</h4>
          
          {/* Voice Selection */}
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>
              Voice:
            </label>
            <select
              value={selectedVoice?.name || ''}
              onChange={(e) => {
                const voice = availableVoices.find(v => v.name === e.target.value);
                setSelectedVoice(voice);
              }}
              style={{
                width: '100%',
                padding: '4px',
                borderRadius: '4px',
                border: '1px solid #d1d5db'
              }}
            >
              {availableVoices
                .filter(voice => voice.lang.startsWith('it') || voice.lang.startsWith('en'))
                .map((voice, index) => (
                <option key={index} value={voice.name}>
                  {voice.name} ({voice.lang})
                </option>
              ))}
            </select>
          </div>

          {/* Speed Control */}
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>
              Speed: {speechSettings.rate.toFixed(2)}
            </label>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={speechSettings.rate}
              onChange={(e) => updateSpeechSettings({ rate: parseFloat(e.target.value) })}
              style={{ width: '100%' }}
            />
          </div>

          {/* Pitch Control */}
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>
              Pitch: {speechSettings.pitch.toFixed(2)}
            </label>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={speechSettings.pitch}
              onChange={(e) => updateSpeechSettings({ pitch: parseFloat(e.target.value) })}
              style={{ width: '100%' }}
            />
          </div>

          {/* Volume Control */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>
              Volume: {speechSettings.volume.toFixed(2)}
            </label>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.1"
              value={speechSettings.volume}
              onChange={(e) => updateSpeechSettings({ volume: parseFloat(e.target.value) })}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div style={{
          background: '#fee2e2',
          color: '#dc2626',
          padding: '8px',
          borderRadius: '4px',
          fontSize: '12px',
          marginTop: '8px'
        }}>
          {error}
        </div>
      )}

      {/* Current Transcript Display */}
      {currentTranscript && (
        <div style={{
          background: '#f0f9ff',
          border: '1px solid #0ea5e9',
          borderRadius: '4px',
          padding: '8px',
          marginTop: '8px',
          fontSize: '14px'
        }}>
          <strong>Transcript:</strong> {currentTranscript}
        </div>
      )}
    </div>
  );
}

// Export utility functions for use in other components
export const voiceUtils = {
  // Speak text from any component
  speak: (text, options = {}) => {
    if (window.voiceManager) {
      window.voiceManager.speak(text, options);
    }
  },
  
  // Stop speaking from any component
  stopSpeaking: () => {
    if (window.voiceManager) {
      window.voiceManager.stopSpeaking();
    }
  },

  // Start listening from any component
  startListening: () => {
    if (window.voiceManager) {
      window.voiceManager.startListening();
    }
  },

  // Stop listening from any component  
  stopListening: () => {
    if (window.voiceManager) {
      window.voiceManager.stopListening();
    }
  },

  // Get current transcript
  getTranscript: () => {
    if (window.voiceManager) {
      return window.voiceManager.getTranscript();
    }
    return '';
  },

  // Test current voice
  testVoice: () => {
    if (window.voiceManager) {
      window.voiceManager.testVoice();
    }
  },

  // Check if voice features are active
  isActive: () => {
    if (window.voiceManager) {
      return window.voiceManager.isListening || window.voiceManager.isSpeaking;
    }
    return false;
  },

  // Get current voice info
  getCurrentVoice: () => {
    if (window.voiceManager) {
      return window.voiceManager.selectedVoice;
    }
    return 'Unknown';
  }
};