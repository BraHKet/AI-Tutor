// Esempio in App.js (adatta alla tua struttura)
import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import HomePage from './components/HomePage';
import LoginPage from './components/LoginPage';
import CreateProject from './components/CreateProject';
import StudyPlanViewer from './components/StudyPlanViewer'; // Importa il nuovo componente
import useGoogleAuth from './hooks/useGoogleAuth'; // Per la logica di PrivateRoute

function App() {
  const { user, loading } = useGoogleAuth();

  if (loading) {
    return <div>Loading...</div>; // O uno spinner migliore
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Routes protette */}
        <Route path="/" element={<HomePage />} />
        <Route path="/create-project" element={<CreateProject />} />
        <Route path="/projects" element={<HomePage />} />
        {/* NUOVA ROTTA per visualizzare il piano */}
        <Route path="/projects/:projectId/plan" element={<StudyPlanViewer />} />

        {/* Fallback o redirect se necessario */}
        <Route path="*" element={<Navigate to={user ? "/" : "/login"} replace />} />
      </Routes>
    </Router>
  );
}

export default App;