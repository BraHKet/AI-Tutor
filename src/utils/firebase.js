// src/utils/firebase.js (VERSIONE FINALE - MINIMAL CHANGE)

import {
  signInWithCredential, // Useremo questo per il login finale   


} from "firebase/auth";

// Installa questa dipendenza: npm install @react-oauth/google
import { googleLogout } from '@react-oauth/google';




// src/utils/firebase.js - Aggiunto metodo per eliminazione progetti

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  writeBatch,
  serverTimestamp,
  deleteDoc,
  getDocs
} from "firebase/firestore";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "firebase/auth";

// --- CONFIGURAZIONE FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyDEvG7PnTdzMg5xF_xO-u97cjO4QF4rRaw",
  authDomain: "ai-tutor-b7897.firebaseapp.com",
  projectId: "ai-tutor-b7897",
  storageBucket: "ai-tutor-b7897.firebasestorage.app",
  messagingSenderId: "706674759570",
  appId: "1:706674759570:web:87614633401febbd21134b"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();

export const signInWithGoogle = () => {
  return signInWithPopup(auth, provider);
};



/**
 * Esegue il login sicuro tramite backend.
 * @param {function} onCodeResponse - La funzione che riceve il codice da Google.
 */
export const getGoogleAuthCode = (onCodeResponse) => {
  // Questa funzione apre il popup di Google e restituisce un codice temporaneo.
  // Usa una libreria specifica per questo flusso.
  // Dovrai installarla: npm install @react-oauth/google
  // E configurare il GoogleOAuthProvider nel tuo file index.js o App.js
};

/**
 * Funzione che orchestra il login sicuro.
 * 1. Ottiene un codice temporaneo dal frontend.
 * 2. Lo invia al backend Vercel per scambiarlo con i token.
 * 3. Usa i token per autenticare l'utente su Firebase.
 * @param {string} code - Il codice di autorizzazione di Google.
 */
export const signInWithCode = async (code) => {
  try {
    // 1. Invia il codice al nostro backend sicuro
    const response = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });

    if (!response.ok) {
      throw new Error('Failed to exchange code with backend.');
    }

    const { idToken } = await response.json();

    if (!idToken) {
      throw new Error('idToken not received from backend.');
    }

    // 2. Crea una credenziale Google usando l'idToken ricevuto dal backend
    const credential = GoogleAuthProvider.credential(idToken);

    // 3. Autentica l'utente su Firebase con questa credenziale sicura
    return await signInWithCredential(auth, credential);

  } catch (error) {
    console.error("Error during secure sign-in:", error);
    throw error;
  }
};






export const logoutUser = () => {
  // Usa googleLogout per assicurarti che anche la sessione Google sia terminata
  googleLogout();
  return signOut(auth);
};

// --- Salva progetto e piano ---
export const saveProjectWithPlan = async (projectCoreData, finalTopicsData) => {
  const batch = writeBatch(db);
  const newProjectRef = doc(collection(db, "projects"));
  const projectId = newProjectRef.id;

  console.log("Firebase/saveProjectWithPlan: Preparing batch write for FINAL plan. Project ID:", projectId);

  batch.set(newProjectRef, {
    ...projectCoreData,
    id: projectId,
    createdAt: serverTimestamp(),
    studyPlanStatus: 'generated',
    finalizedAt: serverTimestamp()
  });
  console.log(`Firebase/saveProjectWithPlan: Project document added to batch.`);

  if (finalTopicsData && finalTopicsData.length > 0) {
    const topicsCollectionRef = collection(db, "projects", projectId, "topics");
    finalTopicsData.forEach((topic) => {
      const topicRef = doc(topicsCollectionRef, topic.id);
      const topicDataWithId = { ...topic, id: topicRef.id };
      batch.set(topicRef, topicDataWithId);
    });
    console.log(`Firebase/saveProjectWithPlan: Added ${finalTopicsData.length} topics to batch.`);
  } else {
     console.warn("Firebase/saveProjectWithPlan: No final topics data provided.");
  }

  try {
    await batch.commit();
    console.log(`Firebase/saveProjectWithPlan: Batch write successful. Final Project ID: ${projectId}`);
    return projectId;
  } catch (error) {
    console.error(`Firebase/saveProjectWithPlan: Error committing batch write for final plan (Project ID: ${projectId}):`, error);
    throw new Error("Impossibile salvare il piano finalizzato su Firebase: " + error.message);
  }
};

// --- NUOVO: Elimina progetto completo ---
export const deleteProject = async (projectId) => {
  console.log(`Firebase/deleteProject: Starting deletion for project ID: ${projectId}`);
  
  try {
    const batch = writeBatch(db);
    
    // 1. Elimina tutti i topics nella sottocollezione
    const topicsCollectionRef = collection(db, "projects", projectId, "topics");
    const topicsSnapshot = await getDocs(topicsCollectionRef);
    
    console.log(`Firebase/deleteProject: Found ${topicsSnapshot.docs.length} topics to delete`);
    
    topicsSnapshot.docs.forEach((topicDoc) => {
      batch.delete(topicDoc.ref);
    });
    
    // 2. Elimina il documento principale del progetto
    const projectRef = doc(db, "projects", projectId);
    batch.delete(projectRef);
    
    // 3. Esegui la cancellazione batch
    await batch.commit();
    
    console.log(`Firebase/deleteProject: Project ${projectId} and all topics deleted successfully`);
    return true;
    
  } catch (error) {
    console.error(`Firebase/deleteProject: Error deleting project ${projectId}:`, error);
    throw new Error("Impossibile eliminare il progetto: " + error.message);
  }
};

// Esporta onAuthStateChanged se usato altrove
export { onAuthStateChanged };