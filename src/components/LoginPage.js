import React from 'react';
import useGoogleAuth from '../hooks/useGoogleAuth';
import './styles/LoginPage.css';

const LoginPage = () => {
  const { login } = useGoogleAuth();
  
  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-left">
          <div className="login-content">
            <h1 className="login-title">CIAO, sono il tuo Tutor!</h1>
            <p className="login-subtitle">Il mio compito è aiutarti a passare gli esami! Iniziamo?</p>
            
            <div className="social-login">
              <div className="social-buttons">
                <button className="social-button google" onClick={login}>
                  <img src="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg" alt="Google" />
                  <span>Login with google</span>
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <div className="login-right">
          <div className="person-container">
            <div className="person-card">
              <img src="/tutor-image.png" alt="Tutor" className="person-image" />
            </div>
            <div className="light-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L14.85 8.75L22 9.54L16.82 14.37L18.25 21.46L12 17.93L5.75 21.46L7.18 14.37L2 9.54L9.15 8.75L12 2Z"/>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;