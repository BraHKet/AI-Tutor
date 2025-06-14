// ==========================================
// FILE: src/components/VoiceManager.js (MINIMAL VOICE COMPONENT - ENHANCED)
// ==========================================

import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Settings } from 'lucide-react';

export default function VoiceManager({ 
  onTranscriptUpdate = () => {}, 
  onSpeechComplete = () => {},
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
  const recognitionRef = useRef(null);
  const synthRef = useRef(null);

  // Load and select best available voice
  const loadVoices = () => {
    if (!synthRef.current) return;
    
    const voices = synthRef.current.getVoices();
    setAvailableVoices(voices);
    
    if (voices.length > 0 && !selectedVoice) {
      // Find the best Italian voice available
      const bestVoice = findBestItalianVoice(voices);
      setSelectedVoice(bestVoice);
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

  // Initialize Speech APIs
  useEffect(() => {
    // Check browser support
    const speechRecognitionSupported = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
    const speechSynthesisSupported = 'speechSynthesis' in window;
    
    if (!speechRecognitionSupported || !speechSynthesisSupported) {
      setIsSupported(false);
      setError('Speech APIs not supported in this browser');
      return;
    }

    // Initialize Speech Recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = 'it-IT';

    // Recognition event handlers
    recognitionRef.current.onstart = () => {
      setIsListening(true);
      setError('');
    };

    recognitionRef.current.onresult = (event) => {
      let transcript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      
      setCurrentTranscript(transcript);
      onTranscriptUpdate(transcript, event.results[event.results.length - 1].isFinal);
    };

    recognitionRef.current.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current.onerror = (event) => {
      setIsListening(false);
      setError(`Speech recognition error: ${event.error}`);
    };

    // Initialize Speech Synthesis
    synthRef.current = window.speechSynthesis;

    // Load voices when available
    loadVoices();
    if (synthRef.current.onvoiceschanged !== undefined) {
      synthRef.current.onvoiceschanged = loadVoices;
    }

    return () => {
      // Cleanup
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, [onTranscriptUpdate]);

  // Start listening
  const startListening = () => {
    if (!isSupported || disabled || isListening) return;

    try {
      // Stop any ongoing speech first
      if (synthRef.current.speaking) {
        synthRef.current.cancel();
        setIsSpeaking(false);
      }

      setCurrentTranscript('');
      setError('');
      recognitionRef.current.start();
    } catch (error) {
      setError(`Failed to start listening: ${error.message}`);
    }
  };

  // Stop listening
  const stopListening = () => {
    if (!isSupported || !isListening) return;

    try {
      recognitionRef.current.stop();
    } catch (error) {
      setError(`Failed to stop listening: ${error.message}`);
    }
  };

  // Enhanced speak function with better voice and settings
  const speakText = (text, options = {}) => {
    if (!isSupported || disabled || !text.trim()) return;

    try {
      // Stop any ongoing speech
      synthRef.current.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      
      // Use selected voice or best available
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
      
      // Apply optimized settings
      utterance.lang = options.lang || selectedVoice?.lang || 'it-IT';
      utterance.rate = options.rate || speechSettings.rate;
      utterance.pitch = options.pitch || speechSettings.pitch;
      utterance.volume = options.volume || speechSettings.volume;

      // Event handlers
      utterance.onstart = () => {
        setIsSpeaking(true);
        setError('');
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        onSpeechComplete();
      };

      utterance.onerror = (event) => {
        setIsSpeaking(false);
        setError(`Speech synthesis error: ${event.error}`);
      };

      // Start speaking
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
      isListening,
      isSpeaking,
      selectedVoice: selectedVoice?.name
    };

    return () => {
      delete window.voiceManager;
    };
  }, [isListening, isSpeaking, currentTranscript, selectedVoice]);

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