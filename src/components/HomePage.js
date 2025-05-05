// src/components/HomePage.js
import React from 'react';
import NavBar from './NavBar';

const HomePage = () => {
  return (
    <div className="page-container">
      <h1>Home Page</h1>
      <p>Benvenuto nella piattaforma AI Tutor. Inizia a creare un nuovo progetto o visualizza quelli esistenti.</p>
      <NavBar></NavBar>
    </div>

  );
};

export default HomePage;