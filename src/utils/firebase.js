// src/utils/firebase.js
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  setDoc, // Useremo setDoc per creare il documento progetto con ID generato
  writeBatch,
  serverTimestamp,
  // getDoc // Non più necessario qui
} from "firebase/firestore";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "firebase/auth";

// --- CONFIGURAZIONE FIREBASE ---
// !!! SOSTITUISCI CON I TUOI VALORI REALI DALLA FIREBASE CONSOLE !!!
const firebaseConfig = {
  apiKey: "AIzaSyDEvG7PnTdzMg5xF_xO-u97cjO4QF4rRaw",
  authDomain: "ai-tutor-b7897.firebaseapp.com",
  projectId: "ai-tutor-b7897",
  storageBucket: "ai-tutor-b7897.firebasestorage.app",
  messagingSenderId: "706674759570",
  appId: "1:706674759570:web:87614633401febbd21134b"
};
// -----------------------------

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();

export const signInWithGoogle = () => {
  return signInWithPopup(auth, provider);
};

export const logoutUser = () => {
  return signOut(auth);
};

// --- Funzione UNICA per Salvare Progetto e Piano FINALIZZATO ---
/**
 * Salva i dati principali del progetto e la sotto-collezione 'topics' completa
 * (con i riferimenti ai chunk) in Firestore usando un batch write.
 * @param {object} projectCoreData - Dati base progetto (title, examName, ..., dailyPlan map).
 * @param {Array<object>} finalTopicsData - Array di oggetti topic completi con sources aggiornate.
 * @returns {Promise<string>} - L'ID del progetto creato/salvato.
 * @throws {Error} - Se il salvataggio fallisce.
 */
export const saveProjectWithPlan = async (projectCoreData, finalTopicsData) => {
  const batch = writeBatch(db);
  // Genera un nuovo ID per il progetto ogni volta che questa funzione viene chiamata
  const newProjectRef = doc(collection(db, "projects"));
  const projectId = newProjectRef.id;

  console.log("Firebase/saveProjectWithPlan: Preparing batch write for FINAL plan. Project ID:", projectId);

  // 1. Set Project Document (con ID e stato 'generated')
  batch.set(newProjectRef, {
    ...projectCoreData,
    id: projectId, // Salva ID nel documento
    createdAt: serverTimestamp(),
    studyPlanStatus: 'generated', // Stato finale
    finalizedAt: serverTimestamp() // Timestamp finalizzazione
  });
  console.log(`Firebase/saveProjectWithPlan: Project document added to batch.`);

  // 2. Set Topic Documents in Subcollection
  if (finalTopicsData && finalTopicsData.length > 0) {
    const topicsCollectionRef = collection(db, "projects", projectId, "topics");
    finalTopicsData.forEach((topic) => {
      // Usa l'ID generato nell'orchestrator (ora in CreateProject)
      const topicRef = doc(topicsCollectionRef, topic.id);
      // Assicurati che l'ID sia salvato anche all'interno del documento topic
      const topicDataWithId = { ...topic, id: topicRef.id };
      batch.set(topicRef, topicDataWithId);
    });
    console.log(`Firebase/saveProjectWithPlan: Added ${finalTopicsData.length} topics to batch.`);
  } else {
     console.warn("Firebase/saveProjectWithPlan: No final topics data provided.");
  }

  // 3. Commit Batch
  try {
    await batch.commit();
    console.log(`Firebase/saveProjectWithPlan: Batch write successful. Final Project ID: ${projectId}`);
    return projectId; // Restituisce l'ID del progetto salvato
  } catch (error) {
    console.error(`Firebase/saveProjectWithPlan: Error committing batch write for final plan (Project ID: ${projectId}):`, error);
    throw new Error("Impossibile salvare il piano finalizzato su Firebase: " + error.message);
  }
};

// Esporta onAuthStateChanged se usato altrove
export { onAuthStateChanged };