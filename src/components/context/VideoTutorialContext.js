import React, { createContext, useState, useContext } from 'react';

// 1. Creare il Context
const VideoTutorialContext = createContext();

// 2. Creare il Provider (componente che gestisce lo stato)
export const VideoTutorialProvider = ({ children }) => {
  const [isVideoVisible, setIsVideoVisible] = useState(false);

  const showVideo = () => setIsVideoVisible(true);
  const hideVideo = () => setIsVideoVisible(false);

  const value = { isVideoVisible, showVideo, hideVideo };

  return (
    <VideoTutorialContext.Provider value={value}>
      {children}
    </VideoTutorialContext.Provider>
  );
};

// 3. Creare un custom hook per usare facilmente il context
export const useVideoTutorial = () => {
  return useContext(VideoTutorialContext);
};