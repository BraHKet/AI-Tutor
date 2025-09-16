// FILE: src/components/CustomCursor.js

import React from 'react';
import styles from './styles/overlays.module.css'; // Useremo lo stesso file CSS

export default function CustomCursor({ position }) {
  // Calcoliamo la circonferenza del cerchio per l'animazione
  // Raggio (r) = 14, SVG è 32x32, quindi c'è 2px di padding
  const radius = 14;
  const circumference = 2 * Math.PI * radius;

  return (
    <div
      className={styles.customCursor}
      style={{
        top: `${position.y}px`,
        left: `${position.x}px`,
      }}
    >
      <svg width="32" height="32" viewBox="0 0 32 32">
        {/* Cerchio di sfondo, grigio chiaro */}
        <circle
          cx="16" cy="16" r={radius}
          stroke="#e5e7eb"
          strokeWidth="3"
          fill="transparent"
        />
        {/* Cerchio di progresso, animato */}
        <circle
          className={styles.progressCircle}
          cx="16" cy="16" r={radius}
          stroke="#4f46e5" // Colore indaco
          strokeWidth="3"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={circumference} // Inizia "vuoto"
        />
      </svg>
    </div>
  );
}