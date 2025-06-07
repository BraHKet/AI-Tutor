// src/components/LoadingOverlay.js
import React from 'react';
import { Loader, FileText, BrainCircuit, Cloud, Save } from 'lucide-react';
import './styles/LoadingOverlay.css';

const LoadingOverlay = ({ 
  isVisible, 
  message = 'Caricamento in corso...', 
  phase = 'processing',
  progress = null,
  details = null 
}) => {
  if (!isVisible) return null;

  // Icone diverse per fasi diverse
  const getPhaseIcon = () => {
    switch (phase) {
      case 'analyzing':
        return <BrainCircuit size={32} className="phase-icon analyzing" />;
      case 'processing':
        return <FileText size={32} className="phase-icon processing" />;
      case 'uploading':
        return <Cloud size={32} className="phase-icon uploading" />;
      case 'saving':
        return <Save size={32} className="phase-icon saving" />;
      case 'chunks':
        return <FileText size={32} className="phase-icon chunks" />;
      default:
        return <Loader size={32} className="phase-icon default spin-animation" />;
    }
  };

  return (
    <div className="loading-overlay">
      <div className="loading-overlay-backdrop" />
      <div className="loading-overlay-content">
        <div className="loading-animation-container">
          {getPhaseIcon()}
          <div className="loading-pulse-ring"></div>
        </div>
        
        <div className="loading-message-container">
          <h3 className="loading-title">{message}</h3>
          
          {details && (
            <p className="loading-details">{details}</p>
          )}
          
          {progress !== null && (
            <div className="progress-container">
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <span className="progress-text">{Math.round(progress)}%</span>
            </div>
          )}
          
          <div className="loading-spinner-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingOverlay;