// src/utils/gemini.js
import { GoogleGenerativeAI } from "@google/generative-ai";

// Funzione di inizializzazione
function initGeminiAI() {
  try {
    // Ottieni la chiave API dalle variabili d'ambiente
    const apiKey = process.env.REACT_APP_GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY;
    
    if (!apiKey) {
      console.error("Chiave API Gemini non trovata nelle variabili d'ambiente");
      return null;
    }
    
    // Inizializza l'API con la chiave
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Ottieni il modello (con gestione degli errori)
    try {
      // Prova con diversi nomi di modello (potrebbero cambiare nel tempo)
      // Le versioni possibili sono 'gemini-pro', 'gemini-1.0-pro', 'models/gemini-pro'
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
      console.log("Modello Gemini inizializzato con successo");
      return { genAI, model };
    } catch (modelError) {
      console.error("Errore nel caricamento del modello:", modelError);
      return null;
    }
  } catch (error) {
    console.error("Errore nell'inizializzazione di Gemini:", error);
    return null;
  }
}

// Inizializza il client Gemini
const geminiClient = initGeminiAI();

// Esporta le variabili (con fallback a null se l'inizializzazione fallisce)
export const genAI = geminiClient?.genAI || null;
export const model = geminiClient?.model || null;