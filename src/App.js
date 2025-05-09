// App.js 
import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import HomePage from './components/HomePage';
import LoginPage from './components/LoginPage';
import CreateProject from './components/CreateProject';
import StudyPlanViewer from './components/StudyPlanViewer'; 
import ProjectsSummary from './components/ProjectsSummary'; // Importa il nuovo componente
import useGoogleAuth from './hooks/useGoogleAuth';
import PlanReviewModal from './components/PlanReviewModal';

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
        
        {/* Rotta per il riepilogo progetti */}
        <Route path="/projects" element={<ProjectsSummary />} />
        
        {/* Rotta per visualizzare il piano */}
        <Route path="/projects/:projectId/plan" element={<StudyPlanViewer />} />
        
        {/* Rotta per la revisione del piano */}
        <Route path="/plan-review" element={<PlanReviewModal />} />

        {/* Fallback o redirect se necessario */}
        <Route path="*" element={<Navigate to={user ? "/" : "/login"} replace />} />
      </Routes>
    </Router>
  );
}

export default App;