// src/components/SimpleLoading.js
import React from 'react';
import './styles/SimpleLoading.css';

const SimpleLoading = ({ 
  message = "Caricamento...", 
  size = "medium",
  fullScreen = true,
  darkMode = false // Aggiunta una prop per attivare la dark mode
}) => {
  let containerClass = fullScreen ? "simple-loading-fullscreen" : "simple-loading-inline";
  
  // Aggiungi la classe 'dark' se fullScreen e darkMode sono attivi
  if (fullScreen && darkMode) {
    containerClass += " dark";
  }

  const spinnerSize = size === "small" ? "small" : size === "large" ? "large" : "medium";

  return (
    <div className={containerClass}>
      <div className="simple-loading-content">
        <div className={`simple-spinner ${spinnerSize}`}>
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
        </div>
        {message && (
          <p className="simple-loading-message">{message}</p>
        )}
      </div>
    </div>
  );
};

export default SimpleLoading;