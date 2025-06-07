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

export const logoutUser = () => {
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