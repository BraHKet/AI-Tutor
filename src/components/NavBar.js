// src/components/NavBar.js
import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Home, BookOpen, List, User } from 'lucide-react';
import './styles/NavBar.css';
import useGoogleAuth from '../hooks/useGoogleAuth';

const NavBar = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useGoogleAuth();

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    handleResize();
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/'); // Redirect to login page after logout
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const navItems = [
    { path: '/homepage', icon: <Home size={24} />, label: 'Home' },
    { path: '/create-project', icon: <BookOpen size={24} />, label: 'Crea Progetto' },
    { path: '/projects', icon: <List size={24} />, label: 'Riepilogo Progetti' },
  ];

  return (
    <nav className={`navbar ${isMobile ? 'mobile' : 'desktop'}`}>
      <div className="navbar-container">
        {!isMobile && (
          <div className="navbar-logo">
            <h2>AI Tutor</h2>
          </div>
        )}
        
        <div className="navbar-links">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => 
                isActive ? "nav-item active" : "nav-item"
              }
            >
              <div className="nav-icon">{item.icon}</div>
              {!isMobile && <span className="nav-label">{item.label}</span>}
            </NavLink>
          ))}
        </div>
        
        {!isMobile && user && (
          <div className="navbar-footer">
            <div className="user-info">
              <img 
                src={user.photoURL || 'https://via.placeholder.com/40'} 
                alt="User profile" 
                className="user-avatar"
              />
              <div className="user-details">
                <p className="user-name">{user.displayName || 'User'}</p>
                <p className="user-email">{user.email}</p>
              </div>
            </div>
            <button className="logout-btn" onClick={handleLogout}>
              Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};

export default NavBar;