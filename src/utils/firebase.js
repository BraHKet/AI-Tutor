// src/utils/firebase.js
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy
} from "firebase/firestore";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup,
  signOut,
} from "firebase/auth";

// Replace with your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDEvG7PnTdzMg5xF_xO-u97cjO4QF4rRaw",
  authDomain: "ai-tutor-b7897.firebaseapp.com",
  projectId: "ai-tutor-b7897",
  storageBucket: "ai-tutor-b7897.firebasestorage.app",
  messagingSenderId: "706674759570",
  appId: "1:706674759570:web:87614633401febbd21134b"
};
  
console.log('Firebase: Initializing Firebase with config');

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const provider = new GoogleAuthProvider();

console.log('Firebase: Firebase initialized successfully');

// Authentication helpers
export const signInWithGoogle = async () => {
  console.log('Firebase: signInWithGoogle called');
  try {
    console.log('Firebase: Starting Google sign-in popup...');
    const result = await signInWithPopup(auth, provider);
    console.log('Firebase: Sign-in successful, user:', result.user.email);
    
    // Log additional user info
    console.log('Firebase: User ID:', result.user.uid);
    console.log('Firebase: User Display Name:', result.user.displayName);
    
    return result.user;
  } catch (error) {
    console.error("Firebase: Error signing in with Google:", error);
    console.error("Firebase: Error code:", error.code);
    console.error("Firebase: Error message:", error.message);
    throw error;
  }
};

export const logoutUser = async () => {
  console.log('Firebase: logoutUser called');
  try {
    await signOut(auth);
    console.log('Firebase: User signed out successfully');
  } catch (error) {
    console.error("Firebase: Error signing out:", error);
    throw error;
  }
};

// Firestore helpers
export const createProject = async (projectData) => {
  console.log('Firebase: createProject called with data:', projectData);
  try {
    console.log("Firebase: Creating project in Firestore...");
    const docRef = await addDoc(collection(db, "projects"), projectData);
    console.log("Firebase: Project created successfully with ID:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("Firebase: Error creating project in Firestore:", error);
    console.error("Firebase: Error code:", error.code);
    console.error("Firebase: Error message:", error.message);
    throw error;
  }
};

export const updateProject = async (projectId, data) => {
  console.log('Firebase: updateProject called for ID:', projectId);
  console.log('Firebase: Update data:', data);
  try {
    const projectRef = doc(db, "projects", projectId);
    await updateDoc(projectRef, {
      ...data,
      updatedAt: new Date()
    });
    console.log('Firebase: Project updated successfully');
  } catch (error) {
    console.error("Firebase: Error updating project:", error);
    throw error;
  }
};

export const getUserProjects = async (userId) => {
  console.log('Firebase: getUserProjects called for userId:', userId);
  try {
    const projectsRef = collection(db, "projects");
    const q = query(
      projectsRef, 
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    );
    
    console.log('Firebase: Executing query for user projects...');
    const querySnapshot = await getDocs(q);
    console.log('Firebase: Found projects:', querySnapshot.size);
    
    const projects = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log('Firebase: Returning projects:', projects.length);
    return projects;
  } catch (error) {
    console.error("Firebase: Error getting user projects:", error);
    console.error("Firebase: Error code:", error.code);
    console.error("Firebase: Error message:", error.message);
    throw error;
  }
};

export const getProjectById = async (projectId) => {
  console.log('Firebase: getProjectById called for ID:', projectId);
  try {
    const projectRef = doc(db, "projects", projectId);
    const projectSnap = await getDoc(projectRef);
    
    if (projectSnap.exists()) {
      console.log('Firebase: Project found');
      return {
        id: projectSnap.id,
        ...projectSnap.data()
      };
    } else {
      console.log('Firebase: Project not found');
      throw new Error("Project not found");
    }
  } catch (error) {
    console.error("Firebase: Error getting project:", error);
    throw error;
  }
};

export const deleteProject = async (projectId) => {
  console.log('Firebase: deleteProject called for ID:', projectId);
  try {
    await deleteDoc(doc(db, "projects", projectId));
    console.log('Firebase: Project deleted successfully');
  } catch (error) {
    console.error("Firebase: Error deleting project:", error);
    throw error;
  }
};