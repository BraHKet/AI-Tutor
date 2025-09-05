import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import HomePage from './components/HomePage';
import LoginPage from './components/LoginPage';
// 1. RIMUOVI: DayTopicsSelector non serve più
// import DayTopicsSelector from './components/DayTopicsSelector'; 
import useGoogleAuth from './hooks/useGoogleAuth';
import SimpleLoading from './components/SimpleLoading';
import AgentDemo from './components/AgentDemo'
// 2. AGGIUNGI: Importa il nuovo componente per la visualizzazione del singolo argomento
// Importa il Context Provider e il Player

function App() {
  const { user, loading } = useGoogleAuth();

  if (loading) {
    return (
      <SimpleLoading 
        message="Inizializzazione..." 
        size="medium"
        fullScreen={true}
      />
    );
  }

  return (
    <Router>
      <Routes>
        {/* Route pubblica di login */}
        <Route path="/" element={
          user ? <Navigate to="/homepage" replace /> : <LoginPage />
        } />

        {/* Routes protette - accessibili solo se autenticati */}
        {user ? (
          <>
            <Route path="/homepage" element={<HomePage />} />


            {/* NUOVA ROTTA per l'agente */}
            {/* Gli passiamo projectId e topicId per sapere quale PDF caricare */}
            <Route path="/projects/:projectId/topic/:topicId/exam" element={<AgentDemo />} />
          </>
        ) : (
          /* Se non autenticato, redirect alla login */
          <Route path="*" element={<Navigate to="/" replace />} />
        )}

        {/* Fallback per routes non esistenti */}
        <Route path="*" element={
          <Navigate to={user ? "/homepage" : "/"} replace />
        } />
      </Routes>
    </Router>
  );
}

export default App;