import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { GoogleOAuthProvider } from '@react-oauth/google';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  //<React.StrictMode>
     <GoogleOAuthProvider clientId="954741971381-4qtl2v6f4b2iebt23kd827sumf6d31dg.apps.googleusercontent.com">
      <App />
    </GoogleOAuthProvider>
  //</React.StrictMode>
);

