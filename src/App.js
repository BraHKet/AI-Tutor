import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LoginPage from './components/LoginPage'
import HomePage from './components/HomePage'
import CreateProject from './components/CreateProject';

function App() {
  return (
    <Router>
      <div className="app-container">

        <main className="main-content">
          <Routes>
            <Route path="/" element={<LoginPage />} />
            <Route path="/homepage" element={<HomePage />} />
            <Route path="/projects" element={<HomePage />} />
            <Route path="/create-project" element={<CreateProject />} />
          </Routes>
        </main>

      </div>
    </Router>
  );
}

export default App;
