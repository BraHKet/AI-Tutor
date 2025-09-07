import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import LoginPage from './components/LoginPage';
// 1. RIMUOVI: DayTopicsSelector non serve più
// import DayTopicsSelector from './components/DayTopicsSelector'; 
import useGoogleAuth from './hooks/useGoogleAuth';
import SimpleLoading from './components/SimpleLoading';
import AgentDemo from './components/AgentDemo'
import { PdfProvider } from "./context/PdfContext";
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
    <PdfProvider>
    <Router>
      <Routes>
        
        <Route path="/" element={
            user ? <Navigate to="/exam" replace /> : <LoginPage />
          } />
        {/* Routes protette */}
        {user && (
          <Route path="/exam" element={<AgentDemo />} />
        )}

        {/* Fallback per route non esistenti */}
        <Route path="*" element={
          <Navigate to={user ? "/exam" : "/"} replace />
        } />
      </Routes>
    </Router> 
    </PdfProvider>
  );
}

export default App;