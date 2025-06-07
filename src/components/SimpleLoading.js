// src/components/SimpleLoading.js
import React from 'react';
import './styles/SimpleLoading.css';

const SimpleLoading = ({ 
  message = "Caricamento...", 
  size = "medium",
  fullScreen = true 
}) => {
  const containerClass = fullScreen ? "simple-loading-fullscreen" : "simple-loading-inline";
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