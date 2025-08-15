// src/components/VideoTutorialPlayer.jsx (Versione Finale SENZA ridimensionamento)

import React from 'react';
import { useVideoTutorial } from './context/VideoTutorialContext';
import './styles/VideoTutorialPlayer.css';

const VideoTutorialPlayer = () => {
  const { isVideoVisible, hideVideo } = useVideoTutorial();

  if (!isVideoVisible) {
    return null;
  }
  
  const videoId = "7dCg9Vc4_JI";
  const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=1`;

  return (
    // Il wrapper ora è controllato solo dal CSS
    <div className="video-player-wrapper">
      <div className="player-header">
        <span>Tutorial</span>
      </div>
      
      <button className="close-btn" onClick={hideVideo}>×</button>

      <div className="player-container">
        <iframe
          className="youtube-iframe"
          src={embedUrl}
          title="Tutorial Video"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        ></iframe>
      </div>
    </div>
  );
};

export default VideoTutorialPlayer;