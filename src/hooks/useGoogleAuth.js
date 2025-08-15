// src/hooks/useGoogleAuth.js (NUOVA VERSIONE SICURA E INTEGRATA)

import { useEffect, useState } from 'react';
import { auth, signInWithCode, logoutUser } from '../utils/firebase'; // Useremo le nostre nuove funzioni
import { useGoogleLogin } from '@react-oauth/google';

const useGoogleAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Questo useEffect rimane identico. È perfetto perché ascolta lo stato di
  // autenticazione di Firebase, indipendentemente da come è avvenuto il login.
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // --- MODIFICA CHIAVE: LA NUOVA FUNZIONE DI LOGIN ---
  // Questa funzione ora orchestra il flusso sicuro che abbiamo costruito.
  const login = useGoogleLogin({
    // 1. Al successo, Google ci dà un 'code' temporaneo.
    onSuccess: async (codeResponse) => {
      setLoading(true);
      try {
        // 2. Passiamo questo 'code' alla nostra funzione sicura in firebase.js
        //    che parlerà con il backend Vercel.
        await signInWithCode(codeResponse.code);
        // 3. L'useEffect sopra rileverà il nuovo utente e aggiornerà lo stato.
      } catch (error) {
        console.error("Login fallito durante lo scambio del codice:", error);
        setLoading(false); // Assicurati di fermare il caricamento in caso di errore
      }
    },
    onError: (error) => {
      console.error("Errore nel popup di login di Google:", error);
      setLoading(false);
    },
    // 4. Specifichiamo il flusso "auth-code", che è quello sicuro.
    flow: 'auth-code',
  });

  // La funzione di logout rimane quasi uguale, ma usiamo quella aggiornata
  // dal nostro file firebase.js per pulire tutto.
  const logout = async () => {
    try {
      setLoading(true);
      await logoutUser();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setLoading(false);
    }
  };

  // Restituiamo l'hook con la nuova funzione di login.
  // Il nome è sempre 'login', quindi non dovrai cambiare nulla
  // nel componente LoginPage.
  return { user, loading, login, logout };
};

export default useGoogleAuth;