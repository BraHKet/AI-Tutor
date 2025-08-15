// src/components/TutorialButton.jsx

import React from 'react';
import { useLocation } from 'react-router-dom';
import { useVideoTutorial } from './context/VideoTutorialContext';
import styles from './styles/TutorialButton.module.css';

const TutorialButton = () => {
  const { isVideoVisible, showVideo } = useVideoTutorial();
  const location = useLocation();

  if (isVideoVisible || location.pathname === '/') {
    return null;
  }

  return (
    <button
      className={styles.fab}
      onClick={showVideo}
      title="Guarda il tutorial"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    </button>
  );
};

export default TutorialButton;