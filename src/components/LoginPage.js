// src/components/LoginPage.js
import React from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { signInWithCode } from '../utils/firebase'; // La nostra nuova funzione sicura

const LoginPage = () => {
  const login = useGoogleLogin({
    onSuccess: async (codeResponse) => {
      try {
        // Passiamo il codice alla nostra funzione sicura che parlerà con il backend
        await signInWithCode(codeResponse.code);
        // Il redirect verrà gestito da App.js o da un hook
      } catch (error) {
        console.error("Login failed after code exchange:", error);
      }
    },
    flow: 'auth-code', // Questo è il flusso sicuro!
  });

  return <button onClick={() => login()}>Accedi con Google</button>;
};

export default LoginPage;