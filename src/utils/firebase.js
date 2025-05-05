// src/utils/firebase.js
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  setDoc,
  writeBatch,
  serverTimestamp // Usiamo serverTimestamp per createdAt
} from "firebase/firestore";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged // Esportiamolo per l'hook
} from "firebase/auth";

// --- CONFIGURAZIONE FIREBASE ---
// !!! SOSTITUISCI CON I TUOI VALORI REALI DALLA FIREBASE CONSOLE !!!
// In particolare, assicurati che 'apiKey' sia ESATTAMENTE quella della tua app web Firebase.
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

// Google Auth Provider
const provider = new GoogleAuthProvider();

export const signInWithGoogle = () => {
  // Potresti aggiungere scope qui se necessario, ma solitamente non per il solo login
  // provider.addScope('https://www.googleapis.com/auth/drive.file'); // Esempio - NON necessario se usi GSI per Drive
  return signInWithPopup(auth, provider);
};

export const logoutUser = () => {
  return signOut(auth);
};

// --- Funzione per Salvare Progetto e Piano (Nuova) ---
/**
 * Salva i dati principali del progetto e la struttura del piano (topics) in Firestore.
 * Usa un batch write per garantire l'atomicità.
 * @param {object} projectCoreData - Dati base del progetto (title, examName, totalDays, userId, originalFiles, etc.).
 * @param {Array<object>} topicsData - Array di oggetti topic da salvare nella sotto-collezione.
 * @returns {Promise<string>} - L'ID del progetto creato.
 * @throws {Error} - Se il salvataggio fallisce.
 */
export const saveProjectWithPlan = async (projectCoreData, topicsData) => {
  const batch = writeBatch(db);
  const newProjectRef = doc(collection(db, "projects")); // Genera ref con nuovo ID

  console.log("Firebase: Preparing batch write. Project ID:", newProjectRef.id);

  // 1. Set Project Document
  batch.set(newProjectRef, {
    ...projectCoreData,
    id: newProjectRef.id, // Salva ID nel documento
    createdAt: serverTimestamp(), // Orario del server
    studyPlanStatus: 'generated'
  });

  // 2. Set Topic Documents in Subcollection
  if (topicsData && topicsData.length > 0) {
    const topicsCollectionRef = collection(db, "projects", newProjectRef.id, "topics");
    topicsData.forEach((topic) => {
      // Usa l'ID già generato nell'orchestrator se presente, altrimenti genera nuovo ref
      const topicRef = topic.id ? doc(topicsCollectionRef, topic.id) : doc(topicsCollectionRef);
       // Assicurati che l'ID sia salvato nel documento topic, anche se ne generiamo uno nuovo qui
       const topicDataWithId = { ...topic, id: topicRef.id };
       batch.set(topicRef, topicDataWithId);
    });
    console.log(`Firebase: Added ${topicsData.length} topics to batch.`);
  } else {
     console.warn("Firebase: No topics data provided to saveProjectWithPlan.");
  }

  // 3. Commit Batch
  try {
    await batch.commit();
    console.log("Firebase: Batch write successful. Project ID:", newProjectRef.id);
    return newProjectRef.id; // Restituisci l'ID del progetto
  } catch (error) {
    console.error("Firebase: Error committing batch write:", error);
    throw new Error("Impossibile salvare il piano completo su Firebase: " + error.message);
  }
};


// --- Vecchia Funzione (deprecata per i piani AI) ---
/**
 * @deprecated Use saveProjectWithPlan for projects with AI-generated plans.
 */
export const createProject = async (projectData) => {
  console.warn("Firebase: Using deprecated createProject function.");
  try {
    const docRef = await addDoc(collection(db, "projects"), {
      ...projectData,
      createdAt: serverTimestamp()
    });
    console.log("Firebase: (Deprecated) Project document written with ID: ", docRef.id);
    return docRef.id;
  } catch (e) {
    console.error("Firebase: (Deprecated) Error adding project document: ", e);
    throw new Error("Impossibile salvare il progetto su Firebase (vecchia funzione).");
  }
};

// Esporta onAuthStateChanged per l'hook useGoogleAuth
export { onAuthStateChanged };