import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import HomePage from './components/HomePage';
import LoginPage from './components/LoginPage';
import CreateProject from './components/CreateProject';
import StudyPlanViewer from './components/StudyPlanViewer'; 
import ProjectsSummary from './components/ProjectsSummary';
// 1. RIMUOVI: DayTopicsSelector non serve più
// import DayTopicsSelector from './components/DayTopicsSelector'; 
import StudySession from './components/StudySession';
import useGoogleAuth from './hooks/useGoogleAuth';
import PlanReviewModal from './components/PlanReviewModal';
import SimpleLoading from './components/SimpleLoading';

// 2. AGGIUNGI: Importa il nuovo componente per la visualizzazione del singolo argomento
import TopicViewer from './components/TopicViewer';

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
            <Route path="/create-project" element={<CreateProject />} />
            <Route path="/projects" element={<ProjectsSummary />} />
            <Route path="/projects/:projectId/plan" element={<StudyPlanViewer />} />
            
            {/* 3. SOSTITUISCI: La vecchia rotta viene sostituita con quella nuova */}
            
            {/* VECCHIA ROTTA (da cancellare)
            <Route path="/projects/:projectId/day/:dayNum/topics" element={<DayTopicsSelector />} /> 
            */}
            
            {/* NUOVA ROTTA per il singolo argomento */}
            <Route path="/projects/:projectId/topic/:topicId" element={<TopicViewer />} />

            <Route path="/projects/:projectId/study/:topicId" element={<StudySession />} />
            <Route path="/plan-review" element={<PlanReviewModal />} />
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